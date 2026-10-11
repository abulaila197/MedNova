import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { FriendsSection, Name, Ring } from '@/features/profile/Friends';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { useAccount } from '@/state/account';
import { type Friend, seenLabel, useFriends } from '@/state/friends';
import { u } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

// Preview only: what a search for "sa" would return.
const FOUND: (Friend & { state: 'add' | 'sent' | 'friend' })[] = [
  { id: 's1', username: 'sara.k', display_name: 'Sara K', avatar: 'iris', level: 7, last_seen: null, kind: 'friend', state: 'add' },
  { id: 's2', username: 'samir_md', display_name: 'Samir', avatar: 'atlas', level: 12, last_seen: null, kind: 'friend', state: 'sent' },
  { id: 's3', username: 'salma', display_name: 'Salma', avatar: 'layla', level: 4, last_seen: null, kind: 'friend', state: 'add' },
];

/** Friends (preview): your invite code, redeem a code, search players, requests and your friends. */
export function FriendsPage() {
  const c = useInfo();
  const t = c.t;
  const q = useLocalSearchParams<{ look?: string; tab?: string }>();
  const look = q.look === 'b' ? 'b' : 'a';
  return (
    <Screen tab={null} glow={9}>
      <InfoScroll>
        <Kicker>Friends</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {'Your '}
          <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>people</Text>
        </Text>
        {look === 'a' ? <PassFirst t={t} /> : <Tabs t={t} start={q.tab === 'find' ? 2 : q.tab === 'req' ? 1 : 0} />}
      </InfoScroll>
    </Screen>
  );
}

/** Look A, "Pass first": the invite ticket on top, then search, then requests and friends as one list. */
function PassFirst({ t }: { t: Theme }) {
  return (
    <>
      <Ticket t={t} />
      <Redeem t={t} />
      <Search t={t} />
      <FriendsSection t={t} />
    </>
  );
}

