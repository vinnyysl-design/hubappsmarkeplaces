import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {TooltipProvider} from '@/components/ui/tooltip';
import AppPreviewModal from '@/components/AppPreviewModal';
import AppCard from '@/components/AppCard';
import {getAppPreview} from '@/data/appPreviews';
import apps from '@/data/apps.json';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'synthetic-local'},status:'ativo',isAdmin:false,termsAcceptedAt:'2026-01-01',termsVersion:'1.0'})}));
vi.mock('@/hooks/useAppPrefs',()=>({useAppPrefs:()=>({track:vi.fn(),isFavorite:()=>false,toggleFavorite:vi.fn()})}));
vi.mock('@/hooks/usePreviewPrefs',()=>({usePreviewPrefs:()=>({shouldAutoShow:()=>false})}));
vi.mock('@/hooks/useTracking',()=>({trackToolClick:vi.fn()}));
beforeEach(()=>{vi.stubGlobal('fetch',vi.fn(()=>{throw Error('NETWORK_FORBIDDEN');}));vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
for(const slug of ['curva-abc','precificacao']){
 const app=apps.find(a=>a.slug===slug)!;
 it(`${slug}: deferred config has no old asset URL or duration`,()=>{
  const cfg=getAppPreview(slug)!;expect(cfg.demonstrationUnavailable).toBe(true);
  expect(cfg.videoUrl).toBeUndefined();expect(cfg.previewImageUrl).toBeUndefined();expect(cfg.videoDuration).toBeUndefined();
 });
 it(`${slug}: unavailable demonstration ignores stale media overrides while retaining real app route`,()=>{
  render(<MemoryRouter><AppPreviewModal app={{...app,preview:{videoMp4:'/__l5e/stale.mp4',poster:'/__l5e/stale.jpg',image:'/__l5e/stale.jpg'}}} onClose={()=>{}}/></MemoryRouter>);
  const dialog=screen.getByRole('dialog');expect(screen.getByRole('status')).toHaveTextContent('Demonstração indisponível no momento.');
  expect(dialog.querySelector('video,source,img')).toBeNull();expect(dialog.innerHTML).not.toContain('/__l5e/');
  expect(screen.getByRole('link',{name:/Acessar aplicativo/})).toHaveAttribute('href',`/app/${slug}`);expect(fetch).not.toHaveBeenCalled();
 });
 it(`${slug}: existing card and Conhecer App remain usable`,()=>{
  const preview=vi.fn();render(<MemoryRouter><TooltipProvider><AppCard app={app} onPreview={preview}/></TooltipProvider></MemoryRouter>);
  expect(screen.getByRole('link',{name:/Acessar App/})).toHaveAttribute('href',`/app/${slug}`);
  fireEvent.click(screen.getByRole('button',{name:/Conhecer App/}));expect(preview).toHaveBeenCalledWith(app);expect(fetch).not.toHaveBeenCalled();
 });
}
it('locked preview still refuses app access; other app configs are unchanged',()=>{
 const app=apps.find(a=>a.slug==='curva-abc')!;render(<MemoryRouter><AppPreviewModal app={app} locked onClose={()=>{}}/></MemoryRouter>);
 expect(screen.queryByRole('link',{name:/Acessar aplicativo/})).toBeNull();expect(screen.getByText('Bloqueado')).toHaveAttribute('aria-disabled','true');
 for(const a of apps.filter(a=>!['curva-abc','precificacao'].includes(a.slug)))expect(getAppPreview(a.slug)?.demonstrationUnavailable).toBeUndefined();
});
