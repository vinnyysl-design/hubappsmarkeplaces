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

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  status: UserStatus | null;
  role: AppRole | null;
  termsAcceptedAt: string | null;
  termsVersion: string | null;
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
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    // Aplica regra de trial de 3 dias (bloqueia automaticamente se sem pagamento)
    const { data: trialData } = await supabase.rpc("enforce_trial_status", {
      _user_id: uid,
    });
    const trial = Array.isArray(trialData) ? trialData[0] : trialData;
    const trialExpired = !!trial?.trial_expired;

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("status, terms_accepted_at, terms_version")
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

    if (userStatus === "bloqueado") {
      toast({
        title: "Acesso aos apps bloqueado",
        description:
          "Sua conta está aguardando liberação do administrador. Você pode navegar pelo Hub, mas os apps estão bloqueados até a liberação.",
      });
    }
  }, []);

  useEffect(() => {
    // 1) Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      // mantém o access_token sincronizado no localStorage para os helpers globais
      setToken(newSession?.access_token ?? null);

      if (newSession?.user) {
        // defer profile fetch + validação central para evitar deadlock no callback
        setTimeout(async () => {
          await loadProfile(newSession.user.id);
          // valida contra a Netlify Function: bloqueia imediatamente se 401/403
          const result = await validateAccess();
          if (!result.ok) {
            const reason = result.data?.error;
            // user_blocked: NÃO desloga — usuário pode entrar no Hub, mas apps ficam travados
            if (reason === "user_blocked") {
              return;
            }
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
            }
          }
        }, 0);
      } else {
        setStatus(null);
        setRole(null);
      }
    });

    // 2) THEN check existing session
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

  const signup: AuthContextValue["signup"] = async (email, password, displayName, phone) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: REDIRECT_URL,
        data: { display_name: displayName, phone: phone ?? null },
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
  };

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        status,
        role,
        loading,
        isAuthenticated: !!user,
        isAdmin: role === "admin",
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
