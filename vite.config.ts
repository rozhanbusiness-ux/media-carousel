import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/media-carousel/',
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
});
