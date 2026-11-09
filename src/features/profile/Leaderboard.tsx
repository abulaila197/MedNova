import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { openPlayer } from '@/features/profile/Friends';
import { useStyle, wantLooks } from '@/features/style/useStyle';
import Svg, { Path } from 'react-native-svg';
import { PlayerFace } from '@/features/style/Frame';
import { useAccount } from '@/state/account';

import { LevelBadge, useBalance } from '@/components/LevelBadge';
import { Fade } from '@/components/Fade';
import { GAMES } from '@/data/games';
import { useSession } from '@/games/shell/session';
import { agoText, copyOf, keepCopy } from '@/lib/copies';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

// Page colours (dark only).
const C = {
  dark: {
    rank: '#6fd6ff',
    pinLine: 'rgba(164,139,255,0.55)',
    pinShadow: (k: number) => `0px ${12 * k}px ${30 * k}px ${-14 * k}px rgba(143,117,255,0.8)`,
    prog: 'rgba(255,255,255,0.1)',
    box: ['#2a3c7a', '#1a2754'] as const,
    boxFirst: ['#3a3f86', '#1f2a5c'] as const,
    boxLine: '#33478a',
    row: '#1a2754',
  },
};

// Podium (Yazan 2026-11-09, option A, short boxes): 2nd, 1st, 3rd as boxes with the player's photo on top.
// h = box height, f = photo size (design px). Medal colours: m = light, d = deep.
const POD = [
  { place: 2, h: 97, f: 42, m: '#dfe6ff', d: '#9aa6cc' },
  { place: 1, h: 108, f: 49, m: '#ffd76a', d: '#c99a2e' },
  { place: 3, h: 90, f: 40, m: '#f0a875', d: '#b86a3c' },
];
const POD_ROOM = 44; // space above the tallest box for the 1st photo and its crown, so nothing reaches the filters

type Period = 'week' | 'month' | 'all';
const PERIODS: { k: Period; label: string; empty: string }[] = [
  { k: 'week', label: 'This week', empty: 'this week' },
  { k: 'month', label: 'This month', empty: 'this month' },
  { k: 'all', label: 'All time', empty: 'yet' },
];
const SHORT: Record<Period, string> = { week: 'Week', month: 'Month', all: 'All time' };
type Row = { rank: number; id: string; name: string; level: number; exp: number; avatar?: string | null };
/** `savedAt`: shown from the saved copy read then, because the server can't be reached (#59). */
type Board = { rows: Row[]; me: { rank: number; exp: number; above: { name: string; gap: number } | null } | null; savedAt?: number };
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
    supabase.rpc('leaderboard', { period, scope, game }).then(async ({ data, error }) => {
      // Each filter's last board is kept per account; offline the saved one shows with its time (#59).
      const saved = userId ? await copyOf<Record<string, Board>>('leaderboard', userId) : null;
      if (!live) return;
      if (error || !data) return setBoard(saved?.v[filter] ?? 'error');
      setBoard(data as Board);
      if (userId) void keepCopy('leaderboard', userId, { ...saved?.v, [filter]: { ...(data as Board), savedAt: Date.now() } });
      // Bought name glow (Yazan 2026-10-13): ask for the shown players' looks.
      wantLooks((data as Board).rows.map((r) => r.id));
    });
    return () => {
      live = false;
    };
  }, [period, scope, game, userId, filter]);
  return board;
}

// Monthly prizes (#73, Yazan 2026-10-25), paid by lb_claim on the server when the month ends.
const MONTH_PRIZE_ALL = 'MONTHLY PRIZES · 1ST 500 · 2ND 300 · 3RD 150 · 4TH TO 10TH 50 TOKENS';
const MONTH_PRIZE_GAME = 'MONTHLY PRIZES · THE TOP 3 OF THIS GAME WIN 100 TOKENS EACH';

const TOP = 72; // content area top (design px)

