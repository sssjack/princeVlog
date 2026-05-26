import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/princevlog/',
  plugins: [react()],
  server: {
    port: 5177,
    proxy: {
      '/princevlog/api': 'http://127.0.0.1:4210',
      '/princevlog/uploads': 'http://127.0.0.1:4210'
    }
  }
});
