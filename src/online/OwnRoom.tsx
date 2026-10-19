import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text, TextInput } from '@/components/AppText';

import { LevelBadge } from '@/components/LevelBadge';
import { PlayerFace } from '@/features/style/Frame';
import { PlayerTitle } from '@/features/style/PlayerTitle';
import { Face } from '@/games/shell/Face';
import { presetTeam } from '@/games/shell/teams';
import type { GameDef } from '@/games/shell/types';
import { useAccount } from '@/state/account';
import { shareText } from '@/lib/share';

import { createRoom, JOIN_SAY, joinRoom, joinRoomId, leaveRoom, rematchRoom, setReady, setTeam, startMatch, type Seat } from './api';
import { settingsLine } from './format';
import { LobbySheets, type LobbySheet } from './Lobby';
import { RoomLookProvider, type RoomLook } from './look';
import { useTalk, useTalkFeed } from './talk';
import { TalkBubble } from './TalkBar';
import { lobbyOf, useJoin, useOpenRooms } from './useJoin';
import { useRoom } from './useRoom';

/**
 * Join or create and the lobby for a game with its own look (Yazan 2026-10-18: from the landing page until you leave,
 * the game keeps its look). The same steps as the shared OnlineSetup and Lobby (ON16, ON20); the game hands in its own
 * page, paper, buttons, type and words.
 */
export type RoomKit = {
  /** The sheets and Talk tray in the game's colours. */
  look: RoomLook;
  /** The page: the game header over the game's own background. `top` floats over it (the sheets). */
  Screen: ComponentType<{ children: ReactNode; top?: ReactNode }>;
  /** The game's paper (a parchment sheet, a pinned report, a playbill). */
  Paper: ComponentType<{ children: ReactNode; style?: StyleProp<ViewStyle> }>;
  /** The game's button on the background; `onPaper` for one drawn on its paper. */
  Btn: ComponentType<{ label: string; onPress?: () => void; ghost?: boolean; off?: boolean; onPaper?: boolean; style?: StyleProp<ViewStyle> }>;
  /** The big page title. */
  Title: ComponentType<{ text: string }>;
  /** A player's mark in their colour (a kingdom dot, an ink diamond, a gem). */
  Mark: ComponentType<{ color: string }>;
  f: { head: string; body: string; kick: string; num: string };
  /** The game's sizing (its own scale). */
  z: (n: number) => number;
  /** Text sizes run a little bigger for some faces. */
  k?: number;
  room: { fg: string; soft: string; dim: string; acc: string };
  paper: { fg: string; soft: string; acc: string; rule: string; onAcc: string };
  ok: string;
  wait: string;
  seat: (i: number) => string;
  /** Rank as I, II, III (or 1, 2, 3). */
  num?: (i: number) => string;
  words: {
    game: string;
    setup: string;
    find: string;
    findNote: string;
    host: string;
    hostNote: string;
    code: string;
    open: string;
    none: string;
    create: string;
    lobby: string;
    players: string;
    invite: string;
    start: string;
    leave: string;
    gone: string;
  };
};

const spaced = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

/** Text in the kit's faces and sizing. */
function KT({ kit, children, f = kit.f.body, size = 13, color, style, lines }: { kit: RoomKit; children: ReactNode; f?: string; size?: number; color: string; style?: StyleProp<TextStyle>; lines?: number }) {
  const n = size * (kit.k ?? 1);
  return <Text numberOfLines={lines} style={[{ fontFamily: f, fontSize: kit.z(n), lineHeight: kit.z(n * 1.3), color }, style]}>{children}</Text>;
}

function Kick({ kit, children, color }: { kit: RoomKit; children: string; color: string }) {
  return (
    <KT kit={kit} f={kit.f.kick} size={10} color={color} style={{ letterSpacing: kit.z(1.8) }}>
      {children.toUpperCase()}
    </KT>
  );
}

/** The game's choices on its paper: the picked one filled in the paper's accent. */
function Choices<V extends string | number>({ kit, choices, value, onChange }: { kit: RoomKit; choices: { value: V; label: string }[]; value: V; onChange?: (v: V) => void }) {
  const { z, paper } = kit;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: z(6) }}>
      {choices.map((c) => {
        const on = c.value === value;
        return (
          <Pressable
            key={String(c.value)}
            onPress={onChange ? () => onChange(c.value) : undefined}
            style={{ borderWidth: 1.5, borderColor: on ? paper.acc : paper.rule, backgroundColor: on ? paper.acc : 'transparent', borderRadius: z(4), paddingVertical: z(5), paddingHorizontal: z(11) }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={c.label}>
            <KT kit={kit} f={kit.f.head} size={12} color={on ? paper.onAcc : paper.fg}>{c.label}</KT>
          </Pressable>
        );
      })}
    </View>
  );
}

