/**
 * services/auth.js
 *
 * Helpers globais de autenticação para o HUB Analytical X.
 * Funcionam em qualquer parte do app (e podem ser copiados para os
 * 9 apps externos para padronizar a verificação de acesso).
 *
 * IMPORTANTE: este módulo NUNCA deve usar a SERVICE_ROLE_KEY.
 * Toda decisão sensível (status do usuário, bloqueio) é feita
 * pela Netlify Function `/.netlify/functions/validate-user`.
 */

import { supabase } from "@/integrations/supabase/client";

const TOKEN_STORAGE_KEY = "analyticalx.access_token";

/** Salva o access_token no localStorage (chamado após login bem-sucedido). */
export function setToken(token) {
  if (!token) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

/** Retorna o token atual (preferindo a sessão viva do Supabase). */
export function getToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/** Sincroniza o token do localStorage com a sessão viva do Supabase. */
export async function syncTokenFromSession() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token ?? null;
  setToken(token);
  return token;
}

/** True se existe token armazenado. NÃO substitui validateAccess(). */
export function isAuthenticated() {
  return Boolean(getToken());
}

/** Logout completo: encerra sessão Supabase, limpa storage, redireciona. */
export async function logout({ redirect = true } = {}) {
  try {
    await supabase.auth.signOut();
  } catch {
    // ignora erros de rede no signOut
  }
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  if (redirect && typeof window !== "undefined") {
    window.location.href = "/auth";
  }
}
