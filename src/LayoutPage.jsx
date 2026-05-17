// Pagina dedicata per scegliere il layout/tema visivo dell'app.
// Tap su un tema = applicato subito (salvato su Supabase, niente bottone SALVA).
// Oltre ai temi cromatici tradizionali, sono disponibili 2 layout strutturali alternativi
// (Foglio Bianco e Cruscotto) ispirati al logo ufficiale GoalFit.

import { useState, useEffect } from 'react';
import { THEMES, THEME_ORDER, DEFAULT_THEME, getTheme } from './themes.js';
import { getCurrentLayoutId, setLayoutId } from './layouts.js';

const fGaramond = '"Cormorant Garamond", serif';
const fCinzel = '"Cinzel", serif';

export default function LayoutPage({ profile, updProfile, onClose }) {
  const currentTheme = profile?.theme || DEFAULT_THEME;
  const Q = getTheme(currentTheme);
  const [applying, setApplying] = useState(null); // id che si sta applicando

  // Layout strutturale corrente (classic | diario | dashboard) — salvato in localStorage.
  // Quando l'utente sceglie "Foglio Bianco" o "Cruscotto", il tema cromatico resta
  // (potrebbe essere usato altrove) ma la Home applica il vestito strutturale.
  const [structLayout, setStructLayout] = useState(getCurrentLayoutId());

  const apply = async (themeId) => {
    if (!updProfile) return;
    setApplying(themeId);
    try {
      // Tap su un tema cromatico = ripristina layout classico (azzera il layout strutturale)
      setLayoutId('classic');
      setStructLayout('classic');
      try { window.dispatchEvent(new CustomEvent('goalfit-layout-changed', { detail: { id: 'classic' } })); } catch (_) {}
      if (themeId !== currentTheme) {
        await updProfile({ theme: themeId });
      }
    } finally {
      setApplying(null);
    }
  };

  const applyStruct = (layoutId) => {
    setApplying(layoutId);
    setLayoutId(layoutId);
    setStructLayout(layoutId);
    try { window.dispatchEvent(new CustomEvent('goalfit-layout-changed', { detail: { id: layoutId } })); } catch (_) {}
    setTimeout(() => setApplying(null), 200);
  };

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(ellipse at top, ${Q.bg1} 0%, ${Q.bg2} 100%)`, color: Q.cream, fontFamily: fGaramond, position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 14, border: `1px solid ${Q.gold}40`, borderRadius: 20, pointerEvents: 'none', zIndex: 1 }} />
      <div aria-hidden style={{ position: 'absolute', inset: 20, border: `1px solid ${Q.gold}1A`, borderRadius: 16, pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'relative', zIndex: 2, padding: '24px 22px 60px', maxWidth: 480, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', color: Q.gold, border: `1px solid ${Q.gold}66`, fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.3em', padding: '8px 14px', cursor: 'pointer' }}>← INDIETRO</button>
          <div style={{ fontFamily: fCinzel, fontSize: 11, letterSpacing: '0.45em', color: Q.gold, textTransform: 'uppercase' }}>LAYOUT</div>
          <div style={{ width: 70 }} />
        </div>

        {/* Intro */}
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <div style={{ fontFamily: fCinzel, fontSize: 22, letterSpacing: '0.25em', color: Q.gold, textTransform: 'uppercase' }}>scegli lo stile</div>
          <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 13, color: Q.goldDim, marginTop: 8, lineHeight: 1.5 }}>
            tap su un tema per applicarlo subito.<br/>
            l'app cambia su tutte le pagine.
          </div>
        </div>

        {/* Griglia temi + layout strutturali */}
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {THEME_ORDER.map(id => {
            const t = THEMES[id];
            // Un tema cromatico è "selected" solo se il layout strutturale è classic
            const selected = currentTheme === id && structLayout === 'classic';
            const isApplying = applying === id;
            return (
              <button key={id} onClick={() => apply(id)} disabled={isApplying}
                style={{
                  background: selected ? `${Q.gold}1A` : 'transparent',
                  border: `1px solid ${selected ? Q.gold : Q.gold + '44'}`,
                  padding: '12px 12px',
                  cursor: isApplying ? 'wait' : 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  opacity: isApplying ? 0.6 : 1,
                  transition: 'all 0.15s ease',
                }}>
                {/* Swatch a 3 colori */}
                <div style={{ display: 'flex', gap: 4, height: 22 }}>
                  {t.swatch.map((c, i) => (
                    <div key={i} style={{ flex: 1, background: c, borderRadius: 2, border: `1px solid ${Q.gold}22` }} />
                  ))}
                </div>
                <div>
                  <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.25em', color: selected ? Q.gold : Q.cream, textTransform: 'uppercase' }}>
                    {selected ? '✓ ' : ''}{t.name}
                  </div>
                  <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: Q.goldDim, marginTop: 3 }}>
                    {isApplying ? 'applicando…' : t.desc}
                  </div>
                </div>
              </button>
            );
          })}

          {/* === LAYOUT STRUTTURALI === Foglio Bianco e Cruscotto, ispirati al logo GoalFit */}
          {[
            { id: 'diario', name: 'Foglio Bianco', desc: 'sfondo bianco, font serif elegante, righe sottili turchese' },
            { id: 'dashboard', name: 'Cruscotto', desc: 'sfondo bianco, cards moderne con bordo turchese, logo nell\'header' },
          ].map(L => {
            const selected = structLayout === L.id;
            const isApplying = applying === L.id;
            return (
              <button key={L.id} onClick={() => applyStruct(L.id)} disabled={isApplying}
                style={{
                  background: selected ? `${Q.gold}1A` : 'transparent',
                  border: `1px solid ${selected ? Q.gold : Q.gold + '44'}`,
                  padding: '12px 12px',
                  cursor: isApplying ? 'wait' : 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  opacity: isApplying ? 0.6 : 1,
                  transition: 'all 0.15s ease',
                }}>
                {/* Anteprima a 3 swatch coerente con i temi: bianco + turchese + verde lime (dal logo) */}
                <div style={{ display: 'flex', gap: 4, height: 22 }}>
                  <div style={{ flex: 1, background: '#FFFFFF', borderRadius: 2, border: `1px solid ${Q.gold}22` }} />
                  <div style={{ flex: 1, background: '#2BA8B5', borderRadius: 2, border: `1px solid ${Q.gold}22` }} />
                  <div style={{ flex: 1, background: '#9CC73A', borderRadius: 2, border: `1px solid ${Q.gold}22` }} />
                </div>
                <div>
                  <div style={{ fontFamily: fCinzel, fontSize: 10, letterSpacing: '0.25em', color: selected ? Q.gold : Q.cream, textTransform: 'uppercase' }}>
                    {selected ? '✓ ' : ''}{L.name}
                  </div>
                  <div style={{ fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: Q.goldDim, marginTop: 3 }}>
                    {isApplying ? 'applicando…' : L.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Suggerimento */}
        <div style={{ marginTop: 28, padding: '12px 14px', border: `1px solid ${Q.gold}22`, background: `${Q.gold}06`, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: Q.goldDim, textAlign: 'center', lineHeight: 1.5 }}>
          il tema scelto resta salvato sul tuo profilo e ti segue su qualsiasi dispositivo
        </div>
      </div>
    </div>
  );
}
