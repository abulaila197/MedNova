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
  { id: 'frame:inviter', key: 'inviter', name: 'Inviter', price: null },
  { id: 'frame:sovereign', key: 'sovereign', name: 'Sovereign', price: null },
  { id: 'frame:admin', key: 'admin', name: 'Admin', price: null },
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

/** Titles that are never sold. "The Admin" is only on the MedNova team account (list #8). */
export const SPECIAL_TITLES: Item[] = [{ id: 'title:the_admin', key: 'the_admin', name: 'The Admin', price: null }];

export type EffectKey = 'confetti' | 'trophy' | 'medal' | 'pulse_wave' | 'too_easy' | 'mic_drop' | 'flatline' | 'spotlight' | 'friend_chain';

/**
 * Win effects: everyone in an online room sees yours when you win. Yazan 2026-10-18: celebrations first, the four
 * taunts cost the most.
 */
export const EFFECTS: (Item & { key: EffectKey; what: string })[] = [
  { id: 'effect:confetti', key: 'confetti', name: 'Confetti', price: 80, what: 'A burst of paper confetti' },
  { id: 'effect:trophy', key: 'trophy', name: 'Trophy', price: 120, what: 'A gold trophy pops up' },
  { id: 'effect:medal', key: 'medal', name: 'Medal', price: 150, what: 'A gold medal drops in and swings' },
  { id: 'effect:pulse_wave', key: 'pulse_wave', name: 'Pulse Wave', price: 200, what: 'A bold heartbeat shakes the screen' },
  { id: 'effect:too_easy', key: 'too_easy', name: 'Too Easy', price: 250, what: 'A red stamp slams down on everyone' },
  { id: 'effect:mic_drop', key: 'mic_drop', name: 'Mic Drop', price: 300, what: 'You drop the mic. Nothing more to say' },
  { id: 'effect:flatline', key: 'flatline', name: 'Flatline', price: 350, what: "Everyone else's line goes flat" },
  { id: 'effect:spotlight', key: 'spotlight', name: 'Spotlight', price: 400, what: 'Lights out for them, a spotlight for you' },
  { id: 'effect:friend_chain', key: 'friend_chain', name: 'Friendship Chain', price: null, what: 'Two chains lock together around a heart' },
];

/** How each earned item is got (shown instead of a price), and the ones only listed to their owner. */
export const EARNED_HOW: Record<string, string> = {
  'frame:rounds': 'Finish all 13 Grand Rounds weeks',
  'frame:inviter': 'Have 10 friends redeem your invite code',
  'effect:friend_chain': 'Have 10 friends redeem your invite code',
  'frame:sovereign': 'Comes with the Sovereign package',
  'frame:admin': 'MedNova team only',
  'title:the_admin': 'MedNova team only',
};
export const OWNER_ONLY = ['frame:admin', 'title:the_admin'];

/** Text sticker packs for online rooms (your character's stickers stay free). */
export const PACK_PRICE = 30;

export const titleName = (key?: string | null) =>
  [...TITLES, ...PLATINUM_TITLES, ...SPECIAL_TITLES].find((x) => x.key === key)?.name ?? 'Medical Student';

export const isPlatinumTitle = (key?: string | null) => !!key?.startsWith('p:');

/** The price this week (30% off for the weekly deal, rounded like the server). */
/** The weekly deal's discount (Yazan 2026-10-13: 15%, was 30%). Same as the server's style_cost. */
export const DEAL_OFF = 15;
export const costOf = (item: Item, deal: string[]) => (item.price == null ? null : deal.includes(item.id) ? Math.round((item.price * (100 - DEAL_OFF)) / 100) : item.price);
