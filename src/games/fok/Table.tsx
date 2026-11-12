// Four of a Kind's own look (look E, Yazan 2026-11-12): the card table moved onto the app's navy. Cream boxes with
// small red crosses, picked boxes lift with a gold edge, found groups become coloured rows, gold Submit. Plain words.
import { HelperButton } from '../shell/ui';
import { COIN, CoinLabel, spoken } from '@/components/CoinLabel';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/AppText';
import { loadFonts } from '@/features/loading/fonts';
import { tapped } from '@/lib/sound';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { engine } from '../engine';
import { FOK, LEVEL_NAME, groupOfTile, type Board, type Group } from './core';
import { groupById } from './data';

export const SERIF = 'DMSerifDisplay_400Regular';
export const C = {
  cream: '#fffaf0',
  creamOn: '#fff3cf',
  ink: '#1b2140',
  cross: '#c0353f',
  gold: '#f2c14e',
  goldInk: '#2a1f00',
  text: '#f6f2e4',
  soft: '#c9d6ff',
  mute: '#a9b9e6',
  heart: '#e2384d',
  heartOff: 'rgba(255,255,255,0.2)',
  /** Group rows by slot: easy yellow, the two mediums green and blue, hard violet. */
  rows: ['#f2d27a', '#9fd8b5', '#a9c6ff', '#d3b3ff'],
};

