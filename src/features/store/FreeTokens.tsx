import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { create } from 'zustand';

import { Text } from '@/components/AppText';
import { Sheet } from '@/components/Sheet';
import { ADS_LIVE } from '@/features/freeplays/paywall';
import { Kicker } from '@/features/info/ui';
import { useSession } from '@/games/shell/session';
import { syncAccount } from '@/lib/sync';
import { call } from '@/online/api';
import { u } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

import { LINKS } from './links';

type Icon = (p: { size: number; color: string }) => ReactNode;
type Way = { key: string; label: string; tokens: number; each?: boolean; act: string; icon: Icon };

const stroke = { fill: 'none', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const I: Record<string, Icon> = {
  tiktok: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Path d="M13 4v10.5a3.5 3.5 0 1 1-3.5-3.5" />
      <Path d="M13 4c.5 2.6 2.4 4.3 5 4.5" />
    </Svg>
  ),
  instagram: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Rect x="4" y="4" width="16" height="16" rx="5" />
      <Circle cx="12" cy="12" r="3.6" />
      <Circle cx="16.6" cy="7.4" r="0.6" fill={color} />
    </Svg>
  ),
  facebook: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M13.4 20.3V11.5c0-1.4.8-2.3 2.2-2.3h1.1M10.6 13.2h5.2" />
    </Svg>
  ),
  youtube: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Rect x="3" y="6" width="18" height="12.5" rx="4" />
      <Path d="M10.4 9.6v5.2l4.4-2.6z" fill={color} />
    </Svg>
  ),
  channel: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Path d="M4 10v4h3l7 4V6L7 10z" />
      <Path d="M17.5 9.5a3.5 3.5 0 0 1 0 5M7.5 14.5l1 4" />
    </Svg>
  ),
  community: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Circle cx="9" cy="12" r="5.5" />
      <Circle cx="15" cy="12" r="5.5" />
    </Svg>
  ),
  listing: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Rect x="6.5" y="3" width="11" height="18" rx="2.5" />
      <Path d="M12 8.4l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" />
    </Svg>
  ),
  feedback: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17H11l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" />
      <Path d="M8 10h8M8 13h5" />
    </Svg>
  ),
  story: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Path d="M19 4.5c-6 1-10.5 5.5-12.5 13l-1.5 3" />
      <Path d="M19 4.5c.5 5-2.5 9-8.5 10.5" />
    </Svg>
  ),
  video: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Rect x="3.5" y="6.5" width="12" height="11" rx="2.5" />
      <Path d="M15.5 10.5l5-3v9l-5-3" />
    </Svg>
  ),
  invite: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Path d="M3.5 8.5a2 2 0 0 0 0 4v4a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5v-4a2 2 0 0 1 0-4V7A1.5 1.5 0 0 0 19 5.5H5A1.5 1.5 0 0 0 3.5 7z" />
      <Path d="M14.5 6v12" strokeDasharray="1.6 2" />
    </Svg>
  ),
  ad: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Rect x="3" y="5" width="18" height="12" rx="2.5" />
      <Path d="M10.5 8.8v4.4l3.8-2.2z" />
      <Path d="M8 20h8" />
    </Svg>
  ),
  globe: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5S9.5 6.1 12 3.5z" />
    </Svg>
  ),
};

// Amounts decided 2026-10-11 (each once per account); the server pays (free_claim and friends).
const WAYS: Way[] = [
  { key: 'tiktok', label: 'Follow us on TikTok', tokens: 3, act: 'Follow', icon: I.tiktok },
  { key: 'instagram', label: 'Follow us on Instagram', tokens: 3, act: 'Follow', icon: I.instagram },
  { key: 'facebook', label: 'Follow us on Facebook', tokens: 3, act: 'Follow', icon: I.facebook },
  { key: 'youtube', label: 'Subscribe on YouTube', tokens: 3, act: 'Subscribe', icon: I.youtube },
  { key: 'channel', label: 'Join our Instagram channel', tokens: 3, act: 'Join', icon: I.channel },
  { key: 'community', label: 'Visit the Community page', tokens: 2, act: 'Visit', icon: I.community },
  { key: 'listing', label: Platform.OS === 'android' ? 'Visit us on Google Play' : 'Visit us on the App Store', tokens: 3, act: 'Visit', icon: I.listing },
  { key: 'feedback', label: 'Send us your feedback', tokens: 10, act: 'Write', icon: I.feedback },
  { key: 'story', label: 'Share your story', tokens: 5, each: true, act: 'Write', icon: I.story },
  { key: 'ambassador', label: 'Ambassador video', tokens: 50, act: 'Apply', icon: I.video },
  { key: 'invite', label: 'Invite a friend with your code', tokens: 10, each: true, act: 'My code', icon: I.invite },
];

