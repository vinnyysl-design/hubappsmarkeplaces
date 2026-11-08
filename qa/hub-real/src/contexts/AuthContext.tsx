import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceFingerprint } from "@/lib/fingerprint";
// @ts-ignore JS module
import { setToken, logout as logoutHelper, sessionAdoptionAllowed, getLogoutGeneration, confirmExplicitLogin } from "@/services/auth";
// @ts-ignore JS module
import { validateAccess } from "@/services/api";

import { authOperations } from "@/lib/auth-operation-interlock";
import { createProfileClient } from "@/integrations/supabase/profileClient";
import { toast } from "@/hooks/use-toast";
import { reconcileSessionEvent } from "@/lib/reconcile-session-event";
import { loadProfileAccess } from "@/lib/load-profile-access";
import { createProfileRequestGate } from "@/lib/profile-request-gate";

export type UserStatus = "ativo" | "bloqueado";
export type AppRole = "admin" | "user";
export type TrialStatus = "pendente" | "ativo" | "expirado";
export type UserPlan = "trial" | "pagante" | "cortesia";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  status: UserStatus | null;
  administrativeBlocked: boolean | null;
  financialBlocked: boolean;
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
  accessState: "anonymous" | "checking" | "ready" | "unavailable";
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (
    email: string,
    password: string,
    displayName: string,
    phone?: string,
    couponCode?: string
  ) => Promise<{ error: string | null }>;
  recoveryUserId: string | null;
  recoveryPending: boolean;
  cancelRecovery: () => void;
  confirmRecovery: () => Promise<{error: string | null}>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  resendConfirmationEmail: (email: string) => Promise<{ error: string | null }>;
  logout: () => Promise<{ confirmed: boolean; error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const REDIRECT_URL = `${window.location.origin}/`;

async function saveFingerprint(userId: string, emailNormalized: string | null, client: any, assertCurrent: () => void) {
  try {
    assertCurrent();
    const fp = await getDeviceFingerprint();
    assertCurrent();
    const pending = client.from("signup_fingerprints").insert({
      user_id: userId,
      fingerprint: fp,
      user_agent: navigator.userAgent.slice(0, 500),
      email_normalized: emailNormalized,
    });
    assertCurrent();
    await pending.then((value: unknown) => value);
    assertCurrent();
  } catch {
    console.warn(JSON.stringify({component:"signup",event:"fingerprint_not_saved"}));
  }
}

export function AuthProvider({ children, recoveryAllowedUserId }: { children: ReactNode; recoveryAllowedUserId?: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [administrativeBlocked,setAdministrativeBlocked] = useState<boolean|null>(null);
  const [financialBlocked,setFinancialBlocked] = useState(true);
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
  const recoveryContext = useRef<{id: string} | null>(null);
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);
  const recoveryCandidate = useRef<{id: string; generation: number} | null>(null);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const clearVerifiedRecovery = useCallback(() => { recoveryContext.current = null; setRecoveryUserId(null); }, []);
  const clearRecovery = useCallback(() => {
    clearVerifiedRecovery(); recoveryCandidate.current=null; setRecoveryPending(false);
  }, [clearVerifiedRecovery]);

  const [accessState, setAccessState] = useState<"anonymous" | "checking" | "ready" | "unavailable">("checking");
  const profileGate = useRef(createProfileRequestGate());
  const authTransition = useRef(0);
  const authIntent = useRef(0);
  const adoptSession = useRef<(value: Session|null) => void>(() => {});
  const clearProfile = useCallback(() => {
    setStatus(null); setRole(null); setPlan(null);setAdministrativeBlocked(null);setFinancialBlocked(true);
    setTermsAcceptedAt(null); setTermsVersion(null); setPhone(null);
    setPhoneVerified(false); setTrialStatus(null); setTrialStartedAt(null); setTrialEndsAt(null);
  }, []);

  const loadProfile = useCallback(async (
    uid: string, emailConfirmed: boolean, metaCoupon: string | null, ticket: number, tokenSnapshot: string
  ) => {
    await profileGate.current.run(ticket, () => loadProfileAccess(
      uid,emailConfirmed,metaCoupon,createProfileClient(tokenSnapshot),() => validateAccess(tokenSnapshot),
      () => { if (!profileGate.current.current(ticket)) throw new Error("PROFILE_REQUEST_SUPERSEDED"); },
    ), ({profile,roles,trial,blocked}) => {
      setStatus(blocked?"bloqueado":profile.status as UserStatus);
      setAdministrativeBlocked(profile.administrative_blocked);setFinancialBlocked(profile.financial_blocked);
      setRole(roles.some(r=>r.role==="admin")?"admin":"user");
      setPlan(profile.plan as UserPlan); setTermsAcceptedAt(profile.terms_accepted_at);
      setTermsVersion(profile.terms_version); setPhone(profile.phone); setPhoneVerified(Boolean(profile.phone_verified));
      setTrialStatus(profile.trial_status as TrialStatus); setTrialStartedAt(profile.trial_started_at);
      setTrialEndsAt(trial.trial_ends_at??null); setAccessState("ready"); setLoading(false);
    }, () => {clearProfile();setAccessState("unavailable");setLoading(false);});
  }, [clearProfile]);

  useEffect(() => {
    let disposed=false, eventGeneration=0;
    const adopt=(newSession: Session|null) => {
      if (disposed) return;
      if (!newSession || !sessionAdoptionAllowed() || (recoveryContext.current && recoveryContext.current.id !== newSession.user.id)) clearVerifiedRecovery();
      if (newSession && !sessionAdoptionAllowed()) {
        profileGate.current.invalidate();clearProfile();setToken(null);setSession(null);setUser(null);setAccessState("anonymous");setLoading(false);return;
      }
      const ticket=profileGate.current.next();
      clearProfile();setSession(newSession);setUser(newSession?.user??null);setToken(newSession?.access_token??null);
      if (!newSession?.user) {setAccessState("anonymous");setLoading(false);return;}
      setAccessState("checking");setLoading(true);
      // Avoid awaiting SDK operations inside the Auth callback itself.
      setTimeout(()=>{void loadProfile(newSession.user.id,Boolean(newSession.user.email_confirmed_at),newSession.user.user_metadata?.coupon_code??null,ticket,newSession.access_token);},0);
    };
    adoptSession.current=adopt;
    const initialGeneration=eventGeneration;
    const {data:sub}=supabase.auth.onAuthStateChange((event,newSession)=>{
      if (event === "PASSWORD_RECOVERY" && newSession?.user && (!recoveryAllowedUserId || newSession.user.id === recoveryAllowedUserId)) {
        // Event records identity metadata only, never credentials. Adoption after
        // logout requires a separate explicit UI gesture and server verification.
        clearRecovery();
        recoveryCandidate.current={id:newSession.user.id,generation:getLogoutGeneration()};
        setRecoveryPending(true);
      } else if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "SIGNED_OUT" || !newSession || (recoveryContext.current && recoveryContext.current.id !== newSession.user.id) || (recoveryCandidate.current && recoveryCandidate.current.id !== newSession.user.id)) clearRecovery();
      const eventTicket=++eventGeneration;
      authTransition.current++;
      profileGate.current.invalidate();
      if(!sessionAdoptionAllowed()){adopt(null);return;}
      // Even null events may be stale: reconcile against the SDK's current
      // session instead of unconditionally signing out a newer user B.
      // The SDK may already use B's credentials. Revoke A's visible permissions
      // synchronously in this callback, before any deferred session read.
      clearProfile();setUser(null);setSession(null);setToken(null);
      setAccessState("checking");setLoading(true);
      setTimeout(()=>{void reconcileSessionEvent({
        current:()=>!disposed&&eventGeneration===eventTicket,
        allowed:sessionAdoptionAllowed,
        read:()=>supabase.auth.getSession(),
        apply:adopt,
        unavailable:()=>{clearProfile();setAccessState("unavailable");setLoading(false);},
      });},0);
    });
    supabase.auth.getSession().then(({data,error})=>{
      if (disposed || eventGeneration!==initialGeneration) return;
      if (error) {profileGate.current.invalidate();clearProfile();setAccessState("unavailable");setLoading(false);return;}
      adopt(data.session);
    }).catch(()=>{if(!disposed && eventGeneration===initialGeneration){profileGate.current.invalidate();clearProfile();setAccessState("unavailable");setLoading(false);}});
    return ()=>{disposed=true;recoveryContext.current=null;recoveryCandidate.current=null;adoptSession.current=()=>{};profileGate.current.invalidate();sub.subscription.unsubscribe();};
  },[clearProfile,loadProfile,clearRecovery,clearVerifiedRecovery,recoveryAllowedUserId]);

  const authBusy = () => ({error:"Uma operação de acesso ainda está em andamento. Aguarde a conclusão antes de tentar novamente."});
  const login: AuthContextValue["login"] = async (email, password) => {
    const requestedGeneration=getLogoutGeneration();
    return authOperations.tryRun(async () => {
    if(requestedGeneration!==getLogoutGeneration())return {error:"Tentativa interrompida por uma saída de sessão."};
    const attempt=++authIntent.current;
    const intent=getLogoutGeneration();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    // Logout or a later accepted Auth intent supersedes this response.
    // This cannot cancel an Auth request that the SDK already started.
    if(attempt!==authIntent.current||intent!==getLogoutGeneration()) {
      return {error:"Tentativa de login substituída por uma mudança de sessão. Confirme o login atual."};
    }
    if (error) {
      const msg =
        error.message === "Invalid login credentials"
          ? "Email ou senha incorretos."
          : error.message === "Email not confirmed"
          ? "Confirme seu email antes de fazer login. Verifique sua caixa de entrada."
          : error.message;
      return { error: msg };
    }
    if (!data.session || !confirmExplicitLogin(data.session.access_token,intent)) return { error: "Não foi possível confirmar esta sessão. Tente novamente." };
    adoptSession.current(data.session);
    return { error: null };
    },authBusy);
  };

  const signup: AuthContextValue["signup"] = async (
    email,
    password,
    displayName,
    phoneArg,
    couponCode

  ) => {
    const requestedGeneration=getLogoutGeneration();
    return authOperations.tryRun(async () => {
    if(requestedGeneration!==getLogoutGeneration())return {error:"Cadastro interrompido por uma saída de sessão."};
    const intent=getLogoutGeneration(), attempt=++authIntent.current;
    const startTransition=authTransition.current;
    const cancelled={error:"Cadastro interrompido por uma mudança de sessão. Confirme a sessão antes de tentar novamente."};
    const sameIntent=()=>intent===getLogoutGeneration()&&attempt===authIntent.current;
    const beforeCreate=()=>sameIntent()&&startTransition===authTransition.current;
    if(!beforeCreate())return cancelled;
    // 1. Valida o email: formato, descartável, e duplicado (normalizado)
    const { data: validation, error: valErr } = await supabase.rpc(
      "validate_signup_email",
      { _email: email }
    );
    if(!beforeCreate())return cancelled;
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
      if(!beforeCreate())return cancelled;
      const { data: available } = await supabase.rpc("is_phone_available", {
        _phone: phoneArg,
      });
      if(!beforeCreate())return cancelled;
      if (available === false) {
        return { error: "Este número já está vinculado a uma conta." };
      }
    }

    // 3. Cria a conta — Supabase envia email de confirmação automaticamente
    if(!beforeCreate())return cancelled;
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: REDIRECT_URL,
        data: {
          display_name: displayName,
          phone: phoneArg ?? null,
          coupon_code: couponCode ? couponCode.trim() : null,
        },
      },
    });
    if(!sameIntent())return cancelled;
    if (error) {
      const msg =
        error.message === "User already registered"
          ? "Este email já está cadastrado."
          : error.message;
      return { error: msg };
    }

    if (signUpData.session) {
      // signUp may emit its own Auth event; verify the authoritative session
      // after that event, never adopt a late response over a different user.
      const responseTransition=authTransition.current;
      const current=()=>sameIntent()&&responseTransition===authTransition.current;
      if(!current())return cancelled;
      let actual;
      try { actual=await supabase.auth.getSession(); } catch { return cancelled; }
      if(!current()||actual.error||actual.data?.session?.user.id!==signUpData.user?.id||actual.data?.session?.access_token!==signUpData.session.access_token)return cancelled;
      if (!confirmExplicitLogin(signUpData.session.access_token,intent)) return cancelled;
      adoptSession.current(signUpData.session);
      if(!current())return cancelled;
      // Bind optional anti-fraud writes to this signup's immutable token.
      await saveFingerprint(signUpData.user.id,v.normalized??null,createProfileClient(signUpData.session.access_token),()=>{if(!current())throw new Error("SIGNUP_SUPERSEDED");});
      if(!current())return cancelled;
    } else {
      // No authenticated identity is available for a safe fingerprint insert.
      // Do not borrow whichever session the global SDK might adopt later.
      if(!beforeCreate())return cancelled;
    }

    return { error: null };
    },authBusy);
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

  const confirmRecovery: AuthContextValue["confirmRecovery"] = async () => {
    const candidate=recoveryCandidate.current;
    const rejected={error:"Recuperação não confirmada. Solicite um novo link e abra-o nesta aba."};
    const current=()=>!!candidate && recoveryCandidate.current===candidate && candidate.generation===getLogoutGeneration();
    if(!current())return rejected;
    return authOperations.tryRun(async () => {
      if(!current())return rejected;
      try {
        const verified=await supabase.auth.getUser();
        if(!current())return rejected;
        if(verified.error || verified.data.user?.id!==candidate!.id){clearRecovery();return rejected;}
        const actual=await supabase.auth.getSession();
        if(!current())return rejected;
        if(actual.error || actual.data.session?.user.id!==candidate!.id){clearRecovery();return rejected;}
        // Uses the existing explicit-adoption barrier only after the user gesture.
        // The session remains SDK-owned; no token is stored in recovery context.
        if(!confirmExplicitLogin(actual.data.session.access_token,candidate!.generation)){clearRecovery();return rejected;}
        recoveryCandidate.current=null;setRecoveryPending(false);
        recoveryContext.current={id:candidate!.id};setRecoveryUserId(candidate!.id);
        adoptSession.current(actual.data.session);
        return {error:null};
      } catch { if(current())clearRecovery();return rejected; }
    },authBusy);
  };

  const updatePassword: AuthContextValue["updatePassword"] = async (password) => {
    const requestedGeneration=getLogoutGeneration();
    const context=recoveryContext.current;
    const interrupted={error:"Recuperação não confirmada ou substituída. Abra um novo link válido."};
    const current=()=>!!context && recoveryContext.current===context && requestedGeneration===getLogoutGeneration() && sessionAdoptionAllowed();
    if(!current())return interrupted;
    return authOperations.tryRun(async () => {
      if(!current())return interrupted;
      try {
        // No token argument, URL inspection or credential materialization.
        const verified=await supabase.auth.getUser();
        if(!current() || verified.error || verified.data.user?.id!==context!.id)return interrupted;
        // Logout before dispatch prevents the mutation; after dispatch it cannot
        // cancel a server operation. Suppress stale success in either case.
        const result=await supabase.auth.updateUser({ password });
        if(!current())return interrupted;
        if(result.error)return {error:result.error.message};
        if(result.data.user?.id!==context!.id)return interrupted;
        clearRecovery();
        return {error:null};
      } catch { return {error:"Não foi possível confirmar a alteração. Não repita sem verificar o resultado."}; }
    },authBusy);
  };

  const logout = async () => {
    clearRecovery();
    authIntent.current++;authTransition.current++;
    const pending=logoutHelper({redirect:false});
    profileGate.current.invalidate();setUser(null);setSession(null);
    clearProfile();setAccessState("anonymous");setLoading(false);
    const result=await pending;
    if (result.qaRevocationConfirmed === false) toast({title:"Revogação QA não confirmada",description:"O logout prosseguiu, mas o acesso remoto da ferramenta pode permanecer válido até expirar. Não repita o teste automaticamente.",variant:"destructive"});
    if (!result.confirmed) toast({title:"Saída no servidor não confirmada",description:"O acesso local foi bloqueado. Tente sair novamente ou faça um novo login explícito.",variant:"destructive"});
    return result;
  };

  const refreshProfile = useCallback(async () => {
    if (!user) { window.location.reload(); return; }
    const ticket=profileGate.current.next();clearProfile();setAccessState("checking");setLoading(true);
    try {
      const {data,error}=await supabase.auth.getUser();
      if (!profileGate.current.current(ticket)) return;
      if (error || !data.user || data.user.id!==user.id) throw new Error("USER_REFRESH_UNAVAILABLE");
      setUser(data.user);
      await loadProfile(data.user.id,Boolean(data.user.email_confirmed_at),null,ticket,session?.access_token??"");
    } catch {if(profileGate.current.current(ticket)){clearProfile();setAccessState("unavailable");setLoading(false);}}
  },[user,session,loadProfile,clearProfile]);

  const isAdmin = role === "admin";
  const emailConfirmed = Boolean(user?.email_confirmed_at);
  const needsEmailVerification = Boolean(user) && !emailConfirmed && !isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        status,
        administrativeBlocked, financialBlocked,
        role,
        termsAcceptedAt,
        termsVersion,
        phone,
        phoneVerified,
        trialStatus,
        trialStartedAt,
        trialEndsAt,
        plan,
        emailConfirmed,
        needsEmailVerification,
        needsPhoneVerification: needsEmailVerification,
        loading,
        accessState,
        isAuthenticated: !!user,
        isAdmin,
        login,
        signup,
        recoveryUserId,
        recoveryPending,
        cancelRecovery: clearRecovery,
        confirmRecovery,
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
