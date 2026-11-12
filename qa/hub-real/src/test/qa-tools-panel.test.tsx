import {render,screen,cleanup} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import QaTools from '@/pages/QaTools';
import {QA_HUB,QA_OWNER} from '@/lib/qa-tool-bridge';
const state=vi.hoisted(()=>({id:''}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:state.id},logout:vi.fn()})}));
vi.mock('@/components/QaToolAccess',()=>({default:({app}:{app:string})=><div data-testid="qa-frame-slot">{app}</div>}));
beforeEach(()=>{state.id=QA_OWNER;vi.stubEnv('VITE_DEPLOYMENT_STAGE','staging');vi.stubGlobal('location',{origin:QA_HUB});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.unstubAllEnvs();});
function open(){render(<MemoryRouter initialEntries={['/qa-tools']}><Routes><Route path="/qa-tools" element={<QaTools/>}/><Route path="/" element={<p>home</p>}/></Routes></MemoryRouter>)}
it('keeps Ads and Vision in the same protected QA page',()=>{open();expect(screen.getAllByTestId('qa-frame-slot')).toHaveLength(2);expect(screen.getByRole('button',{name:'Encerrar ambas e sair do Hub'})).toBeEnabled();});
it('does not expose the panel to another owner',()=>{state.id='other';open();expect(screen.getByText('home')).toBeTruthy();expect(screen.queryAllByTestId('qa-frame-slot')).toHaveLength(0);});
it('does not expose the panel in production',()=>{vi.stubEnv('VITE_DEPLOYMENT_STAGE','production');open();expect(screen.getByText('home')).toBeTruthy();});
it('does not expose the panel at an unapproved origin',()=>{vi.stubGlobal('location',{origin:'https://example.invalid'});open();expect(screen.getByText('home')).toBeTruthy();});
