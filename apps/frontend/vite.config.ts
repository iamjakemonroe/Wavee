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
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          data: ['@supabase/supabase-js', '@tanstack/react-query', 'zustand'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
