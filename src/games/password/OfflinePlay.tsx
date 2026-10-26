import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/AppText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';

import { engine, rank } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { useTicker } from '../engine/useTicker';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import { Body, Btn, Card, Ghost, Kick } from '../shell/ui';
import { initialOfflineState, offlineTransition, rolesFor, type OfflineEvent, type OfflineState, type SetupNotice } from './engine/offlineMachine';
import { offlineGiverView } from './engine/selectors';
import type { BankChoice, Settings, TeamId } from './engine/types';
import { Clock, ClueStack, PasswordScreen, Plate, ResultRow, SHOW, ShowBtn, TEAM, TeamHead, TeamPicker, s as k } from './kit';
import { envFor, playEffects, termOf, uniqueNames } from './offline';

type Saved = { off: OfflineState; recorded: number; wins: Record<number, number> };

const NOTICE: Record<SetupNotice, string> = {
  INVALID_PLAYERS: 'Password needs exactly 4 players with different names.',
  TEAMS_NOT_2_AND_2: 'Each team needs exactly 2 players.',
  MISSING_GIVER: 'Pick a clue giver for each team.',
  NOT_ENOUGH_TERMS: 'Not enough words for these settings.',
};
const other = (t: TeamId): TeamId => (t === 'A' ? 'B' : 'A');
const CATEGORY: Record<string, string> = { sign: 'sign or symptom', procedure: 'procedure or test' };

function settingsOf(play: PlayProps['play']): Settings {
  const words = Number(play.settings.words) === 10 ? 10 : 5;
  const rounds = Number(play.settings.rounds) === 2 ? 2 : 1;
  return { bank: ((play.settings.bank as BankChoice) ?? 'mixed') as BankChoice, wordsPerTeam: words, rounds };
}

function resumeOrStart(play: PlayProps['play']): Saved {
  const r = play.resume as Saved | null;
  if (r?.off) return r;
  const names = uniqueNames(play.seats.filter((x) => !x.removed).map((x) => x.name));
  const env = envFor(play.settings.custom);
  let off = initialOfflineState();
  off = offlineTransition(env, off, { type: 'SET_PLAYERS', names }).state;
  off = offlineTransition(env, off, { type: 'SET_SETTINGS', settings: settingsOf(play) }).state;
  return { off, recorded: 0, wins: {} };
}

/**
 * Pass the phone (Yazan's rules): exactly 4 players, 2 teams of 2. The giver holds the phone, sees one word at a
 * time and its forbidden words, says one-word clues out loud and taps +1 for each; the guesser answers out loud.
 * Teams take turns, 3 minutes each; the most words wins, then the fewest clues, then the least time. No EXP.
 */
