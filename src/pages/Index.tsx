import { useState, useMemo, useEffect } from "react";
import { Search, SlidersHorizontal, Lock, CreditCard, Loader2, FileCheck } from "lucide-react";
import HeroSection from "@/components/HeroSection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import MetricCards from "@/components/MetricCards";
import AppCard from "@/components/AppCard";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import WhatsNewDialog from "@/components/WhatsNewDialog";
import WelcomeDialog from "@/components/WelcomeDialog";
import ReviewDialog from "@/components/ReviewDialog";
import TermsDialog, { TERMS_VERSION } from "@/components/TermsDialog";
import VisionAgent from "@/components/VisionAgent";
import SupportButton from "@/components/SupportButton";
import ReviewButton from "@/components/ReviewButton";
import TrialBanner from "@/components/TrialBanner";
import RenewalBanner from "@/components/RenewalBanner";
import apps from "@/data/apps.json";
import { usePageViewTracker } from "@/hooks/useTracking";
import { useAuth } from "@/contexts/AuthContext";

const WHATSAPP_NUMBER = "5511915264364";

const Index = () => {
  usePageViewTracker();
  const { status, isAdmin, refreshProfile, termsAcceptedAt, termsVersion, isAuthenticated, trialStatus, trialEndsAt, plan } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (!payment) return;
    if (payment === "success") {
      toast({
        title: "Pagamento recebido!",
        description: "Estamos liberando seu acesso. Pode levar alguns segundos.",
      });
      let tries = 0;
      const interval = setInterval(async () => {
        tries++;
        await refreshProfile();
        if (tries >= 6) clearInterval(interval);
      }, 3000);
    } else if (payment === "pending") {
      toast({
        title: "Pagamento pendente",
        description: "Assim que for confirmado seu acesso será liberado automaticamente.",
      });
    } else if (payment === "failure") {
      toast({
        title: "Pagamento não concluído",
        description: "Você pode tentar novamente.",
        variant: "destructive",
      });
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, [refreshProfile]);
  const needsTerms =
    isAuthenticated &&
    !isAdmin &&
    status === "ativo" &&
    (!termsAcceptedAt || termsVersion !== TERMS_VERSION);
  const isBlocked = (status === "bloqueado" || needsTerms) && !isAdmin;
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("Todos");
  const [paying, setPaying] = useState(false);

  const handleSubscribe = async () => {
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-mp-preference", {
        body: { return_url: window.location.origin },
      });
      if (error) throw error;
      const url = data?.init_point || data?.sandbox_init_point;
      if (!url) throw new Error("URL de checkout não recebida");
      window.location.href = url;
    } catch (err: any) {
      toast({
        title: "Erro ao iniciar pagamento",
        description: err?.message ?? "Tente novamente em instantes.",
        variant: "destructive",
      });
      setPaying(false);
    }
  };

  const categorias = useMemo(
    () => ["Todos", ...Array.from(new Set(apps.map((a) => a.categoria))).sort()],
    []
  );

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return apps.filter((app) => {
      const matchCat = categoria === "Todos" || app.categoria === categoria;
      const conteudo = `${app.nome} ${app.descricao} ${app.tag}`.toLowerCase();
      const matchTermo = conteudo.includes(termo);
      return matchCat && matchTermo;
    });
  }, [busca, categoria]);

  const ativos = apps.filter((a) => a.status === "Ativo").length;
  const beta = apps.filter((a) => a.status === "Beta").length;
  const numCategorias = new Set(apps.map((a) => a.categoria)).size;

  return (
    <div className="min-h-screen bg-background">
      <WhatsNewDialog />
      <WelcomeDialog />
      <ReviewDialog />
      <TermsDialog open={needsTerms} onAccepted={() => refreshProfile()} />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-end items-center gap-2 mb-4">
          <ThemeToggle />
          <UserMenu />
        </div>
        <HeroSection />
        {isBlocked && (
          <div className="mb-6 flex flex-col sm:flex-row items-start gap-4 p-5 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive">
            {needsTerms ? <FileCheck size={20} className="mt-0.5 shrink-0" /> : <Lock size={20} className="mt-0.5 shrink-0" />}
            <div className="text-sm flex-1">
              {needsTerms ? (
                <>
                  <p className="font-semibold mb-1">Falta apenas aceitar o Termo de Uso.</p>
                  <p className="text-destructive/80">
                    Pagamento confirmado! Para liberar o acesso aos apps pelo período contratado,
                    leia e aceite o Termo de Uso e Responsabilidade.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold mb-1">Seu acesso aos apps está bloqueado.</p>
                  <p className="text-destructive/80">
                    Para liberar todos os apps do Hub, assine o plano mensal por{" "}
                    <strong>R$ 100,00/mês</strong>. Após o pagamento (Pix ou cartão), seu acesso é
                    liberado automaticamente por 30 dias.
                  </p>
                </>
              )}
            </div>
            {!needsTerms && (
              <button
                onClick={handleSubscribe}
                disabled={paying}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 whitespace-nowrap"
              >
                {paying ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CreditCard size={16} />
                )}
                {paying ? "Redirecionando..." : "Assinar por R$ 100/mês"}
              </button>
            )}
          </div>
        )}
        {!isBlocked && !isAdmin && plan === "trial" && trialStatus === "ativo" && trialEndsAt && (() => {
          const left = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000));
          return <TrialBanner daysLeft={left} onSubscribe={handleSubscribe} paying={paying} />;
        })()}
        {!isBlocked && !isAdmin && plan === "pagante" && trialEndsAt && (() => {
          const left = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000));
          if (left > 5) return null;
          return <RenewalBanner daysLeft={left} dueDateISO={trialEndsAt} onSubscribe={handleSubscribe} paying={paying} />;
        })()}
        <MetricCards total={apps.length} ativos={ativos} beta={beta} categorias={numCategorias} />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar aplicativo..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 text-sm transition-shadow"
            />
          </div>
          <div className="relative">
            <SlidersHorizontal className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="pl-9 pr-8 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 appearance-none cursor-pointer transition-shadow"
            >
              {categorias.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categorias.map((c) => (
            <button
              key={c}
              onClick={() => setCategoria(c)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                categoria === c
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-card text-muted-foreground border-border hover:border-primary/20 hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Apps grid */}
        {filtrados.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground text-sm">
            Nenhum aplicativo encontrado.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtrados.map((app) => (
              <AppCard key={app.nome} app={app} />
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-muted-foreground text-xs mt-14 pb-6 border-t border-border pt-6">
          <div className="flex items-center justify-center gap-4 mb-2">
            <a
              href="https://www.instagram.com/analytical.x.com.br"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram Analytical X"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-[#e6683c] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              <span>@analytical.x.com.br</span>
            </a>
          </div>
          <p>© 2026 Analytical X · Todos os direitos reservados</p>
        </footer>
      </div>
      {!isBlocked && <VisionAgent />}
      <SupportButton phoneNumber={WHATSAPP_NUMBER} />
      <ReviewButton />
    </div>
  );
};

export default Index;
