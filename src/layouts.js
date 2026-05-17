// Definizione dei layout disponibili in GoalFit.
// Ogni layout è un oggetto che descrive font, colori semantici e parametri di stile
// applicati dinamicamente nella OggiPage (Home).
// I dati e la struttura logica restano gli stessi, cambia solo il "vestito".

// Palette comune (estratta dal logo)
const TEAL = '#2BA8B5';
const TEAL_DARK = '#1E8FA0';
const TEAL_LIGHT = '#5BBCC9';
const GREEN = '#9CC73A';
const GREEN_DARK = '#8FB82A';
const RED = '#E04545';
const YELLOW = '#E8B845';
const WHITE = '#FFFFFF';
const OFF = '#FAFAFA';
const INK = '#2A3942';
const DIM = '#8FA0A8';

export const LAYOUTS = {
  // Layout "classico" = quello che c'è oggi nell'app (mantiene tema selezionato dall'utente).
  // Quando classic è attivo, NON applichiamo nessun override: la Home renderizza come sempre.
  classic: {
    id: 'classic',
    name: 'Classico',
    description: "Lo stile attuale dell'app con il tema cromatico scelto dal Profilo.",
    isOverride: false,
  },

  // Layout "diario" — tipografico serif, aerato, sfondo bianco, linee turchese
  diario: {
    id: 'diario',
    name: 'Diario',
    description: 'Sfondo bianco, font serif elegante, layout aerato con righe sottili.',
    isOverride: true,
    bg: WHITE,
    bg2: OFF,
    fontText: "'Cardo', serif",
    fontHeading: "'Cardo', serif",
    fontMicro: "'Cinzel', serif",
    fontNumber: "'Cardo', serif",
    inkPrimary: INK,
    inkLine: TEAL,          // linee/simboli
    inkLabel: TEAL,          // scritte/label
    inkValue: GREEN_DARK,    // dati numerici
    inkSubtle: DIM,
    teal: TEAL,
    green: GREEN,
    statusOk: GREEN,
    statusWarn: YELLOW,
    statusBad: RED,
    statusInfo: TEAL,
    // Card style
    cardBg: 'transparent',
    cardBorder: 'none',
    cardBorderRadius: 0,
    cardPadding: '18px 0',
    cardDivider: `1px solid ${TEAL}33`,
    // Striscia giornata
    stripStyle: 'underline',  // dot semplici dentro 2 linee orizzontali turchese
    // Logo nell'header
    showLogo: false,
  },

  // Layout "dashboard" — sans-serif moderno, cards riquadrate, pill, fitness pro
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Sfondo bianco, sans-serif compatto, cards riquadrate con bordo turchese e logo nell\'header.',
    isOverride: true,
    bg: WHITE,
    bg2: OFF,
    fontText: "'Inter', system-ui, sans-serif",
    fontHeading: "'Inter', system-ui, sans-serif",
    fontMicro: "'Inter', system-ui, sans-serif",
    fontNumber: "'Inter', system-ui, sans-serif",
    inkPrimary: INK,
    inkLine: TEAL,
    inkLabel: TEAL,
    inkValue: GREEN,
    inkSubtle: DIM,
    teal: TEAL,
    green: GREEN,
    statusOk: GREEN,
    statusWarn: YELLOW,
    statusBad: RED,
    statusInfo: TEAL,
    // Card style: bordo netto turchese, riquadri arrotondati
    cardBg: WHITE,
    cardBorder: `1px solid ${TEAL}`,
    cardBorderRadius: 12,
    cardPadding: '16px',
    cardDivider: 'none',
    // Striscia giornata: pill arrotondate
    stripStyle: 'pills',
    // Logo nell'header
    showLogo: true,
  },
};

// Legge la preferenza dell'utente da localStorage. Default = 'classic'.
export function getCurrentLayoutId() {
  if (typeof window === 'undefined') return 'classic';
  try {
    const v = localStorage.getItem('goalfit_layout');
    if (v && LAYOUTS[v]) return v;
  } catch (_) {}
  return 'classic';
}

// Salva la preferenza in localStorage e ritorna il layout aggiornato.
export function setLayoutId(id) {
  if (!LAYOUTS[id]) return null;
  try { localStorage.setItem('goalfit_layout', id); } catch (_) {}
  return LAYOUTS[id];
}

export function getLayout(id) {
  return LAYOUTS[id] || LAYOUTS.classic;
}

// Carica i font web necessari (solo una volta).
export function ensureLayoutFonts() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('layout-fonts')) return;
  const link = document.createElement('link');
  link.id = 'layout-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Cardo:ital,wght@0,400;1,400&family=Cinzel:wght@400;500&family=Inter:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(link);
}
