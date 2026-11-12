import { Box, CheckCircle, FlaskConical, LayoutGrid } from "lucide-react";

interface MetricCardsProps {
  total: number;
  ativos: number;
  beta: number;
  categorias: number;
}

const MetricCards = ({ total, ativos, beta, categorias }: MetricCardsProps) => {
  const metrics = [
    { label: "Total de apps", value: total, icon: <Box size={14} /> },
    { label: "Ativos", value: ativos, icon: <CheckCircle size={14} /> },
    { label: "Em beta", value: beta, icon: <FlaskConical size={14} /> },
    { label: "Categorias", value: categorias, icon: <LayoutGrid size={14} /> },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 gap-2">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="bg-background/60 border border-border rounded-lg px-3 py-2 flex items-center gap-2.5"
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary shrink-0">
            {m.icon}
          </div>
          <div className="min-w-0">
            <span className="text-lg font-bold text-foreground leading-none">{m.value}</span>
            <span className="block text-[11px] text-muted-foreground truncate">{m.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MetricCards;
