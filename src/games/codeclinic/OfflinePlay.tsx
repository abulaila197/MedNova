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
import { canEndTurn, getPhaseRemainingMs, type GameEvent } from './engine/gameCore';
import { createInitialOfflineState, reduceOffline, validateOfflineSettings, type OfflineEvent, type OfflineState } from './engine/offlineMachine';
import type { ClueNumber, StyleChoice, Team } from './engine/types';
import { Board, ClinicScreen, TeamPicker, Clock, clueText, HoldKey, KeyLegend, NumberPick, TEAM, TeamHead, s as k } from './kit';
import { board, dealTeams, playEffects, rosterOf, type Split } from './offline';

type Saved = {
  stage: 'teams' | 'game';
  split: Split;
  off: OfflineState;
  recorded: number;
  wins: Record<number, number>;
};

/** Why the game ended, said of the winner (w) and the loser (l). */
const reason = (why: string | null, w: string, l: string) => (why === 'assassin' ? `${l} touched the deadly card.` : why === 'forfeit' ? `${l} gave up.` : `${w} found all their cards.`);

function resumeOrStart(play: PlayProps['play']): Saved {
  const r = play.resume as Saved | null;
  if (r?.split && r.off) return r;
  const seats = play.seats.filter((x) => !x.removed).map((x) => x.seat);
  return {
    stage: 'teams',
    split: dealTeams(seats),
    off: createInitialOfflineState(),
    recorded: 0,
    wins: {},
  };
}

/**
 * Pass the phone (Yazan's rules, CC1): one phone, 4 to 6 players in two teams of 2 or 3. Each spymaster checks the key
 * by holding it, says the clue out loud and enters only the number; the guessers tap cards. Rematches keep the teams
 * and move the spymaster on. No EXP and nothing to Learn; each finished game is one item per player.
 */
