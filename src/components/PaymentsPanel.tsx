import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  X,
  CircleDollarSign,
  ShieldOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface PaymentInfo {
  user_id: string;
  last_paid_at: string | null;
  next_due_date: string | null;
  amount: number | null;
}

interface ProfileLite {
  id: string;
  display_name: string | null;
  email: string | null;
  status: "ativo" | "bloqueado";
}

interface PaymentRow {
  id: string;
  user_id: string;
  paid_at: string;
  amount: number | null;
  next_due_date: string;
  notes: string | null;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const daysBetween = (a: string, b: string) => {
  const d1 = new Date(a + "T00:00:00");
  const d2 = new Date(b + "T00:00:00");
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
};

const formatDateBR = (iso: string | null) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR") : "—";

export function getPaymentStatus(p: PaymentInfo | undefined) {
  if (!p?.next_due_date) {
    return { label: "Sem registro", variant: "secondary" as const, overdue: 0 };
  }
  const diff = daysBetween(todayISO(), p.next_due_date); // >0 = a vencer, <0 = vencido
  if (diff >= 0) {
    return {
      label: `Em dia (vence em ${diff}d)`,
      variant: "outline" as const,
      overdue: 0,
    };
  }
  const overdue = Math.abs(diff);
  if (overdue >= 3) {
    return {
      label: `Vencido há ${overdue}d`,
      variant: "destructive" as const,
      overdue,
    };
  }
  return {
    label: `Atrasado ${overdue}d`,
    variant: "default" as const,
    overdue,
  };
}

interface Props {
  /** Map de informações de pagamento por user_id, exposto para o Admin reutilizar nas linhas */
  onPaymentsLoaded?: (map: Record<string, PaymentInfo>) => void;
  refreshSignal?: number;
}

export default function PaymentsPanel({ onPaymentsLoaded, refreshSignal }: Props) {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    paid_at: todayISO(),
    amount: "",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    const [profRes, payRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,display_name,email,status")
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("id,user_id,paid_at,amount,next_due_date,notes")
        .order("paid_at", { ascending: false }),
    ]);
    if (profRes.error || payRes.error) {
      toast({
        title: "Erro ao carregar pagamentos",
        description: profRes.error?.message ?? payRes.error?.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    setProfiles((profRes.data ?? []) as ProfileLite[]);
    const pays = (payRes.data ?? []) as PaymentRow[];
    setPayments(pays);

    // Monta mapa: último pagamento por usuário (já vem ordenado desc)
    const map: Record<string, PaymentInfo> = {};
    pays.forEach((p) => {
      if (!map[p.user_id]) {
        map[p.user_id] = {
          user_id: p.user_id,
          last_paid_at: p.paid_at,
          next_due_date: p.next_due_date,
          amount: p.amount,
        };
      }
    });
    onPaymentsLoaded?.(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  // ----- Métricas -----
  const stats = useMemo(() => {
    const map: Record<string, PaymentInfo> = {};
    payments.forEach((p) => {
      if (!map[p.user_id]) {
        map[p.user_id] = {
          user_id: p.user_id,
          last_paid_at: p.paid_at,
          next_due_date: p.next_due_date,
          amount: p.amount,
        };
      }
    });

    let aReceber = 0; // vence nos próximos 30 dias
    let vencidos = 0;
    let bloquearAgora = 0; // vencido >= 3d
    profiles.forEach((p) => {
      const info = map[p.id];
      if (!info?.next_due_date) return;
      const diff = daysBetween(todayISO(), info.next_due_date);
      if (diff >= 0 && diff <= 30) aReceber += 1;
      if (diff < 0) vencidos += 1;
      if (diff <= -3) bloquearAgora += 1;
    });

    const ativos = profiles.filter((p) => p.status === "ativo").length;
    const bloqueados = profiles.filter((p) => p.status === "bloqueado").length;

    return { aReceber, vencidos, bloquearAgora, ativos, bloqueados };
  }, [profiles, payments]);

  // Lista de usuários para alerta de bloqueio
  const usuariosParaBloquear = useMemo(() => {
    const map: Record<string, PaymentInfo> = {};
    payments.forEach((p) => {
      if (!map[p.user_id]) {
        map[p.user_id] = {
          user_id: p.user_id,
          last_paid_at: p.paid_at,
          next_due_date: p.next_due_date,
          amount: p.amount,
        };
      }
    });
    return profiles
      .filter((p) => p.status === "ativo")
      .map((p) => ({ profile: p, info: map[p.id] }))
      .filter(
        ({ info }) =>
          info?.next_due_date &&
          daysBetween(todayISO(), info.next_due_date) <= -3
      );
  }, [profiles, payments]);

  const openDialog = (userId?: string) => {
    setForm({
      user_id: userId ?? "",
      paid_at: todayISO(),
      amount: "",
      notes: "",
    });
    setDialogOpen(true);
  };

  const handleSavePayment = async () => {
    if (!form.user_id) {
      toast({ title: "Selecione um usuário", variant: "destructive" });
      return;
    }
    setSavingPayment(true);
    const payload = {
      user_id: form.user_id,
      paid_at: form.paid_at,
      amount: form.amount ? Number(form.amount) : null,
      next_due_date: new Date(
        new Date(form.paid_at + "T00:00:00").getTime() +
          30 * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .slice(0, 10),
      notes: form.notes || null,
      created_by: currentUser?.id ?? null,
    };
    const { error } = await supabase.from("payments").insert(payload);
    setSavingPayment(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pagamento registrado" });
    setDialogOpen(false);
    load();
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  const cards = [
    {
      label: "A receber (30d)",
      value: stats.aReceber,
      icon: <CalendarClock size={18} />,
      tone: "text-primary bg-primary/10",
    },
    {
      label: "Pagamentos vencidos",
      value: stats.vencidos,
      icon: <AlertTriangle size={18} />,
      tone: "text-destructive bg-destructive/10",
    },
    {
      label: "Usuários ativos",
      value: stats.ativos,
      icon: <CheckCircle2 size={18} />,
      tone: "text-emerald-500 bg-emerald-500/10",
    },
    {
      label: "Usuários bloqueados",
      value: stats.bloqueados,
      icon: <ShieldOff size={18} />,
      tone: "text-muted-foreground bg-muted",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CircleDollarSign size={20} className="text-primary" />
            Pagamentos & assinaturas
          </h2>
          <p className="text-sm text-muted-foreground">
            Controle manual de mensalidades. Próximo vencimento = pagamento + 30 dias.
          </p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus size={14} className="mr-1" /> Registrar pagamento
        </Button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4"
          >
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${c.tone}`}
            >
              {c.icon}
            </div>
            <div>
              <span className="text-2xl font-bold text-foreground leading-none">
                {c.value}
              </span>
              <span className="block text-xs font-medium text-muted-foreground mt-0.5">
                {c.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Alerta de bloqueio */}
      {usuariosParaBloquear.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-destructive shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <h3 className="font-semibold text-destructive">
                {usuariosParaBloquear.length} usuário(s) com pagamento vencido há
                3+ dias — considere bloquear:
              </h3>
              <ul className="mt-2 space-y-1 text-sm">
                {usuariosParaBloquear.map(({ profile, info }) => (
                  <li
                    key={profile.id}
                    className="flex items-center justify-between"
                  >
                    <span>
                      <strong>{profile.display_name ?? profile.email}</strong>
                      <span className="text-muted-foreground ml-2">
                        venceu em {formatDateBR(info.next_due_date)} (
                        {Math.abs(daysBetween(todayISO(), info.next_due_date!))}d)
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: registrar pagamento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck size={18} /> Registrar pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Usuário</Label>
              <Select
                value={form.user_id}
                onValueChange={(v) => setForm((f) => ({ ...f, user_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name ?? p.email ?? p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data do pagamento</Label>
                <Input
                  type="date"
                  value={form.paid_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, paid_at: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor (R$) — opcional</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações — opcional</Label>
              <Input
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Ex: Pix, transferência, ref. abril"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Próximo vencimento será calculado automaticamente:{" "}
              <strong>
                {formatDateBR(
                  new Date(
                    new Date(form.paid_at + "T00:00:00").getTime() +
                      30 * 24 * 60 * 60 * 1000
                  )
                    .toISOString()
                    .slice(0, 10)
                )}
              </strong>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X size={14} className="mr-1" /> Cancelar
            </Button>
            <Button onClick={handleSavePayment} disabled={savingPayment}>
              {savingPayment && (
                <Loader2 size={14} className="mr-1 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Botão pequeno reutilizado na linha da tabela de usuários */
export function RegisterPaymentButton({
  userId,
  onRegistered,
}: {
  userId: string;
  onRegistered: () => void;
}) {
  const { user: currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paidAt, setPaidAt] = useState(todayISO());
  const [amount, setAmount] = useState("");

  const save = async () => {
    setSaving(true);
    const next = new Date(
      new Date(paidAt + "T00:00:00").getTime() + 30 * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .slice(0, 10);
    const { error } = await supabase.from("payments").insert({
      user_id: userId,
      paid_at: paidAt,
      amount: amount ? Number(amount) : null,
      next_due_date: next,
      created_by: currentUser?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pagamento registrado" });
    setOpen(false);
    onRegistered();
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <CalendarCheck size={14} className="mr-1" /> Pagamento
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Data do pagamento</Label>
              <Input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$) — opcional</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { formatDateBR };
