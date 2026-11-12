import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {render,screen,fireEvent,waitFor,cleanup} from "@testing-library/react";
const h=vi.hoisted(()=>({fixture:{enabled:false,purpose:"identity-only",ownerId:"3f65242c-b030-4505-aa01-344676f50991",windowStart:0,windowEnd:0,apps:["adsengine","vision-x"]},callback:null as any,client:null as any,terminal:false,create:vi.fn(),close:vi.fn(),normal:vi.fn()}));
vi.mock("../../identity-only-window.json",()=>({default:h.fixture}));
vi.mock("../lib/qa-tool-bridge",async()=>{
 const actual=await vi.importActual<any>("../lib/qa-tool-bridge");
 return {...actual,QA_GATE:{enabled:true,ownerId:"3f65242c-b030-4505-aa01-344676f50991",windowStart:0,windowEnd:Number.MAX_SAFE_INTEGER}};
});
vi.mock("@supabase/supabase-js",()=>({createClient:(...args:any[])=>h.create(...args)}));
vi.mock("../lib/deployment-config",()=>({readDeploymentConfig:()=>({url:"https://mdqlgwnggbkgmplgkebd.supabase.co",publishableKey:"sb_publishable_test"})}));
vi.mock("../lib/qa-tool-shutdown",()=>({qaShutdown:{terminal:()=>h.terminal,terminalize:()=>{h.terminal=true;},closeAll:()=>h.close()}}));
vi.mock("../components/QaToolAccessCore",()=>({QaToolAccessCore:({app}:any)=><p>tool:{app}</p>}));
vi.mock("../contexts/AuthContext",()=>{throw Error("GLOBAL_AUTH_IMPORTED");});
vi.mock("../integrations/supabase/client",()=>{throw Error("GLOBAL_CLIENT_IMPORTED");});
import Entry from "../pages/QaIdentityEntry";
const owner="3f65242c-b030-4505-aa01-344676f50991",origin="https://deploy-preview-1--analyticalxhub.netlify.app";
let session:any;
beforeEach(()=>{
 h.terminal=false;h.callback=null;h.create.mockReset();h.close.mockReset().mockResolvedValue(true);
 const now=Date.now();h.fixture.enabled=true;h.fixture.windowStart=now-1000;h.fixture.windowEnd=now+899000;
 // Parent QA interval must itself meet its 2h bound. Mutated through mock export below.
 Object.assign(gate,{windowStart:now-1000,windowEnd:now+899000});
 vi.stubEnv("VITE_DEPLOYMENT_STAGE","staging");vi.stubGlobal("location",{origin,pathname:"/qa-tools",search:"",hash:""});
 const user={id:owner,email_confirmed_at:"2026-01-01"};session={user,access_token:"test-not-a-real-credential",expires_at:now/1000+3600};
 h.client={auth:{signInWithPassword:vi.fn().mockResolvedValue({data:{session},error:null}),getUser:vi.fn().mockResolvedValue({data:{user},error:null}),signOut:vi.fn().mockResolvedValue({error:null}),onAuthStateChange:vi.fn(cb=>{h.callback=cb;return {data:{subscription:{unsubscribe:vi.fn()}}};})},from:vi.fn(()=>({select:()=>({retry(){return this;},eq:()=>({maybeSingle:async()=>({data:{id:owner,status:"ativo",administrative_blocked:false,financial_blocked:false,phone_verified:true,plan:"trial",trial_started_at:new Date(now-864000001).toISOString(),terms_accepted_at:"2026-01-01",terms_version:"1.0"},error:null})})})})),rpc:vi.fn()};
 h.create.mockReturnValue(h.client);
});
import {QA_GATE as gate} from "../lib/qa-tool-bridge";
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.unstubAllEnvs();});
function login(){fireEvent.change(screen.getByLabelText("Email QA"),{target:{value:"qa@example.test"}});fireEvent.change(screen.getByLabelText("Senha"),{target:{value:"fake-offline-password"}});fireEvent.submit(screen.getByRole("button",{name:"Entrar somente no QA"}).closest("form")!);}
it("closed fixture never instantiates client even query/hash request activation",()=>{h.fixture.enabled=false;vi.stubGlobal("location",{origin,pathname:"/qa-tools",search:"?enabled=true",hash:"#activate"});render(<Entry/>);expect(screen.getByText("QA identity-only fechado")).toBeTruthy();expect(h.create).not.toHaveBeenCalled();});
it("no credential/client/autoload before explicit login",()=>{render(<Entry/>);expect(h.create).not.toHaveBeenCalled();expect(h.client.rpc).not.toHaveBeenCalled();});
it("uses isolated auth and read-only profile, then closes only local auth session",async()=>{render(<Entry/>);login();await screen.findByText("tool:adsengine");expect(h.create.mock.calls[0][2].auth).toMatchObject({persistSession:false,autoRefreshToken:false,detectSessionInUrl:false});expect(h.client.rpc).not.toHaveBeenCalled();fireEvent.click(screen.getByText("Encerrar e sair do QA"));await waitFor(()=>expect(h.client.auth.signOut).toHaveBeenCalledWith({scope:"local"}));expect(h.close).toHaveBeenCalled();});
it("rejects wrong owner without adopting tool session",async()=>{h.client.auth.getUser.mockResolvedValue({data:{user:{id:"other"}},error:null});render(<Entry/>);login();await waitFor(()=>expect(h.client.auth.signOut).toHaveBeenCalled());expect(screen.queryByText("tool:adsengine")).toBeNull();});
it("token refresh terminalizes rather than adopting new credentials",async()=>{render(<Entry/>);login();await screen.findByText("tool:adsengine");h.callback("TOKEN_REFRESHED",{...session,access_token:"new-offline-token"});await waitFor(()=>expect(screen.queryByText("tool:adsengine")).toBeNull());expect(h.terminal).toBe(true);});
it("late login after unmount is cleaned and never adopted",async()=>{let resolve:any;h.client.auth.signInWithPassword.mockImplementation(()=>new Promise(r=>{resolve=r;}));const view=render(<Entry/>);login();view.unmount();resolve({data:{session},error:null});await waitFor(()=>expect(h.client.auth.signOut).toHaveBeenCalled());expect(h.client.from).not.toHaveBeenCalled();});

