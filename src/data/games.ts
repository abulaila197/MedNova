// The games in Yazan's Games page order (2026-10-05; new order 2026-10-26); decision 63 adds the one-line descriptions.
// sub = the game's sub name ('Title: Sub name', build/game-subtitles.md).
export type Game = { key: string; lead: string; em: string; sub: string; desc: string };

export const GAMES: Game[] = [
  { key: 'the-diagnostic-pursuit', lead: 'The Diagnostic', em: 'Pursuit', sub: 'The Road to Diagnosis', desc: 'Race the clock to the right diagnosis, one clue at a time.' },
  { key: 'the-silent-artist', lead: 'The Silent', em: 'Artist', sub: 'Chalk and Silence', desc: 'Draw the diagnosis without words while friends guess.' },
  // Trust Me Not was cancelled (Yazan 2026-10-24); its code and database stay, it just isn't listed.
  // The Conqueror, Nova Password and Code Clinic were taken off (Yazan 2026-11-04, point 6): same, kept in PARKED_GAMES.
  { key: 'nova-crossword', lead: 'Nova', em: 'Crossword', sub: "The Clinician's Grid", desc: 'Fill the grid with diseases, drugs and signs.' },
  { key: 'the-quiz-parade', lead: 'The Quiz', em: 'Parade', sub: 'March of Minds', desc: 'Seven kinds of question, one after another. Harder ones score more.' },
  { key: 'the-riddler', lead: 'The', em: 'Riddler', sub: 'Puzzles in Plain Sight', desc: 'Picture riddles that spell out a condition or sign.' },
  { key: 'nova-medicordle', lead: 'Nova', em: 'Medicordle', sub: 'Word of the Ward', desc: 'Guess the hidden medical term in six tries.' },
  { key: 'the-streak-master', lead: 'The Streak', em: 'Master', sub: 'One Miss Away', desc: 'Answer in a row and keep your streak alive.' },
  { key: 'case-files-unsolved', lead: 'Case', em: 'Files', sub: 'Unsolved Differentials', desc: 'Open the file, follow the clues and close the case.' },
  { key: 'the-wheels-of-chaos', lead: 'The Wheels of', em: 'Chaos', sub: 'Spin of Fate', desc: 'Spin the wheel and take on whatever case it lands on.' },
  { key: 'imposter', lead: 'The', em: 'Imposter', sub: 'Who Walked In', desc: 'One player has a different word. Find who walked in.' },
  // New mode 1 of 3 (Yazan 2026-11-12): placed last until he sets its spot in the order.
  { key: 'tilt-and-tell', lead: 'Tilt &', em: 'Tell', sub: 'Read My Mind', desc: 'The word is on your forehead. Your team gives the clues.' },
];

/** Games taken off the Games page but kept for later (Yazan 2026-11-04): code, art, banks and database all stay. */
export const PARKED_GAMES: Game[] = [
  { key: 'the-conqueror', lead: 'The', em: 'Conqueror', sub: 'The Last Empire', desc: "Answer right to seize land and take over your rivals' territory." },
  { key: 'nova-password', lead: 'Nova', em: 'Password', sub: 'One Word Away', desc: 'One-word clues, one secret term. The fewest clues wins.' },
  { key: 'code-clinic', lead: 'Code', em: 'Clinic', sub: 'Read Between the Lines', desc: 'Two teams, one-word clues. Find your cards, never the deadly one.' },
];

export const PARKED_KEYS: readonly string[] = PARKED_GAMES.map((g) => g.key);