function BackLink({ kit, label, to }: { kit: RoomKit; label: string; to: string }) {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace(to as never))} hitSlop={kit.z(8)} accessibilityRole="link" accessibilityLabel={`Back to ${label}`} style={{ alignSelf: 'flex-start' }}>
      <KT kit={kit} size={13} color={kit.room.soft}>{`‹ ${label}`}</KT>
    </Pressable>
  );
}

// ---------------------------------------------------------------- join or create

type Tab = 'join' | 'create';

export function OwnOnlineSetup({ kit, def, prefill }: { kit: RoomKit; def: GameDef; prefill?: Record<string, unknown> }) {
  const [tab, setTab] = useState<Tab>(prefill ? 'create' : 'join');
  const { z, words: w } = kit;
  const tabs: { key: Tab; title: string; note: string }[] = [
    { key: 'join', title: w.find, note: w.findNote },
    { key: 'create', title: w.host, note: w.hostNote },
  ];
  return (
    <kit.Screen>
      <View style={{ gap: z(4) }}>
        <BackLink kit={kit} label={w.game} to={`/play/${def.key}`} />
        <Kick kit={kit} color={kit.room.soft}>Online</Kick>
        <kit.Title text={w.setup} />
      </View>
      <View style={{ flexDirection: 'row', gap: z(10) }}>
        {tabs.map((x) => {
          const on = x.key === tab;
          const body = (
            <>
              <KT kit={kit} f={kit.f.head} size={14.5} color={on ? kit.paper.fg : kit.room.fg}>{x.title}</KT>
              <KT kit={kit} size={11} color={on ? kit.paper.soft : kit.room.dim}>{x.note}</KT>
            </>
          );
          return (
            <Pressable key={x.key} onPress={() => setTab(x.key)} style={{ flex: 1 }} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={x.title}>
              {on ? <kit.Paper style={{ flex: 1 }}>{body}</kit.Paper> : <View style={[st.off, { borderColor: kit.look.line, borderRadius: z(6), padding: z(12), gap: z(2) }]}>{body}</View>}
            </Pressable>
          );
        })}
      </View>
      {tab === 'join' ? <Join kit={kit} def={def} /> : <Create kit={kit} def={def} prefill={prefill} />}
    </kit.Screen>
  );
}

function Join({ kit, def }: { kit: RoomKit; def: GameDef }) {
  const { z, paper, room: rc, words: w } = kit;
  const [code, setCode] = useState('');
  const { rooms, refresh } = useOpenRooms(def);
  const { msg, setMsg, busy, go } = useJoin(def);
  const input = useRef<TextInput>(null);
  const type = (v: string) => {
    const c = v.replace(/\D/g, '').slice(0, 6);
    setCode(c);
    setMsg(null);
    if (c.length === 6) go((a) => joinRoom(c, a));
  };
  return (
    <>
      <kit.Paper>
        <Kick kit={kit} color={paper.acc}>{`Have a ${w.code.toLowerCase()}?`}</Kick>
        <Pressable onPress={() => input.current?.focus()} style={{ flexDirection: 'row', gap: z(5) }} accessibilityLabel={w.code}>
          {Array.from({ length: 6 }, (_, i) => (
            <View key={i} style={[st.box, { height: z(38), borderRadius: z(3), borderColor: code[i] ? paper.acc : paper.rule }, i === 3 ? { marginLeft: z(8) } : null]}>
              <KT kit={kit} f={kit.f.num} size={18} color={paper.fg}>{code[i] ?? ''}</KT>
            </View>
          ))}
          <TextInput ref={input} value={code} onChangeText={type} keyboardType="number-pad" maxLength={6} editable={!busy} style={st.hidden} accessibilityLabel={`Type a ${w.code.toLowerCase()}`} />
        </Pressable>
        <KT kit={kit} size={11.5} color={msg ? paper.acc : paper.soft}>{msg ?? (busy ? 'Finding it…' : 'Type the 6 digits the host shared. You join as soon as the last one is in.')}</KT>
      </kit.Paper>
      <View style={st.spread}>
        <Kick kit={kit} color={rc.soft}>{`${w.open} · ${rooms?.length ?? 0}`}</Kick>
        <Pressable onPress={refresh} hitSlop={z(8)} accessibilityRole="button">
          <KT kit={kit} size={12} color={rc.acc}>↻ Refresh</KT>
        </Pressable>
      </View>
      {rooms && !rooms.length ? <KT kit={kit} size={12.5} color={rc.soft} style={{ textAlign: 'center', paddingVertical: z(8) }}>{w.none}</KT> : null}
      {(rooms ?? []).map((r, i) => (
        <kit.Paper key={r.id} style={{ gap: 0 }}>
          <View style={[st.row, { gap: z(10) }]}>
            <kit.Mark color={kit.seat(i)} />
            <Face slug={r.host_avatar ?? 'yara'} size={z(30)} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={[st.row, { gap: z(5) }]}>
                <KT kit={kit} f={kit.f.head} size={14} color={paper.fg} lines={1} style={{ flexShrink: 1 }}>{r.host_name}</KT>
                <LevelBadge level={r.host_level} size={z(14)} />
              </View>
              <KT kit={kit} size={11} color={paper.soft} lines={1}>{`${settingsLine(def, r.settings)} · ${r.players} of ${Math.min(6, def.players?.online?.max ?? 6)}`}</KT>
            </View>
            <kit.Btn label="Join" onPaper off={busy} onPress={() => go((a) => joinRoomId(r.id, a))} style={{ minWidth: z(64) }} />
          </View>
        </kit.Paper>
      ))}
    </>
  );
}

