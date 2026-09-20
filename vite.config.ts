import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    sourcemap: false,
    rollupOptions: {
      // Bramblewood ships one bundle per game; the shell that ties them together comes later.
      input: {
        hub: resolve(__dirname, 'index.html'),
        cloudhopper: resolve(__dirname, 'cloudhopper.html'),
        nightwatch: resolve(__dirname, 'nightwatch.html'),
        orbit: resolve(__dirname, 'orbit.html'),
        dig: resolve(__dirname, 'dig.html'),
        mill: resolve(__dirname, 'mill.html'),
        tidepool: resolve(__dirname, 'tidepool.html'),
        market: resolve(__dirname, 'market.html'),
        puffball: resolve(__dirname, 'puffball.html'),
      },
    },
  },
  server: { port: 5173 },
});
