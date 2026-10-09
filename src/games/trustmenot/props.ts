// The one contract every Trust Me Not page takes: the phone's own envelope from the server, the clock, and a way to
// send an action. Pages never see anything the server did not put in this player's envelope.
import type { TmnEnvelope } from './online';

export type PageProps = {
  env: TmnEnvelope;
  /** Seconds left on the current phase's clock (server time). */
  seconds: number;
  /** Server time now, in ms. */
  now: number;
  /** Sends an engine action without the player (e.g. { type: 'SELL', jewels: 1 }), or { type: 'ready' }. */
  act: (a: { type: string; [k: string]: unknown }) => void;
  /** The match room (for chat and voice lines). */
  roomId: string;
};
