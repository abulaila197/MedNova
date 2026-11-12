// Spot the Flaw's own look (look B "The red pen", Yazan 2026-11-12): the app's navy with a clean white case sheet that
// has a red margin line, like a marked paper. The story is set in a serif; the Highlight help circles the part in red
// pen. Rounded choices with coral A-D letters, a coral "Lock it in".
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { PlayerFace } from '@/features/style/Frame';
import { loadFonts } from '@/features/loading/fonts';
import { tapped } from '@/lib/sound';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { LEVEL_NAME, casePoints, right1, right2, shownOf, type Case, type CaseRun } from './core';
import { hospitalOf } from './data';

export const SERIF = 'Fraunces_400Regular';
export const SERIF_BOLD = 'Fraunces_800ExtraBold';
export const PEN = 'Caveat_700Bold';
export const C = {
  paper: '#f7f8fc',
  ink: '#1c2340',
  inkSoft: '#56608a',
  head: '#7a86b3',
  margin: '#ff8b96',
  pen: '#e2283a',
  /** On the white answer card (Yazan 2026-11-12): headings green, "You said" red, the explanations cyan. */
  secOk: '#14895a',
  why: '#0a7f99',
  said: '#d61f33',
  coral: '#ff5d6c',
  text: '#eef2ff',
  soft: '#cfd8ff',
  mute: '#9fb2ff',
  ok: '#14864b',
  okLight: '#5fe0a0',
  no: '#d62839',
  line: 'rgba(255,255,255,0.14)',
};

