import { setTimeout as sleep } from 'node:timers/promises';

export interface RetryOptions {
  attempts: number;
  /** Wait before the 2nd try; doubles before each next one (exponential backoff). */
  delayMs: number;
  /** False: the error will not go away by itself (e.g. 404), give up at once. */
  isRetryable: (error: unknown) => boolean;
  /** Abort stops the waiting between tries (shutdown). */
  signal: AbortSignal;
}

/** Runs the task until it succeeds or the attempts run out; rethrows the last error. */
export async function withRetry<T>(task: () => Promise<T>, options: RetryOptions): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= options.attempts || !options.isRetryable(error) || options.signal.aborted) throw error;
      await sleep(options.delayMs * 2 ** (attempt - 1), undefined, { signal: options.signal });
    }
  }
}
