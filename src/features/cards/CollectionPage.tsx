import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { create } from 'zustand';

import { Text } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { u, useScreen } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

import { DECK, type HuntCard } from './deck';
import { CardBack, RATIO, Sleeve } from './Sleeve';

/** Cards found so far (preview: a sample hand until the hunt is wired to the account). */
export const useHunt = create<{ found: string[] }>(() => ({ found: ['bolt', 'iris', 'atlas', 'nova', 'yara'] }));

/** My card collection: every card in a glass saver; found ones open (front, then flip for the clue), locked ones are dimmed. */
export function CollectionPage() {
  const c = useInfo();
  const t = c.t;
  const look = useLocalSearchParams<{ look?: string }>().look === 'b' ? 'b' : 'a';
  const found = useHunt((h) => h.found);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Screen tab={null} glow={13}>
      <InfoScroll contentStyle={look === 'b' ? { paddingHorizontal: 0 } : undefined}>
        <View style={look === 'b' ? { paddingHorizontal: u(18) } : undefined}>
          <Kicker>Treasure hunt</Kicker>
          <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
            {'My card '}
            <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>collection</Text>
          </Text>
          <View style={s.count}>
            <Text style={[s.countT, { color: c.fg }]}>{`${found.length} of 9 found`}</Text>
            <View style={s.pips}>
              {DECK.map((k) => (
                <View key={k.key} style={[s.pip, { backgroundColor: found.includes(k.key) ? t.accent : c.line }]} />
              ))}
            </View>
          </View>
          <Text style={[s.hint, { color: c.mute }]}>Tap a card to read it, then flip it for the clue.</Text>
        </View>
        {look === 'a' ? <Binder t={t} found={found} onOpen={setOpen} /> : <Showcase t={t} found={found} onOpen={setOpen} />}
      </InfoScroll>
      <Viewer t={t} i={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

/** Look A, "Binder page": all nine savers on one page, three by three. */
function Binder({ t, found, onOpen }: { t: Theme; found: string[]; onOpen: (i: number) => void }) {
  const w = Math.floor((u(246) - u(10) * 2 - u(16) - 4) / 3);
  return (
    <View style={[s.binder, { backgroundColor: t.mode === 'light' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.03)', borderColor: t.panelLine }]}>
      {DECK.map((k, i) => {
        const has = found.includes(k.key);
        return (
          <Pressable key={k.key} disabled={!has} onPress={() => onOpen(i)} style={{ width: w, alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={has ? `Open ${k.name}` : 'Locked card'}>
            <Sleeve t={t} card={k} w={w} locked={!has} />
            <Text style={[s.bName, { color: has ? t.fg : t.mute }]}>{has ? k.name : '★'.repeat(k.stars)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Look B, "Showcase": one big saver at a time in a sideways row, with a strip of all nine underneath. */
function Showcase({ t, found, onOpen }: { t: Theme; found: string[]; onOpen: (i: number) => void }) {
  const { width } = useScreen();
  const w = u(158);
  const gap = u(16);
  const side = (width - w) / 2;
  const [at, setAt] = useState(0);
  const k = DECK[at];
  const has = found.includes(k.key);
  return (
    <View style={{ marginTop: u(14) }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={w + gap}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: side, gap, paddingVertical: u(10) }}
        onScroll={(e) => setAt(Math.max(0, Math.min(8, Math.round(e.nativeEvent.contentOffset.x / (w + gap)))))}
        scrollEventThrottle={32}>
        {DECK.map((d, i) => (
          <Pressable key={d.key} disabled={!found.includes(d.key)} onPress={() => onOpen(i)} accessibilityRole="button" style={{ opacity: i === at ? 1 : 0.55, transform: [{ scale: i === at ? 1 : 0.9 }] }}>
            <Sleeve t={t} card={d} w={w} locked={!found.includes(d.key)} />
          </Pressable>
        ))}
      </ScrollView>
      <View style={s.cap}>
        <Text style={[s.capN, { color: has ? t.fg : t.mute }]}>{has ? k.name : 'Locked'}</Text>
        <Text style={[s.capS, { color: t.mode === 'light' ? '#c98a1e' : '#e9b44c' }]}>{'★'.repeat(k.stars)}</Text>
        <Text style={[s.capM, { color: t.mute }]}>{has ? 'FOUND · TAP TO OPEN' : 'FOLLOW THE CLUES TO FIND IT'}</Text>
      </View>
      <View style={s.strip}>
        {DECK.map((d, i) => (
          <View key={d.key} style={[s.mini, { borderColor: i === at ? t.accent : t.panelLine, backgroundColor: found.includes(d.key) ? (t.mode === 'light' ? 'rgba(229,131,58,0.15)' : 'rgba(111,214,255,0.14)') : 'transparent' }]}>
            <Text style={[s.miniT, { color: found.includes(d.key) ? t.fg : t.mute }]}>{i + 1}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The opened card: big, in its saver; tap flips it to the clue on the back. */
function Viewer({ t, i, onClose }: { t: Theme; i: number | null; onClose: () => void }) {
  const [back, setBack] = useState(false);
  const sx = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scaleX: sx.value }] }));
  const w = u(196);
  if (i === null) return null;
  const card = DECK[i] as HuntCard;
  const flip = () => {
    sx.value = withTiming(0, { duration: 160 }, (ok) => {
      if (!ok) return;
      runOnJS(setBack)(!back);
      sx.value = withTiming(1, { duration: 160 });
    });
  };
  const close = () => {
    setBack(false);
    onClose();
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.mode === 'light' ? 'rgba(40,34,24,0.72)' : 'rgba(3,4,12,0.86)' }]} onPress={close} accessibilityLabel="Close" />
      <View style={s.view} pointerEvents="box-none">
        <Pressable onPress={flip} accessibilityRole="button" accessibilityLabel={back ? 'Show the front' : 'Flip for the clue'}>
          <Animated.View style={anim}>{back ? <BackInSleeve t={t} card={card} i={i} w={w} /> : <Sleeve t={t} card={card} w={w} locked={false} />}</Animated.View>
        </Pressable>
        <Text style={[s.flipT, { color: 'rgba(240,242,255,0.75)' }]}>{back ? 'Tap to see the front' : 'Tap the card to flip it'}</Text>
        <Pressable onPress={close} style={s.close} accessibilityRole="button">
          <Text style={s.closeT}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function BackInSleeve({ t, card, i, w }: { t: Theme; card: HuntCard; i: number; w: number }) {
  const pad = Math.max(3, w * 0.045);
  return (
    <View style={{ width: w, borderRadius: w * 0.07, padding: pad, backgroundColor: t.mode === 'light' ? 'rgba(255,255,255,0.45)' : 'rgba(190,205,255,0.07)', borderWidth: 1, borderColor: t.mode === 'light' ? 'rgba(255,255,255,0.8)' : 'rgba(200,215,255,0.22)' }}>
      <View style={{ height: (w - pad * 2) * RATIO }}>
        <CardBack card={card} w={w - pad * 2} i={i} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  count: { flexDirection: 'row', alignItems: 'center', gap: u(10), marginTop: u(10) },
  countT: { fontFamily: F.bodySemi, fontSize: u(11.5) },
  pips: { flexDirection: 'row', gap: u(4) },
  pip: { width: u(10), height: u(4), borderRadius: u(2) },
  hint: { fontFamily: F.body, fontSize: u(10.5), lineHeight: u(15), marginTop: u(4) },
  binder: { marginTop: u(14), borderWidth: 1, borderRadius: u(20), padding: u(10), flexDirection: 'row', flexWrap: 'wrap', columnGap: u(8), rowGap: u(10) },
  bName: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1), marginTop: u(5), textTransform: 'uppercase' },
  cap: { alignItems: 'center', marginTop: u(4), gap: u(2) },
  capN: { fontFamily: F.display, fontSize: u(20), lineHeight: u(24) },
  capS: { fontSize: u(12), letterSpacing: u(2) },
  capM: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3), marginTop: u(2) },
  strip: { flexDirection: 'row', justifyContent: 'center', gap: u(5), marginTop: u(14) },
  mini: { width: u(20), height: u(28), borderRadius: u(5), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  miniT: { fontFamily: F.mono, fontSize: u(8) },
  view: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flipT: { fontFamily: F.bodyMedium, fontSize: u(11), marginTop: u(16) },
  close: { marginTop: u(10), paddingHorizontal: u(18), paddingVertical: u(8), borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  closeT: { fontFamily: F.bodySemi, fontSize: u(11), color: '#f0f2ff' },
});
