import { ExternalLink, BarChart3, Package, Rocket, DollarSign, RotateCcw, Landmark, ArrowUpRight } from "lucide-react";

interface App {
  nome: string;
  descricao: string;
  categoria: string;
  status: string;
  tag: string;
  url: string;
  github: string;
  icone: string;
}

const iconMap: Record<string, React.ReactNode> = {
  "🧮": <BarChart3 size={28} />,
  "📦": <Package size={28} />,
  "🚀": <Rocket size={28} />,
  "💰": <DollarSign size={28} />,
  "↩️": <RotateCcw size={28} />,
  "🏦": <Landmark size={28} />,
  "⚖️": <BarChart3 size={28} />,
  "📊": <BarChart3 size={28} />,
};

const AppCard = ({ app }: { app: App }) => {
  const icon = iconMap[app.icone] || <ArrowUpRight size={28} />;

  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors duration-200 flex flex-col h-full">
      <span className="text-primary mb-3">{icon}</span>
      <h3 className="text-lg font-bold text-foreground mb-2">{app.nome}</h3>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[hsl(var(--badge-cat-bg))] text-[hsl(var(--badge-cat-text))]">
          {app.categoria}
        </span>
        <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[hsl(var(--badge-status-bg))] text-[hsl(var(--badge-status-text))]">
          {app.status}
        </span>
        {app.tag && (
          <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[hsl(var(--badge-tag-bg))] text-[hsl(var(--badge-tag-text))]">
            {app.tag}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground flex-1 mb-5">{app.descricao}</p>
      <div className="flex mt-auto">
        <a
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <ExternalLink size={15} /> Abrir
        </a>
      </div>
    </div>
  );
};

export default AppCard;
