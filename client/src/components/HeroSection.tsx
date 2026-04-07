import { Crosshair } from "lucide-react";

const HeroSection = () => {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[hsl(var(--hero-from))] via-[hsl(var(--hero-via))] to-[hsl(var(--hero-to))] px-8 py-10 mb-8 border border-border">
      <div className="flex items-center gap-3 mb-2">
        <Crosshair className="text-primary" size={28} />
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
          Nexus App
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
