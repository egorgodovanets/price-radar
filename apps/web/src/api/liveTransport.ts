import { createClient } from 'graphql-ws';
import { GRAPHQL_ENDPOINT, type Variables } from './client';

/**
 * Live updates from the BFF: GraphQL subscriptions over one shared WebSocket.
 * Components use it through useSubscription; tests replace it with a fake.
 */
export interface LiveTransport {
  /** Starts a subscription; returns the function that stops it. */
  subscribe<TData>(query: string, variables: Variables, onData: (data: TData) => void): () => void;
  /**
   * Called after the socket dropped and connected again.
   * Events sent while it was down are lost, so listeners reload their data.
   */
  onReconnected(listener: () => void): () => void;
}

const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * Exponential backoff with a cap and random jitter: about 1s, 2s, 4s ... 30s.
 * Jitter spreads reconnects, so many tabs do not hit a restarted server at the same moment.
 */
export function reconnectDelay(retries: number, random: () => number = Math.random): number {
  const base = Math.min(1000 * 2 ** retries, MAX_RECONNECT_DELAY_MS);
  return base / 2 + random() * (base / 2);
}

/** ws://host/graphql on http pages, wss:// on https; Vite proxies it to the BFF in development. */
export function liveUrl(location: Pick<Location, 'protocol' | 'host'> = window.location): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}${GRAPHQL_ENDPOINT}`;
}

export function createLiveTransport(url: string): LiveTransport {
  const client = createClient({
    url,
    // Lazy: the socket opens on the first subscription and closes after the last one.
    lazy: true,
    // A live view should never give up: retry every connection problem, forever, with backoff.
    retryAttempts: Infinity,
    shouldRetry: () => true,
    retryWait: (retries) => new Promise((resolve) => setTimeout(resolve, reconnectDelay(retries))),
  });

  return {
    subscribe<TData>(query: string, variables: Variables, onData: (data: TData) => void) {
      return client.subscribe<TData>(
        { query, variables },
        {
          next: (result) => {
            if (result.errors?.length) console.error('Live update failed', result.errors);
            else if (result.data) onData(result.data);
          },
          error: (error) => console.error('Live updates stopped', error),
          complete: () => {},
        },
      );
    },
    onReconnected(listener) {
      return client.on('connected', (_socket, _payload, wasRetry) => {
        if (wasRetry) listener();
      });
    },
  };
}
