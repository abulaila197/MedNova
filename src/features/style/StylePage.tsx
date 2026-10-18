import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/AppText';
import { Display } from '@/components/Txt';
import { useBalance } from '@/components/LevelBadge';
import { TokenCoin } from '@/components/PulseStar';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { Face } from '@/games/shell/Face';
import { useSession } from '@/games/shell/session';
import { TEXT_PACKS, textPackOf } from '@/online/textStickers';
import { useAccount } from '@/state/account';
import { loadFriends, useFriends } from '@/state/friends';
import type { Theme } from '@/theme/tokens';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { costOf, DEAL_OFF, EFFECTS, FRAMES, type Item, PACK_PRICE, PLATINUM_TITLES, titleName, TITLES } from './catalog';
import { Framed, type FrameKey } from './Frame';
import { titleColor } from './PlayerTitle';
import { buyItem, loadStyle, spendTokens, useStyle, wear, whySay } from './useStyle';
import { EffectSign, WinEffect } from './WinEffect';

export type Tab = 'frames' | 'titles' | 'effects' | 'stickers';
const TABS: { k: Tab; label: string }[] = [
  { k: 'frames', label: 'Frames' },
  { k: 'titles', label: 'Titles' },
  { k: 'effects', label: 'Win effects' },
  { k: 'stickers', label: 'Stickers' },
];

// Text sticker packs (Yazan 2026-10-13); character stickers are free and not sold.
// The 3 daily chest packs are shown but never sold (Yazan 2026-10-18).
const PACKS: Item[] = TEXT_PACKS.map((p) => ({ id: `pack:${p.key}`, key: p.key, name: p.name, price: p.chest ? null : PACK_PRICE }));
const fromChest = (id: string) => !!textPackOf(id.replace(/^pack:/, ''))?.chest;

