import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/AppText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { tapped } from '@/lib/sound';

import { Card as Panel, GameScreen, Kick, RoundBtn } from '../shell/ui';
import type { Card, CardColor, ClueNumber, Team } from './engine/types';
import type { Split } from './offline';

// Code Clinic's screens in the app look, dark only. Shared by Pass the phone and Online.

export const TEAM: Record<Team, { name: string; color: string; deep: string }> = {
  red: { name: 'Red', color: '#ff5c6c', deep: '#5a1820' },
  blue: { name: 'Blue', color: '#4f9dff', deep: '#14305e' },
};
const NEUTRAL = { color: '#c9b48a', deep: '#3a3326' };
const DEADLY = { color: '#ff3b3b', deep: '#07070b' };

const fill = (c: CardColor) => (c === 'red' || c === 'blue' ? TEAM[c].deep : c === 'neutral' ? NEUTRAL.deep : DEADLY.deep);
const edge = (c: CardColor) => (c === 'red' || c === 'blue' ? TEAM[c].color : c === 'neutral' ? NEUTRAL.color : DEADLY.color);

/** The game page: whose turn on top, the pause button, then the phase's own body. */
export function ClinicScreen({ turn, remaining, onPause, children, bottom }: { turn: Team | null; remaining: Record<Team, number>; onPause: () => void; children: ReactNode; bottom?: ReactNode }) {
  const t = useTheme();
  return (
    <GameScreen scroll bottom={bottom}>
      <View style={s.top}>
        <View style={s.score}>
          {(['red', 'blue'] as const).map((tm) => (
            <View
              key={tm}
              style={[
                s.pill,
                {
                  borderColor: turn === tm ? TEAM[tm].color : t.chipLine,
                  backgroundColor: turn === tm ? TEAM[tm].deep : t.chip,
                },
              ]}
            >
              <View style={[s.dot, { backgroundColor: TEAM[tm].color }]} />
              <Text style={[s.pillT, { color: t.white }]}>{`${TEAM[tm].name} ${remaining[tm]}`}</Text>
            </View>
          ))}
        </View>
        <RoundBtn label="Pause" glyph="❚❚" onPress={onPause} />
      </View>
      {children}
    </GameScreen>
  );
}

/**
 * The 5 x 5 board, styled like the paper game: beige word cards that flip over to their picture when turned. With
 * `showKey` on (the spymaster holding the key) each hidden card takes its key colour round the edge. `marked` is a card
 * picked once and waiting for the second tap; `fade` dims the hidden key cards at the end of a game.
 */
