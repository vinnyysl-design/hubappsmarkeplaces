import { useEffect, useMemo } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import apps from "@/data/apps.json";
import { useAuth } from "@/contexts/AuthContext";
import { trackToolClick } from "@/hooks/useTracking";

interface App {
  slug: string;
  nome: string;
  descricao: string;
  categoria: string;
  status: string;
  tag: string;
  url: string;
  github: string;
  icone: string;
}

const AppViewer = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const app = useMemo(
    () => (apps as App[]).find((a) => a.slug === slug),
    [slug]
  );

  useEffect(() => {
    if (app) {
      void trackToolClick(user?.id, {
        tool_id: app.slug,
        tool_name: app.nome,
        tool_category: app.categoria,
        tool_url: app.url,
      });
      document.title = `${app.nome} · Analytical X`;
    }
  }, [app, user?.id]);

  if (!app) return <Navigate to="/" replace />;

  // Add hub marker so the app can detect it's embedded and skip its own redirect.
  const embedUrl = (() => {
    try {
      const u = new URL(app.url);
      u.searchParams.set("from", "hub");
      return u.toString();
    } catch {
      return app.url;
    }
  })();

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between gap-3 px-4 h-12 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Voltar ao Hub</span>
          </Link>
          <span className="text-border">|</span>
          <h1 className="text-sm font-semibold text-foreground truncate">
            {app.nome}
          </h1>
        </div>
        <a
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Abrir em nova aba"
        >
          <ExternalLink size={14} />
          <span className="hidden sm:inline">Nova aba</span>
        </a>
      </header>
      <iframe
        src={embedUrl}
        title={app.nome}
        className="flex-1 w-full border-0"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
};

export default AppViewer;
