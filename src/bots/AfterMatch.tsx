import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { PlayerFace } from '@/features/style/Frame';
import type { Play } from '@/games/engine/types';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { afterMatch, namesOf } from './after';
import { rivalMoment } from './director';
import type { Place } from './lines';
import { loadRivals, useRivals } from './memory';
import { tr } from '@/i18n';

/**
 * Vs rivals results (G4): each rival reacts to how it finished (winners brag, losers want another go), and the card
 * says who asks for a rematch and who is leaving the room.
 */
export function AfterMatch({ play }: { play: Play }) {
  const t = useTheme();
  const favs = useRivals((x) => x.favs);
  const loaded = useRivals((x) => x.loaded);
  useEffect(() => void loadRivals(), []);
  const a = useMemo(() => afterMatch(play, favs), [play, favs]);

  // Fresh results only: reopening old results stays quiet.
  const said = useRef(false);
  useEffect(() => {
    if (!loaded || said.current || !play.endedAt || Date.now() - play.endedAt > 60_000) return;
    const room = `bot:${play.id}`;
    const n = play.standings.length;
    const rank = new Map(play.standings.map((x) => [x.seat, x.rank]));
    const rivals = play.seats.filter((x) => x.bot && !x.removed).sort((x, y) => (rank.get(x.seat) ?? n) - (rank.get(y.seat) ?? n));
    // Each rival reacts in its own time, 2 to 4 s after the results open (never all on the same instant).
    const ids = rivals.map((x) =>
      setTimeout(() => {
        said.current = true;
        const r = rank.get(x.seat) ?? n;
        const place: Place = r === 1 ? 'lead' : r >= n ? 'last' : 'mid';
        rivalMoment(room, x.bot!, 'end', { place, tableSize: n });
      }, 2000 + Math.random() * 2000),
    );
    return () => ids.forEach(clearTimeout);
  }, [loaded, play]);

  if (!a.want.length && !a.leave.length) return null;
  return (
    <View style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
      {a.want.length ? (
        <View style={s.row}>
          <View style={s.faces}>
            {a.want.slice(0, 3).map((b) => (
              <PlayerFace key={b.id} slug={b.character} size={u(20)} still />
            ))}
          </View>
          <Text style={[s.t, { color: t.fg }]}>
            {tr(a.want.length === 1 ? '{names} wants a rematch.' : '{names} want a rematch.', { names: namesOf(a.want) })}
          </Text>
        </View>
      ) : null}
      {a.leave.length ? (
        <View style={s.row}>
          <View style={[s.faces, { opacity: 0.45 }]}>
            {a.leave.map((b) => (
              <PlayerFace key={b.id} slug={b.character} size={u(20)} still />
            ))}
          </View>
          <Text style={[s.t, { color: t.mute }]}>
            {tr(a.leave.length === 1 ? '{names} is leaving. A new rival takes that seat at the rematch.' : '{names} are leaving. New rivals take those seats at the rematch.', { names: namesOf(a.leave) })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: u(14), paddingVertical: u(10), paddingHorizontal: u(12), gap: u(8) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(9), marginEnd: u(30) },
  faces: { flexDirection: 'row', gap: u(3) },
  t: { flex: 1, fontFamily: F.body, fontSize: u(11.5), lineHeight: u(15) },
});
