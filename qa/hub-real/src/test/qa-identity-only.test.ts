import {describe,it,expect,vi} from "vitest";
import {identityScope,identityProfileAllowed,inspectIdentity} from "../lib/qa-identity-only";
import {QA_OWNER,QA_HUB} from "../lib/qa-tool-bridge";
const now=1794506000000;
const fixture=()=>({enabled:true,purpose:"identity-only",ownerId:QA_OWNER,windowStart:now-1000,windowEnd:now+899000,apps:["adsengine","vision-x"]});
const gate=()=>({enabled:true,ownerId:QA_OWNER,windowStart:now-1000,windowEnd:now+899000});
const user=()=>({id:QA_OWNER,email_confirmed_at:"2026-01-01"});
const session=()=>({user:user(),access_token:"test-memory-only",expires_at:now/1000+3600});
const profile=()=>({id:QA_OWNER,status:"ativo",administrative_blocked:false,financial_blocked:false,phone_verified:true,plan:"trial",trial_started_at:new Date(now-864000001).toISOString(),terms_accepted_at:new Date(now-1000).toISOString(),terms_version:"1.0"});
it("accepts only bounded expired-trial identity fixture",()=>{expect(identityScope(fixture(),gate(),"staging",QA_HUB,now)).toBe(true);expect(identityProfileAllowed(profile(),user(),session(),now)).toBe(true);});
it.each([
 ["disabled",{enabled:false}],["wrong-purpose",{purpose:"commercial"}],["wrong-owner",{ownerId:"other"}],["missing-owner",{ownerId:null}],["too-long",{windowEnd:now+900000}],["zero",{windowStart:0,windowEnd:0}],["future",{windowStart:now+1}],["expired",{windowEnd:now}],["nearexpiry",{windowEnd:now+65000}],["apps-order",{apps:["vision-x","adsengine"]}],["thirdapp",{apps:["adsengine","vision-x","third"]}],["NaN",{windowEnd:NaN}],
])("rejects fixture %s",(_,delta)=>expect(identityScope({...fixture(),...delta},gate(),"staging",QA_HUB,now)).toBe(false));
it.each(["https://evil.example","https://deploy-preview-1--analyticalxhub.netlify.app.evil.example","https://analyticalxhub.netlify.app","http://deploy-preview-1--analyticalxhub.netlify.app"])("rejects origin %s",origin=>expect(identityScope(fixture(),gate(),"staging",origin,now)).toBe(false));
it("rejects production stage and closed parent gate",()=>{expect(identityScope(fixture(),gate(),"production",QA_HUB,now)).toBe(false);expect(identityScope(fixture(),{...gate(),enabled:false},"staging",QA_HUB,now)).toBe(false);});
it.each([
 ["owner",{id:"other"}],["blocked",{status:"bloqueado"}],["adminblock",{administrative_blocked:true}],["unknownblock",{administrative_blocked:null}],["financial",{financial_blocked:true}],["phone",{phone_verified:false}],["plan",{plan:"pagante"}],["no-trial",{trial_started_at:null}],["trial-active",{trial_started_at:new Date(now-1000).toISOString()}],["terms",{terms_version:"0.9"}],["no-terms",{terms_accepted_at:null}],["future-terms",{terms_accepted_at:new Date(now+1).toISOString()}]
])("rejects profile %s",(_,delta)=>expect(identityProfileAllowed({...profile(),...delta},user(),session(),now)).toBe(false));
it("rejects unconfirmed/wrong user and short session",()=>{expect(identityProfileAllowed(profile(),{...user(),email_confirmed_at:null},session(),now)).toBe(false);expect(identityProfileAllowed(profile(),{...user(),id:"other"},session(),now)).toBe(false);expect(identityProfileAllowed(profile(),user(),{...session(),expires_at:now/1000+65},now)).toBe(false);});
function port(){const maybeSingle=vi.fn().mockResolvedValue({data:profile(),error:null});const eq=vi.fn(()=>({maybeSingle}));const select=vi.fn(()=>({eq,retry(){return this;}}));const from=vi.fn(()=>({select}));return {auth:{getUser:vi.fn().mockResolvedValue({data:{user:user()},error:null})},from,select,eq,maybeSingle,rpc:vi.fn(()=>{throw Error("MUTATION");})};}
it("does only authoritative user read and profile SELECT; never coupon/trial RPC",async()=>{const p=port();const identity=await inspectIdentity(p,session(),()=>true,()=>now);expect(identity.user.id).toBe(QA_OWNER);expect(p.rpc).not.toHaveBeenCalled();expect(p.from).toHaveBeenCalledWith("profiles");expect(p.eq).toHaveBeenCalledWith("id",QA_OWNER);});
it("rejects before any lookup when stale",async()=>{const p=port();await expect(inspectIdentity(p,session(),()=>false,()=>now)).rejects.toThrow();expect(p.auth.getUser).not.toHaveBeenCalled();});
it("denies profile read error",async()=>{const p=port();p.maybeSingle.mockResolvedValue({data:profile(),error:{} as any});await expect(inspectIdentity(p,session(),()=>true,()=>now)).rejects.toThrow();});
it("denies superseded profile completion",async()=>{const p=port();let current=true;p.maybeSingle.mockImplementation(async()=>{current=false;return {data:profile(),error:null};});await expect(inspectIdentity(p,session(),()=>current,()=>now)).rejects.toThrow();});
