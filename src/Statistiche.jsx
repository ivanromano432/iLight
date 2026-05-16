// Pagina Statistiche dedicata: trend lungo periodo, composizione corporea, pattern settimanali, export CSV.
// Accessibile dalla pagina Peso tramite bottone "STATISTICHE COMPLETE".

import { useState, useMemo, useEffect } from 'react';
import { getTheme } from './themes.js';

// Fallback Refettorio per sotto-componenti definiti a livello modulo
// (StatRow, Section, GoalModal). Il componente principale StatistichePage
// usa invece Q dinamico via shadow.
// Nota: il tema Q non e' piu' definito a livello modulo (era hardcoded sul tema refettorio
// e causava problemi di contrasto sui temi chiari). Ora ogni sotto-componente riceve Q come prop
// da StatistichePage, dove Q = getTheme(profile?.theme).
const fGaramond = '"Cormorant Garamond", serif';
const fCinzel = '"Cinzel", serif';

// === Chiamata IA via netlify function (con cache localStorage 24h) ===
const AI_CACHE_PREFIX = 'quercus_ai_';
const AI_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

async function callAI({ cacheKey, systemPrompt, userPrompt, maxTokens = 1200 }) {
  // Check cache
  try {
    const cached = localStorage.getItem(AI_CACHE_PREFIX + cacheKey);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < AI_CACHE_TTL) return { data, cached: true };
    }
  } catch (_) { /* ignore */ }

  const res = await fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();
  const txt = json.content?.[0]?.text || '';
  // Estrai JSON anche se circondato da prosa o code fences
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Risposta IA non in formato JSON');
  const data = JSON.parse(m[0]);
  try {
    localStorage.setItem(AI_CACHE_PREFIX + cacheKey, JSON.stringify({ ts: Date.now(), data }));
  } catch (_) { /* quota piena, va bene */ }
  return { data, cached: false };
}

function clearAICache(prefix) {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(AI_CACHE_PREFIX + prefix))
      .forEach(k => localStorage.removeItem(k));
  } catch (_) { /* ignore */ }
}

function fmt(n, d = 1) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
}

const PERIODS = [
  { id: '30', label: '30G', days: 30 },
  { id: '90', label: '3M', days: 90 },
  { id: '365', label: '1A', days: 365 },
  { id: 'all', label: 'SEMPRE', days: null },
];

function buildLineChart(values, chartW, chartH) {
  const padX = 8, padY = 14;
  const valid = values.filter(v => v != null);
  if (valid.length === 0) return { path: '', area: '', points: [] };
  const min = Math.min(...valid), max = Math.max(...valid), span = Math.max(max - min, 0.5);
  const xStep = (chartW - padX * 2) / Math.max(1, values.length - 1);
  const points = values.map((v, i) => v == null ? null : { x: padX + i * xStep, y: padY + (chartH - padY * 2) * (1 - (v - min) / span), v }).filter(Boolean);
  let path = '', area = '';
  if (points.length > 1) {
    path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    area = path + ` L ${points[points.length - 1].x} ${chartH} L ${points[0].x} ${chartH} Z`;
  }
  return { path, area, points, min, max };
}

// Esportazione CSV
function toCSV(rows, columns) {
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.join(',');
  const body = rows.map(r => columns.map(c => escape(r[c])).join(',')).join('\n');
  return header + '\n' + body;
}

function downloadCSV(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportAllCSV({ weights, meals, sleeps, water, workouts, workoutTypes, supplements, suppTaken, mindful, fasts, diaryNotes }) {
  const ts = new Date().toISOString().slice(0, 10);
  const typeNameById = {};
  (workoutTypes || []).forEach(t => { typeNameById[t.id] = t.name; });
  const suppNameById = {};
  (supplements || []).forEach(s => { suppNameById[s.id] = s.name; });

  const sections = [
    ['goalfit_pesi', weights.map(w => ({
      data: new Date(w.ts).toLocaleString('it-IT'),
      peso_kg: w.weight,
      grasso_pct: w.bodyFat ?? '',
      muscolo_pct: w.muscle ?? '',
      acqua_pct: w.water ?? '',
    })), ['data', 'peso_kg', 'grasso_pct', 'muscolo_pct', 'acqua_pct']],
    ['goalfit_pasti', meals.map(m => ({
      data: new Date(m.ts).toLocaleString('it-IT'),
      tipo: m.type,
      descrizione: m.description,
      grammi: m.qty_g ?? '',
      kcal: m.kcal ?? '',
      proteine: m.p ?? '',
      carboidrati: m.c ?? '',
      grassi: m.g ?? '',
      stato: m.status,
    })), ['data', 'tipo', 'descrizione', 'grammi', 'kcal', 'proteine', 'carboidrati', 'grassi', 'stato']],
    ['goalfit_sonno', sleeps.map(s => ({
      data_risveglio: s.wakeDate,
      a_letto: s.bedtime,
      sveglia: s.waketime,
      qualita: s.quality ?? '',
      note: s.notes ?? '',
    })), ['data_risveglio', 'a_letto', 'sveglia', 'qualita', 'note']],
    ['goalfit_acqua', Object.entries(water || {}).map(([day, glasses]) => ({
      giorno: day, bicchieri: glasses,
    })), ['giorno', 'bicchieri']],
    ['goalfit_allenamenti', workouts.map(w => ({
      data: new Date(w.ts).toLocaleString('it-IT'),
      tipo: typeNameById[w.typeId] || w.typeId,
      quantita: w.qty ?? '',
      note: w.notes ?? '',
    })), ['data', 'tipo', 'quantita', 'note']],
    ['goalfit_integratori_presi', Object.entries(suppTaken || {}).flatMap(([day, ids]) =>
      (ids || []).map(id => ({ giorno: day, integratore: suppNameById[id] || id }))
    ), ['giorno', 'integratore']],
    ['goalfit_mindful', mindful.map(m => ({
      data: new Date(m.ts).toLocaleString('it-IT'),
      tipo: m.type ?? '',
      durata_min: m.duration_min ?? '',
      note: m.note ?? '',
    })), ['data', 'tipo', 'durata_min', 'note']],
    ['goalfit_digiuni', fasts.map(f => ({
      inizio: f.started_ts ? new Date(f.started_ts).toLocaleString('it-IT') : '',
      fine_pianificata: f.planned_end_ts ? new Date(f.planned_end_ts).toLocaleString('it-IT') : '',
      fine_effettiva: f.ended_ts ? new Date(f.ended_ts).toLocaleString('it-IT') : '',
      ore_obiettivo: f.planned_hours ?? '',
      tipo: f.type ?? '',
      etichetta: f.label ?? '',
    })), ['inizio', 'fine_pianificata', 'fine_effettiva', 'ore_obiettivo', 'tipo', 'etichetta']],
    ['goalfit_diario', diaryNotes.map(n => ({
      data: new Date(n.ts).toLocaleString('it-IT'),
      testo: n.text,
    })), ['data', 'testo']],
  ];

  sections.forEach(([name, rows, cols]) => {
    if (rows.length === 0) return;
    const csv = toCSV(rows, cols);
    downloadCSV(`${name}_${ts}.csv`, csv);
  });
}

// Linear regression: ritorna { slopePerDay, intercept } per stimare goal ETA
function linearRegression(weights) {
  if (weights.length < 2) return null;
  const xs = weights.map(w => new Date(w.ts).getTime() / 86400000); // giorni
  const ys = weights.map(w => w.weight);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept, lastX: xs[xs.length - 1], lastY: ys[ys.length - 1] };
}

