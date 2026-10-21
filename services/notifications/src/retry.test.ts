import { describe, expect, it, jest } from '@jest/globals';
import { withRetry } from './retry.js';

const options = { attempts: 3, delayMs: 0, isRetryable: () => true, signal: new AbortController().signal };

describe('withRetry', () => {
  it('returns the first successful result', async () => {
    const task = jest.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('flaky')).mockResolvedValue('ok');

    await expect(withRetry(task, options)).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('gives up after the last attempt with its error', async () => {
    const task = jest.fn<() => Promise<string>>().mockRejectedValue(new Error('down'));

    await expect(withRetry(task, options)).rejects.toThrow('down');
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('does not retry an error that will not go away', async () => {
    const task = jest.fn<() => Promise<string>>().mockRejectedValue(new Error('not found'));

    await expect(withRetry(task, { ...options, isRetryable: () => false })).rejects.toThrow('not found');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('stops waiting between tries when aborted', async () => {
    const controller = new AbortController();
    const task = jest.fn<() => Promise<string>>().mockRejectedValue(new Error('down'));

    const result = withRetry(task, { ...options, delayMs: 60_000, signal: controller.signal });
    // Let the first try fail, so withRetry is inside the one-minute pause.
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();

    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(task).toHaveBeenCalledTimes(1);
  });
});