/** The table: the app's navy, a little lighter in the middle where the boxes sit. */
export function FokSky() {
  // The serif comes with the loading page; load it here too for a resumed game.
  useEffect(() => {
    void loadFonts([SERIF]).catch(() => {});
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#0e1846', '#16245c', '#0e1846', '#070d26']} locations={[0, 0.35, 0.7, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const HEART = 'M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4.5 6 4.5c2.2 0 3.6 1.3 6 3.6 2.4-2.3 3.8-3.6 6-3.6 3.7 0 5.6 3.9 4 7.2C19.5 16.4 12 21 12 21z';
export function Hearts({ n, max = FOK.hearts }: { n: number; max?: number }) {
  return (
    <View style={s.hearts} accessibilityLabel={`${n} of ${max} hearts`}>
      {Array.from({ length: Math.max(max, n) }, (_, i) => (
        <Svg key={i} width={u(13)} height={u(13)} viewBox="0 0 24 24">
          <Path d={HEART} fill={i < n ? C.heart : C.heartOff} />
        </Svg>
      ))}
    </View>
  );
}

/** The line over the board: a small kicker on the left, hearts (or anything) on the right, then the title. */
export function TopLine({ kicker, right, title, sub }: { kicker: string; right?: ReactNode; title: string; sub?: string }) {
  return (
    <View style={{ gap: u(2) }}>
      <View style={s.topRow}>
        <Text style={s.kick}>{kicker}</Text>
        {right}
      </View>
      <Text style={s.title} numberOfLines={1}>
        {title}
      </Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

function Fan() {
  return (
    <View style={s.fan}>
      {[-14, -5, 5, 14].map((r, i) => (
        <View key={r} style={[s.fanCard, { transform: [{ rotate: `${r}deg` }], marginLeft: i ? -u(6) : 0 }]} />
      ))}
    </View>
  );
}

/** A found (or revealed) group: its row colour, name, level and the four boxes. `who` names who found it. */
export function GroupRow({ board, slot, who, missed, line, onPress }: { board: Board; slot: number; who?: string; missed?: boolean; line?: boolean; onPress?: () => void }) {
  const g = groupById.get(board.groups[slot].id)!;
  const boxes = board.groups[slot].boxes.map((i) => g.b[i][0]);
  const body = (
    <Animated.View entering={FadeInDown.duration(260)} style={[s.row, { backgroundColor: C.rows[slot], opacity: missed ? 0.72 : 1 }]}>
      <Fan />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.rowHead}>
          <Text style={s.rowName} numberOfLines={2}>
            {g.n}
          </Text>
          <Text style={s.rowLv}>{(missed ? 'MISSED · ' : who ? `${who.toUpperCase()} · ` : '') + LEVEL_NAME[g.lv].toUpperCase()}</Text>
        </View>
        <Text style={s.rowBoxes}>{boxes.join(' · ')}</Text>
        {line ? <Text style={s.rowLine}>{g.l}</Text> : null}
      </View>
    </Animated.View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${g.n}, see each box`}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

const TILE_FONT = u(10.5);

/** The boxes still on the table, four to a row. */
export function Tiles({ board, order, picked, onTap, width, disabled }: { board: Board; order: number[]; picked: number[]; onTap?: (t: number) => void; width: number; disabled?: boolean }) {
  const gap = u(6);
  const w = (width - gap * 3) / 4;
  return (
    <View style={[s.grid, { gap }]}>
      {order.map((t) => {
        const on = picked.includes(t);
        const g = groupById.get(board.groups[groupOfTile(t)].id)!;
        const label = g.b[board.groups[groupOfTile(t)].boxes[t % 4]][0];
        // Words never break in the middle: the longest word sets the size (adjustsFontSizeToFit is native only).
        const longest = Math.max(...label.split(/[\s-]+/).map((x) => x.length));
        const base = TILE_FONT * Math.min(1.5, Math.max(1, w / u(78)));
        const size = Math.max(base * 0.5, Math.min(base, (w - u(9)) / (longest * 0.6)));
        return (
          <Pressable
            key={t}
            onPress={tapped(onTap ? () => onTap(t) : undefined)}
            disabled={disabled || !onTap}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            style={[s.tile, { width: w, height: w * 1.08 }, on ? s.tileOn : null]}>
            <Text style={[s.pip, { top: u(2), left: u(4) }]}>✚</Text>
            <Text style={[s.pip, { bottom: u(2), right: u(4), transform: [{ rotate: '180deg' }] }]}>✚</Text>
            <Text style={[s.tileT, { fontSize: size, lineHeight: size * 1.2 }]} numberOfLines={4} adjustsFontSizeToFit minimumFontScale={0.72}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The row of buttons under the board. */
export function Bar({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.bar, style]}>{children}</View>;
}
export function TableBtn({ label, onPress, go, disabled, flex = 1 }: { label: string; onPress?: () => void; go?: boolean; disabled?: boolean; flex?: number }) {
  return (
    <Pressable onPress={tapped(onPress)} disabled={disabled} accessibilityRole="button" accessibilityLabel={spoken(label)} style={[s.btn, go ? s.btnGo : null, { flex, opacity: disabled ? 0.45 : 1 }]}>
      <CoinLabel text={label} style={[s.btnT, go ? { color: C.goldInk, fontFamily: F.bodyBold } : null]} numberOfLines={1} />
    </Pressable>
  );
}

/** The stamp in the free space under the boxes ("One away"); never over them (Yazan 2026-11-12). */
export function Stamp({ text, tone = 'red' }: { text: string; tone?: 'red' | 'gold' }) {
  return (
    <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(220)} style={[s.stamp, tone === 'gold' ? { borderColor: C.gold } : null]}>
      <Text style={[s.stampT, tone === 'gold' ? { color: '#7a5600' } : null]}>{text}</Text>
    </Animated.View>
  );
}

/** A small note under the boxes. */
export const Note = ({ children }: { children: ReactNode }) => <Text style={s.note}>{children}</Text>;

/** Out of hearts: one token gives a heart back, once a board; otherwise the board shows its answers. */
export function TokenCard({ playId, name, text, onBuy, onNo, noLabel = 'No, show the answers' }: { playId: string; name?: string; text?: string; onBuy: () => void; onNo: () => void; noLabel?: string }) {
  const [note, setNote] = useState<string | null>(null);
  const busy = useRef(false);
  const [sending, setSending] = useState(false);
  const buy = async () => {
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    try {
      const receipt = await engine.wallet.spend(FOK.tokenPrice, 'fok_heart', playId);
      if (!receipt) return setNote('You need 1 token. Each level up gives 1 token.');
      try {
        onBuy();
      } catch {
        await engine.wallet.refund(receipt);
        setNote('Couldn’t add the heart. Your token was refunded.');
      }
    } finally {
      busy.current = false;
      setSending(false);
    }
  };
  return (
    <View style={s.card}>
      <Text style={[s.kick, { color: '#ff8a9a' }]}>OUT OF HEARTS</Text>
      {name ? <Text style={s.cardBig}>{name}</Text> : null}
      <Text style={s.cardLine}>{note ?? text ?? `Second chance: ${FOK.tokenPrice} token gives ${FOK.tokenHearts} heart, once a board. Your found groups stay found.`}</Text>
      <HelperButton label={`1 more heart · ${FOK.tokenPrice}${COIN}`} tone="rose" onPress={buy} disabled={sending} style={{ borderRadius: 999, paddingVertical: u(12) }} />
      <TableBtn label={noLabel} onPress={onNo} />
    </View>
  );
}

/** A group's boxes with their notes (the end of a board). */
export function GroupNotes({ board, slot }: { board: Board; slot: number }) {
  const g: Group = groupById.get(board.groups[slot].id)!;
  return (
    <View style={[s.notes, { borderColor: C.rows[slot] }]}>
      <Text style={[s.rowName, { color: C.text }]}>{g.n}</Text>
      <Text style={[s.rowLine, { color: C.soft }]}>{g.l}</Text>
      {board.groups[slot].boxes.map((i) => (
        <Text key={i} style={s.noteLine}>
          <Text style={{ fontFamily: F.bodySemi, color: C.text }}>{g.b[i][0]}</Text>
          {`  ${g.b[i][1]}`}
        </Text>
      ))}
    </View>
  );
}

export const s = StyleSheet.create({
  hearts: { flexDirection: 'row', gap: u(3) },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: u(10) },
  kick: { fontFamily: F.mono, fontSize: u(9.5), letterSpacing: u(1.4), color: C.soft, textTransform: 'uppercase' },
  title: { fontFamily: SERIF, fontSize: u(26), lineHeight: u(32), color: C.text },
  sub: { fontFamily: F.body, fontSize: u(11.5), color: C.mute },
  fan: { flexDirection: 'row', width: u(34), flexShrink: 0, paddingLeft: u(4), alignItems: 'center' },
  fanCard: { width: u(11), height: u(15), borderRadius: u(2), backgroundColor: C.cream, borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)' },
  row: { borderRadius: u(10), paddingVertical: u(7), paddingHorizontal: u(10), flexDirection: 'row', alignItems: 'center', gap: u(9), shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: u(8), shadowOffset: { width: 0, height: u(3) }, elevation: 3 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: u(6) },
  rowName: { fontFamily: SERIF, fontSize: u(14), lineHeight: u(18), color: '#16182a', flexShrink: 1 },
  rowLv: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1), color: 'rgba(22,24,42,0.6)' },
  rowBoxes: { fontFamily: F.bodyMedium, fontSize: u(10), lineHeight: u(13.5), color: 'rgba(22,24,42,0.85)' },
  rowLine: { fontFamily: F.body, fontSize: u(10), lineHeight: u(13.5), color: 'rgba(22,24,42,0.75)', marginTop: u(2) },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { borderRadius: u(8), backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', paddingHorizontal: u(4), paddingVertical: u(10), shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: u(7), shadowOffset: { width: 0, height: u(4) }, elevation: 4 },
  tileOn: { backgroundColor: C.creamOn, borderWidth: u(2), borderColor: C.gold, transform: [{ translateY: -u(5) }], shadowColor: C.gold, shadowOpacity: 0.55, shadowRadius: u(10) },
  pip: { position: 'absolute', fontSize: u(7.5), lineHeight: u(10), color: C.cross },
  tileT: { fontFamily: F.bodySemi, fontSize: u(10.5), lineHeight: u(12.5), color: C.ink, textAlign: 'center' },
  bar: { flexDirection: 'row', gap: u(6) },
  btn: { borderRadius: 999, paddingVertical: u(10), alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(242,193,78,0.45)', backgroundColor: 'rgba(255,255,255,0.03)' },
  btnGo: { backgroundColor: C.gold, borderColor: C.gold },
  btnT: { fontFamily: F.bodySemi, fontSize: u(11.5), color: '#f3e3b4' },
  stamp: { alignSelf: 'center', backgroundColor: C.cream, borderWidth: u(2), borderColor: C.cross, borderRadius: u(6), paddingVertical: u(7), paddingHorizontal: u(18), transform: [{ rotate: '-3deg' }], shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: u(10), shadowOffset: { width: 0, height: u(6) }, elevation: 6 },
  stampT: { fontFamily: SERIF, fontSize: u(17), lineHeight: u(22), color: '#7a1420' },
  note: { fontFamily: F.body, fontSize: u(11), color: C.mute },
  card: { borderRadius: u(16), padding: u(14), gap: u(8), backgroundColor: '#18245a', borderWidth: 1, borderColor: 'rgba(242,193,78,0.3)' },
  cardBig: { fontFamily: SERIF, fontSize: u(21), lineHeight: u(26), color: C.text },
  cardLine: { fontFamily: F.body, fontSize: u(12), lineHeight: u(17), color: C.soft },
  notes: { borderLeftWidth: u(3), paddingLeft: u(10), gap: u(3) },
  noteLine: { fontFamily: F.body, fontSize: u(11), lineHeight: u(15.5), color: C.mute },
});
