import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { useStyle, wantLooks } from '@/features/style/useStyle';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { LevelBadge, useBalance } from '@/components/LevelBadge';
import { Fade } from '@/components/Fade';
import { useSvgId } from '@/components/svgId';
import { GAMES } from '@/data/games';
import { useSession } from '@/games/shell/session';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

// Page colours from the locked preview (d-/l-leaderboard).
const C = {
  dark: {
    star: '#ffffff',
    // rank words and the pinned rank number are lilac (#c9b8ff) in the preview; accent per the standing rule
    rank: '#6fd6ff',
    pinLine: 'rgba(164,139,255,0.55)',
    pinShadow: (k: number) => `0px ${12 * k}px ${30 * k}px ${-14 * k}px rgba(143,117,255,0.8)`,
    prog: 'rgba(255,255,255,0.1)',
  },
};
const HALO = '201,184,255'; // star glow colour

// Top three as stars. cx = star centre x, top = star top (screen design px), d = star diameter, a = glow alpha.
const TOP3 = [
  { word: 'First', cx: 141, top: 139, d: 20, a: 0.9, blur: 32, spread: 7 },
  { word: 'Second', cx: 62, top: 192, d: 14, a: 0.65, blur: 22, spread: 5 },
  { word: 'Third', cx: 221.5, top: 211, d: 11, a: 0.45, blur: 18, spread: 4 },
];

type Period = 'week' | 'month' | 'all';
const PERIODS: { k: Period; label: string; empty: string }[] = [
  { k: 'week', label: 'This week', empty: 'this week' },
  { k: 'month', label: 'This month', empty: 'this month' },
  { k: 'all', label: 'All time', empty: 'yet' },
];
const SHORT: Record<Period, string> = { week: 'Week', month: 'Month', all: 'All time' };
type Row = { rank: number; id: string; name: string; level: number; exp: number };
type Board = { rows: Row[]; me: { rank: number; exp: number; above: { name: string; gap: number } | null } | null };
const num = (n: number) => n.toLocaleString('en-US');
const gameName = (k: string | null) => (k ? (GAMES.find((g) => g.key === k) ?? { lead: '', em: k }) : null);

/** The board from the server (RL3): reloads when a filter changes; null while loading, 'error' if it failed. */
function useBoard(period: Period, scope: 'everyone' | 'friends', game: string | null, userId: string | null) {
  const [board, setBoard] = useState<Board | null | 'error'>(null);
  // A new filter shows "loading" again until its board arrives.
  const filter = `${period}|${scope}|${game}|${userId}`;
  const [shown, setShown] = useState(filter);
  if (shown !== filter) {
    setShown(filter);
    setBoard(null);
  }
  useEffect(() => {
    let live = true;
    supabase.rpc('leaderboard', { period, scope, game }).then(({ data, error }) => {
      if (!live) return;
      setBoard(error || !data ? 'error' : (data as Board));
      // Bought name glow (Yazan 2026-10-13): ask for the shown players' looks.
      if (data) wantLooks((data as Board).rows.map((r) => r.id));
    });
    return () => {
      live = false;
    };
  }, [period, scope, game, userId]);
  return board;
}

// Monthly prizes (#73, Yazan 2026-10-25), paid by lb_claim on the server when the month ends.
const MONTH_PRIZE_ALL = 'MONTHLY PRIZES · 1ST 500 · 2ND 300 · 3RD 150 · 4TH TO 10TH 50 TOKENS';
const MONTH_PRIZE_GAME = 'MONTHLY PRIZES · THE TOP 3 OF THIS GAME WIN 100 TOKENS EACH';

const TOP = 72; // content area top (design px)

