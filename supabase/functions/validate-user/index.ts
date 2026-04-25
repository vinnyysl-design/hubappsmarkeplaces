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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
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
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!userRes.ok) {
      return json(401, { valid: false, error: "invalid_token" });
    }

    const authUser = await userRes.json();
    if (!authUser?.id) {
      return json(401, { valid: false, error: "invalid_token" });
    }

    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${authUser.id}&select=id,email,status`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: "application/json",
        },
      },
    );

    if (!profileRes.ok) {
      return json(500, { valid: false, error: "profile_lookup_failed" });
    }

    const profiles = await profileRes.json();
    const profile = Array.isArray(profiles) ? profiles[0] : null;

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

    const rolesRes = await fetch(
      `${supabaseUrl}/rest/v1/user_roles?user_id=eq.${authUser.id}&select=role`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: "application/json",
        },
      },
    );

    const roles = rolesRes.ok ? await rolesRes.json() : [];
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
