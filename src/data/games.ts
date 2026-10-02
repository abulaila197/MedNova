// The 8 games, in the order of the locked Games page (decision 63 adds the one-line descriptions).
export type Game = { key: string; lead: string; em: string; desc: string };

export const GAMES: Game[] = [
  { key: 'the-diagnostic-pursuit', lead: 'The Diagnostic', em: 'Pursuit', desc: 'Race the clock to the right diagnosis, one clue at a time.' },
  { key: 'the-wheels-of-chaos', lead: 'The Wheels of', em: 'Chaos', desc: 'Spin the wheel and take on whatever case it lands on.' },
  { key: 'nova-crossword', lead: 'Nova', em: 'Crossword', desc: 'Fill the grid with diseases, drugs and signs.' },
  { key: 'nova-medicordle', lead: 'Nova', em: 'Medicordle', desc: 'Guess the hidden medical term in six tries.' },
  { key: 'the-silent-artist', lead: 'The Silent', em: 'Artist', desc: 'Draw the diagnosis without words while friends guess.' },
  { key: 'the-riddler', lead: 'The', em: 'Riddler', desc: 'Crack clinical riddles hidden in a few short lines.' },
  { key: 'the-streak-master', lead: 'The Streak', em: 'Master', desc: 'Answer in a row and keep your streak alive.' },
  { key: 'case-files-unsolved', lead: 'Case Files:', em: 'Unsolved', desc: 'Open the file, follow the clues and close the case.' },
];

export const GAME_PHOTOS = {
  dark: {
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
