// Scheduled Netlify Function: gira ogni ora e invia promemoria push agli utenti
// che hanno attivato le rispettive notifiche per l'ora corrente.
//
// Schedule: ogni ora al minuto 0 (cron: '0 * * * *')
// Configurato nel netlify.toml: [functions.send-reminders] schedule = "0 * * * *"
//
// Tre tipi di promemoria:
//  - morning  (default 8:00): "Buongiorno, ricordati di pesarti ✦"
//  - afternoon (default 13:00): "È ora di una pausa acqua 💧"
//  - evening  (default 20:00): "Una nota nel diario per chiudere la giornata ⟡"

import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const REMINDERS = {
  morning: {
    column: 'notif_morning_enabled',
    hourColumn: 'notif_morning_hour',
    title: 'Buongiorno ✦',
    body: 'Ricordati di pesarti per iniziare la giornata.',
    url: '/',
  },
  afternoon: {
    column: 'notif_afternoon_enabled',
    hourColumn: 'notif_afternoon_hour',
    title: 'Pausa acqua 💧',
    body: 'Quanti bicchieri hai bevuto finora? Tocca per aggiornare.',
    url: '/',
  },
  evening: {
    column: 'notif_evening_enabled',
    hourColumn: 'notif_evening_hour',
    title: 'Diario di sera ⟡',
    body: 'Una nota per chiudere la giornata, l\'IA fa il resto.',
    url: '/',
  },
};

export default async (req) => {
  const supaUrl = (process.env.SUPABASE_URL || 'https://lssvedghyqshhuvyuspw.supabase.co').trim();
  const supaService = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const vapidPublic = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const vapidPrivate = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const vapidSubject = (process.env.VAPID_SUBJECT || 'mailto:ivanromano@romanoformazionesas.com').trim();

  if (!supaService || !vapidPublic || !vapidPrivate) {
    console.error('[send-reminders] config mancante');
    return new Response('config missing', { status: 500 });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const supa = createClient(supaUrl, supaService, { auth: { persistSession: false } });

  // Ora corrente in UTC. Per ora gestiamo solo Europe/Rome (+1/+2): se il deploy
  // verrà esteso ad altri fusi, qui andrà aggiunto un campo timezone nel profilo.
  // Calcolo offset Italia: in DST (last Sun di Marzo → last Sun di Ottobre) è +2, altrimenti +1.
  const now = new Date();
  const m = now.getUTCMonth(); // 0=Jan, 11=Dec
  const isDST = m > 2 && m < 10; // approssimazione: Apr-Oct (più semplice che calcolare l'ultima domenica)
  const offsetHours = isDST ? 2 : 1;
  const localHour = (now.getUTCHours() + offsetHours) % 24;

  console.log(`[send-reminders] tick: UTC=${now.toISOString()}, localHour=${localHour}`);

  let totalSent = 0;
  let totalFailed = 0;

  // Per ogni tipo di reminder
  for (const [key, cfg] of Object.entries(REMINDERS)) {
    // Trova utenti con questo reminder attivo all'ora corrente
    const { data: profiles, error: profErr } = await supa
      .from('profiles')
      .select(`id, ${cfg.column}, ${cfg.hourColumn}`)
      .eq(cfg.column, true)
      .eq(cfg.hourColumn, localHour);

    if (profErr) {
      console.error(`[send-reminders] errore profili ${key}`, profErr);
      continue;
    }
    if (!profiles || profiles.length === 0) continue;

    const userIds = profiles.map(p => p.id);
    console.log(`[send-reminders] ${key} → ${userIds.length} utenti`);

    // Recupera tutte le subscription per questi utenti
    const { data: subs, error: subErr } = await supa
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', userIds);
    if (subErr || !subs) {
      console.error('[send-reminders] errore subs', subErr);
      continue;
    }

    // Invia in parallelo (Promise.allSettled per non bloccare su errori singoli)
    const results = await Promise.allSettled(subs.map(s => sendOne(s, cfg, supa)));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value === true) totalSent++;
      else totalFailed++;
    }
  }

  console.log(`[send-reminders] done: sent=${totalSent}, failed=${totalFailed}`);
  return new Response(JSON.stringify({ sent: totalSent, failed: totalFailed, localHour }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

async function sendOne(sub, cfg, supa) {
  const payload = JSON.stringify({
    title: cfg.title,
    body: cfg.body,
    url: cfg.url,
    tag: `goalfit-${cfg.title}`,
  });
  try {
    await webpush.sendNotification({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    }, payload);
    // Marca last_sent_at (non bloccante)
    supa.from('push_subscriptions').update({ last_sent_at: new Date().toISOString() }).eq('id', sub.id).then(() => {});
    return true;
  } catch (e) {
    // 410 Gone / 404 Not Found → subscription scaduta, la cancelliamo
    if (e.statusCode === 410 || e.statusCode === 404) {
      console.log(`[send-reminders] subscription scaduta ${sub.endpoint.substring(0, 50)}... → cancello`);
      try { await supa.from('push_subscriptions').delete().eq('id', sub.id); } catch (_) {}
    } else {
      console.warn(`[send-reminders] errore invio: ${e.statusCode || '?'} ${e.message}`);
    }
    return false;
  }
}

// Schedule cron: ogni ora al minuto 0
export const config = {
  schedule: '0 * * * *',
};
