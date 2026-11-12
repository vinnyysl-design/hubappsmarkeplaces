// @vitest-environment node
import {it,expect,vi} from "vitest";
import {createClient} from "@supabase/supabase-js";
import {createQaLogoutObserver,qaClosureMessage} from "../lib/qa-logout-receipt";
import {createBoundedQaFetch} from "../lib/qa-bounded-fetch";
const origin="https://mdqlgwnggbkgmplgkebd.supabase.co";
const url=origin+"/auth/v1/logout?scope=local";
const token="synthetic-round-token";
function request(observer:ReturnType<typeof createQaLogoutObserver>,at=url,bearer=token,method="POST"){
 return observer.fetch(at,{method,headers:{authorization:"Bearer "+bearer}});
}
it("requires a real canonical204 request, not SDK error:null or event",async()=>{
 const send=vi.fn().mockResolvedValue(new Response(null,{status:204}));const o=createQaLogoutObserver(send);
 expect(await o.signOut({auth:{signOut:async()=>({error:null})}},token)).toMatchObject({remote:"unknown"});expect(send).not.toHaveBeenCalled();
 expect(await o.signOut({auth:{signOut:async()=>{await request(o);return {error:null};}}},token)).toMatchObject({remote:"accepted"});
});
it.each([200,201,205,302,401,403,404,500])("status%s never becomes remote confirmation",async status=>{
 const o=createQaLogoutObserver(async()=>new Response(null,{status}));
 expect(await o.signOut({auth:{signOut:async()=>{await request(o);return {error:null};}}},token)).toMatchObject({remote:"unknown"});
});
it.each([
 ["other origin","https://other.invalid/auth/v1/logout?scope=local",token,"POST"],
 ["global scope",origin+"/auth/v1/logout?scope=global",token,"POST"],
 ["missing scope",origin+"/auth/v1/logout",token,"POST"],
 ["extra scope",url+"&scope=global",token,"POST"],
 ["other token",url,"other-synthetic-token","POST"],
 ["GET",url,token,"GET"],
 ["userinfo","https://fake@mdqlgwnggbkgmplgkebd.supabase.co/auth/v1/logout?scope=local",token,"POST"],
 ["fragment",url+"#other",token,"POST"],
])("%s cannot satisfy receipt",async(_name,at,bearer,method)=>{
 const o=createQaLogoutObserver(async()=>new Response(null,{status:204}));
 expect(await o.signOut({auth:{signOut:async()=>{await request(o,at,bearer,method);return {error:null};}}},token)).toMatchObject({remote:"unknown"});
});
it("Request input and header override are interpreted correctly",async()=>{
 const o=createQaLogoutObserver(async()=>new Response(null,{status:204}));
 const req=new Request(url,{method:"POST",headers:{authorization:"Bearer "+token}});
 expect(await o.signOut({auth:{signOut:async()=>{await o.fetch(req);return {error:null};}}},token)).toMatchObject({remote:"accepted"});
 expect(await o.signOut({auth:{signOut:async()=>{await o.fetch(req,{headers:{}});return {error:null};}}},token)).toMatchObject({remote:"unknown"});
});
it("remote acceptance survives later SDK failure, but duplicate requests are ambiguous",async()=>{
 const o=createQaLogoutObserver(async()=>new Response(null,{status:204}));
 expect(await o.signOut({auth:{signOut:async()=>{await request(o);return {error:{message:"synthetic"}};}}},token)).toEqual({remote:"accepted",sdkCompleted:false});
 expect(await o.signOut({auth:{signOut:async()=>{await request(o);await request(o);return {error:null};}}},token)).toMatchObject({remote:"unknown"});
});
it("late response from earlier attempt cannot satisfy current attempt",async()=>{
 let resolve!:(r:Response)=>void;const o=createQaLogoutObserver(()=>new Promise<Response>(r=>{resolve=r;}));
 const first=o.signOut({auth:{signOut:async()=>{await request(o);return {error:null};}}},token);
 const second=o.signOut({auth:{signOut:async()=>({error:null})}},"next-token");
 resolve(new Response(null,{status:204}));expect(await first).toMatchObject({remote:"unknown"});expect(await second).toMatchObject({remote:"unknown"});
});
it("bounded timeout and late completion remain unconfirmed",async()=>{
 let resolve!:(r:Response)=>void;const o=createQaLogoutObserver(createBoundedQaFetch(()=>new Promise<Response>(r=>{resolve=r;}),15));
 const pending=o.signOut({auth:{signOut:async()=>{await request(o);return {error:null};}}},token);
 expect(await pending).toMatchObject({remote:"unknown"});resolve(new Response(null,{status:204}));await Promise.resolve();
 expect(await o.signOut({auth:{signOut:async()=>({error:null})}},token)).toMatchObject({remote:"unknown"});
});
it("canonical confirmation still warns about existing access JWTs",()=>{
 expect(qaClosureMessage(true,{remote:"accepted",sdkCompleted:true})).toContain("Tokens ja emitidos podem valer ate expirar");
 expect(qaClosureMessage(false,{remote:"accepted",sdkCompleted:true})).toContain("Fechamento das ferramentas nao confirmado");
 expect(qaClosureMessage(true,{remote:"unknown",sdkCompleted:true})).toContain("Logout remoto nao confirmado");
});
const user={id:"10000000-0000-4000-8000-000000000001",aud:"authenticated",email:"synthetic@example.test",app_metadata:{},user_metadata:{},created_at:"2020-01-01T00:00:00Z"};
const jwt=(label:string,seconds:number)=>Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url")+"."+Buffer.from(JSON.stringify({sub:user.id,session_id:"20000000-0000-4000-8000-000000000001",exp:Math.floor(Date.now()/1000)+seconds,label})).toString("base64url")+".synthetic-not-signed";
async function sdk(status:number|"network",seconds=3600){
 const events:string[]=[],urls:string[]=[];let initial="";
 const send=vi.fn(async(input:RequestInfo|URL)=>{
  const at=String(input);urls.push(at);
  if(at.includes("/token?grant_type=password")){initial=jwt("initial",seconds);return Response.json({access_token:initial,refresh_token:"synthetic-refresh-only",expires_in:seconds,token_type:"bearer",user});}
  if(at.includes("/token?grant_type=refresh_token")){events.push("refresh");return Response.json({access_token:jwt("renewed",3600),refresh_token:"synthetic-refresh-renewed",expires_in:3600,token_type:"bearer",user});}
  if(at===url){events.push("logout");if(status==="network")throw Error("offline network");
   return status===204?new Response(null,{status}):Response.json({error:"synthetic",error_description:"synthetic"}, {status});}
  throw Error("UNEXPECTED_SYNTHETIC_ROUTE");
 });
 const o=createQaLogoutObserver(createBoundedQaFetch(send,100));
 const c=createClient(origin,"sb_publishable_synthetic",{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:"synthetic-"+Math.random()},global:{fetch:o.fetch}});
 await c.auth.initialize();
 const subscription=c.auth.onAuthStateChange(event=>{if(event==="SIGNED_OUT")events.push("event");});
 await c.auth.signInWithPassword({email:"synthetic@example.test",password:"synthetic-local-only"});
 return {c,o,events,urls,initial,send,dispose:()=>subscription.data.subscription.unsubscribe()};
}
it("real SDK2.106.0: successful204 precedes local event and gives receipt",async()=>{
 const s=await sdk(204);try{expect(await s.o.signOut(s.c,s.initial)).toMatchObject({remote:"accepted"});expect(s.events).toEqual(["logout","event"]);}finally{s.dispose();}
});
it.each([401,403,404])("real SDK ignores%s but receipt stays unknown",async status=>{
 const s=await sdk(status);try{expect(await s.o.signOut(s.c,s.initial)).toMatchObject({remote:"unknown"});expect(s.events).toEqual(["logout","event"]);}finally{s.dispose();}
});
it("real SDK absent session has no request and no receipt",async()=>{
 const send=vi.fn(()=>{throw Error("NETWORK_FORBIDDEN");});const o=createQaLogoutObserver(send);
 const c=createClient(origin,"sb_publishable_synthetic",{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:"synthetic-empty"},global:{fetch:o.fetch}});
 await c.auth.initialize();expect(await o.signOut(c,null)).toMatchObject({remote:"unknown"});expect(send).not.toHaveBeenCalled();
});
it.each([500,"network"] as const)("real SDK%s failure does not confirm logout",async status=>{
 const s=await sdk(status);try{expect(await s.o.signOut(s.c,s.initial)).toMatchObject({remote:"unknown"});expect(s.events).not.toContain("event");}finally{s.dispose();}
});
it("real SDK near expiry may refresh on logout; changed bearer is not original-round proof",async()=>{
 const s=await sdk(204,30);try{expect(await s.o.signOut(s.c,s.initial)).toMatchObject({remote:"unknown"});expect(s.events).toEqual(["refresh","logout","event"]);expect(s.urls.some(x=>x.includes("refresh_token"))).toBe(true);}finally{s.dispose();}
});

it("204 remains accepted when SDK cleanup throws afterwards",async()=>{
 const o=createQaLogoutObserver(async()=>new Response(null,{status:204}));
 expect(await o.signOut({auth:{signOut:async()=>{await request(o);throw Error("synthetic cleanup failure");}}},token)).toEqual({remote:"accepted",sdkCompleted:false});
 expect(qaClosureMessage(true,{remote:"accepted",sdkCompleted:false})).toContain("Limpeza local do SDK nao confirmada");
});

import {createQaShutdown} from "../lib/qa-tool-shutdown";
it("empty tool shutdown is not described as a remote SSO revocation",async()=>{
 const tools=createQaShutdown();const closed=await tools.closeAll();
 expect(closed).toBe(true);
 const message=qaClosureMessage(closed,{remote:"accepted",sdkCompleted:true});
 expect(message).toContain("Fechamento das ferramentas concluido");
 expect(message).not.toContain("Revogacao SSO confirmada");
});
