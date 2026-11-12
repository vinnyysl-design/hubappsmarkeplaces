type Stop = () => Promise<boolean>;
// A QA run is terminal after closing. Re-entry is never allowed while revocation is
// pending or after it completes; fresh explicit authentication/setup is required.
export function createQaShutdown() {
  const stops = new Set<Stop>();
  const pending = new Set<Promise<boolean>>();
  let terminal = false, uncertain = false;
  const terminalize = () => { terminal = true; };
  const track = (promise: Promise<boolean>) => {
    const safe = promise.catch(() => false).then(ok => { if (!ok) uncertain = true; return ok; });
    pending.add(safe); void safe.finally(() => pending.delete(safe)); return safe;
  };
  return {
    terminal: () => terminal,
    terminalize,
    register(stop: Stop) { stops.add(stop); return () => { stops.delete(stop); }; },
    track,
    async closeAll(timeoutMs = 10500) {
      if (!stops.size && !pending.size) return !uncertain;
      terminalize();
      for (const stop of [...stops]) { try { track(stop()); } catch { track(Promise.resolve(false)); } }
      let timer: ReturnType<typeof setTimeout>;
      try {
        return await Promise.race([
          Promise.all([...pending]).then(values => !uncertain && values.every(Boolean)),
          new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); }),
        ]);
      } finally { clearTimeout(timer!); }
    },
  };
}
export const qaShutdown = createQaShutdown();
export const closeQaTools = () => qaShutdown.closeAll();
