// Receipts are transport observations, not proof that previously issued JWTs expired.
// The bearer stays only in this dedicated client's memory and reference is cleared after an attempt.
export type QaLogoutReceipt = {remote:"accepted"|"unknown";sdkCompleted:boolean};
type Attempt = {id:number;token:string|null;calls:number;success:boolean;invalid:boolean};
const ORIGIN="https://mdqlgwnggbkgmplgkebd.supabase.co";
export function createQaLogoutObserver(send:typeof fetch) {
 let sequence=0,active:Attempt|null=null;
 const begin=(token:string|null)=>{if(active)active.token=null;active={id:++sequence,token,calls:0,success:false,invalid:false};return sequence;};
 const complete=(id:number,sdkSucceeded:boolean):QaLogoutReceipt=>{
  if(!active||active.id!==id)return {remote:"unknown",sdkCompleted:sdkSucceeded};
  const a=active;active=null;a.token=null;
  return {remote:a.calls===1&&a.success&&!a.invalid?"accepted":"unknown",sdkCompleted:sdkSucceeded};
 };
 const observedFetch:typeof fetch=async(input,init)=>{
  const a=active;let logout=false,matched=false;
  try {
   const req=typeof Request!=="undefined"&&input instanceof Request?input:null;
   const u=new URL(req?req.url:String(input));
   logout=u.pathname==="/auth/v1/logout";
   if(a&&logout){
    a.calls++;
    const method=(init?.method??req?.method??"GET").toUpperCase();
    const headers=new Headers(init?.headers??req?.headers);
    matched=u.origin===ORIGIN&&!u.username&&!u.password&&!u.hash&&u.search==="?scope=local"&&method==="POST"&&
     typeof a.token==="string"&&a.token.length>0&&headers.get("authorization")==="Bearer "+a.token;
    if(!matched)a.invalid=true;
   }
  }catch{if(a)a.invalid=true;}
  try {
   const response=await send(input,init);
   if(a&&logout&&active===a){
    // send is the bounded no-redirect transport, so late/partial responses reject.
    if(matched&&response.status===204&&!response.redirected)a.success=true;
    else a.invalid=true;
   }
   return response;
  }catch(error){if(a&&logout&&active===a)a.invalid=true;throw error;}
 };
 return {fetch:observedFetch,async signOut(client:any,token:string|null):Promise<QaLogoutReceipt>{
  const id=begin(token);let ok=false;
  try{const result=await client.auth.signOut({scope:"local"});ok=result?.error===null;}
  catch{/* An SDK exception is never a revocation receipt. */}
  return complete(id,ok);
 }};
}
export function qaClosureMessage(toolsClosed:boolean,receipt:QaLogoutReceipt) {
 if(receipt.remote!=="accepted")return "Fluxo local encerrado. Logout remoto nao confirmado. Nao repita o teste.";
 const local=receipt.sdkCompleted?"":" Limpeza local do SDK nao confirmada.";
 const tools=toolsClosed?" Fechamento das ferramentas concluido.":" Fechamento das ferramentas nao confirmado.";
 return "Fluxo local encerrado. Logout aceito pelo servidor."+local+tools+" Tokens ja emitidos podem valer ate expirar. Nao reinicie nesta aba.";
}
