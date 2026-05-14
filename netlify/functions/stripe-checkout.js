// Crea una sessione Checkout di Stripe per l'utente loggato.
// POST /api/stripe-checkout
// Body: { plan: 'monthly' | 'yearly', userId, userEmail }
// Response: { url } da redirigere

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const PRICE_MONTHLY = 'price_1TX6HlIbdF4Z4tGLeZWDcIVf';
const PRICE_YEARLY = 'price_1TX6HrIbdF4Z4tGLDZdSR3K5';

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
    const { plan, userId, userEmail } = body;
    if (!userId || !userEmail || !plan) {
      return new Response(JSON.stringify({ error: 'parametri mancanti' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const price = plan === 'yearly' ? PRICE_YEARLY : PRICE_MONTHLY;

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
    const supa = createClient(supaUrl, supaService, { auth: { persistSession: false } });

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
        metadata: { supabase_user_id: userId },
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