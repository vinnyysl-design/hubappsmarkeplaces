import { useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ReviewRow {
  id: string;
  user_id: string;
  email: string;
  rating: number;
  comment: string | null;
  created_at: string;
  display_name?: string | null;
}

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          className={i <= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}
        />
      ))}
    </div>
  );
}

export default function ReviewsPanel() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: reviews } = await supabase
        .from("user_reviews")
        .select("id,user_id,email,rating,comment,created_at")
        .order("created_at", { ascending: false });
      const list = (reviews as ReviewRow[]) ?? [];
      if (list.length > 0) {
        const ids = Array.from(new Set(list.map((r) => r.user_id)));
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id,display_name")
          .in("id", ids);
        const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]));
        list.forEach((r) => (r.display_name = nameMap.get(r.user_id) ?? null));
      }
      setRows(list);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhuma avaliação recebida ainda.</p>;
  }

  const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-2">
        <div className="text-2xl font-bold">{avg.toFixed(1)}</div>
        <Stars n={Math.round(avg)} />
        <div className="text-sm text-muted-foreground">{rows.length} avaliação(ões)</div>
      </div>
      <div className="border border-border rounded-xl overflow-hidden -mx-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Nota</TableHead>
              <TableHead>Comentário</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="font-medium">{r.display_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell><Stars n={r.rating} /></TableCell>
                <TableCell className="text-sm max-w-md">
                  {r.comment ? r.comment : <span className="text-muted-foreground italic">(sem comentário)</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
