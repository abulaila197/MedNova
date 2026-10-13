// The Style shop catalogue (Yazan 2026-10-13). Prices are mirrored from the server (style_price); the server decides.
import { ACHIEVEMENTS } from '../achievements/progress';
import type { FrameKey } from './Frame';

export type Item = { id: string; key: string; name: string; price: number | null };

/** Frames, cheapest first. Grand Rounds is earned by finishing 13 weeks (price null). */
export const FRAMES: (Item & { key: FrameKey })[] = [
  { id: 'frame:normal', key: 'normal', name: 'Normal', price: 0 },
  { id: 'frame:bronze', key: 'bronze', name: 'Bronze', price: 60 },
  { id: 'frame:silver', key: 'silver', name: 'Silver', price: 150 },
  { id: 'frame:gold', key: 'gold', name: 'Gold', price: 350 },
  { id: 'frame:stethoscope', key: 'stethoscope', name: 'Stethoscope', price: 500 },
  { id: 'frame:platinum', key: 'platinum', name: 'Platinum', price: 700 },
  { id: 'frame:helix', key: 'helix', name: 'Helix', price: 800 },
  { id: 'frame:neuron', key: 'neuron', name: 'Neuron', price: 850 },
  { id: 'frame:pulse', key: 'pulse', name: 'Pulse', price: 900 },
  { id: 'frame:laurel', key: 'laurel', name: 'Laurel', price: 1000 },
  { id: 'frame:aurora', key: 'aurora', name: 'Aurora', price: 1100 },
  { id: 'frame:nova', key: 'nova', name: 'Nova', price: 1200 },
  { id: 'frame:rounds', key: 'rounds', name: 'Grand Rounds', price: null },
];

const T = (key: string, name: string, price: number): Item => ({ id: `title:${key}`, key, name, price });

export const TITLES: Item[] = [
  T('medical_student', 'Medical Student', 0),
  T('intern', 'Intern', 40), T('night_owl', 'Night Owl', 40), T('coffee_powered', 'Coffee Powered', 40),
  T('resident', 'Resident', 100), T('differential_hunter', 'Differential Hunter', 100), T('ward_whisperer', 'Ward Whisperer', 100),
  T('chief_resident', 'Chief Resident', 250), T('the_diagnostician', 'The Diagnostician', 250), T('pager_legend', 'Pager Legend', 250),
  T('attending', 'Attending', 500), T('consultant', 'Consultant', 500), T('riddle_master', 'Riddle Master', 500),
  T('head_of_department', 'Head of Department', 1000), T('professor', 'Professor', 1000),
];

/** Platinum titles: one per achievement, earned at its Platinum tier ("Night Shift Platinum"). */
export const PLATINUM_TITLES: Item[] = ACHIEVEMENTS.filter((a) => a.goals.length > 3).map((a) => ({
  id: `title:p:${a.key}`,
  key: `p:${a.key}`,
  name: `${a.name} Platinum`,
  price: null,
}));

export type EffectKey = 'confetti' | 'pulse_wave' | 'signed_off' | 'supernova';

/** Win effects: everyone in an online room sees yours when you win. */
export const EFFECTS: (Item & { key: EffectKey; what: string })[] = [
  { id: 'effect:confetti', key: 'confetti', name: 'Confetti', price: 80, what: 'A burst of paper confetti' },
  { id: 'effect:pulse_wave', key: 'pulse_wave', name: 'Pulse Wave', price: 150, what: 'A heartbeat ripples across the screen' },
  { id: 'effect:signed_off', key: 'signed_off', name: 'Signed Off', price: 200, what: 'A red "Discharged" stamp lands' },
  { id: 'effect:supernova', key: 'supernova', name: 'Supernova', price: 300, what: 'The Pulse star bursts into light' },
];

/** Reaction packs: another character's stickers for online rooms (your own character's are free). */
export const PACK_PRICE = 60;

export const titleName = (key?: string | null) =>
  [...TITLES, ...PLATINUM_TITLES].find((x) => x.key === key)?.name ?? 'Medical Student';

export const isPlatinumTitle = (key?: string | null) => !!key?.startsWith('p:');

/** The price this week (30% off for the weekly deal, rounded like the server). */
export const costOf = (item: Item, deal: string[]) => (item.price == null ? null : deal.includes(item.id) ? Math.round(item.price * 0.7) : item.price);
