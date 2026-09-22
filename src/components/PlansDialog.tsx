import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, Loader2, Sparkles, CreditCard, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [mercadoPagoEmail, setMercadoPagoEmail] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("coupon_redemptions")
        .select("code, discount_percent, first_payment_done")
        .eq("user_id", uid)
        .eq("first_payment_done", false)
        .maybeSingle();
      if (!cancelled && data) {
        setCoupon({ code: data.code, discount: Number(data.discount_percent) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const firstMonth = (value: number) =>
    coupon ? Math.round(value * (1 - coupon.discount / 100) * 100) / 100 : value;

  const handleChoose = async (plan: Plan) => {
    const payerEmail = mercadoPagoEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
      toast({
        title: "Informe o e-mail do Mercado Pago",
        description: "Use o mesmo e-mail da conta que será aberta para concluir a assinatura.",
        variant: "destructive",
      });
      return;
    }

    setLoadingId(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-mp-subscription", {
        body: {
          plan_id: plan.id,
          payer_email: payerEmail,
          return_url: window.location.origin,
        },
      });
      if (error) throw error;
      const url = data?.init_point;
      if (!url) throw new Error("URL de checkout não recebida");
      window.location.href = url;
    } catch (err: any) {
      toast({
        title: "Erro ao iniciar assinatura",
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
            Assinatura recorrente no cartão de crédito. Você paga apenas a mensalidade
            do seu plano, debitada automaticamente todo mês — sem precisar ter o valor
            cheio disponível no limite.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-4">
          <Label htmlFor="mercado-pago-email">E-mail da sua conta Mercado Pago</Label>
          <Input
            id="mercado-pago-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={mercadoPagoEmail}
            onChange={(event) => setMercadoPagoEmail(event.target.value)}
            placeholder="email usado no Mercado Pago"
            disabled={loadingId !== null}
          />
          <p className="text-xs text-muted-foreground">
            Deve ser exatamente o mesmo e-mail da conta Mercado Pago usada no pagamento.
          </p>
        </div>

        {coupon && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5">
            <Ticket size={15} className="text-emerald-500 shrink-0" />
            <p className="text-xs text-foreground">
              Cupom <strong>{coupon.code}</strong> aplicado: {coupon.discount}% de desconto
              no 1º mês de qualquer plano.
            </p>
          </div>
        )}

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
                    {plan.months === 1 ? (
                      "Renova automaticamente todo mês"
                    ) : (
                      <>
                        Cobrado {brl(plan.monthly)} por mês durante{" "}
                        <strong className="text-foreground">{plan.months} meses</strong>
                      </>
                    )}
                  </p>
                  {plan.discount > 0 && (
                    <p className="text-xs font-semibold text-emerald-500 mt-1">
                      Economia de {plan.discount}% vs. mensal
                    </p>
                  )}
                  {coupon && (
                    <p className="text-xs font-semibold text-emerald-500 mt-1">
                      1º mês: {brl(firstMonth(plan.monthly))} com o cupom {coupon.code}
                    </p>
                  )}
                </div>

                <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground flex-1">
                  <li className="flex items-start gap-1.5"><Check size={13} className="mt-0.5 text-primary shrink-0" /> Acesso completo a todos os apps</li>
                  <li className="flex items-start gap-1.5"><Check size={13} className="mt-0.5 text-primary shrink-0" /> Débito automático no cartão</li>
                  <li className="flex items-start gap-1.5"><Check size={13} className="mt-0.5 text-primary shrink-0" /> Cancele quando quiser</li>
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
          Assinatura processada pelo Mercado Pago. Se o cartão for cancelado ou a cobrança
          falhar, o acesso é bloqueado automaticamente até a próxima cobrança ser aprovada.
        </p>
      </DialogContent>
    </Dialog>
  );
}
