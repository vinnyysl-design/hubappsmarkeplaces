import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import ResetPassword from '../pages/ResetPassword';
import { sessionAdoptionAllowed, confirmExplicitLogin, getLogoutGeneration } from '../services/auth';

const s = vi.hoisted(() => ({ session: null as any, callback: null as any, generation: 0, barrier: false,
  getUserWait: null as any, updateWait: null as any, serverId: null as string | null,
  getUser: vi.fn(), updateUser: vi.fn(), toast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ toast: (...args: any[]) => s.toast(...args) }));
vi.mock('@/integrations/supabase/profileClient', () => ({ createProfileClient: () => ({}) }));
vi.mock('@/lib/load-profile-access', () => ({ loadProfileAccess: async () => ({ profile: { status: 'ativo', plan: 'trial', administrative_blocked:false, financial_blocked:false }, roles: [], trial: {}, blocked: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {
  onAuthStateChange: (cb: any) => { s.callback = cb; return { data: { subscription: { unsubscribe: vi.fn() } } }; },
  signOut: async () => { s.session=null; return {error:null}; },
  getSession: async () => ({ data: { session: s.session }, error: null }),
  getUser: () => { s.getUser(); return s.getUserWait ?? Promise.resolve({ data: { user: s.serverId ? { id: s.serverId } : null }, error: null }); },
  updateUser: (args: any) => { s.updateUser(args); return s.updateWait ?? Promise.resolve({ data: { user: { id: s.serverId } }, error: null }); },
} } }));
let api: any;
function Probe() { api = useAuth(); return null; }
function mount(allowed?: string) { return render(<MemoryRouter><AuthProvider recoveryAllowedUserId={allowed}><Probe /><ResetPassword /></AuthProvider></MemoryRouter>); }
function event(type: string, id: string | null) { act(() => { s.session = id ? { user: { id, user_metadata: {} }, access_token: 'offline-placeholder-not-a-jwt' } : null; s.serverId = id; s.callback(type, s.session); }); }
async function submit(view: ReturnType<typeof mount>) {
  const pw = view.container.querySelector('#pw')!;
  fireEvent.change(pw, { target: { value: 'synthetic-password-only' } });
  fireEvent.change(view.container.querySelector('#pw2')!, { target: { value: 'synthetic-password-only' } });
  fireEvent.submit(view.container.querySelector('form')!);
}
beforeEach(() => { s.session = null; s.callback = null; s.generation = 0; s.barrier = false; s.serverId = null;
  s.getUserWait = null; s.updateWait = null; s.getUser.mockClear(); s.updateUser.mockClear(); s.toast.mockClear();
  confirmExplicitLogin('offline-placeholder-not-a-jwt',getLogoutGeneration());
  window.history.replaceState({}, '', '/reset-password');
  vi.stubGlobal('fetch', vi.fn(() => { throw Error('NETWORK_FORBIDDEN'); }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { promise, resolve }; };
const success = () => ({ data: { user: { id: 'A' } }, error: null });
async function recovery(view: ReturnType<typeof mount>) {
  await waitFor(() => expect(s.callback).toBeTypeOf('function'));
  event('PASSWORD_RECOVERY', 'A');
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar recupera\u00e7\u00e3o nesta aba' }));
  await screen.findByRole('button', { name: 'Atualizar senha' });
  return view;
}
describe('real recovery page and Provider, mocked SDK offline', () => {
  it('does not expose form without session after the former 600ms timeout', async () => {
    mount(); await act(async () => { await new Promise(r => setTimeout(r, 650)); });
    expect(screen.queryByRole('button', { name: 'Atualizar senha' })).toBeNull();
    expect((await api.updatePassword('synthetic-only')).error).not.toBeNull();
    expect(s.updateUser).not.toHaveBeenCalled();
  });
  it('does not trust a recovery marker in the URL', async () => {
    window.history.replaceState({}, '', '/reset-password#type=recovery'); mount();
    expect(screen.queryByRole('button', { name: 'Atualizar senha' })).toBeNull();
    expect((await api.updatePassword('synthetic-only')).error).not.toBeNull();
  });
  it('invalid or expired callback without a recovery event stays blocked', async () => {
    window.history.replaceState({}, '', '/reset-password#error_code=otp_expired'); mount();
    await waitFor(() => expect(s.callback).toBeTypeOf('function')); event('SIGNED_OUT', null);
    expect(screen.queryByRole('button', { name: 'Atualizar senha' })).toBeNull();
    expect(s.updateUser).not.toHaveBeenCalled();
  });
  it('ordinary authenticated B cannot use the recovery update method', async () => {
    s.session = { user: { id: 'B', user_metadata: {} } }; s.serverId = 'B'; mount();
    await waitFor(() => expect(api.session?.user.id).toBe('B'));
    expect(screen.queryByRole('button', { name: 'Atualizar senha' })).toBeNull();
    expect((await api.updatePassword('synthetic-only')).error).not.toBeNull();
    expect(s.getUser).not.toHaveBeenCalled(); expect(s.updateUser).not.toHaveBeenCalled();
  });
  it('retains the existing logout barrier even if a recovery event arrives later', async () => {
    mount(); await waitFor(() => expect(s.callback).toBeTypeOf('function'));
    await act(async () => { await api.logout(); }); event('PASSWORD_RECOVERY', 'A');
    expect(api.recoveryUserId).toBeNull();
    expect((await api.updatePassword('synthetic-only')).error).not.toBeNull();
    expect(s.updateUser).not.toHaveBeenCalled();
  });
  it('new recovery after logout needs an explicit gesture before barrier release', async () => {
    const view=mount(); await waitFor(() => expect(s.callback).toBeTypeOf('function'));
    await act(async () => { await api.logout(); }); event('PASSWORD_RECOVERY','A');
    expect(sessionAdoptionAllowed()).toBe(false); expect(api.recoveryUserId).toBeNull();
    expect(screen.queryByRole('button',{name:'Atualizar senha'})).toBeNull();
    fireEvent.click(await screen.findByRole('button',{name:'Confirmar recupera\u00e7\u00e3o nesta aba'}));
    await screen.findByRole('button',{name:'Atualizar senha'}); expect(sessionAdoptionAllowed()).toBe(true);
    await submit(view); await waitFor(() => expect(s.updateUser).toHaveBeenCalledTimes(1));
  });
  it('ordinary SIGNED_IN after logout does not clear the barrier', async () => {
    mount(); await waitFor(() => expect(s.callback).toBeTypeOf('function'));
    await act(async () => { await api.logout(); }); event('SIGNED_IN','B');
    expect(sessionAdoptionAllowed()).toBe(false); expect(api.recoveryPending).toBe(false);
    expect((await api.confirmRecovery()).error).not.toBeNull(); expect(s.getUser).not.toHaveBeenCalled();
  });
  it('reload/remount with a surviving SDK session requires a new recovery flow', async () => {
    const view=await recovery(mount()); view.unmount(); mount();
    await waitFor(() => expect(api.session?.user.id).toBe('A'));
    expect(api.recoveryUserId).toBeNull(); expect(api.recoveryPending).toBe(false);
    expect(screen.queryByRole('button',{name:'Atualizar senha'})).toBeNull();
    expect(screen.getByText(/Solicite um novo link pelo fluxo/)).toBeTruthy();
    expect((await api.confirmRecovery()).error).not.toBeNull();
  });
  it('failed server verification cannot release a prior logout barrier', async () => {
    mount(); await waitFor(() => expect(s.callback).toBeTypeOf('function'));
    await act(async () => { await api.logout(); }); event('PASSWORD_RECOVERY','A'); s.serverId='B';
    fireEvent.click(await screen.findByRole('button',{name:'Confirmar recupera\u00e7\u00e3o nesta aba'}));
    await waitFor(() => expect(api.recoveryPending).toBe(false));
    expect(sessionAdoptionAllowed()).toBe(false); expect(api.recoveryUserId).toBeNull(); expect(s.updateUser).not.toHaveBeenCalled();
  });
  it('logout during explicit verification invalidates the candidate and does not release barrier', async () => {
    mount(); await waitFor(() => expect(s.callback).toBeTypeOf('function')); event('PASSWORD_RECOVERY','A');
    const gate=deferred(); s.getUserWait=gate.promise;
    fireEvent.click(await screen.findByRole('button',{name:'Confirmar recupera\u00e7\u00e3o nesta aba'}));
    await waitFor(() => expect(s.getUser).toHaveBeenCalledTimes(1));
    await act(async () => { const pending=api.logout(); gate.resolve(success()); await pending; });
    expect(sessionAdoptionAllowed()).toBe(false); expect(api.recoveryUserId).toBeNull(); expect(s.updateUser).not.toHaveBeenCalled();
  });
  it('explicit confirmation shares the interlock and rejects concurrent attempts', async () => {
    mount(); await waitFor(() => expect(s.callback).toBeTypeOf('function')); event('PASSWORD_RECOVERY','A');
    const gate=deferred(); s.getUserWait=gate.promise;
    let first: any; act(() => { first=api.confirmRecovery(); });
    expect((await api.confirmRecovery()).error).not.toBeNull();
    await act(async () => { gate.resolve(success()); await first; }); expect(s.getUser).toHaveBeenCalledTimes(1);
  });
  it('leaving only the recovery page invalidates pending confirmation without releasing barrier', async () => {
    const view=mount(); await waitFor(() => expect(s.callback).toBeTypeOf('function'));
    await act(async () => { await api.logout(); }); event('PASSWORD_RECOVERY','A');
    const gate=deferred(); s.getUserWait=gate.promise;
    let pending: any; act(() => { pending=api.confirmRecovery(); });
    await waitFor(() => expect(s.getUser).toHaveBeenCalledTimes(1));
    view.rerender(<MemoryRouter><AuthProvider><Probe /><p>Other inert route</p></AuthProvider></MemoryRouter>);
    await act(async () => { gate.resolve(success()); await pending; });
    expect(sessionAdoptionAllowed()).toBe(false); expect(api.recoveryUserId).toBeNull();
  });
  it('QA-only expected identity rejects another recovery account', async () => {
    mount('PINNED_RECOVERY_ID'); await waitFor(() => expect(s.callback).toBeTypeOf('function')); event('PASSWORD_RECOVERY','A');
    expect(api.recoveryPending).toBe(false); expect((await api.confirmRecovery()).error).not.toBeNull();
    expect(s.getUser).not.toHaveBeenCalled(); expect(s.updateUser).not.toHaveBeenCalled();
  });
  it('REPRO: recovery completed before Provider mount is indistinguishable from ordinary stored session', async () => {
    // Model an SDK recovery event already emitted while dynamic chunks loaded.
    // No token/link is created; only nonsecret identity metadata is supplied.
    s.session={user:{id:'A',user_metadata:{}}};s.serverId='A';
    mount();await waitFor(()=>expect(api.session?.user.id).toBe('A'));
    event('INITIAL_SESSION','A');
    await waitFor(()=>expect(api.session?.user.id).toBe('A'));
    expect(api.recoveryPending).toBe(false);expect(api.recoveryUserId).toBeNull();
    expect(screen.queryByRole('button',{name:'Confirmar recupera\u00e7\u00e3o nesta aba'})).toBeNull();
    expect(screen.queryByRole('button',{name:'Atualizar senha'})).toBeNull();
    expect(s.updateUser).not.toHaveBeenCalled();
  });
  it('valid SDK recovery context checks the server identity before one update', async () => {
    const view = await recovery(mount()); await submit(view);
    await waitFor(() => expect(s.updateUser).toHaveBeenCalledTimes(1));
    expect(s.getUser).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(s.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Senha atualizada!' })));
    expect(api.recoveryUserId).toBeNull();
  });
  it('server identity B cannot update in recovery A context', async () => {
    const view = await recovery(mount()); s.serverId = 'B'; await submit(view);
    await waitFor(() => expect(s.toast).toHaveBeenCalled()); expect(s.updateUser).not.toHaveBeenCalled();
  });
  it('server rejection of expired session prevents the update', async () => {
    const view = await recovery(mount()); s.getUserWait = Promise.resolve({ data: { user: null }, error: { message: 'expired' } });
    await submit(view); await waitFor(() => expect(s.toast).toHaveBeenCalled()); expect(s.updateUser).not.toHaveBeenCalled();
  });
  it('logout while getUser waits prevents update dispatch', async () => {
    const gate = deferred(); const view = await recovery(mount()); s.getUserWait = gate.promise;
    await submit(view); await waitFor(() => expect(s.getUser).toHaveBeenCalledTimes(2));
    await act(async () => { const pending=api.logout(); gate.resolve(success()); await pending; });
    expect(s.updateUser).not.toHaveBeenCalled(); expect(api.recoveryUserId).toBeNull();
  });
  it('account replacement while getUser waits prevents update dispatch', async () => {
    const gate = deferred(); const view = await recovery(mount()); s.getUserWait = gate.promise;
    await submit(view); await waitFor(() => expect(s.getUser).toHaveBeenCalledTimes(2)); event('SIGNED_IN', 'B');
    await act(async () => { gate.resolve(success()); }); expect(s.updateUser).not.toHaveBeenCalled();
  });
  it('logout after dispatch suppresses stale success, without claiming server cancellation', async () => {
    const gate = deferred(); const view = await recovery(mount()); s.updateWait = gate.promise;
    await submit(view); await waitFor(() => expect(s.updateUser).toHaveBeenCalledTimes(1));
    await act(async () => { const pending=api.logout(); gate.resolve(success()); await pending; });
    expect(s.toast.mock.calls.some(([value]) => value.title === 'Senha atualizada!')).toBe(false);
    expect(api.recoveryUserId).toBeNull();
  });
  it('SDK update error does not produce success or automatic retry', async () => {
    const view = await recovery(mount()); s.updateWait = Promise.resolve({ data: { user: null }, error: { message: 'synthetic failure' } });
    await submit(view); await waitFor(() => expect(s.toast).toHaveBeenCalled());
    expect(s.updateUser).toHaveBeenCalledTimes(1);
    expect(s.toast.mock.calls.some(([value]) => value.title === 'Senha atualizada!')).toBe(false);
  });
  it('unmount during update prevents navigation and success notification', async () => {
    const gate = deferred(); const view = await recovery(mount()); s.updateWait = gate.promise;
    await submit(view); await waitFor(() => expect(s.updateUser).toHaveBeenCalled()); view.unmount();
    await act(async () => { gate.resolve(success()); }); expect(s.toast).not.toHaveBeenCalled();
  });
});
