import { Link } from "react-router-dom";
import { trackToolClick } from "@/hooks/useTracking";
import { useAuth } from "@/contexts/AuthContext";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import type { HubApp } from "@/components/AppCard";

/** Link único de acesso ao app: mesmo destino e rastreamento em qualquer lugar do Hub. */
export default function AppAccessLink({
  app,
  className,
  children,
  onClick,
}: {
  app: HubApp;
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const { user } = useAuth();
  const { track } = useAppPrefs();
  const id = app.slug || app.nome;

  const handle = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    track(id);
    if (app.external) {
      void trackToolClick(user?.id, { tool_id: id, tool_name: app.nome, tool_category: app.categoria, tool_url: app.url });
    }
  };

  if (app.external) {
    return (
      <a href={app.url} target="_blank" rel="noopener noreferrer" onClick={handle} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={app.slug ? `/app/${app.slug}` : "/"} onClick={handle} className={className}>
      {children}
    </Link>
  );
}
