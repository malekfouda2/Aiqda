import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const manualChunkGroups = {
  react: ['react', 'react-dom'],
  router: ['react-router-dom'],
  motion: ['framer-motion'],
  network: ['axios'],
  state: ['zustand'],
  media: ['@vimeo/player']
};

const resolveManualChunk = (id) => {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  for (const [chunkName, packages] of Object.entries(manualChunkGroups)) {
    if (packages.some((pkg) => id.includes(`node_modules/${pkg}/`))) {
      return chunkName;
    }
  }

  return undefined;
};

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
