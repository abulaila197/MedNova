import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { Play, PlayItem } from '../engine/types';

export type Tone = 'win' | 'mid' | 'last';

/*
 * Omar reacts to how you did (Yazan 2026-10-18): first place or a great score gets the cocky line, last place or a bad
 * score gets teased, everyone else gets a calm one. Pass the phone always gets the calm one.
 */
const LINES: Record<Tone, [string, string][]> = {
  win: [
    ['Built different.', 'Top of the table, as expected.'],
    ['Was there ever any doubt?', 'Didn\'t even break a sweat.'],
    ['Too smooth.', 'Try to keep up next time.'],
  ],
  mid: [
    ['Not bad at all.', 'Solid game. Run it back?'],
    ['Respectable.', 'One more and you\'ve got it.'],
    ['Steady hands.', 'Keep it rolling.'],
  ],
  last: [
    ['Oof. That was rough.', 'Bold strategy. It didn\'t work.'],
    ['Were you even trying?', 'Asking for a friend.'],
    ['Well, someone had\nto be last.', 'Today it was you.'],
  ],
};
const PASS: [string, string] = ['Good game, everyone.', 'Pass it round and go again?'];

// All three are cut at the same line under the ID badge and padded so the badge sits at the same spot; Omar's face is
// the same size in each (90% of the first preview). The cut edge hides behind the stats card below.
const STICKER = {
  win: { src: require('@/assets/stickers/results/omar-win.png'), w: 281, h: 357 },
  mid: { src: require('@/assets/stickers/results/omar-mid.png'), w: 245, h: 304 },
  last: { src: require('@/assets/stickers/results/omar-last.png'), w: 250, h: 323 },
};
const SCALE = 0.325;
const TUCK = 4; // how far the cut edge sits under the card
const GAP = 12; // the page's gap between this row and the card (GameScreen body)

/** Solo: 70% or more right is great, under 35% is bad. With rivals: first, last, or in between. */
export function toneOf(play: Play, items: PlayItem[], uid: string | null): Tone {
  if (play.mode === 'solo') {
    const mine = items.filter((i) => i.seat === 0);
    const right = mine.filter((i) => i.outcome === 'right').length / Math.max(1, mine.length);
    return right >= 0.7 ? 'win' : right < 0.35 ? 'last' : 'mid';
  }
  const seat = play.seats.find((x) => x.userId && x.userId === uid)?.seat ?? 0;
  const rank = play.standings.find((r) => r.seat === seat)?.rank ?? 1;
  const worst = Math.max(...play.standings.map((r) => r.rank));
  return rank === 1 ? 'win' : rank === worst ? 'last' : 'mid';
}

export function ResultTone({ play, items, uid }: { play: Play; items: PlayItem[]; uid: string | null }) {
  const t = useTheme();
  const pass = play.mode === 'offline';
  const tone = pass ? 'mid' : toneOf(play, items, uid);
  // The same play always shows the same line.
  const n = [...play.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const [head, sub] = pass ? PASS : LINES[tone][n % LINES[tone].length];
  const st = STICKER[tone];
  return (
    <View style={s.row}>
      <Image
        source={st.src}
        style={[s.sticker, { width: u(st.w * SCALE), height: u(st.h * SCALE), bottom: -u(GAP + TUCK) }]}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
      <View style={s.words}>
        <Text style={[s.head, { color: t.white }]}>{head}</Text>
        <Text style={[s.sub, { color: t.soft }]}>{sub}</Text>
      </View>
    </View>
  );
}

/**
 * Own-look results pages (Case Files, Wheels): only Omar's sticker, beside their own title and tucked behind their
 * first card the same way (Yazan 2026-10-18).
 */
export function ToneSticker({ play, items, uid, children }: { play: Play; items: PlayItem[]; uid: string | null; children: ReactNode }) {
  const tone = play.mode === 'offline' ? 'mid' : toneOf(play, items, uid);
  const st = STICKER[tone];
  return (
    <View style={s.row}>
      <Image
        source={st.src}
        style={[s.sticker, { width: u(st.w * SCALE), height: u(st.h * SCALE), bottom: -u(GAP + TUCK) }]}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
      <View style={{ paddingRight: u(80) }}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  // Tall enough for the biggest sticker above the card; the card that follows is drawn over the sticker's cut edge.
  row: { height: u(357 * SCALE - TUCK), justifyContent: 'flex-end', marginTop: u(-4) },
  words: { paddingRight: u(80), paddingBottom: u(10), gap: u(4) },
  head: { fontFamily: F.display, fontSize: u(18), lineHeight: u(21) },
  sub: { fontFamily: F.body, fontSize: u(11) },
  sticker: { position: 'absolute', right: u(-4) },
});
