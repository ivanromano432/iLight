// Onboarding al primo accesso: 6 schermate swipeabili che spiegano GoalFit.
// Il flag "già visto" è salvato sia su Supabase (profiles.onboarded) come fonte autorevole,
// sia in localStorage come fallback per evitare flash al successivo avvio.
// Tema dinamico: segue profile.theme.

import { useState, useEffect } from 'react';
import { getTheme } from './themes.js';

const fGaramond = '"Cormorant Garamond", serif';
const fCinzel = '"Cinzel", serif';

const ONBOARDING_KEY_PREFIX = 'quercus_onboarded_v1_';

export function hasSeenOnboarding(userId) {
  try { return !!localStorage.getItem(ONBOARDING_KEY_PREFIX + userId); }
  catch { return false; }
}
export function markOnboardingSeen(userId) {
  try { localStorage.setItem(ONBOARDING_KEY_PREFIX + userId, '1'); } catch (_) {}
}

const SLIDES = [
  {
    title: 'Benvenuto in GoalFit',
    sub: 'il tuo diario quotidiano del corpo',
    body: [
      'GoalFit ti aiuta a perdere peso e stare meglio attraverso nove mondi tematici — peso, diario, pasti, allenamento, integratori, digiuno, respiro, sonno, sera.',
      'Niente conteggio ossessivo, niente promesse miracolose. Solo le tue abitudini, osservate con cura.',
    ],
    showLogo: true,
  },
  {
    title: 'Il diario libero',
    sub: 'la funzione che cambia tutto',
    body: [
      'Apri la pagina "II diario" e scrivi naturale: "stamattina caffè e cornetto, pranzo pasta col pesto, due bicchieri d\'acqua, dormito 7 ore".',
      'Tap su "Registra con IA". In pochi secondi, l\'intelligenza artificiale estrae i pasti, l\'acqua e il sonno e li mette nei posti giusti.',
      'Niente form da compilare. Scrivi come parli.',
    ],
  },
  {
    title: 'I nove mondi',
    sub: 'esplora dalla barra in basso',
    body: [
      '✦ I peso · pesate e composizione corporea, grafico trend',
      '✦ II diario · note libere con analisi IA',
      '✦ III pasti · pianificati e fatti, foto opzionali',
      '✦ IV integra · integratori giornalieri',
      '✦ V allena · sessioni di allenamento',
      '✦ VI digiuno · timer per digiuno intermittente',
      '✦ VII respiro · sessioni mindful guidate',
      '✦ VIII sonno · qualità delle notti',
      '✦ IX sera · rituale di chiusura giornata',
    ],
  },
  {
    title: 'Statistiche complete',
    sub: 'i tuoi dati raccontano una storia',
    body: [
      'Dalla pagina "I peso", tap su "✦ STATISTICHE COMPLETE".',
      'Trovi grafici a 30 giorni, 3 mesi, 1 anno o tutto lo storico. Pattern settimanali. Composizione corporea nel tempo.',
      'L\'IA ti dà correlazioni ("quando dormi meglio, perdi più peso") e riassunti mensili scritti come un coach.',
      'Puoi anche impostare obiettivi multipli (sonno ≥ 7h, allenamenti ≥ 3/settimana…) ed esportare tutto in CSV.',
    ],
  },
  {
    title: 'Il tuo profilo',
    sub: 'sempre in alto a destra',
    body: [
      'Tap sul cerchio con la tua iniziale in alto a destra.',
      'Da lì accedi a profilo, layout dei temi, guida, abbonamento.',
      'I tuoi dati sono al sicuro su cloud: anche se cambi dispositivo, ritrovi tutto.',
    ],
  },
  {
    title: 'Inizia ora',
    sub: 'fai il primo passo',
    body: [
      'GoalFit impara meglio se la usi tutti i giorni, anche solo per 30 secondi.',
      'Suggerimento per oggi:',
      '· Vai su "I peso" e registra la prima pesata',
      '· Oppure scrivi nel diario cosa hai mangiato a colazione',
      'Buon viaggio.',
    ],
    isLast: true,
  },
];

