import { canReact, privateWord } from './engine';
import type { ClueRecord, GameState, MatchConfig, Mode, Phase } from './types';

/**
 * What one player is allowed to see. The server sends each player only their own view,
 * so secret words and the imposter's identity never reach other devices.
 * viewerId = null is the shared offline device (it shows no secrets; use privateWord() for hold-to-view).
 */
export interface PlayerView {
  roomId: string;
  mode: Mode;
  hostId: string;
  viewerId: string | null;
  players: { id: string; name: string; connected: boolean; score: number | null }[];
  config: MatchConfig | null;
  roundNumber: number; // 1-based, 0 before the first round
  totalRounds: number | null;
  phase: Phase; // contains no secrets (round results are only included once the round is over)
  category: string | null;
  myWord: string | null; // online only
  typingPlayerId: string | null;
  revealedClue: ClueRecord | null; // only the most recent clue is shown
  lastTurnClues: ClueRecord[] | null; // shown at the decision, the vote and the redemption
  decisionAnswered: string[]; // who has answered, never what they answered
  votes: Record<string, string>; // visible live during the vote
  candidates: string[] | null; // revote candidates
  scoresVisible: boolean; // totals are shown after every round
  winners: string[] | null;
  canReact: boolean; // stickers / voice lines
}

export function getView(s: GameState, viewerId: string | null): PlayerView {
  const r = s.round;
  const k = s.phase.kind;
  const inRoundPhase = r !== null && k !== 'lobby' && k !== 'matchEnd';
  const scoresVisible = k === 'lobby' || k === 'roundResult' || k === 'matchEnd';
  const showLastTurn = k === 'decision' || k === 'offlineDiscussion' || k === 'vote' || k === 'redemption';

  return {
    roomId: s.roomId,
    mode: s.mode,
    hostId: s.hostId,
    viewerId,
    players: s.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected, score: scoresVisible ? p.score : null })),
    config: s.config,
    roundNumber: r ? r.index + 1 : 0,
    totalRounds: s.config?.rounds ?? null,
    phase: s.phase,
    category: inRoundPhase ? r!.pair.category : null,
    myWord: s.mode === 'online' && viewerId && inRoundPhase ? privateWord(s, viewerId) : null,
    typingPlayerId: s.phase.kind === 'clue' && s.phase.stage === 'typing' && r ? r.order[s.phase.slot] : null,
    revealedClue: s.phase.kind === 'clue' ? s.phase.reveal : null,
    lastTurnClues: showLastTurn && r ? r.clues.filter((c) => c.turn === r.turn) : null,
    decisionAnswered: k === 'decision' && r ? Object.keys(r.decisions) : [],
    votes: k === 'vote' && r ? { ...r.votes } : {},
    candidates: k === 'vote' && r ? r.candidates : null,
    scoresVisible,
    winners: s.winners,
    canReact: viewerId ? canReact(s, viewerId) : true,
  };
}
