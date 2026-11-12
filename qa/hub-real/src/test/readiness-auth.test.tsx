import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {AuthProvider,useAuth} from '../contexts/AuthContext';
import {MemoryRouter} from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';

const state=vi.hoisted(()=>({callback:null as any,user:null as any,initial:null as any,rpcWait:new Map<string,Promise<any>>(),profileMissing:false,networkFail:false,adminIds:new Set<string>(),calls:[] as string[],logoutGeneration:0,logoutBarrier:false,signupWait:null as any,fingerprintWait:null as any,loginWait:new Map<string,Promise<any>>()}));
const user=(id:string)=>({id,email:`${id}@synthetic.invalid`,email_confirmed_at:null,user_metadata:{}});
const deferred=()=>{let resolve:(value:any)=>void=()=>{};const promise=new Promise<any>(r=>resolve=r);return {promise,resolve};};
vi.mock('@/lib/fingerprint',()=>({getDeviceFingerprint:vi.fn(async()=>{state.calls.push('fingerprint');return state.fingerprintWait??'synthetic-fingerprint';})}));
vi.mock('@/services/auth',()=>({setToken:vi.fn(),sessionAdoptionAllowed:()=>!state.logoutBarrier,getLogoutGeneration:()=>state.logoutGeneration,confirmExplicitLogin:(_token:string,generation:number)=>{if(generation!==state.logoutGeneration)return false;state.logoutBarrier=false;return true;},logout:async()=>{state.logoutGeneration++;state.logoutBarrier=true;return {confirmed:true,error:null};}}));
vi.mock('@/integrations/supabase/profileClient',async()=>{const {supabase}=await import('@/integrations/supabase/client');return {createProfileClient:()=>supabase};});
vi.mock('@/services/api',()=>({validateAccess:async()=>state.networkFail?{ok:false,status:0,data:{error:'network_error'}}:{ok:true,status:200,data:{valid:true,user:{id:state.user.id}}}}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{
 auth:{onAuthStateChange:(cb:any)=>{state.callback=cb;return {data:{subscription:{unsubscribe:vi.fn()}}};},getSession:()=>{const pending=state.initial;state.initial=null;return pending??Promise.resolve({data:{session:state.user?{user:state.user,access_token:`synthetic-${state.user.id}`}:null},error:null});},signInWithPassword:async({email}:any)=>{state.calls.push('login:'+email);const result=await state.loginWait.get(email);if(result?.data?.session&&!result.error){state.user=result.data.session.user;state.callback('SIGNED_IN',result.data.session);}return result;},getUser:async()=>({data:{user:state.user},error:null}),signUp:async()=>{state.calls.push('auth.signUp');if(state.signupWait)return state.signupWait;state.user=user('NEW');state.callback('SIGNED_IN',{user:state.user,access_token:'synthetic-NEW'});return {data:{user:state.user,session:{user:state.user,access_token:'synthetic-NEW'}},error:null};},signOut:async()=>{}},
 rpc:async(name:string,args:any)=>{state.calls.push(name);if(state.rpcWait.has(name))return state.rpcWait.get(name);if(name==='validate_signup_email')return {data:{ok:true,normalized:args._email},error:null};if(name==='is_phone_available')return {data:true,error:null};return state.rpcWait.get(args._user_id)??{data:[{status:'ativo',trial_ends_at:null}],error:null};},
 from:(table:string)=>{let uid='';const q:any={insert:()=>{state.calls.push('insert:'+table);return Promise.resolve({data:null,error:null});},select:()=>q,eq:(_:string,id:string)=>{uid=id;return q;},maybeSingle:async()=>({data:state.profileMissing?null:{id:uid,status:'ativo',plan:'trial',administrative_blocked:false,financial_blocked:false},error:null}),then:(resolve:any)=>Promise.resolve({data:[{role:state.adminIds.has(uid)?'admin':'user'}],error:null}).then(resolve)};return q;},
}}));
let authApi:any;
function Probe(){const a=useAuth();authApi=a;return <output data-testid="state">{JSON.stringify({id:a.user?.id??null,status:a.status,role:a.role,access:a.accessState})}</output>;}
const read=()=>JSON.parse(screen.getByTestId('state').textContent!);
const send=(id:string|null)=>act(()=>{state.user=id?user(id):null;state.callback('SIGNED_IN',id?{user:state.user,access_token:`synthetic-${id}`}:null);});
beforeEach(()=>{state.callback=null;state.user=null;state.initial=null;state.rpcWait.clear();state.profileMissing=false;state.networkFail=false;state.adminIds.clear();state.calls=[];state.logoutGeneration=0;state.logoutBarrier=false;state.signupWait=null;state.fingerprintWait=null;state.loginWait.clear();authApi=null;vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('REAL_NETWORK_FORBIDDEN');}));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

