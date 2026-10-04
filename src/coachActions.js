// Azioni del coach: l'IA propone modifiche ai dati dell'app, l'utente le approva in un pop-up.
// Qui: gli strumenti dichiarati all'IA e la traduzione delle sue proposte in modifiche concrete.

const num = { type: 'number' };
const str = { type: 'string' };
const day = { type: 'string', description: 'Giorno nel formato AAAA-MM-GG' };
const mealType = { type: 'string', enum: ['colazione', 'spuntino_m', 'pranzo', 'merenda', 'cena', 'spuntino_s'] };
const tool = (name, description, properties, required = []) => ({ name, description, input_schema: { type: 'object', properties, required } });

export const COACH_TOOLS = [
  tool('registra_pasto', 'Aggiunge un pasto mangiato. Stima tu quantità, calorie e nutrienti se l\'utente non li dice.', { giorno: day, tipo: mealType, descrizione: str, quantita_g: num, kcal: num, proteine_g: num, carboidrati_g: num, grassi_g: num }, ['giorno', 'tipo', 'descrizione', 'kcal']),
  tool('modifica_pasto', 'Corregge un pasto esistente. Usa il codice (es. P3) dall\'elenco dei pasti recenti. Indica solo i campi da cambiare.', { codice: str, tipo: mealType, descrizione: str, quantita_g: num, kcal: num, proteine_g: num, carboidrati_g: num, grassi_g: num }, ['codice']),
  tool('elimina_pasto', 'Elimina un pasto esistente, indicato con il suo codice (es. P3).', { codice: str }, ['codice']),
  tool('registra_sonno', 'Registra o corregge una notte. Se per quella data di risveglio c\'è già una notte, la corregge.', { data_risveglio: day, a_letto: { type: 'string', description: 'HH:MM' }, sveglia: { type: 'string', description: 'HH:MM' }, qualita: { type: 'integer', minimum: 1, maximum: 5 } }, ['data_risveglio']),
  tool('registra_peso', 'Registra il peso di un giorno. Se quel giorno c\'è già una pesata, la corregge.', { giorno: day, peso_kg: num }, ['giorno', 'peso_kg']),
  tool('imposta_obiettivo_peso', 'Imposta o cambia il peso obiettivo.', { peso_kg: num }, ['peso_kg']),
  tool('imposta_obiettivi_giornalieri', 'Imposta calorie e nutrienti giornalieri. Se indichi solo le calorie, i nutrienti seguono la zona 40/30/30.', { kcal: num, proteine_g: num, carboidrati_g: num, grassi_g: num }, ['kcal']),
  tool('imposta_acqua', 'Imposta il numero di bicchieri d\'acqua bevuti in un giorno.', { giorno: day, bicchieri: { type: 'integer', minimum: 0, maximum: 100 } }, ['giorno', 'bicchieri']),
  tool('registra_allenamento', 'Registra una sessione di allenamento. attivita è il nome (es. Corsa); se non esiste viene creata con l\'unità indicata.', { giorno: day, attivita: str, quantita: num, unita: { type: 'string', enum: ['km', 'min', 'kg', 'reps', 'm'] }, note: str }, ['giorno', 'attivita', 'quantita']),
  tool('digiuno', 'Avvia un digiuno adesso (con le ore previste) oppure termina adesso quello in corso.', { azione: { type: 'string', enum: ['avvia', 'termina'] }, ore: num }, ['azione']),
];

