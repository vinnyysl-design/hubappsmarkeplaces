import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ close: vi.fn(), signOut: vi.fn(async () => ({ error: null })) }));
vi.mock("@/lib/qa-tool-shutdown", () => ({ closeQaTools: mocks.close }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: mocks.signOut } } }));
vi.mock("@/lib/auth-operation-interlock", () => ({ authOperations: { queue: (f: any) => f() } }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); localStorage.clear(); vi.stubEnv("VITE_DEPLOYMENT_STAGE", "staging"); });
afterEach(() => vi.unstubAllEnvs());
it("actual auth helper blocks adoption then waits for QA revoke before signOut", async () => {
  let finish!: (ok: boolean) => void; mocks.close.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const auth = await import("../services/auth"); const pending = auth.logout({ redirect: false });
  expect(auth.sessionAdoptionAllowed()).toBe(false); expect(mocks.signOut).not.toHaveBeenCalled();
  finish(true); await pending; expect(mocks.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
});
it("actual auth helper still logs out when QA revoke fails", async () => {
  mocks.close.mockRejectedValue(new Error("synthetic"));
  const auth = await import("../services/auth"); const result = await auth.logout({ redirect: false });
  expect(mocks.signOut).toHaveBeenCalledOnce(); expect(result.confirmed).toBe(true); expect(result.qaRevocationConfirmed).toBe(false);
});
