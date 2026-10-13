import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import Svg, { Defs, LinearGradient as SvgLinear, Path, Stop } from 'react-native-svg';

import { LevelBadge, useBalance } from '@/components/LevelBadge';
import { Display } from '@/components/Txt';
import { Fade } from '@/components/Fade';
import { useSvgId } from '@/components/svgId';
import { FriendCount } from '@/features/profile/Friends';
import { Face } from '@/games/shell/Face';
import { deleteAccount, useAccount } from '@/state/account';
import { useTheme } from '@/state/app';
import { loadFriends, unblockUser, useFriends } from '@/state/friends';
import { u } from '@/theme/scale';
import { F, type Theme } from '@/theme/tokens';

import { useProfileStats } from './stats';
import { titleName } from '@/features/style/catalog';
import { Framed } from '@/features/style/Frame';
import { titleColor } from '@/features/style/PlayerTitle';
import { loadStyle, useStyle } from '@/features/style/useStyle';


// Page colours from the locked preview (d-/l-profile).
const C = {
  dark: { tide: ['#a48bff', '#6fd6ff'] },
  light: { tide: ['#e9bf4f', '#e5833a'] },
};

const TW = 96; // sparkline width (design px)

function Tide({ t, pts }: { t: Theme; pts: number[] }) {
  const id = useSvgId('tg');
  const c = C[t.mode].tide;
  // Accuracy 0-1 drawn top (all right) to bottom (all wrong); one game draws a flat line.
  const ys = (pts.length > 1 ? pts : [pts[0] ?? 0, pts[0] ?? 0]).map((a) => 24 - a * 22);
  const d = 'M' + ys.map((y, i) => `${((i * TW) / (ys.length - 1)).toFixed(2)},${y.toFixed(1)}`).join(' L');
  return (
    <Svg width={u(TW)} height={u(26)} viewBox={`0 0 ${TW} 26`}>
      <Defs>
        <SvgLinear id={id} x1="0" y1="0" x2={TW} y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c[0]} stopOpacity={0.3} />
          <Stop offset="1" stopColor={c[1]} />
        </SvgLinear>
      </Defs>
      <Path d={d} fill="none" stroke={`url(#${id})`} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

/** Profile: your framed face, name, title, three numbers, tide lines per game and your friends (FR1-FR4). */
export function Profile() {
  const t = useTheme();
  const line = { borderColor: t.panelLine };
  const profile = useAccount((a) => a.profile);
  const lv = useBalance();
  const st = useProfileStats();
  const look = useStyle((x) => x.worn);
  useEffect(() => {
    void loadStyle();
  }, [profile?.id]);
  const pct = (a: number | null | undefined) => (a == null ? '–' : `${Math.round(a * 100)}%`);
  return (
    <Fade stops={[[0, 0], [0.04, 1], [0.9, 1], [1, 0]]} style={s.area}>
      <ScrollView style={s.fill} contentContainerStyle={s.pf} showsVerticalScrollIndicator={false}>
        {/* Your framed face where the planet was (Yazan 2026-10-13: on the planet spot, orbit and moons removed). */}
        <View style={s.me}>
          <Framed slug={profile?.avatar ?? 'yara'} size={u(124)} frame={look.frame} />
        </View>
        <View style={s.idn}>
          <View style={s.nm}>
            <Display em={profile?.display_name ?? 'Guest'} italic style={[s.h2, { color: t.fg }]}>
              {'Dr. '}
            </Display>
            {/* LV3: your level beside your name, the ring filling toward the next level. */}
            <LevelBadge level={lv.level} progress={lv.into / lv.need} size={u(21)} />
          </View>
          <Text style={[s.title, { color: titleColor(t.mode, look.title, t.accent) }]}>{titleName(look.title)}</Text>
          <Text style={[s.role, { color: t.mute }]}>{profile ? `@${profile.username.toUpperCase()}` : 'SIGN IN TO SAVE YOUR PROGRESS'}</Text>
          <View style={s.style}>
            {[['Change frame', 'frames'], ['Change title', 'titles']].map(([l, tab]) => (
              <Pressable key={l} onPress={() => router.navigate(`/style?tab=${tab}` as never)} style={[s.stBtn, { backgroundColor: t.chip, borderColor: t.chipLine }]} accessibilityRole="button">
                <Text style={[s.stT, { color: t.fg }]}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={[s.nums, line]}>
          {[
            [String(st?.finished ?? 0), 'SOLVED'],
            [pct(st?.acc), 'ACCURACY'],
            [String(st?.bestDays ?? 0), 'BEST STREAK'],
          ].map(([n, l]) => (
            <View key={l} style={s.num}>
              <Text style={[s.numB, { color: t.fg }]}>{n}</Text>
              <Text style={[s.numS, { color: t.mute }]}>{l}</Text>
            </View>
          ))}
        </View>
        <Text style={[s.sh2, { color: t.kick }]}>BY GAME</Text>
        {st && !st.games.length ? <Text style={[s.none, { color: t.mute }]}>Play a game to see your lines.</Text> : null}
        {st?.games.map((g) => (
          <View key={g.key} style={s.td}>
            <Text style={[s.tdB, { color: t.fg }]}>{g.name}</Text>
            <Tide t={t} pts={g.line} />
            <Text style={[s.tdN, { color: t.fg }]} numberOfLines={1}>{pct(g.acc)}</Text>
          </View>
        ))}
        <FriendCount t={t} />
        {profile ? <Blocked t={t} /> : null}
        {profile ? <DeleteAccount t={t} /> : null}
      </ScrollView>
    </Fade>
  );
}

/** Blocked players card (moved here from the Settings page, Yazan 2026-10-13). */
function Blocked({ t }: { t: Theme }) {
  const blocked = useFriends((f) => f.blocked);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    loadFriends().catch(() => {});
  }, []);
  return (
    <>
      <Text style={[s.sh2, { color: t.kick }]}>BLOCKED PLAYERS</Text>
      <View style={[s.blk, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
        {blocked.length ? (
          blocked.map((b) => (
            <View key={b.id} style={s.blkRow}>
              <Face slug={b.avatar} size={u(22)} />
              <Text style={[s.blkN, { color: t.fg }]} numberOfLines={1}>{b.display_name}</Text>
              <Pressable
                disabled={busy === b.id}
                onPress={async () => {
                  setBusy(b.id);
                  await unblockUser(b.id).catch(() => {});
                  setBusy(null);
                }}
                style={[s.ch, s.ghost, { borderColor: t.panelLine }]}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${b.display_name}`}>
                <Text style={[s.ghT, { color: t.mute }]}>Unblock</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={[s.none, { color: t.mute, paddingVertical: 0 }]}>You haven’t blocked anyone.</Text>
        )}
      </View>
    </>
  );
}

/** Delete my account (store rule): a two-tap confirm inside the page, then the phone goes back to guest. */
function DeleteAccount({ t }: { t: Theme }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      await deleteAccount();
    } catch {
      setErr('Could not delete right now. Check your connection and try again.');
      setBusy(false);
    }
  };
  return (
    <View style={s.del}>
      {ask ? (
        <>
          <Text style={[s.delQ, { color: t.fg }]}>Delete your account? Your EXP, tokens, misses and cards on the server are removed for good.</Text>
          <View style={s.delRow}>
            <Pressable onPress={() => setAsk(false)} style={[s.ch, s.ghost, { borderColor: t.panelLine }]} accessibilityRole="button">
              <Text style={[s.ghT, { color: t.mute }]}>Keep it</Text>
            </Pressable>
            <Pressable onPress={go} disabled={busy} style={[s.ch, s.ghost, { borderColor: t.red }]} accessibilityRole="button">
              <Text style={[s.ghT, { color: t.red }]}>{busy ? 'Deleting…' : 'Delete'}</Text>
            </Pressable>
          </View>
          {err ? <Text style={[s.delQ, { color: t.red }]}>{err}</Text> : null}
        </>
      ) : (
        <Pressable onPress={() => setAsk(true)} accessibilityRole="button">
          <Text style={[s.delL, { color: t.mute }]}>Delete my account</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  area: { flex: 1 },
  fill: { flex: 1 },
  pf: { paddingTop: u(23), paddingHorizontal: u(16), paddingBottom: u(110), gap: u(6) },
  me: { alignItems: 'center', paddingTop: u(18), paddingBottom: u(8) },
  idn: { marginTop: u(2), alignItems: 'center' },
  title: { marginTop: u(2), fontFamily: F.displayItalic, fontSize: u(12.5) },
  style: { flexDirection: 'row', gap: u(8), marginTop: u(10) },
  stBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: u(12), paddingVertical: u(6) },
  stT: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  nm: { flexDirection: 'row', alignItems: 'center', gap: u(7) },
  h2: { fontSize: u(30), lineHeight: u(30), height: u(30), overflow: 'visible', textAlign: 'center' },
  del: { marginTop: u(26), alignItems: 'center', gap: u(10) },
  delL: { fontFamily: F.body, fontSize: u(9.5), textDecorationLine: 'underline' },
  delQ: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(13), textAlign: 'center' },
  delRow: { flexDirection: 'row', gap: u(10) },
  role: { marginTop: u(5), fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12), letterSpacing: u(1.53) },
  nums: { flexDirection: 'row', justifyContent: 'space-around', marginTop: u(14), marginBottom: u(10), paddingVertical: u(10), borderTopWidth: 1, borderBottomWidth: 1 },
  num: { alignItems: 'center', height: u(46) },
  numB: { fontFamily: F.display, fontSize: u(26), lineHeight: u(26), height: u(26) },
  numS: { marginTop: u(8), fontFamily: F.mono, fontSize: u(7.5), lineHeight: u(10), letterSpacing: u(1.2) },
  sh2: { marginTop: u(10), marginBottom: u(2), fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12), letterSpacing: u(1.7) },
  td: { flexDirection: 'row', alignItems: 'center', gap: u(8), paddingVertical: u(7), minHeight: u(40) },
  tdB: { width: u(104), fontFamily: F.display, fontSize: u(12.5), lineHeight: u(14.375) },
  none: { fontFamily: F.body, fontSize: u(11), lineHeight: u(15), paddingVertical: u(7) },
  tdN: { width: u(50), textAlign: 'right', fontFamily: F.display, fontSize: u(16), lineHeight: u(20) },
  ch: { height: u(23), paddingHorizontal: u(10), borderRadius: u(10), justifyContent: 'center' },
  ghost: { height: u(25), borderWidth: 1 },
  ghT: { fontFamily: F.bodySemi, fontSize: u(9.5) },
  blk: { borderWidth: 1, borderRadius: u(14), padding: u(12), gap: u(8), marginTop: u(4) },
  blkRow: { flexDirection: 'row', alignItems: 'center', gap: u(9) },
  blkN: { flex: 1, fontFamily: F.bodySemi, fontSize: u(11.5) },
});
