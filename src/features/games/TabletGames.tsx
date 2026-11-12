import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { NemesisButton } from '@/bots/NemesisButton';
import { GAMES } from '@/data/games';
import { ChestButton } from '@/features/chests/ChestButton';
import { DailyButton } from '@/features/daily/DailyButton';
import { InboxButton } from '@/features/inbox/InboxButton';
import { useLoading } from '@/features/loading/store';
import { sfx } from '@/lib/sound';
import { useTheme } from '@/state/app';
import { PAGE_W, u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { ART } from './GameArt';
import { useGamesFocus } from './focus';
import { GameTag, GameTagSheet } from './GameTag';

const PAD = 18;
const COLS = 5;
const GAP = 10;
/** Tile width in design px: five across the page. */
const TILE = (PAGE_W - PAD * 2 - GAP * (COLS - 1)) / COLS;
const HERO_ART = Math.min(220, (PAGE_W - PAD * 2) * 0.4);

/**
 * Games page on an Android tablet (look A, Yazan 2026-11-12): the chosen game big at the top (its drawing, name,
 * what it's for, Play), and all ten below as picture tiles, so a tap picks one instead of ten swipes.
 */
export function TabletGames() {
  const t = useTheme();
  const [sel, setSel] = useState(() => useGamesFocus.getState().j);
  // Coming back from a game's results: that game is the one shown.
  useEffect(() => useGamesFocus.subscribe(({ j }) => setSel(j)), []);
  const game = GAMES[sel] ?? GAMES[0];
  const play = useRef<View>(null);
  const onPlay = () => {
    void sfx('tap');
    const btn = play.current;
    if (!btn) return useLoading.getState().start(game.key, 0);
    btn.measureInWindow((_x, y, _w, h) => useLoading.getState().start(game.key, y + h / 2));
  };
  const pick = (j: number) => {
    void sfx('tap');
    setSel(j);
    useGamesFocus.setState({ j });
  };
  return (
    <Screen tab="games" glow={0} wide>
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Animated.View key={game.key} entering={FadeIn.duration(220)} style={[s.art, { borderColor: t.panelLine }]}>
            <Image source={ART[game.key]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={0} cachePolicy="memory-disk" accessible={false} />
          </Animated.View>
          <View style={s.info}>
            <View style={s.top}>
              <Text style={[s.kick, { color: t.accent }]}>{`${String(sel + 1).padStart(2, '0')} / ${String(GAMES.length).padStart(2, '0')}`}</Text>
              <GameTag game={game.key} />
            </View>
            <Text style={[s.ttl, { color: t.white }]}>
              {game.lead} <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>{game.em}</Text>
            </Text>
            <Text style={[s.sub, { color: t.soft }]}>{game.sub}</Text>
            <Text style={[s.desc, { color: '#c9cde8' }]}>{game.desc}</Text>
            <Pressable ref={play} onPress={onPlay} style={s.goWrap} accessibilityRole="button" accessibilityLabel={`Play ${game.lead} ${game.em}`}>
              <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.go}>
                <Text style={[s.goT, { color: t.onGrad }]}>Play</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>

        <Text style={[s.k, { color: t.kick }]}>{`ALL ${GAMES.length} GAMES`}</Text>
        <View style={s.grid}>
          {GAMES.map((g, j) => {
            const on = j === sel;
            return (
              <Pressable key={g.key} onPress={() => pick(j)} style={s.tile} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${g.lead} ${g.em}`}>
                <View style={[s.tArt, { borderColor: on ? t.accent : t.panelLine, borderWidth: on ? 2 : 1 }]}>
                  <Image source={ART[g.key]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={0} cachePolicy="memory-disk" accessible={false} />
                </View>
                <Text style={[s.tName, { color: on ? t.fg : t.soft }]} numberOfLines={2}>
                  {`${g.lead} ${g.em}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {/* Inbox, daily reward, chests and the rival of the day: the same buttons as the phone, top right. */}
      <View style={s.side} pointerEvents="box-none">
        <InboxButton />
        <DailyButton />
        <ChestButton />
        <NemesisButton />
      </View>
      <GameTagSheet />
    </Screen>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: u(PAD), paddingTop: u(18), paddingBottom: u(40) },
  hero: { flexDirection: 'row', gap: u(18), alignItems: 'center', paddingRight: u(36) },
  art: { width: u(HERO_ART), height: u(HERO_ART * 1.3), borderRadius: u(16), borderWidth: 1, overflow: 'hidden', backgroundColor: '#0b1331' },
  info: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', gap: u(8), marginBottom: u(8) },
  kick: { fontFamily: F.display, fontSize: u(11), lineHeight: u(13), letterSpacing: u(1.2) },
  ttl: { fontFamily: F.display, fontSize: u(34), lineHeight: u(32), letterSpacing: u(-0.64) },
  sub: { marginTop: u(10), fontFamily: F.displayItalic, fontSize: u(14), lineHeight: u(18) },
  desc: { marginTop: u(8), maxWidth: u(260), fontFamily: F.body, fontSize: u(11.5), lineHeight: u(16.5) },
  goWrap: { marginTop: u(14), alignSelf: 'flex-start' },
  go: { borderRadius: u(14), paddingVertical: u(10), paddingHorizontal: u(34) },
  goT: { fontFamily: F.bodyBold, fontSize: u(13), lineHeight: u(16), textAlign: 'center' },
  k: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.4), marginTop: u(26), marginBottom: u(10) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: u(GAP) },
  tile: { width: u(TILE) },
  tArt: { width: u(TILE), height: u(TILE * 1.25), borderRadius: u(12), overflow: 'hidden', backgroundColor: '#0b1331' },
  tName: { marginTop: u(6), fontFamily: F.display, fontSize: u(10.5), lineHeight: u(13) },
  side: { position: 'absolute', top: 0, right: 0, width: u(60), height: u(160) },
});
