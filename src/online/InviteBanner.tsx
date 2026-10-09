import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, SlideInUp, SlideOutUp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GAMES } from '@/data/games';
import { Face } from '@/games/shell/Face';
import { gameDef } from '@/games/shell/registry';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { settingsLine } from './format';
import { acceptInvite, markBannered, useInvites } from './invites';
import { G } from './grey';

const SHOW_MS = 10_000;

/**
 * ON24, "Top banner" (Yazan's pick): a new challenge slides down under the header for 10 s with a bar running out.
 * Later keeps it on your Friends list (Join + time left) until it ends. Not shown on match screens.
 */
export function InviteBanner() {
  const ins = useSafeAreaInsets();
  const path = usePathname();
  const list = useInvites((s) => s.list);
  const bannered = useInvites((s) => s.bannered);
  const inv = list.find((x) => !bannered.includes(x.id));
  const busy = /\/(live|run|lobby)$/.test(path);
  const bar = useSharedValue(1);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!inv || busy) return;
    setShown(inv.id);
    bar.value = 1;
    bar.value = withTiming(0, { duration: SHOW_MS, easing: Easing.linear });
    const id = setTimeout(() => markBannered(inv.id), SHOW_MS);
    return () => clearTimeout(id);
  }, [inv, busy, bar]);
  const run = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));

  if (!inv || busy || shown !== inv.id) return null;
  const g = GAMES.find((x) => x.key === inv.game);
  const top = (Platform.OS === 'web' ? u(30) : ins.top) + u(48);
  return (
    <Animated.View key={inv.id} entering={SlideInUp.duration(320)} exiting={SlideOutUp.duration(240)} style={[s.wrap, { top }]}>
      <Face slug={inv.avatar} size={u(32)} />
      <View style={s.t}>
        <Text style={s.n} numberOfLines={1}>{`${inv.display_name} challenges you`}</Text>
        <Text style={s.d} numberOfLines={1}>{[g ? `${g.lead} ${g.em}` : null, settingsLine(gameDef(inv.game), inv.settings)].filter(Boolean).join(' · ')}</Text>
      </View>
      <View style={s.b}>
        <Pressable onPress={() => acceptInvite(inv)} accessibilityRole="button" accessibilityLabel={`Join ${inv.display_name}`}>
          <LinearGradient colors={['#a48bff', '#6fd6ff']} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.join}>
            <Text style={s.joinT}>Join</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={() => markBannered(inv.id)} hitSlop={u(6)} accessibilityRole="button">
          <Text style={s.later}>Later</Text>
        </Pressable>
      </View>
      <View style={s.track}>
        <Animated.View style={[s.fill, run]} />
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: u(10), right: u(10), zIndex: 40, flexDirection: 'row', alignItems: 'center', gap: u(9), backgroundColor: G.panel, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: u(15), padding: u(10), overflow: 'hidden', boxShadow: '0px 14px 28px rgba(0,0,0,0.5)' },
  t: { flex: 1, minWidth: 0, gap: u(1) },
  n: { fontFamily: F.bodySemi, fontSize: u(11.5), color: G.fg },
  d: { fontFamily: F.body, fontSize: u(9.5), color: G.mute },
  b: { alignItems: 'center', gap: u(3) },
  join: { borderRadius: u(9), paddingVertical: u(5), paddingHorizontal: u(12) },
  joinT: { fontFamily: F.bodyBold, fontSize: u(10.5), color: '#0b0b26' },
  later: { fontFamily: F.bodySemi, fontSize: u(9.5), color: G.mute },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: u(2.5), backgroundColor: 'rgba(255,255,255,0.08)' },
  fill: { height: '100%', backgroundColor: G.acc },
});
