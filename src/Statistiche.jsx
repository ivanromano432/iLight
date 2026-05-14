// Pagina Statistiche dedicata: trend lungo periodo, composizione corporea, pattern settimanali, export CSV.
// Accessibile dalla pagina Peso tramite bottone "STATISTICHE COMPLETE".

import { useState, useMemo } from 'react';

// Palette: usa la palette Quercus della pagina Peso
const Q = { bg1: '#3A2818', bg2: '#1F140C', gold: '#C9A876', goldDim: '#8B7355', cream: '#E8D8B8', ink: '#1F140C' };
const fGaramond = '"Cormorant Garamond", serif';
const fCinzel = '"Cinzel", serif';

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
    ['quercus_pesi', weights.map(w => ({
      data: new Date(w.ts).toLocaleString('it-IT'),
      peso_kg: w.weight,
      grasso_pct: w.bodyFat ?? '',
      muscolo_pct: w.muscle ?? '',
      acqua_pct: w.water ?? '',
    })), ['data', 'peso_kg', 'grasso_pct', 'muscolo_pct', 'acqua_pct']],
    ['quercus_pasti', meals.map(m => ({
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
    ['quercus_sonno', sleeps.map(s => ({
      data_risveglio: s.wakeDate,
      a_letto: s.bedtime,
      sveglia: s.waketime,
      qualita: s.quality ?? '',
      note: s.notes ?? '',
    })), ['data_risveglio', 'a_letto', 'sveglia', 'qualita', 'note']],
    ['quercus_acqua', Object.entries(water || {}).map(([day, glasses]) => ({
      giorno: day, bicchieri: glasses,
    })), ['giorno', 'bicchieri']],
    ['quercus_allenamenti', workouts.map(w => ({
      data: new Date(w.ts).toLocaleString('it-IT'),
      tipo: typeNameById[w.typeId] || w.typeId,
      quantita: w.qty ?? '',
      note: w.notes ?? '',
    })), ['data', 'tipo', 'quantita', 'note']],
    ['quercus_integratori_presi', Object.entries(suppTaken || {}).flatMap(([day, ids]) =>
      (ids || []).map(id => ({ giorno: day, integratore: suppNameById[id] || id }))
    ), ['giorno', 'integratore']],
    ['quercus_mindful', mindful.map(m => ({
      data: new Date(m.ts).toLocaleString('it-IT'),
      tipo: m.type ?? '',
      durata_min: m.duration_min ?? '',
      note: m.note ?? '',
    })), ['data', 'tipo', 'durata_min', 'note']],
    ['quercus_digiuni', fasts.map(f => ({
      inizio: f.started_ts ? new Date(f.started_ts).toLocaleString('it-IT') : '',
      fine_pianificata: f.planned_end_ts ? new Date(f.planned_end_ts).toLocaleString('it-IT') : '',
      fine_effettiva: f.ended_ts ? new Date(f.ended_ts).toLocaleString('it-IT') : '',
      ore_obiettivo: f.planned_hours ?? '',
      tipo: f.type ?? '',
      etichetta: f.label ?? '',
    })), ['inizio', 'fine_pianificata', 'fine_effettiva', 'ore_obiettivo', 'tipo', 'etichetta']],
    ['quercus_diario', diaryNotes.map(n => ({
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

function StatRow({ label, value, sub, color }) {
  return (
    <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.35em', color: Q.goldDim, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 26, color: color || Q.cream, marginTop: 4, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 11, color: Q.goldDim, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, sub, children }) {
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

export default function StatistichePage({
  weights = [], meals = [], sleeps = [], water = {}, workouts = [], workoutTypes = [],
  supplements = [], suppTaken = {}, mindful = [], fasts = [], diaryNotes = [],
  goal = null, onClose,
}) {
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
            {/* Sezione 1: TREND PESO */}
            <Section title="TREND PESO" sub={periodObj?.label.toLowerCase() === 'sempre' ? 'da quando hai iniziato' : `ultimi ${periodObj.days} giorni`}>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
                <StatRow label="peso medio" value={fmt(stats.avgW)} sub="kg" />
                <StatRow label="delta" value={stats.delta != null ? `${stats.delta < 0 ? '−' : '+'}${fmt(Math.abs(stats.delta))}` : '—'} sub="kg" color={stats.delta != null ? (stats.delta < 0 ? '#A5B889' : '#C99A7A') : Q.cream} />
                <StatRow label="registrazioni" value={stats.daysRegistered} sub="giorni" />
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

            {/* Sezione 2: COMPOSIZIONE CORPOREA */}
            {(compStats.bf || compStats.mu || compStats.wa) && (
              <Section title="COMPOSIZIONE CORPOREA" sub="grasso · muscolo · acqua">
                <div style={{ display: 'flex', justifyContent: 'space-around', gap: 8 }}>
                  {compStats.bf && (
                    <StatRow label="% grasso" value={fmt(compStats.bf.last)}
                      sub={compStats.bf.delta != null ? `${compStats.bf.delta < 0 ? '−' : '+'}${fmt(Math.abs(compStats.bf.delta))}%` : 'unico dato'}
                      color={compStats.bf.delta != null ? (compStats.bf.delta < 0 ? '#A5B889' : '#C99A7A') : Q.cream} />
                  )}
                  {compStats.mu && (
                    <StatRow label="% muscolo" value={fmt(compStats.mu.last)}
                      sub={compStats.mu.delta != null ? `${compStats.mu.delta < 0 ? '−' : '+'}${fmt(Math.abs(compStats.mu.delta))}%` : 'unico dato'}
                      color={compStats.mu.delta != null ? (compStats.mu.delta < 0 ? '#C99A7A' : '#A5B889') : Q.cream} />
                  )}
                  {compStats.wa && (
                    <StatRow label="% acqua" value={fmt(compStats.wa.last)}
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
              <Section title="PATTERN SETTIMANALI" sub="peso medio per giorno della settimana">
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
            <Section title="ALTRE ABITUDINI" sub="nel periodo selezionato">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <StatRow label="pasti registrati" value={otherAgg.mealsCount} sub={otherAgg.photosCount > 0 ? `di cui ${otherAgg.photosCount} con foto` : ''} />
                <StatRow label="sonno medio" value={otherAgg.avgSleepHours != null ? fmt(otherAgg.avgSleepHours) : '—'} sub={otherAgg.avgSleepHours != null ? 'ore/notte' : ''} />
                <StatRow label="acqua media" value={otherAgg.avgWaterGlasses != null ? fmt(otherAgg.avgWaterGlasses, 1) : '—'} sub={otherAgg.avgWaterGlasses != null ? 'bicchieri/giorno' : ''} />
                <StatRow label="allenamenti" value={otherAgg.workoutsCount} sub="sessioni" />
                <StatRow label="digiuni" value={otherAgg.fastsCount} sub="completati" />
                <StatRow label="mindful" value={otherAgg.mindfulCount} sub="sessioni" />
              </div>
            </Section>
          </>
        )}

        {/* Sezione 5: EXPORT */}
        <Section title="ESPORTA" sub="scarica tutti i tuoi dati in CSV">
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
    </div>
  );
}
