import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { gameDef } from '@/games/shell/registry';

import { LOAD, wipeColor } from './configs';
import { loadFontsFor } from './fonts';
import { LoadingPage } from './LoadingPage';
import { type LoadRun, useLoading } from './store';
import { useScreen } from '@/theme/scale';

/** Locked timings (2026-10-05): doors 0.9 s in, 5 s loading, bar wipe out (slowed to about 2 s on 2026-10-19). */
export const LOAD_MS = 5000;
const DOORS_MS = 900;
const SETTLE_MS = 1100;
const DOORS = Easing.bezier(0.6, 0, 0.2, 1);
const SETTLE = Easing.bezier(0.2, 0.7, 0.2, 1);
const IN_OUT = Easing.inOut(Easing.cubic);
const OUT = Easing.out(Easing.cubic);
// Way out (2026-10-19, Yazan: it ran too fast): the line grows out from the bar's ends, rises, then sweeps.
const GROW_MS = 450;
const RISE_MS = 450;
const SWEEP_MS = 1100;
// The game screen is opened this long before the way out, underneath the still-covering loading page, so
// building it can't stall the line.
const OPEN_EARLY_MS = 700;

/** Sits above the app pages: plays a game's loading page between its Play button and the next screen. */
export function LoadingHost() {
  const run = useLoading((s) => s.run);
  return run && LOAD[run.key] ? <Run key={run.id} run={run} /> : null;
}