function Create({ kit, def, prefill }: { kit: RoomKit; def: GameDef; prefill?: Record<string, unknown> }) {
  const { z, paper } = kit;
  const avatar = useAccount((a) => a.profile?.avatar);
  const opts = def.setup.online ?? [];
  const [vals, setVals] = useState<Record<string, string | number>>(() => Object.fromEntries(opts.map((o) => [o.key, (prefill?.[o.key] as string | number | undefined) ?? o.initial])));
  const [teams, setTeams] = useState(Number(prefill?.teams) || 0);
  const [pub, setPub] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const create = async () => {
    setBusy(true);
    setErr(false);
    try {
      lobbyOf(def, await createRoom(def.key, { ...vals, teams }, pub === 1, avatar));
    } catch {
      setErr(true);
      setBusy(false);
    }
  };
  const line = (label: string, body: ReactNode, first?: boolean) => (
    <View key={label} style={[{ gap: z(6) }, first ? null : { borderTopWidth: 1, borderTopColor: paper.rule, paddingTop: z(10) }]}>
      <Kick kit={kit} color={paper.soft}>{label}</Kick>
      {body}
    </View>
  );
  return (
    <>
      <kit.Paper>
        {opts.map((o, i) => line(o.label, <Choices kit={kit} choices={o.choices} value={vals[o.key]} onChange={(v) => setVals((p) => ({ ...p, [o.key]: v }))} />, i === 0))}
        {def.teams?.online ? line('Teams', <Choices kit={kit} choices={[{ value: 0, label: 'Off' }, { value: 2, label: '2' }, { value: 3, label: '3' }]} value={teams} onChange={setTeams} />) : null}
        {line('Who joins', <Choices kit={kit} choices={[{ value: 1, label: 'Anyone' }, { value: 0, label: 'Code only' }]} value={pub} onChange={setPub} />, !opts.length && !def.teams?.online)}
      </kit.Paper>
      <KT kit={kit} size={12} color={err ? kit.room.acc : kit.room.soft} style={{ textAlign: 'center' }}>
        {err ? JOIN_SAY.error : teams ? 'You put players in teams in the lobby.' : 'You can still change these in the lobby.'}
      </KT>
      <kit.Btn label={busy ? 'Opening…' : kit.words.create} off={busy} onPress={create} />
    </>
  );
}

// ---------------------------------------------------------------- lobby

