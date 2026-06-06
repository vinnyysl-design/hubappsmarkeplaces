import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Mail, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import logoSrc from "@/assets/logo-x.png";

export default function VerifyPhone() {
  const {
    user,
    loading,
    emailConfirmed,
    isAdmin,
    resendConfirmationEmail,
    refreshProfile,
    logout,
  } = useAuth();
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }
    if (emailConfirmed || isAdmin) {
      navigate("/", { replace: true });
    }
  }, [user, loading, emailConfirmed, isAdmin, navigate]);

  // Poll a cada 5s pra detectar a confirmação sem precisar recarregar
  useEffect(() => {
    if (!user || emailConfirmed) return;
    const id = setInterval(async () => {
      await refreshProfile();
    }, 5000);
    return () => clearInterval(id);
  }, [user, emailConfirmed, refreshProfile]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const handleResend = async () => {
    if (!user?.email || cooldown > 0) return;
    setResending(true);
    const { error } = await resendConfirmationEmail(user.email);
    setResending(false);
    if (error) {
      toast({
        title: "Não foi possível reenviar",
        description: error,
        variant: "destructive",
      });
      return;
    }
    setCooldown(60);
    toast({
      title: "Email reenviado",
      description: "Verifique sua caixa de entrada e a pasta de spam.",
    });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-lg space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <img
              src={logoSrc}
              alt="Analytical X"
              className="h-16 w-auto object-contain"
            />
          </div>
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="text-primary" size={28} />
            </div>
          </div>
          <h1 className="text-xl font-bold text-foreground">
            Confirme seu email
          </h1>
          <p className="text-sm text-muted-foreground">
            Enviamos um link de confirmação para{" "}
            <span className="font-semibold text-foreground">{user.email}</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            Clique no link do email para ativar sua conta e iniciar seu período de
            teste de <span className="font-semibold">10 dias grátis</span>.
          </p>
        </div>

        <div className="rounded-lg bg-muted/50 border border-border p-4 text-xs text-muted-foreground space-y-1">
          <p>• Verifique também a pasta de spam/lixo eletrônico.</p>
          <p>• O link expira em 24 horas.</p>
          <p>• Esta página atualiza automaticamente após a confirmação.</p>
        </div>

        <div className="space-y-2">
          <Button
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            variant="outline"
            className="w-full"
          >
            {resending ? (
              <Loader2 className="animate-spin mr-2" size={16} />
            ) : (
              <RefreshCw className="mr-2" size={16} />
            )}
            {cooldown > 0
              ? `Reenviar em ${cooldown}s`
              : "Reenviar email de confirmação"}
          </Button>
          <Button
            onClick={async () => {
              await logout();
              navigate("/auth", { replace: true });
            }}
            variant="ghost"
            className="w-full text-muted-foreground"
          >
            <LogOut className="mr-2" size={16} />
            Sair e usar outra conta
          </Button>
        </div>
      </div>
    </div>
  );
}
