import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Congrats } from '@/components/Congrats';
import { Screen } from '@/components/Screen';
import { loadFree, useFree } from '@/features/store/FreeTokens';
import { FriendsSection, Name, Ring } from '@/features/profile/Friends';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { useSession } from '@/games/shell/session';
import { syncAccount } from '@/lib/sync';
import { call } from '@/online/api';
import { useAccount } from '@/state/account';
import { type Friend, loadFriends, useFriends } from '@/state/friends';
import { u } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

type Found = Omit<Friend, 'kind' | 'last_seen'> & { kind: Friend['kind'] | 'none' };

/** Friends (locked look B, "Tabs"): Friends / Requests / Find, with the invite code and Redeem under the tabs on every tab. */
export function FriendsPage() {
  const c = useInfo();
  const t = c.t;
  const profile = useAccount((a) => a.profile);
  const { list } = useFriends();
  const [tab, setTab] = useState(0);
  useEffect(() => {
    if (!profile) return;
    loadFriends().catch(() => {});
    loadFree().catch(() => {});
  }, [profile]);
  const req = list.filter((f) => f.kind === 'incoming').length;
  const fr = list.filter((f) => f.kind === 'friend').length;
  const names = [`Friends · ${fr}`, `Requests · ${req}`, 'Find'];
  return (
    <Screen tab={null} glow={9}>
      <InfoScroll>
        <Kicker>Friends</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {'Your '}
          <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>people</Text>
        </Text>
        {!profile ? (
          <Pressable onPress={() => router.navigate('/auth')} style={[s.guest, { borderColor: t.panelLine, backgroundColor: t.panel }]} accessibilityRole="button">
            <Text style={[s.guestT, { color: t.fg }]}>Sign in to add friends, challenge them and get your invite code.</Text>
            <Text style={[s.guestA, { color: t.accent }]}>Sign in</Text>
          </Pressable>
        ) : (
          <>
            <View style={[s.tabs, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
              {names.map((n, i) => (
                <Pressable key={n} onPress={() => setTab(i)} style={[s.tab, i === tab && { backgroundColor: t.panel, borderColor: t.panelLine, borderWidth: 1 }]} accessibilityRole="tab" accessibilityState={{ selected: i === tab }}>
                  <Text style={[s.tabT, { color: i === tab ? t.fg : t.mute }]}>{n}</Text>
                </Pressable>
              ))}
            </View>
            <Strip t={t} code={profile.friend_code} />
            <Redeem t={t} />
            {tab === 2 ? <Find t={t} /> : <FriendsSection t={t} only={tab === 0 ? 'friends' : 'requests'} />}
          </>
        )}
      </InfoScroll>
    </Screen>
  );
}

/** Your invite code (= friend code): a new player redeems it and you both get 10 tokens, up to 150 for you. */
function Strip({ t, code }: { t: Theme; code: string }) {
  const earned = useFree((x) => x.status?.invite_tokens ?? 0);
  const share = () => Share.share({ message: `Join me on MedNova, the medical games app. Enter my invite code ${code} on the Friends page and we both get 10 tokens.` }).catch(() => {});
  return (
    <View style={[s.strip, { borderColor: t.panelLine, backgroundColor: t.panel }]}>
      <View>
        <Text style={[s.mono, { color: t.kick }]}>INVITE CODE</Text>
        <Text style={[s.stripC, { color: t.fg }]}>{code}</Text>
      </View>
      <Text style={[s.stripS, { color: t.mute }]}>{`+10 each\n${earned} of 150 earned`}</Text>
      <View style={{ flex: 1 }} />
      <Grad t={t} label="Share" onPress={share} />
    </View>
  );
}

/** Redeem a friend's code: once per account; both players get 10 (a congrats pop-up shows yours). */
function Redeem({ t }: { t: Theme }) {
  const redeemed = useFree((x) => x.status?.redeemed);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [won, setWon] = useState(false);
  if (redeemed && !won) return <Text style={[s.done, { color: t.mute }]}>INVITE CODE REDEEMED ✓</Text>;
  const go = async () => {
    if (busy || code.trim().length < 4) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await call<{ ok: boolean; why?: string }>('redeem_code', { code });
      if (r.ok) {
        const uid = useSession.getState().userId;
        if (uid) await syncAccount(uid).catch(() => {});
        await loadFree().catch(() => {});
        setCode('');
        setWon(true);
      } else setMsg(r.why === 'not_found' ? 'No player has that code.' : r.why === 'self' ? 'That is your own code.' : r.why === 'swap' ? 'You invited this player, so their code can’t pay you back.' : 'You already redeemed a code.');
    } catch {
      setMsg('Not redeemed. Check your connection and try again.');
    }
    setBusy(false);
  };
  return (
    <View style={{ marginTop: u(10) }}>
      <Text style={[s.mono, { color: t.mute }]}>GOT A CODE FROM A FRIEND?</Text>
      <View style={s.rd}>
        <TextInput value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="Enter code" placeholderTextColor={t.mute} autoCapitalize="characters" autoCorrect={false} maxLength={12} style={[s.input, { flex: 1, minWidth: 0, width: 0, color: t.fg, borderColor: t.panelLine, backgroundColor: t.panel2 }]} />
        <Ghost t={t} label={busy ? '...' : 'Redeem'} onPress={go} />
      </View>
      {msg ? <Text style={[s.msg, { color: t.red }]}>{msg}</Text> : null}
      <Congrats open={won} tokens={10} title="Welcome aboard" line="Your friend's code worked. They get 10 tokens too." onClose={() => setWon(false)} />
    </View>
  );
}

/** Find players by name or @username and send a request. */
function Find({ t }: { t: Theme }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Found[] | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  // Under 2 letters there is nothing to look up: clear the list at once.
  const short = q.trim().length < 2;
  if (short && rows !== null) setRows(null);
  useEffect(() => {
    if (short) return;
    let live = true;
    const id = setTimeout(() => {
      call<Found[]>('find_players', { q })
        .then((r) => live && setRows(r ?? []))
        .catch(() => live && setRows([]));
    }, 350);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [q, short]);
  const add = async (id: string) => {
    setSent((x) => [...x, id]);
    try {
      await call('request_friend_id', { other: id });
      await loadFriends();
    } catch {
      setSent((x) => x.filter((y) => y !== id));
    }
  };
  return (
    <>
      <View style={[s.input, s.search, { borderColor: t.panelLine, backgroundColor: t.panel2 }]}>
        <Text style={{ color: t.mute, fontSize: u(12) }}>⌕</Text>
        <TextInput value={q} onChangeText={setQ} autoCapitalize="none" autoCorrect={false} placeholder="Find a player by name or @username" placeholderTextColor={t.mute} style={[s.searchT, { color: t.fg }]} />
      </View>
      {rows ? <Text style={[s.sub, { color: t.mute }]}>{rows.length ? `${rows.length} PLAYER${rows.length === 1 ? '' : 'S'}` : 'NOBODY BY THAT NAME YET'}</Text> : null}
      {rows?.map((f) => {
        const state = sent.includes(f.id) && f.kind === 'none' ? 'outgoing' : f.kind;
        return (
          <View key={f.id} style={[s.fr, { borderColor: t.panelLine }]}>
            <Ring t={t} f={f} />
            <View style={{ flex: 1 }}>
              <Name t={t} f={{ ...f, last_seen: null, kind: 'friend' }} />
              <Text style={[s.frS, { color: t.mute }]}>{`@${f.username.toUpperCase()}`}</Text>
            </View>
            {state === 'none' ? (
              <Grad t={t} label="+ Add" onPress={() => add(f.id)} />
            ) : state === 'incoming' ? (
              <Grad t={t} label="Accept" onPress={() => add(f.id)} />
            ) : (
              <Text style={[s.frS, { color: t.mute }]}>{state === 'friend' ? 'FRIENDS' : 'REQUEST SENT'}</Text>
            )}
          </View>
        );
      })}
    </>
  );
}

const Grad = ({ t, label, onPress }: { t: Theme; label: string; onPress?: () => void }) => (
  <Pressable onPress={onPress} accessibilityRole="button">
    <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.btn}>
      <Text style={[s.btnT, { color: t.onGrad }]}>{label}</Text>
    </LinearGradient>
  </Pressable>
);
const Ghost = ({ t, label, onPress }: { t: Theme; label: string; onPress?: () => void }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={[s.btn, { borderWidth: 1, borderColor: t.panelLine }]}>
    <Text style={[s.btnT, { color: t.fg, fontFamily: F.bodySemi }]}>{label}</Text>
  </Pressable>
);

const s = StyleSheet.create({
  guest: { marginTop: u(14), borderWidth: 1, borderRadius: u(14), padding: u(12), gap: u(4) },
  guestT: { fontFamily: F.bodyMedium, fontSize: u(11), lineHeight: u(15) },
  guestA: { fontFamily: F.bodyBold, fontSize: u(11) },
  mono: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3) },
  rd: { flexDirection: 'row', gap: u(8), marginTop: u(6), alignItems: 'center' },
  msg: { fontFamily: F.bodyMedium, fontSize: u(10), marginTop: u(6) },
  done: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.2), marginTop: u(10) },
  input: { height: u(34), borderWidth: 1, borderRadius: u(12), paddingHorizontal: u(12), fontFamily: F.body, fontSize: u(11) },
  search: { marginTop: u(12), flexDirection: 'row', alignItems: 'center', gap: u(8) },
  searchT: { flex: 1, fontFamily: F.body, fontSize: u(11), height: '100%' },
  tabs: { flexDirection: 'row', borderRadius: u(14), padding: u(3), marginTop: u(14) },
  tab: { flex: 1, height: u(30), borderRadius: u(11), alignItems: 'center', justifyContent: 'center', borderColor: 'transparent' },
  tabT: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  strip: { marginTop: u(10), flexDirection: 'row', alignItems: 'center', gap: u(10), borderWidth: 1, borderRadius: u(14), paddingHorizontal: u(12), paddingVertical: u(8) },
  stripC: { fontFamily: F.mono, fontSize: u(13), letterSpacing: u(2), marginTop: u(2) },
  stripS: { fontFamily: F.body, fontSize: u(8.5), lineHeight: u(12) },
  sub: { marginTop: u(12), fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.2) },
  fr: { flexDirection: 'row', alignItems: 'center', gap: u(10), paddingVertical: u(9), borderBottomWidth: 1 },
  frS: { marginTop: u(3), fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.05) },
  btn: { height: u(26), paddingHorizontal: u(12), borderRadius: u(10), alignItems: 'center', justifyContent: 'center' },
  btnT: { fontFamily: F.bodyBold, fontSize: u(10) },
});
