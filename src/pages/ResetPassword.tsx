import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Crosshair, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const passwordSchema = z
  .string()
  .min(8, { message: "Mínimo de 8 caracteres" })
  .max(72);

export default function ResetPassword() {
  const { updatePassword, session } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase puts recovery info in URL hash; client picks it up automatically.
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || session) {
      setReady(true);
    } else {
      // give it a tick for hash detection
      const t = setTimeout(() => setReady(true), 600);
      return () => clearTimeout(t);
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      toast({
        title: "Senha inválida",
        description: parsed.error.issues[0].message,
        variant: "destructive",
      });
      return;
    }
    if (password !== confirm) {
      toast({
        title: "Senhas diferentes",
        description: "As senhas não coincidem.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const { error } = await updatePassword(parsed.data);
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Senha atualizada!", description: "Faça login com a nova senha." });
    navigate("/auth", { replace: true });
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Crosshair className="text-primary" size={32} />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Nova senha</h1>
            <p className="text-sm text-muted-foreground">
              Defina uma nova senha para sua conta.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw">Nova senha</Label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw2">Confirmar senha</Label>
              <Input
                id="pw2"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin mr-2" size={16} />}
              Atualizar senha
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
