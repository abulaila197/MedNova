import { useEffect } from 'react';
import { type StyleProp, type TextStyle } from 'react-native';

import { Text } from '@/components/AppText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { isPlatinumTitle, titleName } from './catalog';
import { useLook, wantLooks } from './useStyle';

/** Platinum titles read in platinum, every other title in the accent. */
export const titleColor = (mode: 'dark' | 'light', key: string | undefined, accent: string) =>
  isPlatinumTitle(key) ? (mode === 'light' ? '#6f7f96' : '#dfe8f3') : accent;

/**
 * A player's title, shown only in four places (Yazan 2026-10-13): the Profile header, the player card, the winner's
 * line on results and under names in online lobby seats.
 */
export function PlayerTitle({ userId, size = 12, style, accent, mode }: { userId?: string | null; size?: number; style?: StyleProp<TextStyle>; accent?: string; mode?: 'dark' | 'light' }) {
  const t = useTheme();
  useEffect(() => {
    if (userId) wantLooks([userId]);
  }, [userId]);
  const look = useLook(userId);
  if (!userId) return null;
  return (
    <Text style={[{ fontFamily: F.displayItalic, fontSize: u(size), lineHeight: u(size * 1.3), color: titleColor(mode ?? t.mode, look.title, accent ?? t.accent) }, style]} numberOfLines={1}>
      {titleName(look.title)}
    </Text>
  );
}

/** The sole winner's account, if they have one: online seats carry it; offline and solo, seat 0 is the phone owner. */
export function winnerAccount(play: { mode: string; standings: { seat: number; rank: number }[]; seats: { seat: number; userId?: string | null }[] }, me: string | null) {
  const top = play.standings.filter((r) => r.rank === 1);
  if (top.length !== 1 || play.standings.length < 2) return null;
  const seat = top[0].seat;
  return (play.mode === 'online' ? play.seats.find((x) => x.seat === seat)?.userId : seat === 0 ? me : null) ?? null;
}

/**
 * Whose win effect plays on these results (Yazan 2026-10-13: Online, Solo and Pass the phone), only as the game
 * just ended so reopening old results stays quiet. Online: the sole winner. Pass the phone: you, when your seat
 * (the phone owner) is the sole winner. Solo: you, after any game that scored.
 */
export function effectWinner(
  play: { mode: string; score: number; endedAt: number | null; standings: { seat: number; rank: number }[]; seats: { seat: number; userId?: string | null }[] },
  me: string | null,
) {
  if (!play.endedAt || Date.now() - play.endedAt > 60_000) return null;
  if (play.mode === 'solo') return play.score > 0 ? me : null;
  return winnerAccount(play, me);
}
