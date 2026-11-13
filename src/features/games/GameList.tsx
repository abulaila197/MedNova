import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { create } from 'zustand';

import { Text } from '@/components/AppText';
import { Fade } from '@/components/Fade';
import { Sheet } from '@/components/Sheet';
import { type Game, GAMES } from '@/data/games';
import { useLoading } from '@/features/loading/store';
import { gameDef } from '@/games/shell/registry';
import { sfx } from '@/lib/sound';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { useGamesFocus } from './focus';
import { openTagSheet, tagOf } from './GameTag';
import { STRIP } from './strips';


/** One strip and its gap, design px. */
const STEP = 78;
const num = (j: number) => String(j + 1).padStart(2, '0');
const alpha = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

const useInfo = create<{ j: number | null }>(() => ({ j: null }));

/** Tap a box: the game's loading page, its bar starting from the box. */
function useOpen(g: Game, j: number) {
  const box = useRef<View>(null);
  const go = () => {
    void sfx('tap');
    useGamesFocus.setState((st) => ({ j, n: st.n + 1 }));
    const b = box.current;
    if (!b) return useLoading.getState().start(g.key, 0);
    b.measureInWindow((_x, top, _w, h) => useLoading.getState().start(g.key, top + h / 2));
  };
  return { box, go };
}

function Ask({ j, style }: { j: number; style: object }) {
  const t = useTheme();
  const g = GAMES[j];
  return (
    <Pressable
      onPress={() => {
        void sfx('tap');
        useInfo.setState({ j });
      }}
      hitSlop={u(8)}
      style={[s.ask, { borderColor: alpha(t.accent, 0.55) }, style]}
      accessibilityRole="button"
      accessibilityLabel={`What is ${g.lead} ${g.em}?`}>
      <Text style={[s.askT, { color: t.accent }]}>?</Text>
    </Pressable>
  );
}

function Tag({ game }: { game: string }) {
  const tag = tagOf(game);
  if (!tag) return null;
  return (
    <Pressable onPress={() => openTagSheet(game)} hitSlop={u(6)} style={[s.tag, { borderColor: alpha(tag.color, 0.45), backgroundColor: alpha(tag.color, 0.14) }]} accessibilityRole="button" accessibilityLabel={`${tag.label}: what this means`}>
      <Text style={[s.tagT, { color: tag.color }]}>{tag.label}</Text>
    </Pressable>
  );
}

