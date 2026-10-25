import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { tapped } from '@/lib/sound';

import { Btn, Card, GameScreen, Kick, RoundBtn } from '../shell/ui';
import type { RoundSummary } from './engine/types';

// Imposter's screens in the app look (IM1), dark only. Shared by Pass the phone and Online.

export const IC = { good: '#3fc58a', bad: '#ff5c6c', warn: '#f0b54a' };

export type Person = { id: string; name: string; color?: string };

/** The game page: round counter and category on top, the pause button, then the phase's own body. */
export function ImposterScreen({ round, rounds, category, onPause, children, bottom }: { round: number; rounds: number; category?: string | null; onPause: () => void; children: ReactNode; bottom?: ReactNode }) {
  const t = useTheme();
  return (
    <GameScreen scroll bottom={bottom}>
      <View style={s.top}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Kick>{`Round ${round} of ${rounds}`}</Kick>
          {category ? (
            <Text style={[s.cat, { color: t.white }]} numberOfLines={1}>
              {category}
            </Text>
          ) : null}
        </View>
        <RoundBtn label="Pause" glyph="❚❚" onPress={onPause} />
      </View>
      {children}
    </GameScreen>
  );
}

/** Big name of whoever holds the phone now. */
export function Holder({ lead, person, sub }: { lead: string; person: Person; sub?: string }) {
  const t = useTheme();
  return (
    <View style={s.holder}>
      <Kick>{lead}</Kick>
      <Text style={[s.name, { color: person.color ?? t.accent }]} numberOfLines={1}>
        {person.name}
      </Text>
      {sub ? <Text style={[s.sub, { color: t.mute }]}>{sub}</Text> : null}
    </View>
  );
}

