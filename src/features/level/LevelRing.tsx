import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '@/components/AppText';
import { Face } from '@/games/shell/Face';
import { useTheme } from '@/state/app';
import { F } from '@/theme/tokens';

/**
 * Your face in the EXP ring with the level chip, the header's look (#34, #51) at any size, for the Results level
 * counter and the level-up pop-up. `progress` 0-1 is how far into the next level.
 */
export function LevelRing({ size, level, progress, slug }: { size: number; level: number; progress: number; slug: string }) {
  const t = useTheme();
  const sw = Math.max(2, size * 0.08);
  const r = (size - sw) / 2;
  const len = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="#141a3f" stroke="rgba(255,255,255,0.16)" strokeWidth={sw} />
        {p > 0 ? <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.accent} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${len * p} ${len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} /> : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, s.center]}>
        <Face slug={slug} size={size - sw * 2 - 2} />
      </View>
      <View style={[s.chip, { backgroundColor: t.accent, right: -size * 0.1, bottom: -size * 0.06, minWidth: size * 0.42, height: size * 0.34, paddingHorizontal: size * 0.06 }]}>
        <Text style={{ fontFamily: F.bodyBold, fontSize: size * 0.22, lineHeight: size * 0.28, color: t.onGrad }}>{level}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  chip: { position: 'absolute', borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
