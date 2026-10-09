import type { ComponentType } from 'react';

import type { GameKey, Mode, Play, PlayItem, Seat, Standing } from '../engine/types';

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
  /** Called when the game is over; the shell records it and opens results. Multiplayer passes the standings. */
  onFinish: (score: number, standings?: Standing[]) => void;
  /** Called when the player leaves from the pause menu (solo bookmarks, rule 7). */
  onQuit: () => void;
};

/** A live online match screen (ON17): the room and match ids; the server referees. */
export type OnlineProps = { def: GameDef; roomId: string; matchId: string; me: string };

/** Everything the shared shell needs to host a game. */
export type GameDef = {
  key: GameKey;
  modes: ModeDef[];
  setup: Partial<Record<Mode, SetupOption[]>>;
  /** Modes that take named players in setup (one phone). Seat 0 is the phone owner. */
  players?: Partial<Record<Mode, { min: number; max: number }>>;
  Play: Partial<Record<Mode, ComponentType<PlayProps>>>;
  /** The live online match screen; Join/Create and the lobby are shared (ON16, ON20). */
  Online?: ComponentType<OnlineProps>;
  /** EXP for a finished play, and the per-play sanity cap (rule 6). */
  exp: (score: number, items: PlayItem[]) => number;
  expCap: (settings: Record<string, unknown>, mode?: Play['mode']) => number;
  /** One line per item on the results page. */
  itemLabel?: (item: PlayItem) => string;
  /** What one item is called, as in "Resume word 3" (default "case"). */
  itemNoun?: string;
  /** Heading for the item list on results (default "Cases"). */
  itemsTitle?: string;
  /** Results list shows only the names and dossier links (no right/wrong mark, no points), e.g. practice modes. */
  plainItems?: (play: Play) => boolean;
  /** Replaces the Points and Solved figures on results when the game counts differently; null keeps the default. */
  summary?: (play: Play, items: PlayItem[]) => { value: string; label: string }[] | null;
  /** Modes that offer team play (TM1); the host turns it on in setup. Team score is the average unless 'sum'. */
  teams?: Partial<Record<Mode, true>>;
  teamScore?: 'average' | 'sum';
  /** Note under the players list in setup (default: the phone owner earns EXP and Learn entries). */
  playersNote?: (players: number) => string;
  /** The game's own player and team colours (and team names), when the app's would clash with its look. */
  palette?: { seats: string[]; teams: { name: string; color: string }[] };
  /** RS3: a game with one look of its own draws the shared screens itself; the logic stays in the shell hooks. */
  screens?: OwnScreens;
};

export type OwnScreens = {
  Landing?: ComponentType<{ def: GameDef }>;
  Gate?: ComponentType<{ def: GameDef; mode: Mode }>;
  Setup?: ComponentType<{ def: GameDef; mode: Mode; prefill?: Record<string, unknown>; prefillSeats?: Seat[] }>;
  Results?: ComponentType<{ def: GameDef; play: Play; items: PlayItem[] }>;
};
