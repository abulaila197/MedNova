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
 * Yazan 2026-11-12: renamed On duty / Play and learn / Party time, and a tap explains all three in one pop-up,
 * the tapped one first. Party time is the pass-the-phone group games (Imposter, Tilt & Tell, Sketch It).
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
  'tilt-and-tell': 'play',
  'four-of-a-kind': 'both',
  'spot-the-flaw': 'both',
  'the-silent-artist': 'play',
  'nova-medicordle': 'both',
  'the-riddler': 'both',
  'the-wheels-of-chaos': 'learn', // On duty since Quick Fire Quiz merged in (2026-11-12)
  'the-conqueror': 'both',
};

// Three colours that stay clear of the navy page (Yazan: green, not blue, for Learn).
const LOOK: Record<GameKind, { label: string; color: string; text: string }> = {
  learn: {
    label: 'On duty',
    color: '#34d399',
    text: "Learning first. Every miss goes to Today's review on Learn.",
  },
  both: {
    label: 'Play and learn',
    color: '#f59e0b',
    text: 'Fun first, medicine along the way. Results link each answer to its dossier.',
  },
  play: {
    label: 'Party time',
    color: '#f472b6',
    text: 'Group games on one phone with friends. Nothing goes to review.',
  },
};
const ORDER: GameKind[] = ['learn', 'both', 'play'];

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

/** All three tags explained in one pop-up over the Games page, the tapped one first. */
export function GameTagSheet() {
  const t = useTheme();
  const kind = useTagSheet((x) => x.kind);
  const close = () => useTagSheet.setState({ kind: null });
  const order = kind ? [kind, ...ORDER.filter((k) => k !== kind)] : ORDER;
  return (
    <Sheet open={!!kind} onClose={close}>
      {kind ? (
        <View style={s.body}>
          {order.map((k) => {
            const look = LOOK[k];
            return (
              <View key={k} style={[s.row, { borderColor: k === kind ? alpha(look.color, 0.45) : t.panelLine, backgroundColor: k === kind ? alpha(look.color, 0.07) : 'transparent' }]}>
                <View style={[s.tag, s.big, { borderColor: alpha(look.color, 0.4), backgroundColor: alpha(look.color, 0.16) }]}>
                  <Text style={[s.t, s.bigT, { color: look.color }]}>{look.label}</Text>
                </View>
                <Text style={[s.p, { color: t.soft }]}>{look.text}</Text>
              </View>
            );
          })}
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
  body: { gap: u(6), paddingTop: u(2) },
  row: { gap: u(4), borderWidth: 1, borderRadius: u(10), paddingVertical: u(7), paddingHorizontal: u(9) },
  big: { paddingVertical: u(3), paddingHorizontal: u(9), borderRadius: u(8) },
  bigT: { fontSize: u(9.5), lineHeight: u(12) },
  p: { fontFamily: F.body, fontSize: u(11), lineHeight: u(15) },
  ok: { alignSelf: 'stretch', borderWidth: 1, borderRadius: u(12), paddingVertical: u(8), alignItems: 'center' },
  okT: { fontFamily: F.bodyBold, fontSize: u(12) },
});
