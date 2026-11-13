import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { tapped } from '@/lib/sound';
import { useTheme } from '@/state/app';
import { u, useScreen } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { allKeys, type FieldMenu, toggleAll, toggleField } from './fields';
import { tr } from '@/i18n';

/**
 * The field menu under a setup choice (Yazan 2026-11-11). Opens below the choice's arrow and closes on a tap anywhere
 * else. "All" at the top; untick All and every tick goes; untick one field and All goes with it.
 */
export function FieldPicker({ menu, ticked, top, onChange, onClose }: { menu: FieldMenu; ticked: string[] | null; top: number; onChange: (t: string[]) => void; onClose: () => void }) {
  const t = useTheme();
  const { height } = useScreen();
  const all = allKeys(menu);
  const on = (k: string) => ticked == null || ticked.includes(k);
  const allOn = all.every(on);
  const have = menu.total(ticked);
  const short = have < menu.min;
  const maxH = Math.min(u(300), height - top - u(24));
  const flip = maxH < u(160);
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={tr('Close the field list')} />
      <View
        style={[
          s.panel,
          { backgroundColor: t.panel, borderColor: t.accent, maxHeight: flip ? u(300) : maxH },
          flip ? { bottom: height - top + u(14) } : { top },
        ]}>
        <ScrollView bounces={false} contentContainerStyle={{ paddingVertical: u(4) }}>
          <Row label={tr('All')} count={menu.total(null)} on={allOn} bold onPress={() => onChange(toggleAll(menu, ticked))} />
          {menu.groups.map((g, gi) => (
            <View key={g.title ?? gi}>
              {g.title ? <Text style={[s.group, { color: t.dim }]}>{g.title.toUpperCase()}</Text> : null}
              {g.items.map((i) => (
                <Row key={i.key} label={i.label} count={i.count} on={on(i.key)} onPress={() => onChange(toggleField(menu, ticked, i.key))} />
              ))}
            </View>
          ))}
        </ScrollView>
        <Text style={[s.foot, { color: short ? t.error : t.dim, borderTopColor: t.panelLine }]}>
          {short ? tr('Tick at least {min} {unit} (now {have}).', { min: menu.min, unit: menu.unit, have }) : tr('{have} {unit} ticked.', { have, unit: menu.unit })}
        </Text>
      </View>
    </Modal>
  );
}

function Row({ label, count, on, bold, onPress }: { label: string; count: number; on: boolean; bold?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={tapped(onPress)} style={s.row} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${label}, ${count}`}>
      <View style={[s.box, { borderColor: on ? t.accent : t.chipLine, backgroundColor: on ? t.accent : 'transparent' }]}>
        {on ? <Text style={[s.tick, { color: t.panel }]}>✓</Text> : null}
      </View>
      <Text style={[s.label, { color: t.fg, fontFamily: bold ? F.bodyBold : F.bodySemi }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[s.count, { color: t.dim }]}>{count}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  panel: { position: 'absolute', left: u(16), right: u(16), borderWidth: 1, borderRadius: u(14), overflow: 'hidden' },
  group: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.4), paddingHorizontal: u(14), paddingTop: u(10), paddingBottom: u(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(10), paddingHorizontal: u(14), paddingVertical: u(7) },
  box: { width: u(16), height: u(16), borderRadius: u(4), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tick: { fontFamily: F.bodyBold, fontSize: u(10), lineHeight: u(12) },
  label: { flex: 1, fontSize: u(11), lineHeight: u(14) },
  count: { fontFamily: F.mono, fontSize: u(9.5) },
  foot: { fontFamily: F.body, fontSize: u(9.5), paddingHorizontal: u(14), paddingVertical: u(8), borderTopWidth: 1 },
});
