/**
 * Edge Function: mp-subscriptions-cron
 *
 * Reconciliação diária das assinaturas recorrentes do Mercado Pago.
 * Não depende de webhook: varre todos os perfis com mp_preapproval_id e
 *  - atualiza o status da assinatura (authorized / paused / cancelled)
 *  - importa as cobranças mensais aprovadas (authorized_payments) que faltam
 *  - estende a vigência (next_due_date) ou bloqueia o acesso
 *
 * Protegida por header x-cron-secret (HUB_WEBHOOK_SECRET) ou service role.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  const CRON_SECRET = Deno.env.get("HUB_WEBHOOK_SECRET");

  const auth = req.headers.get("Authorization") ?? "";
  const cronHeader = req.headers.get("x-cron-secret") ?? "";
  const authorized =
    (CRON_SECRET && cronHeader === CRON_SECRET) || auth === `Bearer ${SERVICE_KEY}`;
  if (!authorized) return json({ error: "unauthorized" }, 401);
  if (!MP_TOKEN) return json({ error: "missing_mp_token" }, 500);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const mpHeaders = { Authorization: `Bearer ${MP_TOKEN}` };

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, mp_preapproval_id, subscription_plan_id")
    .not("mp_preapproval_id", "is", null);

  const results: unknown[] = [];

  for (const p of profiles ?? []) {
    try {
      const r = await fetch(
        `https://api.mercadopago.com/preapproval/${p.mp_preapproval_id}`,
        { headers: mpHeaders },
      );
      if (!r.ok) {
        results.push({ user: p.id, error: "lookup_failed", status: r.status });
        continue;
      }
      const pre = await r.json();
      const status = String(pre?.status ?? "");
      const amount = Number(pre?.auto_recurring?.transaction_amount ?? 0);

      const patch: Record<string, unknown> = { mp_preapproval_status: status };
      if (status === "authorized") {
        patch.plan = "pagante";
      } else if (status === "cancelled" || status === "paused") {
        patch.status = "bloqueado";
      }
      await supabase.from("profiles").update(patch).eq("id", p.id);

      if (status !== "authorized") {
        results.push({ user: p.id, status });
        continue;
      }

      // Importa cobranças mensais aprovadas ainda não registradas
      const sRes = await fetch(
        `https://api.mercadopago.com/authorized_payments/search?preapproval_id=${p.mp_preapproval_id}`,
        { headers: mpHeaders },
      );
      let imported = 0;
      if (sRes.ok) {
        const list = await sRes.json();
        const items: any[] = list?.results ?? list?.elements ?? [];
        for (const ap of items) {
          const apId = String(ap?.id ?? "");
          const apStatus = String(ap?.payment?.status ?? ap?.status ?? "");
          if (!apId) continue;
          if (apStatus !== "approved" && apStatus !== "processed") continue;

          const { data: exists } = await supabase
            .from("payments")
            .select("id")
            .eq("mp_authorized_payment_id", apId)
            .maybeSingle();
          if (exists) continue;

          const paidAt = (ap?.payment?.date_approved ?? ap?.date_created ?? new Date().toISOString())
            .slice(0, 10);
          const next = new Date(paidAt);
          next.setDate(next.getDate() + 31);

          await supabase.from("payments").insert({
            user_id: p.id,
            amount: Number(ap?.transaction_amount ?? amount),
            paid_at: paidAt,
            next_due_date: next.toISOString().slice(0, 10),
            mp_authorized_payment_id: apId,
            mp_payment_id: ap?.payment?.id ? String(ap.payment.id) : null,
            mp_preapproval_id: String(p.mp_preapproval_id),
            payment_method: "recurring_card",
            notes: `Cobrança recorrente importada (plano ${p.subscription_plan_id ?? "?"})`,
          });
          imported++;
        }
      }

      // Reativa se a vigência está em dia
      const { data: last } = await supabase
        .from("payments")
        .select("next_due_date")
        .eq("user_id", p.id)
        .order("next_due_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const today = new Date().toISOString().slice(0, 10);
      if (last?.next_due_date && String(last.next_due_date) >= today) {
        await supabase.from("profiles").update({ status: "ativo" }).eq("id", p.id);
      }

      results.push({ user: p.id, status, imported });
    } catch (err) {
      results.push({ user: p.id, error: String(err) });
    }
  }

  return json({ ok: true, checked: results.length, results });
});