/** Look C: the programme's numbered strip (2026-11-11), standing still, each one a button. */
function Strip({ g, j }: { g: Game; j: number }) {
  const t = useTheme();
  const { box, go } = useOpen(g, j);
  const [down, setDown] = useState(false);
  return (
    <Pressable ref={box} onPress={go} onPressIn={() => setDown(true)} onPressOut={() => setDown(false)} accessibilityRole="button" accessibilityLabel={`Play ${g.lead} ${g.em}`}
      style={[s.strip, { borderColor: down ? t.accent : t.panelLine, transform: [{ scale: down ? 0.98 : 1 }] }]}>
      <Image source={STRIP[g.key]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" transition={0} cachePolicy="memory-disk" accessible={false} />
      <LinearGradient colors={['rgba(13,23,56,0.95)', 'rgba(13,23,56,0.35)', 'rgba(13,23,56,0.1)']} locations={[0.3, 0.75, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <Text style={[s.n, { color: t.accent }]}>{num(j)}</Text>
      <View style={s.stripTxt}>
        <Text style={[s.name, { color: t.white }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {`${g.lead} `}
          <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>{g.em}</Text>
        </Text>
        <Text style={[s.sub, { color: t.soft }]} numberOfLines={1}>{g.sub.toUpperCase()}</Text>
      </View>
      <Ask j={j} style={s.askC} />
    </Pressable>
  );
}

/** Look C (Yazan 2026-11-13): the programme's strips in a still list. "Back to games" scrolls to the game just played. */
export function GameList({ top }: { top: number }) {
  const list = useRef<ScrollView>(null);
  const focus = useGamesFocus((f) => f.n);
  useEffect(() => {
    const j = useGamesFocus.getState().j;
    list.current?.scrollTo({ y: Math.max(0, j - 1) * u(STEP), animated: false });
  }, [focus]);
  return (
    <Fade stops={[[0, 0], [0.03, 1], [0.95, 1], [1, 0]]} style={[s.list, { top }]}>
      <ScrollView ref={list} style={s.fill} contentContainerStyle={s.inC} showsVerticalScrollIndicator={false}>
        {GAMES.map((g, j) => <Strip key={g.key} g={g} j={j} />)}
      </ScrollView>
    </Fade>
  );
}

/** The ? pop-up: what the game is, its tag and its modes, and Play. */
export function GameInfoSheet() {
  const t = useTheme();
  const j = useInfo((x) => x.j);
  const g = j == null ? null : GAMES[j];
  const close = () => useInfo.setState({ j: null });
  const modes = g ? gameDef(g.key)?.modes ?? [] : [];
  return (
    <Sheet open={!!g} onClose={close}>
      {g ? (
        <View style={s.body}>
          <Text style={[s.sheetT, { color: t.white }]}>
            {`${g.lead} `}
            <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>{g.em}</Text>
          </Text>
          <Tag game={g.key} />
          <Text style={[s.p, { color: t.soft }]}>{g.desc}</Text>
          <View style={s.modes}>
            {modes.map((m) => (
              <Text key={m.mode} style={[s.p, { color: t.soft }]}>
                <Text style={{ color: t.white, fontFamily: F.bodyBold }}>{`${m.title}: `}</Text>
                {m.blurb}
              </Text>
            ))}
          </View>
          <Pressable
            onPress={() => {
              close();
              useGamesFocus.setState((st) => ({ j: j!, n: st.n + 1 }));
              useLoading.getState().start(g.key, 0);
            }}
            accessibilityRole="button"
            style={s.playTap}>
            <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.play}>
              <Text style={[s.playT, { color: t.onGrad }]}>Play</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  list: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  fill: { flex: 1 },
  inC: { paddingLeft: u(14), paddingRight: u(56), paddingTop: u(6), paddingBottom: u(40), gap: u(8) },
  strip: { height: u(70), borderRadius: u(12), borderWidth: 1, overflow: 'hidden', justifyContent: 'center', backgroundColor: '#0b1331' },
  stripTxt: { paddingLeft: u(40), paddingRight: u(40), gap: u(2) },
  n: { position: 'absolute', left: u(10), fontFamily: F.mono, fontSize: u(13), lineHeight: u(16) },
  name: { fontFamily: F.display, fontSize: u(15), lineHeight: u(18) },
  sub: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(11), letterSpacing: u(0.85) },
  tag: { alignSelf: 'flex-start', marginTop: u(3), borderWidth: 1, borderRadius: u(7), paddingVertical: u(2), paddingHorizontal: u(7) },
  tagT: { fontFamily: F.bodyBold, fontSize: u(8), lineHeight: u(10), letterSpacing: u(0.5), textTransform: 'uppercase' },
  ask: { position: 'absolute', width: u(26), height: u(26), borderRadius: u(13), borderWidth: 1, backgroundColor: 'rgba(8,16,41,0.75)', alignItems: 'center', justifyContent: 'center' },
  askT: { fontFamily: F.display, fontSize: u(14), lineHeight: u(17) },
  askC: { right: u(9), top: u(22) },
  body: { gap: u(8), paddingTop: u(2) },
  sheetT: { fontFamily: F.display, fontSize: u(21), lineHeight: u(25) },
  p: { fontFamily: F.body, fontSize: u(12), lineHeight: u(17) },
  modes: { gap: u(6) },
  playTap: { marginTop: u(6), height: u(42), borderRadius: u(21), overflow: 'hidden' },
  play: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playT: { fontFamily: F.display, fontSize: u(15), lineHeight: u(19) },
});
