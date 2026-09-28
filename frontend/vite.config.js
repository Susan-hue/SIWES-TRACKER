import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Custom service worker (src/sw.js) so it can handle push events.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: false, // registered in src/push.js
      devOptions: { enabled: true, type: 'module' },
      manifest: {
        name: 'SIWES Outreach Tracker',
        short_name: 'Outreach',
        description: 'Pipeline, follow ups and response analytics for SIWES outreach.',
        start_url: '/',
        display: 'standalone',
        background_color: '#f7f7f5',
        theme_color: '#1f5fae',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