/** Store ads (1 token each, 5 a day, Yazan 2026-10-12; separate from play-again ads, which give a play and no tokens; the server's ad_watched holds the same numbers). Locked "Coming soon" until ads are live. */
const AD_WAY: Way = { key: 'ad', label: 'Watch an ad', tokens: 1, each: true, act: 'Watch', icon: I.ad };
const AD_CAP = 5;

type FreeStatus = { ads_today?: number; done: string[]; ambassador: 'pending' | 'approved' | 'rejected' | null; invites: number; invite_tokens: number; redeemed: boolean; downloads: number | null; goal: number };
type OpenSheet = 'story' | 'feedback' | 'ambassador' | null;

/** What this player already collected, and which sheet is open (drawn by the Store page above its scroll). */
export const useFree = create<{ status: FreeStatus | null; sheet: OpenSheet }>(() => ({ status: null, sheet: null }));

export async function loadFree() {
  if (!useSession.getState().userId) return useFree.setState({ status: null });
  useFree.setState({ status: await call<FreeStatus>('free_status') });
}

/** After the server paid: bring the new wallet rows to the phone, then refresh what's collected. */
async function settle() {
  const uid = useSession.getState().userId;
  if (uid) await syncAccount(uid).catch(() => {});
  await loadFree().catch(() => {});
}

const CARD = u(124);
const GAP = u(10);
const GOLD = ['#f7dd8b', '#d39a2c', '#f3cf6c'] as const;
const SOCIAL = ['tiktok', 'instagram', 'facebook', 'youtube', 'channel'] as const;

/** Free tokens (locked look A, one row): pack-shaped boxes, the gold global mission first. Sits between the subscription and the packs. */
export function FreeTokens({ t }: { t: Theme }) {
  const signedIn = !!useSession((x) => x.userId);
  const st = useFree((x) => x.status);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    loadFree().catch(() => {});
  }, [signedIn]);
  const done = new Set(st?.done ?? []);
  const stories = [0, 1, 2, 3, 4].filter((i) => done.has(`free:story:${i}`)).length;
  const isDone = (w: Way) =>
    w.key === 'story' ? stories === 5 : w.key === 'ambassador' ? st?.ambassador === 'approved' : w.key === 'invite' ? false : done.has(`free:${w.key}`);

  const claim = async (key: string) => {
    setBusy(key);
    try {
      await call('free_claim', { way: key });
      await settle();
    } catch {
      // stays open; the next tap tries again
    }
    setBusy(null);
  };
  const tap = (w: Way) => {
    if (!signedIn) return router.navigate('/auth');
    if (busy) return;
    if ((SOCIAL as readonly string[]).includes(w.key)) {
      Linking.openURL(LINKS[w.key as (typeof SOCIAL)[number]]).catch(() => {});
      return claim(w.key);
    }
    if (w.key === 'listing') {
      Linking.openURL(Platform.OS === 'android' ? LINKS.listingAndroid : LINKS.listing).catch(() => {});
      return claim('listing');
    }
    if (w.key === 'community') {
      claim('community');
      return router.navigate('/community' as never);
    }
    if (w.key === 'invite') return router.navigate('/friends' as never);
    if (w.key === 'ambassador' && st?.ambassador === 'pending') return;
    useFree.setState({ sheet: w.key as OpenSheet });
  };
  // ADS_LIVE: show the rewarded ad first and stop here unless it was watched to the end.
  const watchAd = async () => {
    if (busy || !ADS_LIVE) return;
    setBusy('ad');
    try {
      await call('ad_watched', { source: 'store' });
      await settle();
    } catch {}
    setBusy(null);
  };
  const label = (w: Way) => (w.key === 'story' ? `${w.label} · ${stories} of 5` : w.key === 'invite' && st ? `${w.label} · ${st.invite_tokens} of 150` : w.label);
  const act = (w: Way) => (!signedIn ? 'Sign in' : w.key === 'ambassador' && st?.ambassador === 'pending' ? 'In review' : w.act);
  return (
    <>
      <View style={{ height: u(14) }} />
      <Kicker inSec>Free tokens</Kicker>
      <Row>
        <Global t={t} st={st} signedIn={signedIn} />
        <WayCard t={t} w={AD_WAY} label={ADS_LIVE && st ? `${AD_WAY.label} · ${st.ads_today ?? 0} of ${AD_CAP} today` : AD_WAY.label} act={signedIn ? AD_WAY.act : 'Sign in'} done={(st?.ads_today ?? 0) >= AD_CAP} locked={!ADS_LIVE} busy={busy === 'ad'} onPress={() => (signedIn ? watchAd() : router.navigate('/auth'))} />
        {WAYS.map((w) => (
          <WayCard key={w.key} t={t} w={w} label={label(w)} act={act(w)} done={isDone(w)} busy={busy === w.key} onPress={() => tap(w)} />
        ))}
      </Row>
    </>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.rowScroll} contentContainerStyle={s.row} snapToInterval={CARD + GAP} decelerationRate="fast">
      {children}
    </ScrollView>
  );
}

