// Collegamento a WHOOP.
// POST /api/whoop  { action: 'status' | 'start' | 'sync' | 'disconnect' }  (richiede la sessione dell'utente)
// GET  /api/whoop/callback?code=…&state=…   (ritorno dall'autorizzazione WHOOP)
//
// Variabili d'ambiente: WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET (dal portale sviluppatori WHOOP),
// SUPABASE_SERVICE_ROLE_KEY. Indirizzo di ritorno da registrare su WHOOP: https://goalfit.it/api/whoop/callback
import { createClient } from '@supabase/supabase-js';

const AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const API = 'https://api.prod.whoop.com/developer/v2';
const REDIRECT = 'https://goalfit.it/api/whoop/callback';
const SCOPES = 'offline read:sleep read:workout read:recovery read:cycles';
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
const back = (q) => new Response(null, { status: 302, headers: { Location: 'https://goalfit.it/?whoop=' + q } });

const pad = n => String(n).padStart(2, '0');
// Ora locale dell'utente a partire dall'istante UTC e dallo scarto orario dato da WHOOP (es. "+02:00")
function local(iso, offset) {
  const m = String(offset || '+00:00').match(/^([+-])(\d{2}):?(\d{2})$/);
  const mins = m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0;
  const d = new Date(new Date(iso).getTime() + mins * 60000);
  return { day: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` };
}

async function tokenRequest(params) {
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error('WHOOP token ' + res.status + ' ' + (data.error_description || data.error || ''));
  return data;
}

async function collection(path, token, startIso) {
  const out = []; let next = null;
  for (let i = 0; i < 4; i++) {
    const q = new URLSearchParams({ limit: '25', start: startIso }); if (next) q.set('nextToken', next);
    const res = await fetch(`${API}${path}?${q}`, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) throw new Error('WHOOP ' + path + ' ' + res.status);
    const data = await res.json();
    out.push(...(data.records || []));
    next = data.next_token || data.nextToken || null;
    if (!next) break;
  }
  return out;
}

export default async (req) => {
  const clientId = (process.env.WHOOP_CLIENT_ID || '').trim();
  const clientSecret = (process.env.WHOOP_CLIENT_SECRET || '').trim();
  const supaUrl = (process.env.SUPABASE_URL || 'https://lssvedghyqshhuvyuspw.supabase.co').trim();
  const supaService = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const configured = !!(clientId && clientSecret && supaService);
  const supa = supaService ? createClient(supaUrl, supaService, { auth: { persistSession: false } }) : null;
  const url = new URL(req.url);

  // --- Ritorno da WHOOP dopo l'autorizzazione ---
  if (req.method === 'GET') {
    if (!configured) return back('errore');
    const code = url.searchParams.get('code'); const state = url.searchParams.get('state');
    if (!code || !state) return back('annullato');
    try {
      const { data: st } = await supa.from('whoop_states').select('user_id, created_at').eq('state', state).maybeSingle();
      await supa.from('whoop_states').delete().eq('state', state);
      if (!st || Date.now() - new Date(st.created_at).getTime() > 15 * 60000) return back('scaduto');
      const t = await tokenRequest({ grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT });
      await supa.from('whoop_tokens').upsert({ user_id: st.user_id, access_token: t.access_token, refresh_token: t.refresh_token || null, expires_at: new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString(), connected_at: new Date().toISOString(), last_sync_at: null });
      return back('ok');
    } catch (e) { console.error('[whoop] callback', e); return back('errore'); }
  }

  if (req.method !== 'POST') return json(405, { error: 'Metodo non consentito' });
  if (!supa) return json(500, { error: 'Servizio non configurato' });
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const { data: u } = token ? await supa.auth.getUser(token) : { data: null };
  const userId = u?.user?.id;
  if (!userId) return json(401, { error: 'Sessione scaduta: chiudi e riapri l\'app.' });
  let body = {}; try { body = await req.json(); } catch (_) {}
  const action = body.action;

  const { data: tok } = await supa.from('whoop_tokens').select('*').eq('user_id', userId).maybeSingle();

  if (action === 'status') return json(200, { configured, connected: !!tok, last_sync_at: tok?.last_sync_at || null });

  if (action === 'disconnect') {
    await supa.from('whoop_tokens').delete().eq('user_id', userId);
    await supa.from('whoop_daily').delete().eq('user_id', userId);
    return json(200, { connected: false });
  }

  if (!configured) return json(503, { error: 'Il collegamento a WHOOP non è ancora attivo.' });

  if (action === 'start') {
    const state = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
    await supa.from('whoop_states').delete().eq('user_id', userId);
    await supa.from('whoop_states').insert({ state, user_id: userId });
    const q = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, scope: SCOPES, state });
    return json(200, { url: `${AUTH_URL}?${q}` });
  }

  if (action === 'sync') {
    if (!tok) return json(409, { error: 'WHOOP non è collegato.' });
    try {
      let access = tok.access_token;
      if (new Date(tok.expires_at).getTime() < Date.now() + 60000) {
        if (!tok.refresh_token) { await supa.from('whoop_tokens').delete().eq('user_id', userId); return json(409, { error: 'Il collegamento a WHOOP è scaduto: collegalo di nuovo.', reconnect: true }); }
        let t;
        try { t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: tok.refresh_token, client_id: clientId, client_secret: clientSecret, scope: 'offline' }); }
        catch (e) { await supa.from('whoop_tokens').delete().eq('user_id', userId); return json(409, { error: 'Il collegamento a WHOOP è scaduto: collegalo di nuovo.', reconnect: true }); }
        access = t.access_token;
        await supa.from('whoop_tokens').update({ access_token: t.access_token, refresh_token: t.refresh_token || tok.refresh_token, expires_at: new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString() }).eq('user_id', userId);
      }
      const startIso = new Date(Date.now() - 21 * 86400000).toISOString();
      const [sl, wo, rec, cyc] = await Promise.all([
        collection('/activity/sleep', access, startIso), collection('/activity/workout', access, startIso),
        collection('/recovery', access, startIso), collection('/cycle', access, startIso),
      ]);
      const qual = p => p == null ? 3 : p >= 90 ? 5 : p >= 80 ? 4 : p >= 65 ? 3 : p >= 50 ? 2 : 1;
      const sleeps = sl.filter(s => !s.nap && s.start && s.end).map(s => {
        const a = local(s.start, s.timezone_offset), b = local(s.end, s.timezone_offset);
        return { id: s.id, wakeDate: b.day, bedtime: a.time, waketime: b.time, quality: qual(s.score?.sleep_performance_percentage), performance: s.score?.sleep_performance_percentage ?? null };
      });
      const workouts = wo.filter(w => w.start && w.end).map(w => {
        const a = local(w.start, w.timezone_offset);
        return { id: w.id, ts: w.start, day: a.day, sport: w.sport_name || 'attività', minutes: Math.max(1, Math.round((new Date(w.end) - new Date(w.start)) / 60000)), km: w.score?.distance_meter ? Math.round(w.score.distance_meter / 10) / 100 : null, kcal: w.score?.kilojoule ? Math.round(w.score.kilojoule / 4.184) : null, strain: w.score?.strain != null ? Math.round(w.score.strain * 10) / 10 : null };
      });
      // Dati del giorno: recupero (giorno del risveglio), sforzo e passi del ciclo
      const sleepDay = {}; sl.forEach(s => { if (s.end) sleepDay[s.id] = local(s.end, s.timezone_offset).day; });
      const cycleDay = {}; const daily = {};
      rec.forEach(r => { const d = sleepDay[r.sleep_id] || (r.created_at ? r.created_at.slice(0, 10) : null); if (!d) return; cycleDay[r.cycle_id] = d; if (r.score) daily[d] = { ...(daily[d] || {}), recovery: r.score.recovery_score != null ? Math.round(r.score.recovery_score) : null, hrv: r.score.hrv_rmssd_milli != null ? Math.round(r.score.hrv_rmssd_milli * 10) / 10 : null, resting_hr: r.score.resting_heart_rate != null ? Math.round(r.score.resting_heart_rate) : null }; });
      cyc.forEach(c => { const d = cycleDay[c.id] || (c.start ? local(new Date(new Date(c.start).getTime() + 8 * 3600000).toISOString(), c.timezone_offset).day : null); if (!d) return; daily[d] = { ...(daily[d] || {}), strain: c.score?.strain != null ? Math.round(c.score.strain * 10) / 10 : null, steps: c.step_count != null ? Math.round(c.step_count) : null }; });
      const rows = Object.keys(daily).map(d => ({ user_id: userId, day: d, recovery: daily[d].recovery ?? null, hrv: daily[d].hrv ?? null, resting_hr: daily[d].resting_hr ?? null, strain: daily[d].strain ?? null, steps: daily[d].steps ?? null }));
      if (rows.length) await supa.from('whoop_daily').upsert(rows, { onConflict: 'user_id,day' });
      const now = new Date().toISOString();
      await supa.from('whoop_tokens').update({ last_sync_at: now }).eq('user_id', userId);
      return json(200, { sleeps, workouts, days: rows.length, last_sync_at: now });
    } catch (e) {
      console.error('[whoop] sync', e);
      return json(502, { error: 'WHOOP non ha risposto. Riprova tra poco.' });
    }
  }
  return json(400, { error: 'Azione non valida' });
};

export const config = { path: ['/api/whoop', '/api/whoop/callback'] };
