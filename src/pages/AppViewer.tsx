import { useEffect, useMemo, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import apps from "@/data/apps.json";
import { useAuth } from "@/contexts/AuthContext";
import { trackToolClick } from "@/hooks/useTracking";
import { supabase } from "@/integrations/supabase/client";

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
  sso?: boolean;
}

const AppViewer = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const app = useMemo(
    () => (apps as App[]).find((a) => a.slug === slug),
    [slug]
  );

  const [ssoUrl, setSsoUrl] = useState<string | null>(null);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [ssoLoading, setSsoLoading] = useState(false);

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

  useEffect(() => {
    if (!app?.sso) return;
    let cancelled = false;
    setSsoLoading(true);
    setSsoError(null);
    (async () => {
      const { data, error } = await supabase.functions.invoke(
        "sso-image-generator",
        { body: {} }
      );
      if (cancelled) return;
      if (error || !data?.url) {
        console.error("[sso-image-generator]", error, data);
        setSsoError(
          data?.error === "user_blocked"
            ? "Sua conta está bloqueada. Regularize sua assinatura para acessar."
            : "Não foi possível gerar o acesso à ferramenta. Tente novamente."
        );
      } else {
        setSsoUrl(data.url as string);
      }
      setSsoLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [app?.sso, app?.slug]);

  if (!app) return <Navigate to="/" replace />;

  // Fonte da URL a exibir no iframe
  const embedUrl = (() => {
    if (app.sso) return ssoUrl ?? "";
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
      </header>

      {app.sso && ssoLoading && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="animate-spin" size={18} />
          Liberando acesso à ferramenta…
        </div>
      )}

      {app.sso && ssoError && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md text-center">
            <p className="text-sm text-destructive mb-3">{ssoError}</p>
            <Link
              to="/"
              className="text-sm text-primary hover:underline"
            >
              Voltar ao Hub
            </Link>
          </div>
        </div>
      )}

      {embedUrl && !ssoError && !ssoLoading && (
        <iframe
          src={embedUrl}
          title={app.nome}
          className="flex-1 w-full border-0"
          allow="clipboard-read; clipboard-write; fullscreen"
        />
      )}
    </div>
  );
};

export default AppViewer;
