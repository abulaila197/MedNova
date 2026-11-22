// The games in Yazan's Games page order (2026-10-05; new order 2026-10-26); decision 63 adds the one-line descriptions.
// sub = the game's sub name ('Title: Sub name', build/game-subtitles.md).
/** `about`: what the game is, in plain words, for the Games page ? (Yazan 2026-11-22); the mode steps live on the mode page. */
export type Game = { key: string; lead: string; em: string; sub: string; desc: string; about?: string };

export const GAMES: Game[] = [
  { key: 'the-diagnostic-pursuit', lead: 'Race to', em: 'Diagnosis', sub: 'Every Clue Counts', desc: 'Race the clock to the right diagnosis, one clue at a time.', about: "A medical detective race. A patient's case is revealed one clue at a time, and you name the diagnosis as early as you can. The fewer clues you need, the more points you get." },
  { key: 'the-silent-artist', lead: 'Sketch', em: 'It', sub: 'Chalk and Silence', desc: 'Draw the diagnosis without words while friends guess.', about: "A drawing and guessing party game. One player draws or acts out a secret medical word without speaking, and everyone else shouts guesses. You can also play alone to practise." },
  // Trust Me Not was cancelled (Yazan 2026-10-24); its code and database stay, it just isn't listed.
  // The Conqueror, Nova Password and Code Clinic were taken off (Yazan 2026-11-04, point 6): same, kept in PARKED_GAMES.
  { key: 'nova-crossword', lead: 'Nova', em: 'Crossword', sub: "The Clinician's Grid", desc: 'Fill the grid with diseases, drugs and signs.', about: "Classic crosswords made of medical words. Read each clue and fill the grid with diseases, drugs and signs until it is complete." },
  { key: 'the-riddler', lead: 'Medical', em: 'Riddles', sub: 'Puzzles in Plain Sight', desc: 'Picture riddles that spell out a condition or sign.', about: "Picture puzzles. Each one mixes pictures, letters and symbols that, read together, sound out a medical condition or sign. Work out what it says." },
  { key: 'nova-medicordle', lead: 'Word', em: 'Lab', sub: 'Word of the Ward', desc: 'Guess the hidden medical term in six tries.', about: "Word puzzles with medical terms. Guess a hidden word in six tries, with colour hints after each guess, or fix a word whose letters are scrambled." },
  { key: 'the-streak-master', lead: 'The Streak', em: 'Master', sub: 'One Miss Away', desc: 'Answer in a row and keep your streak alive.', about: "A quick quiz where your streak is everything. Answer medical questions one after another. Every right answer in a row is worth more, and one wrong answer breaks the streak." },
  { key: 'case-files-unsolved', lead: 'Case', em: 'Files', sub: 'Unsolved Differentials', desc: 'Open the file, follow the clues and close the case.', about: "Be the doctor on a full patient case. Take the history, examine, order tests, then diagnose and treat, step by step from the first visit to discharge." },
  { key: 'the-wheels-of-chaos', lead: 'The Wheels of', em: 'Chaos', sub: 'Spin of Fate', desc: 'Spin the wheel and take on whatever case it lands on.', about: "A game-show quiz. Spin the wheel to pick your questions, their style and their field, answer them, and keep spinning until you reach the target score." },
  { key: 'imposter', lead: 'The', em: 'Imposter', sub: 'Who Walked In', desc: 'One player has a different word. Find who walked in.', about: "A bluffing party game. Everyone gets the same medical word except one player. Take turns giving clues without giving it away, then vote on who the imposter is." },
  // New mode 1 of 3 (Yazan 2026-11-12): placed last until he sets its spot in the order.
  { key: 'tilt-and-tell', lead: 'Tilt &', em: 'Tell', sub: 'Read My Mind', desc: 'The word is on your forehead. Your team gives the clues.', about: "A party guessing game. Hold the phone on your forehead so you can't see the word, and your team gives you clues. Tilt down when you get it, tilt up to pass." },
  // New mode 2 (Yazan 2026-11-12): placed last until he sets its spot in the order.
  { key: 'four-of-a-kind', lead: 'Four of a', em: 'Kind', sub: 'Find the Hidden Link', desc: 'Sixteen boxes, four hidden groups. Find what links each four.', about: "A grouping puzzle. Sixteen medical words hide four groups of four that share a link. Pick the four that belong together and find all four groups." },
  // New mode 3 (Yazan 2026-11-12): placed last until he sets its spot in the order.
  { key: 'spot-the-flaw', lead: 'Spot the', em: 'Flaw', sub: 'Read Between the Lines', desc: 'One story, one hidden mistake. Catch it, then fix it.', about: "A short patient story with one mistake hidden in it, like a wrong sign, test or treatment. Find the mistake, then pick the right fix." },
  // New game 4 (Yazan 2026-11-12): placed last.
  { key: 'trace-the-treatment', lead: 'Trace the', em: 'Treatment', sub: 'Follow the Clues', desc: 'One story, one treatment. Follow the clues to find it.', about: "A short patient story that points to one treatment. Read the clues in the story and work out which treatment the patient needs." },
  // Group 6 (Yazan 2026-11-17): basic sciences, Play and learn.
  // Group 7 (Yazan 2026-11-18): basic sciences, Play and learn.
  { key: 'put-in-order', lead: 'Put it in', em: 'order', sub: 'Step by Step', desc: 'Drag the steps into the right order. Watch out for the ones that do not belong.', about: "A sorting puzzle. You get the steps of a medical process, like how a drug works or how a disease develops. Drag them into the right order and leave out the steps that don't belong." },
  { key: 'who-am-i', lead: 'Who am', em: 'I?', sub: 'Written in the Stars', desc: 'Five clues, one hidden answer. Name it with as few as you can.', about: "A guess-who game. Something medical, like a disease, a drug or an organism, describes itself in five clues. Name it with as few clues as you can." },
];

/** Games taken off the Games page but kept for later (Yazan 2026-11-04): code, art, banks and database all stay. */
export const PARKED_GAMES: Game[] = [
  { key: 'the-conqueror', lead: 'The', em: 'Conqueror', sub: 'The Last Empire', desc: "Answer right to seize land and take over your rivals' territory." },
  { key: 'nova-password', lead: 'Nova', em: 'Password', sub: 'One Word Away', desc: 'One-word clues, one secret term. The fewest clues wins.' },
  { key: 'code-clinic', lead: 'Code', em: 'Clinic', sub: 'Read Between the Lines', desc: 'Two teams, one-word clues. Find your cards, never the deadly one.' },
  // Merged into The Wheels of Chaos and removed (Yazan 2026-11-12): its code is gone, its name stays for old plays.
  { key: 'the-quiz-parade', lead: 'Quick Fire', em: 'Quiz', sub: 'March of Minds', desc: 'Seven kinds of question, one after another. Harder ones score more.' },
];

export const PARKED_KEYS: readonly string[] = PARKED_GAMES.map((g) => g.key);
