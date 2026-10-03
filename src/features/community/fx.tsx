import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Image, type ImageSourcePropType, Platform, View, type ViewStyle } from 'react-native';
import Svg, { Defs, G, Image as SvgImage, LinearGradient as LinearGradientSvg, Mask, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';

/** Unique, url()-safe id for SVG defs. */
export function useSvgId(prefix: string) {
  return prefix + useId().replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Vertical alpha fade over any content (CSS `mask-image: linear-gradient(...)`).
 * `stops` are [offset 0..1, alpha 0..1] pairs from top to bottom.
 * Web uses a real CSS mask; native uses MaskedView with a gradient.
 */
export function Fade({ stops, style, children }: { stops: [number, number][]; style?: ViewStyle; children: ReactNode }) {
  const ref = useRef<View>(null);
  const css = `linear-gradient(${stops.map(([o, a]) => `rgba(0,0,0,${a}) ${(o * 100).toFixed(2)}%`).join(', ')})`;
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = ref.current as unknown as HTMLElement | null;
    if (el && el.style) {
      el.style.setProperty('mask-image', css);
      el.style.setProperty('-webkit-mask-image', css);
    }
  }, [css]);
  if (Platform.OS === 'web') {
    return (
      <View ref={ref} style={style}>
        {children}
      </View>
    );
  }
  return (
    <MaskedView
      style={style}
      maskElement={
        <LinearGradient
          style={{ flex: 1 }}
          colors={stops.map(([, a]) => `rgba(0,0,0,${a})`) as unknown as [string, string, ...string[]]}
          locations={stops.map(([o]) => o) as unknown as [number, number, ...number[]]}
        />
      }
    >
      {children}
    </MaskedView>
  );
}

/** Where a photo sits inside its box, in design px (x/y = box-relative top-left of the image). */
export type Place = { x: number; y: number; w: number; h: number };

/** CSS `background-size: cover; background-position: px py` for an image of iw x ih in a box of bw x bh. */
export function cover(iw: number, ih: number, bw: number, bh: number, px = 0.5, py = 0.5): Place {
  const s = Math.max(bw / iw, bh / ih);
  const w = iw * s;
  const h = ih * s;
  return { x: (bw - w) * px, y: (bh - h) * py, w, h };
}

/**
 * Photo with a soft elliptical edge (CSS `mask-image: radial-gradient(rx ry at cx cy, ...)`),
 * drawn with react-native-svg so it works on web and native. All numbers in design px.
 */
export function Feather({
  source,
  box,
  place,
  ellipse,
  stops,
  opacity = 1,
  vfade,
  style,
}: {
  source: ImageSourcePropType;
  box: { w: number; h: number };
  place: Place;
  ellipse: { cx: number; cy: number; rx: number; ry: number };
  stops: [number, number][];
  opacity?: number;
  /** optional extra vertical fade (box-relative 0..1 stops), multiplied with the radial edge */
  vfade?: [number, number][];
  style?: ViewStyle;
}) {
  const id = useSvgId('fe');
  const img = <SvgImage href={source} x={place.x} y={place.y} width={place.w} height={place.h} preserveAspectRatio="none" mask={`url(#${id}m)`} opacity={opacity} />;
  const { cx, cy, rx, ry } = ellipse;
  const k = ry / rx;
  return (
    <Svg width={u(box.w)} height={u(box.h)} viewBox={`0 0 ${box.w} ${box.h}`} style={style} pointerEvents="none">
      <Defs>
        <RadialGradient id={`${id}g`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={rx} fx={cx} fy={cy}>
          {stops.map(([o, a], i) => (
            <Stop key={i} offset={o} stopColor="#fff" stopOpacity={a} />
          ))}
        </RadialGradient>
        <Mask id={`${id}m`} maskUnits="userSpaceOnUse" x={-2000} y={-2000} width={5000} height={5000}>
          <G transform={`translate(0 ${cy}) scale(1 ${k}) translate(0 ${-cy})`}>
            <Rect x={-2000} y={-6000} width={5000} height={14000} fill={`url(#${id}g)`} />
          </G>
        </Mask>
        {vfade ? (
          <LinearGradientSvg id={`${id}v`} x1={0} y1={0} x2={0} y2={1}>
            {vfade.map(([o, a], i) => (
              <Stop key={i} offset={o} stopColor="#fff" stopOpacity={a} />
            ))}
          </LinearGradientSvg>
        ) : null}
        {vfade ? (
          <Mask id={`${id}w`} maskUnits="userSpaceOnUse" x={0} y={0} width={box.w} height={box.h}>
            <Rect x={0} y={0} width={box.w} height={box.h} fill={`url(#${id}v)`} />
          </Mask>
        ) : null}
      </Defs>
      {vfade ? <G mask={`url(#${id}w)`}>{img}</G> : img}
    </Svg>
  );
}

/** Photo cropped into a box: the image is drawn `place` (design px) inside an overflow-hidden box. */
export function Crop({ source, w, h, place, radius = 0, style, children }: { source: ImageSourcePropType; w: number; h: number; place: Place; radius?: number; style?: ViewStyle; children?: ReactNode }) {
  return (
    <View style={[{ width: u(w), height: u(h), borderRadius: u(radius), overflow: 'hidden' }, style]}>
      <Image source={source} style={{ position: 'absolute', left: u(place.x), top: u(place.y), width: u(place.w), height: u(place.h) }} />
      {children}
    </View>
  );
}

/** Empty photo frame: a soft tinted box that keeps a photo's place until real content exists. */
export function Empty({ w, h, radius = 0, style, children }: { w: number; h: number; radius?: number; style?: ViewStyle; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={[{ width: u(w), height: u(h), borderRadius: u(radius), overflow: 'hidden', backgroundColor: t.card2, borderWidth: 1, borderColor: t.chipLine }, style]}>
      {children}
    </View>
  );
}

/** Soft round glow (stand-in for a CSS box-shadow halo), centred in its box. */
export function Halo({ size, color, inner = 0.3 }: { size: number; color: string; inner?: number }) {
  const id = useSvgId('ha');
  return (
    <Svg width={u(size)} height={u(size)} viewBox={`0 0 ${size} ${size}`} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset={0} stopColor={color} stopOpacity={1} />
          <Stop offset={inner} stopColor={color} stopOpacity={1} />
          <Stop offset={1} stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} fill={`url(#${id})`} />
    </Svg>
  );
}
