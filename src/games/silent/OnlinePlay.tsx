import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/AppText';

import { supabase } from '@/lib/supabase';
import { call } from '@/online/api';
import { AlertPill, Countdown, nth, useAlerts } from '@/online/live';
import { settingsLine } from '@/online/format';
import { useRace, type RacePlayer, type RaceState } from '@/online/race';
import { RoomTalk } from '@/online/Talk';
import { u } from '@/theme/scale';

import { characterOf } from '../shell/characters';
import { PauseMenu } from '../shell/PauseMenu';
import { presetTeam } from '../shell/teams';
import type { OnlineProps } from '../shell/types';
import { Board, Sketch, type BoardHandle, type Stroke } from './Board';
import { SA } from './core';
import { WORDS, wordName } from './data';
import { buildAnswerIndex, guessCandidates } from './guess';
import { ChalkBtn, ChalkTimer, ChalkTitle, Frame, HintCard, Kicker, Ledge, Note, Panel, PauseBtn, SL, Scores, SlateScreen, TopRow, useRoom } from './slate';

/** Everyone sees the same board shape online, so a drawing lands in the same place on every phone. */
const RATIO = 1.1;
const wordOf = (n: number | null | undefined) => (n ? WORDS[n - 1] : undefined);
const INDEX = buildAnswerIndex(WORDS);

/** Each turn is one item: what you drew, or what you guessed. SA1: no Learn and no EXP; the dossier links still show (RS1). */
function itemsOf(st: RaceState) {
  return (st.my_items ?? []).map((m) => {
    const w = wordOf(m.item)!;
    const right = m.drawer ? m.points > 0 : m.solved_ms != null;
    return {
      seat: 0,
      itemId: w.id,
      answerKey: w.dossier ?? null,
      outcome: right ? ('right' as const) : ('wrong' as const),
      answersGiven: [],
      timeMs: m.solved_ms ?? 0,
      hintsUsed: 0,
      revealsUsed: 0,
      points: m.points,
      feedsLearn: false,
      gameData: { kind: m.drawer ? 'drew' : 'guessed', field: w.field, rank: m.rank, room: st.room_id },
    };
  });
}

/**
 * The Silent Artist Online (SA5, SA7, SA8, SA12): players take turns drawing a disease they pick from 3; everyone else
 * types guesses. Faster guesses score more; the drawer earns the average of everyone's points, +20 if all got it.
 * Strokes go live over a Realtime broadcast, and the whole board is saved on the server so late phones catch up.
 */
