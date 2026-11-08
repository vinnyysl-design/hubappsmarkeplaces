import { createQaShutdown } from "@/lib/qa-tool-shutdown";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import QaToolAccess from "@/components/QaToolAccess";
import { BROWSER_PROTOCOL, QA_APPS, QA_HUB, QA_OWNER } from "@/lib/qa-tool-bridge";
const state = vi.hoisted(() => ({ auth: {} as any, shutdown: null as any }));
vi.mock("@/lib/qa-tool-shutdown", async original => {
  const actual = await original<typeof import("@/lib/qa-tool-shutdown")>();
  return { ...actual, qaShutdown: {
    terminal: () => state.shutdown.terminal(), terminalize: () => state.shutdown.terminalize(),
    register: (fn: any) => state.shutdown.register(fn), track: (p: any) => state.shutdown.track(p),
  } };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/lib/qa-tool-bridge", async original => {
  const actual = await original<typeof import("@/lib/qa-tool-bridge")>();
  return { ...actual, QA_GATE: { enabled: true, ownerId: actual.QA_OWNER, windowStart: Date.now() - 1000, windowEnd: Date.now() + 300000 } };
});
beforeEach(() => {
  state.shutdown = createQaShutdown();
  state.auth = { user: { id: QA_OWNER }, session: { access_token: "synthetic-qa-bearer", expires_at: Math.floor(Date.now() / 1000) + 600 }, accessState: "ready", status: "ativo", administrativeBlocked: false, financialBlocked: false };
  vi.stubGlobal("location", { origin: QA_HUB });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("real component opens exact preview on click, issues once and revokes on close", async () => {
  const send = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.endsWith("/revoke") ? { revocationVerified: true } : { code: "c".repeat(43) }), { headers: { "content-type": "application/json" } })));
  vi.stubGlobal("fetch", send);
  const view = render(<QaToolAccess app="adsengine" />);
  expect(send).not.toHaveBeenCalled(); fireEvent.click(screen.getByText("Abrir ferramenta QA"));
  const iframe = view.container.querySelector("iframe")!;
  expect(iframe.src).toBe(QA_APPS.adsengine.origin + "/");
  const post = vi.spyOn(iframe.contentWindow!, "postMessage").mockImplementation(() => {});
  fireEvent(window, new MessageEvent("message", { origin: QA_APPS.adsengine.origin, source: iframe.contentWindow, data: { protocol: BROWSER_PROTOCOL, type: "tool:ready", app: "adsengine", nonce: "n".repeat(43), challenge: "h".repeat(43) } }));
  await waitFor(() => expect(post).toHaveBeenCalled());
  expect(JSON.stringify(post.mock.calls)).not.toContain("synthetic-qa-bearer");
  expect(send.mock.calls[0][0]).toContain("qa-tool-sso-v3-ads-user/authorize");
  fireEvent.click(screen.getByText("Encerrar acesso QA"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("revogação confirmada"));
  expect(send).toHaveBeenCalledTimes(2); expect(view.container.querySelector("iframe")).toBeNull();
  expect(screen.getByText("Abrir ferramenta QA")).toBeDisabled();
});
it("account change removes the frame without automatically starting a new handshake", async () => {
  const send = vi.fn(); vi.stubGlobal("fetch", send);
  const view = render(<QaToolAccess app="vision-x" />); fireEvent.click(screen.getByText("Abrir ferramenta QA"));
  state.auth = { ...state.auth, user: { id: "other" }, session: null };
  view.rerender(<QaToolAccess app="vision-x" />);
  expect(view.container.querySelector("iframe")).toBeNull(); expect(send).not.toHaveBeenCalled();
});
it("blocked account cannot open the iframe even inside the QA window", () => {
  state.auth.financialBlocked = true;
  render(<QaToolAccess app="adsengine" />);
  expect(screen.getByText("Abrir ferramenta QA")).toBeDisabled();
});


it("cannot reopen while the earlier revocation is pending", async () => {
  let release!: (r: Response) => void;
  const send = vi.fn().mockImplementation((url: string) => url.endsWith("/revoke") ? new Promise(resolve => { release = resolve; }) : Promise.resolve(new Response(JSON.stringify({ code: "c".repeat(43) }), { headers: { "content-type": "application/json" } })));
  vi.stubGlobal("fetch", send);
  const view = render(<QaToolAccess app="adsengine" />); fireEvent.click(screen.getByText("Abrir ferramenta QA"));
  const peer = view.container.querySelector("iframe")!.contentWindow!; vi.spyOn(peer, "postMessage").mockImplementation(() => {});
  fireEvent(window, new MessageEvent("message", { origin: QA_APPS.adsengine.origin, source: peer, data: { protocol: BROWSER_PROTOCOL, type: "tool:ready", app: "adsengine", nonce: "n".repeat(43), challenge: "h".repeat(43) } }));
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByText("Encerrar acesso QA"));
  expect(screen.getByText("Abrir ferramenta QA")).toBeDisabled(); fireEvent.click(screen.getByText("Abrir ferramenta QA"));
  expect(view.container.querySelector("iframe")).toBeNull(); expect(send).toHaveBeenCalledTimes(2);
  release(new Response(JSON.stringify({ revocationVerified: true }), { headers: { "content-type": "application/json" } }));
  await waitFor(() => expect(screen.getByText("Abrir ferramenta QA")).toBeDisabled());
});
