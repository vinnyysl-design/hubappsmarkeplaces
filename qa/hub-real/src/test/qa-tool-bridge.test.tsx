import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import QaToolAccess from "@/components/QaToolAccess";
import { BROWSER_PROTOCOL, QA_APPS, QA_GATE, QA_HUB, QA_OWNER, createHubBridge, qaAllowed, qaUserRequest } from "@/lib/qa-tool-bridge";
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: QA_OWNER }, session: null, accessState: "ready" }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const nonce = "n".repeat(43), challenge = "h".repeat(43), code = "c".repeat(43);
function setup(app: "adsengine" | "vision-x" = "adsengine") {
  const peer = {} as Window, authorize = vi.fn().mockResolvedValue({ code }), post = vi.fn(), failed = vi.fn();
  let active = true;
  const bridge = createHubBridge({ app, peer, active: () => active, authorize, post, failed });
  const event = (data: object = {}) => ({ source: peer, origin: QA_APPS[app].origin, data: { protocol: BROWSER_PROTOCOL, type: "tool:ready", app, nonce, challenge, ...data } }) as MessageEvent;
  return { peer, authorize, post, failed, bridge, event, deactivate: () => { active = false; } };
}
it("ships closed and renders no iframe or network calls", () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect(QA_GATE.enabled).toBe(false);
  const view = render(<QaToolAccess app="adsengine" />);
  expect(screen.getByRole("button", { name: "Abrir ferramenta QA" })).toBeDisabled();
  expect(view.container.querySelector("iframe")).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
});
it("requires exact owner, origin and bounded window", () => {
  const gate = { enabled: true, ownerId: QA_OWNER, windowStart: 1000, windowEnd: 101000 };
  expect(qaAllowed(gate, QA_HUB, QA_OWNER, 1001)).toBe(true);
  expect(qaAllowed(gate, QA_HUB + ".evil", QA_OWNER, 1001)).toBe(false);
  expect(qaAllowed(gate, QA_HUB, "other", 1001)).toBe(false);
  expect(qaAllowed(gate, QA_HUB, QA_OWNER, 40000)).toBe(false);
});
it.each(["adsengine", "vision-x"] as const)("bridges %s once with code only", async app => {
  const s = setup(app); expect(await s.bridge.receive(s.event())).toBe(true);
  expect(s.authorize).toHaveBeenCalledWith({ app, audience: QA_APPS[app].origin, nonce, challenge });
  expect(s.post).toHaveBeenCalledWith({ protocol: BROWSER_PROTOCOL, type: "hub:code", app, nonce, code }, QA_APPS[app].origin);
  expect(await s.bridge.receive(s.event())).toBe(false); expect(s.authorize).toHaveBeenCalledTimes(1);
  s.bridge.close(); expect(s.post).toHaveBeenLastCalledWith({ protocol: BROWSER_PROTOCOL, type: "hub:logout", app, nonce }, QA_APPS[app].origin);
});
it("rejects wrong source/origin/app/extra keys without consuming valid handshake", async () => {
  const s = setup();
  for (const event of [{ ...s.event(), source: {} }, { ...s.event(), origin: "https://evil.invalid" }, s.event({ app: "vision-x" }), s.event({ extra: "token" }), s.event({ nonce: "short" })]) expect(await s.bridge.receive(event as MessageEvent)).toBe(false);
  expect(s.authorize).not.toHaveBeenCalled(); expect(await s.bridge.receive(s.event())).toBe(true);
});
it("drops completion after close or lost session and never retries", async () => {
  const s = setup(); let resolve!: (v: unknown) => void;
  s.authorize.mockImplementation(() => new Promise(r => { resolve = r; }));
  const result = s.bridge.receive(s.event()); s.deactivate(); resolve({ code });
  expect(await result).toBe(false); expect(s.post).not.toHaveBeenCalled(); expect(await s.bridge.receive(s.event())).toBe(false);
});
it("rejects malformed response without leaking payload", async () => {
  const s = setup(); s.authorize.mockResolvedValue({ code, token: "private" });
  expect(await s.bridge.receive(s.event())).toBe(false); expect(s.post).not.toHaveBeenCalled(); expect(s.failed).toHaveBeenCalledOnce();
});
it("routes bearer only to fixed QA backend, without automatic retry", async () => {
  const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code }), { headers: { "content-type": "application/json" } })); vi.stubGlobal("fetch", send);
  await qaUserRequest("vision-x", "authorize", {}, "synthetic-only", new AbortController().signal);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0]).toBe("https://mdqlgwnggbkgmplgkebd.supabase.co/functions/v1/qa-tool-sso-v3-vision-user/authorize");
  expect(send.mock.calls[0][1]).toMatchObject({ credentials: "omit", redirect: "error", cache: "no-store" });
});
