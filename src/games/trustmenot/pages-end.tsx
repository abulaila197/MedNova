// Trust Me Not: after the round and the end of the year, in the all-paper look (locked 2026-10-07, preview pages
// 30-45): the ledger with its heat bar and my mission, trust stars, death, the Inquisition, a ghost's Gap, the Last
// Supper, the seven-part final reveal, the epilogue cards, the results and the pause page.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { TextInput } from '@/components/AppText';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { leaveRoom, rematchRoom } from '@/online/api';
import { finishOnline } from '@/online/finish';

import { gameDef } from '../shell/registry';
import type { Mission, MissionId, PlayerId } from './engine';
import { rules } from './engine';
import { Icon } from './icons';
import { CRIM, CRIMB, CRIMI, FELL, FELLI, p, Paper, Portrait, T, TM } from './paper';
import { ROUND_NAME, Strip } from './pages';
import type { PageProps } from './props';
import { EFFECT, ITEM, MEAL, question } from './text';

type View_ = PageProps['env']['view'];
type Pl = View_['players'][number];

const SEASON_TITLE = ['The Harvest', 'The Long Cold', 'The Rot', 'The Scorch'];
const LINE = 'rgba(42,31,22,0.18)';

const MISSION: Record<MissionId, { name: string; what: string }> = {
  skim: { name: 'Skim', what: 'take up to 10% of the wallet unseen' },
  steal: { name: 'Steal', what: 'take 2 jewels from {t}' },
  sabotage: { name: 'Sabotage', what: 'answer wrong so the team misses' },
  poisoner: { name: 'Poisoner', what: 'poison everyone and fake the icon' },
  'cold-shoulder': { name: 'Cold Shoulder', what: "refuse {t}'s help request" },
  guardian: { name: 'Guardian', what: 'keep {t} above 50% health' },
  'false-whisper': { name: 'False Whisper', what: 'mislead the guesser into 2 wrong' },
  'bad-hands': { name: 'Bad Hands', what: 'make the partner lose 2 answers' },
  'chain-breaker': { name: 'Chain Breaker', what: 'answer right and take the pot' },
  loyal: { name: 'Loyal', what: 'approve every request all season' },
  'fallen-hero': { name: 'Fallen Hero', what: 'get picked as Hero and fail' },
  'free-rider': { name: 'Free Rider', what: 'bid nothing while the others win' },
  'clock-thief': { name: 'Clock Thief', what: "take 5 s off {t}'s timer" },
  fog: { name: 'Fog', what: 'blur a wrong choice for the team' },
  'ghost-vote': { name: 'Ghost Vote', what: 'a team vote that counts twice' },
};
/** Missions carried out in the Gap after the month they were dealt. */
const GAP_MISSIONS: MissionId[] = ['skim', 'steal', 'cold-shoulder'];

const clock = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
const pct = (n: number) => `${Math.round(n)}%`;
const nameOf = (v: View_, id: PlayerId | null | undefined, you = 'You') => (id === v.me ? you : (v.players.find((x) => x.id === id)?.name ?? ''));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** A mission's short text with its target filled in ("your" when the target is me). */
const whatOf = (v: View_, m: { id: MissionId; target?: PlayerId }) => {
  const t = m.target === v.me ? null : nameOf(v, m.target);
  return MISSION[m.id].what.replace("{t}'s", t ? `${t}'s` : 'your').replace('{t}', t ?? 'you');
};

// ---------------------------------------------------------------- small pieces

const K = ({ children, red, style }: { children: ReactNode; red?: boolean; style?: object }) => (
  <T f={red ? CRIM : FELL} size={10} color={red ? TM.red : TM.ink} style={[{ letterSpacing: p(red ? 1.2 : 0.6), textTransform: 'uppercase', opacity: red ? 1 : 0.75, lineHeight: p(14) }, style]}>{children}</T>
);
const Title = ({ children, center }: { children: ReactNode; center?: boolean }) => (
  <T f={FELL} size={21} style={{ lineHeight: p(24), textAlign: center ? 'center' : 'left' }}>{children}</T>
);
const Sec = ({ children }: { children: ReactNode }) => (
  <T f={FELL} size={10} style={{ letterSpacing: p(0.6), textTransform: 'uppercase', opacity: 0.8, marginTop: p(2) }}>{children}</T>
);
const Dot = ({ color }: { color: string }) => <View style={{ width: p(8), height: p(8), borderRadius: p(4), backgroundColor: color }} />;

function Btn({ label, onPress, kind = 'ink', disabled, style, size = 14 }: { label: string; onPress: () => void; kind?: 'ink' | 'line' | 'red'; disabled?: boolean; style?: StyleProp<ViewStyle>; size?: number }) {
  const ink = kind === 'ink';
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      style={[s.btn, ink ? { backgroundColor: TM.ink } : { borderWidth: 1, borderColor: kind === 'red' ? TM.red : TM.ink }, disabled ? { opacity: 0.5 } : null, style]}>
      <T f={FELL} size={size} color={ink ? TM.paper : kind === 'red' ? TM.red : TM.ink} style={{ textAlign: 'center' }}>{label}</T>
    </Pressable>
  );
}

/** A star, filled red or faint. */
const Star = ({ on, size = 16, color = TM.red }: { on: boolean; size?: number; color?: string }) => (
  <Svg viewBox="0 0 24 24" width={p(size)} height={p(size)}>
    <Path d="M12 2.2l2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.5l7.1-.7z" fill={on ? color : 'rgba(42,31,22,0.2)'} />
  </Svg>
);

const HEAD = 'M20 6 a8 9 0 1 1 0 18 a8 9 0 1 1 0-18Z';
const BODY = 'M6 40 C6 30 12 26 20 25 C28 26 34 30 34 40 Z';
/** A bare silhouette with no ring: filled in the player's colour, or a dashed outline for the dead. */
function Sil({ color, size, dead }: { color: string; size: number; dead?: boolean }) {
  return (
    <Svg viewBox="0 0 40 40" width={p(size)} height={p(size)}>
      {dead ? (
        <>
          <Path d={HEAD} fill="none" stroke={TM.redSoft} strokeWidth={1} strokeDasharray="2 2" />
          <Path d={BODY} fill="none" stroke={TM.redSoft} strokeWidth={1} strokeDasharray="2 2" />
        </>
      ) : (
        <>
          <Path d={HEAD} fill={color} />
          <Path d={BODY} fill={color} />
        </>
      )}
    </Svg>
  );
}

/** A sheet under the strip (the "top" sheets of the preview). */
const TopSheet = ({ seed, children, gap = 7 }: { seed: string; children: ReactNode; gap?: number }) => (
  <ScrollView style={{ position: 'absolute', left: 0, right: 0, top: p(70), bottom: 0 }} contentContainerStyle={{ paddingHorizontal: p(12), paddingBottom: p(16) }} showsVerticalScrollIndicator={false}>
    <Paper seed={seed}>
      <View style={{ gap: p(gap) }}>{children}</View>
    </Paper>
  </ScrollView>
);
/** A sheet in the middle of the page; scrolls when it is taller than the screen. */
const MidSheet = ({ seed, children, gap = 6 }: { seed: string; children: ReactNode; gap?: number }) => (
  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: p(12), paddingVertical: p(14) }} showsVerticalScrollIndicator={false}>
    <Paper seed={seed}>
      <View style={{ gap: p(gap) }}>{children}</View>
    </Paper>
  </ScrollView>
);