/** The 1st place crown. */
function Crown({ w, color }: { w: number; color: string }) {
  return (
    <Svg width={u(w)} height={u(w * 0.72)} viewBox="0 0 24 17.3">
      <Path d="M2 15.3 L0.6 3.6 L7 8.4 L12 0.6 L17 8.4 L23.4 3.6 L22 15.3 Z" fill={color} stroke="#c99a2e" strokeWidth={1} strokeLinejoin="round" />
      <Path d="M3 16.3 H21" stroke="#c99a2e" strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

/** Leaderboard: scope and filters, the top three on a podium, places 4 to 50 and your pinned row. */
export function Leaderboard() {
  const t = useTheme();
  const looks = useStyle((x) => x.looks);
  const glowOf = (id: string) => (looks[id]?.glow ? { textShadowColor: t.accent, textShadowRadius: u(9), textShadowOffset: { width: 0, height: 0 } } : null);
  const p = C[t.mode];
  const pill = [s.pill, { backgroundColor: t.panel, borderColor: t.panelLine }];
  const me = useBalance();
  const myFace = useAccount((a) => a.profile?.avatar) || 'yara';
  const userId = useSession((x) => x.userId);
  const [scope, setScope] = useState<'everyone' | 'friends'>('everyone');
  const [period, setPeriod] = useState<Period>('week');
  const [game, setGame] = useState<string | null>(null);
  const [pick, setPick] = useState<'game' | 'period' | null>(null);
  const board = useBoard(period, scope, game, userId);
  // Tap a player for their profile sheet (Yazan 2026-10-26, pick B); signed in only, not yourself.
  const canOpen = (id: string) => !!userId && id !== userId;
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
  // #11 (Yazan 2026-10-31): the offline line gets its own red line above the podium, so it never sits behind a name.
  const offline = board && board !== 'error' && board.savedAt ? `Offline · last updated ${agoText(board.savedAt)}` : null;
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
      <Fade veil stops={[[0, 1], [0.86, 1], [0.99, 0], [1, 0]]} style={s.area}>
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
            {offline ? <Text style={[s.offline, { color: t.red }]}>{offline}</Text> : null}
            {note ? <Text style={[s.note, { color: t.mute }]}>{note}</Text> : null}
            {rows.length ? (
              <View style={s.pod}>
                {POD.map((b) => {
                  const who = rows[b.place - 1];
                  const first = b.place === 1;
                  if (!who) return <View key={b.place} style={[s.box, s.boxEmpty, { height: u(b.h * 0.6), borderColor: p.boxLine }]} />;
                  return (
                    <Pressable key={b.place} disabled={!canOpen(who.id)} onPress={() => openPlayer({ id: who.id, display_name: who.name, avatar: who.avatar ?? undefined })} style={[s.box, { height: u(b.h), borderColor: first ? 'rgba(255,215,106,0.4)' : p.boxLine }]} accessibilityRole="button" accessibilityHint="Open their profile">
                      <LinearGradient colors={first ? p.boxFirst : p.box} style={[StyleSheet.absoluteFill, s.boxFill]} />
                      <View style={[s.face, { top: u(-b.f / 2 - 3), width: u(b.f + 4), height: u(b.f + 4), borderColor: b.m, boxShadow: `0px 0px ${u(14)}px ${b.m}66` }]}>
                        <PlayerFace slug={who.avatar || 'yara'} size={u(b.f - 2)} userId={who.id} still />
                      </View>
                      {first ? (
                        <View style={[s.crown, { top: u(-b.f / 2 - 3 - 15) }]}>
                          <Crown w={18} color={b.m} />
                        </View>
                      ) : null}
                      <View style={{ height: u(b.f / 2 + 4) }} />
                      <Text style={[s.bName, { color: t.fg }, glowOf(who.id)]} numberOfLines={1}>
                        {who.id === userId ? 'You' : who.name}
                      </Text>
                      <View style={s.bLv}>
                        <LevelBadge level={who.level} size={u(14)} />
                      </View>
                      <Text style={[s.bExp, { color: t.fg }]}>{num(who.exp)}</Text>
                      <Text style={[s.bNum, { color: b.m }]}>{b.place}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <View style={s.list}>
              {rows.slice(3).map((r) => (
                <Pressable key={r.id} disabled={!canOpen(r.id)} onPress={() => openPlayer({ id: r.id, display_name: r.name, avatar: r.avatar ?? undefined })} style={[s.r, { backgroundColor: p.row, borderColor: r.id === userId ? t.accent : t.panelLine }]} accessibilityRole="button" accessibilityHint="Open their profile">
                  <Text style={[s.rN, { color: t.mute }]}>{r.rank}</Text>
                  <PlayerFace slug={r.avatar || 'yara'} size={u(26)} userId={r.id} still />
                  <View style={s.rNm}>
                    <Text style={[s.rB, { color: r.id === userId ? t.accent : t.fg }, glowOf(r.id)]} numberOfLines={1}>
                      {r.id === userId ? 'You' : r.name}
                    </Text>
                    <LevelBadge level={r.level} size={u(14)} />
                  </View>
                  <Text style={[s.rS, { color: t.fg }]}>
                    {num(r.exp)} <Text style={[s.rU, { color: t.mute }]}>EXP</Text>
                  </Text>
                </Pressable>
              ))}
            </View>
            {period === 'month' && scope === 'everyone' ? (
              <Text style={[s.prize, { color: t.mute }]}>{game ? MONTH_PRIZE_GAME : MONTH_PRIZE_ALL}</Text>
            ) : null}
          </View>
        </ScrollView>
      </Fade>
      {/* Your row stays pinned under the list. */}
      <View style={[s.pin, { backgroundColor: t.panel, borderColor: p.pinLine, boxShadow: p.pinShadow(u(1)) }]}>
        <Text style={[s.pinN, { color: p.rank }]}>{mine ? mine.rank : '–'}</Text>
        <View style={[s.pinFace, { borderColor: t.accent }]}>
          <PlayerFace slug={myFace} size={u(28)} userId={userId} still />
        </View>
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
  pod: { flexDirection: 'row', alignItems: 'flex-end', gap: u(7), marginTop: u(POD_ROOM), marginBottom: u(12) },
  box: { flex: 1, alignItems: 'center', borderWidth: 1, borderTopLeftRadius: u(14), borderTopRightRadius: u(14), borderBottomLeftRadius: u(10), borderBottomRightRadius: u(10), paddingHorizontal: u(4) },
  boxFill: { borderTopLeftRadius: u(13), borderTopRightRadius: u(13), borderBottomLeftRadius: u(9), borderBottomRightRadius: u(9) },
  boxEmpty: { opacity: 0.4 },
  face: { position: 'absolute', alignSelf: 'center', borderRadius: 999, borderWidth: u(2), alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1738' },
  crown: { position: 'absolute', alignSelf: 'center' },
  bName: { fontFamily: F.display, fontSize: u(11), lineHeight: u(14), maxWidth: '100%' },
  bLv: { marginTop: u(2) },
  bExp: { marginTop: u(2), fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(11) },
  bNum: { marginTop: 'auto', marginBottom: u(3), fontFamily: F.display, fontSize: u(19), lineHeight: u(22) },
  list: { gap: u(6) },
  r: { flexDirection: 'row', alignItems: 'center', gap: u(9), paddingHorizontal: u(10), height: u(42), borderRadius: u(12), borderWidth: 1 },
  rN: { width: u(16), fontFamily: F.display, fontSize: u(11.5), lineHeight: u(15) },
  nmRow: { flexDirection: 'row', alignItems: 'center', gap: u(5) },
  rNm: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: u(6) },
  rB: { fontFamily: F.display, fontSize: u(12.5), lineHeight: u(16), flexShrink: 1 },
  rS: { fontFamily: F.mono, fontSize: u(9.5), lineHeight: u(13) },
  rU: { fontFamily: F.mono, fontSize: u(7) },
  prize: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1), lineHeight: u(12), textAlign: 'center', marginTop: u(14), paddingHorizontal: u(16) },
  offline: { fontFamily: F.bodySemi, fontSize: u(10.5), textAlign: 'center', marginTop: u(8) },
  note: { marginTop: u(60), marginBottom: u(20), textAlign: 'center', fontFamily: F.body, fontSize: u(11), lineHeight: u(15) },
  guest: { marginTop: u(3), fontFamily: F.body, fontSize: u(10.5), lineHeight: u(14) },
  menu: { position: 'absolute', top: u(88 - TOP + 30), left: u(14), right: u(14), flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: u(16), paddingHorizontal: u(10), paddingVertical: u(4) },
  opt: { width: '50%', paddingVertical: u(8), paddingHorizontal: u(4), borderBottomWidth: 1 },
  optT: { fontFamily: F.display, fontSize: u(12.5), lineHeight: u(16) },
  pin: { marginTop: u(6), marginBottom: u(80), marginHorizontal: u(14), height: u(66), flexDirection: 'row', alignItems: 'center', gap: u(12), paddingHorizontal: u(14), borderRadius: u(18), borderWidth: 1 },
  pinN: { minWidth: u(16), fontFamily: F.display, fontSize: u(12), lineHeight: u(15) },
  pinFace: { borderRadius: 999, borderWidth: u(1.5), padding: u(1) },
  pinB: { flex: 1 },
  you: { fontFamily: F.displayItalic, fontSize: u(17), lineHeight: u(21) },
  sub: { marginTop: u(3), fontFamily: F.mono, fontSize: u(7.5), lineHeight: u(10), letterSpacing: u(0.9) },
  prog: { marginTop: u(6), height: u(2), borderRadius: u(2), overflow: 'hidden' },
  progI: { height: '100%', borderRadius: u(2) },
  pinS: { fontFamily: F.display, fontSize: u(16), lineHeight: u(20) },
});
