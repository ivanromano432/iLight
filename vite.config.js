import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

// Numero di versione automatico: 2.<numero di commit>, più la data della build.
// Si aggiorna da solo a ogni pubblicazione, senza doverlo cambiare a mano.
let commits = 0;
try { commits = parseInt(execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 10) || 0; } catch (_) {}
const builtOn = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Rome' });

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(commits > 1 ? `2.${commits}` : ''),
    __APP_BUILT__: JSON.stringify(builtOn),
  },
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