export default function Onboarding({ userId, profile, updProfile, onDone }) {
  const Q = getTheme(profile?.theme);
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];

  const finish = async () => {
    if (userId) markOnboardingSeen(userId);
    try {
      if (updProfile) await updProfile({ onboarded: true });
    } catch (e) {
      console.warn('[onboarding] errore salvataggio profile.onboarded', e);
    }
    onDone();
  };
  const next = () => {
    if (idx >= SLIDES.length - 1) finish();
    else setIdx(idx + 1);
  };
  const prev = () => { if (idx > 0) setIdx(idx - 1); };

  // Swipe touch
  useEffect(() => {
    let startX = 0, dx = 0;
    const handleStart = (e) => { startX = e.touches[0].clientX; dx = 0; };
    const handleMove = (e) => { dx = e.touches[0].clientX - startX; };
    const handleEnd = () => {
      if (Math.abs(dx) > 60) {
        if (dx < 0) next();
        else prev();
      }
    };
    document.addEventListener('touchstart', handleStart, { passive: true });
    document.addEventListener('touchmove', handleMove, { passive: true });
    document.addEventListener('touchend', handleEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleStart);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
    // eslint-disable-next-line
  }, [idx]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: `radial-gradient(ellipse at top, ${Q.bg1} 0%, ${Q.bg2} 100%)`, color: Q.cream, fontFamily: fGaramond, overflow: 'hidden' }}>
      {/* Doppia cornice in stile con il resto dell'app */}
      <div aria-hidden style={{ position: 'absolute', inset: 14, border: `1px solid ${Q.gold}40`, borderRadius: 20, pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', inset: 20, border: `1px solid ${Q.gold}1A`, borderRadius: 16, pointerEvents: 'none' }} />

      {/* Header con contatore e skip */}
      <div style={{ position: 'relative', zIndex: 2, padding: '22px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.4em', color: Q.goldDim, textTransform: 'uppercase' }}>
          {idx + 1} / {SLIDES.length}
        </div>
        {!slide.isLast && (
          <button onClick={finish} style={{ background: 'transparent', color: Q.goldDim, border: 'none', fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.35em', cursor: 'pointer', textTransform: 'uppercase' }}>
            salta
          </button>
        )}
      </div>

      {/* Corpo scrollabile */}
      <div style={{
        position: 'relative', zIndex: 2,
        padding: '24px 30px 0',
        maxWidth: 480, margin: '0 auto',
        height: 'calc(100vh - 60px)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ flex: 1 }}>

          {slide.showLogo && (
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <img src="/icon-512.png" alt="GoalFit" style={{ width: 110, height: 110, display: 'block', margin: '0 auto' }} />
            </div>
          )}

          {/* Header sezione */}
          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <div style={{ fontFamily: fCinzel, fontSize: 9, letterSpacing: '0.5em', color: Q.goldDim, textTransform: 'uppercase', marginBottom: 6 }}>
              ✦ {String(idx + 1).padStart(2, '0')} ✦
            </div>
            <div style={{ fontFamily: fCinzel, fontSize: 22, letterSpacing: '0.18em', color: Q.gold, textTransform: 'uppercase', lineHeight: 1.2 }}>
              {slide.title}
            </div>
            <div style={{ marginTop: 8, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 15, color: Q.goldDim }}>
              {slide.sub}
            </div>
            <div style={{ width: 60, height: 1, background: `${Q.gold}55`, margin: '14px auto 0' }} />
          </div>

          {/* Corpo testo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {slide.body.map((p, i) => {
              const isBullet = p.startsWith('✦') || p.startsWith('·');
              return (
                <div key={i} style={{
                  fontFamily: fGaramond,
                  fontStyle: 'italic',
                  fontSize: 16,
                  color: Q.cream,
                  lineHeight: 1.55,
                  paddingLeft: isBullet ? 4 : 0,
                }}>
                  {p}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer: dots + bottoni navigazione */}
        <div style={{ paddingTop: 22, paddingBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)} aria-label={`Vai a ${i + 1}`}
                style={{ width: i === idx ? 22 : 8, height: 8, borderRadius: 4, border: 'none', background: i === idx ? Q.gold : `${Q.goldDim}66`, cursor: 'pointer', padding: 0, transition: 'width 0.2s' }} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {idx > 0 && (
              <button onClick={prev} style={{ background: 'transparent', color: Q.goldDim, border: `1px solid ${Q.goldDim}66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', padding: '12px 18px', cursor: 'pointer', textTransform: 'uppercase' }}>
                ← indietro
              </button>
            )}
            <button onClick={next}
              style={{ background: Q.gold, color: Q.ink, border: 'none', fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.35em', padding: '12px 26px', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 600 }}>
              {slide.isLast ? '✦ inizia ✦' : 'avanti →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
