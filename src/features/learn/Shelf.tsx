import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { Spine } from './data';
import { useLearnColors } from './palette';
import { VText } from './VText';

/** One shelf of book spines on a ledge. Spines fill their mastery bar; tapping one opens it. */
export function Shelf({ spines, heights, onOpen }: { spines: Spine[]; heights: number[]; onOpen: (s: Spine) => void }) {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  const tall = Math.max(...heights);
  return (
    <View style={s.shelf}>
      <View style={[s.row, { height: u(4 + tall) }]}>
        {spines.map((sp, i) => {
          const h = heights[i % heights.length];
          const col = c.spineColors[sp.c];
          return (
            <Pressable
              key={sp.name}
              onPress={() => onOpen(sp)}
              accessibilityRole="button"
              accessibilityLabel={`${sp.name}, ${sp.count} dossiers`}
              style={[s.spn, { height: u(h), borderColor: c.spineLine, boxShadow: c.spineShadow }]}
            >
              <LinearGradient colors={[c.spineA, c.spineB]} style={StyleSheet.absoluteFill} />
              <LinearGradient colors={[...c.spineSheen]} locations={[0, 0.3, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <View style={[s.stripe, { backgroundColor: col }]} />
              <View style={s.sn}>
                <VText h={u(h - 2 - 18 - 32)} line={u(14)} dir="up" top style={{ fontFamily: F.display, fontSize: u(11.5), letterSpacing: u(0.115), color: t.fg }}>
                  {sp.name}
                </VText>
              </View>
              <Text style={[s.sc, { color: c.mute }]}>{sp.count}</Text>
              <View style={[s.sb, { backgroundColor: c.barTrack }]}>
                <View style={{ width: `${sp.mastery * 100}%`, height: '100%', backgroundColor: col }} />
              </View>
            </Pressable>
          );
        })}
      </View>
      <LinearGradient colors={[c.sledgeA, c.sledgeB]} style={[s.ledge, { boxShadow: c.sledgeShadow }]} />
    </View>
  );
}

const s = StyleSheet.create({
  shelf: { marginHorizontal: u(-4) },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: u(5), paddingTop: u(4), paddingHorizontal: u(4) },
  spn: {
    flex: 1,
    borderWidth: 1,
    borderTopLeftRadius: u(7),
    borderTopRightRadius: u(7),
    borderBottomLeftRadius: u(3),
    borderBottomRightRadius: u(3),
    overflow: 'hidden',
  },
  stripe: { position: 'absolute', left: u(8), right: u(8), top: u(10), height: u(2), borderRadius: u(2), opacity: 0.8 },
  // CSS top is 18; Fraunces' vertical run starts ~2px lower in RN, so lift it to land where the reference does.
  sn: { position: 'absolute', left: 0, right: 0, top: u(16) },
  sc: { position: 'absolute', left: 0, right: 0, bottom: u(22), textAlign: 'center', fontFamily: F.mono, fontSize: u(8), lineHeight: u(10) },
  sb: { position: 'absolute', left: u(12), right: u(12), bottom: u(10), height: u(5), borderRadius: u(3), overflow: 'hidden' },
  ledge: { height: u(6), marginHorizontal: u(2), borderRadius: u(2) },
});
