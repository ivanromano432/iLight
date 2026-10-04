// Chiamata unica all'IA: aggiunge l'accesso dell'utente e il tipo di richiesta (per i limiti del piano).
import { supabase } from './supabase.js';

// kind: 'coach' (chat), 'foto' (analisi dei pasti), 'altro' (suggerimenti e analisi)
export async function aiFetch(body, kind = 'altro') {
  let token = '';
  try { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token || ''; } catch (_) {}
  return fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-GF-Kind': kind, ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
}
