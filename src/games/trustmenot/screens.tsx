// Trust Me Not's own versions of the shared joining screens (rule RS3), in the all-paper "Camp Ledger" look (locked
// 2026-10-07, preview pages 1 to 5): landing, sign-in notice, find or start a camp, and the lobby ("The camp is
// gathering"). Same logic as the shared screens: useLanding for Play, the room calls in src/online/api, the room
// state from useRoom.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { createRoom, JOIN_SAY, joinRoom, joinRoomId, leaveRoom, listPublicRooms, rematchRoom, setReady, startMatch, updateRoom, type JoinResult, type PublicRoom } from '@/online/api';
import { useRoom } from '@/online/useRoom';
import { useAccount } from '@/state/account';

import type { Mode } from '../engine/types';
import { useSession } from '../shell/session';
import type { GameDef, OwnScreens } from '../shell/types';
import { useLanding } from '../shell/useShellPages';
import { CRIMB, FELL, FELLI, p, Paper, PaperScreen, Portrait, T, TM } from './paper';
import { TMN_SEATS } from './seats';

/** Rule book §2: a camp holds 3 to 6 survivors. */
const MIN = 3;
const MAX = 6;

// ---------------------------------------------------------------- small parts

/** A page of this game: the month's village behind one sheet, at the preview's height or centred. */
function Page({ month, center, children }: { month: number; center?: boolean; children: ReactNode }) {
  return (
    <PaperScreen month={month}>
      <ScrollView
        contentContainerStyle={[s.page, center ? { justifyContent: 'center', paddingTop: p(20) } : { paddingTop: p(76) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </PaperScreen>
  );
}

const Kicker = ({ children }: { children: ReactNode }) => (
  <T f={FELL} size={10} style={s.kicker}>{children}</T>
);
const Title = ({ children }: { children: ReactNode }) => (
  <T f={FELL} size={21} style={{ lineHeight: p(24) }}>{children}</T>
);
const Note = ({ children, color }: { children: ReactNode; color?: string }) => (
  <T size={11} color={color} style={{ lineHeight: p(15), opacity: color ? 1 : 0.75 }}>{children}</T>
);

/** The ink button; `ghost` is the outlined one. */
function Btn({ label, onPress, ghost, off }: { label: string; onPress?: () => void; ghost?: boolean; off?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={off} style={[s.btn, ghost ? s.ghost : null, off ? { opacity: 0.5 } : null]} accessibilityRole="button" accessibilityLabel={label}>
      <T f={FELL} size={14} color={ghost ? TM.ink : TM.paper}>{label}</T>
    </Pressable>
  );
}

/** A dashed ink rule (drawn, so it is dashed on every platform). */
function Dash() {
  const [w, setW] = useState(0);
  return (
    <View style={{ height: 1 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w ? (
        <Svg width={w} height={1}>
          <Line x1={0} y1={0.5} x2={w} y2={0.5} stroke={TM.line} strokeWidth={1} strokeDasharray={`${p(3)} ${p(2.5)}`} />
        </Svg>
      ) : null}
    </View>
  );
}

/** Segmented choices, as in "Questions: Mixed | Clinical | Basic". Read-only when there is no onChange. */
function Seg<V extends string | number>({ choices, value, onChange }: { choices: { value: V; label: string }[]; value: V; onChange?: (v: V) => void }) {
  return (
    <View style={s.seg}>
      {choices.map((c) => {
        const on = c.value === value;
        return (
          <Pressable
            key={String(c.value)}
            disabled={!onChange}
            onPress={() => onChange?.(c.value)}
            style={[s.segI, on ? { backgroundColor: TM.ink } : null]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}>
            <T f={CRIMB} size={11} color={on ? TM.paper : TM.ink} style={{ lineHeight: p(14) }}>{c.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One setting line: label on the left, its control or value on the right. */
const Setting = ({ label, children }: { label: string; children: ReactNode }) => (
  <View style={s.set}>
    <T size={12}>{label}</T>
    {children}
  </View>
);

const questionsOf = (def: GameDef) => def.setup.online?.find((o) => o.key === 'mix');
const mixLabel = (def: GameDef, v: unknown) => questionsOf(def)?.choices.find((c) => c.value === v)?.label ?? 'Mixed';
const spaced = (code: string) => `${code.slice(0, 3)}·${code.slice(3)}`;

// ---------------------------------------------------------------- 01 landing

const RULES = [
  'Twelve months, four seasons. Answer 3-choice questions to feed the camp.',
  'In the Gap, buy food and cures, gift, lend and vote. Every vote is secret.',
  'Some players hold secret missions that work against the camp.',
  'Survive the year. The final reveal unmasks everyone.',
];

function Landing({ def }: { def: GameDef }) {
  const { go } = useLanding(def);
  const signedIn = !!useSession((x) => x.userId);
  return (
    <Page month={1}>
      <Paper seed="tmn-landing">
        <View style={s.gap}>
          <Kicker>MedNova Original</Kicker>
          <View>
            <T f={FELL} size={21} style={{ lineHeight: p(24) }}>Trust Me Not</T>
            <T f={FELLI} size={15} style={{ lineHeight: p(18), opacity: 0.85 }}>The Year of Hunger</T>
          </View>
          <T size={12.5} style={s.sub}>A starving camp, one shared jar and a year to survive it together, or not.</T>
          <Kicker>{`Online multiplayer · ${MIN} to ${MAX} players`}</Kicker>
          <View style={{ gap: p(6), marginTop: p(1), marginBottom: p(3) }}>
            {RULES.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: p(9) }}>
                <T f={FELL} size={14} color={TM.red} style={{ minWidth: p(14), lineHeight: p(19) }}>{String(i + 1)}</T>
                <T size={12} style={{ flex: 1, lineHeight: p(16.2) }}>{r}</T>
              </View>
            ))}
          </View>
          <Btn label="Find a camp" onPress={() => go('online')} />
          <View style={s.meta}>
            <T size={11} style={{ opacity: 0.8 }}>{signedIn ? 'Signed in' : 'Sign in to play'}</T>
            <T size={11} style={{ opacity: 0.8 }}>Questions: Mixed, Clinical or Basic</T>
          </View>
        </View>
      </Paper>
    </Page>
  );
}

// ---------------------------------------------------------------- 02 sign in

function Gate({ def }: { def: GameDef; mode: Mode }) {
  return (
    <Page month={2} center>
      <Paper seed="tmn-gate">
        <View style={s.gap}>
          <Kicker>Before you join the camp</Kicker>
          <Title>Sign the ledger</Title>
          <T size={12.5} style={s.sub}>Online games need an account, so the other survivors see your name and your results are kept.</T>
          <Btn label="Sign in" onPress={() => router.push('/auth')} />
          <Btn label="Back" ghost onPress={() => (router.canGoBack() ? router.back() : router.replace(`/play/${def.key}` as never))} />
        </View>
      </Paper>
    </Page>
  );
}

// ---------------------------------------------------------------- 03 + 04 find or start a camp

type Tab = 'open' | 'code' | 'start';
const TABS: { key: Tab; label: string; title: string }[] = [
  { key: 'open', label: 'Open camps', title: 'Find a camp' },
  { key: 'code', label: 'Join by code', title: 'Join by code' },
  { key: 'start', label: 'Start a camp', title: 'Start a camp' },
];

const lobbyOf = (def: GameDef, id: string) => router.replace(`/play/${def.key}/lobby?room=${id}`);

/** Online setup: the shared Join and Create (ON20), as three ledger tabs. */
function OnlineSetup({ def, prefill }: { def: GameDef; prefill?: Record<string, unknown> }) {
  const [tab, setTab] = useState<Tab>(prefill ? 'start' : 'open');
  return (
    <Page month={3}>
      <Paper seed="tmn-find">
        <View style={s.gap}>
          <Kicker>Trust Me Not · online</Kicker>
          <Title>{TABS.find((x) => x.key === tab)!.title}</Title>
          <View style={s.tabs}>
            {TABS.map((x) => {
              const on = x.key === tab;
              return (
                <Pressable key={x.key} onPress={() => setTab(x.key)} style={[s.tab, on ? { backgroundColor: TM.ink } : null]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                  <T f={FELL} size={12.5} color={on ? TM.paper : TM.ink} lines={1} style={{ lineHeight: p(16) }}>{x.label}</T>
                </Pressable>
              );
            })}
          </View>
          {tab === 'open' ? <OpenCamps def={def} /> : tab === 'code' ? <ByCode def={def} /> : <StartCamp def={def} prefill={prefill} />}
        </View>
      </Paper>
    </Page>
  );
}

/** A join attempt: on success go to the lobby, otherwise say why (JOIN_SAY). */
function useJoin(def: GameDef) {
  const avatar = useAccount((a) => a.profile?.avatar);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async (fn: (avatar?: string) => Promise<JoinResult>) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn(avatar);
      if ((r.result === 'joined' || r.result === 'spectating') && r.room_id) lobbyOf(def, r.room_id);
      else setMsg(JOIN_SAY[r.result] ?? JOIN_SAY.error);
    } catch {
      setMsg(JOIN_SAY.error);
    }
    setBusy(false);
  };
  return { msg, setMsg, busy, go };
}

function OpenCamps({ def }: { def: GameDef }) {
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);
  const { msg, busy, go } = useJoin(def);
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
  return (
    <View>
      {rooms && !rooms.length ? (
        <View style={{ paddingVertical: p(8) }}>
          <T size={12} style={{ opacity: 0.8 }}>No open camps right now. Start one from the Start a camp tab.</T>
        </View>
      ) : null}
      {(rooms ?? []).map((r, i) => {
        const full = r.players >= MAX;
        return (
          <View key={r.id}>
            <View style={s.camp}>
              <Portrait color={TMN_SEATS[i % TMN_SEATS.length]} health={100} size={30} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T f={FELL} size={16} lines={1} style={{ lineHeight: p(19) }}>{`${r.host_name}’s camp`}</T>
                <T size={10.5} style={{ opacity: 0.75, lineHeight: p(13) }}>{`${mixLabel(def, r.settings.mix)} · ${r.players} of ${MAX} signed`}</T>
              </View>
              <Pressable
                onPress={() => go((a) => joinRoomId(r.id, a))}
                disabled={full || busy}
                style={[s.join, full ? { opacity: 0.4 } : null]}
                accessibilityRole="button"
                accessibilityLabel={full ? `${r.host_name}’s camp is full` : `Join ${r.host_name}’s camp`}>
                <T f={FELL} size={13} style={{ lineHeight: p(16) }}>{full ? 'Full' : 'Join'}</T>
              </Pressable>
            </View>
            <Dash />
          </View>
        );
      })}
      {msg ? <View style={{ marginTop: p(6) }}><Note color={TM.red}>{msg}</Note></View> : null}
      <View style={{ marginTop: p(7) }}>
        <Note>Open camps anyone can join. Private camps need a code or an invite link.</Note>
      </View>
    </View>
  );
}

function ByCode({ def }: { def: GameDef }) {
  const [code, setCode] = useState('');
  const { msg, setMsg, busy, go } = useJoin(def);
  const type = (v: string) => {
    const c = v.replace(/\D/g, '').slice(0, 6);
    setCode(c);
    setMsg(null);
    if (c.length === 6) go((a) => joinRoom(c, a));
  };
  return (
    <View style={s.gap}>
      <TextInput
        value={code}
        onChangeText={type}
        keyboardType="number-pad"
        maxLength={6}
        editable={!busy}
        placeholder="Camp code"
        placeholderTextColor="rgba(42,31,22,0.45)"
        style={s.code}
        accessibilityLabel="Type a camp code"
      />
      {msg ? <Note color={TM.red}>{msg}</Note> : null}
      <Note>{busy ? 'Finding the camp…' : 'Type the 6 digits the host shared. You join as soon as the last one is in.'}</Note>
    </View>
  );
}

function StartCamp({ def, prefill }: { def: GameDef; prefill?: Record<string, unknown> }) {
  const avatar = useAccount((a) => a.profile?.avatar);
  const q = questionsOf(def);
  const [mix, setMix] = useState<string | number>((prefill?.mix as string | undefined) ?? q?.initial ?? 'mixed');
  const [pub, setPub] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const open = async () => {
    setBusy(true);
    setErr(false);
    try {
      lobbyOf(def, await createRoom(def.key, { mix }, pub === 1, avatar));
    } catch {
      setErr(true);
      setBusy(false);
    }
  };
  return (
    <View style={s.gap}>
      {q ? (
        <Setting label={q.label}>
          <Seg choices={q.choices} value={mix} onChange={setMix} />
        </Setting>
      ) : null}
      <Setting label="Who can join">
        <Seg choices={[{ value: 1, label: 'Open' }, { value: 0, label: 'Private' }]} value={pub} onChange={setPub} />
      </Setting>
      <Note color={err ? TM.red : undefined}>
        {err ? JOIN_SAY.error : `You can start the year once ${MIN} have signed. ${MAX} at most. You get a camp code and an invite link to share.`}
      </Note>
      <Btn label={busy ? 'Opening the sheet…' : 'Open the sign-up sheet'} onPress={open} off={busy} />
    </View>
  );
}

// ---------------------------------------------------------------- 05 lobby

/** The shared lobby's logic (ON16) on a sign-up sheet: the camp code, everyone who signed, Questions, and Start the year. */
function Lobby({ def, roomId }: { def: GameDef; roomId: string }) {
  const { state, error, reload } = useRoom(roomId);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const went = useRef(false);
  const room = state?.room;
  const me = state?.me;
  const players = useMemo(() => (state?.players ?? []).filter((x) => x.state === 'in'), [state]);
  const watching = (state?.players ?? []).filter((x) => x.state === 'spectator');
  const mine = players.find((x) => x.user_id === me);
  const host = !!room && room.host === me;

  // The match has begun: everyone in the room moves to the live screen.
  useEffect(() => {
    if (!room || went.current) return;
    if (room.status === 'playing' && room.match_id) {
      went.current = true;
      router.replace(`/play/${def.key}/live?room=${room.id}&match=${room.match_id}`);
    }
  }, [room, def.key]);

  // Signing the sheet is being ready: there is no separate Ready step here, so each phone marks its own seat ready
  // (again after the host changes the questions, which un-readies everyone).
  useEffect(() => {
    if (room?.status === 'lobby' && mine && !mine.ready) setReady(room.id, true).catch(() => {});
  }, [room?.status, room?.id, mine]);

  const leave = async () => {
    await leaveRoom(roomId).catch(() => {});
    router.replace(`/play/${def.key}`);
  };

  if (!state || state.result !== 'ok' || !room || room.status === 'closed') {
    return (
      <Page month={1} center>
        <Paper seed="tmn-lobby-gone">
          <View style={s.gap}>
            <Kicker>Trust Me Not · The Year of Hunger</Kicker>
            <Title>{!state ? (error ? 'The road is cut' : 'Finding the camp…') : room?.status === 'closed' ? 'This camp has broken up' : 'You are not in this camp'}</Title>
            {!state && !error ? null : (
              <>
                <T size={12.5} style={s.sub}>
                  {!state ? 'Couldn’t reach the camp. Check your connection.' : 'Camps break up when everyone leaves, or after 15 minutes without a start.'}
                </T>
                <Btn label="Back to the game" onPress={() => router.replace(`/play/${def.key}`)} />
              </>
            )}
          </View>
        </Paper>
      </Page>
    );
  }

  const q = questionsOf(def);
  const mix = (room.settings.mix as string | undefined) ?? q?.initial ?? 'mixed';
  const share = () => Share.share({ message: `Join my camp in Trust Me Not on MedNova. Camp code: ${room.code}` }).catch(() => {});
  const setMix = (v: string | number) => updateRoom(room.id, { ...room.settings, mix: v }, room.is_public).then(reload).catch(() => {});
  const start = async () => {
    setBusy(true);
    setFailed(false);
    await startMatch(room.id).catch(() => setFailed(true));
    await reload();
    setBusy(false);
  };
  const enough = players.length >= MIN;
  const finished = room.status === 'finished';

  return (
    <Page month={1} center>
      <Paper seed="tmn-lobby">
        <View style={s.gap}>
          <Kicker>Trust Me Not · The Year of Hunger</Kicker>
          <Title>The camp is gathering</Title>
          <Pressable onPress={share} style={s.codeRow} accessibilityRole="button" accessibilityLabel={`Camp code ${room.code.split('').join(' ')}. Share it`}>
            <T size={11} style={{ opacity: 0.75 }}>Camp code</T>
            <T f={FELL} size={20} color={TM.red} style={{ letterSpacing: p(1.6), lineHeight: p(24) }}>{spaced(room.code)}</T>
          </Pressable>
          <View style={{ marginTop: p(-3) }}>
            {players.map((x, i) => (
              <View key={x.user_id}>
                <View style={s.sign}>
                  <Portrait color={TMN_SEATS[i % TMN_SEATS.length]} health={100} size={24} />
                  <T f={FELLI} size={18} lines={1} style={{ flex: 1, lineHeight: p(22) }}>{x.user_id === me ? 'You' : x.name}</T>
                  {x.user_id === room.host ? <T size={10} color={TM.red}>host</T> : null}
                </View>
                <Dash />
              </View>
            ))}
            {players.length < MAX ? (
              <Pressable onPress={share} accessibilityRole="button" accessibilityLabel="Invite a player">
                <View style={s.sign}>
                  <T f={FELLI} size={18} style={{ flex: 1, lineHeight: p(22), opacity: 0.4 }}>sign here…</T>
                </View>
                <Dash />
              </Pressable>
            ) : null}
          </View>
          {q ? (
            <Setting label={q.label}>
              <Seg choices={q.choices} value={mix} onChange={host && !finished ? setMix : undefined} />
            </Setting>
          ) : null}
          <Setting label="Players">
            <T f={CRIMB} size={12}>{`${players.length} of ${MAX} · ${MIN} needed`}</T>
          </Setting>
          {watching.length ? <Note>{`Watching: ${watching.map((x) => x.name).join(', ')}. They sign in for the next year.`}</Note> : null}
          {failed ? <Note color={TM.red}>The year could not start. Try again in a moment.</Note> : null}
          {finished ? (
            <Btn label="Back to the sign-up sheet" onPress={() => rematchRoom(room.id).then(reload).catch(() => {})} />
          ) : host ? (
            <Btn label={busy ? 'Starting…' : enough ? 'Start the year' : `Start the year · ${MIN - players.length} more to sign`} onPress={start} off={!enough || busy} />
          ) : (
            <Btn label={enough ? 'The host starts the year' : `Waiting for ${MIN - players.length} more`} ghost off />
          )}
          <View style={s.meta}>
            <Pressable onPress={leave} hitSlop={p(8)} accessibilityRole="button">
              <T size={11} style={{ opacity: 0.8 }}>‹ Leave the camp</T>
            </Pressable>
            <Pressable onPress={share} hitSlop={p(8)} accessibilityRole="button">
              <T size={11} color={TM.red}>Share the code</T>
            </Pressable>
          </View>
        </View>
      </Paper>
    </Page>
  );
}

export const TMN_SCREENS: OwnScreens = { Landing, Gate, OnlineSetup, Lobby };

const s = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: p(12), paddingBottom: p(28) },
  gap: { gap: p(7) },
  kicker: { textTransform: 'uppercase', letterSpacing: p(0.6), opacity: 0.75, lineHeight: p(13) },
  sub: { lineHeight: p(17.3), opacity: 0.85 },
  btn: { backgroundColor: TM.ink, paddingVertical: p(10), alignItems: 'center', borderWidth: 1, borderColor: TM.ink },
  ghost: { backgroundColor: 'transparent', paddingVertical: p(9) },
  meta: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(42,31,22,0.25)', paddingTop: p(7) },
  tabs: { flexDirection: 'row', borderWidth: 1, borderColor: TM.ink },
  tab: { flex: 1, alignItems: 'center', paddingVertical: p(6), paddingHorizontal: p(2) },
  camp: { flexDirection: 'row', alignItems: 'center', gap: p(10), paddingVertical: p(8) },
  join: { borderWidth: 1, borderColor: TM.ink, paddingVertical: p(3), paddingHorizontal: p(10) },
  set: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seg: { flexDirection: 'row', borderWidth: 1, borderColor: TM.line },
  segI: { paddingVertical: p(3), paddingHorizontal: p(9) },
  code: {
    fontFamily: FELL, fontSize: p(22), letterSpacing: p(2.6), color: TM.ink, paddingVertical: p(4), paddingHorizontal: p(2),
    borderBottomWidth: 1, borderBottomColor: TM.ink,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: p(8), borderTopWidth: 1, borderBottomWidth: 1, borderColor: TM.line },
  sign: { flexDirection: 'row', alignItems: 'center', gap: p(10), paddingVertical: p(4) },
});
