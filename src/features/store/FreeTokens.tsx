import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { create } from 'zustand';

import { Text } from '@/components/AppText';
import { Sheet } from '@/components/Sheet';
import { Kicker } from '@/features/info/ui';
import { u } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

type Icon = (p: { size: number; color: string }) => ReactNode;
type Way = { key: string; label: string; tokens: number; each?: boolean; act: string; icon: Icon; group: 'follow' | 'look' | 'tell' };

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
  globe: ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5S9.5 6.1 12 3.5z" />
    </Svg>
  ),
};

// Amounts decided 2026-10-11 (each once per account).
const WAYS: Way[] = [
  { key: 'tiktok', label: 'Follow us on TikTok', tokens: 3, act: 'Follow', icon: I.tiktok, group: 'follow' },
  { key: 'instagram', label: 'Follow us on Instagram', tokens: 3, act: 'Follow', icon: I.instagram, group: 'follow' },
  { key: 'facebook', label: 'Follow us on Facebook', tokens: 3, act: 'Follow', icon: I.facebook, group: 'follow' },
  { key: 'youtube', label: 'Subscribe on YouTube', tokens: 3, act: 'Subscribe', icon: I.youtube, group: 'follow' },
  { key: 'channel', label: 'Join our Instagram channel', tokens: 3, act: 'Join', icon: I.channel, group: 'follow' },
  { key: 'community', label: 'Visit the Community page', tokens: 2, act: 'Visit', icon: I.community, group: 'look' },
  { key: 'listing', label: 'Visit us on the App Store', tokens: 3, act: 'Visit', icon: I.listing, group: 'look' },
  { key: 'feedback', label: 'Send us your feedback', tokens: 10, act: 'Write', icon: I.feedback, group: 'tell' },
  { key: 'story', label: 'Share your story · 2 of 5', tokens: 5, each: true, act: 'Write', icon: I.story, group: 'tell' },
  { key: 'ambassador', label: 'Ambassador video', tokens: 50, act: 'Apply', icon: I.video, group: 'tell' },
  { key: 'invite', label: 'Invite a friend with your code', tokens: 10, each: true, act: 'My code', icon: I.invite, group: 'tell' },
];

/** Whether the story sheet is open (drawn by the Store page above its scroll, so it covers the page). */
export const useStory = create<{ open: boolean }>(() => ({ open: false }));

const CARD = u(124);
const GAP = u(10);
const GOLD = ['#f7dd8b', '#d39a2c', '#f3cf6c'] as const;

