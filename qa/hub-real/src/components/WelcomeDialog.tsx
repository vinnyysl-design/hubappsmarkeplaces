import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_PREFIX = "hub:welcomeSeen:";

export default function WelcomeDialog() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    const key = `${STORAGE_PREFIX}${user.id}`;
    if (!localStorage.getItem(key)) {
      setOpen(true);
    }
  }, [loading, user]);

  const handleClose = () => {
    if (user) localStorage.setItem(`${STORAGE_PREFIX}${user.id}`, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : setOpen(o))}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Rocket className="text-primary" size={18} />
            </div>
            <DialogTitle>Seja muito bem-vindo à Analytical X 🚀</DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
            <p className="font-semibold text-foreground">
              Sua CENTRAL DE INTELIGÊNCIA para Marketplaces.
            </p>
            <p>
              A Analytical X é um Hub de Soluções Estratégicas criado para
              sellers e operações de e-commerce que precisam tomar decisões
              rápidas, inteligentes e orientadas por dados.
            </p>
            <p>Aqui você encontra estratégia aplicada para:</p>
            <ul className="space-y-1.5 pl-1">
              <li>📊 Precificação</li>
              <li>📢 Ads e performance</li>
              <li>📦 Fulfillment</li>
              <li>🔄 Devoluções</li>
              <li>💰 Rentabilidade</li>
              <li>📈 Gestão e análise de operação</li>
            </ul>
            <p className="font-medium text-foreground">
              Tudo isso em um único ambiente.
            </p>
            <p>
              Nossa missão é transformar dados em ações claras, conectando
              diagnóstico, estratégia e execução através de ferramentas que
              economizam tempo, aumentam margem e ajudam sua operação a crescer
              com mais controle.
            </p>
            <p>
              Chega de planilhas dispersas, retrabalho e decisões no escuro.
            </p>
            <p>
              A Analytical X reúne tudo que sua operação precisa para vender
              mais e vender melhor nos marketplaces.
            </p>
            <p className="font-semibold text-foreground">
              Seja bem-vindo ao futuro da inteligência aplicada ao e-commerce. 🚀
            </p>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full sm:w-auto">
            Vamos começar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
