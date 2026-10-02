import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, FeGaussianBlur, Filter, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { ECG, STAR } from '@/components/PulseStar';
import { u } from '@/theme/scale';

import { bezier, EASE, EASE_IN_OUT, prog, track } from './ease';
import { NAVY } from './Sky';
import { Wordmark } from './Wordmark';

/*
 * The MedNova intro, frame for frame from the approved prototype (build_proto.py ICSS + OBJS):
 *   0s     star pops in, heartbeat cut + spark run through it (0.5s), it beats (1.3s)
 *   1.95s  the lockup slides so star + wordmark sit centred
 *   2.15s  the Lottie wordmark writes itself in
 *   5.4s   handover: wordmark fades, star glides to the centre, drops 10% and bursts into light
 *   8.1s   done, slide 1 is revealed
 */
export const T_LOTTIE = 2.15;
export const T_HAND = 5.4;
export const T_DONE = 8.1;

const POP = bezier(0.2, 0.9, 0.3, 1.25);
const CUT = bezier(0.6, 0, 0.3, 1);
const SPARK2 = bezier(0.5, 0, 0.4, 1);
const SLIDE = bezier(0.65, 0, 0.25, 1);
const EASE_OUT = bezier(0, 0, 0.58, 1);

// The heartbeat path is drawn with pathLength=1000 in the prototype. react-native-svg has no
// pathLength, so dash values are scaled by the real length of the path.
const ECG_LEN = 1375.87;
const k = ECG_LEN / 1000;

const SYM = 58;
const WM_W = 143;
const WM_H = 36;
const GAP = 6;
const SHIFT = (WM_W + GAP) / 2;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function frameAt(t: number, h: number) {
  // pop (0..0.5s) then one heartbeat (1.3s, 0.75s)
  const pp = prog(t, 0, 0.5);
  let popS = track(pp, [[0, 0], [0.6, 1.14], [1, 1]], POP);
  const popR = track(pp, [[0, -35], [0.6, 4], [1, 0]], POP);
  const popO = clamp01(track(pp, [[0, 0], [0.6, 1]], POP));
  if (t >= 1.3) popS = track(prog(t, 1.3, 0.75), [[0, 1], [0.18, 1.09], [0.36, 0.98], [0.54, 1.04], [1, 1]], EASE_IN_OUT);

  // glow: in, flare with the beat, then breathe
  let glow = track(pp, [[0, 0], [1, 0.55]], EASE_OUT);
  if (t >= 1.3) glow = track(prog(t, 1.3, 0.75), [[0, 0.55], [0.2, 1], [1, 0.55]], EASE_OUT);
  if (t >= 2.4) glow = track(((t - 2.4) % 4) / 4, [[0, 0.55], [0.5, 0.8], [1, 0.55]], EASE_IN_OUT);

  // heartbeat cut and the spark that runs along it
  const cut = 1000 * (1 - CUT(prog(t, 0.5, 0.8)));
  let sOff: number;
  let sOp: number;
  if (t < 4.2) {
    const q = prog(t, 0.5, 0.8);
    sOff = 70 - 1070 * CUT(q);
    sOp = track(q, [[0, 1], [0.9, 1], [1, 0]], CUT);
  } else {
    const q = ((t - 4.2) % 1.6) / 1.6;
    sOff = 70 - 1070 * SPARK2(q);
    sOp = track(q, [[0, 0.9], [0.85, 0.9], [1, 0]], SPARK2);
  }

  const shift = u(SHIFT) * (1 - SLIDE(prog(t, 1.95, 0.7)));

  // handover, keyframe progress of the 6.5s animation started at -1.56s
  const hk = (t - (T_HAND - 1.56)) / 6.5;
  const on = t >= T_HAND;
  const dx = u(SHIFT);
  const dy = h * 0.1;
  return {
    popS,
    popR,
    popO,
    glow,
    cut,
    sOff,
    sOp,
    shift,
    hx: on ? track(hk, [[0.24, 0], [0.31, dx]], EASE) : 0,
    hy: on ? track(hk, [[0.31, 0], [0.39, dy]], EASE) : 0,
    hs: on ? track(hk, [[0.31, 1], [0.39, 1.3], [0.46, 3]], EASE) : 1,
    ho: on ? track(hk, [[0.39, 1], [0.46, 0]], EASE) : 1,
    wmO: on ? track(hk, [[0.24, 1], [0.32, 0]], EASE) : 1,
    bg: on ? track(hk, [[0.38, 1], [0.5, 0]], EASE) : 1,
    fxO: on ? track(hk, [[0.38, 0], [0.46, 1], [0.64, 0]], EASE) : 0,
    fxS: on ? track(hk, [[0.38, 0.3], [0.46, 1.2], [0.64, 1.8]], EASE) : 0.3,
  };
}

