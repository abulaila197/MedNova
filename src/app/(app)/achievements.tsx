import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { type AchRow, useAchievements } from '@/features/achievements/useAchievements';
import { tierTokens, TOUR_STEPS } from '@/features/achievements/progress';
import { RoundsEntry } from '@/features/rounds/RoundsEntry';
import Svg, { Circle, Defs, LinearGradient as SvgLinear, Path, Stop } from 'react-native-svg';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import type { Theme } from '@/theme/tokens';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

const TIER = ['Bronze', 'Silver', 'Gold', 'Platinum'];
const METAL = [
  ['#e6b089', '#a8693d'],
  ['#eef1f6', '#9aa3b2'],
  ['#f6dc8a', '#c9952e'],
  ['#ffffff', '#8e9db2'],
] as const;

/** Achievements (AC1-AC8), locked look B "Residency logbook": bronze, silver and gold tiers; reached tiers wait for a tap to collect. */
export default function Page() {
  const c = useInfo();
  const { rows, signedIn, busy, error, collect, waiting, tokensWaiting } = useAchievements();
  const reached = rows?.reduce((n, r) => n + r.reached, 0) ?? 0;
  const tiers = rows?.reduce((n, r) => n + r.goals.length, 0) ?? 0;
  return (
    <Screen tab={null} glow={21}>
      <InfoScroll>
        <Kicker>Achievements</Kicker>
        <Text style={[ui.H, s.H, { color: c.fg }]}>
          {'Your '}
          <Text style={[ui.H, s.H, { color: c.t.accent, fontFamily: F.displayItalic }]}>logbook</Text>
        </Text>
        <Text style={[ui.p, { color: c.mute }]}>
          {`${reached} of ${tiers} tiers reached`}
          {waiting ? ` · ${tokensWaiting} token${tokensWaiting === 1 ? '' : 's'} waiting` : ''}
        </Text>
        {!signedIn ? (
          <Pressable onPress={() => router.navigate('/auth')} style={[s.guest, { borderColor: c.line, backgroundColor: c.surf }]} accessibilityRole="button">
            <Text style={[s.guestT, { color: c.fg }]}>Sign in to collect your tokens</Text>
            <Text style={[s.guestA, { color: c.t.accent }]}>Sign in</Text>
          </Pressable>
        ) : null}
        {error ? <Text style={[ui.p, { color: c.t.error }]}>{error}</Text> : null}
        {/* This week's Grand Rounds, changing every week like the Games page button (Yazan 2026-10-13). */}
        <RoundsEntry />
        <View style={[s.log, { backgroundColor: c.surf, borderColor: c.line }]}>
          <View style={[s.margin, { backgroundColor: c.t.rose }]} />
          {rows?.map((r) => <LogRow key={r.key} r={r} t={c.t} canCollect={signedIn} busy={busy === r.key} onCollect={() => collect(r.key)} />)}
        </View>
      </InfoScroll>
    </Screen>
  );
}

/** The Platinum seal: a wax-like platinum disc with a four-point star, for an achievement finished to the end. */
function PlatinumSeal() {
  return (
    <View style={{ transform: [{ rotate: '-10deg' }] }} accessibilityLabel="Platinum">
      <Svg width={u(34)} height={u(34)} viewBox="0 0 40 40">
        <Defs>
          <SvgLinear id="pts" x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#ffffff" />
            <Stop offset="0.45" stopColor="#cfd9e6" />
            <Stop offset="1" stopColor="#8e9db2" />
          </SvgLinear>
        </Defs>
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return <Circle key={i} cx={20 + Math.cos(a) * 16.5} cy={20 + Math.sin(a) * 16.5} r={3} fill="url(#pts)" />;
        })}
        <Circle cx={20} cy={20} r={16.5} fill="url(#pts)" stroke="#7d8ba0" strokeWidth={0.6} />
        <Circle cx={20} cy={20} r={12.5} fill="none" stroke="#7d8ba0" strokeWidth={0.6} strokeDasharray="1.2 1.6" />
        <Path d="M20 10.5 L22 18 L29.5 20 L22 22 L20 29.5 L18 22 L10.5 20 L18 18 Z" fill="#5f6d82" />
        <Path d="M14 12.5 A10 10 0 0 1 26 11.8" stroke="#ffffff" strokeOpacity={0.8} strokeWidth={1} fill="none" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

type RowP = { r: AchRow; t: Theme; canCollect: boolean; busy: boolean; onCollect: () => void };

