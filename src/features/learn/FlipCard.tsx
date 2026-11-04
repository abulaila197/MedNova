import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/AppText';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { type Card, titleOf } from './library';
import { useLearnColors } from './palette';

/** "3 days ago", "today", "yesterday". */
function ago(at: number) {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

/**
 * Today's review flash card. A missed disease shows 3 of its clues and you guess it; the back shows its name (Yazan
 * 2026-10-26, replacing RL7's name-first card); a missed
 * question shows the question and its choices, with the answer on the back, Anki style (RL5).
 */
export function FlipCard({ card, flipped, onPress }: { card: Card; flipped: boolean; onPress: () => void }) {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  // #31: one of the case's last 3 clues, picked when the card comes up.
  const [pick] = useState(() => Math.floor(Math.random() * 3));
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withTiming(flipped ? 180 : 0, { duration: 600, easing: Easing.bezier(0.3, 0.8, 0.3, 1) });
  }, [flipped, r]);
  const front = useAnimatedStyle(() => ({
    opacity: r.value < 90 ? 1 : 0,
    transform: [{ perspective: u(900) }, { rotateY: `${-r.value}deg` }],
  }));
  const back = useAnimatedStyle(() => ({
    opacity: r.value >= 90 ? 1 : 0,
    transform: [{ perspective: u(900) }, { rotateY: `${180 - r.value}deg` }],
  }));
  const face = [s.face, { borderColor: c.cardLine, boxShadow: c.cardShadow }];
  const bg = <LinearGradient colors={[c.cardA, c.cardB]} style={[StyleSheet.absoluteFill, { borderRadius: u(19) }]} />;
  const src = (
    <View style={s.src}>
      <View style={[s.dot, { backgroundColor: c.miss }]} />
      <Text style={[s.srcT, { color: c.mute }]}>Missed in</Text>
      <Text style={[s.srcT, s.srcB, { color: c.strong }]} numberOfLines={1}>
        {card.gameName}
      </Text>
      <Text style={[s.srcT, { color: c.mute }]}>· {ago(card.at)}</Text>
    </View>
  );
  const isDossier = card.kind === 'dossier';
  const title = isDossier ? titleOf(card.dossier.name) : null;
  // #7 (Yazan 2026-11-04): the card grows to fit its answer (or question), up to about half the screen (the room between the title and the buttons); past that the
  // text steps down a size and scrolls inside the card. The estimate counts lines at the card's width.
  const { height: screenH, width: screenW } = useWindowDimensions();
  const answer = card.kind === 'dossier' ? '' : card.answer ?? 'Not saved for this question.';
  const longAnswer = answer.length > 110;
  const lines = (text: string, perLine: number) => Math.ceil(text.length / Math.max(10, perLine));
  const textW = Math.min(screenW, u(400)) - u(64);
  const backH = u(64) + lines(answer, textW / (longAnswer ? u(8) : u(10))) * (longAnswer ? u(20) : u(24.7)) + u(40);
  const frontH = card.kind === 'dossier' ? 0 : u(70) + lines(card.q, textW / u(8)) * u(21) + card.choices.length * u(30) + (card.image ? u(100) : 0);
  const fitH = Math.min(Math.max(u(220), backH, frontH), screenH * 0.48);
  return (
    <Pressable onPress={onPress} style={[s.flip, { minHeight: fitH }]} accessibilityRole="button" accessibilityLabel={flipped ? 'Show the front' : isDossier ? 'Show the disease' : 'Show the answer'}>
      <Animated.View style={[face, front]} pointerEvents={flipped ? 'none' : 'box-none'}>
        {bg}
        {src}
        {card.kind === 'dossier' ? (
          <>
            {/* #5: no clue labels, one point per line, and the box scrolls; a tap on it still flips the card. */}
            <ScrollView style={s.qscroll} contentContainerStyle={s.qin} showsVerticalScrollIndicator={false}>
              <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Show the disease">
                {card.facts.clues ? (
                  <Text style={[s.one, { color: t.fg }]}>{card.facts.clues[pick % card.facts.clues.length]}</Text>
                ) : (
                  card.facts.points.map((p, i) => (
                    <View key={i} style={s.pt}>
                      <View style={[s.bul, { backgroundColor: t.accent }]} />
                      <Text style={[s.ptT, { color: t.fg }]}>{p}</Text>
                    </View>
                  ))
                )}
              </Pressable>
            </ScrollView>
            <Text style={[s.hint, { color: c.mute }]}>Which disease is it? Tap to see</Text>
          </>
        ) : (
          <>
            {/* A long question scrolls instead of being cut; a tap on it still turns the card. */}
            <ScrollView style={s.qscroll} contentContainerStyle={s.qin} showsVerticalScrollIndicator={false}>
              <Pressable onPress={onPress} style={s.qmid} accessibilityRole="button" accessibilityLabel="Show the answer">
                {card.image ? <Image source={card.image} style={s.img} resizeMode="contain" /> : null}
                <Text style={[s.q, (card.q.length > 80 || card.choices.length > 4) && s.qLong, { color: t.fg }]}>{card.q}</Text>
                <View style={[s.chs, card.choices.length > 4 && s.chGrid]}>
                  {card.choices.map((ch, i) => (
                    <Text key={i} numberOfLines={card.choices.length > 4 ? 2 : card.choices.some((x) => x.length > 34) ? 3 : 1} style={[s.ch, card.choices.length > 4 && s.chHalf, { color: c.strong, borderColor: c.cardLine }]}>
                      {ch}
                    </Text>
                  ))}
                </View>
              </Pressable>
            </ScrollView>
            <Text style={[s.hint, { color: c.mute }]}>Tap for the answer</Text>
          </>
        )}
      </Animated.View>
      <Animated.View style={[face, back]} pointerEvents={flipped ? 'box-none' : 'none'}>
        {bg}
        {card.kind === 'dossier' ? (
          <>
            <Text style={[s.fld, { color: t.accent }]}>THE DISEASE</Text>
            <View style={s.mid}>
              {title!.first ? <Text style={[s.big, { color: t.fg }]}>{title!.first}</Text> : null}
              <Text style={[s.big, { color: t.accent, fontFamily: F.displayItalic }]}>{title!.em}</Text>
            </View>
            <Text style={[s.hint, { color: c.mute }]}>Its dossier is one tap below</Text>
          </>
        ) : (
          <>
            <Text style={[s.fld, { color: t.accent }]}>ANSWER</Text>
            <ScrollView style={s.qscroll} showsVerticalScrollIndicator={false}>
              <Text style={[s.fact, longAnswer && s.factLong, { color: t.fg }]}>{answer}</Text>
            </ScrollView>
            <Text style={[s.hint, { color: c.mute }]} numberOfLines={2}>
              {card.q}
            </Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  flip: { flex: 1, minHeight: u(220) },
  face: { ...StyleSheet.absoluteFill, borderRadius: u(20), borderWidth: 1, padding: u(16), gap: u(7), backfaceVisibility: 'hidden', overflow: 'hidden' },
  src: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  dot: { width: u(6), height: u(6), borderRadius: u(6) },
  srcT: { fontFamily: F.body, fontSize: u(10), lineHeight: u(12) },
  srcB: { fontFamily: F.bodySemi, flexShrink: 1 },
  mid: { flex: 1, justifyContent: 'center' },
  big: { fontFamily: F.display, fontSize: u(38), lineHeight: u(38), letterSpacing: u(-0.76) },
  qmid: { gap: u(5) },
  q: { fontFamily: F.display, fontSize: u(16), lineHeight: u(21), marginBottom: u(4) },
  ch: { fontFamily: F.body, fontSize: u(11), lineHeight: u(14), borderWidth: 1, borderRadius: u(10), paddingVertical: u(6), paddingHorizontal: u(10) },
  // Long stems and six-choice questions step down so the whole question stays on the card.
  qLong: { fontSize: u(13), lineHeight: u(17), marginBottom: u(2) },
  chs: { gap: u(5) },
  // Five or six choices sit two to a row.
  chGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  chHalf: { width: '48.5%', paddingHorizontal: u(8), paddingVertical: u(4), fontSize: u(10), lineHeight: u(12) },
  img: { width: '100%', height: u(96), borderRadius: u(10) },
  hint: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(11) },
  tail: { marginTop: 'auto' },
  qscroll: { flex: 1 },
  qin: { flexGrow: 1, justifyContent: 'center', paddingVertical: u(4) },
  one: { fontFamily: F.body, fontSize: u(14), lineHeight: u(20) },
  pt: { flexDirection: 'row', gap: u(8), marginBottom: u(6) },
  bul: { width: u(5), height: u(5), borderRadius: u(3), marginTop: u(6) },
  ptT: { flex: 1, fontFamily: F.body, fontSize: u(11.5), lineHeight: u(15.5) },
  fld: { fontFamily: F.mono, fontSize: u(9), lineHeight: u(12), letterSpacing: u(1.62) },
  fact: { fontFamily: F.display, fontSize: u(19), lineHeight: u(24.7) },
  factLong: { fontSize: u(15), lineHeight: u(20) },
});
