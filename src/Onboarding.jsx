// Onboarding al primo accesso: schermate swipeabili che spiegano GoalFit.
// Stile dashboard (Cruscotto): bianco, Inter, turchese/lime, icone a linea.
// I mock-up delle schermate sono "disegnati" in CSS (mini-riproduzioni), non screenshot.
// Il flag "già visto" è salvato su Supabase (profiles.onboarded) e in localStorage (fallback).

import { useState, useEffect } from 'react';
import { markOnboardingSeen } from './onboardingHelpers.js';
import { Home, Scale, Salad, ClipboardList, Hourglass, Pill, Activity, Moon, NotebookPen, Sparkles } from 'lucide-react';

const TEAL = '#3F95A1', LIME = '#9CC756', INK = '#2A3942', GREY = '#9AA5AB';
const BORDER = '#E5EAEE', BG = '#FFFFFF', TINT = '#EAF4F5';
const fInter = "'Inter', system-ui, -apple-system, sans-serif";

// ---- Logo riutilizzabile ----
function Logo({ size = 16 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <img src="/icon-192.png" alt="" style={{ width: size + 10, height: size + 10, borderRadius: 7, display: 'block' }} />
      <div style={{ fontSize: size, fontWeight: 800, letterSpacing: '-0.01em' }}>
        <span style={{ color: LIME }}>Goal</span><span style={{ color: INK }}>fit</span>
      </div>
    </div>
  );
}

// ---- Cornice telefono per i mock-up ----
function Phone({ children }) {
  return (
    <div style={{ width: 208, margin: '0 auto', borderRadius: 26, border: `1px solid ${BORDER}`, background: BG, boxShadow: '0 12px 30px rgba(42,57,66,0.10)', overflow: 'hidden', padding: 12, boxSizing: 'border-box' }}>
      <div style={{ width: 46, height: 5, borderRadius: 3, background: '#EDF1F3', margin: '0 auto 12px' }} />
      {children}
    </div>
  );
}
const miniHeader = (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
    <Logo size={11} />
    <div style={{ width: 18, height: 18, borderRadius: 9, background: TINT, border: `1px solid ${TEAL}55` }} />
  </div>
);
const tile = (color, w) => (
  <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 9px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
      <div style={{ width: 7, height: 7, borderRadius: 4, background: color }} />
      <div style={{ height: 4, width: 30, borderRadius: 2, background: '#E3E9ED' }} />
    </div>
    <div style={{ height: 4, width: '100%', borderRadius: 2, background: '#EEF2F4', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: w, background: color, opacity: 0.85 }} />
    </div>
  </div>
);

// ---- Mock: Home / dashboard ----
function MockHome() {
  return (
    <Phone>
      {miniHeader}
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 11px', marginBottom: 9 }}>
        <div style={{ fontSize: 7, letterSpacing: '0.18em', color: TEAL, fontWeight: 700 }}>PESO E CALORIE</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 3 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: LIME, lineHeight: 1 }}>74,2</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: TEAL }}>kg</div>
        </div>
        <div style={{ fontSize: 8, color: '#5AA8B3', fontWeight: 600, marginTop: 3 }}>mattina 74,8 · sera 74,2</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        {tile(TEAL, '60%')}{tile(LIME, '80%')}{tile('#8E6FD6', '40%')}{tile('#E0A33E', '70%')}
      </div>
    </Phone>
  );
}

// ---- Mock: Diario IA ----
function MockDiary() {
  return (
    <Phone>
      {miniHeader}
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 11px', marginBottom: 9 }}>
        {[92, 76, 60].map((w, i) => (
          <div key={i} style={{ height: 5, width: `${w}%`, borderRadius: 3, background: '#EAEFF2', marginBottom: 6 }} />
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 4, background: LIME, borderRadius: 8, padding: '7px 0' }}>
          <Sparkles size={11} color={INK} strokeWidth={2.4} />
          <div style={{ fontSize: 9, fontWeight: 700, color: INK }}>Registra con IA</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {['pasta', 'acqua ×2', '7h sonno'].map((c) => (
          <div key={c} style={{ fontSize: 8, fontWeight: 600, color: TEAL, border: `1px solid ${TEAL}55`, background: TINT, borderRadius: 999, padding: '4px 8px' }}>{c}</div>
        ))}
      </div>
    </Phone>
  );
}

// ---- Mock: Statistiche (grafico in calo) ----
function MockStats() {
  return (
    <Phone>
      {miniHeader}
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 11px' }}>
        <div style={{ fontSize: 7, letterSpacing: '0.18em', color: TEAL, fontWeight: 700, marginBottom: 8 }}>TREND · 30 GIORNI</div>
        <svg viewBox="0 0 180 80" style={{ width: '100%', height: 'auto', display: 'block' }}>
          {[20, 40, 60].map((y) => <line key={y} x1="0" y1={y} x2="180" y2={y} stroke="#EEF2F4" strokeWidth="1" />)}
          <polyline points="4,18 32,26 60,22 88,38 116,46 144,58 176,64" fill="none" stroke={LIME} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {[[4,18],[60,22],[116,46],[176,64]].map(([x,y],i)=>(<circle key={i} cx={x} cy={y} r="3.2" fill={TEAL} />))}
        </svg>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 8 }}>
        {tile(LIME, '85%')}{tile(TEAL, '55%')}
      </div>
    </Phone>
  );
}