describe('actual AuthProvider with synthetic SDK and denied fetch',()=>{
 it('does not grant active status when profile is unavailable',async()=>{
  state.profileMissing=true;render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(read().access).toBe('anonymous'));
  send('A');await waitFor(()=>expect(read().access).toBe('unavailable'));expect(read().status).toBeNull();expect(read().role).toBeNull();
 });
 it('network validation failure stays unavailable without pretending login vanished',async()=>{
  state.networkFail=true;render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(read().access).toBe('anonymous'));
  send('A');await waitFor(()=>expect(read().access).toBe('unavailable'));expect(read().id).toBe('A');expect(read().status).toBeNull();
 });
 it('late A profile cannot overwrite B',async()=>{
  const a=deferred();state.rpcWait.set('A',a.promise);render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(read().access).toBe('anonymous'));
  send('A');await new Promise(r=>setTimeout(r,10));send('B');await waitFor(()=>expect(read().access).toBe('ready'));expect(read().id).toBe('B');
  await act(async()=>a.resolve({data:[{status:'ativo'}],error:null}));expect(read().id).toBe('B');expect(read().status).toBe('ativo');
 });
 it('logout while profile is pending cannot resurrect A',async()=>{
  const a=deferred();state.rpcWait.set('A',a.promise);render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(read().access).toBe('anonymous'));
  send('A');await new Promise(r=>setTimeout(r,10));send(null);await act(async()=>a.resolve({data:[{status:'ativo'}],error:null}));
  await waitFor(()=>expect(read()).toEqual({id:null,status:null,role:null,access:'anonymous'}));
 });
 it('initial getSession cannot overwrite a newer Auth event',async()=>{
  const initial=deferred();state.initial=initial.promise;render(<AuthProvider><Probe/></AuthProvider>);send('B');await waitFor(()=>expect(read().access).toBe('ready'));
  await act(async()=>initial.resolve({data:{session:{user:user('A'),access_token:'synthetic-A'}},error:null}));expect(read().id).toBe('B');
 });

 it('revokes A permissions immediately while the SDK session read for B is pending',async()=>{
  function GuardProbe(){
   const a=useAuth();
   return <><output data-testid="permissions">{JSON.stringify({sessionId:a.session?.user.id??null,loading:a.loading,authenticated:a.isAuthenticated,admin:a.isAdmin})}</output>
    {a.accessState!=="anonymous"&&<ProtectedRoute requireAdmin requireActive><div data-testid="admin-content">synthetic admin content</div></ProtectedRoute>}</>;
  }
  state.adminIds.add('A');
  render(<MemoryRouter><AuthProvider><Probe/><GuardProbe/></AuthProvider></MemoryRouter>);
  await waitFor(()=>expect(read().access).toBe('anonymous'));
  send('A');await waitFor(()=>expect(read().access).toBe('ready'));
  expect(read().role).toBe('admin');expect(screen.queryByTestId('admin-content')).not.toBeNull();
  const pending=deferred();state.initial=pending.promise;
  send('B');
  // Assert BEFORE getSession resolves or the event's setTimeout callback runs.
  expect(read()).toEqual({id:null,status:null,role:null,access:'checking'});
  expect(JSON.parse(screen.getByTestId('permissions').textContent!)).toEqual({sessionId:null,loading:true,authenticated:false,admin:false});
  expect(screen.queryByTestId('admin-content')).toBeNull();
  await act(async()=>{await new Promise(r=>setTimeout(r,10));});
  expect(read()).toEqual({id:null,status:null,role:null,access:'checking'});
  expect(screen.queryByTestId('admin-content')).toBeNull();
  await act(async()=>pending.resolve({data:{session:{user:state.user,access_token:'synthetic-B'}},error:null}));
  await waitFor(()=>expect(read().access).toBe('ready'));
  expect(read().id).toBe('B');expect(read().role).toBe('user');
  expect(screen.queryByTestId('admin-content')).toBeNull();
 });

 it('reconciles a late null event against the current B session',async()=>{
  render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(read().access).toBe('anonymous'));
  send('B');await waitFor(()=>expect(read().access).toBe('ready'));
  act(()=>state.callback('SIGNED_OUT',null));
  expect(read().access).toBe('checking');expect(read().role).toBeNull();
  await waitFor(()=>expect(read().access).toBe('ready'));expect(read().id).toBe('B');
 });
 it('does not start signUp after logout while email validation waits',async()=>{
  const gate=deferred();state.rpcWait.set('validate_signup_email',gate.promise);
  render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(read().access).toBe('anonymous'));
  let result:any;act(()=>{result=authApi.signup('new@synthetic.invalid','synthetic-only','synthetic');});
  await waitFor(()=>expect(state.calls).toContain('validate_signup_email'));
  await act(async()=>{await authApi.logout();});
  await act(async()=>gate.resolve({data:{ok:true,normalized:'new@synthetic.invalid'},error:null}));
  expect((await result).error).not.toBeNull();expect(state.calls).not.toContain('auth.signUp');expect(state.calls).not.toContain('fingerprint');
 });
 it('does not start signUp after B replaces the session during phone validation',async()=>{
  const gate=deferred();state.rpcWait.set('is_phone_available',gate.promise);
  render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(read().access).toBe('anonymous'));
  let result:any;act(()=>{result=authApi.signup('new@synthetic.invalid','synthetic-only','synthetic','11900000000');});
  await waitFor(()=>expect(state.calls).toContain('is_phone_available'));
  send('B');await waitFor(()=>expect(read().access).toBe('ready'));
  await act(async()=>gate.resolve({data:true,error:null}));
  expect((await result).error).not.toBeNull();expect(state.calls).not.toContain('auth.signUp');expect(read().id).toBe('B');
 });
 it('does not adopt a late signUp response over B',async()=>{
  const gate=deferred();state.signupWait=gate.promise;
  render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(read().access).toBe('anonymous'));
  let result:any;act(()=>{result=authApi.signup('new@synthetic.invalid','synthetic-only','synthetic');});
  await waitFor(()=>expect(state.calls).toContain('auth.signUp'));
  send('B');await waitFor(()=>expect(read().access).toBe('ready'));
  const old=user('NEW');await act(async()=>gate.resolve({data:{user:old,session:{user:old,access_token:'synthetic-NEW'}},error:null}));
  expect((await result).error).not.toBeNull();expect(state.calls).not.toContain('fingerprint');expect(read().id).toBe('B');
 });
 it('does not insert a fingerprint after logout while fingerprint calculation waits',async()=>{
  const gate=deferred();state.fingerprintWait=gate.promise;
  render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(read().access).toBe('anonymous'));
  let result:any;act(()=>{result=authApi.signup('new@synthetic.invalid','synthetic-only','synthetic');});
  await waitFor(()=>expect(state.calls).toContain('fingerprint'));
  await act(async()=>{await authApi.logout();});await act(async()=>gate.resolve('synthetic-fingerprint'));
  expect((await result).error).not.toBeNull();expect(state.calls).not.toContain('insert:signup_fingerprints');expect(read().id).toBeNull();
 });

 it('rejects concurrent B before SDK execution, then permits B after A settles',async()=>{
  const a=deferred(),b=deferred();state.loginWait.set('A@synthetic.invalid',a.promise);state.loginWait.set('B@synthetic.invalid',b.promise);
  render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(read().access).toBe('anonymous'));
  let first:any,second:any;act(()=>{first=authApi.login('A@synthetic.invalid','synthetic-only');second=authApi.login('B@synthetic.invalid','synthetic-only');});
  expect((await second).error).not.toBeNull();expect(state.calls).not.toContain('login:B@synthetic.invalid');
  await act(async()=>a.resolve({data:{session:{user:user('A'),access_token:'synthetic-A'}},error:null}));
  expect((await first).error).toBeNull();await waitFor(()=>expect(read().access).toBe('ready'));expect(read().id).toBe('A');
  let third:any;act(()=>{third=authApi.login('B@synthetic.invalid','synthetic-only');});
  await act(async()=>b.resolve({data:{session:{user:user('B'),access_token:'synthetic-B'}},error:null}));
  expect((await third).error).toBeNull();await waitFor(()=>expect(read().access).toBe('ready'));expect(read().id).toBe('B');
 });
});
