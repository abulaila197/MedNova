import { Pressable, StyleSheet, View } from 'react-native';
import { create } from 'zustand';

import { Text } from '@/components/AppText';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/**
 * What a game is for (Yazan 2026-10-26, #75), as a tag beside the game counter in the style of the Diagnostic Pursuit
 * hint box. Tapping it explains the tag.
 */
export type GameKind = 'learn' | 'both' | 'play';

const KIND: Record<string, GameKind> = {
  'the-diagnostic-pursuit': 'learn',
  'the-quiz-parade': 'learn',
  'case-files-unsolved': 'learn',
  'the-streak-master': 'learn',
  'nova-crossword': 'learn',
  'nova-password': 'play',
  'code-clinic': 'play',
  imposter: 'play',
  'the-silent-artist': 'play',
  'nova-medicordle': 'both',
  'the-riddler': 'both',
  'the-wheels-of-chaos': 'both',
  'the-conqueror': 'both',
};

// Three colours that stay clear of the navy page (Yazan: green, not blue, for Learn).
const LOOK: Record<GameKind, { label: string; color: string; text: string }> = {
  learn: {
    label: 'Learn',
    color: '#34d399',
    text: "Here the focus is learning. Every case or question you miss goes to Today's review on the Learn page, so you can go over it again, and missed diseases open their dossier with the full notes.",
  },
  both: {
    label: 'Learn & play',
    color: '#f59e0b',
    text: 'Learning and fun together. You pick up medicine as you play, but the game comes first, so most misses stay in the game. The results page links each answer to its dossier if you want to read up.',
  },
  play: {
    label: 'Play',
    color: '#f472b6',
    text: "Just for fun, with friends. The words are medical, but nothing goes to Today's review: no studying, just play.",
  },
};

const alpha = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

const useTagSheet = create<{ kind: GameKind | null }>(() => ({ kind: null }));

export function GameTag({ game }: { game: string }) {
  const kind = KIND[game];
  if (!kind) return null;
  const { label, color } = LOOK[kind];
  return (
    <Pressable
      onPress={() => useTagSheet.setState({ kind })}
      hitSlop={u(8)}
      style={[s.tag, { borderColor: alpha(color, 0.4), backgroundColor: alpha(color, 0.16) }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: what this means`}>
      <Text style={[s.t, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** The explanation for the tapped tag, over the Games page. */
export function GameTagSheet() {
  const t = useTheme();
  const kind = useTagSheet((x) => x.kind);
  const close = () => useTagSheet.setState({ kind: null });
  const look = kind ? LOOK[kind] : null;
  return (
    <Sheet open={!!look} onClose={close}>
      {look ? (
        <View style={s.body}>
          <View style={[s.tag, s.big, { borderColor: alpha(look.color, 0.4), backgroundColor: alpha(look.color, 0.16) }]}>
            <Text style={[s.t, s.bigT, { color: look.color }]}>{look.label}</Text>
          </View>
          <Text style={[s.p, { color: t.soft }]}>{look.text}</Text>
          <Pressable onPress={close} style={[s.ok, { borderColor: t.panelLine }]} accessibilityRole="button">
            <Text style={[s.okT, { color: t.fg }]}>Got it</Text>
          </Pressable>
        </View>
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: u(7), paddingVertical: u(3), paddingHorizontal: u(8) },
  t: { fontFamily: F.bodyBold, fontSize: u(8.5), lineHeight: u(11), letterSpacing: u(0.5), textTransform: 'uppercase' },
  body: { gap: u(12), paddingTop: u(4) },
  big: { paddingVertical: u(5), paddingHorizontal: u(11), borderRadius: u(9) },
  bigT: { fontSize: u(10.5), lineHeight: u(13) },
  p: { fontFamily: F.body, fontSize: u(12.5), lineHeight: u(19) },
  ok: { alignSelf: 'stretch', borderWidth: 1, borderRadius: u(14), paddingVertical: u(10), alignItems: 'center' },
  okT: { fontFamily: F.bodyBold, fontSize: u(12) },
});
