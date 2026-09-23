import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Ticket, Gift, Percent, Trophy, Users, Link2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

type CouponKind = "discount" | "free_access";

interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  purpose: string | null;
  kind: CouponKind;
  grants_trial: boolean;
  free_days: number | null;
  discount_percent: number | null;
  valid_until: string | null;
  max_uses: number | null;
  uses_count: number;
  active: boolean;
  created_at: string;
  partner_name: string | null;
  partner_token: string | null;
}

interface RedemptionRow {
  id: string;
  code: string;
  user_id: string;
  kind: CouponKind | null;
  free_days: number | null;
  discount_percent: number | null;
  granted_until: string | null;
  first_payment_done: boolean;
  applied_at: string;
}

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const FREE_DAY_PRESETS = [
  { value: "10", label: "10 dias" },
  { value: "20", label: "20 dias" },
  { value: "30", label: "1 mês (30 dias)" },
  { value: "90", label: "3 meses (90 dias)" },
  { value: "180", label: "6 meses (180 dias)" },
  { value: "365", label: "1 ano (365 dias)" },
];

const describeRule = (c: {
  kind: CouponKind | null;
  free_days: number | null;
  discount_percent: number | null;
  grants_trial?: boolean;
}) => {
  const base =
    c.kind === "free_access"
      ? `${c.free_days ?? 0} dias de acesso grátis`
      : `${Number(c.discount_percent ?? 0)}% no 1º mês`;
  if (c.grants_trial === undefined) return base;
  return `${base} · ${c.grants_trial ? "com" : "sem"} 10 dias de teste`;
};

