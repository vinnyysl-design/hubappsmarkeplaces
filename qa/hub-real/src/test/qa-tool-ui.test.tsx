import { createQaShutdown } from "@/lib/qa-tool-shutdown";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import QaToolAccess from "@/components/QaToolAccess";
import { BROWSER_PROTOCOL, QA_APPS, QA_HUB, QA_OWNER } from "@/lib/qa-tool-bridge";
const state = vi.hoisted(() => ({ auth: {} as any, shutdown: null as any, peers: [] as any[], open: null as any }));
vi.mock("@/lib/qa-tool-shutdown", async original => {
  const actual = await original<typeof import("@/lib/qa-tool-shutdown")>();
  return { ...actual, qaShutdown: {
    terminal: () => state.shutdown.terminal(), terminalize: () => state.shutdown.terminalize(),
    closeAll: () => state.shutdown.closeAll(), register: (fn: any) => state.shutdown.register(fn), track: (p: any) => state.shutdown.track(p),
  } };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/lib/qa-tool-bridge", async original => {
  const actual = await original<typeof import("@/lib/qa-tool-bridge")>();
  return { ...actual, QA_GATE: { enabled: true, ownerId: actual.QA_OWNER, windowStart: Date.now() - 1000, windowEnd: Date.now() + 300000 } };
});
beforeEach(() => {
  state.shutdown = createQaShutdown(); state.peers=[];
  state.open=vi.spyOn(window,"open").mockImplementation(()=>{ const peer={closed:false,postMessage:vi.fn(),close:vi.fn(function(this:any){this.closed=true;})};state.peers.push(peer);return peer as any; });
  state.auth = { user: { id: QA_OWNER }, session: { access_token: "synthetic-qa-bearer", expires_at: Math.floor(Date.now() / 1000) + 600 }, accessState: "ready", status: "ativo", administrativeBlocked: false, financialBlocked: false };
  vi.stubGlobal("location", { origin: QA_HUB });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("real component opens exact preview on click, issues once and revokes on close", async () => {
  const send = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.endsWith("/revoke") ? { revocationVerified: true } : { code: "c".repeat(43) }), { headers: { "content-type": "application/json" } })));
  vi.stubGlobal("fetch", send);
  const view = render(<QaToolAccess app="adsengine" />);
  expect(send).not.toHaveBeenCalled(); fireEvent.click(screen.getByText("Abrir ferramenta QA"));
  const peer=state.peers[0]; expect(state.open).toHaveBeenCalledWith(QA_APPS.adsengine.origin+"/","_blank");
  const post=peer.postMessage;
  fireEvent(window, new MessageEvent("message", { origin: QA_APPS.adsengine.origin, source: peer, data: { protocol: BROWSER_PROTOCOL, type: "tool:ready", app: "adsengine", nonce: "n".repeat(43), challenge: "h".repeat(43) } }));
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
  const peer=state.peers[0];
  fireEvent(window, new MessageEvent("message", { origin: QA_APPS.adsengine.origin, source: peer, data: { protocol: BROWSER_PROTOCOL, type: "tool:ready", app: "adsengine", nonce: "n".repeat(43), challenge: "h".repeat(43) } }));
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByText("Encerrar acesso QA"));
  expect(screen.getByText("Abrir ferramenta QA")).toBeDisabled(); fireEvent.click(screen.getByText("Abrir ferramenta QA"));
  expect(view.container.querySelector("iframe")).toBeNull(); expect(send).toHaveBeenCalledTimes(2);
  release(new Response(JSON.stringify({ revocationVerified: true }), { headers: { "content-type": "application/json" } }));
  await waitFor(() => expect(screen.getByText("Abrir ferramenta QA")).toBeDisabled());
});

it("keeps both tool frames together and closes both before final logout", async () => {
  const send = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.endsWith("/revoke") ? { revocationVerified: true } : { code: "c".repeat(43) }), { headers: { "content-type": "application/json" } })));
  vi.stubGlobal("fetch", send);
  const view = render(<><QaToolAccess app="adsengine"/><QaToolAccess app="vision-x"/></>);
  for(const button of screen.getAllByText("Abrir ferramenta QA")) fireEvent.click(button);
  const frames=state.peers; expect(frames).toHaveLength(2);
  const posts=frames.map(f=>f.postMessage);
  const apps = ["adsengine", "vision-x"] as const;
  for(let i=0;i<2;i++)fireEvent(window,new MessageEvent("message",{source:frames[i],origin:QA_APPS[apps[i]].origin,data:{protocol:BROWSER_PROTOCOL,type:"tool:ready",app:apps[i],nonce:(i?"v":"a").repeat(43),challenge:"h".repeat(43)}}));
  await waitFor(()=>expect(posts[1]).toHaveBeenCalled()); expect(send).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getAllByText("Encerrar acesso QA")[0]);
  await waitFor(()=>expect(view.container.querySelectorAll("iframe")).toHaveLength(0));
  expect(send).toHaveBeenCalledTimes(4);
  for(const post of posts)expect(post.mock.calls.some(call=>(call[0] as {type:string}).type==="hub:logout")).toBe(true);
  for(const button of screen.getAllByText("Abrir ferramenta QA"))expect(button).toBeDisabled();
});

