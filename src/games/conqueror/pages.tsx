// The Conqueror's match pages in the Ink Atlas look. Each page draws one phase of the match from the server's
// state and sends only this player's actions.
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';


import { AT, Btn, CardTile, v, Chip, CZ, CZM, CG, CGI, KINGDOMS, PieceIcon, ROMAN, Rule, T, Top } from './atlas';
import { MapChart, troopLabel, type Arrow, type LandView } from './AtlasMap';
import { BALANCE, CARDS, landsOf, maxMoves, type CardType, type Match, type Move } from './core';
import type { AtlasMap } from './map';
import { useScreen } from '@/theme/scale';

export type Act = (a: Record<string, unknown>) => void;
type PageProps = { m: Match; me: string; map: AtlasMap; seconds: number | null; act: Act };

export const seatOf = (m: Match, id: string | null) => (id == null ? null : m.order.indexOf(id));
export const colorOf = (m: Match, id: string) => KINGDOMS[Math.max(0, m.order.indexOf(id)) % KINGDOMS.length];
export const stageLine = (m: Match) => `Stage ${ROMAN[m.stage - 1] ?? m.stage} of ${ROMAN[BALANCE.MAX_STAGES - 1]}`;
const nameOf = (m: Match, id: string, me: string) => (id === me ? 'You' : m.players[id]?.name ?? 'Player');
const fmt = (n: number) => n.toLocaleString('en-US');

/** What the map shows for each land. Hidden troops (Hide troops) read "?" to everyone but their owner. */
export function landViews(m: Match, me: string, pending: Move[] = []): Record<string, LandView> {
  const out: Record<string, LandView> = {};
  for (const id of m.landOrder) {
    const l = m.lands[id];
    const mine = l.owner === me;
    let troops = l.troops;
    if (mine) for (const mv of pending) if (mv.from === id) troops -= mv.troops;
    out[id] = { seat: seatOf(m, l.owner), capital: l.capital, troops: l.hidden && !mine ? '?' : troopLabel(troops), shielded: l.shielded && mine, trapped: l.trapped && mine };
  }
  return out;
}

