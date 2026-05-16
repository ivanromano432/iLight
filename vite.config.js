import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Aumentiamo soglia warning (i nostri chunk principali sono ~300kB ma comprime molto bene)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Spezzo manualmente i vendor in chunk separati: vengono cachati dal browser tra deploy diversi
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
