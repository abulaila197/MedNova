// The Conqueror's question, versus, card, duel and report pages in the Ink Atlas look. Each page draws the
// player's own view of the match (view.ts) and sends only their own actions; the server judges everything.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { AT, Btn, CardTile, CG, CGB, CGI, Chip, CZ, CZM, Kicker, PieceIcon, ROMAN, Rule, T, Top, v } from './atlas';
import { MapChart } from './AtlasMap';
import type { SoloStyle } from './bank';
import { BALANCE, CARDS, landsOf, type CardType, type SoloTurn, type VersusStyle } from './core';
import type { AtlasMap } from './map';
import { colorOf, landViews, Players, stageLine, type Act } from './pages';
import { SECRET, type Hold, type MatchView, type SoloView } from './view';

export type { Hold };


type P = { m: MatchView; me: string; map: AtlasMap; seconds: number | null; act: Act; elapsed: number };

const nameOf = (m: MatchView, id: string) => (id === m.me ? 'You' : m.players[id]?.name ?? 'Player');
const fmt = (n: number) => n.toLocaleString('en-US');
const STYLE_NAME: Record<SoloStyle, string> = { mcq: 'Multiple choice', tf: 'True or false', order: 'Put in order', match: 'Match the pairs' };
export const VERSUS: Record<VersusStyle, { name: string; rule: string }> = {
  closest: { name: 'Closest number', rule: 'Three numbers to guess. The closest guess wins each one.' },
  rush: { name: 'Category rush', rule: 'Name as many answers in the category as you can.' },
  standing: { name: 'Last one standing', rule: 'Two hearts each. A wrong answer, or the slowest right one, costs a heart.' },
  clue: { name: 'Clue ladder', rule: 'A new clue every 8 seconds. Guess early for more points; a wrong guess costs 5.' },
};

// ---------------------------------------------------------------- solo tile