const shade = { textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } };

// ---------------------------------------------------------------- ledger, death, trust stars

/** How I died, from what my own log and this month's requests show. */
function causeOf(v: View_, me: Pl) {
  const season = SEASON_TITLE[rules.seasonOf(v.month)].replace('The', 'the');
  const refused = v.requests.find((r) => r.by === v.me && r.kind === 'help' && r.status === 'refused');
  const poisonGift = v.gifts.some((g) => g.to === v.me && g.poisoned && g.status === 'accepted');
  const worst = me.effects.find((e) => e.rabies) ?? me.effects.find((e) => ['snakebite', 'poisoned', 'rat-bite'].includes(e.id));
  let tail = '';
  if (refused) tail = ` and the ${refused.item ? ITEM[refused.item].name.toLowerCase() : 'cure'} was refused`;
  else if (poisonGift) tail = ' and a poisoned gift';
  else if (worst) tail = ` and ${worst.rabies ? 'rabies' : EFFECT[worst.id].name.toLowerCase()} took the rest`;
  return `Health reached 0% after ${season} drained them${tail}.`;
}

/** My mission for the ledger's private box: what came of it this month (or nothing to show). */
function myMissionLine(v: View_) {
  const mine = v.missions.filter((m) => m.holder === v.me);
  const settled = mine.find((m) => m.status !== 'active' && (GAP_MISSIONS.includes(m.id) ? m.month === v.month - 1 : m.month === v.month));
  if (settled) {
    const n = MISSION[settled.id].name;
    if (settled.status === 'failed') return `Your mission ${n} failed.`;
    return settled.paid ? `Your mission ${n} worked: +${plural(settled.paid, 'jewel')}` : `Your mission ${n} worked.`;
  }
  const open = mine.find((m) => m.status === 'active');
  return open ? `Your mission ${MISSION[open.id].name} is still open.` : null;
}

/** The ledger phase: death (if I just died), the ledger with heat and my mission, trust stars at a season's end. */
export function LedgerFlow({ env, act }: PageProps) {
  const v = env.view;
  const self = v.players.find((x) => x.id === v.me)!;
  const died = !self.alive && self.diedMonth === v.month;
  const [step, setStep] = useState<'death' | 'ledger' | 'stars'>(died ? 'death' : 'ledger');
  const ready = env.ready.includes(v.me);
  const season = v.month % 3 === 0;
  if (step === 'death') return <DeathPage v={v} self={self} onRise={() => setStep('ledger')} />;
  if (step === 'stars') return <StarsPage {...{ env, act }} />;
  return <LedgerPage env={env} ready={ready} onGo={() => (season ? setStep('stars') : act({ type: 'ready' }))} />;
}

function DeathPage({ v, self, onRise }: { v: View_; self: Pl; onRise: () => void }) {
  return (
    <MidSheet seed={`death${v.month}`} gap={9}>
      <K>{`Month ${v.month} · the camp mourns`}</K>
      <View style={{ alignItems: 'center', marginTop: p(2) }}>
        <Sil color={self.color} size={70} dead />
      </View>
      <Title center>{`${self.name} did not survive`}</Title>
      <T size={12.5} style={{ textAlign: 'center', opacity: 0.85, lineHeight: p(17.5) }}>{causeOf(v, self)}</T>
      <View style={s.ghl}>
        <T f={FELL} size={15} color={TM.red} style={{ textAlign: 'center' }}>Now a Ghost</T>
        <T size={11} style={{ textAlign: 'center', lineHeight: p(15) }}>Watch any screen · one whisper a month · break tied votes · rate trust stars</T>
      </View>
      <Btn label="Rise as a Ghost" onPress={onRise} />
    </MidSheet>
  );
}

function LedgerPage({ env, ready, onGo }: { env: PageProps['env']; ready: boolean; onGo: () => void }) {
  const v = env.view;
  const x = env.extras.end;
  const round = env.plan[v.month - 1];
  const rows = [...v.players.filter((q) => q.alive), ...v.players.filter((q) => !q.alive)];
  const heat = Math.min(rules.HEAT_INQUISITION, v.heat);
  const why = x.heatWhy;
  const mission = myMissionLine(v);
  const cols = [1.6, 0.8, 0.9, 1];
  return (
    <MidSheet seed={`ledger${v.month}`}>
      <K>{`Ledger · end of month ${v.month}`}</K>
      <View style={{ marginBottom: p(4) }}>
        <Title>{round ? ROUND_NAME[round] : 'The year goes on'}</Title>
      </View>
      <View style={[s.row, { paddingTop: 0 }]}>
        {['Survivor', 'Right', 'Coins', 'Health'].map((h, i) => (
          <T key={h} size={9.5} style={[s.hd, { flex: cols[i], textAlign: i ? 'right' : 'left' }]}>{h}</T>
        ))}
      </View>
      {rows.map((q) => {
        const r = x.ledger.find((l) => l.id === q.id);
        return (
          <View key={q.id} style={[s.row, q.alive ? null : { opacity: 0.5 }]}>
            <View style={[s.nm, { flex: cols[0] }]}>
              <Dot color={q.color} />
              <T size={13}>{q.id === v.me ? 'You' : q.name}</T>
            </View>
            <T size={13} style={{ flex: cols[1], textAlign: 'right' }}>{q.alive ? String(r?.right ?? 0) : '–'}</T>
            <T size={13} style={{ flex: cols[2], textAlign: 'right' }}>{q.alive ? `+${r?.coins ?? 0}` : '–'}</T>
            <T size={13} style={{ flex: cols[3], textAlign: 'right' }}>{q.alive ? pct(q.health) : 'ghost'}</T>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: p(10), marginTop: p(8) }}>
        <T size={11}>Wallet now</T>
        <T f={FELL} size={17}>{String(v.wallet)}</T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: p(8), marginTop: p(4) }}>
        <T size={11}>Suspicion heat</T>
        <View style={{ flex: 1, flexDirection: 'row', gap: p(3) }}>
          {[0, 1, 2, 3, 4].map((k) => (
            <View key={k} style={[s.heatCell, k < heat ? { backgroundColor: '#b23a2c' } : null]} />
          ))}
        </View>
        <T f={FELL} size={16}>{`${heat} / ${rules.HEAT_INQUISITION}`}</T>
      </View>
      <T size={10} style={{ opacity: 0.75, lineHeight: p(13) }}>
        {`${why.length ? `+${why.length} this month: ${why.join(', ')}.` : 'No new suspicion this month.'} ${v.heat >= rules.HEAT_INQUISITION ? 'The Inquisition opens in the next Gap.' : 'At 5, the Inquisition opens.'}`}
      </T>
      {mission ? (
        <View style={s.mline}>
          <T size={9.5} color={TM.red} style={{ letterSpacing: p(0.8), textTransform: 'uppercase' }}>Only you see this</T>
          <T f={CRIMB} size={12.5}>{mission}</T>
        </View>
      ) : null}
      <Btn label={ready ? 'Waiting for the camp' : v.month % 3 === 0 ? 'Rate the camp' : 'Continue'} onPress={onGo} disabled={ready} style={{ marginTop: p(4) }} />
    </MidSheet>
  );
}

