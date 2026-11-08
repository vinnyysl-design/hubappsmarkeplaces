// Complete AuthProvider + real Supabase SDK. Only environment/client injection,
// synthetic fingerprint input, HTTP and storage ports are replaced.
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createAuthOperationInterlock } from '@/lib/auth-operation-interlock';

const state = vi.hoisted(() => ({ sdk: null as any, fingerprints: 0 }));
vi.mock('@/integrations/supabase/client', () => ({ get supabase() { return state.sdk; } }));
vi.mock('@/lib/fingerprint', () => ({ getDeviceFingerprint: async () => { state.fingerprints++; return 'synthetic-fingerprint'; } }));
let AuthProvider: any, useAuth: any;
const origin = 'https://mdqlgwnggbkgmplgkebd.supabase.co'; // Every request still uses the in-memory transport.
const ids = { A: '11111111-1111-4111-8111-111111111111', B: '22222222-2222-4222-8222-222222222222', NEW: '33333333-3333-4333-8333-333333333333' };
type Label = keyof typeof ids;
const user = (label: Label) => ({ id: ids[label], aud: 'authenticated', role: 'authenticated', email: `${label}@synthetic.invalid`, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' });
const jwt = (label: Label) => `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: ids[label], exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated' }))}.synthetic`;
const session = (label: Label) => ({ access_token: jwt(label), refresh_token: `synthetic-refresh-${label}`, expires_in: 3600, token_type: 'bearer', user: user(label) });
const deferred = () => { let resolve!: (value?: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { promise, resolve }; };
let loginGates: Map<string, ReturnType<typeof deferred>>, profileGates: Map<string, ReturnType<typeof deferred>>;
let calls: { path: string; uid: string | null; body: any }[], events: string[], sdkStorage: Map<string, string>;
let missingProfile: boolean, noSignupSession: boolean, logoutFails: boolean, testSequence = 0;
let clients: any[], subscriptions: any[], api: Record<string, any>;
const flush = async () => { await act(async () => { await new Promise(r => setTimeout(r, 20)); }); };
const uidFromToken = (authorization: string | null) => {
  if (!authorization?.startsWith('Bearer ')) return null;
  try { return JSON.parse(atob(authorization.slice(7).split('.')[1])).sub; } catch { return null; }
};
async function transport(input: any, init: RequestInit = {}) {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.origin !== origin) throw new Error('EXTERNAL_NETWORK_FORBIDDEN');
  const headers = new Headers(init.headers);
  const uid = uidFromToken(headers.get('authorization'));
  const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
  calls.push({ path: url.pathname, uid, body });
  if (url.pathname === '/auth/v1/token') {
    expect(url.searchParams.get('grant_type')).toBe('password');
    await loginGates.get(body.email)?.promise;
    const label = body.email.split('@')[0] as Label;
    return Response.json(session(label));
  }
  if (url.pathname === '/auth/v1/logout') return logoutFails
    ? Response.json({ message: 'synthetic logout failure' }, { status: 500 })
    : new Response(null, { status: 204 });
  if (url.pathname === '/auth/v1/user') return Response.json(user((Object.keys(ids) as Label[]).find(k => ids[k] === uid)!));
  if (url.pathname === '/auth/v1/signup') return Response.json(noSignupSession ? { user: user('NEW') } : session('NEW'));
  if (url.pathname === '/rest/v1/rpc/validate_signup_email') return Response.json({ ok: true, normalized: body._email });
  if (url.pathname === '/rest/v1/rpc/is_phone_available') return Response.json(true);
  if (url.pathname === '/rest/v1/rpc/enforce_trial_status') {
    expect(body._user_id).toBe(uid);
    await profileGates.get(uid!)?.promise;
    return Response.json([{ status: 'ativo', trial_ends_at: null }]);
  }
  if (url.pathname === '/rest/v1/profiles') {
    expect(url.searchParams.get('id')).toBe(`eq.${uid}`);
    return Response.json(missingProfile ? null : { id: uid, status: 'ativo', plan: 'trial', phone_verified: false, administrative_blocked:false, financial_blocked:false });
  }
  if (url.pathname === '/rest/v1/user_roles') return Response.json([{ role: uid === ids.A ? 'admin' : 'user' }]);
  if (url.pathname === '/functions/v1/validate-user') return Response.json({ valid: true, user: { id: uid } });
  if (url.pathname === '/rest/v1/signup_fingerprints') return new Response(null, { status: 201 });
  throw new Error(`UNEXPECTED_MOCK_PATH: ${url.pathname}`);
}
function newSdk(storage = sdkStorage, key = `qa-auth-${testSequence}`) {
  const sdk = createClient(origin, 'synthetic-publishable-key', {
    global: { fetch: transport },
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: true, storageKey: key,
      storage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => { storage.set(k, v); }, removeItem: k => { storage.delete(k); } },
    },
  });
  clients.push(sdk);
  subscriptions.push(sdk.auth.onAuthStateChange((event: string) => { events.push(event); }).data.subscription);
  return sdk;
}
function Probe({ name = 'one' }) {
  const auth = useAuth(); api[name] = auth;
  return <output data-testid={name}>{JSON.stringify({ id: auth.user?.id ?? null, status: auth.status, role: auth.role, access: auth.accessState, authenticated: auth.isAuthenticated })}</output>;
}
const view = (name = 'one') => JSON.parse(screen.getByTestId(name).textContent!);
async function mount(two = false) {
  render(<><AuthProvider><Probe /></AuthProvider>{two && <AuthProvider><Probe name="two" /></AuthProvider>}</>);
  await waitFor(() => expect(view().access).toBe('anonymous'));
  await flush();
}
async function login(label: Label, name = 'one') {
  let result: any;
  await act(async () => { result = await api[name].login(`${label}@synthetic.invalid`, 'synthetic-only'); });
  expect(result.error).toBeNull();
  await waitFor(() => expect(view(name).access).toBe('ready'));
}
beforeAll(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', origin);
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_offline_validation_value');
  vi.stubEnv('VITE_DEPLOYMENT_STAGE','staging');
  vi.stubEnv('VITE_APPROVED_PROJECT_REF','mdqlgwnggbkgmplgkebd');
  vi.stubEnv('VITE_SUPABASE_PROJECT_ID','mdqlgwnggbkgmplgkebd');
  ({ AuthProvider, useAuth } = await import('../contexts/AuthContext'));
});
beforeEach(() => {
  localStorage.clear();
  loginGates = new Map(); profileGates = new Map(); calls = []; events = []; sdkStorage = new Map();
  missingProfile = false; noSignupSession = false; logoutFails = false; testSequence++;
  clients = []; subscriptions = []; api = {}; state.fingerprints = 0;
  // No real WebSocket may be constructed. SDK initialization only needs its type.
  vi.stubGlobal('WebSocket', class { constructor() { throw new Error('WEBSOCKET_FORBIDDEN'); } });
  vi.stubGlobal('BroadcastChannel', undefined); // Tab propagation is explicitly simulated, never assumed.
  vi.stubGlobal('fetch', vi.fn(transport));
  state.sdk = newSdk();
});
afterEach(async () => {
  for (const gate of [...loginGates.values(), ...profileGates.values()]) gate.resolve();
  await flush(); cleanup();
  for (const sub of subscriptions) sub.unsubscribe();
  for (const sdk of clients) sdk.auth.stopAutoRefresh();
  vi.unstubAllGlobals();
});

