import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import Svg, { Circle } from 'react-native-svg';

import { engine } from '@/games/engine';
import { useTheme } from '@/state/app';
import { F } from '@/theme/tokens';

/** Your EXP, tokens and level progress, refreshed while on screen (the wallet lives on the phone, rule 6). */
export function useBalance() {
  const [b, setB] = useState({ exp: 0, tokens: 0, level: 1, into: 0, need: 60 });
  useEffect(() => {
    let live = true;
    const load = () => engine.wallet.balance().then((x) => live && setB((p) => (p.exp === x.exp && p.tokens === x.tokens ? p : x)));
    load();
    const id = setInterval(load, 1500);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  return b;
}

/**
 * LV3 "Orbit" badge: the level number in a small round chip, circled by a ring that fills toward the next level,
 * the same idea as the header coin. Other players' rings show only the track (`progress` left out).
 */
export function LevelBadge({ level, progress = 0, size, edge }: { level: number; progress?: number; size: number; edge?: string }) {
  const t = useTheme();
  const light = t.mode === 'light';
  const sw = Math.max(1.5, size * 0.09);
  const r = (size - sw) / 2;
  const len = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={[{ width: size, height: size, borderRadius: size / 2 }, edge ? { boxShadow: `0px 0px 0px 2px ${edge}` } : null]}
      accessibilityLabel={`Level ${level}`}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill={light ? '#fbf9f4' : '#141a3f'} stroke={light ? 'rgba(29,34,48,0.14)' : 'rgba(255,255,255,0.16)'} strokeWidth={sw} />
        {p > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={t.accent}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={`${len * p} ${len}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, s.mid]}>
        <Text style={{ fontFamily: F.bodyBold, fontSize: size * (level >= 100 ? 0.34 : 0.44), lineHeight: size * 0.6, color: t.fg }}>{level}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({ mid: { alignItems: 'center', justifyContent: 'center' } });
