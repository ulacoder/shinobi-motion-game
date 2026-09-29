import { defineConfig } from 'vite';

// base: './' — чтобы сборка работала и на Vercel, и на GitHub Pages, и из любой папки.
export default defineConfig({
  base: './',
  server: { host: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
});
