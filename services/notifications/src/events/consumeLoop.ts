import { setTimeout as sleep } from 'node:timers/promises';

/** Where messages come from. Kafka in production, a fake in tests. */
export interface MessageSource<M> {
  /** Next messages; empty when nothing arrived within the poll timeout. */
  next(): Promise<M[]>;
  /** Marks the message as done: after a restart the consumer group continues after it. */
  commit(message: M): void;
}

export interface ConsumeLoop {
  /** Lets the message in progress finish (or aborts its retries), then stops reading. */
  stop(): Promise<void>;
}

const RETRY_NEXT_MS = 1000;

/**
 * Reads messages one by one and commits each only after it was handled (at-least-once):
 * if the process dies halfway, the message is delivered again instead of being lost.
 * The price is a possible duplicate, which is fine for a price alert.
 */
export function startConsumeLoop<M>(
  source: MessageSource<M>,
  handle: (message: M, signal: AbortSignal) => Promise<void>,
  onError: (error: unknown) => void,
): ConsumeLoop {
  const controller = new AbortController();
  const { signal } = controller;

  const done = (async () => {
    while (!signal.aborted) {
      let messages: M[];
      try {
        messages = await source.next();
      } catch (error) {
        onError(error);
        await sleep(RETRY_NEXT_MS, undefined, { signal }).catch(() => undefined);
        continue;
      }

      for (const message of messages) {
        try {
          await handle(message, signal);
        } catch (error) {
          // Interrupted by shutdown: leave it uncommitted, it is handled again after the restart.
          if (signal.aborted) return;
          // Any other failure: report and move on, one bad message must not block the rest.
          onError(error);
        }

        try {
          source.commit(message);
        } catch (error) {
          // Not fatal: the message may come again after a restart (a duplicate, not a loss).
          onError(error);
        }
      }
    }
  })();

  return {
    async stop() {
      controller.abort();
      await done;
    },
  };
}
