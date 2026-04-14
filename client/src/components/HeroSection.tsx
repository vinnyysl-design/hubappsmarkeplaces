import logoSrc from "@/assets/logo-analyticalx.jpeg";

const HeroSection = () => {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[hsl(var(--hero-from))] via-[hsl(var(--hero-via))] to-[hsl(var(--hero-to))] px-8 py-10 mb-8 border border-border">
      <div className="flex items-center gap-4 mb-2">
        <img src={logoSrc} alt="Analytical X" className="h-12 w-auto rounded-md" />
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
          Analytical X
        </h1>
      </div>
      <p className="mt-1 text-lg font-semibold text-primary">
        Central de Inteligência para Marketplaces
      </p>
      <p className="mt-2 text-muted-foreground text-lg max-w-xl">
        Ferramentas estratégicas de dados para precificação, ads, fulfillment, devoluções e rentabilidade — tudo em um só lugar.
      </p>
    </div>
  );
};

export default HeroSection;
