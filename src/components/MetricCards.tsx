interface MetricCardsProps {
  total: number;
  ativos: number;
  beta: number;
  categorias: number;
}

const MetricCards = ({ total, ativos, beta, categorias }: MetricCardsProps) => {
  const metrics = [
    { label: "Total de apps", value: total, icon: "📦" },
    { label: "Ativos", value: ativos, icon: "✅" },
    { label: "Em beta", value: beta, icon: "🧪" },
    { label: "Categorias", value: categorias, icon: "📁" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="bg-card border border-border rounded-2xl p-5 flex flex-col items-start gap-1 shadow-sm"
        >
          <span className="text-2xl">{m.icon}</span>
          <span className="text-sm font-medium text-muted-foreground">{m.label}</span>
          <span className="text-3xl font-bold text-foreground">{m.value}</span>
        </div>
      ))}
    </div>
  );
};

export default MetricCards;
