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
        cloudhopper: resolve(__dirname, 'index.html'),
        nightwatch: resolve(__dirname, 'nightwatch.html'),
      },
    },
  },
  server: { port: 5173 },
});
