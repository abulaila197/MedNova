import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, ScrollView } from 'react-native';
import { Text } from '@/components/AppText';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Screen } from '@/components/Screen';
import { Back } from '@/components/Back';
import { DISCLAIMER } from '@/features/info/content';
import { loadCases, mineFields, useCases, wordTitle } from '@/features/learn/cases';
import { DOSSIERS, FIELDS, bookOf, noteOpened, titleOf } from '@/features/learn/library';
import { gameLabel } from '@/features/learn/NewWord';
import { useLearn } from '@/features/learn/useLearn';
import { useLearnColors } from '@/features/learn/palette';
import { VText } from '@/features/learn/VText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

// Folder tab heights from the locked preview (they size to their labels).
const TAB_H = [69, 51, 51, 79, 56];

const STATUS = { waiting: 'Waiting for approval', approved: 'Approved', declined: 'Declined' } as const;
// Own items have their own tab names: each tab sizes to its label, and together they end above the folder's lower
// corner, as the first one starts at its top (Yazan 2026-10-26).
const FOLD_H = 322;
const TAB_GAP = 4;
const FOLD_CORNER = 18;
function tabHeights(labels: string[]) {
  const want = labels.map((l) => Math.max(44, 16 + l.length * 6.2));
  const room = FOLD_H - FOLD_CORNER - TAB_GAP * (labels.length - 1);
  const sum = want.reduce((a, b) => a + b, 0);
  if (sum <= room) return want;
  // Too tall: every tab gives up the same share of the space above its label's own length.
  const need = labels.map((l) => 12 + l.length * 4.7);
  const spare = want.map((w, i) => w - need[i]);
  const cut = Math.min(1, (sum - room) / spare.reduce((a, b) => a + b, 0));
  return want.map((w, i) => w - spare[i] * cut);
}

/**
 * A disease dossier (?id=canonical id): a folder card whose tabs on the right switch the field. With ?mine=case:<id>
 * or word:<id> it is one of my own cases or words, in its maker's words (Yazan 2026-10-26, #21).
 */
export default function DossierPage() {
  const { mine } = useLocalSearchParams<{ mine?: string }>();
  return mine ? <MinePage mine={mine} /> : <LibraryPage />;
}

function MinePage({ mine }: { mine: string }) {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  const [on, setOn] = useState(0);
  const [kind, id] = mine.split(':');
  const cs = useCases((x) => x.list);
  const ws = useCases((x) => x.words);
  const k = kind === 'case' ? cs?.find((x) => x.id === id) : undefined;
  const w = kind === 'word' ? ws?.find((x) => x.id === id) : undefined;
  // Opened straight from a link: the list isn't loaded yet.
  useEffect(() => {
    if (cs == null) loadCases().catch(() => {});
  }, [cs]);
  if (cs == null && !w) return <Screen tab="learn" glow={6}>{null}</Screen>;
  if (!k && !w) {
    return (
      <Screen tab="learn" glow={6}>
        <View style={s.dpb}>
          <Back label="My diseases" fallback="/learn" />
          <Text style={[s.dmT, { color: c.mute }]}>This one isn’t in My diseases any more.</Text>
        </View>
      </Screen>
    );
  }
  const status = (k ?? w)!.status;
  const note = (k ?? w)!.note;
  const name = k ? k.diagnosis : wordTitle(w!);
  const title = titleOf(name.length > 40 ? `${name.slice(0, 38)}…` : name);
  const fields = mineFields(k ? { kind: 'case', c: k } : { kind: 'word', w: w! });
  return (
    <Screen tab="learn" glow={6}>
      <View style={s.dpb}>
        <View style={s.dtop}>
          <Back label="My diseases" fallback="/learn" />
          <Text style={[s.ms, { color: status === 'approved' ? t.accent : c.mute }]}>{STATUS[status].toUpperCase()}</Text>
        </View>
        <Text style={[s.dt, { color: t.fg }]} numberOfLines={2}>
          {title.first ? `${title.first} ` : ''}
          <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>{title.em}</Text>
        </Text>
        <View style={s.dm}>
          <View style={[s.sw, { backgroundColor: c.swatch, borderColor: c.swatchLine }]} />
          <Text style={[s.dmT, { color: c.mute }]} numberOfLines={1}>
            {`${k ? 'Diagnostic Pursuit case' : `${gameLabel(w!.game)} word`} · written by you`}
          </Text>
        </View>
        {note ? <Text style={[s.dmT, { color: t.fg }]}>{`Note from MedNova: ${note}`}</Text> : null}
        <Folder fields={fields} on={on} setOn={setOn} heights={tabHeights(fields.map((f) => f.tab))} />
      </View>
    </Screen>
  );
}

