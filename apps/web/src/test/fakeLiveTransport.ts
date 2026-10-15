import type { Variables } from '../api/client';
import type { LiveTransport } from '../api/liveTransport';

interface FakeSubscription {
  query: string;
  variables: Variables;
  onData: (data: unknown) => void;
}

/**
 * In-memory LiveTransport: tests push events with emit() instead of a real WebSocket.
 * emit() mimics the BFF filter: a subscription with productId only gets that product's changes.
 */
export function createFakeLiveTransport() {
  const subscriptions = new Set<FakeSubscription>();
  const reconnectListeners = new Set<() => void>();

  const transport: LiveTransport = {
    subscribe<TData>(query: string, variables: Variables, onData: (data: TData) => void) {
      const subscription: FakeSubscription = { query, variables, onData: (data) => onData(data as TData) };
      subscriptions.add(subscription);
      return () => subscriptions.delete(subscription);
    },
    onReconnected(listener) {
      reconnectListeners.add(listener);
      return () => reconnectListeners.delete(listener);
    },
  };

  return {
    transport,
    /** Variables of the subscriptions that are open right now. */
    active: () => [...subscriptions].map((subscription) => subscription.variables),
    emit(data: { priceChanged: { productId: string } }) {
      for (const { variables, onData } of subscriptions) {
        const { productId } = variables;
        if (productId === undefined || productId === data.priceChanged.productId) onData(data);
      }
    },
    reconnect() {
      for (const listener of reconnectListeners) listener();
    },
  };
}
