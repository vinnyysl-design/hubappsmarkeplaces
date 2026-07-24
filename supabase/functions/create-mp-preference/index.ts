/**
 * Edge Function: create-mp-preference
 *
 * Cria uma preference no Mercado Pago (Checkout Pro).
 *
 * Modos:
 * 1) Assinatura (pagamento único do período): body { plan_id: "mensal" | "trimestral" | "semestral" | "anual" }
 *    - default: "mensal" (compatibilidade retro)
 *    - Parcelamento em até 12x no cartão
 * 2) Pack de imagens: body { pack_id: "pack-5" | "pack-8" | "pack-10" | "pack-20" }
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SubscriptionPlan {
  months: number;
  amount: number;
  title: string;
}

const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  mensal:      { months: 1,  amount: 100.0, title: "Assinatura Analytical X Hub - 1 mês" },
  trimestral:  { months: 3,  amount: 279.0, title: "Assinatura Analytical X Hub - 3 meses" },
  semestral:   { months: 6,  amount: 510.0, title: "Assinatura Analytical X Hub - 6 meses" },
  anual:       { months: 12, amount: 900.0, title: "Assinatura Analytical X Hub - 12 meses" },
};

const IMAGE_PACKS: Record<string, { uses: number; amount: number; title: string }> = {
  "pack-5":  { uses: 5,  amount: 24.99, title: "Pack 5 usos - Gerador de Imagens" },
  "pack-8":  { uses: 8,  amount: 38.99, title: "Pack 8 usos - Gerador de Imagens" },
  "pack-10": { uses: 10, amount: 44.99, title: "Pack 10 usos - Gerador de Imagens" },
  "pack-20": { uses: 20, amount: 84.99, title: "Pack 20 usos - Gerador de Imagens" },
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

    const packId = typeof body?.pack_id === "string" ? body.pack_id : null;
    const pack = packId ? IMAGE_PACKS[packId] : null;

    if (packId && !pack) {
      return new Response(
        JSON.stringify({ error: "invalid_pack" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Assinatura: aceita plan_id novo; se não vier, mantém compatibilidade com mensal
    const planId = typeof body?.plan_id === "string" ? body.plan_id : "mensal";
    const plan = !pack ? SUBSCRIPTION_PLANS[planId] : null;

    if (!pack && !plan) {
      return new Response(
        JSON.stringify({ error: "invalid_plan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookUrl = `${SUPABASE_URL}/functions/v1/mp-webhook`;

    const itemId = pack ? packId! : `subscription-${planId}`;
    const itemTitle = pack ? pack.title : plan!.title;
    const amount = pack ? pack.amount : plan!.amount;
    const description = pack
      ? `${pack.uses} usos avulsos no Gerador de Imagens`
      : `Acesso completo ao Hub de apps por ${plan!.months} ${plan!.months === 1 ? "mês" : "meses"}`;

    const metadata: Record<string, unknown> = { user_id: userId };
    if (pack) {
      metadata.kind = "image_pack";
      metadata.pack_id = packId;
      metadata.uses = pack.uses;
      if (userEmail) metadata.email = userEmail;
    } else {
      metadata.kind = "subscription";
      metadata.plan_id = planId;
      metadata.months = plan!.months;
    }

    const preferencePayload: Record<string, unknown> = {
      items: [
        {
          id: itemId,
          title: itemTitle,
          description,
          quantity: 1,
          currency_id: "BRL",
          unit_price: amount,
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
      metadata,
      // Parcelamento em até 12x no cartão (assinatura). Packs ficam em 1x.
      payment_methods: {
        installments: pack ? 1 : 12,
        default_installments: pack ? 1 : 12,
      },
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
        kind: pack ? "image_pack" : "subscription",
        pack_id: packId,
        plan_id: pack ? null : planId,
        months: pack ? null : plan!.months,
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
