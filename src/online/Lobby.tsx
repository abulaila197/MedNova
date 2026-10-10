import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { Sheet } from '@/components/Sheet';
import { CHARACTERS } from '@/games/shell/characters';
import { Face } from '@/games/shell/Face';
import { presetTeam } from '@/games/shell/teams';
import type { GameDef } from '@/games/shell/types';
import { GameScreen } from '@/games/shell/ui';
import { ModePin } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { leaveRoom, rematchRoom, removePlayer, setCharacter, setReady, setTeam, startMatch, updateRoom, type RoomState, type Seat } from './api';
import { settingsLine } from './format';
import { G } from './grey';
import { TalkBubble, TalkPanel } from './Talk';
import { toggleMute, useTalk, useTalkFeed } from './talk';
import { useRoom } from './useRoom';


/** A page in the online look: dark header (pinned), grey room behind. */
export function GreyScreen({ children, scroll = true, over }: { children: React.ReactNode; scroll?: boolean; over?: React.ReactNode }) {
  return (
    <ModePin.Provider value="dark">
      <GameScreen scroll={scroll} top={over} under={<View style={[StyleSheet.absoluteFill, { backgroundColor: G.page }]} />} bodyStyle={{ paddingTop: u(12), gap: u(11) }}>
        {children}
      </GameScreen>
    </ModePin.Provider>
  );
}

export function GBtn({ label, onPress, off, style }: { label: string; onPress?: () => void; off?: boolean; style?: object }) {
  return (
    <Pressable onPress={onPress} disabled={off} style={[s.btn, { backgroundColor: off ? G.btnOff : G.btn }, style]} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[s.btnT, { color: off ? '#b9bcc3' : G.onBtn }]}>{label}</Text>
    </Pressable>
  );
}

export { G };

const TONE = { bg: G.raised, line: G.line };

const spaced = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

