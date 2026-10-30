import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      external: [],
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  // Active config for 'vite' (vite.config.js takes precedence over .ts).
  // The candidate Opinions browser QA and local development route /api only
  // to an explicitly launched localhost backend. No production build change.
  server: {
    port: 3000,
    host: 'localhost',
    proxy: {
      '/api': {
        target: 'http://localhost:10000',
        changeOrigin: true,
      },
    },
  },
})