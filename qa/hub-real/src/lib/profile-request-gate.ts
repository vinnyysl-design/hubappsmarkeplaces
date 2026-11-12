// Client race protection only. Server authorization and RLS remain mandatory.
export function createProfileRequestGate() {
  let generation = 0;
  return {
    next() { return ++generation; },
    invalidate() { ++generation; },
    current(ticket: number) { return ticket === generation; },
    async run<T>(ticket: number, load: () => Promise<T>, commit: (data: T) => void, fail: () => void) {
      if (ticket !== generation) return;
      try {
        const data = await load();
        if (ticket === generation) commit(data);
      } catch {
        if (ticket === generation) fail();
      }
    },
  };
}
