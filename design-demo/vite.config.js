import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Folds the whole build into ONE index.html: the script, the styles and the
 * SQLite engine (as base64) all inline. The result opens by double-click from
 * a folder (file://) and needs nothing else on GitHub Pages — upload the one
 * file and share the link.
 */
function singleFile() {
  return {
    name: 'single-file',
    enforce: 'post',
    generateBundle(_, bundle) {
      const html = Object.values(bundle).find((f) => f.fileName.endsWith('.html'));
      let out = String(html.source);
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === 'chunk') {
          out = out.replace(new RegExp(`<script[^>]*src="[^"]*${escape(name)}"[^>]*></script>`), '');
          // A classic script at the end of <body>: module scripts are blocked on file://.
          const code = file.code.replace(/<\/script/gi, '<\\/script');
          out = out.replace('</body>', () => `<script>${code}</script>\n</body>`);
          delete bundle[name];
        } else if (name.endsWith('.css')) {
          out = out.replace(new RegExp(`<link[^>]*href="[^"]*${escape(name)}"[^>]*>`), () => `<style>${file.source}</style>`);
          delete bundle[name];
        }
      }
      html.source = out;
    },
  };
}
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default defineConfig({
  plugins: [react(), singleFile()],
  base: './',
  resolve: {
    alias: {
      // The copied API routes import { Router } from 'express'; in the browser
      // that resolves to a tiny router with the same surface.
      express: path.resolve(here, 'src/demo-server/express.js'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: { loadPaths: [path.resolve(here, 'src/styles')] },
    },
  },
  build: {
    outDir: 'publish',
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 100_000_000,   // inline everything, including the .wasm
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 5000,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
});
