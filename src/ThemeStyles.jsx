// ThemeStyles — inietta CSS globale per applicare il "vestito" strutturale dei temi
// che hanno proprietà come fontText, useFlat, noDecorBorders.
//
// Funzionamento: quando il tema attivo è uno dei "temi strutturali" (Foglio Bianco, Cruscotto)
// monta uno <style> tag nel <head> con regole CSS scope-ate al body tramite classe.
// Le regole usano !important per sovrascrivere gli inline style dei componenti esistenti
// (font-family hardcoded, radial-gradient, bordi decorativi).
//
// Vantaggio: zero modifiche ai 14 componenti pagina. Cambio del tema = visivamente
// si applica subito a TUTTA l'app.

import { useEffect } from 'react';

// URL Google Fonts dei font usati nei temi strutturali. Caricati una sola volta.
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Cardo:ital,wght@0,400;1,400&family=Cinzel:wght@400;500;600&family=Inter:wght@300;400;500;600;700;800&display=swap';

function ensureFontLink() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('goalfit-theme-fonts')) return;
  const link = document.createElement('link');
  link.id = 'goalfit-theme-fonts';
  link.rel = 'stylesheet';
  link.href = FONTS_URL;
  document.head.appendChild(link);
}

// Costruisce il CSS globale per un tema strutturale specifico.
function buildCSS(theme) {
  if (!theme || !theme.structuralVariant) return '';
  const cls = `theme-${theme.id}`;
  const bg = theme.bg1 || theme.bg || '#FFFFFF';
  const fontText = theme.fontText || "'Cardo', serif";
  const fontMicro = theme.fontMicro || fontText;
  const teal = theme.gold || '#2BA8B5';
  const green = theme.amber || '#9CC73A';
  const ink = theme.ink || '#2A3942';
  // Colori semaforici per il remap dei colori semantici hardcoded delle pagine classiche.
  const ok   = theme.okColor   || green;
  const warn = theme.warnColor || '#D9B86A';
  const bad  = theme.badColor  || '#E04545';
  const info = theme.infoColor || teal;
  const isDashboard = theme.structuralVariant === 'dashboard';

  // CSS con !important per battere gli inline style React.
  // Usiamo sia 'body.cls' che 'html.cls' come scope, per maggiore specificity.
  return `
    /* === ${theme.name} (${theme.structuralVariant}) === */

    /* Background piatto: sostituisce ovunque ci sia un radial-gradient inline */
    html.${cls} [style*="radial-gradient"],
    body.${cls} [style*="radial-gradient"] {
      background: ${bg} !important;
      background-image: none !important;
    }

    /* Nasconde le cornici decorative inset (le 2 div con aria-hidden e inset) */
    html.${cls} [aria-hidden="true"][style*="inset:"],
    body.${cls} [aria-hidden="true"][style*="inset:"],
    body.${cls} [aria-hidden][style*="inset:14"],
    body.${cls} [aria-hidden][style*="inset:20"] {
      display: none !important;
    }

    /* === FONT OVERRIDE === */
    /* Override font globale per tutti gli elementi - massima specificity */
    html.${cls},
    html.${cls} body,
    html.${cls} body *,
    body.${cls},
    body.${cls} * {
      font-family: ${fontText} !important;
    }

    /* Override anche su selettori che usano Cormorant Garamond inline */
    html.${cls} *[style*="Cormorant Garamond"],
    html.${cls} *[style*="Garamond"],
    body.${cls} *[style*="Cormorant Garamond"],
    body.${cls} *[style*="Garamond"] {
      font-family: ${fontText} !important;
    }

    /* Mantieni il font Micro (Cinzel per Diario, Inter per Cruscotto) sui label maiuscoli */
    html.${cls} *[style*="Cinzel"],
    html.${cls} *[style*="letter-spacing"][style*="uppercase"],
    html.${cls} *[style*="text-transform:uppercase"],
    html.${cls} *[style*="text-transform: uppercase"],
    body.${cls} *[style*="Cinzel"],
    body.${cls} *[style*="letter-spacing"][style*="uppercase"],
    body.${cls} *[style*="text-transform:uppercase"],
    body.${cls} *[style*="text-transform: uppercase"] {
      font-family: ${fontMicro} !important;
      ${isDashboard ? 'font-weight: 700 !important;' : ''}
    }

    /* Per Cruscotto: numeri grandi in bold con letter-spacing stretto (look fitness app) */
    ${isDashboard ? `
    html.${cls} *[style*="font-size:32"],
    html.${cls} *[style*="font-size: 32"],
    html.${cls} *[style*="font-size:28"],
    html.${cls} *[style*="font-size: 28"],
    html.${cls} *[style*="font-size:24"],
    html.${cls} *[style*="font-size: 24"],
    html.${cls} *[style*="font-size:22"],
    html.${cls} *[style*="font-size: 22"] {
      font-weight: 700 !important;
      letter-spacing: -0.5px !important;
      font-style: normal !important;
    }
    ` : ''}

    /* Bordi card semplificati: tondi per Cruscotto, squadrati per Diario */
    ${isDashboard ? `
    html.${cls} *[style*="border:1px solid"][style*="background"]:not(button),
    body.${cls} *[style*="border:1px solid"][style*="background"]:not(button) {
      border-color: ${teal}44 !important;
      border-radius: 12px !important;
    }
    ` : `
    html.${cls} *[style*="border:1px solid"][style*="background"]:not(button),
    body.${cls} *[style*="border:1px solid"][style*="background"]:not(button) {
      border-color: ${teal}22 !important;
      border-radius: 0 !important;
    }
    `}

    /* Bottoni: arrotondati per Cruscotto, squadrati per Diario */
    ${isDashboard ? `
    html.${cls} button[style*="border"],
    body.${cls} button[style*="border"] {
      border-radius: 6px !important;
      font-weight: 600 !important;
    }
    ` : `
    html.${cls} button[style*="border"],
    body.${cls} button[style*="border"] {
      border-radius: 0 !important;
    }
    `}

    /* === REMAP COLORI SEMANTICI HARDCODED ===
       Le pagine "classiche" usano colori caldi fissi (salvia, salmone, oro, arancio)
       pensati per i temi tipografici. Su Cruscotto/Foglio Bianco li riportiamo sulla
       palette del tema (lime=ok, turchese=info/accento, ocra=warn, rosso=bad) agendo
       solo sul color del testo, via attribute selector sugli inline style React.
       Scoped al tema strutturale: gli altri temi non sono toccati. */
    ${[
      // positivo / "va bene" -> verde ok
      ['#A5B889', ok], ['#6B8060', ok], ['#9CC73A', ok],
      // attenzione / negativo / sopra-soglia -> ocra warn
      ['#C99A7A', warn], ['#D4B86A', warn], ['#C8763C', warn],
      // errore / elimina -> rosso bad
      ['#A04848', bad],
      // accenti decorativi oro/ambra/blu -> turchese info
      ['#C9A876', info], ['#B89548', info], ['#4A9EBA', info],
    ].map(([from, to]) => `html.${cls} [style*="${from}"], body.${cls} [style*="${from}"] { color: ${to} !important; }`).join('\n    ')}

    /* Body globale */
    html.${cls},
    body.${cls} {
      background: ${bg} !important;
      color: ${ink} !important;
    }
  `;
}

