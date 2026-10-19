export type Mode = 'dark';

// The one theme (light mode removed, Yazan 2026-10-17): deep navy Nebula.
// Deep navy (redesign stage 1, option A, Yazan 2026-10-17): reads as navy, never black.
const NAVY = { sky: '#0d1738', card: '#24346c', card2: '#1f2e62', panel: '#26376f', panel2: '#213166' };
const dark = {
  mode: 'dark' as Mode,
  sky: NAVY.sky,
  fg: '#eef0ff',
  white: '#ffffff',
  soft: '#c3c7e4',
  mute: '#9aa0c4',
  dim: '#8a90b8',
  accent: '#6fd6ff',
  gradA: '#a48bff',
  gradB: '#6fd6ff',
  onGrad: '#0b0b26',
  red: '#c73646',
  // Error message text: lighter than the red button fill so it reads on navy (Yazan 2026-10-19).
  error: '#ff7a88',
  rose: '#ff7aa8',
  line: 'rgba(255,255,255,0.08)',
  hair: 'rgba(255,255,255,0.14)',
  chip: 'rgba(255,255,255,0.05)',
  chipLine: 'rgba(255,255,255,0.09)',
  card: NAVY.card,
  card2: NAVY.card2,
  glow: ['rgba(143,117,255,0.6)', 'rgba(79,170,255,0.45)', 'rgba(225,230,255,0.5)'],
  grainOpacity: 0.08,
  headerEdge: 'rgba(255,255,255,0.14)',
  dockEdge: 'rgba(255,255,255,0.06)',
  dockDivider: 'rgba(255,255,255,0.14)',
  tabOn: 'rgba(255,255,255,0.08)',
  tabOff: '#9aa0c4',
  gamesGlow: 'rgba(120,130,255,0.8)',
  menuBtn: '#dfe3ff',
  panel: NAVY.panel,
  panel2: NAVY.panel2,
  panelLine: 'rgba(255,255,255,0.13)',
  kick: '#4fc8ff',
  moonShade: 'rgba(9,11,30,0.9)',
};

export const THEMES = { dark };
export type Theme = typeof dark;

export const F = {
  display: 'Gabarito_700Bold',
  // Gabarito has no italic: emphasis words keep the same face and lean on the accent colour.
  displayItalic: 'Gabarito_700Bold',
  body: 'InterTight_400Regular',
  bodyMedium: 'InterTight_500Medium',
  bodySemi: 'InterTight_600SemiBold',
  bodyBold: 'InterTight_700Bold',
  mono: 'JetBrainsMono_500Medium',
};
