export interface Scheduler {
  /** Cancels the waiting timer, aborts the running task and waits until it settles. */
  stop(): Promise<void>;
}

/**
 * Runs the task now, then again intervalMs after each run finishes.
 * A chain of setTimeout (not setInterval): a slow run never overlaps the next one.
 */
export function startScheduler(
  task: (signal: AbortSignal) => Promise<void>,
  intervalMs: number,
  onError: (error: unknown) => void,
): Scheduler {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  let current = Promise.resolve();

  const run = () => {
    current = task(controller.signal)
      .catch((error: unknown) => {
        // An abort during shutdown is expected, not an error.
        if (!controller.signal.aborted) onError(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) timer = setTimeout(run, intervalMs);
      });
  };
  run();

  return {
    async stop() {
      controller.abort();
      clearTimeout(timer);
      await current;
    },
  };
}
