import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { tapped } from '@/lib/sound';

import { Card as Panel, GameScreen, Kick, RoundBtn } from '../shell/ui';
import type { TeamId, TeamRoundResult } from './engine/types';

// Nova Password's screens in the app look, dark only, with game-show touches: two team colours, a big clock,
// the secret term on a lit plate and a stack of clue chips. Shared by Pass the phone and Online.

export const TEAM: Record<TeamId, { name: string; color: string; deep: string }> = {
  A: { name: 'Coral', color: '#ff7a62', deep: '#3a1c18' },
  B: { name: 'Mint', color: '#4fd1b0', deep: '#0f3029' },
};
const PLATE = { bg: '#f6ecd8', ink: '#2a1d16', faint: '#8a6a55' };
const GREEN = '#4fd1b0';
const RED = '#ff7a62';

export const clock = (ms: number) => {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

/** The screen with the two teams' pills on top (the playing team lit) and the pause button. */
export function PasswordScreen({ turn, pills, onPause, children, bottom }: { turn: TeamId | null; pills: Record<TeamId, string>; onPause: () => void; children: ReactNode; bottom?: ReactNode }) {
  const t = useTheme();
  return (
    <GameScreen scroll bottom={bottom}>
      <View style={s.top}>
        <View style={s.score}>
          {(['A', 'B'] as const).map((tm) => (
            <View key={tm} style={[s.pill, { borderColor: turn === tm ? TEAM[tm].color : t.chipLine, backgroundColor: turn === tm ? TEAM[tm].deep : t.chip }]}>
              <View style={[s.dot, { backgroundColor: TEAM[tm].color }]} />
              <Text style={[s.pillT, { color: t.white }]} numberOfLines={1}>
                {`${TEAM[tm].name} ${pills[tm]}`}
              </Text>
            </View>
          ))}
        </View>
        <RoundBtn label="Pause" glyph="❚❚" onPress={onPause} />
      </View>
      {children}
    </GameScreen>
  );
}

export function TeamHead({ team, lead, sub }: { team: TeamId; lead: string; sub?: string }) {
  const t = useTheme();
  return (
    <View style={s.head}>
      <Kick>{lead}</Kick>
      <Text style={[s.headT, { color: TEAM[team].color }]} numberOfLines={1}>
        {`${TEAM[team].name} team`}
      </Text>
      {sub ? <Text style={[s.sub, { color: t.mute }]}>{sub}</Text> : null}
    </View>
  );
}

/** The game-show clock: big, amber in the last 20 seconds. */
export function Clock({ ms }: { ms: number }) {
  const t = useTheme();
  return <Text style={[s.clock, { color: ms <= 20_000 ? '#f0b54a' : t.white }]}>{clock(ms)}</Text>;
}

/** The secret term on a lit plate, with its forbidden words under it. */
export function Plate({ term, category, forbidden, team }: { term: string; category?: string; forbidden?: readonly string[]; team: TeamId }) {
  const t = useTheme();
  return (
    <View style={[s.plateWrap, { borderColor: TEAM[team].color, shadowColor: TEAM[team].color }]}>
      <View style={s.bulbs}>
        {Array.from({ length: 9 }, (_, i) => (
          <View key={i} style={[s.bulb, { backgroundColor: i % 2 ? TEAM[team].color : '#ffe2a8' }]} />
        ))}
      </View>
      <View style={s.plate}>
        {category ? <Text style={[s.cat, { color: PLATE.faint }]}>{category.toUpperCase()}</Text> : null}
        <Text style={[s.term, { color: PLATE.ink, fontSize: u(term.length > 22 ? 19 : term.length > 14 ? 23 : 28), lineHeight: u(term.length > 22 ? 24 : term.length > 14 ? 28 : 33) }]}>{term}</Text>
      </View>
      {forbidden?.length ? (
        <View style={s.forb}>
          <Text style={[s.forbK, { color: t.mute }]}>DON&apos;T SAY</Text>
          <View style={s.forbRow}>
            {forbidden.map((w) => (
              <View key={w} style={[s.forbChip, { borderColor: 'rgba(255,122,98,0.45)' }]}>
                <Text style={[s.forbT, { color: '#ffb3a4' }]}>{w}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** The stack of clue chips for the current word, and the team's total. */
export function ClueStack({ count, total, team, word, words }: { count: number; total: number; team: TeamId; word: number; words: number }) {
  const t = useTheme();
  return (
    <View style={s.stackRow}>
      <View style={{ flex: 1 }}>
        <Text style={[s.small, { color: t.mute }]}>{`Clues on this word: ${count}`}</Text>
        <View style={s.chips}>
          {Array.from({ length: Math.min(count, 14) }, (_, i) => (
            <View key={i} style={[s.chip, { backgroundColor: TEAM[team].color, marginLeft: i ? -u(6) : 0 }]} />
          ))}
          {count > 14 ? <Text style={[s.small, { color: t.white, marginLeft: u(4) }]}>{`+${count - 14}`}</Text> : null}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[s.small, { color: t.mute }]}>{`Word ${word} of ${words}`}</Text>
        <Text style={[s.total, { color: t.white }]}>{`${total} ${total === 1 ? 'clue' : 'clues'}`}</Text>
      </View>
    </View>
  );
}

/** A big square game-show button. */
export function ShowBtn({ label, sub, color, onPress, disabled, flex = 1 }: { label: string; sub?: string; color: string; onPress: () => void; disabled?: boolean; flex?: number }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [s.show, { flex, borderColor: color, backgroundColor: pressed ? color : 'rgba(255,255,255,0.04)', opacity: disabled ? 0.35 : 1 }]}
    >
      {({ pressed }) => (
        <>
          <Text style={[s.showT, { color: pressed ? '#111' : color }]}>{label}</Text>
          {sub ? <Text style={[s.showS, { color: pressed ? '#111' : 'rgba(255,255,255,0.6)' }]}>{sub}</Text> : null}
        </>
      )}
    </Pressable>
  );
}
export const SHOW = { green: GREEN, red: RED };

/** Two teams of two: tap a name, then a name on the other team, to swap them; the star picks the clue giver. */
export function TeamPicker({
  teams,
  givers,
  picked,
  nameOf,
  onPick,
  onGiver,
}: {
  teams: Record<TeamId, string[]>;
  givers: Record<TeamId, string | null>;
  picked: string | null;
  nameOf: (id: string) => string;
  onPick: (id: string) => void;
  onGiver: (team: TeamId, id: string) => void;
}) {
  const t = useTheme();
  return (
    <>
      {(['A', 'B'] as const).map((team) => (
        <Panel key={team} style={{ borderColor: TEAM[team].color }}>
          <Kick color={TEAM[team].color}>{`${TEAM[team].name} team`}</Kick>
          {teams[team].map((id) => {
            const giver = givers[team] === id;
            return (
              <View key={id} style={[s.row, picked === id && { backgroundColor: TEAM[team].deep, borderRadius: u(8) }]}>
                <Pressable onPress={tapped(() => onGiver(team, id))} accessibilityRole="button" accessibilityLabel={`Make ${nameOf(id)} the clue giver`} hitSlop={8}>
                  <Text style={{ fontSize: u(16), lineHeight: u(20), color: giver ? TEAM[team].color : t.dim }}>{giver ? '★' : '☆'}</Text>
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={tapped(() => onPick(id))} accessibilityRole="button" accessibilityLabel={`Swap ${nameOf(id)}`}>
                  <Text style={[s.rowN, { color: t.fg }]} numberOfLines={1}>
                    {nameOf(id)}
                  </Text>
                </Pressable>
                <Text style={[s.tag, { color: giver ? TEAM[team].color : t.dim }]}>{giver ? 'GIVES CLUES' : 'GUESSES'}</Text>
              </View>
            );
          })}
        </Panel>
      ))}
    </>
  );
}

/** One team's words, clues and time, as on the results screen. */
export function ResultRow({ team, r, best }: { team: TeamId; r: TeamRoundResult; best?: boolean }) {
  const t = useTheme();
  return (
    <View style={[s.res, { borderColor: best ? TEAM[team].color : t.chipLine, backgroundColor: best ? TEAM[team].deep : t.chip }]}>
      <View style={[s.dot, { backgroundColor: TEAM[team].color }]} />
      <Text style={[s.rowN, { color: t.white }]}>{`${TEAM[team].name}`}</Text>
      <Stat n={String(r.wordsCompleted)} l="words" />
      <Stat n={String(r.clues)} l="clues" />
      <Stat n={clock(r.timeMs)} l="time" />
    </View>
  );
}
function Stat({ n, l }: { n: string; l: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', minWidth: u(40) }}>
      <Text style={[s.statN, { color: t.white }]}>{n}</Text>
      <Text style={[s.tag, { color: t.dim }]}>{l.toUpperCase()}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  score: { flex: 1, flexDirection: 'row', gap: u(6) },
  pill: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: u(6), borderWidth: 1, borderRadius: u(12), paddingHorizontal: u(10), paddingVertical: u(5) },
  pillT: { fontFamily: F.bodyBold, fontSize: u(11.5), lineHeight: u(14) },
  dot: { width: u(8), height: u(8), borderRadius: u(4) },
  head: { alignItems: 'center', gap: u(3), paddingTop: u(10) },
  headT: { fontFamily: F.display, fontSize: u(28), lineHeight: u(32), textAlign: 'center' },
  sub: { fontFamily: F.body, fontSize: u(11.5), lineHeight: u(16), textAlign: 'center' },
  clock: { fontFamily: F.display, fontSize: u(40), lineHeight: u(44), marginTop: u(4), textAlign: 'center' },
  plateWrap: {
    marginTop: u(8),
    borderWidth: 2,
    borderRadius: u(16),
    padding: u(8),
    backgroundColor: '#141a2e',
    shadowOpacity: 0.55,
    shadowRadius: u(14),
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  bulbs: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: u(6), marginBottom: u(6) },
  bulb: { width: u(7), height: u(7), borderRadius: u(4) },
  plate: { backgroundColor: PLATE.bg, borderRadius: u(10), paddingVertical: u(12), paddingHorizontal: u(10), alignItems: 'center', gap: u(4) },
  cat: { fontFamily: F.mono, fontSize: u(9), letterSpacing: u(1.2) },
  term: { fontFamily: F.display, textAlign: 'center' },
  forb: { marginTop: u(8), alignItems: 'center', gap: u(5) },
  forbK: { fontFamily: F.mono, fontSize: u(9), letterSpacing: u(1.2) },
  forbRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: u(5) },
  forbChip: { borderWidth: 1, borderRadius: u(10), paddingHorizontal: u(8), paddingVertical: u(2) },
  forbT: { fontFamily: F.bodySemi, fontSize: u(11), lineHeight: u(15), textDecorationLine: 'line-through' },
  stackRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: u(12), gap: u(10) },
  chips: { flexDirection: 'row', alignItems: 'center', height: u(22), marginTop: u(4) },
  chip: { width: u(20), height: u(20), borderRadius: u(10), borderWidth: 2, borderColor: '#141a2e' },
  total: { fontFamily: F.display, fontSize: u(20), lineHeight: u(24) },
  small: { fontFamily: F.body, fontSize: u(10.5), lineHeight: u(14) },
  show: { borderWidth: 2, borderRadius: u(14), paddingVertical: u(10), alignItems: 'center', justifyContent: 'center' },
  showT: { fontFamily: F.bodyBold, fontSize: u(15), lineHeight: u(19) },
  showS: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(12) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(8), paddingVertical: u(5), paddingHorizontal: u(4) },
  rowN: { flex: 1, fontFamily: F.bodySemi, fontSize: u(12.5), lineHeight: u(16) },
  tag: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(0.8) },
  res: { flexDirection: 'row', alignItems: 'center', gap: u(8), borderWidth: 1, borderRadius: u(12), paddingHorizontal: u(10), paddingVertical: u(8), marginTop: u(6) },
  statN: { fontFamily: F.bodyBold, fontSize: u(14), lineHeight: u(18) },
});
