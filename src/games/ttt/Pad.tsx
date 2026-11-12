// Trace the Treatment's own look (look A "The prescription pad" on the app's navy, Yazan 2026-11-12): the story on a
// cream prescription pad with a perforated top and a serif, no ℞. Choices, labels and the main button use the app's
// colours; the 50/50 keeps Race to Diagnosis' cyan; the answer card keeps Spot the Flaw's colours (headings green,
// the explanation cyan, "You said" red). A short note shows whole; only a long one gets the line that opens it.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { PlayerFace } from '@/features/style/Frame';
import { loadFonts } from '@/features/loading/fonts';
import { tapped } from '@/lib/sound';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { LEVEL_NAME, casePoints, isRight, shownOf, type Case, type CaseRun } from './core';
import { fieldShort } from './data';

export const SERIF = 'LibreBaskerville_400Regular';
export const SERIF_IT = 'LibreBaskerville_400Regular_Italic';
export const C = {
  pad: '#fbfaf3',
  ink: '#1c2340',
  inkSoft: '#56608a',
  head: '#6a76a8',
  cyan: '#6fd6ff',
  gradA: '#a48bff',
  gradB: '#6fd6ff',
  onGrad: '#0b0b26',
  /** On the cream answer card (like Spot the Flaw): headings green, "You said" red, the explanations cyan. */
  secOk: '#14895a',
  why: '#0a7f99',
  said: '#d61f33',
  text: '#eef2ff',
  soft: '#cfd8ff',
  mute: '#9fb2ff',
  ok: '#14864b',
  okLight: '#5fe0a0',
  no: '#ff6b7d',
  opt: '#16225a',
  optLine: '#2f3f86',
  line: 'rgba(255,255,255,0.14)',
};