function StarsPage({ env, act }: Pick<PageProps, 'env' | 'act'>) {
  const v = env.view;
  const x = env.extras.end;
  const others = v.players.filter((q) => q.alive && q.id !== v.me);
  const [rate, setRate] = useState<Record<string, number>>(() => Object.fromEntries(others.map((q) => [q.id, x.myRatings[q.id] ?? 3])));
  const sealed = env.ready.includes(v.me);
  const seal = () => {
    act({ type: 'STARS', ratings: rate });
    act({ type: 'ready' });
  };
  return (
    <View style={{ flex: 1 }}>
      <Strip players={v.players} me={v.me} />
      <TopSheet seed={`stars${v.month}`}>
        <K>{`End of ${rules.SEASON_NAMES[rules.seasonOf(v.month)]} · month ${v.month}`}</K>
        <Title>Who do you trust?</Title>
        <T size={12.5} style={{ opacity: 0.85, lineHeight: p(17.5) }}>Rate every survivor from 0 to 5 stars. Your ratings stay hidden until the final reveal.</T>
        <View>
          {others.map((q) => (
            <View key={q.id} style={s.sr}>
              <View style={s.nm}>
                <Dot color={q.color} />
                <T size={14}>{q.name}</T>
              </View>
              <View style={{ flexDirection: 'row', gap: p(3) }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} disabled={sealed} hitSlop={3} accessibilityRole="button" accessibilityLabel={`${n} stars for ${q.name}`}
                    onPress={() => setRate((r) => ({ ...r, [q.id]: r[q.id] === n && n === 1 ? 0 : n }))}>
                    <Star on={n <= (rate[q.id] ?? 0)} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T size={11}>Your average from the camp so far</T>
          <T f={FELL} size={17}>{x.myStars == null ? '–' : x.myStars.toFixed(1)}</T>
        </View>
        <Pressable onPress={seal} disabled={sealed} accessibilityRole="button" accessibilityLabel="Seal my ratings" style={[s.sealrow, sealed ? { opacity: 0.6 } : null]}>
          <View style={s.seal}>
            <T f={FELL} size={8} color="#f2c9b8">TMN</T>
          </View>
          <T f={FELL} size={14} color={TM.paper}>{sealed ? 'Sealed · waiting for the camp' : 'Seal my ratings'}</T>
        </Pressable>
      </TopSheet>
    </View>
  );
}

// ---------------------------------------------------------------- inquisition

/** Gap step 2 when the Inquisition is open and I have not accused yet. */
export function InquisitionPage({ env, act, seconds }: PageProps) {
  const v = env.view;
  const suspects = v.players.filter((q) => q.alive && q.id !== v.me);
  const [pick, setPick] = useState<string | null>(null);
  const picked = suspects.find((q) => q.id === pick);
  return (
    <View style={{ flex: 1 }}>
      <Strip players={v.players} me={v.me} />
      <TopSheet seed={`inq${v.month}`}>
        <K red>Suspicion has boiled over</K>
        <Title>The Inquisition</Title>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: p(8) }}>
          <T size={10.5}>Heat</T>
          <View style={{ flex: 1, flexDirection: 'row', gap: p(3) }}>
            {[0, 1, 2, 3, 4].map((k) => <View key={k} style={{ flex: 1, height: p(7), backgroundColor: '#c0473a' }} />)}
          </View>
          <T f={FELL} size={16}>5 / 5</T>
        </View>
        <T f={FELL} size={18} style={{ marginTop: p(2) }}>Who betrayed the camp?</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p(8) }}>
          {suspects.map((q) => {
            const on = q.id === pick;
            return (
              <Pressable key={q.id} onPress={() => setPick(q.id)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Accuse ${q.name}`}
                style={[s.sus, { width: suspects.length === 4 ? '22.6%' : '30.9%' }, on ? { borderColor: '#c0473a', backgroundColor: 'rgba(192,71,58,0.12)' } : null]}>
                <Portrait color={q.color} health={q.health} size={36} />
                <T f={CRIMB} size={12} style={{ marginTop: p(3) }}>{q.name}</T>
                <T size={10} style={{ opacity: 0.7 }}>{pct(q.health)}</T>
              </Pressable>
            );
          })}
        </View>
        <View style={{ gap: p(4) }}>
          <T size={10.5}><T f={CRIMB} size={10.5} color={TM.red}>Right  </T>their mission is shown to all and they pay 2 jewels</T>
          <T size={10.5}><T f={CRIMB} size={10.5} color={TM.red}>Wrong  </T>everyone who voted for them pays 1 jewel</T>
        </View>
        <Btn label={picked ? `Accuse ${picked.name}` : 'Pick someone to accuse'} disabled={!picked} onPress={() => picked && act({ type: 'ACCUSE', target: picked.id })} />
        <T size={11} style={{ textAlign: 'center', opacity: 0.75 }}>{`Votes close in ${clock(seconds)}`}</T>
      </TopSheet>
    </View>
  );
}

// ---------------------------------------------------------------- ghost

/** A ghost's Gap: watching, one whisper a month, tie votes. */
export function GhostPage({ env, act }: PageProps) {
  const v = env.view;
  const self = v.players.find((q) => q.id === v.me)!;
  const living = v.players.filter((q) => q.alive);
  const [watch, setWatch] = useState(0);
  const [to, setTo] = useState<string | null>(living[0]?.id ?? null);
  const [text, setText] = useState('');
  const sent = env.extras.end.whispered;
  const w = living[watch % Math.max(1, living.length)];
  const mission = w ? (v.missions.find((m) => m.holder === w.id && m.status === 'active') ?? null) : null;
  const screen = w ? [`${pct(w.health)}`, plural(w.jewels ?? 0, 'jewel'), ...w.effects.map((e) => EFFECT[e.id].name), w.bag?.length ? `${plural(w.bag.length, 'item')} in the bag` : ''].filter(Boolean).join(' · ') : '';
  const target = living.find((q) => q.id === to);
  return (
    <View style={{ flex: 1 }}>
      <Strip players={v.players} me={v.me} />
      <TopSheet seed={`ghost${v.month}`}>
        <K red>{`You died in month ${self.diedMonth ?? v.month}`}</K>
        <Title>You are a Ghost</Title>
        <Sec>Watching</Sec>
        {w ? (
          <Pressable onPress={() => setWatch((k) => k + 1)} accessibilityRole="button" accessibilityLabel="Watch the next survivor" style={s.watch}>
            <Portrait color={w.color} health={w.health} />
            <View style={{ flex: 1 }}>
              <T f={CRIMB} size={13}>{`${w.name}’s screen`}</T>
              <T size={10.5} style={{ opacity: 0.75, lineHeight: p(14) }}>{screen}</T>
              <T size={10.5} style={{ opacity: 0.75, lineHeight: p(14) }}>
                {mission ? `their mission: ${MISSION[mission.id].name}, ${whatOf(v, mission)}` : 'no mission this month'}
              </T>
            </View>
            <T f={FELL} size={16} style={{ opacity: 0.6 }}>›</T>
          </Pressable>
        ) : null}
        <Sec>Whisper to</Sec>
        {sent ? (
          <T f={CRIMI} size={13} style={{ lineHeight: p(18) }}>{`You whispered to ${nameOf(v, sent.to)}: “${sent.text}”`}</T>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: p(4), flexWrap: 'wrap' }}>
              {living.map((q) => {
                const on = q.id === to;
                return (
                  <Pressable key={q.id} onPress={() => setTo(q.id)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Whisper to ${q.name}`}
                    style={[s.pk, on ? { borderColor: TM.red, backgroundColor: 'rgba(42,31,22,0.07)' } : null]}>
                    <Portrait color={q.color} health={q.health} size={28} />
                    <T f={CRIMB} size={11} style={{ marginTop: p(2) }} lines={1}>{q.name}</T>
                  </Pressable>
                );
              })}
            </View>
            <TextInput value={text} onChangeText={setText} maxLength={140} multiline placeholder="Write one private whisper…" placeholderTextColor="rgba(42,31,22,0.45)"
              style={s.inp} accessibilityLabel="Whisper" />
            <Btn label={target ? `Send whisper to ${target.name}` : 'Send whisper'} disabled={!target || !text.trim()} onPress={() => target && act({ type: 'WHISPER', to: target.id, text: text.trim() })} />
          </>
        )}
        <T size={10} style={{ textAlign: 'center', opacity: 0.65 }}>{sent ? '0 left this month · they may believe it, or not' : '1 left this month · private · you may lie'}</T>
        <Sec>Tie vote</Sec>
        <T size={11.5} style={{ lineHeight: p(15.5) }}>If a supply request ties in step 2, the Ghosts decide it. Your vote counts only then.</T>
      </TopSheet>
    </View>
  );
}

