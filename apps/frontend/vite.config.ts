import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    // In development, uploads go to the live Worker (it holds the storage);
    // npm run dev:local sends /api to the Worker on this Mac instead
    // (npm run dev:api), to try payments in Flutterwave's test mode.
    proxy: {
      '/api': { target: process.env.WAVEE_API || 'https://wavee.kaivon.app', changeOrigin: true },
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // Libraries in their own files, so a release only re-downloads the app's code. By path,
        // so react-dom/client (most of React) lands with React rather than in the app.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (/[\\/](@supabase|@tanstack|zustand)[\\/]/.test(id)) return 'data';
          if (/[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion';
          return undefined;
        },
      },
    },
  },
});
