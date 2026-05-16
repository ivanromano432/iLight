// Salva una Web Push subscription nel database.
// POST /api/push-subscribe
// Headers: Authorization: Bearer <jwt>
// Body: { endpoint, p256dh, auth, user_agent }

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'metodo non consentito' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const supaUrl = (process.env.SUPABASE_URL || 'https://lssvedghyqshhuvyuspw.supabase.co').trim();
  const supaService = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supaService) {
    return new Response(JSON.stringify({ error: 'config server' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return new Response(JSON.stringify({ error: 'token mancante' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const supa = createClient(supaUrl, supaService, { auth: { persistSession: false } });

    const { data: userData, error: userErr } = await supa.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'token non valido' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { endpoint, p256dh, auth, user_agent } = body || {};
    if (!endpoint || !p256dh || !auth) {
      return new Response(JSON.stringify({ error: 'campi mancanti' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Upsert sull'endpoint (UNIQUE): se la stessa subscription esiste già, aggiorno user_id
    const { error: upErr } = await supa.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: user_agent || null,
    }, { onConflict: 'endpoint' });

    if (upErr) {
      console.error('[push-subscribe] db error', upErr);
      return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
};

export const config = { path: '/api/push-subscribe' };