export function SoloPage({ m, me, seconds, act }: P) {
  const turn = m.solo[me];
  const p = m.players[me];
  const [ix, setIx] = useState(0);
  const [picks, setPicks] = useState<(number | boolean | null)[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [pairs, setPairs] = useState<(string | null)[]>([]);
  const [left, setLeft] = useState<number | null>(null);
  const [joker, setJoker] = useState(false);
  const qs = (turn?.questions ?? []) as SoloView[];
  const key = qs.map((q) => q.id).join();
  useEffect(() => {
    setIx(0);
    setPicks([]);
    setOrder([]);
    setPairs([]);
    setLeft(null);
  }, [key]);

  const head = <Top kicker={`${stageLine(m)} · Solo round ${ROMAN[m.round - 1]}`} title={turn?.card ? 'A card!' : turn?.style ? STYLE_NAME[turn.style] : 'Your number'} line={turn ? `Number ${turn.tile}` : undefined} seconds={seconds} />;
  if (!turn) return <>{head}<Waiting text="You sit this round out." /></>;
  if (turn.card)
    return (
      <>
        {head}
        <View style={{ alignItems: 'center', gap: v(14), marginTop: v(30) }}>
          <CardTile card={turn.card} w={130} />
          <T f={CGI} size={17} style={{ textAlign: 'center', maxWidth: v(280) }}>{CARDS[turn.card].text}</T>
          <T f={CG} size={15} color={AT.soft}>It goes into your hand.</T>
        </View>
        <Waiting text="Waiting for the others…" />
      </>
    );
  if (turn.result) return <>{head}<SoloResultCard turn={turn} /><Waiting text="Waiting for the others…" /></>;

  const style = turn.style!;
  const q = qs[ix];
  const canJoker = p.cards.includes('joker') && !picks.length && !order.length && !pairs.some(Boolean);
  const submit = (answers: unknown[]) => act({ type: 'solo', answers });

  let body: React.ReactNode = null;
  if ((style === 'mcq' || style === 'tf') && q) {
    const choose = (a: number | boolean) => {
      const next = [...picks];
      next[ix] = a;
      setPicks(next);
      if (ix < qs.length - 1) setIx(ix + 1);
      else submit(next);
    };
    body = (
      <>
        <Dots n={qs.length} at={ix} />
        <Paper>
          <T f={CG} size={17} color={AT.ink} style={{ lineHeight: v(22) }}>{q.prompt}</T>
        </Paper>
        <View style={{ gap: v(8) }}>
          {q.style === 'mcq'
            ? q.options.map((o, i) => <Option key={i} label={o} mark={'ABCDE'[i]} onPress={() => choose(i)} />)
            : ([true, false] as const).map((b) => <Option key={String(b)} label={b ? 'True' : 'False'} onPress={() => choose(b)} />)}
        </View>
      </>
    );
  } else if (style === 'order' && q?.style === 'order') {
    const shown = q.shown ?? [];
    body = (
      <>
        <Paper>
          <T f={CG} size={17} color={AT.ink} style={{ lineHeight: v(22) }}>{q.prompt}</T>
          <T f={CGI} size={13.5} color={AT.inkSoft}>Tap the items in order, first to last.</T>
        </Paper>
        <View style={{ gap: v(7) }}>
          {shown.map((it) => {
            const at = order.indexOf(it);
            return <Option key={it} label={it} mark={at >= 0 ? String(at + 1) : ' '} on={at >= 0} onPress={() => setOrder(at >= 0 ? order.filter((x) => x !== it) : [...order, it])} />;
          })}
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: v(10) }}>
          <Btn ghost label="Clear" disabled={!order.length} onPress={() => setOrder([])} />
          <Btn label="Seal answer" disabled={order.length < shown.length} onPress={() => submit(order)} />
        </View>
      </>
    );
  } else if (style === 'match' && q?.style === 'match') {
    const shown = q.shown ?? [];
    const lefts = q.pairs.map((x) => x[0]);
    body = (
      <>
        <Paper>
          <T f={CG} size={17} color={AT.ink} style={{ lineHeight: v(22) }}>{q.prompt}</T>
          <T f={CGI} size={13.5} color={AT.inkSoft}>Tap a left item, then its match.</T>
        </Paper>
        <View style={{ flexDirection: 'row', gap: v(8) }}>
          <View style={{ flex: 1, gap: v(7) }}>
            {lefts.map((l, i) => <Option key={l} small label={l} mark={pairs[i] ? String(shown.indexOf(pairs[i]!) + 1) : ' '} on={left === i} onPress={() => setLeft(left === i ? null : i)} />)}
          </View>
          <View style={{ flex: 1, gap: v(7) }}>
            {shown.map((r, j) => {
              const taken = pairs.indexOf(r);
              return (
                <Option key={r} small label={r} mark={String(j + 1)} on={taken >= 0} onPress={() => {
                  if (left == null) return;
                  const next = pairs.map((x) => (x === r ? null : x));
                  next[left] = r;
                  setPairs(next);
                  setLeft(null);
                }} />
              );
            })}
          </View>
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: v(10) }}>
          <Btn ghost label="Clear" disabled={!pairs.some(Boolean)} onPress={() => setPairs([])} />
          <Btn label="Seal answer" disabled={lefts.some((_, i) => !pairs[i])} onPress={() => submit(lefts.map((_, i) => pairs[i]))} />
        </View>
      </>
    );
  }

  return (
    <>
      {head}
      {canJoker ? (
        joker ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: v(6), alignItems: 'center' }}>
            <T f={CGI} size={14} color={AT.soft}>Switch to</T>
            {(['mcq', 'tf', 'order', 'match'] as SoloStyle[]).filter((x) => x !== style).map((x) => (
              <Pressable key={x} onPress={() => (setJoker(false), act({ type: 'joker', style: x }))} style={s.pill} accessibilityRole="button">
                <T f={CZ} size={11}>{STYLE_NAME[x]}</T>
              </Pressable>
            ))}
          </View>
        ) : (
          <Pressable onPress={() => setJoker(true)} style={[s.pill, { alignSelf: 'flex-start' }]} accessibilityRole="button" accessibilityLabel="Play Joker to switch the question style">
            <T f={CZ} size={11} color={AT.gold}>Play Joker: switch style</T>
          </Pressable>
        )
      ) : null}
      {body}
    </>
  );
}

