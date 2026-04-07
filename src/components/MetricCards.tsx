import { Box, CheckCircle, FlaskConical, LayoutGrid } from "lucide-react";

interface MetricCardsProps {
  total: number;
  ativos: number;
  beta: number;
  categorias: number;
}

const MetricCards = ({ total, ativos, beta, categorias }: MetricCardsProps) => {
  const metrics = [
    { label: "Total de apps", value: total, icon: <Box size={18} /> },
    { label: "Ativos", value: ativos, icon: <CheckCircle size={18} /> },
    { label: "Em beta", value: beta, icon: <FlaskConical size={18} /> },
    { label: "Categorias", value: categorias, icon: <LayoutGrid size={18} /> },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="group bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4 hover:border-primary/30 transition-colors"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
            {m.icon}
          </div>
          <div>
            <span className="text-2xl font-bold text-foreground leading-none">{m.value}</span>
            <span className="block text-xs font-medium text-muted-foreground mt-0.5">{m.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MetricCards;
