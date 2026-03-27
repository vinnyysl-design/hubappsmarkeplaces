import { ExternalLink } from "lucide-react";

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

const AppCard = ({ app }: { app: App }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow duration-200 flex flex-col h-full">
      <span className="text-4xl mb-3">{app.icone}</span>
      <h3 className="text-lg font-bold text-foreground mb-2">{app.nome}</h3>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[hsl(var(--badge-cat-bg))] text-[hsl(var(--badge-cat-text))]">
          {app.categoria}
        </span>
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[hsl(var(--badge-status-bg))] text-[hsl(var(--badge-status-text))]">
          {app.status}
        </span>
        {app.tag && (
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[hsl(var(--badge-tag-bg))] text-[hsl(var(--badge-tag-text))]">
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
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <ExternalLink size={15} /> Abrir
        </a>
      </div>
    </div>
  );
};

export default AppCard;
