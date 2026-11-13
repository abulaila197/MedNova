import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { NemesisButton } from '@/bots/NemesisButton';
import { type Game, GAMES } from '@/data/games';
import { ChestButton } from '@/features/chests/ChestButton';
import { DailyButton } from '@/features/daily/DailyButton';
import { InboxButton } from '@/features/inbox/InboxButton';
import { useLoading } from '@/features/loading/store';
import { sfx } from '@/lib/sound';
import { useTheme } from '@/state/app';
import { TABLET, u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { useGamesFocus } from './focus';
import { STRIP } from './strips';
import { GameTagSheet } from './GameTag';
import { GameInfoSheet, GameList } from './GameList';


const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen'];
const COUNT = WORDS[GAMES.length] ?? String(GAMES.length);
const num = (j: number) => String(j + 1).padStart(2, '0');

// Strip geometry, design px.
const ROW_H = 70;
const ROW_GAP = 8;

/**
 * The Games entrance page, "The programme" (option C, Yazan 2026-11-11): every game as a numbered strip, like a show's
 * running order. On a phone the list rolls slowly upward and no game can be tapped: the one Start opens the swipe pages.
 * On an Android tablet (Yazan 2026-11-12) all of them fit at once, standing still, and a tap on one opens that game.
 */
export function Programme() {
  return TABLET ? <TabletProgramme /> : <ListProgramme />;
}

/** The one Games page on a phone (Yazan 2026-11-12): every game in a still list, each box opens its loading page. */
function ListProgramme() {
  const [headH, setHeadH] = useState(0);
  return (
    <Screen tab="games" glow={0} symbols>
      <View style={s.fill}>
        <Head end="tap one to play" onHeight={setHeadH} />
        {headH ? <GameList top={headH + u(4)} /> : null}
        <Side />
      </View>
      <GameTagSheet />
      <GameInfoSheet />
    </Screen>
  );
}

function Side() {
  return (
    <>
      <InboxButton />
      <DailyButton />
      <ChestButton />
      <NemesisButton />
    </>
  );
}

function Head({ end, onHeight }: { end: string; onHeight?: (h: number) => void }) {
  const t = useTheme();
  return (
    <View style={s.head} onLayout={onHeight ? (e) => onHeight(e.nativeEvent.layout.height) : undefined}>
      <Text style={[s.k, { color: t.accent }]}>TONIGHT ON THE WARD</Text>
      <Text style={[s.h, { color: t.white }]}>
        {`${COUNT} games, `}
        <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>{end}</Text>
      </Text>
    </View>
  );
}

/** Number, name and sub name over the poster strip, the poster dimmed from the left so the words stay readable. */
function StripBody({ g, j, big }: { g: Game; j: number; big?: boolean }) {
  const t = useTheme();
  return (
    <>
      <Image source={STRIP[g.key]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={big ? 'right center' : 'center'} transition={0} cachePolicy="memory-disk" accessible={false} />
      <LinearGradient colors={['rgba(13,23,56,0.95)', 'rgba(13,23,56,0.35)', 'rgba(13,23,56,0.1)']} locations={[0.3, 0.75, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <Text style={[s.n, big && s.nBig, { color: t.accent }]}>{num(j)}</Text>
      <View style={[s.rt, big && s.rtBig]}>
        <Text style={[s.name, big && s.nameBig, { color: t.white }]} numberOfLines={1}>
          {`${g.lead} `}
          <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>{g.em}</Text>
        </Text>
        <Text style={[s.sub, big && s.subBig, { color: t.soft }]} numberOfLines={1}>
          {g.sub.toUpperCase()}
        </Text>
        {big ? (
          <Text style={[s.desc, { color: '#c9cde8' }]} numberOfLines={2}>
            {g.desc}
          </Text>
        ) : null}
      </View>
    </>
  );
}

function TabletStrip({ g, j }: { g: Game; j: number }) {
  const t = useTheme();
  const box = useRef<View>(null);
  const [down, setDown] = useState(false);
  const go = () => {
    void sfx('tap');
    // "Back to games" after a round shows this game's place in the list.
    useGamesFocus.setState((st) => ({ j, n: st.n + 1 }));
    const b = box.current;
    if (!b) return useLoading.getState().start(g.key, 0);
    b.measureInWindow((_x, top, _w, h) => useLoading.getState().start(g.key, top + h / 2));
  };
  return (
    <Pressable
      ref={box}
      onPress={go}
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      accessibilityRole="button"
      accessibilityLabel={`Play ${g.lead} ${g.em}`}
      style={[s.row, s.tRow, { borderColor: down ? t.accent : t.panelLine, transform: [{ scale: down ? 0.98 : 1 }] }]}>
      <StripBody g={g} j={j} />
    </Pressable>
  );
}

function TabletProgramme() {
  return (
    <Screen tab="games" glow={0} wide symbols>
      <View style={s.fill}>
        <Head end="tap one to play" />
        {/* rows of two; an odd last game sits alone on the left */}
        <View style={s.tGrid}>
          {Array.from({ length: Math.ceil(GAMES.length / 2) }, (_, r) => (
            <View key={r} style={s.tLine}>
              {[0, 1].map((c) => {
                const j = r * 2 + c;
                const g = GAMES[j];
                return g ? <TabletStrip key={g.key} g={g} j={j} /> : <View key={c} style={s.tGap} />;
              })}
            </View>
          ))}
        </View>
        <Side />
      </View>
      <GameTagSheet />
    </Screen>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  head: { paddingTop: u(10), paddingLeft: u(16), paddingRight: u(44), paddingBottom: u(8), gap: u(2) },
  k: { fontFamily: F.mono, fontSize: u(9), lineHeight: u(12), letterSpacing: u(1.44) },
  h: { fontFamily: F.display, fontSize: u(24), lineHeight: u(26), letterSpacing: u(-0.4) },
  row: { height: u(ROW_H), marginBottom: u(ROW_GAP), borderRadius: u(12), borderWidth: 1, overflow: 'hidden', justifyContent: 'center', backgroundColor: '#0b1331' },
  n: { position: 'absolute', left: u(10), fontFamily: F.mono, fontSize: u(13), lineHeight: u(16) },
  nBig: { left: u(14), top: u(14), fontSize: u(15), lineHeight: u(18) },
  rt: { paddingLeft: u(40), paddingRight: u(10), gap: u(2) },
  rtBig: { paddingLeft: u(14), paddingTop: u(36), paddingRight: u(12), gap: u(3) },
  name: { fontFamily: F.display, fontSize: u(15), lineHeight: u(18) },
  nameBig: { fontSize: u(18), lineHeight: u(21) },
  sub: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(11), letterSpacing: u(0.85) },
  subBig: { fontSize: u(8.5), lineHeight: u(11) },
  desc: { marginTop: u(3), marginRight: u(58), fontFamily: F.body, fontSize: u(10.5), lineHeight: u(14) },
  // tablet (Yazan 2026-11-12): the phone's own strips, two to a row, each one a button
  tGrid: { gap: u(ROW_GAP), paddingLeft: u(16), paddingRight: u(52), paddingTop: u(6) },
  tLine: { flexDirection: 'row', gap: u(10) },
  tGap: { flex: 1 },
  tRow: { flex: 1, minWidth: 0, marginBottom: 0 },
});
