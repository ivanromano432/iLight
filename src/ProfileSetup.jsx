// Setup iniziale del profilo: raccontami di te.
// Mostrato dopo l'onboarding (le 6 slide) al primo accesso, prima di entrare nell'app.
// Raccoglie dati utili per personalizzare l'IA: sesso, anno, altezza, peso attuale,
// peso obiettivo, stile alimentare, allergie, livello attivita'.
//
// Al termine: salva tutto in profiles + crea la prima pesata in weights + segna setup_completed=true.

import { useState, useEffect } from 'react';
import { C, fSerif, page, btn, chip, label, input, tag, muted, ensureUiFonts } from './ui.js';

// Nuovo UUID per la pesata iniziale
function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return (Date.now() + Math.random()).toString();
}

export default function ProfileSetup({ profile, updProfile, onCreateWeight, onDone, latestWeight }) {
  useEffect(ensureUiFonts, []);
  const [step, setStep] = useState(0);

  // State dei vari campi (precompilato se profile li ha già)
  const [name, setName] = useState(profile?.display_name || '');
  const [sex, setSex] = useState(profile?.sex || '');
  const [birthYear, setBirthYear] = useState(profile?.birth_year ? String(profile.birth_year) : '');
  const [heightCm, setHeightCm] = useState(profile?.height_cm ? String(profile.height_cm) : '');
  // Per utenti esistenti: precompila con l'ultima pesata in modo che il campo non sia vuoto
  const [currentWeight, setCurrentWeight] = useState(latestWeight != null ? String(latestWeight) : '');
  const [goalWeight, setGoalWeight] = useState(profile?.goal_weight ? String(profile.goal_weight) : '');
  const [dietStyle, setDietStyle] = useState(profile?.diet_style || '');
  const [allergies, setAllergies] = useState(profile?.allergies || '');
  const [activityLevel, setActivityLevel] = useState(profile?.activity_level || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currentYear = new Date().getFullYear();

  const STEPS = [
    {
      id: 'name',
      title: 'Come ti chiami?',
      sub: 'il nome che vuoi vedere nell\'app',
      valid: () => name.trim().length >= 1 && name.trim().length <= 40,
      hint: 'Puoi anche usare un soprannome',
    },
    {
      id: 'sex_year',
      title: 'Sesso e anno di nascita',
      sub: 'servono per calcoli precisi (BMR, ecc.)',
      valid: () => !!sex && !!birthYear && parseInt(birthYear) >= 1900 && parseInt(birthYear) <= currentYear - 8,
      hint: 'Privato — l\'IA usa questi dati solo per personalizzare i consigli',
    },
    {
      id: 'height',
      title: 'Quanto sei alto/a?',
      sub: 'in centimetri',
      valid: () => heightCm && parseInt(heightCm) >= 100 && parseInt(heightCm) <= 250,
      hint: 'Serve per il BMI e la composizione corporea',
    },
    {
      id: 'weight',
      title: 'Peso attuale e obiettivo',
      sub: 'la pesata di oggi e dove vuoi arrivare',
      valid: () => currentWeight && parseFloat(currentWeight) >= 20 && parseFloat(currentWeight) <= 300 && goalWeight && parseFloat(goalWeight) >= 20 && parseFloat(goalWeight) <= 300,
      hint: 'Salvo la pesata di oggi nel diario peso',
    },
    {
      id: 'diet',
      title: 'Come mangi?',
      sub: 'lo stile alimentare di base',
      valid: () => !!dietStyle,
      hint: 'Per consigli sui pasti coerenti con il tuo stile',
    },
    {
      id: 'allergies',
      title: 'Allergie o intolleranze?',
      sub: 'opzionale — puoi anche saltare',
      valid: () => true, // sempre valido, allergie è facoltativo
      hint: 'Scrivi liberamente: glutine, lattosio, frutta secca…',
      optional: true,
    },
    {
      id: 'activity',
      title: 'Quanto sei attivo/a?',
      sub: 'il tuo livello medio settimanale',
      valid: () => !!activityLevel,
      hint: 'Per calcolare il fabbisogno calorico',
    },
  ];

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const canAdvance = current.valid();

  async function next() {
    if (!canAdvance) return;
    setError('');
    if (isLast) {
      await save();
    } else {
      setStep(step + 1);
    }
  }

  function prev() {
    if (step > 0) { setStep(step - 1); setError(''); }
  }

  async function save() {
    setSaving(true);
    try {
      const fields = {
        display_name: name.trim(),
        sex,
        birth_year: parseInt(birthYear),
        height_cm: parseInt(heightCm),
        goal_weight: parseFloat(goalWeight),
        diet_style: dietStyle,
        allergies: allergies.trim() || null,
        activity_level: activityLevel,
        setup_completed: true,
      };
      await updProfile(fields);
      // Crea la pesata SOLO se è diversa dall'ultima registrata (evita duplicati per utenti esistenti)
      const kg = parseFloat(currentWeight);
      if (kg && onCreateWeight && kg !== latestWeight) {
        await onCreateWeight({
          id: newId(),
          ts: new Date().toISOString(),
          weight: kg,
        });
      }
      onDone();
    } catch (e) {
      console.error('[ProfileSetup] save error', e);
      setError('Errore di salvataggio: ' + (e.message || 'sconosciuto'));
    } finally {
      setSaving(false);
    }
  }

  // --- Render nuovo stile: barra dei passi, una domanda per schermata ---
  const numField = (lab, value, onChange, placeholder, unit, mode='numeric', auto=false) => (
    <label style={{ display: 'block' }}>
      <span style={label}>{lab}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, borderBottom: `2px solid ${C.gold}` }}>
        <input type="text" inputMode={mode} value={value} onChange={onChange} placeholder={placeholder} autoFocus={auto} style={{ ...input(48), border: 'none', padding: '2px 0 4px' }} />
        {unit && <span style={{ fontSize: 16, color: C.dim }}>{unit}</span>}
      </span>
    </label>
  );
  const optCard = (active, onClick, lab, sub) => (
    <button key={lab} onClick={onClick} aria-pressed={active} style={{ minHeight: 60, padding: '10px 16px', textAlign: 'left', cursor: 'pointer', borderRadius: 16, background: active ? C.gold : C.card, border: `1px solid ${active ? C.gold : C.line}`, color: active ? C.navy : C.cream, fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 16, fontWeight: 600 }}>{lab}</span>
      <span style={{ fontSize: 13, opacity: 0.8 }}>{sub}</span>
    </button>
  );
  return (
    <div style={{ ...page, position: 'fixed', inset: 0, zIndex: 1000, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100%', boxSizing: 'border-box', padding: 'calc(40px + env(safe-area-inset-top, 0px)) 24px 32px', display: 'flex', flexDirection: 'column', gap: 26 }}>
        <div style={{ display: 'flex', gap: 6 }} role="img" aria-label={`passo ${step + 1} di ${STEPS.length}`}>
          {STEPS.map((_, i) => (<span key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? C.gold : '#2A4466' }} />))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={tag}>passo {step + 1} di {STEPS.length}</span>
          <h1 style={{ fontFamily: fSerif, fontSize: 38, fontWeight: 500, lineHeight: 1.1, margin: 0 }}>{current.title}</h1>
          <span style={muted}>{current.sub.charAt(0).toUpperCase() + current.sub.slice(1)}. {current.hint}.</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
          {current.id === 'name' && (
            <label><span style={label}>il tuo nome</span>
              <input type="text" value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="il tuo nome" maxLength={40} style={input(40)} /></label>
          )}
          {current.id === 'sex_year' && (<>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {[['f', 'Donna'], ['m', 'Uomo'], ['other', 'Altro'], ['prefer_not_say', 'Preferisco non dire']].map(([id, l]) => (
                <button key={id} onClick={() => setSex(id)} aria-pressed={sex === id} style={{ ...chip(sex === id), minHeight: 50 }}>{l}</button>
              ))}
            </div>
            {numField('anno di nascita', birthYear, e => setBirthYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4)), String(currentYear - 35), '')}
          </>)}
          {current.id === 'height' && numField('altezza', heightCm, e => setHeightCm(e.target.value.replace(/[^0-9]/g, '').slice(0, 3)), '170', 'cm', 'numeric', true)}
          {current.id === 'weight' && (<>
            {numField('peso attuale', currentWeight, e => setCurrentWeight(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.').slice(0, 6)), '70.5', 'kg', 'decimal', true)}
            {numField('peso obiettivo', goalWeight, e => setGoalWeight(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.').slice(0, 6)), '65.0', 'kg', 'decimal')}
          </>)}
          {current.id === 'diet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['onnivoro', 'Onnivoro', 'mangio di tutto'], ['vegetariano', 'Vegetariano', 'niente carne né pesce'], ['vegano', 'Vegano', 'nessun prodotto animale'], ['pescatariano', 'Pescatariano', 'niente carne, pesce sì'], ['altro', 'Altro', 'ad esempio chetogenica o paleo']].map(([id, l, sub]) => optCard(dietStyle === id, () => setDietStyle(id), l, sub))}
            </div>
          )}
          {current.id === 'allergies' && (<>
            <textarea value={allergies} onChange={e => setAllergies(e.target.value.slice(0, 300))} autoFocus placeholder="es. lattosio, frutta secca, glutine…" rows={4} aria-label="allergie o intolleranze"
              style={{ width: '100%', boxSizing: 'border-box', background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, fontFamily: 'inherit', fontSize: 16, color: C.cream, padding: 14, outline: 'none', resize: 'none', lineHeight: 1.5 }} />
            <span style={muted}>Lascia vuoto se non ne hai.</span>
          </>)}
          {current.id === 'activity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['sedentario', 'Sedentario', 'lavoro fermo, niente sport'], ['leggero', 'Leggero', '1-2 sessioni a settimana'], ['moderato', 'Moderato', '3-4 sessioni a settimana'], ['intenso', 'Intenso', '5-6 sessioni a settimana'], ['molto_intenso', 'Molto intenso', 'allenamenti quotidiani o atleta']].map(([id, l, sub]) => optCard(activityLevel === id, () => setActivityLevel(id), l, sub))}
            </div>
          )}
          {error && <div role="alert" style={{ fontSize: 14, color: C.sal, lineHeight: 1.4 }}>{error}</div>}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 && <button onClick={prev} disabled={saving} style={{ ...btn(false), width: 'auto', padding: '0 20px', borderColor: `${C.cream}88` }}>indietro</button>}
          <button onClick={next} disabled={!canAdvance || saving} style={{ ...btn(), flex: 1, opacity: (!canAdvance || saving) ? 0.5 : 1 }}>{saving ? '…' : (isLast ? 'entra in GoalFit' : 'avanti')}</button>
        </div>
      </div>
    </div>
  );
}
