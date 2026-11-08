import { Clock, CreditCard, Loader2 } from "lucide-react";

interface Props {
  daysLeft: number;
  onSubscribe: () => void;
  paying: boolean;
}

export default function TrialBanner({ daysLeft, onSubscribe, paying }: Props) {
  const urgent = daysLeft <= 3;
  return (
    <div
      className={`mb-6 flex flex-col sm:flex-row items-start gap-4 p-5 rounded-xl border ${
        urgent
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-primary/30 bg-primary/5 text-foreground"
      }`}
    >
      <Clock
        size={20}
        className={`mt-0.5 shrink-0 ${urgent ? "text-destructive" : "text-primary"}`}
      />
      <div className="text-sm flex-1">
        <p className="font-semibold mb-1">
          {daysLeft === 0
            ? "Seu período de avaliação acaba hoje."
            : daysLeft === 1
            ? "Falta apenas 1 dia para o fim do seu trial."
            : `Faltam ${daysLeft} dias para o fim do seu trial.`}
        </p>
        <p className={urgent ? "text-destructive/80" : "text-muted-foreground"}>
          Para continuar com acesso completo aos apps após o trial, assine o plano
          mensal por <strong>R$ 100,00/mês</strong>. Pagamento via Pix ou cartão,
          liberação automática por 30 dias.
        </p>
      </div>
      <button
        onClick={onSubscribe}
        disabled={paying}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 whitespace-nowrap"
      >
        {paying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
        {paying ? "Redirecionando..." : "Assinar agora"}
      </button>
    </div>
  );
}
