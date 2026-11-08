import {readDeploymentConfig} from './deployment-config';
export function stagingRequestAllowed(url:URL,method:string) {
  if(url.origin!=='https://mdqlgwnggbkgmplgkebd.supabase.co')return false;
  if(method==='GET')return url.pathname==='/auth/v1/user'||url.pathname.startsWith('/rest/v1/');
  if(method!=='POST')return false;
  if(url.pathname==='/auth/v1/token')return ['password','refresh_token'].includes(url.searchParams.get('grant_type')??'');
  return ['/auth/v1/logout','/functions/v1/validate-user','/rest/v1/rpc/activate_trial_after_email_confirm','/rest/v1/rpc/enforce_trial_status','/rest/v1/rpc/validate_coupon'].includes(url.pathname);
}
export function installStagingIsolation(env:Record<string,unknown>) {
  const config=readDeploymentConfig(env);if(config.stage!=='staging')return;
  const original=globalThis.fetch.bind(globalThis);
  globalThis.fetch=async(input,init)=>{
    const url=new URL(input instanceof Request?input.url:String(input),location.origin);
    const method=(init?.method??(input instanceof Request?input.method:'GET')).toUpperCase();
    if(!stagingRequestAllowed(url,method))return Response.json({error:'staging_action_disabled'},{status:503});
    return original(input,init);
  };
  const open=window.open.bind(window);
  window.open=((url?:string|URL,target?:string,features?:string)=>{
    if(!url||new URL(String(url),location.origin).origin!==location.origin)return null;
    return open(url,target,features);
  }) as typeof window.open;
  document.addEventListener('click',event=>{
    const anchor=(event.target as Element|null)?.closest?.('a');
    if(anchor&&new URL(anchor.href,location.origin).origin!==location.origin)event.preventDefault();
  },true);
  globalThis.WebSocket=class {constructor(){throw Error('STAGING_REALTIME_DISABLED');}} as any;
}
