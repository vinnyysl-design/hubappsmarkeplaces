import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getDeviceFingerprint } from "@/lib/fingerprint";
// @ts-ignore JS module
import { setToken, logout as logoutHelper } from "@/services/auth";
// @ts-ignore JS module
import { validateAccess } from "@/services/api";

export type UserStatus = "ativo" | "bloqueado";
export type AppRole = "admin" | "user";
export type TrialStatus = "pendente" | "ativo" | "expirado";
export type UserPlan = "trial" | "pagante" | "cortesia";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  status: UserStatus | null;
  role: AppRole | null;
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  phone: string | null;
  phoneVerified: boolean;
  trialStatus: TrialStatus | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  plan: UserPlan | null;
  emailConfirmed: boolean;
  needsEmailVerification: boolean;
  /** @deprecated mantido por compatibilidade — agora reflete needsEmailVerification */
  needsPhoneVerification: boolean;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (
    email: string,
    password: string,
    displayName: string,
    phone?: string
  ) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  resendConfirmationEmail: (email: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const REDIRECT_URL = `${window.location.origin}/`;

async function saveFingerprint(userId: string, emailNormalized: string | null) {
  try {
    const fp = await getDeviceFingerprint();
    await supabase.from("signup_fingerprints").insert({
      user_id: userId,
      fingerprint: fp,
      user_agent: navigator.userAgent.slice(0, 500),
      email_normalized: emailNormalized,
    });
  } catch (e) {
    console.warn("[fingerprint] não foi possível salvar:", e);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);
  const [termsVersion, setTermsVersion] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [trialStartedAt, setTrialStartedAt] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string, emailConfirmed: boolean) => {
    // Se o usuário já confirmou o email mas o trial ainda não foi ativado, ativa agora.
    if (emailConfirmed) {
      await supabase.rpc("activate_trial_after_email_confirm", { _user_id: uid });
    }

    const { data: trialData } = await supabase.rpc("enforce_trial_status", {
      _user_id: uid,
    });
    const trial = Array.isArray(trialData) ? trialData[0] : trialData;
    setTrialEndsAt((trial as any)?.trial_ends_at ?? null);

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "status, terms_accepted_at, terms_version, phone, phone_verified, trial_status, trial_started_at"
        )
        .eq("id", uid)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);

    const userStatus = (profile?.status as UserStatus) ?? "ativo";
    const isAdmin = roles?.some((r) => r.role === "admin") ?? false;

    setStatus(userStatus);
    setRole(isAdmin ? "admin" : "user");
    setTermsAcceptedAt((profile as any)?.terms_accepted_at ?? null);
    setTermsVersion((profile as any)?.terms_version ?? null);
    setPhone((profile as any)?.phone ?? null);
    setPhoneVerified(Boolean((profile as any)?.phone_verified));
    setTrialStatus(((profile as any)?.trial_status as TrialStatus) ?? null);
    setTrialStartedAt((profile as any)?.trial_started_at ?? null);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setToken(newSession?.access_token ?? null);

      if (newSession?.user) {
        const confirmed = Boolean(newSession.user.email_confirmed_at);
        setTimeout(async () => {
          await loadProfile(newSession.user.id, confirmed);
          const result = await validateAccess();
          if (!result.ok) {
            const reason = result.data?.error;
            if (reason === "user_blocked") return;
            if (reason && reason !== "network_error") {
              toast({
                title: "Sessão inválida",
                description: "Faça login novamente para continuar.",
                variant: "destructive",
              });
              await logoutHelper({ redirect: false });
              setUser(null);
              setSession(null);
              setStatus(null);
              setRole(null);
              setTermsAcceptedAt(null);
              setTermsVersion(null);
              setPhone(null);
              setPhoneVerified(false);
              setTrialStatus(null);
              setTrialStartedAt(null);
              setTrialEndsAt(null);
            }
          }
        }, 0);
      } else {
        setStatus(null);
        setRole(null);
        setTermsAcceptedAt(null);
        setTermsVersion(null);
        setPhone(null);
        setPhoneVerified(false);
        setTrialStatus(null);
        setTrialStartedAt(null);
        setTrialEndsAt(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      setToken(existing?.access_token ?? null);
      if (existing?.user) {
        const confirmed = Boolean(existing.user.email_confirmed_at);
        loadProfile(existing.user.id, confirmed).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const login: AuthContextValue["login"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg =
        error.message === "Invalid login credentials"
          ? "Email ou senha incorretos."
          : error.message === "Email not confirmed"
          ? "Confirme seu email antes de fazer login. Verifique sua caixa de entrada."
          : error.message;
      return { error: msg };
    }
    return { error: null };
  };

  const signup: AuthContextValue["signup"] = async (
    email,
    password,
    displayName,
    phoneArg
  ) => {
    // 1. Valida o email: formato, descartável, e duplicado (normalizado)
    const { data: validation, error: valErr } = await supabase.rpc(
      "validate_signup_email",
      { _email: email }
    );
    if (valErr) {
      return { error: "Não foi possível validar o email. Tente novamente." };
    }
    const v = validation as { ok: boolean; reason?: string; normalized?: string };
    if (!v?.ok) {
      const reasonMap: Record<string, string> = {
        invalid_email: "Email inválido.",
        disposable_email:
          "Emails temporários/descartáveis não são permitidos. Use um email pessoal ou corporativo.",
        email_already_used:
          "Este email (ou uma variação dele) já está cadastrado. Faça login ou recupere a senha.",
      };
      return { error: reasonMap[v?.reason ?? ""] ?? "Email não permitido." };
    }

    // 2. Telefone único (opcional)
    if (phoneArg) {
      const { data: available } = await supabase.rpc("is_phone_available", {
        _phone: phoneArg,
      });
      if (available === false) {
        return { error: "Este número já está vinculado a uma conta." };
      }
    }

    // 3. Cria a conta — Supabase envia email de confirmação automaticamente
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: REDIRECT_URL,
        data: { display_name: displayName, phone: phoneArg ?? null },
      },
    });
    if (error) {
      const msg =
        error.message === "User already registered"
          ? "Este email já está cadastrado."
          : error.message;
      return { error: msg };
    }

    // 4. Salva fingerprint do dispositivo (anti-fraude)
    if (signUpData.user) {
      await saveFingerprint(signUpData.user.id, v.normalized ?? null);
    }

    return { error: null };
  };

  const resendConfirmationEmail: AuthContextValue["resendConfirmationEmail"] = async (
    email
  ) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: REDIRECT_URL },
    });
    return { error: error?.message ?? null };
  };

  const resetPassword: AuthContextValue["resetPassword"] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword: AuthContextValue["updatePassword"] = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setStatus(null);
    setRole(null);
    setTermsAcceptedAt(null);
    setTermsVersion(null);
    setPhone(null);
    setPhoneVerified(false);
    setTrialStatus(null);
    setTrialStartedAt(null);
    setTrialEndsAt(null);
  };

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id, Boolean(user.email_confirmed_at));
  }, [user, loadProfile]);

  const isAdmin = role === "admin";
  const emailConfirmed = Boolean(user?.email_confirmed_at);
  const needsEmailVerification = Boolean(user) && !emailConfirmed && !isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        status,
        role,
        termsAcceptedAt,
        termsVersion,
        phone,
        phoneVerified,
        trialStatus,
        trialStartedAt,
        trialEndsAt,
        emailConfirmed,
        needsEmailVerification,
        needsPhoneVerification: needsEmailVerification,
        loading,
        isAuthenticated: !!user,
        isAdmin,
        login,
        signup,
        resetPassword,
        updatePassword,
        resendConfirmationEmail,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
