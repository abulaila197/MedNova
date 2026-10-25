// Code Clinic Online (CC1): everyone on their own phone. The server runs Yazan's room rules (the code-clinic edge
// function) and hands each phone only its own view, so only the two spymasters' phones ever hold the key. Teams and
// spymasters are picked on the first screen, as in his lobby. This screen polls every second and sends my moves.
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text, TextInput } from '@/components/AppText';
import { invoke, leaveRoom } from '@/online/api';
import { useBackPause } from '@/online/backPause';
import { finishOnline, useShowResults } from '@/online/finish';
import { settingsLine } from '@/online/format';
import { Countdown } from '@/online/live';
import { RoomTalk } from '@/online/TalkBar';
import { useMatchState } from '@/online/useMatchState';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { tapped } from '@/lib/sound';

import { SEAT_COLOURS } from '../shell/characters';
import { PauseMenu } from '../shell/PauseMenu';
import type { OnlineProps } from '../shell/types';
import { Body, Btn, Card as Panel, Chips, GameScreen, Ghost, Kick } from '../shell/ui';
import { checkClue } from './engine/clueCheck';
import type { Card, ClueNumber, StyleChoice, Team } from './engine/types';
import { Board, ClinicScreen, Clock, clueText, KeyLegend, NumberPick, TEAM, TeamHead, s as k } from './kit';
import type { CcView, Move } from './online';
import { playEffects } from './offline';

type CPlayer = { user_id: string; name: string; character: string; score: number; dropped: boolean; rank: number | null };
type CState = {
  now: number;
  room_id: string;
  phase: 'countdown' | 'case' | 'done';
  phase_ends_at: number;
  settings: Record<string, unknown>;
  players: CPlayer[];
  seats: string[] | null;
  me: string;
  version: number;
  due: number | null;
  view: CcView | null;
};

const STYLES: { value: StyleChoice; label: string }[] = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'clinical', label: 'Clinical' },
  { value: 'basic', label: 'Basic science' },
];

const reason = (why: string | null, w: Team) => {
  const l: Team = w === 'red' ? 'blue' : 'red';
  return why === 'assassin' ? `The ${TEAM[l].name} team touched the deadly card.` : why === 'forfeit' ? `The ${TEAM[l].name} team has nobody left.` : `The ${TEAM[w].name} team found all their cards.`;
};

/** The screen only redraws when the whole seconds left change, or every tick once a wait has run out. */
function shownOf(sv: number, st: CState | null) {
  if (!st) return null;
  const end = st.view ? st.due : st.phase_ends_at;
  if (end == null) return st.version;
  if (sv >= end) return sv;
  return `${st.version}:${Math.ceil((end - sv) / 1000)}`;
}

