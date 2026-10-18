import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { interpolateColor, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { Screen } from '@/components/Screen';
import { customId, loadCases, useCases, type CustomCase } from '@/features/learn/cases';
import { startPlay } from '@/games/shell/flow';
import { useSession } from '@/games/shell/session';
import { Fade } from '@/components/Fade';
import { FlipCard } from '@/features/learn/FlipCard';
import { useLearnColors } from '@/features/learn/palette';
import { BookShelf } from '@/features/learn/BookShelf';
import { BOOKS, DOSSIERS, again, bookOf, gotIt, type Book, type Card } from '@/features/learn/library';
import { useLearn } from '@/features/learn/useLearn';
import { PageTitle } from '@/features/learn/Title';
import { useTheme } from '@/state/app';
import { u, useScreen } from '@/theme/scale';
import { F } from '@/theme/tokens';

const NAMES = ['Review', 'Dossiers', 'My cases'];

/** Learn: three pages swiped sideways (Today's review, Disease dossiers, My cases) under a fixed row of page names. */
export default function Learn() {
  const { width: W } = useScreen();
  const x = useSharedValue(0);
  const pager = useRef<Animated.ScrollView>(null);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });
  const [H, setH] = useState(0);
  const { data, reload } = useLearn();
  const go = (i: number) => pager.current?.scrollTo({ x: i * W, animated: true });
  return (
    <Screen tab="learn" glow={6}>
      <View style={s.wds}>
        {NAMES.map((n, i) => (
          <PageName key={n} i={i} label={n} x={x} W={W} onPress={() => go(i)} />
        ))}
      </View>
      <View style={s.pgs} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
        <Animated.ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16} style={s.flex}>
          <View style={{ width: W, height: H }}>
            <ReviewPage pile={data?.pile ?? null} reload={reload} />
          </View>
          <View style={{ width: W, height: H }}>
            <DossiersPage missed={data?.missed ?? null} />
          </View>
          <View style={{ width: W, height: H }}>
            <CasesPage />
          </View>
        </Animated.ScrollView>
      </View>
    </Screen>
  );
}

function PageName({ i, label, x, W, onPress }: { i: number; label: string; x: SharedValue<number>; W: number; onPress: () => void }) {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  const on = t.fg;
  const off = c.nameOff;
  const st = useAnimatedStyle(() => ({
    color: interpolateColor(Math.min(1, Math.abs(x.value / W - i)), [0, 1], [on, off]),
  }));
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" hitSlop={u(6)}>
      <Animated.Text style={[s.name, st]}>{label}</Animated.Text>
    </Pressable>
  );
}

