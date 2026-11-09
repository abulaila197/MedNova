import type { PuzzleDef, WordDef } from './core';
import puzzles from './data/puzzles.json';

/**
 * The 70 bundled puzzles in play order (publish task 1, 2026-11-02; 51-70 added 2026-11-09, one photo each): array place = `level` = online puzzle number
 * (cw_words.n). Puzzle and word ids keep their first names (cw-18, p18-3), so they no longer follow the order.
 */
export const PUZZLES = puzzles as PuzzleDef[];
export const puzzleById = new Map(PUZZLES.map((p) => [p.id, p]));
export const puzzleByLevel = new Map(PUZZLES.map((p) => [p.level, p]));

/** Every word by id across all puzzles (ids are unique: "p<page>-<n>"). */
export const wordById = new Map<string, WordDef>(PUZZLES.flatMap((p) => p.words.map((w) => [w.id, w] as const)));

/** The clue as one line of text, for results and Learn (picture clues say so). */
export const clueText = (w: WordDef) => (w.question.kind === 'text' ? w.question.text : 'Identify the picture.');
