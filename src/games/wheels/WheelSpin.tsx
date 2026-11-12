// #27 (Yazan 2026-11-01, look A): a real wheel. One brass wheel with three rings: the centre is the count, the
// middle ring the style, the outer ring the field. All three spin at once and stop from the inside out, each landing
// its pick under the pointer. Every name is written out in full and fits inside its slice (Yazan: never cut); the
// label sizes below were fitted once for Cinzel Bold in this drawing's own units, so the wheel scales as one piece.
import { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import { u } from '@/theme/scale';

import { mixFields, STYLE_KEYS, type Turn } from './core';
import { CB, VV } from './velvet';

/** The drawing's own units: a 390-wide box, the wheel's centre in the middle. */
const BOX = 390;
const C = BOX / 2;
const R = 174;
const RINGS = { field: [106, R], style: [44, 106], count: [18, 44] } as const;

const COUNT_LABELS = ['1', '2', '3'];
const STYLE_LABELS: Record<(typeof STYLE_KEYS)[number], string> = {
  mcq: 'Direct\nMCQ', tf: 'True or\nFalse', r2o: 'Rule\n2 Out', match: 'Matching', riddle: 'Riddle\nMCQ', reverse: 'Reverse\nQuestion', lie: '3 Truths\n& a Lie', closest: 'Closest\nNumber', order: 'Put in\nOrder',
};
const FIELD_LABELS: Record<string, string> = {
  anatomy: 'Anatomy', physiology: 'Physiology', pathology: 'Pathology', pharmacology: 'Pharmacology', microbiology: 'Microbiology',
  biochemistry: 'Biochemistry', medicine: 'Internal\nMedicine', surgery: 'Surgery', pediatrics: 'Pediatrics', obgyn: 'Obs &\nGynae',
};
/** Fitted so each line sits inside its slice with room to spare (largest that fits, at most 12; count 15). */
const SIZE: Record<string, number> = {
  Pharmacology: 9, Microbiology: 9.75, Biochemistry: 10.25, Physiology: 11.75, Matching: 9.75, 'Reverse\nQuestion': 9.5,
};
const sizeOf = (label: string, base: number) => SIZE[label] ?? base;

/** When each ring stops (ms from mount); the first 300 ms the wheel rests. */
const START_MS = 300;
export const STOP_MS = { count: 1700, style: 2500, field: 3300 } as const;

const rad = (d: number) => (d * Math.PI) / 180;
const pt = (r: number, d: number) => `${C + r * Math.cos(rad(d))} ${C + r * Math.sin(rad(d))}`;
function wedge(r0: number, r1: number, a0: number, a1: number) {
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M ${pt(r1, a0)} A ${r1} ${r1} 0 ${big} 1 ${pt(r1, a1)} L ${pt(r0, a1)} A ${r0} ${r0} 0 ${big} 0 ${pt(r0, a0)} Z`;
}

/** Where a ring ends: its pick at the top, after some full turns (negative turns spin the other way). */
const landing = (pick: number, n: number, turns: number) => -(pick * 360) / n - turns * 360;

/** One ring, drawn once; it turns as a whole. `land` is its final angle, so labels are upright where it stops. */
const Ring = memo(function Ring({ id, r0, r1, labels, land, base }: { id: string; r0: number; r1: number; labels: string[]; land: number; base: number }) {
  const n = labels.length;
  const seg = 360 / n;
  const mid = (r0 + r1) / 2;
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${BOX} ${BOX}`}>
      <Defs>
        <RadialGradient id={`${id}d`} cx={C} cy={C} r={r1} gradientUnits="userSpaceOnUse">
          <Stop offset={r0 / r1} stopColor="#1a2858" />
          <Stop offset={1} stopColor="#2c3e7c" />
        </RadialGradient>
        <RadialGradient id={`${id}l`} cx={C} cy={C} r={r1} gradientUnits="userSpaceOnUse">
          <Stop offset={r0 / r1} stopColor="#e3d4b2" />
          <Stop offset={1} stopColor={VV.paper} />
        </RadialGradient>
      </Defs>
      {labels.map((label, i) => {
        const am = -90 + i * seg;
        const dark = i % 2 === 0;
        // Upright where the ring comes to rest: flip the words on the lower half.
        const rest = (((am + land) % 360) + 360) % 360;
        const low = rest > 0.01 && rest < 179.99;
        const lines = label.split('\n');
        const fs = sizeOf(label, base);
        const lh = fs * 1.12;
        return (
          <G key={label}>
            <Path d={wedge(r0, r1, am - seg / 2, am + seg / 2)} fill={`url(#${id}${dark ? 'd' : 'l'})`} stroke={VV.brass} strokeWidth={1.4} />
            <G transform={`translate(${C} ${C}) rotate(${am + (low ? -90 : 90)})`}>
              {lines.map((ln, j) => {
                const off = (j - (lines.length - 1) / 2) * lh;
                return (
                  <SvgText key={j} x={0} y={(low ? mid + off : -mid + off) + fs * 0.36} fontFamily={CB} fontSize={fs} fill={dark ? VV.cream : VV.paperInk} textAnchor="middle">
                    {ln}
                  </SvgText>
                );
              })}
            </G>
          </G>
        );
      })}
    </Svg>
  );
});

