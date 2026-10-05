import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { u } from '@/theme/scale';

import { completed, invFile, status, type CaseDef, type FileId, type Run } from './core';
import { NR, T } from './noir';

// The evidence board (Case Files look, decided 2026-10-05): files pinned to a grey felt board in rings by stage,
// the personal file in the centre, red strings joining every file that glow as files unlock. Strings are
// decoration only (as coded). The felt is Yazan's photo (assets/casefiles/board.jpg).

type Pin = { id: FileId; label: string; x: number; y: number; r: number; kind: 'personal' | 'paper' };

/** Where each file sits, as fractions of the board: centre, then history, exam, tests, treatment, discharge. */
export function layout(def: CaseDef): Pin[] {
  const inv = def.investigations;
  const invSpots = [
    [0.17, 0.62, -4],
    [0.83, 0.61, 5],
    [0.5, 0.74, -2],
    [0.16, 0.09, 4],
  ];
  return [
    { id: 'personal', label: 'Personal file', x: 0.5, y: 0.45, r: -2, kind: 'personal' },
    { id: 'incident', label: 'Incident', x: 0.17, y: 0.33, r: -5, kind: 'paper' },
    { id: 'background', label: 'Background', x: 0.83, y: 0.32, r: 4, kind: 'paper' },
    { id: 'exam', label: 'Examination', x: 0.5, y: 0.09, r: 3, kind: 'paper' },
    ...inv.map((v, i) => {
      const [x, y, r] = invSpots[i % invSpots.length];
      return { id: invFile(i), label: v.title || 'Results', x, y, r, kind: 'paper' } as Pin;
    }),
    { id: 'treatment', label: 'Treatment', x: 0.73, y: 0.9, r: 3, kind: 'paper' },
    { id: 'discharge', label: 'Discharge', x: 0.27, y: 0.9, r: -3, kind: 'paper' },
  ];
}

/** Decorative strands: every file to the centre, plus a few crossing pairs, like the loading page board. */
function strands(pins: Pin[]) {
  const ids = pins.map((p) => p.id);
  const pairs: [FileId, FileId][] = ids.filter((x) => x !== 'personal').map((x) => ['personal', x]);
  const extra: [string, string][] = [['incident', 'exam'], ['background', 'inv0'], ['incident', 'inv1'], ['exam', 'background'], ['inv0', 'discharge'], ['inv1', 'treatment'], ['incident', 'discharge'], ['background', 'treatment']];
  for (const [a, b] of extra) if (ids.includes(a as FileId) && ids.includes(b as FileId)) pairs.push([a as FileId, b as FileId]);
  return pairs;
}

/** Folder height on the board; width follows each photo. */
const CARD_H = 60;
/** Yazan's photos (2026-10-05): the empty felt board in its frame, and the creamy yellow police folder in each state. */
const BOARD = require('@/assets/casefiles/board.jpg');
const FOLDER = {
  new: { src: require('@/assets/casefiles/folder-new.png'), ratio: 249 / 360 },
  read: { src: require('@/assets/casefiles/folder-read.png'), ratio: 292 / 360 },
  personal: { src: require('@/assets/casefiles/folder-personal.png'), ratio: 248 / 360 },
};

