/**
 * Edge Function: sync-mp-subscription
 *
 * Consulta o Mercado Pago e sincroniza o estado da assinatura recorrente
 * do usuário autenticado (ou de um preapproval_id informado).
 *
 * Usada como rede de segurança quando o webhook do MP não chega:
 *  - promove o usuário para "pagante"/"ativo" quando o preapproval está authorized
 *  - garante um registro em payments com next_due_date (senão enforce_trial_status bloqueia)
 *  - bloqueia quando cancelled/paused
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_TOKEN) return json({ error: "missing_mp_token" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await anon.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: profile } = await admin
      .from("profiles")
      .select("id, mp_preapproval_id, subscription_plan_id")
      .eq("id", userId)
      .maybeSingle();

    const preapprovalId =
      (typeof body?.preapproval_id === "string" && body.preapproval_id) ||
      profile?.mp_preapproval_id ||
      null;

    if (!preapprovalId) return json({ ok: true, no_subscription: true });

    const r = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error("preapproval lookup failed", r.status, txt);
      return json({ ok: false, error: "lookup_failed" }, 502);
    }
    const pre = await r.json();

    // Segurança: o preapproval precisa pertencer a este usuário
    const ext = String(pre?.external_reference ?? "");
    const extUser = ext.split("|")[0] || null;
    if (extUser && extUser !== userId) return json({ error: "forbidden" }, 403);

    const status = String(pre?.status ?? "");
    const planId = ext.split("|")[1] || profile?.subscription_plan_id || null;
    const amount = Number(pre?.auto_recurring?.transaction_amount ?? 0);

    const patch: Record<string, unknown> = {
      mp_preapproval_id: String(preapprovalId),
      mp_preapproval_status: status,
    };
    if (planId) patch.subscription_plan_id = planId;
    if (pre?.auto_recurring?.start_date) patch.subscription_started_at = pre.auto_recurring.start_date;
    if (pre?.auto_recurring?.end_date) patch.subscription_ends_at = pre.auto_recurring.end_date;

    if (status === "authorized") {
      patch.plan = "pagante";
      patch.status = "ativo";
    } else if (status === "cancelled" || status === "paused") {
      patch.status = "bloqueado";
    }

    await admin.from("profiles").update(patch).eq("id", userId);

    // Garante vigência (next_due_date) para o usuário pagante
    if (status === "authorized") {
      const { data: last } = await admin
        .from("payments")
        .select("id, next_due_date")
        .eq("user_id", userId)
        .order("next_due_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const today = new Date();
      const needsGrant =
        !last?.next_due_date || new Date(last.next_due_date as string) < today;

      if (needsGrant) {
        const next = new Date();
        next.setDate(next.getDate() + 31);
        await admin.from("payments").insert({
          user_id: userId,
          amount,
          paid_at: today.toISOString().slice(0, 10),
          next_due_date: next.toISOString().slice(0, 10),
          mp_preapproval_id: String(preapprovalId),
          payment_method: "recurring_card",
          notes: `Assinatura autorizada (plano ${planId ?? "?"}) — liberação automática`,
        });
      }
    }

    return json({ ok: true, status, plan_id: planId });
  } catch (err) {
    console.error("sync-mp-subscription error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
