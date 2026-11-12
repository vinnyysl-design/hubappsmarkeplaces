// App-issued Auth mutations are exclusive in this JS realm. Busy login/signup
// is rejected, never queued as an invisible second sign-in. Logout may queue.
export function createAuthOperationInterlock() {
  let pending = 0;
  let tail: Promise<void> = Promise.resolve();
  function queue<T>(task: () => Promise<T>): Promise<T> {
    pending++;
    const result = tail.then(task);
    const settled = result.then(
      value => { pending--; return value; },
      error => { pending--; throw error; },
    );
    tail = settled.then(() => undefined, () => undefined);
    return settled;
  }
  return {
    busy: () => pending > 0,
    queue,
    tryRun<T>(task: () => Promise<T>, onBusy: () => T): Promise<T> {
      return pending > 0 ? Promise.resolve(onBusy()) : queue(task);
    },
  };
}
export const authOperations = createAuthOperationInterlock();
