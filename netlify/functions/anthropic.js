// Netlify Function v2 — proxy alle API Anthropic con diagnostica
// Esposta su /api/anthropic
//
// GET /api/anthropic           → restituisce diagnostica (verifica key/env senza esporla)
// POST /api/anthropic          → inoltra il body al vero endpoint Anthropic
// OPTIONS /api/anthropic       → CORS preflight

export default async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Leggi la API key (e fai trim difensivo per eventuali whitespace/newline)
  // NOTA: usiamo MY_ANTHROPIC_KEY perché ANTHROPIC_API_KEY è riservata
  // a Netlify Claude Agent, che la sovrascriverebbe automaticamente.
  const rawKey = process.env.MY_ANTHROPIC_KEY || '';
  const apiKey = rawKey.trim();

  // === GET = diagnostica (NON espone la key intera) ===
  if (req.method === 'GET') {
    const diag = {
      configured: !!apiKey,
      raw_length: rawKey.length,
      trimmed_length: apiKey.length,
      had_whitespace: rawKey.length !== apiKey.length,
      prefix: apiKey.slice(0, 14),                  // es. "sk-ant-api03-X" (pubblico, non sensibile)
      suffix_last4: apiKey.slice(-4),               // ultimi 4 (per identificare quale key è)
      starts_correctly: apiKey.startsWith('sk-ant-api03-'),
      node_version: process.version,
      timestamp: new Date().toISOString(),
    };
    return new Response(JSON.stringify(diag, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
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

  try {
    const body = await req.text();

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
          key_prefix: apiKey.slice(0, 14),
          key_suffix: apiKey.slice(-4),
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
