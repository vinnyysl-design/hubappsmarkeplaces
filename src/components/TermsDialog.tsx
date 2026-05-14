import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, FileCheck } from "lucide-react";

export const TERMS_VERSION = "1.0";

interface Props {
  open: boolean;
  onAccepted: () => void;
}

export default function TermsDialog({ open, onAccepted }: Props) {
  const { user, refreshProfile } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAccept = async () => {
    if (!user || !agreed) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        terms_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao registrar aceite", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Termo aceito", description: "Seu acesso está liberado pelo período contratado." });
    await refreshProfile();
    onAccepted();
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* bloqueado: não fecha sem aceitar */ }}>
      <DialogContent className="max-w-3xl" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck size={20} className="text-primary" />
            Termo de Uso e Responsabilidade
          </DialogTitle>
          <DialogDescription>
            Para liberar o acesso aos apps, leia e aceite os termos abaixo. Versão {TERMS_VERSION}.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[420px] rounded-md border border-border p-4 text-sm leading-relaxed">
          <div className="space-y-4 text-foreground">
            <h3 className="font-semibold text-base">Contrato de Licença de Uso de Ferramenta e Prestação de Serviços de Acesso</h3>

            <section>
              <h4 className="font-semibold">1. Identificação das partes</h4>
              <p><strong>CONTRATADA:</strong> Vinicius Lima LTDA - Analytical X, CNPJ 47.192.694/0001-70, com sede em Rua dos Mercanteis, nº 40, representada por Vinicius Lima (Founder).</p>
              <p><strong>CONTRATANTE:</strong> o(a) usuário(a) titular do cadastro identificado pelo e-mail vinculado a esta conta.</p>
            </section>

            <section>
              <h4 className="font-semibold">2. Objeto</h4>
              <p>Disponibilização de 1 (um) acesso à ferramenta <strong>Analytical X – Central de Inteligência para Marketplaces</strong>, durante o prazo contratado, sem cessão de propriedade intelectual, código-fonte ou tecnologia.</p>
            </section>

            <section>
              <h4 className="font-semibold">3. Quantidade e titularidade dos acessos</h4>
              <p>Cada acesso é <strong>individual, exclusivo e intransferível</strong>, devendo ser utilizado por apenas 1 (uma) pessoa física identificada. É proibido compartilhar login/senha, permitir uso simultâneo, revender, sublicenciar, ceder ou emprestar o acesso. O descumprimento gera <strong>bloqueio imediato</strong>.</p>
            </section>

            <section>
              <h4 className="font-semibold">4. Liberação do acesso</h4>
              <p>A liberação ocorre após confirmação do pagamento. O prazo de vigência de cada acesso é de <strong>30 (trinta) dias corridos</strong>, contados da liberação efetiva.</p>
            </section>

            <section>
              <h4 className="font-semibold">5. Vigência e renovação</h4>
              <p>Cada período contratado dura 30 (trinta) dias. A renovação depende de <strong>novo pagamento confirmado</strong>. Não havendo pagamento, o acesso será suspenso ou encerrado ao final do ciclo vigente. Não há renovação automática sem manifestação positiva da CONTRATANTE.</p>
            </section>

            <section>
              <h4 className="font-semibold">6. Preço, cobrança e pagamento</h4>
              <p>Valor de <strong>R$ 100,00</strong> por acesso, referente ao ciclo de 30 dias. Pagamento por Pix, cartão ou outro meio aceito. Considera-se adimplido apenas após compensação/confirmação.</p>
            </section>

            <section>
              <h4 className="font-semibold">7. Obrigações da CONTRATADA</h4>
              <p>Liberar o acesso após confirmação do pagamento; manter a ferramenta disponível durante o período pago, ressalvadas paradas técnicas, manutenções, indisponibilidade de terceiros, caso fortuito ou força maior; prestar orientações básicas de uso.</p>
            </section>

            <section>
              <h4 className="font-semibold">8. Obrigações da CONTRATANTE</h4>
              <p>Realizar os pagamentos nas datas ajustadas; usar a ferramenta em conformidade com este contrato e a legislação; manter sob sigilo as credenciais; não compartilhar, transferir ou comercializar o acesso; comunicar uso indevido ou suspeita de violação.</p>
            </section>

            <section>
              <h4 className="font-semibold">9. Penalidades por uso indevido</h4>
              <p>O descumprimento das regras de exclusividade sujeita a CONTRATANTE, além do bloqueio imediato, à <strong>multa não compensatória de 5% do valor de 1 (uma) nova parcela/ciclo por acesso irregular</strong>. A reativação fica a critério comercial da CONTRATADA. Em caso de reincidência, o contrato pode ser rescindido por justa causa, sem devolução de valores já pagos.</p>
            </section>

            <section>
              <h4 className="font-semibold">10. Suspensão e rescisão</h4>
              <p>A CONTRATADA poderá suspender ou rescindir o contrato em caso de inadimplemento, uso compartilhado, violação das obrigações contratuais ou uso ilícito da ferramenta. O cancelamento solicitado após a liberação não gera reembolso proporcional do ciclo em andamento.</p>
            </section>

            <section>
              <h4 className="font-semibold">11. Propriedade intelectual</h4>
              <p>Todos os direitos relativos à ferramenta, dashboards, marca, métodos e materiais são de titularidade exclusiva da CONTRATADA. É vedado copiar, distribuir, fazer engenharia reversa, sublicenciar ou explorar economicamente a ferramenta.</p>
            </section>

            <section>
              <h4 className="font-semibold">12. Proteção de dados (LGPD)</h4>
              <p>Os dados compartilhados serão tratados em conformidade com a Lei nº 13.709/2018 (LGPD). As comunicações poderão ocorrer por e-mail, WhatsApp ou área do cliente, sendo válidas para fins de notificação.</p>
            </section>

            <section>
              <h4 className="font-semibold">13. Disposições gerais</h4>
              <p>Ao clicar em "Aceito os termos", a CONTRATANTE declara ter lido, compreendido e concordado integralmente com este instrumento, que terá força de contrato celebrado entre as partes, com registro eletrônico de data, hora e versão aceita.</p>
            </section>
          </div>
        </ScrollArea>

        <div className="flex items-start gap-2 pt-2">
          <Checkbox id="agree-terms" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
          <label htmlFor="agree-terms" className="text-sm leading-snug cursor-pointer">
            Li e <strong>aceito</strong> integralmente o Termo de Uso e Responsabilidade acima.
          </label>
        </div>

        <DialogFooter>
          <Button onClick={handleAccept} disabled={!agreed || saving}>
            {saving && <Loader2 size={14} className="animate-spin mr-2" />}
            Aceitar e liberar acesso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
