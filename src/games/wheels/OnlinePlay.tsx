// The Wheels of Chaos Online (WC20-WC23): the full show on everyone's own phone. The server referees (the wheels
// edge function); this screen polls the game every second, shows whoever's turn it is live to the whole room, and
// sends only my own moves. Cards stay secret: the server hides other players' hands. The Boss Round is played by
// everyone at once, each swipe sent as it happens.
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';

import { call, invoke, leaveRoom } from '@/online/api';
import { finishOnline, playForMatch } from '@/online/finish';
import { settingsLine } from '@/online/format';
import { AlertPill, Countdown, useAlerts } from '@/online/live';
import { RoomTalk } from '@/online/Talk';
import { u } from '@/theme/scale';

import type { OnlineProps } from '../shell/types';
import { CARD_INFO, type Card } from './cards';
import { fieldName, type Answer, type QResult, type TurnEvent } from './core';
import { BANK } from './data';
import { bankVersion } from './keys';
import { actor, bossPoints, BOSS_BONUS, BOSS_MS, BOSS_RIGHT, BOSS_WRONG, type OfflineGame } from './offline';
import { actName, Board, BossOver, CardWindow, ReactWindow, recapLine, RedemptionBoard, RedemptionOffer, Top, TurnOver, type Seats } from './OfflinePlay';
import { ONLINE_MS, type Move, type OnlineWheels } from './online';
import { WheelsPause } from './screens';
import { TurnBoard, type Strip } from './TurnBoard';
import { Bill, Btn, Bulbs, CardArt, CD, CM, GEMS, Panel, PauseBtn, ROMAN, Rule, T, VelvetScreen, VV } from './velvet';
import { useMatchState } from '@/online/useMatchState';

/** Every phone in a game must carry the same bank; the server checks this. */
const BANK_V = bankVersion(BANK);

type WPlayer = { user_id: string; name: string; character: string; team: number | null; score: number; dropped: boolean; rank: number | null };
type WState = {
  now: number;
  room_id: string;
  phase: 'countdown' | 'case' | 'done';
  phase_ends_at: number;
  settings: Record<string, unknown>;
  players: WPlayer[];
  seats: string[] | null;
  me: number | null;
  version: number;
  due: number | null;
  state: OnlineWheels | null;
  swipes: Record<string, number>;
  my_swipes: boolean[] | null;
};

/** The server plays on answer keys; the phone puts the bank's words back in. */
function hydrate(g: OfflineGame): OfflineGame {
  const turn = g.turn ? { ...g.turn, question: BANK.questions[Number(g.turn.question.id)] ?? g.turn.question } : null;
  const redemption = g.redemption ? { ...g.redemption, items: g.redemption.items.map((q) => BANK.redemption[Number(q.id)] ?? q) } : null;
  let boss = g.boss;
  const set = boss ? BANK.boss[Number(boss.category)] : undefined;
  if (boss && set) boss = { ...boss, category: set.category, items: boss.items.map((it) => ({ label: set.items[Number(it.label)]?.label ?? it.label, fits: it.fits })) };
  return { ...g, turn, redemption, boss };
}

const WAITS: Partial<Record<OfflineGame['phase'], number>> = { initiation: ONLINE_MS.init, reaction: ONLINE_MS.react, redemptionOffer: ONLINE_MS.offer };

