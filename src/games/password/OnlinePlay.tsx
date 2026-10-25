// Nova Password Online: everyone on their own phone, both teams at once. The server runs Yazan's rules (the
// nova-password edge function) and hands each phone only its own view, so only the clue givers' phones ever hold the
// secret terms. The guesser picks from the whole term list. This screen polls every second and sends my moves.
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
import { sfx, tapped } from '@/lib/sound';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { SEAT_COLOURS } from '../shell/characters';
import { PauseMenu } from '../shell/PauseMenu';
import type { OnlineProps } from '../shell/types';
import { Body, Btn, Card as Panel, Chips, GameScreen, Ghost, Kick } from '../shell/ui';
import { validateClue } from './engine/clues';
import type { LobbyIntent } from './engine/lobby';
import { searchTerms } from './engine/terms';
import type { BankChoice, TeamId } from './engine/types';
import { Clock, clock, PasswordScreen, Plate, ResultRow, ShowBtn, TEAM, TeamHead, s as k } from './kit';
import { TERMS, termOf } from './offline';
import { clueWhy, startWhy, type Move, type PwView } from './online';

type PPlayer = { user_id: string; name: string; character: string; score: number; dropped: boolean; rank: number | null };
type PState = {
  now: number;
  room_id: string;
  phase: 'countdown' | 'case' | 'done';
  phase_ends_at: number;
  settings: Record<string, unknown>;
  players: PPlayer[];
  seats: string[] | null;
  me: string;
  version: number;
  due: number | null;
  view: PwView | null;
};

const BANKS: { value: BankChoice; label: string }[] = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'clinical', label: 'Clinical' },
  { value: 'basic', label: 'Basic science' },
];
const CATEGORY: Record<string, string> = { sign: 'sign or symptom', procedure: 'procedure or test' };
const other = (t: TeamId): TeamId => (t === 'A' ? 'B' : 'A');

/** The screen only redraws when the whole seconds left change, or every tick once a wait has run out. */
function shownOf(sv: number, st: PState | null) {
  if (!st) return null;
  const end = st.view ? st.due : st.phase_ends_at;
  if (end == null) return st.version;
  if (sv >= end) return sv;
  return `${st.version}:${Math.ceil((end - sv) / 1000)}`;
}