/** ON16 (locked): the room lobby. Leave, How to play, the code, a live status line, character tiles, settings, Start or I'm ready. */
export function Lobby({ def, roomId }: { def: GameDef; roomId: string }) {
  // The room's seats: the game's online limit, 6 at most (WC22: Wheels holds 4).
  const cap = Math.min(6, def.players?.online?.max ?? 6);
  const { state, error, reload } = useRoom(roomId);
  const [sheet, setSheet] = useState<'how' | 'settings' | 'talk' | { seat: Seat } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const went = useRef(false);

  const room = state?.room;
  const me = state?.me;
  const players = useMemo(() => (state?.players ?? []).filter((p) => p.state === 'in'), [state]);
  const watching = (state?.players ?? []).filter((p) => p.state === 'spectator');
  const mine = state?.players.find((p) => p.user_id === me);
  const host = room?.host === me;
  const teams = Number(room?.settings.teams) || 0;
  // ON12: stickers and voice lines in the lobby; a sticker pops over its sender's tile.
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

  if (!state) {
    return (
      <GreyScreen>
        <Text style={[s.center, { color: G.mute }]}>{error ? 'Couldn’t reach the room. Check your connection.' : 'Opening the room…'}</Text>
      </GreyScreen>
    );
  }
  if (state.result !== 'ok' || !room || room.status === 'closed') {
    return (
      <GreyScreen>
        <Text style={[s.h, { color: G.fg }]}>{room?.status === 'closed' ? 'This room has closed' : 'You’re not in this room'}</Text>
        <Text style={[s.small, { color: G.mute }]}>Rooms close when everyone leaves, or after 15 minutes without a start.</Text>
        <GBtn label="Back to the game" onPress={() => router.replace(`/play/${def.key}`)} />
      </GreyScreen>
    );
  }

  const share = () => Share.share({ message: `Join my MedNova room for ${def.key === 'the-diagnostic-pursuit' ? 'The Diagnostic Pursuit' : 'a game'}. Room code: ${spaced(room.code)}` }).catch(() => {});
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

  const tile = (p: Seat) => {
    const isHost = p.user_id === room.host;
    const label = isHost ? '♛ Host' : p.ready ? '✓ Ready' : 'Not ready';
    const said = pops.find((m) => m.user_id === p.user_id);
    return (
      <Pressable
        key={p.user_id}
        onPress={() => setSheet({ seat: p })}
        style={[s.tile, teams >= 2 && s.tileTight]}
        accessibilityRole="button"
        accessibilityLabel={`${p.name}, ${label}${muted.includes(p.user_id) ? ', muted' : ''}`}>
        <View style={s.ring}>
          <Face slug={p.character} size={u(38)} />
        </View>
        <Text style={[s.tn, { color: G.fg }]} numberOfLines={1}>{p.user_id === me ? 'You' : p.name}</Text>
        <Text style={[s.tl, { color: p.ready && !isHost ? G.ok : G.mute }, p.ready && !isHost && { fontFamily: F.bodySemi }]}>{label}</Text>
        {host && !isHost ? <Text style={[s.rm, { color: G.dim }]}>✕</Text> : null}
        {muted.includes(p.user_id) ? <Text style={[s.mu, { color: G.dim }]}>🔇</Text> : null}
        {said ? (
          <View style={s.bub}>
            <TalkBubble m={said} size={50} />
          </View>
        ) : null}
      </Pressable>
    );
  };
  const empties = (n: number) =>
    Array.from({ length: n }, (_, i) => (
      <Pressable key={`e${i}`} onPress={share} style={[s.tile, s.empty]} accessibilityRole="button" accessibilityLabel="Invite a player">
        <Text style={[s.plus, { color: G.dim }]}>+</Text>
        <Text style={[s.tl, { color: G.dim }]}>Invite</Text>
      </Pressable>
    ));

  const over = (
    <>
      <Sheet tone={TONE} open={sheet === 'how'} onClose={() => setSheet(null)}>
        <HowTo def={def} />
      </Sheet>
      <Sheet tone={TONE} open={sheet === 'talk'} onClose={() => setSheet(null)}>
        {sheet === 'talk' && mine ? <TalkPanel room={roomId} me={{ id: mine.user_id, name: mine.name, face: mine.character }} onSent={() => setSheet(null)} /> : null}
      </Sheet>
      <Sheet tone={TONE} open={sheet === 'settings'} onClose={() => setSheet(null)}>
        {sheet === 'settings' ? <RoomSettings def={def} state={state} onDone={() => (setSheet(null), reload())} /> : null}
      </Sheet>
      <Sheet tone={TONE} open={!!sheet && typeof sheet === 'object'} onClose={() => setSheet(null)}>
        {sheet && typeof sheet === 'object' ? <SeatSheet state={state} seat={sheet.seat} teams={teams} onDone={() => (setSheet(null), reload())} /> : null}
      </Sheet>
    </>
  );

  return (
    <GreyScreen over={over}>
      <View style={s.tb}>
        <Pressable onPress={leave} hitSlop={u(8)} accessibilityRole="button">
          <Text style={[s.tbT, { color: G.mute }]}>‹ Leave room</Text>
        </Pressable>
        <Pressable onPress={() => setSheet('how')} hitSlop={u(8)} accessibilityRole="button">
          <Text style={[s.tbT, { color: G.acc, fontFamily: F.bodySemi }]}>How to play</Text>
        </Pressable>
      </View>
      <View style={s.rh}>
        <View>
          <Text style={[s.k, { color: G.mute }]}>{room.is_public ? 'PUBLIC ROOM' : 'PRIVATE ROOM'}</Text>
          <View style={s.codeRow}>
            <Text style={[s.code, { color: G.fg }]} accessibilityLabel={`Room code ${room.code.split('').join(' ')}`}>{spaced(room.code)}</Text>
            <Pressable onPress={() => Clipboard.setStringAsync(room.code).then(() => setCopied(true))} style={s.copy} accessibilityRole="button">
              <Text style={[s.copyT, { color: G.mute }]}>{copied ? 'Copied' : '⧉ Copy'}</Text>
            </Pressable>
          </View>
        </View>
        <Pressable onPress={share} style={s.share} accessibilityRole="button">
          <Text style={[s.shareT, { color: G.fg }]}>Share</Text>
        </Pressable>
      </View>
      <View style={s.stl}>
        <View style={[s.sd, { backgroundColor: allReady ? G.ok : G.amber }]} />
        <Text style={[s.stlT, { color: G.mute }]}>{status}</Text>
        <Text style={[s.stlN, { color: G.fg }]}>{`${players.length} / ${cap}`}</Text>
      </View>

      {teams >= 2 ? (
        Array.from({ length: teams }, (_, i) => {
          const tm = presetTeam(i);
          const list = players.filter((p) => p.team === i);
          return (
            <View key={i} style={{ gap: u(6) }}>
              <View style={s.tgh}>
                <View style={[s.tdot, { backgroundColor: tm.color }]} />
                <Text style={[s.tghT, { color: G.fg }]}>{tm.name}</Text>
                <Text style={[s.tghN, { color: G.dim }]}>{`${list.length} ${list.length === 1 ? 'player' : 'players'}`}</Text>
              </View>
              <View style={s.tiles}>{list.length ? list.map(tile) : <Text style={[s.small, { color: G.dim }]}>Nobody yet.</Text>}</View>
            </View>
          );
        })
      ) : (
        <View style={s.tiles}>
          {players.map(tile)}
          {empties(Math.max(0, cap - players.length))}
        </View>
      )}
      {watching.length ? <Text style={[s.small, { color: G.dim }]}>{`Watching: ${watching.map((p) => p.name).join(', ')} · they get a seat at the rematch`}</Text> : null}

      <View style={s.sum}>
        <View style={{ gap: u(2), flex: 1 }}>
          <Text style={[s.k, { color: G.mute }]}>SETTINGS</Text>
          <Text style={[s.sumT, { color: G.fg }]}>{settingsLine(def, room.settings)}</Text>
        </View>
        {host && room.status === 'lobby' ? (
          <Pressable onPress={() => setSheet('settings')} hitSlop={u(8)} accessibilityRole="button">
            <Text style={[s.sumT, { color: G.acc }]}>Change</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={[s.note, { color: G.dim }]}>
        {room.status === 'finished'
          ? 'Tap Back to lobby to play again with the same settings.'
          : host
            ? 'You are the host. Start lights up when everyone is ready.'
            : 'The host starts the match once everyone is ready.'}
      </Text>
      <View style={s.lbar}>
        <Pressable onPress={() => setSheet('talk')} style={s.talk} accessibilityRole="button" accessibilityLabel="Talk: stickers and voice">
          <Face slug={mine?.character ?? 'yara'} size={u(20)} />
          <Text style={[s.talkT, { color: G.fg }]}>Talk</Text>
        </Pressable>
        {room.status === 'finished' ? (
          <GBtn style={s.grow} label="Back to lobby" onPress={() => rematchRoom(room.id).then(reload).catch(() => {})} />
        ) : host ? (
          <GBtn
            style={s.grow}
            label={busy ? 'Starting…' : allReady ? 'Start' : players.length < 2 ? 'Start · needs 2 players' : `Start · ${players.length - notReady.length} of ${players.length} ready`}
            off={!allReady || busy}
            onPress={async () => {
              setBusy(true);
              await startMatch(room.id).catch(() => {});
              await reload();
              setBusy(false);
            }}
          />
        ) : mine?.state === 'spectator' ? (
          <GBtn style={s.grow} label="Watching this match" off />
        ) : (
          <GBtn label={mine?.ready ? 'Not ready yet' : 'I’m ready'} onPress={() => setReady(room.id, !mine?.ready).then(reload).catch(() => {})} style={[s.grow, mine?.ready ? s.ghost : null]} />
        )}
      </View>

    </GreyScreen>
  );
}

function HowTo({ def }: { def: GameDef }) {
  const steps = def.modes.find((m) => m.mode === 'online')?.howTo ?? [];
  return (
    <ModePin.Provider value="dark">
      <Text style={[s.k, { color: G.mute }]}>HOW TO PLAY ONLINE</Text>
      {steps.map((x, i) => (
        <View key={i} style={s.step}>
          <Text style={[s.stepN, { color: G.dim }]}>{i + 1}</Text>
          <Text style={[s.stepT, { color: G.fg }]}>{x}</Text>
        </View>
      ))}
    </ModePin.Provider>
  );
}

/** Host only: the same options as Create, plus Public or Private. Changing them un-readies the others. */
function RoomSettings({ def, state, onDone }: { def: GameDef; state: RoomState; onDone: () => void }) {
  const opts = def.setup.online ?? [];
  const [vals, setVals] = useState<Record<string, unknown>>(() => ({ ...state.room.settings }));
  const [pub, setPub] = useState(state.room.is_public);
  const rows: { key: string; label: string; choices: { value: string | number; label: string }[]; value: unknown; set: (v: string | number) => void }[] = [
    ...opts.map((o) => ({ key: o.key, label: o.label, choices: o.choices, value: vals[o.key] ?? o.initial, set: (v: string | number) => setVals((p) => ({ ...p, [o.key]: v })) })),
    ...(def.teams?.online
      ? [{ key: 'teams', label: 'Teams', choices: [{ value: 0, label: 'Off' }, { value: 2, label: '2' }, { value: 3, label: '3' }], value: Number(vals.teams) || 0, set: (v: string | number) => setVals((p) => ({ ...p, teams: v })) }]
      : []),
    { key: 'pub', label: 'Who joins', choices: [{ value: 1, label: 'Public' }, { value: 0, label: 'Private' }], value: pub ? 1 : 0, set: (v: string | number) => setPub(v === 1) },
  ];
  return (
    <>
      <Text style={[s.k, { color: G.mute }]}>ROOM SETTINGS</Text>
      {rows.map((r) => (
        <View key={r.key} style={s.optRow}>
          <Text style={[s.optL, { color: G.fg }]}>{r.label}</Text>
          <View style={s.chips}>
            {r.choices.map((c) => {
              const on = c.value === r.value;
              return (
                <Pressable key={String(c.value)} onPress={() => r.set(c.value)} style={[s.chip, on && { backgroundColor: G.btn, borderColor: 'transparent' }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Text style={[s.chipT, { color: on ? G.onBtn : G.mute }]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <Text style={[s.small, { color: G.dim }]}>Saving asks everyone to tap Ready again.</Text>
      <GBtn label="Save" onPress={() => updateRoom(state.room.id, vals, pub).then(onDone).catch(onDone)} />
    </>
  );
}

/** Tap a tile: your own picks a free character (ON10); the host also moves players between teams or removes them (ON11). */
function SeatSheet({ state, seat, teams, onDone }: { state: RoomState; seat: Seat; teams: number; onDone: () => void }) {
  const self = seat.user_id === state.me;
  const host = state.room.host === state.me;
  const taken = state.players.filter((p) => p.user_id !== seat.user_id && p.state === 'in').map((p) => p.character);
  return (
    <>
      <View style={s.ssh}>
        <Face slug={seat.character} size={u(32)} />
        <Text style={[s.h, { color: G.fg, fontSize: u(18) }]}>{self ? 'You' : seat.name}</Text>
      </View>
      {self ? (
        <>
          <Text style={[s.k, { color: G.mute }]}>YOUR CHARACTER</Text>
          <View style={s.faces}>
            {CHARACTERS.map((c) => {
              const used = taken.includes(c.slug);
              const on = c.slug === seat.character;
              return (
                <Pressable
                  key={c.slug}
                  disabled={used}
                  onPress={() => setCharacter(state.room.id, c.slug).then(onDone).catch(onDone)}
                  style={[s.face, { opacity: used ? 0.22 : 1, borderColor: on ? G.fg : 'transparent' }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: used }}
                  accessibilityLabel={c.name}>
                  <Face slug={c.slug} size={u(28)} />
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
      {host && teams >= 2 && state.room.status === 'lobby' ? (
        <>
          <Text style={[s.k, { color: G.mute }]}>TEAM</Text>
          <View style={s.chips}>
            {Array.from({ length: teams }, (_, i) => {
              const tm = presetTeam(i);
              const on = seat.team === i;
              return (
                <Pressable key={i} onPress={() => setTeam(state.room.id, seat.user_id, i).then(onDone).catch(onDone)} style={[s.chip, { borderColor: on ? tm.color : G.line }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Text style={[s.chipT, { color: on ? tm.color : G.mute }]}>{tm.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
      {!self ? <MuteRow room={state.room.id} seat={seat} /> : null}
      {host && !self && state.room.status === 'lobby' ? (
        <Pressable onPress={() => removePlayer(state.room.id, seat.user_id).then(onDone).catch(onDone)} style={s.remove} accessibilityRole="button">
          <Text style={[s.removeT]}>{`Remove ${seat.name} from the room`}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

/** ON12: mute a player on your phone only; their stickers and voice stop popping for you. */
function MuteRow({ room, seat }: { room: string; seat: Seat }) {
  const on = (useTalk((x) => x.muted[room]) ?? []).includes(seat.user_id);
  return (
    <Pressable onPress={() => toggleMute(room, seat.user_id)} style={[s.remove, { borderColor: G.line }]} accessibilityRole="button">
      <Text style={[s.removeT, { color: G.fg }]}>{on ? `Unmute ${seat.name}` : `Mute ${seat.name} (only for you)`}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  center: { fontFamily: F.body, fontSize: u(11.5), textAlign: 'center', marginTop: u(40) },
  h: { fontFamily: F.display, fontSize: u(21), lineHeight: u(25) },
  small: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(13) },
  k: { fontFamily: F.bodySemi, fontSize: u(8), letterSpacing: u(0.9) },
  tb: { flexDirection: 'row', justifyContent: 'space-between' },
  tbT: { fontFamily: F.body, fontSize: u(10.5) },
  rh: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  code: { fontFamily: F.display, fontSize: u(21), lineHeight: u(26), letterSpacing: u(0.3), fontVariant: ['tabular-nums'] },
  copy: { borderWidth: 1, borderColor: G.line, borderRadius: u(7), paddingVertical: u(2), paddingHorizontal: u(6) },
  copyT: { fontFamily: F.bodySemi, fontSize: u(9.5) },
  share: { borderWidth: 1, borderColor: G.line, backgroundColor: G.panel, borderRadius: u(10), paddingVertical: u(6), paddingHorizontal: u(10) },
  shareT: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  stl: { flexDirection: 'row', alignItems: 'center', gap: u(7), backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: u(9), paddingVertical: u(6), paddingHorizontal: u(9) },
  sd: { width: u(6), height: u(6), borderRadius: u(3) },
  stlT: { fontFamily: F.body, fontSize: u(10.5), flex: 1 },
  stlN: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8) },
  tile: { width: '31%', flexGrow: 1, maxWidth: '32.5%', backgroundColor: G.panel, borderWidth: 1, borderColor: G.line, borderRadius: u(13), paddingTop: u(11), paddingBottom: u(9), paddingHorizontal: u(5), alignItems: 'center', gap: u(2) },
  tileTight: { paddingTop: u(8), paddingBottom: u(7) },
  ring: { borderRadius: u(22), borderWidth: u(2.5), borderColor: G.panel, boxShadow: `0px 0px 0px 1px ${G.line}` },
  tn: { fontFamily: F.bodySemi, fontSize: u(11), marginTop: u(3) },
  tl: { fontFamily: F.body, fontSize: u(9) },
  rm: { position: 'absolute', top: u(6), right: u(8), fontFamily: F.bodyBold, fontSize: u(9) },
  empty: { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', minHeight: u(86) },
  plus: { fontFamily: F.body, fontSize: u(18), lineHeight: u(20) },
  tgh: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  tdot: { width: u(7), height: u(7), borderRadius: u(4) },
  tghT: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  tghN: { fontFamily: F.body, fontSize: u(9.5), marginLeft: 'auto' },
  sum: { flexDirection: 'row', alignItems: 'center', backgroundColor: G.panel, borderWidth: 1, borderColor: G.line, borderRadius: u(13), paddingVertical: u(9), paddingHorizontal: u(11) },
  sumT: { fontFamily: F.bodySemi, fontSize: u(11) },
  note: { fontFamily: F.body, fontSize: u(10), textAlign: 'center', marginTop: 'auto' },
  lbar: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  talk: { flexDirection: 'row', alignItems: 'center', gap: u(6), borderWidth: 1, borderColor: G.line, backgroundColor: G.panel, borderRadius: u(12), paddingVertical: u(6), paddingLeft: u(6), paddingRight: u(11) },
  talkT: { fontFamily: F.bodySemi, fontSize: u(11.5) },
  grow: { flex: 1 },
  mu: { position: 'absolute', top: u(6), left: u(8), fontSize: u(9) },
  bub: { position: 'absolute', top: u(-26), right: u(-8), zIndex: 3 },
  btn: { borderRadius: u(12), paddingVertical: u(11), alignItems: 'center' },
  btnT: { fontFamily: F.bodyBold, fontSize: u(12) },
  ghost: { backgroundColor: G.panel, borderWidth: 1, borderColor: G.line },
  step: { flexDirection: 'row', gap: u(8) },
  stepN: { fontFamily: F.mono, fontSize: u(10), lineHeight: u(16), width: u(10) },
  stepT: { flex: 1, fontFamily: F.body, fontSize: u(11), lineHeight: u(16) },
  optRow: { gap: u(5) },
  optL: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(5) },
  chip: { borderWidth: 1, borderColor: G.line, borderRadius: 999, paddingVertical: u(5), paddingHorizontal: u(10) },
  chipT: { fontFamily: F.bodySemi, fontSize: u(10) },
  ssh: { flexDirection: 'row', alignItems: 'center', gap: u(9) },
  faces: { flexDirection: 'row', flexWrap: 'wrap', gap: u(4) },
  face: { padding: 1, borderRadius: u(16), borderWidth: 2 },
  remove: { borderWidth: 1, borderColor: 'rgba(199,54,70,0.5)', borderRadius: u(12), paddingVertical: u(10), alignItems: 'center' },
  removeT: { fontFamily: F.bodySemi, fontSize: u(11), color: '#ff7a88' },
});
