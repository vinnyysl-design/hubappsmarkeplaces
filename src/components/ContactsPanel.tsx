import { useEffect, useMemo, useState } from "react";
import { Loader2, Copy, Download, MessageCircle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface ContactRow {
  id: string;
  email: string | null;
  display_name: string | null;
  phone: string | null;
  plan: "trial" | "pagante" | "cortesia";
  status: "ativo" | "bloqueado";
  created_at: string;
}

/** Normaliza para E.164 sem "+" (padrão wa.me): garante DDI 55 no Brasil */
export function toWhatsAppNumber(phone: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length < 12) return null;
  return d;
}

/** Exibição amigável: (11) 99999-9999 */
export function formatPhoneBR(phone: string | null): string {
  const d = (phone ?? "").replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone ?? "—";
}

const planLabel: Record<string, string> = {
  trial: "Trial",
  pagante: "Pagante",
  cortesia: "Cortesia",
};

export default function ContactsPanel() {
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [planFilter, setPlanFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,display_name,phone,plan,status,created_at")
        .order("created_at", { ascending: false });
      if (error) {
        toast({
          title: "Erro ao carregar contatos",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setRows((data as ContactRow[]) ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (planFilter !== "todos" && r.plan !== planFilter) return false;
      if (planFilter === "sem_telefone" && r.phone) return false;
      if (!q) return true;
      return (
        (r.display_name ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.phone ?? "").includes(q)
      );
    });
  }, [rows, planFilter, search]);

  const withPhone = filtered.filter((r) => toWhatsAppNumber(r.phone));

  const copyNumbers = async () => {
    const list = withPhone
      .map((r) => `+${toWhatsAppNumber(r.phone)}`)
      .join("\n");
    if (!list) {
      toast({ title: "Nenhum número na seleção atual", variant: "destructive" });
      return;
    }
    await navigator.clipboard.writeText(list);
    toast({ title: `${withPhone.length} número(s) copiado(s)` });
  };

  const exportCsv = () => {
    const header = "nome,email,telefone,plano,status\n";
    const body = filtered
      .map((r) =>
        [
          `"${r.display_name ?? ""}"`,
          `"${r.email ?? ""}"`,
          `"${toWhatsAppNumber(r.phone) ? `+${toWhatsAppNumber(r.phone)}` : ""}"`,
          r.plan,
          r.status,
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contatos-analyticalx-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Buscar por nome, email ou telefone"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os planos</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="pagante">Pagantes</SelectItem>
            <SelectItem value="cortesia">Cortesia</SelectItem>
            <SelectItem value="sem_telefone">Sem telefone</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={copyNumbers}>
          <Copy size={15} className="mr-2" /> Copiar números
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download size={15} className="mr-2" /> CSV
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} cliente(s) • {withPhone.length} com telefone válido
      </p>

      <div className="border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">WhatsApp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const wa = toWhatsAppNumber(r.phone);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.display_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {r.email}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatPhoneBR(r.phone)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.plan === "pagante" ? "default" : "secondary"}>
                      {planLabel[r.plan] ?? r.plan}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={r.status === "ativo" ? "outline" : "destructive"}
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {wa ? (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={`https://wa.me/${wa}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle size={15} className="mr-2" />
                          Enviar
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        sem número
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  Nenhum contato encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
