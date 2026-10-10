import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/AppText';

import { useBalance } from '@/components/LevelBadge';
import { Sheet } from '@/components/Sheet';
import { Face } from '@/games/shell/Face';
import { useAccount } from '@/state/account';
import { useTheme } from '@/state/app';
import { blockUser, removeFriend, type RequestResult, requestFriend, seenLabel } from '@/state/friends';
import { u } from '@/theme/scale';
import { F, type Theme } from '@/theme/tokens';

import { Name, useFriendSheet } from './Friends';

const close = () => useFriendSheet.setState({ open: null, friend: null, code: '' });
const ALLOWED = /[^A-HJ-NP-Z2-9]/g; // friend codes skip 0, O, 1 and I

const SAY: Record<RequestResult | 'error', string> = {
  sent: 'Request sent. You’re friends once they accept.',
  accepted: 'They had asked you too, so you’re friends now.',
  already: 'You’re already friends.',
  pending: 'You already sent them a request.',
  self: 'That’s your own code.',
  not_found: 'No player has that code.',
  unavailable: 'You can’t send a request to that player.',
  error: 'Couldn’t reach the server. Check your connection.',
};

/** The Add friend sheet and the remove/block sheet (FR1-FR3). Lives in the app layout so it covers the dock. */
export function FriendSheets() {
  const open = useFriendSheet((x) => x.open);
  return (
    <Sheet open={!!open} onClose={close}>
      {open === 'add' ? <AddFriend /> : open === 'menu' ? <FriendMenu /> : null}
    </Sheet>
  );
}

/** "Friend pass" look (Yazan's pick): your code on an ID pass with Copy and Share link, then 6 boxes and Send request. */
function AddFriend() {
  const t = useTheme();
  const lt = t.mode === 'light';
  const profile = useAccount((a) => a.profile);
  const { level } = useBalance();
  const start = useFriendSheet((x) => x.code);
  const [code, setCode] = useState(start.toUpperCase().replace(ALLOWED, '').slice(0, 6));
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<RequestResult | 'error' | null>(null);
  const input = useRef<TextInput>(null);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);
  if (!profile) return null;
  const mine = profile.friend_code;
  const link = `mednova://add/${mine}`;
  const ink = lt ? '#2a2216' : '#151a3d';
  const send = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await requestFriend(code);
      setMsg(r);
      if (r === 'sent' || r === 'accepted') setCode('');
    } catch {
      setMsg('error');
    }
    setBusy(false);
  };
  const good = msg === 'sent' || msg === 'accepted';
  return (
    <>
      <Text style={[s.k, { color: t.mute }]}>YOUR FRIEND CODE</Text>
      <LinearGradient colors={lt ? ['#fffaf0', '#eadfc8'] : ['#eef1ff', '#cfd6f3']} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={s.pass}>
        <View style={[s.slot, { backgroundColor: lt ? '#c9b994' : '#9aa3c9' }]} />
        <View style={s.idr}>
          <View style={s.face}>
            <Face slug={profile.avatar} size={u(40)} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.idN, { color: ink }]} numberOfLines={1}>{`Dr. ${profile.display_name}`}</Text>
            <Text style={[s.idS, { color: lt ? '#6b5d44' : '#4b527a' }]}>{`@${profile.username.toUpperCase()} · LEVEL ${level}`}</Text>
          </View>
        </View>
        <Text style={[s.code, { color: ink }]} accessibilityLabel={`Your friend code ${mine.split('').join(' ')}`}>{`${mine.slice(0, 3)} · ${mine.slice(3)}`}</Text>
        <View style={[s.strip, { backgroundColor: ink }]}>
          <Text style={[s.stripT, { color: t.accent }]}>MEDNOVA · FRIEND PASS</Text>
        </View>
      </LinearGradient>
      <View style={s.row}>
        <Pressable
          style={[s.gh, { borderColor: t.panelLine }]}
          onPress={() => Clipboard.setStringAsync(mine).then(() => setCopied(true))}
          accessibilityRole="button">
          <Text style={[s.ghT, { color: t.fg }]}>{copied ? 'Copied' : 'Copy'}</Text>
        </Pressable>
        <Pressable
          style={[s.gh, { borderColor: t.panelLine }]}
          onPress={() => Share.share({ message: `Add me on MedNova: ${link}\nOr type my friend code: ${mine}` }).catch(() => {})}
          accessibilityRole="button">
          <Text style={[s.ghT, { color: t.fg }]}>Share link</Text>
        </Pressable>
      </View>
      <Text style={[s.k, { color: t.mute, marginTop: u(4) }]}>ADD A FRIEND</Text>
      <Pressable onPress={() => input.current?.focus()} style={s.boxes} accessibilityLabel="Friend code">
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={[s.box, { backgroundColor: t.panel2, borderColor: code[i] ? (lt ? 'rgba(229,131,58,0.55)' : 'rgba(111,214,255,0.5)') : t.panelLine }]}>
            <Text style={[s.boxT, { color: t.fg }]}>{code[i] ?? ''}</Text>
          </View>
        ))}
        <TextInput
          ref={input}
          value={code}
          onChangeText={(v) => {
            setCode(v.toUpperCase().replace(ALLOWED, '').slice(0, 6));
            setMsg(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          style={s.hidden}
          accessibilityLabel="Type a friend code"
        />
      </Pressable>
      {msg ? <Text style={[s.msg, { color: good ? t.accent : t.mute }]}>{SAY[msg]}</Text> : null}
      <Pressable disabled={code.length < 6 || busy} onPress={send} accessibilityRole="button" style={{ opacity: code.length < 6 ? 0.5 : 1 }}>
        <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.btn}>
          <Text style={[s.btnT, { color: t.onGrad }]}>{busy ? 'Sending…' : 'Send request'}</Text>
        </LinearGradient>
      </Pressable>
    </>
  );
}

