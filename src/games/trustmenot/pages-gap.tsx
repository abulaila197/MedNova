// Trust Me Not: the Gap in the all-paper look (locked 2026-10-07, preview pages 7-17). Step 1 opens with the
// month's notices (wild card, rumor, Snares), then the tabbed sheet: market and food, bag, gifts, selling, lending,
// asking for help and the room chat; the Rumor pen holder picks a rumor first. Step 2 is the vote on everyone's
// requests. Every page sends only this player's own actions.
import { Image } from 'expo-image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { stickerById } from '@/online/stickers';
import { sendTalk, useTalk, useTalkFeed, type TalkMsg } from '@/online/talk';
import { voiceById } from '@/online/voice';

import { rules, type EffectId, type ItemId, type MealId, type WildId } from './engine';
import { Icon } from './icons';
import type { TmnView } from './online';
import { CRIM, CRIMB, CRIMI, FELL, FELLI, p, Paper, Portrait, T, TM } from './paper';
import { Strip } from './pages';
import type { PageProps } from './props';
import { EFFECT, ITEM, MEAL } from './text';

type Player = TmnView['players'][number];
type Act = PageProps['act'];

const SOFT = 'rgba(42,31,22,0.06)';
const shadow = { textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } };

/** Seconds as m:ss, the Gap's clock. */
const mmss = (s: number) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const jewelsFor = (coins: number) => Math.ceil(coins / rules.JEWEL_COINS);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const nameOf = (v: TmnView, id: string | null | undefined) => (id === v.me ? 'You' : v.players.find((x) => x.id === id)?.name ?? 'Someone');
const colorOf = (v: TmnView, id: string | null | undefined) => v.players.find((x) => x.id === id)?.color ?? TM.ink;

// ---------------------------------------------------------------- texts

/** The eight wild cards (rule book §9). */
const WILD: Record<WildId, { title: string; text: (v: TmnView) => ReactNode }> = {
  storm: { title: 'The Storm', text: () => <>The wind tears through camp. The <B>Gap timer is halved</B> this month.</> },
  caravan: { title: 'Merchant Caravan', text: () => <><B>4 extra items</B> in the market this month, <B>25% cheaper</B>.</> },
  wolves: { title: 'Wolves at the fence', text: () => <>Everyone loses <B>5% health</B> unless they pay 1 jewel.</> },
  donor: { title: 'A Friendly Donor', text: (v) => <>A stranger leaves <B>{`${rules.DONOR_COINS_PER_PLAYER * v.players.filter((x) => x.alive).length} coins`}</B> in the Common Wallet, 10 for each of the living.</> },
  'cold-snap': { title: 'Cold Snap', text: () => <>Frost on the tents. Hunger drains <B>5 more health</B> this month for everyone.</> },
  'heat-wave': { title: 'Heat Wave', text: () => <>The wells shrink. Hunger drains <B>5 more health</B> this month for everyone.</> },
  'clean-spring': { title: 'Clean Spring', text: () => <>Fresh water. Hunger drains <B>5 less</B> this month, and <B>Dehydrated</B> is cured for everyone.</> },
  doctor: { title: 'The Traveling Doctor', text: () => <>Heals one player fully for 6 jewels. Chip in secretly first; the wallet covers the rest if everyone agrees.</> },
};

/** The eight rumor cards (writing file §2); {other} is the player the pen holder names. */
const RUMORS = [
  'Someone has been skimming the jar since winter.',
  '{other} has more jewels than they admit.',
  'One of us is lying about their mission.',
  '{other} refused a help request they voted yes on.',
  'A poisoned gift was sent this month.',
  '{other} is working with a ghost.',
  'The last missed target was no accident.',
  '{other} can be trusted.',
];
const rumorText = (card: number, name: string) => RUMORS[card - 1].replace('{other}', name);

const TRIGGER = { help: 'help request', gift: 'gift', buy: 'purchase' } as const;
const MEAL_HEAL: Record<MealId, string> = { scraps: '+5', basic: '+15', feast: '+30', skip: 'x1.5 drain' };
const MEAL_WANT: Record<MealId, string> = { scraps: 'Scraps', basic: 'a Basic meal', feast: 'a Feast', skip: 'nothing' };
/** Voice lines offered in the Gap chat (the shared set, ON28). */
const GAP_VOICE = ['help-me', 'thank-you', 'sorry', 'hurry-up', 'nice-one', 'good-luck'];

// ---------------------------------------------------------------- small parts

const B = ({ children }: { children: ReactNode }) => <T f={CRIMB} size={12.5}>{children}</T>;

/** Small caps-style label over a section. */
const Sec = ({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) => (
  <View style={style}>
    <T f={FELL} size={10} style={s.caps}>{children}</T>
  </View>
);

const Dot = ({ color, size = 9 }: { color: string; size?: number }) => <View style={{ width: p(size), height: p(size), borderRadius: p(size / 2), backgroundColor: color }} />;

type BtnKind = 'ok' | 'ok2' | 'no' | 'line';
/** The paper buttons: dark ink (ok), light wash (ok2), red outline (no), plain outline (line). */
function Btn({ label, kind = 'ok', onPress, disabled, on, style, size = 12, sub }: { label: string; kind?: BtnKind; onPress?: () => void; disabled?: boolean; on?: boolean; style?: StyleProp<ViewStyle>; size?: number; sub?: string }) {
  const fg = kind === 'ok' ? TM.paper : kind === 'no' ? TM.red : TM.ink;
  return (
    <Pressable onPress={onPress} disabled={disabled || !onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, selected: !!on }}
      style={[s.btn, s[kind], on ? s.btnOn : null, disabled ? { opacity: 0.4 } : null, style]}>
      <T f={CRIM} size={size} color={fg} style={{ textAlign: 'center', lineHeight: p(size * 1.25) }}>{label}</T>
      {sub ? <T size={9} color={fg} style={{ textAlign: 'center', opacity: 0.75, lineHeight: p(11) }}>{sub}</T> : null}
    </Pressable>
  );
}

/** The big dark button at the bottom of a form. */
const Cta = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => (
  <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={[s.cta, disabled ? { opacity: 0.4 } : null]}>
    <T f={FELL} size={14} color={TM.paper} style={{ textAlign: 'center' }}>{label}</T>
  </Pressable>
);

function Stepper({ n, set, min, max, unit }: { n: number; set: (n: number) => void; min: number; max: number; unit: string }) {
  const round = (sign: string, to: number, ok: boolean, label: string) => (
    <Pressable onPress={() => set(to)} disabled={!ok} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={[s.round, ok ? null : { opacity: 0.35 }]}>
      <T size={15} style={{ lineHeight: p(17) }}>{sign}</T>
    </Pressable>
  );
  return (
    <View style={s.step}>
      {round('−', n - 1, n > min, 'Fewer')}
      <T f={FELL} size={22} style={{ minWidth: p(16), textAlign: 'center', lineHeight: p(26) }}>{String(n)}</T>
      <T size={11.5} style={{ flex: 1, opacity: 0.8 }}>{unit}</T>
      {round('+', n + 1, n < max, 'More')}
    </View>
  );
}

function Toggle({ label, note, on, set }: { label: string; note: string; on: boolean; set: (on: boolean) => void }) {
  return (
    <Pressable onPress={() => set(!on)} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} style={s.tog}>
      <View style={{ flex: 1 }}>
        <T f={CRIMB} size={12.5} style={{ lineHeight: p(15) }}>{label}</T>
        <T size={10} style={{ opacity: 0.7, lineHeight: p(13) }}>{note}</T>
      </View>
      <View style={[s.track, on ? { backgroundColor: TM.red, borderColor: TM.red } : null]}>
        <View style={[s.knob, on ? { left: p(15), backgroundColor: TM.paper, opacity: 1 } : null]} />
      </View>
    </Pressable>
  );
}

