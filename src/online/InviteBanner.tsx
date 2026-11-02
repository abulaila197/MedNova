import { LinearGradient } from 'expo-linear-gradient';
import { safeEnter } from '@/lib/enter';
import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import Animated, { Easing, SlideInUp, SlideOutUp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GAMES } from '@/data/games';
import { PlayerFace } from '@/features/style/Frame';
import { gameDef } from '@/games/shell/registry';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { settingsLine } from './format';
import type { Invite } from './api';
import { acceptInvite, cancelAsking, loadInvites, markBannered, useInvites } from './invites';
import { G } from './grey';


/**
 * ON24, "Top banner" (Yazan's pick): a new challenge slides down under the header. #3 (Yazan 2026-11-02): it shows
 * on every page and stays until you tap Join or Later, or the challenge ends (the bar is the time it has left); it
 * used to leave after 10 s and was easy to miss. In a game (Solo, Pass the phone or online) it waits, and the app
 * checks again the moment you leave the game, so it shows right away. Later keeps it on your Friends list.
 */
export function InviteBanner() {
  const ins = useSafeAreaInsets();
  const path = usePathname();
  const list = useInvites((s) => s.list);
  const bannered = useInvites((s) => s.bannered);
  const inv = list.find((x) => !bannered.includes(x.id));
  const busy = /\/(live|run|lobby)$/.test(path);
  useEffect(() => {
    if (!busy) loadInvites().catch(() => {});
  }, [busy]);
  const top = (Platform.OS === 'web' ? u(30) : ins.top) + u(48);
  return (
    <>
      {!inv || busy ? null : <Banner key={inv.id} inv={inv} top={top} />}
      <WatchNote top={top} />
    </>
  );
}

/**
 * #15/#16: what happened to a Watch tap, wherever it was tapped (Friends list, a profile pop-up, the leaderboard):
 * "Waiting for … to allow" with Cancel while the friend decides, then why it didn't work for a few seconds.
 */
function WatchNote({ top }: { top: number }) {
  const asking = useInvites((s) => s.asking);
  const say = useInvites((s) => s.say);
  useEffect(() => {
    if (!say) return;
    const id = setTimeout(() => useInvites.setState({ say: null }), 5000);
    return () => clearTimeout(id);
  }, [say]);
  if (!asking && !say) return null;
  return (
    <Animated.View key={asking ? asking.ask : say ?? ''} entering={safeEnter(SlideInUp.duration(320))} exiting={SlideOutUp.duration(240)} style={[s.wrap, { top, zIndex: 45 }]}>
      <View style={s.t}>
        <Text style={s.n} numberOfLines={2}>{asking ? `Waiting for ${asking.name} to allow you to watch…` : say}</Text>
      </View>
      {asking ? (
        <Pressable onPress={cancelAsking} hitSlop={u(6)} accessibilityRole="button">
          <Text style={s.later}>Cancel</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => useInvites.setState({ say: null })} hitSlop={u(6)} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={s.later}>OK</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

/** One challenge's banner: its bar is the challenge's time left; at the end it goes (Join or Later close it sooner). */
function Banner({ inv, top }: { inv: Invite; top: number }) {
  const bar = useSharedValue(1);
  useEffect(() => {
    const start = new Date(inv.created_at).getTime();
    const end = new Date(inv.expires_at).getTime();
    const left = Math.max(0, end - Date.now());
    bar.value = Math.min(1, left / Math.max(1, end - start));
    bar.value = withTiming(0, { duration: left, easing: Easing.linear });
    const id = setTimeout(() => markBannered(inv.id), left);
    return () => clearTimeout(id);
  }, [inv, bar]);
  const run = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));
  const g = GAMES.find((x) => x.key === inv.game);
  return (
    <Animated.View entering={safeEnter(SlideInUp.duration(320))} exiting={SlideOutUp.duration(240)} style={[s.wrap, { top }]}>
      <PlayerFace slug={inv.avatar} size={u(32)} userId={inv.from_user} still />
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
