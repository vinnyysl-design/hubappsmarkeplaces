/**
 * Edge Function: validate-user
 *
 * Endpoint central de validação de acesso do HUB Analytical X.
 * Recebe um access_token via header `Authorization: Bearer <token>`,
 * valida o token, busca o status do usuário na tabela `profiles` e retorna:
 *
 *   200 { valid: true, user: { id, email, status, role } }
 *   401 { valid: false, error: 'invalid_token' | 'missing_token' | 'user_not_found' }
 *   403 { valid: false, error: 'user_blocked' }
 *   500 { valid: false, error: 'server_error' }
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return json(500, { valid: false, error: "server_misconfigured" });
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(401, { valid: false, error: "missing_token" });
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json(401, { valid: false, error: "missing_token" });
  }

  try {
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return json(401, { valid: false, error: "invalid_token" });
    }

    const userId = claimsData.claims.sub;
    const userEmail = typeof claimsData.claims.email === "string" ? claimsData.claims.email : null;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("id, email, status")
      .eq("id", userId)
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

    const { data: roles, error: rolesErr } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesErr) {
      return json(500, { valid: false, error: "role_lookup_failed" });
    }

    const isAdmin = Array.isArray(roles) && roles.some((r) => r.role === "admin");

    return json(200, {
      valid: true,
      user: {
        id: profile.id,
        email: profile.email ?? userEmail,
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
