import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { TokenCoin } from '@/components/PulseStar';
import { engine } from '@/games/engine';
import { FIFTH_LEVEL_PRIZE, TOKENS_PER_LEVEL } from '@/games/engine/levels';
import { useSession } from '@/games/shell/session';
import { useAccount } from '@/state/account';
import { useTheme } from '@/state/app';
import { useBalanceStore } from '@/state/balance';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { LevelRing } from './LevelRing';

const SEEN = 'level:seen';
/** Tokens the level ups from `from` (exclusive) to `to` paid. */
const paid = (from: number, to: number) => {
  let n = 0;
  for (let l = from + 1; l <= to; l++) n += TOKENS_PER_LEVEL + (l % 5 === 0 ? FIFTH_LEVEL_PRIZE : 0);
  return n;
};

/**
 * The level-up pop-up (#34): when your level goes up it shows the new level in your ring and the tokens it paid,
 * once, after the game (never over a play in progress).
 */
export function LevelUpHost() {
  const t = useTheme();
  const userId = useSession((x) => x.userId);
  const { level, into, need } = useBalanceStore();
  const slug = useAccount((a) => a.profile?.avatar) ?? 'yara';
  const path = usePathname();
  const playing = /\/play\/[^/]+\/(run|live|lobby)/.test(path);
  const [from, setFrom] = useState<number | null>(null);

  useEffect(() => {
    if (!userId || level <= 1) return;
    void engine.kv.get<Record<string, number>>(SEEN).then((m) => {
      const seen = m?.[userId];
      // The first read on this phone only remembers the level; later rises open the pop-up.
      if (seen == null) return engine.kv.set(SEEN, { ...m, [userId]: level });
      if (level > seen) setFrom(seen);
    });
  }, [userId, level]);

  if (from == null || playing || !userId) return null;
  const close = () => {
    setFrom(null);
    void engine.kv.get<Record<string, number>>(SEEN).then((m) => engine.kv.set(SEEN, { ...m, [userId]: level }));
  };
  const tokens = paid(from, level);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3,4,12,0.78)' }]} onPress={close} accessibilityLabel="Close" />
      <View style={s.mid} pointerEvents="box-none">
        <Animated.View entering={ZoomIn.springify().damping(14)} style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
          <View style={[s.halo, { backgroundColor: 'rgba(111,214,255,0.14)' }]}>
            <LevelRing size={u(96)} level={level} progress={need ? into / need : 0} slug={slug} />
          </View>
          <Text style={[s.kick, { color: t.kick }]}>LEVEL UP</Text>
          <Text style={[s.h, { color: t.fg }]}>
            {'Level '}
            <Text style={[s.h, { color: t.accent, fontFamily: F.displayItalic }]}>{level}</Text>
          </Text>
          <View style={s.tok}>
            <Text style={[s.big, { color: t.accent }]}>{`+${tokens}`}</Text>
            <TokenCoin size={u(20)} progress={0} track="transparent" />
          </View>
          <Text style={[s.p, { color: t.mute }]}>{level % 5 === 0 ? `Every 5th level pays ${FIFTH_LEVEL_PRIZE} more. ${need - into} EXP to the next one.` : `${need - into} EXP to level ${level + 1}.`}</Text>
          <Pressable onPress={close} accessibilityRole="button" style={{ alignSelf: 'stretch' }}>
            <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.btn}>
              <Text style={[s.btnT, { color: t.onGrad }]}>Nice</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  mid: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: u(28) },
  card: { width: '100%', maxWidth: u(320), borderRadius: u(24), borderWidth: 1, padding: u(20), alignItems: 'center', gap: u(6) },
  halo: { width: u(132), height: u(132), borderRadius: u(66), alignItems: 'center', justifyContent: 'center', marginBottom: u(4) },
  kick: { fontFamily: F.mono, fontSize: u(9), letterSpacing: u(2) },
  h: { fontFamily: F.display, fontSize: u(30), lineHeight: u(36) },
  tok: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  big: { fontFamily: F.display, fontSize: u(24) },
  p: { fontFamily: F.body, fontSize: u(11.5), lineHeight: u(16), textAlign: 'center', marginBottom: u(8) },
  btn: { height: u(44), borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnT: { fontFamily: F.bodyBold, fontSize: u(13.5) },
});
