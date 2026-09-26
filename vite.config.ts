import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: the dashboard then works at any URL, including a
  // proxied preview that serves it from a sub-path.
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // The preview host is proxied (https://<port>-<sandbox>.e2b.app), so allow any host
    // and any origin to reach the dev server.
    allowedHosts: true,
    cors: true,
    hmr: { clientPort: undefined },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
