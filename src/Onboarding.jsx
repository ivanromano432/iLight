// Onboarding al primo accesso: schermate scorrevoli che spiegano la nuova GoalFit.
// Stile dell'app: blu notte, petrolio in alto, oro, crema. Le illustrazioni sono disegnate in CSS.
// Il flag "già visto" è salvato su Supabase (profiles.onboarded) e in localStorage (fallback).

import { useState, useEffect } from 'react';
import { markOnboardingSeen } from './onboardingHelpers.js';
import { MessageCircle, ListChecks, Camera, Utensils, ChartColumn, Image as ImageIcon, FolderOpen } from 'lucide-react';
import { C, fSerif, page, btn, link, muted, ensureUiFonts } from './ui.js';

const round = (size, filled) => ({ width: size, height: size, borderRadius: '50%', background: filled ? C.gold : C.card, border: `1.5px solid ${C.gold}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 });
const panel = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 24, padding: '18px 12px' };

function ArtBar() {
  return (
    <div style={{ ...panel, display: 'flex', justifyContent: 'space-around', alignItems: 'center' }} role="img" aria-label="I cinque tasti in basso: coach, aggiorna, foto, pasti, statistiche">
      <MessageCircle size={26} color={C.cream} strokeWidth={1.7} />
      <ListChecks size={26} color={C.cream} strokeWidth={1.7} />
      <span style={round(60, true)}><Camera size={28} color={C.navy} strokeWidth={1.9} /></span>
      <Utensils size={26} color={C.cream} strokeWidth={1.7} />
      <ChartColumn size={26} color={C.cream} strokeWidth={1.7} />
    </div>
  );
}
function ArtCamera() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }} role="img" aria-label="Il tasto fotocamera apre tre scelte: scatta, libreria, file">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22 }}>
        <span style={round(54)}><Camera size={24} color={C.gold} strokeWidth={1.9} /></span>
        <span style={{ ...round(54), marginBottom: 30 }}><ImageIcon size={24} color={C.gold} strokeWidth={1.9} /></span>
        <span style={round(54)}><FolderOpen size={24} color={C.gold} strokeWidth={1.9} /></span>
      </div>
      <span style={round(72, true)}><Camera size={32} color={C.navy} strokeWidth={1.9} /></span>
    </div>
  );
}
function ArtCoach() {
  const b = (me) => ({ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '82%', padding: '11px 14px', borderRadius: 18, background: me ? C.gold : C.card, border: me ? 'none' : `1px solid ${C.line}`, color: me ? C.navy : C.cream, fontSize: 15, lineHeight: 1.4 });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} role="img" aria-label="Esempio di conversazione con il coach">
      <div style={b(true)}>Perché questa settimana non sono sceso?</div>
      <div style={b(false)}>Ho guardato peso, pasti e sonno degli ultimi giorni…</div>
    </div>
  );
}
function ArtMenu() {
  return (
    <div style={{ ...panel, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }} role="img" aria-label="Il menu del profilo con le altre sezioni">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span style={{ ...round(44), color: C.cream, fontWeight: 700, fontSize: 17 }}>tu</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {['Peso', 'Menù', 'Digiuno', 'Integrazione', 'Allenamenti', 'Respiro', 'Sonno', 'Diario'].map(n => (
          <span key={n} style={{ minHeight: 40, padding: '0 12px', borderRadius: 12, background: C.navy, border: `1px solid ${C.line}`, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center' }}>{n}</span>
        ))}
      </div>
    </div>
  );
}

const SLIDES = [
  { brand: true, title: 'Benvenuto in GoalFit', text: 'Il diario quotidiano del tuo corpo: peso, pasti, sonno e allenamenti in un posto solo, con un’intelligenza artificiale che ti aiuta a leggerli.' },
  { art: ArtBar, title: 'Cinque tasti, tutto qui', text: 'Parla con il coach, spunta le cose di oggi, fotografa il piatto, guarda i pasti e le statistiche.' },
  { art: ArtCamera, title: 'Fotografa quello che mangi', text: 'Tocca due volte la fotocamera al centro: scatti o scegli una foto, e l’IA riconosce il piatto e calcola calorie e nutrienti. Puoi sempre correggere.' },
  { art: ArtCoach, title: 'Un coach che vede i tuoi dati', text: 'Chiedigli del peso, dei pasti o di cosa migliorare: risponde guardando quello che hai registrato. Sono consigli generali, non sostituiscono medico o nutrizionista.' },
  { art: ArtMenu, title: 'Il resto è nel tuo profilo', text: 'Tocca la tua foto in alto a destra per aprire peso, menù, digiuno, integrazione, allenamenti, respiro, sonno e diario.' },
  { brand: true, last: true, title: 'Si comincia', text: 'Ancora qualche domanda su di te per calcolare calorie e obiettivo, poi sei dentro. Inizia registrando il peso di oggi e fotografando il prossimo pasto.' },
];

export default function Onboarding({ userId, updProfile, onDone }) {
  useEffect(ensureUiFonts, []);
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
    <div style={{ ...page, position: 'fixed', inset: 0, zIndex: 1000, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 460, margin: '0 auto', minHeight: '100%', boxSizing: 'border-box', padding: 'calc(26px + env(safe-area-inset-top, 0px)) 24px 30px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', minHeight: 44 }}>
          {!slide.last && <button onClick={finish} style={{ ...link, minHeight: 44, padding: '0 6px' }}>salta</button>}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}>
          {slide.brand && <span style={{ fontFamily: fSerif, fontSize: 60, fontWeight: 500, lineHeight: 1 }}>GoalFit</span>}
          {Art && <Art />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h1 style={{ fontFamily: fSerif, fontSize: 38, fontWeight: 500, lineHeight: 1.1, margin: 0 }}>{slide.title}</h1>
            <p style={{ ...muted, fontSize: 16, margin: 0 }}>{slide.text}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`vai alla schermata ${i + 1} di ${SLIDES.length}`} aria-current={i === idx}
              style={{ width: 28, height: 28, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: i === idx ? 22 : 8, height: 8, borderRadius: 4, background: i === idx ? C.gold : '#2A4466', transition: 'width 0.2s' }} />
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {idx > 0 && <button onClick={prev} style={{ ...btn(false), width: 'auto', padding: '0 20px', borderColor: `${C.cream}88` }}>indietro</button>}
          <button onClick={next} style={{ ...btn(), flex: 1 }}>{slide.last ? 'inizia' : 'avanti'}</button>
        </div>
      </div>
    </div>
  );
}
