import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LevelBadge } from '@/components/LevelBadge';
import { GAMES } from '@/data/games';
import { Back } from '@/features/learn/Back';
import { Face } from '@/games/shell/Face';
import type { GameDef } from '@/games/shell/types';
import { Btn, Card, Chips, GameScreen, Title } from '@/games/shell/ui';
import { useAccount } from '@/state/account';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F, type Theme } from '@/theme/tokens';

import { createRoom, JOIN_SAY, joinRoom, joinRoomId, listPublicRooms, type JoinResult, type PublicRoom } from './api';
import { settingsLine } from './format';

type Tab = 'join' | 'create';

/**
 * ON20 + ON27: the online setup page. Two ticket-stub tabs (Yazan's pick): Join (6-digit code + this game's open rooms)
 * and Create (the game's options + Public/Private). It wears the game's own setup look, so app-look games follow dark/light.
 */
export function OnlineSetup({ def, prefill }: { def: GameDef; prefill?: Record<string, unknown> }) {
  const t = useTheme();
  const g = GAMES.find((x) => x.key === def.key)!;
  const [tab, setTab] = useState<Tab>(prefill ? 'create' : 'join');
  return (
    <GameScreen bodyStyle={{ paddingTop: u(10), gap: u(10) }}>
      <Back label={`${g.lead} ${g.em}`} fallback={`/play/${def.key}`} />
      <Title lead="Play" em="online" size={21} />
      <View style={s.stubs}>
        <Stub t={t} on={tab === 'join'} k="JOIN" title="Find a room" note="code or open list" onPress={() => setTab('join')} />
        <Stub t={t} on={tab === 'create'} k="CREATE" title="Host a room" note="your rules" onPress={() => setTab('create')} />
      </View>
      {tab === 'join' ? <Join def={def} /> : <Create def={def} prefill={prefill} />}
    </GameScreen>
  );
}

/** A ticket-shaped tab with a notch on each side; the chosen one lifts and brightens, the other sinks. */
function Stub({ t, on, k, title, note, onPress }: { t: Theme; on: boolean; k: string; title: string; note: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.stub,
        on
          ? { backgroundColor: t.panel, borderColor: t.accent, borderStyle: 'solid', boxShadow: t.mode === 'light' ? '0px 8px 16px rgba(60,50,30,0.16)' : '0px 10px 20px rgba(0,0,0,0.4)' }
          : { backgroundColor: t.chip, borderColor: t.chipLine, borderStyle: 'dashed', opacity: 0.62, transform: [{ translateY: u(3) }] },
      ]}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={title}>
      <View style={[s.notch, s.nl, { backgroundColor: t.sky, borderColor: on ? t.accent : t.chipLine }]} />
      <View style={[s.notch, s.nr, { backgroundColor: t.sky, borderColor: on ? t.accent : t.chipLine }]} />
      <Text style={[s.stubK, { color: on ? t.accent : t.mute }]}>{k}</Text>
      <Text style={[s.stubT, { color: t.white }]}>{title}</Text>
      <Text style={[s.stubN, { color: t.mute }]}>{note}</Text>
    </Pressable>
  );
}

const lobbyOf = (def: GameDef, id: string) => router.replace(`/play/${def.key}/lobby?room=${id}`);

