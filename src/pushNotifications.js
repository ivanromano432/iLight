// Gestione push notifications lato client.
// - registerServiceWorker(): registra /sw.js
// - getPushStatus(): legge stato corrente (granted/denied/default, subscribed/no)
// - subscribePush(): chiede permesso, sottoscrive Web Push API, salva su Supabase
// - unsubscribePush(): annulla sottoscrizione locale + rimuove da Supabase

import { supabase } from './supabase.js';

// Chiave VAPID pubblica generata per GoalFit. PUÒ stare in chiaro (è pubblica per design).
// La chiave privata è solo sul server (Netlify env: VAPID_PRIVATE_KEY).
const VAPID_PUBLIC_KEY = 'BOYKYYpN0KDqvIbCNFi69aAAZnqK4kblzOzNmGs5IVUlIbqctfOFWs-eS6mZMJ90wykFWYigRvPt3xNRrFsdCtQ';

// Helper: converte base64url → Uint8Array (richiesto dalla Web Push API)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Verifica supporto: serve Service Worker + Notification API + PushManager
export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

// Registra il SW (idempotente, lo fa anche se già registrato)
export async function registerServiceWorker() {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (e) {
    console.error('SW registration failed', e);
    return null;
  }
}

// Stato attuale: { supported, permission, subscribed }
export async function getPushStatus() {
  if (!pushSupported()) {
    return { supported: false, permission: 'denied', subscribed: false };
  }
  const permission = Notification.permission; // 'default' | 'granted' | 'denied'
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    subscribed = !!sub;
  } catch (_) {}
  return { supported: true, permission, subscribed };
}

// Attiva push: chiede permesso → sottoscrive → salva su Supabase
// Ritorna { ok: true } o { ok: false, error: '...' }
export async function subscribePush() {
  if (!pushSupported()) return { ok: false, error: 'Browser non supportato. Su iPhone serve iOS 16.4+ con la PWA installata sulla schermata Home.' };

  try {
    // 1. Permesso
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
    }
    if (perm !== 'granted') {
      return { ok: false, error: 'Permesso negato. Apri le impostazioni del browser per riabilitarlo.' };
    }

    // 2. Service worker pronto
    await registerServiceWorker();
    const reg = await navigator.serviceWorker.ready;

    // 3. Sottoscrizione push (se già esiste, riusa)
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // 4. Estraggo le chiavi dalla subscription
    const json = sub.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return { ok: false, error: 'Sottoscrizione incompleta' };
    }

    // 5. Salvo su Supabase via Netlify function (così uso service role per bypassare RLS in INSERT)
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return { ok: false, error: 'Sessione non valida' };

    const res = await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
      }),
    });
    const result = await res.json();
    if (!res.ok || result.error) {
      return { ok: false, error: result.error || `Errore ${res.status}` };
    }

    return { ok: true };
  } catch (e) {
    console.error('subscribePush error', e);
    return { ok: false, error: e.message || 'Errore sconosciuto' };
  }
}

// Disattiva push: rimuove subscription locale + Supabase
export async function unsubscribePush() {
  if (!pushSupported()) return { ok: false, error: 'Non supportato' };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      // Cancello la riga da Supabase (l'utente può farlo direttamente con RLS DELETE policy)
      try {
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      } catch (e) {
        console.warn('Errore cancellazione subscription Supabase (non bloccante)', e);
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'Errore' };
  }
}
