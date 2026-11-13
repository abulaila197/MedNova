// The welcome tour (Yazan, 2026-10-13): one pop-up on the Games page at the very first open, before the daily
// reward. A cast of characters takes turns, each one showing a main page or something only MedNova has.

export type Stop = { who: string; title: string; text: string };

// Simpler tour (Yazan 2026-11-13): 5 stops, updated to the app as it is now.
export const TOUR: Stop[] = [
  { who: 'nova', title: 'Welcome to MedNova', text: 'Learn medicine by playing 13 games, alone, around one phone, or against rivals.' },
  { who: 'bolt', title: 'Pick a game', text: 'Games are grouped into On duty, Play and learn, and Party time. Tap ? on any game to see how to play.' },
  { who: 'iris', title: 'Learn from every miss', text: 'Every answer you miss becomes a review card in Learn, with a full disease dossier behind it.' },
  { who: 'atlas', title: 'Sparks and tokens', text: 'Each play uses Sparks, which refill over time. Tokens buy helpers, extra plays and Nova Shop items.' },
  { who: 'yara', title: 'Come back daily', text: 'Daily missions, Grand Rounds, achievements and the card hunt all pay tokens. Now grab your first daily reward!' },
];
