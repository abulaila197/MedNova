/** The 9 Original pack characters. Several players may share one; colours are given out separately (Yazan 2026-10-18). */
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

/** The Style shop characters (Yazan 2026-10-25): five sold for tokens, then Linky, Sovereign and Admin. */
export const SHOP_CHARACTERS: Character[] = [
  { slug: 'bloop', name: 'Bloop', ring: '#3cc8d8' },
  { slug: 'pixel', name: 'Pixel', ring: '#9b5de5' },
  { slug: 'nimbus', name: 'Nimbus', ring: '#8fd3ff' },
  { slug: 'ember', name: 'Ember', ring: '#ff6a2a' },
  { slug: 'zenith', name: 'Zenith', ring: '#e8b64a' },
  { slug: 'linky', name: 'Linky', ring: '#ff7a5c' },
  { slug: 'sovereign', name: 'Sovereign', ring: '#f2c14e' },
  { slug: 'admin', name: 'Admin', ring: '#40e0ff' },
];

export const characterOf = (slug?: string) =>
  CHARACTERS.find((c) => c.slug === slug) ?? MECH_CHARACTERS.find((c) => c.slug === slug) ?? SHOP_CHARACTERS.find((c) => c.slug === slug);

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

/** An online player's colour: one of the 8, never shared in a room, the same on every phone (by account id order). */
export function playerColour(players: { user_id: string }[], userId: string) {
  const i = players.map((p) => p.user_id).sort().indexOf(userId);
  return SEAT_COLOURS[Math.max(0, i) % SEAT_COLOURS.length].color;
}
