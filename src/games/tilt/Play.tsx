import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Accelerometer } from 'expo-sensors';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/AppText';
import { loadFonts } from '@/features/loading/fonts';
import { sfx } from '@/lib/sound';
import { useSidewaysFrame } from '@/state/sideways';
import { F } from '@/theme/tokens';

import { engine, rank, type Seat } from '../engine';
import { defaultKV } from '../engine/storage';
import { usePauseHide } from '../engine/usePauseHide';
import { useTicker } from '../engine/useTicker';
import { tickedFields } from '../shell/fields';
import { recordItem } from '../shell/flow';
import { teamsOf, type Team } from '../shell/teams';
import type { PlayProps } from '../shell/types';
import { BANK, catLabel, wordById } from './data';
import { confirm, current, endTurn, fix, freshDeck, leaders, mark, newGame, points, seatScores, startTurn, teamTotals, turnSeconds, type Mark, type TTState } from './game';
import { freshTilt, held, stepHold, stepTilt, type Reading, type TiltState } from './tilt';

// Look B "Spotlight stage" (Yazan 2026-11-12, claude.ai/artifact/3BBV24vDmvjkJKfhQLw3yt): a game-show stage under a
// spotlight, marquee bulbs, a row of lights for the clock; correct floods green, pass floods orange. The whole
// play screen is sideways; there is no header during a turn so the word fills the screen.
const C = {
  plum: '#240d33',
  deep: '#13061c',
  glow: '#4a1e5e',
  cream: '#fff7ea',
  pink: '#e7b7d3',
  soft: '#f3d9e6',
  gold: '#ffd780',
  ink: '#3a1440',
  shadow: '#7a2d58',
  ok: ['#2ee59a', '#0f8a5a', '#06452e'] as const,
  pass: ['#ffb25c', '#d46a14', '#6e3005'] as const,
};
const WORD_FONT = 'Gabarito_800ExtraBold';
const FLASH_MS = 650;
const SEEN_KEY = 'tilt:seen';
const kv = defaultKV();

type Saved = { state: TTState };
type Flash = { kind: Mark; word: string; left: number } | null;

/** Sizes in % of the short side (s) and the long side (l) of the sideways screen. */
function useUnits() {
  const { width, height } = useWindowDimensions();
  const S = Math.min(width, height);
  const L = Math.max(width, height);
  return { s: (n: number) => (n * S) / 100, l: (n: number) => (n * L) / 100 };
}

/** This screen only is sideways (Yazan TT2); the app goes back upright when it closes. */
function useSideways() {
  useEffect(() => {
    useSidewaysFrame.setState({ on: true });
    return () => useSidewaysFrame.setState({ on: false });
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);
}

/** Accelerometer readings while `on`; `ok` is false on a phone (or the web preview) without one. */
function useMotion(on: boolean, onReading: (r: Reading) => void) {
  const [ok, setOk] = useState(false);
  const cb = useRef(onReading);
  useEffect(() => {
    cb.current = onReading;
  });
  useEffect(() => {
    let live = true;
    // A sensor that says it exists but can't be listened to (some browsers) falls back to the tap buttons.
    const listens = () => {
      try {
        Accelerometer.addListener(() => {}).remove();
        return true;
      } catch {
        return false;
      }
    };
    Accelerometer.isAvailableAsync()
      .then((a) => live && setOk(a && listens()))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!on || !ok) return;
    Accelerometer.setUpdateInterval(50);
    const sub = Accelerometer.addListener((r) => cb.current(r));
    return () => sub.remove();
  }, [on, ok]);
  return ok;
}

