import type { ComponentType } from 'react';

import type { GameKey, Mode, Play, PlayItem } from '../engine/types';

/** One mode card on a game's landing page. */
export type ModeDef = {
  mode: Mode;
  title: string;
  blurb: string;
  /** Short "How to play" steps shown when the card opens. */
  howTo: string[];
  /** Not built yet: the card shows "Coming soon" and cannot start. */
  soon?: boolean;
};

/** A setup choice rendered as tappable chips (rule 9: locked once the game starts). */
export type SetupOption = {
  key: string;
  label: string;
  choices: { value: string | number; label: string; note?: string }[];
  initial: string | number;
};

export type PlayProps = {
  play: Play;
  /** Called when the game is over; the shell records it and opens results. */
  onFinish: (score: number) => void;
  /** Called when the player leaves from the pause menu (solo bookmarks, rule 7). */
  onQuit: () => void;
};

/** Everything the shared shell needs to host a game. */
export type GameDef = {
  key: GameKey;
  modes: ModeDef[];
  setup: Partial<Record<Mode, SetupOption[]>>;
  Play: Partial<Record<Mode, ComponentType<PlayProps>>>;
  /** EXP for a finished play, and the per-play sanity cap (rule 6). */
  exp: (score: number, items: PlayItem[]) => number;
  expCap: (settings: Record<string, unknown>) => number;
  /** One line per item on the results page. */
  itemLabel?: (item: PlayItem) => string;
};
