// Imposter Online (IM2): everyone on their own phone. The server runs Yazan's engine (the imposter edge function) and
// hands each phone only its own view, so a phone never holds another player's word. Clues and the caught imposter's
// guess are typed; the vote is live and can change until it closes. This screen polls every second and sends my moves.
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Text, TextInput } from '@/components/AppText';
import { invoke, leaveRoom } from '@/online/api';
import { useBackPause } from '@/online/backPause';
import { finishOnline, useShowResults } from '@/online/finish';
import { settingsLine } from '@/online/format';
import { AlertPill, Countdown, useAlerts } from '@/online/live';
import { RoomTalk } from '@/online/TalkBar';
import { useMatchState } from '@/online/useMatchState';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { SEAT_COLOURS } from '../shell/characters';
import { PauseMenu } from '../shell/PauseMenu';
import type { OnlineProps } from '../shell/types';
import { Body, Btn, GameScreen, Kick } from '../shell/ui';
import { RULES } from './engine/constants';
import { BigClock, ClueList, DecisionButtons, Holder, IC, ImposterScreen, PlayerTiles, RoundResult, s as k, type Person } from './kit';
import type { ImView, Move } from './online';
import { roundOutcome } from './offline';

type IPlayer = { user_id: string; name: string; character: string; score: number; dropped: boolean; rank: number | null };
type IState = {
  now: number;
  room_id: string;
  phase: 'countdown' | 'case' | 'done';
  phase_ends_at: number;
  settings: Record<string, unknown>;
  players: IPlayer[];
  seats: string[] | null;
  me: string;
  version: number;
  due: number | null;
  view: ImView | null;
};

/** The screen only redraws when the whole seconds left change, or every tick once a wait has run out. */
function shownOf(sv: number, st: IState | null) {
  if (!st) return null;
  const end = st.view ? st.due : st.phase_ends_at;
  if (end == null) return st.version;
  if (sv >= end) return sv;
  return `${st.version}:${Math.ceil((end - sv) / 1000)}`;
}

