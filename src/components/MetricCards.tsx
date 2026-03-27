import { Box, CheckCircle, FlaskConical, LayoutGrid } from "lucide-react";

interface MetricCardsProps {
  total: number;
  ativos: number;
  beta: number;
  categorias: number;
}

const MetricCards = ({ total, ativos, beta, categorias }: MetricCardsProps) => {
  const metrics = [
    { label: "Total de apps", value: total, icon: <Box size={20} /> },
    { label: "Ativos", value: ativos, icon: <CheckCircle size={20} /> },
    { label: "Em beta", value: beta, icon: <FlaskConical size={20} /> },
    { label: "Categorias", value: categorias, icon: <LayoutGrid size={20} /> },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="bg-card border border-border rounded-xl p-5 flex flex-col items-start gap-1"
        >
          <span className="text-primary">{m.icon}</span>
          <span className="text-sm font-medium text-muted-foreground">{m.label}</span>
          <span className="text-3xl font-bold text-foreground">{m.value}</span>
        </div>
      ))}
    </div>
  );
};

export default MetricCards;
