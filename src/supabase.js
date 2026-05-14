// Client Supabase di Quercus.
//
// L'URL e la "publishable" key sono SICURE da mettere lato client:
// Supabase usa Row Level Security per impedire l'accesso ai dati altrui.
// Sono hardcodate come fallback per robustezza, override possibile via VITE_*.

import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://lssvedghyqshhuvyuspw.supabase.co';
const FALLBACK_KEY = 'sb_publishable_2RSTLv7es6aCxFA62ehQWg_F69Y8F5_';

const url = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY;

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,        // salva sessione in localStorage → utente resta loggato
    autoRefreshToken: true,      // rinnova token automaticamente
    detectSessionInUrl: true,    // gestisce ritorni da magic link / conferma email
  },
});