it("blocked popup fails closed without issuing code and cannot retry",()=>{state.open.mockReturnValue(null);const send=vi.fn();vi.stubGlobal("fetch",send);render(<QaToolAccess app="adsengine"/>);fireEvent.click(screen.getByText("Abrir ferramenta QA"));expect(screen.getByRole("status").textContent).toContain("Popup bloqueado");expect(screen.getByText("Abrir ferramenta QA")).toBeDisabled();expect(send).not.toHaveBeenCalled();});
it("manual popup closure terminalizes and closes its peer",async()=>{render(<><QaToolAccess app="adsengine"/><QaToolAccess app="vision-x"/></>);for(const b of screen.getAllByText("Abrir ferramenta QA"))fireEvent.click(b);state.peers[0].closed=true;await waitFor(()=>expect(state.peers[1].close).toHaveBeenCalled());for(const b of screen.getAllByText("Abrir ferramenta QA"))expect(b).toBeDisabled();});
it("unmount closes popup without leaving a live browser peer",()=>{const view=render(<QaToolAccess app="adsengine"/>);fireEvent.click(screen.getByText("Abrir ferramenta QA"));view.unmount();expect(state.peers[0].close).toHaveBeenCalled();expect(state.shutdown.terminal()).toBe(true);});

it("authorization failure terminalizes and closes popup with bounded revoke",async()=>{const send=vi.fn().mockImplementation((url:string)=>Promise.resolve(new Response(JSON.stringify(url.endsWith("/revoke")?{revocationVerified:true}:{error:"denied"}),{status:url.endsWith("/revoke")?200:403,headers:{"content-type":"application/json"}})));vi.stubGlobal("fetch",send);render(<QaToolAccess app="adsengine"/>);fireEvent.click(screen.getByText("Abrir ferramenta QA"));const peer=state.peers[0];fireEvent(window,new MessageEvent("message",{origin:QA_APPS.adsengine.origin,source:peer,data:{protocol:BROWSER_PROTOCOL,type:"tool:ready",app:"adsengine",nonce:"n".repeat(43),challenge:"h".repeat(43)}}));await waitFor(()=>expect(peer.close).toHaveBeenCalled());expect(screen.getByText("Abrir ferramenta QA")).toBeDisabled();expect(send).toHaveBeenCalledTimes(2);});

it("bound tool closed terminates both and discards late authorize",async()=>{let release:any;const send=vi.fn().mockImplementation((url:string)=>url.endsWith("/revoke")?Promise.resolve(new Response(JSON.stringify({revocationVerified:true}),{headers:{"content-type":"application/json"}})):new Promise(resolve=>{release=resolve}));vi.stubGlobal("fetch",send);render(<><QaToolAccess app="adsengine"/><QaToolAccess app="vision-x"/></>);for(const b of screen.getAllByText("Abrir ferramenta QA"))fireEvent.click(b);const peer=state.peers[0];const emit=(data:any,source=peer,origin=QA_APPS.adsengine.origin)=>fireEvent(window,new MessageEvent("message",{source,origin,data}));const terminal={protocol:BROWSER_PROTOCOL,type:"tool:closed",app:"adsengine",nonce:"n".repeat(43)};emit(terminal);expect(peer.close).not.toHaveBeenCalled();emit({protocol:BROWSER_PROTOCOL,type:"tool:ready",app:"adsengine",nonce:"n".repeat(43),challenge:"h".repeat(43)});await waitFor(()=>expect(send).toHaveBeenCalledTimes(1));emit({...terminal,nonce:"x".repeat(43)});emit({...terminal,extra:true});emit(terminal,state.peers[1]);emit(terminal,peer,QA_APPS["vision-x"].origin);expect(peer.close).not.toHaveBeenCalled();emit(terminal);await waitFor(()=>expect(state.peers[1].close).toHaveBeenCalled());emit(terminal);release(new Response(JSON.stringify({code:"c".repeat(43)}),{headers:{"content-type":"application/json"}}));await new Promise(r=>setTimeout(r,10));expect(peer.postMessage.mock.calls.some((c:any)=>c[0].type==="hub:code")).toBe(false);expect(send).toHaveBeenCalledTimes(2);});
