import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // The API and the app share an origin in development, so the session
    // cookie behaves exactly as it will in production.
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } },
  },
  css: {
    preprocessorOptions: {
      scss: { loadPaths: [path.resolve(process.cwd(), 'src/styles')] },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
