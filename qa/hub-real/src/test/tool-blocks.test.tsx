import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
const auth=vi.hoisted(()=>({isAuthenticated:true,isAdmin:false,status:'bloqueado',loading:false,accessState:'ready',refreshProfile:()=>{},needsPhoneVerification:true}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>auth}));
afterEach(cleanup);
function open(requireActive:boolean){render(<MemoryRouter initialEntries={['/target']}><Routes><Route path="/target" element={<ProtectedRoute requireActive={requireActive}><div>permitted target</div></ProtectedRoute>}/><Route path="/" element={<div>Hub remains accessible</div>}/><Route path="/verify-phone" element={<div>phone gate</div>}/></Routes></MemoryRouter>);}
it('blocked authenticated identity can open Hub even before phone gate',()=>{auth.isAdmin=false;auth.status='bloqueado';auth.needsPhoneVerification=true;open(false);expect(screen.getByText('permitted target')).toBeTruthy();});
it('admin role does not bypass a block on a tool route',()=>{auth.isAdmin=true;auth.status='bloqueado';auth.needsPhoneVerification=false;open(true);expect(screen.getByText('Hub remains accessible')).toBeTruthy();});
it('active confirmed identity can open tool route',()=>{auth.isAdmin=false;auth.status='ativo';auth.needsPhoneVerification=false;open(true);expect(screen.getByText('permitted target')).toBeTruthy();});