function Star({ glow, cut, sOff, sOp }: { glow: number; cut: number; sOff: number; sOp: number }) {
  return (
    <Svg width={u(SYM)} height={u(SYM)} viewBox="120 100 784 824" style={{ overflow: 'visible' }}>
      <Defs>
        <LinearGradient id="inF" x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <Stop offset="0" stopColor="#d8f6ff" />
          <Stop offset="0.42" stopColor="#6fd6ff" />
          <Stop offset="1" stopColor="#3aa6dc" />
        </LinearGradient>
        <RadialGradient id="inH" cx="0.3" cy="0.25" r="0.55">
          <Stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#fff" stopOpacity="0" />
        </RadialGradient>
        <Filter id="inG" x="-60%" y="-60%" width="220%" height="220%">
          <FeGaussianBlur stdDeviation="38" />
        </Filter>
        <Filter id="inS" x="-20%" y="-20%" width="140%" height="140%">
          <FeGaussianBlur stdDeviation="5" />
        </Filter>
        <ClipPath id="inC">
          <Path d={STAR} />
        </ClipPath>
      </Defs>
      <Path d={STAR} fill="#6fd6ff" opacity={glow} filter="url(#inG)" />
      <Path d={STAR} fill="url(#inF)" />
      <Path d={STAR} fill="url(#inH)" />
      <Path d="M160 503 L405 405 L512 138 L619 405" fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={5} strokeLinejoin="round" clipPath="url(#inC)" />
      <G clipPath="url(#inC)">
        <Path
          d={ECG}
          fill="none"
          stroke={NAVY}
          strokeWidth={17}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[1000 * k, 1000 * k]}
          strokeDashoffset={cut * k}
        />
        {sOp > 0.001 ? (
          <Path
            d={ECG}
            fill="none"
            stroke="#fff"
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[70 * k, 1100 * k]}
            strokeDashoffset={sOff * k}
            opacity={sOp}
            filter="url(#inS)"
          />
        ) : null}
      </G>
    </Svg>
  );
}

/** Background of the logo stage and the light burst of the handover. */
function Backdrop({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="inBg" gradientUnits="userSpaceOnUse" cx={0} cy={0} r={1} gradientTransform={`translate(${w / 2} ${h / 2}) scale(${0.7 * w} ${0.5 * h})`}>
          <Stop offset={0} stopColor="#0f1840" />
          <Stop offset={0.7} stopColor={NAVY} />
          <Stop offset={1} stopColor={NAVY} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#inBg)" />
    </Svg>
  );
}

function Burst({ w, h }: { w: number; h: number }) {
  // radial-gradient(circle at 50% 60%, ...) : a circle out to the farthest corner
  const r = Math.hypot(w / 2, h * 0.6);
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="inFx" gradientUnits="userSpaceOnUse" cx={w / 2} cy={h * 0.6} r={r} fx={w / 2} fy={h * 0.6}>
          <Stop offset={0} stopColor="rgb(190,240,255)" stopOpacity={0.95} />
          <Stop offset={0.18} stopColor="rgb(111,214,255)" stopOpacity={0.5} />
          <Stop offset={0.45} stopColor="rgb(111,214,255)" stopOpacity={0} />
          <Stop offset={1} stopColor="rgb(111,214,255)" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#inFx)" />
    </Svg>
  );
}

/** Full-screen intro overlay. Calls onDone once the handover has revealed the page below. */
export function Intro({ w, h, onDone }: { w: number; h: number; onDone: () => void }) {
  const [t, setT] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    let raf = 0;
    const t0 = Date.now();
    const step = () => {
      const s = (Date.now() - t0) / 1000;
      if (s >= T_DONE) {
        done.current();
        return;
      }
      setT(s);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  const f = frameAt(t, h);
  const play = t >= T_LOTTIE;
  const backdrop = useMemo(() => <Backdrop w={w} h={h} />, [w, h]);
  const burst = useMemo(() => <Burst w={w} h={h} />, [w, h]);
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 60 }]}>
      <View style={[StyleSheet.absoluteFill, { opacity: f.bg }]}>
        {backdrop}
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(GAP), transform: [{ translateX: f.shift }] }}>
            <View style={{ width: u(SYM), height: u(SYM), opacity: f.ho, transform: [{ translateX: f.hx }, { translateY: f.hy }, { scale: f.hs }] }}>
              <View style={{ flex: 1, opacity: f.popO, transform: [{ scale: f.popS }, { rotate: `${f.popR}deg` }] }}>
                <Star glow={f.glow} cut={f.cut} sOff={f.sOff} sOp={f.sOp} />
              </View>
            </View>
            <View style={{ opacity: f.wmO }}>
              <Wordmark width={u(WM_W)} height={u(WM_H)} play={play} />
            </View>
          </View>
        </View>
      </View>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: f.fxO, transform: [{ scale: f.fxS }] }]}>
        {burst}
      </View>
    </View>
  );
}