/** Look B, "Tabs": Friends / Requests / Find, with the invite code as a slim strip under them. */
function Tabs({ t, start }: { t: Theme; start: number }) {
  const [tab, setTab] = useState(start);
  const { list } = useFriends();
  const req = list.filter((f) => f.kind === 'incoming');
  const fr = list.filter((f) => f.kind !== 'incoming');
  const names = [`Friends · ${fr.length}`, `Requests · ${req.length}`, 'Find'];
  return (
    <>
      <View style={[s.tabs, { backgroundColor: t.mode === 'light' ? 'rgba(29,34,48,0.05)' : 'rgba(255,255,255,0.05)' }]}>
        {names.map((n, i) => (
          <Pressable key={n} onPress={() => setTab(i)} style={[s.tab, i === tab && { backgroundColor: t.panel, borderColor: t.panelLine, borderWidth: 1 }]} accessibilityRole="tab">
            <Text style={[s.tabT, { color: i === tab ? t.fg : t.mute }]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <Strip t={t} />
      {tab === 2 ? (
        <>
          <Search t={t} />
          <Results t={t} />
          <Redeem t={t} />
        </>
      ) : (
        (tab === 0 ? fr : req).map((f) => (
          <View key={f.id} style={[s.fr, { borderColor: t.panelLine }]}>
            <Ring t={t} f={f} />
            <View style={{ flex: 1 }}>
              <Name t={t} f={f} />
              <Text style={[s.frS, { color: seenLabel(f.last_seen) === 'ONLINE' ? (t.mode === 'light' ? '#5e9e6a' : '#7be0a8') : t.mute }]}>{f.kind === 'incoming' ? 'WANTS TO BE FRIENDS' : f.kind === 'outgoing' ? 'REQUEST SENT' : seenLabel(f.last_seen)}</Text>
            </View>
            {f.kind === 'friend' ? <Ghost t={t} label="Challenge" /> : f.kind === 'incoming' ? <Grad t={t} label="Accept" /> : null}
          </View>
        ))
      )}
    </>
  );
}

function Ticket({ t }: { t: Theme }) {
  const code = useAccount((a) => a.profile?.friend_code) ?? 'MN7K4Q';
  return (
    <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tk}>
      <View style={[s.tkIn, { backgroundColor: t.panel }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.mono, { color: t.kick }]}>YOUR INVITE CODE</Text>
          <Text style={[s.code, { color: t.fg }]}>{code}</Text>
          <Text style={[s.tkS, { color: t.mute }]}>A new player enters it, you both get 10 tokens.</Text>
          <Text style={[s.tkS, { color: t.mute }]}>30 of 200 earned from invites</Text>
        </View>
        <View style={[s.notch, { borderColor: t.panelLine }]} />
        <View style={s.tkBtns}>
          <Grad t={t} label="Share" />
          <Ghost t={t} label="Copy" />
        </View>
      </View>
    </LinearGradient>
  );
}

function Strip({ t }: { t: Theme }) {
  const code = useAccount((a) => a.profile?.friend_code) ?? 'MN7K4Q';
  return (
    <View style={[s.strip, { borderColor: t.panelLine, backgroundColor: t.panel }]}>
      <Text style={[s.mono, { color: t.kick }]}>INVITE CODE</Text>
      <Text style={[s.stripC, { color: t.fg }]}>{code}</Text>
      <Text style={[s.stripS, { color: t.mute }]}>+10 each</Text>
      <View style={{ flex: 1 }} />
      <Grad t={t} label="Share" />
    </View>
  );
}

function Redeem({ t }: { t: Theme }) {
  return (
    <View style={{ marginTop: u(12) }}>
      <Text style={[s.mono, { color: t.mute }]}>GOT A CODE FROM A FRIEND?</Text>
      <View style={s.rd}>
        <TextInput placeholder="Enter code" placeholderTextColor={t.mute} autoCapitalize="characters" style={[s.input, { flex: 1, minWidth: 0, width: 0, color: t.fg, borderColor: t.panelLine, backgroundColor: t.panel2 }]} />
        <Ghost t={t} label="Redeem" />
      </View>
    </View>
  );
}

function Search({ t }: { t: Theme }) {
  return (
    <View style={[s.input, s.search, { borderColor: t.panelLine, backgroundColor: t.panel2 }]}>
      <Text style={{ color: t.mute, fontSize: u(12) }}>⌕</Text>
      <TextInput placeholder="Find a player by name or @username" placeholderTextColor={t.mute} defaultValue="" style={[s.searchT, { color: t.fg }]} />
    </View>
  );
}

function Results({ t }: { t: Theme }) {
  return (
    <>
      <Text style={[s.sub, { color: t.mute }]}>3 PLAYERS FOR “SA”</Text>
      {FOUND.map((f) => (
        <View key={f.id} style={[s.fr, { borderColor: t.panelLine }]}>
          <Ring t={t} f={f} />
          <View style={{ flex: 1 }}>
            <Name t={t} f={f} />
            <Text style={[s.frS, { color: t.mute }]}>{`@${f.username.toUpperCase()}`}</Text>
          </View>
          {f.state === 'sent' ? <Text style={[s.frS, { color: t.mute }]}>REQUEST SENT</Text> : <Grad t={t} label="+ Add" />}
        </View>
      ))}
    </>
  );
}

const Grad = ({ t, label }: { t: Theme; label: string }) => (
  <Pressable accessibilityRole="button">
    <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.btn}>
      <Text style={[s.btnT, { color: t.onGrad }]}>{label}</Text>
    </LinearGradient>
  </Pressable>
);
const Ghost = ({ t, label }: { t: Theme; label: string }) => (
  <Pressable accessibilityRole="button" style={[s.btn, { borderWidth: 1, borderColor: t.panelLine }]}>
    <Text style={[s.btnT, { color: t.fg, fontFamily: F.bodySemi }]}>{label}</Text>
  </Pressable>
);

const s = StyleSheet.create({
  mono: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3) },
  tk: { marginTop: u(14), borderRadius: u(18), padding: u(1.5) },
  tkIn: { borderRadius: u(16.5), padding: u(14), flexDirection: 'row', alignItems: 'center', gap: u(10) },
  code: { fontFamily: F.mono, fontSize: u(22), letterSpacing: u(3), marginVertical: u(4) },
  tkS: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(13) },
  notch: { width: 0, alignSelf: 'stretch', borderLeftWidth: 1, borderStyle: 'dashed' },
  tkBtns: { gap: u(6), alignItems: 'stretch' },
  rd: { flexDirection: 'row', gap: u(8), marginTop: u(6), alignItems: 'center' },
  input: { height: u(34), borderWidth: 1, borderRadius: u(12), paddingHorizontal: u(12), fontFamily: F.body, fontSize: u(11) },
  search: { marginTop: u(12), flexDirection: 'row', alignItems: 'center', gap: u(8) },
  searchT: { flex: 1, fontFamily: F.body, fontSize: u(11), height: '100%' },
  tabs: { flexDirection: 'row', borderRadius: u(14), padding: u(3), marginTop: u(14) },
  tab: { flex: 1, height: u(30), borderRadius: u(11), alignItems: 'center', justifyContent: 'center', borderColor: 'transparent' },
  tabT: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  strip: { marginTop: u(10), flexDirection: 'row', alignItems: 'center', gap: u(8), borderWidth: 1, borderRadius: u(14), paddingHorizontal: u(12), paddingVertical: u(8) },
  stripC: { fontFamily: F.mono, fontSize: u(13), letterSpacing: u(2) },
  stripS: { fontFamily: F.body, fontSize: u(9) },
  sub: { marginTop: u(12), fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.2) },
  fr: { flexDirection: 'row', alignItems: 'center', gap: u(10), paddingVertical: u(9), borderBottomWidth: 1 },
  frS: { marginTop: u(3), fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.05) },
  btn: { height: u(26), paddingHorizontal: u(12), borderRadius: u(10), alignItems: 'center', justifyContent: 'center' },
  btnT: { fontFamily: F.bodyBold, fontSize: u(10) },
});

