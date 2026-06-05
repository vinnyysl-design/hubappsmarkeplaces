import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MessageCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import logoSrc from "@/assets/logo-x.png";

function normalizePhone(p: string) {
  return p.replace(/[^0-9]/g, "");
}

export default function VerifyPhone() {
  const { user, phone, phoneVerified, refreshProfile, logout, loading } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<"phone" | "code">(phone ? "code" : "phone");
  const [phoneInput, setPhoneInput] = useState(phone ?? "");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
    if (!loading && phoneVerified) navigate("/", { replace: true });
  }, [loading, user, phoneVerified, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSend = async () => {
    const norm = normalizePhone(phoneInput);
    if (norm.length < 10 || norm.length > 15) {
      toast({
        title: "Telefone inválido",
        description: "Informe DDD + número (ex.: 11915264364).",
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-whatsapp-otp", {
      body: { phone: norm },
    });
    setSending(false);
    if (error || (data && data.error)) {
      const code = (data as any)?.error ?? error?.message;
      const fallbackHint = (data as any)?.hint as string | undefined;
      const msg =
        code === "phone_in_use"
          ? "Este número já está vinculado a uma conta."
          : code === "rate_limited"
          ? "Aguarde 1 minuto antes de pedir outro código."
          : code === "twilio_not_configured"
          ? "Provedor de SMS não configurado. Avise o suporte."
          : code === "invalid_phone"
          ? "Telefone inválido."
          : code === "sms_sender_not_available"
          ? "Nenhum número SMS está disponível na conta conectada."
          : fallbackHint ?? "Não foi possível enviar o código por SMS. Tente novamente.";
      toast({ title: "Erro ao enviar", description: msg, variant: "destructive" });
      return;
    }
    setSent(true);
    setStep("code");
    setCooldown(60);
    toast({
      title: "Código enviado",
      description: "Verifique seu SMS. O código expira em 5 minutos.",
    });
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast({ title: "Digite os 6 dígitos do código", variant: "destructive" });
      return;
    }
    setVerifying(true);
    const norm = normalizePhone(phoneInput);
    const { data, error } = await supabase.functions.invoke("verify-otp", {
      body: { phone: norm, code },
    });
    setVerifying(false);
    if (error || (data && data.error)) {
      const errCode = (data as any)?.error ?? error?.message;
      const msg =
        errCode === "invalid_code"
          ? `Código inválido. Tentativas restantes: ${(data as any)?.remaining ?? "?"}`
          : errCode === "code_expired"
          ? "Código expirado. Solicite outro."
          : errCode === "too_many_attempts"
          ? "Muitas tentativas. Solicite um novo código."
          : errCode === "no_active_code"
          ? "Nenhum código ativo. Solicite um novo."
          : errCode === "phone_in_use"
          ? "Este número já está vinculado a outra conta."
          : "Falha na verificação. Tente novamente.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
      if (errCode === "code_expired" || errCode === "too_many_attempts") {
        setCode("");
      }
      return;
    }
    toast({
      title: "Telefone verificado!",
      description: "Seu período de teste de 10 dias começou agora.",
    });
    await refreshProfile();
    navigate("/", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg space-y-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <img src={logoSrc} alt="Analytical X" className="h-16 w-auto" />
            </div>
            <div className="flex justify-center">
              <div className="p-3 bg-primary/10 rounded-xl">
                <MessageCircle className="text-primary" size={28} />
              </div>
            </div>
            <h1 className="text-xl font-bold text-foreground">
              Verificação por SMS
            </h1>
            <p className="text-sm text-muted-foreground">
              Confirme seu número para liberar o acesso e iniciar seu teste de 10
              dias.
            </p>
          </div>

          {step === "phone" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vphone">Telefone (com DDD)</Label>
                <Input
                  id="vphone"
                  type="tel"
                  placeholder="11915264364"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Inclua o código do país se for fora do Brasil. Apenas números.
                </p>
              </div>
              <Button onClick={handleSend} className="w-full" disabled={sending}>
                {sending && <Loader2 className="animate-spin mr-2" size={16} />}
                Enviar código por SMS
              </Button>
            </div>
          )}

          {step === "code" && (
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Código enviado para <strong>{phoneInput}</strong>
              </p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button
                onClick={handleVerify}
                className="w-full"
                disabled={verifying || code.length !== 6}
              >
                {verifying && <Loader2 className="animate-spin mr-2" size={16} />}
                Verificar
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground underline"
                  onClick={() => {
                    setStep("phone");
                    setCode("");
                  }}
                >
                  Alterar número
                </button>
                <button
                  type="button"
                  className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                  disabled={cooldown > 0 || sending}
                  onClick={handleSend}
                >
                  {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar código"}
                </button>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border flex justify-center">
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              <LogOut size={14} className="mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