export default function CouponsPanel() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<CouponKind>("discount");
  const [purpose, setPurpose] = useState("");
  const [discount, setDiscount] = useState("10");
  const [freeDays, setFreeDays] = useState("90");
  const [grantsTrial, setGrantsTrial] = useState(true);
  const [validUntil, setValidUntil] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [partnerName, setPartnerName] = useState("");

  const partnerLink = (token: string) =>
    `${window.location.origin}/parceiro/${token}`;

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(partnerLink(token));
    toast({ title: "Link copiado", description: "Envie para a empresa parceira." });
  };

  const newToken = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const load = async () => {
    setLoading(true);
    const [{ data: cps, error: cErr }, { data: rds }, { data: profiles }] =
      await Promise.all([
        supabase.from("coupons").select("*").order("created_at", { ascending: false }),
        supabase
          .from("coupon_redemptions")
          .select(
            "id, code, user_id, kind, free_days, discount_percent, granted_until, first_payment_done, applied_at",
          )
          .order("applied_at", { ascending: false }),
        supabase.from("profiles").select("id, email"),
      ]);
    if (cErr) {
      toast({ title: "Erro ao carregar cupons", description: cErr.message, variant: "destructive" });
    }
    setCoupons((cps as unknown as CouponRow[]) ?? []);
    setRedemptions((rds as unknown as RedemptionRow[]) ?? []);
    setEmails(
      Object.fromEntries(((profiles ?? []) as any[]).map((p) => [p.id, p.email ?? "—"])),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(() => {
    const byCode = new Map<string, number>();
    redemptions.forEach((r) => byCode.set(r.code, (byCode.get(r.code) ?? 0) + 1));
    const ranking = [...byCode.entries()].sort((a, b) => b[1] - a[1]);
    return {
      totalUses: redemptions.length,
      activeCoupons: coupons.filter((c) => c.active).length,
      top: ranking[0] ?? null,
      ranking,
      paid: redemptions.filter((r) => r.first_payment_done).length,
    };
  }, [coupons, redemptions]);

  const createCoupon = async () => {
    const normalized = code.trim();
    const pct = Number(discount);
    const days = Number(freeDays);
    if (normalized.length < 3) {
      toast({ title: "Informe um código com ao menos 3 caracteres", variant: "destructive" });
      return;
    }
    if (kind === "discount" && !(pct > 0 && pct <= 100)) {
      toast({ title: "Desconto deve ser entre 1 e 100", variant: "destructive" });
      return;
    }
    if (kind === "free_access" && !(days >= 1 && days <= 3650)) {
      toast({ title: "Informe quantos dias de acesso grátis", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("coupons").insert({
      code: normalized,
      kind,
      grants_trial: grantsTrial,
      discount_percent: kind === "discount" ? pct : null,
      free_days: kind === "free_access" ? days : null,
      purpose: purpose.trim() || null,
      valid_until: validUntil ? new Date(`${validUntil}T23:59:59`).toISOString() : null,
      max_uses: maxUses ? Number(maxUses) : null,
      partner_name: partnerName.trim() || null,
      partner_token: partnerName.trim() ? newToken() : null,
      description:
        kind === "free_access"
          ? `${days} dias de acesso grátis`
          : `Desconto de ${pct}% no primeiro mês`,
    } as any);
    setSaving(false);
    if (error) {
      toast({
        title: "Erro ao criar cupom",
        description: error.message.includes("duplicate")
          ? "Já existe um cupom com esse código."
          : error.message,
        variant: "destructive",
      });
      return;
    }
    setCode("");
    setPurpose("");
    setDiscount("10");
    setFreeDays("90");
    setGrantsTrial(true);
    setValidUntil("");
    setMaxUses("");
    setPartnerName("");
    toast({ title: "Cupom criado", description: normalized });
    load();
  };

  const toggleActive = async (row: CouponRow) => {
    const { error } = await supabase
      .from("coupons")
      .update({ active: !row.active })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setCoupons((prev) =>
      prev.map((c) => (c.id === row.id ? { ...c, active: !c.active } : c)),
    );
  };

  const removeCoupon = async (row: CouponRow) => {
    const { error } = await supabase.from("coupons").delete().eq("id", row.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cupom excluído", description: row.code });
    load();
  };

  return (
    <div className="space-y-6">
      {/* Criar cupom */}
      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="coupon-code">Código</Label>
            <Input
              id="coupon-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="MeliXp10"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de cupom</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as CouponKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discount">Desconto no 1º mês</SelectItem>
                <SelectItem value="free_access">Acesso grátis por período</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-purpose">Para que serve</Label>
            <Input
              id="coupon-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Ex: sorteio do evento Meli XP"
            />
          </div>

          {kind === "discount" ? (
            <div className="space-y-1.5">
              <Label htmlFor="coupon-discount">Desconto (%)</Label>
              <Input
                id="coupon-discount"
                type="number"
                min={1}
                max={100}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Tempo de acesso grátis</Label>
              <Select value={freeDays} onValueChange={setFreeDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREE_DAY_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="coupon-valid">Cupom válido até</Label>
            <Input
              id="coupon-valid"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-max">Limite de usos</Label>
            <Input
              id="coupon-max"
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="ilimitado"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-partner">Empresa parceira (gera link externo)</Label>
            <Input
              id="coupon-partner"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="Ex: Nexia"
            />
          </div>
        </div>


        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between pt-1">
          <div className="flex items-center gap-3">
            <Switch
              id="coupon-trial"
              checked={grantsTrial}
              onCheckedChange={setGrantsTrial}
            />
            <Label htmlFor="coupon-trial" className="font-normal">
              Quem usar este cupom também ganha os 10 dias grátis
            </Label>
          </div>
          <Button onClick={createCoupon} disabled={saving}>
            {saving ? (
              <Loader2 size={15} className="animate-spin mr-1" />
            ) : (
              <Plus size={15} className="mr-1" />
            )}
            Criar cupom
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Métricas */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Ticket size={13} /> Cupons ativos
              </p>
              <p className="text-xl font-bold">{metrics.activeCoupons}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users size={13} /> Usos totais
              </p>
              <p className="text-xl font-bold">{metrics.totalUses}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Trophy size={13} /> Mais usado
              </p>
              <p className="text-sm font-bold truncate">
                {metrics.top ? `${metrics.top[0]} (${metrics.top[1]})` : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Percent size={13} /> Já pagaram
              </p>
              <p className="text-xl font-bold">{metrics.paid}</p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cupom</TableHead>
                <TableHead>Regra</TableHead>
                <TableHead>10 dias grátis</TableHead>
                <TableHead>Finalidade</TableHead>
                <TableHead>Válido até</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Link do parceiro</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-sm text-muted-foreground">
                    Nenhum cupom cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {coupons.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {c.kind === "free_access" ? (
                        <Gift size={14} className="text-emerald-500" />
                      ) : (
                        <Ticket size={14} className="text-primary" />
                      )}
                      {c.code}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{describeRule(c)}</TableCell>
                  <TableCell>
                    <Badge variant={c.grants_trial ? "default" : "outline"}>
                      {c.grants_trial ? "sim" : "não"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                    {c.purpose ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">{fmt(c.valid_until)}</TableCell>
                  <TableCell className="text-xs">
                    {c.uses_count}
                    {c.max_uses ? ` / ${c.max_uses}` : ""}
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.partner_token ? (
                      <div className="flex items-center gap-1">
                        <a
                          href={partnerLink(c.partner_token)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <Link2 size={13} /> {c.partner_name ?? "abrir"}
                        </a>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => copyLink(c.partner_token!)}
                        >
                          <Copy size={13} />
                        </Button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch checked={c.active} onCheckedChange={() => toggleActive(c)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => removeCoupon(c)}>
                      <Trash2 size={14} className="mr-1" /> Excluir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div>
            <h3 className="text-sm font-semibold mb-2">
              Quem usou ({redemptions.length})
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Cupom</TableHead>
                  <TableHead>Benefício</TableHead>
                  <TableHead>Usado em</TableHead>
                  <TableHead>Acesso grátis até</TableHead>
                  <TableHead>1ª cobrança</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {redemptions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      Nenhum cliente usou cupom ainda.
                    </TableCell>
                  </TableRow>
                )}
                {redemptions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{emails[r.user_id] ?? r.user_id}</TableCell>
                    <TableCell className="text-xs font-medium">{r.code}</TableCell>
                    <TableCell className="text-xs">{describeRule(r)}</TableCell>
                    <TableCell className="text-xs">{fmt(r.applied_at)}</TableCell>
                    <TableCell className="text-xs">{fmt(r.granted_until)}</TableCell>
                    <TableCell>
                      {r.kind === "free_access" ? (
                        <Badge variant="outline">acesso grátis</Badge>
                      ) : (
                        <Badge variant={r.first_payment_done ? "default" : "outline"}>
                          {r.first_payment_done ? "já paga" : "pendente"}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
