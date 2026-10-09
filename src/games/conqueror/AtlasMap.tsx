// The chart itself (CQ20-CQ21): sea with coastal ripple lines, a parchment continent, watercolour kingdoms that
// follow whoever holds each land now, ink borders, mountains, a compass rose, and a chess piece on every land
// (a castle on a capital, a pawn on an outpost) with its troops underneath. Lands can be tapped.
import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Path, Rect, Text as SvgText } from 'react-native-svg';

import { AT, CZ, KINGDOMS, Piece, shade } from './atlas';
import { MAP_H, MAP_W, type AtlasMap } from './map';

export type LandView = { seat: number | null; troops: string | null; capital: boolean; shielded?: boolean; trapped?: boolean };
export type Arrow = { from: string | null; to: string; label: string; color?: string };

const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
export const troopLabel = k;

type Props = {
  map: AtlasMap;
  lands: Record<string, LandView>;
  width: number;
  selected?: string | null;
  /** Lands that can be tapped right now are drawn a little stronger. */
  targets?: string[];
  arrows?: Arrow[];
  onLand?: (id: string) => void;
};

function AtlasMapView({ map, lands, width, selected, targets, arrows = [], onLand }: Props) {
  const height = (width * MAP_H) / MAP_W;
  const spot = useMemo(() => Object.fromEntries(map.lands.map((l) => [l.id, l.spot])), [map]);
  const seatOf = (id: string) => lands[id]?.seat ?? null;
  // Borders: thick between kingdoms (or with neutral land), dashed inside one kingdom.
  const kb = map.borders.filter((b) => seatOf(b.a) !== seatOf(b.b) || seatOf(b.a) == null);
  const ib = map.borders.filter((b) => !kb.includes(b));
  const order = map.lands.slice().sort((a, b) => a.spot[1] - b.spot[1]);
  const W = MAP_W, H = MAP_H;

  return (
    <View style={{ width, height, borderWidth: 1.5, borderColor: 'rgba(20,10,4,0.6)', backgroundColor: AT.sea }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          {map.lands.map((l) => (
            <ClipPath key={l.id} id={`c${l.id}`}>
              <Path d={l.d} />
            </ClipPath>
          ))}
        </Defs>
        <Rect width={W} height={H} fill={AT.sea} />
        {[25, 15, 7].map((r) => (
          <G key={r}>
            <Path d={map.coast} fill="none" stroke={AT.seaLine} strokeOpacity={0.75} strokeWidth={2 * r + 1.2} strokeLinejoin="round" />
            <Path d={map.coast} fill="none" stroke={AT.sea} strokeWidth={2 * r - 0.4} strokeLinejoin="round" />
          </G>
        ))}
        <Path d={map.coast} fill={AT.land} />
        {map.lands.map((l) => {
          const v = lands[l.id];
          if (v?.seat == null) return null;
          const c = KINGDOMS[v.seat % KINGDOMS.length];
          const strong = selected === l.id || targets?.includes(l.id);
          return (
            <G key={l.id}>
              <Path d={l.d} fill={c} fillOpacity={selected === l.id ? 0.66 : strong ? 0.52 : 0.42} />
              <G clipPath={`url(#c${l.id})`}>
                <Path d={l.d} fill="none" stroke={shade(c, -0.15)} strokeOpacity={0.35} strokeWidth={7} />
              </G>
            </G>
          );
        })}
        <SvgImage href={require('@/assets/conqueror/wash.png')} x={0} y={0} width={W} height={H} preserveAspectRatio="none" />
        {ib.map((b) => (
          <Path key={`i${b.a}${b.b}`} d={b.d} fill="none" stroke={AT.ink} strokeOpacity={0.55} strokeWidth={0.8} strokeDasharray="3 2.2" />
        ))}
        {kb.map((b) => (
          <Path key={`k${b.a}${b.b}`} d={b.d} fill="none" stroke={AT.ink} strokeOpacity={0.85} strokeWidth={1.5} strokeLinecap="round" />
        ))}
        <Path d={map.coast} fill="none" stroke={AT.ink} strokeOpacity={0.12} strokeWidth={5} />
        <Path d={map.coast} fill="none" stroke={AT.ink} strokeWidth={1.8} strokeLinejoin="round" />
        {map.mountains.map(([x, y], i) => (
          <Path key={i} d={`M${x - 6} ${y + 3}L${x} ${y - 5}L${x + 6} ${y + 3}M${x - 1} ${y - 3.5}L${x + 1.5} ${y - 0.5}`} fill="none" stroke={AT.ink} strokeOpacity={0.5} strokeWidth={1} strokeLinejoin="round" />
        ))}
        <G transform={`translate(${W - 26} ${H - 26})`} opacity={0.75}>
          <Circle r={13} fill="none" stroke="#5a3a1e" strokeWidth={0.7} />
          <Path d="M0-17 L2.6 0 L0 17 L-2.6 0Z" fill="#5a3a1e" />
          <Path d="M-17 0 L0 2.6 L17 0 L0-2.6Z" fill="#5a3a1e" opacity={0.6} />
          <SvgText y={-19} textAnchor="middle" fontFamily={CZ} fontSize={7.5} fill="#5a3a1e">N</SvgText>
        </G>
        {onLand
          ? map.lands.map((l) => <Path key={`t${l.id}`} d={l.d} fill="#000" fillOpacity={0.001} onPress={() => onLand(l.id)} />)
          : null}
        {arrows.map((a, i) => {
          const b = spot[a.to];
          if (!b) return null;
          const s = a.from ? spot[a.from] : ([b[0], b[1] - 62] as [number, number]);
          const mx = (s[0] + b[0]) / 2, my = a.from ? Math.min(s[1], b[1]) - 30 : b[1] - 40;
          const cx = a.from ? mx : b[0] + 26;
          const end: [number, number] = [b[0], b[1] - 18];
          // Arrowhead along the curve's last tangent.
          const ang = Math.atan2(end[1] - my, end[0] - cx);
          const head = (d: number) => `${end[0] + 6 * Math.cos(ang + d)} ${end[1] + 6 * Math.sin(ang + d)}`;
          const col = a.color ?? AT.red;
          return (
            <G key={i} pointerEvents="none">
              <Path d={`M${s[0]} ${s[1] - (a.from ? 12 : 0)} Q${cx} ${my} ${end[0]} ${end[1]}`} fill="none" stroke={col} strokeWidth={2} strokeDasharray="5 3.5" strokeLinecap="round" />
              <Path d={`M${end[0]} ${end[1]}L${head(Math.PI - 0.45)}L${head(Math.PI + 0.45)}Z`} fill={col} />
              <G transform={`translate(${(s[0] + 2 * cx + end[0]) / 4} ${(s[1] + 2 * my + end[1]) / 4 + 4})`}>
                <Circle r={10} fill={col} />
                <Circle r={10} fill="none" stroke={AT.cream} strokeOpacity={0.5} strokeWidth={0.8} strokeDasharray="1.5 1.5" />
                <SvgText y={3} textAnchor="middle" fontFamily={CZ} fontSize={7.5} fill={AT.cream}>{a.label}</SvgText>
              </G>
            </G>
          );
        })}
        {order.map((l) => {
          const v = lands[l.id];
          const color = v?.seat == null ? '#8a8172' : KINGDOMS[v.seat % KINGDOMS.length];
          return (
            <G key={`p${l.id}`} pointerEvents="none">
              <Piece kind={v?.capital ? 'rook' : 'pawn'} color={color} x={l.spot[0]} y={l.spot[1] + 6} label={v?.troops ?? undefined} id={`g${l.id}`} />
              {v?.shielded ? <Path d={`M${l.spot[0] + 9} ${l.spot[1] - 14}h7v4c0 3-3.5 5-3.5 5s-3.5-2-3.5-5Z`} fill={AT.paper} stroke={AT.ink} strokeWidth={0.8} /> : null}
              {v?.trapped ? <Path d={`M${l.spot[0] - 16} ${l.spot[1] - 6}l3-6 3 6 3-6 3 6`} fill="none" stroke={AT.red} strokeWidth={1.3} /> : null}
              {selected === l.id ? <Circle cx={l.spot[0]} cy={l.spot[1] + 7} r={13} fill="none" stroke={AT.red} strokeWidth={1.6} strokeDasharray="3 2" /> : null}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

export const MapChart = memo(AtlasMapView);
