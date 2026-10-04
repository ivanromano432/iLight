// Netlify Function v2 — proxy alle API Anthropic con diagnostica
// Esposta su /api/anthropic
//
// GET /api/anthropic           → restituisce diagnostica (verifica key/env senza esporla)
// POST /api/anthropic          → inoltra il body al vero endpoint Anthropic
// OPTIONS /api/anthropic       → CORS preflight

import { createClient } from '@supabase/supabase-js';

// Limiti giornalieri di richieste all'IA per piano. 'coach' = messaggi al coach, 'foto' = analisi dei pasti, 'altro' = suggerimenti e analisi.
// La prova gratuita usa i limiti del piano base.
const LIMITS = {
  base:    { coach: 30,  foto: 15, altro: 20 },
  premium: { coach: 150, foto: 60, altro: 80 },
};
const KIND_LABEL = { coach: 'messaggi al coach', foto: 'analisi dei pasti', altro: 'analisi e suggerimenti' };
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

async function checkAccess(req) {
  const supaUrl = (process.env.SUPABASE_URL || 'https://lssvedghyqshhuvyuspw.supabase.co').trim();
  const supaService = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supaService) return { status: 500, error: 'Servizio non configurato' };
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { status: 401, code: 'login', error: 'Accedi per usare l\'IA. Se sei già dentro, chiudi e riapri l\'app.' };
  const supa = createClient(supaUrl, supaService, { auth: { persistSession: false } });
  const { data: u, error: uErr } = await supa.auth.getUser(token);
  const userId = u?.user?.id;
  if (uErr || !userId) return { status: 401, code: 'login', error: 'Sessione scaduta: chiudi e riapri l\'app.' };
  const { data: prof } = await supa.from('profiles').select('subscription_status, trial_ends_at, is_lifetime_free, plan').eq('id', userId).single();
  if (!prof) return { status: 403, code: 'profilo', error: 'Profilo non trovato.' };
  const active = prof.subscription_status === 'active' || !!prof.is_lifetime_free;
  const inTrial = !prof.trial_ends_at || new Date(prof.trial_ends_at) >= new Date();
  if (!active && !inTrial) return { status: 402, code: 'abbonamento', error: 'La prova è terminata: per usare l\'IA serve un abbonamento.' };
  const plan = prof.is_lifetime_free || (active && prof.plan === 'premium') ? 'premium' : 'base';
  const k = (req.headers.get('x-gf-kind') || '').toLowerCase();
  const kind = k === 'coach' || k === 'foto' ? k : 'altro';
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  const { data: row } = await supa.from('ai_usage').select('count').eq('user_id', userId).eq('day', day).eq('kind', kind).maybeSingle();
  const used = row?.count || 0;
  const limit = LIMITS[plan][kind];
  if (used >= limit) {
    return { status: 429, code: 'limite', error: `Hai raggiunto il limite di oggi (${limit} ${KIND_LABEL[kind]})` + (plan === 'base' ? ' del tuo piano. Con Premium il limite è più alto; domani riparte da zero.' : '. Domani riparte da zero.') };
  }
  // Il conteggio sale solo se l'IA ha risposto davvero
  const bump = async () => { try { await supa.from('ai_usage').upsert({ user_id: userId, day, kind, count: used + 1 }, { onConflict: 'user_id,day,kind' }); } catch (_) {} };
  return { bump };
}

export default async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-GF-Kind',
      },
    });
  }

  // Leggi la API key (e fai trim difensivo per eventuali whitespace/newline)
  // NOTA: usiamo MY_ANTHROPIC_KEY perché ANTHROPIC_API_KEY è riservata
  // a Netlify Claude Agent, che la sovrascriverebbe automaticamente.
  const rawKey = process.env.MY_ANTHROPIC_KEY || '';
  const apiKey = rawKey.trim();

  // === GET = diagnostica minima (non espone nulla della chiave) ===
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ configured: !!apiKey }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  // === Solo POST oltre questo punto ===
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: 'ANTHROPIC_API_KEY non configurata',
        hint: 'Apri /api/anthropic in GET per la diagnostica',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // === Accesso: solo utenti GoalFit con prova o abbonamento attivi, entro il limite giornaliero ===
  const gate = await checkAccess(req);
  if (gate.error) return json(gate.status, { error: gate.error, code: gate.code });

  try {
    // Il corpo viene ricostruito: modello fisso e tetto ai token, così l'endpoint non è usabile per altro
    let parsed;
    try { parsed = JSON.parse(await req.text()); } catch (_) { return json(400, { error: 'Richiesta non valida' }); }
    const safe = {
      model: 'claude-sonnet-4-6',
      max_tokens: Math.min(Math.max(parseInt(parsed.max_tokens, 10) || 1000, 1), 3000),
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
    if (typeof parsed.system === 'string') safe.system = parsed.system;
    if (Array.isArray(parsed.tools)) safe.tools = parsed.tools;
    const body = JSON.stringify(safe);
    if (body.length > 1500000) return json(413, { error: 'Richiesta troppo grande' });

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
    });

    const text = await upstream.text();

    // Se la risposta è errore, includi extra info per debug
    if (!upstream.ok) {
      let parsed = {};
      try { parsed = JSON.parse(text); } catch (_) {}
      const anthropicMsg = parsed?.error?.message || parsed?.message || text || 'errore sconosciuto';
      return new Response(
        JSON.stringify({
          error: `Anthropic ${upstream.status}: ${anthropicMsg}`,
          anthropic_status: upstream.status,
          anthropic_response: parsed,
        }),
        {
          status: upstream.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    await gate.bump();
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Proxy: ' + (error?.message || 'errore sconosciuto') }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export const config = {
  path: '/api/anthropic',
};
