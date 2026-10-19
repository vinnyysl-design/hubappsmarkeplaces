import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, TrendingDown, Receipt, PackageX, BarChart3, ShieldCheck, Clock, CreditCard } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ThemeToggle from "@/components/ThemeToggle";
import logoSrc from "@/assets/logo-analyticalx.png.asset.json";
import apps from "@/data/apps.json";

const SIGNUP = "/auth?modo=cadastro";
const WHATSAPP = `https://wa.me/5511915264364?text=${encodeURIComponent("Olá! Quero saber mais sobre o Analytical X.")}`;

const PLANOS = [
  { label: "Mensal", monthly: 100, total: 100, months: 1, discount: 0 },
  { label: "3 meses", monthly: 93, total: 279, months: 3, discount: 7 },
  { label: "6 meses", monthly: 85, total: 510, months: 6, discount: 15, badge: "Mais escolhido" },
  { label: "12 meses", monthly: 75, total: 900, months: 12, discount: 25, badge: "Melhor preço" },
];

const DORES = [
  { icon: Receipt, titulo: "Vende muito e sobra pouco", texto: "Taxas, comissão e frete comem a margem e você não sabe quanto lucra em cada venda.", solucao: "Precificação Estratégica e Painel Financeiro mostram o lucro real por produto." },
  { icon: TrendingDown, titulo: "Anúncios que gastam sem retorno", texto: "Investe em ads sem saber quais produtos realmente merecem verba.", solucao: "Curva ABC e Ads Engine apontam onde investir e onde cortar." },
  { icon: PackageX, titulo: "Devoluções e frete reverso", texto: "Cada devolução vira prejuízo escondido no fim do mês.", solucao: "A ferramenta de Devoluções revela motivos, custos e produtos problemáticos." },
  { icon: BarChart3, titulo: "Planilhas e decisões no escuro", texto: "Horas montando relatórios e ainda assim sem clareza do que fazer.", solucao: "Diagnósticos prontos com ações sugeridas e o agente de IA Vision X." },
];

const FAQ = [
  { q: "Como funciona o teste grátis?", a: "Ao criar sua conta e confirmar o e-mail, você ganha 10 dias de acesso a todas as ferramentas, sem precisar cadastrar cartão." },
  { q: "Para quais marketplaces funciona?", a: "As ferramentas foram feitas para vendedores do Mercado Livre e da Shopee, e várias também aceitam dados de Amazon, Magalu e TikTok Shop." },
  { q: "Preciso conectar minha conta do marketplace?", a: "Não. Você usa os relatórios que já exporta do seu canal ou ERP (CSV/Excel) e a análise sai na hora." },
  { q: "Quais as formas de pagamento?", a: "Pix ou cartão em até 12x, via Mercado Pago. O acesso é liberado automaticamente após a confirmação." },
  { q: "Posso cancelar quando quiser?", a: "Sim. Você escolhe o período do plano e não há fidelidade além dele." },
  { q: "Tenho um cupom de parceiro, onde uso?", a: "No cadastro há um campo para o cupom. O desconto ou benefício é aplicado automaticamente." },
];

