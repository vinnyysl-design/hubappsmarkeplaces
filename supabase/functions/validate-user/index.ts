/**
 * Edge Function: validate-user
 *
 * Endpoint central de validação de acesso do HUB Analytical X.
 * Recebe um access_token (Supabase) via header `Authorization: Bearer <token>`,
 * valida o token, busca o status do usuário na tabela `profiles` e retorna:
 *
 *   200 { valid: true, user: { id, email, status, role } }
 *   401 { valid: false, error: 'invalid_token' | 'missing_token' | 'user_not_found' }
 *   403 { valid: false, error: 'user_blocked' }
 *   500 { valid: false, error: 'server_error' }
 *
 * Usado por:
 *   - O próprio HUB (src/contexts/AuthContext.tsx)
 *   - Os 9 apps externos (cada app envia seu token aqui para validar acesso)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json(500, { valid: false, error: "server_misconfigured" });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return json(401, { valid: false, error: "missing_token" });
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) Valida o token
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return json(401, { valid: false, error: "invalid_token" });
    }
    const authUser = userData.user;

    // 2) Busca profile (service role -> ignora RLS)
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id, email, status")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileErr) {
      return json(500, { valid: false, error: "profile_lookup_failed" });
    }
    if (!profile) {
      return json(401, { valid: false, error: "user_not_found" });
    }
    if (profile.status !== "ativo") {
      return json(403, {
        valid: false,
        error: "user_blocked",
        status: profile.status,
      });
    }

    // 3) Role
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", authUser.id);
    const isAdmin = Array.isArray(roles) && roles.some((r) => r.role === "admin");

    return json(200, {
      valid: true,
      user: {
        id: profile.id,
        email: profile.email ?? authUser.email,
        status: profile.status,
        role: isAdmin ? "admin" : "user",
      },
    });
  } catch (err) {
    return json(500, {
      valid: false,
      error: "server_error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