function Run({ run }: { run: LoadRun }) {
  const { width: W, height: H } = useScreen();
  const g = LOAD[run.key];
  const [tip] = useState(() => g.tips[Math.floor(Math.random() * g.tips.length)]);
  const [stage, setStage] = useState<'doors' | 'load' | 'out'>('doors');
  const [split, setSplit] = useState<number | null>(null);
  // Nothing shows until both door pictures are decoded: before, the loading page flashed through for a moment.
  const [doorsLoaded, setDoorsLoaded] = useState(0);
  const shown = split !== null && (!run.shot || doorsLoaded >= 2);
  const doorLoaded = () => setDoorsLoaded((n) => n + 1);
  const host = useRef<View>(null);
  const bar = useRef<View>(null);

  const p = useSharedValue(0);
  const door = useSharedValue(0);
  const settle = useSharedValue(1.06);
  const clip = useSharedValue(0);
  const lineL = useSharedValue(0);
  const lineW = useSharedValue(0);
  const lineY = useSharedValue(0);
  const lineO = useSharedValue(0);

  // Way out: the bar becomes a line that grows out to both edges, rises to the top and sweeps the next screen in.
  const wipe = () => {
    setStage('out');
    const go = (x0: number, w: number, y0: number) => {
      lineL.value = x0;
      lineW.value = w;
      lineY.value = y0;
      lineO.value = 1;
      lineL.value = withTiming(0, { duration: GROW_MS, easing: OUT });
      lineW.value = withTiming(W, { duration: GROW_MS, easing: OUT });
      // The whole sweep is handed to the animation engine up front, so nothing on the JavaScript side can stall it.
      lineY.value = withSequence(withDelay(GROW_MS, withTiming(0, { duration: RISE_MS, easing: IN_OUT })), withTiming(H + 4, { duration: SWEEP_MS, easing: IN_OUT }));
      clip.value = withDelay(GROW_MS + RISE_MS, withTiming(H + 4, { duration: SWEEP_MS, easing: IN_OUT }));
      setTimeout(() => useLoading.getState().end(), GROW_MS + RISE_MS + SWEEP_MS + 80);
    };
    // Measured against the loading page itself (measureInWindow often came back empty on Android, so the line
    // started mid-screen at full width instead of from the bar).
    if (!bar.current || !host.current) return go(0, W, H / 2);
    bar.current.measureLayout(
      host.current,
      (x, y, w, h) => (w > 0 ? go(x, w, y + h / 2) : go(0, W, H / 2)),
      () => go(0, W, H / 2),
    );
  };

  // Way in: load this game's fonts, find the split line, then open the doors.
  useEffect(() => {
    let live = true;
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
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Doors open once they are on screen with their pictures ready.
  useEffect(() => {
    if (!shown) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        door.value = withTiming(1, { duration: DOORS_MS, easing: DOORS });
        settle.value = withTiming(1, { duration: SETTLE_MS, easing: SETTLE });
      }, 60),
      setTimeout(() => {
        setStage('load');
        p.value = withTiming(1, { duration: LOAD_MS, easing: Easing.linear });
        // read the game's question bank now, while the bar runs, not when the game opens
        setTimeout(() => gameDef(run.key), 400);
      }, 60 + SETTLE_MS + 20),
      setTimeout(() => router.push(`/play/${run.key}`), 60 + SETTLE_MS + 20 + LOAD_MS + 250 - OPEN_EARLY_MS),
      setTimeout(() => wipe(), 60 + SETTLE_MS + 20 + LOAD_MS + 250),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const settleSt = useAnimatedStyle(() => ({ transform: [{ scale: settle.value }] }));
  // moved with transforms, not top/left/width, so nothing is laid out again on each frame
  const outer = useAnimatedStyle(() => ({ transform: [{ translateY: clip.value }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ translateY: -clip.value }] }));
  const lineSt = useAnimatedStyle(() => ({
    opacity: lineO.value,
    transform: [{ translateX: lineL.value }, { translateY: lineY.value - 1.5 }, { scaleX: Math.max(0.001, lineW.value / W) }],
  }));
  const y = split ?? 0;
  const topDoor = useAnimatedStyle(() => ({ transform: [{ translateY: -y * door.value }] }));
  const botDoor = useAnimatedStyle(() => ({ transform: [{ translateY: (H - y) * door.value }] }));
  const col = wipeColor(g);

  return (
    <View ref={host} collapsable={false} style={[StyleSheet.absoluteFill, s.host, { opacity: shown ? 1 : 0 }]}>
      <Animated.View style={[s.clip, outer]}>
        <Animated.View style={[s.page, { width: W, height: H }, inner]}>
          <Animated.View style={[StyleSheet.absoluteFill, settleSt]}>
            <LoadingPage g={g} w={W} h={H} live={stage !== 'doors'} p={p} tip={tip} barRef={bar} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
      {stage === 'doors' && run.shot ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {split === null ? null : (
            <>
              <Animated.View style={[s.door, { top: y, height: H - y }, botDoor]}>
                <View style={{ position: 'absolute', top: -y }}>
                  <Shot uri={run.shot} w={W} h={H} onLoad={doorLoaded} />
                </View>
              </Animated.View>
              <Animated.View style={[s.door, s.shadow, { top: 0, height: y }, topDoor]}>
                <Shot uri={run.shot} w={W} h={H} onLoad={doorLoaded} />
              </Animated.View>
            </>
          )}
        </View>
      ) : null}
      {stage === 'out' ? <Animated.View pointerEvents="none" style={[s.line, { width: W, transformOrigin: 'left center', backgroundColor: col, boxShadow: `0 0 12px ${col}, 0 0 30px ${col}` }, lineSt]} /> : null}
    </View>
  );
}

/** The page as it was at the tap: the doors are cut from this picture. */
function Shot({ uri, w, h, onLoad }: { uri: string; w: number; h: number; onLoad: () => void }) {
  return <Image source={{ uri }} style={{ width: w, height: h }} contentFit="fill" transition={0} onLoad={onLoad} onError={onLoad} />;
}

const s = StyleSheet.create({
  host: { zIndex: 20 },
  clip: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' },
  page: { position: 'absolute', left: 0 },
  door: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  shadow: { boxShadow: '0 8px 20px rgba(0,0,0,0.5)' },
  line: { position: 'absolute', left: 0, top: 0, height: 3 },
});
