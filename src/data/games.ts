// The games in Yazan's Games page order (2026-10-05); decision 63 adds the one-line descriptions. Imposter joined last (2026-10-25), then Code Clinic.
// sub = the game's sub name ('Title: Sub name', build/game-subtitles.md).
export type Game = { key: string; lead: string; em: string; sub: string; desc: string };

export const GAMES: Game[] = [
  { key: 'the-diagnostic-pursuit', lead: 'The Diagnostic', em: 'Pursuit', sub: 'The Road to Diagnosis', desc: 'Race the clock to the right diagnosis, one clue at a time.' },
  { key: 'the-silent-artist', lead: 'The Silent', em: 'Artist', sub: 'Chalk and Silence', desc: 'Draw the diagnosis without words while friends guess.' },
  // Trust Me Not was cancelled (Yazan 2026-10-24); its code and database stay, it just isn't listed.
  { key: 'the-quiz-parade', lead: 'The Quiz', em: 'Parade', sub: 'March of Minds', desc: 'Seven kinds of question, one after another. Harder ones score more.' },
  { key: 'the-wheels-of-chaos', lead: 'The Wheels of', em: 'Chaos', sub: 'Spin of Fate', desc: 'Spin the wheel and take on whatever case it lands on.' },
  { key: 'the-riddler', lead: 'The', em: 'Riddler', sub: 'Puzzles in Plain Sight', desc: 'Picture riddles that spell out a condition or sign.' },
  { key: 'the-conqueror', lead: 'The', em: 'Conqueror', sub: 'The Last Empire', desc: "Answer right to seize land and take over your rivals' territory." },
  { key: 'case-files-unsolved', lead: 'Case', em: 'Files', sub: 'Unsolved Differentials', desc: 'Open the file, follow the clues and close the case.' },
  { key: 'nova-medicordle', lead: 'Nova', em: 'Medicordle', sub: 'Word of the Ward', desc: 'Guess the hidden medical term in six tries.' },
  { key: 'the-streak-master', lead: 'The Streak', em: 'Master', sub: 'One Miss Away', desc: 'Answer in a row and keep your streak alive.' },
  { key: 'nova-crossword', lead: 'Nova', em: 'Crossword', sub: "The Clinician's Grid", desc: 'Fill the grid with diseases, drugs and signs.' },
  { key: 'imposter', lead: 'The', em: 'Imposter', sub: 'Who Walked In', desc: 'One player has a different word. Find who walked in.' },
  { key: 'code-clinic', lead: 'Code', em: 'Clinic', sub: 'Read Between the Lines', desc: 'Two teams, one-word clues. Find your cards, never the deadly one.' },
];