function StatRow({ Q, label, value, sub, color }) {
  return (
    <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.35em', color: Q.goldDim, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 26, color: color || Q.cream, marginTop: 4, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Section({ Q, title, sub, children }) {
  return (
    <div style={{ marginTop: 28, paddingTop: 18, borderTop: `1px solid ${Q.gold}33` }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.4em', color: Q.gold, textTransform: 'uppercase' }}>✦ {title}</div>
        {sub && <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: Q.goldDim, marginTop: 4 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

const DOW_LABELS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

// === Definizioni tipologie obiettivo ===
const GOAL_TYPES = {
  sleep_h: {
    label: 'Sonno', icon: '☾', unit: 'ore/notte', period: 'per_day',
    suggestedTarget: 7.5, step: 0.5, min: 4, max: 12,
    current: ({ sleeps }) => {
      const cut = new Date(); cut.setDate(cut.getDate() - 7);
      const r = sleeps.filter(s => new Date(s.wakeDate) >= cut && s.bedtime && s.waketime);
      if (!r.length) return null;
      const hs = r.map(s => {
        const [bh,bm]=s.bedtime.split(':').map(Number);
        const [wh,wm]=s.waketime.split(':').map(Number);
        let d=wh*60+wm-(bh*60+bm); if(d<=0)d+=1440; return d/60;
      });
      return hs.reduce((a,b)=>a+b,0)/hs.length;
    },
  },
  water_glasses: {
    label: 'Idratazione', icon: '~', unit: 'bicchieri/giorno', period: 'per_day',
    suggestedTarget: 8, step: 1, min: 1, max: 20,
    current: ({ water }) => {
      const cut = new Date(); cut.setDate(cut.getDate() - 7);
      const e = Object.entries(water || {}).filter(([d]) => new Date(d) >= cut);
      if (!e.length) return null;
      return e.reduce((a,[,g])=>a+(g||0),0)/e.length;
    },
  },
  protein_g: {
    label: 'Proteine', icon: '◆', unit: 'g/giorno', period: 'per_day',
    suggestedTarget: 100, step: 5, min: 20, max: 300,
    current: ({ meals }) => {
      const cut = new Date(); cut.setDate(cut.getDate() - 7);
      const r = meals.filter(m => new Date(m.ts) >= cut && m.status === 'eaten' && m.p != null);
      if (!r.length) return null;
      const byDay = {};
      r.forEach(m => { const k = new Date(m.ts).toISOString().slice(0,10); byDay[k] = (byDay[k]||0) + Number(m.p); });
      const days = Object.keys(byDay);
      return days.reduce((a,k)=>a+byDay[k],0) / days.length;
    },
  },
  workouts: {
    label: 'Allenamenti', icon: '✦', unit: 'sessioni/settimana', period: 'per_week',
    suggestedTarget: 3, step: 1, min: 1, max: 14,
    current: ({ workouts }) => {
      const cut = new Date(); cut.setDate(cut.getDate() - 7);
      return workouts.filter(w => new Date(w.ts) >= cut).length;
    },
  },
  fasts: {
    label: 'Digiuni', icon: '○', unit: 'completati/settimana', period: 'per_week',
    suggestedTarget: 2, step: 1, min: 1, max: 7,
    current: ({ fasts }) => {
      const cut = new Date(); cut.setDate(cut.getDate() - 7);
      return fasts.filter(f => f.ended_ts && new Date(f.started_ts) >= cut).length;
    },
  },
  mindful: {
    label: 'Mindful', icon: '✧', unit: 'sessioni/settimana', period: 'per_week',
    suggestedTarget: 3, step: 1, min: 1, max: 21,
    current: ({ mindful }) => {
      const cut = new Date(); cut.setDate(cut.getDate() - 7);
      return mindful.filter(m => new Date(m.ts) >= cut).length;
    },
  },
  meals_logged: {
    label: 'Pasti registrati', icon: '✿', unit: '/giorno', period: 'per_day',
    suggestedTarget: 3, step: 1, min: 1, max: 10,
    current: ({ meals }) => {
      const cut = new Date(); cut.setDate(cut.getDate() - 7);
      const r = meals.filter(m => new Date(m.ts) >= cut && m.status === 'eaten');
      if (!r.length) return null;
      const byDay = {};
      r.forEach(m => { const k = new Date(m.ts).toISOString().slice(0,10); byDay[k] = (byDay[k]||0)+1; });
      const days = Math.max(Object.keys(byDay).length, 1);
      return r.length / days;
    },
  },
};

function newGoalId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now()+Math.random()).toString();
}

function GoalModal({ Q, existing, alreadyUsed, onClose, onSave, onDelete }) {
  const editMode = !!existing;
  const [type, setType] = useState(existing?.goal_type || null);
  const [target, setTarget] = useState(existing?.target_value != null ? String(existing.target_value).replace('.', ',') : '');
  useEffect(() => {
    if (type && !editMode) {
      const def = GOAL_TYPES[type];
      if (def && !target) setTarget(String(def.suggestedTarget).replace('.', ','));
    }
    // eslint-disable-next-line
  }, [type]);
  const def = type ? GOAL_TYPES[type] : null;
  const targetN = parseFloat((target || '').replace(',', '.'));
  const valid = type && !isNaN(targetN) && targetN > 0;
  const availableTypes = Object.entries(GOAL_TYPES).filter(([k]) => editMode || !alreadyUsed.has(k));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: Q.bg2, border: `1px solid ${Q.gold}66`, padding: 24, maxWidth: 360, width: '100%' }}>
        <div style={{ fontFamily: fCinzel, fontSize: 11, letterSpacing: '0.45em', color: Q.gold, textTransform: 'uppercase', textAlign: 'center', marginBottom: 18 }}>
          {editMode ? 'MODIFICA OBIETTIVO' : '+ NUOVO OBIETTIVO'}
        </div>
        {!type && (
          <>
            {availableTypes.length === 0 ? (
              <div style={{ textAlign: 'center', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 14, color: Q.goldDim, padding: 12 }}>
                Hai già aggiunto tutti gli obiettivi disponibili.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {availableTypes.map(([k, d]) => (
                  <button key={k} onClick={() => setType(k)} style={{ background: 'transparent', color: Q.cream, border: `1px solid ${Q.gold}66`, padding: '14px 8px', cursor: 'pointer', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 14, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 18, color: Q.gold }}>{d.icon}</span>
                    <span>{d.label}</span>
                    <span style={{ fontSize: 10, color: Q.goldDim }}>{d.unit}</span>
                  </button>
                ))}
              </div>
            )}
            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <button onClick={onClose} style={{ background: 'transparent', color: Q.goldDim, border: `1px solid ${Q.goldDim}66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', padding: '8px 14px', cursor: 'pointer' }}>ANNULLA</button>
            </div>
          </>
        )}
        {type && def && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${Q.gold}33` }}>
              <span style={{ fontSize: 22, color: Q.gold }}>{def.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', color: Q.gold, textTransform: 'uppercase' }}>{def.label}</div>
                <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: Q.goldDim }}>{def.unit}</div>
              </div>
              {!editMode && (
                <button onClick={() => setType(null)} style={{ background: 'transparent', color: Q.goldDim, border: 'none', fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.2em', cursor: 'pointer' }}>cambia</button>
              )}
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.35em', color: Q.goldDim, textTransform: 'uppercase', marginBottom: 6 }}>OBIETTIVO</div>
              <input type="text" inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)}
                placeholder={String(def.suggestedTarget).replace('.', ',')}
                style={{ width: '100%', background: 'transparent', border: `1px solid ${Q.gold}66`, color: Q.cream, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 22, padding: '10px 12px', textAlign: 'center', outline: 'none' }} />
              <div style={{ marginTop: 6, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim, textAlign: 'center' }}>{def.unit} · suggerito {def.suggestedTarget}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
              {editMode && onDelete && (
                <button onClick={onDelete} style={{ background: 'transparent', color: '#C99A7A', border: `1px solid #C99A7A66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', padding: '10px 14px', cursor: 'pointer' }}>ELIMINA</button>
              )}
              <button onClick={onClose} style={{ background: 'transparent', color: Q.goldDim, border: `1px solid ${Q.goldDim}66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', padding: '10px 14px', cursor: 'pointer' }}>ANNULLA</button>
              <button disabled={!valid} onClick={() => onSave({ goal_type: type, target_value: targetN, period: def.period })}
                style={{ background: valid ? Q.gold : '#555', color: valid ? Q.ink : '#999', border: 'none', fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', padding: '10px 18px', cursor: valid ? 'pointer' : 'not-allowed' }}>SALVA</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function StatistichePage({
  weights = [], meals = [], sleeps = [], water = {}, workouts = [], workoutTypes = [],
  supplements = [], suppTaken = {}, mindful = [], fasts = [], diaryNotes = [],
  goal = null, userGoals = [], updGoals,
  profile,
  onClose,
}) {
  const Q = getTheme(profile?.theme);
  const [period, setPeriod] = useState('30');

  const periodObj = PERIODS.find(p => p.id === period);
  const cutoff = useMemo(() => {
    if (period === 'all') return new Date(0);
    const d = new Date(); d.setDate(d.getDate() - periodObj.days);
    return d;
  }, [period, periodObj]);

  // Pesi nel periodo, ordinati per ts
  const wInPeriod = useMemo(() =>
    weights.filter(w => new Date(w.ts) >= cutoff).sort((a, b) => new Date(a.ts) - new Date(b.ts)),
    [weights, cutoff]
  );

  // Aggregazione: 1 punto per giorno (media se ci sono più pesate)
  const dailyAgg = useMemo(() => {
    const map = {};
    wInPeriod.forEach(w => {
      const k = new Date(w.ts).toISOString().slice(0, 10);
      if (!map[k]) map[k] = { ws: [], bfs: [], mus: [], was: [] };
      map[k].ws.push(w.weight);
      if (w.bodyFat != null) map[k].bfs.push(w.bodyFat);
      if (w.muscle != null) map[k].mus.push(w.muscle);
      if (w.water != null) map[k].was.push(w.water);
    });
    return Object.entries(map).map(([day, m]) => ({
      day,
      date: new Date(day),
      weight: m.ws.reduce((a, b) => a + b, 0) / m.ws.length,
      bodyFat: m.bfs.length > 0 ? m.bfs.reduce((a, b) => a + b, 0) / m.bfs.length : null,
      muscle: m.mus.length > 0 ? m.mus.reduce((a, b) => a + b, 0) / m.mus.length : null,
      water: m.was.length > 0 ? m.was.reduce((a, b) => a + b, 0) / m.was.length : null,
    })).sort((a, b) => a.date - b.date);
  }, [wInPeriod]);

  // Stats principali
  const stats = useMemo(() => {
    if (dailyAgg.length === 0) return null;
    const first = dailyAgg[0];
    const last = dailyAgg[dailyAgg.length - 1];
    const avgW = dailyAgg.reduce((a, b) => a + b.weight, 0) / dailyAgg.length;
    const delta = dailyAgg.length >= 2 ? last.weight - first.weight : null;
    const minW = Math.min(...dailyAgg.map(d => d.weight));
    const maxW = Math.max(...dailyAgg.map(d => d.weight));
    return { first, last, avgW, delta, minW, maxW, daysRegistered: dailyAgg.length };
  }, [dailyAgg]);

  // Stima ETA goal con regressione lineare
  const goalEta = useMemo(() => {
    if (!goal || dailyAgg.length < 3) return null;
    const reg = linearRegression(dailyAgg.map(d => ({ ts: d.date.toISOString(), weight: d.weight })));
    if (!reg) return null;
    const { slope, lastX, lastY } = reg;
    // Verso obiettivo
    if (lastY === goal) return { msg: 'già al traguardo', color: '#A5B889' };
    const towardsGoal = (goal < lastY && slope < 0) || (goal > lastY && slope > 0);
    if (!towardsGoal) {
      return { msg: 'con questo ritmo non raggiungerai l\'obiettivo', color: '#C99A7A', slope };
    }
    const daysToGoal = (goal - lastY) / slope;
    if (daysToGoal <= 0 || daysToGoal > 365 * 5) return { msg: 'ritmo troppo lento per stimare', color: Q.goldDim, slope };
    const eta = new Date(lastX * 86400000 + daysToGoal * 86400000);
    return {
      msg: `obiettivo previsto · ${eta.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      color: '#A5B889',
      slope,
      eta,
    };
  }, [dailyAgg, goal]);

  // Grafico principale: 1 punto per ogni "giornogriglia" nel periodo, allineato
  const chartW = 320, chartH = 120;
  const chartData = useMemo(() => {
    // Creo array di valori. Per period lungo, includo tutti i giorni con peso=null nei buchi (per stretch corretto sul tempo).
    if (dailyAgg.length === 0) return { weights: [], bfs: [] };
    if (period === 'all' || dailyAgg.length < 30) {
      return {
        weights: dailyAgg.map(d => d.weight),
        bfs: dailyAgg.map(d => d.bodyFat),
        labels: dailyAgg.map(d => d.date),
      };
    }
    // Periodo lungo: stretch temporale 1 punto per giorno
    const startD = new Date(cutoff); startD.setHours(0, 0, 0, 0);
    const endD = new Date(); endD.setHours(0, 0, 0, 0);
    const days = Math.round((endD - startD) / 86400000) + 1;
    const byDay = new Map(dailyAgg.map(d => [d.day, d]));
    const ws = [], bfs = [], labels = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startD); d.setDate(startD.getDate() + i);
      const k = d.toISOString().slice(0, 10);
      const cell = byDay.get(k);
      ws.push(cell ? cell.weight : null);
      bfs.push(cell ? cell.bodyFat : null);
      labels.push(d);
    }
    return { weights: ws, bfs, labels };
  }, [dailyAgg, period, cutoff]);

  const mainChart = buildLineChart(chartData.weights, chartW, chartH);
  const bfChartBig = buildLineChart(chartData.bfs, chartW, chartH);

  // Pattern: peso medio per giorno della settimana
  const dowPattern = useMemo(() => {
    const buckets = [[], [], [], [], [], [], []]; // 0=lun, 6=dom (mappo: getDay()→idx con lun=0)
    wInPeriod.forEach(w => {
      const dow = new Date(w.ts).getDay(); // 0=dom, 1=lun, ..., 6=sab
      const idx = (dow + 6) % 7; // 0=lun
      buckets[idx].push(w.weight);
    });
    const avgs = buckets.map(b => b.length > 0 ? b.reduce((a, x) => a + x, 0) / b.length : null);
    const valid = avgs.filter(a => a != null);
    if (valid.length === 0) return null;
    const min = Math.min(...valid), max = Math.max(...valid);
    return {
      avgs,
      min, max,
      bestIdx: avgs.indexOf(min),
      worstIdx: avgs.indexOf(max),
    };
  }, [wInPeriod]);

  // Composizione corporea: ultimo valore + delta
  const compStats = useMemo(() => {
    const lastBf = [...wInPeriod].reverse().find(w => w.bodyFat != null);
    const firstBf = wInPeriod.find(w => w.bodyFat != null);
    const lastMu = [...wInPeriod].reverse().find(w => w.muscle != null);
    const firstMu = wInPeriod.find(w => w.muscle != null);
    const lastWa = [...wInPeriod].reverse().find(w => w.water != null);
    const firstWa = wInPeriod.find(w => w.water != null);
    return {
      bf: lastBf ? { last: lastBf.bodyFat, delta: firstBf && firstBf !== lastBf ? lastBf.bodyFat - firstBf.bodyFat : null } : null,
      mu: lastMu ? { last: lastMu.muscle, delta: firstMu && firstMu !== lastMu ? lastMu.muscle - firstMu.muscle : null } : null,
      wa: lastWa ? { last: lastWa.water, delta: firstWa && firstWa !== lastWa ? lastWa.water - firstWa.water : null } : null,
      // Massa magra stimata se abbiamo peso e bf
      leanMass: lastBf && stats?.last ? stats.last.weight * (100 - lastBf.bodyFat) / 100 : null,
    };
  }, [wInPeriod, stats]);

  // Altri aggregati periodi
  const otherAgg = useMemo(() => {
    const inCutoff = (ts) => new Date(ts) >= cutoff;
    return {
      mealsCount: meals.filter(m => inCutoff(m.ts) && m.status === 'eaten').length,
      photosCount: meals.filter(m => inCutoff(m.ts) && m.photo).length,
      sleepsCount: sleeps.filter(s => new Date(s.wakeDate) >= cutoff).length,
      avgSleepHours: (() => {
        const ss = sleeps.filter(s => new Date(s.wakeDate) >= cutoff && s.bedtime && s.waketime);
        if (ss.length === 0) return null;
        const hours = ss.map(s => {
          const [bh, bm] = s.bedtime.split(':').map(Number);
          const [wh, wm] = s.waketime.split(':').map(Number);
          let d = wh * 60 + wm - (bh * 60 + bm);
          if (d <= 0) d += 24 * 60;
          return d / 60;
        });
        return hours.reduce((a, b) => a + b, 0) / hours.length;
      })(),
      avgWaterGlasses: (() => {
        const days = Object.entries(water).filter(([day]) => new Date(day) >= cutoff);
        if (days.length === 0) return null;
        return days.reduce((a, [, g]) => a + (g || 0), 0) / days.length;
      })(),
      workoutsCount: workouts.filter(w => inCutoff(w.ts)).length,
      fastsCount: fasts.filter(f => f.ended_ts && inCutoff(f.started_ts)).length,
      mindfulCount: mindful.filter(m => inCutoff(m.ts)).length,
    };
  }, [meals, sleeps, water, workouts, fasts, mindful, cutoff]);

  // === Aggregazione settimanale per correlazioni IA ===
  const weeklyAgg = useMemo(() => {
    const inCutoff = (ts) => new Date(ts) >= cutoff;
    const bucket = {};
    const weekStart = (d) => {
      const dt = new Date(d);
      const day = dt.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      dt.setDate(dt.getDate() + diff);
      dt.setHours(0, 0, 0, 0);
      return dt.toISOString().slice(0, 10);
    };
    const ensure = (k) => { if (!bucket[k]) bucket[k] = { ws: [], sleepH: [], waterG: [], mealCnt: 0, workCnt: 0, fastCnt: 0 }; };
    weights.filter(w => inCutoff(w.ts)).forEach(w => { const k = weekStart(w.ts); ensure(k); bucket[k].ws.push(w.weight); });
    sleeps.filter(s => inCutoff(s.wakeDate)).forEach(s => {
      const k = weekStart(s.wakeDate); ensure(k);
      if (s.bedtime && s.waketime) {
        const [bh, bm] = s.bedtime.split(':').map(Number);
        const [wh, wm] = s.waketime.split(':').map(Number);
        let d = wh * 60 + wm - (bh * 60 + bm);
        if (d <= 0) d += 24 * 60;
        bucket[k].sleepH.push(d / 60);
      }
    });
    Object.entries(water || {}).forEach(([day, g]) => { if (!inCutoff(day)) return; const k = weekStart(day); ensure(k); bucket[k].waterG.push(g || 0); });
    meals.filter(m => inCutoff(m.ts) && m.status === 'eaten').forEach(m => { const k = weekStart(m.ts); ensure(k); bucket[k].mealCnt++; });
    workouts.filter(w => inCutoff(w.ts)).forEach(w => { const k = weekStart(w.ts); ensure(k); bucket[k].workCnt++; });
    fasts.filter(f => f.ended_ts && inCutoff(f.started_ts)).forEach(f => { const k = weekStart(f.started_ts); ensure(k); bucket[k].fastCnt++; });
    return Object.entries(bucket).map(([weekStart, b]) => ({
      settimana: weekStart,
      peso_medio: b.ws.length ? +(b.ws.reduce((a, x) => a + x, 0) / b.ws.length).toFixed(2) : null,
      sonno_medio_ore: b.sleepH.length ? +(b.sleepH.reduce((a, x) => a + x, 0) / b.sleepH.length).toFixed(2) : null,
      acqua_media_bicchieri: b.waterG.length ? +(b.waterG.reduce((a, x) => a + x, 0) / b.waterG.length).toFixed(1) : null,
      pasti_registrati: b.mealCnt,
      allenamenti: b.workCnt,
      digiuni: b.fastCnt,
    })).sort((a, b) => a.settimana.localeCompare(b.settimana));
  }, [weights, sleeps, water, meals, workouts, fasts, cutoff]);

  // === Aggregazione mensile per riassunti ===
  const monthlyAgg = useMemo(() => {
    const monthsKey = (ts) => new Date(ts).toISOString().slice(0, 7);
    const map = {};
    const init = (k) => { if (!map[k]) map[k] = { ws: [], sleepH: [], waterG: [], mealCnt: 0, workCnt: 0, fastCnt: 0, mindCnt: 0 }; };
    weights.forEach(w => { const k = monthsKey(w.ts); init(k); map[k].ws.push({ ts: w.ts, v: w.weight }); });
    sleeps.forEach(s => {
      if (!s.bedtime || !s.waketime) return;
      const k = monthsKey(s.wakeDate); init(k);
      const [bh, bm] = s.bedtime.split(':').map(Number);
      const [wh, wm] = s.waketime.split(':').map(Number);
      let d = wh * 60 + wm - (bh * 60 + bm);
      if (d <= 0) d += 24 * 60;
      map[k].sleepH.push(d / 60);
    });
    Object.entries(water || {}).forEach(([day, g]) => { const k = monthsKey(day); init(k); map[k].waterG.push(g || 0); });
    meals.forEach(m => { if (m.status !== 'eaten') return; const k = monthsKey(m.ts); init(k); map[k].mealCnt++; });
    workouts.forEach(w => { const k = monthsKey(w.ts); init(k); map[k].workCnt++; });
    fasts.forEach(f => { if (!f.ended_ts) return; const k = monthsKey(f.started_ts); init(k); map[k].fastCnt++; });
    mindful.forEach(m => { const k = monthsKey(m.ts); init(k); map[k].mindCnt++; });
    return Object.entries(map).map(([month, b]) => {
      const sortedWs = b.ws.sort((a, b) => new Date(a.ts) - new Date(b.ts));
      return {
        mese: month,
        peso_inizio: sortedWs[0]?.v ?? null,
        peso_fine: sortedWs[sortedWs.length - 1]?.v ?? null,
        peso_medio: sortedWs.length ? +(sortedWs.reduce((a, x) => a + x.v, 0) / sortedWs.length).toFixed(2) : null,
        sonno_medio_ore: b.sleepH.length ? +(b.sleepH.reduce((a, x) => a + x, 0) / b.sleepH.length).toFixed(2) : null,
        acqua_media_bicchieri: b.waterG.length ? +(b.waterG.reduce((a, x) => a + x, 0) / b.waterG.length).toFixed(1) : null,
        pasti_registrati: b.mealCnt,
        allenamenti: b.workCnt,
        digiuni: b.fastCnt,
        mindful: b.mindCnt,
      };
    }).sort((a, b) => b.mese.localeCompare(a.mese));
  }, [weights, sleeps, water, meals, workouts, fasts, mindful]);

  // === IA: Correlazioni ===
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insights, setInsights] = useState(null);
  const [insightsError, setInsightsError] = useState(null);
  const generateInsights = async (force = false) => {
    setInsightsError(null); setInsightsLoading(true);
    try {
      const cacheKey = `insights_${period}_${weeklyAgg.length}w`;
      if (force) clearAICache('insights_');
      const validWeeks = weeklyAgg.filter(w => w.peso_medio != null || w.sonno_medio_ore != null || w.pasti_registrati > 0);
      if (validWeeks.length < 2) {
        setInsights({ items: [], note: 'Servono almeno 2 settimane di dati registrati. Continua ad annotare il diario.' });
        setInsightsLoading(false); return;
      }
      const { data, cached } = await callAI({
        cacheKey,
        systemPrompt: 'Sei un coach di benessere italiano. Rispondi SEMPRE e SOLO con JSON valido in italiano.',
        userPrompt: `Analizza i dati settimanali di un utente e identifica 3-5 correlazioni utili per migliorare benessere e perdita di peso sostenibile.\n\nDati settimanali:\n${JSON.stringify(validWeeks, null, 2)}\n\nLinee guida:\n- Cerca pattern tra le variabili (es. sonno vs peso, digiuni vs energia, idratazione vs costanza)\n- 1-2 frasi per insight, tono caldo ma diretto, italiano naturale\n- "tone" può essere: "positive" (cosa va bene), "warning" (attenzione), "neutral" (osservazione)\n- Se i dati sono troppo pochi o non emergono pattern chiari, ritorna meno insights ma onesti\n\nRispondi SOLO con JSON:\n{ "insights": [{ "title": "...", "body": "...", "tone": "positive" }], "note": "opzionale" }`,
        maxTokens: 1500,
      });
      setInsights({ items: data.insights || [], note: data.note, fromCache: cached });
    } catch (e) { setInsightsError(e.message || String(e)); }
    finally { setInsightsLoading(false); }
  };

  // === IA: Riassunto mensile ===
  const currentMonth = monthlyAgg[0];
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [monthlyError, setMonthlyError] = useState(null);
  const generateMonthlySummary = async (force = false) => {
    setMonthlyError(null); setMonthlyLoading(true);
    try {
      if (!currentMonth) { setMonthlySummary(null); setMonthlyLoading(false); return; }
      const cacheKey = `monthly_${currentMonth.mese}`;
      if (force) clearAICache(`monthly_${currentMonth.mese}`);
      const monthLabel = new Date(currentMonth.mese + '-01').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
      const { data } = await callAI({
        cacheKey,
        systemPrompt: 'Sei un coach di benessere italiano. Rispondi SEMPRE e SOLO con JSON valido in italiano.',
        userPrompt: `Scrivi un riassunto del mese di ${monthLabel} per un utente, in italiano naturale, 2-4 frasi, tono caldo ma onesto.\n\nDati del mese:\n${JSON.stringify(currentMonth, null, 2)}\n\nLinee guida:\n- Concentrati su 2-3 osservazioni più rilevanti (cambiamento di peso, costanza, abitudini)\n- Se positive, celebra. Se da migliorare, incoraggia senza biasimare.\n- Non listare i numeri, racconta il senso del mese\n- Italiano naturale, evita "fitness-speak" anglosassone\n\nRispondi SOLO con JSON: { "summary": "..." }`,
        maxTokens: 600,
      });
      setMonthlySummary(data.summary || '');
    } catch (e) { setMonthlyError(e.message || String(e)); }
    finally { setMonthlyLoading(false); }
  };

  const toneColor = (t) => t === 'positive' ? '#A5B889' : t === 'warning' ? '#C99A7A' : Q.gold;

  // === Obiettivi multipli ===
  const [goalModal, setGoalModal] = useState(null); // null | 'new' | goalObject

  // Mese attualmente visualizzato nel calendario (default: oggi)
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  // Giorno selezionato nel calendario (1..31) o null
  const [selectedDay, setSelectedDay] = useState(null);
  const goalsActive = useMemo(() => userGoals.filter(g => g.active !== false), [userGoals]);
  const goalsAlreadyUsed = useMemo(() => new Set(goalsActive.map(g => g.goal_type)), [goalsActive]);
  const dataForGoals = { sleeps, water, meals, workouts, fasts, mindful, weights };

  const saveGoal = async ({ goal_type, target_value, period }) => {
    if (goalModal === 'new') {
      const newGoal = { id: newGoalId(), goal_type, target_value, period, active: true };
      await updGoals([...userGoals, newGoal]);
    } else if (goalModal && goalModal.id) {
      await updGoals(userGoals.map(g => g.id === goalModal.id ? { ...g, goal_type, target_value, period } : g));
    }
    setGoalModal(null);
  };
  const deleteGoal = async () => {
    if (goalModal && goalModal.id) {
      await updGoals(userGoals.filter(g => g.id !== goalModal.id));
    }
    setGoalModal(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(ellipse at top, ${Q.bg1} 0%, ${Q.bg2} 100%)`, color: Q.cream, fontFamily: fGaramond, position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 14, border: `1px solid ${Q.gold}40`, borderRadius: 20, pointerEvents: 'none', zIndex: 1 }} />
      <div aria-hidden style={{ position: 'absolute', inset: 20, border: `1px solid ${Q.gold}1A`, borderRadius: 16, pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'relative', zIndex: 2, padding: '24px 22px 60px', maxWidth: 480, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', color: Q.gold, border: `1px solid ${Q.gold}66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', padding: '8px 14px', cursor: 'pointer' }}>← INDIETRO</button>
          <div style={{ fontFamily: fCinzel, fontSize: 11, letterSpacing: '0.45em', color: Q.gold, textTransform: 'uppercase' }}>STATISTICHE</div>
          <div style={{ width: 70 }} />
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 22 }}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              style={{ background: period === p.id ? Q.gold : 'transparent', color: period === p.id ? Q.ink : Q.goldDim, border: `1px solid ${Q.gold}66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.2em', padding: '7px 12px', cursor: 'pointer', textTransform: 'uppercase' }}>
              {p.label}
            </button>
          ))}
        </div>

        {!stats && (
          <div style={{ textAlign: 'center', padding: '60px 8px 0', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 16, color: Q.goldDim }}>
            Nessuna pesata nel periodo selezionato.<br />Allarga il periodo o registra il primo peso.
          </div>
        )}

        {stats && (
          <>
            {/* Calendario del mese: a colpo d'occhio quali giorni hai registrato qualcosa */}
            <Section Q={Q} title="CALENDARIO" sub="i giorni con almeno un dato registrato">
              {(() => {
                const today = new Date();
                const year = calMonth.getFullYear();
                const month = calMonth.getMonth();
                const monthLabel = calMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                const daysInMonth = lastDay.getDate();
                // Lunedi = 0, domenica = 6 (ISO settimana europea)
                const firstDayOfWeek = (firstDay.getDay() + 6) % 7;

                // Limiti navigazione: si puo' andare indietro fino a 10 anni fa, avanti solo fino al mese corrente.
                // (Non limitiamo per "prima pesata" perche' l'utente potrebbe avere dati di altre tabelle nei mesi precedenti.)
                const tenYearsAgo = new Date(today.getFullYear() - 10, today.getMonth(), 1);
                const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const canPrev = calMonth.getTime() > tenYearsAgo.getTime();
                const canNext = calMonth.getTime() < currentMonth.getTime();

                // Per ogni giorno del mese, calcola un "punteggio" di completezza
                const dayDataMap = {};
                const sameDayLocal = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

                for (let d = 1; d <= daysInMonth; d++) {
                  const day = new Date(year, month, d);
                  const dayKeyAppFmt = `${year}-${month}-${d}`; // come il dayKey() dell'app

                  const hasWeight = (weights || []).some(w => sameDayLocal(new Date(w.ts), day));
                  const hasMeal = (meals || []).some(m => sameDayLocal(new Date(m.ts), day) && m.status !== 'planned');
                  const hasNote = (diaryNotes || []).some(n => sameDayLocal(new Date(n.ts), day));
                  const hasSleep = (sleeps || []).some(s => s.wakeDate === dayKeyAppFmt);
                  const hasWorkout = (workouts || []).some(w => sameDayLocal(new Date(w.ts), day));
                  const hasWater = (water?.[dayKeyAppFmt] || 0) > 0;
                  const score = [hasWeight, hasMeal, hasNote, hasSleep, hasWorkout, hasWater].filter(Boolean).length;
                  const isToday = sameDayLocal(today, day);
                  const isFuture = day > today;
                  dayDataMap[d] = { score, isToday, isFuture };
                }

                const totalActive = Object.values(dayDataMap).filter(d => d.score > 0 && !d.isFuture).length;
                const totalPast = Object.values(dayDataMap).filter(d => !d.isFuture).length;

                // Grid 7 colonne (lun-dom)
                const cells = [];
                // Padding iniziale per allineare il 1° del mese al giorno della settimana
                for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
                for (let d = 1; d <= daysInMonth; d++) cells.push(d);

                const dayLabels = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

                const cellSize = 36;
                const navBtnStyle = (enabled) => ({
                  background: enabled ? `${Q.gold}1A` : 'transparent',
                  border: `1px solid ${Q.gold}${enabled ? '88' : '33'}`,
                  color: Q.gold || Q.cream,
                  fontFamily: fGaramond,
                  fontSize: 20,
                  lineHeight: 1,
                  width: 44,
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  borderRadius: 4,
                  cursor: enabled ? 'pointer' : 'default',
                  opacity: enabled ? 1 : 0.3,
                  WebkitAppearance: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                  userSelect: 'none',
                });
                const goPrev = () => { if (canPrev) { setCalMonth(new Date(year, month - 1, 1)); setSelectedDay(null); } };
                const goNext = () => { if (canNext) { setCalMonth(new Date(year, month + 1, 1)); setSelectedDay(null); } };

                return (
                  <div>
                    {/* Header navigazione mesi */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <button type="button" onClick={goPrev} aria-label="mese precedente" style={navBtnStyle(canPrev)}>‹</button>
                      <div style={{ flex: 1, textAlign: 'center', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 14, color: Q.gold || Q.cream, opacity: 0.85, textTransform: 'capitalize' }}>
                        {monthLabel}
                      </div>
                      <button type="button" onClick={goNext} aria-label="mese successivo" style={navBtnStyle(canNext)}>›</button>
                    </div>

                    {/* Header giorni settimana */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, 1fr)`, gap: 4, marginBottom: 6 }}>
                      {dayLabels.map((l, i) => (
                        <div key={i} style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.2em', color: Q.cream, opacity: 0.45, textAlign: 'center', textTransform: 'uppercase' }}>
                          {l}
                        </div>
                      ))}
                    </div>

                    {/* Griglia giorni */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, 1fr)`, gap: 4 }}>
                      {cells.map((d, i) => {
                        if (d == null) return <div key={`pad-${i}`} style={{ height: cellSize }} />;
                        const info = dayDataMap[d];
                        const isSelected = selectedDay === d;
                        // Intensità dello score: 0..6 attività -> opacity tra 0.12 e 1.0
                        const intensity = info.isFuture ? 0 : Math.min(1, info.score / 4);
                        const bg = info.isFuture
                          ? 'transparent'
                          : info.score === 0
                            ? `${Q.cream || '#E8D8B8'}11`
                            : `${Q.gold || '#C9A876'}${Math.round(intensity * 255).toString(16).padStart(2, '0').toUpperCase()}`;
                        return (
                          <div key={d}
                            onClick={info.isFuture ? undefined : () => setSelectedDay(isSelected ? null : d)}
                            style={{
                              height: cellSize,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: bg,
                              border: isSelected
                                ? `2px solid ${Q.ink || '#1F140C'}`
                                : info.isToday ? `2px solid ${Q.gold || '#C9A876'}` : `1px solid ${Q.cream || '#E8D8B8'}15`,
                              borderRadius: 2,
                              fontFamily: fGaramond,
                              fontStyle: info.isFuture ? 'italic' : 'normal',
                              fontSize: 12,
                              color: info.score >= 2 ? Q.ink || '#1F140C' : (info.isFuture ? Q.cream + '55' : Q.cream),
                              opacity: info.isFuture ? 0.3 : 1,
                              fontWeight: info.isToday || isSelected ? 700 : 400,
                              cursor: info.isFuture ? 'default' : 'pointer',
                              userSelect: 'none',
                            }}>
                            {d}
                          </div>
                        );
                      })}
                    </div>

                    {/* Legenda */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: Q.cream, opacity: 0.7 }}>
                      <span>{totalActive}/{totalPast} giorni con dati</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ display: 'inline-block', width: 14, height: 14, background: `${Q.gold || '#C9A876'}33`, borderRadius: 2 }} />
                        <span style={{ display: 'inline-block', width: 14, height: 14, background: `${Q.gold || '#C9A876'}88`, borderRadius: 2 }} />
                        <span style={{ display: 'inline-block', width: 14, height: 14, background: `${Q.gold || '#C9A876'}FF`, borderRadius: 2 }} />
                        <span style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: fCinzel, fontStyle: 'normal', opacity: 0.8 }}>poco → molto</span>
                      </span>
                    </div>

                    {/* Hint quando non c'è selezione */}
                    {!selectedDay && (
                      <div style={{ marginTop: 12, textAlign: 'center', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: Q.cream, opacity: 0.55 }}>
                        tocca un giorno per vedere i dettagli
                      </div>
                    )}

                    {/* Dettaglio giorno selezionato */}
                    {selectedDay && (() => {
                      const day = new Date(year, month, selectedDay);
                      const dayKeyAppFmt = `${year}-${month}-${selectedDay}`;
                      const sameDayL = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
                      const ws = (weights || []).filter(w => sameDayL(new Date(w.ts), day)).sort((a, b) => new Date(a.ts) - new Date(b.ts));
                      const ms = (meals || []).filter(m => sameDayL(new Date(m.ts), day) && m.status !== 'planned');
                      const sl = (sleeps || []).find(s => s.wakeDate === dayKeyAppFmt);
                      const wk = (workouts || []).filter(w => sameDayL(new Date(w.ts), day));
                      const wg = water?.[dayKeyAppFmt] || 0; // grams
                      const mn = (mindful || []).filter(m => sameDayL(new Date(m.ts), day));
                      const fs = (fasts || []).filter(f => f.ended_ts && sameDayL(new Date(f.started_ts), day));
                      const dn = (diaryNotes || []).filter(n => sameDayL(new Date(n.ts), day));
                      const isEmpty = ws.length === 0 && ms.length === 0 && !sl && wk.length === 0 && wg === 0 && mn.length === 0 && fs.length === 0 && dn.length === 0;
                      const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: `1px solid ${Q.gold}1A`, fontFamily: fGaramond, fontSize: 14, color: Q.cream };
                      const labelStyle = { fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.3em', color: Q.goldDim, textTransform: 'uppercase' };
                      return (
                        <div style={{ marginTop: 18, padding: '14px 14px', background: `${Q.gold}10`, border: `1px solid ${Q.gold}33` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 16, color: Q.gold, textTransform: 'capitalize' }}>
                              {day.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                            <button onClick={() => setSelectedDay(null)} aria-label="chiudi"
                              style={{ background: 'transparent', border: 'none', color: Q.goldDim, fontSize: 22, lineHeight: 1, padding: '0 4px', cursor: 'pointer' }}>×</button>
                          </div>
                          {isEmpty ? (
                            <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.goldDim, textAlign: 'center', padding: '8px 0' }}>
                              nessun dato registrato in questo giorno
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                              {ws.map((w, idx) => (
                                <div key={`w${idx}`} style={rowStyle}>
                                  <span style={labelStyle}>peso{ws.length > 1 ? ` (${idx + 1})` : ''}</span>
                                  <span style={{ fontStyle: 'italic' }}>
                                    {fmt(w.weight)} kg
                                    {w.bodyFat != null && <span style={{ color: Q.goldDim, fontSize: 12, marginLeft: 8 }}>· {fmt(w.bodyFat)}% grasso</span>}
                                    {w.muscle != null && <span style={{ color: Q.goldDim, fontSize: 12, marginLeft: 8 }}>· {fmt(w.muscle)} muscolo</span>}
                                  </span>
                                </div>
                              ))}
                              {ms.length > 0 && (
                                <div style={rowStyle}>
                                  <span style={labelStyle}>pasti</span>
                                  <span style={{ fontStyle: 'italic' }}>{ms.length}{ms.some(m => m.photo || m.photo_url) ? ` · ${ms.filter(m => m.photo || m.photo_url).length} con foto` : ''}</span>
                                </div>
                              )}
                              {sl && (
                                <div style={rowStyle}>
                                  <span style={labelStyle}>sonno</span>
                                  <span style={{ fontStyle: 'italic' }}>{sl.hours != null ? `${fmt(sl.hours)} ore` : '—'}{sl.quality ? ` · qualità ${sl.quality}/5` : ''}</span>
                                </div>
                              )}
                              {wg > 0 && (
                                <div style={rowStyle}>
                                  <span style={labelStyle}>acqua</span>
                                  <span style={{ fontStyle: 'italic' }}>{(wg / 250).toFixed(1).replace('.', ',')} bicchieri ({wg} ml)</span>
                                </div>
                              )}
                              {wk.length > 0 && (
                                <div style={rowStyle}>
                                  <span style={labelStyle}>allenamenti</span>
                                  <span style={{ fontStyle: 'italic' }}>{wk.length}</span>
                                </div>
                              )}
                              {fs.length > 0 && (
                                <div style={rowStyle}>
                                  <span style={labelStyle}>digiuni</span>
                                  <span style={{ fontStyle: 'italic' }}>{fs.length} completati</span>
                                </div>
                              )}
                              {mn.length > 0 && (
                                <div style={rowStyle}>
                                  <span style={labelStyle}>mindful</span>
                                  <span style={{ fontStyle: 'italic' }}>{mn.length} sessioni</span>
                                </div>
                              )}
                              {dn.length > 0 && (
                                <div style={{ ...rowStyle, borderBottom: 'none', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                                  <span style={labelStyle}>note diario</span>
                                  {dn.map((n, idx) => (
                                    <div key={`n${idx}`} style={{ fontStyle: 'italic', fontSize: 13, color: Q.cream, lineHeight: 1.4, opacity: 0.9 }}>
                                      {n.text || n.body || '—'}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </Section>

            {/* Sezione 1: TREND PESO */}
            <Section Q={Q} title="TREND PESO" sub={periodObj?.label.toLowerCase() === 'sempre' ? 'da quando hai iniziato' : `ultimi ${periodObj.days} giorni`}>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
                <StatRow Q={Q} label="peso medio" value={fmt(stats.avgW)} sub="kg" />
                <StatRow Q={Q} label="delta" value={stats.delta != null ? `${stats.delta < 0 ? '−' : '+'}${fmt(Math.abs(stats.delta))}` : '—'} sub="kg" color={stats.delta != null ? (stats.delta < 0 ? '#A5B889' : '#C99A7A') : Q.cream} />
                <StatRow Q={Q} label="registrazioni" value={stats.daysRegistered} sub="giorni" />
              </div>
              <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height={chartH} style={{ display: 'block' }}>
                <defs>
                  <linearGradient id="statQa" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={Q.gold} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={Q.gold} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {mainChart.points.length > 1 && <path d={mainChart.area} fill="url(#statQa)" />}
                {mainChart.points.length > 1 && <path d={mainChart.path} stroke={Q.gold} strokeWidth="1.2" fill="none" />}
                {bfChartBig.points.length > 1 && <path d={bfChartBig.path} stroke="#C99A7A" strokeWidth="1.2" fill="none" strokeDasharray="3,2" opacity="0.85" />}
                {/* Linea obiettivo */}
                {goal != null && mainChart.min != null && goal >= mainChart.min - 3 && goal <= mainChart.max + 3 && (() => {
                  const span = Math.max(mainChart.max - mainChart.min, 0.5);
                  const y = 14 + (chartH - 14 * 2) * (1 - (goal - mainChart.min) / span);
                  return <line x1={8} x2={chartW - 8} y1={y} y2={y} stroke={Q.cream} strokeWidth="0.8" strokeDasharray="2,3" opacity="0.5" />;
                })()}
              </svg>
              {/* Min/Max */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim }}>
                <span>min {fmt(stats.minW)} kg</span>
                <span>max {fmt(stats.maxW)} kg</span>
              </div>
              {/* Goal ETA */}
              {goalEta && (
                <div style={{ marginTop: 12, textAlign: 'center', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: goalEta.color, padding: '8px 12px', background: `${goalEta.color}11`, border: `1px solid ${goalEta.color}33` }}>
                  {goalEta.msg}
                </div>
              )}
            </Section>

            {/* Sezione: OBIETTIVI MULTIPLI */}
            <Section Q={Q} title="OBIETTIVI" sub="i tuoi traguardi su sonno, idratazione, allenamento…">
              {goalsActive.length === 0 && (
                <div style={{ textAlign: 'center', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.goldDim, padding: '8px 8px 14px' }}>
                  Nessun obiettivo impostato. Tocca <span style={{ color: Q.gold }}>+ NUOVO</span> per iniziare.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {goalsActive.map(g => {
                  const def = GOAL_TYPES[g.goal_type];
                  if (!def) return null;
                  const cur = def.current(dataForGoals);
                  const target = Number(g.target_value);
                  const pct = cur != null ? Math.min(100, (cur / target) * 100) : 0;
                  const reached = cur != null && cur >= target;
                  const near = !reached && pct >= 75;
                  const barColor = reached ? '#A5B889' : near ? Q.gold : Q.goldDim;
                  return (
                    <div key={g.id} onClick={() => setGoalModal(g)}
                      style={{ padding: '12px 14px', border: `1px solid ${Q.gold}33`, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <span style={{ fontSize: 20, color: Q.gold, minWidth: 22, textAlign: 'center' }}>{def.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', color: Q.gold, textTransform: 'uppercase' }}>{def.label}</div>
                          <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim }}>{def.unit}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 16, color: reached ? '#A5B889' : Q.cream }}>
                            {cur != null ? fmt(cur, def.step < 1 ? 1 : 0) : '—'}
                          </span>
                          <span style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: Q.goldDim }}> / {fmt(target, def.step < 1 ? 1 : 0)}</span>
                        </div>
                      </div>
                      <div style={{ height: 5, background: `${Q.goldDim}33`, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button onClick={() => setGoalModal('new')}
                  style={{ background: 'transparent', color: Q.gold, border: `1px solid ${Q.gold}66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.35em', padding: '8px 16px', cursor: 'pointer', textTransform: 'uppercase' }}>
                  + NUOVO OBIETTIVO
                </button>
              </div>
            </Section>

            {/* Sezione 2: COMPOSIZIONE CORPOREA */}
            {(compStats.bf || compStats.mu || compStats.wa) && (
              <Section Q={Q} title="COMPOSIZIONE CORPOREA" sub="grasso · muscolo · acqua">
                <div style={{ display: 'flex', justifyContent: 'space-around', gap: 8 }}>
                  {compStats.bf && (
                    <StatRow Q={Q} label="% grasso" value={fmt(compStats.bf.last)}
                      sub={compStats.bf.delta != null ? `${compStats.bf.delta < 0 ? '−' : '+'}${fmt(Math.abs(compStats.bf.delta))}%` : 'unico dato'}
                      color={compStats.bf.delta != null ? (compStats.bf.delta < 0 ? '#A5B889' : '#C99A7A') : Q.cream} />
                  )}
                  {compStats.mu && (
                    <StatRow Q={Q} label="% muscolo" value={fmt(compStats.mu.last)}
                      sub={compStats.mu.delta != null ? `${compStats.mu.delta < 0 ? '−' : '+'}${fmt(Math.abs(compStats.mu.delta))}%` : 'unico dato'}
                      color={compStats.mu.delta != null ? (compStats.mu.delta < 0 ? '#C99A7A' : '#A5B889') : Q.cream} />
                  )}
                  {compStats.wa && (
                    <StatRow Q={Q} label="% acqua" value={fmt(compStats.wa.last)}
                      sub={compStats.wa.delta != null ? `${compStats.wa.delta < 0 ? '−' : '+'}${fmt(Math.abs(compStats.wa.delta))}%` : 'unico dato'}
                      color={Q.cream} />
                  )}
                </div>
                {compStats.leanMass && (
                  <div style={{ marginTop: 18, textAlign: 'center', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 14, color: Q.cream }}>
                    massa magra stimata <span style={{ color: Q.gold }}>{fmt(compStats.leanMass)} kg</span>
                  </div>
                )}
              </Section>
            )}

            {/* Sezione 3: PATTERN SETTIMANALI */}
            {dowPattern && (
              <Section Q={Q} title="PATTERN SETTIMANALI" sub="peso medio per giorno della settimana">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 100, padding: '0 4px' }}>
                  {dowPattern.avgs.map((avg, i) => {
                    if (avg == null) return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: 0.3 }}>
                        <div style={{ flex: 1 }} />
                        <div style={{ width: '60%', height: 1, background: Q.goldDim }} />
                        <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 10, color: Q.goldDim }}>{DOW_LABELS[i]}</div>
                      </div>
                    );
                    const span = Math.max(dowPattern.max - dowPattern.min, 0.3);
                    const h = 70 * ((avg - dowPattern.min) / span) + 6;
                    const isBest = i === dowPattern.bestIdx;
                    const isWorst = i === dowPattern.worstIdx;
                    const color = isBest ? '#A5B889' : isWorst ? '#C99A7A' : Q.gold;
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 10, color }}>{fmt(avg, 1)}</div>
                        <div style={{ width: '55%', height: h, background: color, opacity: 0.85 }} />
                        <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 10, color: Q.goldDim }}>{DOW_LABELS[i]}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 12, textAlign: 'center', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: Q.goldDim }}>
                  più leggero il <span style={{ color: '#A5B889' }}>{DOW_LABELS[dowPattern.bestIdx]}edì</span> · più pesante il <span style={{ color: '#C99A7A' }}>{DOW_LABELS[dowPattern.worstIdx]}edì</span>
                </div>
              </Section>
            )}

            {/* Sezione 4: ALTRE ABITUDINI */}
            <Section Q={Q} title="ALTRE ABITUDINI" sub="nel periodo selezionato">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <StatRow Q={Q} label="pasti registrati" value={otherAgg.mealsCount} sub={otherAgg.photosCount > 0 ? `di cui ${otherAgg.photosCount} con foto` : ''} />
                <StatRow Q={Q} label="sonno medio" value={otherAgg.avgSleepHours != null ? fmt(otherAgg.avgSleepHours) : '—'} sub={otherAgg.avgSleepHours != null ? 'ore/notte' : ''} />
                <StatRow Q={Q} label="acqua media" value={otherAgg.avgWaterGlasses != null ? fmt(otherAgg.avgWaterGlasses, 1) : '—'} sub={otherAgg.avgWaterGlasses != null ? 'bicchieri/giorno' : ''} />
                <StatRow Q={Q} label="allenamenti" value={otherAgg.workoutsCount} sub="sessioni" />
                <StatRow Q={Q} label="digiuni" value={otherAgg.fastsCount} sub="completati" />
                <StatRow Q={Q} label="mindful" value={otherAgg.mindfulCount} sub="sessioni" />
              </div>
            </Section>
          </>
        )}

        {/* Sezione: CORRELAZIONI (IA) */}
        <Section Q={Q} title="CORRELAZIONI" sub="pattern tra le tue abitudini · generati con IA">
          {!insights && !insightsLoading && !insightsError && (
            <div style={{ textAlign: 'center' }}>
              <button onClick={() => generateInsights(false)}
                style={{ background: 'transparent', color: Q.gold, border: `1px solid ${Q.gold}66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.35em', padding: '10px 18px', cursor: 'pointer', textTransform: 'uppercase' }}>
                ✦ GENERA INSIGHTS
              </button>
              <div style={{ marginTop: 10, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim }}>
                L'IA analizza i dati settimanali per trovare correlazioni
              </div>
            </div>
          )}
          {insightsLoading && (
            <div style={{ textAlign: 'center', padding: '14px', fontFamily: fGaramond, fontStyle: 'italic', color: Q.goldDim }}>
              <span style={{ display: 'inline-block', animation: 'pulse 1.4s infinite' }}>✦</span> sto analizzando i tuoi dati…
            </div>
          )}
          {insightsError && (
            <div style={{ textAlign: 'center', color: '#C99A7A', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13 }}>
              errore: {insightsError}
              <div style={{ marginTop: 10 }}>
                <button onClick={() => generateInsights(true)} style={{ background: 'transparent', color: Q.gold, border: `1px solid ${Q.gold}66`, fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.3em', padding: '6px 14px', cursor: 'pointer' }}>RIPROVA</button>
              </div>
            </div>
          )}
          {insights && (
            <>
              {insights.items.length === 0 && insights.note && (
                <div style={{ textAlign: 'center', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.goldDim, padding: '14px' }}>
                  {insights.note}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {insights.items.map((it, i) => (
                  <div key={i} style={{ padding: '14px 16px', border: `1px solid ${toneColor(it.tone)}44`, background: `${toneColor(it.tone)}0E` }}>
                    <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.35em', color: toneColor(it.tone), textTransform: 'uppercase', marginBottom: 6 }}>{it.title}</div>
                    <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 14, color: Q.cream, lineHeight: 1.45 }}>{it.body}</div>
                  </div>
                ))}
              </div>
              {insights.note && insights.items.length > 0 && (
                <div style={{ marginTop: 12, textAlign: 'center', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim }}>{insights.note}</div>
              )}
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button onClick={() => generateInsights(true)} style={{ background: 'transparent', color: Q.goldDim, border: `1px solid ${Q.goldDim}44`, fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.3em', padding: '6px 14px', cursor: 'pointer' }}>
                  ↻ RIGENERA
                </button>
                {insights.fromCache && <span style={{ marginLeft: 10, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 10, color: Q.goldDim }}>(da cache)</span>}
              </div>
            </>
          )}
        </Section>

        {/* Sezione: RIASSUNTO MENSILE (IA) */}
        {currentMonth && (
          <Section Q={Q} title="RIASSUNTO MENSILE" sub={new Date(currentMonth.mese + '-01').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}>
            {/* Numeri base sempre visibili */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              {currentMonth.peso_inizio != null && (
                <StatRow Q={Q} label="peso inizio" value={fmt(currentMonth.peso_inizio)} sub="kg" />
              )}
              {currentMonth.peso_fine != null && (
                <StatRow Q={Q} label="peso fine" value={fmt(currentMonth.peso_fine)} sub="kg"
                  color={currentMonth.peso_inizio != null && currentMonth.peso_fine < currentMonth.peso_inizio ? '#A5B889' : currentMonth.peso_inizio != null && currentMonth.peso_fine > currentMonth.peso_inizio ? '#C99A7A' : Q.cream} />
              )}
              <StatRow Q={Q} label="pasti" value={currentMonth.pasti_registrati} sub="registrati" />
              <StatRow Q={Q} label="sonno medio" value={currentMonth.sonno_medio_ore != null ? fmt(currentMonth.sonno_medio_ore) : '—'} sub="ore" />
              <StatRow Q={Q} label="allenamenti" value={currentMonth.allenamenti} sub="sessioni" />
              <StatRow Q={Q} label="digiuni" value={currentMonth.digiuni} sub="completati" />
            </div>
            {/* Narrazione IA */}
            {!monthlySummary && !monthlyLoading && !monthlyError && (
              <div style={{ textAlign: 'center' }}>
                <button onClick={() => generateMonthlySummary(false)}
                  style={{ background: 'transparent', color: Q.gold, border: `1px solid ${Q.gold}66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.35em', padding: '10px 18px', cursor: 'pointer', textTransform: 'uppercase' }}>
                  ✦ GENERA RIASSUNTO
                </button>
                <div style={{ marginTop: 10, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim }}>
                  L'IA scrive un riassunto narrativo del mese
                </div>
              </div>
            )}
            {monthlyLoading && (
              <div style={{ textAlign: 'center', padding: '14px', fontFamily: fGaramond, fontStyle: 'italic', color: Q.goldDim }}>
                <span style={{ display: 'inline-block' }}>✦</span> sto raccontando il tuo mese…
              </div>
            )}
            {monthlyError && (
              <div style={{ textAlign: 'center', color: '#C99A7A', fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13 }}>
                errore: {monthlyError}
                <div style={{ marginTop: 10 }}>
                  <button onClick={() => generateMonthlySummary(true)} style={{ background: 'transparent', color: Q.gold, border: `1px solid ${Q.gold}66`, fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.3em', padding: '6px 14px', cursor: 'pointer' }}>RIPROVA</button>
                </div>
              </div>
            )}
            {monthlySummary && (
              <>
                <div style={{ padding: '14px 18px', border: `1px solid ${Q.gold}44`, background: `${Q.gold}0E`, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 15, color: Q.cream, lineHeight: 1.5, textAlign: 'left' }}>
                  {monthlySummary}
                </div>
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <button onClick={() => generateMonthlySummary(true)} style={{ background: 'transparent', color: Q.goldDim, border: `1px solid ${Q.goldDim}44`, fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.3em', padding: '6px 14px', cursor: 'pointer' }}>↻ RIGENERA</button>
                </div>
              </>
            )}
          </Section>
        )}

        {/* Sezione 5: EXPORT */}
        <Section Q={Q} title="ESPORTA" sub="scarica tutti i tuoi dati in CSV">
          <div style={{ textAlign: 'center' }}>
            <button onClick={() => exportAllCSV({ weights, meals, sleeps, water, workouts, workoutTypes, supplements, suppTaken, mindful, fasts, diaryNotes })}
              style={{ background: Q.gold, color: Q.ink, border: 'none', fontFamily: fCinzel, fontSize: 11, letterSpacing: '0.35em', padding: '12px 26px', cursor: 'pointer', textTransform: 'uppercase' }}>
              SCARICA CSV
            </button>
            <div style={{ marginTop: 10, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim }}>
              riceverai un file per categoria (pesi, pasti, sonno, ecc.)
            </div>
          </div>
        </Section>
      </div>
      {goalModal && (
        <GoalModal
          existing={goalModal === 'new' ? null : goalModal}
          alreadyUsed={goalsAlreadyUsed}
          onClose={() => setGoalModal(null)}
          onSave={saveGoal}
          onDelete={goalModal !== 'new' ? deleteGoal : null}
        />
      )}
    </div>
  );
}
