/**
 * Edge Function: sso-image-generator
 *
 * Gera um token HMAC-SHA256 assinado com HUB_SSO_SECRET e retorna a URL
 * de acesso ao gerador de imagens (https://geradordeimagens.analyticalx.com.br).
 *
 * O payload é montado SEMPRE com os dados atuais do banco (profiles + payments),
 * garantindo que plano (trial | pagante | cortesia), início do ciclo e demais
 * atributos reflitam o cadastro real do cliente a cada acesso — sem cache.
 *
 * Formato final do token: base64url(payload) + "." + base64url(hmac)
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TARGET_URL = "https://geradordeimagens.analyticalx.com.br";
const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8h

// Quotas base por plano — enviadas no payload para a ferramenta não precisar
// adivinhar. A ferramenta continua sendo a fonte de verdade do consumo, mas
// recebe do Hub o plano vigente e o teto do ciclo.
const PLAN_BASE_USES: Record<string, number> = {
  trial: 1,
  pagante: 2,
  cortesia: 2,
};
const PLAN_CYCLE_DAYS: Record<string, number> = {
  trial: 10,
  pagante: 30,
  cortesia: 30, // reset mensal (calendário)
};

function b64url(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return new Uint8Array(sig);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const HUB_SSO_SECRET = Deno.env.get("HUB_SSO_SECRET");

    if (!HUB_SSO_SECRET) {
      return new Response(
        JSON.stringify({ error: "missing_hub_sso_secret" }),
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
    const userEmail = (claims.claims.email as string) ?? null;

    // Reavalia trial/bloqueio antes de emitir o token
    const { data: trialData } = await supabase.rpc("enforce_trial_status", {
      _user_id: userId,
    });
    const trial = Array.isArray(trialData) ? trialData[0] : trialData;
    const enforcedStatus = (trial as any)?.status as string | undefined;
    const enforcedTrialEndsAt = (trial as any)?.trial_ends_at as string | undefined;

    // Busca o perfil ATUAL do banco (fonte de verdade do plano)
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select(
        "email, status, plan, trial_status, trial_started_at, updated_at"
      )
      .eq("id", userId)
      .maybeSingle();

    if (profileErr || !profile) {
      console.error("[sso] profile_not_found", { userId, profileErr });
      return new Response(
        JSON.stringify({ error: "profile_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const effectiveStatus = enforcedStatus ?? (profile.status as string);
    if (effectiveStatus === "bloqueado") {
      console.log("[sso] blocked user tried access", { userId, email: profile.email });
      return new Response(
        JSON.stringify({ error: "user_blocked" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Plano vem SEMPRE do banco (trial | pagante | cortesia).
    // Fallback só se coluna estiver nula (usuário legado).
    const plan = ((profile.plan as string) ?? "trial") as
      | "trial"
      | "pagante"
      | "cortesia";

    // Busca último pagamento aprovado (necessário para calcular ciclo de pagantes)
    const { data: lastPayment } = await supabase
      .from("payments")
      .select("paid_at, next_due_date")
      .eq("user_id", userId)
      .not("paid_at", "is", null)
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // cycle_start conforme o plano — SEMPRE recalculado a partir do banco
    let cycleStart: string | null = null;
    let cycleEnd: string | null = null;

    if (plan === "trial") {
      cycleStart = profile.trial_started_at ?? profile.updated_at ?? null;
      if (cycleStart) {
        const d = new Date(cycleStart);
        d.setUTCDate(d.getUTCDate() + PLAN_CYCLE_DAYS.trial);
        cycleEnd = d.toISOString();
      }
      if (enforcedTrialEndsAt) cycleEnd = enforcedTrialEndsAt;
    } else if (plan === "pagante") {
      cycleStart =
        (lastPayment as any)?.paid_at ??
        profile.trial_started_at ??
        profile.updated_at ??
        null;
      if ((lastPayment as any)?.next_due_date) {
        cycleEnd = (lastPayment as any).next_due_date;
      } else if (cycleStart) {
        const d = new Date(cycleStart);
        d.setUTCDate(d.getUTCDate() + PLAN_CYCLE_DAYS.pagante);
        cycleEnd = d.toISOString();
      }
    } else if (plan === "cortesia") {
      // Reset mensal — início do mês corrente (UTC)
      const now = new Date();
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
      );
      const end = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
      );
      cycleStart = start.toISOString();
      cycleEnd = end.toISOString();
    }

    if (!cycleStart) cycleStart = new Date().toISOString();

    const baseUses = PLAN_BASE_USES[plan] ?? 1;
    const cycleDays = PLAN_CYCLE_DAYS[plan] ?? 30;

    const payload = {
      // Identificação
      user_id: userId,
      email: (userEmail ?? profile.email ?? "").toLowerCase().trim(),

      // Plano — fonte única de verdade: banco do Hub
      plan,                    // "trial" | "pagante" | "cortesia"
      status: effectiveStatus, // "ativo" | "bloqueado"

      // Ciclo vigente (a ferramenta usa para reset de cota)
      cycle_start: cycleStart,
      cycle_end: cycleEnd,
      cycle_days: cycleDays,

      // Cota base do plano no ciclo (extras via webhook são somados à parte)
      base_uses: baseUses,
      extra_credits: 0,

      // Metadados auxiliares
      trial_status: profile.trial_status ?? null,
      trial_started_at: profile.trial_started_at ?? null,
      issued_at: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    };

    console.log("[sso] issuing token", {
      user_id: userId,
      email: payload.email,
      plan: payload.plan,
      status: payload.status,
      cycle_start: payload.cycle_start,
      cycle_end: payload.cycle_end,
      base_uses: payload.base_uses,
    });

    const payloadB64 = b64url(new TextEncoder().encode(JSON.stringify(payload)));
    const sigBytes = await hmacSha256(HUB_SSO_SECRET, payloadB64);
    const sig = b64url(sigBytes);
    const signedToken = `${payloadB64}.${sig}`;

    const url = `${TARGET_URL}/?token=${signedToken}`;

    return new Response(
      JSON.stringify({
        url,
        plan: payload.plan,
        status: payload.status,
        cycle_start: payload.cycle_start,
        cycle_end: payload.cycle_end,
        base_uses: payload.base_uses,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sso-image-generator error:", err);
    return new Response(
      JSON.stringify({ error: "server_error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
