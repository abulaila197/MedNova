// The mode loading pages (preview v4, https://claude.ai/artifact/G9kxr7VLEYWHsXi6MfDhyC). Art redone with the robots and
// every bar made a plain line (Yazan 2026-10-27). Glows added for the robots are 'still': no extra moving work on the GPU.
// Each page speaks its game's own language: fonts, colours, bar and living art. No app accent, no light mode.
// Sizes are the preview's pixels on a 300px-wide phone; positions are fractions of the 9:16 photo.

export type BarType = 'line' | 'flame' | 'diamond' | 'chalk' | 'march' | 'thread' | 'tiles' | 'squares' | 'bulbs';
export type PartType = 'rain' | 'rainwin' | 'chalk' | 'motes' | 'sparkle' | 'embers' | 'smoke';
type Txt = { f: string; s: number; c: string; ls?: number; sh?: string };

export type LoadCfg = {
  key: string;
  photo: number;
  /** Focus of the slow push-in. */
  fo: string;
  /** Top veil: colours and stops. */
  veil: { c: string[]; at: number[] };
  txt: { top: number; align: 'left' | 'center'; rot?: number };
  orig: { f: string; c: string };
  title: Txt & { em: string; emF?: string };
  sub: Txt;
  tip: { f: string; s: number; c: string; bg: string; b: string };
  bar: { t: BarType; c?: string; track?: string; glow?: string; flag?: string };
  tag: { t: string; side: 'left' | 'right'; c: string; bg: string; b: string };
  /** 'still': drawn once, no motion. */
  glows: { x: number; y: number; r: number; c: string; a: 'pulse' | 'flicker' | 'still' }[];
  parts: PartType[];
  chase?: { y: number; xs: number[] };
  sweep?: boolean;
  /** The photo starts lower on a plain background (Conqueror, Streak Master). */
  artY?: number;
  bg?: string;
  tips: string[];
  fonts: string[];
};

const ALL = 'Solo · Pass the phone · Online';