export default function Landing() {
  useEffect(() => {
    document.title = "Analytical X | Ferramentas de lucro para Mercado Livre e Shopee";
  }, []);
  const ativos = apps.filter((a) => a.status !== "Inativo");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-4 h-16">
          <img src={logoSrc.url} alt="Analytical X" className="h-8 w-auto rounded" />
          <span className="font-extrabold tracking-tight">Analytical X</span>
          <nav className="hidden md:flex gap-6 ml-8 text-sm text-muted-foreground">
            <a href="#ferramentas" className="hover:text-foreground">Ferramentas</a>
            <a href="#planos" className="hover:text-foreground">Planos</a>
            <a href="#faq" className="hover:text-foreground">Dúvidas</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link to="/auth" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Entrar</Link>
            <Link to={SIGNUP} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">Testar grátis</Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent pointer-events-none" />
          <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs font-medium text-primary uppercase tracking-wide">
              Mercado Livre · Shopee
            </span>
            <h1 className="mt-6 text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05] max-w-3xl">
              Descubra quanto você <span className="text-primary">lucra de verdade</span> em cada venda.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              {ativos.length} ferramentas de dados para precificação, ads, fulfillment, devoluções e rentabilidade — tudo em um só lugar, feitas para quem vende em marketplaces.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={SIGNUP} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90">
                Testar grátis por 10 dias <ArrowRight size={18} />
              </Link>
              <a href="#planos" className="px-6 py-3.5 rounded-xl border border-border bg-card font-semibold hover:border-primary/40">Ver planos</a>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5"><Clock size={15} className="text-primary" /> 10 dias grátis</li>
              <li className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-primary" /> Sem cartão no teste</li>
              <li className="flex items-center gap-1.5"><CreditCard size={15} className="text-primary" /> Pix ou até 12x</li>
            </ul>
          </div>
        </section>

        {/* Dores */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold tracking-tight">Problemas que resolvemos</h2>
          <p className="mt-2 text-muted-foreground">As dores mais comuns de quem vende em marketplace.</p>
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            {DORES.map(({ icon: Icon, titulo, texto, solucao }) => (
              <div key={titulo} className="rounded-2xl border border-border bg-card p-6">
                <Icon className="text-primary" size={24} />
                <h3 className="mt-4 font-semibold text-lg">{titulo}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
                <p className="mt-3 text-sm flex gap-2"><Check size={16} className="text-primary shrink-0 mt-0.5" />{solucao}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Ferramentas */}
        <section id="ferramentas" className="border-y border-border bg-card/40">
          <div className="max-w-6xl mx-auto px-4 py-16">
            <h2 className="text-3xl font-bold tracking-tight">As ferramentas</h2>
            <p className="mt-2 text-muted-foreground">Todas incluídas na assinatura.</p>
            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ativos.map((app) => (
                <div key={app.slug || app.nome} className="rounded-xl border border-border bg-background p-5">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden>{app.icone}</span>
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-tight">{app.nome}</h3>
                      <p className="text-xs text-primary">{app.categoria}{app.status === "Beta" ? " · Beta" : ""}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{app.descricao}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Planos */}
        <section id="planos" className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold tracking-tight">Planos</h2>
          <p className="mt-2 text-muted-foreground">Comece com 10 dias grátis. Depois, escolha o período que preferir — acesso a todas as ferramentas.</p>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANOS.map((p) => (
              <div key={p.label} className={`relative rounded-2xl border p-6 bg-card ${p.badge === "Mais escolhido" ? "border-primary ring-1 ring-primary/40" : "border-border"}`}>
                {p.badge && <span className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">{p.badge}</span>}
                <p className="font-semibold">{p.label}</p>
                <p className="mt-3"><span className="text-3xl font-extrabold">R$ {p.monthly}</span><span className="text-muted-foreground text-sm">/mês</span></p>
                <p className="text-xs text-muted-foreground mt-1">
                  {p.months === 1 ? "Cobrança mensal" : `R$ ${p.total} a cada ${p.months} meses`}
                  {p.discount ? ` · ${p.discount}% off` : ""}
                </p>
                <Link to={SIGNUP} className="mt-6 block text-center px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">Testar grátis</Link>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="max-w-3xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold tracking-tight">Perguntas frequentes</h2>
          <Accordion type="single" collapsible className="mt-6">
            {FAQ.map((f, i) => (
              <AccordionItem key={i} value={`f${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* CTA final */}
        <section className="max-w-6xl mx-auto px-4 pb-20">
          <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-accent/10 to-transparent p-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Pare de vender no escuro.</h2>
            <p className="mt-2 text-muted-foreground">Crie sua conta e teste todas as ferramentas por 10 dias.</p>
            <Link to={SIGNUP} className="mt-6 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90">
              Testar grátis por 10 dias <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <div className="flex justify-center gap-4 mb-2">
          <a href="https://www.instagram.com/analytical.x.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Instagram</a>
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">WhatsApp</a>
        </div>
        © 2026 Analytical X · Todos os direitos reservados
      </footer>
    </div>
  );
}
