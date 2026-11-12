import {createBoundedQaFetch} from "@/lib/qa-bounded-fetch";
import {useEffect,useRef,useState} from "react";
import {createClient} from "@supabase/supabase-js";
import {readDeploymentConfig} from "@/lib/deployment-config";
import {identityScope,inspectIdentity} from "@/lib/qa-identity-only";
import fixture from "../../identity-only-window.json";
import {QA_GATE} from "@/lib/qa-tool-bridge";
import {qaShutdown} from "@/lib/qa-tool-shutdown";
import {QaToolAccessCore, type QaIdentitySnapshot} from "@/components/QaToolAccessCore";

export default function QaIdentityEntry() {
 const [email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [snapshot,setSnapshot]=useState<QaIdentitySnapshot|null>(null);
 const [message,setMessage]=useState("Verificacao exclusiva de identidade. Nao recarregue nem repita o login. Nenhum trial sera renovado.");
 const [busy,setBusy]=useState(false),[terminal,setTerminal]=useState(false);
 const alive=useRef(true),attempted=useRef(false),stopped=useRef(false),client=useRef<any>(null);
 const cleanup=useRef<Promise<void>|null>(null);
 const expectedToken=useRef<string|null>(null),unsubscribe=useRef<(()=>void)|null>(null);
 const scope=()=>["/qa-tools","/qa-auth"].includes(location.pathname)&&!location.search&&!location.hash&&identityScope(fixture,QA_GATE,import.meta.env.VITE_DEPLOYMENT_STAGE,location.origin);
 const finish=()=> {
  stopped.current=true;qaShutdown.terminalize();
  if(alive.current){setTerminal(true);setSnapshot(null);setPassword("");}
  if(cleanup.current)return cleanup.current;
  cleanup.current=(async()=>{
   const revoked=await qaShutdown.closeAll();
   let signedOut=true;
   try { if(client.current){const r=await client.current.auth.signOut({scope:"local"});signedOut=!r.error;} } catch {signedOut=false;}
   unsubscribe.current?.();unsubscribe.current=null;expectedToken.current=null;client.current=null;
   if(alive.current)setMessage(revoked&&signedOut?"Execucao encerrada. Nao reinicie nesta aba.":"Encerramento remoto nao confirmado. Nao repita o teste.");
  })();
  return cleanup.current;
 };
 useEffect(()=>{alive.current=true;const initial=location.pathname+location.search+location.hash;const hide=()=>{void finish();};window.addEventListener("pagehide",hide);window.addEventListener("popstate",hide);const routePoll=setInterval(()=>{if(location.pathname+location.search+location.hash!==initial)void finish();},250);
  return()=>{alive.current=false;window.removeEventListener("pagehide",hide);window.removeEventListener("popstate",hide);clearInterval(routePoll);void finish();};
 },[]);
 useEffect(()=>{if(!scope())return;const deadline=Math.min(fixture.windowEnd,QA_GATE.windowEnd,snapshot?(snapshot.session?.expires_at??0)*1000:Infinity)-65000;
  const timer=setTimeout(()=>{void finish();},Math.max(0,deadline-Date.now()));return()=>clearTimeout(timer);
 },[snapshot]);
 const login=async(e:React.FormEvent)=>{
  let attemptClient:any=null;
  e.preventDefault();if(!scope()||attempted.current||stopped.current||qaShutdown.terminal())return;
  attempted.current=true;setBusy(true);
  try {
   const deployment=readDeploymentConfig(import.meta.env);
   if(deployment.url!=="https://mdqlgwnggbkgmplgkebd.supabase.co")throw Error("QA_UNAVAILABLE");
   const c=createClient(deployment.url,deployment.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:"qa-identity-only-memory"},global:{fetch:createBoundedQaFetch()}});
   client.current=c;attemptClient=c;
   const subscription=c.auth.onAuthStateChange((event,changed)=>{
    if(event==="TOKEN_REFRESHED"||event==="USER_UPDATED"||(expectedToken.current&&(event==="SIGNED_OUT"||changed?.access_token!==expectedToken.current))){void finish();}
   });unsubscribe.current=()=>subscription.data.subscription.unsubscribe();
   const result=await c.auth.signInWithPassword({email,password});
   setPassword("");
   const current=()=>alive.current&&!stopped.current&&scope()&&!qaShutdown.terminal();
   if(result.error||!current()||!result.data.session)throw Error("QA_UNAVAILABLE");
   expectedToken.current=result.data.session.access_token;
   const identity=await inspectIdentity(c,result.data.session,current);
   if(!current())throw Error("QA_UNAVAILABLE");
   setSnapshot(identity);setMessage("Sessao QA autenticada. A autorizacao das ferramentas ainda depende do servidor.");
  }catch{
   // A sign-in may finish after unmount/timeout. Sign out this dedicated client
   // again; the earlier cleanup could have preceded session creation.
   try {await attemptClient?.auth.signOut({scope:"local"});}catch{}
   if(alive.current)setMessage("Acesso QA indisponivel. Nao houve repeticao automatica.");
   await finish();
  }finally{if(alive.current)setBusy(false);}
 };
 if(!scope())return <main><h1>QA identity-only fechado</h1><p>Nenhum login sera iniciado.</p></main>;
 return <main><h1>Verificacao QA de identidade</h1><p role="status">{message}</p>
 {!snapshot&&!terminal&&<form onSubmit={login}><label>Email QA<input autoComplete="off" type="email" value={email} onChange={e=>setEmail(e.target.value)} required disabled={busy}/></label>
 <label>Senha<input autoComplete="off" type="password" value={password} onChange={e=>setPassword(e.target.value)} required disabled={busy}/></label><button disabled={busy||attempted.current}>Entrar somente no QA</button></form>}
 {snapshot&&<><p>Abra ambas sem navegar ou atualizar. Nao execute analises.</p><QaToolAccessCore app="adsengine" identity={snapshot}/><QaToolAccessCore app="vision-x" identity={snapshot}/></>}
 {!terminal&&<button onClick={()=>void finish()}>Encerrar e sair do QA</button>}
 </main>;
}
