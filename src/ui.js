// Stile condiviso delle schermate fuori dalla pagina principale (accesso, profilo, abbonamento, guida…).
// Stessa palette delle pagine nuove: blu notte, petrolio in alto, oro, crema.
export const C = { cream: '#F4EFE2', gold: '#C9A55A', navy: '#0E2240', card: '#142A4C', line: '#34506F', dim: '#B4BFCC', sal: '#F0B9A0' };
export const fSerif = "'EB Garamond',serif";
export const fSans = "'DM Sans',system-ui,sans-serif";
export const PAGE_BG = 'linear-gradient(180deg, #4A6A62 0px, #24405A 260px, #0E2240 540px)';

export function ensureUiFonts() {
  if (typeof document === 'undefined' || document.getElementById('goalfit-ui-fonts')) return;
  const link = document.createElement('link');
  link.id = 'goalfit-ui-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
}

export const page = { minHeight: '100vh', background: PAGE_BG, color: C.cream, fontFamily: fSans };
export const column = { maxWidth: 480, margin: '0 auto', padding: '30px 22px 40px', boxSizing: 'border-box' };
export const kicker = { fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.gold, fontWeight: 600 };
export const h1 = { margin: '4px 0 0', fontFamily: fSerif, fontSize: 36, fontWeight: 500, lineHeight: 1.05, color: C.cream };
export const h2 = { margin: 0, fontFamily: fSerif, fontSize: 26, fontWeight: 500, lineHeight: 1.15, color: C.cream };
export const muted = { fontSize: 14, lineHeight: 1.5, color: C.dim };
export const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 22, padding: '18px', boxSizing: 'border-box' };
export const btn = (primary = true) => ({ minHeight: 50, borderRadius: 25, background: primary ? C.gold : 'transparent', border: `1px solid ${C.gold}`, color: primary ? C.navy : C.cream, fontFamily: fSans, fontSize: 15, fontWeight: primary ? 700 : 500, cursor: 'pointer', width: '100%', padding: '0 18px' });
export const btnDanger = { minHeight: 48, borderRadius: 24, background: 'transparent', border: `1px solid ${C.sal}`, color: C.sal, fontFamily: fSans, fontSize: 15, cursor: 'pointer', width: '100%', padding: '0 18px' };
export const chip = (on) => ({ minHeight: 44, padding: '0 8px', borderRadius: 22, background: on ? C.gold : 'transparent', border: `1px solid ${on ? C.gold : C.line}`, color: on ? C.navy : C.cream, fontFamily: fSans, fontSize: 14, fontWeight: 600, cursor: 'pointer' });
export const label = { fontSize: 12, color: C.dim, display: 'block', marginBottom: 2 };
export const input = (size = 22) => ({ width: '100%', boxSizing: 'border-box', background: 'transparent', border: 'none', borderBottom: `2px solid ${C.gold}`, outline: 'none', color: C.cream, fontFamily: fSerif, fontSize: size, fontWeight: 500, padding: '2px 0 6px', colorScheme: 'dark', borderRadius: 0 });
export const link = { color: C.cream, textDecoration: 'underline', textUnderlineOffset: 3, background: 'transparent', border: 'none', fontFamily: fSans, fontSize: 13, cursor: 'pointer', padding: 0 };
export const tag = { fontSize: 12, color: C.gold, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' };
export const closeBtn = { position: 'fixed', top: 'calc(18px + env(safe-area-inset-top, 0px))', left: 16, zIndex: 9001, minHeight: 44, padding: '0 16px', borderRadius: 22, background: C.card, border: `1px solid ${C.line}`, color: C.cream, fontFamily: fSans, fontSize: 14, cursor: 'pointer' };
