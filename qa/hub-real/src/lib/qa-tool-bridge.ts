export const QA_HUB = "https://deploy-preview-1--analyticalxhub.netlify.app";
export const QA_BACKEND = "https://mdqlgwnggbkgmplgkebd.supabase.co";
export const QA_OWNER = "3f65242c-b030-4505-aa01-344676f50991";
export const BROWSER_PROTOCOL = "analyticalx.tool-sso.v1";
export const QA_APPS = Object.freeze({
  adsengine: { origin: "https://deploy-preview-1--adsenginee.netlify.app", route: "ads" },
  "vision-x": { origin: "https://deploy-preview-1--visionxagent.netlify.app", route: "vision" },
});
export type QaApp = keyof typeof QA_APPS;
export type QaGate = { enabled: boolean; ownerId: string | null; windowStart: number; windowEnd: number };
// Explicitly closed. Activation requires separate approval and verified server configuration.
export const QA_GATE: Readonly<QaGate> = Object.freeze({ enabled: false, ownerId: null, windowStart: 0, windowEnd: 0 });
export function qaAllowed(gate: QaGate, origin: string, userId: string | undefined, now = Date.now()) {
  return gate.enabled === true && gate.ownerId === QA_OWNER && userId === QA_OWNER && origin === QA_HUB &&
    Number.isSafeInteger(gate.windowStart) && Number.isSafeInteger(gate.windowEnd) &&
    gate.windowEnd > gate.windowStart && gate.windowEnd - gate.windowStart <= 7200000 &&
    now >= gate.windowStart && now < gate.windowEnd - 65000;
}
const opaque = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{43}$/.test(v);
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).sort().join() === [...keys].sort().join();
export function createHubBridge({ app, peer, active, authorize, post, failed }: {
  app: QaApp; peer: Window; active: () => boolean;
  authorize: (body: { app: QaApp; audience: string; nonce: string; challenge: string }) => Promise<unknown>;
  post: (message: object, origin: string) => void; failed: () => void;
}) {
  let used = false, closed = false, nonce: string | null = null;
  return {
    async receive(event: MessageEvent) {
      if (closed || used || !active() || event.source !== peer || event.origin !== QA_APPS[app].origin) return false;
      const data: unknown = event.data;
      if (!exact(data, ["protocol", "type", "app", "nonce", "challenge"]) || data.protocol !== BROWSER_PROTOCOL || data.type !== "tool:ready" || data.app !== app || !opaque(data.nonce) || !opaque(data.challenge)) return false;
      used = true; nonce = data.nonce;
      try {
        const result = await authorize({ app, audience: QA_APPS[app].origin, nonce: data.nonce, challenge: data.challenge });
        if (closed || !active()) return false;
        if (!exact(result, ["code"]) || !opaque(result.code)) throw new Error("UNAVAILABLE");
        post({ protocol: BROWSER_PROTOCOL, type: "hub:code", app, nonce, code: result.code }, QA_APPS[app].origin);
        return true;
      } catch { if (!closed) failed(); return false; }
    },
    close() {
      if (closed) return; closed = true;
      try { if (nonce) post({ protocol: BROWSER_PROTOCOL, type: "hub:logout", app, nonce }, QA_APPS[app].origin); } catch { /* Peer may already be gone; server revocation must still run. */ }
      nonce = null;
    },
  };
}
export async function qaUserRequest(app: QaApp, operation: "authorize" | "revoke", body: object, bearer: string, signal: AbortSignal, timeoutMs = 15000) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const timer = setTimeout(abort, timeoutMs);
  try {
    if (controller.signal.aborted) throw new Error("UNAVAILABLE");
    const response = await fetch(`${QA_BACKEND}/functions/v1/qa-tool-sso-v3-${QA_APPS[app].route}-user/${operation}`, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` },
      body: JSON.stringify(body), credentials: "omit", redirect: "error", cache: "no-store", signal: controller.signal,
    });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("application/json")) throw new Error("UNAVAILABLE");
    const text = await response.text();
    if (text.length > 4096 || controller.signal.aborted) throw new Error("UNAVAILABLE");
    return JSON.parse(text) as unknown;
  } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
}
