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

const ALL = 'Solo · Pass the phone · Vs rivals';
// Silent Artist has no bots (Yazan 2026-11-09): practice and Pass the phone only.
const NO_BOTS = 'Solo · Pass the phone';

export const LOAD: Record<string, LoadCfg> = {
  'the-diagnostic-pursuit': {
    key: 'the-diagnostic-pursuit', photo: require('@/assets/loading/the-diagnostic-pursuit.webp'), fo: '66% 64%',
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
    key: 'the-silent-artist', photo: require('@/assets/loading/the-silent-artist.webp'), fo: '55% 52%',
    veil: { c: ['rgba(10,25,20,0.35)', 'rgba(0,0,0,0)'], at: [0, 0.4] },
    txt: { top: 46, align: 'center', rot: -2.5 },
    orig: { f: 'CabinSketch_400Regular', c: '#d9d6c8' },
    title: { f: 'CabinSketch_700Bold', s: 44, c: '#f4f1e6', em: '#f2df8a' },
    sub: { f: 'CabinSketch_400Regular', s: 17, c: '#e6e2d3' },
    tip: { f: 'PatrickHand_400Regular', s: 15, c: '#ebe7da', bg: 'rgba(22,44,36,0.55)', b: 'rgba(240,236,224,0.25)' },
    bar: { t: 'line', c: '#f4f1e6', track: 'rgba(244,241,230,0.18)', glow: '0 0 8px rgba(244,241,230,0.7)' },
    tag: { t: NO_BOTS, side: 'left', c: '#efece0', bg: 'rgba(20,40,32,0.45)', b: 'rgba(240,236,224,0.35)' },
    glows: [
      { x: 0.79, y: 0.46, r: 40, c: 'rgba(90,240,255,0.35)', a: 'still' },
      { x: 0.4, y: 0.52, r: 150, c: 'rgba(255,255,245,0.08)', a: 'pulse' },
    ],
    parts: ['chalk'],
    tips: ['No words, no letters. Only the drawing talks.', 'In Pass the phone you can draw it or act it out.', 'Team play: the other team gets 15 s to steal.'],
    fonts: ['CabinSketch_400Regular', 'CabinSketch_700Bold', 'PatrickHand_400Regular'],
  },
  'the-wheels-of-chaos': {
    key: 'the-wheels-of-chaos', photo: require('@/assets/loading/the-wheels-of-chaos.webp'), fo: '50% 60%',
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
    tips: ['In the final round, last place can take a Redemption round.', 'Rule 2 Out and Matching are all or nothing.', 'The Boss Round winner takes a fifth of the target.'],
    fonts: ['Cinzel_500Medium', 'Cinzel_400Regular', 'CinzelDecorative_700Bold', 'CormorantGaramond_400Regular_Italic'],
  },
  'the-riddler': {
    key: 'the-riddler', photo: require('@/assets/loading/the-riddler.webp'), fo: '40% 60%',
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
  'case-files-unsolved': {
    key: 'case-files-unsolved', photo: require('@/assets/loading/case-files-unsolved.webp'), fo: '55% 55%',
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
    key: 'nova-medicordle', photo: require('@/assets/loading/nova-medicordle.webp'), fo: '40% 65%',
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
    key: 'the-quiz-parade', photo: require('@/assets/loading/the-quiz-parade.webp'), fo: '50% 40%',
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
    key: 'imposter', photo: require('@/assets/loading/imposter.webp'), fo: '50% 45%',
    veil: { c: ['rgba(0,6,8,0.6)', 'rgba(0,0,0,0)'], at: [0, 0.36] },
    txt: { top: 62, align: 'center' },
    orig: { f: 'BarlowCondensed_500Medium', c: '#8fb3b0' },
    title: { f: 'BebasNeue_400Regular', s: 54, c: '#e6f2f0', em: '#ff3b3b', ls: 0.02, sh: 'rgba(255,40,40,0.45)' },
    sub: { f: 'BarlowCondensed_500Medium', s: 15, c: '#b9d3d0' },
    tip: { f: 'BarlowCondensed_500Medium', s: 13.5, c: '#dcebe9', bg: 'rgba(0,10,12,0.62)', b: 'rgba(120,210,200,0.22)' },
    bar: { t: 'line', c: '#ff3b3b', track: 'rgba(160,230,220,0.14)', glow: '0 0 10px #ff3b3b, 0 0 22px rgba(255,59,59,0.55)' },
    tag: { t: 'Pass the phone', side: 'left', c: '#dcebe9', bg: 'rgba(0,0,0,0.45)', b: 'rgba(160,230,220,0.28)' },
    glows: [
      { x: 0.5, y: 0.392, r: 40, c: 'rgba(255,40,40,0.5)', a: 'pulse' },
      { x: 0.5, y: 0.335, r: 36, c: 'rgba(150,255,240,0.35)', a: 'flicker' },
      { x: 0.5, y: 0.66, r: 110, c: 'rgba(60,230,230,0.18)', a: 'still' },
    ],
    parts: [],
    tips: ['One player has a different word, and even they don\'t know it.', 'Give a clue that proves you know the word without giving it away.', 'Caught? Guess everyone else\'s word to win a point back.'],
    fonts: ['BebasNeue_400Regular', 'BarlowCondensed_500Medium'],
  },
  // Tilt & Tell (Yazan 2026-11-12): a 1970s game-show dressing room, marquee bulbs round the mirror, plum and gold.
  'tilt-and-tell': {
    key: 'tilt-and-tell', photo: require('@/assets/loading/tilt-and-tell.webp'), fo: '40% 55%',
    veil: { c: ['rgba(18,4,20,0.7)', 'rgba(0,0,0,0)'], at: [0, 0.38] },
    txt: { top: 54, align: 'center' },
    orig: { f: 'AlegreyaSans_500Medium', c: '#e7b7d3' },
    title: { f: 'Gabarito_800ExtraBold', s: 46, c: '#fff4e3', em: '#ffd780', sh: 'rgba(255,200,110,0.55)' },
    sub: { f: 'AlegreyaSans_500Medium', s: 16, c: '#f3d9e6' },
    tip: { f: 'AlegreyaSans_500Medium', s: 14, c: '#fff4e3', bg: 'rgba(30,8,34,0.62)', b: 'rgba(255,215,128,0.28)' },
    bar: { t: 'line', c: '#ffd780', track: 'rgba(255,215,128,0.16)', glow: '0 0 10px #ffd780, 0 0 22px rgba(255,190,90,0.5)' },
    tag: { t: 'Pass the phone · teams', side: 'left', c: '#fff4e3', bg: 'rgba(0,0,0,0.45)', b: 'rgba(255,215,128,0.3)' },
    // Bloop's dressing room (2026-11-12): bulbs round the mirror, Bloop's green eyes in the mirror.
    glows: [
      { x: 0.13, y: 0.52, r: 60, c: 'rgba(255,200,110,0.38)', a: 'still' },
      { x: 0.6, y: 0.47, r: 44, c: 'rgba(255,215,128,0.35)', a: 'flicker' },
      { x: 0.36, y: 0.628, r: 26, c: 'rgba(120,255,170,0.45)', a: 'pulse' },
    ],
    parts: ['motes'],
    tips: ['Tilt down when you get it, up to pass.', 'Only 3 passes a turn, so think before you skip.', 'Hold the phone flat on your forehead, screen facing your team.'],
    fonts: ['Gabarito_800ExtraBold', 'AlegreyaSans_500Medium'],
  },
  // Four of a Kind (Yazan 2026-11-12): Sovereign sorting cards in a sunlit medical library, gold and crimson.
  'four-of-a-kind': {
    key: 'four-of-a-kind', photo: require('@/assets/loading/four-of-a-kind.webp'), fo: '55% 60%',
    veil: { c: ['rgba(14,8,2,0.7)', 'rgba(0,0,0,0)'], at: [0, 0.36] },
    // The art sits a little lower so the tip clears Sovereign's helmet.
    txt: { top: 40, align: 'center' }, artY: 80, bg: '#140d05',
    orig: { f: 'LibreBaskerville_400Regular_Italic', c: '#e9cf9a' },
    title: { f: 'DMSerifDisplay_400Regular', s: 40, c: '#fff6e2', em: '#f2c14e', sh: 'rgba(242,193,78,0.5)' },
    sub: { f: 'LibreBaskerville_400Regular_Italic', s: 15, c: '#f3e2c0' },
    tip: { f: 'LibreBaskerville_400Regular_Italic', s: 14, c: '#fff6e2', bg: 'rgba(26,14,4,0.62)', b: 'rgba(242,193,78,0.28)' },
    bar: { t: 'line', c: '#f2c14e', track: 'rgba(242,193,78,0.16)', glow: '0 0 10px #f2c14e, 0 0 22px rgba(255,180,70,0.5)' },
    tag: { t: ALL, side: 'left', c: '#fff6e2', bg: 'rgba(0,0,0,0.42)', b: 'rgba(242,193,78,0.3)' },
    glows: [
      { x: 0.17, y: 0.26, r: 90, c: 'rgba(255,225,160,0.3)', a: 'still' },
      { x: 0.35, y: 0.465, r: 26, c: 'rgba(255,40,60,0.5)', a: 'pulse' },
      { x: 0.69, y: 0.52, r: 24, c: 'rgba(255,40,70,0.5)', a: 'pulse' },
    ],
    parts: ['motes'],
    tips: ['“One away” means 3 of your 4 belong together.', 'Start with the group you are surest of. Fewer boxes make the rest easier.', 'Watch for boxes that could fit two groups. Only one is right.'],
    fonts: ['DMSerifDisplay_400Regular', 'LibreBaskerville_400Regular_Italic'],
  },
  'the-streak-master': {
    key: 'the-streak-master', photo: require('@/assets/loading/the-streak-master.webp'), fo: '45% 62%',
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
      { x: 0.6, y: 0.555, r: 40, c: 'rgba(255,140,40,0.6)', a: 'still' },
    ],
    parts: [],
    tips: ['Each answer in a row is worth more than the last.', 'One miss and your streak drops to zero.', 'Skip keeps your streak alive, at a price.'],
    fonts: ['Limelight_400Regular', 'CormorantGaramond_600SemiBold_Italic'],
  },
  'nova-crossword': {
    key: 'nova-crossword', photo: require('@/assets/loading/nova-crossword.webp'), fo: '50% 55%',
    veil: { c: ['rgba(250,246,236,0.3)', 'rgba(0,0,0,0)'], at: [0, 0.35] },
    txt: { top: 40, align: 'center' },
    orig: { f: 'LibreBaskerville_400Regular', c: '#7a736a' },
    title: { f: 'AbrilFatface_400Regular', s: 42, c: '#1c1a18', em: '#8e1b2a', sh: 'rgba(0,0,0,0.12)' },
    sub: { f: 'LibreBaskerville_400Regular_Italic', s: 13.5, c: '#4a4540' },
    tip: { f: 'LibreBaskerville_400Regular_Italic', s: 12.5, c: '#2b2723', bg: 'rgba(251,248,241,0.94)', b: 'rgba(28,26,24,0.25)' },
    bar: { t: 'line', c: '#8e1b2a', track: 'rgba(28,26,24,0.16)', glow: '0 0 4px rgba(142,27,42,0.4)' },
    tag: { t: ALL, side: 'left', c: '#1c1a18', bg: 'rgba(250,246,236,0.6)', b: 'rgba(28,26,24,0.3)' },
    sweep: true, glows: [], parts: [],
    tips: ['A wrong answer costs a heart. You have 3.', 'Leave no word unsolved for 3 stars.', 'A letter hint opens a third of the empty letters.'],
    fonts: ['LibreBaskerville_400Regular', 'LibreBaskerville_400Regular_Italic', 'AbrilFatface_400Regular'],
  },
};

/** The colour of the wipe line that carries the page out: the bar's own colour, else the title accent. */
export const wipeColor = (g: LoadCfg) => g.bar.c ?? g.title.em;