function ReviewPage({ pile, reload }: { pile: Card[] | null; reload: () => Promise<void> }) {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  const [flipped, setFlipped] = useState(false);
  // The pile shrinks as cards are put away; the count runs over today's starting size.
  const [start, setStart] = useState(0);
  const card = pile?.[0];
  const total = Math.max(start, pile?.length ?? 0);
  const done = total - (pile?.length ?? 0);
  const act = async (fn: (c: Card) => Promise<void>) => {
    if (!card) return;
    setStart(total);
    setFlipped(false);
    await fn(card);
    await reload();
  };
  return (
    <View style={[s.pg, s.flex]}>
      <PageTitle first="Today's" em="review" small={card ? `${done + 1} of ${total}` : ''} />
      <View style={[s.lpg, { backgroundColor: c.track }]}>
        <View style={[s.lpgFill, { width: `${total ? (done / total) * 100 : 0}%`, backgroundColor: t.accent }]} />
      </View>
      {card ? (
        <>
          <FlipCard key={card.key} card={card} flipped={flipped} onPress={() => setFlipped((f) => !f)} />
          <View style={s.lrow}>
            <Pressable onPress={() => act(again)} style={[s.btn, s.again, { borderColor: c.againLine }]} accessibilityRole="button">
              <Text style={[s.btnT, { color: c.againText }]}>Again</Text>
            </Pressable>
            <Pressable onPress={() => act(gotIt)} style={s.btnWrap} accessibilityRole="button">
              <LinearGradient colors={[c.gotA, c.gotB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.btn}>
                <Text style={[s.btnT, { color: c.gotText }]}>Got it</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </>
      ) : pile ? (
        <View style={[s.empty, { borderColor: c.cardLine }]}>
          <Text style={[s.emptyH, { color: t.fg }]}>All caught up</Text>
          <Text style={[s.emptyT, { color: c.mute }]}>Anything you miss in a game shows up here as a card, so you can go over it.</Text>
        </View>
      ) : null}
    </View>
  );
}

/** A page that scrolls vertically; when its content runs past the page it fades out at the bottom, clear of the dock. */
function ScrollPage({ children }: { children: ReactNode }) {
  const [box, setBox] = useState(0);
  const [content, setContent] = useState(0);
  // Overflow of less than a row's bottom padding (12) only trims empty space, so it does not count.
  const over = box > 0 && content - u(36) > box + u(12);
  return (
    <Fade from={0.9} to={1} off={!over} style={s.flex} onLayout={(e) => setBox(e.nativeEvent.layout.height)}>
      <ScrollView nestedScrollEnabled scrollEnabled={over} showsVerticalScrollIndicator={false} onContentSizeChange={(_, h) => setContent(h)} contentContainerStyle={[s.pg, s.pgEnd]}>
        {children}
      </ScrollView>
    </Fade>
  );
}

function DossiersPage({ missed }: { missed: Map<string, { count: number; last: number }> | null }) {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  const [q, setQ] = useState('');
  const count = (b: Book) => b.ids.filter((id) => missed?.has(id)).length;
  const open = (b: Book) => router.push(`/learn/shelf?book=${b.key}`);
  // RL6: search finds only your misses.
  const norm = (x: string) => x.toLowerCase().replace(/'s\b/g, '').trim();
  const hits = q.trim() ? [...(missed?.keys() ?? [])].map((id) => DOSSIERS.get(id)!).filter((d) => d && norm(d.name).includes(norm(q))) : null;
  return (
    <ScrollPage>
      <PageTitle first="Disease" em="dossiers" small={`${missed?.size ?? 0} missed`} />
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search your misses"
        placeholderTextColor={c.srchText}
        style={[s.srch, s.srchT, { backgroundColor: c.srchBg, borderColor: c.srchLine, color: t.fg }]}
        autoCorrect={false}
        returnKeyType="search"
      />
      {hits ? (
        <View>
          {hits.length ? (
            hits.map((d) => (
              <Pressable key={d.id} onPress={() => router.push(`/learn/dossier?id=${d.id}`)} style={[s.hit, { borderBottomColor: c.rowLine }]} accessibilityRole="button">
                <Text style={[s.csB, { color: t.fg }]} numberOfLines={1}>
                  {d.name}
                </Text>
                <Text style={[s.csA, { color: c.mute }]}>{bookOf(d.id)?.name ?? ''}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={[s.emptyT, { color: c.mute }]}>No missed disease matches that.</Text>
          )}
        </View>
      ) : (
        <>
          <BookShelf books={BOOKS.slice(0, 8)} missed={count} onOpen={open} />
          <BookShelf books={BOOKS.slice(8)} missed={count} onOpen={open} />
        </>
      )}
    </ScrollPage>
  );
}

const STATE = { waiting: 'Waiting for approval', declined: 'Private note' } as const;

/** Approved cases open straight into a Diagnostic Pursuit practice round (no EXP, no free play used). */
async function playCase(k: CustomCase) {
  const play = await startPlay('the-diagnostic-pursuit', 'solo', { difficulty: 'Medium', cases: 1, custom: customId(k.id) });
  router.push(`/play/the-diagnostic-pursuit/run?play=${play.id}` as never);
}

function CasesPage() {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  const signedIn = !!useSession((x) => x.userId);
  const list = useCases((x) => x.list);
  const [err, setErr] = useState('');
  useFocusEffect(
    useCallback(() => {
      setErr('');
      loadCases().catch(() => setErr('Could not load your cases. Check your connection.'));
      // eslint-disable-next-line react-hooks/exhaustive-deps -- signedIn only re-runs the load when the account changes while the page is open
    }, [signedIn]),
  );
  const cases = list ?? [];
  return (
    <ScrollPage>
      <PageTitle first="My" em="cases" small={`${cases.length}`} />
      <Pressable onPress={() => router.push((signedIn ? '/learn/new-case' : '/auth') as never)} style={[s.newc, { borderColor: c.newcLine, backgroundColor: c.newcBg }]} accessibilityRole="button">
        <Text style={[s.newcT, { color: t.accent }]}>{signedIn ? '+ Write a new case' : 'Sign in to write your own cases'}</Text>
      </Pressable>
      {err ? <Text style={[s.csA, { color: t.red }]}>{err}</Text> : null}
      {signedIn && list && !cases.length ? <Text style={[s.csA, { color: c.mute }]}>No cases yet. Write one and it stays here as a private note.</Text> : null}
      <View>
        {cases.map((k, i) => (
          <View key={k.id} style={[s.cs, i < cases.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.rowLine }]}>
            <View style={s.csL}>
              <Text style={[s.csB, { color: t.fg }]}>{k.diagnosis}</Text>
              <Text style={[s.csA, { color: c.mute }]}>{`${k.field ?? 'Case'} · ${k.gender[0]}, ${k.age}`}</Text>
            </View>
            {k.status === 'approved' && k.answer_id ? (
              <Pressable onPress={() => playCase(k).catch(() => setErr('Could not start the case. Try again.'))} accessibilityRole="button" accessibilityLabel={`Play ${k.diagnosis}`}>
                <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.play}>
                  <Text style={[s.playT, { color: t.onGrad }]}>Play</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <Text style={[s.csE, { color: k.status === 'declined' ? c.mute : t.accent }]}>{STATE[k.status === 'declined' ? 'declined' : 'waiting'].toUpperCase()}</Text>
            )}
          </View>
        ))}
      </View>
    </ScrollPage>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  wds: {
    flexDirection: 'row',
    gap: u(16),
    paddingTop: u(14),
    paddingHorizontal: u(14),
    paddingBottom: u(6),
  },
  name: { fontFamily: F.display, fontSize: u(12), lineHeight: u(15) },
  pg: { paddingTop: u(2), paddingHorizontal: u(14), gap: u(9) },
  // The pages stop 84 design px above the dock (the reference's .pgs padding), clear of the raised Games button.
  pgs: { flex: 1, marginBottom: u(84) },
  // Scrolling pages get a little run-out so their last row can rise clear of the bottom fade.
  pgEnd: { paddingBottom: u(36) },
  lpg: { height: u(3), borderRadius: u(3), overflow: 'hidden' },
  lpgFill: { height: '100%', borderRadius: u(3) },
  lrow: { flexDirection: 'row', gap: u(7) },
  btnWrap: { flex: 1 },
  btn: {
    flex: 1,
    height: u(30),
    borderRadius: u(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  again: { borderWidth: 1 },
  btnT: { fontFamily: F.bodySemi, fontSize: u(11.5), lineHeight: u(14) },
  srch: {
    height: u(34),
    borderWidth: 1,
    borderRadius: u(12),
    paddingHorizontal: u(12),
    justifyContent: 'center',
  },
  srchT: { fontFamily: F.body, fontSize: u(11), lineHeight: u(14) },
  hit: { paddingVertical: u(10), borderBottomWidth: 1, gap: u(2) },
  empty: { flex: 1, borderWidth: 1, borderStyle: 'dashed', borderRadius: u(20), padding: u(18), justifyContent: 'center', gap: u(6) },
  emptyH: { fontFamily: F.display, fontSize: u(20), lineHeight: u(24) },
  emptyT: { fontFamily: F.body, fontSize: u(11), lineHeight: u(15) },
  newc: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: u(14),
    padding: u(11),
  },
  newcT: { fontFamily: F.bodySemi, fontSize: u(12), lineHeight: u(15) },
  cs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(10),
    paddingVertical: u(12),
    paddingHorizontal: u(2),
  },
  csL: { flexShrink: 1, gap: u(3) },
  play: { marginLeft: 'auto', height: u(24), paddingHorizontal: u(14), borderRadius: 999, justifyContent: 'center' },
  playT: { fontFamily: F.bodyBold, fontSize: u(10) },
  csB: { fontFamily: F.display, fontSize: u(15), lineHeight: u(18) },
  csA: { fontFamily: F.body, fontSize: u(10), lineHeight: u(12) },
  csE: {
    marginLeft: 'auto',
    flexShrink: 0,
    fontFamily: F.mono,
    fontSize: u(8.5),
    lineHeight: u(12),
    letterSpacing: u(0.68),
  },
});
