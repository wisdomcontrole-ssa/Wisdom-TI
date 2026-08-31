import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['inventario-ti.svg'],
      manifest: {
        name: 'Inventário TI',
        short_name: 'Inventário TI',
        description:
          'Patrimônio, estoque, auditorias, manutenção e inventário automático de TI.',
        theme_color: '#0b1220',
        background_color: '#f4f6f9',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/inventario-ti.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/inventario-ti.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globIgnores: [
          '**/worker-entry-*.js',
          '**/ort-wasm-*.wasm',
          '**/dist-*.js',
        ],
        runtimeCaching: [
          {
            urlPattern:
              /\/assets\/(?:worker-entry-|ort-wasm-|dist-).*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-runtime-v1',
              expiration: {
                maxEntries: 12,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replaceAll('\\', '/')

          if (
            normalized.includes('/node_modules/html5-qrcode/') ||
            normalized.includes('/node_modules/react-qr-code/')
          ) {
            return 'qr'
          }

          if (
            normalized.includes('/node_modules/@supabase/')
          ) {
            return 'supabase'
          }

          if (
            normalized.includes('/node_modules/react/') ||
            normalized.includes('/node_modules/react-dom/') ||
            normalized.includes('/node_modules/react-router/')
          ) {
            return 'react'
          }

          return undefined
        },
      },
    },
  },
})
