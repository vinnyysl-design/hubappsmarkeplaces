import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import logoSrc from "@/assets/logo-analyticalx.jpeg";

const emailSchema = z.string().trim().email({ message: "Email inválido" }).max(255);
const passwordSchema = z
  .string()
  .min(8, { message: "Mínimo de 8 caracteres" })
  .max(72, { message: "Máximo de 72 caracteres" });
const nameSchema = z
  .string()
  .trim()
  .min(2, { message: "Nome: mínimo de 2 caracteres" })
  .max(100);
const phoneSchema = z
  .string()
  .trim()
  .min(8, { message: "Telefone inválido" })
  .max(20, { message: "Telefone muito longo" })
  .regex(/^[0-9()+\-\s]+$/, { message: "Telefone contém caracteres inválidos" });

// Reusable branded "Analytical X" wordmark with gradient X (matches HeroSection)
const BrandTitle = ({ className = "" }: { className?: string }) => (
  <h1 className={`text-2xl font-extrabold tracking-tight text-foreground ${className}`}>
    Analytical{" "}
    <span className="bg-gradient-to-br from-[hsl(220,80%,55%)] via-[hsl(280,60%,55%)] to-[hsl(175,70%,50%)] bg-clip-text text-transparent">
      X
    </span>
  </h1>
);

// Password input with show/hide toggle
function PasswordField({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

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
  const [signupPhone, setSignupPhone] = useState("");
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
    const phoneP = phoneSchema.safeParse(signupPhone);
    const pwP = passwordSchema.safeParse(signupPassword);
    if (!nameP.success || !emailP.success || !phoneP.success || !pwP.success) {
      const msg =
        (!nameP.success && nameP.error.issues[0].message) ||
        (!emailP.success && emailP.error.issues[0].message) ||
        (!phoneP.success && phoneP.error.issues[0].message) ||
        (!pwP.success && pwP.error.issues[0].message);
      toast({ title: "Dados inválidos", description: msg as string, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await signup(emailP.data, pwP.data, nameP.data, phoneP.data);
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
              <img
                src={logoSrc}
                alt="Analytical X"
                className="h-16 w-16 rounded-xl object-cover border border-border shadow-sm"
              />
            </div>
            <BrandTitle />
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
                  <PasswordField
                    id="login-password"
                    value={loginPassword}
                    onChange={setLoginPassword}
                    autoComplete="current-password"
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
                  <Label htmlFor="signup-phone">Telefone</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="(11) 99999-9999"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <PasswordField
                    id="signup-password"
                    value={signupPassword}
                    onChange={setSignupPassword}
                    autoComplete="new-password"
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