function WayCard({ t, w, label, act, done, locked, busy, onPress }: { t: Theme; w: Way; label: string; act: string; done: boolean; locked?: boolean; busy: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={done || locked ? undefined : onPress} accessibilityRole="button" accessibilityLabel={`${w.label}, ${w.tokens} tokens`} style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }, busy && { opacity: 0.6 }]}>
      <View style={[s.ic, { backgroundColor: 'rgba(111,214,255,0.1)' }]}>{w.icon({ size: u(17), color: t.accent })}</View>
      <Text style={[s.cN, { color: t.fg }]}>{`+${w.tokens}`}</Text>
      <Text style={[s.cU, { color: t.mute }]} numberOfLines={2}>
        {w.each ? `${label} · each` : label}
      </Text>
      {done || locked ? (
        <View style={[s.cBtn, s.ghost, { borderColor: t.panelLine }]}>
          <Text style={[s.cBtnT, { color: t.mute }]}>{locked ? 'Coming soon' : w.each ? 'Back tomorrow' : 'Collected ✓'}</Text>
        </View>
      ) : (
        <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.cBtn}>
          <Text style={[s.cBtnT, { color: t.onGrad }]}>{act}</Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}

/** The global mission: the same box, in a gold frame, with the download bar. When it's reached, players who were here collect 200. */
function Global({ t, st, signedIn }: { t: Theme; st: FreeStatus | null; signedIn: boolean }) {
  const goal = st?.goal ?? 100000;
  const now = Math.min(goal, st?.downloads ?? 0);
  const reached = now >= goal;
  const got = st?.done.includes('free:global');
  const [busy, setBusy] = useState(false);
  const collect = async () => {
    if (!signedIn) return router.navigate('/auth');
    setBusy(true);
    try {
      await call('global_claim');
      await settle();
    } catch {}
    setBusy(false);
  };
  return (
    <LinearGradient colors={GOLD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.gold}>
      <Pressable disabled={!reached || got || busy} onPress={collect} style={[s.card, s.goldIn, { backgroundColor: '#1a1830' }]} accessibilityLabel={`Global mission: ${now} of ${goal} downloads`}>
        <Text style={[s.gKick, { color: '#f3cf6c' }]}>GLOBAL MISSION</Text>
        <Text style={[s.cN, { color: t.fg }]}>+200</Text>
        <Text style={[s.cU, { color: t.mute }]} numberOfLines={2}>
          {got ? 'Collected. Thank you!' : reached ? 'We made it! Tap to collect' : 'for everyone at 100k downloads'}
        </Text>
        <View style={[s.bar, { backgroundColor: 'rgba(243,207,108,0.15)' }]}>
          <LinearGradient colors={GOLD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.max(2, (now / goal) * 100)}%`, height: '100%', borderRadius: 999 }} />
        </View>
        <Text style={[s.gNum, { color: '#f3cf6c' }]}>{`${now.toLocaleString('en-US')} / ${goal.toLocaleString('en-US')}`}</Text>
      </Pressable>
    </LinearGradient>
  );
}

export const PROMPTS = ['Why you chose medicine', 'A burnout story', 'Your hardest phase in college', 'The moment that kept you going', 'Your funniest moment'];
const SAY: Record<string, string> = { short: 'Write at least 20 characters.', done: 'Already sent.', missing: 'Fill in every field.', 'too many': 'That is enough for today. Try tomorrow.' };

/** The three writing sheets of the free ways: story (5 tokens each prompt), feedback (10, first time) and Ambassador (50 after approval). */
export function FreeSheets({ t }: { t: Theme }) {
  const sheet = useFree((x) => x.sheet);
  const close = () => useFree.setState({ sheet: null });
  if (!sheet) return null;
  return (
    <Modal transparent visible onRequestClose={close}>
      <Sheet open onClose={close}>
        {sheet === 'story' ? <StoryForm t={t} onDone={close} /> : sheet === 'feedback' ? <FeedbackForm t={t} onDone={close} /> : <AmbassadorForm t={t} onDone={close} />}
      </Sheet>
    </Modal>
  );
}

/** Sends one form; shows the server's answer under it. */
function useSend(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const send = async (fn: string, args: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await call<{ ok: boolean; why?: string }>(fn, args);
      if (r.ok) {
        await settle();
        onDone();
      } else setMsg(SAY[r.why ?? ''] ?? 'Not sent. Try again.');
    } catch {
      setMsg('Not sent. Check your connection and try again.');
    }
    setBusy(false);
  };
  return { busy, msg, send };
}

function StoryForm({ t, onDone }: { t: Theme; onDone: () => void }) {
  const done = new Set(useFree((x) => x.status?.done) ?? []);
  const sent = [0, 1, 2, 3, 4].filter((i) => done.has(`free:story:${i}`));
  const [p, setP] = useState([0, 1, 2, 3, 4].find((i) => !sent.includes(i)) ?? 0);
  const [body, setBody] = useState('');
  const [credit, setCredit] = useState(false);
  const { busy, msg, send } = useSend(onDone);
  return (
    <>
      <Title t={t} a="Share your " b="story" />
      <View style={s.chips}>
        {PROMPTS.map((x, i) => (
          <Pressable key={x} disabled={sent.includes(i)} onPress={() => setP(i)} style={[s.chip, { borderColor: i === p ? t.accent : t.panelLine, backgroundColor: i === p ? tint(t) : 'transparent', opacity: sent.includes(i) ? 0.5 : 1 }]}>
            <Text style={[s.chipT, { color: i === p ? t.fg : t.mute }]}>{sent.includes(i) ? `${x} ✓` : x}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput multiline value={body} onChangeText={setBody} maxLength={4000} placeholder="Tell it your way..." placeholderTextColor={t.mute} style={[s.area, { color: t.fg, borderColor: t.panelLine, backgroundColor: t.panel2 }]} />
      <Pressable onPress={() => setCredit((v) => !v)} style={s.tick} accessibilityRole="checkbox" accessibilityState={{ checked: credit }}>
        <View style={[s.box, { borderColor: credit ? t.accent : t.mute, backgroundColor: credit ? t.accent : 'transparent' }]}>{credit ? <Text style={[s.boxT, { color: t.onGrad }]}>✓</Text> : null}</View>
        <Text style={[s.tickT, { color: t.fg }]}>Credit me with my in-game name</Text>
      </Pressable>
      <Text style={[s.note, { color: t.mute }]}>Keep it clean: adult (18+) content can get your account blocked. By sharing, you agree MedNova may post your story on our pages, without your name unless you tick Credit me.</Text>
      {msg ? <Text style={[s.note, { color: t.red }]}>{msg}</Text> : null}
      <Send t={t} label="Send · +5 tokens" busy={busy || sent.includes(p)} onPress={() => send('submit_story', { prompt: p, body, credit })} />
    </>
  );
}

function FeedbackForm({ t, onDone }: { t: Theme; onDone: () => void }) {
  const paid = (useFree((x) => x.status?.done) ?? []).includes('free:feedback');
  const [body, setBody] = useState('');
  const { busy, msg, send } = useSend(onDone);
  return (
    <>
      <Title t={t} a="Tell us what you " b="think" />
      <Text style={[s.note, { color: t.mute }]}>What you love, what bugs you, what you wish MedNova had. We read every word.</Text>
      <TextInput multiline value={body} onChangeText={setBody} maxLength={2000} placeholder="Your feedback..." placeholderTextColor={t.mute} style={[s.area, { color: t.fg, borderColor: t.panelLine, backgroundColor: t.panel2 }]} />
      {msg ? <Text style={[s.note, { color: t.red }]}>{msg}</Text> : null}
      <Send t={t} label={paid ? 'Send' : 'Send · +10 tokens'} busy={busy} onPress={() => send('submit_feedback', { body })} />
    </>
  );
}

function AmbassadorForm({ t, onDone }: { t: Theme; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const { busy, msg, send } = useSend(onDone);
  const input = [s.input, { color: t.fg, borderColor: t.panelLine, backgroundColor: t.panel2 }];
  return (
    <>
      <Title t={t} a="Become an " b="ambassador" />
      <Text style={[s.note, { color: t.mute }]}>Post a video of you playing MedNova on your account (100+ followers) and mention us. Send the link here; once we check it, 50 tokens land in your wallet within a week.</Text>
      <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" placeholder="Link to your video" placeholderTextColor={t.mute} style={input} />
      <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Your email" placeholderTextColor={t.mute} style={input} />
      <TextInput value={name} onChangeText={setName} placeholder="Your in-game name" placeholderTextColor={t.mute} style={input} />
      {msg ? <Text style={[s.note, { color: t.red }]}>{msg}</Text> : null}
      <Send t={t} label="Send for review" busy={busy} onPress={() => send('submit_ambassador', { email, game_name: name, video_url: url })} />
    </>
  );
}

const tint = (t: Theme) => 'rgba(111,214,255,0.1)';
const Title = ({ t, a, b }: { t: Theme; a: string; b: string }) => (
  <Text style={[s.shH, { color: t.fg }]}>
    {a}
    <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>{b}</Text>
  </Text>
);
const Send = ({ t, label, busy, onPress }: { t: Theme; label: string; busy: boolean; onPress: () => void }) => (
  <Pressable disabled={busy} onPress={onPress} accessibilityRole="button" style={busy && { opacity: 0.6 }}>
    <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.send}>
      <Text style={[s.cBtnT, { color: t.onGrad, fontSize: u(12) }]}>{label}</Text>
    </LinearGradient>
  </Pressable>
);

const s = StyleSheet.create({
  rowScroll: { marginHorizontal: -u(18) },
  row: { paddingHorizontal: u(18), gap: GAP, paddingTop: u(6), paddingBottom: u(4), alignItems: 'stretch' },
  card: { width: CARD, borderWidth: 1, borderRadius: u(18), padding: u(12), alignItems: 'center' },
  ic: { width: u(30), height: u(30), borderRadius: u(10), alignItems: 'center', justifyContent: 'center', marginBottom: u(4) },
  cN: { fontFamily: F.display, fontSize: u(22), lineHeight: u(26) },
  cU: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(12), height: u(24), textAlign: 'center' },
  cBtn: { alignSelf: 'stretch', height: u(28), borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: u(8) },
  ghost: { borderWidth: 1 },
  cBtnT: { fontFamily: F.bodyBold, fontSize: u(11) },
  gold: { width: CARD, borderRadius: u(18), padding: u(2) },
  goldIn: { width: CARD - u(4), flex: 1, borderWidth: 0, borderRadius: u(16) },
  gKick: { fontFamily: F.mono, fontSize: u(6.5), letterSpacing: u(1.2), height: u(30), lineHeight: u(30), marginBottom: u(4) },
  bar: { alignSelf: 'stretch', height: u(6), borderRadius: 999, overflow: 'hidden', marginTop: u(10) },
  gNum: { fontFamily: F.mono, fontSize: u(7.5), marginTop: u(5) },
  shH: { fontFamily: F.display, fontSize: u(22), lineHeight: u(26) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6) },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: u(10), paddingVertical: u(5) },
  chipT: { fontFamily: F.bodyMedium, fontSize: u(9.5) },
  area: { height: u(96), borderWidth: 1, borderRadius: u(14), padding: u(10), fontFamily: F.body, fontSize: u(11), textAlignVertical: 'top' },
  input: { height: u(34), borderWidth: 1, borderRadius: u(12), paddingHorizontal: u(12), fontFamily: F.body, fontSize: u(11) },
  tick: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  box: { width: u(16), height: u(16), borderRadius: u(5), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  boxT: { fontSize: u(10), fontFamily: F.bodyBold },
  tickT: { fontFamily: F.bodyMedium, fontSize: u(10.5) },
  note: { fontFamily: F.body, fontSize: u(9), lineHeight: u(13) },
  send: { height: u(34), borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
