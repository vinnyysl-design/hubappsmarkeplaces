import {render,screen,cleanup} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import AppViewer from '../pages/AppViewer';
import apps from '../data/apps.json';
const state=vi.hoisted(()=>({invoke:vi.fn(),track:vi.fn()}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'synthetic-viewer-only'}})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke:state.invoke}}}));
vi.mock('@/hooks/useTracking',()=>({trackToolClick:state.track}));
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',vi.fn(()=>{throw Error('NETWORK_FORBIDDEN');}));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('QA local shells for every internal tool never mount frames, invoke SSO or track',()=>{
 vi.stubEnv('VITE_DEPLOYMENT_STAGE','staging');
 for(const app of apps.filter(a=>!a.external)){
  const view=render(<MemoryRouter initialEntries={['/app/'+app.slug]}><Routes><Route path="/app/:slug" element={<AppViewer/>}/></Routes></MemoryRouter>);
  expect(screen.getByRole('heading',{name:'QA de leitura: página local da ferramenta'})).toBeTruthy();
  expect(view.container.querySelector('iframe')).toBeNull();expect(state.invoke).not.toHaveBeenCalled();expect(state.track).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();view.unmount();
 }
});
it('normal non-SSO production tool retains the existing frame and tracking',()=>{
 vi.stubEnv('VITE_DEPLOYMENT_STAGE','production');const app=apps.find(a=>!a.sso&&!a.external)!;
 const view=render(<MemoryRouter initialEntries={['/app/'+app.slug]}><Routes><Route path="/app/:slug" element={<AppViewer/>}/></Routes></MemoryRouter>);
 expect(view.container.querySelector('iframe')?.getAttribute('src')).toContain('from=hub');expect(state.track).toHaveBeenCalledOnce();expect(state.invoke).not.toHaveBeenCalled();
});
