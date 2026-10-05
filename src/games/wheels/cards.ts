// The 8 tarot cards: dealing, what a seat may play in the round-transition window, Mirror swap (WC4)
// and the reaction chain against a Tower or Moon, as a step-by-step machine the screen can drive.
// Ported from cards.py and reactions.py, with fixes: Magician needs a third player, Mirror swap gives a
// random card and can't target an empty hand, and the chain never asks a seat with nothing to play.
import { shuffle, type Rng } from './core';

export type Card = 'star' | 'sun' | 'tower' | 'magician' | 'moon' | 'hermit' | 'mirror' | 'world';
export const CARDS: Card[] = ['star', 'sun', 'tower', 'magician', 'moon', 'hermit', 'mirror', 'world'];

export const CARD_INFO: Record<Card, { name: string; text: string }> = {
  star: { name: 'The Star', text: 'Re-spin the field wheel on your next turn.' },
  sun: { name: 'The Sun', text: 'Double your points on your turn this round.' },
  tower: { name: 'The Tower', text: 'Take 10 points from a player.' },
  magician: { name: 'The Magician', text: 'Send a Tower or Moon aimed at you to another player.' },
  moon: { name: 'The Moon', text: "Skip a player's next turn." },
  hermit: { name: 'The Hermit', text: 'Cancel a Tower or Moon aimed at you.' },
  mirror: { name: 'The Mirror', text: 'Swap a card with a player, or bounce a Tower back to its sender.' },
  world: { name: 'The World', text: 'When you are last, swap your turn for a Redemption round. Once a cycle.' },
};

export const TOWER_DAMAGE = 10;

/** Each seat gets 2 unique cards; with fewer than 4 players the rest are out of this game (spec 7.1). */
export function deal(seats: number, rng: Rng): Card[][] {
  const pool = shuffle(CARDS, rng);
  return Array.from({ length: seats }, (_, i) => [pool[i * 2], pool[i * 2 + 1]]);
}

/** A card played in the Initiation phase. Magician and Hermit only react; The World is offered at turn time. */
export type Play =
  | { card: 'star' | 'sun' }
  | { card: 'tower' | 'moon'; target: number }
  | { card: 'mirror'; target: number; give: Card };

/** Cards a seat may play now, given who is still in the game. */
export function playable(hands: Card[][], seat: number, active: number[]): Card[] {
  const others = active.filter((s) => s !== seat);
  return hands[seat].filter((c) => {
    if (c === 'star' || c === 'sun') return true;
    if (c === 'tower' || c === 'moon') return others.length > 0;
    // WC4: something to give, and someone with a card to take.
    if (c === 'mirror') return hands[seat].length > 1 && others.some((s) => hands[s].length > 0);
    return false;
  });
}

/** Valid targets for a played card. */
export function targetsFor(hands: Card[][], seat: number, card: Card, active: number[]): number[] {
  const others = active.filter((s) => s !== seat);
  return card === 'mirror' ? others.filter((s) => hands[s].length > 0) : others;
}

/** WC4: the user gives the card they pick and gets a random one of the target's cards. */
export function mirrorSwap(hands: Card[][], seat: number, target: number, give: Card, rng: Rng): { hands: Card[][]; got: Card } {
  const mine = hands[seat].filter((c) => c !== 'mirror' && c !== give);
  const theirs = [...hands[target]];
  const got = theirs.splice(Math.floor(rng() * theirs.length), 1)[0];
  const next = hands.map((h) => [...h]);
  next[seat] = [...mine, got];
  next[target] = [...theirs, give];
  return { hands: next, got };
}

// ---------------------------------------------------------------- reaction chain (spec 8.4)

export type Attack = { by: number; card: 'tower' | 'moon'; target: number };
export type Reaction = 'hermit' | 'mirror' | 'magician';

export type ChainStep =
  | { kind: 'start'; seat: number }
  | { kind: 'hermit'; seat: number; cleanup?: boolean }
  | { kind: 'mirror'; seat: number }
  | { kind: 'magician'; seat: number; to: number }
  | { kind: 'land'; seat: number };

export type Chain = {
  attack: Attack;
  /** The seat being asked now. */
  holder: number;
  /** The Magician-user (first target), for the Hermit cleanup exception. */
  magicianBy: number | null;
  /** True while the Magician-user is offered the Hermit-only cleanup after a Mirror. */
  cleanup: boolean;
  hands: Card[][];
  steps: ChainStep[];
  /** Set once resolved: who takes it, or null when cancelled. */
  result: { victim: number | null } | null;
};

/** Reactions the asked seat may use right now. */
export function reactions(c: Chain, active: number[]): Reaction[] {
  if (c.result) return [];
  const hand = c.hands[c.holder];
  if (c.cleanup) return hand.includes('hermit') ? ['hermit'] : [];
  const out: Reaction[] = [];
  if (hand.includes('hermit')) out.push('hermit');
  // Mirror only bounces a Tower, and never once it is back at the sender.
  if (hand.includes('mirror') && c.attack.card === 'tower' && c.holder !== c.attack.by) out.push('mirror');
  if (hand.includes('magician') && magicianTargets(c, active).length) out.push('magician');
  return out;
}

/** Anyone still in the game but the sender and the current holder (so never in a 2-player game). */
export const magicianTargets = (c: Chain, active: number[]) => active.filter((s) => s !== c.attack.by && s !== c.holder);

/** Skips seats with nothing to play, landing the attack on them. */
function settle(c: Chain, active: number[]): Chain {
  if (c.result || reactions(c, active).length) return c;
  if (c.cleanup) return settle({ ...c, cleanup: false, holder: c.attack.by }, active);
  return { ...c, steps: [...c.steps, { kind: 'land', seat: c.holder }], result: { victim: c.holder } };
}

export function startChain(attack: Attack, hands: Card[][], active: number[]): Chain {
  return settle({ attack, holder: attack.target, magicianBy: null, cleanup: false, hands, steps: [{ kind: 'start', seat: attack.target }], result: null }, active);
}

const drop = (hands: Card[][], seat: number, card: Card) => hands.map((h, i) => (i === seat ? h.filter((x) => x !== card) : h));

/** The asked seat answers: a reaction, or null to let it land (or to decline the cleanup). */
export function react(c: Chain, choice: Reaction | null, active: number[], to?: number): Chain {
  if (c.result) return c;
  const legal = reactions(c, active);
  if (choice && !legal.includes(choice)) return c;
  if (!choice) {
    if (c.cleanup) return settle({ ...c, cleanup: false, holder: c.attack.by }, active);
    return { ...c, steps: [...c.steps, { kind: 'land', seat: c.holder }], result: { victim: c.holder } };
  }
  const hands = drop(c.hands, c.holder, choice);
  if (choice === 'hermit') {
    // A full stop: nobody in the chain takes it.
    return { ...c, hands, steps: [...c.steps, { kind: 'hermit', seat: c.holder, cleanup: c.cleanup || undefined }], result: { victim: null } };
  }
  if (choice === 'magician') {
    if (to == null || !magicianTargets(c, active).includes(to)) return c;
    return settle({ ...c, hands, magicianBy: c.holder, holder: to, steps: [...c.steps, { kind: 'magician', seat: c.holder, to }] }, active);
  }
  // Mirror: back to the original sender; a Magician-user first gets a Hermit-only cleanup.
  const steps: ChainStep[] = [...c.steps, { kind: 'mirror', seat: c.holder }];
  if (c.magicianBy != null) return settle({ ...c, hands, steps, holder: c.magicianBy, cleanup: true }, active);
  return settle({ ...c, hands, steps, holder: c.attack.by }, active);
}
