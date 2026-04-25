/**
 * services/api.js
 *
 * Cliente HTTP para a API de validação centralizada do HUB.
 * Usa a Edge Function `validate-user` do backend.
 */

import { getToken, syncTokenFromSession } from "./auth";

const VALIDATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-user`;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
export async function validateAccess() {
  let token = getToken();
  if (!token) {
    token = await syncTokenFromSession();
  }

  if (!token) {
    return { ok: false, status: 401, data: { error: "missing_token" } };
  }

  try {
    const res = await fetch(VALIDATE_URL, {
      method: "POST",
      headers: {
        apikey: PUBLISHABLE_KEY,
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
