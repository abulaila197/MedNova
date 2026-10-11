import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/AppText';

import { Sheet } from '@/components/Sheet';
import { Display } from '@/components/Txt';
import { GAMES } from '@/data/games';
import { engine } from '@/games/engine';
import { supabase } from '@/lib/supabase';
import { useApp, useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

const KINDS = ['Medical content', 'Game', 'Technical', 'Other'];

type Ctx = { chips: string[]; data: Record<string, unknown> };

/** What was on screen when the ! was tapped: the page or game, the mode, and the last case or question answered. */
async function contextOf(path: string, params: Record<string, string | string[] | undefined>): Promise<Ctx> {
  const one = (k: string) => (typeof params[k] === 'string' ? (params[k] as string) : undefined);
  const data: Record<string, unknown> = { path, params, platform: Platform.OS, version: '0.1' };
  const m = path.match(/^\/play\/([^/]+)/);
  if (!m) {
    const page = path.split('/').filter(Boolean);
    const id = one('id') ?? one('book');
    return { chips: [...(page.length ? page : ['games']).map((p) => p.replace(/-/g, ' ').toUpperCase()), ...(id ? [id.toUpperCase()] : [])].slice(0, 3), data };
  }
  const g = GAMES.find((x) => x.key === m[1]);
  const chips = [g ? `${g.lead} ${g.em}`.replace(/^The /, '').toUpperCase() : m[1].toUpperCase()];
  data.game = m[1];
  const playId = one('play');
  if (playId) {
    const play = await engine.recorder.get(playId).catch(() => null);
    if (play) {
      chips.push(play.mode.toUpperCase());
      data.mode = play.mode;
      data.play = play.id;
      const { items } = await engine.recorder.all();
      const last = items.filter((i) => i.playId === play.id).sort((a, b) => b.at - a.at)[0];
      if (last) {
        chips.push(last.itemId.toUpperCase());
        data.item = last.itemId;
      }
    }
  }
  return { chips, data };
}

/** Locked Report sheet ("R1 Flag in place"), opened by the red ! in the header. */
export function ReportSheet() {
  const t = useTheme();
  const { reportOpen, setReport } = useApp();
  const [kind, setKind] = useState(0);
  const [text, setText] = useState('');
  const [ctx, setCtx] = useState<Ctx>({ chips: [], data: {} });
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const path = usePathname();
  const params = useGlobalSearchParams();
  useEffect(() => {
    if (!reportOpen) return;
    setState('idle');
    contextOf(path, params).then(setCtx, () => setCtx({ chips: [], data: { path } }));
    // Only when the sheet opens: the page under it doesn't change while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportOpen]);
  const send = async () => {
    if (state === 'sending') return;
    setState('sending');
    const { error } = await supabase.rpc('submit_report', { kind: KINDS[kind], body: text.trim(), context: { ...ctx.data, chips: ctx.chips, theme: t.mode } });
    if (error) return setState('error');
    setState('sent');
    setText('');
    setTimeout(() => setReport(false), 1200);
  };
  const lt = t.mode === 'light';
  return (
    <Sheet open={reportOpen} onClose={() => setReport(false)}>
      <Text style={[s.k, { color: lt ? '#c4505d' : '#e07a85' }]}>REPORT</Text>
      <Display em="wrong?" italic style={s.h}>
        What looks{' '}
      </Display>
      <View style={s.row}>
        {ctx.chips.map((c) => (
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
      <View style={s.sendRow}>
        <Pressable onPress={send} disabled={state === 'sending' || state === 'sent'} style={[s.btn, { backgroundColor: t.red, opacity: state === 'sending' ? 0.6 : 1 }]}>
          <Text style={s.btnT}>{state === 'sending' ? 'Sending…' : state === 'sent' ? 'Sent' : 'Send report'}</Text>
        </Pressable>
        {state === 'sent' ? <Text style={[s.msg, { color: t.fg }]}>Thank you. We'll look into it.</Text> : null}
        {state === 'error' ? <Text style={[s.msg, { color: t.red }]}>Not sent. Check your connection and try again.</Text> : null}
      </View>
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
  sendRow: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  msg: { flexShrink: 1, fontFamily: F.body, fontSize: u(10), lineHeight: u(13) },
  btn: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: u(9), paddingHorizontal: u(18) },
  btnT: { color: '#fff', fontFamily: F.bodyBold, fontSize: u(11) },
});
