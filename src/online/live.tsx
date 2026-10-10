import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated';

import { Face } from '@/games/shell/Face';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { G } from './grey';

/** ON8 / DPN7: a pill slides in under the header for a big moment ("Sara solved it, 2nd"), then fades after 2 s. */
export function useAlerts() {
  const [alert, setAlert] = useState<{ id: number; text: string; color: string } | null>(null);
  const n = useRef(0);
  useEffect(() => {
    if (!alert) return;
    const id = setTimeout(() => setAlert((a) => (a?.id === alert.id ? null : a)), 2000);
    return () => clearTimeout(id);
  }, [alert]);
  return { alert, push: (text: string, color: string) => setAlert({ id: ++n.current, text, color }) };
}

export function AlertPill({ alert }: { alert: { id: number; text: string; color: string } | null }) {
  const t = useTheme();
  if (!alert) return null;
  return (
    <View style={s.wrap} pointerEvents="none">
      <Animated.View key={alert.id} entering={SlideInUp.duration(260)} exiting={FadeOut.duration(300)} style={[s.pill, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
        <View style={[s.dot, { backgroundColor: alert.color }]} />
        <Text style={[s.pillT, { color: t.fg }]}>{alert.text}</Text>
      </Animated.View>
    </View>
  );
}

/** ON16: the 3-2-1 before the first case, with everyone's faces, in the online grey. */
export function Countdown({ ms, faces, line }: { ms: number; faces: string[]; line: string }) {
  return (
    <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, s.cd]}>
      <Text style={[s.cdK, { color: G.mute }]}>MATCH STARTING</Text>
      <Text style={[s.cdN, { color: G.fg }]}>{Math.max(1, Math.ceil(ms / 1000))}</Text>
      <View style={s.cdF}>
        {faces.map((f, i) => (
          <Face key={i} slug={f} size={u(28)} />
        ))}
      </View>
      <Text style={[s.cdL, { color: G.mute }]}>{line}</Text>
    </Animated.View>
  );
}

/** "1st", "2nd", "3rd", "4th"… */
export const nth = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

const s = StyleSheet.create({
  wrap: { position: 'absolute', top: u(4), left: 0, right: 0, alignItems: 'center', zIndex: 15 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: u(7), borderWidth: 1, borderRadius: 999, paddingVertical: u(6), paddingHorizontal: u(12), boxShadow: '0px 8px 18px rgba(0,0,0,0.3)' },
  dot: { width: u(7), height: u(7), borderRadius: u(4) },
  pillT: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  cd: { backgroundColor: 'rgba(30,32,36,0.92)', alignItems: 'center', justifyContent: 'center', gap: u(10), zIndex: 30 },
  cdK: { fontFamily: F.bodySemi, fontSize: u(9), letterSpacing: u(1.4) },
  cdN: { fontFamily: F.display, fontSize: u(90), lineHeight: u(100) },
  cdF: { flexDirection: 'row', gap: u(6) },
  cdL: { fontFamily: F.body, fontSize: u(10.5) },
});
