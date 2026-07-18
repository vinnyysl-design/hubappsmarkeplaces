import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Shield, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import AdminAnalytics from "@/components/AdminAnalytics";
import VisionKnowledgePanel from "@/components/VisionKnowledgePanel";
import SuspiciousAccountsPanel from "@/components/SuspiciousAccountsPanel";
import TrialUsersPanel from "@/components/TrialUsersPanel";
import ReviewsPanel from "@/components/ReviewsPanel";
import PaymentsPanel, {
  RegisterPaymentButton,
  getPaymentStatus,
  formatDateBR,
  type PaymentInfo,
} from "@/components/PaymentsPanel";

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  status: "ativo" | "bloqueado";
  created_at: string;
  plan: "trial" | "pagante" | "cortesia";
}

type PlanType = "trial" | "pagante" | "cortesia";

export default function Admin() {
  const { user: currentUser } = useAuth();
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [paymentsMap, setPaymentsMap] = useState<Record<string, PaymentInfo>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [paymentsRefresh, setPaymentsRefresh] = useState(0);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id,email,display_name,status,created_at,plan")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id,role").eq("role", "admin"),
      ]);
    if (pErr || rErr) {
      toast({
        title: "Erro ao carregar usuários",
        description: pErr?.message ?? rErr?.message,
        variant: "destructive",
      });
    } else {
      setRows((profiles as ProfileRow[]) ?? []);
      setAdminIds(new Set((roles ?? []).map((r) => r.user_id)));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleStatus = async (row: ProfileRow) => {
    const next = row.status === "ativo" ? "bloqueado" : "ativo";
    setSavingId(row.id);
    const { error } = await supabase
      .from("profiles")
      .update({ status: next })
      .eq("id", row.id);
    setSavingId(null);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    toast({
      title: next === "ativo" ? "Usuário liberado" : "Usuário bloqueado",
    });
  };

  const toggleAdmin = async (row: ProfileRow) => {
    const isAdmin = adminIds.has(row.id);
    setSavingId(row.id);
    if (isAdmin) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", row.id)
        .eq("role", "admin");
      if (!error) {
        const next = new Set(adminIds);
        next.delete(row.id);
        setAdminIds(next);
      } else {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      }
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: row.id, role: "admin" });
      if (!error) {
        setAdminIds(new Set(adminIds).add(row.id));
      } else {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      }
    }
    setSavingId(null);
  };

  const changePlan = async (row: ProfileRow, next: PlanType) => {
    setSavingId(row.id);
    const { error } = await supabase
      .from("profiles")
      .update({ plan: next })
      .eq("id", row.id);
    setSavingId(null);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, plan: next } : r)));
    toast({ title: "Plano atualizado", description: `${row.email}: ${next}` });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              to="/"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeft size={14} className="mr-1" /> Voltar ao Hub
            </Link>
            <h1 className="text-2xl font-bold">Painel Administrativo</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie acesso, papéis e pagamentos dos usuários do hub.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            Atualizar
          </Button>
        </div>

        <Accordion type="multiple" className="space-y-4">
          <AccordionItem value="analytics" className="border border-border rounded-xl px-4 bg-card">
            <AccordionTrigger className="hover:no-underline text-foreground font-semibold">
              📊 Resumo / Analytics
            </AccordionTrigger>
            <AccordionContent>
              <AdminAnalytics />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="payments" className="border border-border rounded-xl px-4 bg-card">
            <AccordionTrigger className="hover:no-underline text-foreground font-semibold">
              💳 Pagamentos
            </AccordionTrigger>
            <AccordionContent>
              <PaymentsPanel
                onPaymentsLoaded={setPaymentsMap}
                refreshSignal={paymentsRefresh}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="vision" className="border border-border rounded-xl px-4 bg-card">
            <AccordionTrigger className="hover:no-underline text-foreground font-semibold">
              🧠 Base de Conhecimento
            </AccordionTrigger>
            <AccordionContent>
              <VisionKnowledgePanel />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="trial" className="border border-border rounded-xl px-4 bg-card">
            <AccordionTrigger className="hover:no-underline text-foreground font-semibold">
              🎁 Usuários em Trial
            </AccordionTrigger>
            <AccordionContent>
              <TrialUsersPanel />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="reviews" className="border border-border rounded-xl px-4 bg-card">
            <AccordionTrigger className="hover:no-underline text-foreground font-semibold">
              ⭐ Avaliações dos Usuários
            </AccordionTrigger>
            <AccordionContent>
              <ReviewsPanel />
            </AccordionContent>
          </AccordionItem>


          <AccordionItem value="suspicious" className="border border-border rounded-xl px-4 bg-card">
            <AccordionTrigger className="hover:no-underline text-foreground font-semibold">
              ⚠️ Contas Suspeitas
            </AccordionTrigger>
            <AccordionContent>
              <SuspiciousAccountsPanel />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="users" className="border border-border rounded-xl px-4 bg-card">
            <AccordionTrigger className="hover:no-underline text-foreground font-semibold">
              👥 Todos os Usuários
            </AccordionTrigger>
            <AccordionContent>
              <div className="bg-card border border-border rounded-xl overflow-hidden -mx-4">
                {loading ? (
                  <div className="p-12 flex justify-center">
                    <Loader2 className="animate-spin text-primary" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Cadastrado em</TableHead>
                        <TableHead>Papel</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Último pagamento</TableHead>
                        <TableHead>Próx. vencimento</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const isAdmin = adminIds.has(row.id);
                        const isSelf = row.id === currentUser?.id;
                        const payInfo = paymentsMap[row.id];
                        const payStatus = getPaymentStatus(payInfo);
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">
                              {row.display_name ?? "—"}
                              {isSelf && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (você)
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.email}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(row.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell>
                              <Badge variant={isAdmin ? "default" : "secondary"}>
                                {isAdmin ? "admin" : "user"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={row.status === "ativo" ? "outline" : "destructive"}
                              >
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={row.plan}
                                onValueChange={(v) => changePlan(row, v as PlanType)}
                                disabled={savingId === row.id}
                              >
                                <SelectTrigger className="h-8 w-[110px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="trial">Trial</SelectItem>
                                  <SelectItem value="pagante">Pagante</SelectItem>
                                  <SelectItem value="cortesia">Cortesia</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {formatDateBR(payInfo?.last_paid_at ?? null)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs">
                                  {formatDateBR(payInfo?.next_due_date ?? null)}
                                </span>
                                <Badge
                                  variant={payStatus.variant}
                                  className="text-[10px] w-fit"
                                >
                                  {payStatus.label}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-right space-x-2 whitespace-nowrap">
                              <RegisterPaymentButton
                                userId={row.id}
                                onRegistered={() =>
                                  setPaymentsRefresh((n) => n + 1)
                                }
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={savingId === row.id || isSelf}
                                onClick={() => toggleAdmin(row)}
                              >
                                {isAdmin ? (
                                  <ShieldOff size={14} className="mr-1" />
                                ) : (
                                  <Shield size={14} className="mr-1" />
                                )}
                                {isAdmin ? "Remover admin" : "Tornar admin"}
                              </Button>
                              <Button
                                size="sm"
                                variant={row.status === "ativo" ? "destructive" : "default"}
                                disabled={savingId === row.id || isSelf}
                                onClick={() => toggleStatus(row)}
                              >
                                {row.status === "ativo" ? "Bloquear" : "Liberar"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