function Join({ def }: { def: GameDef }) {
  const t = useTheme();
  const avatar = useAccount((a) => a.profile?.avatar);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);
  const input = useRef<TextInput>(null);

  const refresh = useCallback(() => {
    listPublicRooms(def.key).then(setRooms).catch(() => setRooms([]));
  }, [def.key]);
  useFocusEffect(
    useCallback(() => {
      refresh();
      const id = setInterval(refresh, 8000);
      return () => clearInterval(id);
    }, [refresh]),
  );

  const done = (r: JoinResult) => {
    if ((r.result === 'joined' || r.result === 'spectating') && r.room_id) lobbyOf(def, r.room_id);
    else setMsg(JOIN_SAY[r.result] ?? JOIN_SAY.error);
  };
  const go = async (fn: () => Promise<JoinResult>) => {
    setBusy(true);
    setMsg(null);
    try {
      done(await fn());
    } catch {
      setMsg(JOIN_SAY.error);
    }
    setBusy(false);
  };
  const type = (v: string) => {
    const c = v.replace(/\D/g, '').slice(0, 6);
    setCode(c);
    setMsg(null);
    if (c.length === 6) go(() => joinRoom(c, avatar));
  };

  return (
    <>
      <Card style={s.card}>
        <Text style={[s.k, { color: t.mute }]}>HAVE A CODE?</Text>
        <Pressable onPress={() => input.current?.focus()} style={s.boxes} accessibilityLabel="Room code">
          {Array.from({ length: 6 }, (_, i) => (
            <View key={i} style={[s.box, i === 3 && { marginLeft: u(6) }, { backgroundColor: t.chip, borderColor: code[i] ? t.accent : t.chipLine }]}>
              <Text style={[s.boxT, { color: t.fg }]}>{code[i] ?? ''}</Text>
            </View>
          ))}
          <TextInput
            ref={input}
            value={code}
            onChangeText={type}
            keyboardType="number-pad"
            maxLength={6}
            editable={!busy}
            style={s.hidden}
            accessibilityLabel="Type a room code"
          />
        </Pressable>
        {msg ? <Text style={[s.msg, { color: t.rose }]}>{msg}</Text> : null}
      </Card>
      <View style={s.lh}>
        <Text style={[s.k, { color: t.mute }]}>{`OPEN ROOMS · ${rooms?.length ?? 0}`}</Text>
        <Pressable onPress={refresh} hitSlop={u(8)} accessibilityRole="button">
          <Text style={[s.rf, { color: t.accent }]}>↻ Refresh</Text>
        </Pressable>
      </View>
      {rooms && !rooms.length ? <Text style={[s.empty, { color: t.dim }]}>No open rooms right now. Host one from the Create tab.</Text> : null}
      {(rooms ?? []).map((r) => (
        <View key={r.id} style={[s.row, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
          <Face slug={r.host_avatar ?? 'yara'} size={u(30)} />
          <View style={s.rt}>
            <View style={s.rn}>
              <Text style={[s.rnT, { color: t.white }]} numberOfLines={1}>{`${r.host_name}’s room`}</Text>
              <LevelBadge level={r.host_level} size={u(14)} />
            </View>
            <Text style={[s.rs, { color: t.mute }]} numberOfLines={1}>{settingsLine(def, r.settings)}</Text>
          </View>
          <Text style={[s.cnt, { color: t.mute }]}>{`${r.players} / 6`}</Text>
          <Btn label="Join" onPress={() => go(() => joinRoomId(r.id, avatar))} disabled={busy} style={s.jb} />
        </View>
      ))}
    </>
  );
}

function Create({ def, prefill }: { def: GameDef; prefill?: Record<string, unknown> }) {
  const t = useTheme();
  const avatar = useAccount((a) => a.profile?.avatar);
  const opts = def.setup.online ?? [];
  const [vals, setVals] = useState<Record<string, string | number>>(() =>
    Object.fromEntries(opts.map((o) => [o.key, (prefill?.[o.key] as string | number | undefined) ?? o.initial])),
  );
  const [teams, setTeams] = useState(Number(prefill?.teams) || 0);
  const [pub, setPub] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const create = async () => {
    setBusy(true);
    setErr(false);
    try {
      const id = await createRoom(def.key, { ...vals, teams }, pub, avatar);
      lobbyOf(def, id);
    } catch {
      setErr(true);
      setBusy(false);
    }
  };
  const Line = ({ label, children, first }: { label: string; children: React.ReactNode; first?: boolean }) => (
    <View style={[s.line, !first && { borderTopWidth: 1, borderTopColor: t.panelLine, paddingTop: u(8) }]}>
      <Text style={[s.lbl, { color: t.white }]}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
  return (
    <>
      <Card style={s.card}>
        {opts.map((o, i) => (
          <Line key={o.key} label={o.label} first={i === 0}>
            <Chips choices={o.choices} value={vals[o.key]} onChange={(v) => setVals((p) => ({ ...p, [o.key]: v }))} />
          </Line>
        ))}
        {def.teams?.online ? (
          <Line label="Teams">
            <Chips choices={[{ value: 0, label: 'Off' }, { value: 2, label: '2' }, { value: 3, label: '3' }]} value={teams} onChange={setTeams} />
          </Line>
        ) : null}
        <Line label="Who joins">
          <Chips choices={[{ value: 1, label: 'Public', note: 'listed' }, { value: 0, label: 'Private', note: 'code only' }]} value={pub ? 1 : 0} onChange={(v) => setPub(v === 1)} />
        </Line>
      </Card>
      <Text style={[s.note, { color: err ? t.rose : t.dim }]}>
        {err ? JOIN_SAY.error : teams ? 'You put players in teams in the lobby.' : 'You can still change these in the lobby.'}
      </Text>
      <Btn label={busy ? 'Opening room…' : 'Create room'} onPress={create} disabled={busy} />
    </>
  );
}

const s = StyleSheet.create({
  stubs: { flexDirection: 'row', gap: u(9) },
  stub: { flex: 1, borderWidth: 1, borderRadius: u(11), paddingVertical: u(8), paddingHorizontal: u(12), gap: u(1) },
  notch: { position: 'absolute', top: '50%', width: u(12), height: u(12), marginTop: u(-6), borderRadius: u(6), borderWidth: 1 },
  nl: { left: u(-6.5) },
  nr: { right: u(-6.5) },
  stubK: { fontFamily: F.bodyBold, fontSize: u(7.5), letterSpacing: u(1.6) },
  stubT: { fontFamily: F.display, fontSize: u(15), lineHeight: u(18) },
  stubN: { fontFamily: F.body, fontSize: u(9), lineHeight: u(12) },
  card: { padding: u(10), gap: u(7) },
  k: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.4) },
  boxes: { flexDirection: 'row', gap: u(5) },
  box: { flex: 1, height: u(34), borderRadius: u(9), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  boxT: { fontFamily: F.mono, fontSize: u(16) },
  hidden: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.01, color: 'transparent', ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  msg: { fontFamily: F.body, fontSize: u(9.5), textAlign: 'center' },
  lh: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: u(2) },
  rf: { fontFamily: F.bodySemi, fontSize: u(10) },
  empty: { fontFamily: F.body, fontSize: u(10.5), textAlign: 'center', paddingVertical: u(10) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(8), borderWidth: 1, borderRadius: u(12), paddingVertical: u(7), paddingHorizontal: u(9) },
  rt: { flex: 1, minWidth: 0, gap: u(1) },
  rn: { flexDirection: 'row', alignItems: 'center', gap: u(4) },
  rnT: { fontFamily: F.bodySemi, fontSize: u(11.5), flexShrink: 1 },
  rs: { fontFamily: F.body, fontSize: u(9) },
  cnt: { fontFamily: F.mono, fontSize: u(9.5) },
  jb: { minWidth: u(54) },
  line: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  lbl: { fontFamily: F.bodySemi, fontSize: u(11), lineHeight: u(14), width: u(62) },
  note: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(13), textAlign: 'center' },
});
