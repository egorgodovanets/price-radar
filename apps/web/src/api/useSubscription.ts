import { createContext, useContext, useEffect, useEffectEvent } from 'react';
import type { Variables } from './client';
import type { LiveTransport } from './liveTransport';

/** Set once in main.tsx. Without a provider live updates are simply off (as in most tests). */
export const LiveTransportContext = createContext<LiveTransport | null>(null);

/**
 * Keeps a subscription open while the component is mounted and the query/variables stay the same.
 * onData and onReconnected may be new functions on every render: they do not restart it.
 */
export function useSubscription<TData>(
  query: string,
  variables: Variables,
  onData: (data: TData) => void,
  onReconnected?: () => void,
): void {
  const transport = useContext(LiveTransportContext);
  const variablesKey = JSON.stringify(variables);
  // Effect events always see the latest props and state, but are not effect dependencies.
  const handleData = useEffectEvent((data: TData) => onData(data));
  const handleReconnected = useEffectEvent(() => onReconnected?.());

  useEffect(() => {
    if (!transport) return;
    const unsubscribe = transport.subscribe<TData>(query, JSON.parse(variablesKey) as Variables, (data) =>
      handleData(data),
    );
    const stopListening = transport.onReconnected(() => handleReconnected());

    // Unmount or new variables: close this subscription before another one starts.
    return () => {
      unsubscribe();
      stopListening();
    };
  }, [transport, query, variablesKey]);
}