export function OnlinePlay({ def, roomId, matchId, me }: OnlineProps) {
  const t = useTheme();
  const { st, load, server, notice, setNotice } = useMatchState<IState>('im_state', matchId, { tickMs: 250, shown: shownOf });
  const [menu, setMenu] = useState(false);
  useBackPause(menu, setMenu);
  const [text, setText] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const lastTick = useRef(0);
  const finishing = useRef(false);
  const showResults = useShowResults(def.key, matchId, st?.phase === 'done');
  const { alert, push } = useAlerts();

  const send = useCallback(
    async (move: Move) => {
      if (move.type !== 'TICK') setSending(true);
      try {
        const r = await invoke<{ result?: string; message?: string } | null>('imposter', { m: matchId, move });
        if (move.type !== 'TICK') {
          // A refused clue or guess says why (letters only, not your own word, a blocked word...).
          if (r?.result === 'refused' && (move.type === 'SUBMIT_CLUE' || move.type === 'SUBMIT_GUESS')) setRefusal(r.message ?? 'That word can’t be used.');
          else if (move.type === 'SUBMIT_CLUE' || move.type === 'SUBMIT_GUESS') {
            setRefusal(null);
            setText('');
          }
        }
      } catch {
        if (move.type !== 'TICK') setNotice('Couldn’t send that. Check your connection.');
      }
      if (move.type !== 'TICK') setSending(false);
      load();
    },
    [matchId, load, setNotice],
  );
  const tick = useCallback(() => {
    if (Date.now() - lastTick.current < 1200) return;
    lastTick.current = Date.now();
    send({ type: 'TICK' });
  }, [send]);

  const v = st?.view ?? null;
  const playing = !!st?.seats?.includes(me) && !st.players.find((p) => p.user_id === me)?.dropped;

  // The server moves on when a phone asks after a wait runs out: the host's phone first, the others a moment later in
  // case it has gone quiet. The first request after the countdown deals the first round.
  useEffect(() => {
    if (!st || st.phase === 'done') return;
    if (!v) {
      if (server >= st.phase_ends_at) tick();
      return;
    }
    if (st.due == null) return;
    if (server >= st.due + (v.hostId === me ? 0 : 2500)) tick();
  }, [server, st, v, me, tick]);

  // A fresh clue box for every new typing turn.
  const slotKey = v?.phase.kind === 'clue' ? `${v.roundNumber}:${v.phase.turn}:${v.phase.slot}` : v?.phase.kind ?? '';
  const [slotSeen, setSlotSeen] = useState(slotKey);
  if (slotSeen !== slotKey) {
    setSlotSeen(slotKey);
    setText('');
    setRefusal(null);
  }

  // The host hears when a player keeps trying blocked words (the engine's notice after 3 tries).
  const seenAlerts = useRef(new Set<number>());
  useEffect(() => {
    for (const a of v?.alerts ?? []) {
      if (seenAlerts.current.has(a.at)) continue;
      seenAlerts.current.add(a.at);
      push(a.text, IC.warn);
    }
  }, [v?.alerts, push]);

  const people: Person[] = useMemo(() => {
    const seats = st?.seats ?? [];
    return (v?.players ?? []).map((p) => ({ id: p.id, name: p.id === me ? `${p.name} (you)` : p.name, color: SEAT_COLOURS[Math.max(0, seats.indexOf(p.id)) % SEAT_COLOURS.length].color }));
  }, [v?.players, st?.seats, me]);
  const by = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  // The end: the server's places become an ordinary play on this phone (ON21). EXP is the points twice over, at most 60 (IM4).
  useEffect(() => {
    if (!st || st.phase !== 'done' || !playing || finishing.current || !st.seats || !v) return;
    finishing.current = true;
    (async () => {
      try {
        const seatsOf = st.seats!;
        const order = [me, ...seatsOf.filter((id) => id !== me)];
        const byId = new Map(st.players.map((p) => [p.user_id, p]));
        const seats = order.map((id, i) => ({ seat: i, userId: id, name: id === me ? 'You' : (byId.get(id)?.name ?? 'Player'), character: byId.get(id)?.character, color: SEAT_COLOURS[seatsOf.indexOf(id) % SEAT_COLOURS.length].color }));
        const standings = order
          .map((id, i) => ({ seat: i, name: seats[i].name, score: byId.get(id)?.score ?? 0, timeMs: 0, rank: byId.get(id)?.rank ?? order.length }))
          .sort((a, b) => a.rank - b.rank);
        const score = byId.get(me)?.score ?? 0;
        // One item per round I played; nothing feeds Learn (IM5).
        const items = v.history.map((sum) => ({
          seat: 0, itemId: sum.pairId, answerKey: null, outcome: roundOutcome(sum, me), answersGiven: [], timeMs: 0, hintsUsed: 0, revealsUsed: 0,
          points: sum.deltas[me] ?? 0, feedsLearn: false, gameData: { imposter: me === sum.imposterId, words: sum.words, category: sum.category, outcome: sum.outcome },
        }));
        const id = await finishOnline(def, matchId, { settings: { ...st.settings, room: roomId, match: matchId }, seats, standings, score, items });
        showResults(id);
      } catch {
        finishing.current = false; // the next poll tries again
      }
    })();
  }, [st, v, playing, me, def, roomId, matchId, showResults]);

  const leave = useCallback(async () => {
    await leaveRoom(roomId).catch(() => {});
    router.replace(`/play/${def.key}`);
  }, [roomId, def.key]);

  const meP = st?.players.find((p) => p.user_id === me);
  const talk = <RoomTalk room={roomId} me={{ id: me, name: meP?.name ?? 'You', face: meP?.character ?? 'yara' }} />;
  const extras = (
    <>
      <AlertPill alert={alert} />
      {notice ? (
        <View style={{ position: 'absolute', bottom: u(90), left: u(16), right: u(16), alignItems: 'center' }} pointerEvents="none">
          <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: u(10), padding: u(8) }}>
            <Text style={{ fontFamily: F.body, fontSize: u(12), color: '#fff' }}>{notice}</Text>
          </View>
        </View>
      ) : null}
    </>
  );

  if (!st) return <GameScreen scroll={false}>{null}</GameScreen>;
  if (!v || v.phase.kind === 'lobby') {
    return (
      <GameScreen scroll={false}>
        {st.phase === 'done' ? null : <Countdown ms={Math.max(0, st.phase_ends_at - server)} faces={st.players.map((p) => p.character)} ids={st.players.map((p) => p.user_id)} line={settingsLine(def, st.settings)} />}
        {extras}
      </GameScreen>
    );
  }

  const ph = v.phase;
  const left = st.due != null ? st.due - server : 0;
  const pause = () => setMenu(true);
  const host = v.hostId === me;
  const inRound = people.filter((p) => v.players.find((x) => x.id === p.id)?.connected);
  const mine = (id: string | null) => id === me;
  let body: ReactNode = null;
  let bottom: ReactNode = null;

  const myWord = v.myWord ? <MyWord word={v.myWord} /> : null;

  if (ph.kind === 'matchEnd') {
    body = (
      <View style={{ alignItems: 'center', gap: u(14), marginTop: u(80) }}>
        <Kick>Match over</Kick>
        <Text style={[k.name, { color: t.white }]}>{playing ? 'Counting the points…' : 'That’s the match.'}</Text>
        {playing ? null : <Btn label="Back to the room" onPress={() => router.replace(`/play/${def.key}/lobby?room=${roomId}`)} />}
      </View>
    );
  } else if (ph.kind === 'wordReveal') {
    body = (
      <>
        <View style={k.holder}>
          <Kick>Your word</Kick>
          <Text style={[k.name, { color: t.white, fontSize: u(36), lineHeight: u(42) }]} adjustsFontSizeToFit numberOfLines={2}>
            {v.myWord ?? '…'}
          </Text>
          <Text style={[k.sub, { color: t.mute }]}>{`Category: ${v.category ?? ''}. Someone has a different word, and they don't know it. It could be you.`}</Text>
        </View>
        <BigClock ms={left} warnAt={3_000} />
        <Body style={{ textAlign: 'center' }}>Remember it. The clues start when the clock runs out.</Body>
      </>
    );
  } else if (ph.kind === 'clue') {
    const typer = v.typingPlayerId;
    const typing = ph.stage === 'typing';
    const extra = ph.turn > RULES.obligatoryTurns;
    const head = <Kick>{extra ? 'Extra turn' : `Turn ${ph.turn} of ${RULES.obligatoryTurns}`}</Kick>;
    if (typing && mine(typer)) {
      body = (
        <>
          {myWord}
          <View style={k.holder}>
            {head}
            <Text style={[k.name, { color: t.accent }]}>Your clue</Text>
            <Text style={[k.sub, { color: t.mute }]}>One word, letters only, up to 15. Not your own word, and not a word already used this round.</Text>
          </View>
          <BigClock ms={left} warnAt={10_000} />
          <TextInput
            value={text}
            onChangeText={(x) => {
              setText(x);
              setRefusal(null);
            }}
            onSubmitEditing={() => text.trim() && !sending && send({ type: 'SUBMIT_CLUE', text })}
            maxLength={RULES.clueMaxLength}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="send"
            placeholder="Type one word"
            placeholderTextColor={t.dim}
            style={[{ borderColor: refusal ? IC.bad : t.panelLine, backgroundColor: t.panel, color: t.white }, inp]}
            accessibilityLabel="Your clue"
          />
          {refusal ? <Text style={[k.sub, { color: IC.bad }]}>{refusal}</Text> : null}
        </>
      );
      bottom = <Btn label={sending ? 'Sending…' : 'Send clue'} disabled={!text.trim() || sending} onPress={() => send({ type: 'SUBMIT_CLUE', text })} />;
    } else if (typing && typer) {
      body = (
        <>
          {myWord}
          <Holder lead={extra ? 'Extra turn' : `Turn ${ph.turn} of ${RULES.obligatoryTurns}`} person={by.get(typer) ?? { id: typer, name: '…' }} sub="is typing a clue" />
          <BigClock ms={left} warnAt={10_000} />
          {v.revealedClue ? null : <Body style={{ textAlign: 'center' }}>Each clue shows here for a moment, then the next player types.</Body>}
        </>
      );
    } else {
      const c = ph.reveal;
      const p = c ? by.get(c.playerId) : undefined;
      body = (
        <>
          {myWord}
          <View style={k.holder}>
            {head}
            <Text style={[k.sub, { color: p?.color ?? t.mute, fontFamily: F.bodySemi, fontSize: u(14) }]}>{p?.name ?? ''}</Text>
            <Text style={[k.name, { color: c?.text ? t.white : t.dim, fontSize: u(40), lineHeight: u(46) }]} adjustsFontSizeToFit numberOfLines={1}>
              {c?.text ?? '—'}
            </Text>
            {c && !c.text ? <Text style={[k.sub, { color: t.dim }]}>No clue in time</Text> : null}
          </View>
        </>
      );
    }
  } else if (ph.kind === 'decision') {
    body = (
      <>
        {myWord}
        <View style={k.holder}>
          <Kick>Two turns done</Kick>
          <Text style={[k.name, { color: t.white }]}>Vote now, or one more turn?</Text>
          <Text style={[k.sub, { color: t.mute }]}>Most answers win; a tie or no answer means one more turn. You can change your answer.</Text>
        </View>
        <BigClock ms={left} warnAt={3_000} />
        <Text style={[k.sub, { color: t.dim }]}>{`${v.decisionAnswered.length} of ${inRound.length} answered${v.decisionAnswered.includes(me) ? ' · yours is in' : ''}`}</Text>
        {v.lastTurnClues?.length ? <ClueList clues={v.lastTurnClues} people={people} /> : null}
      </>
    );
    bottom = playing ? <DecisionButtons onVote={() => send({ type: 'DECIDE', choice: 'vote' })} onExtra={() => send({ type: 'DECIDE', choice: 'extra' })} /> : null;
  } else if (ph.kind === 'vote') {
    const cands = v.candidates;
    const tallies: Record<string, number> = {};
    for (const x of Object.values(v.votes)) tallies[x] = (tallies[x] ?? 0) + 1;
    const myVote = v.votes[me];
    const closing = ph.allVotedAt != null;
    body = (
      <>
        {myWord}
        <View style={k.holder}>
          <Kick>{cands ? 'Revote' : 'Vote'}</Kick>
          <Text style={[k.name, { color: t.white }]}>Who is the imposter?</Text>
          <Text style={[k.sub, { color: t.mute }]}>
            {cands ? 'A tie. Vote again between the tied players.' : 'Talk it over and tap a player. Everyone sees the votes, and you can change yours until the vote closes.'}
          </Text>
        </View>
        <BigClock ms={left} warnAt={closing ? 5_000 : 10_000} />
        {closing ? <Text style={[k.sub, { color: IC.warn }]}>Everyone has voted. The vote closes when the clock runs out.</Text> : null}
        <PlayerTiles
          people={inRound}
          votes={tallies}
          pickable={(id) => playing && id !== me && (!cands || cands.includes(id))}
          onPick={playing ? (id) => send({ type: 'CAST_VOTE', target: id }) : undefined}
          mark={myVote ? { [myVote]: '✓' } : undefined}
        />
        {v.lastTurnClues?.length ? <ClueList clues={v.lastTurnClues} people={people} /> : null}
      </>
    );
  } else if (ph.kind === 'redemption') {
    const caught = v.caught ? by.get(v.caught) : undefined;
    if (mine(v.caught)) {
      body = (
        <>
          {myWord}
          <View style={k.holder}>
            <Kick color={IC.bad}>Caught</Kick>
            <Text style={[k.name, { color: t.white }]}>You were the imposter</Text>
            <Text style={[k.sub, { color: t.mute }]}>Guess everyone else&apos;s word for 1 point. One try.</Text>
          </View>
          <BigClock ms={left} warnAt={5_000} />
          <TextInput
            value={text}
            onChangeText={(x) => {
              setText(x);
              setRefusal(null);
            }}
            onSubmitEditing={() => text.trim() && !sending && send({ type: 'SUBMIT_GUESS', text })}
            maxLength={40}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="send"
            placeholder="Their word"
            placeholderTextColor={t.dim}
            style={[{ borderColor: refusal ? IC.bad : t.panelLine, backgroundColor: t.panel, color: t.white }, inp]}
            accessibilityLabel="Your guess"
          />
          {refusal ? <Text style={[k.sub, { color: IC.bad }]}>{refusal}</Text> : null}
        </>
      );
      bottom = <Btn label={sending ? 'Sending…' : 'Send guess'} disabled={!text.trim() || sending} onPress={() => send({ type: 'SUBMIT_GUESS', text })} />;
    } else {
      body = (
        <>
          {myWord}
          <Holder lead="Caught" person={caught ?? { id: '', name: '…' }} sub="was the imposter. They have one try to guess your word." />
          <BigClock ms={left} warnAt={5_000} />
        </>
      );
    }
  } else if (ph.kind === 'roundResult') {
    const last = v.roundNumber >= (v.totalRounds ?? 1);
    body = <RoundResult sum={ph.summary} people={people} totals={v.players.map((p) => ({ id: p.id, score: p.score ?? 0 }))} />;
    bottom = host ? (
      <Btn label={last ? 'See results' : 'Next round'} onPress={() => send({ type: 'NEXT_ROUND' })} />
    ) : (
      <Text style={[k.sub, { color: t.dim }]}>{`${last ? 'Results' : 'Next round'} in ${Math.max(0, Math.ceil(left / 1000))} s`}</Text>
    );
  }

  // The talk button steps aside while I type, so it never covers the box.
  const typingNow = (ph.kind === 'clue' && ph.stage === 'typing' && mine(v.typingPlayerId)) || (ph.kind === 'redemption' && mine(v.caught));
  const showCat = ph.kind !== 'roundResult' && ph.kind !== 'matchEnd';
  return (
    <ImposterScreen round={Math.max(1, v.roundNumber)} rounds={v.totalRounds ?? 1} category={showCat ? v.category : null} onPause={pause} bottom={bottom}>
      {body}
      {extras}
      {typingNow ? null : talk}
      <PauseMenu open={menu} mode="online" onResume={() => setMenu(false)} onQuit={leave} />
    </ImposterScreen>
  );
}

/** My own word, small, on every screen of the round (online it is only ever on my phone). */
function MyWord({ word }: { word: string }) {
  const t = useTheme();
  return (
    <View style={{ alignSelf: 'center', flexDirection: 'row', gap: u(6), paddingHorizontal: u(12), paddingVertical: u(5), borderRadius: u(12), borderWidth: 1, borderColor: t.chipLine, backgroundColor: t.chip }}>
      <Text style={{ fontFamily: F.mono, fontSize: u(9.5), color: t.dim, letterSpacing: u(1) }}>YOUR WORD</Text>
      <Text style={{ fontFamily: F.bodyBold, fontSize: u(11.5), color: t.white }}>{word}</Text>
    </View>
  );
}

const inp = { borderWidth: 1, borderRadius: u(14), paddingHorizontal: u(14), paddingVertical: u(12), fontFamily: F.bodySemi, fontSize: u(16) };
