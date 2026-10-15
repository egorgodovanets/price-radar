import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';
import { jsonResponse } from '../test/fakeFetch';
import { useQuery } from './useQuery';

interface PendingRequest {
  variables: Record<string, unknown>;
  signal: AbortSignal | null | undefined;
  respond: (data: unknown) => void;
}

/** fetch that waits until the test answers each request by hand. */
function installManualFetch(): PendingRequest[] {
  const pending: PendingRequest[] = [];
  globalThis.fetch = jest.fn<typeof fetch>(
    (_input, init) =>
      new Promise((resolve) => {
        const { variables } = JSON.parse(init?.body as string) as { variables: Record<string, unknown> };
        pending.push({ variables, signal: init?.signal, respond: (data) => resolve(jsonResponse({ data })) });
      }),
  );
  return pending;
}

/** Answers requests inside act() and lets the promise chains behind them settle. */
async function answer(respond: () => void): Promise<void> {
  await act(async () => {
    respond();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useQuery', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'fetch');
  });

  it('is loading until the data arrives', async () => {
    const pending = installManualFetch();
    const { result } = renderHook(() => useQuery<{ value: number }>('query Q { value }'));

    expect(result.current).toMatchObject({ loading: true, data: undefined });

    await answer(() => pending[0]?.respond({ value: 1 }));
    expect(result.current).toMatchObject({ loading: false, data: { value: 1 } });
  });

  it('ignores a slow response for old variables', async () => {
    const pending = installManualFetch();
    const { result, rerender } = renderHook(({ id }) => useQuery<{ id: string }>('query Q($id: ID!) { id }', { id }), {
      initialProps: { id: 'a' },
    });

    rerender({ id: 'b' });
    expect(pending[0]?.signal?.aborted).toBe(true);

    // The new request answers first, the old one answers later: the old answer must be dropped.
    await answer(() => {
      pending[1]?.respond({ id: 'b' });
      pending[0]?.respond({ id: 'a' });
    });

    expect(result.current).toMatchObject({ loading: false, data: { id: 'b' } });
  });

  it('keeps old data visible while refetch() is loading', async () => {
    const pending = installManualFetch();
    const { result } = renderHook(() => useQuery<{ value: number }>('query Q { value }'));
    await answer(() => pending[0]?.respond({ value: 1 }));

    act(() => result.current.refetch());
    expect(result.current).toMatchObject({ loading: true, data: { value: 1 } });

    await answer(() => pending[1]?.respond({ value: 2 }));
    await waitFor(() => expect(result.current.data).toEqual({ value: 2 }));
  });
});
