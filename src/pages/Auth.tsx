import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Crosshair, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const emailSchema = z.string().trim().email({ message: "Email inválido" }).max(255);
const passwordSchema = z
  .string()
  .min(8, { message: "Mínimo de 8 caracteres" })
  .max(72, { message: "Máximo de 72 caracteres" });
const nameSchema = z
  .string()
  .trim()
  .min(2, { message: "Mínimo de 2 caracteres" })
  .max(100);

export default function Auth() {
  const { login, signup, resetPassword, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"login" | "signup" | "reset">("login");

  // login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // signup state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  // reset state
  const [resetEmail, setResetEmail] = useState("");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailParse = emailSchema.safeParse(loginEmail);
    const pwParse = passwordSchema.safeParse(loginPassword);
    if (!emailParse.success || !pwParse.success) {
      toast({
        title: "Dados inválidos",
        description:
          emailParse.success === false
            ? emailParse.error.issues[0].message
            : pwParse.error?.issues[0].message,
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const { error } = await login(emailParse.data, pwParse.data);
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro ao entrar", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Bem-vindo de volta!" });
    navigate("/", { replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameP = nameSchema.safeParse(signupName);
    const emailP = emailSchema.safeParse(signupEmail);
    const pwP = passwordSchema.safeParse(signupPassword);
    if (!nameP.success || !emailP.success || !pwP.success) {
      const msg =
        (!nameP.success && nameP.error.issues[0].message) ||
        (!emailP.success && emailP.error.issues[0].message) ||
        (!pwP.success && pwP.error.issues[0].message);
      toast({ title: "Dados inválidos", description: msg as string, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await signup(emailP.data, pwP.data, nameP.data);
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro no cadastro", description: error, variant: "destructive" });
      return;
    }
    toast({
      title: "Cadastro realizado!",
      description:
        "Enviamos um email de confirmação. Confirme seu email e faça login.",
    });
    setTab("login");
    setLoginEmail(signupEmail);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailP = emailSchema.safeParse(resetEmail);
    if (!emailP.success) {
      toast({
        title: "Email inválido",
        description: emailP.error.issues[0].message,
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const { error } = await resetPassword(emailP.data);
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro", description: error, variant: "destructive" });
      return;
    }
    toast({
      title: "Email enviado",
      description: "Verifique sua caixa de entrada para redefinir a senha.",
    });
    setTab("login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg space-y-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Crosshair className="text-primary" size={32} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Analytical <span className="text-primary">X</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              Hub de inteligência para marketplaces
            </p>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              <TabsTrigger value="reset">Recuperar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="animate-spin mr-2" size={16} />}
                  Entrar
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    autoComplete="name"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo 8 caracteres.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="animate-spin mr-2" size={16} />}
                  Criar conta
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="reset">
              <form onSubmit={handleReset} className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Informe seu email para receber o link de redefinição de senha.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="animate-spin mr-2" size={16} />}
                  Enviar link
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="pt-4 border-t border-border text-center text-xs text-muted-foreground">
            <p>© 2026 Analytical X · Vinicius Lima</p>
          </div>
        </div>
      </div>
    </div>
  );
}
