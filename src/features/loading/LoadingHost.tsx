import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { GAMES } from '@/data/games';
import { GamesScreen } from '@/features/games/GamesScreen';
import { gameDef } from '@/games/shell/registry';
import { useApp } from '@/state/app';

import { LOAD, wipeColor } from './configs';
import { loadFontsFor } from './fonts';
import { LoadingPage } from './LoadingPage';
import { type LoadRun, useLoading } from './store';

/** Locked timings (2026-10-05): doors 0.9 s in, 5 s loading, bar wipe out about 1.5 s. */
export const LOAD_MS = 5000;
const DOORS_MS = 900;
const SETTLE_MS = 1100;
const DOORS = Easing.bezier(0.6, 0, 0.2, 1);
const SETTLE = Easing.bezier(0.2, 0.7, 0.2, 1);
const IN_OUT = Easing.inOut(Easing.cubic);
const OUT = Easing.out(Easing.cubic);

/** Sits above the app pages: plays a game's loading page between its Play button and the next screen. */
export function LoadingHost() {
  const run = useLoading((s) => s.run);
  return run && LOAD[run.key] ? <Run key={run.id} run={run} /> : null;
}

function Run({ run }: { run: LoadRun }) {
  const { width: W, height: H } = useWindowDimensions();
  const g = LOAD[run.key];
  const tip = useMemo(() => g.tips[Math.floor(Math.random() * g.tips.length)], [g]);
  const [stage, setStage] = useState<'doors' | 'load' | 'out'>('doors');
  const [split, setSplit] = useState<number | null>(null);
  const host = useRef<View>(null);
  const bar = useRef<View>(null);

  const p = useSharedValue(0);
  const door = useSharedValue(0);
  const settle = useSharedValue(1.06);
  const clip = useSharedValue(0);
  const line = { l: useSharedValue(0), w: useSharedValue(0), y: useSharedValue(0), o: useSharedValue(0) };

  // Way in: load this game's fonts, find the split line, then open the doors.
  useEffect(() => {
    let live = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    loadFontsFor(run.key)
      .catch(() => {})
      .then(
        () =>
          new Promise<number>((res) => {
            if (host.current) host.current.measureInWindow((_x, y) => res(y || 0));
            else res(0);
          }),
      )
      .then((hy) => {
        if (!live) return;
        const y = Math.max(1, Math.min(H - 1, Math.round(run.y - hy)));
        setSplit(y);
        timers.push(
          setTimeout(() => {
            door.value = withTiming(1, { duration: DOORS_MS, easing: DOORS });
            settle.value = withTiming(1, { duration: SETTLE_MS, easing: SETTLE });
          }, 60),
          setTimeout(() => {
            setStage('load');
            p.value = withTiming(1, { duration: LOAD_MS, easing: Easing.linear });
          }, 60 + SETTLE_MS + 20),
          setTimeout(() => wipe(), 60 + SETTLE_MS + 20 + LOAD_MS + 250),
        );
      });
    return () => {
      live = false;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Way out: the bar becomes a line that grows out to both edges, rises to the top and sweeps the next screen in.
  const wipe = () => {
    setStage('out');
    const def = gameDef(run.key);
    const g0 = GAMES.find((x) => x.key === run.key)!;
    const go = (x0: number, w: number, y0: number) => {
      line.l.value = x0;
      line.w.value = w;
      line.y.value = y0;
      line.o.value = 1;
      line.l.value = withTiming(0, { duration: 300, easing: OUT });
      line.w.value = withTiming(W, { duration: 300, easing: OUT });
      // The next screen opens underneath while the page still covers everything.
      if (def) router.push(`/play/${run.key}`);
      setTimeout(() => (line.y.value = withTiming(0, { duration: 350, easing: IN_OUT })), 300);
      setTimeout(() => {
        line.y.value = withTiming(H + 4, { duration: 1000, easing: IN_OUT });
        clip.value = withTiming(H + 4, { duration: 1000, easing: IN_OUT });
      }, 650);
      setTimeout(() => {
        useLoading.getState().end();
        // Games not built yet keep the old "game screen" note on the Games page.
        if (!def) useApp.getState().setPlaying(`${g0.lead} ${g0.em}`);
      }, 1680);
    };
    if (!bar.current || !host.current) return go(0, W, H / 2);
    host.current.measureInWindow((hx, hy) =>
      bar.current!.measureInWindow((x, y, w, h) => go(x - (hx || 0), w, y - (hy || 0) + h / 2)),
    );
  };

  const settleSt = useAnimatedStyle(() => ({ transform: [{ scale: settle.value }] }));
  const outer = useAnimatedStyle(() => ({ top: clip.value }));
  const inner = useAnimatedStyle(() => ({ top: -clip.value }));
  const lineSt = useAnimatedStyle(() => ({ left: line.l.value, width: line.w.value, top: line.y.value - 1.5, opacity: line.o.value }));
  const y = split ?? 0;
  const topDoor = useAnimatedStyle(() => ({ transform: [{ translateY: -y * door.value }] }));
  const botDoor = useAnimatedStyle(() => ({ transform: [{ translateY: (H - y) * door.value }] }));
  const col = wipeColor(g);

  return (
    <View ref={host} collapsable={false} style={[StyleSheet.absoluteFill, s.host]}>
      <Animated.View style={[s.clip, outer]}>
        <Animated.View style={[s.page, { width: W, height: H }, inner]}>
          <Animated.View style={[StyleSheet.absoluteFill, settleSt]}>
            <LoadingPage g={g} w={W} h={H} live={stage !== 'doors'} p={p} tip={tip} barRef={bar} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
      {stage === 'doors' ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {split === null ? (
            <GamesCopy at={run.at} w={W} h={H} />
          ) : (
            <>
              <Animated.View style={[s.door, { top: y, height: H - y }, botDoor]}>
                <View style={{ position: 'absolute', top: -y, width: W, height: H }}>
                  <GamesCopy at={run.at} w={W} h={H} />
                </View>
              </Animated.View>
              <Animated.View style={[s.door, s.shadow, { top: 0, height: y }, topDoor]}>
                <GamesCopy at={run.at} w={W} h={H} />
              </Animated.View>
            </>
          )}
        </View>
      ) : null}
      {stage === 'out' ? <Animated.View pointerEvents="none" style={[s.line, { backgroundColor: col, boxShadow: `0 0 12px ${col}, 0 0 30px ${col}` }, lineSt]} /> : null}
    </View>
  );
}

/** A still copy of the Games page on the tapped game: the doors are made of it. */
function GamesCopy({ at, w, h }: { at: number; w: number; h: number }) {
  return (
    <View style={{ width: w, height: h }}>
      <GamesScreen at={at} />
    </View>
  );
}

const s = StyleSheet.create({
  host: { zIndex: 20 },
  clip: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  page: { position: 'absolute', left: 0 },
  door: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  shadow: { boxShadow: '0 8px 20px rgba(0,0,0,0.5)' },
  line: { position: 'absolute', height: 3 },
});
