/**
 * services/api.js
 *
 * Cliente HTTP para a API de validação centralizada do HUB.
 * Usa uma Edge Function do Lovable Cloud (Supabase Functions) que
 * funciona tanto no preview quanto em produção (qualquer domínio).
 */

import { supabase } from "@/integrations/supabase/client";
import { getToken, syncTokenFromSession } from "./auth";

/**
 * Valida o token + status do usuário contra a Edge Function `validate-user`.
 *
 * Para apps EXTERNOS, a chamada equivalente é:
 *   POST https://<project-ref>.supabase.co/functions/v1/validate-user
 *   Headers: Authorization: Bearer <access_token>
 *
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
    const { data, error } = await supabase.functions.invoke("validate-user", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (error) {
      // FunctionsHttpError carrega o status real da resposta
      const status = error.context?.status ?? 0;
      let body = {};
      try {
        body = (await error.context?.json?.()) ?? {};
      } catch {
        // ignore
      }
      return { ok: false, status, data: body };
    }

    return { ok: true, status: 200, data: data ?? {} };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: { error: "network_error", message: String(err) },
    };
  }
}
