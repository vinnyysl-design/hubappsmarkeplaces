import { useState, useMemo, useEffect } from "react";
import { Search, SlidersHorizontal, Lock, CreditCard, FileCheck, Sparkles } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import HubSidebar, { type HubView } from "@/components/HubSidebar";
import { useAppPrefs } from "@/hooks/useAppPrefs";

import { toast } from "@/hooks/use-toast";
import MetricCards from "@/components/MetricCards";
import AppCard, { type HubApp } from "@/components/AppCard";
import AppPreviewModal from "@/components/AppPreviewModal";
import { usePreviewPrefs } from "@/hooks/usePreviewPrefs";
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
import PlansDialog from "@/components/PlansDialog";
import apps from "@/data/apps.json";
import { usePageViewTracker } from "@/hooks/useTracking";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_NUMBER = "5511915264364";

const Index = () => {
  usePageViewTracker();
  const { user, status, isAdmin, refreshProfile, termsAcceptedAt, termsVersion, isAuthenticated, trialStatus, trialEndsAt, plan } = useAuth();

  // Retorno da assinatura recorrente (Mercado Pago) — sincroniza status
  useEffect(() => {
    if (!isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    const subscription = params.get("subscription");
    const preapprovalId = params.get("preapproval_id");
    if (!subscription && !preapprovalId) return;

    toast({
      title: "Assinatura recebida!",
      description: "Estamos liberando seu acesso, aguarde alguns segundos.",
    });

    let tries = 0;
    const run = async () => {
      tries++;
      try {
        await supabase.functions.invoke("sync-mp-subscription", {
          body: preapprovalId ? { preapproval_id: preapprovalId } : {},
        });
      } catch (_) {
        /* ignora e tenta novamente */
      }
      await refreshProfile();
    };
    run();
    const interval = setInterval(async () => {
      await run();
      if (tries >= 5) clearInterval(interval);
    }, 5000);

    window.history.replaceState({}, "", window.location.pathname);
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshProfile]);

  // Rede de segurança: se o usuário está bloqueado, revalida a assinatura no MP
  useEffect(() => {
    if (!isAuthenticated || isAdmin || status !== "bloqueado") return;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("sync-mp-subscription", { body: {} });
        if (data?.status === "authorized") await refreshProfile();
      } catch (_) {
        /* silencioso */
      }
    })();
  }, [isAuthenticated, isAdmin, status, refreshProfile]);



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
  const [view, setView] = useState<HubView>("todos");
  const [plansOpen, setPlansOpen] = useState(false);
  const [preview, setPreview] = useState<HubApp | null>(null);
  const previewPrefs = usePreviewPrefs();
  const paying = false;
  const { favorites, recent } = useAppPrefs();
  const displayName =
    ((user?.user_metadata?.display_name as string) || user?.email || "").split(/[ @]/)[0];

  const handleSubscribe = () => setPlansOpen(true);

  const categoriasList = useMemo(
    () => Array.from(new Set(apps.map((a) => a.categoria))).sort(),
    []
  );
  const categorias = ["Todos", ...categoriasList];
  const categoria = view.startsWith("cat:") ? view.slice(4) : "Todos";
  const setCategoria = (c: string) => setView(c === "Todos" ? "todos" : (`cat:${c}` as HubView));
  const idOf = (a: (typeof apps)[number]) => a.slug || a.nome;

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    let base = apps.filter((app) => {
      const matchCat = categoria === "Todos" || app.categoria === categoria;
      const conteudo = `${app.nome} ${app.descricao} ${app.categoria} ${app.tag}`.toLowerCase();
      return matchCat && conteudo.includes(termo);
    });
    if (view === "favoritos") base = base.filter((a) => favorites.includes(idOf(a)));
    if (view === "recentes")
      base = recent.map((id) => base.find((a) => idOf(a) === id)).filter(Boolean) as typeof apps;
    return base;
  }, [busca, categoria, view, favorites, recent]);

  const destaques = useMemo(() => apps.filter((a) => a.tag), []);
  const showDestaques = view === "todos" && !busca.trim() && destaques.length > 0;

  const ativos = apps.filter((a) => a.status === "Ativo").length;
  const beta = apps.filter((a) => a.status === "Beta").length;
  const numCategorias = categoriasList.length;

  const counts = {
    todos: apps.length,
    favoritos: apps.filter((a) => favorites.includes(idOf(a))).length,
    recentes: recent.filter((id) => apps.some((a) => idOf(a) === id)).length,
    cats: Object.fromEntries(categoriasList.map((c) => [c, apps.filter((a) => a.categoria === c).length])),
  };

  const sectionTitle =
    view === "favoritos" ? "Favoritos" : view === "recentes" ? "Utilizados recentemente" : categoria !== "Todos" ? categoria : "Todos os aplicativos";
  const emptyText =
    view === "favoritos" && !busca
      ? "Você ainda não favoritou nenhum aplicativo. Toque na estrela de um card para adicioná-lo aqui."
      : view === "recentes" && !busca
      ? "Os aplicativos que você abrir aparecerão aqui."
      : "Nenhum aplicativo encontrado.";

  const supportHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "Olá! Sou cliente do Analytical X e preciso de suporte. Pode me ajudar?"
  )}`;

  return (
    <SidebarProvider defaultOpen={typeof window === "undefined" || window.innerWidth >= 1024}>
      <WhatsNewDialog />
      <WelcomeDialog />
      <ReviewDialog />
      <TermsDialog open={needsTerms} onAccepted={() => refreshProfile()} />
      <PlansDialog open={plansOpen} onOpenChange={setPlansOpen} />
      <AppPreviewModal
        app={preview}
        locked={isBlocked}
        onClose={() => setPreview(null)}
        onDontShowChange={(id, v) => previewPrefs.setDismissed(id, v)}
        onCompleted={(id) => previewPrefs.markCompleted(id)}
      />
      <div className="min-h-screen flex w-full bg-background">
        <HubSidebar view={view} onChange={setView} counts={counts} categorias={categoriasList} supportHref={supportHref} />

        <div className="flex-1 min-w-0 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
            <div className="flex items-center gap-3 px-4 md:px-6 h-16">
              <SidebarTrigger />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground truncate">
                  {displayName ? `Olá, ${displayName} 👋` : "Olá 👋"} · Analytical X App Center
                </p>
                <h1 className="text-base md:text-lg font-bold text-foreground leading-tight truncate">
                  Central de Inteligência
                </h1>
              </div>
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>

          <main className="flex-1 px-4 md:px-6 py-6 max-w-7xl w-full mx-auto">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-5 mb-5">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 pointer-events-none" />
              <div className="relative flex flex-col lg:flex-row lg:items-center gap-5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary/90">Clareza, prioridade e lucros para sua operação.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ferramentas de dados para precificação, ads, fulfillment, devoluções e rentabilidade.
                  </p>
                  {/* Busca */}
                  <div className="relative mt-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                      type="search"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar por nome, descrição ou categoria..."
                      aria-label="Buscar aplicativo"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm shadow-sm transition-shadow"
                    />
                  </div>
                </div>
                <div className="lg:w-[340px] shrink-0 min-w-0">
                  <MetricCards total={apps.length} ativos={ativos} beta={beta} categorias={numCategorias} />
                </div>
              </div>
            </div>

            {isBlocked && (
              <div className="mb-5 flex flex-col sm:flex-row items-start gap-4 p-5 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive">
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
                        Escolha um plano para liberar todos os apps do Hub — mensal, trimestral,
                        semestral ou anual (com desconto de até 25%). Pagamento via Pix ou cartão em
                        até 12x. Liberação automática após a confirmação.
                      </p>
                    </>
                  )}
                </div>
                {!needsTerms && (
                  <button
                    onClick={handleSubscribe}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition whitespace-nowrap"
                  >
                    <CreditCard size={16} />
                    Ver planos
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

            {/* Category pills */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <SlidersHorizontal size={14} className="text-muted-foreground mr-1" />
              {categorias.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoria(c)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    categoria === c && (c !== "Todos" || view === "todos")
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-card text-muted-foreground border-border hover:border-primary/20 hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {showDestaques && (
              <section className="mb-8">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                  <Sparkles size={15} className="text-primary" /> Aplicativos em destaque
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {destaques.map((app) => (
                    <AppCard key={`d-${app.nome}`} app={app} onPreview={setPreview} />
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="flex items-center justify-between text-sm font-semibold text-foreground mb-3">
                <span>{sectionTitle}</span>
                <span className="text-xs font-normal text-muted-foreground">{filtrados.length} app(s)</span>
              </h2>
              {filtrados.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
                  {emptyText}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtrados.map((app) => (
                    <AppCard key={app.nome} app={app} onPreview={setPreview} />
                  ))}
                </div>
              )}
            </section>

            {/* Footer */}
            <footer className="text-center text-muted-foreground text-xs mt-14 pb-20 md:pb-6 border-t border-border pt-6">
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
          </main>
        </div>
      </div>
      {!isBlocked && <VisionAgent />}
      <div className="md:hidden">
        <SupportButton phoneNumber={WHATSAPP_NUMBER} />
        <ReviewButton />
      </div>
    </SidebarProvider>
  );
};

export default Index;
