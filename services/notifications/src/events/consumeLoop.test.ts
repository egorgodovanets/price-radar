import { describe, expect, it, jest } from '@jest/globals';
import { startConsumeLoop, type MessageSource } from './consumeLoop.js';

/** Hands out the given batches, then idles until the loop is stopped. Commits go to the journal too. */
function fakeSource(batches: (string[] | Error)[], journal: string[] = []) {
  const committed: string[] = [];
  let drained!: () => void;
  const allRead = new Promise<void>((resolve) => (drained = resolve));

  const source: MessageSource<string> = {
    async next() {
      const batch = batches.shift();
      if (batch === undefined) {
        drained();
        await new Promise((resolve) => setTimeout(resolve, 5));
        return [];
      }
      if (batch instanceof Error) throw batch;
      return batch;
    },
    commit: (message) => {
      committed.push(message);
      journal.push(`commit ${message}`);
    },
  };
  return { source, committed, allRead };
}

describe('startConsumeLoop', () => {
  it('handles messages in order and commits each after it was handled', async () => {
    const order: string[] = [];
    const { source, committed, allRead } = fakeSource([['a', 'b'], ['c']], order);
    const handle = jest.fn(async (message: string) => {
      order.push(`handle ${message}`);
      await Promise.resolve();
      order.push(`done ${message}`);
    });

    const loop = startConsumeLoop(source, handle, jest.fn());
    await allRead;
    await loop.stop();

    expect(committed).toEqual(['a', 'b', 'c']);
    expect(order.slice(0, 3)).toEqual(['handle a', 'done a', 'commit a']);
  });

  it('reports a failed message, commits it and goes on', async () => {
    const { source, committed, allRead } = fakeSource([['bad', 'good']]);
    const onError = jest.fn();
    const handle = (message: string) => (message === 'bad' ? Promise.reject(new Error('boom')) : Promise.resolve());

    const loop = startConsumeLoop(source, handle, onError);
    await allRead;
    await loop.stop();

    expect(onError).toHaveBeenCalledWith(new Error('boom'));
    expect(committed).toEqual(['bad', 'good']);
  });

  it('keeps reading after the source fails', async () => {
    const { source, committed, allRead } = fakeSource([new Error('broker down'), ['a']]);
    const onError = jest.fn();

    const loop = startConsumeLoop(source, () => Promise.resolve(), onError);
    await allRead;
    await loop.stop();

    expect(onError).toHaveBeenCalledWith(new Error('broker down'));
    expect(committed).toEqual(['a']);
  });

  it('does not commit a message interrupted by stop', async () => {
    const { source, committed } = fakeSource([['slow']]);
    let started!: () => void;
    const handling = new Promise<void>((resolve) => (started = resolve));
    const handle = (_message: string, signal: AbortSignal) =>
      new Promise<void>((_resolve, reject) => {
        started();
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      });

    const loop = startConsumeLoop(source, handle, jest.fn());
    await handling;
    await loop.stop();

    expect(committed).toEqual([]);
  });
});
