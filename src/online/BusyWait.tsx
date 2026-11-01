import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/AppText';

import { LOAD } from '@/features/loading/configs';
import { loadFontsFor } from '@/features/loading/fonts';
import { LoadingPage } from '@/features/loading/LoadingPage';
import { u, useScreen } from '@/theme/scale';
import { F } from '@/theme/tokens';

/**
 * Busy line (Yazan 2026-11-01): while too many players are online, the room waits on its game's own loading page
 * with "You're number N in line". The match starts by itself when its turn comes; the host can stop waiting.
 */
export function BusyWait({ game, place, onStop }: { game: string; place: number; onStop?: () => void }) {
  const { width: W, height: H } = useScreen();
  const ins = useSafeAreaInsets();
  const g = LOAD[game];
  const p = useSharedValue(0);
  const [fonts, setFonts] = useState(false);
  useEffect(() => {
    let on = true;
    loadFontsFor(game).catch(() => {}).finally(() => on && setFonts(true));
    // The bar fills and starts again while the room waits: there is no real progress to show.
    p.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }), -1, false);
    return () => {
      on = false;
    };
  }, [game, p]);
  const tip = `Servers are busy right now. You’re number ${Math.max(1, place)} in line. Your match starts by itself, so keep this screen open.`;
  return (
    <View style={[StyleSheet.absoluteFill, s.root]}>
      {g && fonts ? (
        <LoadingPage g={g} w={W} h={H} live p={p} tip={tip} tipLead="" />
      ) : (
        <View style={s.plain}>
          <Text style={s.plainT}>{tip}</Text>
        </View>
      )}
      {onStop ? (
        <Pressable onPress={onStop} style={[s.stop, { top: ins.top + u(12) }]} accessibilityRole="button" hitSlop={u(8)}>
          <Text style={s.stopT}>Stop waiting</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { zIndex: 50, elevation: 50, backgroundColor: '#000' },
  plain: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: u(28) },
  plainT: { color: '#fff', fontFamily: F.body, fontSize: u(15), lineHeight: u(22), textAlign: 'center' },
  stop: { position: 'absolute', right: u(16), paddingHorizontal: u(12), paddingVertical: u(7), borderRadius: u(16), backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  stopT: { color: '#fff', fontFamily: F.bodyBold, fontSize: u(12) },
});
