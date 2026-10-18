import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { startScheduler } from './scheduler.js';

/** A task whose runs the test finishes by hand. */
function controllableTask() {
  const finishers: (() => void)[] = [];
  const signals: AbortSignal[] = [];
  const task = jest.fn((signal: AbortSignal) => {
    signals.push(signal);
    return new Promise<void>((resolve) => finishers.push(resolve));
  });
  return { task, signals, finish: (run: number) => finishers[run]?.() };
}

describe('startScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs at once, then the interval after each run has finished', async () => {
    const { task, finish } = controllableTask();
    const scheduler = startScheduler(task, 1000, jest.fn());
    expect(task).toHaveBeenCalledTimes(1);

    // The first run is still busy: no second run, however long it takes.
    await jest.advanceTimersByTimeAsync(5000);
    expect(task).toHaveBeenCalledTimes(1);

    finish(0);
    await jest.advanceTimersByTimeAsync(999);
    expect(task).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);

    finish(1);
    await scheduler.stop();
  });

  it('reports a failed run and keeps the schedule', async () => {
    const onError = jest.fn();
    const task = jest.fn<(signal: AbortSignal) => Promise<void>>().mockRejectedValue(new Error('Tracker is down'));
    const scheduler = startScheduler(task, 1000, onError);

    await jest.advanceTimersByTimeAsync(1000);

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Tracker is down' }));
    expect(task).toHaveBeenCalledTimes(2);
    await scheduler.stop();
  });

  it('stop() aborts the running task, waits for it and plans nothing more', async () => {
    const { task, signals, finish } = controllableTask();
    const onError = jest.fn();
    const scheduler = startScheduler(task, 1000, onError);

    const stopped = scheduler.stop();
    expect(signals[0]?.aborted).toBe(true);
    finish(0);
    await stopped;

    await jest.advanceTimersByTimeAsync(10_000);
    expect(task).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });
});
