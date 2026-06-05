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
// @ts-ignore JS module
import { setToken, logout as logoutHelper } from "@/services/auth";
// @ts-ignore JS module
import { validateAccess } from "@/services/api";

export type UserStatus = "ativo" | "bloqueado";
export type AppRole = "admin" | "user";
export type TrialStatus = "pendente" | "ativo" | "expirado";

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
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const REDIRECT_URL = `${window.location.origin}/`;

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
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    // Aplica regra de trial de 10 dias (bloqueia automaticamente quando expira)
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

    if (userStatus === "bloqueado" && (profile as any)?.phone_verified) {
      toast({
        title: "Acesso aos apps bloqueado",
        description:
          "Sua conta está aguardando liberação. Você pode navegar pelo Hub, mas os apps estão bloqueados.",
      });
    }
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setToken(newSession?.access_token ?? null);

      if (newSession?.user) {
        setTimeout(async () => {
          await loadProfile(newSession.user.id);
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
        loadProfile(existing.user.id).finally(() => setLoading(false));
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
          ? "Confirme seu email antes de fazer login."
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
    // Pre-check: telefone único
    if (phoneArg) {
      const { data: available, error: checkErr } = await supabase.rpc(
        "is_phone_available",
        { _phone: phoneArg }
      );
      if (checkErr) {
        return { error: "Não foi possível validar o telefone. Tente novamente." };
      }
      if (available === false) {
        return { error: "Este número já está vinculado a uma conta." };
      }
    }

    const { error } = await supabase.auth.signUp({
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
    return { error: null };
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
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  const isAdmin = role === "admin";
  const needsPhoneVerification = Boolean(user) && !phoneVerified && !isAdmin;

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
        needsPhoneVerification,
        loading,
        isAuthenticated: !!user,
        isAdmin,
        login,
        signup,
        resetPassword,
        updatePassword,
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