export function SoloResultCard({ turn }: { turn: SoloTurn }) {
  const r = turn.result;
  if (!r) return null;
  const good = r.points > 0;
  return (
    <View style={{ alignItems: 'center', gap: v(6), marginTop: v(24) }}>
      <Kicker>{`${r.correct} of ${r.total} right`}</Kicker>
      <T f={CZ} size={34} color={good ? AT.gold : AT.wrong}>{good ? `+${fmt(r.points * BALANCE.TROOPS_PER_POINT)}` : r.penalty ? `−${fmt(r.penalty)}` : '0'}</T>
      <T f={CGI} size={16} color={AT.soft}>{good ? 'troops to your reserve' : 'troops lost from your reserve'}</T>
    </View>
  );
}

// ---------------------------------------------------------------- versus

export function VersusPage(props: P) {
  const { m, seconds } = props;
  const vs = m.versus;
  if (!vs) return null;
  return (
    <>
      <Top kicker={`${stageLine(m)} · Versus`} title={VERSUS[vs.style].name} line={VERSUS[vs.style].rule} seconds={seconds} />
      {vs.style === 'closest' ? <Closest {...props} /> : vs.style === 'rush' ? <Rush {...props} /> : vs.style === 'standing' ? <Standing {...props} /> : <Clue {...props} />}
    </>
  );
}

function Closest({ m, me, act, elapsed }: P) {
  const vs = m.versus;
  const [text, setText] = useState('');
  if (vs?.style !== 'closest') return null;
  const mine = vs.guesses[me] ?? [];
  const at = vs.items.findIndex((_, i) => !mine[i]);
  if (at < 0) return <Waiting text="Guesses sealed. Waiting for the others…" />;
  const q = vs.items[at];
  const n = Number(text.replace(/,/g, ''));
  return (
    <>
      <Dots n={vs.items.length} at={at} />
      <Paper>
        <T f={CG} size={17} color={AT.ink} style={{ lineHeight: v(22) }}>{q.prompt}</T>
      </Paper>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: v(10) }}>
        <TextInput value={text} onChangeText={setText} keyboardType="decimal-pad" placeholder="Your guess" placeholderTextColor={AT.dim} style={s.input} accessibilityLabel="Your guess" />
        {q.unit ? <T f={CGB} size={17} color={AT.soft}>{q.unit}</T> : null}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <Btn label="Seal guess" disabled={!text || Number.isNaN(n)} onPress={() => (act({ type: 'closest', item: at, value: n, ms: elapsed }), setText(''))} />
      </View>
    </>
  );
}

function Rush({ m, me, act, elapsed }: P) {
  const vs = m.versus;
  const [text, setText] = useState('');
  if (vs?.style !== 'rush') return null;
  const mine = vs.found[me] ?? [];
  const send = () => {
    if (!text.trim()) return;
    act({ type: 'rush', text: text.trim(), ms: elapsed });
    setText('');
  };
  return (
    <>
      <Paper>
        <T f={CZ} size={11} color={AT.red}>THE CATEGORY</T>
        <T f={CG} size={18} color={AT.ink} style={{ lineHeight: v(23) }}>{vs.q.prompt}</T>
        <T f={CGI} size={13.5} color={AT.inkSoft}>{`${m.rushTotal ?? '?'} answers in the list`}</T>
      </Paper>
      <View style={{ flexDirection: 'row', gap: v(8), alignItems: 'center' }}>
        <TextInput value={text} onChangeText={setText} onSubmitEditing={send} returnKeyType="send" blurOnSubmit={false} autoCorrect={false} placeholder="Type an answer" placeholderTextColor={AT.dim} style={[s.input, { flex: 1 }]} accessibilityLabel="Type an answer" />
        <Btn label="Send" style={{ flex: 0, minWidth: v(80) }} onPress={send} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: v(6) }}>
        {mine.map((f) => (
          <View key={f.label} style={s.found}>
            <T f={CGB} size={14} color={AT.ink}>{f.label}</T>
          </View>
        ))}
      </View>
      <Rule />
      <Tally m={m} count={(id) => (vs.found[id] ?? []).length} />
    </>
  );
}

