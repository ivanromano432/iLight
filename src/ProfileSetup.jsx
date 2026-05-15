// Setup iniziale del profilo: raccontami di te.
// Mostrato dopo l'onboarding (le 6 slide) al primo accesso, prima di entrare nell'app.
// Raccoglie dati utili per personalizzare l'IA: sesso, anno, altezza, peso attuale,
// peso obiettivo, stile alimentare, allergie, livello attivita'.
//
// Al termine: salva tutto in profiles + crea la prima pesata in weights + segna setup_completed=true.

import { useState, useEffect } from 'react';
import { getTheme } from './themes.js';

const fGaramond = '"Cormorant Garamond", serif';
const fCinzel = '"Cinzel", serif';

// Nuovo UUID per la pesata iniziale
function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return (Date.now() + Math.random()).toString();
}

export default function ProfileSetup({ profile, updProfile, onCreateWeight, onDone }) {
  const Q = getTheme(profile?.theme);
  const [step, setStep] = useState(0);

  // State dei vari campi (precompilato se profile li ha già)
  const [name, setName] = useState(profile?.display_name || '');
  const [sex, setSex] = useState(profile?.sex || '');
  const [birthYear, setBirthYear] = useState(profile?.birth_year ? String(profile.birth_year) : '');
  const [heightCm, setHeightCm] = useState(profile?.height_cm ? String(profile.height_cm) : '');
  const [currentWeight, setCurrentWeight] = useState('');
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
      // Crea la prima pesata
      const kg = parseFloat(currentWeight);
      if (kg && onCreateWeight) {
        await onCreateWeight({
          id: newId(),
          ts: new Date().toISOString(),
          kg,
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

  // Stili condivisi
  const inputStyle = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${Q.gold}77`,
    fontFamily: fGaramond,
    fontStyle: 'italic',
    fontSize: 28,
    color: Q.cream,
    padding: '10px 0',
    outline: 'none',
    textAlign: 'center',
  };
  const optBtn = (active) => ({
    padding: '14px 16px',
    fontFamily: fCinzel,
    fontSize: 11,
    letterSpacing: '0.25em',
    background: active ? Q.gold : 'transparent',
    color: active ? Q.ink : Q.cream,
    border: `1px solid ${Q.gold}${active ? '' : '66'}`,
    cursor: 'pointer',
    textTransform: 'uppercase',
    borderRadius: 0,
    transition: 'all 0.15s',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: `radial-gradient(ellipse at top, ${Q.bg1} 0%, ${Q.bg2} 100%)`, color: Q.cream, fontFamily: fGaramond, overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 14, border: `1px solid ${Q.gold}40`, borderRadius: 20, pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', inset: 20, border: `1px solid ${Q.gold}1A`, borderRadius: 16, pointerEvents: 'none' }} />

      {/* Header con contatore */}
      <div style={{ position: 'relative', zIndex: 2, padding: '22px 28px 0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.4em', color: Q.gold, opacity: 0.75, textTransform: 'uppercase' }}>
          Raccontami di te · {step + 1} / {STEPS.length}
        </div>
      </div>

      {/* Corpo */}
      <div style={{
        position: 'relative', zIndex: 2,
        padding: '20px 30px 0',
        maxWidth: 480, margin: '0 auto',
        height: 'calc(100vh - 60px)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ flex: 1 }}>

          {/* Header step */}
          <div style={{ textAlign: 'center', marginTop: 24, marginBottom: 36 }}>
            <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.5em', color: Q.gold, opacity: 0.7, textTransform: 'uppercase', marginBottom: 8 }}>
              ✦ {String(step + 1).padStart(2, '0')} ✦
            </div>
            <div style={{ fontFamily: fCinzel, fontSize: 20, letterSpacing: '0.15em', color: Q.gold, textTransform: 'uppercase', lineHeight: 1.3 }}>
              {current.title}
            </div>
            <div style={{ marginTop: 8, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 15, color: Q.cream, opacity: 0.75 }}>
              {current.sub}
            </div>
            <div style={{ width: 60, height: 1, background: Q.gold, opacity: 0.5, margin: '14px auto 0' }} />
          </div>

          {/* Form per ogni step */}
          {current.id === 'name' && (
            <div>
              <input type="text" value={name} onChange={e => setName(e.target.value)} autoFocus
                placeholder="il tuo nome" maxLength={40} style={inputStyle} />
            </div>
          )}

          {current.id === 'sex_year' && (
            <div>
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.4em', color: Q.gold, opacity: 0.7, textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>sesso</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button onClick={() => setSex('F')} style={optBtn(sex === 'F')}>Donna</button>
                  <button onClick={() => setSex('M')} style={optBtn(sex === 'M')}>Uomo</button>
                  <button onClick={() => setSex('other')} style={optBtn(sex === 'other')}>Altro</button>
                  <button onClick={() => setSex('prefer_not_say')} style={optBtn(sex === 'prefer_not_say')}>Preferisco non dire</button>
                </div>
              </div>
              <div>
                <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.4em', color: Q.gold, opacity: 0.7, textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>anno di nascita</div>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={birthYear} onChange={e => setBirthYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder={String(currentYear - 35)} style={inputStyle} />
              </div>
            </div>
          )}

          {current.id === 'height' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={heightCm} onChange={e => setHeightCm(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} autoFocus
                  placeholder="170" style={{ ...inputStyle, width: 'auto', maxWidth: 180, fontSize: 48 }} />
                <span style={{ fontFamily: fCinzel, fontSize: 14, letterSpacing: '0.3em', color: Q.gold, opacity: 0.85 }}>CM</span>
              </div>
            </div>
          )}

          {current.id === 'weight' && (
            <div>
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.4em', color: Q.gold, opacity: 0.7, textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>peso attuale</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
                  <input type="text" inputMode="decimal" value={currentWeight} onChange={e => setCurrentWeight(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.').slice(0, 6))} autoFocus
                    placeholder="70.5" style={{ ...inputStyle, width: 'auto', maxWidth: 180, fontSize: 42 }} />
                  <span style={{ fontFamily: fCinzel, fontSize: 14, letterSpacing: '0.3em', color: Q.gold, opacity: 0.85 }}>KG</span>
                </div>
              </div>
              <div>
                <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.4em', color: Q.gold, opacity: 0.7, textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>peso obiettivo</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
                  <input type="text" inputMode="decimal" value={goalWeight} onChange={e => setGoalWeight(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.').slice(0, 6))}
                    placeholder="65.0" style={{ ...inputStyle, width: 'auto', maxWidth: 180, fontSize: 42 }} />
                  <span style={{ fontFamily: fCinzel, fontSize: 14, letterSpacing: '0.3em', color: Q.gold, opacity: 0.85 }}>KG</span>
                </div>
              </div>
            </div>
          )}

          {current.id === 'diet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { id: 'onnivoro', label: 'Onnivoro', sub: 'mangio di tutto' },
                { id: 'vegetariano', label: 'Vegetariano', sub: 'no carne né pesce' },
                { id: 'vegano', label: 'Vegano', sub: 'no prodotti animali' },
                { id: 'pescatariano', label: 'Pescatariano', sub: 'no carne, pesce sì' },
                { id: 'altro', label: 'Altro', sub: 'esempio: chetogenica, paleo, ecc.' },
              ].map(opt => (
                <button key={opt.id} onClick={() => setDietStyle(opt.id)}
                  style={{
                    padding: '14px 16px', textAlign: 'left', cursor: 'pointer', borderRadius: 0,
                    background: dietStyle === opt.id ? `${Q.gold}22` : 'transparent',
                    border: `1px solid ${Q.gold}${dietStyle === opt.id ? '' : '66'}`,
                  }}>
                  <div style={{ fontFamily: fCinzel, fontSize: 11, letterSpacing: '0.2em', color: Q.gold, textTransform: 'uppercase' }}>{opt.label}</div>
                  <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.cream, opacity: 0.75, marginTop: 2 }}>{opt.sub}</div>
                </button>
              ))}
            </div>
          )}

          {current.id === 'allergies' && (
            <div>
              <textarea value={allergies} onChange={e => setAllergies(e.target.value.slice(0, 300))} autoFocus
                placeholder="es. lattosio, frutta secca, glutine…"
                rows={4}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: `1px solid ${Q.gold}55`,
                  fontFamily: fGaramond,
                  fontStyle: 'italic',
                  fontSize: 16,
                  color: Q.cream,
                  padding: 14,
                  outline: 'none',
                  resize: 'none',
                  borderRadius: 0,
                  lineHeight: 1.5,
                }} />
              <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: Q.cream, opacity: 0.55, marginTop: 10, textAlign: 'center' }}>
                lascia vuoto se non ne hai
              </div>
            </div>
          )}

          {current.id === 'activity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { id: 'sedentario', label: 'Sedentario', sub: 'lavoro fermo, niente sport' },
                { id: 'leggero', label: 'Leggero', sub: '1-2 sessioni a settimana' },
                { id: 'moderato', label: 'Moderato', sub: '3-4 sessioni a settimana' },
                { id: 'intenso', label: 'Intenso', sub: '5-6 sessioni a settimana' },
                { id: 'molto_intenso', label: 'Molto intenso', sub: 'allenamenti quotidiani o atleta' },
              ].map(opt => (
                <button key={opt.id} onClick={() => setActivityLevel(opt.id)}
                  style={{
                    padding: '14px 16px', textAlign: 'left', cursor: 'pointer', borderRadius: 0,
                    background: activityLevel === opt.id ? `${Q.gold}22` : 'transparent',
                    border: `1px solid ${Q.gold}${activityLevel === opt.id ? '' : '66'}`,
                  }}>
                  <div style={{ fontFamily: fCinzel, fontSize: 11, letterSpacing: '0.2em', color: Q.gold, textTransform: 'uppercase' }}>{opt.label}</div>
                  <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.cream, opacity: 0.75, marginTop: 2 }}>{opt.sub}</div>
                </button>
              ))}
            </div>
          )}

          {/* Hint */}
          {current.hint && (
            <div style={{ marginTop: 22, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.cream, opacity: 0.55, textAlign: 'center', lineHeight: 1.5 }}>
              {current.hint}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 18, padding: '10px 14px', border: `1px solid ${Q.danger || '#C99A7A'}66`, background: `${Q.danger || '#C99A7A'}11`, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.danger || '#C99A7A', textAlign: 'center' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer: dots + bottoni */}
        <div style={{ paddingTop: 22, paddingBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 22 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{ width: i === step ? 22 : 6, height: 6, borderRadius: 3, background: i <= step ? Q.gold : `${Q.gold}33`, transition: 'all 0.2s' }} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {step > 0 && (
              <button onClick={prev} disabled={saving}
                style={{ background: 'transparent', color: Q.gold, opacity: 0.85, border: `1px solid ${Q.gold}66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', padding: '12px 18px', cursor: 'pointer', textTransform: 'uppercase' }}>
                ← indietro
              </button>
            )}
            <button onClick={next} disabled={!canAdvance || saving}
              style={{
                background: canAdvance ? Q.gold : `${Q.gold}55`,
                color: Q.ink,
                border: 'none',
                fontFamily: fCinzel,
                fontSize: 10,
                letterSpacing: '0.35em',
                padding: '12px 26px',
                cursor: canAdvance && !saving ? 'pointer' : 'default',
                textTransform: 'uppercase',
                fontWeight: 600,
                opacity: saving ? 0.6 : 1,
              }}>
              {saving ? '…' : (isLast ? '✦ entra in goalfit ✦' : 'avanti →')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