export function OnlinePlay({ def, roomId, matchId, me }: OnlineProps) {
  const R = useRoom();
  const { st, load, server, playing, notice, setNotice, leave } = useRace(def, roomId, matchId, me, itemsOf);
  const [menu, setMenu] = useState(false);
  const { alert, push } = useAlerts();
  const [strokes, setStrokes] = useState<{ turn: number; version: number; list: Stroke[] }>({ turn: -1, version: -1, list: [] });
  const [live, setLive] = useState<Stroke | null>(null);
  const channel = useRef<RealtimeChannel | null>(null);
  const seen = useRef<{ turn: number; solved: Set<string>; stage: number }>({ turn: -1, solved: new Set(), stage: 0 });

  const teams = Number(st?.settings.teams) || 0;
  const colorOf = (p: RacePlayer | undefined) => (!p ? R.soft : teams >= 2 && p.team != null ? presetTeam(p.team).color : (characterOf(p.character)?.ring ?? R.soft));

  // Live strokes from the drawer (the stroke being drawn, and the board after each line).
  useEffect(() => {
    const ch = supabase.channel(`sa-${matchId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'live' }, ({ payload }) => setLive((payload?.s as Stroke | null) ?? null))
      .on('broadcast', { event: 'board' }, ({ payload }) => {
        const p = payload as { turn: number; version: number; list: Stroke[] };
        setStrokes((cur) => (p.turn > cur.turn || (p.turn === cur.turn && p.version > cur.version) ? p : cur));
        setLive(null);
      })
      .subscribe();
    channel.current = ch;
    return () => {
      channel.current = null;
      supabase.removeChannel(ch);
    };
  }, [matchId]);

  // Catch up from the saved board when the server's version moves past ours (missed broadcasts, a reconnect).
  const sa = st?.sa;
  useEffect(() => {
    if (!st || !sa || st.phase === 'pick' || sa.drawer === me) return;
    if (strokes.turn === st.index && strokes.version >= sa.version) return;
    call<{ turn: number; version: number; strokes: Stroke[] }>('sa_strokes', { m: matchId })
      .then((r) => setStrokes((cur) => (r.turn > cur.turn || (r.turn === cur.turn && r.version > cur.version) ? { turn: r.turn, version: r.version, list: r.strokes } : cur)))
      .catch(() => {});
  }, [st, sa, me, matchId, strokes.turn, strokes.version]);

  // SA8 alerts: each correct guess, and the hint stages.
  useEffect(() => {
    if (!st || !sa || st.phase !== 'case') return;
    if (seen.current.turn !== st.index) seen.current = { turn: st.index, solved: new Set(st.players.filter((p) => p.solved).map((p) => p.user_id)), stage: sa.stage };
    for (const p of st.players) {
      if (!p.solved || seen.current.solved.has(p.user_id)) continue;
      seen.current.solved.add(p.user_id);
      if (p.user_id !== me) push(`${p.name} guessed it`, colorOf(p));
    }
    if (sa.stage !== seen.current.stage) {
      if (sa.stage === 1 && sa.drawer !== me) push('Field revealed', R.mark);
      if (sa.stage === 3 && sa.drawer !== me) push('Letters coming', R.mark);
      seen.current.stage = sa.stage;
    }
  }, [st, sa, me, push]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!st) return <SlateScreen>{null}</SlateScreen>;
  if (st.phase === 'countdown' || !sa) {
    return (
      <SlateScreen>
        <Countdown ms={st.phase_ends_at - server} faces={st.players.map((p) => p.character)} line={settingsLine(def, st.settings)} />
      </SlateScreen>
    );
  }

  const mine = st.players.find((p) => p.user_id === me);
  const talker = { id: me, name: mine?.name ?? 'You', face: mine?.character ?? 'yara' };
  const drawer = st.players.find((p) => p.user_id === sa.drawer);
  const drawing = sa.drawer === me;
  const turnMs = (Number(st.settings.turn) || 90) * 1000;
  const left = Math.max(0, st.phase_ends_at - server);
  const kick = `Turn ${st.index + 1} of ${st.total}`;
  const pause = () => setMenu(true);
  const extras = (
    <>
      <AlertPill alert={alert} />
      <RoomTalk room={roomId} me={talker} />
      <PauseMenu open={menu} mode="online" onResume={() => setMenu(false)} onQuit={leave} />
    </>
  );
  const scoreRows = [...st.players]
    .filter((p) => !p.dropped)
    .sort((a, b) => b.score - a.score)
    .map((p) => ({ key: p.user_id, name: p.user_id === me ? 'You' : p.name, score: p.score, color: colorOf(p), mark: p.drawer ? 'drew' : p.solved ? `+${p.item_points}` : undefined }));

  // SA5: the drawer picks 1 of 3 in 10 s; everyone else waits.
  if (st.phase === 'pick') {
    return (
      <SlateScreen scroll>
        <TopRow kicker={kick} title={drawing ? 'Pick what to draw' : `${drawer?.name ?? 'Someone'} is choosing`} color={colorOf(drawer)} right={<><ChalkTimer leftMs={left} totalMs={SA.pickMs} /><PauseBtn onPress={pause} /></>} />
        {drawing ? (
          <>
            <Note>Only you can see these. If time runs out, one is picked for you.</Note>
            <View style={{ gap: u(8) }}>
              {(sa.options ?? []).map((n, i) => {
                const w = wordOf(n)!;
                return (
                  <Pressable key={n} onPress={() => call('sa_pick', { m: matchId, w: n }).then(load).catch(() => setNotice('Couldn’t pick. Try again.'))} style={({ pressed }) => [s.option, { backgroundColor: R.board }, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={`Draw ${w.name}`}>
                    <Text style={s.optNo}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.optT} numberOfLines={2}>{w.name}</Text>
                      <Text style={[s.optF, { color: R.boardSoft }]} numberOfLines={1}>{[...w.aliases, w.field].join(' · ')}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <Panel style={{ paddingVertical: u(12), gap: u(8), marginRight: u(34) }}>
            <Note>{`Get ready to guess. ${drawer?.name ?? 'The artist'} draws, you type what it is. Faster is worth more.`}</Note>
            <Scores rows={scoreRows} />
          </Panel>
        )}
        {notice ? <Note style={{ textAlign: 'center' }}>{notice}</Note> : null}
        {extras}
      </SlateScreen>
    );
  }

  const w = wordOf(st.item);

  if (st.phase !== 'case') {
    const last = st.index + 1 >= st.total;
    return (
      <SlateScreen scroll>
        <Kicker>{kick}</Kicker>
        <ChalkTitle size={18} color={R.soft}>It was</ChalkTitle>
        <ChalkTitle size={27} color={R.mark}>{w ? wordName(w) : ''}</ChalkTitle>
        <Note style={{ marginTop: -u(6) }}>{w?.field}</Note>
        {strokes.turn === st.index && strokes.list.length ? (
          <Frame style={{ width: '62%', alignSelf: 'center' }}>
            <Sketch strokes={strokes.list} bg={R.board} ratio={RATIO} />
          </Frame>
        ) : null}
        <Panel style={{ paddingVertical: u(10), marginRight: u(34) }}>
          <Kicker>Scores</Kicker>
          <Scores rows={scoreRows} />
        </Panel>
        {!drawing && playing && st.phase === 'reveal' ? <ReportBtn sa={sa} matchId={matchId} load={load} /> : null}
        <Note style={{ textAlign: 'center' }}>{st.phase === 'done' ? 'Adding up the scores…' : `${last ? 'Results' : 'Next turn'} in ${Math.ceil(left / 1000)} s`}</Note>
        {extras}
      </SlateScreen>
    );
  }

  if (drawing) {
    return (
      <SlateScreen>
        <TopRow kicker={`${kick} · you’re drawing`} title={w ? w.name : ''} color={R.mark} right={<><ChalkTimer leftMs={left} totalMs={turnMs} /><PauseBtn onPress={pause} /></>} />
        <DrawSide turn={st.index} matchId={matchId} channel={channel} />
        <Note style={{ textAlign: 'center' }}>{`${st.players.filter((p) => p.solved).length} of ${st.players.filter((p) => !p.dropped && !p.drawer).length} guessed it · no letters or numbers on the board`}</Note>
        {extras}
      </SlateScreen>
    );
  }

  return (
    <SlateScreen>
      <TopRow kicker={kick} title={`${drawer?.name ?? 'Someone'} is drawing`} color={colorOf(drawer)} right={<><ChalkTimer leftMs={left} totalMs={turnMs} /><PauseBtn onPress={pause} /></>} />
      <HintCard hint={{ words: sa.words ?? 1, field: sa.field, mask: sa.mask }} />
      <View style={s.fill}>
        <Frame style={{ width: '100%', maxWidth: u(330) }}>
          <Sketch strokes={strokes.turn === st.index ? strokes.list : []} live={live} bg={R.board} ratio={RATIO} />
        </Frame>
      </View>
      {playing ? <GuessBox key={st.index} solved={st.me?.solved_ms != null} points={st.me?.points ?? 0} rank={st.me?.rank ?? null} matchId={matchId} load={load} /> : <Note style={{ textAlign: 'center' }}>You’re watching. You get a seat at the rematch.</Note>}
      {playing ? <ReportBtn sa={sa} matchId={matchId} load={load} /> : null}
      {extras}
    </SlateScreen>
  );
}

/** The drawer's board and chalk ledge. Each finished line saves the board; the line being drawn goes out live. */
function DrawSide({ turn, matchId, channel }: { turn: number; matchId: string; channel: React.RefObject<RealtimeChannel | null> }) {
  const R = useRoom();
  const board = useRef<BoardHandle>(null);
  const [ink, setInk] = useState(0);
  const [size, setSize] = useState(0);
  const [erase, setErase] = useState(false);
  const lastLive = useRef(0);
  const version = useRef(0);
  const saving = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(() => {
    const list = (board.current?.strokes() ?? []).map((x) => ({ ...x, pts: x.pts.map((p) => Math.round(p)) }));
    version.current += 1;
    const v = version.current;
    channel.current?.send({ type: 'broadcast', event: 'board', payload: { turn, version: v, list } });
    if (saving.current) clearTimeout(saving.current);
    saving.current = setTimeout(() => call('sa_draw', { m: matchId, strokes: list }).catch(() => {}), 250);
  }, [turn, matchId, channel]);

  useEffect(() => () => void (saving.current && clearTimeout(saving.current)), []);

  const onLive = useMemo(
    () => (x: Stroke | null) => {
      const t = Date.now();
      if (x && t - lastLive.current < 80) return;
      lastLive.current = t;
      channel.current?.send({ type: 'broadcast', event: 'live', payload: { s: x && { ...x, pts: x.pts.map((p) => Math.round(p)) } } });
    },
    [channel],
  );

  return (
    <>
      <View style={s.fill}>
        <Frame style={{ width: '100%', maxWidth: u(330) }}>
          <Board key={turn} ref={board} color={SL.inks[ink]} width={SL.sizes[size]} erase={erase} bg={R.board} ratio={RATIO} onChange={save} onLive={onLive} />
        </Frame>
      </View>
      <Ledge ink={ink} size={size} erase={erase} onInk={(i) => (setInk(i), setErase(false))} onSize={() => setSize(size ? 0 : 1)} onErase={() => setErase(!erase)} onUndo={() => board.current?.undo()} onClear={() => board.current?.clear()} />
    </>
  );
}

/** Type a guess. The phone runs the coded matcher over the word list; the server says right, close or not. */
function GuessBox({ solved, points, rank, matchId, load }: { solved: boolean; points: number; rank: number | null; matchId: string; load: () => Promise<void> }) {
  const R = useRoom();
  const [text, setText] = useState('');
  const [line, setLine] = useState<string | null>(null);
  const busy = useRef(false);
  const send = async () => {
    const g = text.trim();
    if (!g || busy.current) return;
    busy.current = true;
    const { correct, close } = guessCandidates(g, WORDS, INDEX);
    try {
      const res = await call<string>('sa_guess', { m: matchId, correct, close });
      setLine(res === 'correct' ? null : res === 'close' ? `“${g}” is so close!` : res === 'wrong' ? `Not “${g}”` : null);
      setText('');
      await load();
    } catch {
      setLine('Couldn’t send that. Try again.');
    }
    busy.current = false;
  };
  if (solved)
    return (
      <Panel style={{ paddingVertical: u(10) }}>
        <ChalkTitle size={20} color={R.mark} style={{ textAlign: 'center' }}>{`You got it, ${nth(rank ?? 1)} · +${points}`}</ChalkTitle>
      </Panel>
    );
  return (
    <View style={{ gap: u(4) }}>
      <View style={s.row}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          placeholder="Type your guess"
          placeholderTextColor={R.dim}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="send"
          style={[s.input, { color: R.ink, borderColor: R.line, backgroundColor: R.card }]}
          accessibilityLabel="Your guess"
        />
        <ChalkBtn label="Guess" onPress={send} disabled={!text.trim()} style={{ paddingHorizontal: u(16) }} />
      </View>
      {line ? <Note style={{ color: line.includes('close') ? R.mark : R.soft }}>{line}</Note> : null}
    </View>
  );
}

/** SA7: two reports from different players cancel the drawer's points for this turn. */
function ReportBtn({ sa, matchId, load }: { sa: NonNullable<RaceState['sa']>; matchId: string; load: () => Promise<void> }) {
  const R = useRoom();
  return (
    <Pressable
      disabled={sa.reported}
      onPress={() => call('sa_report', { m: matchId }).then(load).catch(() => {})}
      style={s.report}
      accessibilityRole="button"
      accessibilityLabel={sa.reported ? 'Drawing reported' : 'Report this drawing'}>
      <Text style={[s.reportT, { color: sa.reported ? R.dim : R.alarm }]}>{sa.reported ? 'Reported' : 'Report drawing (letters, rude)'}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: u(120) },
  row: { flexDirection: 'row', gap: u(8), alignItems: 'stretch' },
  input: { flex: 1, minWidth: 0, width: 0, borderWidth: 1.5, borderRadius: u(12), paddingHorizontal: u(12), paddingVertical: u(10), fontFamily: SL.body, fontSize: u(17) },
  option: { flexDirection: 'row', alignItems: 'center', gap: u(12), borderWidth: SL.frameW * 0.6, borderColor: SL.frame, borderRadius: u(4), paddingVertical: u(12), paddingHorizontal: u(14), minHeight: u(62) },
  optNo: { fontFamily: SL.head, fontSize: u(24), color: SL.yellow, width: u(18) },
  optT: { fontFamily: SL.head, fontSize: u(18), lineHeight: u(21), color: SL.chalk },
  optF: { fontFamily: SL.body, fontSize: u(12.5) },
  report: { alignSelf: 'center', paddingVertical: u(4), marginRight: u(34) },
  reportT: { fontFamily: SL.body, fontSize: u(13) },
});
