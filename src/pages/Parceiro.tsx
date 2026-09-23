import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, RefreshCw, Ticket, Users, CheckCircle2, Handshake, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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

interface MonthlyClosed {
  month: string;
  closed: number;
}

interface Report {
  ok: boolean;
  reason?: string;
  code?: string;
  partner_name?: string | null;
  partner_logo_url?: string | null;
  discount_percent?: number | null;
  total_leads?: number;
  total_closed?: number;
  monthly_closed?: MonthlyClosed[];
  generated_at?: string;
  leads?: Lead[];
}

const HOUR = 60 * 60 * 1000;

const chartConfig = {
  closed: {
    label: "Assinaturas",
    color: "hsl(var(--primary))",
  },
};

const partnerInitials = (name?: string | null, code?: string) => {
  const source = (name || code || "P").trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
};

const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "");
};

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
  const monthlyClosed = (report.monthly_closed ?? []).map((item) => ({
    ...item,
    label: monthLabel(item.month),
  }));
  const hasMonthlyData = monthlyClosed.some((item) => Number(item.closed) > 0);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card">
              {report.partner_logo_url ? (
                <img
                  src={report.partner_logo_url}
                  alt={`Logo ${report.partner_name ?? report.code}`}
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <span className="text-xl font-bold text-foreground">
                  {partnerInitials(report.partner_name, report.code)}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Acompanhamento de indicações
              </p>
              <h1 className="text-2xl font-bold">{report.partner_name ?? report.code}</h1>
              <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <Handshake size={13} /> Parceria
                </Badge>
                <span className="flex items-center gap-1.5">
                  <Ticket size={14} className="text-primary" />
                  Cupom <span className="font-semibold text-foreground">{report.code}</span>
                </span>
                {report.discount_percent ? <span>· {Number(report.discount_percent)}% de desconto</span> : null}
              </p>
            </div>
          </div>
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
            <p className="text-2xl font-bold text-primary">{report.total_closed ?? 0}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 size={15} className="text-primary" /> Assinaturas por mês
              </h2>
              <p className="text-xs text-muted-foreground">Comparativo mensal de fechamentos com este cupom</p>
            </div>
          </div>
          {hasMonthlyData ? (
            <ChartContainer config={chartConfig} className="h-[220px] w-full aspect-auto">
              <BarChart data={monthlyClosed} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="closed" fill="var(--color-closed)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Ainda não há assinaturas fechadas para comparar.
            </div>
          )}
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
