// Pagina dedicata per scegliere il layout/tema visivo dell'app.
// Tap su un tema = applicato subito (salvato su Supabase, niente bottone SALVA).

import { useState } from 'react';
import { THEMES, THEME_ORDER, DEFAULT_THEME } from './themes.js';

const Q = { bg1: '#3A2818', bg2: '#1F140C', gold: '#C9A876', goldDim: '#8B7355', cream: '#E8D8B8', ink: '#1F140C' };
const fGaramond = '"Cormorant Garamond", serif';
const fCinzel = '"Cinzel", serif';

export default function LayoutPage({ profile, updProfile, onClose }) {
  const currentTheme = profile?.theme || DEFAULT_THEME;
  const [applying, setApplying] = useState(null); // id del tema che si sta applicando

  const apply = async (themeId) => {
    if (!updProfile) return;
    if (themeId === currentTheme) return;
    setApplying(themeId);
    try {
      await updProfile({ theme: themeId });
    } finally {
      setApplying(null);
    }
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

        {/* Griglia temi */}
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {THEME_ORDER.map(id => {
            const t = THEMES[id];
            const selected = currentTheme === id;
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
        </div>

        {/* Suggerimento */}
        <div style={{ marginTop: 28, padding: '12px 14px', border: `1px solid ${Q.gold}22`, background: `${Q.gold}06`, fontFamily: fGaramond, fontStyle: 'italic', fontSize: 12, color: Q.goldDim, textAlign: 'center', lineHeight: 1.5 }}>
          il tema scelto resta salvato sul tuo profilo e ti segue su qualsiasi dispositivo
        </div>
      </div>
    </div>
  );
}