function LibraryPage() {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  const [on, setOn] = useState(0);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const d = id ? DOSSIERS.get(id) : undefined;
  const book = d ? bookOf(d.id) : undefined;
  const { data } = useLearn();
  const n = d ? (data?.missed.get(d.id)?.count ?? 0) : 0;
  useEffect(() => {
    if (d) void noteOpened(d.id);
  }, [d]);
  if (!d) {
    return (
      <Screen tab="learn" glow={6}>
        <View style={s.dpb}>
          <Back label="Dossiers" fallback="/learn" />
          <Text style={[s.dmT, { color: c.mute }]}>This dossier is not in the library.</Text>
        </View>
      </Screen>
    );
  }
  const title = titleOf(d.name);
  const fields = FIELDS.map((f) => ({ ...f, text: d[f.key] }));
  return (
    <Screen tab="learn" glow={6}>
      <View style={s.dpb}>
        <View style={s.dtop}>
          <Back label={book?.spine ?? 'Dossiers'} fallback={book ? `/learn/shelf?book=${book.key}` : '/learn'} />
          {n ? <Text style={[s.ms, { color: c.miss }]}>{(n === 1 ? 'Missed once' : n === 2 ? 'Missed twice' : `Missed ${n} times`).toUpperCase()}</Text> : null}
        </View>
        <Text style={[s.dt, { color: t.fg }]}>
          {title.first ? `${title.first} ` : ''}
          <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>{title.em}</Text>
        </Text>
        <View style={s.dm}>
          <View style={[s.sw, { backgroundColor: c.swatch, borderColor: c.swatchLine }]} />
          <Text style={[s.dmT, { color: c.mute }]} numberOfLines={1}>
            {book ? book.name : 'Dossier'}
            {d.name !== `${title.first} ${title.em}`.trim() ? ` · ${d.name}` : ''}
          </Text>
        </View>
        <Folder fields={fields} on={on} setOn={setOn} heights={TAB_H} />
      </View>
    </Screen>
  );
}

/** The folder card: one pane per field and a tab for each on the right. */
function Folder({ fields, on, setOn, heights }: { fields: { key: string; tab: string; label: string; text: string }[]; on: number; setOn: (i: number) => void; heights: number[] }) {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  return (
    <View style={s.fold}>
          <View style={[s.fcard, { borderColor: c.cardLine, boxShadow: c.cardShadow }]}>
            <LinearGradient colors={[c.fcardA, c.fcardB]} style={[StyleSheet.absoluteFill, s.fbg]} />
            {fields.map((f, i) => (
              <Pane key={f.key} f={f} on={i === on} />
            ))}
            {/* Inside the folder's empty foot: below it the Games button covers the page. */}
            <Text style={[s.dmT, s.note, { color: c.mute }]}>{DISCLAIMER}</Text>
          </View>
          <View style={s.ftabs}>
            {fields.map((f, i) => {
              const sel = i === on;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setOn(i)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={f.tab}
                  style={[s.tab, { height: u(heights[i]) }, sel ? { backgroundColor: c.tabOn, borderColor: c.tabOnLine, marginLeft: -1, width: u(30) + 1 } : { backgroundColor: c.tabOff, borderColor: c.tabOffLine }]}
                >
                  <VText h={u(heights[i]) - 2} line={u(10)} dir="down" style={{ fontFamily: F.mono, fontSize: u(7), letterSpacing: u(0.42), color: sel ? t.accent : c.tabOffText }}>
                    {f.tab.toUpperCase()}
                  </VText>
                </Pressable>
              );
            })}
          </View>
        </View>
  );
}

/** One field of the folder: fades and settles into place when its tab is chosen. */
function Pane({ f, on }: { f: { key: string; label: string; text: string }; on: boolean }) {
  const t = useTheme();
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(on ? 1 : 0, { duration: 400, easing: Easing.ease });
  }, [on, p]);
  const st = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: u(8) * (1 - p.value) }] }));
  return (
    <Animated.View style={[s.fp, st]} pointerEvents={on ? 'auto' : 'none'}>
      <Text style={[s.cf, { color: t.accent }]}>{f.label.toUpperCase()}</Text>
      {/* Long fields scroll inside the folder and stop above the disclaimer instead of running over it (DEF-104). */}
      <ScrollView style={s.fill} contentContainerStyle={s.pScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        <Text style={[s.p, { color: t.fg }]}>{f.text}</Text>
      </ScrollView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  pScroll: { paddingBottom: u(22) },
  dpb: { flex: 1, paddingTop: u(14), paddingHorizontal: u(14), gap: u(8) },
  dtop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ms: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12), letterSpacing: u(1.02) },
  dt: { fontFamily: F.display, fontSize: u(28), lineHeight: u(28), letterSpacing: u(-0.56) },
  dm: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  sw: { width: u(16), height: u(6), borderRadius: u(2), borderWidth: 1 },
  dmT: { fontFamily: F.body, fontSize: u(10), lineHeight: u(12) },
  note: { position: 'absolute', left: u(16), right: u(12), bottom: u(12), fontSize: u(8.5) },
  fold: { flexDirection: 'row', marginTop: u(6), height: u(FOLD_H) },
  fcard: {
    flex: 1,
    borderWidth: 1,
    borderRightWidth: 0,
    borderTopLeftRadius: u(18),
    borderBottomLeftRadius: u(18),
    borderBottomRightRadius: u(18),
  },
  fbg: { borderTopLeftRadius: u(17), borderBottomLeftRadius: u(17), borderBottomRightRadius: u(18) },
  fp: { ...StyleSheet.absoluteFill, paddingVertical: u(18), paddingHorizontal: u(14), gap: u(10) },
  cf: { fontFamily: F.mono, fontSize: u(9), lineHeight: u(12), letterSpacing: u(1.62) },
  p: { fontFamily: F.display, fontSize: u(16), lineHeight: u(21.12) },
  ftabs: { width: u(30), gap: u(TAB_GAP) },
  tab: { width: u(30), borderWidth: 1, borderLeftWidth: 0, borderTopRightRadius: u(10), borderBottomRightRadius: u(10), justifyContent: 'center' },
});
