import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {AuthClient}=require('@supabase/auth-js');
async function client() {
  const sdk=new AuthClient({url:'https://mdqlgwnggbkgmplgkebd.supabase.co/auth/v1',flowType:'implicit',detectSessionInUrl:false,persistSession:false,autoRefreshToken:false,debug:false,fetch:()=>{throw Error('NETWORK_FORBIDDEN');}});
  await sdk.initialize();
  // Only replace session reading with identity metadata. Actual SDK subscription,
  // INITIAL_SESSION emission and event dispatch run unchanged. No tokens/URL.
  sdk._useSession=async(callback:any)=>callback({data:{session:{user:{id:'OFFLINE_IDENTITY'}}},error:null});
  return sdk;
}
it('actual SDK does not replay PASSWORD_RECOVERY to a late Provider listener',async()=>{
  const sdk=await client();const events:string[]=[];
  await sdk._notifyAllSubscribers('PASSWORD_RECOVERY',{user:{id:'OFFLINE_IDENTITY'}},false);
  const sub=sdk.onAuthStateChange((event:string)=>{events.push(event);});
  await new Promise(resolve=>setTimeout(resolve,10));
  expect(events).toEqual(['INITIAL_SESSION']);
  sub.data.subscription.unsubscribe();await sdk.stopAutoRefresh();
});
it('actual SDK delivers recovery when listener exists before callback completion',async()=>{
  const sdk=await client();const events:string[]=[];
  const sub=sdk.onAuthStateChange((event:string)=>{events.push(event);});
  await new Promise(resolve=>setTimeout(resolve,10));
  await sdk._notifyAllSubscribers('PASSWORD_RECOVERY',{user:{id:'OFFLINE_IDENTITY'}},false);
  expect(events).toContain('PASSWORD_RECOVERY');
  sub.data.subscription.unsubscribe();await sdk.stopAutoRefresh();
});
