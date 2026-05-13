import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Eye,
  MousePointerClick,
  Users,
  Loader2,
  Download,
  TrendingUp,
  UserPlus,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface PageView {
  id: string;
  user_id: string;
  path: string;
  referrer: string | null;
  user_agent: string | null;
  created_at: string;
}

interface ToolClick {
  id: string;
  user_id: string;
  tool_id: string;
  tool_name: string;
  tool_category: string | null;
  tool_url: string | null;
  created_at: string;
}

interface ProfileMap {
  [id: string]: { display_name: string | null; email: string | null; created_at?: string };
}

interface PaymentRow {
  id: string;
  user_id: string;
  amount: number | null;
  paid_at: string;
  next_due_date: string;
}

interface ProfileRowMin {
  id: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
}

const startOfTodayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [pageViews, setPageViews] = useState<PageView[]>([]);
  const [toolClicks, setToolClicks] = useState<ToolClick[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [allProfiles, setAllProfiles] = useState<ProfileRowMin[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const load = async () => {
    setLoading(true);
    const since30 = daysAgoISO(30);

    const [pvRes, tcRes, profRes, payRes] = await Promise.all([
      supabase
        .from("page_views")
        .select("id,user_id,path,referrer,user_agent,created_at")
        .gte("created_at", since30)
        .order("created_at", { ascending: false }),
      supabase
        .from("tool_clicks")
        .select(
          "id,user_id,tool_id,tool_name,tool_category,tool_url,created_at"
        )
        .gte("created_at", since30)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,display_name,email,created_at"),
      supabase
        .from("payments")
        .select("id,user_id,amount,paid_at,next_due_date")
        .order("paid_at", { ascending: false }),
    ]);

    if (pvRes.error || tcRes.error || profRes.error || payRes.error) {
      toast({
        title: "Erro ao carregar analytics",
        description:
          pvRes.error?.message ??
          tcRes.error?.message ??
          profRes.error?.message ??
          payRes.error?.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setPageViews(pvRes.data ?? []);
    setToolClicks(tcRes.data ?? []);
    const map: ProfileMap = {};
    (profRes.data ?? []).forEach((p) => {
      map[p.id] = { display_name: p.display_name, email: p.email, created_at: p.created_at };
    });
    setProfiles(map);
    setAllProfiles(profRes.data ?? []);
    setPayments(payRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // ----- Métricas derivadas -----
  const today = startOfTodayISO();

  const visitsLast30 = pageViews.length;
  const clicksLast30 = toolClicks.length;

  const uniqueVisitorsToday = useMemo(() => {
    const set = new Set<string>();
    pageViews.forEach((pv) => {
      if (pv.created_at >= today) set.add(pv.user_id);
    });
    return set.size;
  }, [pageViews, today]);

  const pageViewsToday = useMemo(
    () => pageViews.filter((pv) => pv.created_at >= today).length,
    [pageViews, today]
  );

  // ----- Mensal: novos cadastros e receita -----
  const monthKey = (iso: string) => iso.slice(0, 7); // YYYY-MM
  const currentMonthKey = new Date().toISOString().slice(0, 7);

  const formatBRL = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatMonthLabel = (key: string) => {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  };

  const newSignupsThisMonth = useMemo(
    () => allProfiles.filter((p) => monthKey(p.created_at) === currentMonthKey).length,
    [allProfiles, currentMonthKey]
  );

  const revenueThisMonth = useMemo(
    () =>
      payments
        .filter((p) => monthKey(p.paid_at) === currentMonthKey)
        .reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [payments, currentMonthKey]
  );

  const monthlyBreakdown = useMemo(() => {
    // últimos 6 meses
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }
    return months.map((key) => {
      const signups = allProfiles.filter(
        (p) => monthKey(p.created_at) === key
      ).length;
      const monthPayments = payments.filter((p) => monthKey(p.paid_at) === key);
      const revenue = monthPayments.reduce(
        (s, p) => s + (Number(p.amount) || 0),
        0
      );
      return {
        key,
        label: formatMonthLabel(key),
        signups,
        paymentsCount: monthPayments.length,
        revenue,
      };
    });
  }, [allProfiles, payments]);

  const top5Tools = useMemo(() => {
    const counts: Record<string, { name: string; category: string | null; count: number }> =
      {};
    toolClicks.forEach((tc) => {
      const key = tc.tool_id;
      if (!counts[key]) {
        counts[key] = { name: tc.tool_name, category: tc.tool_category, count: 0 };
      }
      counts[key].count += 1;
    });
    return Object.entries(counts)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [toolClicks]);

  const recentPageViews = useMemo(() => pageViews.slice(0, 20), [pageViews]);

  // ----- Atividades recentes (page_views + tool_clicks com tempo estimado) -----
  type Activity = {
    id: string;
    user_id: string;
    created_at: string;
    kind: "page" | "tool";
    label: string;
    sublabel?: string | null;
    durationMs: number | null;
  };

  const recentActivities = useMemo<Activity[]>(() => {
    // junta os dois tipos
    const all: Activity[] = [
      ...pageViews.map((pv) => ({
        id: `pv-${pv.id}`,
        user_id: pv.user_id,
        created_at: pv.created_at,
        kind: "page" as const,
        label: pv.path,
        sublabel: null,
        durationMs: null as number | null,
      })),
      ...toolClicks.map((tc) => ({
        id: `tc-${tc.id}`,
        user_id: tc.user_id,
        created_at: tc.created_at,
        kind: "tool" as const,
        label: tc.tool_name,
        sublabel: tc.tool_category ?? null,
        durationMs: null as number | null,
      })),
    ];

    // por usuário, ordena asc para calcular o tempo até o próximo evento
    const byUser: Record<string, Activity[]> = {};
    all.forEach((a) => {
      (byUser[a.user_id] ??= []).push(a);
    });
    Object.values(byUser).forEach((list) => {
      list.sort((a, b) => a.created_at.localeCompare(b.created_at));
      for (let i = 0; i < list.length; i++) {
        if (list[i].kind !== "tool") continue;
        const next = list[i + 1];
        if (!next) continue;
        const diff =
          new Date(next.created_at).getTime() -
          new Date(list[i].created_at).getTime();
        // só considera "tempo na ferramenta" se < 2h (acima disso assume sessão encerrada)
        if (diff > 0 && diff < 1000 * 60 * 60 * 2) {
          list[i].durationMs = diff;
        }
      }
    });

    return all
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 30);
  }, [pageViews, toolClicks]);

  const formatDuration = (ms: number | null) => {
    if (ms == null) return "—";
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min < 60) return sec ? `${min}m ${sec}s` : `${min}m`;
    const hr = Math.floor(min / 60);
    const rmin = min % 60;
    return rmin ? `${hr}h ${rmin}m` : `${hr}h`;
  };

  // ----- Excel export -----
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Aba 1: Resumo
    const resumo = [
      { Métrica: "Período", Valor: "Últimos 30 dias" },
      { Métrica: "Page views (30d)", Valor: visitsLast30 },
      { Métrica: "Cliques em ferramentas (30d)", Valor: clicksLast30 },
      { Métrica: "Page views hoje", Valor: pageViewsToday },
      { Métrica: "Visitantes únicos hoje", Valor: uniqueVisitorsToday },
      { Métrica: "Novos cadastros no mês", Valor: newSignupsThisMonth },
      { Métrica: "Receita do mês (R$)", Valor: revenueThisMonth },
      {
        Métrica: "Gerado em",
        Valor: new Date().toLocaleString("pt-BR"),
      },
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(resumo),
      "Resumo"
    );

    // Aba: Resumo Mensal (últimos 6 meses)
    const monthlySheet = monthlyBreakdown.map((m) => ({
      Mês: m.label,
      "Novos cadastros": m.signups,
      "Pagamentos recebidos": m.paymentsCount,
      "Receita (R$)": m.revenue,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(monthlySheet),
      "Resumo Mensal"
    );

    // Aba: Pagamentos detalhados
    const paySheet = payments.map((p) => ({
      "Pago em": new Date(p.paid_at).toLocaleDateString("pt-BR"),
      Mês: formatMonthLabel(monthKey(p.paid_at)),
      Usuário: profiles[p.user_id]?.display_name ?? "-",
      Email: profiles[p.user_id]?.email ?? "-",
      "Valor (R$)": Number(p.amount) || 0,
      "Próx. vencimento": new Date(p.next_due_date).toLocaleDateString("pt-BR"),
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        paySheet.length ? paySheet : [{ aviso: "Sem pagamentos" }]
      ),
      "Pagamentos"
    );

    // Aba: Novos Cadastros
    const signupsSheet = [...allProfiles]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((p) => ({
        "Cadastrado em": new Date(p.created_at).toLocaleDateString("pt-BR"),
        Mês: formatMonthLabel(monthKey(p.created_at)),
        Usuário: p.display_name ?? "-",
        Email: p.email ?? "-",
      }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        signupsSheet.length ? signupsSheet : [{ aviso: "Sem dados" }]
      ),
      "Novos Cadastros"
    );

    // Aba 2: Top 5 ferramentas
    const top5Sheet = top5Tools.map((t, i) => ({
      Posição: i + 1,
      Ferramenta: t.name,
      Categoria: t.category ?? "-",
      Cliques: t.count,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        top5Sheet.length ? top5Sheet : [{ aviso: "Sem dados" }]
      ),
      "Top 5 Ferramentas"
    );

    // Aba 3: Page views completas
    const pvSheet = pageViews.map((pv) => ({
      "Data/Hora": formatDateTime(pv.created_at),
      Usuário: profiles[pv.user_id]?.display_name ?? "-",
      Email: profiles[pv.user_id]?.email ?? "-",
      Rota: pv.path,
      Referrer: pv.referrer ?? "-",
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        pvSheet.length ? pvSheet : [{ aviso: "Sem dados" }]
      ),
      "Page Views"
    );

    // Aba 4: Cliques em ferramentas
    const tcSheet = toolClicks.map((tc) => ({
      "Data/Hora": formatDateTime(tc.created_at),
      Usuário: profiles[tc.user_id]?.display_name ?? "-",
      Email: profiles[tc.user_id]?.email ?? "-",
      Ferramenta: tc.tool_name,
      Categoria: tc.tool_category ?? "-",
      URL: tc.tool_url ?? "-",
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        tcSheet.length ? tcSheet : [{ aviso: "Sem dados" }]
      ),
      "Cliques em Ferramentas"
    );

    // Aba 5: Usuários ativos (30d)
    const userActivity: Record<
      string,
      { name: string; email: string; views: number; clicks: number }
    > = {};
    pageViews.forEach((pv) => {
      const p = profiles[pv.user_id];
      if (!userActivity[pv.user_id]) {
        userActivity[pv.user_id] = {
          name: p?.display_name ?? "-",
          email: p?.email ?? "-",
          views: 0,
          clicks: 0,
        };
      }
      userActivity[pv.user_id].views += 1;
    });
    toolClicks.forEach((tc) => {
      const p = profiles[tc.user_id];
      if (!userActivity[tc.user_id]) {
        userActivity[tc.user_id] = {
          name: p?.display_name ?? "-",
          email: p?.email ?? "-",
          views: 0,
          clicks: 0,
        };
      }
      userActivity[tc.user_id].clicks += 1;
    });
    const activitySheet = Object.values(userActivity)
      .sort((a, b) => b.views + b.clicks - (a.views + a.clicks))
      .map((u) => ({
        Usuário: u.name,
        Email: u.email,
        "Page Views": u.views,
        Cliques: u.clicks,
        Total: u.views + u.clicks,
      }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        activitySheet.length ? activitySheet : [{ aviso: "Sem dados" }]
      ),
      "Usuários Ativos"
    );

    const filename = `analytical-x-relatorio-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast({ title: "Relatório baixado", description: filename });
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  const stats = [
    {
      label: "Novos cadastros no mês",
      value: newSignupsThisMonth,
      icon: <UserPlus size={18} />,
    },
    {
      label: "Receita do mês",
      value: formatBRL(revenueThisMonth),
      icon: <DollarSign size={18} />,
    },
    {
      label: "Page views (30d)",
      value: visitsLast30,
      icon: <Eye size={18} />,
    },
    {
      label: "Cliques em ferramentas (30d)",
      value: clicksLast30,
      icon: <MousePointerClick size={18} />,
    },
    {
      label: "Page views hoje",
      value: pageViewsToday,
      icon: <BarChart3 size={18} />,
    },
    {
      label: "Visitantes únicos hoje",
      value: uniqueVisitorsToday,
      icon: <Users size={18} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp size={20} className="text-primary" />
            Analytics do Hub
          </h2>
          <p className="text-sm text-muted-foreground">
            Métricas dos últimos 30 dias e do dia atual.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}>
            Atualizar
          </Button>
          <Button onClick={exportExcel}>
            <Download size={14} className="mr-1" /> Baixar Excel
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
              {s.icon}
            </div>
            <div>
              <span className="text-2xl font-bold text-foreground leading-none">
                {s.value}
              </span>
              <span className="block text-xs font-medium text-muted-foreground mt-0.5">
                {s.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Top 5 ferramentas + Page views recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="font-semibold">Top 5 ferramentas mais usadas</h3>
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </div>
          {top5Tools.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum clique registrado ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Ferramenta</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top5Tools.map((t, i) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.category ?? "-"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {t.count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="font-semibold">Últimas atividades</h3>
            <p className="text-xs text-muted-foreground">
              30 mais recentes — inclui páginas visitadas e ferramentas usadas (com tempo estimado)
            </p>
          </div>
          {recentActivities.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma atividade registrada ainda.
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ferramenta / Rota</TableHead>
                    <TableHead className="text-right">Tempo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActivities.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(a.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {profiles[a.user_id]?.display_name ??
                          profiles[a.user_id]?.email ??
                          "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.kind === "tool" ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              🔧 {a.label}
                            </span>
                            {a.sublabel && (
                              <span className="text-muted-foreground">
                                {a.sublabel}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="font-mono text-muted-foreground">
                            {a.label}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs whitespace-nowrap">
                        {a.kind === "tool" ? (
                          <span className="font-semibold text-primary">
                            {formatDuration(a.durationMs)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