export function OfflinePlay({ play, onFinish, onQuit }: PlayProps) {
  const t = useTheme();
  const [st, setSt] = useState<Saved>(() => resumeOrStart(play));
  const ref = useRef<Saved>(st);
  const [paused, setPaused] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const seats = useMemo(() => play.seats.filter((x) => !x.removed), [play.seats]);
  const off = st.off;
  const players = off.setup.players;
  const seatOf = useCallback((id: string) => seats[Number(id.slice(1)) - 1]?.seat ?? 0, [seats]);
  const nameOf = useCallback((id: string) => players.find((p) => p.id === id)?.name ?? id, [players]);

  useEffect(() => {
    if (ref.current.recorded === 0) engine.recorder.bookmark(play.id, ref.current, 0);
  }, [play.id]);

  const save = useCallback(
    (next: Saved) => {
      ref.current = next;
      setSt(next);
      engine.recorder.bookmark(play.id, next, next.wins[0] ?? 0);
    },
    [play.id],
  );

  const send = useCallback(
    (e: OfflineEvent) => {
      const cur = ref.current;
      const r = offlineTransition(envFor(play.settings.custom), cur.off, e);
      playEffects(r.effects);
      if (r.state === cur.off) return;
      let { recorded, wins } = cur;
      if (r.state.ui.name === 'results' && cur.off.ui.name !== 'results') {
        // One item per player per match (nothing feeds Learn); right for the winning team.
        const sum = r.state.ui.summary;
        wins = { ...wins };
        for (const p of r.state.setup.players) {
          const seat = seatOf(p.id);
          const won = sum.winner === p.team;
          if (won) wins[seat] = (wins[seat] ?? 0) + 1;
          recordItem(
            play,
            {
              seat,
              itemId: `match-${recorded + 1}`,
              answerKey: null,
              outcome: won ? 'right' : sum.winner === 'draw' ? 'skipped' : 'wrong',
              answersGiven: [],
              timeMs: sum.totals[p.team].timeMs,
              hintsUsed: 0,
              revealsUsed: 0,
              points: won ? 1 : 0,
              feedsLearn: false,
              gameData: { team: p.team, winner: sum.winner, totals: sum.totals, rounds: sum.rounds.length },
            },
            true,
          );
        }
        recorded += 1;
      }
      save({ ...cur, off: r.state, recorded, wins });
    },
    [play, save, seatOf],
  );

  const playing = off.ui.name === 'playing';
  const now = useTicker(!paused && playing, 250, () => send({ type: 'TICK' }));

  const pause = () => {
    if (ref.current.off.ui.name === 'playing') send({ type: 'APP_BACKGROUND' });
    setPaused(true);
  };
  const resume = () => {
    if (ref.current.off.ui.name === 'playing') send({ type: 'APP_FOREGROUND' });
    setPaused(false);
  };
  const { resume: unhide } = usePauseHide(pause);

  const finish = () => {
    const rows = seats.map((x) => ({ seat: x.seat, name: x.name, score: ref.current.wins[x.seat] ?? 0, timeMs: 0 }));
    onFinish(ref.current.wins[0] ?? 0, rank(rows));
  };

  const teams = { A: players.filter((p) => p.team === 'A').map((p) => p.id), B: players.filter((p) => p.team === 'B').map((p) => p.id) };
  const teamOf = (id: string): TeamId => players.find((p) => p.id === id)?.team ?? 'A';
  const pick = (id: string) => {
    if (!picked || picked === id) return setPicked(picked === id ? null : id);
    if (teamOf(picked) === teamOf(id)) return setPicked(id);
    // Swap the two players between the teams.
    send({ type: 'ASSIGN_TEAMS', teams: { [picked]: teamOf(id), [id]: teamOf(picked) } });
    setPicked(null);
  };

  const pills = (team: TeamId): string => {
    const res = off.results[off.round]?.[team];
    if (res) return `${res.wordsCompleted} done`;
    if (playing && off.turn?.team === team) return `${off.turn.tr.completed.length} done`;
    return '–';
  };

  let body: ReactNode = null;
  let bottom: ReactNode = null;
  const ui = off.ui;
  const rounds = off.setup.settings.rounds;
  const roundName = (r: number) => (rounds === 2 ? `Round ${r + 1} of 2` : 'The round');

  if (paused) {
    body = <Body style={{ textAlign: 'center', marginTop: u(40) }}>Paused. The clock is stopped.</Body>;
  } else if (ui.name === 'setup') {
    body = (
      <>
        <View style={k.head}>
          <Kick>Before you start</Kick>
          <Text style={[k.headT, { color: t.white }]}>Pick the teams</Text>
          <Text style={[k.sub, { color: t.mute }]}>Tap a name, then a name on the other team, to swap them. The star picks who gives clues first; roles swap in round 2.</Text>
        </View>
        <TeamPicker teams={teams} givers={off.setup.givers} picked={picked} nameOf={nameOf} onPick={pick} onGiver={(team, id) => send({ type: 'SET_GIVER', team, playerId: id })} />
        {ui.notice ? <Text style={[k.sub, { color: '#f0b54a' }]}>{NOTICE[ui.notice]}</Text> : null}
      </>
    );
    bottom = (
      <View style={{ gap: u(8) }}>
        <Btn label="Start the game" onPress={() => send({ type: 'START_MATCH' })} />
        <Ghost
          label="Shuffle the teams"
          onPress={() => {
            setPicked(null);
            send({ type: 'RANDOMIZE_TEAMS' });
          }}
        />
      </View>
    );
  } else if (ui.name === 'turnIntro') {
    const roles = rolesFor(off.setup, ui.team, ui.round);
    const n = off.setup.settings.wordsPerTeam;
    const first = off.firstTeams[ui.round] === ui.team;
    body = (
      <>
        <TeamHead
          team={ui.team}
          lead={roundName(ui.round)}
          sub={`${first && ui.round === 0 ? 'The app picked you to go first. ' : ''}Pass the phone to ${nameOf(roles.giverId)}, who gives the clues. ${nameOf(roles.guesserId)} guesses. ${n} words, 3 minutes.`}
        />
        <Card>
          <Kick>How it works</Kick>
          <Body>Say one word at a time, never part of the term or a crossed-out word. Tap +1 for every clue. Wrong guesses are free; Skip sends the word to the back.</Body>
        </Card>
        {ui.team === off.firstTeams[ui.round] ? null : (
          <Body style={{ textAlign: 'center' }}>{`${TEAM[other(ui.team)].name} finished with ${off.results[ui.round]?.[other(ui.team)]?.wordsCompleted ?? 0} words. Your turn.`}</Body>
        )}
      </>
    );
    bottom = <Btn label={`I'm ${nameOf(roles.giverId)}: start the clock`} onPress={() => send({ type: 'START_TURN' })} />;
  } else if (ui.name === 'playing' && off.turn) {
    const v = offlineGiverView(envFor(play.settings.custom).terms, off, now)!;
    const term = termOf(off.turn.tr.queue[0] ?? null);
    const team = off.turn.team;
    body = (
      <>
        <Clock ms={v.msLeft} />
        <Text style={[k.sub, { color: t.mute }]}>{`${nameOf(v.giverId)} gives clues to ${nameOf(v.guesserId)}`}</Text>
        {term ? <Plate term={term.name} category={CATEGORY[term.category] ?? term.category} forbidden={term.forbidden} team={team} /> : null}
        <ClueStack count={v.clueCount} total={v.totalClues} team={team} word={v.wordsDone + 1} words={v.wordsTotal} />
      </>
    );
    bottom = (
      <View style={{ gap: u(8) }}>
        <View style={{ flexDirection: 'row', gap: u(8) }}>
          <ShowBtn label="−1" sub="undo" color={t.mute} flex={0.3} disabled={v.clueCount === 0} onPress={() => send({ type: 'CLUE_MINUS' })} />
          <ShowBtn label="+1 clue" sub="after every clue" color={TEAM[team].color} onPress={() => send({ type: 'CLUE_PLUS' })} />
          <ShowBtn label="Skip" sub={v.canSkip ? 'to the back' : 'last word'} color={t.mute} flex={0.42} disabled={!v.canSkip} onPress={() => send({ type: 'SKIP' })} />
        </View>
        <View style={{ flexDirection: 'row', gap: u(8) }}>
          <ShowBtn label="Not correct" color={SHOW.red} onPress={() => send({ type: 'NOT_CORRECT' })} />
          <ShowBtn label="Correct" color={SHOW.green} onPress={() => send({ type: 'CORRECT' })} />
        </View>
      </View>
    );
  } else if (ui.name === 'turnEnd') {
    const done = off.results[ui.round];
    const last = !!(done?.A && done?.B);
    body = (
      <>
        <TeamHead
          team={ui.team}
          lead={ui.reason === 'timeUp' ? "Time's up" : 'All words done'}
          sub={last ? 'Both teams have played.' : `Now pass the phone to the ${TEAM[other(ui.team)].name} team.`}
        />
        <ResultRow team={ui.team} r={ui.result} />
      </>
    );
    bottom = <Btn label={last ? 'See the round' : `${TEAM[other(ui.team)].name} team's turn`} onPress={() => send({ type: 'NEXT' })} />;
  } else if (ui.name === 'roundSummary') {
    const { A, B } = ui.results;
    const w =
      A.wordsCompleted !== B.wordsCompleted
        ? A.wordsCompleted > B.wordsCompleted
          ? 'A'
          : 'B'
        : A.clues !== B.clues
          ? A.clues < B.clues
            ? 'A'
            : 'B'
          : A.timeMs !== B.timeMs
            ? A.timeMs < B.timeMs
              ? 'A'
              : 'B'
            : null;
    body = (
      <>
        <View style={k.head}>
          <Kick>{roundName(ui.round)}</Kick>
          <Text style={[k.headT, { color: w ? TEAM[w].color : t.white }]}>{w ? `${TEAM[w].name} takes it` : 'A dead heat'}</Text>
          <Text style={[k.sub, { color: t.mute }]}>Most words wins, then the fewest clues, then the least time.</Text>
        </View>
        <ResultRow team="A" r={A} best={w === 'A'} />
        <ResultRow team="B" r={B} best={w === 'B'} />
        {ui.round + 1 < rounds ? <Body style={{ textAlign: 'center', marginTop: u(8) }}>Round 2: new words, and the roles swap. The guessers give the clues now.</Body> : null}
      </>
    );
    bottom = <Btn label={ui.round + 1 < rounds ? 'Start round 2' : 'See the winner'} onPress={() => send({ type: 'NEXT' })} />;
  } else if (ui.name === 'results') {
    const sum = ui.summary;
    const w = sum.winner;
    body = (
      <>
        {w === 'draw' ? (
          <View style={k.head}>
            <Kick>Final result</Kick>
            <Text style={[k.headT, { color: t.white }]}>It&apos;s a draw</Text>
            <Text style={[k.sub, { color: t.mute }]}>Same words, same clues, same time.</Text>
          </View>
        ) : (
          <TeamHead
            team={w}
            lead="Winner"
            sub={`${players
              .filter((p) => p.team === w)
              .map((p) => p.name)
              .join(' and ')} win${rounds === 2 ? ' over both rounds' : ''}.`}
          />
        )}
        <Kick>{rounds === 2 ? 'Totals' : 'Result'}</Kick>
        <ResultRow team="A" r={sum.totals.A} best={w === 'A'} />
        <ResultRow team="B" r={sum.totals.B} best={w === 'B'} />
        {rounds === 2
          ? sum.rounds.map((r, i) => (
              <View key={i} style={{ marginTop: u(10) }}>
                <Kick>{`Round ${i + 1}`}</Kick>
                <ResultRow team="A" r={r.A} best={sum.roundWinners[i] === 'A'} />
                <ResultRow team="B" r={r.B} best={sum.roundWinners[i] === 'B'} />
              </View>
            ))
          : null}
      </>
    );
    bottom = (
      <View style={{ gap: u(8) }}>
        <Btn
          label="Rematch: new words"
          onPress={() => {
            for (const p of players) send({ type: 'REMATCH_ACCEPT', playerId: p.id });
          }}
        />
        <Ghost label="See results" onPress={finish} />
      </View>
    );
  }

  return (
    <PasswordScreen turn={playing ? (off.turn?.team ?? null) : null} pills={{ A: pills('A'), B: pills('B') }} onPause={pause} bottom={paused ? null : bottom}>
      {body}
      <PauseMenu
        open={paused}
        mode="offline"
        onResume={() => {
          unhide();
          resume();
        }}
        onQuit={onQuit}
      />
    </PasswordScreen>
  );
}
