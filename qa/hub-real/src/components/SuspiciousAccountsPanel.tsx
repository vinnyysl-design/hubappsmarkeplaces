import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface SuspiciousRow {
  fingerprint: string;
  account_count: number;
  user_ids: string[];
  emails: (string | null)[];
  ips: (string | null)[];
  first_seen: string;
  last_seen: string;
}

export default function SuspiciousAccountsPanel() {
  const [rows, setRows] = useState<SuspiciousRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("suspicious_accounts" as any)
        .select("*")
        .order("last_seen", { ascending: false });
      if (!error && data) setRows(data as unknown as SuspiciousRow[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="text-amber-500" size={20} />
        <h2 className="text-lg font-bold text-foreground">Contas suspeitas</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Grupos de contas criadas no mesmo dispositivo (fingerprint compartilhado).
        Investigue antes de liberar trials estendidos.
      </p>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhum dispositivo suspeito detectado.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.fingerprint}
              className="border border-border rounded-lg p-4 bg-muted/30"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-amber-500" />
                  <Badge variant="destructive">
                    {row.account_count} contas no mesmo dispositivo
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  fp: {row.fingerprint.slice(0, 12)}…
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-muted-foreground">Emails: </span>
                  <span className="text-foreground">
                    {row.emails.filter(Boolean).join(", ") || "—"}
                  </span>
                </div>
                {row.ips?.filter(Boolean).length > 0 && (
                  <div>
                    <span className="text-muted-foreground">IPs: </span>
                    <span className="text-foreground font-mono text-xs">
                      {row.ips.filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground pt-1">
                  Primeira: {new Date(row.first_seen).toLocaleString("pt-BR")} ·
                  Última: {new Date(row.last_seen).toLocaleString("pt-BR")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
