import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['hn.svg'],
      manifest: {
        name: 'Hacker News Reader',
        short_name: 'HN Reader',
        description: 'A modern Hacker News reader with offline support',
        theme_color: '#f97316',
        background_color: '#ffffff',
        icons: [
          {
            src: 'hn.svg',
            sizes: '256x256',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ],
        display: 'standalone',
        start_url: '/'
      }
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react']
  }
});