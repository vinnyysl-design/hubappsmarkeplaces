import { closeQaTools } from "@/lib/qa-tool-shutdown";
/** Session mirror only; server authorization remains mandatory. */
import { supabase } from "@/integrations/supabase/client";
import { authOperations } from "@/lib/auth-operation-interlock";
const TOKEN_STORAGE_KEY = "analyticalx.access_token";
const LOGOUT_BARRIER_KEY = "analyticalx.logout-pending";
let currentToken = null;
let tokenGeneration = 0;
let logoutGeneration = 0;
let memoryBarrier = false;
export function sessionAdoptionAllowed() {
  try { return !memoryBarrier && localStorage.getItem(LOGOUT_BARRIER_KEY) !== "1"; }
  catch { return false; }
}
function blockAdoption() {
  memoryBarrier = true;
  logoutGeneration++;
  tokenGeneration++;
  currentToken = null;
  try { localStorage.setItem(LOGOUT_BARRIER_KEY,"1"); } catch { /* memory barrier still active */ }
  try { localStorage.removeItem(TOKEN_STORAGE_KEY); } catch { /* no session enumeration */ }
}
export function getLogoutGeneration() { return logoutGeneration; }
export function confirmExplicitLogin(token, expectedLogoutGeneration) {
  if (expectedLogoutGeneration !== logoutGeneration || typeof token !== "string" || !token) return false;
  try { localStorage.removeItem(LOGOUT_BARRIER_KEY); } catch { return false; }
  memoryBarrier = false;
  setToken(token);
  return true;
}
export function setToken(token) {
  tokenGeneration++;
  currentToken = typeof token === "string" && token && sessionAdoptionAllowed() ? token : null;
  try { localStorage.removeItem(TOKEN_STORAGE_KEY); } catch { /* memory only */ }
}
export function getToken() { return sessionAdoptionAllowed() ? currentToken : null; }
export async function syncTokenFromSession() {
  if (!sessionAdoptionAllowed()) return null;
  const generation=tokenGeneration;
  try {
    const {data,error}=await supabase.auth.getSession();
    if (generation!==tokenGeneration || !sessionAdoptionAllowed()) return null;
    if (error) { setToken(null); return null; }
    const token=data?.session?.access_token??null;
    setToken(token);
    return token;
  } catch { if(generation===tokenGeneration)setToken(null);return null; }
}
export function isAuthenticated() { return Boolean(getToken()); }
export async function logout({redirect=true}={}) {
  blockAdoption();
  let qaRevocationConfirmed=false;
  try { qaRevocationConfirmed=await closeQaTools(); } catch { /* Continue ordinary logout regardless. */ }
  let confirmed=false;
  try {
    const result=await authOperations.queue(()=>import.meta.env.VITE_DEPLOYMENT_STAGE==='staging'
      ? supabase.auth.signOut({scope:'local'}) : supabase.auth.signOut());
    confirmed=!!result && result.error===null;
  }
  catch { confirmed=false; }
  // Do not remove the barrier on failure OR success. Only a successful explicit
  // login may adopt a new session, preventing bootstrap/late events resurrecting A.
  if (confirmed && redirect && typeof window!=="undefined")window.location.href="/auth";
  return {confirmed,error:confirmed?null:"logout_not_confirmed",...(qaRevocationConfirmed ? {} : {qaRevocationConfirmed:false})};
}