const MEAL_NAMES = { colazione: 'Colazione', spuntino_m: 'Spuntino', pranzo: 'Pranzo', merenda: 'Merenda', cena: 'Cena', spuntino_s: 'Spuntino serale' };
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function parseDay(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (isNaN(d)) return null;
  const now = new Date();
  // niente date future né più vecchie di un anno
  if (d > new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59) || now - d > 366 * 86400000) return null;
  return d;
}
const dayLabel = d => { const k = keyOf(d), n = new Date(); if (k === keyOf(n)) return 'oggi'; if (k === keyOf(new Date(n.getTime() - 86400000))) return 'ieri'; return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }); };
const okNum = (v, min, max) => { const n = Number(v); return v != null && v !== '' && !isNaN(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : null; };
const okTime = t => { const m = String(t || '').match(/^(\d{1,2})[:.](\d{2})$/); if (!m || +m[1] > 23 || +m[2] > 59) return null; return `${pad(+m[1])}:${m[2]}`; };
function dur(b, w) { if (!b || !w) return null; const [bh, bm] = b.split(':').map(Number), [wh, wm] = w.split(':').map(Number); let x = wh * 60 + wm - (bh * 60 + bm); if (x <= 0) x += 1440; return `${Math.floor(x / 60)} h ${pad(x % 60)}`; }
const hourFor = { colazione: 8, spuntino_m: 10, pranzo: 13, merenda: 16, cena: 20, spuntino_s: 22 };

// Elenco dei pasti recenti con un codice breve, da dare all'IA perché possa modificarli o eliminarli
export function buildMealRefs(meals) {
  const cutoff = Date.now() - 3 * 86400000;
  const list = (meals || []).filter(m => m.status !== 'planned' && new Date(m.ts).getTime() >= cutoff).sort((a, b) => new Date(a.ts) - new Date(b.ts));
  const refs = {};
  const lines = list.map((m, i) => { const code = 'P' + (i + 1); refs[code] = m.id; return `  ${code}: ${keyOf(new Date(m.ts))} ${m.type || ''} "${String(m.description || 'senza nome').slice(0, 60)}" ${m.qty_g ?? '?'} g, ${m.kcal ?? '?'} kcal`; });
  return { refs, text: lines.join('\n') || '  nessuno' };
}

// Traduce le proposte dell'IA in schede da mostrare nel pop-up e nei nuovi dati da salvare.
// data: { meals, sleeps, weights, goal, water, workouts, workoutTypes, fasts, profile, target }
export function planActions(uses, data, refs, newId) {
  const next = {};
  const cur = k => next[k] !== undefined ? next[k] : data[k];
  const cards = [], labels = [];
  const row = (l, a, b) => ({ l, a: a == null || a === '' ? null : String(a), b: String(b) });
  for (const u of uses || []) {
    const i = u.input || {};
    try {
      if (u.name === 'registra_pasto') {
        const d = parseDay(i.giorno); const kcal = okNum(i.kcal, 0, 10000); const desc = String(i.descrizione || '').trim().slice(0, 200);
        if (!d || !desc || kcal == null || !MEAL_NAMES[i.tipo]) continue;
        const ts = keyOf(d) === keyOf(new Date()) ? new Date() : new Date(d.getFullYear(), d.getMonth(), d.getDate(), hourFor[i.tipo], 0);
        const meal = { id: newId(), ts: ts.toISOString(), status: 'eaten', type: i.tipo, description: desc, qty_g: okNum(i.quantita_g, 1, 5000), kcal, p: okNum(i.proteine_g, 0, 1000), c: okNum(i.carboidrati_g, 0, 1000), g: okNum(i.grassi_g, 0, 1000), photo: null, photo_url: null };
        next.meals = [...cur('meals'), meal];
        cards.push({ title: 'Nuovo pasto', sub: `pasti · ${dayLabel(d)}, ${MEAL_NAMES[i.tipo].toLowerCase()}`, rows: [row('piatto', null, desc), meal.qty_g != null && row('quantità', null, meal.qty_g + ' g'), row('calorie', null, kcal + ' kcal'), (meal.p != null || meal.c != null || meal.g != null) && row('proteine · carboidrati · grassi', null, `${meal.p ?? '—'} · ${meal.c ?? '—'} · ${meal.g ?? '—'} g`)].filter(Boolean), note: 'Valori stimati dal coach: puoi correggerli dopo, toccando il pasto.' });
        labels.push(`pasto aggiunto (${desc})`);
      } else if (u.name === 'modifica_pasto' || u.name === 'elimina_pasto') {
        const id = refs[String(i.codice || '').toUpperCase()]; const old = cur('meals').find(m => m.id === id);
        if (!old) continue;
        const d = new Date(old.ts);
        if (u.name === 'elimina_pasto') {
          next.meals = cur('meals').filter(m => m.id !== id);
          cards.push({ title: 'Elimino il pasto', sub: `pasti · ${dayLabel(d)}`, danger: true, rows: [row('piatto', null, old.description || 'senza nome'), row('calorie', null, (old.kcal ?? '—') + ' kcal')] });
          labels.push(`pasto eliminato (${old.description || 'senza nome'})`);
        } else {
          const patch = {}, rows = [];
          const set = (k, v, l, unit = '') => { if (v != null && v !== old[k]) { patch[k] = v; rows.push(row(l, old[k] != null ? (k === 'type' ? MEAL_NAMES[old[k]] : old[k] + unit) : null, k === 'type' ? MEAL_NAMES[v] : v + unit)); } };
          set('type', MEAL_NAMES[i.tipo] ? i.tipo : null, 'pasto');
          set('description', i.descrizione ? String(i.descrizione).trim().slice(0, 200) : null, 'piatto');
          set('qty_g', okNum(i.quantita_g, 1, 5000), 'quantità', ' g'); set('kcal', okNum(i.kcal, 0, 10000), 'calorie', ' kcal');
          set('p', okNum(i.proteine_g, 0, 1000), 'proteine', ' g'); set('c', okNum(i.carboidrati_g, 0, 1000), 'carboidrati', ' g'); set('g', okNum(i.grassi_g, 0, 1000), 'grassi', ' g');
          if (!rows.length) continue;
          next.meals = cur('meals').map(m => m.id === id ? { ...m, ...patch } : m);
          cards.push({ title: 'Correggo il pasto', sub: `pasti · ${dayLabel(d)} · ${old.description || ''}`, rows });
          labels.push(`pasto corretto (${patch.description || old.description || 'senza nome'})`);
        }
      } else if (u.name === 'registra_sonno') {
        const d = parseDay(i.data_risveglio); if (!d) continue;
        const k = keyOf(d); const old = cur('sleeps').find(s => s.wakeDate === k);
        const bed = okTime(i.a_letto) || old?.bedtime, wake = okTime(i.sveglia) || old?.waketime; const q = okNum(i.qualita, 1, 5) ?? old?.quality ?? 3;
        if (!bed || !wake) continue;
        const rec = { ...(old || { id: newId(), notes: '' }), wakeDate: k, bedtime: bed, waketime: wake, quality: q };
        next.sleeps = old ? cur('sleeps').map(s => s.id === old.id ? rec : s) : [...cur('sleeps'), rec];
        const rows = [bed !== old?.bedtime && row('a letto alle', old?.bedtime, bed), wake !== old?.waketime && row('sveglia alle', old?.waketime, wake), row('durata', old ? dur(old.bedtime, old.waketime) : null, dur(bed, wake)), (!old || q !== old.quality) && row('qualità', old?.quality, q + ' su 5')].filter(Boolean);
        cards.push({ title: old ? 'Correggo la notte' : 'Registro la notte', sub: `sonno · risveglio di ${dayLabel(d)}`, rows });
        labels.push(`notte di ${dayLabel(d)} ${old ? 'corretta' : 'registrata'}`);
      } else if (u.name === 'registra_peso') {
        const d = parseDay(i.giorno); const w = okNum(i.peso_kg, 20, 300); if (!d || w == null) continue;
        const k = keyOf(d); const old = [...cur('weights')].sort((a, b) => new Date(b.ts) - new Date(a.ts)).find(x => keyOf(new Date(x.ts)) === k);
        const ts = k === keyOf(new Date()) ? new Date() : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 0);
        next.weights = old ? cur('weights').map(x => x.id === old.id ? { ...x, weight: w } : x) : [...cur('weights'), { id: newId(), ts: ts.toISOString(), weight: w }];
        cards.push({ title: old ? 'Correggo il peso' : 'Registro il peso', sub: `peso · ${dayLabel(d)}`, rows: [row('peso', old ? old.weight + ' kg' : null, w + ' kg')] });
        labels.push(`peso di ${dayLabel(d)} ${old ? 'corretto' : 'registrato'} (${w} kg)`);
      } else if (u.name === 'imposta_obiettivo_peso') {
        const w = okNum(i.peso_kg, 20, 300); if (w == null || w === cur('goal')) continue;
        cards.push({ title: 'Cambio l\'obiettivo di peso', sub: 'peso', rows: [row('obiettivo', cur('goal') != null ? cur('goal') + ' kg' : null, w + ' kg')] });
        next.goal = w; labels.push(`obiettivo di peso a ${w} kg`);
      } else if (u.name === 'imposta_obiettivi_giornalieri') {
        const kcal = okNum(i.kcal, 800, 6000); if (kcal == null) continue;
        const t = data.target || {};
        const p = okNum(i.proteine_g, 0, 1000) ?? Math.round(kcal * 0.30 / 4), c = okNum(i.carboidrati_g, 0, 1000) ?? Math.round(kcal * 0.40 / 4), g = okNum(i.grassi_g, 0, 1000) ?? Math.round(kcal * 0.30 / 9);
        next.targets = { daily_kcal_goal: Math.round(kcal), daily_protein_g: p, daily_carbs_g: c, daily_fat_g: g };
        cards.push({ title: 'Cambio gli obiettivi del giorno', sub: 'menù · calorie e nutrienti', rows: [row('calorie', t.kcal != null ? t.kcal + ' kcal' : null, Math.round(kcal) + ' kcal'), row('proteine', t.protein != null ? t.protein + ' g' : null, p + ' g'), row('carboidrati', t.carbs != null ? t.carbs + ' g' : null, c + ' g'), row('grassi', t.fat != null ? t.fat + ' g' : null, g + ' g')] });
        labels.push(`obiettivo giornaliero a ${Math.round(kcal)} kcal`);
      } else if (u.name === 'imposta_acqua') {
        const d = parseDay(i.giorno); const n = okNum(i.bicchieri, 0, 100); if (!d || n == null) continue;
        const k = keyOf(d); const old = (cur('water') || {})[k];
        next.water = { ...(cur('water') || {}), [k]: Math.round(n) };
        cards.push({ title: 'Aggiorno l\'acqua', sub: `acqua · ${dayLabel(d)}`, rows: [row('bicchieri', old, Math.round(n))] });
        labels.push(`acqua di ${dayLabel(d)} a ${Math.round(n)} bicchieri`);
      } else if (u.name === 'registra_allenamento') {
        const d = parseDay(i.giorno); const q = okNum(i.quantita, 0.01, 100000); const name = String(i.attivita || '').trim().slice(0, 40);
        if (!d || q == null || !name) continue;
        let type = cur('workoutTypes').find(t => t.name.toLowerCase() === name.toLowerCase());
        if (!type) { type = { id: newId(), name: name.charAt(0).toUpperCase() + name.slice(1), unit: ['km', 'min', 'kg', 'reps', 'm'].includes(i.unita) ? i.unita : 'min' }; next.workoutTypes = [...cur('workoutTypes'), type]; }
        const ts = keyOf(d) === keyOf(new Date()) ? new Date() : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 0);
        next.workouts = [...cur('workouts'), { id: newId(), ts: ts.toISOString(), typeId: type.id, qty: q, notes: String(i.note || '').trim().slice(0, 200) }];
        cards.push({ title: 'Registro l\'allenamento', sub: `allenamenti · ${dayLabel(d)}`, rows: [row('attività', null, type.name), row('quantità', null, `${q} ${type.unit}`)] });
        labels.push(`allenamento registrato (${type.name} ${q} ${type.unit})`);
      } else if (u.name === 'digiuno') {
        const active = cur('fasts').find(f => !f.ended_ts);
        if (i.azione === 'avvia') {
          const h = okNum(i.ore, 1, 72) ?? 16; if (active) continue;
          const st = new Date();
          next.fasts = [...cur('fasts'), { id: newId(), started_ts: st.toISOString(), planned_hours: h, planned_end_ts: new Date(st.getTime() + h * 3600000).toISOString(), type: 'custom', label: `${h}h`, ended_ts: null }];
          cards.push({ title: 'Avvio il digiuno', sub: 'digiuno · da adesso', rows: [row('durata prevista', null, h + ' ore')] });
          labels.push(`digiuno di ${h} ore avviato`);
        } else if (i.azione === 'termina' && active) {
          next.fasts = cur('fasts').map(f => f.id === active.id ? { ...f, ended_ts: new Date().toISOString() } : f);
          const hh = Math.round((Date.now() - new Date(active.started_ts).getTime()) / 360000) / 10;
          cards.push({ title: 'Chiudo il digiuno', sub: 'digiuno · adesso', rows: [row('durata', null, hh + ' ore')] });
          labels.push('digiuno terminato');
        }
      }
    } catch (e) { console.error('[coach] azione non valida', u?.name, e); }
  }
  return { cards, next, labels };
}
