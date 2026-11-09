import { hash } from './rng';
import { PERSONAS, type BotType, type Persona } from './types';

/**
 * Same name, same person (Yazan 2026-11-09): a rival's personality, face and starting level all come from its
 * name, so meeting "Omar" again next week is meeting the same player.
 */
export const personaOf = (name: string): Persona => PERSONAS[hash(`persona:${name}`) % PERSONAS.length];

/** The starting levels each type shows on its badge, so the badge also hints how strong a rival is. */
export const LEVELS: Record<BotType, [number, number]> = { freshman: [1, 9], scholar: [8, 22], genius: [20, 45] };
export const levelOf = (type: BotType, name: string) => {
  const [a, b] = LEVELS[type];
  return a + (hash(`level:${name}`) % (b - a + 1));
};
/** One face from the type's faces, always the same for a name. */
export const faceOf = (faces: string[], name: string) => faces[hash(`face:${name}`) % faces.length];

/**
 * How chatty each personality is (Yazan 2026-11-09: between Normal and Chatty, by personality).
 * 0 is the Normal end, 1 the Chatty end.
 */
export const CHATTY: Record<Persona, number> = { shy: 0, cool: 0.15, sleepy: 0.4, cheer: 0.5, sore: 0.75, hot: 0.8, joker: 0.9, showoff: 1 };