export default function ThemeStyles({ theme }) {
  useEffect(() => {
    // Carica i font appena montato
    ensureFontLink();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Rimuovo eventuali classi tema precedenti dal body.
    // Uso Array.from per evitare problemi durante l'iterazione di DOMTokenList live.
    Array.from(document.body.classList).forEach(cn => {
      if (cn.startsWith('theme-')) document.body.classList.remove(cn);
    });
    // Rimuovo lo <style> tag precedente
    const old = document.getElementById('goalfit-theme-styles');
    if (old) old.remove();

    if (!theme || !theme.structuralVariant) return; // tema classico, niente da fare

    // Aggiungo classe sia al body sia all'html per massima specificity
    document.body.classList.add(`theme-${theme.id}`);
    document.documentElement.classList.add(`theme-${theme.id}`);

    // Inietto il nuovo <style>
    const styleEl = document.createElement('style');
    styleEl.id = 'goalfit-theme-styles';
    styleEl.textContent = buildCSS(theme);
    document.head.appendChild(styleEl);

    // Cleanup al cambio di tema
    return () => {
      document.body.classList.remove(`theme-${theme.id}`);
      document.documentElement.classList.remove(`theme-${theme.id}`);
      const s = document.getElementById('goalfit-theme-styles');
      if (s) s.remove();
    };
  }, [theme?.id, theme?.structuralVariant]);

  return null; // componente puramente side-effect, non renderizza nulla
}