/** A buzz the holder feels (they can't see the screen). Android haptics need no vibrate permission. */
function buzz(kind: Mark) {
  if (Platform.OS === 'android') void Haptics.performAndroidHapticsAsync(kind === 'right' ? Haptics.AndroidHaptics.Confirm : Haptics.AndroidHaptics.Reject).catch(() => {});
  else if (Platform.OS === 'ios') void Haptics.notificationAsync(kind === 'right' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** A bookmarked game picks up at the turn it stopped in: a turn that was running starts again from its hand-off. */
function resumeOrStart(play: PlayProps['play'], seats: Seat[], teams: Team[]): Saved {
  const r = play.resume as Saved | null;
  if (r?.state?.turns?.length) {
    const s = r.state;
    if (s.phase === 'play') return { state: { ...s, phase: 'handoff', showing: null, turns: s.turns.map((t, i) => (i === s.at ? { ...t, words: [] } : t)) } };
    return r;
  }
  return { state: newGame(seats, teams, Number(play.settings.rounds) || 1, []) };
}

export function Play({ play, onFinish, onQuit }: PlayProps) {
  useSideways();
  const { s: vs, l: vl } = useUnits();
  const seats = useMemo(() => play.seats.filter((x) => !x.removed), [play.seats]);
  const teams = useMemo(() => teamsOf(play) ?? [], [play]);
  const bySeat = useMemo(() => new Map(seats.map((x) => [x.seat, x])), [seats]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const setting = Number(play.settings.time) || 60;
  const act = play.settings.clue === 'act';
  // The words in the ticked categories (no ticks taken off = all mixed).
  const pool = useMemo(() => {
    const ticked = tickedFields(play.settings);
    return BANK.filter((w) => ticked == null || ticked.includes(w.c)).map((w) => w.id);
  }, [play.settings]);

  const [st, setSt] = useState<Saved>(() => resumeOrStart(play, seats, teams));
  const ref = useRef(st);
  const seen = useRef<Set<string> | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [count, setCount] = useState<number | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const left = useRef<number | null>(null);
  const [frozen, setFrozen] = useState<number | null>(null);
  const tilt = useRef<TiltState>(freshTilt());
  const hold = useRef<number | null>(null);

  // The word face comes with the loading page; load it here too for a resumed game.
  useEffect(() => {
    void loadFonts([WORD_FONT]).catch(() => {});
  }, []);
  // Words already seen on this phone come back only after every word in the chosen categories was shown (TT16).
  useEffect(() => {
    kv.get<string[]>(SEEN_KEY)
      .then((x) => (seen.current = new Set(x ?? [])))
      .catch(() => (seen.current = new Set()))
      .finally(() => setReady(true));
  }, []);
  const saveSeen = () => void kv.set(SEEN_KEY, [...(seen.current ?? [])]).catch(() => {});

  /** Keeps a few words queued, unseen ones first; a used-up pool starts over. */
  const topUp = useCallback(
    (s: TTState): TTState => {
      if (s.deck.length >= 5) return s;
      const have = new Set([...s.deck, ...(current(s)?.words.map((w) => w.id) ?? [])]);
      const seenSet = seen.current ?? new Set<string>();
      const { deck, reset } = freshDeck(pool, new Set([...seenSet, ...have]));
      if (reset) for (const id of pool) seenSet.delete(id);
      return { ...s, deck: [...s.deck, ...deck.filter((id) => !have.has(id))] };
    },
    [pool],
  );

  const commit = useCallback(
    (next: TTState) => {
      if (next.showing) seen.current?.add(next.showing);
      const saved = { state: next };
      ref.current = saved;
      setSt(saved);
    },
    [],
  );
  const bookmark = useCallback((s: TTState) => engine.recorder.bookmark(play.id, { state: s }, seatScores(s).get(0) ?? 0), [play.id]);
  useEffect(() => {
    bookmark(ref.current.state);
  }, [bookmark]);

  const s = st.state;
  const turn = current(s);
  const holder = turn ? bySeat.get(turn.seat) : undefined;
  const team = turn ? teamById.get(turn.team) : undefined;
  const secs = turnSeconds(turn, setting);

  // ---- the turn ----
  const begin = useCallback(() => {
    if (ref.current.state.phase !== 'handoff') return;
    setCount(null);
    hold.current = null;
    tilt.current = freshTilt();
    commit(startTurn(topUp(ref.current.state)));
    setEndsAt(Date.now() + turnSeconds(current(ref.current.state), setting) * 1000);
  }, [commit, topUp, setting]);

  const countdown = useCallback(() => {
    if (count != null) return;
    setCount(3);
    void sfx('tap');
  }, [count]);
  useEffect(() => {
    if (count == null || paused) return;
    const id = setTimeout(() => {
      if (count <= 1) begin();
      else {
        setCount(count - 1);
        void sfx('tap');
      }
    }, 800);
    return () => clearTimeout(id);
  }, [count, paused, begin]);

  const onMark = useCallback(
    (m: Mark) => {
      const cur = ref.current.state;
      if (cur.phase !== 'play' || !cur.showing || flash) return;
      if (m === 'pass' && cur.passesLeft <= 0) return;
      const word = wordById.get(cur.showing)?.w ?? '';
      commit(topUp(mark(cur, m)));
      setFlash({ kind: m, word, left: m === 'pass' ? cur.passesLeft - 1 : cur.passesLeft });
      void sfx(m === 'right' ? 'right' : 'pass');
      buzz(m);
    },
    [commit, topUp, flash],
  );
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(id);
  }, [flash]);

  const timeUp = useCallback(() => {
    setEndsAt(null);
    setFlash(null);
    commit(endTurn(ref.current.state));
    saveSeen();
    void sfx('timeup');
  }, [commit]);
  const now = useTicker(s.phase === 'play' && !paused && endsAt != null, 200, (n) => {
    if (endsAt != null && n >= endsAt) timeUp();
  });

  // ---- sensors: the forehead check before the count, the tilts during the turn ----
  const sensing = !paused && (s.phase === 'play' || (s.phase === 'handoff' && count == null && ready));
  const motion = useMotion(sensing, (r) => {
    const t = Date.now();
    const cur = ref.current.state;
    if (cur.phase === 'handoff') {
      hold.current = stepHold(hold.current, r, t);
      if (held(hold.current, t)) countdown();
      return;
    }
    const out = stepTilt(tilt.current, r, t);
    tilt.current = out.st;
    if (out.tilt) onMark(out.tilt === 'down' ? 'right' : 'pass');
  });

  // ---- review and the end ----
  const next = () => {
    const cur = ref.current.state;
    const t = current(cur);
    if (!t) return;
    for (const w of t.words)
      void recordItem(
        play,
        {
          seat: t.seat,
          itemId: w.id,
          answerKey: null,
          outcome: w.mark === 'right' ? 'right' : 'skipped',
          answersGiven: [],
          timeMs: 0,
          hintsUsed: 0,
          revealsUsed: 0,
          points: w.mark === 'right' ? 1 : 0,
          feedsLearn: false,
          gameData: { team: t.team, sudden: !!t.sudden, category: wordById.get(w.id)?.c },
        },
        true,
      );
    const after = confirm(cur, seats, teams);
    commit(after);
    bookmark(after);
    if (after.phase === 'over') {
      const sc = seatScores(after);
      const rows = seats.map((x) => ({ seat: x.seat, name: x.name, score: sc.get(x.seat) ?? 0, timeMs: 0 }));
      onFinish(sc.get(0) ?? 0, rank(rows));
    }
  };

  // ---- pause (the menu button, or the app going to the background) ----
  const pause = () => {
    if (ref.current.state.phase === 'play' && endsAt != null) left.current = Math.max(0, endsAt - Date.now());
    setFrozen(left.current);
    setPaused(true);
  };
  const resume = () => {
    if (left.current != null) setEndsAt(Date.now() + left.current);
    left.current = null;
    setFrozen(null);
    tilt.current = freshTilt();
    hold.current = null;
    setPaused(false);
  };
  usePauseHide(pause);

  const remaining = s.phase === 'play' && endsAt != null ? Math.max(0, (paused && frozen != null ? frozen : endsAt - now) / 1000) : secs;
  const totals = teamTotals(s, teams);
  const nextTurn = s.turns[s.at + 1];
  const nextName = nextTurn ? bySeat.get(nextTurn.seat)?.name : undefined;
  const nextTeam = nextTurn ? teamById.get(nextTurn.team)?.name : undefined;
  // The last turn ended level at the top: sudden death comes next (once).
  const tiedNow = !nextTurn && leaders(s, teams).length > 1 && !s.turns.some((t) => t.sudden);
  const rounds = Number(play.settings.rounds) || 1;
  const perRound = Math.max(1, s.turns.filter((t) => !t.sudden).length / rounds);
  const round = Math.min(rounds, Math.floor(s.at / perRound) + 1);

  const T = (sz: number, extra?: object) => ({ fontSize: vs(sz), lineHeight: vs(sz * 1.18), ...extra });
  let body: ReactNode = null;

  if (paused) {
    body = (
      <View style={st_.center}>
        <Text style={[st_.name, T(13), { fontFamily: WORD_FONT }]}>Paused</Text>
        <Text style={[st_.hint, T(5.2), { maxWidth: vl(60) }]}>The clock is stopped and the word is hidden.</Text>
        <View style={{ flexDirection: 'row', gap: vl(2), marginTop: vs(4) }}>
          <Pill label="Resume" onPress={resume} gold vs={vs} />
          <Pill label="Quit game" onPress={onQuit} vs={vs} />
        </View>
      </View>
    );
  } else if (s.phase === 'handoff' && holder && team) {
    body = (
      <View style={st_.center}>
        <Text style={[st_.tag, T(4.6, { letterSpacing: vs(1) })]}>
          {turn?.sudden ? `Sudden death · ${team.name}` : `${team.name} · Round ${round} of ${rounds}`}
        </Text>
        <Text style={[st_.name, T(16), { fontFamily: WORD_FONT, textShadowOffset: { width: 0, height: vs(1) } }]} numberOfLines={1} adjustsFontSizeToFit>
          {holder.name}
        </Text>
        {count != null ? (
          <Text style={[st_.count, T(22), { fontFamily: WORD_FONT }]}>{String(count)}</Text>
        ) : (
          <Text style={[st_.hint, T(5.2), { maxWidth: vl(64) }]}>
            {motion ? 'Hold the phone on your forehead, screen facing your team. The clock starts by itself.' : 'Hold the phone on your forehead, screen facing your team, and tap Start.'}
          </Text>
        )}
        <View style={[st_.modePill, { paddingHorizontal: vl(2.4), paddingVertical: vs(1.2), borderRadius: vs(10) }]}>
          <Text style={[st_.modeText, T(4.4)]}>{`${act ? 'Act it out' : 'Describe it'} · ${secs} s`}</Text>
        </View>
      </View>
    );
  } else if (s.phase === 'play' && turn) {
    const w = s.showing ? wordById.get(s.showing) : undefined;
    const lights = 12;
    const lit = Math.ceil((remaining / secs) * lights);
    body = (
      <>
        <View style={[st_.hud, { top: vs(9), left: vl(4.5) + vs(10), right: vl(4.5) + vs(10) }]}>
          <Chip text={`${team?.name ?? ''} · ${totals.get(turn.team) ?? 0}`} vs={vs} vl={vl} />
          <Text style={[st_.timer, T(9), { fontFamily: WORD_FONT }]}>{String(Math.ceil(remaining))}</Text>
          <Chip text={`Passes ${s.passesLeft}`} vs={vs} vl={vl} />
        </View>
        <View style={st_.center}>
          <Text style={[st_.word, T(w && w.w.length > 16 ? 13 : 19), { fontFamily: WORD_FONT, maxWidth: vl(82), textShadowOffset: { width: 0, height: vs(1) } }]} numberOfLines={2} adjustsFontSizeToFit>
            {w?.w ?? ''}
          </Text>
          <Text style={[st_.cat, T(4.4, { letterSpacing: vs(1) })]}>{w ? catLabel(w.c).toUpperCase() : ''}</Text>
        </View>
        <View style={[st_.lights, { left: vl(8), right: vl(8), bottom: vs(9), gap: vl(1.2) }]}>
          {Array.from({ length: lights }, (_, i) => (
            <View key={i} style={[st_.light, { height: vs(2.4), borderRadius: vs(2) }, i < lit ? st_.on : st_.off]} />
          ))}
        </View>
        {/* Backup taps (TT: tilt not working, or the web preview): small, at the far ends. */}
        <Pressable onPress={() => onMark('pass')} style={[st_.edge, { left: vl(2), bottom: vs(14), padding: vs(2.4), borderRadius: vs(8) }]} accessibilityLabel="Pass">
          <Text style={[st_.edgeText, T(4)]}>Pass</Text>
        </Pressable>
        <Pressable onPress={() => onMark('right')} style={[st_.edge, { right: vl(2), bottom: vs(14), padding: vs(2.4), borderRadius: vs(8) }]} accessibilityLabel="Correct">
          <Text style={[st_.edgeText, T(4)]}>Correct</Text>
        </Pressable>
      </>
    );
  } else if (s.phase === 'review' && turn && holder) {
    body = (
      <View style={[st_.review, { top: vs(10), bottom: vs(10), left: vl(8), right: vl(8), gap: vs(3) }]}>
        <View style={st_.row}>
          <Text style={[st_.name, T(8), { fontFamily: WORD_FONT, textAlign: 'left' }]}>{holder.name === 'You' ? 'Your turn' : `${holder.name}'s turn`}</Text>
          <Text style={[st_.timer, T(11), { fontFamily: WORD_FONT }]}>{`+${points(turn)}`}</Text>
        </View>
        <View style={[st_.cards, { gap: vs(2) }]}>
          {turn.words.length ? (
            turn.words.map((x, i) => (
              <Pressable
                key={x.id + i}
                onPress={() => commit(fix(ref.current.state, i))}
                style={[st_.card, x.mark === 'right' ? st_.cardOk : st_.cardPass, { paddingHorizontal: vl(1.6), paddingVertical: vs(1.4), borderRadius: vs(2) }]}
                accessibilityLabel={`${wordById.get(x.id)?.w ?? x.id}, ${x.mark === 'right' ? 'correct' : 'passed'}. Tap to change.`}>
                <Text style={[x.mark === 'right' ? st_.okText : st_.passText, T(4.6)]}>{`${x.mark === 'right' ? '✓' : '↷'} ${wordById.get(x.id)?.w ?? x.id}`}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={[st_.hint, T(5)]}>No words this turn.</Text>
          )}
        </View>
        <View style={[st_.row, { marginTop: 'auto' }]}>
          <Text style={[st_.hint, T(4.2), { textAlign: 'left', flexShrink: 1 }]}>Tap a word to fix a wrong tilt.</Text>
          <Pill
            label={nextTurn ? `Next: ${nextName} · ${nextTeam}` : tiedNow ? 'Sudden death!' : 'See results'}
            onPress={next}
            gold
            vs={vs}
          />
        </View>
      </View>
    );
  }

  const fl = flash;
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[C.glow, C.plum, C.deep]} locations={[0, 0.55, 1]} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* The spotlight: one soft cone from the top, drawn once. */}
      <LinearGradient colors={['rgba(255,230,180,0.18)', 'rgba(255,230,180,0)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[st_.beam, { left: vl(30), right: vl(30) }]} />
      <Bulbs vs={vs} vl={vl} />
      {body}
      {fl ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LinearGradient colors={fl.kind === 'right' ? [...C.ok] : [...C.pass]} locations={[0, 0.6, 1]} start={{ x: 0.5, y: 0.3 }} end={{ x: 0.5, y: 1.2 }} style={StyleSheet.absoluteFill} />
          <View style={st_.center}>
            <Text style={[st_.burst, T(7, { letterSpacing: vs(0.4) }), { fontFamily: WORD_FONT }]}>{fl.kind === 'right' ? 'GOT IT! +1' : `PASS · ${fl.left} LEFT`}</Text>
            <Text style={[st_.word, T(fl.word.length > 16 ? 13 : 19), { fontFamily: WORD_FONT, maxWidth: vl(82), textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: vs(1) } }]} numberOfLines={2} adjustsFontSizeToFit>
              {fl.word}
            </Text>
          </View>
        </View>
      ) : null}
      {/* Top corners: pause, and on the hand-off the team scores and a Start for phones without a motion sensor. */}
      {!paused && s.phase !== 'over' ? (
        <Pressable onPress={pause} style={[st_.pause, { top: vs(6), left: vl(3), width: vs(10), height: vs(10), borderRadius: vs(5) }]} accessibilityLabel="Pause">
          <Text style={[st_.edgeText, T(4.4)]}>II</Text>
        </Pressable>
      ) : null}
      {!paused && s.phase === 'handoff' ? (
        <>
          <View style={[st_.scores, { top: vs(7), right: vl(3), gap: vl(1) }]}>
            {teams.map((t) => (
              <Chip key={t.id} text={`${t.name} · ${totals.get(t.id) ?? 0}`} dot={t.color} vs={vs} vl={vl} />
            ))}
          </View>
          {count == null ? (
            <View style={[st_.startWrap, { bottom: vs(9) }]}>
              <Pill label="Start" onPress={countdown} gold={!motion} vs={vs} disabled={!ready} />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** The marquee: one row of bulbs along the top and one along the bottom, drawn once (no animation, light on the GPU). */
function Bulbs({ vs, vl }: { vs: (n: number) => number; vl: (n: number) => number }) {
  const n = 26;
  const row = (top: boolean) => (
    <View style={[st_.bulbRow, top ? { top: vs(3) } : { bottom: vs(3) }, { left: vl(4), right: vl(4) }]} pointerEvents="none">
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={[st_.bulb, { width: vs(1.8), height: vs(1.8), borderRadius: vs(1), shadowRadius: vs(1.4) }]} />
      ))}
    </View>
  );
  return (
    <>
      {row(true)}
      {row(false)}
    </>
  );
}

function Chip({ text, dot, vs, vl }: { text: string; dot?: string; vs: (n: number) => number; vl: (n: number) => number }) {
  return (
    <View style={[st_.chip, { paddingHorizontal: vl(1.6), paddingVertical: vs(1.2), borderRadius: vs(10), gap: vl(0.8) }]}>
      {dot ? <View style={{ width: vs(2.2), height: vs(2.2), borderRadius: vs(1.2), backgroundColor: dot }} /> : null}
      <Text style={[st_.chipText, { fontSize: vs(4.4), lineHeight: vs(5.4) }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function Pill({ label, onPress, gold, disabled, vs }: { label: string; onPress: () => void; gold?: boolean; disabled?: boolean; vs: (n: number) => number }) {
  return (
    <Pressable
      onPress={() => {
        void sfx('tap');
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[st_.pill, gold ? st_.pillGold : st_.pillGhost, { paddingHorizontal: vs(6), paddingVertical: vs(2.6), borderRadius: vs(10), opacity: disabled ? 0.5 : 1 }]}>
      <Text style={[gold ? st_.pillGoldText : st_.pillGhostText, { fontSize: vs(4.8), lineHeight: vs(6) }]}>{label}</Text>
    </Pressable>
  );
}

const st_ = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  beam: { position: 'absolute', top: 0, bottom: '25%', borderBottomLeftRadius: 400, borderBottomRightRadius: 400 },
  tag: { fontFamily: F.bodyBold, color: C.pink, textTransform: 'uppercase', textAlign: 'center' },
  name: { color: C.cream, textAlign: 'center', textShadowColor: C.shadow, textShadowRadius: 0 },
  count: { color: C.gold, textAlign: 'center' },
  hint: { fontFamily: F.bodyMedium, color: C.soft, textAlign: 'center' },
  modePill: { backgroundColor: C.gold },
  modeText: { fontFamily: F.bodyBold, color: C.ink },
  hud: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,244,227,0.1)', borderWidth: 1, borderColor: 'rgba(255,244,227,0.22)' },
  chipText: { fontFamily: F.bodyBold, color: C.cream },
  timer: { color: C.gold, textAlign: 'center' },
  word: { color: C.cream, textAlign: 'center', textShadowColor: C.shadow, textShadowRadius: 0 },
  cat: { fontFamily: F.bodyBold, color: C.pink, textAlign: 'center' },
  lights: { position: 'absolute', flexDirection: 'row' },
  light: { flex: 1 },
  on: { backgroundColor: C.gold, shadowColor: C.gold, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  off: { backgroundColor: 'rgba(255,244,227,0.14)' },
  edge: { position: 'absolute', backgroundColor: 'rgba(255,244,227,0.08)', borderWidth: 1, borderColor: 'rgba(255,244,227,0.2)', zIndex: 3 },
  edgeText: { fontFamily: F.bodyBold, color: C.soft, textAlign: 'center' },
  burst: { color: '#fff', textAlign: 'center' },
  review: { position: 'absolute' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cards: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { borderWidth: 1 },
  cardOk: { backgroundColor: 'rgba(46,229,154,0.18)', borderColor: 'rgba(46,229,154,0.6)' },
  cardPass: { backgroundColor: 'rgba(255,178,92,0.14)', borderColor: 'rgba(255,178,92,0.7)', borderStyle: 'dashed' },
  okText: { fontFamily: F.bodyBold, color: '#c9ffe6' },
  passText: { fontFamily: F.bodyBold, color: '#ffe0bb' },
  pill: { alignItems: 'center', justifyContent: 'center' },
  pillGold: { backgroundColor: C.gold },
  pillGhost: { backgroundColor: 'rgba(255,244,227,0.1)', borderWidth: 1, borderColor: 'rgba(255,244,227,0.3)' },
  pillGoldText: { fontFamily: F.bodyBold, color: C.ink },
  pillGhostText: { fontFamily: F.bodyBold, color: C.cream },
  pause: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,244,227,0.08)', borderWidth: 1, borderColor: 'rgba(255,244,227,0.2)', zIndex: 4 },
  scores: { position: 'absolute', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '60%', zIndex: 3 },
  startWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 3 },
  bulbRow: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  bulb: { backgroundColor: C.gold, shadowColor: C.gold, shadowOpacity: 0.9, shadowOffset: { width: 0, height: 0 } },
});
