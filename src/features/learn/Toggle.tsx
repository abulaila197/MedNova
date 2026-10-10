import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { useLearnColors } from './palette';

/** The small "My misses / All" pill toggle. `count` puts a rose number after an option's label. */
export function Toggle({ options, value, onChange }: { options: { label: string; count?: number; tail?: string }[]; value: number; onChange: (i: number) => void }) {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  return (
    <View style={[s.tg, { backgroundColor: c.tgBg }]}>
      {options.map((o, i) => {
        const on = i === value;
        return (
          <Pressable key={o.label} onPress={() => onChange(i)} style={[s.opt, on && { backgroundColor: c.tgOn }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
            <Text style={[s.txt, { color: on ? c.tgOnText : c.mute }]}>
              {o.label}
              {o.count != null ? <Text style={{ color: c.miss }}> {o.count}</Text> : null}
              {o.tail ? ` ${o.tail}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  tg: { flexDirection: 'row', alignSelf: 'flex-start', gap: u(4), padding: u(3), borderRadius: 999 },
  opt: { paddingVertical: u(5), paddingHorizontal: u(11), borderRadius: 999 },
  txt: { fontFamily: F.bodySemi, fontSize: u(10.5), lineHeight: u(13) },
});
