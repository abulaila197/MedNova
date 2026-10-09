// Trust Me Not: the round, in the all-paper look (locked 2026-10-07, preview pages 18-29). The obstacle dealt to me
// and my sealed mission come first, then the round's own stages: Hero / Supplier votes, Wager bids, then the
// questions one after another, each on its own clock. Every page sends only this player's own actions.
import { Fragment, useEffect, useReducer, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { EffectId, MissionId } from './engine';
import { rules } from './engine';
import { Icon } from './icons';
import { ROUND_NAME, type StripPlayer } from './pages';
import { CRIM, CRIMB, CRIMI, FELL, IvBag, Jar, p, Paper, Portrait, RingClock, T, TM } from './paper';
import type { PageProps } from './props';
import { EFFECT, ITEM, question } from './text';

type View_ = PageProps['env']['view'];
type Round = NonNullable<View_['round']>;
type Extras = PageProps['env']['extras']['round'];

const MODE_NAME: Record<string, string> = {
  'team-vote': 'team vote', solo: 'solo', 'solo-competitive': 'solo, lowest loses', pairs: 'in pairs', 'team-target': 'team target', linked: 'one link each',
};
/** Frostbitten: taps to break the ice on a choice (§6). */
const FROST_TAPS = 7;
const LINE = 'rgba(42,31,22,0.3)';

/** The 15 missions as the holder reads them (rule book §7.2); `t` is the named player. */
const MISSION: Record<MissionId, { name: string; text: (t: string) => string; reward: string }> = {
  skim: { name: 'Skim', text: () => 'In the Gap, take up to 10% of the wallet without anyone seeing.', reward: 'the coins, as jewels' },
  steal: { name: 'Steal', text: (t) => `In the Gap, take 2 jewels from ${t}. A Lock box blocks it.`, reward: '2 jewels' },
  sabotage: { name: 'Sabotage', text: () => 'Answer wrong so the team misses this round.', reward: '2 jewels' },
  poisoner: { name: 'Poisoner', text: () => 'Everyone else is Poisoned this month; you only show the icon. Nobody may accuse you this season.', reward: '2 jewels' },
  'cold-shoulder': { name: 'Cold Shoulder', text: (t) => `Refuse ${t}'s help request, overriding the vote.`, reward: 'safe from targeting next month' },
  guardian: { name: 'Guardian', text: (t) => `Keep ${t} above 50% health at the end of this month.`, reward: '3 jewels' },
  'false-whisper': { name: 'False Whisper', text: () => 'In The Whisperer, make your guesser get at least 2 answers wrong.', reward: '2 jewels' },
  'bad-hands': { name: 'Bad Hands', text: () => 'In In Your Hands, answer for your partner so they lose at least 2 answers.', reward: '2 jewels' },
  'chain-breaker': { name: 'Chain Breaker', text: () => 'In the Chain of Trust, answer right when everyone must answer wrong, and take the pot.', reward: 'the pot + 1 jewel' },
  loyal: { name: 'Loyal', text: () => 'Approve every request all season.', reward: '2 jewels + one Snare blocked' },
  'fallen-hero': { name: 'Fallen Hero', text: () => 'Get picked as the Hero, then fail on purpose.', reward: '3 jewels' },
  'free-rider': { name: 'Free Rider', text: () => "In The Wager, bid 0 jewels while the others' bids win.", reward: '25% of the pot' },
  'clock-thief': { name: 'Clock Thief', text: (t) => `${t} loses 5 seconds on every question. They must get fewer than half right.`, reward: '1 jewel' },
  fog: { name: 'Fog', text: () => 'Blur one wrong choice so it looks like a second answer. The team must get that question wrong.', reward: '2 jewels' },
  'ghost-vote': { name: 'Ghost Vote', text: () => 'Your vote secretly counts twice in this round.', reward: 'the power itself' },
};

// ---------------------------------------------------------------- local memory

/** Survives a remount (the pause page swaps the round out): when my notes were done, and each round's question clock. */
const NOTES: Record<string, { step: number; doneAt: number | null }> = {};
type Clock = { q: number; since: number; sent: Record<number, true> };
const CLOCKS: Record<string, Clock> = {};
const SEEN_AT: Record<string, number> = {};

const nameOf = (v: View_, id: string | null | undefined) => (id === v.me ? 'you' : v.players.find((x) => x.id === id)?.name ?? 'someone');
const colorOf = (v: View_, id: string | null | undefined) => v.players.find((x) => x.id === id)?.color ?? TM.ink;
const LETTER = 'ABC';

/**
 * My questions one after another: which one I'm on, when it started and the seconds left. A question whose clock runs
 * out calls onTimeout and moves on; after a reload I resume at the first question not done.
 */
function useQuestions(key: string, n: number, done: (q: number) => boolean, limit: (q: number) => number, startAt: number, now: number) {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  let c = CLOCKS[key];
  if (!c) {
    let first = 0;
    while (first < n && done(first)) first++;
    c = CLOCKS[key] = { q: first, since: first === 0 ? Math.min(now, startAt) : now, sent: {} };
  }
  while (c.q < n && (done(c.q) || c.sent[c.q])) {
    c.q++;
    c.since = now;
  }
  const clock = c;
  const left = clock.q < n ? Math.max(0, (limit(clock.q) - (now - clock.since)) / 1000) : 0;
  /** Marks question q sent and moves on; returns the ms it took. */
  const finish = (q: number) => {
    const ms = Math.max(0, Math.min(limit(q), now - clock.since));
    clock.sent[q] = true;
    clock.q = q + 1;
    clock.since = now;
    bump();
    return ms;
  };
  return { q: clock.q, left, expired: clock.q < n && left <= 0, finish };
}

/** Which question a watcher sees: the camp's clock run from the stage start. */
function scheduleIndex(r: Round, started: number, now: number) {
  let t = started;
  for (let i = 0; i < r.questions.length; i++) {
    t += r.questions[i].limitMs;
    if (now < t) return { q: i, left: (t - now) / 1000 };
  }
  return { q: r.questions.length, left: 0 };
}

// ---------------------------------------------------------------- the round phase

/** The whole round phase: obstacle dealt, sealed mission, then the round's own stages and questions. */
export function RoundFlow(props: PageProps) {
  const { env, now } = props;
  const v = env.view;
  const x = env.extras.round;
  const notesKey = `${v.month}`;
  const notes = (NOTES[notesKey] ??= { step: 0, doneAt: null });
  const [, bump] = useReducer((n: number) => n + 1, 0);

  if (v.ghost) return <GhostSheet {...props} />;

  // My notes in order: each obstacle dealt to me, then the mission dealt to me this month.
  const dealt = v.dealt.filter((d) => d.player === v.me);
  const mission = v.missions.find((m) => m.holder === v.me && m.month === v.month && m.status === 'active');
  const list: ReactNode[] = [
    ...dealt.map((d, i) => <ObstacleNote key={`o${i}`} v={v} x={x} effect={d.effect} onSeen={() => next()} />),
    ...(mission ? [<MissionNote key="m" v={v} mission={mission} onDone={() => next()} />] : []),
  ];
  function next() {
    notes.step++;
    if (notes.step >= list.length) notes.doneAt = now;
    bump();
  }
  if (notes.step < list.length) return list[notes.step];

  const r = v.round;
  if (!r) return null;
  const startAt = Math.max(env.started, notes.doneAt ?? 0);
  if (r.stage === 'pick') return <PickPage {...props} r={r} />;
  if (r.stage === 'bid') return <WagerBid {...props} r={r} />;
  if (r.id === 'chain') return <ChainSheet {...props} r={r} startAt={startAt} />;
  if (r.id === 'whisperer' && r.pairs.some((pr) => pr.b === v.me)) return <WhisperSheet {...props} r={r} startAt={startAt} />;
  if (r.id === 'hands' && !r.pairs.some((pr) => pr.b === v.me)) return <WatchSheet {...props} r={r} />;
  if ((r.id === 'hero' || r.id === 'supplier') && r.chosen !== v.me) return <WatchSheet {...props} r={r} />;
  return <AnswerSheet {...props} r={r} startAt={startAt} />;
}

// ---------------------------------------------------------------- shared sheet parts

/** Everyone across the top, with the Star Player's crown and the Weak Link's red pulse when they are marked. */
function MarkStrip({ players, me, star, weak }: { players: StripPlayer[]; me: string; star?: string | null; weak?: string | null }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: p(9), paddingHorizontal: p(14) }}>
      {players.map((pl) => (
        <View key={pl.id} style={{ width: p(46), alignItems: 'center', opacity: pl.alive ? 1 : 0.6 }}>
          <View>
            <Portrait color={pl.color} health={pl.health} ghost={!pl.alive} />
            {pl.id === star ? <Crown /> : pl.id === weak ? <View style={s.pulse} /> : null}
          </View>
          <T f={FELL} size={11} color={TM.cream} style={[s.shadow, { marginTop: p(3), lineHeight: p(13) }]} lines={1}>{pl.id === me ? 'You' : pl.name}</T>
          <T size={8.5} color={TM.cream} style={[s.shadow, { lineHeight: p(10), opacity: 0.8 }]}>{pl.alive ? `${Math.round(pl.health)}%` : 'ghost'}</T>
        </View>
      ))}
    </View>
  );
}

