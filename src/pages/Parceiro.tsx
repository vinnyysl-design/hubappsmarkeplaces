import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, RefreshCw, Ticket, Users, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Lead {
  nome: string;
  plano: string | null;
  fechou: boolean;
  status: string;
  data: string;
}

interface Report {
  ok: boolean;
  reason?: string;
  code?: string;
  partner_name?: string | null;
  discount_percent?: number | null;
  total_leads?: number;
  total_closed?: number;
  generated_at?: string;
  leads?: Lead[];
}

const HOUR = 60 * 60 * 1000;

export default function Parceiro() {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    const { data, error } = await supabase.rpc("get_partner_report", {
      _token: token,
    } as never);
    setReport(
      error ? { ok: false, reason: "error" } : ((data as unknown as Report) ?? { ok: false }),
    );
    setRefreshing(false);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, HOUR);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!report?.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold">Link inválido</h1>
          <p className="text-sm text-muted-foreground">
            Este link de acompanhamento não existe ou foi desativado.
          </p>
        </div>
      </div>
    );
  }

  const leads = report.leads ?? [];

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Acompanhamento de indicações
          </p>
          <h1 className="text-2xl font-bold">{report.partner_name ?? report.code}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Ticket size={14} className="text-primary" />
            Cupom <span className="font-semibold text-foreground">{report.code}</span>
            {report.discount_percent ? ` · ${Number(report.discount_percent)}% de desconto` : ""}
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users size={13} /> Cadastros com o cupom
            </p>
            <p className="text-2xl font-bold">{report.total_leads ?? 0}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 size={13} /> Fecharam assinatura
            </p>
            <p className="text-2xl font-bold text-emerald-500">{report.total_closed ?? 0}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Plano</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-sm text-muted-foreground">
                    Ninguém usou o cupom ainda.
                  </TableCell>
                </TableRow>
              )}
              {leads.map((l, i) => (
                <TableRow key={`${l.nome}-${i}`}>
                  <TableCell className="font-medium">{l.nome}</TableCell>
                  <TableCell>
                    <Badge variant={l.fechou ? "default" : "outline"}>{l.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{l.plano ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Atualizado em{" "}
            {report.generated_at
              ? new Date(report.generated_at).toLocaleString("pt-BR")
              : "—"}{" "}
            · atualiza automaticamente a cada hora
          </span>
          <Button size="sm" variant="outline" onClick={load} disabled={refreshing}>
            {refreshing ? (
              <Loader2 size={14} className="animate-spin mr-1" />
            ) : (
              <RefreshCw size={14} className="mr-1" />
            )}
            Atualizar
          </Button>
        </div>
      </div>
    </div>
  );
}