describe('complete AuthProvider with real SDK 2.106.0 and memory HTTP/storage', () => {
  it('rejects concurrent login before HTTP; allows retry after the first settles', async () => {
    await mount(); const gate = deferred(); loginGates.set('A@synthetic.invalid', gate);
    let first: any, busy: any;
    act(() => { first = api.one.login('A@synthetic.invalid', 'synthetic-only'); busy = api.one.login('B@synthetic.invalid', 'synthetic-only'); });
    expect((await busy).error).not.toBeNull();
    await waitFor(() => expect(calls.filter(c => c.path === '/auth/v1/token')).toHaveLength(1));
    await act(async () => { gate.resolve(); expect((await first).error).toBeNull(); });
    await waitFor(() => expect(view().id).toBe(ids.A)); await login('B');
    expect((await state.sdk.auth.getSession()).data.session.user.id).toBe(ids.B);
    expect(events).toContain('SIGNED_IN');
  });
  it('blocks local adoption immediately and queues real SDK signOut behind pending login', async () => {
    await mount(); const gate = deferred(); loginGates.set('A@synthetic.invalid', gate);
    let first: any, exit: any;
    act(() => { first = api.one.login('A@synthetic.invalid', 'synthetic-only'); });
    await waitFor(() => expect(calls.some(c => c.path === '/auth/v1/token')).toBe(true));
    act(() => { exit = api.one.logout(); });
    expect(view().authenticated).toBe(false); expect(view().access).toBe('anonymous');
    expect(calls.some(c => c.path === '/auth/v1/logout')).toBe(false);
    await act(async () => { gate.resolve(); expect((await first).error).not.toBeNull(); expect((await exit).confirmed).toBe(true); });
    await flush(); expect(view().id).toBeNull();
    expect((await state.sdk.auth.getSession()).data.session).toBeNull(); expect(sdkStorage.size).toBe(0);
    expect(events).toContain('SIGNED_IN'); expect(events).toContain('SIGNED_OUT');
  });
  it('does not apply profile responses or start dependent lookups after logout', async () => {
    await mount(); const gate = deferred(); profileGates.set(ids.A, gate);
    await act(async () => { expect((await api.one.login('A@synthetic.invalid', 'synthetic-only')).error).toBeNull(); });
    await waitFor(() => expect(calls.some(c => c.path.endsWith('/enforce_trial_status'))).toBe(true));
    await act(async () => { expect((await api.one.logout()).confirmed).toBe(true); });
    await act(async () => { gate.resolve(); }); await flush();
    expect(view()).toMatchObject({ id: null, status: null, role: null, access: 'anonymous' });
    expect(calls.some(c => c.path === '/rest/v1/profiles')).toBe(false);
  });
  it('retains identity but fails closed when the real PostgREST client gets no profile', async () => {
    await mount(); missingProfile = true;
    await act(async () => { expect((await api.one.login('A@synthetic.invalid', 'synthetic-only')).error).toBeNull(); });
    await waitFor(() => expect(view().access).toBe('unavailable'));
    expect(view()).toMatchObject({ id: ids.A, status: null, role: null });
  });
  it('ignores late A profile responses after the SDK and provider move to B', async () => {
    await mount(); const gate = deferred(); profileGates.set(ids.A, gate);
    await act(async () => { await api.one.login('A@synthetic.invalid', 'synthetic-only'); });
    await waitFor(() => expect(calls.some(c => c.uid === ids.A && c.path.endsWith('/enforce_trial_status'))).toBe(true));
    await login('B'); await act(async () => { gate.resolve(); }); await flush();
    expect(view()).toMatchObject({ id: ids.B, role: 'user', access: 'ready' });
    expect(calls.filter(c => c.uid === ids.A && c.path === '/rest/v1/profiles')).toHaveLength(0);
  });
  it('reconciles a deliberately replayed stale SDK event with current B storage', async () => {
    await mount(); await login('A'); await login('B');
    // Controlled event replay uses the SDK notifier, not a replacement Auth API.
    await act(async () => { await (state.sdk.auth as any)._notifyAllSubscribers('SIGNED_IN', session('A'), false); });
    await waitFor(() => expect(view().access).toBe('ready'));
    expect(view().id).toBe(ids.B);
    expect((await state.sdk.auth.getSession()).data.session.user.id).toBe(ids.B);
  });
  it('signup without a session does not write a fingerprint or borrow another identity', async () => {
    await mount(); noSignupSession = true;
    let result: any;
    await act(async () => { result = await api.one.signup('NEW@synthetic.invalid', 'synthetic-only', 'Synthetic'); });
    expect(result.error).toBeNull(); expect(view().id).toBeNull();
    expect((await state.sdk.auth.getSession()).data.session).toBeNull();
    expect(state.fingerprints).toBe(0); expect(calls.some(c => c.path === '/rest/v1/signup_fingerprints')).toBe(false);
    // This verifies omission of an unsafe write, not antifraud completeness.
  });
  it('shares the singleflight slot between two mounted providers in one JS realm', async () => {
    await mount(true); const gate = deferred(); loginGates.set('A@synthetic.invalid', gate);
    let first: any, second: any;
    act(() => { first = api.one.login('A@synthetic.invalid', 'synthetic-only'); second = api.two.login('B@synthetic.invalid', 'synthetic-only'); });
    expect((await second).error).not.toBeNull();
    await act(async () => { gate.resolve(); await first; });
    await waitFor(() => expect(view('two').id).toBe(ids.A));
    expect(calls.filter(c => c.path === '/auth/v1/token')).toHaveLength(1);
  });
  it('does not attach a sessionless signup fingerprint to the existing B identity', async () => {
    await mount(); await login('B'); noSignupSession = true;
    let result: any;
    await act(async () => { result = await api.one.signup('NEW@synthetic.invalid', 'synthetic-only', 'Synthetic'); });
    expect(result.error).toBeNull(); expect(view().id).toBe(ids.B);
    expect((await state.sdk.auth.getSession()).data.session.user.id).toBe(ids.B);
    expect(state.fingerprints).toBe(0);
    expect(calls.some(c => c.path === '/rest/v1/signup_fingerprints')).toBe(false);
  });
  it('documents another mounted provider retaining its UI until the queued SDK event', async () => {
    await mount(true); await login('A');
    await waitFor(() => expect(view('two').access).toBe('ready'));
    const gate = deferred(); loginGates.set('B@synthetic.invalid', gate);
    let pending: any, exit: any;
    act(() => { pending = api.one.login('B@synthetic.invalid', 'synthetic-only'); });
    await waitFor(() => expect(calls.filter(c => c.path === '/auth/v1/token')).toHaveLength(2));
    act(() => { exit = api.two.logout(); });
    expect(view('two').authenticated).toBe(false);
    // Scope finding: per-Provider UI state is not synchronously broadcast.
    expect(view('one')).toMatchObject({ id: ids.A, role: 'admin', authenticated: true });
    const helpers = await import('../services/auth');
    expect(helpers.getToken()).toBeNull();
    expect(helpers.sessionAdoptionAllowed()).toBe(false);
    await act(async () => { gate.resolve(); expect((await pending).error).not.toBeNull(); await exit; });
    await waitFor(() => expect(view('one').authenticated).toBe(false));
  });
  it('keeps the local logout barrier when the mocked Auth server fails signOut', async () => {
    await mount(); await login('A'); logoutFails = true;
    let result: any;
    await act(async () => { result = await api.one.logout(); });
    expect(result).toEqual({ confirmed: false, error: 'logout_not_confirmed' });
    expect(view()).toMatchObject({ id: null, status: null, role: null, access: 'anonymous' });
    expect(localStorage.getItem('analyticalx.logout-pending')).toBe('1');
    // The SDK may retain A after a failed remote logout; replay cannot restore UI.
    await act(async () => { await (state.sdk.auth as any)._notifyAllSubscribers('SIGNED_IN', session('A'), false); });
    await flush(); expect(view().authenticated).toBe(false);
  });
  it('demonstrates separate realm locks do not serialize two SDK clients sharing storage', async () => {
    const shared = new Map<string, string>(); const tabA = newSdk(shared, 'qa-shared-tabs'); const tabB = newSdk(shared, 'qa-shared-tabs');
    await tabA.auth.getSession(); await tabB.auth.getSession();
    const gateA = deferred(), gateB = deferred(); loginGates.set('A@synthetic.invalid', gateA); loginGates.set('B@synthetic.invalid', gateB);
    // Independent instances of the actual interlock model separate JS realms.
    const lockA = createAuthOperationInterlock(), lockB = createAuthOperationInterlock();
    const a = lockA.tryRun<any>(() => tabA.auth.signInWithPassword({ email: 'A@synthetic.invalid', password: 'synthetic-only' }), () => ({ busy: true }));
    const b = lockB.tryRun<any>(() => tabB.auth.signInWithPassword({ email: 'B@synthetic.invalid', password: 'synthetic-only' }), () => ({ busy: true }));
    await waitFor(() => expect(calls.filter(c => c.path === '/auth/v1/token')).toHaveLength(2));
    gateB.resolve(); await b; gateA.resolve(); await a;
    expect((await tabB.auth.getSession()).data.session?.user.id).toBe(ids.A);
    // Last HTTP completion wins shared storage; no cross-tab guarantee is made.
  });
});
