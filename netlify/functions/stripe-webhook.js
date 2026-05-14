// Riceve eventi da Stripe e aggiorna profiles.subscription_status.
// POST /api/stripe-webhook
// Verifica la firma usando STRIPE_WEBHOOK_SECRET.
//
// Eventi gestiti:
// - checkout.session.completed: attivazione abbonamento
// - customer.subscription.updated/created: aggiorna stato e period end
// - customer.subscription.deleted: annullamento

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { path: '/api/stripe-webhook' };

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('metodo non consentito', { status: 405 });
  }
  const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  const supaUrl = (process.env.SUPABASE_URL || 'https://lssvedghyqshhuvyuspw.supabase.co').trim();
  const supaService = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!stripeKey || !webhookSecret || !supaService) {
    console.error('[stripe-webhook] configurazione mancante');
    return new Response('configurazione server mancante', { status: 500 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('manca firma', { status: 400 });

  const rawBody = await req.text();
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
  const supa = createClient(supaUrl, supaService, { auth: { persistSession: false } });

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] verifica firma fallita:', err.message);
    return new Response(`webhook signature invalid: ${err.message}`, { status: 400 });
  }

  try {
    const updateByCustomer = async (customerId, fields) => {
      const { error } = await supa.from('profiles').update(fields).eq('stripe_customer_id', customerId);
      if (error) console.error('[stripe-webhook] update fallito:', error.message);
    };

    const statusFromStripe = (s) => {
      // Stripe: active, past_due, unpaid, canceled, incomplete, incomplete_expired, trialing, paused
      if (s === 'active' || s === 'trialing') return 'active';
      if (s === 'past_due' || s === 'unpaid') return 'past_due';
      if (s === 'canceled' || s === 'incomplete_expired') return 'canceled';
      return 'none';
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          await updateByCustomer(session.customer, {
            stripe_subscription_id: sub.id,
            subscription_status: statusFromStripe(sub.status),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          });
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        await updateByCustomer(sub.customer, {
          stripe_subscription_id: sub.id,
          subscription_status: statusFromStripe(sub.status),
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await updateByCustomer(sub.customer, {
          subscription_status: 'canceled',
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        });
        break;
      }
      default:
        // ignora gli altri eventi
        break;
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[stripe-webhook] errore:', err);
    return new Response(`webhook error: ${err.message}`, { status: 500 });
  }
};
