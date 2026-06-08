import { useEffect, useState } from "react";
import { Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TrialRow {
  id: string;
  email: string | null;
  display_name: string | null;
  trial_started_at: string | null;
  trial_status: string;
  status: string;
}

const TRIAL_DAYS = 10;

function daysLeft(start: string | null): number | null {
  if (!start) return null;
  const end = new Date(start).getTime() + TRIAL_DAYS * 86400000;
  const diff = end - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export default function TrialUsersPanel() {
  const [rows, setRows] = useState<TrialRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id,email,display_name,trial_started_at,trial_status,status,plan")
      .eq("plan", "trial")
      .in("trial_status", ["ativo", "pendente", "expirado"])
      .order("trial_started_at", { ascending: false, nullsFirst: false });
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const ativos = rows.filter((r) => r.trial_status === "ativo").length;
  const pendentes = rows.filter((r) => r.trial_status === "pendente").length;
  const expirados = rows.filter((r) => r.trial_status === "expirado").length;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock size={18} className="text-primary" /> Usuários em Trial
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Visão geral dos cadastros no período de avaliação de {TRIAL_DAYS} dias.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge variant="default">Ativos: {ativos}</Badge>
          <Badge variant="secondary">Pendentes: {pendentes}</Badge>
          <Badge variant="destructive">Expirados: {expirados}</Badge>
        </div>
      </div>

      {loading ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum usuário em trial no momento.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Início do trial</TableHead>
              <TableHead>Dias restantes</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const left = daysLeft(r.trial_started_at);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.display_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.email}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {r.trial_started_at
                      ? new Date(r.trial_started_at).toLocaleDateString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {left === null ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Badge
                        variant={
                          left === 0
                            ? "destructive"
                            : left <= 3
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {left} dia{left === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.trial_status === "ativo"
                          ? "default"
                          : r.trial_status === "expirado"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {r.trial_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
