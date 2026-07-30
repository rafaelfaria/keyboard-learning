import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: Number(process.env.PORT) || 50675 },
  preview: { port: Number(process.env.PORT) || 4173 },
  build: {
    chunkSizeWarningLimit: 1800,
  },
});
