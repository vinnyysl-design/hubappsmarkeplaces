import { useAuth } from "@/contexts/AuthContext";

/**
 * Controle de primeira visualização da prévia, por usuário E por aplicativo.
 * Chave: ax_hub_preview:<userId>:<appId>  →  "completed" | "dismissed"
 * Fechar a janela sem acessar e sem dispensar NÃO grava nada.
 */
type PreviewState = "completed" | "dismissed";
const key = (uid: string | undefined, appId: string) => `ax_hub_preview:${uid || "anon"}:${appId}`;
const legacyKey = (uid?: string) => `ax_hub_preview_seen:${uid || "anon"}`;

const get = (uid: string | undefined, appId: string): PreviewState | null => {
  try {
    const v = localStorage.getItem(key(uid, appId));
    if (v === "completed" || v === "dismissed") return v;
    // compatibilidade com o formato anterior (lista única por usuário)
    const legacy = JSON.parse(localStorage.getItem(legacyKey(uid)) || "[]");
    return Array.isArray(legacy) && legacy.includes(appId) ? "completed" : null;
  } catch {
    return null;
  }
};
const set = (uid: string | undefined, appId: string, v: PreviewState | null) => {
  try {
    if (v) localStorage.setItem(key(uid, appId), v);
    else localStorage.removeItem(key(uid, appId));
  } catch {
    /* armazenamento indisponível: segue sem bloquear o acesso */
  }
};

export function usePreviewPrefs() {
  const { user } = useAuth();
  const uid = user?.id;
  return {
    /** true se a prévia ainda não foi concluída nem dispensada */
    shouldAutoShow: (appId: string) => get(uid, appId) === null,
    markCompleted: (appId: string) => {
      if (get(uid, appId) !== "dismissed") set(uid, appId, "completed");
    },
    setDismissed: (appId: string, dismissed: boolean) => {
      if (dismissed) set(uid, appId, "dismissed");
      else if (get(uid, appId) === "dismissed") set(uid, appId, null);
    },
  };
}
