import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Eye,
  MousePointerClick,
  Users,
  Loader2,
  Download,
  TrendingUp,
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
  [id: string]: { display_name: string | null; email: string | null };
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

  const load = async () => {
    setLoading(true);
    const since30 = daysAgoISO(30);

    const [pvRes, tcRes, profRes] = await Promise.all([
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
      supabase.from("profiles").select("id,display_name,email"),
    ]);

    if (pvRes.error || tcRes.error || profRes.error) {
      toast({
        title: "Erro ao carregar analytics",
        description:
          pvRes.error?.message ??
          tcRes.error?.message ??
          profRes.error?.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setPageViews(pvRes.data ?? []);
    setToolClicks(tcRes.data ?? []);
    const map: ProfileMap = {};
    (profRes.data ?? []).forEach((p) => {
      map[p.id] = { display_name: p.display_name, email: p.email };
    });
    setProfiles(map);
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
            <h3 className="font-semibold">Últimas page views</h3>
            <p className="text-xs text-muted-foreground">
              20 mais recentes (últimos 30 dias)
            </p>
          </div>
          {recentPageViews.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma visita registrada ainda.
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Rota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPageViews.map((pv) => (
                    <TableRow key={pv.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(pv.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {profiles[pv.user_id]?.display_name ??
                          profiles[pv.user_id]?.email ??
                          "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {pv.path}
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
