import { accessState } from "./access-blocks.js";
// Shared real AuthContext pipeline, with a guard before AND after each wait.
// Already-started requests still require the server's independent caller guard.
export async function loadProfileAccess(
  uid: string, emailConfirmed: boolean, metaCoupon: string|null,
  client: any, validateAccess: () => Promise<any>, assertCurrent: () => void,
) {
  async function step<T>(call:()=>PromiseLike<T>):Promise<T> {
    assertCurrent();
    const pending=call();
    assertCurrent();
    // Start PostgREST thenables while the ticket is still current rather than
    // letting Promise.all schedule another request after a session transition.
    const result=await pending.then(value=>value);
    assertCurrent();
    return result;
  }
  assertCurrent();
  if(metaCoupon)await step(()=>client.rpc('redeem_coupon',{_code:metaCoupon,_user_id:uid}));
  if(emailConfirmed){
    const activated:any=await step(()=>client.rpc('activate_trial_after_email_confirm',{_user_id:uid}));
    if(activated.error)throw new Error('ACTIVATION_UNAVAILABLE');
  }
  const enforced:any=await step(()=>client.rpc('enforce_trial_status',{_user_id:uid}));
  const trial=Array.isArray(enforced.data)?enforced.data[0]:enforced.data;
  if(enforced.error||!trial||!['ativo','bloqueado'].includes(trial.status))throw new Error('ENTITLEMENT_UNAVAILABLE');
  // Sequence the dependent lookups, guarding both the starts and completions.
  const profileResult:any=await step(()=>client.from('profiles').select('id,status,administrative_blocked,financial_blocked,terms_accepted_at,terms_version,phone,phone_verified,trial_status,trial_started_at,plan').eq('id',uid).maybeSingle());
  const roleResult:any=await step(()=>client.from('user_roles').select('role').eq('user_id',uid));
  const profile=profileResult.data;
  if(profileResult.error||roleResult.error||!profile||profile.id!==uid||!Array.isArray(roleResult.data)||!['ativo','bloqueado'].includes(profile.status))throw new Error('PROFILE_UNAVAILABLE');
  const tools=accessState(profile);
  const validation:any=await step(validateAccess);
  const blocked=validation.status===403&&validation.data?.error==='user_blocked';
  if(!blocked&&(!validation.ok||validation.data?.valid!==true||validation.data?.user?.id!==uid))throw new Error('ACCESS_UNAVAILABLE');
  if(blocked===tools.toolsAllowed)throw new Error("ACCESS_STATE_INCONSISTENT");
  return {profile,roles:roleResult.data,trial,blocked};
}