/** The desk: the app's navy, a deep blue fall to the bottom. */
export function PadSky() {
  // The fonts come with the loading page; load them here too for a resumed game.
  useEffect(() => {
    void loadFonts([SERIF, SERIF_IT]).catch(() => {});
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#1a2766', '#0d1738', '#0a1130']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** "CASE 2 OF 3" with the clock (or anything) on the right, then "Trace the Treatment" with Treatment in cyan italics. */
export function TopLine({ kicker, right, sub }: { kicker: string; right?: ReactNode; sub?: string }) {
  return (
    <View style={{ gap: u(2) }}>
      <View style={s.topRow}>
        <Text style={s.kick}>{kicker}</Text>
        {right}
      </View>
      <Text style={s.title} numberOfLines={1}>
        Trace the <Text style={[s.title, { fontFamily: SERIF_IT, color: C.cyan }]}>Treatment</Text>
      </Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

/** A small pill on the right of the top line (the clock, points). */
export const Pill = ({ text, warn }: { text: string; warn?: boolean }) => (
  <View style={[s.pill, warn ? { borderColor: C.no } : null]}>
    <Text style={[s.pillT, warn ? { color: C.no } : null]}>{text}</Text>
  </View>
);

/** The pad's head: setting and field on the left, the level on the right. */
function PadHead({ c }: { c: Case }) {
  return (
    <View style={s.padHead}>
      <Text style={s.padHeadT} numberOfLines={1}>{`${c.p} · ${fieldShort(c.f)}`.toUpperCase()}</Text>
      <View style={s.lvl}>
        <Text style={s.lvlT}>{LEVEL_NAME[c.lv].toUpperCase()}</Text>
      </View>
    </View>
  );
}

/** The perforated top edge of the pad. */
const Perf = () => (
  <View style={s.perf} pointerEvents="none">
    {Array.from({ length: 40 }, (_, i) => (
      <View key={i} style={s.perfDash} />
    ))}
  </View>
);

/**
 * The prescription pad with the story. A note that fits shows whole on a short pad (Yazan 2026-11-12); a long one
 * fills the room left, fades out, and gets the line that opens the whole note.
 */
export function Pad({ c, style, onOpen }: { c: Case; style?: object; onOpen?: () => void }) {
  const paras = c.s.split('\n\n');
  const [room, setRoom] = useState(0);
  const [need, setNeed] = useState(0);
  const long = room > 0 && need > room + 1;
  return (
    <View style={[s.pad, style]}>
      <Perf />
      <PadHead c={c} />
      <View style={{ flexShrink: 1, overflow: 'hidden' }} onLayout={(e) => setRoom(e.nativeEvent.layout.height)}>
        <View style={{ gap: u(8) }} onLayout={(e) => setNeed(e.nativeEvent.layout.height)}>
          {paras.map((p, i) => (
            <Text key={i} style={s.story}>
              {p}
            </Text>
          ))}
        </View>
        {long ? <LinearGradient colors={['rgba(251,250,243,0)', C.pad]} style={s.fade} pointerEvents="none" /> : null}
      </View>
      {long && onOpen ? (
        <Pressable onPress={tapped(onOpen)} accessibilityRole="button" accessibilityLabel="Tap to read the whole note" style={s.openBar}>
          <Text style={s.openT}>Tap to read the whole note  ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The whole note as one pad in a pop-up: no scrolling; a long note shrinks its font until it fits. */
export function NotePopup({ c, onClose }: { c: Case; onClose: () => void }) {
  const paras = c.s.split('\n\n');
  const base = u(13.5);
  const [fs, setFs] = useState(base);
  const [room, setRoom] = useState(0);
  const [need, setNeed] = useState(0);
  const fits = room > 0 && need > 0 && need <= room;
  // Measured, not guessed: while the note is taller than the pad, step the font down.
  const sizes = useRef({ room: 0, need: 0 });
  const check = () => {
    const { room: r, need: n } = sizes.current;
    if (r > 0 && n > r) setFs((f) => (f > u(7) ? Math.max(u(7), f * 0.93) : f));
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.popBack} onPress={onClose} accessibilityLabel="Close the note">
        <Pressable style={[s.pad, s.popPad]} onPress={() => {}}>
          <Perf />
          <PadHead c={c} />
          <View style={{ flex: 1, overflow: 'hidden' }} onLayout={(e) => { sizes.current.room = e.nativeEvent.layout.height; setRoom(sizes.current.room); check(); }}>
            <View key={fs} style={{ gap: fs * 0.6, opacity: fits || fs <= u(7) ? 1 : 0 }} onLayout={(e) => { sizes.current.need = e.nativeEvent.layout.height; setNeed(sizes.current.need); check(); }}>
              {paras.map((p, i) => (
                <Text key={i} style={[s.story, { fontSize: fs, lineHeight: fs * 1.55 }]}>
                  {p}
                </Text>
              ))}
            </View>
          </View>
          <Pressable onPress={tapped(onClose)} accessibilityRole="button" accessibilityLabel="Close" style={[s.openBar, s.closeBar]}>
            <Text style={s.openT}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** The case's question over the choices. */
export const Ask = ({ q }: { q: string }) => <Text style={s.ask}>{q.toUpperCase()}</Text>;

/** The 4 choices (fewer after 50/50), A to D. */
export function Choices({ c, run, picked, onPick, disabled }: { c: Case; run: CaseRun; picked: number | null; onPick: (i: number) => void; disabled?: boolean }) {
  const shown = shownOf(run);
  return (
    <View style={{ gap: u(6) }}>
      {run.order.map((i, k) => {
        const gone = !shown.includes(i);
        const on = picked === i;
        const text = c.a[i].o;
        return (
          <Animated.View key={i} entering={FadeInDown.duration(220).delay(k * 50)}>
            <Pressable
              onPress={tapped(() => onPick(i))}
              disabled={disabled || gone}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: disabled || gone }}
              accessibilityLabel={`${'ABCD'[k]}. ${text}`}
              style={[s.opt, on ? s.optOn : null, gone ? { opacity: 0.3 } : null]}>
              <View style={[s.optDot, on ? { backgroundColor: C.cyan } : null]}>
                <Text style={[s.optL, on ? { color: C.onGrad } : null]}>{'ABCD'[k]}</Text>
              </View>
              <Text style={[s.optT, gone ? { textDecorationLine: 'line-through' } : null]}>{text}</Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

/** The main button in the app's purple-to-cyan. */
export function Btn({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={tapped(onPress)} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={{ opacity: disabled ? 0.45 : 1 }}>
      <LinearGradient colors={[C.gradA, C.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.go}>
        <Text style={s.goT} numberOfLines={1}>
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

export type RevealRow = { id: string; name: string; character: string; color: string; run: CaseRun; points: number; rank?: number | null };

/**
 * The answer card after every case: the treatment, the clue that pointed to it and why, then why each other choice
 * doesn't fit. `run` is yours (Solo, vs rivals) and `rows` everyone's answers at once.
 */
export function Explain({ c, run, rows, foot }: { c: Case; run?: CaseRun; rows?: RevealRow[]; foot?: ReactNode }) {
  const pts = run ? casePoints(c.lv, run) : null;
  const yours = run && run.pick != null && run.pick > 0 ? c.a[run.pick].o : null;
  return (
    <View style={{ flex: 1, gap: u(10) }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: u(10), paddingBottom: u(6) }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(260)} style={s.card}>
          <Perf />
          <View style={s.cardHead}>
            <Text style={s.cardKick}>THE TREATMENT</Text>
            {pts != null ? <Text style={[s.cardPts, { color: pts > 0 ? C.ok : C.inkSoft }]}>{pts > 0 ? `+${pts}` : '0'}</Text> : null}
          </View>
          <Text style={s.cardTitle}>{c.t}</Text>
          {yours ? <Text style={s.yours}>{`You said: ${yours}`}</Text> : run?.timeUp ? <Text style={s.yours}>Time ran out</Text> : null}
          <Text style={s.cardSec}>THE CLUE</Text>
          <Text style={[s.cardBody, { color: C.why }]}>{c.c}</Text>
          <Text style={s.cardSec}>WHY</Text>
          <Text style={[s.cardBody, { color: C.why }]}>{c.a[0].w}</Text>
          <Text style={s.cardSec}>WHY NOT THE OTHERS</Text>
          {c.a.slice(1).map((a, i) => (
            <View key={i} style={s.rest}>
              <Text style={s.restO}>{a.o}</Text>
              <Text style={[s.cardBody, { color: C.why }]}>{a.w}</Text>
            </View>
          ))}
        </Animated.View>
        {rows?.length ? (
          <View style={s.rows}>
            {rows.map((r) => {
              const ok = isRight(r.run);
              const said = r.run.pick != null && r.run.pick >= 0 ? c.a[r.run.pick].o : 'No answer';
              return (
                <View key={r.id} style={[s.prow, { borderColor: r.color }]}>
                  <PlayerFace slug={r.character} size={u(22)} userId={r.id} still />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.pname} numberOfLines={1}>{r.rank ? `${r.rank}. ${r.name}` : r.name}</Text>
                    <Text style={[s.pmarks, { color: ok ? C.okLight : C.no }]} numberOfLines={1}>{`${ok ? '✔' : '✘'} ${said}`}</Text>
                  </View>
                  <Text style={[s.ppts, { color: r.points > 0 ? C.okLight : C.mute }]}>{r.points > 0 ? `+${r.points}` : '0'}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
      {foot}
    </View>
  );
}

export const s = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: u(10) },
  kick: { fontFamily: F.bodySemi, fontSize: u(10), letterSpacing: u(1.6), color: C.mute, textTransform: 'uppercase' },
  title: { fontFamily: SERIF, fontSize: u(21), lineHeight: u(27), color: C.text },
  sub: { fontFamily: F.body, fontSize: u(11.5), color: C.mute },
  pill: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingVertical: u(3), paddingHorizontal: u(9) },
  pillT: { fontFamily: F.mono, fontSize: u(10.5), color: C.soft },
  pad: { backgroundColor: C.pad, borderRadius: u(8), paddingTop: u(14), paddingHorizontal: u(14), paddingBottom: u(12), overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: u(12), shadowOffset: { width: 0, height: u(6) }, elevation: 5 },
  perf: { position: 'absolute', left: 0, right: 0, top: u(3), flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: u(4), overflow: 'hidden' },
  perfDash: { width: u(5), height: u(3), borderRadius: 1, backgroundColor: 'rgba(13,23,56,0.2)', marginRight: u(3) },
  padHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: u(8), marginBottom: u(7) },
  padHeadT: { fontFamily: F.bodyBold, fontSize: u(8.5), letterSpacing: u(1.2), color: C.head, flexShrink: 1 },
  lvl: { backgroundColor: '#e6ebff', borderRadius: 999, paddingVertical: u(2), paddingHorizontal: u(7) },
  lvlT: { fontFamily: F.bodyBold, fontSize: u(8), letterSpacing: u(1), color: '#3b4aa8' },
  story: { fontFamily: SERIF, fontSize: u(10.5), lineHeight: u(16), color: C.ink },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: u(34) },
  openBar: { height: u(28), marginTop: u(6), alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: 'rgba(106,118,168,0.4)' },
  closeBar: { marginTop: u(10) },
  openT: { fontFamily: F.bodyBold, fontSize: u(10.5), color: '#3b4aa8', letterSpacing: u(0.3) },
  popBack: { flex: 1, backgroundColor: 'rgba(6,10,30,0.82)', paddingHorizontal: u(14), paddingVertical: u(34), justifyContent: 'center' },
  popPad: { flex: 1 },
  ask: { fontFamily: F.bodySemi, fontSize: u(10), letterSpacing: u(1.6), color: C.cyan },
  opt: { flexDirection: 'row', alignItems: 'center', gap: u(9), borderRadius: u(10), borderWidth: 1, borderColor: C.optLine, backgroundColor: C.opt, paddingVertical: u(7), paddingHorizontal: u(10) },
  optOn: { borderWidth: 2, borderColor: C.cyan, backgroundColor: '#1b2d6e' },
  optDot: { width: u(19), height: u(19), borderRadius: 999, backgroundColor: '#22307a', alignItems: 'center', justifyContent: 'center' },
  optL: { fontFamily: F.bodyBold, fontSize: u(9.5), color: C.cyan },
  optT: { flex: 1, fontFamily: F.bodySemi, fontSize: u(12), lineHeight: u(16), color: C.text },
  go: { borderRadius: u(12), paddingVertical: u(12), alignItems: 'center', justifyContent: 'center' },
  goT: { fontFamily: F.bodyBold, fontSize: u(14), color: C.onGrad },
  card: { backgroundColor: C.pad, borderRadius: u(10), padding: u(14), paddingTop: u(16), gap: u(5) },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardKick: { fontFamily: F.bodyBold, fontSize: u(9), letterSpacing: u(1.6), color: C.head },
  cardPts: { fontFamily: SERIF, fontSize: u(20), lineHeight: u(26) },
  cardTitle: { fontFamily: SERIF, fontSize: u(17), lineHeight: u(23), color: C.ink },
  cardSec: { fontFamily: F.bodyBold, fontSize: u(8.5), letterSpacing: u(1.4), color: C.secOk, marginTop: u(6) },
  cardBody: { fontFamily: F.body, fontSize: u(11.5), lineHeight: u(16.5), color: C.ink },
  yours: { fontFamily: F.bodySemi, fontSize: u(11), lineHeight: u(15), color: C.said },
  rest: { gap: u(2), borderLeftWidth: 2, borderLeftColor: 'rgba(28,35,64,0.15)', paddingLeft: u(8), marginTop: u(2) },
  restO: { fontFamily: F.bodySemi, fontSize: u(11.5), lineHeight: u(15.5), color: C.inkSoft },
  rows: { gap: u(6) },
  prow: { flexDirection: 'row', alignItems: 'center', gap: u(8), borderWidth: 1, borderRadius: u(12), paddingVertical: u(6), paddingHorizontal: u(8), backgroundColor: 'rgba(255,255,255,0.05)' },
  pname: { fontFamily: F.bodySemi, fontSize: u(12), color: C.text },
  pmarks: { fontFamily: F.body, fontSize: u(10.5) },
  ppts: { fontFamily: SERIF, fontSize: u(16) },
});
