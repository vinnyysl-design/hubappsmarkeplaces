import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import {TooltipProvider} from '@/components/ui/tooltip';
import AppCard from '@/components/AppCard';
const auth=vi.hoisted(()=>({status:'ativo',isAdmin:false,termsAcceptedAt:'2026-01-01',termsVersion:'1.0'}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('@/hooks/useAppPrefs',()=>({useAppPrefs:()=>({isFavorite:()=>false,toggleFavorite:vi.fn(),track:vi.fn()})}));
vi.mock('@/hooks/usePreviewPrefs',()=>({usePreviewPrefs:()=>({shouldAutoShow:()=>false})}));
vi.mock('@/hooks/useTracking',()=>({trackToolClick:vi.fn()}));
const app={slug:'fulfillment',nome:'Full',descricao:'Fixture de cartão sem serviço externo',categoria:'Operação',status:'Ativo',tag:'',url:'https://example.invalid/',github:'',icone:'x'};
afterEach(cleanup);
function open(){render(<MemoryRouter><TooltipProvider><AppCard app={app}/></TooltipProvider></MemoryRouter>);}
it('blocked administrative role cannot receive an enabled tool link',()=>{auth.isAdmin=true;auth.status='bloqueado';open();expect(screen.queryByRole('link',{name:/Acessar App/})).toBeNull();expect(screen.getByText('Bloqueado')).toHaveAttribute('aria-disabled','true');});
it('blocked ordinary role cannot receive an enabled tool link',()=>{auth.isAdmin=false;auth.status='bloqueado';open();expect(screen.queryByRole('link',{name:/Acessar App/})).toBeNull();});
it('active administrative role keeps the existing tool route',()=>{auth.isAdmin=true;auth.status='ativo';open();expect(screen.getByRole('link',{name:/Acessar App/})).toHaveAttribute('href','/app/fulfillment');});
