/** The 9 player characters (AV1). A player's colour is their character's ring colour (AV3). */
export type Character = { slug: string; name: string; ring: string };

export const CHARACTERS: Character[] = [
  { slug: 'yazan', name: 'Yazan', ring: '#d21f45' },
  { slug: 'yara', name: 'Yara', ring: '#f3c110' },
  { slug: 'omar', name: 'Omar', ring: '#8b5c3a' },
  { slug: 'layla', name: 'Layla', ring: '#f58a2c' },
  { slug: 'atlas', name: 'Atlas', ring: '#8a5ae0' },
  { slug: 'nova', name: 'Nova', ring: '#3aa9e4' },
  { slug: 'bolt', name: 'Bolt', ring: '#e23f88' },
  { slug: 'iris', name: 'Iris', ring: '#7cc72a' },
  { slug: 'pip', name: 'Pip', ring: '#12969a' },
];

/** The 8 Nova Mechs (Yazan 2026-10-18): profile pictures won from daily chests; the ring is the rim on each face. */
export const MECH_CHARACTERS: Character[] = [
  { slug: 'sprocket', name: 'Sprocket', ring: '#5fc79a' },
  { slug: 'kit', name: 'Kit', ring: '#f28a24' },
  { slug: 'vex', name: 'Vex', ring: '#a98bff' },
  { slug: 'bulwark', name: 'Bulwark', ring: '#f2c230' },
  { slug: 'echo', name: 'Echo', ring: '#1fb5ad' },
  { slug: 'aurora', name: 'Aurora', ring: '#e6c36a' },
  { slug: 'cortex', name: 'Cortex', ring: '#ff3fb4' },
  { slug: 'titan', name: 'Titan', ring: '#ff7a1a' },
];

export const characterOf = (slug?: string) => CHARACTERS.find((c) => c.slug === slug) ?? MECH_CHARACTERS.find((c) => c.slug === slug);

/** The first character nobody in `taken` has picked. */
export const freeCharacter = (taken: (string | undefined)[]) => CHARACTERS.find((c) => !taken.includes(c.slug)) ?? CHARACTERS[0];

/** Pass the phone colours (Yazan 2026-10-18): setups pick a colour only; characters are chosen in Profile. */
export const SEAT_COLOURS: { name: string; color: string }[] = [
  { name: 'Red', color: '#d21f45' },
  { name: 'Yellow', color: '#f3c110' },
  { name: 'Orange', color: '#f58a2c' },
  { name: 'Purple', color: '#8a5ae0' },
  { name: 'Blue', color: '#3aa9e4' },
  { name: 'Pink', color: '#e23f88' },
  { name: 'Green', color: '#7cc72a' },
  { name: 'Teal', color: '#12969a' },
];

/** The first colour nobody in `taken` has picked. */
export const freeColour = (taken: (string | undefined)[]) => (SEAT_COLOURS.find((c) => !taken.includes(c.color)) ?? SEAT_COLOURS[0]).color;