const Crown = () => (
  <Svg width={p(16)} height={p(12)} viewBox="0 0 16 12" style={{ position: 'absolute', top: -p(6), right: -p(6) }}>
    <Polygon points="0.8,10.6 0.8,3.4 4.4,6.8 8,1.2 11.6,6.8 15.2,3.4 15.2,10.6" fill={TM.amber} stroke={TM.ink} strokeWidth={1.2} strokeLinejoin="round" />
  </Svg>
);

/** The round's torn sheet under the strip. */
function Sheet({ v, seed, children }: { v: View_; seed: string; children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <MarkStrip players={v.players} me={v.me} />
      <View style={{ position: 'absolute', left: p(12), right: p(12), top: p(76) }}>
        <Paper seed={seed}>
          <View style={{ gap: p(8) }}>{children}</View>
        </Paper>
      </View>
    </View>
  );
}

/** Round name, a small line under it, and the question clock. */
function Head({ title, sub, seconds, limit }: { title: string; sub: string; seconds?: number; limit?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: p(40) }}>
      <View style={{ flex: 1 }}>
        <T f={FELL} size={19} style={{ lineHeight: p(21) }}>{title}</T>
        <T size={10.5} style={{ opacity: 0.75 }}>{sub}</T>
      </View>
      {seconds != null && limit != null ? <RingClock seconds={seconds} total={limit} /> : null}
    </View>
  );
}

const Kicker = ({ children, center }: { children: ReactNode; center?: boolean }) => (
  <T f={FELL} size={10} style={[s.kicker, center ? { textAlign: 'center' } : null]}>{children}</T>
);
const Note = ({ children, center }: { children: ReactNode; center?: boolean }) => (
  <T size={11} style={{ lineHeight: p(14.9), opacity: 0.75, textAlign: center ? 'center' : 'left' }}>{children}</T>
);
const Cta = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => (
  <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={[s.cta, disabled ? { opacity: 0.45 } : null]}>
    <T f={FELL} size={14} color={TM.paper}>{label}</T>
  </Pressable>
);

/** A coloured dot and a line about who you play with (pairs rounds). */
const PairLine = ({ color, children }: { color: string; children: ReactNode }) => (
  <View style={{ flexDirection: 'row', gap: p(7), alignItems: 'flex-start' }}>
    <View style={[s.dot, { backgroundColor: color }]} />
    <T size={12} style={{ flex: 1, lineHeight: p(16.6) }}>{children}</T>
  </View>
);

/** Health and jewels at the foot of the sheet, with any helper items between them. */
function Gauges({ health, jewels, middle }: { health: number; jewels: number; middle?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: p(6) }}>
      <View style={s.gauge}>
        <IvBag health={health} />
        <T f={FELL} size={15}>{`${Math.round(health)}%`}</T>
      </View>
      {middle}
      <View style={s.gauge}>
        <Jar />
        <T f={FELL} size={15}>{String(jewels)}</T>
      </View>
    </View>
  );
}

/** My effects as small red tags at the top of the sheet. */
function EffectRow({ effects }: { effects: EffectId[] }) {
  if (!effects.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p(6) }}>
      {effects.map((e) => (
        <View key={e} style={s.fx}>
          <Icon name={e} size={16} color={TM.red} />
          <T size={10.5} color={TM.red} style={{ lineHeight: p(13) }}>{EFFECT[e].name}</T>
        </View>
      ))}
    </View>
  );
}

/** A small steady random in 0..1 (the flicker of a fevered letter). */
const wobble = (n: number) => {
  const t = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return t - Math.floor(t);
};

type ChoiceState = {
  picked?: number | null;
  /** The Whisperer's lit choice (amber glow). */
  lit?: number | null;
  /** The right answer, marked in red italics (the Whisperer, ghosts). */
  answer?: number | null;
  /** Greyed out by my pocket guide. */
  hidden?: number | null;
  /** Blurred by a Fog mission to look like a second answer. */
  fogged?: number | null;
  /** Frostbitten: taps so far on each choice. */
  taps?: number[] | null;
  /** Feverish: the flicker tick. */
  fever?: number | null;
  disabled?: boolean;
};

