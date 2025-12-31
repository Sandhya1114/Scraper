import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://react-studio.onrender.com',
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react']
  }
});