import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, Loader2, Sparkles, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type PlanId = "mensal" | "trimestral" | "semestral" | "anual";

export interface Plan {
  id: PlanId;
  label: string;
  months: number;
  total: number;
  monthly: number;
  discount: number;
  highlight?: boolean;
  badge?: string;
}

export const PLANS: Plan[] = [
  { id: "mensal",      label: "Mensal",      months: 1,  total: 100, monthly: 100, discount: 0 },
  { id: "trimestral",  label: "3 meses",     months: 3,  total: 279, monthly: 93,  discount: 7 },
  { id: "semestral",   label: "6 meses",     months: 6,  total: 510, monthly: 85,  discount: 15, highlight: true, badge: "Mais escolhido" },
  { id: "anual",       label: "12 meses",    months: 12, total: 900, monthly: 75,  discount: 25, badge: "Melhor preço" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export default function PlansDialog({ open, onOpenChange }: Props) {
  const [loadingId, setLoadingId] = useState<PlanId | null>(null);

  const handleChoose = async (plan: Plan) => {
    setLoadingId(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-mp-preference", {
        body: { plan_id: plan.id, return_url: window.location.origin },
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
      setLoadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Escolha seu plano</DialogTitle>
          <DialogDescription>
            Pagamento único do período via Pix ou cartão de crédito (parcelamos em até 12x).
            Quanto maior o período, maior o desconto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          {PLANS.map((plan) => {
            const loading = loadingId === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl border p-5 transition-colors ${
                  plan.highlight
                    ? "border-primary/60 bg-primary/5"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wide">
                    <Sparkles size={11} /> {plan.badge}
                  </span>
                )}

                <p className="text-sm font-semibold text-foreground">{plan.label}</p>

                <div className="mt-3">
                  <p className="text-2xl font-bold text-foreground">
                    {brl(plan.monthly)}
                    <span className="text-xs font-medium text-muted-foreground">/mês</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total: <strong className="text-foreground">{brl(plan.total)}</strong>
                    {plan.months > 1 && (
                      <>
                        {" · "}até {plan.months}x de {brl(plan.total / plan.months)} sem juros
                      </>
                    )}
                  </p>
                  {plan.discount > 0 && (
                    <p className="text-xs font-semibold text-emerald-500 mt-1">
                      Economia de {plan.discount}%
                    </p>
                  )}
                </div>

                <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground flex-1">
                  <li className="flex items-start gap-1.5"><Check size={13} className="mt-0.5 text-primary shrink-0" /> Acesso completo a todos os apps</li>
                  <li className="flex items-start gap-1.5"><Check size={13} className="mt-0.5 text-primary shrink-0" /> Liberação por {plan.months} {plan.months === 1 ? "mês" : "meses"}</li>
                  <li className="flex items-start gap-1.5"><Check size={13} className="mt-0.5 text-primary shrink-0" /> Pix ou cartão em até 12x</li>
                </ul>

                <button
                  onClick={() => handleChoose(plan)}
                  disabled={loading || loadingId !== null}
                  className={`mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-60 ${
                    plan.highlight
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "bg-foreground text-background hover:opacity-90"
                  }`}
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                  {loading ? "Redirecionando..." : "Assinar"}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-4">
          Pagamento processado pelo Mercado Pago. Ao final do período contratado, você pode renovar
          escolhendo qualquer plano novamente.
        </p>
      </DialogContent>
    </Dialog>
  );
}
