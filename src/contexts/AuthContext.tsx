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

export type UserStatus = "ativo" | "bloqueado";
export type AppRole = "admin" | "user";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  status: UserStatus | null;
  role: AppRole | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (
    email: string,
    password: string,
    displayName: string
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
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("status").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);

    const userStatus = (profile?.status as UserStatus) ?? "ativo";
    const isAdmin = roles?.some((r) => r.role === "admin") ?? false;

    setStatus(userStatus);
    setRole(isAdmin ? "admin" : "user");

    if (userStatus === "bloqueado") {
      toast({
        title: "Acesso bloqueado",
        description:
          "Sua conta foi bloqueada por um administrador. Entre em contato para mais informações.",
        variant: "destructive",
      });
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setStatus(null);
      setRole(null);
    }
  }, []);

  useEffect(() => {
    // 1) Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // defer profile fetch to avoid deadlock inside auth callback
        setTimeout(() => {
          loadProfile(newSession.user.id);
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

  const signup: AuthContextValue["signup"] = async (email, password, displayName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: REDIRECT_URL,
        data: { display_name: displayName },
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
        isAuthenticated: !!user && status === "ativo",
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