export function OnlinePlay({ def, roomId, matchId, me }: OnlineProps) {
  const { st, load, server, notice, setNotice } = useMatchState<WState>('wc_state', matchId, { tickMs: 200 });
  const [oldBank, setOldBank] = useState(false);
  const [menu, setMenu] = useState(false);
  const lastTick = useRef(0);
  const busy = useRef(false);
  const finishing = useRef(false);
  const { alert, push } = useAlerts();

  /** One request to the referee: my move, or a nudge when a wait has run out. */
  const send = useCallback(
    async (move: Move) => {
      if (move.type !== 'TICK') {
        if (busy.current) return;
        busy.current = true;
      }
      try {
        const data = await invoke<{ result?: string } | null>('wheels', { m: matchId, v: BANK_V, move });
        if (data?.result === 'bank') setOldBank(true);
      } catch {
        if (move.type !== 'TICK') setNotice('Couldn’t send that. Check your connection.');
      } finally {
        if (move.type !== 'TICK') busy.current = false;
        load();
      }
    },
    [matchId, load],
  );
  const tick = useCallback(() => {
    if (Date.now() - lastTick.current < 1200) return;
    lastTick.current = Date.now();
    send({ type: 'TICK' });
  }, [send]);

  const g = useMemo(() => (st?.state ? hydrate(st.state.g) : null), [st?.version, st?.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const mySeat = st?.me ?? null;
  const playing = mySeat != null;
  const who = g ? actor(g) : null;

  // The server moves on when someone asks after a wait runs out: the player whose turn it is first, the rest a
  // moment later in case that phone has gone quiet. The first request after the countdown deals the cards.
  useEffect(() => {
    if (!st || st.phase === 'done' || oldBank) return;
    if (!st.state) {
      if (server >= st.phase_ends_at) tick();
      return;
    }
    if (st.due == null) return;
    const first = who === mySeat || (who == null && mySeat === Math.min(...(g?.active ?? [0])));
    if (server >= st.due + (first ? 0 : 2500)) tick();
  }, [server, st, who, mySeat, g, tick, oldBank]);

  // WC8: card plays, hits and Boss winners as alerts for the room.
  const seenLog = useRef<number | null>(null);
  const seatName = useCallback(
    (s: number) => {
      const id = st?.seats?.[s];
      if (s === mySeat) return 'You';
      return st?.players.find((p) => p.user_id === id)?.name ?? `Player ${s + 1}`;
    },
    [st?.seats, st?.players, mySeat],
  );
  useEffect(() => {
    if (!g) return;
    if (seenLog.current == null || g.log.length < seenLog.current) {
      seenLog.current = g.log.length;
      return;
    }
    for (const l of g.log.slice(seenLog.current)) {
      if (l.k === 'turn' || l.k === 'skipped') continue;
      const line = recapLine(l, seatName);
      if (line) push(line, GEMS[('seat' in l ? l.seat : 0) % GEMS.length]);
    }
    seenLog.current = g.log.length;
  }, [g, seatName, push]);

  // The end: the server's final places become an ordinary play on this phone (ON21). EXP is half my points (WC11).
  useEffect(() => {
    if (!st || st.phase !== 'done' || !playing || finishing.current || !st.state || !st.seats) return;
    finishing.current = true;
    (async () => {
      const seatsOf = st.seats!;
      const order = [mySeat!, ...seatsOf.map((_, i) => i).filter((i) => i !== mySeat)];
      const local = new Map(order.map((s, i) => [s, i]));
      const byId = new Map(st.players.map((p) => [p.user_id, p]));
      const seats = order.map((s, i) => ({ seat: i, name: s === mySeat ? 'You' : (byId.get(seatsOf[s])?.name ?? `Player ${s + 1}`), character: byId.get(seatsOf[s])?.character, color: GEMS[s % GEMS.length] }));
      const standings = order
        .map((s) => {
          const p = byId.get(seatsOf[s]);
          return { seat: local.get(s)!, name: seats[local.get(s)!].name, score: p?.score ?? 0, timeMs: 0, rank: p?.rank ?? order.length };
        })
        .sort((a, b) => a.rank - b.rank);
      const score = byId.get(me)?.score ?? 0;
      const mine = st.state!.g.answers.filter((a) => a.seat === mySeat).map((a) => a.r);
      const items = mine.map((r: QResult) => ({
        seat: 0, itemId: BANK.questions[Number(r.id)]?.id ?? r.id, answerKey: null, outcome: r.right ? ('right' as const) : r.answer == null ? ('timed_out' as const) : ('wrong' as const),
        answersGiven: [], timeMs: 0, hintsUsed: 0, revealsUsed: 0, points: r.points, feedsLearn: false, gameData: { style: r.style, field: r.field },
      }));
      const id = await finishOnline(def, matchId, { settings: { ...st.settings, room: roomId, match: matchId }, seats, standings, score, items });
      router.replace(`/play/${def.key}/results?play=${id}`);
    })();
  }, [st, playing, mySeat, me, def, roomId, matchId]);

  // Already finished on this phone (reopened): straight to the results.
  useEffect(() => {
    playForMatch(matchId).then((id) => id && st?.phase === 'done' && router.replace(`/play/${def.key}/results?play=${id}`));
  }, [matchId, st?.phase, def.key]);

  const leave = useCallback(async () => {
    await leaveRoom(roomId).catch(() => {});
    router.replace(`/play/${def.key}`);
  }, [roomId, def.key]);

  const meTalk = st?.players.find((p) => p.user_id === me);
  // The talk button steps aside while I answer or swipe, so it never covers a choice (as in Crossword).
  const answering = !!g && ((g.phase === 'turn' && who === mySeat && g.turn?.phase === 'question') || (g.phase === 'redemption' && who === mySeat) || (g.phase === 'boss' && g.boss?.phase === 'playing'));
  const extras = (
    <>
      <AlertPill alert={alert} />
      {answering ? null : <RoomTalk room={roomId} me={{ id: me, name: meTalk?.name ?? 'You', face: meTalk?.character ?? 'yara' }} />}
      {notice || oldBank ? (
        <View style={{ position: 'absolute', bottom: u(90), left: u(16), right: u(16), alignItems: 'center' }} pointerEvents="none">
          <View style={{ backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: u(10), padding: u(8) }}>
            <T size={12} color={VV.cream}>{oldBank ? 'This game uses a different question bank. Update the app to play.' : notice}</T>
          </View>
        </View>
      ) : null}
    </>
  );

  if (!st) return <VelvetScreen>{null}</VelvetScreen>;
  if (!st.state || !g) {
    return (
      <VelvetScreen>
        {st.phase === 'done' ? null : <Countdown ms={Math.max(0, st.phase_ends_at - server)} faces={st.players.map((p) => p.character)} line={settingsLine(def, st.settings)} />}
        {extras}
      </VelvetScreen>
    );
  }

  const seats: Seats = new Map((st.seats ?? []).map((_, s) => [s, { name: seatName(s), color: GEMS[s % GEMS.length] }]));
  const board: Strip = g.active.map((s) => ({ seat: s, name: seatName(s), color: GEMS[s % GEMS.length], score: g.scores[s], me: s === who })).sort((a, b) => b.score - a.score);
  const mine = who != null && who === mySeat;
  const hand = mySeat != null ? g.hands[mySeat] : [];
  const pause = () => setMenu(true);
  const o = st.state;
  const wait = WAITS[g.phase];
  const waitBar = wait && o.deadline ? <WaitBar left={Math.max(0, o.deadline - server)} total={wait} mine={mine} /> : null;

  let body: React.ReactNode = null;
  if (g.phase === 'done') body = <T f={CD} size={22} color={VV.gold} style={{ textAlign: 'center', marginTop: u(120) }}>Final curtain…</T>;
  else if (g.phase === 'initiation' && who != null)
    body = mine ? (
      <CardWindow g={g} seat={who} seats={seats} board={board} onPlay={(p) => send({ type: 'PLAY', play: p })} onPass={() => send({ type: 'PASS' })} onPause={pause} />
    ) : (
      <Watching kicker={`${actName(g)} · Card window`} title={`${seatName(who)} is choosing`} line="Cards played on you show up here." board={board} hand={hand} onPause={pause} />
    );
  else if (g.phase === 'reaction' && g.chain)
    body =
      g.chain.holder === mySeat ? (
        <ReactWindow g={g} seats={seats} onReact={(choice, to) => send({ type: 'REACT', choice, to })} onPause={pause} />
      ) : (
        <Watching
          kicker={`${actName(g)} · ${CARD_INFO[g.chain.attack.card].name}`}
          title={`${CARD_INFO[g.chain.attack.card].name} incoming`}
          line={`${seatName(g.chain.attack.by)} played ${CARD_INFO[g.chain.attack.card].name} on ${seatName(g.chain.attack.target)}. ${seatName(g.chain.holder)} has ${ONLINE_MS.react / 1000} seconds to answer.`}
          card={g.chain.attack.card}
          board={board}
          hand={hand}
          onPause={pause}
        />
      );
  else if (g.phase === 'redemptionOffer' && who != null)
    body = mine ? (
      <RedemptionOffer seat={who} seats={seats} onPick={(use) => send({ type: 'REDEEM', use })} onPause={pause} />
    ) : (
      <Watching kicker="The World" title={`${seatName(who)} holds The World`} line="Last place may swap this turn for a Redemption round." card="world" board={board} hand={hand} onPause={pause} />
    );
  else if (g.phase === 'redemption' && g.redemption)
    body = (
      <RedemptionBoard
        g={g}
        now={server}
        seats={seats}
        watch={!mine}
        onEvent={(e) => send(e.type === 'GO' ? { type: 'GO' } : { type: 'CALL', value: e.value })}
        onPause={pause}
      />
    );
  else if (g.phase === 'turn' && g.turn && who != null)
    body = (
      <TurnBoard
        turn={g.turn}
        now={server}
        kicker={actName(g)}
        title={mine ? 'Your turn' : `${seatName(who)}’s turn`}
        strip={board}
        tray={hand}
        watch={!mine}
        footer={mine ? undefined : <T f={CM} size={12} color={VV.soft} style={{ textAlign: 'center' }}>{`${seatName(who)} is answering`}</T>}
        onEvent={(e: TurnEvent) => send(e.type === 'ANSWER' ? { type: 'ANSWER', answer: e.answer as Answer } : e.type === 'GO' || e.type === 'STAR' || e.type === 'KEEP' ? { type: e.type } : { type: 'TICK' })}
        onPause={pause}
      />
    );
  else if (g.phase === 'turnOver' && who != null) body = <TurnOver g={g} seat={who} seats={seats} board={board} />;
  else if (g.phase === 'boss' && g.boss)
    body = <OnlineBoss g={g} seat={mySeat} st={st} server={server} seatName={seatName} matchId={matchId} onDone={tick} onPause={pause} />;
  else if (g.phase === 'bossOver') body = <BossOver g={g} seats={seats} board={board} />;

  return (
    <>
      <VelvetScreen scroll={g.phase === 'initiation' || g.phase === 'turnOver' || g.phase === 'bossOver'}>
        {waitBar}
        {body}
        {extras}
      </VelvetScreen>
      <WheelsPause open={menu} mode="online" onResume={() => setMenu(false)} onQuit={leave} />
    </>
  );
}

/** How long the player whose move it is has left. */
function WaitBar({ left, total, mine }: { left: number; total: number; mine: boolean }) {
  return (
    <View style={{ gap: u(4), marginBottom: u(10) }}>
      <Bulbs frac={left / total} />
      <T f={CM} size={11} color={mine ? VV.gold : VV.dim} style={{ textAlign: 'right' }}>{`${Math.ceil(left / 1000)} s${mine ? ' to choose' : ''}`}</T>
    </View>
  );
}

/** Someone else's move: what is happening, the table, and my own cards (WC20). */
function Watching({ kicker, title, line, card, board, hand, onPause }: { kicker: string; title: string; line: string; card?: Card; board: Strip; hand: Card[]; onPause: () => void }) {
  return (
    <View style={{ gap: u(12) }}>
      <Top kicker={kicker} title={title} onPause={onPause} />
      {card ? (
        <View style={{ alignItems: 'center', paddingTop: u(4) }}>
          <CardArt card={card} w={u(88)} />
        </View>
      ) : null}
      <T size={13.5} color={VV.soft} style={{ textAlign: 'center' }}>{line}</T>
      <Board board={board} />
      {hand.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: u(10) }}>
          <T f={CM} size={12} color={VV.soft} style={{ flex: 1, alignSelf: 'center' }}>Your cards</T>
          {hand.map((c) => <CardArt key={c} card={c} w={u(34)} />)}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Boss Round, everyone at once (WC23)

function OnlineBoss({ g, seat, st, server, seatName, matchId, onDone, onPause }: {
  g: OfflineGame; seat: number | null; st: WState; server: number; seatName: (s: number) => string; matchId: string; onDone: () => void; onPause: () => void;
}) {
  const b = g.boss!;
  const [mine, setMine] = useState<boolean[]>(st.my_swipes ?? []);
  const mineRef = useRef(mine);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const key = `${g.cycle}`;
  useEffect(() => {
    mineRef.current = st.my_swipes ?? [];
    setMine(mineRef.current);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const playing = b.phase === 'playing' && seat != null;
  const deck = seat != null ? (b.decks[seat] ?? []) : [];
  const done = mine.length >= deck.length && deck.length > 0;
  const swipe = useCallback(
    (fits: boolean) => {
      const cur = mineRef.current;
      if (cur.length >= deck.length) return;
      const i = cur.length;
      mineRef.current = [...cur, fits];
      setMine(mineRef.current);
      // Sent one by one, in order, so the server keeps them in the same order as my deck.
      queue.current = queue.current.then(() => call('wc_swipe', { m: matchId, i, fits }).catch(() => {}));
    },
    [deck.length, matchId],
  );
  const swipeRef = useRef(swipe);
  swipeRef.current = swipe;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, d) => Math.abs(d.dx) > 12,
        onPanResponderRelease: (_, d) => {
          if (Math.abs(d.dx) > 60) swipeRef.current(d.dx > 0);
        },
      }),
    [],
  );
  // When I finish my deck, the round can close early once everyone has.
  useEffect(() => {
    if (done) queue.current.then(onDone);
  }, [done, onDone]);

  if (b.phase === 'ready' || !playing || done) {
    const others = g.active.filter((s) => s !== seat);
    const startsIn = b.phase === 'ready' && st.state?.deadline ? Math.max(0, Math.ceil((st.state.deadline - server) / 1000)) : null;
    return (
      <View style={{ gap: u(14) }}>
        <Top kicker={`Act ${ROMAN[g.cycle]} · Boss Round`} title={b.phase === 'ready' ? 'Everyone swipes at once' : done ? 'Deck done' : 'The Boss Round'} onPause={onPause} />
        <Bill>
          <T f={CM} size={10.5} color={VV.paperSoft} style={{ letterSpacing: u(2), textAlign: 'center' }}>{fieldName(b.field).toUpperCase()}</T>
          <T f={CD} size={19} color={VV.redInk} style={{ textAlign: 'center' }}>{b.category}</T>
          <Rule c="rgba(42,26,18,0.18)" />
          <T size={13} color={VV.paperInk} style={{ textAlign: 'center' }}>{`Swipe right if it belongs, left if it doesn’t. ${BOSS_MS / 1000} seconds. +${BOSS_RIGHT} for a right swipe, ${BOSS_WRONG} for a wrong one.`}</T>
          <T size={12} color={VV.paperSoft} style={{ textAlign: 'center' }}>{`Same items for everyone, each in their own order. Highest score wins +${BOSS_BONUS}.`}</T>
        </Bill>
        {startsIn != null ? <T f={CD} size={30} color={VV.gold} style={{ textAlign: 'center' }}>{String(startsIn)}</T> : null}
        {done && seat != null ? <T size={13} color={VV.soft} style={{ textAlign: 'center' }}>{`${bossPoints({ ...b, swipes: { [seat]: mine } }, seat)} points. Waiting for the others.`}</T> : null}
        {b.phase === 'playing' ? (
          <Panel>
            {others.map((s) => (
              <T key={s} size={12.5} color={VV.soft}>{`${seatName(s)}: ${st.swipes[String(s)] ?? 0} of ${b.items.length}`}</T>
            ))}
          </Panel>
        ) : null}
      </View>
    );
  }

  const item = b.items[deck[Math.min(mine.length, deck.length - 1)]];
  const left = b.until != null ? Math.max(0, b.until - server) : 0;
  return (
    <View style={{ flex: 1, gap: u(12) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(12) }}>
        <View style={{ flex: 1 }}>
          <Bulbs frac={left / BOSS_MS} />
        </View>
        <PauseBtn onPress={onPause} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T f={CM} size={12} color={VV.brass} style={{ letterSpacing: u(1), flexShrink: 1 }} lines={1}>{b.category.toUpperCase()}</T>
        <T f={CM} size={12} color={VV.soft} style={{ flexShrink: 0 }}>{`${bossPoints({ ...b, swipes: { [seat!]: mine } }, seat!)} pts`}</T>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', minHeight: u(240) }} {...pan.panHandlers}>
        <Bill style={{ marginHorizontal: u(20) }}>
          <View style={{ minHeight: u(150), alignItems: 'center', justifyContent: 'center', gap: u(8) }}>
            <T f={CM} size={10.5} color={VV.paperSoft} style={{ letterSpacing: u(2) }}>{`${mine.length + 1} OF ${b.items.length}`}</T>
            <T f={CD} size={20} color={VV.paperInk} style={{ textAlign: 'center' }}>{item.label}</T>
          </View>
        </Bill>
        <T size={11.5} color={VV.dim} style={{ textAlign: 'center', marginTop: u(10) }}>Swipe the card, or tap below.</T>
      </View>
      <View style={{ flexDirection: 'row', gap: u(10) }}>
        <Btn label="‹ Doesn’t fit" ghost onPress={() => swipe(false)} style={{ flex: 1 }} />
        <Btn label="Fits ›" onPress={() => swipe(true)} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
