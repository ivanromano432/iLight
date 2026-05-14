// Repo factory generico per tabelle Supabase con shape { id, user_id, ...columns }.
// Permette di rimpiazzare gradualmente i flussi localStorage con persistenza cloud,
// mantenendo l'API attuale dell'app (passare un array intero ad ogni update).

import { supabase } from './supabase.js';

/**
 * Crea un repository per una tabella Supabase.
 * @param {string} tableName - Nome della tabella (es. 'weights')
 * @param {string[]} columns - Colonne da leggere/scrivere (escluso id e user_id)
 * @param {string} [orderBy='ts'] - Colonna per ordinamento al load
 */
export function makeRepo(tableName, columns, orderBy = 'ts') {
  return {
    /**
     * Carica tutti i record di un utente.
     * Ritorna array vuoto se errore (l'app continua a funzionare).
     */
    async load(userId) {
      const { data, error } = await supabase
        .from(tableName)
        .select(['id', ...columns].join(','))
        .eq('user_id', userId)
        .order(orderBy, { ascending: true });
      if (error) {
        console.error(`[repo:${tableName}] load error:`, error);
        return [];
      }
      return data || [];
    },

    /**
     * Sincronizza differenze tra oldList e newList su Supabase.
     * Confronta per id: aggiunge nuovi, cancella mancanti, aggiorna modificati.
     */
    async sync(userId, oldList, newList) {
      const oldMap = new Map(oldList.map(x => [x.id, x]));
      const newMap = new Map(newList.map(x => [x.id, x]));

      const toAdd = newList.filter(x => !oldMap.has(x.id));
      const toDelete = oldList.filter(x => !newMap.has(x.id));
      const toUpdate = newList.filter(x => {
        const old = oldMap.get(x.id);
        if (!old) return false;
        // Cambiato se almeno una colonna è diversa (confronto loose per timestamp/numeri)
        return columns.some(c => String(old[c] ?? '') !== String(x[c] ?? ''));
      });

      const promises = [];

      if (toDelete.length > 0) {
        promises.push(
          supabase.from(tableName).delete().in('id', toDelete.map(x => x.id))
        );
      }

      if (toAdd.length > 0) {
        const rows = toAdd.map(x => {
          const row = { id: x.id, user_id: userId };
          for (const c of columns) row[c] = x[c] ?? null;
          return row;
        });
        promises.push(supabase.from(tableName).insert(rows));
      }

      for (const x of toUpdate) {
        const update = {};
        for (const c of columns) update[c] = x[c] ?? null;
        promises.push(
          supabase.from(tableName).update(update).eq('id', x.id).eq('user_id', userId)
        );
      }

      const results = await Promise.all(promises);
      const errors = [];
      for (const r of results) {
        if (r.error) {
          errors.push(r.error.message || JSON.stringify(r.error));
          console.error(`[repo:${tableName}] sync error:`, r.error.message, r.error);
        }
      }
      return { ok: errors.length === 0, errors };
    },
  };
}

// === Repository specifici ===

// weights: l'app usa { id, ts, weight, bodyFat, muscle, water } (camelCase, water = idratazione %)
// DB usa { id, ts, weight, body_fat, muscle, body_water } (snake_case, body_water più chiaro)
const _weightsCore = makeRepo('weights', ['ts', 'weight', 'body_fat', 'muscle', 'body_water']);
export const weightsRepo = {
  async load(userId) {
    const rows = await _weightsCore.load(userId);
    return rows.map(r => ({
      id: r.id,
      ts: r.ts,
      weight: r.weight != null ? Number(r.weight) : null,
      bodyFat: r.body_fat != null ? Number(r.body_fat) : null,
      muscle: r.muscle != null ? Number(r.muscle) : null,
      water: r.body_water != null ? Number(r.body_water) : null,
    }));
  },
  async sync(userId, oldList, newList) {
    const toDb = (item) => ({
      id: item.id,
      ts: item.ts,
      weight: item.weight ?? null,
      body_fat: item.bodyFat ?? null,
      muscle: item.muscle ?? null,
      body_water: item.water ?? null,
    });
    return _weightsCore.sync(userId, oldList.map(toDb), newList.map(toDb));
  },
};

// Profilo utente: una sola riga per utente, indicizzata da id (non user_id)
export const profileRepo = {
  async load(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, goal_weight, water_goal')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('[repo:profiles] load error:', error);
      return null;
    }
    return data;
  },

  async update(userId, fields) {
    const { error } = await supabase
      .from('profiles')
      .update(fields)
      .eq('id', userId);
    if (error) console.error('[repo:profiles] update error:', error);
  },
};
