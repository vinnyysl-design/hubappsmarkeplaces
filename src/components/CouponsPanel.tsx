import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  discount_percent: number;
  valid_until: string | null;
  max_uses: number | null;
  uses_count: number;
  active: boolean;
  created_at: string;
}

interface RedemptionRow {
  id: string;
  code: string;
  user_id: string;
  first_payment_done: boolean;
  applied_at: string;
}

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export default function CouponsPanel() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("10");
  const [validUntil, setValidUntil] = useState("");
  const [maxUses, setMaxUses] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: cps, error: cErr }, { data: rds }, { data: profiles }] =
      await Promise.all([
        supabase.from("coupons").select("*").order("created_at", { ascending: false }),
        supabase
          .from("coupon_redemptions")
          .select("id, code, user_id, first_payment_done, applied_at")
          .order("applied_at", { ascending: false }),
        supabase.from("profiles").select("id, email"),
      ]);
    if (cErr) {
      toast({ title: "Erro ao carregar cupons", description: cErr.message, variant: "destructive" });
    }
    setCoupons((cps as CouponRow[]) ?? []);
    setRedemptions((rds as RedemptionRow[]) ?? []);
    setEmails(
      Object.fromEntries(((profiles ?? []) as any[]).map((p) => [p.id, p.email ?? "—"])),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createCoupon = async () => {
    const normalized = code.trim();
    const pct = Number(discount);
    if (normalized.length < 3) {
      toast({ title: "Informe um código com ao menos 3 caracteres", variant: "destructive" });
      return;
    }
    if (!(pct > 0 && pct <= 100)) {
      toast({ title: "Desconto deve ser entre 1 e 100", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("coupons").insert({
      code: normalized,
      discount_percent: pct,
      valid_until: validUntil ? new Date(`${validUntil}T23:59:59`).toISOString() : null,
      max_uses: maxUses ? Number(maxUses) : null,
      description: `Desconto de ${pct}% no primeiro mês`,
    });
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
    setDiscount("10");
    setValidUntil("");
    setMaxUses("");
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
      <div className="grid gap-3 md:grid-cols-5 items-end rounded-lg border border-border bg-muted/30 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="coupon-code">Código</Label>
          <Input
            id="coupon-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="MeliXp10"
            className="uppercase"
          />
        </div>
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
        <div className="space-y-1.5">
          <Label htmlFor="coupon-valid">Válido até</Label>
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
        <Button onClick={createCoupon} disabled={saving}>
          {saving ? (
            <Loader2 size={15} className="animate-spin mr-1" />
          ) : (
            <Plus size={15} className="mr-1" />
          )}
          Criar cupom
        </Button>
      </div>

      {loading ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cupom</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Válido até</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    Nenhum cupom cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {coupons.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Ticket size={14} className="text-primary" /> {c.code}
                  </TableCell>
                  <TableCell>{Number(c.discount_percent)}%</TableCell>
                  <TableCell className="text-xs">{fmt(c.valid_until)}</TableCell>
                  <TableCell className="text-xs">
                    {c.uses_count}
                    {c.max_uses ? ` / ${c.max_uses}` : ""}
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
              Usos ({redemptions.length})
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Cupom</TableHead>
                  <TableHead>Usado em</TableHead>
                  <TableHead>1ª cobrança com desconto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {redemptions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">
                      Nenhum cliente usou cupom ainda.
                    </TableCell>
                  </TableRow>
                )}
                {redemptions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{emails[r.user_id] ?? r.user_id}</TableCell>
                    <TableCell className="text-xs font-medium">{r.code}</TableCell>
                    <TableCell className="text-xs">{fmt(r.applied_at)}</TableCell>
                    <TableCell>
                      <Badge variant={r.first_payment_done ? "default" : "outline"}>
                        {r.first_payment_done ? "já paga" : "pendente"}
                      </Badge>
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
