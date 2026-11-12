import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const signOut=vi.hoisted(()=>vi.fn(async()=>({error:null})));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{signOut}}}));
vi.mock('@/lib/auth-operation-interlock',()=>({authOperations:{queue:(f:any)=>f()}}));
beforeEach(()=>{vi.resetModules();signOut.mockClear();localStorage.clear();vi.stubGlobal('fetch',vi.fn(()=>{throw Error('NETWORK_FORBIDDEN');}));});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('staging logout closes only the current QA session',async()=>{vi.stubEnv('VITE_DEPLOYMENT_STAGE','staging');const auth=await import('../services/auth');await auth.logout({redirect:false});expect(signOut).toHaveBeenCalledExactlyOnceWith({scope:'local'});});
it('production preserves its existing default logout behavior',async()=>{vi.stubEnv('VITE_DEPLOYMENT_STAGE','production');const auth=await import('../services/auth');await auth.logout({redirect:false});expect(signOut).toHaveBeenCalledExactlyOnceWith();});
