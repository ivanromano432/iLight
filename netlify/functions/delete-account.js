// Cancellazione completa dell'account utente.
// POST /api/delete-account
// Header: Authorization: Bearer <jwt_utente>
// Response: { success: true } oppure { error }
//
// Flusso:
// 1. Verifica il JWT dell'utente e ne estrae l'user_id (solo l'utente stesso può cancellarsi)
// 2. Cancella eventuale subscription Stripe attiva
// 3. Cancella le foto pasti dallo storage Supabase (bucket meal-photos, prefisso {user_id}/)
// 4. Cancella l'utente da auth.users → tutte le 13 tabelle utente in CASCADE
//
// Garanzia GDPR art. 17 (diritto all'oblio).

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'metodo non consentito' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const supaUrl = (process.env.SUPABASE_URL || 'https://lssvedghyqshhuvyuspw.supabase.co').trim();
  const supaService = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();

  if (!supaService) {
    return new Response(JSON.stringify({ error: 'configurazione server mancante (SUPABASE_SERVICE_ROLE_KEY)' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    // 1. Verifica JWT utente
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'token mancante (Authorization: Bearer ...)' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Client admin (service role) — bypassa RLS
    const supaAdmin = createClient(supaUrl, supaService, { auth: { persistSession: false } });

    // Verifica il token e ricava l'user_id
    const { data: userData, error: userErr } = await supaAdmin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'token non valido o scaduto' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email;
    console.log(`[delete-account] richiesta cancellazione per user_id=${userId} email=${userEmail}`);

    // 2. Cancella eventuale subscription Stripe
    let stripeResult = 'skipped (no stripe customer)';
    if (stripeKey) {
      try {
        const { data: profile } = await supaAdmin
          .from('profiles')
          .select('stripe_customer_id, stripe_subscription_id')
          .eq('id', userId)
          .single();

        if (profile?.stripe_subscription_id) {
          const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
          try {
            await stripe.subscriptions.cancel(profile.stripe_subscription_id);
            stripeResult = `subscription ${profile.stripe_subscription_id} cancellata`;
          } catch (e) {
            // Forse era già cancellata o scaduta — log ma proseguo
            stripeResult = `errore non bloccante: ${e.message}`;
            console.warn('[delete-account] stripe cancel error', e.message);
          }
        } else if (profile?.stripe_customer_id) {
          stripeResult = `customer ${profile.stripe_customer_id} senza subscription attiva`;
        }
      } catch (e) {
        console.warn('[delete-account] impossibile leggere profile per stripe', e.message);
      }
    }

    // 3. Cancella le foto pasti dallo Storage (bucket meal-photos, prefisso {userId}/)
    let storageResult = 'nessuna foto';
    try {
      const { data: files, error: listErr } = await supaAdmin.storage
        .from('meal-photos')
        .list(userId, { limit: 1000 });
      if (listErr) {
        console.warn('[delete-account] storage list error', listErr.message);
      } else if (files && files.length > 0) {
        const paths = files.map(f => `${userId}/${f.name}`);
        const { error: rmErr } = await supaAdmin.storage.from('meal-photos').remove(paths);
        if (rmErr) {
          console.warn('[delete-account] storage remove error', rmErr.message);
          storageResult = `errore non bloccante: ${rmErr.message}`;
        } else {
          storageResult = `${paths.length} foto eliminate`;
        }
      }
    } catch (e) {
      console.warn('[delete-account] storage exception', e.message);
    }

    // 4. Cancella l'utente da auth.users → cascade su tutte le 13 tabelle
    const { error: deleteErr } = await supaAdmin.auth.admin.deleteUser(userId);
    if (deleteErr) {
      console.error('[delete-account] auth.admin.deleteUser error', deleteErr);
      return new Response(JSON.stringify({ error: `errore nella cancellazione: ${deleteErr.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log(`[delete-account] ✓ utente ${userId} cancellato. stripe=${stripeResult}, storage=${storageResult}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Account e tutti i dati associati sono stati eliminati.',
      details: { stripe: stripeResult, storage: storageResult },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('[delete-account] eccezione', err);
    return new Response(JSON.stringify({ error: err.message || 'errore sconosciuto' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

export const config = { path: '/api/delete-account' };
