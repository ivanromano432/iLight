// Client Supabase di Quercus.
// Le credenziali sono iniettate via variabili d'ambiente di Vite (VITE_*).
// L'anon/publishable key è SICURA da mettere lato client: Supabase usa
// Row Level Security per impedire l'accesso ai dati altrui.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // In dev/preview senza env var, mostra errore subito invece di silenzioso fail
  console.error('Supabase non configurato. VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY mancanti.');
}

export const supabase = createClient(url || 'http://placeholder', anon || 'placeholder', {
  auth: {
    persistSession: true,        // salva sessione in localStorage → utente resta loggato
    autoRefreshToken: true,      // rinnova token automaticamente
    detectSessionInUrl: true,    // gestisce ritorni da magic link / conferma email
  },
});
