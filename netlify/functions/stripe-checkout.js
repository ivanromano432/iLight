// Crea una sessione Checkout di Stripe per l'utente loggato.
// POST /api/stripe-checkout
// Body: { plan: 'monthly' | 'yearly', userId, userEmail }
// Response: { url } da redirigere

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Piano base "GoalFit" (6,90 €/mese, 69 €/anno) e "GoalFit Premium" (9,90 €/mese, 99 €/anno)
const PRICES = {
  base:    { monthly: 'price_1UMt5aIbdF4Z4tGLGUaJMizx', yearly: 'price_1UMt5cIbdF4Z4tGLKMGw5mlu' },
  premium: { monthly: 'price_1UMt5qIbdF4Z4tGLGLsTPGgE', yearly: 'price_1UMt5tIbdF4Z4tGLenIm3Rzg' },
};

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
    return new Response(JSON.stringify({ error: 'metodo non consentito' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  const supaUrl = (process.env.SUPABASE_URL || 'https://lssvedghyqshhuvyuspw.supabase.co').trim();
  const supaService = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!stripeKey || !supaService) {
    return new Response(JSON.stringify({ error: 'configurazione server mancante (STRIPE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY)' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const { plan } = body;
    const tier = body.tier === 'premium' ? 'premium' : 'base';
    if (!plan) {
      return new Response(JSON.stringify({ error: 'parametri mancanti' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const price = PRICES[tier][plan === 'yearly' ? 'yearly' : 'monthly'];

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
    const supa = createClient(supaUrl, supaService, { auth: { persistSession: false } });

    // L'utente è quello della sessione, non quello dichiarato nella richiesta
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const { data: u, error: uErr } = token ? await supa.auth.getUser(token) : { data: null, error: true };
    const userId = u?.user?.id; const userEmail = u?.user?.email;
    if (uErr || !userId || !userEmail) {
      return new Response(JSON.stringify({ error: 'Sessione scaduta: chiudi e riapri l\'app.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // Recupera o crea customer Stripe
    const { data: profile } = await supa.from('profiles').select('stripe_customer_id').eq('id', userId).single();
    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
      await supa.from('profiles').update({ stripe_customer_id: customerId }).eq('id', userId);
    }

    const origin = req.headers.get('origin') || 'https://goalfit.it';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/?sub=success`,
      cancel_url: `${origin}/?sub=cancel`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      locale: 'it',
      subscription_data: {
        metadata: { supabase_user_id: userId, plan: tier },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('[stripe-checkout]', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
};

export const config = { path: '/api/stripe-checkout' };