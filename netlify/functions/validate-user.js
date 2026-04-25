/**
 * Netlify Function: validate-user
 *
 * Endpoint central de validação de acesso do HUB Analytical X.
 * Recebe um access_token (Supabase) via header `Authorization: Bearer <token>`,
 * valida o token, busca o status do usuário na tabela `profiles` e retorna:
 *
 *   200 { valid: true, user: { id, email, status, role } }  -> acesso liberado
 *   401 { valid: false, error: 'invalid_token' }            -> token ausente/inválido
 *   401 { valid: false, error: 'user_not_found' }           -> sem profile
 *   403 { valid: false, error: 'user_blocked' }             -> status != 'ativo'
 *   500 { valid: false, error: 'server_error' }             -> falha interna
 *
 * Variáveis de ambiente exigidas (configurar em Site settings -> Environment):
 *   - SUPABASE_URL                (igual ao VITE_SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY   (NUNCA expor no frontend)
 *
 * Observação: usamos fetch direto à API REST/Auth do Supabase para não
 * depender de SDK e manter o bundle da function mínimo.
 */

const JSON_HEADERS = {
  "Content-Type": "application/json",
  // CORS aberto: o HUB e os 9 apps externos (cada um em seu domínio Netlify)
  // precisam conseguir chamar este endpoint.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: JSON_HEADERS, body: "" };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return respond(500, {
      valid: false,
      error: "server_misconfigured",
      message: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.",
    });
  }

  // Aceita "Authorization: Bearer xxx" (case-insensitive)
  const authHeader =
    event.headers?.authorization || event.headers?.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return respond(401, { valid: false, error: "missing_token" });
  }

  try {
    // 1) Valida o token chamando /auth/v1/user
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!userRes.ok) {
      return respond(401, { valid: false, error: "invalid_token" });
    }

    const authUser = await userRes.json();
    if (!authUser?.id) {
      return respond(401, { valid: false, error: "invalid_token" });
    }

    // 2) Busca o profile (status) usando service role -> ignora RLS
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${authUser.id}&select=id,email,status`,
      {
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          Accept: "application/json",
        },
      }
    );

    if (!profileRes.ok) {
      return respond(500, { valid: false, error: "profile_lookup_failed" });
    }

    const profiles = await profileRes.json();
    const profile = Array.isArray(profiles) ? profiles[0] : null;

    if (!profile) {
      return respond(401, { valid: false, error: "user_not_found" });
    }

    if (profile.status !== "ativo") {
      return respond(403, {
        valid: false,
        error: "user_blocked",
        status: profile.status,
      });
    }

    // 3) (Opcional) busca o role do usuário
    const rolesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${authUser.id}&select=role`,
      {
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          Accept: "application/json",
        },
      }
    );
    const roles = rolesRes.ok ? await rolesRes.json() : [];
    const isAdmin = Array.isArray(roles) && roles.some((r) => r.role === "admin");

    return respond(200, {
      valid: true,
      user: {
        id: profile.id,
        email: profile.email ?? authUser.email,
        status: profile.status,
        role: isAdmin ? "admin" : "user",
      },
    });
  } catch (err) {
    return respond(500, {
      valid: false,
      error: "server_error",
      message: err?.message ?? String(err),
    });
  }
};
