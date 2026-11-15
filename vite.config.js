import { defineConfig } from 'vite';

export default defineConfig({
  // Hot reload is off by default so an open play session isn't reset by every save.
  // Run `BB_HMR=1 npm run dev` to turn it back on.
  server: { hmr: process.env.BB_HMR === '1' },
  build: { chunkSizeWarningLimit: 1200 },
});