const left = (ms: number) => {
  const h = Math.max(0, Math.floor((ms - Date.now()) / 3600000));
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`;
};

/**
 * The Style shop (Yazan 2026-10-13): frames, titles, win effects and sticker packs, bought with tokens. The top card
 * shows you wearing what you tap, so you can try before buying. Opened from the Store and from Profile's buttons.
 */
export function StylePage() {
  const c = useInfo();
  const t = c.t;
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [chosen, setTab] = useState<Tab | null>(null);
  const tab = chosen ?? params.tab ?? 'frames';
  const signedIn = !!useSession((x) => x.userId);
  const profile = useAccount((a) => a.profile);
  const { tokens } = useBalance();
  const { owned, worn, deal, dealEnds } = useStyle();
  const [pick, setPick] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const [gift, setGift] = useState(false);
  const [trying, setTrying] = useState<Item | null>(null);

  useEffect(() => {
    void loadStyle();
  }, [signedIn]);
  // Coming back from Profile's buttons opens the tab they asked for.
  useFocusEffect(useCallback(() => setTab(null), []));

  const has = (id: string) => owned.includes(id);
  const frame = (pick?.id.startsWith('frame:') ? pick.key : worn.frame) as FrameKey;
  const title = pick?.id.startsWith('title:') ? pick.key : worn.title;

  const act = async (fn: () => Promise<{ ok: boolean; why?: string; need?: number }>, done: string) => {
    if (!signedIn) return router.navigate('/auth');
    setBusy(true);
    setSaid('');
    const r = await fn();
    setBusy(false);
    setSaid(r.ok ? done : whySay(r as { why: string; need?: number }));
  };

  const list = tab === 'frames' ? FRAMES : tab === 'titles' ? [...TITLES, ...PLATINUM_TITLES] : tab === 'effects' ? EFFECTS : PACKS;
  const wearing = (it: Item) =>
    it.id.startsWith('frame:') ? worn.frame === it.key : it.id.startsWith('title:') ? worn.title === it.key : it.id.startsWith('effect:') ? worn.effect === it.key : false;

  return (
    <Screen tab={null} glow={21}>
      <InfoScroll>
        <Kicker>Style shop</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {'Dress your '}
          <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>name</Text>
        </Text>

        {/* You, wearing what you tapped. */}
        <View style={[s.me, { backgroundColor: c.surf, borderColor: c.line }]}>
          <Framed slug={profile?.avatar ?? 'yara'} size={u(92)} frame={frame} />
          <View style={{ flex: 1, gap: u(2) }}>
            <Display em={profile?.display_name ?? 'Guest'} italic style={[s.meN, { color: c.fg }]}>
              {'Dr. '}
            </Display>
            <Text style={[s.meT, { color: titleColor(t.mode, title, t.accent) }]}>{titleName(title)}</Text>
            <View style={s.bal}>
              <TokenCoin size={u(13)} progress={0} track="transparent" />
              <Text style={[s.balT, { color: c.mute }]}>{signedIn ? `${tokens} tokens` : 'Sign in to buy'}</Text>
            </View>
          </View>
        </View>

        {/* A tapped sticker pack shows all its stickers. */}
        {pick?.id.startsWith('pack:') ? (
          <View style={[s.packAll, { backgroundColor: c.surf, borderColor: c.line }]}>
            {(textPackOf(pick.key)?.stickers ?? []).map((x) => (
              <Image key={x.id} source={x.src} style={s.packImg} contentFit="contain" accessibilityLabel={x.label} />
            ))}
          </View>
        ) : null}

        {/* This week's deal: one frame and one title at DEAL_OFF% off. */}
        {deal.length ? (
          <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={s.deal}>
            <Text style={[s.dealK, { color: t.onGrad }]}>{`THIS WEEK · ${DEAL_OFF}% OFF · ENDS IN ${left(dealEnds).toUpperCase()}`}</Text>
            <Text style={[s.dealT, { color: t.onGrad }]}>
              {[FRAMES, TITLES].map((l, i) => {
                const it = l.find((x) => x.id === deal[i]);
                return it ? `${it.name} ${i ? 'title' : 'frame'}` : '';
              }).filter(Boolean).join('  ·  ')}
            </Text>
          </LinearGradient>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll} contentContainerStyle={s.tabs}>
          {TABS.map((x) => {
            const on = x.k === tab;
            return (
              <Pressable
                key={x.k}
                onPress={() => {
                  setTab(x.k);
                  setPick(null);
                  setSaid('');
                }}
                style={[s.tab, { borderColor: on ? c.chipOnLine : c.line, backgroundColor: on ? c.chipOnFill : 'transparent' }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}>
                <Text style={[s.tabT, { color: on ? c.fg : c.mute }]}>{x.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {said ? <Text style={[s.said, { color: c.fg, borderColor: c.line, backgroundColor: c.surf }]}>{said}</Text> : null}

        {tab === 'frames' ? (
          <View style={s.grid}>
            {FRAMES.map((it) => (
              <Cell key={it.id} t={t} on={pick?.id === it.id} onPress={() => setPick(it)}>
                {/* Still in the grid; the one you tap moves in the card above. */}
                <Framed slug={profile?.avatar ?? 'yara'} size={u(62)} frame={it.key} still />
                <Text style={[s.cN, { color: c.fg }]} numberOfLines={1}>{it.name}</Text>
                <Price t={t} it={it} deal={deal} owned={has(it.id)} wearing={wearing(it)} />
              </Cell>
            ))}
          </View>
        ) : (
          <View style={[s.list, { borderColor: c.line, backgroundColor: c.surf }]}>
            {list.map((it, i) => (
              <Pressable
                key={it.id}
                onPress={() => setPick(it)}
                style={[s.row, i > 0 && { borderTopWidth: 1, borderColor: c.line }, pick?.id === it.id && { backgroundColor: c.chipOnFill }]}
                accessibilityRole="button"
                accessibilityState={{ selected: pick?.id === it.id }}>
                {tab === 'effects' ? <EffectSign kind={(it as (typeof EFFECTS)[number]).key} size={u(30)} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={[s.rN, { color: tab === 'titles' ? titleColor(t.mode, it.key, c.fg) : c.fg, fontFamily: tab === 'titles' ? F.displayItalic : F.bodySemi }]}>{it.name}</Text>
                  {tab === 'effects' ? <Text style={[s.rS, { color: c.mute }]}>{(it as (typeof EFFECTS)[number]).what}</Text> : null}
                  {tab === 'stickers' ? <Stickers slug={it.key} /> : null}
                  {it.price == null ? <Text style={[s.rS, { color: c.mute }]}>{fromChest(it.id) ? 'From daily chests' : 'Earned at this achievement\u2019s Platinum tier'}</Text> : null}
                </View>
                <Price t={t} it={it} deal={deal} owned={has(it.id)} wearing={wearing(it)} />
              </Pressable>
            ))}
          </View>
        )}

        {tab === 'effects' ? <Glow t={t} busy={busy} act={act} glow={worn.glow} /> : null}
        <View style={{ height: u(120) }} />
      </InfoScroll>

      {/* What you can do with the item you tapped. */}
      {pick ? (
        <View style={[s.bar, { backgroundColor: c.surf, borderColor: c.line }]}>
          <Text style={[s.barN, { color: c.fg }]} numberOfLines={1}>{pick.name}</Text>
          <View style={s.barBtns}>
            {pick.id.startsWith('effect:') ? <Small t={t} label="Try it" onPress={() => setTrying(pick)} /> : null}
            {pick.price ? <Small t={t} label="Gift" onPress={() => (signedIn ? setGift(true) : router.navigate('/auth'))} /> : null}
            {has(pick.id) ? (
              pick.id.startsWith('pack:') ? (
                <Text style={[s.barS, { color: c.mute }]}>Yours in every room</Text>
              ) : wearing(pick) ? (
                pick.id.startsWith('effect:') ? (
                  <Big t={t} label="Take off" busy={busy} onPress={() => act(() => wear({ effect: null }), 'Taken off.')} />
                ) : (
                  <Text style={[s.barS, { color: c.mute }]}>Wearing</Text>
                )
              ) : (
                <Big t={t} label="Wear" busy={busy} onPress={() => act(() => wear({ [pick.id.split(':')[0]]: pick.id.slice(pick.id.indexOf(':') + 1) }), 'Done. Everyone sees it now.')} />
              )
            ) : pick.price == null ? (
              <Text style={[s.barS, { color: c.mute }]}>{fromChest(pick.id) ? 'From daily chests' : 'Earned, not sold'}</Text>
            ) : (
              <Big t={t} label={`Buy · ${costOf(pick, deal)}`} busy={busy} onPress={() => act(() => buyItem(pick.id), 'Bought. Tap Wear to put it on.')} />
            )}
          </View>
        </View>
      ) : null}

      <GiftSheet open={gift} item={pick} onClose={() => setGift(false)} onSent={(name) => setSaid(`Sent to ${name}. They get a pop-up next time they open MedNova.`)} />
      {trying ? <WinEffect kind={(trying as (typeof EFFECTS)[number]).key} onDone={() => setTrying(null)} /> : null}
    </Screen>
  );
}

function Cell({ t, on, onPress, children }: { t: Theme; on: boolean; onPress: () => void; children: React.ReactNode }) {
  const c = useInfo();
  return (
    <Pressable onPress={onPress} style={[s.cell, { backgroundColor: t.panel, borderColor: on ? c.chipOnLine : t.panelLine }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
      {children}
    </Pressable>
  );
}

function Price({ t, it, deal, owned, wearing }: { t: Theme; it: Item; deal: string[]; owned: boolean; wearing: boolean }) {
  if (wearing) return <Text style={[s.pT, { color: t.accent }]}>WEARING</Text>;
  if (owned) return <Text style={[s.pT, { color: t.mute }]}>OWNED</Text>;
  if (it.price == null) return <Text style={[s.pT, { color: t.mute }]}>EARNED</Text>;
  const now = costOf(it, deal)!;
  return (
    <View style={s.price}>
      {now !== it.price ? <Text style={[s.pT, s.was, { color: t.mute }]}>{it.price}</Text> : null}
      <Text style={[s.pT, { color: now !== it.price ? t.accent : t.fg }]}>{now}</Text>
      <TokenCoin size={u(9)} progress={0} track="transparent" />
    </View>
  );
}

function Stickers({ slug }: { slug: string }) {
  return (
    <View style={s.stk}>
      {(textPackOf(slug)?.stickers ?? []).slice(0, 4).map((x) => (
        <Image key={x.id} source={x.src} style={{ width: u(40), height: u(24) }} contentFit="contain" accessibilityLabel={x.label} />
      ))}
    </View>
  );
}

/** Leaderboard name glow for a week (50 tokens). */
function Glow({ t, busy, act, glow }: { t: Theme; busy: boolean; act: (fn: () => Promise<{ ok: boolean }>, done: string) => void; glow: boolean }) {
  const c = useInfo();
  return (
    <View style={[s.list, s.glow, { borderColor: c.line, backgroundColor: c.surf }]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.rN, { color: c.fg, textShadowColor: t.accent, textShadowRadius: u(8) }]}>Name glow</Text>
        <Text style={[s.rS, { color: c.mute }]}>{glow ? 'Your name glows on the leaderboard. Buying again adds a week.' : 'Your name glows on the leaderboard for 7 days'}</Text>
      </View>
      <Big t={t} label="50" coin busy={busy} onPress={() => act(() => spendTokens('glow'), 'Your name glows for 7 days.')} />
    </View>
  );
}

function Big({ t, label, onPress, busy, coin }: { t: Theme; label: string; onPress: () => void; busy?: boolean; coin?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" style={busy && { opacity: 0.6 }}>
      <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.big}>
        <Text style={[s.bigT, { color: t.onGrad }]}>{label}</Text>
        {coin ? <TokenCoin size={u(11)} progress={0} track="transparent" /> : null}
      </LinearGradient>
    </Pressable>
  );
}

function Small({ t, label, onPress }: { t: Theme; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.small, { borderColor: t.panelLine }]} accessibilityRole="button">
      <Text style={[s.smallT, { color: t.fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Pick a friend to send the item to. */
function GiftSheet({ open, item, onClose, onSent }: { open: boolean; item: Item | null; onClose: () => void; onSent: (name: string) => void }) {
  const c = useInfo();
  const friends = useFriends((f) => f.list);
  const mates = useMemo(() => friends.filter((f) => f.kind === 'friend'), [friends]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const deal = useStyle((x) => x.deal);
  useEffect(() => {
    if (open) loadFriends().catch(() => {});
  }, [open]);
  if (!item) return null;
  return (
    <Sheet open={open} onClose={onClose}>
      <Text style={[s.gH, { color: c.fg }]}>{`Gift ${item.name}`}</Text>
      <Text style={[s.rS, { color: c.mute, marginBottom: u(8) }]}>{`${costOf(item, deal)} tokens from you. It's theirs to keep.`}</Text>
      {err ? <Text style={[s.rS, { color: c.t.red }]}>{err}</Text> : null}
      {mates.length ? (
        mates.map((f) => (
          <Pressable
            key={f.id}
            disabled={!!busy}
            onPress={async () => {
              setErr('');
              setBusy(f.id);
              const r = await buyItem(item.id, f.id);
              setBusy(null);
              if (r.ok) {
                onClose();
                onSent(f.display_name);
              } else setErr(r.why === 'owned' ? `${f.display_name} already has it.` : whySay(r));
            }}
            style={[s.gRow, { borderColor: c.line }, busy === f.id && { opacity: 0.6 }]}
            accessibilityRole="button">
            <Face slug={f.avatar} size={u(26)} />
            <Text style={[s.rN, { color: c.fg, flex: 1 }]}>{f.display_name}</Text>
            <Text style={[s.smallT, { color: c.t.accent }]}>Send</Text>
          </Pressable>
        ))
      ) : (
        <Text style={[s.rS, { color: c.mute }]}>Add friends first, then you can send them gifts.</Text>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center', gap: u(12), borderWidth: 1, borderRadius: u(20), padding: u(12), marginTop: u(14) },
  meN: { fontSize: u(20), lineHeight: u(24) },
  meT: { fontFamily: F.displayItalic, fontSize: u(12.5) },
  bal: { flexDirection: 'row', alignItems: 'center', gap: u(4), marginTop: u(4) },
  balT: { fontFamily: F.body, fontSize: u(10) },
  deal: { borderRadius: u(16), paddingVertical: u(10), paddingHorizontal: u(14), marginTop: u(12) },
  dealK: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3), opacity: 0.8 },
  dealT: { fontFamily: F.display, fontSize: u(15), marginTop: u(2) },
  tabsScroll: { marginHorizontal: -u(18), marginTop: u(14) },
  tabs: { paddingHorizontal: u(18), gap: u(6) },
  tab: { borderWidth: 1, borderRadius: 999, paddingHorizontal: u(12), height: u(28), justifyContent: 'center' },
  tabT: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  said: { fontFamily: F.bodyMedium, fontSize: u(11), lineHeight: u(15), marginTop: u(10), borderWidth: 1, borderRadius: u(12), paddingVertical: u(8), paddingHorizontal: u(12), overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8), marginTop: u(12) },
  cell: { width: '31.5%', borderWidth: 1, borderRadius: u(16), paddingVertical: u(10), alignItems: 'center', gap: u(3) },
  cN: { fontFamily: F.bodySemi, fontSize: u(10.5), marginTop: u(2) },
  price: { flexDirection: 'row', alignItems: 'center', gap: u(3) },
  pT: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(0.8) },
  was: { textDecorationLine: 'line-through' },
  list: { borderWidth: 1, borderRadius: u(16), marginTop: u(12), overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(10), paddingVertical: u(10), paddingHorizontal: u(12) },
  rN: { fontSize: u(13) },
  rS: { fontFamily: F.body, fontSize: u(9.5), marginTop: u(2) },
  stk: { flexDirection: 'row', gap: u(3), marginTop: u(4) },
  packAll: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: u(6), borderWidth: 1, borderRadius: u(18), padding: u(12), marginTop: u(10) },
  packImg: { width: '23.5%', aspectRatio: 1.5 },
  glow: { flexDirection: 'row', alignItems: 'center', padding: u(12), gap: u(10) },
  bar: { position: 'absolute', left: u(14), right: u(14), bottom: u(18), borderWidth: 1, borderRadius: u(18), paddingVertical: u(10), paddingHorizontal: u(14), gap: u(8) },
  barN: { fontFamily: F.display, fontSize: u(15) },
  barBtns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: u(6) },
  barS: { fontFamily: F.bodyMedium, fontSize: u(10.5) },
  big: { flexDirection: 'row', alignItems: 'center', gap: u(4), height: u(32), borderRadius: 999, paddingHorizontal: u(14) },
  bigT: { fontFamily: F.bodyBold, fontSize: u(11.5) },
  small: { height: u(32), borderRadius: 999, borderWidth: 1, paddingHorizontal: u(12), justifyContent: 'center' },
  smallT: { fontFamily: F.bodySemi, fontSize: u(11) },
  gH: { fontFamily: F.display, fontSize: u(19) },
  gRow: { flexDirection: 'row', alignItems: 'center', gap: u(10), paddingVertical: u(9), borderTopWidth: 1 },
});
