const HeroSection = () => {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[hsl(var(--hero-from))] via-[hsl(var(--hero-via))] to-[hsl(var(--hero-to))] px-8 py-10 mb-8">
      <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
        🚀 Central de Inteligência para Marketplaces
      </h1>
      <p className="mt-2 text-blue-200 text-lg max-w-xl">
        Ferramentas estratégicas de dados para precificação, ads, fulfillment, devoluções e rentabilidade — tudo em um só lugar.
      </p>
    </div>
  );
};

export default HeroSection;
