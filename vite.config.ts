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
      // Braambos ships one bundle per game; the shell that ties them together comes later.
      input: {
        hub: resolve(__dirname, 'index.html'),
        parents: resolve(__dirname, 'parents.html'),
        cloudhopper: resolve(__dirname, 'cloudhopper.html'),
        nightwatch: resolve(__dirname, 'nightwatch.html'),
        orbit: resolve(__dirname, 'orbit.html'),
        dig: resolve(__dirname, 'dig.html'),
        mill: resolve(__dirname, 'mill.html'),
        tidepool: resolve(__dirname, 'tidepool.html'),
        market: resolve(__dirname, 'market.html'),
        puffball: resolve(__dirname, 'puffball.html'),
        moonshot: resolve(__dirname, 'moonshot.html'),
        clock: resolve(__dirname, 'clock.html'),
        animals: resolve(__dirname, 'animals.html'),
        atlas: resolve(__dirname, 'atlas.html'),
        rhythm: resolve(__dirname, 'rhythm.html'),
        numbers: resolve(__dirname, 'numbers.html'),
        letters: resolve(__dirname, 'letters.html'),
        circuit: resolve(__dirname, 'circuit.html'),
        reis: resolve(__dirname, 'reis.html'),
        diepzee: resolve(__dirname, 'diepzee.html'),
      },
    },
  },
  server: { port: 5173 },
});