// ---- Mock: Profilo / menu ----
function MockProfile() {
  return (
    <Phone>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Logo size={11} />
        <div style={{ width: 22, height: 22, borderRadius: 11, background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 800 }}>I</div>
      </div>
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 6, marginLeft: 'auto', width: '78%' }}>
        {['profilo', 'layout temi', 'guida', 'abbonamento'].map((r) => (
          <div key={r} style={{ fontSize: 9, color: INK, fontWeight: 500, padding: '7px 8px', borderRadius: 7 }}>{r}</div>
        ))}
      </div>
    </Phone>
  );
}

const WORLDS = [
  { Icon: Home, name: 'home', desc: 'il cruscotto: tutto a colpo d\u2019occhio' },
  { Icon: Scale, name: 'peso', desc: 'pesate, composizione e grafico trend' },
  { Icon: Salad, name: 'pasti', desc: 'pianificati e fatti, con foto' },
  { Icon: ClipboardList, name: 'men\u00f9', desc: 'proposte e suggerimenti IA' },
  { Icon: Hourglass, name: 'digiuno', desc: 'timer per il digiuno intermittente' },
  { Icon: Pill, name: 'rituale', desc: 'i tuoi integratori giornalieri' },
  { Icon: Activity, name: 'corpo', desc: 'allenamento e respiro guidato' },
  { Icon: Moon, name: 'sonno', desc: 'qualit\u00e0 e durata delle notti' },
  { Icon: NotebookPen, name: 'diario', desc: 'note libere + riflessione IA' },
];

const SLIDES = [
  {
    title: 'Benvenuto in GoalFit',
    sub: 'il tuo diario quotidiano del corpo',
    showLogo: true,
    art: MockHome,
    body: [
      'GoalFit ti aiuta a perdere peso e stare meglio osservando con cura le tue abitudini.',
      'Niente conteggio ossessivo, niente promesse miracolose.',
    ],
  },
  {
    title: 'Il diario libero',
    sub: 'la funzione che cambia tutto',
    art: MockDiary,
    body: [
      'Apri la pagina diario e scrivi naturale: \u201ccaff\u00e8 e cornetto, pranzo pasta col pesto, due bicchieri d\u2019acqua, dormito 7 ore\u201d.',
      'Tap su \u201cRegistra con IA\u201d: in pochi secondi pasti, acqua e sonno finiscono nei posti giusti.',
      'Niente form da compilare. Scrivi come parli.',
    ],
  },
  {
    title: 'I tuoi mondi',
    sub: 'esplora dalla barra in basso',
    worlds: true,
    body: [],
  },
  {
    title: 'Statistiche complete',
    sub: 'i tuoi dati raccontano una storia',
    art: MockStats,
    body: [
      'Dalla pagina peso, tap su \u201cStatistiche complete\u201d.',
      'Grafici a 30 giorni, 3 mesi, 1 anno o tutto lo storico, pattern settimanali e composizione corporea nel tempo.',
      'L\u2019IA ti d\u00e0 correlazioni (\u201cquando dormi meglio, perdi pi\u00f9 peso\u201d) e riassunti mensili. Esporti tutto in CSV.',
    ],
  },
  {
    title: 'Il tuo profilo',
    sub: 'sempre in alto a destra',
    art: MockProfile,
    body: [
      'Tap sul cerchio con la tua iniziale in alto a destra.',
      'Da l\u00ec accedi a profilo, layout dei temi, guida e abbonamento.',
      'I tuoi dati sono al sicuro sul cloud: cambi dispositivo e ritrovi tutto.',
    ],
  },
  {
    title: 'Inizia ora',
    sub: 'fai il primo passo',
    isLast: true,
    body: [
      'GoalFit funziona meglio se la usi ogni giorno, anche solo 30 secondi.',
      'Per oggi:',
      '\u00b7 vai su peso e registra la prima pesata',
      '\u00b7 oppure scrivi nel diario cosa hai mangiato a colazione',
    ],
  },
];