/** CSS box-shadow `0 0 blur spread` glow around a circle of radius r, as a soft radial gradient. */
function StarGlow({ r, blur, spread, a }: { r: number; blur: number; spread: number; a: number }) {
  const id = useSvgId('sg');
  const e = r + spread; // shadow edge
  const R = e + blur;
  const sz = 2 * R;
  return (
    <Svg width={u(sz)} height={u(sz)} viewBox={`0 0 ${sz} ${sz}`} style={{ position: 'absolute', left: u(r - R), top: u(r - R) }} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx={R} cy={R} r={R} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={`rgb(${HALO})`} stopOpacity={a * 0.6} />
          <Stop offset={Math.max(0, e - blur / 2) / R} stopColor={`rgb(${HALO})`} stopOpacity={a * 0.52} />
          <Stop offset={e / R} stopColor={`rgb(${HALO})`} stopOpacity={a * 0.3} />
          <Stop offset={(e + blur / 2) / R} stopColor={`rgb(${HALO})`} stopOpacity={a * 0.09} />
          <Stop offset="1" stopColor={`rgb(${HALO})`} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={R} cy={R} r={R} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Leaderboard: scope and filters, the top three as stars, places 4 to 50 and your pinned row. */
export function Leaderboard() {
  const t = useTheme();
  const looks = useStyle((x) => x.looks);
  const glowOf = (id: string) => (looks[id]?.glow ? { textShadowColor: t.accent, textShadowRadius: u(9), textShadowOffset: { width: 0, height: 0 } } : null);
  const p = C[t.mode];
  const pill = [s.pill, { backgroundColor: t.panel, borderColor: t.panelLine }];
  const me = useBalance();
  const userId = useSession((x) => x.userId);
  const [scope, setScope] = useState<'everyone' | 'friends'>('everyone');
  const [period, setPeriod] = useState<Period>('week');
  const [game, setGame] = useState<string | null>(null);
  const [pick, setPick] = useState<'game' | 'period' | null>(null);
  const board = useBoard(period, scope, game, userId);
  const rows = board && board !== 'error' ? board.rows : [];
  const mine = userId && board && board !== 'error' ? board.me : null;
  const g = gameName(game);
  const per = PERIODS.find((x) => x.k === period)!;
  const note =
    board === 'error'
      ? 'Could not load the board. Check your connection.'
      : board && !rows.length
        ? scope === 'friends' && !userId
          ? 'Sign in to see your friends here.'
          : `No EXP earned ${per.empty}${g ? ` in ${g.lead} ${g.em}` : ''}.`
        : null;
  const sub = !userId
    ? null
    : !mine
      ? 'EARN EXP TO JOIN THE BOARD'
      : mine.above
        ? `${num(mine.above.gap)} EXP TO PASS ${mine.above.name.toUpperCase()}`
        : 'YOU LEAD THE BOARD';
  const prog = !mine ? 0 : mine.above ? mine.exp / (mine.exp + mine.above.gap) : 1;
  const scopeBtn = (k: 'everyone' | 'friends', label: string) => (
    <Pressable key={k} onPress={() => setScope(k)} accessibilityRole="tab" accessibilityState={{ selected: scope === k }}>
      <Text style={[s.scopeT, scope === k ? { color: t.accent, fontFamily: F.displayItalic } : { color: t.mute }]}>{label}</Text>
    </Pressable>
  );
  const opt = (label: string, on: boolean, go: () => void) => (
    <Pressable
      key={label}
      onPress={() => {
        go();
        setPick(null);
      }}
      style={[s.opt, { borderColor: t.panelLine }]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Text style={[s.optT, { color: on ? t.accent : t.fg }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={s.area}>
      <Fade stops={[[0, 1], [0.86, 1], [0.99, 0], [1, 0]]} style={s.area}>
        <ScrollView style={s.fill} contentContainerStyle={s.c} showsVerticalScrollIndicator={false}>
          <View style={s.lb}>
            <View style={s.top}>
              <View style={s.scope}>
                {scopeBtn('everyone', 'Everyone')}
                {scopeBtn('friends', 'Friends')}
              </View>
              <View style={s.flt}>
                <Pressable style={pill} onPress={() => setPick('game')} accessibilityRole="button">
                  <Text style={[s.pillT, { color: t.mute }]} numberOfLines={1}>{`${g ? g.em : 'All games'} ▾`}</Text>
                </Pressable>
                <Pressable style={pill} onPress={() => setPick('period')} accessibilityRole="button">
                  <Text style={[s.pillT, { color: t.mute }]}>{`${SHORT[period]} ▾`}</Text>
                </Pressable>
              </View>
            </View>
            <View style={s.hero}>
              {note ? <Text style={[s.note, { color: t.mute }]}>{note}</Text> : null}
              {TOP3.map((r, i) => {
                const who = rows[i];
                if (!who) return null;
                return (
                  <View key={r.word} style={[s.rk, { left: u(r.cx - 40), top: u(r.top - 115) }]}>
                    <View style={{ width: u(r.d), height: u(r.d) }}>
                      <StarGlow r={r.d / 2} blur={r.blur} spread={r.spread} a={r.a} />
                      <View style={{ width: u(r.d), height: u(r.d), borderRadius: u(r.d / 2), backgroundColor: p.star }} />
                    </View>
                    <Text style={[s.word, { color: p.rank }]}>{r.word}</Text>
                    <View style={s.nmRow}>
                      <Text style={[s.name, { color: t.fg }, glowOf(who.id)]} numberOfLines={1}>
                        {who.id === userId ? 'You' : who.name}
                      </Text>
                      <LevelBadge level={who.level} size={u(15)} />
                    </View>
                    <Text style={[s.pts, { color: t.mute }]}>{num(who.exp)}</Text>
                  </View>
                );
              })}
            </View>
            {rows.slice(3).map((r, i) => (
              <View key={r.id} style={[s.r, { borderColor: t.panelLine }, i === 0 && s.first]}>
                <Text style={[s.rN, { color: t.kick }]}>{String(r.rank).padStart(2, '0')}</Text>
                <View style={s.rNm}>
                  <Text style={[s.rB, { color: r.id === userId ? t.accent : t.fg }, glowOf(r.id)]} numberOfLines={1}>
                    {r.id === userId ? 'You' : r.name}
                  </Text>
                  <LevelBadge level={r.level} size={u(15)} />
                </View>
                <Text style={[s.rS, { color: t.mute }]}>{num(r.exp)}</Text>
              </View>
            ))}
            {period === 'month' && scope === 'everyone' ? (
              <Text style={[s.prize, { color: t.mute }]}>{game ? MONTH_PRIZE_GAME : MONTH_PRIZE_ALL}</Text>
            ) : null}
          </View>
        </ScrollView>
      </Fade>
      {/* Your row stays pinned under the list. */}
      <View style={[s.pin, { backgroundColor: t.panel, borderColor: p.pinLine, boxShadow: p.pinShadow(u(1)) }]}>
        <Text style={[s.pinN, { color: p.rank }]}>{mine ? String(mine.rank).padStart(2, '0') : '–'}</Text>
        <View style={s.pinB}>
          <View style={s.nmRow}>
            <Text style={[s.you, { color: t.fg }]}>You</Text>
            <LevelBadge level={me.level} progress={me.into / me.need} size={u(15)} />
          </View>
          {userId ? (
            <>
              <Text style={[s.sub, { color: t.mute }]}>{sub}</Text>
              <View style={[s.prog, { backgroundColor: p.prog }]}>
                <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.progI, { width: `${Math.round(prog * 100)}%` }]} />
              </View>
            </>
          ) : (
            <Pressable onPress={() => router.push('/auth')} accessibilityRole="link">
              <Text style={[s.guest, { color: t.mute }]}>
                Sign in to join the board. <Text style={{ color: t.accent, fontFamily: F.bodySemi }}>Sign in</Text>
              </Text>
            </Pressable>
          )}
        </View>
        {userId ? <Text style={[s.pinS, { color: t.fg }]}>{num(mine?.exp ?? 0)}</Text> : null}
      </View>
      {/* Filter menu: drops down under the filters, two columns; a tap anywhere else closes it. */}
      {pick ? (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPick(null)} accessibilityLabel="Close" />
          <View style={[s.menu, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
            {pick === 'game'
              ? [opt('All games', game == null, () => setGame(null)), ...GAMES.map((x) => opt(`${x.lead} ${x.em}`, game === x.key, () => setGame(x.key)))]
              : PERIODS.map((x) => opt(x.label, period === x.k, () => setPeriod(x.k)))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  area: { flex: 1 },
  fill: { flex: 1 },
  c: { paddingTop: u(88 - TOP), paddingBottom: u(24) },
  lb: { paddingHorizontal: u(16) },
  top: { height: u(23), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scope: { flexDirection: 'row', gap: u(10), alignItems: 'center' },
  scopeT: { fontFamily: F.display, fontSize: u(17), lineHeight: u(21) },
  flt: { flexDirection: 'row', gap: u(4) },
  pill: { height: u(23), paddingHorizontal: u(7), borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  pillT: { fontFamily: F.bodySemi, fontSize: u(9), maxWidth: u(90) },
  hero: { height: u(200), marginTop: u(4), marginHorizontal: u(-16) },
  rk: { position: 'absolute', width: u(80), alignItems: 'center' },
  word: { marginTop: u(4), fontFamily: F.displayItalic, fontSize: u(13), lineHeight: u(16) },
  name: { marginTop: u(4), fontFamily: F.display, fontSize: u(15), lineHeight: u(15) },
  pts: { marginTop: u(4), fontFamily: F.mono, fontSize: u(7.5), lineHeight: u(10), letterSpacing: u(1.05) },
  r: { flexDirection: 'row', alignItems: 'center', gap: u(12), paddingVertical: u(8), height: u(36), borderBottomWidth: 1 },
  first: { borderTopWidth: 1, height: u(37) },
  rN: { width: u(16), fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12) },
  nmRow: { flexDirection: 'row', alignItems: 'center', gap: u(5) },
  rNm: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: u(6) },
  rB: { fontFamily: F.display, fontSize: u(16), lineHeight: u(16) },
  rS: { fontFamily: F.display, fontSize: u(15), lineHeight: u(19) },
  prize: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1), lineHeight: u(12), textAlign: 'center', marginTop: u(14), paddingHorizontal: u(16) },
  note: { position: 'absolute', left: u(16), right: u(16), top: u(70), textAlign: 'center', fontFamily: F.body, fontSize: u(11), lineHeight: u(15) },
  guest: { marginTop: u(3), fontFamily: F.body, fontSize: u(10.5), lineHeight: u(14) },
  menu: { position: 'absolute', top: u(88 - TOP + 30), left: u(14), right: u(14), flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: u(16), paddingHorizontal: u(10), paddingVertical: u(4) },
  opt: { width: '50%', paddingVertical: u(8), paddingHorizontal: u(4), borderBottomWidth: 1 },
  optT: { fontFamily: F.display, fontSize: u(12.5), lineHeight: u(16) },
  pin: { marginTop: u(6), marginBottom: u(80), marginHorizontal: u(14), height: u(66), flexDirection: 'row', alignItems: 'center', gap: u(12), paddingHorizontal: u(14), borderRadius: u(18), borderWidth: 1 },
  pinN: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12) },
  pinB: { flex: 1 },
  you: { fontFamily: F.displayItalic, fontSize: u(17), lineHeight: u(21) },
  sub: { marginTop: u(3), fontFamily: F.mono, fontSize: u(7.5), lineHeight: u(10), letterSpacing: u(0.9) },
  prog: { marginTop: u(6), height: u(2), borderRadius: u(2), overflow: 'hidden' },
  progI: { height: '100%', borderRadius: u(2) },
  pinS: { fontFamily: F.display, fontSize: u(16), lineHeight: u(20) },
});
