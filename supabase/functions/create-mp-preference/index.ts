/**
 * Edge Function: create-mp-preference
 *
 * Cria uma preference no Mercado Pago (Checkout Pro) para o usuário autenticado
 * pagar a assinatura mensal de R$ 100,00 via Pix ou cartão.
 * Retorna a URL de checkout (init_point) para redirecionamento.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUBSCRIPTION_AMOUNT = 100.0;
const SUBSCRIPTION_TITLE = "Assinatura mensal Analytical X Hub";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

    if (!MP_TOKEN) {
      return new Response(
        JSON.stringify({ error: "missing_mp_token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.claims.sub as string;
    const userEmail = (claims.claims.email as string) ?? undefined;

    const body = await req.json().catch(() => ({}));
    const origin =
      (body?.return_url as string) ||
      req.headers.get("origin") ||
      "https://hub.analyticalx.com.br";

    const webhookUrl = `${SUPABASE_URL}/functions/v1/mp-webhook`;

    const preferencePayload = {
      items: [
        {
          id: "subscription-monthly",
          title: SUBSCRIPTION_TITLE,
          description: "Acesso completo ao Hub de apps por 30 dias",
          quantity: 1,
          currency_id: "BRL",
          unit_price: SUBSCRIPTION_AMOUNT,
        },
      ],
      payer: userEmail ? { email: userEmail } : undefined,
      external_reference: userId,
      notification_url: webhookUrl,
      back_urls: {
        success: `${origin}/?payment=success`,
        failure: `${origin}/?payment=failure`,
        pending: `${origin}/?payment=pending`,
      },
      auto_return: "approved",
      statement_descriptor: "ANALYTICAL X",
      metadata: { user_id: userId },
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferencePayload),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP preference error:", mpData);
      return new Response(
        JSON.stringify({ error: "mp_error", details: mpData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        preference_id: mpData.id,
        init_point: mpData.init_point,
        sandbox_init_point: mpData.sandbox_init_point,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-mp-preference error:", err);
    return new Response(
      JSON.stringify({ error: "server_error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
