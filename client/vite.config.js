import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Local Kitchen (npm run dev:kitchen → PORT 3005)
      '/kitchen': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/kitchen/, '') || '/',
      },
    },
  },
});