export default function Onboarding({ userId, profile, updProfile, onDone }) {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];

  const finish = async () => {
    if (userId) { try { markOnboardingSeen(userId); } catch (e) { /* noop */ } }
    try {
      if (updProfile) await updProfile({ onboarded: true });
    } catch (e) {
      console.warn('[onboarding] errore salvataggio profile.onboarded', e);
    }
    onDone();
  };
  const next = () => { if (idx >= SLIDES.length - 1) finish(); else setIdx(idx + 1); };
  const prev = () => { if (idx > 0) setIdx(idx - 1); };

  useEffect(() => {
    let startX = 0, dx = 0;
    const hs = (e) => { startX = e.touches[0].clientX; dx = 0; };
    const hm = (e) => { dx = e.touches[0].clientX - startX; };
    const he = () => { if (Math.abs(dx) > 60) { if (dx < 0) next(); else prev(); } };
    document.addEventListener('touchstart', hs, { passive: true });
    document.addEventListener('touchmove', hm, { passive: true });
    document.addEventListener('touchend', he, { passive: true });
    return () => {
      document.removeEventListener('touchstart', hs);
      document.removeEventListener('touchmove', hm);
      document.removeEventListener('touchend', he);
    };
    // eslint-disable-next-line
  }, [idx]);

  const Art = slide.art;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: BG, color: INK, fontFamily: fInter, overflow: 'hidden' }}>
      {/* Header: contatore + salta */}
      <div style={{ position: 'relative', zIndex: 2, padding: '18px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: GREY }}>{idx + 1} / {SLIDES.length}</div>
        {!slide.isLast && (
          <button onClick={finish} style={{ background: 'transparent', color: TEAL, border: 'none', fontFamily: fInter, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>salta</button>
        )}
      </div>

      {/* Corpo */}
      <div style={{ position: 'relative', zIndex: 2, padding: '14px 24px 0', maxWidth: 460, margin: '0 auto', height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ flex: 1 }}>

          {slide.showLogo && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18, marginTop: 4 }}>
              <Logo size={20} />
            </div>
          )}

          {/* Titolo */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 23, fontWeight: 800, color: INK, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{slide.title}</div>
            <div style={{ marginTop: 6, fontSize: 14, fontWeight: 500, color: TEAL }}>{slide.sub}</div>
          </div>

          {/* Mock-up disegnato */}
          {Art && (
            <div style={{ marginBottom: 22 }}><Art /></div>
          )}

          {/* Lista mondi (con icone a linea) */}
          {slide.worlds && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              {WORLDS.map((w) => {
                const Ic = w.Icon;
                return (
                  <div key={w.name} style={{ display: 'flex', alignItems: 'center', gap: 12, background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: TINT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Ic size={18} strokeWidth={2} color={TEAL} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: INK, textTransform: 'capitalize' }}>{w.name}</div>
                      <div style={{ fontSize: 12, color: GREY, marginTop: 1 }}>{w.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Testo */}
          {slide.body.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {slide.body.map((p, i) => {
                const isBullet = p.startsWith('\u00b7');
                const text = isBullet ? p.replace(/^\u00b7\s*/, '') : p;
                return (
                  <div key={i} style={{ fontSize: 15, color: isBullet ? INK : '#4A5A63', lineHeight: 1.5, display: 'flex', gap: 8 }}>
                    {isBullet && <span style={{ color: LIME, fontWeight: 800 }}>•</span>}
                    <span>{text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: dots + bottoni */}
        <div style={{ paddingTop: 20, paddingBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginBottom: 18 }}>
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)} aria-label={`Vai a ${i + 1}`}
                style={{ width: i === idx ? 22 : 8, height: 8, borderRadius: 4, border: 'none', background: i === idx ? TEAL : '#D8E0E4', cursor: 'pointer', padding: 0, transition: 'width 0.2s' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {idx > 0 && (
              <button onClick={prev} style={{ background: 'transparent', color: TEAL, border: `1px solid ${TEAL}66`, fontFamily: fInter, fontSize: 14, fontWeight: 600, borderRadius: 10, padding: '12px 20px', cursor: 'pointer' }}>indietro</button>
            )}
            <button onClick={next} style={{ background: slide.isLast ? LIME : TEAL, color: slide.isLast ? INK : '#fff', border: 'none', fontFamily: fInter, fontSize: 14, fontWeight: 700, borderRadius: 10, padding: '12px 30px', cursor: 'pointer' }}>
              {slide.isLast ? 'inizia' : 'avanti'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
