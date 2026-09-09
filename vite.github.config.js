import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'static-pages',
  base: '/homevaluation/',
  plugins: [react()],
  define: {
    '__ANALYSIS_API_URL__': JSON.stringify('https://web-app-housing.onrender.com/api/analysis'),
  },
  build: {
    outDir: '../dist-github',
    emptyOutDir: true,
  },
});
