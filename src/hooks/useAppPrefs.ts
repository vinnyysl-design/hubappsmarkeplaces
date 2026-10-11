import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const EVT = "ax-hub-prefs";
export const MAX_RECENT = 5;

// Preferências salvas no navegador, separadas pelo ID do usuário (sem alterar o banco).
const favKey = (uid?: string) => `ax_hub_favorites:${uid || "anon"}`;
const recentKey = (uid?: string) => `ax_hub_recent:${uid || "anon"}`;

const read = (k: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(k) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const write = (k: string, v: string[]) => {
  localStorage.setItem(k, JSON.stringify(v));
  window.dispatchEvent(new Event(EVT));
};

/** Registra um app efetivamente acessado (mais recente primeiro, máx. 5). */
export const markRecent = (userId: string | undefined, id: string) => {
  const k = recentKey(userId);
  write(k, [id, ...read(k).filter((x) => x !== id)].slice(0, MAX_RECENT));
};

export function useAppPrefs() {
  const { user } = useAuth();
  const uid = user?.id;
  const [favorites, setFavorites] = useState<string[]>(() => read(favKey(uid)));
  const [recent, setRecent] = useState<string[]>(() => read(recentKey(uid)));

  useEffect(() => {
    const sync = () => {
      setFavorites(read(favKey(uid)));
      setRecent(read(recentKey(uid)).slice(0, MAX_RECENT));
    };
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [uid]);

  const toggleFavorite = useCallback(
    (id: string) => {
      const k = favKey(uid);
      const list = read(k);
      write(k, list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
    },
    [uid]
  );

  return {
    favorites,
    recent,
    toggleFavorite,
    isFavorite: (id: string) => favorites.includes(id),
    track: (id: string) => markRecent(uid, id),
  };
}