function Standing({ m, me, act, elapsed }: P) {
  const vs = m.versus;
  const [sel, setSel] = useState<number[]>([]);
  const index = vs?.style === 'standing' ? vs.index : -1;
  useEffect(() => setSel([]), [index]);
  if (vs?.style !== 'standing') return null;
  const q = vs.qs[vs.index];
  const alive = (vs.hearts[me] ?? 0) > 0;
  const sent = !!vs.answers[me];
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: v(6) }}>
        {m.order.filter((id) => vs.hearts[id] != null).map((id) => (
          <Chip key={id} color={colorOf(m, id)} name={nameOf(m, id)} mark={vs.hearts[id] > 0 ? '♥'.repeat(vs.hearts[id]) : '✕'} dim={vs.hearts[id] <= 0} />
        ))}
      </View>
      <Kicker>{`Question ${vs.index + 1} of up to ${vs.qs.length}`}</Kicker>
      <Paper>
        <T f={CG} size={17} color={AT.ink} style={{ lineHeight: v(22) }}>{q.prompt}</T>
        <T f={CGI} size={13.5} color={AT.inkSoft}>Pick every right answer (1 to 3).</T>
      </Paper>
      <View style={{ gap: v(7) }}>
        {q.options.map((o, i) => (
          <Option key={i} small label={o} mark={'ABCDEF'[i]} on={sel.includes(i)} onPress={() => alive && !sent && setSel(sel.includes(i) ? sel.filter((x) => x !== i) : sel.length < 3 ? [...sel, i] : sel)} />
        ))}
      </View>
      <View style={{ flex: 1 }} />
      {!alive ? <Waiting text="You are out of hearts. Watching the rest…" /> : sent ? <Waiting text="Answer sealed. Waiting for the others…" /> : (
        <View style={{ flexDirection: 'row' }}>
          <Btn label="Seal answer" disabled={!sel.length} onPress={() => act({ type: 'standing', picks: sel, ms: elapsed })} />
        </View>
      )}
    </>
  );
}

function Clue({ m, me, act, elapsed }: P) {
  const vs = m.versus;
  const [tab, setTab] = useState(0);
  const [text, setText] = useState('');
  if (vs?.style !== 'clue') return null;
  const shown = Math.min(4, 1 + Math.floor(elapsed / (BALANCE.CLUE_INTERVAL_SECONDS * 1000)));
  const solved = vs.solved[me] ?? vs.qs.map(() => null);
  const q = vs.qs[tab];
  const send = () => {
    if (!text.trim() || solved[tab] != null) return;
    act({ type: 'clue', mystery: tab, text: text.trim(), clue: shown, ms: elapsed });
    setText('');
  };
  return (
    <>
      <View style={{ flexDirection: 'row', gap: v(8) }}>
        {vs.qs.map((_, i) => (
          <Pressable key={i} onPress={() => setTab(i)} style={[s.tab, tab === i ? s.tabOn : null]} accessibilityRole="tab" accessibilityState={{ selected: tab === i }}>
            <T f={CZ} size={12} color={tab === i ? AT.cream : AT.soft}>{`Mystery ${ROMAN[i]}${solved[i] != null ? ' ✓' : ''}`}</T>
          </Pressable>
        ))}
      </View>
      <Paper>
        {q.clues.slice(0, shown).map((c, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: v(8) }}>
            <T f={CZ} size={11} color={AT.red} style={{ marginTop: v(3) }}>{`${BALANCE.CLUE_SCORES[i]}`}</T>
            <T f={CG} size={16} color={AT.ink} style={{ flex: 1, lineHeight: v(20) }}>{c}</T>
          </View>
        ))}
        {shown < 4 ? <T f={CGI} size={13} color={AT.inkSoft}>Next clue soon…</T> : null}
      </Paper>
      {solved[tab] != null ? <Waiting text={`Solved on clue ${solved[tab]}.`} /> : (
        <View style={{ flexDirection: 'row', gap: v(8), alignItems: 'center' }}>
          <TextInput value={text} onChangeText={setText} onSubmitEditing={send} returnKeyType="send" autoCorrect={false} placeholder="Your guess" placeholderTextColor={AT.dim} style={[s.input, { flex: 1 }]} accessibilityLabel="Your guess" />
          <Btn label="Guess" style={{ flex: 0, minWidth: v(80) }} onPress={send} />
        </View>
      )}
      {(vs.wrong[me] ?? 0) > 0 ? <T f={CGI} size={14} color={AT.wrong}>{`${vs.wrong[me]} wrong guess${vs.wrong[me] > 1 ? 'es' : ''} (−${vs.wrong[me] * BALANCE.CLUE_WRONG_PENALTY})`}</T> : null}
    </>
  );
}

