import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Base path per il deploy
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'oxc', // Minificatore nativo Vite 8/Rolldown, senza dipendenza esbuild
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('/node_modules/react/') ||
            id.includes('\\node_modules\\react\\') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('\\node_modules\\react-dom\\')
          ) {
            return 'vendor';
          }
          if (
            id.includes('@radix-ui/react-alert-dialog') ||
            id.includes('@radix-ui/react-avatar') ||
            id.includes('@radix-ui/react-switch')
          ) {
            return 'ui';
          }
        },
        // Mantieni output ESM senza opzioni Rollup rimosse da Rolldown.
        format: 'es',
      },
    },
    target: 'esnext',
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:10000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },
  preview: {
    port: 3000,
    host: true,
  },
})
