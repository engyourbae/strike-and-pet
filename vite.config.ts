import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// VITE_BASE: "/" untuk domain root, "/nama-repo/" untuk GitHub Pages project site.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { version: string };
  const rawBase = env.VITE_BASE || '/';
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'STRIKE & PET',
          short_name: 'STRIKE & PET',
          description: 'Aplikasi sosial privat untuk pasangan dan teman dekat.',
          lang: 'id',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: '#F4F5FB',
          theme_color: '#5B3DF5',
          icons: [
            { src: 'assets/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'assets/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'assets/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        // Hanya aset statis aplikasi yang di-precache. Tidak ada runtime cache
        // untuk Firebase/API agar data privat tidak masuk cache service worker.
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
          // Penanganan push (tanpa SDK Firebase di service worker) dimuat dari public/push-sw.js.
          importScripts: ['push-sw.js'],
        },
      }),
    ],
    test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  };
});