/** Players to choose from, each a small silhouette in a box. */
function Pick({ players, sel, set }: { players: Player[]; sel: string | null; set: (id: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: p(10), flexWrap: 'wrap' }}>
      {players.map((x) => (
        <Pressable key={x.id} onPress={() => set(x.id)} accessibilityRole="button" accessibilityState={{ selected: sel === x.id }} accessibilityLabel={x.name}
          style={[s.pk, sel === x.id ? { borderColor: TM.red, backgroundColor: SOFT } : null]}>
          <Portrait color={x.color} health={x.health} size={28} />
          <T f={CRIMB} size={11} style={{ marginTop: p(2), lineHeight: p(13) }} lines={1}>{x.name}</T>
        </Pressable>
      ))}
    </View>
  );
}

/** One row of a list: icon, name and what it does, and anything on the right. */
const Row = ({ icon, name, does, right, last }: { icon: string; name: string; does: string; right?: ReactNode; last?: boolean }) => (
  <View style={[s.it, last ? { borderBottomWidth: 0 } : null]}>
    <Icon name={icon} size={22} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <T f={CRIMB} size={13} style={{ lineHeight: p(16) }}>{name}</T>
      <T size={10} style={{ opacity: 0.7, lineHeight: p(13) }}>{does}</T>
    </View>
    {right}
  </View>
);

/** "I'm done" for this Gap step; once pressed it counts who else is done (everyone done ends the step). */
function Done({ env, act, light }: { env: PageProps['env']; act: Act; light?: boolean }) {
  const v = env.view;
  const done = env.extras.skipped ?? [];
  const living = v.players.filter((x) => x.alive);
  const mine = done.includes(v.me);
  const color = light ? TM.cream : TM.ink;
  if (mine)
    return <T size={10} color={color} style={[{ opacity: 0.8 }, light ? shadow : null]}>{`done · ${living.filter((x) => done.includes(x.id)).length} of ${living.length}`}</T>;
  return (
    <Pressable onPress={() => act({ type: 'SKIP' })} accessibilityRole="button" accessibilityLabel="I'm done with this step" hitSlop={6} style={[s.done, { borderColor: color }]}>
      <T f={FELL} size={10} color={color} style={{ lineHeight: p(12) }}>{"I'm done"}</T>
    </Pressable>
  );
}

/** The sheet's top line: the Gap's kicker, the done button and the clock. */
function Kicker({ title, props, light }: { title: string; props: PageProps; light?: boolean }) {
  return (
    <View style={s.gtop}>
      <T f={FELL} size={10} color={light ? TM.cream : TM.ink} style={[s.caps, { flex: 1 }, light ? shadow : null]} lines={1}>{title}</T>
      {props.env.view.ghost ? null : <Done env={props.env} act={props.act} light={light} />}
      <T f={FELL} size={15} color={light ? '#e0806a' : TM.red} style={[{ marginLeft: p(10) }, light ? shadow : null]}>{mmss(props.seconds)}</T>
    </View>
  );
}

/** A torn sheet under the strip that scrolls inside the phone when it runs long. */
function Sheet({ seed, children, tabs = true, bottom = false }: { seed: string; children: ReactNode; tabs?: boolean; bottom?: boolean }) {
  return (
    <View style={[s.region, { bottom: tabs ? p(50) : p(14) }]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: bottom ? 'flex-end' : 'flex-start', paddingBottom: p(6) }} showsVerticalScrollIndicator={false}>
        <Paper seed={seed}>
          <View style={{ gap: p(7) }}>{children}</View>
        </Paper>
      </ScrollView>
    </View>
  );
}

const TABS = ['Market', 'Bag', 'Gifts', 'Sell', 'Lend', 'Help', 'Chat'] as const;
type Tab = (typeof TABS)[number];

