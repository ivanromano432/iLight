// Collegamento a WHOOP lato app: chiamate al server e fusione dei dati in Sonno e Allenamenti.
import { supabase } from './supabase.js';

export async function whoopCall(action) {
  let token = '';
  try { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token || ''; } catch (_) {}
  const res = await fetch('/api/whoop', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action }) });
  let data = {}; try { data = await res.json(); } catch (_) {}
  if (!res.ok) return { error: data.error || 'Errore ' + res.status, ...data };
  return data;
}

// Dati del giorno (recupero, sforzo, passi) degli ultimi 30 giorni: li usa il coach
export async function loadWhoopDaily() {
  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase.from('whoop_daily').select('day,recovery,hrv,resting_hr,strain,steps').gte('day', from).order('day', { ascending: true });
  if (error) { console.error('[whoop] daily', error.message); return []; }
  return data || [];
}

const SPORT_IT = { running: 'Corsa', walking: 'Camminata', hiking: 'Escursione', cycling: 'Bici', 'mountain-biking': 'Mountain bike', spin: 'Spinning', swimming: 'Nuoto', weightlifting: 'Pesi', powerlifting: 'Pesi', 'functional-fitness': 'Allenamento funzionale', 'strength-trainer': 'Pesi', yoga: 'Yoga', pilates: 'Pilates', hiit: 'HIIT', rowing: 'Vogatore', elliptical: 'Ellittica', boxing: 'Boxe', tennis: 'Tennis', padel: 'Padel', soccer: 'Calcio', basketball: 'Basket', skiing: 'Sci', dance: 'Ballo', stretching: 'Stretching', meditation: 'Meditazione', activity: 'Attività' };
const DIST = ['running', 'walking', 'hiking', 'cycling', 'mountain-biking'];
const sportKey = s => String(s || 'activity').trim().toLowerCase().replace(/[\s_]+/g, '-');
const sportName = s => { const k = sportKey(s); if (SPORT_IT[k]) return SPORT_IT[k]; const t = k.replace(/-/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };

// Aggiunge notti e sessioni di WHOOP che nell'app non ci sono ancora. Non tocca quello che l'utente ha già inserito.
export function mergeWhoop(data, cur, newId) {
  const out = { nights: 0, sessions: 0 };
  let sleeps = cur.sleeps || [], workouts = cur.workouts || [], types = cur.workoutTypes || [];
  const haveDates = new Set(sleeps.map(s => s.wakeDate));
  const newSleeps = [];
  for (const s of data.sleeps || []) {
    if (!s.wakeDate || haveDates.has(s.wakeDate)) continue;
    haveDates.add(s.wakeDate);
    newSleeps.push({ id: s.id || newId(), wakeDate: s.wakeDate, bedtime: s.bedtime, waketime: s.waketime, quality: s.quality || 3, notes: 'da WHOOP' + (s.performance != null ? ` · resa ${Math.round(s.performance)}%` : '') });
  }
  if (newSleeps.length) { out.sleeps = [...sleeps, ...newSleeps]; out.nights = newSleeps.length; }
  const haveIds = new Set(workouts.map(w => w.id));
  const newW = []; let typesChanged = false;
  for (const w of data.workouts || []) {
    if (!w.id || haveIds.has(w.id)) continue;
    haveIds.add(w.id);
    const useKm = w.km > 0 && DIST.includes(sportKey(w.sport));
    const unit = useKm ? 'km' : 'min';
    const name = sportName(w.sport);
    let type = types.find(t => t.name.toLowerCase() === name.toLowerCase() && t.unit === unit);
    if (!type) {
      const clash = types.some(t => t.name.toLowerCase() === name.toLowerCase());
      type = { id: newId(), name: clash ? `${name} (${unit})` : name, unit };
      const again = types.find(t => t.name.toLowerCase() === type.name.toLowerCase() && t.unit === unit);
      if (again) type = again; else { types = [...types, type]; typesChanged = true; }
    }
    newW.push({ id: w.id, ts: w.ts, typeId: type.id, qty: useKm ? w.km : w.minutes, notes: 'WHOOP' + (useKm ? ` · ${w.minutes} min` : '') + (w.strain != null ? ` · sforzo ${w.strain}` : '') + (w.kcal ? ` · ${w.kcal} kcal` : '') });
  }
  if (typesChanged) out.workoutTypes = types;
  if (newW.length) { out.workouts = [...workouts, ...newW]; out.sessions = newW.length; }
  return out;
}
