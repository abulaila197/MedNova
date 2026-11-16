import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import type { useInfo } from '@/features/info/ui';
import { checkNow, runningLabel, setUpdatesFirst, useUpdates } from '@/lib/updates';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/** Admin: this phone's updates (Yazan 2026-11-16): take test updates first, see what runs, check now. */
export function Switches({ c }: { c: ReturnType<typeof useInfo> }) {
  const first = useUpdates((x) => x.first);
  const [upd, setUpd] = useState<string | null>(null);
  const flipFirst = async () => {
    setUpd(null);
    try {
      await setUpdatesFirst(!first);
    } catch {
      setUpd('Could not save on this phone.');
    }
  };
  const check = async () => {
    setUpd('Checking…');
    try {
      setUpd(await checkNow());
    } catch (e) {
      setUpd((e as { message?: string })?.message ?? 'Could not check');
    }
  };
  return (
    <View style={[s.box, { backgroundColor: c.surf, borderColor: c.line }]}>
      <Text style={[s.k, { color: c.kick }]}>SWITCHES</Text>
      {/* Yazan 2026-11-16: every update reaches this phone first; only after his OK does it go out to everyone. */}
      <Pressable onPress={flipFirst} style={s.row} accessibilityRole="switch" accessibilityState={{ checked: first }}>
        <View style={{ flex: 1 }}>
          <Text style={[s.name, { color: c.fg }]}>Get updates first</Text>
          <Text style={[s.sub, { color: c.mute }]}>{first ? 'This phone takes test updates before everyone. Close and reopen the app to load one.' : 'This phone gets updates with everyone.'}</Text>
        </View>
        <View style={[s.track, { backgroundColor: first ? c.t.accent : c.line }]}>
          <View style={[s.knob, { alignSelf: first ? 'flex-end' : 'flex-start' }]} />
        </View>
      </Pressable>
      <View style={s.row}>
        <Text style={[s.sub, { color: c.mute, flex: 1 }]}>{upd ?? runningLabel()}</Text>
        <Pressable onPress={check} hitSlop={u(6)} style={[s.btn, { borderColor: c.line }]} accessibilityRole="button">
          <Text style={[s.name, { color: c.fg }]}>Check now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: { marginTop: u(14), borderWidth: 1, borderRadius: u(14), padding: u(12), gap: u(8) },
  k: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.5) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  name: { fontFamily: F.bodySemi, fontSize: u(12) },
  sub: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(13) },
  track: { width: u(36), height: u(20), borderRadius: u(10), padding: u(2), justifyContent: 'center' },
  btn: { borderWidth: 1, borderRadius: u(10), paddingVertical: u(5), paddingHorizontal: u(10) },
  knob: { width: u(16), height: u(16), borderRadius: u(8), backgroundColor: '#fff' },
});
