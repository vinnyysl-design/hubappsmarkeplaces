import { BarChart3, Package, Rocket, DollarSign, RotateCcw, Landmark, ArrowUpRight, Lock, Eye, Image as ImageIcon, Star, PlayCircle } from "lucide-react";
import AppAccessLink from "@/components/AppAccessLink";
import { usePreviewPrefs } from "@/hooks/usePreviewPrefs";
import { useAuth } from "@/contexts/AuthContext";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface HubApp {
  slug?: string;
  nome: string;
  descricao: string;
  categoria: string;
  status: string;
  tag: string;
  url: string;
  github: string;
  icone: string;
  external?: boolean;
  sso?: boolean;
  canais?: string[];
  aiKnowledge?: string;
  whatsNew?: string;
  version?: string;
}

const iconMap: Record<string, React.ReactNode> = {
  "🧮": <BarChart3 size={22} />,
  "📦": <Package size={22} />,
  "🚀": <Rocket size={22} />,
  "💰": <DollarSign size={22} />,
  "↩️": <RotateCcw size={22} />,
  "🏦": <Landmark size={22} />,
  "⚖️": <BarChart3 size={22} />,
  "📊": <BarChart3 size={22} />,
  "👁️": <Eye size={22} />,
  "🎨": <ImageIcon size={22} />,
};
export const appIcon = (icone: string) => iconMap[icone] || <ArrowUpRight size={22} />;

const CHANNEL_SHORT: Record<string, string> = {
  "Mercado Livre": "ML",
  Shopee: "SHP",
  Amazon: "AMZ",
  Magalu: "MGL",
  "TikTok Shop": "TT",
  TikTok: "TT",
};

const TERMS_VERSION = "1.0";

interface Props {
  app: HubApp;
  /** Abre a janela de prévia do app (integração futura). */
  onPreview?: (app: HubApp, opts?: { auto?: boolean }) => void;
}

const AppCard = ({ app, onPreview }: Props) => {
  const { status, isAdmin, termsAcceptedAt, termsVersion } = useAuth() as any;
  const { isFavorite, toggleFavorite } = useAppPrefs();
  const { shouldAutoShow } = usePreviewPrefs();
  const appId = app.slug || app.nome;
  const fav = isFavorite(appId);
  const isBeta = app.status === "Beta";
  const needsTerms = !isAdmin && status === "ativo" && (!termsAcceptedAt || termsVersion !== TERMS_VERSION);
  const locked = !isAdmin && (status === "bloqueado" || needsTerms);
  const canais = app.canais ?? [];
  const allChannels = canais.includes("Todos os canais");

  // 1º acesso: abre a prévia antes de entrar no app (até o usuário dispensar ou acessar por ela)
  const onAccess = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onPreview && shouldAutoShow(appId)) {
      e.preventDefault();
      onPreview(app, { auto: true });
    }
  };

  const btnBase =
    "inline-flex flex-1 items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const accessCls = `${btnBase} bg-primary text-primary-foreground hover:opacity-90`;

  return (
    <article
      data-app={appId}
      onClick={(e) => {
        // Clique principal no card = mesmo comportamento do botão "Acessar App"
        if (locked || (e.target as HTMLElement).closest("a,button,[role=button]")) return;
        e.currentTarget.querySelector<HTMLAnchorElement>("a[data-access]")?.click();
      }}
      className={`group relative flex flex-col h-full rounded-xl border bg-card p-5 transition-all duration-200 ${
        locked
          ? "border-border opacity-75"
          : "cursor-pointer border-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30"
      }`}
    >
      {/* Topo: ícone + favorito */}
      <div className="flex items-start justify-between mb-4">
        <div
          className={`flex items-center justify-center w-12 h-12 rounded-xl transition-colors duration-200 ${
            locked ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary group-hover:bg-primary/15"
          }`}
        >
          {appIcon(app.icone)}
        </div>
        <button
          type="button"
          onClick={() => toggleFavorite(appId)}
          aria-label={fav ? `Remover ${app.nome} dos favoritos` : `Adicionar ${app.nome} aos favoritos`}
          aria-pressed={fav}
          className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors duration-150 ${
            fav ? "border-primary/30 bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:text-primary hover:border-border"
          }`}
        >
          <Star size={15} className={fav ? "fill-current" : ""} />
        </button>
      </div>

      {/* Nome + descrição (máx. 2 linhas) */}
      <h3 className="text-base font-semibold text-foreground leading-snug line-clamp-2 min-h-[2.75rem]">{app.nome}</h3>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.75rem]" title={app.descricao}>
        {app.descricao}
      </p>

      {/* Metadados compactos */}
      <div className="mt-4 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground truncate">{app.categoria}</span>
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium ${
              isBeta
                ? "bg-[hsl(var(--badge-beta-bg))] text-[hsl(var(--badge-beta-text))]"
                : "bg-[hsl(var(--badge-status-bg))] text-[hsl(var(--badge-status-text))]"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {app.status}
          </span>
        </div>
        {canais.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 shrink-0 cursor-default" aria-label={`Marketplaces: ${canais.join(", ")}`}>
                {allChannels ? (
                  <span className="px-1.5 py-0.5 rounded border border-border text-[10px] font-medium text-muted-foreground">Todos os canais</span>
                ) : (
                  canais.slice(0, 3).map((c) => (
                    <span key={c} className="px-1.5 py-0.5 rounded border border-border text-[10px] font-semibold text-muted-foreground">
                      {CHANNEL_SHORT[c] ?? c}
                    </span>
                  ))
                )}
                {!allChannels && canais.length > 3 && (
                  <span className="text-[10px] font-medium text-muted-foreground">+{canais.length - 3}</span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent>{canais.join(" · ")}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Ações */}
      <div className="mt-auto pt-4 flex gap-2">
        <button
          type="button"
          onClick={() => onPreview?.(app)}
          className={`${btnBase} border border-border text-foreground hover:border-primary/40 hover:text-primary`}
        >
          <PlayCircle size={15} /> Conhecer App
        </button>
        {locked ? (
          <span
            className={`${btnBase} bg-muted text-muted-foreground cursor-not-allowed`}
            title={needsTerms ? "Aceite o Termo de Uso para liberar o acesso" : "Acesso bloqueado — escolha um plano para liberar"}
            aria-disabled="true"
          >
            <Lock size={14} /> Bloqueado
          </span>
        ) : (
          <AppAccessLink app={app} onClick={onAccess} className={accessCls} data-access>
            Acessar App <ArrowUpRight size={14} />
          </AppAccessLink>
        )}
      </div>
    </article>
  );
};

export default AppCard;
