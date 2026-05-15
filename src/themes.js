// Temi visivi di GoalFit. Ogni tema è un oggetto piatto con tutte le chiavi che
// le pagine usano nei loro `const Q = {...}`, `const W = {...}`, ecc.
// In questo modo posso fare `const Q = theme` (o W, J, ecc.) in ogni pagina e
// il codice esistente legge da Q.bg1, W.tan, J.sage continua a funzionare.
//
// Schema delle chiavi (super-set):
//   bg, bg1, bg2       background principale e gradient
//   ink, dark          alias per "molto scuro" o "non visibile"
//   cream, pale, body  colore del testo principale (varia: chiaro se tema dark, scuro se tema light)
//   gold, sage, silver, accent, amber, active   accento primario del tema
//   goldDim, light, dim, tan                    accento secondario tenue
//   border             colore bordi (= accent in genere)
//   danger             colore di allarme (sempre #C99A7A per coerenza)

const DANGER = '#C99A7A';

// Ogni tema è strutturato così:
// id, name, desc, isDark, swatch (3 colori distintivi per preview), poi tutte le chiavi colore
export const THEMES = {
  // 1. REFETTORIO — marrone scuro + oro + crema (originale pagina Peso)
  refettorio: {
    id: 'refettorio',
    name: 'Refettorio',
    desc: 'marrone scuro e oro',
    isDark: true,
    swatch: ['#3A2818', '#C9A876', '#E8D8B8'],
    bg: '#3A2818', bg1: '#3A2818', bg2: '#1F140C',
    ink: '#1F140C', dark: '#1F140C',
    cream: '#E8D8B8', pale: '#E8D8B8', body: '#E8D8B8',
    gold: '#C9A876', sage: '#C9A876', silver: '#C9A876', accent: '#C9A876', amber: '#C9A876', active: '#C9A876',
    goldDim: '#8B7355', light: '#8B7355', dim: '#8B7355', tan: '#8B7355',
    border: '#C9A876',
    danger: DANGER,
  },

  // 2. BIBLIOTECA — crema pergamena + inchiostro + tan (originale pagina Diario)
  biblioteca: {
    id: 'biblioteca',
    name: 'Biblioteca',
    desc: 'pergamena e inchiostro',
    isDark: false,
    swatch: ['#E8E0D2', '#8C6A4E', '#3C3329'],
    bg: '#E8E0D2', bg1: '#E8E0D2', bg2: '#D8D0BD',
    ink: '#3C3329', dark: '#3C3329',
    cream: '#3C3329', pale: '#3C3329', body: '#3C3329',
    gold: '#8C6A4E', sage: '#8C6A4E', silver: '#8C6A4E', accent: '#8C6A4E', amber: '#8C6A4E', active: '#8C6A4E',
    goldDim: '#B89C7E', light: '#B89C7E', dim: '#B89C7E', tan: '#8C6A4E',
    border: '#3C3329',
    danger: DANGER,
  },

  // 3. GIARDINO — beige caldo + sage + muschio (originale pagina Pasti) — DEFAULT
  giardino: {
    id: 'giardino',
    name: 'Giardino',
    desc: 'sage e muschio',
    isDark: false,
    swatch: ['#E5E3D5', '#5C6B4E', '#2D3A2E'],
    bg: '#E5E3D5', bg1: '#E5E3D5', bg2: '#CFCDB7',
    ink: '#2D3A2E', dark: '#2D3A2E',
    cream: '#2D3A2E', pale: '#2D3A2E', body: '#2D3A2E',
    gold: '#5C6B4E', sage: '#5C6B4E', silver: '#5C6B4E', accent: '#5C6B4E', amber: '#5C6B4E', active: '#5C6B4E',
    goldDim: '#8FA288', light: '#8FA288', dim: '#8FA288', tan: '#7A8E78',
    border: '#2D3A2E',
    danger: DANGER,
  },

  // 4. ALBA — beige chiaro + sage tenue (originale pagina Integra)
  alba: {
    id: 'alba',
    name: 'Alba',
    desc: 'beige chiaro al mattino',
    isDark: false,
    swatch: ['#F4F0E6', '#4A5C4D', '#1F2724'],
    bg: '#F4F0E6', bg1: '#F4F0E6', bg2: '#E8E2D2',
    ink: '#1F2724', dark: '#1F2724',
    cream: '#1F2724', pale: '#1F2724', body: '#1F2724',
    gold: '#4A5C4D', sage: '#4A5C4D', silver: '#4A5C4D', accent: '#4A5C4D', amber: '#4A5C4D', active: '#4A5C4D',
    goldDim: '#8B9A82', light: '#8B9A82', dim: '#8B9A82', tan: '#4A5C4D',
    border: '#1F2724',
    danger: DANGER,
  },

  // 5. CUOIO — beige caldo + ink + dim (originale pagina Allena)
  cuoio: {
    id: 'cuoio',
    name: 'Cuoio',
    desc: 'beige caldo',
    isDark: false,
    swatch: ['#F2EBDC', '#6B5D45', '#1F1A12'],
    bg: '#F2EBDC', bg1: '#F2EBDC', bg2: '#DDD5C5',
    ink: '#1F1A12', dark: '#1F1A12',
    cream: '#1F1A12', pale: '#1F1A12', body: '#1F1A12',
    gold: '#6B5D45', sage: '#6B5D45', silver: '#6B5D45', accent: '#6B5D45', amber: '#6B5D45', active: '#6B5D45',
    goldDim: '#A89880', light: '#A89880', dim: '#A89880', tan: '#6B5D45',
    border: '#1F1A12',
    danger: DANGER,
  },

  // 6. SERA VIOLA — viola scuro + argento + crema (originale pagina Digiuno)
  sera_viola: {
    id: 'sera_viola',
    name: 'Sera viola',
    desc: 'viola scuro e argento',
    isDark: true,
    swatch: ['#1E1A2E', '#B8B0C9', '#F2E8D0'],
    bg: '#1E1A2E', bg1: '#1E1A2E', bg2: '#0F0D1A',
    ink: '#0F0D1A', dark: '#0F0D1A',
    cream: '#F2E8D0', pale: '#F2E8D0', body: '#F2E8D0',
    gold: '#B8B0C9', sage: '#B8B0C9', silver: '#B8B0C9', accent: '#B8B0C9', amber: '#B8B0C9', active: '#B8B0C9',
    goldDim: '#6B6478', light: '#6B6478', dim: '#6B6478', tan: '#6B6478',
    border: '#B8B0C9',
    danger: DANGER,
  },

  // 7. NOTTE BLU — navy + oro stellato + crema (originale pagina Respiro)
  notte_blu: {
    id: 'notte_blu',
    name: 'Notte blu',
    desc: 'navy e oro stellato',
    isDark: true,
    swatch: ['#2C3340', '#C9A876', '#F2E8D0'],
    bg: '#2C3340', bg1: '#2C3340', bg2: '#14171F',
    ink: '#14171F', dark: '#14171F',
    cream: '#F2E8D0', pale: '#F2E8D0', body: '#DDD3C2',
    gold: '#C9A876', sage: '#C9A876', silver: '#C9A876', accent: '#C9A876', amber: '#C9A876', active: '#C9A876',
    goldDim: '#8A8270', light: '#8A8270', dim: '#8A8270', tan: '#8A8270',
    border: '#C9A876',
    danger: DANGER,
  },

  // 8. BOSCO PASTELLO — verde-acqua freddo + menta polverosa (più freddo di Giardino)
  bosco_pastello: {
    id: 'bosco_pastello',
    name: 'Bosco pastello',
    desc: 'verde freddo, nebbia',
    isDark: false,
    swatch: ['#DDE5E0', '#6E9788', '#2F3D3A'],
    bg: '#DDE5E0', bg1: '#DDE5E0', bg2: '#BFCDC4',
    ink: '#2F3D3A', dark: '#2F3D3A',
    cream: '#2F3D3A', pale: '#2F3D3A', body: '#2F3D3A',
    gold: '#6E9788', sage: '#6E9788', silver: '#6E9788', accent: '#6E9788', amber: '#6E9788', active: '#6E9788',
    goldDim: '#9DB5AC', light: '#9DB5AC', dim: '#9DB5AC', tan: '#88A599',
    border: '#2F3D3A',
    danger: DANGER,
  },

  // 9. NOTTURNO AMBRA — nero + ambra dorato (originale pagina Sera)
  notturno_ambra: {
    id: 'notturno_ambra',
    name: 'Notturno ambra',
    desc: 'nero e ambra dorato',
    isDark: true,
    swatch: ['#1F2228', '#D4A23E', '#E8E4D5'],
    bg: '#1F2228', bg1: '#1F2228', bg2: '#0E1115',
    ink: '#0E1115', dark: '#0E1115',
    cream: '#E8E4D5', pale: '#E8E4D5', body: '#E8E4D5',
    gold: '#D4A23E', sage: '#D4A23E', silver: '#D4A23E', accent: '#C9A876', amber: '#D4A23E', active: '#A8826E',
    goldDim: '#6B6478', light: '#6B6478', dim: '#6B6478', tan: '#6B6478',
    border: '#C9A876',
    danger: DANGER,
  },
};

export const THEME_ORDER = [
  'giardino', 'refettorio', 'biblioteca', 'alba', 'cuoio',
  'sera_viola', 'notte_blu', 'bosco_pastello', 'notturno_ambra',
];

export const DEFAULT_THEME = 'giardino';

export function getTheme(themeId) {
  return THEMES[themeId] || THEMES[DEFAULT_THEME];
}
