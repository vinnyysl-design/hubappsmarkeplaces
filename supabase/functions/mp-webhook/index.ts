/**
 * Edge Function: mp-webhook
 *
 * Recebe notificações do Mercado Pago.
 *
 * - Assinatura mensal: registra em `payments` (idempotente via mp_payment_id)
 *   e libera o usuário (status = 'ativo' por 30 dias).
 * - Pack de imagens (metadata.kind === "image_pack"): NÃO altera assinatura;
 *   credita usos no Gerador de Imagens via POST assinado (HMAC-SHA256).
 *
 * Endpoint público (sem JWT) — Mercado Pago não envia auth header.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const IMAGE_TOOL_WEBHOOK =
  "https://geradordeimagens.analyticalx.com.br/api/public/hub/credits";

// Fallback caso a metadata não venha completa (raro, mas seguro)
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const HUB_WEBHOOK_SECRET = Deno.env.get("HUB_WEBHOOK_SECRET");

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

    console.log("MP webhook:", { topic, paymentId });

    if (!paymentId || (topic && !String(topic).includes("payment"))) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${MP_TOKEN}` } }
    );

    if (!mpRes.ok) {
      const txt = await mpRes.text();
      console.error("MP payment lookup failed:", mpRes.status, txt);
      return new Response(JSON.stringify({ ok: false, error: "lookup_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = await mpRes.json();
    const status = payment?.status;
    const userId =
      payment?.external_reference ||
      payment?.metadata?.user_id ||
      null;
    const amount = Number(payment?.transaction_amount ?? 0);
    const method = payment?.payment_method_id ?? payment?.payment_type_id ?? null;
    const metadata = payment?.metadata ?? {};
    const kind = String(metadata?.kind ?? "subscription");

    if (status !== "approved") {
      console.log("Payment not approved, skipping:", status);
      return new Response(JSON.stringify({ ok: true, status }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // ============ PACK DE IMAGENS ============
    if (kind === "image_pack") {
      const packId = String(metadata?.pack_id ?? "");
      const uses =
        Number(metadata?.uses) ||
        PACK_USES[packId] ||
        0;

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

      if (!email || !uses) {
        console.error("Pack payment missing email/uses:", { email, uses, packId });
        return new Response(JSON.stringify({ ok: false, error: "invalid_pack_data" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!HUB_WEBHOOK_SECRET) {
        console.error("HUB_WEBHOOK_SECRET not configured");
        return new Response(JSON.stringify({ ok: false, error: "missing_secret" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = {
        event_id: `mp-payment-${paymentId}`,
        email,
        uses,
      };
      const rawBody = JSON.stringify(payload);
      const signature = await hmacHex(HUB_WEBHOOK_SECRET, rawBody);

      const credRes = await fetch(IMAGE_TOOL_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature": signature,
        },
        body: rawBody,
      });

      const credText = await credRes.text();
      console.log("Image pack credit response:", credRes.status, credText);

      if (!credRes.ok) {
        return new Response(
          JSON.stringify({ ok: false, error: "credit_failed", status: credRes.status, body: credText }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, credited: uses, pack: packId, email }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ ASSINATURA MENSAL ============
    if (!userId) {
      console.error("Payment approved but no user_id in external_reference");
      return new Response(JSON.stringify({ ok: false, error: "no_user_id" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { error: upErr } = await supabase
      .from("profiles")
      .update({ status: "ativo" })
      .eq("id", userId);

    if (upErr) console.error("Update profile error:", upErr);

    console.log("Subscription payment processed:", userId);
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
