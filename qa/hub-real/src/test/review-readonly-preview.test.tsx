import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import ReviewDialog from '../components/ReviewDialog';
const state=vi.hoisted(()=>({from:vi.fn(),upsert:vi.fn(),toast:vi.fn()}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'synthetic-review-only'},isAuthenticated:false})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:state.from}}));
vi.mock('@/hooks/use-toast',()=>({toast:state.toast}));
beforeEach(()=>{vi.clearAllMocks();state.upsert.mockResolvedValue({error:null});state.from.mockReturnValue({upsert:state.upsert});vi.stubGlobal('fetch',vi.fn(()=>{throw Error('NETWORK_FORBIDDEN');}));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.unstubAllEnvs();});
function open(){render(<ReviewDialog/>);fireEvent(window,new Event('open-review-dialog'));}
it('QA close is UI-only, emits no SDK request and never touches terms',async()=>{
 vi.stubEnv('VITE_DEPLOYMENT_STAGE','staging');open();expect(screen.getByText(/QA de leitura/)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Close'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(state.from).not.toHaveBeenCalled();expect(state.upsert).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
it('QA evaluation remains disabled even with a rating and manual click',()=>{
 vi.stubEnv('VITE_DEPLOYMENT_STAGE','staging');open();fireEvent.click(screen.getByRole('button',{name:'5 estrelas'}));
 const submit=screen.getByRole('button',{name:'Enviar avaliação'});expect(submit).toBeDisabled();fireEvent.click(submit);
 expect(state.from).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
it('production dismissal retains existing own-user upsert behavior',async()=>{
 vi.stubEnv('VITE_DEPLOYMENT_STAGE','production');open();fireEvent.click(screen.getByRole('button',{name:'Close'}));
 await waitFor(()=>expect(state.upsert).toHaveBeenCalledOnce());expect(state.from).toHaveBeenCalledWith('review_dismissals');
 expect(state.upsert).toHaveBeenCalledWith({user_id:'synthetic-review-only',dismissed_at:expect.any(String)});
});
