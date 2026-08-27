import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  server: {
    port: 3010,
    proxy: {
      '/api': {
        target: 'http://localhost:5010',
        changeOrigin: true,
      },
    },
  },
});
