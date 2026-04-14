import logoSrc from "@/assets/logo-analyticalx.jpeg";

const HeroSection = () => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-8 py-12 mb-8">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 pointer-events-none" />
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium text-primary tracking-wide uppercase">Plataforma ativa</span>
        </div>
        <div className="flex items-center gap-4 mb-2">
          <img src={logoSrc} alt="Analytical X" className="h-14 w-auto rounded-md" />
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight leading-tight">
            Analytical{" "}
            <span className="bg-gradient-to-br from-[hsl(220,80%,45%)] via-[hsl(280,60%,50%)] to-[hsl(175,70%,45%)] bg-clip-text text-transparent">X</span>
          </h1>
        </div>
        <p className="mt-2 text-lg font-medium text-primary/80">
          Central de Inteligência para Marketplaces
        </p>
        <p className="mt-3 text-muted-foreground text-base max-w-lg leading-relaxed">
          Ferramentas estratégicas de dados para precificação, ads, fulfillment, devoluções e rentabilidade — tudo em um só lugar.
        </p>
      </div>
    </div>
  );
};

export default HeroSection;