export function OwnLobby({ kit, def, roomId }: { kit: RoomKit; def: GameDef; roomId: string }) {
  const { z, paper, room: rc, words: w } = kit;
  const cap = Math.min(6, def.players?.online?.max ?? 6);
  const { state, error, reload } = useRoom(roomId);
  const [sheet, setSheet] = useState<LobbySheet>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startFail, setStartFail] = useState(false);
  const failTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashStartFail = () => {
    setStartFail(true);
    if (failTimer.current) clearTimeout(failTimer.current);
    failTimer.current = setTimeout(() => setStartFail(false), 2500);
  };
  useEffect(() => () => void (failTimer.current && clearTimeout(failTimer.current)), []);
  const went = useRef(false);
  const room = state?.room;
  const me = state?.me;
  const players = useMemo(() => (state?.players ?? []).filter((p) => p.state === 'in'), [state]);
  const watching = (state?.players ?? []).filter((p) => p.state === 'spectator');
  const mine = state?.players.find((p) => p.user_id === me);
  const host = room?.host === me;
  const teams = Number(room?.settings.teams) || 0;
  useTalkFeed(roomId, me ?? null);
  const pops = useTalk((x) => x.pops);
  const muted = useTalk((x) => x.muted[roomId]) ?? [];

  // The match has begun: everyone in the room (spectators too, ON19) moves to the live screen.
  useEffect(() => {
    if (!room || went.current) return;
    if (room.status === 'playing' && room.match_id) {
      went.current = true;
      router.replace(`/play/${def.key}/live?room=${room.id}&match=${room.match_id}`);
    }
  }, [room, def.key]);
  // Teams on: the host deals anyone without a team round the teams, so Start never waits on an empty pick.
  useEffect(() => {
    if (!host || !room || room.status !== 'lobby' || teams < 2) return;
    players.forEach((p, i) => {
      if (p.team == null || p.team >= teams) setTeam(room.id, p.user_id, i % teams).catch(() => {});
    });
  }, [host, room, teams, players]);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  const leave = async () => {
    await leaveRoom(roomId).catch(() => {});
    router.replace(`/play/${def.key}`);
  };

  if (!state || state.result !== 'ok' || !room || room.status === 'closed') {
    return (
      <RoomLookProvider value={kit.look}>
        <kit.Screen>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <kit.Paper>
              <Kick kit={kit} color={paper.acc}>{w.game}</Kick>
              <KT kit={kit} f={kit.f.head} size={20} color={paper.fg}>
                {!state ? (error ? 'Couldn’t reach the room' : 'Opening the room…') : room?.status === 'closed' ? w.gone : 'You’re not in this room'}
              </KT>
              {!state && !error ? null : (
                <>
                  <KT kit={kit} size={12.5} color={paper.soft}>{!state ? 'Check your connection and try again.' : 'Rooms close when everyone leaves, or after 15 minutes without a start.'}</KT>
                  <kit.Btn label="Back to the game" onPaper onPress={() => router.replace(`/play/${def.key}`)} />
                </>
              )}
            </kit.Paper>
          </View>
        </kit.Screen>
      </RoomLookProvider>
    );
  }

  const share = () => shareText(`Join my ${w.game} room on MedNova. ${w.code}: ${spaced(room.code)}`);
  const allReady = players.length >= 2 && players.every((p) => p.ready);
  const notReady = players.filter((p) => !p.ready);
  const status =
    room.status === 'finished'
      ? 'Last match finished'
      : players.length < 2
        ? 'Waiting for players'
        : allReady
          ? 'Everyone is ready'
          : notReady.some((p) => p.user_id === me)
            ? 'Waiting for you'
            : `Waiting for ${notReady[0].name}${notReady.length > 1 ? ` + ${notReady.length - 1}` : ''}`;
  const teamOf = (i: number) => def.palette?.teams[i] ?? presetTeam(i);

  const row = (p: Seat, i: number, last: boolean) => {
    const isHost = p.user_id === room.host;
    const label = isHost ? 'Host' : p.ready ? 'Ready' : 'Not ready';
    const said = pops.find((m) => m.user_id === p.user_id);
    return (
      <Pressable
        key={p.user_id}
        onPress={() => setSheet({ seat: p })}
        style={[st.row, { gap: z(10), paddingVertical: z(8) }, last ? null : { borderBottomWidth: 1, borderBottomColor: paper.rule }]}
        accessibilityRole="button"
        accessibilityLabel={`${p.name}, ${label}${muted.includes(p.user_id) ? ', muted' : ''}`}>
        <kit.Mark color={teams >= 2 && p.team != null ? teamOf(p.team).color : kit.seat(i)} />
        <View>
          <PlayerFace slug={p.character} size={z(34)} userId={p.user_id} />
          <View style={{ position: 'absolute', right: -z(5), bottom: -z(3) }}>
            <LevelBadge level={p.level} size={z(15)} />
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <KT kit={kit} f={kit.f.head} size={15} color={paper.fg} lines={1}>{p.user_id === me ? 'You' : p.name}</KT>
          <PlayerTitle userId={p.user_id} size={10} accent={paper.acc} mode="light" />
        </View>
        {muted.includes(p.user_id) ? <KT kit={kit} size={11} color={paper.soft}>muted</KT> : null}
        <KT kit={kit} f={kit.f.kick} size={10.5} color={isHost ? paper.acc : p.ready ? kit.ok : paper.soft} style={{ letterSpacing: z(1) }}>{label.toUpperCase()}</KT>
        {said ? (
          <View style={{ position: 'absolute', top: -z(24), right: z(40), zIndex: 3 }} pointerEvents="none">
            <TalkBubble m={said} size={46} />
          </View>
        ) : null}
      </Pressable>
    );
  };
  const empty = (n: number) =>
    Array.from({ length: n }, (_, i) => (
      <Pressable key={`e${i}`} onPress={share} style={[st.row, { gap: z(10), paddingVertical: z(9) }, i < n - 1 ? { borderBottomWidth: 1, borderBottomColor: paper.rule } : null]} accessibilityRole="button" accessibilityLabel="Invite a player">
        <View style={{ width: z(34), height: z(34), borderRadius: z(17), borderWidth: 1.5, borderStyle: 'dashed', borderColor: paper.rule, alignItems: 'center', justifyContent: 'center', marginLeft: z(18) }}>
          <KT kit={kit} size={16} color={paper.soft}>+</KT>
        </View>
        <KT kit={kit} f={kit.f.head} size={14} color={paper.soft} style={{ opacity: 0.8 }}>{w.invite}</KT>
      </Pressable>
    ));

  return (
    <RoomLookProvider value={kit.look}>
      <kit.Screen top={<LobbySheets def={def} state={state} sheet={sheet} setSheet={setSheet} reload={reload} />}>
        <View style={st.spread}>
          <Pressable onPress={leave} hitSlop={z(8)} accessibilityRole="button">
            <KT kit={kit} size={13} color={rc.soft}>{`‹ ${w.leave}`}</KT>
          </Pressable>
          <Pressable onPress={() => setSheet('how')} hitSlop={z(8)} accessibilityRole="button">
            <KT kit={kit} size={13} color={rc.acc}>How to play</KT>
          </Pressable>
        </View>
        <View style={{ gap: z(3) }}>
          <Kick kit={kit} color={rc.soft}>{room.is_public ? 'Open room' : 'Private room'}</Kick>
          <kit.Title text={w.lobby} />
        </View>
        <kit.Paper>
          <View style={st.spread}>
            <View style={{ gap: z(1) }}>
              <Kick kit={kit} color={paper.soft}>{w.code}</Kick>
              <KT kit={kit} f={kit.f.num} size={26} color={paper.acc} style={{ letterSpacing: z(2) }}>{spaced(room.code)}</KT>
            </View>
            <View style={{ alignItems: 'flex-end', gap: z(6) }}>
              <Pressable onPress={() => Clipboard.setStringAsync(room.code).then(() => setCopied(true))} hitSlop={z(6)} accessibilityRole="button">
                <KT kit={kit} size={12} color={paper.fg} style={{ textDecorationLine: 'underline' }}>{copied ? 'Copied' : 'Copy'}</KT>
              </Pressable>
              <Pressable onPress={share} hitSlop={z(6)} accessibilityRole="button">
                <KT kit={kit} size={12} color={paper.acc} style={{ textDecorationLine: 'underline' }}>Share</KT>
              </Pressable>
            </View>
          </View>
          <View style={[st.row, { gap: z(7), borderTopWidth: 1, borderTopColor: paper.rule, paddingTop: z(8) }]}>
            <View style={{ width: z(7), height: z(7), borderRadius: z(4), backgroundColor: allReady ? kit.ok : kit.wait }} />
            <KT kit={kit} size={12.5} color={paper.soft} style={{ flex: 1 }}>{status}</KT>
            <KT kit={kit} f={kit.f.num} size={13} color={paper.fg}>{`${players.length} / ${cap}`}</KT>
          </View>
        </kit.Paper>
        <kit.Paper style={{ gap: 0 }}>
          <Kick kit={kit} color={paper.acc}>{w.players}</Kick>
          {teams >= 2
            ? Array.from({ length: teams }, (_, ti) => {
                const tm = teamOf(ti);
                const list = players.filter((p) => p.team === ti);
                return (
                  <View key={ti} style={{ marginTop: z(8) }}>
                    <View style={[st.row, { gap: z(6) }]}>
                      <kit.Mark color={tm.color} />
                      <KT kit={kit} f={kit.f.head} size={13} color={paper.fg} style={{ flex: 1 }}>{tm.name}</KT>
                      <KT kit={kit} size={11} color={paper.soft}>{`${list.length} ${list.length === 1 ? 'player' : 'players'}`}</KT>
                    </View>
                    {list.length ? list.map((p, i) => row(p, players.indexOf(p), i === list.length - 1)) : <KT kit={kit} size={11.5} color={paper.soft} style={{ paddingVertical: z(6) }}>Nobody yet.</KT>}
                  </View>
                );
              })
            : [...players.map((p, i) => row(p, i, i === players.length - 1 && players.length >= cap)), ...empty(Math.max(0, cap - players.length))]}
        </kit.Paper>
        {watching.length ? <KT kit={kit} size={11.5} color={rc.soft}>{`Watching: ${watching.map((p) => p.name).join(', ')}. They get a seat at the rematch.`}</KT> : null}
        <kit.Paper>
          <View style={st.spread}>
            <View style={{ flex: 1, gap: z(2) }}>
              <Kick kit={kit} color={paper.soft}>Settings</Kick>
              <KT kit={kit} f={kit.f.head} size={13.5} color={paper.fg}>{settingsLine(def, room.settings) || 'Standard'}</KT>
            </View>
            {host && room.status === 'lobby' ? (
              <Pressable onPress={() => setSheet('settings')} hitSlop={z(8)} accessibilityRole="button">
                <KT kit={kit} size={12.5} color={paper.acc} style={{ textDecorationLine: 'underline' }}>Change</KT>
              </Pressable>
            ) : null}
          </View>
        </kit.Paper>
        <KT kit={kit} size={12} color={rc.soft} style={{ textAlign: 'center' }}>
          {room.status === 'finished' ? 'Tap Back to lobby to play again with the same settings.' : host ? 'You are the host. Start lights up when everyone is ready.' : 'The host starts the match once everyone is ready.'}
        </KT>
        <View style={[st.row, { gap: z(8) }]}>
          <Pressable onPress={() => setSheet('talk')} style={[st.row, { gap: z(6), borderWidth: 1, borderColor: kit.look.line, backgroundColor: kit.look.panel, borderRadius: z(30), paddingVertical: z(6), paddingLeft: z(6), paddingRight: z(12) }]} accessibilityRole="button" accessibilityLabel="Talk: stickers and voice">
            <PlayerFace slug={mine?.character ?? 'yara'} size={z(22)} userId={mine?.user_id} still />
            <KT kit={kit} f={kit.f.head} size={12.5} color={rc.fg}>Talk</KT>
          </Pressable>
          <View style={{ flex: 1 }}>
            {room.status === 'finished' ? (
              <kit.Btn label="Back to lobby" onPress={() => rematchRoom(room.id).then(reload).catch(() => {})} />
            ) : host ? (
              <kit.Btn
                label={busy ? 'Starting…' : startFail ? 'Couldn’t start. Try again' : allReady ? w.start : players.length < 2 ? 'Needs 2 players' : `${players.length - notReady.length} of ${players.length} ready`}
                off={!allReady || busy}
                onPress={async () => {
                  setBusy(true);
                  // A refused start (someone left or un-readied) says so on the button instead of failing silently (AP12g).
                  await startMatch(room.id).catch(() => flashStartFail());
                  await reload();
                  setBusy(false);
                }}
              />
            ) : mine?.state === 'spectator' ? (
              <kit.Btn label="Watching this match" off />
            ) : (
              <kit.Btn label={mine?.ready ? 'Not ready yet' : 'I’m ready'} ghost={!!mine?.ready} onPress={() => setReady(room.id, !mine?.ready).then(reload).catch(() => {})} />
            )}
          </View>
        </View>
      </kit.Screen>
    </RoomLookProvider>
  );
}

const st = StyleSheet.create({
  off: { flex: 1, borderWidth: 1, borderStyle: 'dashed', opacity: 0.8 },
  box: { flex: 1, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  hidden: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.01, color: 'transparent', ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
