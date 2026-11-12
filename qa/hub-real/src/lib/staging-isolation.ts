import {readDeploymentConfig} from './deployment-config';
import fixture from '../../identity-only-window.json';
import {identityScope, IDENTITY_PROFILE_FIELDS} from './qa-identity-only';
import {QA_GATE,QA_HUB,QA_OWNER,QA_APPS} from './qa-tool-bridge';
export function stagingRequestAllowed(url:URL,method:string) {
 if(url.origin!=='https://mdqlgwnggbkgmplgkebd.supabase.co')return false;
 if(method==='GET')return url.pathname==='/auth/v1/user'||url.pathname.startsWith('/rest/v1/');
 if(method!=='POST')return false;
 if(url.pathname==='/auth/v1/token')return ['password','refresh_token'].includes(url.searchParams.get('grant_type')??'');
 return ['/auth/v1/logout','/functions/v1/validate-user','/rest/v1/rpc/activate_trial_after_email_confirm','/rest/v1/rpc/enforce_trial_status','/rest/v1/rpc/validate_coupon'].includes(url.pathname);
}
const qaPath=(path:string)=>path==='/qa-tools'||path==='/qa-auth';
const qaOrigin='https://mdqlgwnggbkgmplgkebd.supabase.co';
const fixedUserPaths=(operation:string)=>['ads','vision'].map(app=>'/functions/v1/qa-tool-sso-v3-'+app+'-user/'+operation);
const exactQuery=(url:URL,expected:Record<string,string>)=>{
 const entries=[...url.searchParams.entries()];return entries.length===Object.keys(expected).length&&Object.entries(expected).every(([k,v])=>url.searchParams.getAll(k).length===1&&url.searchParams.get(k)===v);
};
export function qaIdentityRequestAllowed(url:URL,method:string,active:boolean,cleanup:boolean) {
 if(url.origin!==qaOrigin||url.username||url.password||url.hash)return false;
 if(method==='POST'&&cleanup){
  if(url.pathname==='/auth/v1/logout'&&exactQuery(url,{scope:'local'}))return true;
  if(!url.search&&fixedUserPaths('revoke').includes(url.pathname))return true;
 }
 if(!active)return false;
 if(method==='GET'){
  if(url.pathname==='/auth/v1/user'&&!url.search)return true;
  return url.pathname==='/rest/v1/profiles'&&exactQuery(url,{select:IDENTITY_PROFILE_FIELDS,id:'eq.'+QA_OWNER});
 }
 if(method!=='POST')return false;
 if(url.pathname==='/auth/v1/token'&&exactQuery(url,{grant_type:'password'}))return true;
 return !url.search&&fixedUserPaths('authorize').includes(url.pathname);
}
export function installStagingIsolation(env:Record<string,unknown>) {
 const config=readDeploymentConfig(env);if(config.stage!=='staging')return;
 const original=globalThis.fetch.bind(globalThis);
 // Classify once per document. Ordinary navigation cannot acquire this exception.
 const identityDocument=qaPath(location.pathname);
 const initialPath=location.pathname;
 let qaAttempted=false;
 const active=()=>identityDocument&&location.pathname===initialPath&&!location.search&&!location.hash&&
  identityScope(fixture,QA_GATE,String(env.VITE_DEPLOYMENT_STAGE),location.origin);
 globalThis.fetch=async(input,init)=>{
  let url:URL;
  try {url=new URL(input instanceof Request?input.url:String(input),location.origin);}catch{return Response.json({error:'staging_action_disabled'},{status:503});}
  const method=(init?.method??(input instanceof Request?input.method:'GET')).toUpperCase();
  const allowed=identityDocument
   ?qaIdentityRequestAllowed(url,method,active(),qaAttempted&&location.origin===QA_HUB)
   :stagingRequestAllowed(url,method);
  if(!allowed)return Response.json({error:'staging_action_disabled'},{status:503});
  if(identityDocument&&method==='POST'&&url.pathname==='/auth/v1/token')qaAttempted=true;
  return original(input,init);
 };
 const open=window.open.bind(window);
 window.open=((url?:string|URL,target?:string,features?:string)=>{
  if(!url)return null;let parsed:URL;try{parsed=new URL(String(url),location.origin);}catch{return null;}
  if(identityDocument){
   if(!active()||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash||
    !Object.values(QA_APPS).some(app=>app.origin===parsed.origin)||target!=='_blank'||features)return null;
  }else if(parsed.origin!==location.origin)return null;
  return open(url,target,features);
 }) as typeof window.open;
 document.addEventListener('click',event=>{
  const anchor=(event.target as Element|null)?.closest?.('a');
  if(anchor&&new URL(anchor.href,location.origin).origin!==location.origin)event.preventDefault();
 },true);
 globalThis.WebSocket=class {constructor(){throw Error('STAGING_REALTIME_DISABLED');}} as any;
}
