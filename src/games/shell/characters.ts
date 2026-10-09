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

export const characterOf = (slug?: string) => CHARACTERS.find((c) => c.slug === slug);

/** The first character nobody in `taken` has picked. */
export const freeCharacter = (taken: (string | undefined)[]) => CHARACTERS.find((c) => !taken.includes(c.slug)) ?? CHARACTERS[0];