/** The three choices as ruled boxes with a lettered ring; effects and marks drawn on top. */
function Choices({ choices, st, onPick }: { choices: string[]; st: ChoiceState; onPick: (i: number) => void }) {
  return (
    <View style={{ gap: p(7) }}>
      {choices.map((c, i) => {
        const on = st.picked === i;
        const lit = st.lit === i;
        const gone = st.hidden === i;
        const frost = st.taps && !on;
        const fade = st.fever != null ? 0.25 + 0.75 * wobble(st.fever * 3 + i) : 1;
        return (
          <Pressable
            key={i}
            onPress={() => onPick(i)}
            disabled={st.disabled || gone || st.picked != null}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled: st.disabled || gone }}
            accessibilityLabel={c}
            style={[s.ch, frost ? s.chFrost : null, on ? s.chOn : null, lit ? s.chLit : null, gone ? { opacity: 0.3 } : null, st.disabled && !on && !lit ? { opacity: 0.75 } : null]}
          >
            {frost ? <Ice /> : null}
            <View style={[s.letter, on ? s.letterOn : null]}>
              <T f={FELL} size={12} color={on ? TM.paper : TM.ink} style={{ lineHeight: p(14), opacity: on ? 1 : fade }}>{LETTER[i]}</T>
            </View>
            <T f={CRIM} size={13.5} style={[{ flex: 1, lineHeight: p(18), opacity: fade }, gone ? { textDecorationLine: 'line-through' } : null]}>{c}</T>
            {st.answer === i || st.fogged === i ? <T f={CRIMI} size={11} color={TM.red}>answer</T> : null}
            {frost ? (
              <View style={{ flexDirection: 'row', gap: p(2) }}>
                {Array.from({ length: FROST_TAPS }, (_, k) => (
                  <View key={k} style={[s.tap, k < (st.taps?.[i] ?? 0) ? { backgroundColor: '#5e8798' } : null]} />
                ))}
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Frost over a choice: pale blue with fine white streaks. */
function Ice() {
  const [w, setW] = useState(0);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w ? (
        <Svg width={w} height="100%" style={StyleSheet.absoluteFill}>
          {Array.from({ length: Math.ceil(w / p(10)) + 6 }, (_, k) => (
            <Line key={k} x1={k * p(10)} y1={0} x2={k * p(10) - p(22)} y2={p(48)} stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

/** Small paper buttons for a pocket guide (50/50) and a stethoscope (+10 s) from my bag. */
function Helpers({ v, x, q, act }: { v: View_; x: Extras; q: number; act: PageProps['act'] }) {
  const bag = v.players.find((pl) => pl.id === v.me)?.bag ?? [];
  const used = x.helpers as { guide?: number; stethoscope?: number };
  const items = (['pocket-guide', 'stethoscope'] as const).filter((it) => bag.includes(it) && (it === 'pocket-guide' ? used.guide === undefined : used.stethoscope === undefined));
  if (!items.length) return null;
  return (
    <View style={{ flexDirection: 'row', gap: p(6) }}>
      {items.map((it) => (
        <Pressable key={it} onPress={() => act({ type: 'USE_ITEM', item: it, q })} accessibilityRole="button" accessibilityLabel={`Use ${ITEM[it].name}`} style={s.helper}>
          <Icon name={it} size={15} />
          <T f={FELL} size={11} style={{ lineHeight: p(13) }}>{it === 'pocket-guide' ? '50/50' : '+10 s'}</T>
        </Pressable>
      ))}
    </View>
  );
}

/** Damage-control rounds: what is at risk, as slices that empty, and what is lost so far. */
function RiskPanel({ risk, team }: { risk: NonNullable<Extras['risk']>; team: boolean }) {
  const slice = risk.risk / Math.max(1, risk.slices);
  const lo = Math.floor(slice), hi = Math.ceil(slice);
  const per = risk.unit === 'coins' ? (lo === hi ? `${lo} coins` : `${lo} or ${hi} coins`) : '10% of your jewels';
  const head = risk.unit === 'coins' ? (team ? `At risk: ${risk.risk} of ${risk.of} coins` : `At risk: your ${risk.risk} coins`) : `At risk: your ${risk.risk} jewels`;
  const how = team ? 'Each wrong or slow team answer' : 'Each wrong or slow answer of yours';
  return (
    <View style={s.risk}>
      <Jar />
      <View style={{ flex: 1, gap: p(3) }}>
        <T f={FELL} size={15} style={{ lineHeight: p(18) }}>{head}</T>
        <View style={{ flexDirection: 'row', gap: p(3) }}>
          {Array.from({ length: risk.slices }, (_, k) => (
            <View key={k} style={[s.slice, k < risk.lostSlices ? s.sliceLost : null]} />
          ))}
        </View>
        <T size={10} style={{ lineHeight: p(13), opacity: 0.75 }}>{`${how} costs ${per}. ${risk.lost} lost so far.`}</T>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- answering

type SheetProps = PageProps & { r: Round; startAt: number };

/** One question at a time with its own clock: normal rounds, effects on screen, damage control, Hands, the guesser. */
function AnswerSheet({ env, now, act, r, startAt }: SheetProps) {
  const v = env.view;
  const x = env.extras.round;
  const me = v.players.find((pl) => pl.id === v.me)!;
  const mode = rules.ROUNDS[r.id].mode;
  const n = r.questions.length;
  // Hands: I answer for one or two partners; my answers sit under "me>partner".
  const handsFor = r.id === 'hands' ? r.pairs.filter((pr) => pr.b === v.me).map((pr) => pr.a) : [];
  const whisperedBy = r.id === 'whisperer' ? r.pairs.find((pr) => pr.a === v.me)?.b ?? null : null;
  const myKey = handsFor.length ? `${v.me}>${handsFor[0]}` : v.me;
  const mine = (r.myAnswers as Record<string, ({ choice: number | null; ms: number } | null)[]>)[myKey] ?? [];
  const limit = (q: number) => r.questions[q]?.limitMs ?? 10000;
  const clock = useQuestions(`${v.month}:${r.id}:${env.started}`, n, (q) => !!mine[q], limit, startAt, now);
  const q = clock.q;
  const [taps, setTaps] = useState<{ q: number; t: number[] }>({ q: -1, t: [0, 0, 0] });
  const fx = me.effects.map((e) => e.id);
  const frozen = fx.includes('frostbitten');
  const fever = fx.includes('feverish') ? Math.floor(now / 450) : null;

  const send = (qi: number, choice: number | null) => {
    const ms = clock.finish(qi);
    act({ type: 'ANSWER', q: qi, choice, ms: choice === null ? limit(qi) : ms });
  };
  // A question whose clock ran out counts as no answer, and the next one starts.
  useEffect(() => {
    if (clock.expired) send(q, null);
  }, [clock.expired, q]);

  const roundName = ROUND_NAME[r.id];
  const damage = rules.DAMAGE_CONTROL.includes(r.id);
  const bits = [damage ? 'damage control' : null, MODE_NAME[mode]].filter(Boolean);
  if (r.id === 'hero') bits.splice(0, bits.length, 'you are the Hero');
  if (r.id === 'supplier') bits.splice(0, bits.length, 'you are the Supplier');
  if (handsFor.length) bits.splice(0, bits.length, `you answer for ${handsFor.map((a) => nameOf(v, a)).join(' and ')}`);
  if (whisperedBy) bits.splice(0, bits.length, `${nameOf(v, whisperedBy)} whispers to you`);

  if (q >= n) {
    return (
      <Sheet v={v} seed={`round${r.id}done`}>
        <EffectRow effects={fx} />
        <Head title={roundName} sub={`${bits.join(' · ')} · all ${n} answered`} />
        {env.camp && mode === 'team-target' ? <CampBar camp={env.camp} /> : null}
        {x.risk ? <RiskPanel risk={x.risk} team={mode === 'team-vote'} /> : null}
        <T f={FELL} size={16} style={{ lineHeight: p(21), marginTop: p(2) }}>Your answers are in.</T>
        <Note>Waiting for the rest of the camp. The round closes when everyone has answered or the clock runs out.</Note>
        <Gauges health={me.health} jewels={me.jewels ?? 0} />
      </Sheet>
    );
  }

  const qt = question(r.questions[q].id);
  const t = taps.q === q ? taps.t : [0, 0, 0];
  const guide = x.guideHide && x.guideHide.q === q ? x.guideHide.choice : null;
  const fogged = r.fog[q] ?? null;
  const lit = whisperedBy ? r.signals[q] ?? null : null;
  const onPick = (i: number) => {
    if (frozen) {
      const nt = t.map((k, j) => (j === i ? k + 1 : k));
      setTaps({ q, t: nt });
      if (nt[i] < FROST_TAPS) return;
    }
    send(q, i);
  };
  const sub = [...bits, `question ${q + 1} of ${n}`, fx.includes('dehydrated') ? 'timer -30%' : null].filter(Boolean).join(' · ');
  const frostLeft = frozen ? Math.max(...t) : 0;
  const frostOn = t.indexOf(frostLeft);
  const fog = x.fogWrong && mode === 'team-vote' && !Object.keys(r.fog).length ? x.fogWrong[q] : null;

  let note: ReactNode = null;
  if (frozen)
    note = <Note>{frostLeft ? `Frozen: keep tapping a choice to break the ice. ${FROST_TAPS - frostLeft} taps left on ${LETTER[frostOn]}.` : `Frozen: tap a choice about ${FROST_TAPS} times to break the ice.`}</Note>;
  else if (damage && mode === 'team-vote') note = <Note>Votes stay hidden until time runs out. Ties go to the fastest voter.</Note>;

  return (
    <Sheet v={v} seed={`round${r.id}${q}`}>
      <EffectRow effects={fx} />
      <Head title={roundName} sub={sub} seconds={clock.left} limit={limit(q) / 1000} />
      {env.camp && mode === 'team-target' ? <CampBar camp={env.camp} /> : null}
      {x.risk ? <RiskPanel risk={x.risk} team={mode === 'team-vote'} /> : null}
      {whisperedBy ? (
        <PairLine color={colorOf(v, whisperedBy)}>
          {lit != null ? (
            <>
              {`${nameOf(v, whisperedBy)} lit `}
              <T f={CRIMB} size={12}>{LETTER[lit]}</T>
              {'. Trust it, or pick another. Each wrong answer costs you 6% health.'}
            </>
          ) : (
            `${nameOf(v, whisperedBy)} has not lit a choice yet. Each wrong answer costs you 6% health.`
          )}
        </PairLine>
      ) : null}
      {handsFor.length ? (
        <PairLine color={colorOf(v, handsFor[0])}>
          {`Your answer counts for ${handsFor.map((a) => nameOf(v, a)).join(' and ')}. Each wrong answer costs them 6% health; you risk nothing.`}
        </PairLine>
      ) : null}
      {r.id === 'hero' ? <PairLine color={me.color}>Get 2 of 3 right and win 2 jewels. Fail and everyone else loses 25% health.</PairLine> : null}
      {r.id === 'supplier' ? <SkimRow x={x} act={act} players={v.players.filter((pl) => pl.alive).length} /> : null}
      <T f={FELL} size={16} style={{ lineHeight: p(21), marginTop: p(2), opacity: fever != null ? 0.4 + 0.6 * wobble(fever) : 1 }}>{qt.q}</T>
      <Choices choices={qt.choices} st={{ lit, hidden: guide, fogged, taps: frozen ? t : null, fever }} onPick={onPick} />
      {fog != null ? (
        <Pressable onPress={() => act({ type: 'FOG', q, choice: fog })} accessibilityRole="button" style={s.fog}>
          <T f={CRIMI} size={11.5} color={TM.red}>{`Fog: blur ${LETTER[fog]} for the team on this question`}</T>
        </Pressable>
      ) : null}
      {note ? (
        <>
          <Helpers v={v} x={x} q={q} act={act} />
          {note}
        </>
      ) : (
        <Gauges health={me.health} jewels={me.jewels ?? 0} middle={<Helpers v={v} x={x} q={q} act={act} />} />
      )}
    </Sheet>
  );
}

/** Team-target rounds: right answers so far against the camp's target. */
function CampBar({ camp }: { camp: { done: number; target: number; max: number } }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: p(8) }}>
      <T size={10.5}>Camp total</T>
      <View style={s.bar}>
        <View style={[s.barFill, { width: `${Math.min(100, (camp.done / camp.max) * 100)}%` }]} />
        <View style={[s.barMark, { left: `${Math.min(100, (camp.target / camp.max) * 100)}%` }]} />
      </View>
      <T f={FELL} size={10.5}>{`${camp.done} / ${camp.target}`}</T>
    </View>
  );
}

/** The Supplier may secretly keep up to 20% of what they earn, as jewels. */
function SkimRow({ x, act, players }: { x: Extras; act: PageProps['act']; players: number }) {
  const [share, setShare] = useState<number>(x.skim ?? 0);
  const set = (k: number) => {
    const next = Math.round(Math.max(0, Math.min(rules.SUPPLIER_SKIM_MAX, k)) * 100) / 100;
    setShare(next);
    act({ type: 'SUPPLIER_SKIM', share: next });
  };
  return (
    <View style={{ gap: p(5) }}>
      <T size={12} style={{ lineHeight: p(16.6) }}>{`Each right answer earns the camp ${rules.SUPPLIER_COINS_PER_PLAYER * players} coins. Only you see your skim.`}</T>
      <View style={[s.step, { gap: p(8) }]}>
        <T f={FELL} size={10} style={[s.kicker, { flex: 1 }]}>Skim in secret</T>
        <Round_ label="−" onPress={() => set(share - 0.05)} />
        <T f={FELL} size={18} style={{ minWidth: p(40), textAlign: 'center' }}>{`${Math.round(share * 100)}%`}</T>
        <Round_ label="+" onPress={() => set(share + 0.05)} />
      </View>
    </View>
  );
}

const Round_ = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label === '+' ? 'More' : 'Less'} hitSlop={6} style={s.stepBtn}>
    <T size={15} style={{ lineHeight: p(18) }}>{label}</T>
  </Pressable>
);

// ---------------------------------------------------------------- the Whisperer

/** I whisper: I see the answer and light one choice for my guesser (I may lie). */
function WhisperSheet({ env, now, act, r, startAt }: SheetProps) {
  const v = env.view;
  const x = env.extras.round;
  const n = r.questions.length;
  const guessers = r.pairs.filter((pr) => pr.b === v.me).map((pr) => pr.a);
  const who = guessers.map((g) => nameOf(v, g)).join(' and ');
  const signals = x.whisper?.signals ?? [];
  const limit = (q: number) => r.questions[q]?.limitMs ?? 10000;
  const key = `${v.month}:${r.id}:${env.started}`;
  const clock = useQuestions(key, n, (q) => signals[q] != null, limit, startAt, now);
  const q = clock.q;
  const [sel, setSel] = useState<{ q: number; c: number } | null>(null);
  // A question I did not light in time just passes; my guesser answers without a light.
  useEffect(() => {
    if (clock.expired) clock.finish(q);
  }, [clock.expired, q]);
  const me = v.players.find((pl) => pl.id === v.me)!;

  if (q >= n)
    return (
      <Sheet v={v} seed="whisperdone">
        <Head title="The Whisperer" sub={`you whisper to ${who} · all ${n} lit`} />
        <T f={FELL} size={16} style={{ lineHeight: p(21) }}>Your lights are out.</T>
        <Note>{`${who} ${guessers.length > 1 ? 'are' : 'is'} still answering. Each wrong answer costs them 6% health.`}</Note>
        <Gauges health={me.health} jewels={me.jewels ?? 0} />
      </Sheet>
    );

  const qt = question(r.questions[q].id);
  const c = sel && sel.q === q ? sel.c : null;
  return (
    <Sheet v={v} seed={`whisper${q}`}>
      <Head title="The Whisperer" sub={`you whisper to ${who} · question ${q + 1} of ${n}`} seconds={clock.left} limit={limit(q) / 1000} />
      <PairLine color={colorOf(v, guessers[0])}>{`You know the answer. Light one choice for ${who}. You may lie.`}</PairLine>
      <T f={FELL} size={16} style={{ lineHeight: p(21), marginTop: p(2) }}>{qt.q}</T>
      <Choices choices={qt.choices} st={{ lit: c, answer: x.whisper?.answers[q] ?? null }} onPick={(i) => setSel({ q, c: i })} />
      <Cta
        label={c == null ? `Pick a choice to light for ${who}` : `Light ${LETTER[c]} for ${who}`}
        disabled={c == null}
        onPress={() => {
          if (c == null) return;
          clock.finish(q);
          act({ type: 'SIGNAL', q, choice: c });
        }}
      />
    </Sheet>
  );
}

// ---------------------------------------------------------------- watching

/** Someone else answers (my Hands partner, the Hero, the Supplier): I watch the camp's clock. */
function WatchSheet({ env, now, r }: PageProps & { r: Round }) {
  const v = env.view;
  const me = v.players.find((pl) => pl.id === v.me)!;
  const at = scheduleIndex(r, env.started, now);
  const n = r.questions.length;
  let sub = '';
  let line = '';
  let color = TM.ink;
  if (r.id === 'hands') {
    const b = r.pairs.find((pr) => pr.a === v.me)?.b;
    color = colorOf(v, b);
    sub = `${nameOf(v, b)} answers for you`;
    line = `${nameOf(v, b)} answers for you this round. Each wrong answer costs you 6% health.`;
  } else {
    const who = nameOf(v, r.chosen);
    color = colorOf(v, r.chosen);
    sub = `${who} is the ${r.id === 'hero' ? 'Hero' : 'Supplier'}`;
    line =
      r.id === 'hero'
        ? `${who} answers 3 questions alone. 2 right wins them 2 jewels; a miss costs everyone else 25% health.`
        : `${who} answers 5 questions alone. Each right answer earns the camp ${rules.SUPPLIER_COINS_PER_PLAYER * v.players.filter((pl) => pl.alive).length} coins.`;
  }
  const qt = at.q < n ? question(r.questions[at.q].id) : null;
  return (
    <Sheet v={v} seed={`watch${r.id}`}>
      <Head title={ROUND_NAME[r.id]} sub={qt ? `${sub} · question ${at.q + 1} of ${n}` : sub} seconds={qt ? at.left : undefined} limit={qt ? r.questions[at.q].limitMs / 1000 : undefined} />
      <PairLine color={color}>{line}</PairLine>
      {qt ? (
        <>
          <T f={FELL} size={16} style={{ lineHeight: p(21), marginTop: p(2) }}>{qt.q}</T>
          <Choices choices={qt.choices} st={{ disabled: true }} onPick={() => {}} />
        </>
      ) : (
        <Note>The answers are in. The round closes in a moment.</Note>
      )}
      <Gauges health={me.health} jewels={me.jewels ?? 0} />
    </Sheet>
  );
}

/** Ghosts watch the round read-only, the right answers marked. */
function GhostSheet({ env, now }: PageProps) {
  const v = env.view;
  const r = v.round;
  if (!r) return null;
  const n = r.questions.length;
  const at = r.stage === 'play' ? scheduleIndex(r, env.started, now) : { q: n, left: 0 };
  const qt = at.q < n ? question(r.questions[at.q].id) : null;
  const what = r.stage === 'pick' ? 'the camp is voting' : r.stage === 'bid' ? 'bids are being sealed' : qt ? `question ${at.q + 1} of ${n}` : 'the answers are in';
  return (
    <Sheet v={v} seed={`ghost${r.id}`}>
      <Head title={ROUND_NAME[r.id]} sub={`You are a Ghost: watching · ${what}`} seconds={qt ? at.left : undefined} limit={qt ? r.questions[at.q].limitMs / 1000 : undefined} />
      {env.camp && rules.ROUNDS[r.id].mode === 'team-target' ? <CampBar camp={env.camp} /> : null}
      {qt ? (
        <>
          <T f={FELL} size={16} style={{ lineHeight: p(21), marginTop: p(2) }}>{qt.q}</T>
          <Choices choices={qt.choices} st={{ disabled: true, answer: r.questions[at.q].answer ?? null }} onPick={() => {}} />
        </>
      ) : null}
      <Note>The living cannot see you. Your whisper waits for the next Gap.</Note>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Hero / Supplier vote

/** The camp votes one living player to answer alone (tie: the top scorer of the round before). */
function PickPage({ env, seconds, act, r }: PageProps & { r: Round }) {
  const v = env.view;
  const x = env.extras.round;
  const [sel, setSel] = useState<string | null>(null);
  const hero = r.id === 'hero';
  const picked = sel ?? x.myPick;
  const living = v.players.filter((pl) => pl.alive);
  const text = hero
    ? 'Buried Alive held. Pick one player to answer 3 questions alone: 2 right wins them 2 jewels; a miss costs everyone else 25% health.'
    : `The Signal Fire was seen. Pick one player to answer 5 questions alone, for ${rules.SUPPLIER_COINS_PER_PLAYER * living.length} coins a right answer. They may quietly keep up to 20%.`;
  const role = hero ? 'Hero' : 'Supplier';
  return (
    <Sheet v={v} seed={`pick${r.id}`}>
      <Head title={ROUND_NAME[r.id]} sub={`vote a ${role} · closes in 0:${String(Math.ceil(seconds)).padStart(2, '0')}`} />
      <T size={12.5} style={{ lineHeight: p(17.5), opacity: 0.85 }}>{text}</T>
      <View style={{ gap: p(6) }}>
        {living.map((pl) => {
          const on = picked === pl.id;
          return (
            <Pressable key={pl.id} onPress={() => setSel(pl.id)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={pl.name} style={[s.ch, { paddingVertical: p(6) }, on ? s.chOn : null]}>
              <Portrait color={pl.color} health={pl.health} size={28} />
              <T f={CRIM} size={13.5} style={{ flex: 1 }}>{pl.id === v.me ? 'You' : pl.name}</T>
              <T size={11} style={{ opacity: 0.7 }}>{`${Math.round(pl.health)}%`}</T>
            </Pressable>
          );
        })}
      </View>
      <Cta
        label={picked ? (x.myPick === picked ? `Your vote: ${nameOf(v, picked)}` : `Vote ${picked === v.me ? 'yourself' : nameOf(v, picked)} as ${role}`) : `Pick a ${role}`}
        disabled={!picked || x.myPick === picked}
        onPress={() => picked && act({ type: 'PICK', pick: picked })}
      />
      <Note center>Ties go to the top scorer of the round before.</Note>
    </Sheet>
  );
}

// ---------------------------------------------------------------- The Wager

/** A secret bid of my own jewels; only the pot's total is shown. */
function WagerBid({ env, seconds, act, r }: PageProps & { r: Round }) {
  const v = env.view;
  const me = v.players.find((pl) => pl.id === v.me)!;
  const max = (me.jewels ?? 0) + r.myBid;
  const [bid, setBid] = useState<number | null>(null);
  const b = Math.min(max, bid ?? r.myBid);
  // Sealed once the server holds this very bid (a bid of 0 counts once I pressed Seal).
  const sealed = r.myBid === b && (bid != null || r.myBid > 0);
  const secs = Math.ceil(seconds);
  return (
    <View style={{ flex: 1 }}>
      <MarkStrip players={v.players} me={v.me} />
      <View style={{ position: 'absolute', left: p(12), right: p(12), top: p(70) }}>
        <Paper seed="wager">
          <View style={{ gap: p(9) }}>
            <Kicker>{`Month ${v.month} · The Wager`}</Kicker>
            <T f={FELL} size={21} style={{ lineHeight: p(24) }}>Bet on the camp</T>
            <T size={12.5} style={{ lineHeight: p(17.5), opacity: 0.85 }}>
              {'Bid any of your jewels, in secret. If the camp reaches 60% correct, each bidder gets '}
              <T f={CRIMB} size={12.5}>double</T>
              {' their bid back.'}
            </T>
            <View style={s.pot}>
              <T f={FELL} size={10} style={[s.kicker, { textAlign: 'center' }]}>Pot so far</T>
              <T f={FELL} size={40} color={TM.red} style={{ lineHeight: p(44), textAlign: 'center' }}>{String(r.pot)}</T>
              <T size={10.5} style={{ opacity: 0.75, textAlign: 'center' }}>jewels · only the total is shown</T>
            </View>
            <Kicker>Your secret bid</Kicker>
            <View style={s.step}>
              <Round_ label="−" onPress={() => setBid(Math.max(0, b - 1))} />
              <T f={FELL} size={22} style={{ minWidth: p(16), textAlign: 'center' }}>{String(b)}</T>
              <T size={11.5} style={{ flex: 1, opacity: 0.8 }}>{`of your ${max} jewels`}</T>
              <Round_ label="+" onPress={() => setBid(Math.min(max, b + 1))} />
            </View>
            <View style={{ gap: p(4) }}>
              <T size={10.5} style={{ lineHeight: p(14) }}>
                <T f={CRIMB} size={10.5} color={TM.red}>{'Hit  '}</T>
                {b ? `you get ${b * 2} jewels back` : 'you get nothing back without a bid'}
              </T>
              <T size={10.5} style={{ lineHeight: p(14) }}>
                <T f={CRIMB} size={10.5} color={TM.red}>{'Miss  '}</T>
                bids are lost and the wallet drops 20%
              </T>
            </View>
            <Cta label={sealed ? `Sealed: ${b} jewels` : 'Seal my bid'} disabled={sealed} onPress={() => (setBid(b), act({ type: 'BID', jewels: b }))} />
            <Note center>{`Bids close in 0:${String(secs).padStart(2, '0')}`}</Note>
          </View>
        </Paper>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- Chain of Trust

/** One link each, in the chain's order: only my question (my place in the chain) is mine to answer. */
function ChainSheet({ env, now, act, r, startAt }: SheetProps) {
  const v = env.view;
  const x = env.extras.round;
  const chain = x.chain;
  const order = r.chainOrder;
  const k = order.indexOf(v.me);
  const links = chain?.links ?? order.map(() => null);
  const key = `${v.month}:chain:${env.started}`;
  // My turn starts when every link before me has answered, or when their clocks would have run out.
  const ready = links.slice(0, Math.max(0, k)).every((l) => l != null);
  if (ready && SEEN_AT[key] == null) SEEN_AT[key] = Math.max(now, startAt);
  const byClock = Math.max(startAt, env.started) + r.questions.slice(0, Math.max(0, k)).reduce((s_, q) => s_ + q.limitMs, 0);
  const turnAt = Math.min(SEEN_AT[key] ?? Infinity, byClock);
  const myLimit = r.questions[k]?.limitMs ?? 10000;
  const answered = links[k] != null || !!CLOCKS[key]?.sent[k];
  const myTurn = k >= 0 && now >= turnAt && !answered;
  const left = myTurn ? Math.max(0, (myLimit - (now - turnAt)) / 1000) : 0;
  const [picked, setPicked] = useState<number | null>(null);
  const send = (choice: number | null) => {
    (CLOCKS[key] ??= { q: k, since: turnAt, sent: {} }).sent[k] = true;
    act({ type: 'ANSWER', q: k, choice, ms: choice === null ? myLimit : Math.min(myLimit, now - turnAt) });
  };
  const late = myTurn && left <= 0;
  useEffect(() => {
    if (late) send(null);
  }, [late]);

  const current = links.findIndex((l) => l == null);
  const taker = links.findIndex((l) => l === 'right');
  const status = (i: number) => {
    const l = links[i];
    if (l) return l === 'timeout' ? 'timed out' : l;
    if (i === current) return 'now';
    if (i === current + 1) return 'next';
    return '';
  };
  const sub = myTurn ? 'your turn · answer WRONG' : answered ? 'you answered' : current >= 0 ? `${nameOf(v, order[current])}'s turn` : 'the chain is done';
  const qt = k >= 0 ? question(r.questions[k].id) : null;
  return (
    <Sheet v={v} seed="chain">
      <Head title={ROUND_NAME.chain} sub={`month ${v.month} · ${sub}`} seconds={myTurn ? left : undefined} limit={myTurn ? myLimit / 1000 : undefined} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {order.map((id, i) => {
          const pl = v.players.find((y) => y.id === id)!;
          const on = id === v.me && myTurn;
          const done = links[i] != null;
          return (
            <Fragment key={id}>
              {i ? <View style={s.link} /> : null}
              <View style={{ width: p(52), alignItems: 'center', opacity: done ? 0.55 : 1 }}>
                <View style={on ? s.chainOn : null}>
                  <Portrait color={pl.color} health={pl.health} size={28} />
                </View>
                <T f={CRIMB} size={11} color={id === v.me ? TM.red : TM.ink} style={{ marginTop: p(3), lineHeight: p(13) }} lines={1}>{id === v.me ? 'You' : pl.name}</T>
                <T size={9.5} style={{ opacity: 0.7, lineHeight: p(12) }}>{status(i)}</T>
              </View>
            </Fragment>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: p(8) }}>
        <T size={11}>Pot</T>
        <T f={FELL} size={16} style={{ flex: 1 }}>{`${chain?.pot ?? 0} jewels`}</T>
        <T size={11}>your stake</T>
        <T f={FELL} size={16}>{String(chain?.stake ?? 0)}</T>
      </View>
      {taker >= 0 ? <Note>{`${nameOf(v, order[taker])} answered right and takes the pot.`}</Note> : null}
      {qt && myTurn ? (
        <>
          <T f={FELL} size={16} style={{ lineHeight: p(21), marginTop: p(2) }}>{qt.q}</T>
          <Choices
            choices={qt.choices}
            st={{ picked }}
            onPick={(i) => {
              setPicked(i);
              send(i);
            }}
          />
        </>
      ) : (
        <T f={FELL} size={16} style={{ lineHeight: p(21), marginTop: p(2) }}>
          {answered ? 'Your link is set. Waiting for the rest of the chain.' : 'Your question comes when the links before you have answered.'}
        </T>
      )}
      <Note>A right answer takes the whole pot. All wrong: stakes back and +10% health each.</Note>
    </Sheet>
  );
}

// ---------------------------------------------------------------- obstacle and mission notes

/** What struck me this month (it lands when the round ends), why me, and the cure. */
function ObstacleNote({ v, x, effect, onSeen }: { v: View_; x: Extras; effect: EffectId; onSeen: () => void }) {
  const cure = (x.cures as Partial<Record<EffectId, { item: keyof typeof ITEM; price: number }>>)[effect];
  const why = x.star === v.me ? 'star' : x.weak === v.me ? 'weak' : null;
  const bag = v.players.find((pl) => pl.id === v.me)?.bag ?? [];
  const ready = cure && bag.includes(cure.item);
  const hit = rules.EFFECT_HIT[effect];
  return (
    <View style={{ flex: 1 }}>
      <MarkStrip players={v.players} me={v.me} star={x.star} weak={x.weak} />
      <View style={[StyleSheet.absoluteFill, s.mid]} pointerEvents="box-none">
        <Paper seed={`struck${v.month}${effect}`}>
          <View style={{ gap: p(9) }}>
            <Kicker>{`Month ${v.month} · struck`}</Kicker>
            <View style={{ flexDirection: 'row', gap: p(12), alignItems: 'center' }}>
              <Icon name={effect} size={58} />
              <View style={{ flex: 1 }}>
                <T f={FELL} size={21} style={{ lineHeight: p(24) }}>{EFFECT[effect].name}</T>
                <T size={12.5} style={{ lineHeight: p(17.5), opacity: 0.85 }}>{OBSTACLE_TEXT[effect] + (hit ? ` It costs ${hit}% health when it lands.` : '')}</T>
              </View>
            </View>
            {why ? (
              <View style={s.why}>
                {why === 'star' ? <Crown /> : <View style={[s.pulse, { position: 'relative', top: 0, right: 0 }]} />}
                <View style={{ flex: 1 }}>
                  <T f={CRIMB} size={13} style={{ lineHeight: p(16) }}>{why === 'star' ? 'Chosen as the Star Player' : 'Chosen as the Weak Link'}</T>
                  <T size={10.5} style={{ opacity: 0.75 }}>{why === 'star' ? 'most right answers over the last 3 months' : 'lowest health in the camp'}</T>
                </View>
              </View>
            ) : (
              <View style={s.rule} />
            )}
            {cure ? (
              <View style={{ gap: p(1) }}>
                <T size={10} style={[s.kicker, { fontFamily: CRIM }]}>Cure</T>
                <T f={FELL} size={16}>{`${ITEM[cure.item].name} · ${cure.price} coins`}</T>
                <T size={10.5} style={{ opacity: 0.75 }}>
                  {ready ? `The ${ITEM[cure.item].name.toLowerCase()} in your bag cures it when it lands.` : 'It lands when the round ends. Treat it in the next Gap: pay, ask for help or ignore'}
                </T>
              </View>
            ) : (
              <T size={10.5} style={{ opacity: 0.75 }}>It lands when the round ends.</T>
            )}
            <Cta label="Seen" onPress={onSeen} />
          </View>
        </Paper>
      </View>
    </View>
  );
}

/** The obstacle page's longer line for each effect (rule book §6). */
const OBSTACLE_TEXT: Record<EffectId, string> = {
  dehydrated: 'Your question timer runs 30% shorter, never below 4 seconds.',
  weak: 'You win at most 1 jewel a round.',
  hoarse: "You can't chat or send voice lines.",
  frostbitten: 'Your answers freeze. Tap a choice about 7 times to pick it.',
  feverish: 'Your answer letters fade and flicker.',
  anemic: 'Your health is capped at 70% until cured.',
  lost: "You can't buy anything in the next Gap.",
  snakebite: 'Then 5% more every month until cured.',
  'dog-bite': 'Rabies sets in after 2 months without the vaccine.',
  poisoned: 'Food heals nothing, and you lose 5% a month for 2 months.',
  'rat-bite': 'Plague: it spreads to whoever accepts your gift.',
};

/** My secret mission: a sealed envelope, then the card on tap, hidden again on the next tap. */
function MissionNote({ v, mission, onDone }: { v: View_; mission: View_['missions'][number]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const m = MISSION[mission.id];
  if (!open) return <Envelope kicker="Your secret mission" sub="Tap to open · only you can see it" seal="red" onPress={() => setOpen(true)} />;
  const reward = m.reward;
  return (
    <Pressable onPress={onDone} accessibilityRole="button" accessibilityLabel="Hide the mission" style={s.mid}>
      <Paper seed={`mission${v.month}`}>
        <View style={{ gap: p(9), alignItems: 'center' }}>
          <Kicker center>Your secret mission</Kicker>
          <T f={FELL} size={28} color={TM.red} style={{ lineHeight: p(31), textAlign: 'center' }}>{m.name}</T>
          <T size={12.5} style={{ lineHeight: p(17.5), opacity: 0.85, textAlign: 'center' }}>{m.text(nameOf(v, mission.target))}</T>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: p(8), justifyContent: 'center' }}>
            <T size={12}>Reward</T>
            <T f={FELL} size={reward.length > 12 ? 16 : 20}>{reward}</T>
          </View>
          <T f={CRIMI} size={11} style={{ opacity: 0.65 }}>Tap to hide.</T>
        </View>
      </Paper>
    </Pressable>
  );
}

/** Closed mail: a big cream envelope with a wax seal (red for missions, black for the Lifeline). */
function Envelope({ kicker, sub, seal, onPress }: { kicker: string; sub: string; seal: 'red' | 'black'; onPress: () => void }) {
  const w = p(224);
  const h = (w * 160) / 240;
  const [a, b, fg] = seal === 'red' ? ['#c0473a', '#7c1e15', '#f2c9b8'] : ['#3d3a36', '#0e0d0c', '#cfc6b8'];
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: p(60) }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${kicker}. ${sub}`} style={{ alignItems: 'center' }}>
        <View style={[s.env, { width: w, height: h }]}>
          <Svg viewBox="0 0 240 160" width={w} height={h}>
            <Defs>
              <LinearGradient id="envg" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#f1e5c9" />
                <Stop offset="1" stopColor="#e0cda5" />
              </LinearGradient>
              <RadialGradient id={`seal${seal}`} cx="35%" cy="30%" r="70%">
                <Stop offset="0" stopColor={a} />
                <Stop offset="1" stopColor={b} />
              </RadialGradient>
            </Defs>
            <Rect x={1} y={1} width={238} height={158} rx={3} fill="url(#envg)" stroke="rgba(42,31,22,0.25)" />
            <Path d="M2 158 L102 84 M238 158 L138 84" stroke="rgba(42,31,22,0.22)" strokeWidth={1} fill="none" />
            <Path d="M2 3 L120 92 L238 3" fill="#e8d7b2" stroke="rgba(42,31,22,0.3)" strokeWidth={1} />
            <Circle cx={120} cy={92} r={24} fill="rgba(0,0,0,0.25)" />
            <Circle cx={120} cy={92} r={23} fill={`url(#seal${seal})`} />
            <Circle cx={120} cy={92} r={20} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth={3} />
          </Svg>
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', top: h * 0.575 - p(9) }]}>
            <T f={FELL} size={12} color={fg} style={{ letterSpacing: p(1.2), lineHeight: p(16) }}>TMN</T>
          </View>
        </View>
        <T f={FELL} size={22} color={TM.cream} style={[s.shadow, { marginTop: p(22), lineHeight: p(26) }]}>{kicker}</T>
        <T f={CRIMI} size={13} color={TM.cream} style={[s.shadow, { marginTop: p(4), opacity: 0.9 }]}>{sub}</T>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------- Lifeline Contract

/** The Lifeline Contract offer (sealed, then opened), shown in the Gap of a Summer month when I hold one. */
export function LifelineNote({ env, onDone }: PageProps & { onDone: () => void }) {
  const v = env.view;
  const [open, setOpen] = useState(false);
  const l = v.lifeline;
  if (!l) return null;
  if (!open) return <Envelope kicker="A sealed offer" sub="Tap to open · only you can see it" seal="black" onPress={() => setOpen(true)} />;
  const who = v.players.find((pl) => pl.id === l.target)?.name ?? 'someone';
  return (
    <View style={s.mid}>
      <Paper seed={`lifeline${l.month}`}>
        <View style={{ gap: p(9) }}>
          <Kicker center>{`A sealed offer · month ${l.month}`}</Kicker>
          <T f={FELL} size={21} style={{ lineHeight: p(24), textAlign: 'center' }}>The Lifeline Contract</T>
          <T size={12.5} style={{ lineHeight: p(17.5), opacity: 0.85, textAlign: 'center' }}>
            {'If '}
            <T f={CRIMB} size={12.5}>{who}</T>
            {' dies this month, you get '}
            <T f={CRIMB} size={12.5}>{`${rules.LIFELINE_HEAL}% health`}</T>
            {` back and inherit their jewels. ${who} is never told.`}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: p(8) }}>
            <T f={CRIMI} size={12}>Signed</T>
            <View style={{ flex: 1, height: p(14), borderBottomWidth: 1, borderBottomColor: TM.ink }} />
          </View>
          <Note center>Only you see this offer. It pays whoever caused the death.</Note>
          <Cta label="Keep the contract" onPress={onDone} />
        </View>
      </Paper>
    </View>
  );
}

const s = StyleSheet.create({
  shadow: { textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  kicker: { letterSpacing: p(1.2), textTransform: 'uppercase', opacity: 0.75, lineHeight: p(13) },
  mid: { flex: 1, justifyContent: 'center', paddingHorizontal: p(12), paddingBottom: p(20) },
  rule: { height: 1, backgroundColor: LINE },
  cta: { alignItems: 'center', justifyContent: 'center', paddingVertical: p(9), backgroundColor: TM.ink },
  pulse: {
    position: 'absolute', top: -p(6), right: -p(6), width: p(14), height: p(14), borderRadius: p(7), backgroundColor: '#c0473a',
    shadowColor: '#c0473a', shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, borderWidth: 2, borderColor: 'rgba(192,71,58,0.35)',
  },
  why: { flexDirection: 'row', alignItems: 'center', gap: p(10), paddingVertical: p(7), borderTopWidth: 1, borderBottomWidth: 1, borderColor: LINE },
  dot: { width: p(9), height: p(9), borderRadius: p(5), marginTop: p(4) },
  fx: { flexDirection: 'row', alignItems: 'center', gap: p(4), paddingVertical: p(2), paddingLeft: p(3), paddingRight: p(7), borderWidth: 1, borderColor: TM.red },
  gauge: { flexDirection: 'row', alignItems: 'center', gap: p(6) },
  helper: { flexDirection: 'row', alignItems: 'center', gap: p(3), paddingVertical: p(3), paddingHorizontal: p(6), borderWidth: 1, borderColor: 'rgba(42,31,22,0.4)' },
  fog: { alignSelf: 'flex-start', paddingVertical: p(3), paddingHorizontal: p(7), borderWidth: 1, borderStyle: 'dashed', borderColor: TM.red },
  bar: { flex: 1, height: p(5), backgroundColor: 'rgba(42,31,22,0.15)' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: TM.ink },
  barMark: { position: 'absolute', top: -p(3), bottom: -p(3), width: 1.5, backgroundColor: TM.red },
  ch: { flexDirection: 'row', alignItems: 'center', gap: p(10), paddingVertical: p(9), paddingHorizontal: p(11), borderWidth: 1, borderColor: 'rgba(42,31,22,0.4)', overflow: 'hidden' },
  chOn: { backgroundColor: 'rgba(155,47,34,0.1)', borderColor: TM.red },
  chLit: { borderColor: TM.amber, borderWidth: 2, backgroundColor: 'rgba(217,164,65,0.14)', shadowColor: TM.amber, shadowOpacity: 0.55, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } },
  chFrost: { backgroundColor: 'rgba(214,232,240,0.75)', borderColor: '#8fb3c4' },
  letter: { width: p(22), height: p(22), borderRadius: p(11), borderWidth: 1, borderColor: TM.ink, alignItems: 'center', justifyContent: 'center' },
  letterOn: { backgroundColor: TM.red, borderColor: TM.red },
  tap: { width: p(4), height: p(9), borderWidth: 1, borderColor: '#5e8798' },
  risk: { flexDirection: 'row', alignItems: 'center', gap: p(10), paddingVertical: p(6), borderTopWidth: 1, borderBottomWidth: 1, borderColor: LINE },
  slice: { flex: 1, height: p(8), backgroundColor: TM.ink },
  sliceLost: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: TM.red },
  pot: { alignItems: 'center', paddingVertical: p(6), borderTopWidth: 1, borderBottomWidth: 1, borderColor: LINE },
  step: { flexDirection: 'row', alignItems: 'center', gap: p(10) },
  stepBtn: { width: p(26), height: p(26), borderRadius: p(13), borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center' },
  link: { flex: 1, borderTopWidth: 1.5, borderStyle: 'dotted', borderColor: TM.ink, marginTop: p(15), marginHorizontal: -p(4) },
  chainOn: { borderRadius: p(16), shadowColor: TM.red, shadowOpacity: 0.5, shadowRadius: 5, shadowOffset: { width: 0, height: 0 }, borderWidth: 2, borderColor: TM.red },
  env: { transform: [{ rotate: '-2deg' }], shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 10 } },
});
