import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import type { useInfo } from '@/features/info/ui';
import { loadFlags, setFlag, useFlags } from '@/state/flags';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/** Admin: switches that reach every phone without a new build (Yazan 2026-11-16). */
export function Switches({ c }: { c: ReturnType<typeof useInfo> }) {
  const razan = useFlags((f) => f.show_razan);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void loadFlags().catch(() => {});
  }, []);
  const flip = async () => {
    setBusy(true);
    setErr(null);
    try {
      await setFlag('show_razan', !razan);
    } catch (e) {
      setErr((e as { message?: string })?.message ?? 'Could not save');
    }
    setBusy(false);
  };
  return (
    <View style={[s.box, { backgroundColor: c.surf, borderColor: c.line }]}>
      <Text style={[s.k, { color: c.kick }]}>SWITCHES</Text>
      <Pressable onPress={busy ? undefined : flip} style={[s.row, busy && { opacity: 0.6 }]} accessibilityRole="switch" accessibilityState={{ checked: razan }}>
        <View style={{ flex: 1 }}>
          <Text style={[s.name, { color: c.fg }]}>Show Razan</Text>
          <Text style={[s.sub, { color: c.mute }]}>{razan ? 'Razan shows everywhere.' : 'Razan is hidden: pickers, collection, rivals and stickers.'}</Text>
        </View>
        <View style={[s.track, { backgroundColor: razan ? c.t.accent : c.line }]}>
          <View style={[s.knob, { alignSelf: razan ? 'flex-end' : 'flex-start' }]} />
        </View>
      </Pressable>
      {err ? <Text style={[s.sub, { color: c.t.error }]}>{err}</Text> : null}
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
  knob: { width: u(16), height: u(16), borderRadius: u(8), backgroundColor: '#fff' },
});
