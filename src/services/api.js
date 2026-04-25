/**
 * services/api.js
 *
 * Cliente HTTP para a API de validação centralizada do HUB.
 * Usado pelo próprio HUB e replicável para os 9 apps externos.
 */

import { getToken, syncTokenFromSession } from "./auth";

/**
 * Endpoint do HUB. Em produção (Netlify) usamos o caminho relativo
 * `/api/validate-user` (redirecionado para a function).
 *
 * Quando os APPS EXTERNOS forem chamar este endpoint, eles devem usar
 * a URL absoluta do HUB, ex.:
 *   const HUB_VALIDATE_URL = "https://hubappsmarkeplaces.lovable.app/api/validate-user";
 */
const VALIDATE_URL = "/api/validate-user";

/**
 * Valida o token + status do usuário contra a Netlify Function.
 *
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
export async function validateAccess() {
  let token = getToken();
  if (!token) {
    // tenta recuperar da sessão viva do Supabase antes de desistir
    token = await syncTokenFromSession();
  }
  if (!token) {
    return { ok: false, status: 401, data: { error: "missing_token" } };
  }

  try {
    const res = await fetch(VALIDATE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: { error: "network_error", message: String(err) },
    };
  }
}