function Tally({ m, count }: { m: MatchView; count: (id: string) => number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: v(6) }}>
      {m.order.filter((id) => !m.players[id].out).map((id) => <Chip key={id} color={colorOf(m, id)} name={nameOf(m, id)} count={count(id)} />)}
    </View>
  );
}

export function VersusResult({ m }: { m: MatchView }) {
  const r = m.lastVersus;
  if (!r) return null;
  return (
    <View style={{ gap: v(10), marginTop: v(10) }}>
      {r.ranking.map((id, i) => (
        <View key={id} style={s.row}>
          <T f={CZ} size={14} color={AT.soft} style={{ width: v(26) }}>{ROMAN[i]}</T>
          <View style={{ width: v(11), height: v(11), borderRadius: v(6), backgroundColor: colorOf(m, id) }} />
          <T f={CGB} size={17} style={{ flex: 1 }}>{nameOf(m, id)}</T>
          {r.points[id] ? <T f={CZ} size={15} color={AT.gold}>{`+${fmt(r.points[id] * BALANCE.TROOPS_PER_POINT)}`}</T> : null}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- the Gap: cards and alliances

/** Played in the Gap; Joker belongs to a solo tile and Reinforcements to a troop move. */
const GAP_CARDS: CardType[] = ['double_attack', 'shield', 'spy', 'trap', 'ambush', 'earthquake', 'revolution', 'betrayal', 'hide_troops'];
const ON_OWN_LAND: CardType[] = ['shield', 'trap', 'revolution'];

export function CardsPage({ m, me, map, seconds, act }: P) {
  const { width } = useWindowDimensions();
  const p = m.players[me];
  const [pick, setPick] = useState<number | null>(null);
  const [land, setLand] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const card = pick != null ? p.cards[pick] : null;
  const ready = m.gap.ready.includes(me);
  const rivals = m.order.filter((id) => id !== me && !m.players[id].out);
  const canAlly = rivals.length >= 2 && !p.ally;
  const incoming = m.gap.proposals.filter((x) => x.to === me && x.status === 'pending');
  const outgoing = m.gap.proposals.filter((x) => x.from === me);
  const needsLand = card && (ON_OWN_LAND.includes(card) || card === 'betrayal');
  const landOk = (id: string) => (card === 'betrayal' ? m.lands[id].owner === p.ally && !m.lands[id].capital : m.lands[id].owner === me);
  const views = useMemo(() => landViews(m, me), [m, me]);
  const play = () => {
    if (!card) return;
    act({ type: 'card', card, ...(land ? { land } : null), ...(target ? { target } : null) });
    setPick(null);
    setLand(null);
    setTarget(null);
  };

  return (
    <>
      <Top kicker={stageLine(m)} title="The Gap" line="Cards and alliances" seconds={seconds} />
      <Players m={m} me={me} mark={(id) => (m.gap.ready.includes(id) ? '✓' : id === p.ally ? '⚑' : undefined)} />
      {needsLand ? (
        <MapChart map={map} lands={views} width={width - v(28)} selected={land} targets={m.landOrder.filter(landOk)} onLand={(id) => landOk(id) && setLand(id)} />
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: v(8), paddingVertical: v(8) }}>
        {p.cards.length ? p.cards.map((c, i) => <CardTile key={`${c}${i}`} card={c} w={86} on={pick === i} dim={!GAP_CARDS.includes(c)} onPress={GAP_CARDS.includes(c) ? () => (setPick(pick === i ? null : i), setLand(null), setTarget(null)) : undefined} />) : <T f={CGI} size={15} color={AT.soft}>No cards in hand.</T>}
      </ScrollView>
      {card ? (
        <View style={{ gap: v(8) }}>
          <T f={CGI} size={15}>{CARDS[card].text}</T>
          {card === 'ambush' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: v(6) }}>
              {rivals.map((id) => (
                <Pressable key={id} onPress={() => setTarget(id)} style={[s.pill, target === id ? s.pillOn : null]} accessibilityRole="radio" accessibilityState={{ selected: target === id }}>
                  <T f={CZ} size={11}>{nameOf(m, id)}</T>
                </Pressable>
              ))}
            </View>
          ) : needsLand && !land ? (
            <T f={CGI} size={14} color={AT.soft}>{card === 'betrayal' ? 'Tap one of your ally’s outposts on the map.' : 'Tap one of your lands on the map.'}</T>
          ) : null}
          <View style={{ flexDirection: 'row', gap: v(10) }}>
            <Btn ghost label="Keep it" onPress={() => setPick(null)} />
            <Btn label={`Play ${CARDS[card].name}`} disabled={(needsLand && !land) || (card === 'ambush' && !target) || (card === 'betrayal' && !p.ally)} onPress={play} />
          </View>
        </View>
      ) : null}
      {m.spy ? (
        <View style={s.box}>
          <Kicker color={AT.gold}>Your spy reports</Kicker>
          {rivals.map((id) => (
            <T key={id} f={CG} size={15}>{`${nameOf(m, id)}: ${fmt(m.spy!.reserves[id] ?? 0)} in reserve${m.spy!.cards.filter((c) => c.by === id).map((c) => `, played ${CARDS[c.card].name}`).join('')}`}</T>
          ))}
        </View>
      ) : null}
      {!card ? (
        <View style={{ gap: v(8) }}>
          <Rule />
          <Kicker>Alliances</Kicker>
          {p.ally ? <T f={CG} size={15}>{`You and ${nameOf(m, p.ally)} are allies this stage. You can't attack each other.`}</T> : null}
          {incoming.map((x) => (
            <View key={x.from} style={s.row}>
              <T f={CG} size={15} style={{ flex: 1 }}>{`${nameOf(m, x.from)} offers an alliance.`}</T>
              <Btn ghost label="No" style={{ flex: 0, minWidth: v(64) }} onPress={() => act({ type: 'respond', from: x.from, accept: false })} />
              <Btn label="Ally" style={{ flex: 0, minWidth: v(70) }} onPress={() => act({ type: 'respond', from: x.from, accept: true })} />
            </View>
          ))}
          {canAlly ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: v(6) }}>
              {rivals.filter((id) => !m.players[id].ally).map((id) => {
                const sent = outgoing.find((x) => x.to === id);
                return (
                  <Pressable key={id} disabled={!!sent} onPress={() => act({ type: 'propose', to: id })} style={[s.pill, sent ? { opacity: 0.55 } : null]} accessibilityRole="button" accessibilityLabel={`Offer an alliance to ${nameOf(m, id)}`}>
                    <T f={CZ} size={11}>{sent ? `${nameOf(m, id)}: ${sent.status === 'pending' ? 'asked' : sent.status}` : `Ally with ${nameOf(m, id)}`}</T>
                  </Pressable>
                );
              })}
            </View>
          ) : !p.ally && rivals.length < 2 ? <T f={CGI} size={14} color={AT.soft}>No alliances with only 2 players left.</T> : null}
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      {ready ? <Waiting text="Ready. Waiting for the others…" /> : (
        <View style={{ flexDirection: 'row' }}>
          <Btn label="On to troop moves" onPress={() => act({ type: 'ready' })} />
        </View>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Breaking Duel

export function DuelPage({ m, me, map, seconds, act, elapsed }: P) {
  const { width } = useWindowDimensions();
  const d = m.duels[m.duelIndex];
  const mine = d && (d.p1 === me || d.p2 === me);
  const answers = d ? (d.p1 === me ? d.a1 : d.a2) : [];
  const started = useRef(elapsed);
  const at = answers.length;
  useEffect(() => {
    started.current = elapsed;
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps
  const views = useMemo(() => landViews(m, me), [m, me]);
  if (!d) return null;
  const land = m.lands[d.land];
  const q = d.questions[at];
  return (
    <>
      <Top kicker={stageLine(m)} title="Breaking Duel" line={`${nameOf(m, d.p1)} and ${nameOf(m, d.p2)} both broke into ${land.name}`} seconds={seconds} />
      <MapChart map={map} lands={views} width={width - v(28)} selected={d.land} arrows={[]} />
      <View style={s.row}>
        {[{ id: d.p1, t: d.t1, a: d.a1 }, { id: d.p2, t: d.t2, a: d.a2 }].map((x) => (
          <View key={x.id} style={[s.box, { flex: 1, alignItems: 'center' }]}>
            <PieceIcon color={colorOf(m, x.id)} size={24} />
            <T f={CGB} size={15}>{nameOf(m, x.id)}</T>
            <T f={CZ} size={12} color={AT.gold}>{fmt(x.t)}</T>
            <T f={CZM} size={10} color={AT.soft}>{`${x.a.length} of ${BALANCE.DUEL_QUESTIONS} answered`}</T>
          </View>
        ))}
      </View>
      {mine && q ? (
        <>
          <Dots n={d.questions.length} at={at} />
          <Paper>
            <T f={CG} size={17} color={AT.ink} style={{ lineHeight: v(22) }}>{q.prompt}</T>
          </Paper>
          <View style={{ flexDirection: 'row', gap: v(10) }}>
            <Btn ghost label="False" onPress={() => act({ type: 'duel', answer: false, ms: elapsed - started.current })} />
            <Btn label="True" onPress={() => act({ type: 'duel', answer: true, ms: elapsed - started.current })} />
          </View>
        </>
      ) : (
        <Waiting text={mine ? 'Answers sealed. Waiting for your rival…' : 'Most right answers wins the land, then the faster.'} />
      )}
    </>
  );
}

// ---------------------------------------------------------------- holds: start, results, battle report

export function HoldPage({ m, me, map, hold, seconds }: { m: MatchView; me: string; map: AtlasMap; hold: Hold; seconds: number }) {
  const { width } = useWindowDimensions();
  const views = useMemo(() => landViews(m, me), [m, me]);
  if (hold.kind === 'start')
    return (
      <>
        <Top kicker="The Last Empire" title="Your kingdom" line="A castle for your capital, two pawns for your outposts. Lose the castle and you fall." seconds={seconds} />
        <Players m={m} me={me} />
        <MapChart map={map} lands={views} width={width - v(28)} />
        <T f={CGI} size={16} color={AT.soft} style={{ textAlign: 'center' }}>{`${BALANCE.MAX_STAGES} stages. Most lands at the end wins.`}</T>
      </>
    );
  if (hold.kind === 'soloResult')
    return (
      <>
        <Top kicker={`${stageLine(m)} · Solo round`} title="The tally" seconds={seconds} />
        {hold.solo?.card ? (
          <View style={{ alignItems: 'center', gap: v(10), marginTop: v(24) }}>
            <CardTile card={hold.solo.card} w={110} />
            <T f={CGI} size={16} color={AT.soft}>A card for your hand.</T>
          </View>
        ) : hold.solo ? <SoloResultCard turn={hold.solo} /> : <Waiting text="You sat this round out." />}
        <View style={s.box}>
          <Kicker>Your reserve</Kicker>
          <T f={CZ} size={22}>{fmt(m.players[me].reserve)}</T>
        </View>
      </>
    );
  if (hold.kind === 'versusIntro' && hold.style)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: v(12), paddingHorizontal: v(20) }}>
        <Kicker>{`${stageLine(m)} · Versus round`}</Kicker>
        <T f={CZ} size={30} color={AT.gold} style={{ textAlign: 'center' }}>{VERSUS[hold.style].name}</T>
        <T f={CGI} size={18} style={{ textAlign: 'center' }}>{VERSUS[hold.style].rule}</T>
        <T f={CG} size={15} color={AT.soft} style={{ textAlign: 'center' }}>{`1st takes ${fmt(BALANCE.VERSUS_PAYOUT[0] * 1000)} troops, 2nd ${fmt(BALANCE.VERSUS_PAYOUT[1] * 1000)}.`}</T>
      </View>
    );
  if (hold.kind === 'versusResult')
    return (
      <>
        <Top kicker={`${stageLine(m)} · Versus`} title={m.lastVersus ? VERSUS[m.lastVersus.style].name : 'Versus'} line="The spoils" seconds={seconds} />
        <VersusResult m={m} />
      </>
    );
  // The battle report: what the Gap's moves did, on the map as it stands now.
  return (
    <>
      <Top kicker={stageLine(m)} title="The battle" line="All orders landed at once" seconds={seconds} />
      <Players m={m} me={me} />
      <MapChart map={map} lands={views} width={width - v(28)} />
      <View style={{ gap: v(4) }}>
        {(hold.log ?? []).length ? (hold.log ?? []).map((l, i) => <T key={i} f={CG} size={15}>{l.replace(new RegExp(`\\b${m.players[me].name}'s\\b`, 'g'), 'Your').replace(new RegExp(`^${m.players[me].name}\\b`), 'You')}</T>) : <T f={CGI} size={15} color={AT.soft}>No land changed hands.</T>}
      </View>
    </>
  );
}

/** A spectator line once my capital has fallen. */
export function OutBanner({ m, me }: { m: MatchView; me: string }) {
  const p = m.players[me];
  if (!p.out) return null;
  return (
    <View style={[s.box, { borderColor: AT.red }]}>
      <T f={CZ} size={13} color={AT.wrong}>{p.outReason === 'away' ? 'Removed for being away' : 'Your capital fell'}</T>
      <T f={CGI} size={14} color={AT.soft}>You are watching the rest of the war.</T>
    </View>
  );
}

// ---------------------------------------------------------------- bits

function Paper({ children }: { children: React.ReactNode }) {
  return <View style={s.paper}>{children}</View>;
}

function Option({ label, mark, on, onPress, small }: { label: string; mark?: string; on?: boolean; onPress: () => void; small?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} style={({ pressed }) => [s.opt, small ? { paddingVertical: v(8) } : null, on ? s.optOn : null, pressed ? { opacity: 0.8 } : null]}>
      {mark != null ? (
        <View style={[s.mark, !mark.trim() ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: 'rgba(243,230,198,0.4)' } : null, on ? { backgroundColor: AT.cream } : null]}>
          <T f={CZ} size={11} color={on ? AT.red : AT.cream}>{mark}</T>
        </View>
      ) : null}
      <T f={CGB} size={small ? 14.5 : 16} color={on ? AT.cream : AT.cream} style={{ flex: 1, lineHeight: v(small ? 18 : 20) }}>{label}</T>
    </Pressable>
  );
}

function Dots({ n, at }: { n: number; at: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: v(6), justifyContent: 'center' }}>
      {Array.from({ length: n }, (_, i) => <View key={i} style={{ width: v(9), height: v(9), borderRadius: v(5), backgroundColor: i < at ? AT.gold : i === at ? AT.redHi : 'rgba(243,230,198,0.2)' }} />)}
    </View>
  );
}

