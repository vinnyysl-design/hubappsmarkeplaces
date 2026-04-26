import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Shield, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import AdminAnalytics from "@/components/AdminAnalytics";

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  status: "ativo" | "bloqueado";
  created_at: string;
}

export default function Admin() {
  const { user: currentUser } = useAuth();
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id,email,display_name,status,created_at")
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
      setRows(profiles ?? []);
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
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
              Gerencie acesso e papéis dos usuários do hub.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            Atualizar
          </Button>
        </div>

        <div className="mb-8">
          <AdminAnalytics />
        </div>

        <h2 className="text-lg font-semibold mb-3">Usuários</h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
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
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const isAdmin = adminIds.has(row.id);
                  const isSelf = row.id === currentUser?.id;
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
                      <TableCell className="text-right space-x-2">
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
      </div>
    </div>
  );
}
