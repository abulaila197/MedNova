import { Pressable, StyleSheet, View } from 'react-native';
import { create } from 'zustand';

import { Text } from '@/components/AppText';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { tr } from '@/i18n';

/**
 * What a game is for (Yazan 2026-10-26, #75), as a tag beside the game counter in the style of the Diagnostic Pursuit
 * hint box. Tapping it explains the tag.
 * Yazan 2026-11-12: renamed On duty / Play and learn / Party time, and a tap explains all three in one pop-up,
 * the tapped one first. Party time is the pass-the-phone group games (Imposter, Tilt & Tell, Sketch It).
 */
export type GameKind = 'learn' | 'both' | 'play';

const KIND: Record<string, GameKind> = {
  'the-diagnostic-pursuit': 'learn',
  'case-files-unsolved': 'learn',
  'the-streak-master': 'learn',
  'nova-crossword': 'learn',
  'nova-password': 'play',
  'code-clinic': 'play',
  imposter: 'play',
  'tilt-and-tell': 'play',
  'four-of-a-kind': 'both',
  'spot-the-flaw': 'learn', // On duty, at the end of it (Yazan 2026-11-15)
  'trace-the-treatment': 'learn',
  'who-am-i': 'both', // Play and learn (Yazan 2026-11-17)
  'put-in-order': 'both', // Play and learn (Yazan 2026-11-18)
  'the-silent-artist': 'play',
  'nova-medicordle': 'both',
  'the-riddler': 'both',
  'the-wheels-of-chaos': 'both', // Play and learn (Yazan 2026-11-15)
  'the-conqueror': 'both',
};

// Three colours that stay clear of the navy page (Yazan: green, not blue, for Learn).
const LOOK: Record<GameKind, { label: string; color: string; text: string }> = {
  learn: {
    label: tr('On duty'),
    color: '#34d399',
    text: tr('Learning first. Every miss goes to Today\'s review on Learn.'),
  },
  both: {
    label: tr('Play and learn'),
    color: '#f59e0b',
    text: tr('Fun first, medicine along the way. Results link each answer to its dossier.'),
  },
  play: {
    label: tr('Party time'),
    color: '#f472b6',
    text: tr('Group games on one phone with friends. Nothing goes to review.'),
  },
};
const ORDER: GameKind[] = ['learn', 'both', 'play'];

/**
 * What a game asks about (Yazan 2026-11-17, additions point 8): a second tag beside the one above. Mixed is given only
 * where the bank really holds both (counted 2026-11-17: basic science is 22% of Four of a Kind up to 62% of Crossword).
 * Spot the Flaw is Mixed since its basic science bank (8 fields, 320 cases) went in on 2026-11-18.
 */
export type Knowledge = 'clinical' | 'basic' | 'mixed';
const KNOW: Record<string, Knowledge> = {
  'the-diagnostic-pursuit': 'clinical',
  'trace-the-treatment': 'clinical',
  'who-am-i': 'basic',
  'put-in-order': 'basic',
  'case-files-unsolved': 'clinical',
  'the-riddler': 'clinical',
  'spot-the-flaw': 'mixed',
  'the-streak-master': 'mixed',
  'four-of-a-kind': 'mixed',
  'nova-medicordle': 'mixed',
  'the-wheels-of-chaos': 'mixed',
  'nova-crossword': 'mixed',
  'the-silent-artist': 'mixed',
  'tilt-and-tell': 'mixed',
  imposter: 'mixed',
};
const KNOW_LOOK: Record<Knowledge, { label: string; color: string; text: string }> = {
  clinical: { label: tr('Clinical subjects'), color: '#e6cf9f', text: tr('Diseases, patients and treatment: the wards and the clinic.') },
  basic: { label: tr('Basic sciences'), color: '#a78bfa', text: tr('Anatomy, physiology, biochemistry and the rest of the first years.') },
  mixed: { label: tr('Mixed knowledge'), color: '#22d3ee', text: tr('Both: clinical subjects and basic sciences in one game.') },
};
const KNOW_ORDER: Knowledge[] = ['clinical', 'basic', 'mixed'];
/** A game's knowledge tag label and colour. */
export const knowOf = (game: string) => (KNOW[game] ? KNOW_LOOK[KNOW[game]] : null);
/** Opens the knowledge tags pop-up on the game's one. */
export const openKnowSheet = (game: string) => KNOW[game] && useTagSheet.setState({ kind: KNOW[game] });

/** Where a game's tag sits in the Games list: On duty, then Play and learn, then Party time (Yazan 2026-11-13). */
export const tagRank = (game: string) => (KIND[game] ? ORDER.indexOf(KIND[game]) : ORDER.length);
/** A game's tag label and colour, for the Games list boxes. */
/** Party time games can't be challenged (Yazan 2026-11-22). */
export const isParty = (game: string) => KIND[game] === 'play';

export const tagOf = (game: string) => (KIND[game] ? LOOK[KIND[game]] : null);
/** Opens the tags pop-up on one kind. */
export const openTagSheet = (game: string) => KIND[game] && useTagSheet.setState({ kind: KIND[game] });

const alpha = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

const useTagSheet = create<{ kind: GameKind | Knowledge | null }>(() => ({ kind: null }));

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
      accessibilityLabel={tr('{label}: what this means', { label })}>
      <Text style={[s.t, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** All three tags of the tapped set (what a game is for, or what it asks about) in one pop-up, the tapped one first. */
export function GameTagSheet() {
  const t = useTheme();
  const kind = useTagSheet((x) => x.kind);
  const close = () => useTagSheet.setState({ kind: null });
  const know = (KNOW_ORDER as string[]).includes(kind ?? '');
  const set: string[] = know ? KNOW_ORDER : ORDER;
  const looks = (know ? KNOW_LOOK : LOOK) as Record<string, { label: string; color: string; text: string }>;
  const order = kind ? [kind, ...set.filter((k) => k !== kind)] : set;
  return (
    <Sheet open={!!kind} onClose={close}>
      {kind ? (
        <View style={s.body}>
          {order.map((k) => {
            const look = looks[k];
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
            <Text style={[s.okT, { color: t.fg }]}>{tr('Got it')}</Text>
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