export function Waiting({ text }: { text: string }) {
  return (
    <>
      <View style={{ flex: 1 }} />
      <T f={CGI} size={16} color={AT.soft} style={{ textAlign: 'center', paddingBottom: v(14) }}>{text}</T>
    </>
  );
}

export const landsHeld = (m: MatchView, id: string) => landsOf(m, id).length;
export { SECRET };

const s = StyleSheet.create({
  paper: { backgroundColor: AT.paper, borderRadius: v(6), borderWidth: 1, borderColor: '#5a3a1e', padding: v(14), gap: v(8) },
  opt: { flexDirection: 'row', alignItems: 'center', gap: v(10), paddingVertical: v(11), paddingHorizontal: v(12), borderRadius: v(6), borderWidth: 1, borderColor: 'rgba(243,230,198,0.28)', backgroundColor: 'rgba(243,230,198,0.06)' },
  optOn: { backgroundColor: AT.red, borderColor: AT.cream },
  mark: { width: v(22), height: v(22), borderRadius: v(11), alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(142,28,28,0.85)' },
  pill: { paddingVertical: v(7), paddingHorizontal: v(12), borderRadius: v(20), borderWidth: 1, borderColor: 'rgba(243,230,198,0.35)' },
  pillOn: { backgroundColor: AT.red, borderColor: AT.cream },
  input: { minHeight: v(46), borderRadius: v(6), borderWidth: 1.5, borderColor: 'rgba(243,230,198,0.45)', paddingHorizontal: v(12), color: AT.cream, fontFamily: CGB, fontSize: v(18), flex: 1 },
  found: { paddingVertical: v(4), paddingHorizontal: v(10), borderRadius: v(14), backgroundColor: AT.paper },
  tab: { flex: 1, paddingVertical: v(8), borderRadius: v(6), borderWidth: 1, borderColor: 'rgba(243,230,198,0.3)', alignItems: 'center' },
  tabOn: { backgroundColor: AT.red, borderColor: AT.cream },
  row: { flexDirection: 'row', alignItems: 'center', gap: v(8) },
  box: { padding: v(12), borderRadius: v(6), borderWidth: 1, borderColor: AT.line, backgroundColor: 'rgba(0,0,0,0.12)', gap: v(4) },
});
