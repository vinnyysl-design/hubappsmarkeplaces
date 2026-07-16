/**
 * Edge Function: sso-image-generator
 *
 * Gera um token HMAC-SHA256 assinado com HUB_SSO_SECRET e retorna a URL
 * de acesso ao gerador de imagens (https://geradordeimagens.analyticalx.com.br).
 *
 * Payload do token:
 *   { email, plan, cycle_start, extra_credits, exp }
 * Formato final: base64url(payload) + "." + base64url(hmac)
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

    // Verifica status/plan e força reavaliação (bloqueio, expiração de trial etc.)
    const { data: trialData } = await supabase.rpc("enforce_trial_status", {
      _user_id: userId,
    });
    const trial = Array.isArray(trialData) ? trialData[0] : trialData;
    const currentStatus = (trial as any)?.status as string | undefined;

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("email, status, plan, trial_started_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr || !profile) {
      return new Response(
        JSON.stringify({ error: "profile_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const effectiveStatus = currentStatus ?? profile.status;
    if (effectiveStatus === "bloqueado") {
      return new Response(
        JSON.stringify({ error: "user_blocked" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const plan = (profile.plan as string) ?? "trial";

    // Determina cycle_start conforme o plano
    let cycleStart: string | null = null;
    if (plan === "trial") {
      cycleStart = profile.trial_started_at ?? profile.updated_at ?? null;
    } else if (plan === "pagante") {
      const { data: lastPayment } = await supabase
        .from("payments")
        .select("paid_at")
        .eq("user_id", userId)
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      cycleStart =
        (lastPayment as any)?.paid_at ??
        profile.trial_started_at ??
        profile.updated_at ??
        null;
    } else if (plan === "cortesia") {
      // início do mês atual (UTC) — reset mensal
      const now = new Date();
      cycleStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
      ).toISOString();
    } else {
      cycleStart = profile.trial_started_at ?? profile.updated_at ?? null;
    }

    if (!cycleStart) cycleStart = new Date().toISOString();

    const payload = {
      email: userEmail ?? profile.email,
      plan,
      cycle_start: cycleStart,
      extra_credits: 0,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    };

    const payloadB64 = b64url(new TextEncoder().encode(JSON.stringify(payload)));
    const sigBytes = await hmacSha256(HUB_SSO_SECRET, payloadB64);
    const sig = b64url(sigBytes);
    const signedToken = `${payloadB64}.${sig}`;

    const url = `${TARGET_URL}/?token=${signedToken}`;

    return new Response(
      JSON.stringify({ url, plan, cycle_start: cycleStart }),
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
