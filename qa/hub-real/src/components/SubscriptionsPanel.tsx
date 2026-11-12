import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SubRow {
  id: string;
  email: string | null;
  display_name: string | null;
  status: "ativo" | "bloqueado";
  plan: "trial" | "pagante" | "cortesia";
  mp_preapproval_id: string | null;
  mp_preapproval_status: string | null;
  mp_next_payment_date: string | null;
  subscription_plan_id: string | null;
  subscription_ends_at: string | null;
}

const PLAN_LABEL: Record<string, string> = {
  mensal: "Mensal (R$ 100/mês)",
  trimestral: "3 meses (R$ 93/mês)",
  semestral: "6 meses (R$ 85/mês)",
  anual: "12 meses (R$ 75/mês)",
};

const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";

function statusBadge(status: string | null) {
  switch (status) {
    case "authorized":
      return { label: "ativa", variant: "outline" as const };
    case "pending":
      return { label: "pendente (cartão não autorizado)", variant: "secondary" as const };
    case "paused":
      return { label: "pausada", variant: "destructive" as const };
    case "cancelled":
      return { label: "cancelada", variant: "destructive" as const };
    default:
      return { label: status ?? "—", variant: "secondary" as const };
  }
}

export default function SubscriptionsPanel() {
  const [rows, setRows] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id,email,display_name,status,plan,mp_preapproval_id,mp_preapproval_status,mp_next_payment_date,subscription_plan_id,subscription_ends_at",
      )
      .not("mp_preapproval_id", "is", null)
      .order("mp_next_payment_date", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar assinaturas", description: error.message, variant: "destructive" });
    } else {
      setRows((data as SubRow[]) ?? []);
    }
    setLoading(false);
  };

  // Sincroniza com o Mercado Pago ao abrir, para as datas nunca ficarem defasadas
  useEffect(() => {
    (async () => {
      setSyncing(true);
      await supabase.functions.invoke("mp-subscriptions-cron", { body: {} });
      setSyncing(false);
      load();
    })();
  }, []);

  const sync = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("mp-subscriptions-cron", {
      body: {},
    });
    setSyncing(false);
    if (error) {
      toast({ title: "Erro na sincronização", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Assinaturas sincronizadas",
      description: `${(data as { checked?: number })?.checked ?? 0} assinatura(s) verificada(s) no Mercado Pago.`,
    });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground max-w-2xl">
          A cobrança dos meses seguintes é feita automaticamente pelo Mercado Pago (débito
          recorrente no cartão). Os dados abaixo são atualizados ao abrir este painel e por uma rotina automática a cada 6 horas, que confere cada assinatura, importa as cobranças
          aprovadas, estende o acesso e bloqueia quem tiver cartão cancelado ou cobrança recusada.
        </p>
        <Button size="sm" variant="outline" onClick={sync} disabled={syncing}>
          {syncing ? (
            <Loader2 size={14} className="mr-1 animate-spin" />
          ) : (
            <RefreshCw size={14} className="mr-1" />
          )}
          Sincronizar agora
        </Button>
      </div>

      {loading ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma assinatura recorrente ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Assinatura</TableHead>
                <TableHead>Próxima cobrança</TableHead>
                <TableHead>Fim do ciclo</TableHead>
                <TableHead>Acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const sb = statusBadge(r.mp_preapproval_status);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      <div className="font-medium">{r.display_name ?? "—"}</div>
                      <div className="text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {PLAN_LABEL[r.subscription_plan_id ?? ""] ?? r.subscription_plan_id ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sb.variant} className="text-[10px]">
                        {sb.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {r.mp_next_payment_date ? (
                        fmt(r.mp_next_payment_date)
                      ) : r.mp_preapproval_status === "authorized" ? (
                        <span className="text-muted-foreground">aguardando MP</span>
                      ) : (
                        <span className="text-muted-foreground">
                          sem cobrança (cartão não autorizado)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {r.subscription_ends_at ? fmt(r.subscription_ends_at) : "sem fim (renova)"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "ativo" ? "outline" : "destructive"} className="text-[10px]">
                        {r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
