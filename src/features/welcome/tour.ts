// The welcome tour (Yazan, 2026-10-13): one pop-up on the Games page at the very first open, before the daily
// reward. A cast of characters takes turns, each one showing a main page or something only MedNova has.

export type Stop = { who: string; title: string; text: string };

export const TOUR: Stop[] = [
  { who: 'nova', title: 'Hey, welcome!', text: 'Learn medicine by playing games. Let’s take a quick look around before your first daily reward.' },
  { who: 'bolt', title: 'Ten original games', text: 'Play alone, pass one phone around the room, or race smart rivals that talk back.' },
  { who: 'iris', title: 'Learn from every miss', text: 'Every answer you miss waits in Learn as a review card, with a full disease dossier behind it.' },
  { who: 'layla', title: 'Community', text: 'Stories from people in medicine are on the way. Tap Notify me on the Community page and you’ll be the first to know.' },
  { who: 'atlas', title: 'Your profile', text: 'Your level, EXP and game stats grow with every play, and each new level pays tokens.' },
  { who: 'omar', title: 'Friends', text: 'Add friends, see their profiles and climb the leaderboard together.' },
  { who: 'yara', title: 'Achievements', text: 'Your trophy shelf. Bronze, silver and gold badges, and each one pays tokens.' },
  { who: 'pip', title: 'Nova Shop', text: 'Spend tokens on extra plays, or go unlimited with no ads.' },
  { who: 'yazan', title: 'Cards', text: 'Collect the named cards in the treasure hunt. Finish the set for a big token prize.' },
  { who: 'nova', title: 'Only on MedNova', text: 'Every game has its own world, and the rivals you race live on your phone, so you can play anywhere, no internet needed. Now let’s grab your first daily reward!' },
];
