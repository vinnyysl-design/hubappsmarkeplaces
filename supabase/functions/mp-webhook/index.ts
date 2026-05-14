/**
 * Edge Function: mp-webhook
 *
 * Recebe notificações do Mercado Pago. Quando um pagamento é aprovado,
 * registra na tabela `payments` (idempotente via mp_payment_id) e libera
 * o usuário (status = 'ativo' por 30 dias).
 *
 * Endpoint público (sem JWT) — Mercado Pago não envia auth header.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!MP_TOKEN) {
      return new Response("missing token", { status: 500, headers: corsHeaders });
    }

    const url = new URL(req.url);
    let paymentId =
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      null;
    let topic =
      url.searchParams.get("type") ||
      url.searchParams.get("topic") ||
      null;

    let body: any = null;
    if (req.method === "POST") {
      body = await req.json().catch(() => null);
      if (body) {
        paymentId = body?.data?.id ?? body?.id ?? paymentId;
        topic = body?.type ?? body?.topic ?? topic;
      }
    }

    console.log("MP webhook:", { topic, paymentId, body });

    // Só processamos eventos de pagamento
    if (!paymentId || (topic && !String(topic).includes("payment"))) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca detalhes do pagamento na API do MP
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${MP_TOKEN}` } }
    );

    if (!mpRes.ok) {
      const txt = await mpRes.text();
      console.error("MP payment lookup failed:", mpRes.status, txt);
      return new Response(JSON.stringify({ ok: false, error: "lookup_failed" }), {
        status: 200, // 200 para o MP não reenviar infinitamente
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = await mpRes.json();
    const status = payment?.status; // approved | pending | rejected | etc
    const userId =
      payment?.external_reference ||
      payment?.metadata?.user_id ||
      null;
    const amount = Number(payment?.transaction_amount ?? 0);
    const method = payment?.payment_method_id ?? payment?.payment_type_id ?? null;

    if (status !== "approved") {
      console.log("Payment not approved, skipping:", status);
      return new Response(JSON.stringify({ ok: true, status }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userId) {
      console.error("Payment approved but no user_id in external_reference");
      return new Response(JSON.stringify({ ok: false, error: "no_user_id" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Idempotência: se já registrado, não duplica
    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("mp_payment_id", String(paymentId))
      .maybeSingle();

    if (existing) {
      console.log("Payment already recorded:", paymentId);
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 30);
    const nextDueStr = nextDue.toISOString().slice(0, 10);

    // Insere pagamento
    const { error: insErr } = await supabase.from("payments").insert({
      user_id: userId,
      amount,
      paid_at: today,
      next_due_date: nextDueStr,
      mp_payment_id: String(paymentId),
      payment_method: method,
      notes: "Pagamento via Mercado Pago (Checkout Pro)",
    });

    if (insErr) {
      console.error("Insert payment error:", insErr);
      return new Response(JSON.stringify({ ok: false, error: insErr.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Libera o usuário
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ status: "ativo" })
      .eq("id", userId);

    if (upErr) {
      console.error("Update profile error:", upErr);
    }

    console.log("Payment processed and user activated:", userId);

    return new Response(JSON.stringify({ ok: true, activated: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("mp-webhook error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