export function OnlinePlay({ def, roomId, matchId, me }: OnlineProps) {
  const t = useTheme();
  const { st, load, server, notice, setNotice } = useMatchState<CState>('cc_state', matchId, { tickMs: 250, shown: shownOf });
  const [menu, setMenu] = useState(false);
  useBackPause(menu, setMenu);
  const [word, setWord] = useState('');
  const [num, setNum] = useState<ClueNumber | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const lastTick = useRef(0);
  const finishing = useRef(false);
  const showResults = useShowResults(def.key, matchId, st?.phase === 'done');

  const send = useCallback(
    async (move: Move) => {
      if (move.type !== 'TICK') setSending(true);
      try {
        const r = await invoke<{ result?: string; message?: string } | null>('code-clinic', { m: matchId, move });
        if (move.type !== 'TICK') {
          if (r?.result === 'refused') setRefusal(r.message ?? 'That can’t be done now.');
          else {
            setRefusal(null);
            if (move.type === 'CLUE') setWord('');
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
  const g = v?.game ?? null;
  const playing = !!st?.seats?.includes(me) && !st.players.find((p) => p.user_id === me)?.dropped;

  // The server moves on when a phone asks after a wait runs out: the host's phone first, the others a moment later.
  useEffect(() => {
    if (!st || st.phase === 'done') return;
    if (!v) {
      if (server >= st.phase_ends_at) tick();
      return;
    }
    if (st.due == null) return;
    if (server >= st.due + (v.hostId === me ? 0 : 2500)) tick();
  }, [server, st, v, me, tick]);

  // Sounds when a card turns or the turn changes, heard on every phone at the same moment.
  const logLen = g?.log.length ?? 0;
  const [heard, setHeard] = useState(logLen);
  if (heard !== logLen) {
    setHeard(logLen);
    const last = g?.log[logLen - 1];
    if (g && last && logLen > heard) {
      const fx: { type: string; id?: string; code?: string }[] = [];
      if (g.phase === 'over') fx.push({ type: 'sound', id: 'win' });
      else if (last.kind === 'guess') fx.push({ type: 'sound', id: last.color === g.turn ? 'correct' : last.color === 'neutral' ? 'neutral' : 'wrong' });
      else if (last.kind === 'timeout') fx.push({ type: 'notice', code: 'GUESS_TIMEOUT' });
      else if (last.kind === 'clue') fx.push({ type: 'sound', id: 'clue' });
      playEffects(fx);
    }
  }

  // A new turn clears the clue box.
  const turnKey = `${g?.turnNumber}-${g?.phase}`;
  const [seenTurn, setSeenTurn] = useState(turnKey);
  if (seenTurn !== turnKey) {
    setSeenTurn(turnKey);
    setWord('');
    setNum(null);
    setRefusal(null);
  }

  // The end: the server's places become an ordinary play on this phone (ON21). One item per game played (CC3: nothing to Learn).
  useEffect(() => {
    if (!st || st.phase !== 'done' || !playing || finishing.current || !st.seats || !v) return;
    finishing.current = true;
    (async () => {
      try {
        const seatsOf = st.seats!;
        const order = [me, ...seatsOf.filter((id) => id !== me)];
        const byId = new Map(st.players.map((p) => [p.user_id, p]));
        const seats = order.map((id, i) => ({
          seat: i,
          userId: id,
          name: id === me ? 'You' : (byId.get(id)?.name ?? 'Player'),
          character: byId.get(id)?.character,
          color: SEAT_COLOURS[seatsOf.indexOf(id) % SEAT_COLOURS.length].color,
        }));
        const standings = order
          .map((id, i) => ({ seat: i, name: seats[i].name, score: byId.get(id)?.score ?? 0, timeMs: 0, rank: byId.get(id)?.rank ?? order.length }))
          .sort((a, b) => a.rank - b.rank);
        const items = v.played
          .filter((x) => x.teams[me])
          .map((x, i) => ({
            seat: 0,
            itemId: `${matchId}-${i}`,
            answerKey: null,
            outcome: x.teams[me] === x.winner ? ('right' as const) : ('wrong' as const),
            answersGiven: [],
            timeMs: 0,
            hintsUsed: 0,
            revealsUsed: 0,
            points: x.teams[me] === x.winner ? 1 : 0,
            feedsLearn: false,
            gameData: { team: x.teams[me], winner: x.winner, reason: x.reason, spymaster: x.spymasters.includes(me), turns: x.turns },
          }));
        const id = await finishOnline(def, matchId, { settings: { ...st.settings, room: roomId, match: matchId }, seats, standings, score: byId.get(me)?.score ?? 0, items });
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
  const extras = notice ? (
    <View style={{ position: 'absolute', bottom: u(90), left: u(16), right: u(16), alignItems: 'center' }} pointerEvents="none">
      <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: u(10), padding: u(8) }}>
        <Text style={{ fontFamily: F.body, fontSize: u(12), color: '#fff' }}>{notice}</Text>
      </View>
    </View>
  ) : null;

  if (!st) return <GameScreen scroll={false}>{null}</GameScreen>;
  if (!v || st.phase === 'done' || v.ended) {
    return (
      <GameScreen scroll={false}>
        {st.phase === 'done' || v?.ended ? (
          <View style={{ alignItems: 'center', gap: u(14), marginTop: u(80) }}>
            <Kick>Match over</Kick>
            <Text style={[k.headT, { color: t.white }]}>{playing ? 'Counting the games…' : 'That’s the match.'}</Text>
            {playing ? null : <Btn label="Back to the room" onPress={() => router.replace(`/play/${def.key}/lobby?room=${roomId}`)} />}
          </View>
        ) : (
          <Countdown ms={Math.max(0, st.phase_ends_at - server)} faces={st.players.map((p) => p.character)} ids={st.players.map((p) => p.user_id)} line={settingsLine(def, st.settings)} />
        )}
        {extras}
      </GameScreen>
    );
  }

  const host = v.hostId === me;
  const mine = v.players.find((p) => p.id === me);
  const myTeam = mine?.team ?? null;
  const spy = !!mine?.isSpymaster;
  const nameOf = (id: string) => (id === me ? 'You' : (v.players.find((p) => p.id === id)?.name ?? 'Player'));
  const pause = () => setMenu(true);
  let body: ReactNode = null;
  let bottom: ReactNode = null;

  if (v.phase === 'lobby') {
    const live = v.players.filter((p) => !p.left);
    body = (
      <>
        <View style={k.head}>
          <Kick>{v.played.length ? `Game ${v.played.length + 1}` : 'Before you start'}</Kick>
          <Text style={[k.headT, { color: t.white }]}>Pick your team</Text>
          <Text style={[k.sub, { color: t.mute }]}>
            2 or 3 players a team. Each team needs one spymaster: claim it, or the host picks one{host ? ' (tap a name)' : ''}. A team without one gets one at the start.
          </Text>
        </View>
        {(['red', 'blue'] as const).map((team) => (
          <Panel key={team} style={{ borderColor: TEAM[team].color }}>
            <View style={k.row}>
              <View style={{ flex: 1 }}>
                <Kick color={TEAM[team].color}>{`${TEAM[team].name} team`}</Kick>
              </View>
              {playing && myTeam !== team ? <SmallBtn label="Join" color={TEAM[team].color} onPress={() => send({ type: 'SET_TEAM', team })} /> : null}
            </View>
            {live
              .filter((p) => p.team === team)
              .map((p) => (
                <Pressable
                  key={p.id}
                  disabled={!host}
                  onPress={tapped(() => send({ type: 'ASSIGN_SPYMASTER', playerId: p.id }))}
                  style={k.row}
                  accessibilityRole="button"
                  accessibilityLabel={`Make ${p.name} spymaster`}
                >
                  <Text style={{ fontSize: u(14), lineHeight: u(18), color: p.isSpymaster ? TEAM[team].color : t.dim }}>{p.isSpymaster ? '★' : '·'}</Text>
                  <Text style={[k.rowN, { color: t.fg }]} numberOfLines={1}>
                    {p.id === me ? `${p.name} (you)` : p.name}
                  </Text>
                  <Text style={[k.tag, { color: p.isSpymaster ? TEAM[team].color : t.dim }]}>{p.isSpymaster ? 'SPYMASTER' : 'GUESSER'}</Text>
                </Pressable>
              ))}
          </Panel>
        ))}
        {live.some((p) => !p.team) ? (
          <Text style={[k.sub, { color: t.dim }]}>{`No team yet: ${live
            .filter((p) => !p.team)
            .map((p) => nameOf(p.id))
            .join(', ')}`}</Text>
        ) : null}
        {myTeam && playing ? (
          spy ? (
            <Ghost label="Step down as spymaster" onPress={() => send({ type: 'RELEASE_SPYMASTER' })} />
          ) : (
            <Ghost label="Be the spymaster" onPress={() => send({ type: 'CLAIM_SPYMASTER' })} />
          )
        ) : null}
        {host ? (
          <View style={{ gap: u(6), marginTop: u(6) }}>
            <Kick>Words</Kick>
            <Chips choices={STYLES} value={v.style} onChange={(x) => send({ type: 'SET_STYLE', style: x })} />
          </View>
        ) : null}
        {refusal ? <Text style={[k.sub, { color: '#f0b54a' }]}>{refusal}</Text> : null}
      </>
    );
    bottom = host ? (
      <View style={{ gap: u(8) }}>
        {v.start.ok ? null : <Text style={[k.sub, { color: t.dim }]}>{v.start.message}</Text>}
        <Btn label="Deal the board" disabled={!v.start.ok || sending} onPress={() => send({ type: 'START' })} />
        {v.played.length ? <Ghost label="End the match" onPress={() => send({ type: 'FINISH' })} /> : null}
      </View>
    ) : (
      <Text style={[k.sub, { color: t.dim }]}>The host deals the board when the teams are ready.</Text>
    );
  } else if (g) {
    const cards: Card[] = g.cards.map((c) => ({ index: c.index, termId: 0, term: c.term, revealed: c.revealed, color: v.key?.[c.index] ?? c.color ?? 'neutral' }));
    const team = g.turn;
    const left = st.due != null ? st.due - server : 0;
    const myTurn = myTeam === team && playing;
    const role = myTeam ? `You are ${spy ? 'the spymaster' : 'a guesser'} for ${TEAM[myTeam].name}` : 'You are watching';
    const roleLine = <Text style={[k.tag, { color: myTeam ? TEAM[myTeam].color : t.dim, textAlign: 'center', marginTop: u(4) }]}>{role.toUpperCase()}</Text>;
    if (g.phase === 'over' || v.phase === 'finished') {
      const w = g.winner!;
      const wins = (id: string) => v.played.filter((x) => x.teams[id] === x.winner).length;
      body = (
        <>
          <TeamHead team={w} lead="Winner" sub={reason(g.winReason, w)} />
          <Board cards={cards} showKey fade />
          <KeyLegend />
          <Panel>
            <Kick>Games won</Kick>
            {[...v.players]
              .filter((p) => !p.left)
              .sort((a, b) => wins(b.id) - wins(a.id))
              .map((p) => (
                <View key={p.id} style={k.row}>
                  <View style={[k.dot, { backgroundColor: p.team ? TEAM[p.team].color : t.soft }]} />
                  <Text style={[k.rowN, { color: t.fg }]}>{nameOf(p.id)}</Text>
                  <Text style={[k.tag, { color: t.white }]}>{wins(p.id)}</Text>
                </View>
              ))}
          </Panel>
          {refusal ? <Text style={[k.sub, { color: '#f0b54a' }]}>{refusal}</Text> : null}
        </>
      );
      bottom = host ? (
        <View style={{ gap: u(8) }}>
          <Btn label="Rematch: new spymasters" disabled={sending} onPress={() => send({ type: 'REMATCH' })} />
          <View style={{ flexDirection: 'row', gap: u(8) }}>
            <Ghost style={{ flex: 1 }} label="New teams" onPress={() => send({ type: 'BACK_TO_LOBBY' })} />
            <Ghost style={{ flex: 1 }} label="End the match" onPress={() => send({ type: 'FINISH' })} />
          </View>
        </View>
      ) : (
        <Text style={[k.sub, { color: t.dim }]}>The host picks a rematch, new teams, or the end of the match.</Text>
      );
    } else if (g.phase === 'clue') {
      const giving = myTurn && spy;
      const check = word.trim()
        ? checkClue(
            word,
            g.cards.filter((c) => !c.revealed).map((c) => c.term),
          )
        : null;
      body = (
        <>
          <TeamHead
            team={team}
            lead={giving ? 'Your clue' : `${TEAM[team].name} spymaster is thinking`}
            sub={giving ? 'One word, and how many of your cards it points to. Not a word on the board, or part of one.' : undefined}
          />
          {roleLine}
          <Clock ms={left} />
          <Board cards={cards} showKey={!!v.key} />
          {v.key ? <KeyLegend colors={v.key} /> : null}
          {giving ? (
            <>
              <TextInput
                value={word}
                onChangeText={(x) => {
                  setWord(x);
                  setRefusal(null);
                }}
                maxLength={30}
                autoCorrect={false}
                autoCapitalize="none"
                placeholder="Your one-word clue"
                placeholderTextColor={t.dim}
                style={[{ borderColor: check && !check.ok ? '#ff5c6c' : t.panelLine, backgroundColor: t.panel, color: t.white }, inp]}
                accessibilityLabel="Your clue"
              />
              {check && !check.ok ? <Text style={[k.sub, { color: '#ff5c6c' }]}>{check.message}</Text> : refusal ? <Text style={[k.sub, { color: '#ff5c6c' }]}>{refusal}</Text> : null}
              <NumberPick value={num} onPick={setNum} team={team} />
            </>
          ) : null}
        </>
      );
      bottom = giving ? (
        <Btn
          label={sending ? 'Sending…' : num == null ? 'Pick the number' : `Give the clue for ${clueText(num)}`}
          disabled={sending || num == null || !check?.ok}
          onPress={() => num != null && send({ type: 'CLUE', word: word.trim(), number: num })}
        />
      ) : null;
    } else if (g.phase === 'guess' && g.clue) {
      const c = g.clue;
      const guessing = myTurn && !spy;
      body = (
        <>
          <View style={k.head}>
            <Kick>{`${TEAM[team].name} clue · ${c.guessesLeft == null ? 'no limit' : `${c.guessesLeft} ${c.guessesLeft === 1 ? 'guess' : 'guesses'} left`}`}</Kick>
            <Text style={[k.headT, { color: TEAM[team].color }]} numberOfLines={1}>{`${c.word ?? ''} · ${clueText(c.number)}`}</Text>
            {guessing ? <Text style={[k.sub, { color: t.mute }]}>Tap a card to mark it for your team. Tap the marked card again to turn it over.</Text> : null}
          </View>
          {roleLine}
          <Clock ms={left} />
          <Board cards={cards} showKey={!!v.key} marked={g.marker} onTap={guessing ? (i) => send(g.marker === i ? { type: 'CONFIRM', cardIndex: i } : { type: 'MARK', cardIndex: i }) : undefined} />
          {v.key ? <KeyLegend colors={v.key} /> : null}
          {refusal ? <Text style={[k.sub, { color: '#f0b54a' }]}>{refusal}</Text> : null}
        </>
      );
      bottom = guessing ? <Ghost label={c.guesses >= 1 ? 'End the turn' : 'Make at least one guess'} onPress={c.guesses >= 1 ? () => send({ type: 'END_TURN' }) : undefined} /> : null;
    }
  } else {
    body = <Body style={{ textAlign: 'center', marginTop: u(40) }}>Dealing the board…</Body>;
  }

  return (
    <ClinicScreen turn={v.phase === 'playing' ? (g?.turn ?? null) : null} remaining={g?.remaining ?? { red: 9, blue: 8 }} onPause={pause} bottom={bottom}>
      {body}
      {extras}
      {v.phase === 'playing' && g?.phase === 'clue' && spy ? null : talk}
      <PauseMenu open={menu} mode="online" onResume={() => setMenu(false)} onQuit={leave} />
    </ClinicScreen>
  );
}

function SmallBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={tapped(onPress)}
      style={{ borderWidth: 1, borderColor: color, borderRadius: u(10), paddingHorizontal: u(12), paddingVertical: u(4) }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={{ fontFamily: F.bodyBold, fontSize: u(11), color }}>{label}</Text>
    </Pressable>
  );
}

const inp = { borderWidth: 1, borderRadius: u(14), paddingHorizontal: u(14), paddingVertical: u(12), fontFamily: F.bodySemi, fontSize: u(16), marginTop: u(12) };
