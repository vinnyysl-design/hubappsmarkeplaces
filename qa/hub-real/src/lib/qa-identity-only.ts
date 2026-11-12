import { QA_HUB, QA_OWNER, qaAllowed, type QaGate } from "./qa-tool-bridge";
export type IdentityFixture = {enabled:boolean;purpose:string;ownerId:string|null;windowStart:number;windowEnd:number;apps:string[]};
export function identityScope(f:IdentityFixture,g:QaGate,stage:string,origin:string,now=Date.now()) {
 return stage==="staging" && origin===QA_HUB && f.enabled===true && f.purpose==="identity-only" &&
 f.ownerId===QA_OWNER && JSON.stringify(f.apps)===JSON.stringify(["adsengine","vision-x"]) &&
 Number.isSafeInteger(f.windowStart)&&Number.isSafeInteger(f.windowEnd)&&f.windowEnd>f.windowStart&&
 f.windowEnd-f.windowStart<=900000 && f.windowStart>=g.windowStart && f.windowEnd<=g.windowEnd &&
 now>=f.windowStart && now<f.windowEnd-65000 && qaAllowed(g,origin,QA_OWNER,now);
}
export function identityProfileAllowed(profile:any,user:any,session:any,now:number) {
 const start=Date.parse(profile?.trial_started_at??"");
 const terms=Date.parse(profile?.terms_accepted_at??"");
 return user?.id===QA_OWNER && session?.user?.id===QA_OWNER && !!user.email_confirmed_at &&
 typeof session?.access_token==="string" && session.access_token.length>0 &&
 Number.isFinite(session.expires_at) && session.expires_at*1000>now+65000 &&
 profile?.id===QA_OWNER && profile.status==="ativo" &&
 profile.administrative_blocked===false && profile.financial_blocked===false &&
 profile.phone_verified===true && profile.plan==="trial" &&
 Number.isFinite(start) && now>start+864000000 &&
 Number.isFinite(terms) && terms<=now && profile.terms_version==="1.0";
}
export const IDENTITY_PROFILE_FIELDS="id,status,administrative_blocked,financial_blocked,phone_verified,plan,trial_started_at,terms_accepted_at,terms_version";
export async function inspectIdentity(client:any,session:any,current:()=>boolean,now=()=>Date.now()) {
 if(!current())throw Error("QA_UNAVAILABLE");
 const verified=await client.auth.getUser(session?.access_token);
 if(!current()||verified.error||verified.data?.user?.id!==QA_OWNER||session?.user?.id!==QA_OWNER)throw Error("QA_UNAVAILABLE");
 const read=await client.from("profiles").select(IDENTITY_PROFILE_FIELDS).retry(false).eq("id",QA_OWNER).maybeSingle();
 if(!current()||read.error||!identityProfileAllowed(read.data,verified.data.user,session,now()))throw Error("QA_UNAVAILABLE");
 return {user:verified.data.user,session,accessState:"ready" as const,accountStatus:"ativo" as const,administrativeBlocked:false,financialBlocked:false};
}
