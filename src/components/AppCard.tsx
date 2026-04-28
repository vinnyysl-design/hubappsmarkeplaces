import { ExternalLink, BarChart3, Package, Rocket, DollarSign, RotateCcw, Landmark, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { trackToolClick } from "@/hooks/useTracking";
import { useAuth } from "@/contexts/AuthContext";

interface App {
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
};

const AppCard = ({ app }: { app: App }) => {
  const { user } = useAuth();
  const icon = iconMap[app.icone] || <ArrowUpRight size={22} />;
  const isBeta = app.status === "Beta";
  const to = app.slug ? `/app/${app.slug}` : "/";

  const sharedClass =
    "group bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-all duration-200 flex flex-col h-full cursor-pointer";

  const handleExternalClick = () => {
    void trackToolClick(user?.id, {
      tool_id: app.slug || app.nome,
      tool_name: app.nome,
      tool_category: app.categoria,
      tool_url: app.url,
    });
  };

  const Wrapper = app.external
    ? ({ children }: { children: React.ReactNode }) => (
        <a
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleExternalClick}
          className={sharedClass}
        >
          {children}
        </a>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <Link to={to} className={sharedClass}>
          {children}
        </Link>
      );

  return (
    <Wrapper>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <ExternalLink size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
      </div>

      <h3 className="text-base font-semibold text-foreground mb-1.5 leading-snug">{app.nome}</h3>
      <p className="text-sm text-muted-foreground flex-1 mb-4 leading-relaxed">{app.descricao}</p>

      <div className="flex flex-wrap items-center gap-1.5 mt-auto">
        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-[hsl(var(--badge-cat-bg))] text-[hsl(var(--badge-cat-text))]">
          {app.categoria}
        </span>
        {isBeta ? (
          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-[hsl(var(--badge-beta-bg))] text-[hsl(var(--badge-beta-text))]">
            Beta
          </span>
        ) : (
          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-[hsl(var(--badge-status-bg))] text-[hsl(var(--badge-status-text))]">
            {app.status}
          </span>
        )}
        {app.tag && (
          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-[hsl(var(--badge-tag-bg))] text-[hsl(var(--badge-tag-text))]">
            {app.tag}
          </span>
        )}
      </div>
    </Wrapper>
  );
};

export default AppCard;