function CollectPill({ r, t, busy, onCollect, small = false }: Omit<RowP, 'canCollect'> & { small?: boolean }) {
  return (
    <Pressable onPress={busy ? undefined : onCollect} accessibilityRole="button" style={busy && { opacity: 0.6 }}>
      <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={[s.pill, small && s.pillS]}>
        <Text style={[s.pillT, { color: t.onGrad }]}>{`Collect +${tierTokens(r.key)[r.paid]}`}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/** One ruled line per achievement; each tier is a signed box, gold gets the stamp. */
function LogRow({ r, t, canCollect, busy, onCollect }: RowP) {
  const ready = canCollect && r.paid < r.reached;
  const goal = r.next ?? r.goals[r.goals.length - 1];
  const pct = Math.min(1, r.count / goal);
  return (
    <View style={[s.line, { borderBottomColor: t.panelLine }]}>
      <View style={s.tiers}>
        {r.goals.map((_, i) => (
          <View key={i} style={[s.box, { borderColor: i < r.reached ? METAL[i][1] : t.panelLine }]}>
            {i < r.reached ? <Text style={[s.tick, { color: METAL[i][1] }]}>✓</Text> : null}
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.lName, { color: t.fg }]}>{r.name}</Text>
        <Text style={[s.lWhat, { color: t.mute }]}>
          {r.key === 'app_tour'
            ? `${r.steps?.length ?? 0} / ${TOUR_STEPS.length} pages${r.next == null ? ' · signed' : ''}`
            : r.next == null
              ? `${r.what} · ${r.goals.length > 3 ? 'all four signed' : 'all three signed'}`
              : `${r.what} · ${Math.min(r.count, r.next)} / ${r.next} for ${TIER[r.reached].toLowerCase()}`}
        </Text>
        {r.key === 'app_tour' && r.next != null ? (
          <Text style={[s.lWhat, { color: t.mute }]} numberOfLines={2}>
            {`Still to visit: ${TOUR_STEPS.filter((x) => !r.steps?.includes(x.key)).map((x) => x.name).join(', ')}`}
          </Text>
        ) : null}
        <View style={[s.bar, { backgroundColor: t.chip }]}>
          <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: r.reached ? METAL[r.reached - 1][1] : t.accent }]} />
        </View>
      </View>
      {ready ? (
        <CollectPill r={r} t={t} busy={busy} onCollect={onCollect} small />
      ) : r.paid === 4 ? (
        <PlatinumSeal />
      ) : r.paid === r.goals.length ? (
        <View style={[s.stamp, { borderColor: t.accent }]}>
          <Text style={[s.stampT, { color: t.accent }]}>SIGNED</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  H: { fontFamily: F.display },
  guest: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: u(14), padding: u(12), marginTop: u(12) },
  guestT: { fontFamily: F.bodyMedium, fontSize: u(11) },
  guestA: { fontFamily: F.bodyBold, fontSize: u(11) },
  pill: { borderRadius: 999, paddingHorizontal: u(12), height: u(26), justifyContent: 'center' },
  pillS: { paddingHorizontal: u(9), height: u(22) },
  pillT: { fontFamily: F.bodyBold, fontSize: u(9.5) },
  log: { marginTop: u(18), borderWidth: 1, borderRadius: u(18), paddingLeft: u(14), paddingRight: u(12), overflow: 'hidden' },
  // Halfway between the tier boxes (right edge 34) and the text (starts at 56).
  margin: { position: 'absolute', left: u(45), top: 0, bottom: 0, width: 1, opacity: 0.35 },
  line: { flexDirection: 'row', alignItems: 'center', gap: u(14), paddingVertical: u(11), borderBottomWidth: 1 },
  tiers: { width: u(28), gap: u(3), alignItems: 'center' },
  box: { width: u(12), height: u(12), borderRadius: u(3), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tick: { fontSize: u(8), lineHeight: u(10), fontFamily: F.bodyBold },
  lName: { fontFamily: F.display, fontSize: u(14) },
  lWhat: { fontFamily: F.body, fontSize: u(9), marginTop: u(2) },
  bar: { height: u(3), borderRadius: u(2), marginTop: u(6), overflow: 'hidden' },
  fill: { height: '100%', borderRadius: u(2) },
  stamp: { borderWidth: 1.5, borderRadius: u(4), paddingHorizontal: u(5), paddingVertical: u(2), transform: [{ rotate: '-12deg' }] },
  stampT: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.2) },
});