/** The row of players: kingdom dot, name and lands held. */
export function Players({ m, me, mark }: { m: Match; me: string; mark?: (id: string) => string | undefined }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: v(6), paddingHorizontal: v(4) }}>
      {m.order.map((id) => (
        <Chip key={id} color={colorOf(m, id)} name={nameOf(m, id, me)} count={landsOf(m, id).length} dim={m.players[id].out} mark={mark?.(id)} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- solo pick: the 60-tile board

export function BoardPage({ m, me, seconds, act }: PageProps) {
  const [pick, setPick] = useState<number | null>(null);
  const mineTaken = m.solo[me]?.tile ?? null;
  const done = mineTaken != null;
  const picked = (id: string) => (m.solo[id] ? '✓' : undefined);
  return (
    <>
      <Top kicker={stageLine(m)} title={`Solo round ${ROMAN[m.round - 1]}`} line={`Pick a number. ${BALANCE.TILES - BALANCE.CARD_TILES} questions, ${BALANCE.CARD_TILES} cards hide behind them.`} seconds={seconds} />
      <View style={s.grid}>
        {m.board.map((t) => {
          const by = t.by;
          const on = !done && pick === t.n;
          const mine = by === me;
          return (
            <Pressable
              key={t.n}
              disabled={!!by || done}
              onPress={() => setPick(t.n)}
              accessibilityRole="button"
              accessibilityLabel={by ? `Number ${t.n}, taken by ${nameOf(m, by, me)}` : `Number ${t.n}`}
              accessibilityState={{ selected: on, disabled: !!by || done }}
              style={[s.seal, on || mine ? s.sealOn : null, by && !mine ? s.sealTaken : null]}
            >
              {by ? <PieceIcon color={colorOf(m, by)} size={17} /> : <T f={CZ} size={12.5} color={on ? AT.cream : AT.ink} style={{ lineHeight: v(15) }}>{String(t.n)}</T>}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: v(12) }}>
        {m.order.filter((id) => !m.players[id].out).map((id) => (
          <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: v(4) }}>
            <View style={{ width: v(9), height: v(9), borderRadius: v(5), backgroundColor: colorOf(m, id) }} />
            <T f={CG} size={13.5}>{`${nameOf(m, id, me)}${picked(id) ? ' ✓' : ''}`}</T>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      {done ? (
        <T f={CGI} size={16} color={AT.soft} style={{ textAlign: 'center', paddingBottom: v(14) }}>{`You took number ${mineTaken}. Waiting for the others…`}</T>
      ) : (
        <View style={{ flexDirection: 'row' }}>
          <Btn label={pick ? `Take number ${pick}` : 'Pick a number'} disabled={!pick} onPress={() => pick && act({ type: 'pick', tile: pick })} />
        </View>
      )}
    </>
  );
}

// ---------------------------------------------------------------- the Gap: troop moves on the map

type Draft = { from: string | null; to: string | null };

export function MovesPage({ m, me, map, seconds, act }: PageProps) {
  const { width } = useScreen();
  const p = m.players[me];
  const sent = m.gap.moves[me];
  const [moves, setMoves] = useState<Move[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [amount, setAmount] = useState<number>(BALANCE.MIN_MOVE_TROOPS);
  const limit = maxMoves(m, me);
  const shown = sent ?? moves;
  const usedReserve = shown.filter((x) => x.from === null).reduce((a, x) => a + x.troops, 0);
  const reserve = p.reserve - usedReserve;
  const views = useMemo(() => landViews(m, me, shown), [m, me, shown]);
  const available = (from: string | null) => (from === null ? reserve : m.lands[from].troops - shown.filter((x) => x.from === from).reduce((a, x) => a + x.troops, 0));
  const ally = p.ally;
  const reinforce = p.cards.filter((c) => c === 'reinforcements').length - shown.filter((x) => x.reinforce).length;

  const tapLand = (id: string) => {
    if (sent || shown.length >= limit) return;
    const l = m.lands[id];
    if (!draft) {
      if (l.owner === me) setDraft({ from: id, to: null });
      return;
    }
    if (draft.from === id) return setDraft(null);
    if (l.owner && l.owner !== me && l.owner === ally) return;
    const max = available(draft.from);
    setDraft({ ...draft, to: id });
    setAmount(Math.min(max, Math.max(BALANCE.MIN_MOVE_TROOPS, Math.floor(max / 2 / 1000) * 1000)));
  };
  const fromReserve = () => {
    if (sent || shown.length >= limit || reserve < BALANCE.MIN_MOVE_TROOPS) return;
    setDraft({ from: null, to: null });
  };
  const confirm = (boost: boolean) => {
    if (!draft?.to) return;
    setMoves([...moves, { from: draft.from, to: draft.to, troops: amount, ...(boost ? { reinforce: true } : null) }]);
    setDraft(null);
  };
  const arrows: Arrow[] = shown.map((x) => ({ from: x.from, to: x.to, label: troopLabel(x.reinforce ? Math.round(x.troops * 1.5) : x.troops) }));
  if (draft?.to) arrows.push({ from: draft.from, to: draft.to, label: troopLabel(amount), color: '#b0503f' });
  const landName = (id: string | null) => (id === null ? 'Reserve' : m.lands[id].owner === me ? (m.lands[id].capital ? 'Your capital' : 'Your outpost') : `${m.lands[id].owner ? nameOf(m, m.lands[id].owner!, me) : 'Free'}’s ${m.lands[id].capital ? 'capital' : 'land'}`.replace('Free’s land', 'Free land'));
  const max = draft ? available(draft.from) : 0;

  return (
    <>
      <Top kicker={stageLine(m)} title="The Gap" line="Troop moves" seconds={seconds} />
      <Players m={m} me={me} mark={(id) => (m.gap.ready.includes(id) ? '✓' : undefined)} />
      <MapChart map={map} lands={views} width={width - v(28)} selected={draft?.from ?? null} arrows={arrows} onLand={sent ? undefined : tapLand} />
      <View style={s.panel}>
        <Pressable onPress={fromReserve} accessibilityRole="button" accessibilityLabel="Move troops from your reserve" style={[s.res, draft && draft.from === null ? { borderColor: AT.red } : null]}>
          <T f={CZM} size={9} color={AT.soft} style={{ letterSpacing: v(1.4) }}>RESERVE</T>
          <T f={CZ} size={18} style={{ fontVariant: ['tabular-nums'] }}>{fmt(reserve)}</T>
        </Pressable>
        <View style={s.res0}>
          <T f={CZM} size={9} color={AT.soft} style={{ letterSpacing: v(1.4) }}>MOVES</T>
          <T f={CZ} size={18}>
            {String(shown.length)}
            <T f={CGI} size={14} color={AT.soft}>{' of '}</T>
            {String(limit)}
          </T>
        </View>
        <View style={{ flexDirection: 'row', gap: v(6), marginLeft: 'auto' }}>
          {p.cards.slice(0, 3).map((c, i) => <CardTile key={`${c}${i}`} card={c} w={68} />)}
        </View>
      </View>
      {draft?.to ? (
        <View style={{ gap: v(8), paddingHorizontal: v(4) }}>
          <T f={CG} size={15}>{`${landName(draft.from)} → ${landName(draft.to)}`}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: v(10) }}>
            <Step label="−" onPress={() => setAmount(Math.max(BALANCE.MIN_MOVE_TROOPS, amount - 1000))} />
            <T f={CZ} size={20} color={AT.gold} style={{ flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{fmt(amount)}</T>
            <Step label="+" onPress={() => setAmount(Math.min(max, amount + 1000))} />
          </View>
          <View style={{ flexDirection: 'row', gap: v(10) }}>
            <Btn ghost label="Cancel" onPress={() => setDraft(null)} />
            {reinforce > 0 ? <Btn ghost label="+50% card" onPress={() => confirm(true)} /> : null}
            <Btn label="Add move" disabled={max < BALANCE.MIN_MOVE_TROOPS} onPress={() => confirm(false)} />
          </View>
        </View>
      ) : (
        <>
          <View style={{ gap: v(6), paddingHorizontal: v(6) }}>
            {Array.from({ length: limit }, (_, i) => {
              const mv = shown[i];
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'baseline', gap: v(8) }}>
                  <T f={CZ} size={10} color={AT.soft} style={{ letterSpacing: v(1), minWidth: v(52) }}>{`MOVE ${i + 1}`}</T>
                  {mv ? (
                    <>
                      <T f={CG} size={15} style={{ flex: 1 }} lines={1}>{`${landName(mv.from)} → ${landName(mv.to)}`}</T>
                      <T f={CZ} size={13} color={AT.gold}>{fmt(mv.reinforce ? Math.round(mv.troops * 1.5) : mv.troops)}</T>
                    </>
                  ) : (
                    <T f={CGI} size={15} color={AT.soft} style={{ flex: 1, opacity: 0.8 }}>
                      {draft ? 'Now tap a land to attack or strengthen' : i === shown.length ? 'Tap one of your lands or the reserve, then a target' : 'Free'}
                    </T>
                  )}
                </View>
              );
            })}
          </View>
          <View style={{ flex: 1 }} />
          {sent ? (
            <T f={CGI} size={16} color={AT.soft} style={{ textAlign: 'center', paddingBottom: v(14) }}>Orders sealed. Waiting for the others…</T>
          ) : (
            <View style={{ flexDirection: 'row', gap: v(10) }}>
              <Btn ghost label="Undo move" disabled={!moves.length && !draft} onPress={() => (draft ? setDraft(null) : setMoves(moves.slice(0, -1)))} />
              <Btn label="Ready" onPress={() => act({ type: 'moves', moves })} />
            </View>
          )}
        </>
      )}
    </>
  );
}

function Step({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label === '+' ? 'More troops' : 'Fewer troops'} style={s.step}>
      <T f={CZ} size={20} style={{ lineHeight: v(22) }}>{label}</T>
    </Pressable>
  );
}

export const cardName = (c: CardType) => CARDS[c].name;

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: v(11), rowGap: v(7), width: v(6 * 41 + 5 * 11), alignSelf: 'center' },
  seal: {
    width: v(41), height: v(41), borderRadius: v(20.5), alignItems: 'center', justifyContent: 'center', backgroundColor: '#efdfb6',
    borderWidth: 1.5, borderColor: 'rgba(59,36,18,0.55)', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: v(2), shadowOffset: { width: 0, height: v(1.5) }, elevation: 2,
  },
  sealTaken: { backgroundColor: '#d9c290', opacity: 0.88 },
  sealOn: { backgroundColor: AT.red, borderColor: AT.cream, borderWidth: 2 },
  panel: { flexDirection: 'row', alignItems: 'center', gap: v(10), paddingVertical: v(9), paddingHorizontal: v(6), borderTopWidth: 1, borderBottomWidth: 1, borderColor: AT.line },
  res: { paddingHorizontal: v(6), paddingVertical: v(3), borderRadius: v(6), borderWidth: 1, borderColor: 'transparent' },
  res0: { paddingHorizontal: v(4) },
  step: { width: v(44), height: v(40), borderRadius: v(6), borderWidth: 1.5, borderColor: 'rgba(243,230,198,0.5)', alignItems: 'center', justifyContent: 'center' },
});

export { Rule };
