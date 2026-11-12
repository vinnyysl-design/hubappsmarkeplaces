import { afterEach, expect, it, vi } from "vitest";
import { createQaShutdown } from "@/lib/qa-tool-shutdown";
afterEach(() => vi.useRealTimers());
it("closes synchronously, waits for revocation and remains terminal", async () => {
  const manager = createQaShutdown(); let release!: (ok: boolean) => void;
  const stop = vi.fn(() => new Promise<boolean>(resolve => { release = resolve; }));
  manager.register(stop); const closing = manager.closeAll();
  expect(stop).toHaveBeenCalledOnce(); expect(manager.terminal()).toBe(true);
  release(true); expect(await closing).toBe(true); expect(manager.terminal()).toBe(true);
});
it("waits for an unmounted component's tracked revocation", async () => {
  const manager = createQaShutdown(); let release!: (ok: boolean) => void;
  manager.track(new Promise<boolean>(resolve => { release = resolve; }));
  const close = manager.closeAll(); release(false); expect(await close).toBe(false);
});
it("bounds a stuck revocation without preventing ordinary logout", async () => {
  vi.useFakeTimers(); const manager = createQaShutdown(); const logout = vi.fn();
  manager.register(() => new Promise(() => {}));
  const ordered = manager.closeAll(10).then(result => { logout(); return result; });
  expect(logout).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(11);
  expect(await ordered).toBe(false); expect(logout).toHaveBeenCalledOnce();
});
it("treats rejected close as uncertain without throwing", async () => {
  const manager = createQaShutdown(); manager.register(() => Promise.reject(new Error("synthetic")));
  expect(await manager.closeAll()).toBe(false); expect(manager.terminal()).toBe(true);
});
