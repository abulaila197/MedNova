import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/AppText';

import { Screen } from '@/components/Screen';
import { INTENTS } from '@/features/info/content';
import { GradBtn, InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { call } from '@/online/api';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/** Contact, locked "C1 I want to ___": one sentence instead of a form. Tap the blank to cycle, or pick a chip. */
export default function Page() {
  const c = useInfo();
  const [pick, setPick] = useState(1); // the preview shows "report a bug"
  const [msg, setMsg] = useState('');
  const it = INTENTS[pick];
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Saved to Supabase and listed on the Admin page (Yazan 2026-10-11: Supabase only, no email app).
  const send = async () => {
    if (busy) return;
    if (msg.trim().length < 2) return setSaid({ ok: false, text: 'Write your message first.' });
    setBusy(true);
    try {
      await call('submit_contact', { kind: it.key, body: msg });
      setMsg('');
      setSaid({ ok: true, text: 'Sent. Thank you, we read every message.' });
    } catch {
      setSaid({ ok: false, text: 'Not sent. Check your connection and try again.' });
    }
    setBusy(false);
  };
  return (
    <Screen tab={null} glow={21}>
      <InfoScroll>
        <Kicker>Contact</Kicker>
        <Text style={[s.H, { color: c.fg }]}>I want to</Text>
        <Pressable onPress={() => setPick((pick + 1) % INTENTS.length)} accessibilityRole="button" accessibilityLabel={`I want to ${it.key}`} style={[s.blank, { borderColor: c.t.accent }]}>
          <Text style={[s.H, s.blankT, { color: c.t.accent }]}>{it.key}</Text>
        </Pressable>
        <View style={s.opts}>
          {INTENTS.map((o, i) => {
            const on = i === pick;
            return (
              <Pressable
                key={o.key}
                onPress={() => setPick(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[s.opt, on ? { borderColor: c.chipOnLine, backgroundColor: c.chipOnFill } : { borderColor: c.line }]}
              >
                <Text style={[s.optT, { color: on ? c.fg : c.mute }]}>{o.key}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={msg}
          onChangeText={setMsg}
          placeholder={it.hint}
          placeholderTextColor={c.mute}
          multiline
          textAlignVertical="top"
          style={[s.ta, { backgroundColor: c.surf, borderColor: c.line, color: c.fg }]}
        />
        {said ? <Text style={[s.said, { color: said.ok ? c.t.accent : c.t.red }]}>{said.text}</Text> : null}
        <GradBtn label={busy ? 'Sending...' : 'Send'} onPress={send} style={s.send} />
      </InfoScroll>
    </Screen>
  );
}

const s = StyleSheet.create({
  // .H at 30px / line-height 1.1
  H: { ...StyleSheet.flatten(ui.H), fontFamily: F.display, fontSize: u(30), lineHeight: u(33), letterSpacing: u(-0.3) },
  // .blank: italic accent with a 2px underline that sits 4px under the line box
  blank: { alignSelf: 'flex-start', borderBottomWidth: u(2), paddingBottom: u(4), marginBottom: u(-6) },
  blankT: { marginTop: 0, fontFamily: F.displayItalic },
  said: { fontFamily: F.bodyMedium, fontSize: u(10.5), marginTop: u(8) },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6), marginTop: u(12) },
  opt: { borderWidth: 1, borderRadius: 999, paddingVertical: u(5), paddingHorizontal: u(10) },
  optT: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(11.5) },
  ta: {
    marginTop: u(12),
    minHeight: u(84),
    borderRadius: u(16),
    borderWidth: 1,
    padding: u(12),
    paddingTop: u(12),
    fontFamily: F.body,
    fontSize: u(11),
    lineHeight: u(16.5),
    outlineStyle: 'none',
  } as object,
  send: { marginTop: u(12) },
});
