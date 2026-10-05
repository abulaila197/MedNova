// The 10 games in Yazan's Games page order (2026-10-05); decision 63 adds the one-line descriptions.
// sub = the game's sub name ('Title: Sub name', build/game-subtitles.md).
export type Game = { key: string; lead: string; em: string; sub: string; desc: string };

export const GAMES: Game[] = [
  { key: 'the-diagnostic-pursuit', lead: 'The Diagnostic', em: 'Pursuit', sub: 'The Road to Diagnosis', desc: 'Race the clock to the right diagnosis, one clue at a time.' },
  { key: 'the-silent-artist', lead: 'The Silent', em: 'Artist', sub: 'Chalk and Silence', desc: 'Draw the diagnosis without words while friends guess.' },
  { key: 'trust-me-not', lead: 'Trust Me', em: 'Not', sub: 'The Year of Hunger', desc: 'Survive a year of famine together, if you can trust each other.' },
  { key: 'the-wheels-of-chaos', lead: 'The Wheels of', em: 'Chaos', sub: 'Spin of Fate', desc: 'Spin the wheel and take on whatever case it lands on.' },
  { key: 'the-riddler', lead: 'The', em: 'Riddler', sub: 'Puzzles in Plain Sight', desc: 'Picture riddles that spell out a condition or sign.' },
  { key: 'the-conqueror', lead: 'The', em: 'Conqueror', sub: 'The Last Empire', desc: "Answer right to seize land and take over your rivals' territory." },
  { key: 'case-files-unsolved', lead: 'Case', em: 'Files', sub: 'Unsolved Differentials', desc: 'Open the file, follow the clues and close the case.' },
  { key: 'nova-medicordle', lead: 'Nova', em: 'Medicordle', sub: 'Word of the Ward', desc: 'Guess the hidden medical term in six tries.' },
  { key: 'the-streak-master', lead: 'The Streak', em: 'Master', sub: 'One Miss Away', desc: 'Answer in a row and keep your streak alive.' },
  { key: 'nova-crossword', lead: 'Nova', em: 'Crossword', sub: "The Clinician's Grid", desc: 'Fill the grid with diseases, drugs and signs.' },
];

export const GAME_PHOTOS = {
  dark: {
    'trust-me-not': require('@/assets/games/dark/trust-me-not.jpg'),
    'the-conqueror': require('@/assets/games/dark/the-conqueror.jpg'),
    'the-diagnostic-pursuit': require('@/assets/games/dark/the-diagnostic-pursuit.jpg'),
    'the-wheels-of-chaos': require('@/assets/games/dark/the-wheels-of-chaos.jpg'),
    'nova-crossword': require('@/assets/games/dark/nova-crossword.jpg'),
    'nova-medicordle': require('@/assets/games/dark/nova-medicordle.jpg'),
    'the-silent-artist': require('@/assets/games/dark/the-silent-artist.jpg'),
    'the-riddler': require('@/assets/games/dark/the-riddler.jpg'),
    'the-streak-master': require('@/assets/games/dark/the-streak-master.jpg'),
    'case-files-unsolved': require('@/assets/games/dark/case-files-unsolved.jpg'),
  },
  light: {
    'trust-me-not': require('@/assets/games/light/trust-me-not.jpg'),
    'the-conqueror': require('@/assets/games/light/the-conqueror.jpg'),
    'the-diagnostic-pursuit': require('@/assets/games/light/the-diagnostic-pursuit.jpg'),
    'the-wheels-of-chaos': require('@/assets/games/light/the-wheels-of-chaos.jpg'),
    'nova-crossword': require('@/assets/games/light/nova-crossword.jpg'),
    'nova-medicordle': require('@/assets/games/light/nova-medicordle.jpg'),
    'the-silent-artist': require('@/assets/games/light/the-silent-artist.jpg'),
    'the-riddler': require('@/assets/games/light/the-riddler.jpg'),
    'the-streak-master': require('@/assets/games/light/the-streak-master.jpg'),
    'case-files-unsolved': require('@/assets/games/light/case-files-unsolved.jpg'),
  },
} as const;
