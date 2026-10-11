import { useAuth } from "@/contexts/AuthContext";

// Prévia exibida/dispensada por usuário, salva no navegador (sem alterar o banco).
const key = (uid?: string) => `ax_hub_preview_seen:${uid || "anon"}`;
const read = (k: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(k) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export function usePreviewPrefs() {
  const { user } = useAuth();
  const k = key(user?.id);
  return {
    /** true se o usuário ainda não viu/dispensou a prévia deste app */
    shouldAutoShow: (id: string) => !read(k).includes(id),
    markSeen: (id: string) => {
      const l = read(k);
      if (!l.includes(id)) localStorage.setItem(k, JSON.stringify([...l, id]));
    },
    unmarkSeen: (id: string) => localStorage.setItem(k, JSON.stringify(read(k).filter((x) => x !== id))),
  };
}