/** Tap a friend's name: Remove friend or Block (FR3). For your own pending request: Cancel request. */
function FriendMenu() {
  const t = useTheme();
  const f = useFriendSheet((x) => x.friend);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  if (!f) return null;
  const when = f.kind === 'outgoing' ? 'REQUEST SENT' : seenLabel(f.last_seen);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(false);
    try {
      await fn();
      close();
    } catch {
      setErr(true);
      setBusy(false);
    }
  };
  return (
    <>
      <View style={s.mh}>
        <Face slug={f.avatar} size={u(34)} />
        <View>
          <Name t={t} f={f} size={19} />
          <Text style={[s.mhS, { color: when === 'ONLINE' ? (t.mode === 'light' ? '#5e9e6a' : '#7be0a8') : t.mute }]}>{when}</Text>
        </View>
      </View>
      {f.kind === 'outgoing' ? (
        <Act t={t} title="Cancel request" note="They won’t see it any more. You can send a new one later." onPress={() => run(() => removeFriend(f.id))} disabled={busy} />
      ) : (
        <Act t={t} title="Remove friend" note={`Takes ${f.display_name} off both lists. They can send a new request later.`} onPress={() => run(() => removeFriend(f.id))} disabled={busy} />
      )}
      <Act t={t} red title={`Block ${f.display_name}`} note="Also stops their requests and challenges. Undo any time under Blocked players on your Profile." onPress={() => run(() => blockUser(f.id))} disabled={busy} />
      {err ? <Text style={[s.msg, { color: t.red }]}>Couldn’t reach the server. Check your connection.</Text> : null}
      <Pressable onPress={close} accessibilityRole="button">
        <Text style={[s.cancel, { color: t.mute }]}>Cancel</Text>
      </Pressable>
    </>
  );
}

function Act({ t, title, note, red, onPress, disabled }: { t: Theme; title: string; note: string; red?: boolean; onPress: () => void; disabled?: boolean }) {
  const c = red ? (t.mode === 'light' ? '#c4505d' : '#ff7a88') : t.fg;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[s.act, { borderColor: red ? (t.mode === 'light' ? 'rgba(212,80,76,0.45)' : 'rgba(199,54,70,0.5)') : t.panelLine }]} accessibilityRole="button">
      <Text style={[s.actT, { color: c }]}>{title}</Text>
      <Text style={[s.actS, { color: t.mute }]}>{note}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  k: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.4), marginTop: u(4) },
  pass: { borderRadius: u(16), paddingTop: u(16), paddingHorizontal: u(14), overflow: 'hidden' },
  slot: { position: 'absolute', top: u(6), left: '50%', width: u(34), height: u(5), marginLeft: u(-17), borderRadius: u(3) },
  idr: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  face: { borderRadius: u(22), borderWidth: u(2), borderColor: '#fff' },
  idN: { fontFamily: F.display, fontSize: u(19), lineHeight: u(22) },
  idS: { fontFamily: F.mono, fontSize: u(7), letterSpacing: u(1) },
  code: { fontFamily: F.mono, fontSize: u(24), letterSpacing: u(3), textAlign: 'center', marginTop: u(10), marginBottom: u(8) },
  strip: { marginHorizontal: u(-14), paddingVertical: u(5) },
  stripT: { fontFamily: F.mono, fontSize: u(7), letterSpacing: u(2), textAlign: 'center' },
  row: { flexDirection: 'row', gap: u(8) },
  gh: { flex: 1, height: u(28), borderRadius: u(10), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ghT: { fontFamily: F.bodySemi, fontSize: u(10) },
  boxes: { flexDirection: 'row', gap: u(6) },
  box: { flex: 1, height: u(34), borderRadius: u(9), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  boxT: { fontFamily: F.mono, fontSize: u(16) },
  hidden: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.01, color: 'transparent' },
  msg: { fontFamily: F.body, fontSize: u(9.5), textAlign: 'center' },
  btn: { height: u(34), borderRadius: u(12), alignItems: 'center', justifyContent: 'center' },
  btnT: { fontFamily: F.bodyBold, fontSize: u(11) },
  mh: { flexDirection: 'row', alignItems: 'center', gap: u(10), paddingBottom: u(4) },
  mhS: { marginTop: u(3), fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.05) },
  act: { borderWidth: 1, borderRadius: u(14), paddingVertical: u(10), paddingHorizontal: u(12) },
  actT: { fontFamily: F.bodySemi, fontSize: u(12) },
  actS: { marginTop: u(2), fontFamily: F.body, fontSize: u(9.5), lineHeight: u(13) },
  cancel: { textAlign: 'center', fontFamily: F.bodySemi, fontSize: u(11), paddingTop: u(2) },
});
