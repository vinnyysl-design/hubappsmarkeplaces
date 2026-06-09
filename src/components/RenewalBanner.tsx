import { CalendarClock, CreditCard, Loader2 } from "lucide-react";

interface Props {
  daysLeft: number;
  dueDateISO: string;
  onSubscribe: () => void;
  paying: boolean;
}

export default function RenewalBanner({ daysLeft, dueDateISO, onSubscribe, paying }: Props) {
  const urgent = daysLeft <= 3;
  const dateBR = new Date(dueDateISO).toLocaleDateString("pt-BR");
  return (
    <div
      className={`mb-6 flex flex-col sm:flex-row items-start gap-4 p-5 rounded-xl border ${
        urgent
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-amber-500/30 bg-amber-500/5 text-foreground"
      }`}
    >
      <CalendarClock
        size={20}
        className={`mt-0.5 shrink-0 ${urgent ? "text-destructive" : "text-amber-500"}`}
      />
      <div className="text-sm flex-1">
        <p className="font-semibold mb-1">
          {daysLeft === 0
            ? `Sua assinatura vence hoje (${dateBR}).`
            : daysLeft === 1
            ? `Sua assinatura vence amanhã (${dateBR}).`
            : `Faltam ${daysLeft} dias para o vencimento da sua assinatura (${dateBR}).`}
        </p>
        <p className={urgent ? "text-destructive/80" : "text-muted-foreground"}>
          Renove o pagamento mensal para não perder o acesso. Caso o vencimento
          passe sem confirmação, todas as ferramentas são bloqueadas
          automaticamente e só voltam a liberar quando o pagamento for
          identificado ou o administrador atualizar a data manualmente.
        </p>
      </div>
      <button
        onClick={onSubscribe}
        disabled={paying}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 whitespace-nowrap"
      >
        {paying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
        {paying ? "Redirecionando..." : "Renovar agora"}
      </button>
    </div>
  );
}
