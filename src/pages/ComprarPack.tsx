import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const PACKS: Record<string, { uses: number; amount: string; label: string }> = {
  "pack-5": { uses: 5, amount: "R$ 24,99", label: "Pack 5 usos" },
  "pack-8": { uses: 8, amount: "R$ 38,99", label: "Pack 8 usos" },
  "pack-10": { uses: 10, amount: "R$ 44,99", label: "Pack 10 usos" },
  "pack-20": { uses: 20, amount: "R$ 84,99", label: "Pack 20 usos" },
};

export default function ComprarPack() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const packId = params.get("pack") ?? "";
  const pack = PACKS[packId];

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!pack) {
        setStatus("error");
        setError(
          `Pack inválido${packId ? ` ("${packId}")` : ""}. Use pack-5, pack-8, pack-10 ou pack-20.`,
        );
        return;
      }

      setStatus("loading");
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const returnTo = `/comprar-pack?pack=${packId}`;
        navigate(`/auth?redirect=${encodeURIComponent(returnTo)}`, { replace: true });
        return;
      }

      const { data, error: fnErr } = await supabase.functions.invoke(
        "create-mp-preference",
        {
          body: {
            pack_id: packId,
            return_url: window.location.origin,
          },
        },
      );

      if (cancelled) return;

      if (fnErr || !data?.init_point) {
        console.error("create-mp-preference error:", fnErr, data);
        setStatus("error");
        setError(
          fnErr?.message ||
            (data as any)?.error ||
            "Não foi possível criar o pagamento. Tente novamente.",
        );
        return;
      }

      window.location.href = data.init_point as string;
    }

    start();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId]);

  const paymentStatus = params.get("payment");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-lg">
        {paymentStatus === "success" ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h1 className="text-2xl font-semibold">Pagamento aprovado!</h1>
            <p className="text-muted-foreground text-sm">
              Seus usos foram creditados no Gerador de Imagens. Pode voltar e usar
              agora mesmo.
            </p>
            <Button onClick={() => navigate("/app/gerador-imagens")} className="w-full">
              Abrir Gerador de Imagens
            </Button>
          </div>
        ) : status === "error" ? (
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-2xl font-semibold">Não foi possível continuar</h1>
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button onClick={() => navigate("/app/gerador-imagens")} variant="outline" className="w-full">
              Voltar ao Gerador
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
            <h1 className="text-2xl font-semibold">
              {pack ? `Comprando ${pack.label}` : "Preparando pagamento…"}
            </h1>
            {pack && (
              <p className="text-muted-foreground text-sm">
                {pack.uses} usos por {pack.amount}. Você será redirecionado para o
                Mercado Pago em instantes.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
