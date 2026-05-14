// Crea una sessione Customer Portal di Stripe per gestire l'abbonamento
// (annullare, cambiare metodo di pagamento, vedere ricevute).
// POST /api/stripe-portal
// Body: { userId }
// Response: { url }

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'metodo non consentito' }), { status: 405 });
  }

  const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  const supaUrl = (process.env.SUPABASE_URL || 'https://lssvedghyqshhuvyuspw.supabase.co').trim();
  const supaService = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!stripeKey || !supaService) {
    return new Response(JSON.stringify({ error: 'configurazione server mancante' }), { status: 500 });
  }

  try {
    const { userId } = await req.json();
    if (!userId) return new Response(JSON.stringify({ error: 'userId mancante' }), { status: 400 });

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
    const supa = createClient(supaUrl, supaService, { auth: { persistSession: false } });

    const { data: profile } = await supa.from('profiles').select('stripe_customer_id').eq('id', userId).single();
    if (!profile?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: 'nessun customer Stripe trovato. Abbonati prima.' }), { status: 400 });
    }

    const origin = req.headers.get('origin') || 'https://goalfit.it';
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('[stripe-portal]', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
};

export const config = { path: '/api/stripe-portal' };