export const LOAD: Record<string, LoadCfg> = {
  'the-diagnostic-pursuit': {
    key: 'the-diagnostic-pursuit', photo: require('@/assets/loading/the-diagnostic-pursuit.jpg'), fo: '66% 64%',
    veil: { c: ['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'], at: [0, 0.45] },
    txt: { top: 74, align: 'left' },
    orig: { f: 'SpecialElite_400Regular', c: '#b9b9b9' },
    title: { f: 'BebasNeue_400Regular', s: 54, c: '#f4f4f4', em: '#ff2b2b', ls: 0.01 },
    sub: { f: 'SpecialElite_400Regular', s: 13.5, c: '#d6d6d6' },
    tip: { f: 'SpecialElite_400Regular', s: 11.5, c: '#e2e2e2', bg: 'rgba(0,0,0,0.55)', b: 'rgba(255,255,255,0.18)' },
    bar: { t: 'line', c: '#ff2b2b', track: 'rgba(255,255,255,0.14)', glow: '0 0 10px #ff2b2b, 0 0 22px rgba(255,43,43,0.6)' },
    tag: { t: ALL, side: 'left', c: '#e8e8e8', bg: 'rgba(0,0,0,0.35)', b: 'rgba(255,255,255,0.28)' },
    glows: [
      { x: 0.235, y: 0.632, r: 40, c: 'rgba(255,30,30,0.55)', a: 'pulse' },
      { x: 0.42, y: 0.632, r: 40, c: 'rgba(255,30,30,0.55)', a: 'pulse' },
      { x: 0.257, y: 0.4, r: 60, c: 'rgba(255,255,240,0.28)', a: 'flicker' },
      { x: 0.66, y: 0.55, r: 120, c: 'rgba(255,110,40,0.14)', a: 'still' },
    ],
    parts: ['rain'],
    tips: ['Every clue you open uses up one guess, so guess early.', 'Fewer clues used means more points, plus up to 20 for speed.', 'Wrong guesses are crossed off your differential.'],
    fonts: ['SpecialElite_400Regular', 'BebasNeue_400Regular'],
  },
  'the-silent-artist': {
    key: 'the-silent-artist', photo: require('@/assets/loading/the-silent-artist.jpg'), fo: '55% 52%',
    veil: { c: ['rgba(10,25,20,0.35)', 'rgba(0,0,0,0)'], at: [0, 0.4] },
    txt: { top: 46, align: 'center', rot: -2.5 },
    orig: { f: 'CabinSketch_400Regular', c: '#d9d6c8' },
    title: { f: 'CabinSketch_700Bold', s: 44, c: '#f4f1e6', em: '#f2df8a' },
    sub: { f: 'CabinSketch_400Regular', s: 17, c: '#e6e2d3' },
    tip: { f: 'PatrickHand_400Regular', s: 15, c: '#ebe7da', bg: 'rgba(22,44,36,0.55)', b: 'rgba(240,236,224,0.25)' },
    bar: { t: 'line', c: '#f4f1e6', track: 'rgba(244,241,230,0.18)', glow: '0 0 8px rgba(244,241,230,0.7)' },
    tag: { t: ALL, side: 'left', c: '#efece0', bg: 'rgba(20,40,32,0.45)', b: 'rgba(240,236,224,0.35)' },
    glows: [
      { x: 0.79, y: 0.46, r: 40, c: 'rgba(90,240,255,0.35)', a: 'still' },
      { x: 0.4, y: 0.52, r: 150, c: 'rgba(255,255,245,0.08)', a: 'pulse' },
    ],
    parts: ['chalk'],
    tips: ['No words, no letters. Only the drawing talks.', 'In Pass the phone you can draw it or act it out.', 'Team play: the other team gets 15 s to steal.'],
    fonts: ['CabinSketch_400Regular', 'CabinSketch_700Bold', 'PatrickHand_400Regular'],
  },
  'trust-me-not': {
    key: 'trust-me-not', photo: require('@/assets/loading/trust-me-not.jpg'), fo: '50% 52%',
    veil: { c: ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)'], at: [0, 0.4] },
    txt: { top: 64, align: 'center' },
    orig: { f: 'CormorantGaramond_600SemiBold', c: '#c9a978' },
    title: { f: 'CormorantGaramond_700Bold', emF: 'CormorantGaramond_700Bold_Italic', s: 46, c: '#f3d9a6', em: '#d13a48' },
    sub: { f: 'CormorantGaramond_400Regular_Italic', s: 18, c: '#e6c58e' },
    tip: { f: 'CormorantGaramond_400Regular_Italic', s: 15.5, c: '#f0dcb4', bg: 'rgba(12,6,2,0.55)', b: 'rgba(243,217,166,0.22)' },
    bar: { t: 'flame', c: '#f2b45a', track: 'rgba(243,217,166,0.16)' },
    tag: { t: 'Online · 3-6 players', side: 'right', c: '#f3dfb7', bg: 'rgba(0,0,0,0.4)', b: 'rgba(243,217,166,0.3)' },
    glows: [
      { x: 0.575, y: 0.44, r: 46, c: 'rgba(255,190,90,0.75)', a: 'flicker' },
      { x: 0.56, y: 0.52, r: 190, c: 'rgba(255,170,70,0.16)', a: 'flicker' },
    ],
    parts: ['motes'],
    tips: ['Only you can see your jewels.', 'Skipping a meal is free, but hunger bites harder.', 'At the end of each season, everyone rates everyone in secret.'],
    fonts: ['CormorantGaramond_600SemiBold', 'CormorantGaramond_700Bold', 'CormorantGaramond_700Bold_Italic', 'CormorantGaramond_400Regular_Italic'],
  },
  'the-wheels-of-chaos': {
    key: 'the-wheels-of-chaos', photo: require('@/assets/loading/the-wheels-of-chaos.jpg'), fo: '50% 60%',
    veil: { c: ['rgba(10,0,4,0.5)', 'rgba(0,0,0,0)'], at: [0, 0.38] },
    txt: { top: 58, align: 'center' },
    orig: { f: 'Cinzel_500Medium', c: '#cdb27a' },
    title: { f: 'CinzelDecorative_700Bold', s: 31, c: '#f0cf7a', em: '#fff0c2', ls: 0.01, sh: 'rgba(240,207,122,0.35)' },
    sub: { f: 'Cinzel_400Regular', s: 13, c: '#e8d3a0', ls: 0.16 },
    tip: { f: 'CormorantGaramond_400Regular_Italic', s: 15.5, c: '#f5e8c8', bg: 'rgba(30,0,8,0.55)', b: 'rgba(240,207,122,0.25)' },
    bar: { t: 'line', c: '#f0cf7a', track: 'rgba(240,207,122,0.18)', glow: '0 0 10px rgba(240,207,122,0.8)' },
    tag: { t: ALL, side: 'left', c: '#f5e3b5', bg: 'rgba(40,0,10,0.45)', b: 'rgba(240,207,122,0.35)' },
    glows: [
      { x: 0.5, y: 0.915, r: 70, c: 'rgba(200,230,255,0.6)', a: 'pulse' },
      { x: 0.5, y: 0.355, r: 50, c: 'rgba(255,170,60,0.6)', a: 'still' },
    ],
    parts: ['sparkle'],
    tips: ['Hold The World for a comeback when you fall behind.', 'The Star gives you 3 s to re-spin the field.', 'Cards can be played on rivals. Watch your back.'],
    fonts: ['Cinzel_500Medium', 'Cinzel_400Regular', 'CinzelDecorative_700Bold', 'CormorantGaramond_400Regular_Italic'],
  },
  'the-riddler': {
    key: 'the-riddler', photo: require('@/assets/loading/the-riddler.jpg'), fo: '40% 60%',
    veil: { c: ['rgba(15,8,2,0.4)', 'rgba(0,0,0,0)'], at: [0, 0.38] },
    txt: { top: 46, align: 'left' },
    orig: { f: 'IMFellEnglishSC_400Regular', c: '#c8ad7f' },
    title: { f: 'IMFellEnglish_400Regular', emF: 'IMFellEnglish_400Regular_Italic', s: 50, c: '#f1d9a8', em: '#eaa93b' },
    sub: { f: 'IMFellEnglish_400Regular_Italic', s: 17, c: '#dcc196' },
    tip: { f: 'IMFellEnglish_400Regular', s: 14.5, c: '#f0dfbd', bg: 'rgba(20,10,2,0.5)', b: 'rgba(241,217,168,0.22)' },
    bar: { t: 'line', c: '#eaa93b', track: 'rgba(241,217,168,0.16)', glow: '0 0 8px rgba(234,169,59,0.8)' },
    tag: { t: ALL, side: 'left', c: '#f1dfbb', bg: 'rgba(20,10,2,0.4)', b: 'rgba(241,217,168,0.3)' },
    glows: [
      { x: 0.135, y: 0.33, r: 36, c: 'rgba(255,200,110,0.7)', a: 'still' },
      { x: 0.878, y: 0.452, r: 36, c: 'rgba(255,200,110,0.75)', a: 'flicker' },
      { x: 0.875, y: 0.607, r: 36, c: 'rgba(255,200,110,0.75)', a: 'flicker' },
      { x: 0.45, y: 0.49, r: 44, c: 'rgba(255,190,120,0.45)', a: 'still' },
    ],
    parts: ['motes'],
    tips: ['Say the picture out loud. The answer is in the sound.', 'Solve in 30 s with no mistakes for 3 stars.', 'Using a hint caps the level at 2 stars.'],
    fonts: ['IMFellEnglishSC_400Regular', 'IMFellEnglish_400Regular', 'IMFellEnglish_400Regular_Italic'],
  },
  'the-conqueror': {
    key: 'the-conqueror', photo: require('@/assets/loading/the-conqueror.jpg'), fo: '50% 62%',
    veil: { c: ['rgba(245,232,205,0.25)', 'rgba(0,0,0,0)'], at: [0, 0.4] },
    // The art sits lower so the tip box clears Sovereign's face; the paper colour fills above it.
    txt: { top: 40, align: 'center' }, artY: 56, bg: '#cfae80',
    orig: { f: 'Cinzel_500Medium', c: '#7a5a36' },
    title: { f: 'Cinzel_700Bold', s: 31, c: '#3b2412', em: '#8e1c1c' },
    sub: { f: 'CormorantGaramond_600SemiBold_Italic', s: 19, c: '#5a3a1e' },
    tip: { f: 'CormorantGaramond_600SemiBold_Italic', s: 16, c: '#4a3018', bg: 'rgba(246,234,208,0.82)', b: 'rgba(90,58,30,0.28)' },
    bar: { t: 'line', c: '#8e1c1c', track: 'rgba(90,58,30,0.2)', glow: '0 0 6px rgba(142,28,28,0.5)' },
    tag: { t: 'Online · 2-6 players', side: 'left', c: '#f5e6c8', bg: 'rgba(40,22,8,0.55)', b: 'rgba(245,230,200,0.3)' },
    glows: [
      { x: 0.915, y: 0.735, r: 40, c: 'rgba(255,200,110,0.8)', a: 'flicker' },
      { x: 0.85, y: 0.75, r: 160, c: 'rgba(255,180,90,0.16)', a: 'flicker' },
      { x: 0.205, y: 0.385, r: 40, c: 'rgba(255,40,40,0.55)', a: 'still' },
      { x: 0.52, y: 0.555, r: 30, c: 'rgba(255,40,60,0.5)', a: 'still' },
    ],
    parts: ['motes'],
    tips: ['Every right answer adds troops to your reserve.', 'Your rivals want your land too.', 'The last empire standing wins.'],
    fonts: ['Cinzel_500Medium', 'Cinzel_700Bold', 'CormorantGaramond_600SemiBold_Italic'],
  },
  'case-files-unsolved': {
    key: 'case-files-unsolved', photo: require('@/assets/loading/case-files-unsolved.jpg'), fo: '55% 55%',
    veil: { c: ['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0)'], at: [0, 0.36, 0.48] },
    txt: { top: 62, align: 'left' },
    orig: { f: 'SpecialElite_400Regular', c: '#b5b5b5' },
    title: { f: 'SpecialElite_400Regular', s: 46, c: '#f2f2f2', em: '#d42a36' },
    sub: { f: 'SpecialElite_400Regular', s: 13.5, c: '#cfcfcf' },
    tip: { f: 'SpecialElite_400Regular', s: 11.5, c: '#e2e2e2', bg: 'rgba(0,0,0,0.55)', b: 'rgba(255,255,255,0.18)' },
    bar: { t: 'line', c: '#c8232f', track: 'rgba(255,255,255,0.14)', glow: '0 0 8px rgba(200,35,47,0.7)' },
    tag: { t: ALL, side: 'left', c: '#e9e9e9', bg: 'rgba(0,0,0,0.45)', b: 'rgba(255,255,255,0.25)' },
    glows: [
      { x: 0.3, y: 0.31, r: 60, c: 'rgba(255,255,245,0.45)', a: 'flicker' },
      { x: 0.6, y: 0.47, r: 70, c: 'rgba(190,140,255,0.22)', a: 'still' },
    ],
    parts: ['rainwin'],
    tips: ['Build your differential before the tests come back.', '+10 for each right differential, -2 for each wrong one.', 'A wrong first diagnosis can still be redeemed.'],
    fonts: ['SpecialElite_400Regular'],
  },
  'nova-medicordle': {
    key: 'nova-medicordle', photo: require('@/assets/loading/nova-medicordle.jpg'), fo: '40% 65%',
    veil: { c: ['rgba(250,246,234,0.35)', 'rgba(0,0,0,0)'], at: [0, 0.35] },
    txt: { top: 30, align: 'left' }, bg: '#efe8d8',
    orig: { f: 'Archivo_700Bold', c: '#8a8f96' },
    title: { f: 'Archivo_900Black', s: 32, c: '#3c4a5c', em: '#4f7d5e', ls: -0.01, sh: 'rgba(0,0,0,0.12)' },
    sub: { f: 'Archivo_500Medium', s: 14, c: '#6b7686' },
    tip: { f: 'Archivo_500Medium', s: 12, c: '#3c4a5c', bg: 'rgba(251,248,240,0.92)', b: 'rgba(60,74,92,0.22)' },
    bar: { t: 'line', c: '#4f7d5e', track: 'rgba(60,74,92,0.16)', glow: '0 0 6px rgba(79,125,94,0.45)' },
    tag: { t: ALL, side: 'left', c: '#3c4a5c', bg: 'rgba(250,246,234,0.6)', b: 'rgba(60,74,92,0.3)' },
    sweep: true, glows: [
      { x: 0.785, y: 0.69, r: 16, c: 'rgba(255,160,60,0.7)', a: 'still' },
    ], parts: [],
    tips: ['Green: right letter, right place.', 'Yellow: in the word, but in the wrong place.', 'The definition shows on your last guess.'],
    fonts: ['Archivo_700Bold', 'Archivo_900Black', 'Archivo_500Medium'],
  },
  'the-quiz-parade': {
    key: 'the-quiz-parade', photo: require('@/assets/loading/the-quiz-parade.jpg'), fo: '50% 40%',
    veil: { c: ['rgba(4,8,24,0.55)', 'rgba(0,0,0,0)'], at: [0, 0.34] },
    txt: { top: 62, align: 'center' },
    orig: { f: 'Limelight_400Regular', c: '#e9c98a' },
    title: { f: 'Limelight_400Regular', s: 38, c: '#ffe2a0', em: '#ffb347', sh: 'rgba(255,180,70,0.55)' },
    sub: { f: 'Limelight_400Regular', s: 14, c: '#f5d79a' },
    tip: { f: 'CormorantGaramond_600SemiBold_Italic', s: 16, c: '#f8e6c0', bg: 'rgba(20,8,4,0.6)', b: 'rgba(255,216,138,0.25)' },
    bar: { t: 'line', c: '#ffd88a', track: 'rgba(255,216,138,0.16)', glow: '0 0 10px #ffd88a, 0 0 22px rgba(255,190,90,0.5)' },
    tag: { t: ALL, side: 'left', c: '#f8e2b8', bg: 'rgba(0,0,0,0.45)', b: 'rgba(255,216,138,0.3)' },
    glows: [
      { x: 0.14, y: 0.64, r: 60, c: 'rgba(255,190,90,0.5)', a: 'pulse' },
      { x: 0.5, y: 0.62, r: 40, c: 'rgba(180,220,255,0.45)', a: 'still' },
    ],
    parts: ['sparkle'],
    tips: ['Harder kinds of question are worth more points.', 'Match and order give part points for each right item.', 'Every question has its own clock.'],
    fonts: ['Limelight_400Regular', 'CormorantGaramond_600SemiBold_Italic'],
  },
  imposter: {
    key: 'imposter', photo: require('@/assets/loading/imposter.jpg'), fo: '50% 45%',
    veil: { c: ['rgba(0,6,8,0.6)', 'rgba(0,0,0,0)'], at: [0, 0.36] },
    txt: { top: 62, align: 'center' },
    orig: { f: 'BarlowCondensed_500Medium', c: '#8fb3b0' },
    title: { f: 'BebasNeue_400Regular', s: 54, c: '#e6f2f0', em: '#ff3b3b', ls: 0.02, sh: 'rgba(255,40,40,0.45)' },
    sub: { f: 'BarlowCondensed_500Medium', s: 15, c: '#b9d3d0' },
    tip: { f: 'BarlowCondensed_500Medium', s: 13.5, c: '#dcebe9', bg: 'rgba(0,10,12,0.62)', b: 'rgba(120,210,200,0.22)' },
    bar: { t: 'line', c: '#ff3b3b', track: 'rgba(160,230,220,0.14)', glow: '0 0 10px #ff3b3b, 0 0 22px rgba(255,59,59,0.55)' },
    tag: { t: 'Pass the phone · Online', side: 'left', c: '#dcebe9', bg: 'rgba(0,0,0,0.45)', b: 'rgba(160,230,220,0.28)' },
    glows: [
      { x: 0.5, y: 0.392, r: 40, c: 'rgba(255,40,40,0.5)', a: 'pulse' },
      { x: 0.5, y: 0.335, r: 36, c: 'rgba(150,255,240,0.35)', a: 'flicker' },
      { x: 0.5, y: 0.66, r: 110, c: 'rgba(60,230,230,0.18)', a: 'still' },
    ],
    parts: [],
    tips: ['One player has a different word, and even they don\'t know it.', 'Give a clue that proves you know the word without giving it away.', 'Caught? Guess everyone else\'s word to win a point back.'],
    fonts: ['BebasNeue_400Regular', 'BarlowCondensed_500Medium'],
  },
  'code-clinic': {
    key: 'code-clinic', photo: require('@/assets/loading/code-clinic.jpg'), fo: '50% 50%',
    veil: { c: ['rgba(4,4,10,0.62)', 'rgba(0,0,0,0)'], at: [0, 0.34] },
    txt: { top: 62, align: 'center' },
    orig: { f: 'BarlowCondensed_500Medium', c: '#b8b2c8' },
    title: { f: 'BebasNeue_400Regular', s: 54, c: '#ff5c6c', em: '#4f9dff', ls: 0.02, sh: 'rgba(120,120,255,0.4)' },
    sub: { f: 'BarlowCondensed_500Medium', s: 15, c: '#e2d6c4' },
    tip: { f: 'BarlowCondensed_500Medium', s: 13.5, c: '#ece4d6', bg: 'rgba(8,6,10,0.62)', b: 'rgba(255,214,150,0.22)' },
    bar: { t: 'line', c: '#ffd08a', track: 'rgba(255,220,170,0.14)', glow: '0 0 10px #ffd08a, 0 0 22px rgba(255,190,110,0.5)' },
    tag: { t: 'Pass the phone · Online', side: 'left', c: '#ece4d6', bg: 'rgba(0,0,0,0.45)', b: 'rgba(255,214,150,0.28)' },
    glows: [
      { x: 0.5, y: 0.355, r: 46, c: 'rgba(255,200,120,0.45)', a: 'flicker' },
      { x: 0.5, y: 0.475, r: 40, c: 'rgba(255,60,220,0.45)', a: 'still' },
    ],
    parts: [],
    tips: ['One word, many cards: a good clue links two or three of yours.', 'Stay away from any word that points to the deadly card.', 'You can always guess one more than the number.'],
    fonts: ['BebasNeue_400Regular', 'BarlowCondensed_500Medium'],
  },
  'nova-password': {
    key: 'nova-password', photo: require('@/assets/loading/nova-password.jpg'), fo: '50% 52%',
    veil: { c: ['rgba(252,242,226,0.78)', 'rgba(252,242,226,0)'], at: [0, 0.3] },
    txt: { top: 40, align: 'center' },
    orig: { f: 'Archivo_500Medium', c: '#8a6a55' },
    title: { f: 'AbrilFatface_400Regular', s: 46, c: '#e4553f', em: '#1d8a74', ls: 0.01 },
    sub: { f: 'Archivo_700Bold', s: 14, c: '#5b3a2c' },
    tip: { f: 'Archivo_500Medium', s: 13, c: '#4a3026', bg: 'rgba(255,247,234,0.86)', b: 'rgba(228,85,63,0.35)' },
    bar: { t: 'line', c: '#e4553f', track: 'rgba(29,138,116,0.2)', glow: '0 0 6px rgba(228,85,63,0.5)' },
    tag: { t: 'Pass the phone · Online', side: 'left', c: '#4a3026', bg: 'rgba(255,247,234,0.8)', b: 'rgba(29,138,116,0.4)' },
    glows: [
      { x: 0.25, y: 0.58, r: 30, c: 'rgba(90,240,240,0.45)', a: 'pulse' },
    ],
    parts: [],
    tips: ['One word per clue, and never part of the secret term.', 'Skipping is free, but clues already given still count.', 'Most words wins; on a tie, the fewest clues.'],
    fonts: ['AbrilFatface_400Regular', 'Archivo_500Medium', 'Archivo_700Bold'],
  },
  'the-streak-master': {
    key: 'the-streak-master', photo: require('@/assets/loading/the-streak-master.jpg'), fo: '45% 62%',
    veil: { c: ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)'], at: [0, 0.36] },
    txt: { top: 40, align: 'center' }, artY: 40, bg: '#0b0208',
    orig: { f: 'Limelight_400Regular', c: '#d9b47a' },
    title: { f: 'Limelight_400Regular', s: 38, c: '#ffd88a', em: '#ff9d3c', sh: 'rgba(255,170,60,0.55)' },
    sub: { f: 'Limelight_400Regular', s: 14, c: '#f5cf8d' },
    tip: { f: 'CormorantGaramond_600SemiBold_Italic', s: 16, c: '#f8e6c0', bg: 'rgba(20,4,2,0.6)', b: 'rgba(255,216,138,0.25)' },
    bar: { t: 'line', c: '#ffd88a', track: 'rgba(255,216,138,0.16)', glow: '0 0 10px #ffd88a, 0 0 22px rgba(255,170,60,0.5)' },
    tag: { t: ALL, side: 'left', c: '#f8e2b8', bg: 'rgba(0,0,0,0.45)', b: 'rgba(255,216,138,0.3)' },
    // The fire stays still (Yazan 2026-10-26): its flicker and the floating embers made Streak Master's way in and out lag.
    glows: [
      { x: 0.57, y: 0.565, r: 46, c: 'rgba(255,140,40,0.7)', a: 'still' },
    ],
    parts: [],
    tips: ['Each answer in a row is worth more than the last.', 'One miss and your streak drops to zero.', 'Skip keeps your streak alive, at a price.'],
    fonts: ['Limelight_400Regular', 'CormorantGaramond_600SemiBold_Italic'],
  },
  'nova-crossword': {
    key: 'nova-crossword', photo: require('@/assets/loading/nova-crossword.jpg'), fo: '50% 55%',
    veil: { c: ['rgba(250,246,236,0.3)', 'rgba(0,0,0,0)'], at: [0, 0.35] },
    txt: { top: 40, align: 'center' },
    orig: { f: 'LibreBaskerville_400Regular', c: '#7a736a' },
    title: { f: 'AbrilFatface_400Regular', s: 42, c: '#1c1a18', em: '#8e1b2a', sh: 'rgba(0,0,0,0.12)' },
    sub: { f: 'LibreBaskerville_400Regular_Italic', s: 13.5, c: '#4a4540' },
    tip: { f: 'LibreBaskerville_400Regular_Italic', s: 12.5, c: '#2b2723', bg: 'rgba(251,248,241,0.94)', b: 'rgba(28,26,24,0.25)' },
    bar: { t: 'line', c: '#8e1b2a', track: 'rgba(28,26,24,0.16)', glow: '0 0 4px rgba(142,27,42,0.4)' },
    tag: { t: ALL, side: 'left', c: '#1c1a18', bg: 'rgba(250,246,236,0.6)', b: 'rgba(28,26,24,0.3)' },
    sweep: true, glows: [], parts: [],
    tips: ['A wrong answer costs a heart. You have 5.', 'Leave no word unsolved for 3 stars.', 'A letter hint opens a third of the empty letters.'],
    fonts: ['LibreBaskerville_400Regular', 'LibreBaskerville_400Regular_Italic', 'AbrilFatface_400Regular'],
  },
};

/** The colour of the wipe line that carries the page out: the bar's own colour, else the title accent. */
export const wipeColor = (g: LoadCfg) => g.bar.c ?? g.title.em;
