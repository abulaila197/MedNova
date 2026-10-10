import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/AppText';

import { Sheet } from '@/components/Sheet';
import { Display } from '@/components/Txt';
import { useApp, useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

const KINDS = ['Medical content', 'Game', 'Technical', 'Other'];

/** Locked Report sheet ("R1 Flag in place"), opened by the red ! in the header. */
export function ReportSheet() {
  const t = useTheme();
  const { reportOpen, setReport } = useApp();
  const [kind, setKind] = useState(0);
  const [text, setText] = useState('');
  const lt = t.mode === 'light';
  return (
    <Sheet open={reportOpen} onClose={() => setReport(false)}>
      <Text style={[s.k, { color: lt ? '#c4505d' : '#e07a85' }]}>REPORT</Text>
      <Display em="wrong?" italic style={s.h}>
        What looks{' '}
      </Display>
      <View style={s.row}>
        {['CASE FILES', 'CASE 03', 'CLUE 2'].map((c) => (
          <View key={c} style={[s.ctx, { backgroundColor: t.panel2, borderColor: t.panelLine }]}>
            <Text style={[s.ctxT, { color: t.fg }]}>{c}</Text>
          </View>
        ))}
      </View>
      <View style={[s.row, { flexWrap: 'wrap' }]}>
        {KINDS.map((k, i) => {
          const on = i === kind;
          return (
            <Pressable
              key={k}
              onPress={() => setKind(i)}
              style={[s.opt, { borderColor: on ? (lt ? 'rgba(233,191,79,0.7)' : 'rgba(111,214,255,0.7)') : t.panelLine, backgroundColor: on ? (lt ? 'rgba(233,191,79,0.12)' : 'rgba(111,214,255,0.12)') : 'transparent' }]}>
              <Text style={[s.optT, { color: on ? t.fg : t.mute }]}>{k}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="What happened?"
        placeholderTextColor={t.mute}
        multiline
        style={[s.ta, { color: t.fg, backgroundColor: t.panel, borderColor: t.panelLine }]}
      />
      <Pressable onPress={() => setReport(false)} style={[s.btn, { backgroundColor: t.red }]}>
        <Text style={s.btnT}>Send report</Text>
      </Pressable>
    </Sheet>
  );
}

const s = StyleSheet.create({
  k: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.7), marginTop: u(6) },
  h: { fontSize: u(26), lineHeight: u(30), letterSpacing: u(-0.26) },
  row: { flexDirection: 'row', gap: u(6) },
  ctx: { borderWidth: 1, borderRadius: u(8), paddingHorizontal: u(8), height: u(22), justifyContent: 'center' },
  ctxT: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(0.8) },
  opt: { borderWidth: 1, borderRadius: 999, paddingVertical: u(5), paddingHorizontal: u(10) },
  optT: { fontFamily: F.body, fontSize: u(9.5) },
  ta: { minHeight: u(60), borderWidth: 1, borderRadius: u(16), padding: u(12), fontFamily: F.body, fontSize: u(11), textAlignVertical: 'top' },
  btn: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: u(9), paddingHorizontal: u(18) },
  btnT: { color: '#fff', fontFamily: F.bodyBold, fontSize: u(11) },
});
