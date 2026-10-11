import { useCallback, useEffect, useState } from "react";

const FAV_KEY = "ax_hub_favorites";
const RECENT_KEY = "ax_hub_recent";
const EVT = "ax-hub-prefs";
const MAX_RECENT = 6;

const read = (k: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(k) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const write = (k: string, v: string[]) => {
  localStorage.setItem(k, JSON.stringify(v));
  window.dispatchEvent(new Event(EVT));
};

/** Registra um app como usado recentemente (preferência local do navegador). */
export const markRecent = (id: string) => {
  const list = read(RECENT_KEY).filter((x) => x !== id);
  write(RECENT_KEY, [id, ...list].slice(0, MAX_RECENT));
};

export function useAppPrefs() {
  const [favorites, setFavorites] = useState<string[]>(() => read(FAV_KEY));
  const [recent, setRecent] = useState<string[]>(() => read(RECENT_KEY));

  useEffect(() => {
    const sync = () => {
      setFavorites(read(FAV_KEY));
      setRecent(read(RECENT_KEY));
    };
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    const list = read(FAV_KEY);
    write(FAV_KEY, list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }, []);

  return { favorites, recent, toggleFavorite, isFavorite: (id: string) => favorites.includes(id) };
}
