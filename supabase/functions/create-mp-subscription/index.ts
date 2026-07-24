/**
 * Edge Function: create-mp-subscription
 *
 * Cria uma assinatura recorrente (Preapproval) no Mercado Pago.
 * O cartão do usuário fica registrado e é debitado automaticamente todo mês.
 *
 * Planos:
 *  - mensal:      R$ 100/mês, sem data de término (renova até cancelar)
 *  - trimestral:  R$ 93/mês, ciclo de 3 meses
 *  - semestral:   R$ 85/mês, ciclo de 6 meses
 *  - anual:       R$ 75/mês, ciclo de 12 meses
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SubscriptionPlan {
  months: number | null; // null = indefinido (renova até cancelar)
  monthly: number;
  reason: string;
}

const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  mensal:     { months: null, monthly: 100.0, reason: "Analytical X Hub - Assinatura Mensal" },
  trimestral: { months: 3,    monthly: 93.0,  reason: "Analytical X Hub - Plano 3 meses" },
  semestral:  { months: 6,    monthly: 85.0,  reason: "Analytical X Hub - Plano 6 meses" },
  anual:      { months: 12,   monthly: 75.0,  reason: "Analytical X Hub - Plano 12 meses" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

    if (!MP_TOKEN) {
      return new Response(JSON.stringify({ error: "missing_mp_token" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub as string;
    const userEmail = (claims.claims.email as string) ?? undefined;

    if (!userEmail) {
      return new Response(JSON.stringify({ error: "missing_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const origin =
      (body?.return_url as string) ||
      req.headers.get("origin") ||
      "https://hub.analyticalx.com.br";

    const planId = typeof body?.plan_id === "string" ? body.plan_id : "mensal";
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) {
      return new Response(JSON.stringify({ error: "invalid_plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = `${SUPABASE_URL}/functions/v1/mp-webhook`;

    // Data de início: agora + 5 min (MP exige start_date no futuro para preapproval)
    const startDate = new Date(Date.now() + 5 * 60 * 1000);
    const autoRecurring: Record<string, unknown> = {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: plan.monthly,
      currency_id: "BRL",
      start_date: startDate.toISOString(),
    };
    if (plan.months) {
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + plan.months);
      autoRecurring.end_date = endDate.toISOString();
    }

    const preapprovalPayload = {
      reason: plan.reason,
      external_reference: `${userId}|${planId}`,
      payer_email: userEmail,
      back_url: `${origin}/?subscription=success`,
      status: "pending",
      auto_recurring: autoRecurring,
      notification_url: webhookUrl,
    };

    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preapprovalPayload),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP preapproval error:", mpRes.status, mpData);
      return new Response(
        JSON.stringify({ error: "mp_error", details: mpData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Guarda o preapproval_id pendente no perfil (será promovido a authorized pelo webhook)
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin
      .from("profiles")
      .update({
        mp_preapproval_id: mpData.id,
        mp_preapproval_status: "pending",
        subscription_plan_id: planId,
      })
      .eq("id", userId);

    return new Response(
      JSON.stringify({
        preapproval_id: mpData.id,
        init_point: mpData.init_point,
        plan_id: planId,
        monthly: plan.monthly,
        months: plan.months,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-mp-subscription error:", err);
    return new Response(
      JSON.stringify({ error: "server_error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
