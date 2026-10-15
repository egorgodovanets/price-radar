import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createLiveTransport, liveUrl } from './api/liveTransport';
import { LiveTransportContext } from './api/useSubscription';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Element #root not found in index.html');

// One WebSocket for the whole app; every subscription shares it.
const liveTransport = createLiveTransport(liveUrl());

createRoot(root).render(
  <StrictMode>
    <LiveTransportContext value={liveTransport}>
      <App />
    </LiveTransportContext>
  </StrictMode>,
);