it("withholds tools while authoritative profile is pending",async()=>{let done:any;h.client.from.mockImplementation(()=>({select:()=>({retry(){return this;},eq:()=>({maybeSingle:()=>new Promise(r=>{done=r;})})})}));render(<Entry/>);login();await waitFor(()=>expect(h.client.from).toHaveBeenCalled());expect(screen.queryByText("tool:adsengine")).toBeNull();expect(screen.getByRole("button",{name:"Entrar somente no QA"})).toBeDisabled();done({error:{},data:null});await waitFor(()=>expect(h.terminal).toBe(true));});
it("session identity change closes rather than swaps tools",async()=>{render(<Entry/>);login();await screen.findByText("tool:adsengine");h.callback("SIGNED_IN",{...session,user:{id:"other"},access_token:"other-token"});await waitFor(()=>expect(screen.queryByText("tool:adsengine")).toBeNull());expect(h.terminal).toBe(true);});
it("short token is rejected before tools open",async()=>{session.expires_at=Date.now()/1000+65;render(<Entry/>);login();await waitFor(()=>expect(h.terminal).toBe(true));expect(screen.queryByText("tool:adsengine")).toBeNull();});

it("back or forward after login closes tools and dedicated session",async()=>{render(<Entry/>);login();await screen.findByText("tool:adsengine");vi.stubGlobal("location",{origin,pathname:"/",search:"",hash:""});fireEvent(window,new PopStateEvent("popstate"));await waitFor(()=>expect(screen.queryByText("tool:adsengine")).toBeNull());expect(h.terminal).toBe(true);await waitFor(()=>expect(h.client.auth.signOut).toHaveBeenCalledWith({scope:"local"}));});
it("wrong pathname never enables QA even with fixture open",()=>{vi.stubGlobal("location",{origin,pathname:"/ordinary",search:"",hash:""});render(<Entry/>);expect(screen.getByText("QA identity-only fechado")).toBeTruthy();expect(h.create).not.toHaveBeenCalled();});