export function PinBoard({ def, run, sealed, onOpen }: { def: CaseDef; run: Run; sealed: boolean; onOpen: (f: FileId) => void }) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const st = status(def, run, sealed);
  const opened = new Set(run.opened);
  const pins = layout(def);
  const at = (p: Pin) => ({ x: p.x * (box?.w ?? 0), y: p.y * (box?.h ?? 0) });
  const pinY = (p: Pin) => at(p).y - u(p.kind === 'personal' ? CARD_H * 1.2 : CARD_H) / 2 + u(3);
  const done = completed(run);
  return (
    <View style={s.frame}>
      <Image source={BOARD} resizeMode="stretch" style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} accessibilityIgnoresInvertColors />
      <View style={s.felt} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {box ? (
          <>
            {/* Strings first, so the folders sit on top of them. */}
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
              {strands(pins).map(([a, b]) => {
                const pa = pins.find((p) => p.id === a)!;
                const pb = pins.find((p) => p.id === b)!;
                const lit = st.unlocked[a] && st.unlocked[b];
                const xy = { x1: at(pa).x, y1: pinY(pa), x2: at(pb).x, y2: pinY(pb) };
                return (
                  <G key={a + b}>
                    {lit ? <Line {...xy} stroke="#ff3b47" strokeOpacity={0.22} strokeWidth={5} strokeLinecap="round" /> : null}
                    <Line {...xy} stroke={lit ? '#e0303c' : NR.red} strokeOpacity={lit ? 1 : 0.7} strokeWidth={lit ? 1.5 : 1.1} />
                  </G>
                );
              })}
            </Svg>
            {pins.map((p) => {
              const live = !!st.unlocked[p.id];
              const read = opened.has(p.id);
              const sealedFile = p.id === 'discharge' && sealed && done;
              const state = p.kind === 'personal' ? 'personal' : read ? 'read' : 'new';
              const f = FOLDER[state];
              const h = u(p.kind === 'personal' ? CARD_H * 1.2 : CARD_H);
              const w = h * f.ratio;
              const tag = read ? 'read' : live ? 'new' : sealedFile ? 'sealed' : 'locked';
              return (
                <Pressable
                  key={p.id}
                  onPress={() => live && onOpen(p.id)}
                  disabled={!live}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.label}, ${tag}`}
                  style={[s.card, { left: at(p).x - w / 2, top: at(p).y - h / 2, width: w, height: h, transform: [{ rotate: `${p.r}deg` }] }]}
                >
                  <Image source={f.src} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
                  {!live ? <Lock /> : null}
                  <View style={s.label}>
                    <View style={s.strip}>
                      <T size={8} color={live ? '#1f1a12' : '#6a6050'} lines={1} style={{ lineHeight: u(10), letterSpacing: 0.2 }}>{p.label}</T>
                    </View>
                  </View>
                </Pressable>
              );
            })}
            {/* Pins on top, each needle tip exactly where its strings meet. */}
            {pins.map((p) => {
              const live = !!st.unlocked[p.id];
              return <PinHead key={`pin-${p.id}`} x={at(p).x} y={pinY(p)} glow={live && !opened.has(p.id)} dim={!live} />;
            })}
          </>
        ) : null}
      </View>
    </View>
  );
}

/** Pin size against its 24 x 26 drawing. */
const PIN = 0.65;

/** A red push pin seen from the side, like 📌: head, collar and the needle going into the felt. New files glow. */
function PinHead({ x, y, glow, dim }: { x: number; y: number; glow: boolean; dim: boolean }) {
  // The needle tip is at (19, 22.5) in the 24 x 26 drawing, drawn at PIN scale (smaller, Yazan 2026-10-05).
  return (
    <View style={[s.pinWrap, { left: x - u(19 * PIN), top: y - u(22.5 * PIN) }]} pointerEvents="none">
      <Svg width={u(24 * PIN)} height={u(26 * PIN)} viewBox="0 0 24 26">
        <Defs>
          <RadialGradient id="pg" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#ff3b47" stopOpacity={0.75} />
            <Stop offset="1" stopColor="#ff3b47" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="ph" cx="0.35" cy="0.3" r="0.75">
            <Stop offset="0" stopColor={dim ? '#e06a72' : '#ff8a90'} />
            <Stop offset="1" stopColor={dim ? '#7a1a20' : '#9c1019'} />
          </RadialGradient>
        </Defs>
        {glow ? <Circle cx={9} cy={8} r={9} fill="url(#pg)" /> : null}
        <Path d="M12.5 13.5 L19 22.5" stroke="#b9b9b4" strokeWidth={1.4} strokeLinecap="round" />
        <Path d="M12.5 13.5 L19 22.5" stroke="#000" strokeOpacity={0.25} strokeWidth={0.6} strokeLinecap="round" />
        <Ellipse cx={11.6} cy={12.2} rx={3.2} ry={1.6} fill="#8e1018" transform="rotate(35 11.6 12.2)" />
        <Path d="M5.2 7.6 L10.4 4.4 L13.8 9.6 L8.6 12.8 Z" fill="url(#ph)" />
        <Circle cx={7.4} cy={5.6} r={4.4} fill="url(#ph)" />
        <Circle cx={6.2} cy={4.4} r={1.2} fill="#fff" fillOpacity={0.55} />
      </Svg>
    </View>
  );
}

/** Locked: the same folder with a lock in the middle. */
function Lock() {
  return (
    <View style={s.lock} pointerEvents="none">
      <Svg width={u(18)} height={u(20)} viewBox="0 0 18 20">
        <Path d="M5 9 V6.2 a4 4 0 0 1 8 0 V9" stroke="#3b3326" strokeWidth={2} fill="none" />
        <Rect x={2.5} y={8.5} width={13} height={10} rx={2} fill="#3b3326" />
        <Circle cx={9} cy={13} r={1.5} fill="#d4c497" />
        <Rect x={8.4} y={13.5} width={1.2} height={2.6} fill="#d4c497" />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  frame: { flex: 1, backgroundColor: '#1d1d1c', overflow: 'hidden' },
  /** The felt inside the photo's frame, where the files go. */
  felt: { position: 'absolute', left: '7%', right: '7%', top: '5%', bottom: '5%' },
  card: { position: 'absolute' },
  /** A typed paper label stuck just under the folder. */
  label: { position: 'absolute', left: '-30%', right: '-30%', top: '96%', alignItems: 'center' },
  strip: { backgroundColor: '#f1ede2', paddingHorizontal: u(4), paddingVertical: u(1.5), transform: [{ rotate: '-2deg' }], shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: u(1.5) },
  pinWrap: { position: 'absolute' },
  lock: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', opacity: 0.85 },
});