/** The desk: the app's navy, a deep blue fall to the bottom. */
export function StfSky() {
  // The fonts come with the loading page; load them here too for a resumed game.
  useEffect(() => {
    void loadFonts([SERIF, SERIF_BOLD, PEN]).catch(() => {});
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#101a46', '#0d1640', '#0a1131']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** "CASE 2 OF 3" with the clock (or anything) on the right, then "Spot the Flaw" with Flaw in coral. */
export function TopLine({ kicker, right, sub }: { kicker: string; right?: ReactNode; sub?: string }) {
  return (
    <View style={{ gap: u(2) }}>
      <View style={s.topRow}>
        <Text style={s.kick}>{kicker}</Text>
        {right}
      </View>
      <Text style={s.title} numberOfLines={1}>
        Spot the <Text style={[s.title, { color: C.coral }]}>Flaw</Text>
      </Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

/** A small pill on the right of the top line (the clock, points). */
export const Pill = ({ text, warn }: { text: string; warn?: boolean }) => (
  <View style={[s.pill, warn ? { borderColor: C.coral } : null]}>
    <Text style={[s.pillT, warn ? { color: C.coral } : null]}>{text}</Text>
  </View>
);

/** The case sheet: header, the story in a serif, the red margin line. Scrolls inside; Highlight circles the flaw. */
export function Sheet({ c, highlight, style, onOpen }: { c: Case; highlight?: boolean; style?: object; onOpen?: () => void }) {
  const paras = c.s.split('\n\n');
  const ys = useRef<number[]>([]);
  const scroll = useRef<ScrollView>(null);
  const [more, setMore] = useState(true);
  // The circled part scrolls into view.
  useEffect(() => {
    if (!highlight) return;
    const i = paras.findIndex((p) => p.includes(c.h));
    const y = ys.current[i];
    if (y != null) setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, y - u(10)), animated: true }), 60);
  }, [highlight]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={[s.sheet, style]}>
      <View style={s.margin} />
      <View style={s.sheetHead}>
        <Text style={s.sheetHeadT} numberOfLines={1}>{`${c.p} · ${hospitalOf(c.id)}`.toUpperCase()}</Text>
        <Text style={s.sheetHeadT}>{LEVEL_NAME[c.lv].toUpperCase()}</Text>
      </View>
      <ScrollView
        ref={scroll}
        nestedScrollEnabled
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: u(8), paddingBottom: onOpen ? u(40) : u(26) }}
        showsVerticalScrollIndicator
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          setMore(contentOffset.y + layoutMeasurement.height < contentSize.height - u(12));
        }}
        scrollEventThrottle={64}>
        {paras.map((p, i) => {
          const at = highlight ? p.indexOf(c.h) : -1;
          return (
            <Text key={i} style={s.story} onLayout={(e) => (ys.current[i] = e.nativeEvent.layout.y)}>
              {at < 0 ? (
                p
              ) : (
                <>
                  {p.slice(0, at)}
                  <Text style={s.circled}>{c.h}</Text>
                  {p.slice(at + c.h.length)}
                </>
              )}
            </Text>
          );
        })}
      </ScrollView>
      {highlight ? (
        <Animated.Text entering={FadeIn.duration(300)} style={s.penNote}>
          look here
        </Animated.Text>
      ) : null}
      {more ? <LinearGradient colors={['rgba(247,248,252,0)', C.paper]} style={[s.fade, onOpen ? { bottom: u(30) } : null]} pointerEvents="none" /> : null}
      {onOpen ? (
        <Pressable onPress={tapped(onOpen)} accessibilityRole="button" accessibilityLabel="Tap to read the whole note" style={s.openBar}>
          <Text style={s.openT}>Tap to read the whole note  ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The whole note as one paper in a pop-up (Yazan 2026-11-12): no scrolling; a long note shrinks its font until it fits.
 */
export function NotePopup({ c, highlight, onClose }: { c: Case; highlight?: boolean; onClose: () => void }) {
  const paras = c.s.split('\n\n');
  const base = u(13.5);
  const [fs, setFs] = useState(base);
  const [room, setRoom] = useState(0);
  const [need, setNeed] = useState(0);
  const fits = room > 0 && need > 0 && need <= room;
  // Measured, not guessed: while the note is taller than the paper, step the font down.
  const sizes = useRef({ room: 0, need: 0 });
  const check = () => {
    const { room: r, need: n } = sizes.current;
    if (r > 0 && n > r) setFs((f) => (f > u(7) ? Math.max(u(7), f * 0.93) : f));
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.popBack} onPress={onClose} accessibilityLabel="Close the note">
        <Pressable style={[s.sheet, s.popSheet]} onPress={() => {}}>
          <View style={s.margin} />
          <View style={s.sheetHead}>
            <Text style={s.sheetHeadT} numberOfLines={1}>{`${c.p} · ${hospitalOf(c.id)}`.toUpperCase()}</Text>
            <Text style={s.sheetHeadT}>{LEVEL_NAME[c.lv].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, overflow: 'hidden' }} onLayout={(e) => { sizes.current.room = e.nativeEvent.layout.height; setRoom(sizes.current.room); check(); }}>
            <View key={fs} style={{ gap: fs * 0.6, opacity: fits || fs <= u(7) ? 1 : 0 }} onLayout={(e) => { sizes.current.need = e.nativeEvent.layout.height; setNeed(sizes.current.need); check(); }}>
              {paras.map((p, i) => {
                const at = highlight ? p.indexOf(c.h) : -1;
                const st = [s.story, { fontSize: fs, lineHeight: fs * 1.5 }];
                return (
                  <Text key={i} style={st}>
                    {at < 0 ? p : (
                      <>
                        {p.slice(0, at)}
                        <Text style={s.circled}>{c.h}</Text>
                        {p.slice(at + c.h.length)}
                      </>
                    )}
                  </Text>
                );
              })}
            </View>
          </View>
          <Pressable onPress={tapped(onClose)} accessibilityRole="button" accessibilityLabel="Close" style={s.openBar}>
            <Text style={s.openT}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** The question over the choices. Stage 2 carries a small tick for the locked stage 1. */
export function Ask({ stage }: { stage: 1 | 2 }) {
  return (
    <View style={s.askRow}>
      {stage === 2 ? <Text style={[s.ask, { color: C.okLight, fontSize: u(8.5) }]}>✓ STAGE 1 LOCKED · STAGE 2</Text> : <Text style={[s.ask, { color: C.mute, fontSize: u(8.5) }]}>STAGE 1 OF 2</Text>}
      <Text style={s.ask}>{stage === 1 ? 'WHAT WENT WRONG?' : 'WHAT SHOULD HAVE HAPPENED?'}</Text>
    </View>
  );
}

/** The 4 choices of a stage (fewer after 50/50), A to D. */
export function Choices({ c, run, stage, picked, onPick, disabled }: { c: Case; run: CaseRun; stage: 1 | 2; picked: number | null; onPick: (i: number) => void; disabled?: boolean }) {
  const shown = shownOf(run, stage);
  const all = stage === 1 ? run.order1 : run.order2;
  return (
    <View style={{ gap: u(6) }}>
      {all.map((i, k) => {
        const gone = !shown.includes(i);
        const on = picked === i;
        const text = stage === 1 ? c.a[i].o : c.a[i].x;
        return (
          <Animated.View key={`${stage}:${i}`} entering={FadeInDown.duration(220).delay(k * 50)}>
            <Pressable
              onPress={tapped(() => onPick(i))}
              disabled={disabled || gone}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: disabled || gone }}
              accessibilityLabel={`${'ABCD'[k]}. ${text}`}
              style={[s.opt, on ? s.optOn : null, gone ? { opacity: 0.28 } : null]}>
              <Text style={s.optL}>{'ABCD'[k]}</Text>
              <Text style={[s.optT, gone ? { textDecorationLine: 'line-through' } : null]}>{text}</Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

export function Btn({ label, onPress, go, disabled, flex }: { label: string; onPress?: () => void; go?: boolean; disabled?: boolean; flex?: number }) {
  return (
    <Pressable onPress={tapped(onPress)} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={[go ? s.go : s.help, flex != null ? { flex } : null, { opacity: disabled ? 0.45 : 1 }]}>
      <Text style={go ? s.goT : s.helpT} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A help button in Race to Diagnosis' colours (Yazan 2026-11-12): a dark tinted fill, a coloured edge and coloured text. */
export const HELP_TONE = {
  fifty: { bg: '#142741', line: '#19637e', fg: '#67e8f9', icon: '✂️' },
  highlight: { bg: '#231b4e', line: '#504188', fg: '#d8b4fe', icon: '🖍️' },
} as const;
export function HelpBtn({ label, tone, onPress, disabled }: { label: string; tone: keyof typeof HELP_TONE; onPress: () => void; disabled?: boolean }) {
  const t = HELP_TONE[tone];
  return (
    <Pressable onPress={tapped(onPress)} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={[s.helpTone, { backgroundColor: t.bg, borderColor: t.line }]}>
      <Text style={[s.helpToneT, { color: t.fg, opacity: disabled ? 0.45 : 1 }]} numberOfLines={1}>
        {`${t.icon} ${label}`}
      </Text>
    </Pressable>
  );
}

/** One line of the stage marks: "✔ Spotted it · ✘ Wrong fix". */
const mark = (ok: boolean, yes: string, no: string) => `${ok ? '✔' : '✘'} ${ok ? yes : no}`;

export type RevealRow = { id: string; name: string; character: string; color: string; run: CaseRun; points: number; rank?: number | null };

/**
 * The explanation card after every case (Yazan 2026-11-12): the flaw, what should have happened and why, then why
 * each of the other choices was fine. `run` is yours (Solo, vs rivals) and `rows` everyone's answers at once.
 */
export function Explain({ c, run, rows, foot }: { c: Case; run?: CaseRun; rows?: RevealRow[]; foot?: ReactNode }) {
  const pts = run ? casePoints(c.lv, run) : null;
  return (
    <View style={{ flex: 1, gap: u(10) }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: u(10), paddingBottom: u(6) }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(260)} style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardKick}>THE FLAW</Text>
            {pts != null ? <Text style={[s.cardPts, { color: pts > 0 ? C.ok : pts < 0 ? C.no : C.inkSoft }]}>{pts > 0 ? `+${pts}` : String(pts)}</Text> : null}
          </View>
          <Text style={s.cardTitle}>{c.t}</Text>
          <Text style={s.cardSec}>WHAT WENT WRONG</Text>
          <Text style={s.cardBody}>{c.a[0].o}</Text>
          {run && run.pick1 != null && run.pick1 > 0 ? <Text style={s.yours}>{`You said: ${c.a[run.pick1].o}`}</Text> : null}
          <Text style={s.cardSec}>WHAT SHOULD HAVE HAPPENED</Text>
          <Text style={[s.cardBody, { fontFamily: F.bodySemi }]}>{c.a[0].x}</Text>
          {run && run.pick2 != null && run.pick2 > 0 ? <Text style={s.yours}>{`You said: ${c.a[run.pick2].x}`}</Text> : null}
          <Text style={[s.cardBody, { color: C.why }]}>{c.a[0].w}</Text>
          <Text style={s.cardSec}>WHY THE REST WERE FINE</Text>
          {c.a.slice(1).map((a, i) => (
            <View key={i} style={s.rest}>
              <Text style={s.restO}>{a.o}</Text>
              <Text style={[s.cardBody, { color: C.why }]}>{a.w}</Text>
            </View>
          ))}
        </Animated.View>
        {rows?.length ? (
          <View style={s.rows}>
            {rows.map((r) => (
              <View key={r.id} style={[s.prow, { borderColor: r.color }]}>
                <PlayerFace slug={r.character} size={u(22)} userId={r.id} still />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.pname} numberOfLines={1}>{r.rank ? `${r.rank}. ${r.name}` : r.name}</Text>
                  <Text style={s.pmarks}>
                    <Text style={{ color: right1(r.run) ? C.okLight : C.coral }}>{mark(right1(r.run), 'Spotted', 'Missed')}</Text>
                    {'  ·  '}
                    <Text style={{ color: right2(r.run) ? C.okLight : C.coral }}>{mark(right2(r.run), 'Fix', 'Fix')}</Text>
                  </Text>
                </View>
                <Text style={[s.ppts, { color: r.points > 0 ? C.okLight : r.points < 0 ? C.coral : C.mute }]}>{r.points > 0 ? `+${r.points}` : String(r.points)}</Text>
              </View>
            ))}
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
  title: { fontFamily: SERIF_BOLD, fontSize: u(25), lineHeight: u(31), color: C.text },
  sub: { fontFamily: F.body, fontSize: u(11.5), color: C.mute },
  pill: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingVertical: u(3), paddingHorizontal: u(9) },
  pillT: { fontFamily: F.mono, fontSize: u(10.5), color: C.soft },
  sheet: { backgroundColor: C.paper, borderRadius: u(14), paddingTop: u(10), paddingRight: u(13), paddingLeft: u(24), overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: u(12), shadowOffset: { width: 0, height: u(6) }, elevation: 5 },
  margin: { position: 'absolute', left: u(13), top: 0, bottom: 0, width: 1.5, backgroundColor: C.margin },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', gap: u(8), marginBottom: u(6) },
  sheetHeadT: { fontFamily: F.bodyBold, fontSize: u(8.5), letterSpacing: u(1.2), color: C.head, flexShrink: 1 },
  story: { fontFamily: SERIF, fontSize: u(12.5), lineHeight: u(19.5), color: C.ink },
  circled: { fontFamily: SERIF, color: C.pen, backgroundColor: 'rgba(226,40,58,0.10)', textDecorationLine: 'underline', textDecorationColor: C.pen },
  penNote: { position: 'absolute', right: u(12), top: u(22), fontFamily: PEN, fontSize: u(18), color: C.pen, transform: [{ rotate: '-6deg' }] },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: u(30) },
  openBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: u(30), alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper, borderTopWidth: 1, borderTopColor: 'rgba(122,134,179,0.25)' },
  openT: { fontFamily: F.bodyBold, fontSize: u(10.5), color: C.pen, letterSpacing: u(0.3) },
  popBack: { flex: 1, backgroundColor: 'rgba(6,10,30,0.82)', paddingHorizontal: u(14), paddingVertical: u(34), justifyContent: 'center' },
  popSheet: { flex: 1, paddingBottom: u(36) },
  askRow: { gap: u(3) },
  ask: { fontFamily: F.bodySemi, fontSize: u(10), letterSpacing: u(1.6), color: C.margin },
  opt: { flexDirection: 'row', gap: u(9), borderRadius: u(12), borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: u(8), paddingHorizontal: u(11) },
  optOn: { borderColor: C.coral, backgroundColor: 'rgba(255,93,108,0.16)' },
  optL: { fontFamily: F.bodyBold, fontSize: u(11.5), lineHeight: u(16), color: C.margin },
  optT: { flex: 1, fontFamily: F.body, fontSize: u(11.5), lineHeight: u(16), color: '#e6ebff' },
  go: { backgroundColor: C.coral, borderRadius: 999, paddingVertical: u(12), alignItems: 'center', justifyContent: 'center' },
  goT: { fontFamily: F.bodyBold, fontSize: u(14), color: '#fff' },
  help: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingVertical: u(7), paddingHorizontal: u(10), alignItems: 'center', justifyContent: 'center' },
  helpT: { fontFamily: F.bodySemi, fontSize: u(10.5), color: C.soft },
  helpTone: { flex: 1, borderWidth: 1, borderRadius: u(10), paddingVertical: u(9), paddingHorizontal: u(4), alignItems: 'center' },
  helpToneT: { fontFamily: F.bodyBold, fontSize: u(10.5), lineHeight: u(13) },
  card: { backgroundColor: C.paper, borderRadius: u(16), padding: u(14), gap: u(6) },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardKick: { fontFamily: F.bodyBold, fontSize: u(9), letterSpacing: u(1.6), color: C.head },
  cardPts: { fontFamily: SERIF_BOLD, fontSize: u(22), lineHeight: u(26) },
  cardTitle: { fontFamily: SERIF_BOLD, fontSize: u(19), lineHeight: u(24), color: C.ink },
  cardMarks: { fontFamily: F.bodySemi, fontSize: u(11), lineHeight: u(16) },
  cardSec: { fontFamily: F.bodyBold, fontSize: u(8.5), letterSpacing: u(1.4), color: C.secOk, marginTop: u(6) },
  cardBody: { fontFamily: F.body, fontSize: u(11.5), lineHeight: u(16.5), color: C.ink },
  yours: { fontFamily: F.body, fontStyle: 'italic', fontSize: u(10.5), lineHeight: u(15), color: C.said },
  rest: { gap: u(2), borderLeftWidth: 2, borderLeftColor: 'rgba(28,35,64,0.15)', paddingLeft: u(8), marginTop: u(2) },
  restO: { fontFamily: F.bodySemi, fontSize: u(11), lineHeight: u(15.5), color: C.inkSoft },
  rows: { gap: u(6) },
  prow: { flexDirection: 'row', alignItems: 'center', gap: u(8), borderWidth: 1, borderRadius: u(12), paddingVertical: u(6), paddingHorizontal: u(8), backgroundColor: 'rgba(255,255,255,0.05)' },
  pname: { fontFamily: F.bodySemi, fontSize: u(12), color: C.text },
  pmarks: { fontFamily: F.body, fontSize: u(10.5), color: C.soft },
  ppts: { fontFamily: SERIF_BOLD, fontSize: u(17) },
});
