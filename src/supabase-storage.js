// Backend di window.storage basato su Supabase.
//
// Sostituisce il polyfill localStorage SOLO per le chiavi delle tabelle migrate.
// Le altre chiavi continuano a usare localStorage (migrazione incrementale).
//
// Quando l'utente fa login, AuthGate chiama `setCurrentUserId()` con il suo UUID,
// poi `installSupabaseStorage()` per rimpiazzare window.storage globalmente.

import { supabase } from './supabase.js';

let currentUserId = null;

export function setCurrentUserId(id) {
  currentUserId = id;
}

// ───────────────────────────────────────────────────────────────
// CONVERSIONE DATE
// L'app usa internamente "YYYY-M-D" con mese 0-indicizzato (es. "2026-4-13" = 13 maggio 2026).
// Postgres DATE vuole "YYYY-MM-DD" con mese 1-indicizzato (es. "2026-05-13").
// Queste due helper convertono i formati nelle due direzioni.
// ───────────────────────────────────────────────────────────────
function appKeyToPgDate(k){
  if (!k) return null;
  const parts = String(k).split('-').map(Number);
  if (parts.length !== 3) return null;
  const [y, m0, d] = parts;
  if (!y || isNaN(m0) || !d) return null;
  const m = m0 + 1; // 0-idx → 1-idx
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function pgDateToAppKey(s){
  if (!s) return null;
  const parts = String(s).split('-').map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  if (!y || isNaN(m) || !d) return null;
  return `${y}-${m-1}-${d}`; // 1-idx → 0-idx
}

// ───────────────────────────────────────────────────────────────
// HANDLERS: per ogni "chiave" dell'app, definisco come leggere e
// scrivere dalla tabella Supabase corrispondente, mantenendo lo
// stesso formato che App.jsx si aspetta (stringa JSON o numero).
// ───────────────────────────────────────────────────────────────

const HANDLERS = {

  // ── PROFILES ──
  'goal': {
    async get(uid) {
      const { data, error } = await supabase.from('profiles').select('goal_weight').eq('id', uid).maybeSingle();
      if (error) throw error;
      return data?.goal_weight != null ? String(data.goal_weight) : null;
    },
    async set(uid, valueStr) {
      const num = parseFloat(valueStr);
      const goal_weight = isNaN(num) ? null : num;
      const { error } = await supabase.from('profiles').update({ goal_weight, updated_at: new Date().toISOString() }).eq('id', uid);
      if (error) throw error;
    },
  },

  'watergoal': {
    async get(uid) {
      const { data, error } = await supabase.from('profiles').select('water_goal').eq('id', uid).maybeSingle();
      if (error) throw error;
      return data?.water_goal != null ? String(data.water_goal) : null;
    },
    async set(uid, valueStr) {
      const num = parseInt(valueStr);
      const water_goal = isNaN(num) ? 8 : num;
      const { error } = await supabase.from('profiles').update({ water_goal, updated_at: new Date().toISOString() }).eq('id', uid);
      if (error) throw error;
    },
  },

  // ── WEIGHTS ──
  'weights': {
    async get(uid) {
      const { data, error } = await supabase.from('weights').select('id, ts, kg').eq('user_id', uid).order('ts', { ascending: true });
      if (error) throw error;
      const arr = (data || []).map(r => ({ id: r.id, ts: r.ts, kg: Number(r.kg) }));
      return JSON.stringify(arr);
    },
    async set(uid, valueStr) {
      let newArr = [];
      try { newArr = JSON.parse(valueStr) || []; } catch (_) { newArr = []; }
      if (!Array.isArray(newArr)) newArr = [];

      // Diff: trova ID da cancellare, upsert il resto
      const { data: currentRows } = await supabase.from('weights').select('id').eq('user_id', uid);
      const currentIds = new Set((currentRows || []).map(r => r.id));
      const newIds = new Set(newArr.map(r => r.id));
      const toDelete = [...currentIds].filter(id => !newIds.has(id));

      if (toDelete.length > 0) {
        const { error } = await supabase.from('weights').delete().eq('user_id', uid).in('id', toDelete);
        if (error) throw error;
      }
      if (newArr.length > 0) {
        const rows = newArr.map(r => ({ id: r.id, user_id: uid, ts: r.ts, kg: r.kg }));
        const { error } = await supabase.from('weights').upsert(rows);
        if (error) throw error;
      }
    },
  },

  // ── SLEEPS ──
  'sleeps': {
    async get(uid) {
      const { data, error } = await supabase.from('sleeps').select('id, wake_date, bedtime, waketime, quality, notes').eq('user_id', uid).order('wake_date', { ascending: true });
      if (error) throw error;
      const arr = (data || []).map(r => ({
        id: r.id,
        wakeDate: pgDateToAppKey(r.wake_date), // converte da "2026-05-13" a "2026-4-13"
        bedtime: r.bedtime,
        waketime: r.waketime,
        quality: r.quality,
        notes: r.notes || '',
      })).filter(r => r.wakeDate); // scarta righe con wakeDate non parsabile
      return JSON.stringify(arr);
    },
    async set(uid, valueStr) {
      let newArr = [];
      try { newArr = JSON.parse(valueStr) || []; } catch (_) { newArr = []; }
      if (!Array.isArray(newArr)) newArr = [];

      const { data: currentRows } = await supabase.from('sleeps').select('id').eq('user_id', uid);
      const currentIds = new Set((currentRows || []).map(r => r.id));
      const newIds = new Set(newArr.map(r => r.id));
      const toDelete = [...currentIds].filter(id => !newIds.has(id));

      if (toDelete.length > 0) {
        const { error } = await supabase.from('sleeps').delete().eq('user_id', uid).in('id', toDelete);
        if (error) throw error;
      }
      if (newArr.length > 0) {
        const rows = newArr.map(r => ({
          id: r.id,
          user_id: uid,
          wake_date: appKeyToPgDate(r.wakeDate), // converte da "2026-4-13" a "2026-05-13"
          bedtime: r.bedtime || null,
          waketime: r.waketime || null,
          quality: (r.quality != null && !isNaN(r.quality)) ? r.quality : null,
          notes: r.notes || null,
        })).filter(r => r.wake_date); // scarta righe senza data valida
        if (rows.length > 0) {
          const { error } = await supabase.from('sleeps').upsert(rows);
          if (error) throw error;
        }
      }
    },
  },
};

// ───────────────────────────────────────────────────────────────
// FALLBACK localStorage (per chiavi non ancora migrate)
// ───────────────────────────────────────────────────────────────
function localGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
function localSet(k,v){ try{ localStorage.setItem(k,v); }catch(_){} }
function localDel(k){ try{ localStorage.removeItem(k); }catch(_){} }

// Chiavi su cui useremo localStorage finché non saranno migrate.
// Quelle gestite via Supabase vengono cancellate dal localStorage al login (vedi wipeMigratedLocalStorage).
const MIGRATED_KEYS = new Set(Object.keys(HANDLERS));

export function wipeMigratedLocalStorage(){
  // Esegue al login: cancella dal localStorage le chiavi gestite ora via Supabase
  // (opzione B scelta dall'utente: parti pulito dal cloud)
  for (const k of MIGRATED_KEYS) localDel(k);
}

export function installSupabaseStorage(){
  if (typeof window === 'undefined') return;
  window.storage = {
    async get(key) {
      const h = HANDLERS[key];
      if (h && currentUserId) {
        try {
          const value = await h.get(currentUserId);
          return value === null ? null : { key, value, shared: false };
        } catch (e) {
          console.error('[supabase-storage] get', key, e);
          return null;
        }
      }
      const value = localGet(key);
      return value === null ? null : { key, value, shared: false };
    },
    async set(key, value, shared = false) {
      const h = HANDLERS[key];
      if (h && currentUserId) {
        try {
          await h.set(currentUserId, value);
          return { key, value, shared };
        } catch (e) {
          console.error('[supabase-storage] set', key, e);
          return null;
        }
      }
      localSet(key, value);
      return { key, value, shared };
    },
    async delete(key, shared = false) {
      localDel(key);
      return { key, deleted: true, shared };
    },
    async list(prefix, shared = false) {
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!prefix || (k && k.startsWith(prefix))) keys.push(k);
        }
        return { keys, prefix, shared };
      } catch (_) {
        return { keys: [], prefix, shared };
      }
    },
  };
}