export function Board({
  cards,
  showKey,
  onTap,
  marked,
  disabled,
  fade,
}: {
  cards: Card[];
  showKey?: boolean;
  onTap?: (i: number) => void;
  marked?: number | null;
  disabled?: boolean;
  fade?: boolean;
}) {
  const [w, setW] = useState(0);
  const gap = u(4);
  // Rounded down so five always fit in a row.
  const cw = w ? Math.floor((w - gap * 4) / 5) - 1 : 0;
  return (
    <View style={[s.board, { gap }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {cw
        ? cards.map((c) => (
            <CardTile
              key={c.index}
              card={c}
              cw={cw}
              keyed={!!showKey && !c.revealed}
              marked={marked === c.index}
              fade={!!fade}
              onPress={onTap && !disabled && !c.revealed ? () => onTap(c.index) : undefined}
            />
          ))
        : null}
    </View>
  );
}

export const BACK = {
  red: require('../../../assets/games/codeclinic/back-red.webp'),
  blue: require('../../../assets/games/codeclinic/back-blue.webp'),
  neutral: require('../../../assets/games/codeclinic/back-neutral.webp'),
  assassin: require('../../../assets/games/codeclinic/back-assassin.webp'),
} as const;

/** One card: the beige front with the word (and the word upside down, as on the paper cards), the picture on the back. */
function CardTile({ card: c, cw, keyed, marked, fade, onPress }: { card: Card; cw: number; keyed: boolean; marked: boolean; fade: boolean; onPress?: () => void }) {
  const t = useTheme();
  const ch = cw * 0.72;
  // Already turned when the board first shows (a rejoin or a rematch screen): no flip, just the back.
  const [turn] = useState(() => new Animated.Value(c.revealed ? 1 : 0));
  useEffect(() => {
    Animated.timing(turn, { toValue: c.revealed ? 1 : 0, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [c.revealed, turn]);
  const front = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const back = turn.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const lines = wrapWord(c.term);
  // Never cut a word: long words go over two lines and the font shrinks to fit the longest line.
  const fs = Math.min(cw * 0.15, (cw - 16) / (Math.max(...lines.map((x) => x.length)) * 0.62));
  const ink = keyed ? edge(c.color) : PAPER.line;
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress ? tapped(onPress) : undefined}
      style={[{ width: cw, height: ch }, marked ? { transform: [{ scale: 1.08 }], zIndex: 2 } : null, keyed && fade ? { opacity: 0.5 } : null]}
      accessibilityRole="button"
      accessibilityLabel={c.revealed ? `${c.term}, ${c.color === 'assassin' ? 'deadly' : c.color}` : c.term}
    >
      <Animated.View
        style={[
          s.face,
          { backgroundColor: keyed ? fill(c.color) : PAPER.card, borderColor: marked ? t.accent : ink, borderWidth: marked || keyed ? 2 : 1, transform: [{ perspective: 600 }, { rotateY: front }] },
        ]}
      >
        <Text style={[s.flipWord, { fontSize: fs * 0.55, color: keyed ? 'rgba(255,255,255,0.45)' : PAPER.faint }]} numberOfLines={1}>
          {c.term}
        </Text>
        <View style={[s.label, { backgroundColor: PAPER.label, borderColor: keyed ? edge(c.color) : PAPER.line }]}>
          <Text style={[s.word, { fontSize: fs, lineHeight: fs * 1.12, color: PAPER.ink }]}>{lines.join('\n')}</Text>
        </View>
        {keyed && c.color === 'assassin' ? <Text style={[s.skull, { color: DEADLY.color }]}>DEADLY</Text> : null}
      </Animated.View>
      <Animated.View style={[s.face, s.backFace, { borderColor: edge(c.color), transform: [{ perspective: 600 }, { rotateY: back }] }]}>
        <Image source={BACK[c.color]} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={s.backTag}>
          <Text style={[s.backWord, { fontSize: Math.max(7, fs * 0.62), textDecorationLine: c.color === 'assassin' ? 'line-through' : 'none' }]} numberOfLines={1}>
            {c.term}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const PAPER = { card: '#e3d0a2', label: '#f8f2e2', line: '#bfa671', ink: '#2a2216', faint: 'rgba(42,34,22,0.32)' };

const V = (ch: string | undefined) => !!ch && /[aeiouy]/i.test(ch);
// Letter pairs that sound as one and are never split, and medical word parts to split at first.
const PAIRS = /^(ph|th|ch|sh|rh|pl|pr|tr|br|cr|gr|dr|bl|cl|fl|gl|ps|pn|sc|sp|st|qu|gn|ck)$/;
const STARTS = [
  'hyper',
  'hypo',
  'anti',
  'endo',
  'neuro',
  'cardio',
  'gastro',
  'trans',
  'inter',
  'poly',
  'immuno',
  'electro',
  'broncho',
  'pneumo',
  'osteo',
  'chondro',
  'pseudo',
  'phospho',
  'glyco',
  'lipo',
  'cyto',
  'hemo',
  'thyro',
  'nephro',
  'myelo',
  'chromo',
  'spondylo',
  'sarco',
  'thermo',
  'photo',
  'mechano',
  'pharmaco',
  'radio',
  'micro',
  'macro',
  'oligo',
  'angio',
  'arthro',
  'carcino',
  'entero',
  'hepato',
  'histo',
  'leuko',
  'lympho',
  'onco',
  'patho',
  'proprio',
  'psycho',
  'sclero',
  'tele',
  'tracheo',
  'uro',
  'myo',
];
const ENDS = [
  'ectomy',
  'otomy',
  'ostomy',
  'oscopy',
  'scopy',
  'plasty',
  'itis',
  'osis',
  'ology',
  'emia',
  'therapy',
  'pathy',
  'graphy',
  'gram',
  'lysis',
  'genesis',
  'phobia',
  'philia',
  'trophy',
  'algia',
  'rrhea',
  'rrhage',
  'megaly',
  'plasia',
  'cyte',
  'blast',
  'clast',
  'ization',
  'ation',
  'tion',
  'sion',
  'some',
  'meter',
  'metry',
  'lith',
  'iasis',
  'oma',
  'uria',
  'pnea',
  'mycin',
  'mab',
  'axis',
  'logy',
];

/** Words over 10 letters go over two lines with a hyphen: at a word part, else between syllables, near the middle. */
export function wrapWord(word: string): string[] {
  if (word.length <= 10) return [word];
  const w = word.toLowerCase();
  const mid = word.length / 2;
  let best = Math.ceil(mid);
  let score = -99;
  for (let p = 3; p <= word.length - 3; p++) {
    const [a, b, c, d] = [w[p - 2], w[p - 1], w[p], w[p + 1]];
    let sc = 0;
    if (STARTS.some((x) => x.length === p && w.startsWith(x)) || ENDS.some((x) => w.length - x.length === p && w.endsWith(x))) sc = 4;
    else if (PAIRS.test(b + c) || PAIRS.test(c + (d ?? ''))) sc = V(b) && PAIRS.test(c + (d ?? '')) ? 2 : -2;
    else if (V(a) && !V(b) && !V(c) && V(d)) sc = 3;
    else if (V(b) && !V(c) && V(d)) sc = 2;
    sc -= Math.abs(p - mid) * 0.6 + Math.max(0, Math.max(p, word.length - p) - 10);
    if (sc > score) {
      score = sc;
      best = p;
    }
  }
  return [`${word.slice(0, best)}-`, word.slice(best)];
}

/**
 * The spymaster's key, like the paper key card in its stand: the 25 squares in board order, then what each colour
 * means. Without `colors` only the meaning row shows.
 */
export function KeyLegend({ colors }: { colors?: readonly CardColor[] | null }) {
  const t = useTheme();
  const row = [
    { c: TEAM.red.color, l: 'Red' },
    { c: TEAM.blue.color, l: 'Blue' },
    { c: NEUTRAL.color, l: 'Neutral' },
    { c: DEADLY.color, l: 'Deadly: loses the game' },
  ];
  const sq = u(15);
  return (
    <View style={s.keyWrap}>
      {colors && colors.length === 25 ? (
        <View style={s.keyCard}>
          <View style={[s.keyGrid, { width: sq * 5 + u(3) * 4 + u(8) }]}>
            {colors.map((c, i) => (
              <View
                key={i}
                style={[
                  s.keySq,
                  { width: sq, height: sq, backgroundColor: c === 'neutral' ? PAPER.card : c === 'assassin' ? '#111' : edge(c), borderColor: c === 'assassin' ? DEADLY.color : 'rgba(0,0,0,0.25)' },
                ]}
              >
                {c === 'assassin' ? <Text style={{ color: DEADLY.color, fontSize: u(9), lineHeight: u(11), fontFamily: F.bodyBold }}>✕</Text> : null}
              </View>
            ))}
          </View>
          <View style={s.keyFoot} />
        </View>
      ) : null}
      <View style={s.legend}>
        {row.map((x) => (
          <View key={x.l} style={s.legendI}>
            <View style={[s.dot, { backgroundColor: x.c }]} />
            <Text style={[s.small, { color: t.mute }]}>{x.l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Hold to see the key: it shows only while the finger is down. */
export function HoldKey({ team, onHold, onRelease, held }: { team: Team; onHold: () => void; onRelease: () => void; held: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPressIn={onHold}
      onPressOut={onRelease}
      style={[
        s.hold,
        {
          borderColor: held ? TEAM[team].color : t.panelLine,
          backgroundColor: held ? TEAM[team].deep : t.panel,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Hold to see the key"
    >
      <Text style={[s.holdT, { color: held ? t.white : t.soft }]}>{held ? 'Showing the key' : '◉  Hold to see the key'}</Text>
      <Text style={[s.small, { color: t.dim }]}>{held ? 'Let go to hide it' : 'Spymaster only. Keep it hidden from the guessers'}</Text>
    </Pressable>
  );
}

/** A clock that turns amber in the last 10 seconds. */
export function Clock({ ms, warnAt = 10_000 }: { ms: number; warnAt?: number }) {
  const t = useTheme();
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return <Text style={[s.clock, { color: ms <= warnAt ? '#f0b54a' : t.white }]}>{`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`}</Text>;
}

/** A team's name in its colour, with a line under it. */
export function TeamHead({ team, lead, sub }: { team: Team; lead: string; sub?: string }) {
  const t = useTheme();
  return (
    <View style={s.head}>
      <Kick>{lead}</Kick>
      <Text style={[s.headT, { color: TEAM[team].color }]} numberOfLines={1}>
        {`${TEAM[team].name} team`}
      </Text>
      {sub ? <Text style={[s.sub, { color: t.mute }]}>{sub}</Text> : null}
    </View>
  );
}

/** The clue number picker: 1 to 9, or unlimited. */
export function NumberPick({ value, onPick, team }: { value: ClueNumber | null; onPick: (n: ClueNumber) => void; team: Team }) {
  const t = useTheme();
  const all: ClueNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'unlimited'];
  return (
    <View style={s.nums}>
      {all.map((n) => {
        const on = value === n;
        return (
          <Pressable
            key={String(n)}
            onPress={tapped(() => onPick(n))}
            style={[
              s.num,
              n === 'unlimited' ? { width: u(64) } : null,
              {
                borderColor: on ? TEAM[team].color : t.chipLine,
                backgroundColor: on ? TEAM[team].deep : t.chip,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={n === 'unlimited' ? 'Unlimited' : `${n}`}
          >
            <Text style={[s.numT, { color: on ? t.white : t.fg }]}>{n === 'unlimited' ? '∞' : n}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Pass the phone teams: tap a name to move it to the other team, the star to make that player the spymaster. */
export function TeamPicker({ split, nameOf, onMove, onSpy }: { split: Split; nameOf: (seat: number) => string; onMove: (seat: number, to: Team) => void; onSpy: (team: Team, i: number) => void }) {
  const t = useTheme();
  return (
    <>
      {(['red', 'blue'] as const).map((team) => (
        <Panel key={team} style={{ borderColor: TEAM[team].color }}>
          <Kick color={TEAM[team].color}>{`${TEAM[team].name} team`}</Kick>
          {split[team].map((seat, i) => {
            const spy = split.spymaster[team] === i;
            return (
              <View key={seat} style={s.row}>
                <Pressable onPress={tapped(() => onSpy(team, i))} accessibilityRole="button" accessibilityLabel={`Make ${nameOf(seat)} spymaster`} hitSlop={8}>
                  <Text style={{ fontSize: u(16), lineHeight: u(20), color: spy ? TEAM[team].color : t.dim }}>{spy ? '★' : '☆'}</Text>
                </Pressable>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={tapped(() => onMove(seat, team === 'red' ? 'blue' : 'red'))}
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${nameOf(seat)} to the other team`}
                >
                  <Text style={[s.rowN, { color: t.fg }]} numberOfLines={1}>
                    {nameOf(seat)}
                  </Text>
                </Pressable>
                <Text style={[s.tag, { color: spy ? TEAM[team].color : t.dim }]}>{spy ? 'SPYMASTER' : 'GUESSER'}</Text>
              </View>
            );
          })}
        </Panel>
      ))}
    </>
  );
}

export const clueText = (n: ClueNumber) => (n === 'unlimited' ? 'unlimited' : String(n));

export const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  score: { flex: 1, flexDirection: 'row', gap: u(6) },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(6),
    borderWidth: 1,
    borderRadius: u(12),
    paddingHorizontal: u(10),
    paddingVertical: u(5),
  },
  pillT: { fontFamily: F.bodyBold, fontSize: u(11.5), lineHeight: u(14) },
  dot: { width: u(8), height: u(8), borderRadius: u(4) },
  board: { flexDirection: 'row', flexWrap: 'wrap', marginTop: u(10) },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: u(6),
    alignItems: 'center',
    justifyContent: 'center',
    gap: u(1),
    padding: u(3),
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
  backFace: { borderWidth: 2, padding: 0, justifyContent: 'flex-end' },
  label: { alignSelf: 'stretch', flex: 1, borderRadius: u(3), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  flipWord: { fontFamily: F.bodySemi, transform: [{ rotate: '180deg' }], letterSpacing: 0.3 },
  word: { fontFamily: F.bodyBold, textAlign: 'center', letterSpacing: 0.2 },
  backTag: { alignSelf: 'stretch', backgroundColor: 'rgba(8,10,20,0.62)', paddingVertical: u(1) },
  backWord: { fontFamily: F.bodySemi, color: '#fff', textAlign: 'center' },
  skull: { fontFamily: F.mono, fontSize: u(6.5), marginTop: u(1) },
  keyWrap: { alignItems: 'center', gap: u(6), marginTop: u(8) },
  keyCard: { backgroundColor: '#d9dde4', borderRadius: u(10), padding: u(7), borderWidth: 2, borderColor: '#9aa3b2', alignItems: 'center' },
  keyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: u(3), backgroundColor: '#1b2030', padding: u(4), borderRadius: u(5) },
  keySq: { borderRadius: u(3), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  keyFoot: { width: u(40), height: u(4), borderRadius: u(2), backgroundColor: '#9aa3b2', marginTop: u(5) },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: u(10),
    justifyContent: 'center',
    marginTop: u(6),
  },
  legendI: { flexDirection: 'row', alignItems: 'center', gap: u(4) },
  small: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(13) },
  hold: {
    borderRadius: u(16),
    borderWidth: 1,
    paddingVertical: u(12),
    alignItems: 'center',
    gap: u(3),
  },
  holdT: { fontFamily: F.bodySemi, fontSize: u(13), lineHeight: u(17) },
  clock: {
    fontFamily: F.display,
    fontSize: u(28),
    lineHeight: u(32),
    marginTop: u(4),
    textAlign: 'center',
  },
  head: { alignItems: 'center', gap: u(3), paddingTop: u(10) },
  headT: {
    fontFamily: F.display,
    fontSize: u(28),
    lineHeight: u(32),
    textAlign: 'center',
  },
  sub: {
    fontFamily: F.body,
    fontSize: u(11.5),
    lineHeight: u(16),
    textAlign: 'center',
  },
  nums: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: u(6),
    justifyContent: 'center',
  },
  num: {
    width: u(36),
    height: u(36),
    borderRadius: u(10),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numT: { fontFamily: F.bodyBold, fontSize: u(14), lineHeight: u(18) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(8),
    paddingVertical: u(4),
  },
  rowN: {
    flex: 1,
    fontFamily: F.bodySemi,
    fontSize: u(12.5),
    lineHeight: u(16),
  },
  tag: { fontFamily: F.mono, fontSize: u(9), letterSpacing: u(0.8) },
});