it("SDK success without an observed request remains local-only",async()=>{
 render(<Entry/>);login();await screen.findByText("tool:adsengine");
 fireEvent.click(screen.getByText("Encerrar e sair do QA"));
 await screen.findByText(/Logout remoto nao confirmado/);
 expect(screen.queryByText(/Logout aceito pelo servidor/)).toBeNull();
});
it.each([401,403,404,500])("HTTP%s never makes UI claim remote acceptance",async status=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({error:"synthetic"},{status})));
 h.client.auth.signOut.mockImplementation(async()=>{await h.create.mock.calls[0][2].global.fetch("https://mdqlgwnggbkgmplgkebd.supabase.co/auth/v1/logout?scope=local",{method:"POST",headers:{authorization:"Bearer "+session.access_token}});return {error:null};});
 render(<Entry/>);login();await screen.findByText("tool:adsengine");
 fireEvent.click(screen.getByText("Encerrar e sair do QA"));
 await screen.findByText(/Logout remoto nao confirmado/);
});
it("canonical204 is specific acceptance, never instant JWT invalidation",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(null,{status:204})));
 h.client.auth.signOut.mockImplementation(async()=>{await h.create.mock.calls[0][2].global.fetch("https://mdqlgwnggbkgmplgkebd.supabase.co/auth/v1/logout?scope=local",{method:"POST",headers:{authorization:"Bearer "+session.access_token}});return {error:null};});
 render(<Entry/>);login();await screen.findByText("tool:adsengine");fireEvent.click(screen.getByText("Encerrar e sair do QA"));
 await screen.findByText(/Logout aceito pelo servidor/);expect(screen.getByRole("status").textContent).toContain("Tokens ja emitidos podem valer ate expirar");
});
it("signals local barrier while remote close is pending; distinguishes SSO failure",async()=>{
 let finish!:(v:boolean)=>void;h.close.mockImplementation(()=>new Promise(r=>{finish=r;}));
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(null,{status:204})));
 h.client.auth.signOut.mockImplementation(async()=>{await h.create.mock.calls[0][2].global.fetch("https://mdqlgwnggbkgmplgkebd.supabase.co/auth/v1/logout?scope=local",{method:"POST",headers:{authorization:"Bearer "+session.access_token}});return {error:null};});
 render(<Entry/>);login();await screen.findByText("tool:adsengine");fireEvent.click(screen.getByText("Encerrar e sair do QA"));
 expect(screen.getByText(/Confirmacao remota em andamento/)).toBeTruthy();expect(screen.queryByText("tool:adsengine")).toBeNull();expect(h.client.auth.signOut).not.toHaveBeenCalled();
 finish(false);await screen.findByText(/Logout aceito pelo servidor/);expect(screen.getByRole("status").textContent).toContain("Fechamento das ferramentas nao confirmado");
});
it("SIGNED_OUT reentrancy does not await nested logout inside SDK lock",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(null,{status:204})));
 h.client.auth.signOut.mockImplementation(async()=>{
  await h.create.mock.calls[0][2].global.fetch("https://mdqlgwnggbkgmplgkebd.supabase.co/auth/v1/logout?scope=local",{method:"POST",headers:{authorization:"Bearer "+session.access_token}});
  await h.callback("SIGNED_OUT",null);return {error:null};
 });
 render(<Entry/>);login();await screen.findByText("tool:adsengine");fireEvent.click(screen.getByText("Encerrar e sair do QA"));
 await screen.findByText(/Logout aceito pelo servidor/);expect(h.client.auth.signOut).toHaveBeenCalledTimes(1);expect(h.close).toHaveBeenCalledTimes(1);
});
it("expired scope preserves terminal uncertainty without reopening login",async()=>{
 render(<Entry/>);login();await screen.findByText("tool:adsengine");
 h.fixture.windowEnd=Date.now()-1;fireEvent(window,new Event("pagehide"));
 await screen.findByText(/Logout remoto nao confirmado/);
 expect(screen.queryByText("QA identity-only fechado")).toBeNull();expect(screen.queryByLabelText("Senha")).toBeNull();expect(screen.queryByText("tool:adsengine")).toBeNull();
});
it("late login after prior cleanup makes a second local logout, not a false receipt",async()=>{
 let resolve!:(v:any)=>void;h.client.auth.signInWithPassword.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const view=render(<Entry/>);login();view.unmount();
 await waitFor(()=>expect(h.client.auth.signOut).toHaveBeenCalledTimes(1));
 resolve({data:{session},error:null});await waitFor(()=>expect(h.client.auth.signOut).toHaveBeenCalledTimes(2));expect(h.client.from).not.toHaveBeenCalled();
});

it.each([true,false])("repeated finish and route polling preserve final receipt accepted=%s",async accepted=>{
 if(accepted){
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(null,{status:204})));
  h.client.auth.signOut.mockImplementation(async()=>{await h.create.mock.calls[0][2].global.fetch("https://mdqlgwnggbkgmplgkebd.supabase.co/auth/v1/logout?scope=local",{method:"POST",headers:{authorization:"Bearer "+session.access_token}});return {error:null};});
 }
 render(<Entry/>);login();await screen.findByText("tool:adsengine");
 vi.stubGlobal("location",{origin,pathname:"/elsewhere",search:"",hash:""});
 fireEvent(window,new PopStateEvent("popstate"));
 await screen.findByText(accepted?/Logout aceito pelo servidor/:/Logout remoto nao confirmado/);
 const final=screen.getByRole("status").textContent;
 fireEvent(window,new Event("pagehide"));fireEvent(window,new PopStateEvent("popstate"));
 await new Promise(r=>setTimeout(r,550));
 expect(screen.getByRole("status").textContent).toBe(final);
 expect(screen.queryByText(/Confirmacao remota em andamento/)).toBeNull();
 expect(h.client.auth.signOut).toHaveBeenCalledTimes(1);expect(h.close).toHaveBeenCalledTimes(1);
});
