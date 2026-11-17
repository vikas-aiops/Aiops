import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The app calls the API at the relative path /api, so the same build works on
// any domain, VM or Kubernetes ingress. In development, Vite proxies /api to a
// locally running backend (override with VITE_API_PROXY=http://host:port).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Root-relative alias. An absolute path built from import.meta.url can
    // differ in drive-letter case on Windows (c:\ vs C:\), which makes the
    // bundler load React twice.
    alias: { '@': '/src' },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY || 'http://127.0.0.1:8080', changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});
