import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinear, Path, Rect, Stop } from 'react-native-svg';

import { Text } from '@/components/AppText';
import { Sheet } from '@/components/Sheet';
import { useSvgId } from '@/components/svgId';
import { MECHS } from '@/features/chests/data';
import { Face } from '@/games/shell/Face';
import { CHARACTERS } from '@/games/shell/characters';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

const ORIG = u(37);
const MECH = u(46);
const GAP = u(3);
const RING = u(2);

/**
 * The selection mark: its own ring drawn around the face with a clear gap, in the app gradient, plus a
 * small tick; it never touches the face's coloured rim, so the two read as different things.
 */
function Pick({ size, on, children }: { size: number; on: boolean; children: ReactNode }) {
  const t = useTheme();
  const id = useSvgId('pk');
  const box = size + 2 * (GAP + RING);
  const r = (box - RING) / 2;
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      {children}
      {on ? (
        <>
          <Svg width={box} height={box} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <SvgLinear id={id} x1="0" y1="0" x2={box} y2={box} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={t.gradA} />
                <Stop offset="1" stopColor={t.gradB} />
              </SvgLinear>
            </Defs>
            <Circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={RING} />
          </Svg>
          <View style={[s.tick, { backgroundColor: t.gradB, borderColor: t.panel }]}>
            <Svg width={u(8)} height={u(8)} viewBox="0 0 24 24">
              <Path d="M5 12.5 L10 17.5 L19 7" stroke={t.onGrad} strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Choose your character (Yazan 2026-10-18): the free Original pack, then the Nova Mechs you won from chests. */
export function CharacterPicker({ open, onClose, wearing, owned, onWear, error }: { open: boolean; onClose: () => void; wearing: string; owned: string[]; onWear?: (slug: string) => void; error?: string | null }) {
  const t = useTheme();
  // Your pick while the sheet is open; closing it forgets the pick.
  const [picked, setSel] = useState<string | null>(null);
  const sel = picked ?? wearing;
  const close = () => {
    setSel(null);
    onClose();
  };
  const mech = MECHS.find((m) => m.key === sel);
  const orig = CHARACTERS.find((c) => c.slug === sel);
  return (
    <Sheet open={open} onClose={close}>
      <ScrollView style={{ maxHeight: u(392) }} showsVerticalScrollIndicator={false}>
        <Text style={[s.h, { color: t.fg }]}>
          {'Choose your '}
          <Text style={[s.h, { color: t.accent }]}>character</Text>
        </Text>

        <View style={[s.top, { backgroundColor: t.panel2, borderColor: t.panelLine }]}>
          {mech ? <Image source={mech.face} style={s.big} contentFit="contain" /> : <Face slug={sel} size={u(72)} />}
          <View style={{ flex: 1 }}>
            <Text style={[s.name, { color: t.fg }]}>{mech?.name ?? orig?.name}</Text>
            <Text style={[s.sub, { color: t.mute }]}>{mech ? mech.title : 'Original pack'}</Text>
            {mech ? <Text style={s.stars}>{'★'.repeat(mech.stars)}</Text> : null}
          </View>
        </View>

        <Text style={[s.k, { color: t.kick }]}>ORIGINAL PACK · FREE</Text>
        <View style={s.grid}>
          {CHARACTERS.map((c) => (
            <Pressable key={c.slug} onPress={() => setSel(c.slug)} accessibilityRole="button" accessibilityLabel={c.name} accessibilityState={{ selected: sel === c.slug }}>
              <Pick size={ORIG} on={sel === c.slug}>
                <Face slug={c.slug} size={ORIG} />
              </Pick>
            </Pressable>
          ))}
        </View>

        <Text style={[s.k, { color: t.kick }]}>{`NOVA MECHS · ${owned.length} OF ${MECHS.length}`}</Text>
        <View style={s.grid}>
          {MECHS.map((m) => {
            const has = owned.includes(m.key);
            return (
              <Pressable key={m.key} disabled={!has} onPress={() => setSel(m.key)} style={s.mCell} accessibilityRole="button" accessibilityLabel={has ? m.name : `${m.name}, locked`} accessibilityState={{ selected: sel === m.key, disabled: !has }}>
                <Pick size={MECH} on={sel === m.key}>
                  <Image source={m.face} style={[{ width: MECH, height: MECH }, !has && { opacity: 0.3 }]} contentFit="contain" />
                  {!has ? (
                    <View style={[StyleSheet.absoluteFill, s.lock]}>
                      <Svg width={u(14)} height={u(14)} viewBox="0 0 24 24">
                        <Rect x={5} y={10.5} width={14} height={10} rx={2} fill={t.fg} />
                        <Path d="M8 10.5 V8 a4 4 0 0 1 8 0 V10.5" stroke={t.fg} strokeWidth={2.2} fill="none" />
                      </Svg>
                    </View>
                  ) : null}
                </Pick>
                <Text style={[s.mStars, { opacity: has ? 1 : 0.45 }]}>{'★'.repeat(m.stars)}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[s.note, { color: t.mute }]}>Locked robots come from daily chests.</Text>
      </ScrollView>

      {error ? <Text style={[s.note, { color: t.mute, marginTop: u(8) }]}>{error}</Text> : null}
      <Pressable onPress={() => onWear?.(sel)} disabled={sel === wearing} style={[{ marginTop: u(12) }, sel === wearing && { opacity: 0.5 }]} accessibilityRole="button">
        <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.btn}>
          <Text style={[s.btnT, { color: t.onGrad }]}>{sel === wearing ? 'Wearing now' : `Wear ${mech?.name ?? orig?.name}`}</Text>
        </LinearGradient>
      </Pressable>
    </Sheet>
  );
}

const s = StyleSheet.create({
  h: { fontFamily: F.display, fontSize: u(22), marginTop: u(6) },
  top: { flexDirection: 'row', alignItems: 'center', gap: u(12), borderWidth: 1, borderRadius: u(16), padding: u(10), marginTop: u(12) },
  big: { width: u(72), height: u(72) },
  name: { fontFamily: F.display, fontSize: u(17) },
  sub: { fontFamily: F.body, fontSize: u(9.5), marginTop: u(2) },
  stars: { color: '#ffd76a', fontSize: u(10), marginTop: u(3) },
  k: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3), marginTop: u(16), marginBottom: u(6) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: u(2) },
  mCell: { alignItems: 'center', marginBottom: u(4), marginRight: u(2) },
  lock: { alignItems: 'center', justifyContent: 'center' },
  tick: { position: 'absolute', right: 0, bottom: 0, width: u(13), height: u(13), borderRadius: u(7), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  mStars: { color: '#ffd76a', fontSize: u(7), marginTop: u(1) },
  note: { fontFamily: F.body, fontSize: u(8.5), marginTop: u(10) },
  btn: { height: u(34), borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnT: { fontFamily: F.bodyBold, fontSize: u(11.5) },
});