/** Hold to view: the word shows only while the finger is down (offline word reveal and the guess check). */
export function HoldWord({ word, label = 'Hold to see your word', onSeen, small }: { word: string; label?: string; onSeen?: () => void; small?: boolean }) {
  const t = useTheme();
  const [on, setOn] = useState(false);
  return (
    <Pressable
      onPressIn={() => {
        setOn(true);
        onSeen?.();
      }}
      onPressOut={() => setOn(false)}
      style={[s.hold, small ? { minHeight: u(96) } : null, { borderColor: on ? t.accent : t.panelLine, backgroundColor: t.panel }]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      {on ? (
        <Text style={[s.word, { color: t.white }]} adjustsFontSizeToFit numberOfLines={2}>
          {word}
        </Text>
      ) : (
        <>
          <Text style={[s.holdG, { color: t.accent }]}>◉</Text>
          <Text style={[s.holdT, { color: t.soft }]}>{label}</Text>
          <Text style={[s.holdS, { color: t.dim }]}>Keep it hidden from the others</Text>
        </>
      )}
    </Pressable>
  );
}

/** A big clock for the discussion and the redemption. */
export function BigClock({ ms, warnAt = 10_000 }: { ms: number; warnAt?: number }) {
  const t = useTheme();
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const txt = sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec}`;
  return <Text style={[s.clock, { color: ms <= warnAt ? IC.warn : t.white }]}>{txt}</Text>;
}

/** Players as tappable tiles, with live vote counts. */
export function PlayerTiles({ people, votes, pickable, onPick, mark }: { people: Person[]; votes?: Record<string, number>; pickable?: (id: string) => boolean; onPick?: (id: string) => void; mark?: Record<string, string> }) {
  const t = useTheme();
  return (
    <View style={s.tiles}>
      {people.map((p) => {
        const can = !!onPick && (pickable?.(p.id) ?? true);
        const n = votes?.[p.id] ?? 0;
        return (
          <Pressable
            key={p.id}
            disabled={!can}
            onPress={tapped(() => onPick?.(p.id))}
            style={[s.tile, { borderColor: can ? (p.color ?? t.panelLine) : t.chipLine, backgroundColor: can ? t.panel : t.chip, opacity: can || !onPick ? 1 : 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel={`Vote for ${p.name}`}>
            <View style={[s.dot, { backgroundColor: p.color ?? t.soft }]} />
            <Text style={[s.tileT, { color: t.fg }]} numberOfLines={1}>
              {p.name}
            </Text>
            {mark?.[p.id] ? <Text style={[s.mark, { color: t.mute }]}>{mark[p.id]}</Text> : null}
            {n ? (
              <View style={[s.badge, { backgroundColor: IC.bad }]}>
                <Text style={s.badgeT}>{n}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** The two choices after turn 2, one player at a time. */
export function DecisionButtons({ onVote, onExtra }: { onVote: () => void; onExtra: () => void }) {
  return (
    <View style={{ gap: u(8) }}>
      <Btn label="Vote now" onPress={onVote} />
      <Ghostish label="One more turn" onPress={onExtra} />
    </View>
  );
}

function Ghostish({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={tapped(onPress)} style={[s.ghost, { borderColor: t.accent }]} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[s.ghostT, { color: t.accent }]}>{label}</Text>
    </Pressable>
  );
}

/** Round result: both words, who the imposter was, every vote, the points, then the totals. */
export function RoundResult({ sum, people, totals }: { sum: RoundSummary; people: Person[]; totals: { id: string; score: number }[] }) {
  const t = useTheme();
  const by = new Map(people.map((p) => [p.id, p]));
  const imp = by.get(sum.imposterId);
  const head =
    sum.outcome === 'imposter-disconnected'
      ? 'The imposter left'
      : sum.outcome === 'caught'
        ? sum.redemptionCorrect
          ? 'Caught, but they guessed the word'
          : 'Caught'
        : 'The imposter got away';
  return (
    <Animated.View entering={FadeIn.duration(220)} style={{ gap: u(12) }}>
      <Card style={{ alignItems: 'center' }}>
        <Kick color={sum.outcome === 'not-caught' ? IC.bad : IC.good}>{head}</Kick>
        <Text style={[s.impName, { color: imp?.color ?? t.accent }]}>{imp?.name ?? '?'}</Text>
        <Text style={[s.sub, { color: t.mute }]}>was the imposter</Text>
        <View style={s.words}>
          <View style={s.wordCol}>
            <Text style={[s.wordK, { color: t.dim }]}>EVERYONE ELSE</Text>
            <Text style={[s.wordV, { color: t.white }]}>{sum.majorityWord}</Text>
          </View>
          <View style={[s.vline, { backgroundColor: t.panelLine }]} />
          <View style={s.wordCol}>
            <Text style={[s.wordK, { color: t.dim }]}>IMPOSTER</Text>
            <Text style={[s.wordV, { color: IC.bad }]}>{sum.imposterWord}</Text>
          </View>
        </View>
      </Card>
      <Card>
        <Kick>Votes and points</Kick>
        {people.map((p) => {
          const v = sum.votes[p.id];
          const d = sum.deltas[p.id] ?? 0;
          return (
            <View key={p.id} style={s.row}>
              <View style={[s.dot, { backgroundColor: p.color ?? t.soft }]} />
              <Text style={[s.rowN, { color: t.fg }]} numberOfLines={1}>
                {p.name}
                {p.id === sum.imposterId ? '  (imposter)' : ''}
              </Text>
              <Text style={[s.rowV, { color: v === sum.imposterId ? IC.good : t.mute }]} numberOfLines={1}>
                {v ? `→ ${by.get(v)?.name ?? '?'}` : 'no vote'}
              </Text>
              <Text style={[s.rowP, { color: d ? IC.good : t.dim }]}>{d ? `+${d}` : '0'}</Text>
            </View>
          );
        })}
      </Card>
      <Card>
        <Kick>Totals</Kick>
        {[...totals]
          .sort((a, b) => b.score - a.score)
          .map((x) => {
            const p = by.get(x.id);
            return (
              <View key={x.id} style={s.row}>
                <View style={[s.dot, { backgroundColor: p?.color ?? t.soft }]} />
                <Text style={[s.rowN, { color: t.fg }]}>{p?.name ?? '?'}</Text>
                <Text style={[s.rowP, { color: t.white }]}>{x.score}</Text>
              </View>
            );
          })}
      </Card>
    </Animated.View>
  );
}

/** The last turn's clues, shown again at the decision, the vote and the redemption. */
export function ClueList({ clues, people }: { clues: { playerId: string; text: string | null }[]; people: Person[] }) {
  const t = useTheme();
  const by = new Map(people.map((p) => [p.id, p]));
  return (
    <Card>
      <Kick>Last turn&apos;s clues</Kick>
      {clues.map((c, i) => (
        <View key={`${c.playerId}${i}`} style={s.row}>
          <View style={[s.dot, { backgroundColor: by.get(c.playerId)?.color ?? t.soft }]} />
          <Text style={[s.rowN, { color: t.mute }]}>{by.get(c.playerId)?.name ?? '?'}</Text>
          <Text style={[s.rowV, { color: t.white }]}>{c.text ?? '—'}</Text>
        </View>
      ))}
    </Card>
  );
}

export const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: u(10) },
  cat: { fontFamily: F.display, fontSize: u(22), lineHeight: u(26), marginTop: u(2) },
  holder: { alignItems: 'center', gap: u(4), paddingVertical: u(8) },
  name: { fontFamily: F.display, fontSize: u(30), lineHeight: u(34), textAlign: 'center' },
  sub: { fontFamily: F.body, fontSize: u(11.5), lineHeight: u(16), textAlign: 'center' },
  hold: { borderRadius: u(22), borderWidth: 1, minHeight: u(190), alignItems: 'center', justifyContent: 'center', padding: u(18), gap: u(6) },
  holdG: { fontSize: u(30), lineHeight: u(34) },
  holdT: { fontFamily: F.bodySemi, fontSize: u(13), lineHeight: u(17) },
  holdS: { fontFamily: F.body, fontSize: u(10), lineHeight: u(13) },
  word: { fontFamily: F.display, fontSize: u(30), lineHeight: u(34), textAlign: 'center' },
  clock: { fontFamily: F.display, fontSize: u(56), lineHeight: u(62), textAlign: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8) },
  tile: { width: '48%', flexGrow: 1, borderRadius: u(16), borderWidth: 1, paddingVertical: u(14), paddingHorizontal: u(12), flexDirection: 'row', alignItems: 'center', gap: u(8) },
  tileT: { flex: 1, fontFamily: F.bodySemi, fontSize: u(13), lineHeight: u(16) },
  mark: { fontFamily: F.mono, fontSize: u(9) },
  badge: { minWidth: u(20), height: u(20), borderRadius: u(10), alignItems: 'center', justifyContent: 'center', paddingHorizontal: u(5) },
  badgeT: { fontFamily: F.bodyBold, fontSize: u(10.5), color: '#fff' },
  dot: { width: u(9), height: u(9), borderRadius: u(5) },
  ghost: { borderRadius: u(14), borderWidth: 1, paddingVertical: u(10), alignItems: 'center' },
  ghostT: { fontFamily: F.bodyBold, fontSize: u(12.5), lineHeight: u(15) },
  impName: { fontFamily: F.display, fontSize: u(28), lineHeight: u(32), marginTop: u(4) },
  words: { flexDirection: 'row', alignSelf: 'stretch', marginTop: u(10), gap: u(10) },
  wordCol: { flex: 1, alignItems: 'center', gap: u(4) },
  wordK: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.2) },
  wordV: { fontFamily: F.bodyBold, fontSize: u(14), lineHeight: u(18), textAlign: 'center' },
  vline: { width: 1, alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(8), paddingVertical: u(3) },
  rowN: { flex: 1, fontFamily: F.bodySemi, fontSize: u(12), lineHeight: u(16) },
  rowV: { fontFamily: F.body, fontSize: u(12), lineHeight: u(16), maxWidth: '45%' },
  rowP: { fontFamily: F.mono, fontSize: u(11.5), minWidth: u(24), textAlign: 'right' },
});