// ---------------------------------------------------------------- last supper

/** Month 12's first 30 seconds of the Gap: give one person 1 jewel, or nothing. */
export function LastSupperPage({ env, act, now }: PageProps) {
  const v = env.view;
  const seats = v.players.filter((q) => q.alive);
  const [pick, setPick] = useState<string | null>(null);
  const picked = seats.find((q) => q.id === pick);
  const left = Math.max(0, 30 - (now - env.started) / 1000);
  return (
    <View style={{ flex: 1 }}>
      <Strip players={v.players} me={v.me} />
      <TopSheet seed="supper">
        <K>Month 12 · the last Gap</K>
        <Title>The Last Supper</Title>
        <T size={12.5} style={{ opacity: 0.85, lineHeight: p(17.5) }}>30 silent seconds. Pick one person and give them 1 jewel, or give nothing. Everyone’s choice shows at once.</T>
        <View style={{ height: p(190) }}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Ellipse cx="50%" cy="50%" rx={p(60)} ry={p(35)} fill="rgba(42,31,22,0.06)" stroke={TM.line} strokeWidth={1} />
          </Svg>
          {seats.map((q, i) => {
            // Seats around the oval, starting top left and going round.
            const a = (-125 + (360 * i) / seats.length) * (Math.PI / 180);
            const on = q.id === pick;
            const mine = q.id === v.me;
            return (
              <Pressable key={q.id} disabled={mine} onPress={() => setPick(q.id)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Give ${q.name} 1 jewel`}
                style={[s.seat, { transform: [{ translateX: Math.cos(a) * p(80) }, { translateY: Math.sin(a) * p(68) }] }]}>
                <View style={on ? s.glow : null}>
                  <Portrait color={q.color} health={q.health} />
                </View>
                <T f={CRIMB} size={11} color={on ? TM.red : TM.ink} style={{ marginTop: p(2) }} lines={1}>{mine ? 'You' : q.name}</T>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: p(6) }}>
          <Btn label={picked ? `Give ${picked.name} 1 jewel` : 'Pick a seat'} size={12} disabled={!picked} onPress={() => picked && act({ type: 'LAST_SUPPER', to: picked.id })} style={{ flex: 1 }} />
          <Btn label="Give nothing" kind="red" size={12} onPress={() => act({ type: 'LAST_SUPPER', to: null })} style={{ flex: 1 }} />
        </View>
        <T size={11} style={{ textAlign: 'center', opacity: 0.75 }}>{clock(left)}</T>
      </TopSheet>
    </View>
  );
}

// ---------------------------------------------------------------- the final reveal

/** Epilogue lines from the writing file §1, by line number; placeholders filled on the phone. */
const EPILOGUE: Record<number, string> = {
  1: 'Starved in {month}. {name} gave away the last meal they had.',
  2: '{name} fell in {month}, still owed {n} jewels nobody will collect.',
  3: 'The snake found {name} in {month}. The antivenom request came one vote short.',
  4: '{name} died in {month} with {n} jewels hidden. They never spent them.',
  5: '{name} trusted the wrong gift. Poison took them in {month}.',
  6: 'Rabies came for {name} in {month}. The vaccine was on the shelf.',
  7: "The plague spread through {name}'s kindness. They died in {month}.",
  8: '{name} was the first to go. The camp never said their name again.',
  9: '{name} was the last to go, in {month}, so close to the rescue column.',
  10: 'Winter took {name}. The blanket they needed cost one jewel too many.',
  11: "{name} died in {month}. The camp's jar was full that night.",
  12: '{name} slipped away in {season}. Nobody noticed until morning.',
  13: 'Even dead, {name} kept talking. {n} of their whispers were believed.',
  14: "{name}'s ghost lied in every whisper. Somehow it helped.",
  15: "{name} watched the rest of the year from the well's edge, and said nothing.",
  16: "{name}'s ghost broke {n} ties. The living never knew who decided.",
  17: '{name} survived, richer than anyone, and nobody knows how.',
  18: '{name} took {n} coins from the jar. They will carry that home.',
  19: '{name} lived, but the Inquisition named them in {month}. They walk out alone.',
  20: "{name} sold the camp's trust for {n} jewels. It was enough to live.",
  21: '{name} lit the false signal and walked away first.',
  22: '{name} bid nothing and kept everything.',
  23: '{name} answered right when it mattered most, and took the whole pot.',
  24: '{name} poisoned the well in {month}. Nobody ever pointed at them.',
  25: '{name} survived and kept {other} alive with them.',
  26: '{name} approved every request, all {season}. The camp remembers.',
  27: '{name} gave more than they kept, and still walked out.',
  28: '{name} paid for {n} cures that were not theirs.',
  29: "{name} was the camp's doctor in all but name.",
  30: 'Everyone trusted {name}. For once, they were right to.',
  31: '{name} lived on scraps for {n} months and made it.',
  32: '{name} walked out with {n} jewels and a cough that never left.',
  33: '{name} crawled to the rescue column at {n}% health. It was enough.',
  34: '{name} was wrongly accused in {month}, and survived anyway.',
  35: '{name} read every face in the camp correctly.',
  36: 'Nobody trusted {name}. They lived anyway.',
  37: '{name} called in every debt, and every debt was paid.',
  38: '{name} gave a jewel at the Last Supper and kept their place at the table.',
  39: '{name} kept quiet, kept fed, and kept going.',
  40: '{name} made it through the Year of Hunger. Barely.',
};

const AWARDS: { id: string; label: string }[] = [
  { id: 'best-betrayer', label: 'Best Betrayer' },
  { id: 'most-trusted', label: 'Most Trusted' },
  { id: 'loudest-ghost', label: 'Loudest Ghost' },
  { id: 'best-doctor', label: 'Best Doctor' },
  { id: 'most-distrusted', label: 'Most Distrusted' },
  { id: 'best-reader-of-the-room', label: 'Best Reader' },
];

type Reveal = NonNullable<PageProps['env']['reveal']>;
type Year = NonNullable<PageProps['env']['extras']['end']['year']>;

/** Final places: survivors by score, then the dead, the last to fall first (as the server's finalOrder). */
function placesOf(v: View_, rv: Reveal) {
  const dead = v.players.filter((q) => !q.alive).sort((a, b) => (b.diedMonth ?? 0) - (a.diedMonth ?? 0));
  return [...rv.ranking.map((r) => r.id), ...dead.map((q) => q.id)];
}

/**
 * The year becomes an ordinary play on this phone (as every online game does) as soon as the reveal opens, so
 * leaving early still pays: EXP from the reveal, and the misses in solo rounds feed Today's review.
 */
function useFinish(env: PageProps['env'], roomId: string) {
  const { match } = useLocalSearchParams<{ match?: string }>();
  const finishing = useRef(false);
  const v = env.view;
  const rv = env.reveal;
  useEffect(() => {
    const def = gameDef('trust-me-not');
    if (!def || !match || !rv || finishing.current) return;
    finishing.current = true;
    const order = placesOf(v, rv);
    const local = [v.me, ...v.players.map((q) => q.id).filter((id) => id !== v.me)];
    const seats = local.map((id, i) => ({ seat: i, name: id === v.me ? 'You' : (v.players.find((q) => q.id === id)?.name ?? ''), color: v.players.find((q) => q.id === id)?.color }));
    const score = (id: PlayerId) => Math.round(rv.ranking.find((r) => r.id === id)?.score ?? 0);
    const standings = local.map((id, i) => ({ seat: i, name: seats[i].name, score: score(id), timeMs: 0, rank: order.indexOf(id) + 1 })).sort((a, b) => a.rank - b.rank);
    const items = rv.missed.map((id) => {
      const q = question(id);
      return {
        seat: 0, itemId: id, answerKey: q.dossier ?? null, outcome: 'wrong' as const, answersGiven: [], timeMs: 0, hintsUsed: 0, revealsUsed: 0, points: 0,
        feedsLearn: true, // §7.3: misses in solo rounds go to Today's review
        gameData: { topic: q.topic, room: roomId, match },
      };
    });
    finishOnline(def, match, { settings: { room: roomId, match, exp: rv.exp }, seats, standings, score: score(v.me), items }).catch(() => {
      finishing.current = false;
    });
  }, [match, roomId, rv, v]);
}

/** The end: final reveal (7 parts), epilogue cards, then results. */
export function RevealFlow({ env, roomId }: PageProps) {
  const [part, setPart] = useState(0);
  useFinish(env, roomId);
  const v = env.view;
  const rv = env.reveal;
  const year = env.extras.end.year;
  if (!rv || !year) return null;
  const order = placesOf(v, rv);
  const next = () => setPart((k) => k + 1);
  if (part >= 8) return <ResultsPage env={env} rv={rv} order={order} roomId={roomId} />;
  if (part === 7) return <EpiloguePage v={v} rv={rv} year={year} order={order} onNext={next} />;
  return <RevealPart part={part} v={v} rv={rv} year={year} order={order} onSkip={() => setPart(7)} onNext={next} />;
}

const INTRO = [
  'Who walked out, and who stayed behind.',
  'Jewels at the end of each season.',
  'Who answered right, and who fed the jar.',
  'Every sealed envelope, opened.',
  'Every secret vote, with names.',
  'Who you trusted, and who betrayed you.',
  'The year, remembered.',
];

function RevealPart({ part, v, rv, year, order, onSkip, onNext }: { part: number; v: View_; rv: Reveal; year: Year; order: PlayerId[]; onSkip: () => void; onNext: () => void }) {
  const pl = (id: PlayerId) => v.players.find((q) => q.id === id)!;
  const nm = (id: PlayerId | null | undefined) => nameOf(v, id);
  const yr = (id: PlayerId) => year.players.find((q) => q.id === id)!;
  const survivors = v.players.filter((q) => q.alive);
  const betrayer = (id: PlayerId) => rv.missions.some((m) => m.holder === id && rules.MISSIONS[m.id].betrayal);
  const NameCell = ({ id, w = 62 }: { id: PlayerId; w?: number }) => (
    <View style={[s.nm, { width: p(w) }]}>
      <Dot color={pl(id).color} />
      <T size={12.5} lines={1} style={{ flexShrink: 1 }}>{nm(id)}</T>
    </View>
  );
  let title = '';
  let body: ReactNode = null;
  if (part === 0) {
    title = survivors.length === 0 ? 'No one survived' : survivors.length === 1 ? `Only ${nameOf(v, survivors[0].id)} survived` : `${survivors.length} of ${v.players.length} survived`;
    body = (
      <View>
        <View style={s.tl}>
          <View style={{ width: p(62) }} />
          <View style={s.tr}>
            {rules.SEASON_NAMES.flatMap((_, si) => [1, 2, 3].map((k) => si * 3 + k)).map((m) => (
              <T key={m} size={8} style={{ flex: 1, textAlign: 'center', opacity: 0.65, lineHeight: p(10) }}>{String(m)}</T>
            ))}
          </View>
          <View style={{ width: p(56) }} />
        </View>
        {order.map((id) => {
          const d = pl(id).diedMonth;
          return (
            <View key={id} style={[s.tl, { paddingVertical: p(8) }]}>
              <NameCell id={id} />
              <View style={s.tr}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <View key={m} style={[s.cell, d != null && m === d ? { backgroundColor: TM.red, opacity: 1 } : d != null && m > d ? s.cellOff : null]} />
                ))}
              </View>
              <T f={CRIMB} size={10.5} style={{ width: p(56), textAlign: 'right' }}>{d == null ? 'survived' : `died m${d}`}</T>
            </View>
          );
        })}
      </View>
    );
  } else if (part === 1) {
    title = 'Every stash';
    const top = Math.max(1, ...year.players.flatMap((q) => q.stash));
    // The biggest jump in one season, and what fed it.
    let jump = { id: '', season: 0, from: 0, to: 0 };
    for (const q of year.players)
      q.stash.forEach((n, si) => {
        const from = si ? q.stash[si - 1] : rules.START_JEWELS;
        if (n - from > jump.to - jump.from) jump = { id: q.id, season: si, from, to: n };
      });
    const fed = jump.id
      ? [
          ...[yr(jump.id).skimmed, yr(jump.id).stolen].map((list, k) => {
            const n = list.filter((l) => rules.seasonOf(l.month) === jump.season).reduce((s2, l) => s2 + (k ? l.n : Math.floor(l.n / rules.JEWEL_COINS)), 0);
            return n ? `${n} ${k ? 'stolen' : 'skimmed'}` : '';
          }),
        ].filter(Boolean)
      : [];
    body = (
      <View style={{ gap: p(6) }}>
        {order.map((id) => (
          <View key={id} style={s.sh}>
            <NameCell id={id} />
            <View style={{ flex: 1, flexDirection: 'row', gap: p(6), alignItems: 'flex-end', height: p(38) }}>
              {yr(id).stash.map((n, i) => (
                <View key={i} style={{ flex: 1, height: p(3 + (35 * n) / top), backgroundColor: i === 3 ? TM.red : TM.ink }} />
              ))}
            </View>
          </View>
        ))}
        {jump.id ? (
          <T size={11} style={{ opacity: 0.75, lineHeight: p(15) }}>
            {`${nm(jump.id)}’s stash grew most in ${rules.SEASON_NAMES[jump.season]}: ${jump.from} to ${jump.to} jewels${fed.length ? `, ${fed.join(' and ')}` : ''}.`}
          </T>
        ) : null}
      </View>
    );
  } else if (part === 2) {
    title = 'Who carried the camp';
    body = (
      <View style={{ gap: p(6) }}>
        <View style={[s.row, { paddingTop: 0 }]}>
          {['Survivor', 'Accuracy', 'To wallet'].map((h, i) => <T key={h} size={9.5} style={[s.hd, { flex: i ? 1 : 1.5, textAlign: i ? 'right' : 'left' }]}>{h}</T>)}
        </View>
        {order.map((id) => {
          const q = yr(id);
          return (
            <View key={id} style={s.row}>
              <View style={[s.nm, { flex: 1.5 }]}><Dot color={pl(id).color} /><T size={13}>{nm(id)}</T></View>
              <T size={13} style={{ flex: 1, textAlign: 'right' }}>{q.accuracy == null ? '–' : pct(q.accuracy * 100)}</T>
              <T size={13} style={{ flex: 1, textAlign: 'right' }}>{`+${q.toWallet}`}</T>
            </View>
          );
        })}
      </View>
    );
  } else if (part === 3) {
    title = 'Every mission';
    const ms = [...rv.missions].sort((a, b) => a.month - b.month);
    body = ms.length ? (
      <ScrollView style={{ maxHeight: p(340) }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {ms.map((m, i) => (
          <View key={i} style={s.msn}>
            <NameCell id={m.holder} w={58} />
            <View style={{ flex: 1 }}>
              <T f={FELL} size={14} style={{ lineHeight: p(17) }}>{MISSION[m.id].name}</T>
              <T size={10.5} style={{ opacity: 0.75, lineHeight: p(14) }}>{missionDetail(m, v)}</T>
            </View>
            <View style={[s.tag, m.status === 'done' ? null : { borderColor: TM.red }]}>
              <T size={10.5} color={m.status === 'done' ? TM.ink : TM.red}>{m.status === 'done' ? 'worked' : m.status === 'failed' ? 'failed' : 'unused'}</T>
            </View>
          </View>
        ))}
      </ScrollView>
    ) : (
      <T size={12.5} style={{ opacity: 0.85 }}>No one held a mission this year.</T>
    );
  } else if (part === 4) {
    title = 'Every secret vote';
    const rq = [...year.requests].sort((a, b) => a.month - b.month);
    const more = rq.slice(2).reduce((n, r) => n + r.votes.length, 0);
    body = rq.length ? (
      <View>
        <ScrollView style={{ maxHeight: p(300) }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {rq.map((r) => (
            <View key={r.id} style={s.um}>
              <T f={FELL} size={14}>{`${nm(r.by)}’s ${r.item ? ITEM[r.item].name.toLowerCase() : r.meal ? MEAL[r.meal] : r.effect ? `${EFFECT[r.effect].name} cure` : 'request'} · month ${r.month}`}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: p(4) }}>
                {r.votes.map((x) => (
                  <View key={x.id} style={[s.nm, { width: '50%', gap: p(5) }]}>
                    <Dot color={pl(x.id).color} />
                    <T size={11.5} color={x.approve ? TM.ink : TM.red}>{`${nm(x.id)} ${x.approve ? 'approved' : 'refused'}`}</T>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
        {more ? <T size={11} style={{ opacity: 0.75, marginTop: p(6) }}>{`${more} more votes below`}</T> : null}
      </View>
    ) : (
      <T size={12.5} style={{ opacity: 0.85 }}>No one asked the camp for anything this year.</T>
    );
  } else if (part === 5) {
    title = 'Trust against truth';
    const rows = [...v.players].sort((a, b) => (rv.stars[b.id] ?? -1) - (rv.stars[a.id] ?? -1));
    // The widest gap where a betrayer was trusted above someone who never betrayed.
    let pair: [PlayerId, PlayerId] | null = null;
    let gap = 0;
    for (const b of rows) for (const l of rows) {
      const d = (rv.stars[b.id] ?? 0) - (rv.stars[l.id] ?? 0);
      if (betrayer(b.id) && !betrayer(l.id) && rv.stars[b.id] != null && rv.stars[l.id] != null && d > gap) {
        gap = d;
        pair = [b.id, l.id];
      }
    }
    body = (
      <View style={{ gap: p(6) }}>
        <View style={[s.row, { paddingTop: 0 }]}>
          {['Survivor', 'Stars', 'Really'].map((h, i) => <T key={h} size={9.5} style={[s.hd, { flex: i ? 1 : 1.5, textAlign: i ? 'right' : 'left' }]}>{h}</T>)}
        </View>
        {rows.map((q) => (
          <View key={q.id} style={s.row}>
            <View style={[s.nm, { flex: 1.5 }]}><Dot color={q.color} /><T size={13}>{nm(q.id)}</T></View>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: p(4) }}>
              <T size={13}>{rv.stars[q.id] == null ? '–' : rv.stars[q.id]!.toFixed(1)}</T>
              {rv.stars[q.id] == null ? null : <Star on size={12} color={TM.ink} />}
            </View>
            <T f={betrayer(q.id) ? CRIMB : CRIM} size={13} color={betrayer(q.id) ? TM.red : TM.ink} style={{ flex: 1, textAlign: 'right' }}>{betrayer(q.id) ? 'betrayed' : 'loyal'}</T>
          </View>
        ))}
        <T size={11} style={{ opacity: 0.75, lineHeight: p(15) }}>
          {pair ? `The camp trusted ${nameOf(v, pair[0], 'you')} more than ${nameOf(v, pair[1], 'you')}, who never betrayed.` : 'The camp’s stars matched the truth.'}
        </T>
      </View>
    );
  } else {
    title = 'Ranking and awards';
    const aw = rv.awards as Record<string, PlayerId | undefined>;
    body = (
      <View style={{ gap: p(6) }}>
        {rv.ranking.map((r, i) => {
          const q = pl(r.id);
          const j = yr(r.id).jewels;
          return (
            <View key={r.id} style={s.rr}>
              <T size={13} style={{ width: p(14) }}>{String(i + 1)}</T>
              <View style={{ width: p(40), alignItems: 'center' }}><Sil color={q.color} size={26} /></View>
              <View style={{ flex: 1 }}>
                <T size={15} style={{ lineHeight: p(17) }}>{nm(r.id)}</T>
                <T size={10.5} style={{ opacity: 0.75 }}>{`${pct(q.health)} + ${plural(j, 'jewel')}`}</T>
              </View>
              <T f={FELL} size={17}>{String(Math.round(r.score))}</T>
            </View>
          );
        })}
        {rv.ranking.length === 0 ? <T size={12.5} style={{ opacity: 0.85 }}>No one is left to rank.</T> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p(6), marginTop: p(4) }}>
          {AWARDS.filter((a) => aw[a.id]).map((a) => (
            <View key={a.id} style={s.award}>
              <Icon name={a.id} size={26} />
              <T size={8.5} style={{ letterSpacing: p(0.4), textTransform: 'uppercase', opacity: 0.75, textAlign: 'center', lineHeight: p(12) }}>{a.label}</T>
              <T f={FELL} size={13} lines={1}>{nm(aw[a.id])}</T>
            </View>
          ))}
        </View>
      </View>
    );
  }
  return (
    <MidSheet seed={`reveal${part}`}>
      <K>{`Final reveal · part ${part + 1} of 7`}</K>
      <Title>{title}</Title>
      <T size={12.5} style={{ opacity: 0.85, lineHeight: p(17.5), marginBottom: p(4) }}>{INTRO[part]}</T>
      {body}
      <View style={s.skip}>
        {part < 6 ? (
          <Pressable onPress={onSkip} accessibilityRole="button" accessibilityLabel="Skip the reveal" hitSlop={8}>
            <T f={FELL} size={13}>Skip</T>
          </Pressable>
        ) : <View />}
        <Pressable onPress={onNext} accessibilityRole="button" accessibilityLabel="Next" hitSlop={8}>
          <T f={FELL} size={13} color={TM.red}>Next ›</T>
        </Pressable>
      </View>
    </MidSheet>
  );
}

/** One line on what came of a mission (the reveal's part 4). */
function missionDetail(m: Mission, v: View_) {
  const t = nameOf(v, m.target);
  const holder = v.players.find((q) => q.id === m.holder);
  if (m.status === 'done') {
    if (m.id === 'skim') return `took ${Number(m.data.coins ?? 0)} coins in month ${m.month + 1}`;
    if (m.id === 'guardian') return `${t} stayed above 50%`;
    if (m.id === 'steal') return `took ${plural(m.paid, 'jewel')} from ${t}`;
    if (m.id === 'free-rider' || m.id === 'chain-breaker') return `kept ${plural(m.paid, 'jewel')} from the pot`;
    return `month ${m.month}${m.paid ? ` · paid ${plural(m.paid, 'jewel')}` : ''}`;
  }
  if (holder?.diedMonth != null && holder.diedMonth <= m.month) return 'died before it was done';
  if (m.id === 'guardian') return `${t} fell below 50%`;
  return `month ${m.month} · ${whatOf(v, m)}`;
}

function EpiloguePage({ v, rv, year, order, onNext }: { v: View_; rv: Reveal; year: Year; order: PlayerId[]; onNext: () => void }) {
  const fill = (id: PlayerId) => {
    const q = v.players.find((x) => x.id === id)!;
    const e = year.players.find((x) => x.id === id)!.epilogue;
    let season = e.month ? rules.SEASON_NAMES[rules.seasonOf(e.month)] : rules.SEASON_NAMES[rules.seasonOf(q.diedMonth ?? 12)];
    if (e.line === 26) {
      const loyal = rv.missions.find((m) => m.holder === id && m.id === 'loyal');
      if (loyal) season = rules.SEASON_NAMES[rules.seasonOf(loyal.month)];
    }
    return (EPILOGUE[e.line] ?? EPILOGUE[40])
      .replace('{name}', q.name)
      .replace('{month}', `month ${e.month ?? q.diedMonth ?? 12}`)
      .replace('{season}', season)
      .replace('{n}', String(Math.round(e.n ?? 0)))
      .replace('{other}', nameOf(v, e.other, 'you'));
  };
  const tilt = [{ rotate: '-1.2deg' }, { rotate: '1deg' }, { rotate: '-0.6deg' }];
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: p(16), paddingTop: p(30), paddingBottom: p(30), gap: p(14) }} showsVerticalScrollIndicator={false}>
      <T f={FELLI} size={22} color={TM.cream} style={[shade, { textAlign: 'center', lineHeight: p(28) }]}>Epilogue</T>
      {order.map((id, i) => {
        const q = v.players.find((x) => x.id === id)!;
        return (
          <View key={id} style={{ transform: [tilt[i % 3]], marginLeft: i % 3 === 1 ? p(14) : 0, marginRight: i % 3 === 2 ? p(10) : 0 }}>
            <Paper seed={`ep${id}`}>
              <View style={{ gap: p(4) }}>
                <View style={[s.nm, { gap: p(7) }]}>
                  <Dot color={q.color} />
                  <T f={FELL} size={16}>{id === v.me ? 'You' : q.name}</T>
                </View>
                <T f={CRIMI} size={14} style={{ lineHeight: p(19.6) }}>{fill(id)}</T>
              </View>
            </Paper>
          </View>
        );
      })}
      <Pressable onPress={onNext} accessibilityRole="button" accessibilityLabel="Your results" hitSlop={10} style={{ alignSelf: 'center', marginTop: p(4) }}>
        <T f={FELLI} size={15} color={TM.cream} style={shade}>Your results ›</T>
      </Pressable>
    </ScrollView>
  );
}

const ORD = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

function ResultsPage({ env, rv, order, roomId }: { env: PageProps['env']; rv: Reveal; order: PlayerId[]; roomId: string }) {
  const v = env.view;
  const self = v.players.find((q) => q.id === v.me)!;
  const solo = env.extras.end.soloRight;
  const won = AWARDS.filter((a) => (rv.awards as Record<string, string | undefined>)[a.id] === v.me);
  const place = order.indexOf(v.me) + 1;
  const misses = rv.missed.map((id) => ({ id, ...question(id) }));


  const lines: [string, string][] = [
    ...(solo ? [['Right answers in solo rounds', `+${solo * rules.EXP.perSoloRight}`] as [string, string]] : []),
    ...(self.alive ? [['Survived the year', `+${rules.EXP.survival}`] as [string, string]] : []),
    ...won.map((a) => [`Award: ${a.label}`, `+${rules.EXP.perAward}`] as [string, string]),
  ];
  return (
    <MidSheet seed="results" gap={8}>
      <K>Trust Me Not · your year</K>
      <Title>{self.alive ? 'You survived' : `You died in month ${self.diedMonth ?? 12}`}</Title>
      <View style={s.xp}>
        <T size={12.5}>Your place</T>
        <T f={FELL} size={15}>{`${ORD(place)} of ${v.players.length}`}</T>
      </View>
      {lines.map(([a, b]) => (
        <View key={a} style={s.xp}>
          <T size={12.5}>{a}</T>
          <T f={FELL} size={15}>{b}</T>
        </View>
      ))}
      <View style={[s.xp, { alignItems: 'center' }]}>
        <T size={12.5}>EXP earned</T>
        <T f={FELL} size={20} color={TM.red}>{`+${rv.exp}`}</T>
      </View>
      <Sec>Missed in solo rounds</Sec>
      {misses.length ? (
        misses.slice(0, 4).map((m, i) => (
          <View key={`${m.id}${i}`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: p(8) }}>
            <T size={12} color={TM.red}>✕</T>
            <T size={12} style={{ flex: 1 }} lines={1}>{m.topic || m.q}</T>
            {m.dossier ? (
              <Pressable onPress={() => router.push(`/learn/dossier?id=${m.dossier}`)} accessibilityRole="link" accessibilityLabel={`Open the dossier for ${m.topic}`} hitSlop={6}>
                <T f={FELL} size={12.5} color={TM.red} style={{ textDecorationLine: 'underline' }}>Dossier ›</T>
              </Pressable>
            ) : null}
          </View>
        ))
      ) : (
        <T size={12} style={{ opacity: 0.8 }}>Nothing missed. Every solo answer was right.</T>
      )}
      <T size={11} style={{ opacity: 0.75 }}>
        {misses.length > 4 ? `${misses.length - 4} more misses are waiting in Today’s review.` : misses.length ? 'Your misses are waiting in Today’s review.' : 'Today’s review has nothing new from this year.'}
      </T>
      <View style={{ flexDirection: 'row', gap: p(8) }}>
        <Btn label="New camp, same people" style={{ flex: 1 }} onPress={async () => {
          await rematchRoom(roomId).catch(() => {});
          router.replace(`/play/trust-me-not/lobby?room=${roomId}`);
        }} />
        <Btn label="Back to games" kind="line" style={{ flex: 1 }} onPress={() => {
          leaveRoom(roomId).catch(() => {});
          router.replace('/games');
        }} />
      </View>
    </MidSheet>
  );
}

// ---------------------------------------------------------------- pause

/** The paper pause page: the year goes on; leaving means fleeing the camp. */
export function TmnPause({ onBack, onLeave }: { onBack: () => void; onLeave: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ position: 'absolute', left: p(12), right: p(12), bottom: p(16) }}>
        <Paper seed="pause">
          <View style={{ gap: p(7) }}>
            <K>Paused for you only</K>
            <Title>The year goes on</Title>
            <T size={12.5} style={{ opacity: 0.85, lineHeight: p(17.5) }}>Online games can’t pause for everyone. If you leave now, you flee the camp: your turns stop, and coming back lets you watch only as a Ghost.</T>
            <View style={{ flexDirection: 'row', gap: p(8) }}>
              <Btn label="Back to the camp" onPress={onBack} style={{ flex: 1 }} />
              <Btn label="Flee the camp" kind="red" onPress={onLeave} style={{ flex: 1 }} />
            </View>
          </View>
        </Paper>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { paddingVertical: p(10), paddingHorizontal: p(8), alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: p(6), borderBottomWidth: 1, borderBottomColor: LINE },
  hd: { letterSpacing: p(0.8), textTransform: 'uppercase', opacity: 0.65 },
  nm: { flexDirection: 'row', alignItems: 'center', gap: p(7) },
  heatCell: { flex: 1, height: p(8), borderWidth: 1, borderColor: TM.red },
  mline: { borderWidth: 1, borderStyle: 'dashed', borderColor: TM.red, paddingVertical: p(6), paddingHorizontal: p(8), gap: p(1) },
  ghl: { gap: p(2), paddingVertical: p(7), borderTopWidth: 1, borderBottomWidth: 1, borderColor: TM.line },
  sr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: p(8), borderBottomWidth: 1, borderBottomColor: TM.line },
  sealrow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: p(10), padding: p(8), backgroundColor: TM.ink },
  seal: { width: p(26), height: p(26), borderRadius: p(13), backgroundColor: '#a5372a', alignItems: 'center', justifyContent: 'center' },
  sus: { width: '30.9%', alignItems: 'center', paddingVertical: p(8), borderWidth: 1, borderColor: TM.line },
  watch: { flexDirection: 'row', alignItems: 'center', gap: p(10), paddingVertical: p(8), paddingHorizontal: p(10), borderWidth: 1, borderColor: TM.line },
  pk: { width: p(50), alignItems: 'center', paddingVertical: p(5), borderWidth: 1, borderColor: 'transparent' },
  inp: { fontFamily: CRIMI, fontSize: p(13), lineHeight: p(18), color: TM.ink, paddingVertical: p(9), paddingHorizontal: p(12), borderWidth: 1, borderColor: TM.line, backgroundColor: 'rgba(42,31,22,0.05)', minHeight: p(36) },
  seat: { position: 'absolute', left: '50%', top: '50%', width: p(56), marginLeft: -p(28), marginTop: -p(26), alignItems: 'center' },
  glow: { borderRadius: p(17), shadowColor: '#c0473a', shadowOpacity: 0.9, shadowRadius: p(6), shadowOffset: { width: 0, height: 0 } },
  skip: { flexDirection: 'row', justifyContent: 'space-between', marginTop: p(4), paddingTop: p(6), borderTopWidth: 1, borderTopColor: TM.line },
  tl: { flexDirection: 'row', alignItems: 'center', gap: p(6), paddingVertical: p(2) },
  tr: { flex: 1, flexDirection: 'row', gap: p(2) },
  cell: { flex: 1, height: p(9), backgroundColor: TM.ink, opacity: 0.75 },
  cellOff: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(42,31,22,0.35)', opacity: 1 },
  sh: { flexDirection: 'row', alignItems: 'flex-end', gap: p(6), paddingVertical: p(4), borderBottomWidth: 1, borderBottomColor: TM.line },
  msn: { flexDirection: 'row', alignItems: 'center', gap: p(8), paddingVertical: p(6), borderBottomWidth: 1, borderBottomColor: TM.line },
  tag: { paddingVertical: p(2), paddingHorizontal: p(6), borderWidth: 1, borderColor: TM.ink },
  um: { gap: p(5), paddingVertical: p(6), borderBottomWidth: 1, borderBottomColor: TM.line },
  rr: { flexDirection: 'row', alignItems: 'center', gap: p(9), paddingVertical: p(7) },
  award: { width: '31.5%', alignItems: 'center', gap: p(1), paddingVertical: p(6), paddingHorizontal: p(2), borderWidth: 1, borderColor: TM.line },
  xp: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: p(5), borderBottomWidth: 1, borderBottomColor: 'rgba(42,31,22,0.15)' },
});
