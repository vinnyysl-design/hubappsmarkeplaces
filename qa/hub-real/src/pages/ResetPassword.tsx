import { useEffect, useRef, useState } from "react";
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
  const { updatePassword, session, recoveryUserId, recoveryPending, confirmRecovery, cancelRecovery } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const ready = !!recoveryUserId && session?.user.id === recoveryUserId;
  const mounted = useRef(true);
  useEffect(() => { mounted.current=true; return () => { mounted.current=false; cancelRecovery(); }; }, [cancelRecovery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || submitting) return;
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
    if (!mounted.current) return;
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Senha atualizada!", description: "Faça login com a nova senha." });
    navigate("/auth", { replace: true });
  };

  if (!ready) {
    return <main><h1>Recuperação não confirmada</h1>
      {recoveryPending ? <><p>Um novo contexto de recuperação foi recebido nesta aba. Confirme para verificar a identidade no servidor antes de definir a senha.</p>
        <button disabled={confirming} onClick={() => {
          setConfirming(true);setRecoveryMessage('');
          void confirmRecovery().then(result => { if(mounted.current)setRecoveryMessage(result.error ?? 'Identidade confirmada.'); })
            .catch(() => { if(mounted.current)setRecoveryMessage('Não foi possível confirmar. Solicite um novo link.'); })
            .finally(() => { if(mounted.current)setConfirming(false); });
        }}>Confirmar recuperação nesta aba</button></> :
        <p>O contexto de recuperação não está disponível ou foi perdido ao recarregar/sair. Solicite um novo link pelo fluxo de recuperação e abra-o nesta aba. Uma sessão comum ou o texto da URL não libera este formulário.</p>}
      <p role="status">{recoveryMessage}</p>
      <p>Esta tela não envia e-mails automaticamente.</p>
    </main>;
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