function Spinning({ children, to, ms }: { children: React.ReactNode; to: number; ms: number }) {
  const a = useSharedValue(0);
  useEffect(() => {
    a.value = withDelay(START_MS, withTiming(to, { duration: ms - START_MS, easing: Easing.out(Easing.cubic) }));
  }, [a, to, ms]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${a.value}deg` }] }));
  return <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, style]}>{children}</Animated.View>;
}

/** The brass rim with its bulbs, the pointer and the hub; the landed slices glow once each ring stops. */
const Frame = memo(function Frame({ lit, fields, styleRing }: { lit: { count: boolean; style: boolean; field: boolean }; fields: number; styleRing: readonly [number, number] }) {
  const top = (r0: number, r1: number, n: number) => wedge(r0, r1, -90 - 180 / n, -90 + 180 / n);
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${BOX} ${BOX}`} style={{ position: 'absolute' }}>
      <Defs>
        <RadialGradient id="hub" cx={C - 6} cy={C - 6} r={18} gradientUnits="userSpaceOnUse">
          <Stop offset={0} stopColor="#dff6ff" />
          <Stop offset={1} stopColor="#6f8fe0" />
        </RadialGradient>
      </Defs>
      {lit.field && fields > 1 ? <Path d={top(RINGS.field[0], RINGS.field[1], fields)} fill="rgba(111,214,255,0.2)" stroke={VV.brass} strokeWidth={3} /> : null}
      {lit.style ? <Path d={top(styleRing[0], styleRing[1], STYLE_KEYS.length)} fill="rgba(111,214,255,0.2)" stroke={VV.brass} strokeWidth={3} /> : null}
      {lit.count ? <Path d={top(RINGS.count[0], RINGS.count[1], 3)} fill="rgba(111,214,255,0.2)" stroke={VV.brass} strokeWidth={3} /> : null}
      <Circle cx={C} cy={C} r={R + 8} fill="none" stroke="#3a4f96" strokeWidth={13} />
      <Circle cx={C} cy={C} r={R + 14} fill="none" stroke="#6fd6ff" strokeWidth={1.2} />
      <Circle cx={C} cy={C} r={R + 1.5} fill="none" stroke="#0d1738" strokeWidth={1.2} />
      {Array.from({ length: 24 }, (_, i) => {
        const d = (i / 24) * 360;
        const on = i % 2 === 0;
        return <Circle key={i} cx={C + (R + 8) * Math.cos(rad(d))} cy={C + (R + 8) * Math.sin(rad(d))} r={2.6} fill={on ? '#dff6ff' : '#8a90b8'} />;
      })}
      <Circle cx={C} cy={C} r={18} fill="url(#hub)" stroke="#0d1738" strokeWidth={2} />
      <Path d={`M ${C - 13} ${C - R - 24} L ${C + 13} ${C - R - 24} L ${C} ${C - R + 2} Z`} fill="#6fd6ff" stroke="#0d1738" strokeWidth={1.5} />
    </Svg>
  );
});

/** The wheel for a turn's first question; `settled` tells which rings have stopped (the parent keeps the clock). */
export function WheelSpin({ turn, settled }: { turn: Turn; settled: { count: boolean; style: boolean; field: boolean } }) {
  // #16 (Yazan 2026-11-04): the field ring shows only the fields the room picked (6 basic, 4 clinical or all 10).
  const fields = mixFields(turn.mix);
  const n = { count: 3, style: STYLE_KEYS.length, field: fields.length };
  const land = {
    count: landing(Math.max(0, turn.count - 1), n.count, 5),
    style: landing(STYLE_KEYS.indexOf(turn.combo.style), n.style, -4),
    field: landing(Math.max(0, fields.findIndex((f) => f.key === turn.combo.field)), n.field, 3),
  };
  // Yazan 2026-11-12: one field picked means no field wheel; the style ring takes the outer place (2 wheels).
  const one = fields.length === 1;
  const styleRing = one ? ([RINGS.style[0], R] as const) : RINGS.style;
  return (
    <View style={{ width: '100%', maxWidth: u(380), aspectRatio: 1, alignSelf: 'center' }}>
      {one ? null : (
        <Spinning to={land.field} ms={STOP_MS.field}>
          <Ring id="f" r0={RINGS.field[0]} r1={RINGS.field[1]} labels={fields.map((f) => FIELD_LABELS[f.key] ?? f.name)} land={land.field} base={12} />
        </Spinning>
      )}
      <Spinning to={land.style} ms={STOP_MS.style}>
        <Ring id="s" r0={styleRing[0]} r1={styleRing[1]} labels={STYLE_KEYS.map((k) => STYLE_LABELS[k])} land={land.style} base={one ? 14 : 12} />
      </Spinning>
      <Spinning to={land.count} ms={STOP_MS.count}>
        <Ring id="c" r0={RINGS.count[0]} r1={RINGS.count[1]} labels={COUNT_LABELS} land={land.count} base={15} />
      </Spinning>
      <Frame lit={settled} fields={fields.length} styleRing={styleRing} />
    </View>
  );
}
