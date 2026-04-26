import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Registra automaticamente um page view sempre que a rota muda
 * (apenas para usuários autenticados).
 */
export function usePageViewTracker() {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user?.id) return;
    const path = location.pathname + location.search;
    supabase
      .from("page_views")
      .insert({
        user_id: user.id,
        path,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
      })
      .then(({ error }) => {
        if (error) console.warn("[tracking] page_view error:", error.message);
      });
  }, [user?.id, location.pathname, location.search]);
}

export interface ToolClickPayload {
  tool_id: string;
  tool_name: string;
  tool_category?: string | null;
  tool_url?: string | null;
}

/**
 * Registra um clique em uma ferramenta. Não bloqueia a navegação.
 */
export async function trackToolClick(
  userId: string | undefined,
  payload: ToolClickPayload
) {
  if (!userId) return;
  const { error } = await supabase.from("tool_clicks").insert({
    user_id: userId,
    ...payload,
  });
  if (error) console.warn("[tracking] tool_click error:", error.message);
}