export function OnlinePlay({ def, roomId, matchId, me }: OnlineProps) {
  const t = useTheme();
  const { st, load, server, notice, setNotice } = useMatchState<PState>('pw_state', matchId, { tickMs: 250, shown: shownOf });
  const [menu, setMenu] = useState(false);
  useBackPause(menu, setMenu);
  const [clue, setClue] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const lastTick = useRef(0);
  const finishing = useRef(false);
  const showResults = useShowResults(def.key, matchId, st?.phase === 'done');

  const send = useCallback(
    async (move: Move, quiet = false) => {
      if (move.type !== 'TICK' && !quiet) setSending(true);
      let ok = true;
      try {
        const r = await invoke<{ result?: string; message?: string } | null>('nova-password', { m: matchId, move });
        if (move.type !== 'TICK') {
          if (r?.result === 'refused') {
            ok = false;
            setRefusal(r.message ?? 'That can’t be done now.');
          } else setRefusal(null);
        }
      } catch {
        ok = false;
        if (move.type !== 'TICK') setNotice('Couldn’t send that. Check your connection.');
      }
      if (move.type !== 'TICK' && !quiet) setSending(false);
      if (!quiet) load();
      return ok;
    },
    [matchId, load, setNotice],
  );
  const lobby = (intent: LobbyIntent) => send({ type: 'LOBBY', intent });
  const tick = useCallback(() => {
    if (Date.now() - lastTick.current < 1200) return;
    lastTick.current = Date.now();
    send({ type: 'TICK' });
  }, [send]);

  const v = st?.view ?? null;
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

  // Sounds: a ding when my team gets a word, the buzzer at the end of a round.
  const mineDone = v?.me && v.teams ? v.teams[v.me.team].completed : 0;
  const [heardDone, setHeardDone] = useState(mineDone);
  if (heardDone !== mineDone) {
    setHeardDone(mineDone);
    if (mineDone > heardDone) void sfx('right');
  }
  const wrongs = v?.guesses.length ?? 0;
  const [heardWrong, setHeardWrong] = useState(wrongs);
  if (heardWrong !== wrongs) {
    setHeardWrong(wrongs);
    if (wrongs > heardWrong) void sfx('wrong');
  }
  const phaseKey = `${v?.phase}-${v?.round}`;
  const [seenPhase, setSeenPhase] = useState(phaseKey);
  if (seenPhase !== phaseKey) {
    setSeenPhase(phaseKey);
    setClue('');
    setQuery('');
    setRefusal(null);
    if (v?.phase === 'roundEnd') void sfx('timeup');
  }

  // The end: the server's places become an ordinary play on this phone (ON21). One item per game (nothing to Learn).
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
          .map((x, i) => {
            const team = x.teams[me];
            const won = x.winner === team;
            return {
              seat: 0,
              itemId: `${matchId}-${i}`,
              answerKey: null,
              outcome: won ? ('right' as const) : x.winner === 'draw' ? ('skipped' as const) : ('wrong' as const),
              answersGiven: [],
              timeMs: x.totals[team].timeMs,
              hintsUsed: 0,
              revealsUsed: 0,
              points: won ? 1 : 0,
              feedsLearn: false,
              gameData: { team, winner: x.winner, forfeit: x.forfeited.includes(me), totals: x.totals, rounds: x.rounds.length },
            };
          });
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
  const nameOf = (id: string) => (id === me ? 'You' : (v.players.find((p) => p.id === id)?.name ?? 'Player'));
  const teamOf = (id: string) => v.players.find((p) => p.id === id)?.team ?? null;
  const rounds = v.settings.rounds;
  const roundName = (r: number) => (rounds === 2 ? `Round ${r + 1} of 2` : 'The round');
  const pills: Record<TeamId, string> = {
    A: v.teams ? `${v.teams.A.completed}/${v.teams.A.total}` : '–',
    B: v.teams ? `${v.teams.B.completed}/${v.teams.B.total}` : '–',
  };
  let body: ReactNode = null;
  let bottom: ReactNode = null;
  const warn = refusal ? <Text style={[k.sub, { color: '#f0b54a', marginTop: u(6) }]}>{refusal}</Text> : null;

  // Swap two players between the teams (the host taps one name, then one on the other team).
  const pick = async (id: string) => {
    if (!host) return;
    if (!picked || picked === id) return setPicked(picked === id ? null : id);
    const a = teamOf(picked);
    const b = teamOf(id);
    if (a === b) return setPicked(id);
    const first = picked;
    setPicked(null);
    setSending(true);
    if (await send({ type: 'LOBBY', intent: { type: 'ASSIGN', playerId: first, team: null } }, true)) {
      await send({ type: 'LOBBY', intent: { type: 'ASSIGN', playerId: id, team: a } }, true);
      await send({ type: 'LOBBY', intent: { type: 'ASSIGN', playerId: first, team: b } }, true);
    }
    setSending(false);
    load();
  };

  if (v.phase === 'lobby') {
    body = (
      <>
        <View style={k.head}>
          <Kick>{v.played.length ? `Game ${v.played.length + 1}` : 'Before you start'}</Kick>
          <Text style={[k.headT, { color: t.white }]}>The teams</Text>
          <Text style={[k.sub, { color: t.mute }]}>
            {host
              ? 'Tap a name, then a name on the other team, to swap them. The star picks who gives clues first; roles swap in round 2.'
              : 'The host sets the teams and who gives clues first. Roles swap in round 2.'}
          </Text>
        </View>
        {(['A', 'B'] as const).map((team) => (
          <Panel key={team} style={{ borderColor: TEAM[team].color }}>
            <Kick color={TEAM[team].color}>{`${TEAM[team].name} team`}</Kick>
            {v.players
              .filter((p) => p.team === team && !p.left)
              .map((p) => {
                const giver = v.givers[team] === p.id;
                return (
                  <View key={p.id} style={[k.row, picked === p.id && { backgroundColor: TEAM[team].deep, borderRadius: u(8) }]}>
                    <Pressable
                      disabled={!host}
                      onPress={tapped(() => lobby({ type: 'SET_GIVER', team, playerId: p.id }))}
                      accessibilityRole="button"
                      accessibilityLabel={`Make ${p.name} the clue giver`}
                      hitSlop={8}
                    >
                      <Text style={{ fontSize: u(16), lineHeight: u(20), color: giver ? TEAM[team].color : t.dim }}>{giver ? '★' : '☆'}</Text>
                    </Pressable>
                    <Pressable style={{ flex: 1 }} disabled={!host} onPress={tapped(() => pick(p.id))} accessibilityRole="button" accessibilityLabel={`Swap ${p.name}`}>
                      <Text style={[k.rowN, { color: t.fg }]} numberOfLines={1}>
                        {p.id === me ? `${p.name} (you)` : p.name}
                      </Text>
                    </Pressable>
                    <Text style={[k.tag, { color: giver ? TEAM[team].color : t.dim }]}>{giver ? 'GIVES CLUES' : 'GUESSES'}</Text>
                  </View>
                );
              })}
          </Panel>
        ))}
        {host ? (
          <View style={{ gap: u(6), marginTop: u(6) }}>
            <Kick>Words</Kick>
            <Chips choices={BANKS} value={v.settings.bank} onChange={(x) => lobby({ type: 'SET_SETTINGS', settings: { bank: x } })} />
            <Kick>Words per team</Kick>
            <Chips
              choices={[
                { value: 5, label: '5' },
                { value: 10, label: '10' },
              ]}
              value={v.settings.wordsPerTeam}
              onChange={(x) => lobby({ type: 'SET_SETTINGS', settings: { wordsPerTeam: x as 5 | 10 } })}
            />
            <Kick>Rounds</Kick>
            <Chips
              choices={[
                { value: 1, label: '1' },
                { value: 2, label: '2' },
              ]}
              value={v.settings.rounds}
              onChange={(x) => lobby({ type: 'SET_SETTINGS', settings: { rounds: x as 1 | 2 } })}
            />
          </View>
        ) : (
          <Body
            style={{ textAlign: 'center' }}
          >{`${BANKS.find((b) => b.value === v.settings.bank)?.label} words · ${v.settings.wordsPerTeam} per team · ${rounds} ${rounds === 1 ? 'round' : 'rounds'}`}</Body>
        )}
        {warn}
      </>
    );
    bottom = host ? (
      <View style={{ gap: u(8) }}>
        {v.start.ok ? null : <Text style={[k.sub, { color: t.dim }]}>{startWhy(v.start)}</Text>}
        <Btn label="Start the game" disabled={!v.start.ok || sending} onPress={() => send({ type: 'START' })} />
        <View style={{ flexDirection: 'row', gap: u(8) }}>
          <Ghost style={{ flex: 1 }} label="Shuffle teams" onPress={() => lobby({ type: 'RANDOMIZE' })} />
          {v.played.length ? <Ghost style={{ flex: 1 }} label="End the match" onPress={() => send({ type: 'FINISH' })} /> : null}
        </View>
      </View>
    ) : (
      <Text style={[k.sub, { color: t.dim }]}>The host starts when the teams are ready.</Text>
    );
  } else if (v.phase === 'playing' && v.teams) {
    const left = v.endsAt != null ? v.endsAt - server : 0;
    const team = v.me?.team ?? null;
    const mine = team ? v.teams[team] : null;
    const theirs = team ? v.teams[other(team)] : null;
    const role = v.me ? `You ${v.me.role === 'giver' ? 'give the clues' : 'guess'} for ${TEAM[v.me.team].name}` : 'You are watching';
    const head = (
      <>
        <Clock ms={left} />
        <Text style={[k.tag, { color: team ? TEAM[team].color : t.dim, textAlign: 'center' }]}>{role.toUpperCase()}</Text>
        {theirs && team ? <Text style={[k.sub, { color: t.mute }]}>{`${TEAM[other(team)].name}: ${theirs.completed} of ${theirs.total} done${theirs.forfeit ? ' (forfeited)' : ''}`}</Text> : null}
      </>
    );
    const clueChips = (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: u(6), justifyContent: 'center', marginTop: u(10) }}>
        {v.clues.length ? (
          v.clues.map((c, i) => (
            <View key={i} style={[pill, { borderColor: TEAM[team ?? 'A'].color, backgroundColor: TEAM[team ?? 'A'].deep }]}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: u(14), lineHeight: u(18), color: t.white }}>{c}</Text>
            </View>
          ))
        ) : (
          <Text style={[k.sub, { color: t.dim }]}>No clues yet.</Text>
        )}
      </View>
    );
    const wrongLine = v.guesses.length ? <Text style={[k.sub, { color: '#ffb3a4', marginTop: u(6) }]}>{`Not it: ${v.guesses.map((id) => termOf(id)?.name ?? id).join(', ')}`}</Text> : null;
    if (!v.me || !mine) {
      body = (
        <>
          {head}
          <ResultLine label={TEAM.A.name} n={v.teams.A} />
          <ResultLine label={TEAM.B.name} n={v.teams.B} />
        </>
      );
    } else if (mine.done) {
      body = (
        <>
          {head}
          <TeamHead
            team={v.me.team}
            lead={mine.forfeit ? 'Forfeited' : 'All words done'}
            sub={mine.forfeit ? 'Your team lost a player, so it forfeits this round.' : 'Waiting for the other team or the clock.'}
          />
        </>
      );
    } else if (v.me.role === 'giver' && v.word) {
      const w = v.word;
      const check = clue.trim() ? validateClue({ id: w.id, name: w.name, bank: 'clinical', category: w.category, forbidden: w.forbidden }, clue, v.clues) : null;
      body = (
        <>
          {head}
          <Plate term={w.name} category={CATEGORY[w.category] ?? w.category} forbidden={w.forbidden} team={v.me.team} />
          <Text style={[k.small, { color: t.mute, textAlign: 'center', marginTop: u(8) }]}>{`Word ${v.wordNo} of ${mine.total} · your clues so far`}</Text>
          {clueChips}
          {wrongLine}
          <TextInput
            value={clue}
            onChangeText={(x) => {
              setClue(x);
              setRefusal(null);
            }}
            maxLength={40}
            autoCorrect={false}
            autoCapitalize="none"
            placeholder="One-word clue"
            placeholderTextColor={t.dim}
            style={[{ borderColor: check && !check.ok ? '#ff5c6c' : t.panelLine, backgroundColor: t.panel, color: t.white }, inp]}
            accessibilityLabel="Your clue"
            onSubmitEditing={() => check?.ok && send({ type: 'CLUE', text: clue.trim() }).then((ok) => ok && setClue(''))}
          />
          {check && !check.ok ? <Text style={[k.sub, { color: '#ff5c6c' }]}>{clueWhy(check.reason)}</Text> : warn}
        </>
      );
      bottom = (
        <View style={{ flexDirection: 'row', gap: u(8) }}>
          <ShowBtn
            label="Skip"
            sub={mine.total - mine.completed > 1 ? 'to the back' : 'last word'}
            color={t.mute}
            flex={0.45}
            disabled={mine.total - mine.completed <= 1 || sending}
            onPress={() => send({ type: 'SKIP' })}
          />
          <ShowBtn
            label="Give clue"
            sub="counts against you"
            color={TEAM[v.me.team].color}
            disabled={!check?.ok || sending}
            onPress={() => send({ type: 'CLUE', text: clue.trim() }).then((ok) => ok && setClue(''))}
          />
        </View>
      );
    } else {
      const hits = searchTerms(TERMS, query, 6).filter((x) => !v.doneWords.includes(x.id));
      body = (
        <>
          {head}
          <View style={k.head}>
            <Kick>{`Word ${v.wordNo} of ${mine.total}`}</Kick>
            <Text style={[k.sub, { color: t.mute }]}>Your clues</Text>
          </View>
          {clueChips}
          {wrongLine}
          <TextInput
            value={query}
            onChangeText={(x) => {
              setQuery(x);
              setRefusal(null);
            }}
            maxLength={40}
            autoCorrect={false}
            placeholder="Type 3 letters of your guess"
            placeholderTextColor={t.dim}
            style={[{ borderColor: t.panelLine, backgroundColor: t.panel, color: t.white }, inp]}
            accessibilityLabel="Your guess"
          />
          <View style={{ gap: u(6), marginTop: u(8) }}>
            {hits.map((x) => (
              <Pressable
                key={x.id}
                disabled={sending}
                onPress={tapped(() => send({ type: 'GUESS', termId: x.id }).then(() => setQuery('')))}
                style={[sugg, { borderColor: t.chipLine, backgroundColor: t.chip }]}
                accessibilityRole="button"
                accessibilityLabel={`Guess ${x.name}`}
              >
                <Text style={{ fontFamily: F.bodySemi, fontSize: u(13.5), lineHeight: u(18), color: t.white }}>{x.name}</Text>
              </Pressable>
            ))}
            {query.trim().length >= 3 && !hits.length ? <Text style={[k.sub, { color: t.dim }]}>No term starts like that.</Text> : null}
          </View>
          {warn}
        </>
      );
    }
  } else if (v.phase === 'roundEnd') {
    const res = v.results[v.round];
    const w = res
      ? res.A.wordsCompleted !== res.B.wordsCompleted
        ? res.A.wordsCompleted > res.B.wordsCompleted
          ? 'A'
          : 'B'
        : res.A.clues !== res.B.clues
          ? res.A.clues < res.B.clues
            ? 'A'
            : 'B'
          : res.A.timeMs !== res.B.timeMs
            ? res.A.timeMs < res.B.timeMs
              ? 'A'
              : 'B'
            : null
      : null;
    const wait = v.breakEnds != null ? Math.max(0, v.breakEnds - server) : 0;
    const last = v.round + 1 >= rounds;
    body = res ? (
      <>
        <View style={k.head}>
          <Kick>{roundName(v.round)}</Kick>
          <Text style={[k.headT, { color: w ? TEAM[w].color : t.white }]}>{w ? `${TEAM[w].name} takes it` : 'A dead heat'}</Text>
          <Text style={[k.sub, { color: t.mute }]}>Most words wins, then the fewest clues, then the least time.</Text>
        </View>
        <ResultRow team="A" r={res.A} best={w === 'A'} />
        <ResultRow team="B" r={res.B} best={w === 'B'} />
        {last ? null : <Body style={{ textAlign: 'center', marginTop: u(8) }}>Round 2: new words, and the roles swap.</Body>}
        <Text style={[k.sub, { color: t.dim, marginTop: u(8) }]}>{`${last ? 'The winner' : 'Round 2'} in ${clock(wait)}`}</Text>
      </>
    ) : null;
    bottom = host ? <Btn label={last ? 'See the winner' : 'Start round 2'} disabled={sending} onPress={() => send({ type: 'NEXT' })} /> : null;
  } else if (v.phase === 'finished') {
    const g = v.played[v.played.length - 1];
    const w = g?.winner;
    const accepted = v.rematch.includes(me);
    body = g ? (
      <>
        {w === 'draw' || !w ? (
          <View style={k.head}>
            <Kick>Final result</Kick>
            <Text style={[k.headT, { color: t.white }]}>It&apos;s a draw</Text>
          </View>
        ) : (
          <TeamHead
            team={w}
            lead="Winner"
            sub={`${v.players
              .filter((p) => p.team === w)
              .map((p) => nameOf(p.id))
              .join(' and ')} win${rounds === 2 ? ' over both rounds' : ''}.`}
          />
        )}
        <Kick>{g.rounds.length === 2 ? 'Totals' : 'Result'}</Kick>
        <ResultRow team="A" r={g.totals.A} best={w === 'A'} />
        <ResultRow team="B" r={g.totals.B} best={w === 'B'} />
        {g.rounds.length === 2
          ? g.rounds.map((r, i) => (
              <View key={i} style={{ marginTop: u(10) }}>
                <Kick>{`Round ${i + 1}`}</Kick>
                <ResultRow team="A" r={r.A} />
                <ResultRow team="B" r={r.B} />
              </View>
            ))
          : null}
        <Text style={[k.sub, { color: t.dim, marginTop: u(8) }]}>{`Rematch: ${v.rematch.length} of 4 ready`}</Text>
        {warn}
      </>
    ) : null;
    bottom = (
      <View style={{ gap: u(8) }}>
        {playing ? <Btn label={accepted ? 'Waiting for the others…' : 'Rematch: new words'} disabled={accepted || sending} onPress={() => send({ type: 'REMATCH' })} /> : null}
        {host ? (
          <View style={{ flexDirection: 'row', gap: u(8) }}>
            <Ghost style={{ flex: 1 }} label="Change teams" onPress={() => lobby({ type: 'SET_SETTINGS', settings: {} })} />
            <Ghost style={{ flex: 1 }} label="End the match" onPress={() => send({ type: 'FINISH' })} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <PasswordScreen turn={v.phase === 'playing' ? (v.me?.team ?? null) : null} pills={pills} onPause={() => setMenu(true)} bottom={bottom}>
      {body}
      {extras}
      {v.phase === 'playing' ? null : talk}
      <PauseMenu open={menu} mode="online" onResume={() => setMenu(false)} onQuit={leave} />
    </PasswordScreen>
  );
}

function ResultLine({ label, n }: { label: string; n: { completed: number; total: number } }) {
  const t = useTheme();
  return <Text style={[k.sub, { color: t.fg, marginTop: u(6) }]}>{`${label}: ${n.completed} of ${n.total} done`}</Text>;
}

const pill = { borderWidth: 1, borderRadius: u(14), paddingHorizontal: u(12), paddingVertical: u(5) };
const sugg = { borderWidth: 1, borderRadius: u(12), paddingHorizontal: u(14), paddingVertical: u(10) };
const inp = { borderWidth: 1, borderRadius: u(14), paddingHorizontal: u(14), paddingVertical: u(12), fontFamily: F.bodySemi, fontSize: u(16), marginTop: u(12) };