/** Free tokens (preview): boxes shaped like the token packs; the global mission first, same size with a gold frame. */
export function FreeTokens({ t, look }: { t: Theme; look: 'a' | 'b' }) {
  const [done] = useState<string[]>(['instagram', 'community']); // preview: two already collected
  const tap = (w: Way) => (w.key === 'story' ? useStory.setState({ open: true }) : w.key === 'invite' ? router.navigate('/friends' as never) : undefined);
  const box = (w: Way) => <WayCard key={w.key} t={t} w={w} done={done.includes(w.key)} onPress={() => tap(w)} />;
  return (
    <>
      <View style={{ height: u(14) }} />
      <Kicker inSec>Free tokens</Kicker>
      {look === 'a' ? (
        <Row>
          <Global t={t} />
          {WAYS.map(box)}
        </Row>
      ) : (
        <>
          <Row>
            <Global t={t} />
            <View style={s.gNote}>
              <Text style={[s.gNoteH, { color: t.fg }]}>One goal for everyone</Text>
              <Text style={[s.gNoteT, { color: t.mute }]}>When MedNova reaches 100,000 downloads on both stores, every player gets 200 tokens. Share it to get there faster.</Text>
            </View>
          </Row>
          <Kicker inSec>Follow us</Kicker>
          <Row>{WAYS.filter((w) => w.group === 'follow').map(box)}</Row>
          <Kicker inSec>Look around</Kicker>
          <Row>{WAYS.filter((w) => w.group === 'look').map(box)}</Row>
          <Kicker inSec>Tell us, show us</Kicker>
          <Row>{WAYS.filter((w) => w.group === 'tell').map(box)}</Row>
        </>
      )}
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

function WayCard({ t, w, done, onPress }: { t: Theme; w: Way; done: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={done ? undefined : onPress} accessibilityRole="button" accessibilityLabel={`${w.label}, ${w.tokens} tokens`} style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
      <View style={[s.ic, { backgroundColor: t.mode === 'light' ? 'rgba(229,131,58,0.1)' : 'rgba(111,214,255,0.1)' }]}>{w.icon({ size: u(17), color: t.accent })}</View>
      <Text style={[s.cN, { color: t.fg }]}>{`+${w.tokens}`}</Text>
      <Text style={[s.cU, { color: t.mute }]} numberOfLines={2}>
        {w.each ? `${w.label} · each` : w.label}
      </Text>
      {done ? (
        <View style={[s.cBtn, s.ghost, { borderColor: t.panelLine }]}>
          <Text style={[s.cBtnT, { color: t.mute }]}>Collected ✓</Text>
        </View>
      ) : (
        <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.cBtn}>
          <Text style={[s.cBtnT, { color: t.onGrad }]}>{w.act}</Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}

/** The global mission: the same box, in a gold frame, with the live download bar. */
function Global({ t }: { t: Theme }) {
  const now = 23400;
  const lt = t.mode === 'light';
  return (
    <LinearGradient colors={GOLD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.gold}>
      <View style={[s.card, s.goldIn, { backgroundColor: lt ? '#fffaf0' : '#1a1830' }]}>
        <Text style={[s.gKick, { color: lt ? '#b07a12' : '#f3cf6c' }]}>GLOBAL MISSION</Text>
        <Text style={[s.cN, { color: t.fg }]}>+200</Text>
        <Text style={[s.cU, { color: t.mute }]} numberOfLines={2}>
          for everyone at 100k downloads
        </Text>
        <View style={[s.bar, { backgroundColor: lt ? 'rgba(176,122,18,0.15)' : 'rgba(243,207,108,0.15)' }]}>
          <LinearGradient colors={GOLD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${(now / 100000) * 100}%`, height: '100%', borderRadius: 999 }} />
        </View>
        <Text style={[s.gNum, { color: lt ? '#8a5f0c' : '#f3cf6c' }]}>23,400 / 100,000</Text>
      </View>
    </LinearGradient>
  );
}

const PROMPTS = ['Why you chose medicine', 'A burnout story', 'Your hardest phase in college', 'The moment that kept you going', 'Your funniest moment'];

/** Share your story: five prompts, each paid once on send (5 tokens), saved to Supabase and shown on Admin. */
export function StorySheet({ t }: { t: Theme }) {
  const open = useStory((x) => x.open);
  const onClose = () => useStory.setState({ open: false });
  const [p, setP] = useState(2);
  const [credit, setCredit] = useState(false);
  const sent = [0, 4];
  if (!open) return null;
  return (
    <Modal transparent visible onRequestClose={onClose}>
    <Sheet open={open} onClose={onClose}>
      <Text style={[s.shH, { color: t.fg }]}>
        {'Share your '}
        <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>story</Text>
      </Text>
      <View style={s.chips}>
        {PROMPTS.map((x, i) => (
          <Pressable key={x} disabled={sent.includes(i)} onPress={() => setP(i)} style={[s.chip, { borderColor: i === p ? t.accent : t.panelLine, backgroundColor: i === p ? (t.mode === 'light' ? 'rgba(229,131,58,0.1)' : 'rgba(111,214,255,0.1)') : 'transparent', opacity: sent.includes(i) ? 0.5 : 1 }]}>
            <Text style={[s.chipT, { color: i === p ? t.fg : t.mute }]}>{sent.includes(i) ? `${x} ✓` : x}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput multiline placeholder="Tell it your way..." placeholderTextColor={t.mute} style={[s.area, { color: t.fg, borderColor: t.panelLine, backgroundColor: t.panel2 }]} />
      <Pressable onPress={() => setCredit((v) => !v)} style={s.tick} accessibilityRole="checkbox" accessibilityState={{ checked: credit }}>
        <View style={[s.box, { borderColor: credit ? t.accent : t.mute, backgroundColor: credit ? t.accent : 'transparent' }]}>{credit ? <Text style={[s.boxT, { color: t.onGrad }]}>✓</Text> : null}</View>
        <Text style={[s.tickT, { color: t.fg }]}>Credit me with my in-game name</Text>
      </Pressable>
      <Text style={[s.note, { color: t.mute }]}>Keep it clean: adult (18+) content can get your account blocked. By sharing, you agree MedNova may post your story on our pages, without your name unless you tick Credit me.</Text>
      <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.send}>
        <Text style={[s.cBtnT, { color: t.onGrad, fontSize: u(12) }]}>Send · +5 tokens</Text>
      </LinearGradient>
    </Sheet>
    </Modal>
  );
}

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
  gNote: { width: u(112), justifyContent: 'center', gap: u(4) },
  gNoteH: { fontFamily: F.display, fontSize: u(15), lineHeight: u(18) },
  gNoteT: { fontFamily: F.body, fontSize: u(10), lineHeight: u(14) },
  shH: { fontFamily: F.display, fontSize: u(22), lineHeight: u(26) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6) },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: u(10), paddingVertical: u(5) },
  chipT: { fontFamily: F.bodyMedium, fontSize: u(9.5) },
  area: { height: u(96), borderWidth: 1, borderRadius: u(14), padding: u(10), fontFamily: F.body, fontSize: u(11), textAlignVertical: 'top' },
  tick: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  box: { width: u(16), height: u(16), borderRadius: u(5), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  boxT: { fontSize: u(10), fontFamily: F.bodyBold },
  tickT: { fontFamily: F.bodyMedium, fontSize: u(10.5) },
  note: { fontFamily: F.body, fontSize: u(9), lineHeight: u(13) },
  send: { height: u(34), borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