function TabBar({ tab, set }: { tab: Tab; set: (t: Tab) => void }) {
  return (
    <View style={s.tabs}>
      {TABS.map((t) => (
        <Pressable key={t} onPress={() => set(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} accessibilityLabel={t} style={[s.tab, tab === t ? s.tabOn : null]}>
          <T f={FELL} size={10.5} color={tab === t ? TM.paper : '#d9c9a6'} style={{ letterSpacing: p(0.6), lineHeight: p(13) }}>{t}</T>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- notices

type Notice = { key: string; kind: 'wild' | 'rumor' | 'snare'; body: ReactNode };

/** What is new this month: the wild card, the rumor spread from last month's pen, Snares that sprang or were found. */
function useNotices(props: PageProps, docPatient: string | null, setDocPatient: (id: string) => void, dismiss: (key: string) => void): Notice[] {
  const { env, act } = props;
  const v = env.view;
  const gx = env.extras.gap;
  const me = v.players.find((x) => x.id === v.me);
  const out: Notice[] = [];
  if (v.wild) {
    const w = WILD[v.wild];
    let extra: ReactNode = null;
    if (v.wild === 'wolves')
      extra = gx.wolvesPaid ? (
        <T size={11} style={{ opacity: 0.75 }}>You paid 1 jewel. The wolves pass you by.</T>
      ) : (
        <View style={s.two}>
          <Btn label="Pay 1 jewel" kind="ok" disabled={(me?.jewels ?? 0) < 1} onPress={() => act({ type: 'PAY_WOLVES' })} style={{ flex: 1 }} />
          <Btn label="Take the hit" kind="no" style={{ flex: 1 }} onPress={() => dismiss(`wild${v.month}`)} />
        </View>
      );
    if (v.wild === 'doctor') {
      const others = v.players.filter((x) => x.alive);
      const leading = Object.entries(gx.doctor.pot).sort((a, b) => b[1] - a[1])[0]?.[0];
      const sel = docPatient ?? gx.doctor.mine?.patient ?? leading ?? others.find((x) => x.id !== v.me)?.id ?? v.me;
      const mine = gx.doctor.mine?.patient === sel ? gx.doctor.mine.jewels : 0;
      const pot = gx.doctor.pot[sel] ?? 0;
      extra = (
        <>
          <View style={{ flexDirection: 'row', gap: p(6), flexWrap: 'wrap' }}>
            {others.map((x) => (
              <Pressable key={x.id} onPress={() => setDocPatient(x.id)} accessibilityRole="button" accessibilityState={{ selected: sel === x.id }} accessibilityLabel={x.name}
                style={[s.chip, sel === x.id ? { borderColor: TM.red, backgroundColor: 'rgba(155,47,34,0.08)' } : null]}>
                <Dot color={x.color} size={8} />
                <T size={12} lines={1}>{nameOf(v, x.id)}</T>
              </Pressable>
            ))}
          </View>
          <View style={s.between}>
            <T size={11}>{mine ? `Chipped in so far (${mine} yours)` : 'Chipped in so far'}</T>
            <T f={FELL} size={17}>{`${pot} of ${rules.DOCTOR_JEWELS}`}</T>
          </View>
          <Cta label={`Chip in 1 jewel for ${sel === v.me ? 'yourself' : nameOf(v, sel)}`} disabled={(me?.jewels ?? 0) < 1 || pot >= rules.DOCTOR_JEWELS}
            onPress={() => act({ type: 'DOCTOR_CHIP', jewels: mine + 1, patient: sel })} />
        </>
      );
    }
    out.push({
      key: `wild${v.month}`,
      kind: 'wild',
      body: (
        <>
          <T f={FELL} size={10} style={[s.caps, { opacity: 0.75 }]}>{`Wild card · month ${v.month}`}</T>
          <T f={FELL} size={21} style={{ lineHeight: p(24) }}>{w.title}</T>
          <T size={12.5} style={{ lineHeight: p(17), opacity: 0.9 }}>{w.text(v)}</T>
          {extra}
        </>
      ),
    });
  }
  if (v.rumor.shown?.card)
    out.push({
      key: `rumor${v.month}`,
      kind: 'rumor',
      body: (
        <>
          <T f={FELL} size={10} style={[s.caps, { opacity: 0.75 }]}>A rumor spreads</T>
          <T f={FELLI} size={19} style={{ lineHeight: p(25) }}>{`“${rumorText(v.rumor.shown.card, nameOf(v, v.rumor.shown.names) === 'You' ? (me?.name ?? 'You') : nameOf(v, v.rumor.shown.names))}”`}</T>
          <T size={10} style={{ opacity: 0.6 }}>anonymous</T>
        </>
      ),
    });
  for (const sn of gx.sprung) {
    const mine = sn.to === v.me;
    out.push({
      key: `sprung${sn.id}`,
      kind: 'snare',
      body: (
        <>
          <T f={FELL} size={10} style={[s.caps, { opacity: 0.75 }]}>A Snare sprang</T>
          <View style={s.snr}>
            <Icon name="snare" size={34} />
            <T size={12.5} style={{ flex: 1, lineHeight: p(17) }}>
              {mine ? <>Someone set a Snare on <B>your {TRIGGER[sn.trigger]}</B>. You lost <B>{plural(sn.n, 'jewel')}</B>.</> : <>Someone set a Snare on <B>{nameOf(v, sn.to)}’s {TRIGGER[sn.trigger]}</B>. They lost <B>{plural(sn.n, 'jewel')}</B>.</>}
            </T>
          </View>
        </>
      ),
    });
  }
  for (const sn of v.snares.filter((x) => x.target === v.me && x.status === 'revealed'))
    out.push({
      key: `found${sn.id}`,
      kind: 'snare',
      body: (
        <>
          <T f={FELL} size={10} style={[s.caps, { opacity: 0.75 }]}>Your lantern found a Snare</T>
          <View style={s.snr}>
            <Icon name="lantern" size={34} />
            <T size={12.5} style={{ flex: 1, lineHeight: p(17) }}>Someone set a Snare on <B>your {TRIGGER[sn.trigger]}</B>. It can’t spring now.</T>
          </View>
        </>
      ),
    });
  return out;
}

function Notices({ list, onSeen }: { list: Notice[]; onSeen: () => void }) {
  return (
    <View style={[s.region, { top: p(84), bottom: p(14) }]}>
      <ScrollView contentContainerStyle={{ gap: p(16), paddingHorizontal: p(4), paddingBottom: p(10) }} showsVerticalScrollIndicator={false}>
        {list.map((n, i) => (
          <View key={n.key} style={n.kind === 'wild' ? { transform: [{ rotate: '-1deg' }] } : { transform: [{ rotate: i % 2 ? '1.5deg' : '-0.8deg' }], marginHorizontal: p(16) }}>
            <Paper seed={n.key} pad={n.kind === 'wild' ? [20, 13, 11] : undefined}>
              {n.kind === 'wild' ? <View style={s.nail} /> : null}
              <View style={{ gap: p(6) }}>{n.body}</View>
            </Paper>
          </View>
        ))}
        <Pressable onPress={onSeen} accessibilityRole="button" accessibilityLabel="Seen" style={s.seen}>
          <T f={FELL} size={13} color={TM.paper}>Seen</T>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------- market and food (09)

type Buy = { meal: MealId } | { item: ItemId } | null;

function MarketTab({ props }: { props: PageProps }) {
  const { env, act } = props;
  const v = env.view;
  const gx = env.extras.gap;
  const me = v.players.find((x) => x.id === v.me)!;
  const jewels = me.jewels ?? 0;
  const lost = me.effects.some((e) => e.id === 'lost');
  const [buy, setBuy] = useState<Buy>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [trigger, setTrigger] = useState<'help' | 'gift' | 'buy'>('gift');
  const mealAsked = v.requests.find((r) => r.by === v.me && r.meal)?.meal ?? null;
  const meal = gx.meal ?? mealAsked;
  const asked = new Set(v.requests.filter((r) => r.by === v.me && r.item).map((r) => r.item));
  const others = v.players.filter((x) => x.alive && x.id !== v.me);

  const note = v.wild === 'caravan'
    ? { t: 'Merchant Caravan', s: '4 extra items this month, 25% cheaper' }
    : v.squeeze
      ? { t: 'The Squeeze', s: `The year is ending. Meals cost ${v.meals[1].price}${v.squeeze.cureX > 1.01 ? `, cures x${v.squeeze.cureX.toFixed(1)}` : ''}.` }
      : null;

  /** How to pay: ask the wallet (everyone votes in step 2) or pay with my own jewels, in secret. */
  const pay = (cost: number, send: (pay: 'wallet' | 'jewels') => void) => (
    <View style={s.payBox}>
      <T size={10.5} style={{ opacity: 0.8 }}>How do you pay?</T>
      <View style={s.two}>
        <Btn label={`Wallet · ${cost} coins`} sub="the camp votes" kind="ok2" style={{ flex: 1 }} onPress={() => (send('wallet'), setBuy(null))} />
        <Btn label={`My jewels · ${jewelsFor(cost)}`} sub="secret, change to the wallet" kind="ok" style={{ flex: 1 }} disabled={jewels < jewelsFor(cost)} onPress={() => (send('jewels'), setBuy(null))} />
      </View>
    </View>
  );

  const chosen = buy && 'meal' in buy ? buy.meal : null;
  return (
    <Sheet seed={`market${v.month}`} bottom>
      <Kicker title="The Gap · step 1 of 2" props={props} />
      <View style={s.purse}>
        <View style={{ flex: 1 }}>
          <T size={10} style={{ opacity: 0.75 }}>Common wallet</T>
          <T f={FELL} size={22} style={{ lineHeight: p(26) }}>{String(v.wallet)}</T>
        </View>
        <View style={{ flex: 1 }}>
          <T size={10} style={{ opacity: 0.75 }}>Your jewels</T>
          <T f={FELL} size={22} style={{ lineHeight: p(26) }}>{String(jewels)}</T>
          <T size={9} style={{ opacity: 0.6 }}>only you see this</T>
        </View>
      </View>
      {note ? (
        <View style={s.cara}>
          <T f={FELL} size={13} color={TM.red}>{note.t}</T>
          <T size={10.5}>{note.s}</T>
        </View>
      ) : null}
      <Sec>Food this month</Sec>
      <View style={s.foods}>
        {v.meals.map(({ meal: m, price }) => {
          const on = meal === m || chosen === m;
          return (
            <Pressable key={m} disabled={!!meal || lost} onPress={() => (m === 'skip' ? act({ type: 'BUY_FOOD', meal: 'skip', pay: 'jewels' }) : setBuy(chosen === m ? null : { meal: m }))}
              accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${MEAL[m]}, ${price ? `${price} coins` : 'free'}`}
              style={[s.fd, on ? { backgroundColor: TM.ink } : null, meal && !on ? { opacity: 0.45 } : null]}>
              <T f={CRIMB} size={12} color={on ? TM.paper : TM.ink} style={{ lineHeight: p(15) }}>{MEAL[m]}</T>
              <T size={11} color={on ? TM.paper : TM.ink} style={{ lineHeight: p(14) }}>{price ? String(price) : 'free'}</T>
              <T size={9} color={on ? TM.paper : TM.ink} style={{ opacity: 0.7, lineHeight: p(12) }}>{MEAL_HEAL[m]}</T>
            </Pressable>
          );
        })}
      </View>
      {mealAsked && !gx.meal ? <T size={10.5} color={TM.red}>{`You asked the wallet for ${MEAL_WANT[mealAsked]}. The camp votes in step 2.`}</T> : null}
      {lost ? <T size={10.5} color={TM.red}>You are Lost: you can’t buy anything in this Gap.</T> : null}
      {chosen ? pay(v.meals.find((x) => x.meal === chosen)!.price, (how) => act({ type: 'BUY_FOOD', meal: chosen, pay: how })) : null}
      <Sec>{`Market · ${v.market.length} items`}</Sec>
      <View>
        {v.market.map((m, i) => {
          const open = !!buy && 'item' in buy && buy.item === m.item;
          const out = m.left < 1;
          return (
            <View key={m.item}>
              <Pressable disabled={out || lost} onPress={() => setBuy(open ? null : { item: m.item })} accessibilityRole="button" accessibilityLabel={`${ITEM[m.item].name}, ${m.price} coins`} style={out ? { opacity: 0.45 } : null}>
                <Row icon={m.item} name={ITEM[m.item].name} does={asked.has(m.item) ? 'asked the wallet · vote in step 2' : ITEM[m.item].does} last={i === v.market.length - 1 && !open}
                  right={
                    <View style={{ alignItems: 'flex-end' }}>
                      <T f={FELL} size={16} style={{ lineHeight: p(17) }}>{String(m.price)}</T>
                      <T size={9} style={{ opacity: 0.65, lineHeight: p(11) }}>{out ? 'sold out' : `${m.left} left`}</T>
                    </View>
                  } />
              </Pressable>
              {open && m.item === 'snare' ? (
                <View style={[s.payBox, { marginBottom: p(6) }]}>
                  <T size={10.5} style={{ opacity: 0.8 }}>Who is it for, and what springs it?</T>
                  <Pick players={others} sel={target} set={setTarget} />
                  <View style={{ flexDirection: 'row', gap: p(5) }}>
                    {(['help', 'gift', 'buy'] as const).map((t) => (
                      <Btn key={t} label={TRIGGER[t]} kind="line" size={11} on={trigger === t} onPress={() => setTrigger(t)} style={{ flex: 1 }} />
                    ))}
                  </View>
                  <Btn label={`Set it · ${jewelsFor(m.price)} jewel, in secret`} kind="ok" disabled={!target || jewels < jewelsFor(m.price)}
                    onPress={() => (act({ type: 'BUY_ITEM', item: 'snare', pay: 'jewels', target, trigger }), setBuy(null))} />
                </View>
              ) : open ? (
                <View style={{ marginBottom: p(6) }}>{pay(m.price, (how) => act({ type: 'BUY_ITEM', item: m.item, pay: how }))}</View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------- bag, lock box and secret Gap mission (10)

function BagTab({ props }: { props: PageProps }) {
  const { env, act } = props;
  const v = env.view;
  const me = v.players.find((x) => x.id === v.me)!;
  const bag = (me.bag ?? []) as ItemId[];
  const jewels = me.jewels ?? 0;
  const gems = Math.min(6, Math.max(jewels, rules.LOCK_BOX_JEWELS));
  return (
    <Sheet seed={`bag${v.month}`}>
      <Kicker title="The Gap · your bag" props={props} />
      <Sec>In your bag</Sec>
      {bag.length ? (
        <View>
          {bag.map((it, i) => {
            const cures = rules.ITEMS[it].cures;
            return (
              <Row key={`${it}${i}`} icon={it} name={ITEM[it].name} last={i === bag.length - 1}
                does={cures ? `waits for ${EFFECT[cures].name}` : it === 'lantern' ? 'shows a Snare set on you this month' : ITEM[it].does}
                right={it === 'lantern' ? <Btn label="Use" kind="ok" size={11} onPress={() => act({ type: 'LANTERN' })} style={s.mini} /> : null} />
            );
          })}
        </View>
      ) : (
        <T size={11} style={{ opacity: 0.7 }}>Nothing in your bag. Cures you buy early wait here and work when the effect arrives.</T>
      )}
      <Sec style={{ marginTop: p(4) }}>Lock box</Sec>
      {me.lockBox ? (
        <>
          <View style={s.lockb}>
            <Icon name="lock-box" size={34} />
            <View style={{ flex: 1 }}>
              <T f={FELL} size={15} style={{ lineHeight: p(18) }}>{`${Math.min(jewels, rules.LOCK_BOX_JEWELS)} jewels guarded`}</T>
              <T size={10.5} style={{ opacity: 0.8, lineHeight: p(14) }}>Safe from rounds, Snares, Steal and debt calls. You can still spend them.</T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: p(6) }}>
            {Array.from({ length: gems }, (_, i) => (
              <View key={i} style={[s.gem, i < Math.min(jewels, rules.LOCK_BOX_JEWELS) ? { borderColor: TM.red, backgroundColor: 'rgba(155,47,34,0.1)' } : null, i >= jewels ? { opacity: 0.35 } : null]}>
                <Icon name="jewel" size={20} />
              </View>
            ))}
          </View>
          <T size={11} style={{ opacity: 0.75, lineHeight: p(15) }}>The box always guards 2 of your jewels, for the whole game.</T>
        </>
      ) : (
        <T size={11} style={{ opacity: 0.7 }}>No lock box yet. One from the market guards 2 of your jewels for the whole game.</T>
      )}
      <MissionBox props={props} />
    </Sheet>
  );
}

/** A Skim or Steal mission dealt last month is carried out now, in secret. Only the holder sees this. */
function MissionBox({ props }: { props: PageProps }) {
  const { env, act } = props;
  const v = env.view;
  const m = v.missions.find((x) => x.holder === v.me && x.status === 'active' && x.month === v.month - 1 && (x.id === 'skim' || x.id === 'steal'));
  const taken = Number(m?.data.coins ?? 0);
  const cap = Math.floor((v.wallet + taken) * rules.SKIM_MAX);
  const left = Math.floor(Math.min(cap - taken, v.wallet) / rules.JEWEL_COINS);
  const [n, setN] = useState(1);
  if (!m) return null;
  return (
    <View style={s.msn}>
      <T f={FELL} size={10} color={TM.red} style={s.caps}>Your secret mission</T>
      {m.id === 'skim' ? (
        <>
          <T size={11.5} style={{ lineHeight: p(15) }}>{`Skim: take up to 10% of the wallet unseen. ${taken ? `Taken so far: ${taken} coins. ` : ''}Every 10 coins becomes 1 of your jewels.`}</T>
          {left > 0 ? (
            <View style={{ flexDirection: 'row', gap: p(8), alignItems: 'center' }}>
              <View style={{ flex: 1 }}><Stepper n={Math.min(n, left)} set={setN} min={1} max={left} unit={`× 10 coins`} /></View>
              <Btn label="Take" kind="ok" size={11} style={s.mini} onPress={() => act({ type: 'SKIM', coins: Math.min(n, left) * rules.JEWEL_COINS })} />
            </View>
          ) : <T size={10.5} style={{ opacity: 0.7 }}>Nothing more you can take unseen.</T>}
        </>
      ) : (
        <>
          <T size={11.5} style={{ lineHeight: p(15) }}>{`Steal: take 2 jewels from ${nameOf(v, m.target)}. A lock box blocks it.`}</T>
          {m.data.taken ? <T size={10.5} style={{ opacity: 0.7 }}>{`Done: you took ${plural(m.paid, 'jewel')}.`}</T> : <Btn label={`Steal from ${nameOf(v, m.target)}`} kind="ok" size={11} onPress={() => act({ type: 'STEAL' })} />}
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- gifts (11)

function GiftsTab({ props }: { props: PageProps }) {
  const { env, act } = props;
  const v = env.view;
  const me = v.players.find((x) => x.id === v.me)!;
  const jewels = me.jewels ?? 0;
  const others = v.players.filter((x) => x.alive && x.id !== v.me);
  const [to, setTo] = useState<string | null>(null);
  const [n, setN] = useState(1);
  const [item, setItem] = useState<ItemId | null>(null);
  const [shown, setShown] = useState(false);
  const [poison, setPoison] = useState(false);
  const extra = poison ? rules.POISON_GIFT_EXTRA : 0;
  const max = Math.max(0, jewels - extra);
  const k = Math.min(n, max);
  const arrived = v.gifts.filter((g) => g.to === v.me && g.status === 'pending');
  const sent = v.gifts.filter((g) => g.from === v.me);
  const bag = [...new Set((me.bag ?? []) as ItemId[])];
  const what = (j: number, it?: ItemId | null) => [j ? plural(j, 'jewel') : '', it ? ITEM[it].name : ''].filter(Boolean).join(' and ');
  const send = () => {
    if (!to) return;
    act({ type: 'GIFT', to, jewels: k, ...(item ? { item } : {}), shown, poisoned: poison });
    setN(1);
    setItem(null);
    setPoison(false);
    setShown(false);
  };
  return (
    <Sheet seed={`gifts${v.month}`}>
      <Kicker title="The Gap · gifts" props={props} />
      {arrived.map((g) => (
        <View key={g.id} style={s.card}>
          <T f={FELL} size={10} style={[s.caps, { opacity: 0.75 }]}>A gift arrived</T>
          <View style={s.who}>
            <Dot color={colorOf(v, g.from)} />
            <T size={15} style={{ flex: 1 }}>{`${nameOf(v, g.from)} sent you ${what(g.jewels, g.item)}`}</T>
          </View>
          <T size={10.5} color={TM.red} style={{ lineHeight: p(14) }}>Gifts can be poisoned. Accepting a poisoned gift makes you Poisoned.</T>
          <View style={s.two}>
            <Btn label="Accept" kind="ok" style={{ flex: 1 }} onPress={() => act({ type: 'GIFT_REPLY', gift: g.id, accept: true })} />
            <Btn label="Refuse" kind="no" style={{ flex: 1 }} onPress={() => act({ type: 'GIFT_REPLY', gift: g.id, accept: false })} />
          </View>
        </View>
      ))}
      {sent.map((g) => (
        <T key={g.id} size={10.5} style={{ opacity: 0.8 }}>{`Sent ${nameOf(v, g.to)} ${what(g.jewels, g.item)}${g.poisoned ? ', poisoned' : ''} · ${g.status === 'pending' ? 'waiting' : g.status}`}</T>
      ))}
      <Sec>Send a gift</Sec>
      <Pick players={others} sel={to} set={setTo} />
      <Stepper n={k} set={setN} min={0} max={max} unit={k === 1 ? 'jewel' : 'jewels'} />
      {bag.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p(5) }}>
          {bag.map((it) => (
            <Pressable key={it} onPress={() => setItem(item === it ? null : it)} accessibilityRole="button" accessibilityState={{ selected: item === it }} accessibilityLabel={`Add ${ITEM[it].name}`}
              style={[s.chip, item === it ? { borderColor: TM.red, backgroundColor: 'rgba(155,47,34,0.08)' } : null]}>
              <Icon name={it} size={14} />
              <T size={11}>{ITEM[it].name}</T>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Toggle label="Show everyone" note="Private unless you choose" on={shown} set={setShown} />
      <Toggle label="Poison it" note="Costs 2 extra jewels" on={poison} set={setPoison} />
      <Cta label={to ? `Send ${what(k, item) || 'nothing'} to ${nameOf(v, to)}` : 'Pick who gets it'} disabled={!to || (!k && !item) || jewels < k + extra} onPress={send} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- sell (12)

function SellTab({ props }: { props: PageProps }) {
  const { env, act } = props;
  const v = env.view;
  const jewels = v.players.find((x) => x.id === v.me)?.jewels ?? 0;
  const [n, setN] = useState(1);
  const k = Math.min(n, jewels);
  return (
    <Sheet seed={`sell${v.month}`}>
      <Kicker title="The Gap · sell jewels" props={props} />
      <View style={s.hero}>
        <T size={11} style={[s.caps, { opacity: 0.75 }]}>1 jewel</T>
        <T f={FELL} size={34} color={TM.red} style={{ lineHeight: p(38) }}>= 10 coins</T>
        <T size={11} style={{ opacity: 0.75 }}>into the Common Wallet</T>
      </View>
      <Sec>How many</Sec>
      <Stepper n={k} set={setN} min={jewels ? 1 : 0} max={jewels} unit={`of your ${plural(jewels, 'jewel')}`} />
      <View style={s.flow}>
        <View>
          <T size={10} style={{ opacity: 0.7 }}>Wallet now</T>
          <T f={FELL} size={22}>{String(v.wallet)}</T>
        </View>
        <View style={s.arrow}><View style={s.arrowHead} /></View>
        <View style={{ alignItems: 'flex-end' }}>
          <T size={10} style={{ opacity: 0.7 }}>After</T>
          <T f={FELL} size={22}>{String(v.wallet + k * rules.JEWEL_COINS)}</T>
        </View>
      </View>
      <T size={11} style={{ opacity: 0.75 }}>{`Anonymous. Everyone sees only “${plural(k, 'jewel')} sold”.`}</T>
      <T size={11} style={{ opacity: 0.75 }}>{`Sold in camp this month: ${v.soldThisMonth}`}</T>
      <Cta label={`Sell ${plural(k, 'jewel')}`} disabled={k < 1} onPress={() => (act({ type: 'SELL', jewels: k }), setN(1))} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- lend (13)

function LendTab({ props }: { props: PageProps }) {
  const { env, act } = props;
  const v = env.view;
  const jewels = v.players.find((x) => x.id === v.me)?.jewels ?? 0;
  const others = v.players.filter((x) => x.alive && x.id !== v.me);
  const [to, setTo] = useState<string | null>(null);
  const [n, setN] = useState(1);
  const k = Math.min(n, jewels);
  const ious = v.debts.filter((d) => d.status === 'open' && (d.lender === v.me || d.borrower === v.me));
  const canCall = v.month >= rules.DEBT_CALL_FROM_MONTH;
  return (
    <Sheet seed={`lend${v.month}`}>
      <Kicker title="The Gap · lend" props={props} />
      <Sec>Your IOUs</Sec>
      {ious.length ? (
        ious.map((d) => {
          const lent = d.lender === v.me;
          const called = (d as typeof d & { called?: number }).called === v.month;
          const sub = lent
            ? `lent in month ${d.month} · ${called ? 'called in: they must repay this Gap' : canCall ? 'can be called in now' : `can be called in from month ${rules.DEBT_CALL_FROM_MONTH}`}`
            : `lent in month ${d.month}${called ? ' · called in: repay now or lose health' : ''}`;
          return (
            <View key={d.id} style={s.iou}>
              <Dot color={colorOf(v, lent ? d.borrower : d.lender)} />
              <View style={{ flex: 1 }}>
                <T f={CRIMB} size={12.5} style={{ lineHeight: p(16) }}>{lent ? `${nameOf(v, d.borrower)} owes you ${plural(d.jewels, 'jewel')}` : `You owe ${nameOf(v, d.lender)} ${plural(d.jewels, 'jewel')}`}</T>
                <T size={10} style={{ opacity: 0.7, lineHeight: p(13) }}>{sub}</T>
              </View>
              {lent ? (
                canCall && !called ? <Btn label="Call in" kind="ok" size={11} style={s.mini} onPress={() => act({ type: 'CALL_DEBT', debt: d.id })} /> : null
              ) : (
                <Btn label="Repay" kind="line" size={11} style={s.mini} disabled={jewels < d.jewels} onPress={() => act({ type: 'REPAY', debt: d.id })} />
              )}
            </View>
          );
        })
      ) : (
        <T size={11} style={{ opacity: 0.7 }}>No open IOUs.</T>
      )}
      <T size={10.5} color={TM.red} style={{ lineHeight: p(14) }}>Unpaid when called: the borrower loses 5% health per jewel (max 30%).</T>
      <Sec>New loan</Sec>
      <Pick players={others} sel={to} set={setTo} />
      <Stepper n={k} set={setN} min={jewels ? 1 : 0} max={jewels} unit={k === 1 ? 'jewel' : 'jewels'} />
      <Cta label={to ? `Lend ${plural(k, 'jewel')} to ${nameOf(v, to)}` : 'Pick who borrows'} disabled={!to || k < 1} onPress={() => to && (act({ type: 'LEND', to, jewels: k }), setN(1))} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- ask for help (14)

const REQ_STATUS = { open: 'Waiting for votes in step 2', approved: 'Approved', refused: 'Refused', failed: 'Failed: the wallet was short' } as const;

function HelpTab({ props }: { props: PageProps }) {
  const { env, act } = props;
  const v = env.view;
  const gx = env.extras.gap;
  const me = v.players.find((x) => x.id === v.me)!;
  const jewels = me.jewels ?? 0;
  const lost = me.effects.some((e) => e.id === 'lost');
  const mine = v.requests.filter((r) => r.by === v.me && r.kind === 'help');
  const last = mine[mine.length - 1];
  return (
    <Sheet seed={`help${v.month}`}>
      <Kicker title="The Gap · ask for help" props={props} />
      {gx.mercy ? (
        <View style={[s.fx, { borderColor: TM.red }]}>
          <T f={CRIMB} size={13.5}>Mercy Ration</T>
          <T size={10.5} style={{ opacity: 0.8 }}>Once a game, at 15% or less: a free +15 health. No one can block it.</T>
          <Btn label="Claim +15" kind="ok" onPress={() => act({ type: 'MERCY' })} />
        </View>
      ) : null}
      <Sec>Your current status</Sec>
      {me.effects.length ? (
        me.effects.map((e) => {
          const cure = gx.cures[e.id as EffectId];
          const asked = v.requests.some((r) => r.by === v.me && r.effect === e.id);
          const fresh = e.since === v.month - 1;
          const what = e.rabies ? 'rabies: no cure now' : EFFECT[e.id as EffectId].does;
          return (
            <View key={e.id} style={[s.fx, fresh ? { borderColor: TM.red, backgroundColor: 'rgba(155,47,34,0.06)' } : null]}>
              <View style={s.fh}>
                <Icon name={e.id} size={22} />
                <View style={{ flex: 1 }}>
                  <T f={CRIMB} size={13.5} style={{ lineHeight: p(17) }}>{EFFECT[e.id as EffectId].name}</T>
                  <T size={10} style={{ opacity: 0.75, lineHeight: p(13) }}>{fresh ? `new this month · ${what}` : what}</T>
                </View>
                {cure && !e.rabies ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <T f={FELL} size={16} style={{ lineHeight: p(18) }}>{String(cure.price)}</T>
                    <T size={9} style={{ opacity: 0.65 }}>{ITEM[cure.item].name}</T>
                  </View>
                ) : null}
              </View>
              {asked ? (
                <T size={10.5} color={TM.red}>Asked the camp. Everyone votes in step 2.</T>
              ) : e.ignored ? (
                <T size={10.5} style={{ opacity: 0.75 }}>Ignored: you take the full hit and keep the effect.</T>
              ) : (
                <View style={s.three}>
                  <Btn label="Pay myself" kind="ok" size={11.5} style={{ flex: 1 }} disabled={e.rabies || lost || !cure || jewels < jewelsFor(cure.price)} onPress={() => act({ type: 'TREAT', effect: e.id, how: 'pay' })} />
                  <Btn label="Ask for help" kind="ok2" size={11.5} style={{ flex: 1.2 }} disabled={e.rabies} onPress={() => act({ type: 'TREAT', effect: e.id, how: 'help' })} />
                  <Btn label="Ignore" kind="no" size={11.5} style={{ flex: 1 }} onPress={() => act({ type: 'TREAT', effect: e.id, how: 'ignore' })} />
                </View>
              )}
            </View>
          );
        })
      ) : (
        <T size={11} style={{ opacity: 0.7 }}>Nothing ails you this month.</T>
      )}
      <T size={11} style={{ opacity: 0.75, lineHeight: p(15) }}>Ask: everyone must approve. Others may donate jewels, anonymously; donations are used first, then the wallet. Ignore: you take the full hit and keep the effect.</T>
      {last ? (
        <View style={s.between}>
          <T size={11} style={{ opacity: 0.85 }}>Last request</T>
          <T f={CRIMB} size={11}>{REQ_STATUS[last.status]}</T>
        </View>
      ) : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------- chat (15)

/** The room's talk while the Gap is open: voice lines and stickers as they pop, kept as a short log. */
function useRoomLog(roomId: string, me: string) {
  useTalkFeed(roomId, me);
  const [log, setLog] = useState<TalkMsg[]>([]);
  useEffect(
    () =>
      useTalk.subscribe((st) =>
        setLog((l) => {
          const have = new Set(l.map((m) => m.id));
          const add = st.pops.filter((m) => !have.has(m.id));
          return add.length ? [...l, ...add].slice(-30) : l;
        }),
      ),
    [],
  );
  return log;
}

const Speaker = ({ color }: { color: string }) => (
  <Svg viewBox="0 0 12 12" width={p(11)} height={p(11)}>
    <Path d="M2 4.5h2l3-2.5v8l-3-2.5H2z" fill={color} />
    <Path d="M9 4a3 3 0 0 1 0 4" fill="none" stroke={color} strokeWidth={1} />
  </Svg>
);

function ChatTab({ props, log }: { props: PageProps; log: TalkMsg[] }) {
  const { env, roomId } = props;
  const v = env.view;
  const me = v.players.find((x) => x.id === v.me)!;
  const hoarse = me.effects.some((e) => e.id === 'hoarse');
  // Greys the voice lines for the 3 s between sends.
  const [cooling, setCooling] = useState(false);
  useEffect(
    () =>
      useTalk.subscribe((st, prev) => {
        if (st.nextAt === prev.nextAt) return;
        setCooling(true);
        setTimeout(() => setCooling(false), Math.max(0, st.nextAt - Date.now()) + 30);
      }),
    [],
  );
  return (
    <Sheet seed={`chat${v.month}`}>
      <Kicker title="The Gap · chat" props={props} />
      {log.length ? (
        <View style={{ gap: p(7) }}>
          {log.map((m) => {
            const mine = m.user_id === v.me;
            const st = m.kind === 'sticker' ? stickerById.get(m.item) : null;
            const line = m.kind === 'voice' ? voiceById.get(m.item)?.line : null;
            return (
              <View key={m.id} style={[s.msg, mine ? { alignSelf: 'flex-end' } : null]}>
                <T f={CRIMB} size={10.5} color={colorOf(v, m.user_id)} style={{ lineHeight: p(13) }}>{mine ? 'You' : nameOf(v, m.user_id) === 'Someone' ? m.name : nameOf(v, m.user_id)}</T>
                {st ? (
                  <Image source={st.src} style={{ width: p(44), height: p(44) }} contentFit="contain" accessibilityLabel={st.label} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: p(4) }}>
                    <Speaker color={TM.ink} />
                    <T f={CRIMI} size={12} style={{ lineHeight: p(16) }}>{line ?? '…'}</T>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <T size={11} style={{ opacity: 0.7, lineHeight: p(15) }}>Nobody has said anything yet. Voice lines play out loud on every phone in the camp.</T>
      )}
      <Sec style={{ marginTop: p(4) }}>Voice lines</Sec>
      {hoarse ? (
        <View style={s.inp}>
          <Icon name="hoarse" size={18} />
          <T f={CRIMI} size={12.5} style={{ flex: 1 }}>You are Hoarse: you can’t chat or send voice lines until it is cured.</T>
        </View>
      ) : (
        <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: p(6) }, cooling ? { opacity: 0.45 } : null]}>
          {GAP_VOICE.map((id) => voiceById.get(id)).filter((x) => !!x).map((x) => (
            <Pressable key={x.id} disabled={cooling} onPress={() => sendTalk(roomId, { id: v.me, name: me.name, face: '' }, 'voice', x.id)}
              accessibilityRole="button" accessibilityLabel={`Say: ${x.line}`} style={s.vl}>
              <Speaker color={TM.red} />
              <T size={11} color={TM.red}>{x.line}</T>
            </Pressable>
          ))}
        </View>
      )}
      {!hoarse ? <T size={9.5} style={{ opacity: 0.6 }}>{cooling ? 'One line every 3 seconds.' : 'Everyone hears the same voice.'}</T> : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------- rumor pen (16)

function RumorPen({ props }: { props: PageProps }) {
  const { env, act } = props;
  const v = env.view;
  const others = v.players.filter((x) => x.alive && x.id !== v.me);
  const [card, setCard] = useState<number | null>(null);
  const [names, setNames] = useState<string | null>(null);
  const naming = card != null && rules.RUMORS_NAMING.includes(card);
  return (
    <Sheet seed={`rumor${v.month}`} tabs={false}>
      <Kicker title="The Gap · the Rumor pen" props={props} />
      <T f={FELL} size={21} style={{ lineHeight: p(24) }}>Spread a rumor?</T>
      <T size={12.5} style={{ lineHeight: p(17), opacity: 0.85 }}>Only you hold the pen this month. Your rumor shows anonymously in the next Gap.</T>
      <View style={{ gap: p(4) }}>
        {RUMORS.map((_, i) => {
          const c = i + 1;
          const on = card === c;
          const who = on && names ? nameOf(v, names) : '____';
          return (
            <Pressable key={c} onPress={() => (setCard(c), setNames(null))} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.rl, on ? { borderColor: TM.red, backgroundColor: 'rgba(155,47,34,0.08)' } : null]}>
              <T f={CRIMI} size={13.5} style={{ lineHeight: p(17.5) }}>{rumorText(c, who)}</T>
            </Pressable>
          );
        })}
      </View>
      {naming ? (
        <>
          <T size={11} style={{ opacity: 0.75 }}>Who does it name?</T>
          <Pick players={others} sel={names} set={setNames} />
        </>
      ) : null}
      <View style={s.two}>
        <Pressable disabled={card == null || (naming && !names)} onPress={() => act({ type: 'RUMOR', card, ...(naming && names ? { names } : {}) })} accessibilityRole="button" accessibilityLabel="Spread it"
          style={[s.cta, { flex: 1 }, card == null || (naming && !names) ? { opacity: 0.4 } : null]}>
          <T f={FELL} size={14} color={TM.paper} style={{ textAlign: 'center' }}>Spread it</T>
        </Pressable>
        <Pressable onPress={() => act({ type: 'RUMOR', card: null })} accessibilityRole="button" accessibilityLabel="Pass" style={[s.ghostb, { flex: 1 }]}>
          <T f={FELL} size={14} style={{ textAlign: 'center' }}>Pass</T>
        </Pressable>
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------- the Gap, step 1

/** Gap step 1: notices first, then the tabs (Market, Bag, Gifts, Sell, Lend, Help, Chat), rumor pen when held. */
export function GapPage(props: PageProps) {
  const v = props.env.view;
  const [tab, setTab] = useState<Tab>('Market');
  const [seen, setSeen] = useState<string[]>([]);
  const [docPatient, setDocPatient] = useState<string | null>(null);
  const log = useRoomLog(props.roomId, v.me);
  const notices = useNotices(props, docPatient, setDocPatient, (key) => setSeen((x) => [...x, key])).filter((n) => !seen.includes(n.key));
  const tabs = useMemo(() => ({ Market: MarketTab, Bag: BagTab, Gifts: GiftsTab, Sell: SellTab, Lend: LendTab, Help: HelpTab }), []);

  let body: ReactNode;
  if (notices.length) body = <Notices list={notices} onSeen={() => setSeen((x) => [...x, ...notices.map((n) => n.key)])} />;
  else if (v.rumor.myPen) body = <RumorPen props={props} />;
  else {
    const Page = tab === 'Chat' ? null : tabs[tab];
    body = (
      <>
        {Page ? <Page props={props} /> : <ChatTab props={props} log={log} />}
        <TabBar tab={tab} set={setTab} />
      </>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <Strip players={v.players} me={v.me} />
      {body}
    </View>
  );
}

// ---------------------------------------------------------------- the Gap, step 2: votes (17)

/** The strip, with a stand-in bot greyed and marked (the careful bot plays for a disconnected player). */
function VoteStrip({ v, away }: { v: TmnView; away: string[] }) {
  return (
    <View>
      <Strip players={v.players} me={v.me} />
      {away.length ? (
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', justifyContent: 'space-between', paddingTop: p(9), paddingHorizontal: p(14) }]} pointerEvents="none">
          {v.players.map((x) => (
            <View key={x.id} style={{ width: p(46), alignItems: 'center' }}>
              {away.includes(x.id) && x.alive ? (
                <>
                  <View style={s.botVeil} />
                  <View style={s.botTag}><T size={8} color={TM.paper} style={{ lineHeight: p(10) }}>bot</T></View>
                </>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Gap step 2: votes on requests (living players, and ghosts on supply ties). */
export function VotesPage(props: PageProps) {
  const { env, act } = props;
  const v = env.view;
  const gx = env.extras.gap;
  const me = v.players.find((x) => x.id === v.me)!;
  const jewels = me.jewels ?? 0;
  const cold = v.missions.find((m) => m.holder === v.me && m.id === 'cold-shoulder' && m.status === 'active' && m.month === v.month - 1);
  const reqs = v.requests.filter((r) => r.status === 'open' && (!v.ghost || r.kind === 'supply'));
  return (
    <View style={{ flex: 1 }}>
      <VoteStrip v={v} away={gx.away} />
      <View style={[s.region, { top: p(80), bottom: p(14) }]}>
        <Kicker title="The Gap · step 2 of 2 · votes" props={props} light />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: p(12), paddingTop: p(10), paddingBottom: p(10) }} showsVerticalScrollIndicator={false}>
          {v.ghost ? <T size={11} color={TM.cream} style={shadow}>Ghosts vote only on wallet purchases. Your shared vote breaks a tie.</T> : null}
          {reqs.length ? null : (
            <Paper seed={`novote${v.month}`}>
              <T size={12.5} style={{ opacity: 0.85 }}>{v.ghost ? 'No wallet purchases to vote on this month.' : 'Nobody asked the camp for anything this month.'}</T>
            </Paper>
          )}
          {reqs.map((r, i) => {
            const help = r.kind === 'help';
            const mine = r.by === v.me;
            const vote = r.myVote;
            const title = help ? (r.effect ? EFFECT[r.effect].name : 'The Traveling Doctor') : r.meal ? MEAL[r.meal] : r.item ? ITEM[r.item].name : '';
            const sub = help
              ? r.effect ? `${ITEM[(gx.cures[r.effect]?.item ?? rules.ITEM_IDS.find((it) => rules.ITEMS[it].cures === r.effect)) as ItemId].name} · ${r.cost} coins` : `a full heal · ${r.cost} coins`
              : `${r.cost} coins from the wallet · majority`;
            const who = help ? `${nameOf(v, r.by)} ${mine ? 'ask' : 'asks'} the camp` : `${nameOf(v, r.by)} ${mine ? 'want' : 'wants'} ${r.meal ? MEAL_WANT[r.meal] : r.item ? ITEM[r.item].name : ''}`;
            const forceable = cold && !cold.data.used && cold.target === r.by && !mine;
            return (
              <View key={r.id} style={{ transform: [{ rotate: i % 2 ? '1.2deg' : '-0.8deg' }] }}>
                <Paper seed={`vote${r.id}`}>
                  <View style={{ gap: p(4) }}>
                    <T f={FELL} size={10} style={[s.caps, { opacity: 0.75 }]}>{help ? 'Help request' : 'Wallet purchase'}</T>
                    <View style={s.who}>
                      <Dot color={colorOf(v, r.by)} />
                      <T size={15} style={{ flex: 1 }}>{who}</T>
                    </View>
                    <View style={{ marginVertical: p(4) }}>
                      <T f={FELL} size={20} style={{ lineHeight: p(23) }}>{title}</T>
                      <T size={12} style={{ opacity: 0.8 }}>{sub}</T>
                    </View>
                    {help ? <T size={10.5} style={{ opacity: 0.7, marginBottom: p(5) }}>Everyone must approve. Your vote stays secret.</T> : null}
                    {mine ? (
                      <T size={11} style={{ opacity: 0.8 }}>Your own request. The others are voting.</T>
                    ) : (
                      <>
                        <View style={s.two}>
                          <Btn label="Approve" kind="ok" on={vote?.approve && !vote.donate} style={{ flex: 1 }} onPress={() => act({ type: 'VOTE', request: r.id, approve: true, donate: 0 })} />
                          {help ? (
                            <Btn label="Approve + donate" sub="1 jewel" kind="ok2" on={!!vote?.approve && vote.donate > 0} disabled={jewels < 1} style={{ flex: 1.3 }}
                              onPress={() => act({ type: 'VOTE', request: r.id, approve: true, donate: 1 })} />
                          ) : null}
                          <Btn label="Refuse" kind="no" on={vote ? !vote.approve : false} style={{ flex: 1 }} onPress={() => act({ type: 'VOTE', request: r.id, approve: false })} />
                        </View>
                        {vote ? <T size={10.5} style={{ opacity: 0.75 }}>{`Your vote: ${vote.approve ? (vote.donate ? `approve, donating ${plural(vote.donate, 'jewel')}` : 'approve') : 'refuse'}. Only you see it.`}</T> : null}
                        {forceable ? <Btn label="Force a refusal (your secret mission)" kind="no" size={11} onPress={() => act({ type: 'COLD_SHOULDER', request: r.id })} /> : null}
                        {cold?.data.used && cold.target === r.by ? <T size={10.5} color={TM.red}>Your Cold Shoulder is spent.</T> : null}
                      </>
                    )}
                  </View>
                </Paper>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  caps: { textTransform: 'uppercase', letterSpacing: p(0.7) },
  region: { position: 'absolute', left: p(12), right: p(12), top: p(74) },
  gtop: { flexDirection: 'row', alignItems: 'center' },
  done: { borderWidth: 1, paddingHorizontal: p(6), paddingVertical: p(2.5) },
  tabs: { position: 'absolute', left: p(12), right: p(12), bottom: p(14), flexDirection: 'row', justifyContent: 'space-between', backgroundColor: TM.ink, borderRadius: 2, paddingVertical: p(2), paddingHorizontal: p(3) },
  tab: { paddingVertical: p(5), paddingHorizontal: p(3), borderBottomWidth: 1, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: TM.redSoft },
  btn: { borderWidth: 1, borderColor: TM.ink, paddingVertical: p(9), paddingHorizontal: p(4), alignItems: 'center', justifyContent: 'center' },
  ok: { backgroundColor: TM.ink },
  ok2: { backgroundColor: 'rgba(42,31,22,0.08)' },
  no: { borderColor: TM.red },
  line: { borderColor: TM.line },
  btnOn: { borderColor: TM.red, borderWidth: 2 },
  cta: { backgroundColor: TM.ink, padding: p(10), alignItems: 'center' },
  ghostb: { borderWidth: 1, borderColor: TM.ink, padding: p(9), alignItems: 'center', justifyContent: 'center' },
  mini: { paddingVertical: p(5), paddingHorizontal: p(10) },
  two: { flexDirection: 'row', gap: p(6) },
  three: { flexDirection: 'row', gap: p(5) },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  round: { width: p(26), height: p(26), borderRadius: p(13), borderWidth: 1, borderColor: TM.line, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: p(10) },
  tog: { flexDirection: 'row', alignItems: 'center', gap: p(10) },
  track: { width: p(30), height: p(17), borderRadius: p(9), borderWidth: 1, borderColor: TM.line },
  knob: { position: 'absolute', top: p(2), left: p(2), width: p(11), height: p(11), borderRadius: p(6), backgroundColor: TM.ink, opacity: 0.5 },
  pk: { width: p(56), alignItems: 'center', paddingVertical: p(5), borderWidth: 1, borderColor: 'transparent' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: p(5), borderWidth: 1, borderColor: TM.line, paddingVertical: p(5), paddingHorizontal: p(8) },
  it: { flexDirection: 'row', alignItems: 'center', gap: p(9), paddingVertical: p(6), paddingHorizontal: p(2), borderBottomWidth: 1, borderBottomColor: 'rgba(42,31,22,0.35)', borderStyle: 'dashed' },
  purse: { flexDirection: 'row', gap: p(10), marginTop: p(4) },
  cara: { borderWidth: 1, borderColor: TM.red, borderStyle: 'dashed', paddingVertical: p(5), paddingHorizontal: p(8) },
  foods: { flexDirection: 'row', gap: p(6) },
  fd: { flex: 1, alignItems: 'center', paddingVertical: p(7), paddingHorizontal: p(4), borderWidth: 1, borderColor: 'rgba(42,31,22,0.35)' },
  payBox: { gap: p(6), borderWidth: 1, borderColor: TM.line, backgroundColor: SOFT, padding: p(8) },
  lockb: { flexDirection: 'row', gap: p(10), alignItems: 'center' },
  gem: { flex: 1, alignItems: 'center', paddingVertical: p(6), borderWidth: 1, borderColor: TM.line },
  msn: { gap: p(6), borderWidth: 1, borderColor: TM.red, borderStyle: 'dashed', padding: p(8), marginTop: p(4) },
  card: { gap: p(6), borderWidth: 1, borderColor: TM.line, backgroundColor: SOFT, paddingVertical: p(10), paddingHorizontal: p(12) },
  who: { flexDirection: 'row', alignItems: 'center', gap: p(7) },
  hero: { alignItems: 'center', paddingVertical: p(10), borderTopWidth: 1, borderBottomWidth: 1, borderColor: TM.line },
  flow: { flexDirection: 'row', alignItems: 'center', gap: p(10) },
  arrow: { flex: 1, height: 1, backgroundColor: TM.line },
  arrowHead: { position: 'absolute', right: 0, top: -p(3.5), width: 0, height: 0, borderLeftWidth: p(6), borderLeftColor: TM.red, borderTopWidth: p(3.5), borderBottomWidth: p(3.5), borderTopColor: 'transparent', borderBottomColor: 'transparent' },
  iou: { flexDirection: 'row', alignItems: 'center', gap: p(9), paddingVertical: p(7), borderBottomWidth: 1, borderBottomColor: TM.line },
  fx: { gap: p(7), borderWidth: 1, borderColor: TM.line, paddingVertical: p(8), paddingHorizontal: p(9) },
  fh: { flexDirection: 'row', alignItems: 'center', gap: p(9) },
  msg: { maxWidth: '84%', alignSelf: 'flex-start', paddingVertical: p(6), paddingHorizontal: p(10), borderWidth: 1, borderColor: TM.line, backgroundColor: SOFT },
  vl: { flexDirection: 'row', alignItems: 'center', gap: p(4), paddingVertical: p(5), paddingHorizontal: p(9), borderWidth: 1, borderColor: TM.red },
  inp: { flexDirection: 'row', alignItems: 'center', gap: p(8), paddingVertical: p(9), paddingHorizontal: p(12), borderWidth: 1, borderColor: TM.line, backgroundColor: 'rgba(42,31,22,0.05)' },
  rl: { paddingVertical: p(6), paddingHorizontal: p(8), borderWidth: 1, borderColor: TM.line },
  snr: { flexDirection: 'row', alignItems: 'center', gap: p(10) },
  nail: { position: 'absolute', top: p(8), alignSelf: 'center', width: p(9), height: p(9), borderRadius: p(5), backgroundColor: TM.ink },
  seen: { alignSelf: 'center', backgroundColor: TM.ink, paddingVertical: p(7), paddingHorizontal: p(26), borderRadius: 2 },
  botVeil: { width: p(34), height: p(34), borderRadius: p(17), backgroundColor: 'rgba(60,60,60,0.55)' },
  botTag: { marginTop: p(17), backgroundColor: TM.ink, borderRadius: 3, paddingHorizontal: p(3) },
});
