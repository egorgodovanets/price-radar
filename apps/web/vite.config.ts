import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Where the dev server forwards GraphQL requests. */
const BFF_URL = 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // The browser calls /graphql on the Vite origin, so the BFF needs no CORS setup.
      // ws: true also forwards WebSocket upgrades for subscriptions.
      '/graphql': { target: BFF_URL, ws: true },
    },
  },
});
