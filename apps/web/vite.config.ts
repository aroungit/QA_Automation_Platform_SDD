import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.svg', 'hero-title.svg'],
      manifest: {
        id: '/',
        name: 'QA Automation Platform Agent',
        short_name: 'QAA Platform',
        description: 'Spec-Driven QA Automation Platform by Aroun AI labs',
        theme_color: '#4f46e5',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['development', 'utilities', 'productivity'],
        icons: [
          {
            src: 'logo.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'New Story Intake',
            short_name: 'Intake',
            description: 'Submit a new user story for spec generation',
            url: '/intake',
            icons: [{ src: 'logo.svg', sizes: '192x192' }],
          },
          {
            name: 'Specifications',
            short_name: 'Specs',
            description: 'Browse specifications and test cases',
            url: '/specs',
            icons: [{ src: 'logo.svg', sizes: '192x192' }],
          },
          {
            name: 'Approval Gate',
            short_name: 'Approvals',
            description: 'Review and approve candidate test cases',
            url: '/approval',
            icons: [{ src: 'logo.svg', sizes: '192x192' }],
          },
          {
            name: 'Validation Pipeline',
            short_name: 'Validation',
            description: 'View test runs, reports and auto-healing',
            url: '/validation',
            icons: [{ src: 'logo.svg', sizes: '192x192' }],
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
