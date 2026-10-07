/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // App-Paket ist > 2 MiB (Übungsfiguren, Bibliothek, Charts) – trotzdem offline cachen
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: 'Fitness Tracker',
        short_name: 'Fitness',
        description: 'Tracke deine Gym-Performance: Übungen, Sätze, Auswertung.',
        theme_color: '#0B0F19',
        background_color: '#0B0F19',
        display: 'standalone',
        orientation: 'portrait',
        // Android: App erscheint im Teilen-Menü (TikTok, Instagram, Browser …) → Rezept-Import
        share_target: {
          action: '/share',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        id: '/',
        lang: 'de',
        // PNG 192/512 sind Pflicht, damit Android die App richtig installiert (WebAPK)
        // statt nur eine Verknüpfung anzulegen – sonst gibt es kein Teilen-Menü.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
  },
})