export function OfflinePlay({ play, onFinish, onQuit }: PlayProps) {
  const t = useTheme();
  const [st, setSt] = useState<Saved>(() => resumeOrStart(play));
  const ref = useRef<Saved>(st);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState<Team | null>(null);
  const [seen, setSeen] = useState(false);
  const [num, setNum] = useState<ClueNumber | null>(null);
  const [marked, setMarked] = useState<number | null>(null);

  const style = (play.settings.style as StyleChoice) ?? 'mixed';
  const seats = useMemo(() => play.seats.filter((x) => !x.removed), [play.seats]);
  const nameOf = useCallback((seat: number) => seats.find((x) => x.seat === seat)?.name ?? `Player ${seat + 1}`, [seats]);

  useEffect(() => {
    if (ref.current.recorded === 0 && ref.current.stage === 'teams') engine.recorder.bookmark(play.id, ref.current, 0);
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
      const r = reduceOffline(cur.off, e);
      if (r.state === cur.off) {
        playEffects(r.effects);
        return;
      }
      let { recorded, wins } = cur;
      for (const fx of r.effects) {
        if (fx.type !== 'gameFinished') continue;
        // One item per player per game: right for the winning team (CC3: nothing feeds Learn).
        const winner = fx.record.winner;
        wins = { ...wins };
        for (const team of ['red', 'blue'] as const) {
          for (const seat of cur.split[team]) {
            const won = team === winner;
            if (won) wins[seat] = (wins[seat] ?? 0) + 1;
            recordItem(
              play,
              {
                seat,
                itemId: fx.record.id,
                answerKey: null,
                outcome: won ? 'right' : 'wrong',
                answersGiven: [],
                timeMs: 0,
                hintsUsed: 0,
                revealsUsed: 0,
                points: won ? 1 : 0,
                feedsLearn: false,
                gameData: {
                  team,
                  winner,
                  reason: fx.record.winReason,
                  spymaster: cur.split[team][cur.split.spymaster[team]] === seat,
                  turns: fx.record.turns,
                },
              },
              true,
            );
          }
        }
        recorded += 1;
      }
      playEffects(r.effects);
      save({ ...cur, off: r.state, recorded, wins });
    },
    [play, save],
  );

  const game = (e: GameEvent) => send({ type: 'GAME', event: e });

  const off = st.off;
  const g = off.game;
  const timed = !paused && st.stage === 'game' && off.phase === 'playing' && (g?.phase === 'clue' || g?.phase === 'guess');
  const now = useTicker(timed, 250, (n) => game({ type: 'TICK', at: n }));

  // A new turn or phase clears the picked number and the marked card.
  const turnKey = `${g?.turnNumber}-${g?.phase}`;
  const [lastTurn, setLastTurn] = useState(turnKey);
  if (lastTurn !== turnKey) {
    setLastTurn(turnKey);
    setNum(null);
    setMarked(null);
  }

  const pause = () => {
    if (g && off.phase === 'playing') game({ type: 'PAUSE', at: Date.now() });
    setPaused(true);
  };
  const resume = () => {
    if (g && off.phase === 'playing') game({ type: 'RESUME', at: Date.now() });
    setPaused(false);
  };
  const { resume: unhide } = usePauseHide(pause);

  const finish = () => {
    const rows = seats.map((x) => ({
      seat: x.seat,
      name: x.name,
      score: ref.current.wins[x.seat] ?? 0,
      timeMs: 0,
    }));
    onFinish(ref.current.wins[0] ?? 0, rank(rows));
  };

  const deal = () => {
    const b = board(style);
    const cur = ref.current;
    const r = reduceOffline(cur.off, {
      type: 'START',
      settings: { style, roster: rosterOf(cur.split, nameOf) },
      cards: b.cards,
      startingTeam: b.startingTeam,
      at: Date.now(),
    });
    setReady(null);
    save({ ...cur, stage: 'game', off: r.state });
  };
  const rematch = () => {
    const b = board(style);
    const cur = ref.current;
    const r = reduceOffline(cur.off, {
      type: 'REMATCH',
      cards: b.cards,
      startingTeam: b.startingTeam,
      at: Date.now(),
    });
    const spy = r.state.settings?.roster.spymaster ?? cur.split.spymaster;
    setReady(null);
    save({ ...cur, split: { ...cur.split, spymaster: spy }, off: r.state });
  };

  const move = (seat: number, to: Team) => {
    const cur = ref.current;
    const split = cur.split;
    const from: Team = split.red.includes(seat) ? 'red' : 'blue';
    if (from === to) return;
    const fromList = split[from].filter((x) => x !== seat);
    // Keep each spymaster where they were; a team that loses its spymaster gets its first player.
    const spy = { ...split.spymaster, [from]: Math.max(0, fromList.indexOf(split[from][split.spymaster[from]])) };
    save({ ...cur, split: { ...split, [from]: fromList, [to]: [...split[to], seat], spymaster: spy } });
  };
  const makeSpy = (team: Team, i: number) => {
    const cur = ref.current;
    save({ ...cur, split: { ...cur.split, spymaster: { ...cur.split.spymaster, [team]: i } } });
  };

  const spyName = (team: Team) => nameOf(st.split[team][st.split.spymaster[team]]);
  const keyProps = (team: Team) => ({
    team,
    held: off.keyHeldBy === team,
    onHold: () => {
      setSeen(true);
      send({ type: 'KEY_HOLD', team });
    },
    onRelease: () => send({ type: 'KEY_RELEASE' }),
  });

  let body: ReactNode = null;
  let bottom: ReactNode = null;

  if (paused) {
    body = <Body style={{ textAlign: 'center', marginTop: u(40) }}>Paused. The clock is stopped.</Body>;
  } else if (st.stage === 'teams') {
    const split = st.split;
    const err = validateOfflineSettings({
      style,
      roster: rosterOf(split, nameOf),
    });
    body = (
      <>
        <View style={k.head}>
          <Kick>Before you start</Kick>
          <Text style={[k.headT, { color: t.white }]}>Pick the teams</Text>
          <Text style={[k.sub, { color: t.mute }]}>2 or 3 players a team. Tap a name to move it, and the star to pick each team&apos;s spymaster.</Text>
        </View>
        <TeamPicker split={split} nameOf={nameOf} onMove={move} onSpy={makeSpy} />
        {err ? <Text style={[k.sub, { color: '#f0b54a' }]}>{err.replace(/^red|^blue/, (m) => TEAM[m as Team].name)}</Text> : null}
      </>
    );
    bottom = <Btn label="Deal the board" disabled={!!err} onPress={deal} />;
  } else if (off.phase === 'keyCheck' && g && off.keyTeam) {
    const team = off.keyTeam;
    if (ready !== team) {
      body = (
        <TeamHead
          team={team}
          lead={`Pass the phone to ${spyName(team)}`}
          sub={`${TEAM[team].name} spymaster: look at the key in secret. ${TEAM[g.startingTeam].name} starts and has 9 cards; the other team has 8.`}
        />
      );
      bottom = (
        <Btn
          label="I'm the spymaster"
          onPress={() => {
            setReady(team);
            setSeen(false);
          }}
        />
      );
    } else {
      body = (
        <>
          <TeamHead team={team} lead="The key" sub="Your cards are in your colour. Avoid the deadly card at all costs." />
          <Board cards={g.cards} showKey={off.keyHeldBy === team} />
          {off.keyHeldBy === team ? <KeyLegend colors={g.cards.map((c) => c.color)} /> : null}
        </>
      );
      bottom = (
        <View style={{ gap: u(8) }}>
          <HoldKey {...keyProps(team)} />
          <Btn label={team === 'red' ? 'Done, pass it on' : 'Done, start the game'} disabled={!seen} onPress={() => send({ type: 'KEY_DONE' })} />
        </View>
      );
    }
  } else if (off.phase === 'playing' && g) {
    const team = g.turn;
    const left = getPhaseRemainingMs(g, now);
    if (g.phase === 'ready') {
      body = (
        <>
          <TeamHead team={team} lead={`Turn ${g.turnNumber}`} sub={`${spyName(team)}, take the phone. Check the key, then start: you have 60 seconds for your clue.`} />
          <Board cards={g.cards} showKey={off.keyHeldBy === team} />
          {off.keyHeldBy === team ? <KeyLegend colors={g.cards.map((c) => c.color)} /> : null}
        </>
      );
      bottom = (
        <View style={{ gap: u(8) }}>
          <HoldKey {...keyProps(team)} />
          <Btn label="Start the turn" onPress={() => game({ type: 'BEGIN_TURN', at: Date.now() })} />
        </View>
      );
    } else if (g.phase === 'clue') {
      body = (
        <>
          <TeamHead team={team} lead={`${spyName(team)}'s clue`} sub="Say one word out loud, and how many cards it points to. Then pick the number." />
          <Clock ms={left} />
          <Board cards={g.cards} showKey={off.keyHeldBy === team} />
          {off.keyHeldBy === team ? <KeyLegend colors={g.cards.map((c) => c.color)} /> : null}
          <NumberPick value={num} onPick={setNum} team={team} />
        </>
      );
      bottom = (
        <View style={{ gap: u(8) }}>
          <HoldKey {...keyProps(team)} />
          <Btn
            label={num == null ? 'Pick the number' : `Clue for ${clueText(num)}`}
            disabled={num == null}
            onPress={() =>
              num != null &&
              game({
                type: 'CLUE',
                team,
                word: null,
                number: num,
                at: Date.now(),
              })
            }
          />
        </View>
      );
    } else if (g.phase === 'guess' && g.clue) {
      const c = g.clue;
      body = (
        <>
          <TeamHead
            team={team}
            lead={`Clue for ${clueText(c.number)}`}
            sub={`${c.guessesLeft == null ? 'Guess as many as you like.' : `${c.guessesLeft} ${c.guessesLeft === 1 ? 'guess' : 'guesses'} left.`} Tap a card, then tap it again to turn it over.`}
          />
          <Clock ms={left} />
          <Board
            cards={g.cards}
            marked={marked}
            onTap={(i) => {
              if (marked === i) {
                setMarked(null);
                game({ type: 'GUESS', team, cardIndex: i, at: Date.now() });
              } else setMarked(i);
            }}
          />
        </>
      );
      bottom = <Ghost label={canEndTurn(g) ? 'End the turn' : 'Make at least one guess'} onPress={canEndTurn(g) ? () => game({ type: 'END_TURN', team, at: Date.now() }) : undefined} />;
    }
  } else if (off.phase === 'finished' && g && g.winner) {
    const w = g.winner;
    body = (
      <>
        <TeamHead team={w} lead="Winner" sub={reason(g.winReason, `The ${TEAM[w].name} team`, `The ${TEAM[w === 'red' ? 'blue' : 'red'].name} team`)} />
        <Board cards={g.cards} showKey fade />
        <KeyLegend />
        <Card>
          <Kick>Games won</Kick>
          {[...seats]
            .sort((a, b) => (st.wins[b.seat] ?? 0) - (st.wins[a.seat] ?? 0))
            .map((x) => {
              const team: Team = st.split.red.includes(x.seat) ? 'red' : 'blue';
              return (
                <View key={x.seat} style={k.row}>
                  <View style={[k.dot, { backgroundColor: TEAM[team].color }]} />
                  <Text style={[k.rowN, { color: t.fg }]}>{x.name}</Text>
                  <Text style={[k.tag, { color: t.white }]}>{st.wins[x.seat] ?? 0}</Text>
                </View>
              );
            })}
        </Card>
      </>
    );
    bottom = (
      <View style={{ gap: u(8) }}>
        <Btn label="Rematch: new spymasters" onPress={rematch} />
        <Ghost label="See results" onPress={finish} />
      </View>
    );
  }

  return (
    <ClinicScreen turn={st.stage === 'game' && off.phase === 'playing' ? (g?.turn ?? null) : null} remaining={g?.remaining ?? { red: 9, blue: 8 }} onPause={pause} bottom={paused ? null : bottom}>
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
    </ClinicScreen>
  );
}
