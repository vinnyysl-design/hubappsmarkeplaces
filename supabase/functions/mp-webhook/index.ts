/**
 * Edge Function: mp-webhook
 *
 * Trata notificações do Mercado Pago:
 *
 * 1) topic = "preapproval" → status da assinatura recorrente mudou
 *    (pending → authorized → paused/cancelled). Atualiza profiles.
 *
 * 2) topic = "authorized_payment" (ou "subscription_authorized_payment")
 *    → cobrança mensal recorrente aprovada/rejeitada. Registra em payments
 *    e estende next_due_date.
 *
 * 3) topic = "payment" → pagamento único (packs de imagem) — fluxo legado.
 *
 * Endpoint público (sem JWT).
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const IMAGE_TOOL_WEBHOOK =
  "https://geradordeimagens.analyticalx.com.br/api/public/hub/credits";

const PACK_USES: Record<string, number> = {
  "pack-5": 5,
  "pack-8": 8,
  "pack-10": 10,
  "pack-20": 20,
};

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const HUB_WEBHOOK_SECRET = Deno.env.get("HUB_WEBHOOK_SECRET");

    if (!MP_TOKEN) return json({ ok: false, error: "missing_token" }, 500);

    const url = new URL(req.url);
    let resourceId =
      url.searchParams.get("data.id") || url.searchParams.get("id") || null;
    let topic =
      url.searchParams.get("type") || url.searchParams.get("topic") || null;

    let body: any = null;
    if (req.method === "POST") {
      body = await req.json().catch(() => null);
      if (body) {
        resourceId = body?.data?.id ?? body?.id ?? resourceId;
        topic = body?.type ?? body?.topic ?? topic;
      }
    }
    const topicStr = String(topic ?? "").toLowerCase();
    console.log("MP webhook:", { topic: topicStr, resourceId });

    if (!resourceId) return json({ ok: true, ignored: true });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const mpHeaders = { Authorization: `Bearer ${MP_TOKEN}` };

    // ==================== PREAPPROVAL (status assinatura) ====================
    if (topicStr.includes("preapproval") && !topicStr.includes("authorized")) {
      const r = await fetch(`https://api.mercadopago.com/preapproval/${resourceId}`, {
        headers: mpHeaders,
      });
      if (!r.ok) {
        console.error("preapproval lookup failed", r.status, await r.text());
        return json({ ok: false, error: "lookup_failed" });
      }
      const pre = await r.json();
      const status = String(pre?.status ?? "");
      const ext = String(pre?.external_reference ?? "");
      const userId = ext.split("|")[0] || null;
      const planId = ext.split("|")[1] || null;
      const startDate = pre?.auto_recurring?.start_date ?? null;
      const endDate = pre?.auto_recurring?.end_date ?? null;

      if (!userId) return json({ ok: false, error: "no_user_id" });

      const patch: Record<string, unknown> = {
        mp_preapproval_id: String(resourceId),
        mp_preapproval_status: status,
      };
      if (planId) patch.subscription_plan_id = planId;
      if (startDate) patch.subscription_started_at = startDate;
      if (endDate) patch.subscription_ends_at = endDate;

      if (status === "authorized") {
        patch.plan = "pagante";
        patch.status = "ativo";
      } else if (status === "cancelled" || status === "paused") {
        // Cartão cancelado / assinatura pausada → bloqueia
        patch.status = "bloqueado";
      }

      const { error: upErr } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", userId);
      if (upErr) console.error("profile update error", upErr);

      // Ao autorizar, garante vigência (next_due_date) para não bloquear o pagante
      if (status === "authorized") {
        const { data: last } = await supabase
          .from("payments")
          .select("id, next_due_date")
          .eq("user_id", userId)
          .order("next_due_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        const today = new Date();
        if (!last?.next_due_date || new Date(last.next_due_date as string) < today) {
          const next = new Date();
          next.setDate(next.getDate() + 31);
          await supabase.from("payments").insert({
            user_id: userId,
            amount: Number(pre?.auto_recurring?.transaction_amount ?? 0),
            paid_at: today.toISOString().slice(0, 10),
            next_due_date: next.toISOString().slice(0, 10),
            mp_preapproval_id: String(resourceId),
            payment_method: "recurring_card",
            notes: `Assinatura autorizada (plano ${planId ?? "?"})`,
          });
        }
      }

      return json({ ok: true, kind: "preapproval", status });
    }

    // ================== AUTHORIZED PAYMENT (cobrança mensal) ==================
    if (topicStr.includes("authorized_payment") || topicStr.includes("subscription_authorized_payment")) {
      const r = await fetch(
        `https://api.mercadopago.com/authorized_payments/${resourceId}`,
        { headers: mpHeaders },
      );
      if (!r.ok) {
        console.error("authorized_payment lookup failed", r.status, await r.text());
        return json({ ok: false, error: "lookup_failed" });
      }
      const ap = await r.json();
      const status = String(ap?.status ?? "");
      const paymentStatus = String(ap?.payment?.status ?? ap?.status ?? "");
      const preapprovalId = String(ap?.preapproval_id ?? "");
      const amount = Number(ap?.transaction_amount ?? 0);
      const paymentId = ap?.payment?.id ?? ap?.id ?? resourceId;

      // Localiza usuário pelo preapproval_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, subscription_plan_id")
        .eq("mp_preapproval_id", preapprovalId)
        .maybeSingle();

      if (!profile?.id) {
        console.error("authorized_payment: profile not found", preapprovalId);
        return json({ ok: false, error: "profile_not_found" });
      }

      // Falha na cobrança → bloqueia
      if (paymentStatus === "rejected" || status === "rejected" || status === "recycling") {
        await supabase
          .from("profiles")
          .update({ status: "bloqueado" })
          .eq("id", profile.id);
        return json({ ok: true, kind: "authorized_payment", blocked: true, status: paymentStatus });
      }

      if (paymentStatus !== "approved" && status !== "processed") {
        return json({ ok: true, kind: "authorized_payment", status: paymentStatus, skipped: true });
      }

      // Idempotência: não duplica pagamento
      const { data: existing } = await supabase
        .from("payments")
        .select("id")
        .eq("mp_authorized_payment_id", String(resourceId))
        .maybeSingle();
      if (existing) return json({ ok: true, duplicate: true });

      const today = new Date().toISOString().slice(0, 10);
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + 30);
      const nextDueStr = nextDue.toISOString().slice(0, 10);

      const { error: insErr } = await supabase.from("payments").insert({
        user_id: profile.id,
        amount,
        paid_at: today,
        next_due_date: nextDueStr,
        mp_payment_id: paymentId ? String(paymentId) : null,
        mp_authorized_payment_id: String(resourceId),
        mp_preapproval_id: preapprovalId,
        payment_method: "recurring_card",
        notes: `Cobrança recorrente (plano ${profile.subscription_plan_id ?? "?"})`,
      });
      if (insErr) console.error("insert recurring payment error", insErr);

      await supabase
        .from("profiles")
        .update({ status: "ativo", plan: "pagante" })
        .eq("id", profile.id);

      return json({ ok: true, kind: "authorized_payment", recorded: true });
    }

    // ==================== PAYMENT ÚNICO (packs de imagem) ====================
    if (topicStr.includes("payment")) {
      const mpRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${resourceId}`,
        { headers: mpHeaders },
      );
      if (!mpRes.ok) {
        const txt = await mpRes.text();
        console.error("MP payment lookup failed:", mpRes.status, txt);
        return json({ ok: false, error: "lookup_failed" });
      }
      const payment = await mpRes.json();
      const status = payment?.status;
      const userId = payment?.external_reference || payment?.metadata?.user_id || null;
      const amount = Number(payment?.transaction_amount ?? 0);
      const method = payment?.payment_method_id ?? payment?.payment_type_id ?? null;
      const metadata = payment?.metadata ?? {};
      const kind = String(metadata?.kind ?? "");

      if (status !== "approved") return json({ ok: true, status });

      // Apenas trata packs — assinatura agora é via preapproval
      if (kind !== "image_pack") {
        return json({ ok: true, ignored: true, reason: "not_pack" });
      }

      const packId = String(metadata?.pack_id ?? "");
      const uses = Number(metadata?.uses) || PACK_USES[packId] || 0;

      let email = String(metadata?.email ?? "") || null;
      if (!email && userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", userId)
          .maybeSingle();
        email = profile?.email ?? null;
      }
      if (!email && payment?.payer?.email) email = payment.payer.email;

      if (!email || !uses) return json({ ok: false, error: "invalid_pack_data" });
      if (!HUB_WEBHOOK_SECRET) return json({ ok: false, error: "missing_secret" });

      const payload = { event_id: `mp-payment-${resourceId}`, email, uses };
      const rawBody = JSON.stringify(payload);
      const signature = await hmacHex(HUB_WEBHOOK_SECRET, rawBody);

      const credRes = await fetch(IMAGE_TOOL_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hub-signature": signature },
        body: rawBody,
      });
      const credText = await credRes.text();
      console.log("Image pack credit response:", credRes.status, credText);
      if (!credRes.ok) {
        return json({ ok: false, error: "credit_failed", status: credRes.status, body: credText });
      }
      return json({ ok: true, credited: uses, pack: packId, email });
    }

    return json({ ok: true, ignored: true, topic: topicStr });
  } catch (err) {
    console.error("mp-webhook error:", err);
    return json({ ok: false, error: String(err) });
  }
});
