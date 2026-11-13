import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { LevelBadge } from '@/components/LevelBadge';
import { Sheet } from '@/components/Sheet';
import { PlayerFace } from '@/features/style/Frame';
import { engine, type Play, type Seat } from '@/games/engine';
import { presetTeam } from '@/games/shell/teams';
import type { GameDef } from '@/games/shell/types';
import { GameScreen } from '@/games/shell/ui';
import { safeEnter } from '@/lib/enter';
import { sfx } from '@/lib/sound';
import { settingsLine } from '@/match/format';
import { G } from '@/match/grey';
import { GREY_LOOK, useRoomLook } from '@/match/look';
import { TalkBubble, TalkPanel } from '@/match/TalkBar';
import { sayAsBot, toggleMute, useTalk, useTalkRoom } from '@/match/talk';
import { useAccount } from '@/state/account';
import { TABLET, u } from '@/theme/scale';
import { F, THEMES } from '@/theme/tokens';

import { addBot, swapBot } from './core';
import { rivalMoment, useRivalEars } from './director';
import { grownLevel, loadRivals, rivalOf, toggleFav, useRivals } from './memory';
import { revengeLine } from './revenge';
import { joinMs, readyMs } from './roomTalk';
import { seatsFor } from './setup';
import { LEVEL_NAME, TYPE_NAME, type Bot, type BotLevel, type BotType } from './types';
import { tr } from '@/i18n';

/** Where a bot is in the room: walking in, sitting down, ready, or leaving after a kick. */
type Phase = 'away' | 'in' | 'ready' | 'leaving';
type Sheet_ = 'how' | 'talk' | { add: number | undefined } | { bot: Bot } | null;

const BLURB: Record<BotType, string> = {
  freshman: tr('Means well, guesses a lot. Slow, clumsy and fun to beat.'),
  scholar: tr('Steady and careful. Rarely brilliant, rarely lost.'),
  genius: tr('Fast and sharp, and likes you to know it. Beatable, just.'),
};

/** The Vs bots room (Yazan 2026-11-09): the old lobby kept for bots. They join one by one, get ready and talk. */
export function BotRoom({ def, play, left }: { def: GameDef; play: Play; left?: string }) {
  const L = GREY_LOOK;
  const room = `bot:${play.id}`;
  useTalkRoom(room);
  const profile = useAccount((a) => a.profile);
  const me = { id: profile?.id ?? 'me', name: profile?.display_name ?? tr('You'), face: profile?.avatar ?? 'yara' };
  const pops = useTalk((x) => x.pops);
  const muted = useTalk((x) => x.muted[room]) ?? [];

  const level = (play.settings.botLevel as BotLevel) ?? 'medium';
  const max = def.bots?.max ?? 3;
  const teams = Array.isArray(play.settings.teams) ? play.settings.teams.length : 0;
  const [seats, setSeatsState] = useState<Seat[]>(play.seats);
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const [sheet, setSheet] = useState<Sheet_>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (ms: number, fn: () => void) => void timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const bots = seats.filter((x) => x.bot && !x.removed);
  const seatsRef = useRef(seats);
  useEffect(() => {
    seatsRef.current = seats;
  }, [seats]);
  const favs = useRivals((x) => x.favs);
  const met = useRivals((x) => x.met);
  useEffect(() => void loadRivals(), []);
  const save = (next: Seat[]) => {
    setSeatsState(next);
    void engine.recorder.setSeats(play.id, next);
  };

  /** A bot walks in (join sound), sits a moment, then is ready and may say so. */
  const arrive = (b: Bot, wait: number) => {
    later(wait, () => {
      setPhase((p) => ({ ...p, [b.id]: 'in' }));
      void sfx('tap');
      later(readyMs(b), () => {
        setPhase((p) => (p[b.id] === 'in' ? { ...p, [b.id]: 'ready' } : p));
        // G6: a rival with a record against you greets you with a revenge line instead of its usual hello.
        const grudge = revengeLine(useRivals.getState().record[b.id], `${play.id}:${b.id}`);
        if (grudge) sayAsBot(room, { user_id: b.id, name: b.name, face: b.character, kind: 'line', item: grudge });
        else rivalMoment(room, b, 'ready', { tableSize: seatsRef.current.filter((x) => x.bot).length });
      });
    });
  };

  // Yazan's pick: bots join one by one over 2 to 5 seconds, each at its own pace.
  useEffect(() => {
    let at = 400;
    for (const x of play.seats) {
      if (!x.bot || x.removed) continue;
      at += joinMs(x.bot);
      arrive(x.bot, Math.min(at, 5000));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const leavingRef = useRef(new Set<string>());
  const seen = useRef(new Set<string>());
  const gone = (id: string) => {
    if (!leavingRef.current.delete(id)) return;
    seen.current.delete(id);
    setPhase((p) => ({ ...p, [id]: 'away' }));
    setSeatsState((cur) => {
      const next = cur.filter((x) => x.bot?.id !== id).map((x, i) => ({ ...x, seat: i }));
      void engine.recorder.setSeats(play.id, next);
      return next;
    });
  };

  // A kicked bot says its piece first, then leaves once its bubble has had its moment (6 s at most).
  const leavingIds = Object.keys(phase).filter((k) => phase[k] === 'leaving');
  useEffect(() => {
    for (const id of leavingIds) {
      const on = pops.some((m) => m.user_id === id);
      if (on) seen.current.add(id);
      else if (seen.current.has(id)) gone(id);
    }
  }, [pops, leavingIds.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const live = bots.filter((x) => phase[x.bot!.id] !== 'leaving');
  const kick = (b: Bot) => {
    if (live.length <= 1) return;
    setSheet(null);
    leavingRef.current.add(b.id);
    setPhase((p) => ({ ...p, [b.id]: 'leaving' }));
    rivalMoment(room, b, 'kicked');
    later(6000, () => gone(b.id));
  };
  const taken = () => [me.name, ...bots.map((x) => x.bot!.name)];
  /** Favourites not already at the table, to bring back with "Add a favourite". */
  const freeFavs = favs.map(rivalOf).filter((b): b is Bot => !!b && !bots.some((x) => x.bot!.id === b.id));
  const tapAdd = (team?: number) => (freeFavs.length ? setSheet({ add: team }) : add(team));
  const add = (team?: number, fav?: Bot) => {
    setSheet(null);
    if (live.length >= max) return;
    const b = fav ?? addBot(level, taken());
    const next = [...seats, { seat: seats.length, name: b.name, character: b.character, bot: b, color: '', team }];
    save(recolour(next, teams));
    arrive(b, 300);
  };
  const swap = (old: Bot) => {
    setSheet(null);
    const b = swapBot(old, taken());
    save(recolour(seats.map((x) => (x.bot?.id === old.id ? { ...x, name: b.name, character: b.character, bot: b } : x)), teams));
    arrive(b, 500);
  };

  const ready = live.filter((x) => phase[x.bot!.id] === 'ready');
  // Rivals hear your stickers and voice lines; one answers for the room (G3).
  useRivalEars(room, ready.map((x) => x.bot!));
  const allReady = live.length > 0 && ready.length === live.length;
  const waitingOn = live.find((x) => phase[x.bot!.id] !== 'ready');
  const joining = live.filter((x) => !phase[x.bot!.id] || phase[x.bot!.id] === 'away').length;
  // After a rematch: who left, for the first moments while the new rivals walk in.
  const [leftNote, setLeftNote] = useState(left ?? null);
  useEffect(() => {
    if (!left) return;
    const id = setTimeout(() => setLeftNote(null), 6000);
    return () => clearTimeout(id);
  }, [left]);
  const status = leftNote ? tr('{leftNote} left. {n}', { leftNote, n: joining ? tr('New rivals are joining…') : tr('New rivals are in.') }) : allReady ? tr('Everyone is ready') : joining ? (joining === 1 ? tr('A rival is joining…') : tr('{joining} rivals are joining…', { joining })) : tr('Waiting for {n}', { n: waitingOn?.name ?? tr('the rivals') });
  const canPlay = !!def.Play.bots;

  const leave = async () => {
    await engine.recorder.discard(play.id).catch(() => {});
    router.replace(`/play/${def.key}`);
  };
  const start = () => router.replace(`/play/${def.key}/run?play=${play.id}`);

  const you = seats.find((x) => !x.bot)!;
  const tile = (x: Seat) => {
    const b = x.bot;
    const ph = b ? phase[b.id] : 'ready';
    if (b && (!ph || ph === 'away')) return <View key={x.bot!.id} style={[st.tile, st.empty, teams >= 2 && st.tight]}><Text style={[st.tl, { color: G.dim }]}>{tr('Joining…')}</Text></View>;
    const id = b?.id ?? me.id;
    const said = pops.find((m) => m.user_id === id);
    const label = !b ? tr('♛ Host') : ph === 'leaving' ? tr('Leaving…') : ph === 'ready' ? tr('✓ Ready') : tr('Getting ready');
    return (
      <Animated.View key={id} entering={safeEnter(ZoomIn.springify().damping(15))} exiting={FadeOut.duration(250)} style={[st.tile, teams >= 2 && st.tight, ph === 'leaving' && { opacity: 0.5 }]}>
        <Pressable onPress={() => b && ph !== 'leaving' && setSheet({ bot: b })} style={st.tileIn} accessibilityRole="button" accessibilityLabel={`${b ? b.name : tr('You')}, ${label}`}>
          <View>
            <View style={st.ring}>
              {b ? <PlayerFace slug={b.character} size={u(38)} /> : <PlayerFace slug={me.face} size={u(38)} userId={profile?.id} />}
            </View>
            {b ? (
              <View style={st.lvl}>
                <LevelBadge level={grownLevel(b, met)} size={u(16)} edge={G.panel} />
              </View>
            ) : null}
          </View>
          <Text style={[st.tn, { color: G.fg }]} numberOfLines={1}>{b ? b.name : tr('You')}</Text>
          <Text style={[st.tl, { color: ph === 'ready' && b ? G.ok : G.mute }, ph === 'ready' && b && { fontFamily: F.bodySemi }]}>{label}</Text>
          {b && muted.includes(b.id) ? <Text style={[st.mu, { color: G.dim }]}>🔇</Text> : null}
        </Pressable>
        {said ? (
          <View style={st.bub} pointerEvents="none">
            <TalkBubble m={said} size={50} />
          </View>
        ) : null}
      </Animated.View>
    );
  };
  const adds = (n: number, team?: number) =>
    Array.from({ length: Math.max(0, n) }, (_, i) => (
      <Pressable key={`add${team ?? ''}${i}`} onPress={() => tapAdd(team)} style={[st.tile, st.empty, teams >= 2 && st.tight]} accessibilityRole="button" accessibilityLabel={tr('Add a rival')}>
        <Text style={[st.plus, { color: G.dim }]}>+</Text>
        <Text style={[st.tl, { color: G.dim }]}>{tr('Add rival')}</Text>
      </Pressable>
    ));
  const free = max - live.length;
  const shown = seats.filter((x) => !x.removed);

  return (
    <GameScreen
      top={
        <>
          <Sheet tone={{ bg: L.raised, line: L.line }} open={sheet === 'how'} onClose={() => setSheet(null)}>
            <HowTo def={def} />
          </Sheet>
          <Sheet tone={{ bg: L.raised, line: L.line }} open={sheet === 'talk'} onClose={() => setSheet(null)}>
            {sheet === 'talk' ? <TalkPanel room={room} me={me} onSent={() => setSheet(null)} /> : null}
          </Sheet>
          <Sheet tone={{ bg: L.raised, line: L.line }} open={!!sheet && typeof sheet === 'object'} onClose={() => setSheet(null)}>
            {sheet && typeof sheet === 'object' && 'bot' in sheet ? (
              <BotSheet bot={sheet.bot} level={grownLevel(sheet.bot, met)} fav={favs.includes(sheet.bot.id)} room={room} canKick={live.length > 1} onSwap={() => swap(sheet.bot)} onKick={() => kick(sheet.bot)} />
            ) : sheet && typeof sheet === 'object' && 'add' in sheet ? (
              <AddSheet favs={freeFavs} met={met} onPick={(b) => add(sheet.add, b)} />
            ) : null}
          </Sheet>
        </>
      }
      under={<View style={[StyleSheet.absoluteFill, { backgroundColor: G.page }]} />}
      bodyStyle={{ paddingTop: u(12), gap: u(11), flexGrow: 1 }}>
      <View style={st.tb}>
        <Pressable onPress={leave} hitSlop={u(8)} accessibilityRole="button">
          <Text style={[st.tbT, { color: G.acc }]}>{tr('‹ Leave room')}</Text>
        </Pressable>
        <Pressable onPress={() => setSheet('how')} hitSlop={u(8)} accessibilityRole="button">
          <Text style={[st.tbT, { color: G.acc, fontFamily: F.bodySemi }]}>{tr('How to play')}</Text>
        </Pressable>
      </View>
      <View>
        <Text style={[st.k, { color: G.mute }]}>{tr('VS RIVALS · MOSTLY {toUpperCase}', { toUpperCase: tr(LEVEL_NAME[level]).toUpperCase() })}</Text>
        <Text style={[st.h, { color: G.fg }]}>{tr('Your room')}</Text>
      </View>
      <View style={st.stl}>
        <View style={[st.sd, { backgroundColor: allReady ? G.ok : G.amber }]} />
        <Text style={[st.stlT, { color: G.mute }]}>{status}</Text>
        <Text style={[st.stlN, { color: G.fg }]}>{`${live.length + 1} / ${max + 1}`}</Text>
      </View>

      {teams >= 2 ? (
        Array.from({ length: teams }, (_, i) => {
          const tm = presetTeam(i);
          const list = shown.filter((x) => x.team === i);
          // Free seats shared out: each team is offered up to its fair share, never more than the room has left.
          const fair = Math.ceil((max + 1) / teams);
          const offered = (j: number) => Math.max(0, fair - shown.filter((x) => x.team === j).length);
          const before = Array.from({ length: i }, (_, j) => offered(j)).reduce((a, c) => a + c, 0);
          const room_ = Math.max(0, Math.min(offered(i), free - before));
          return (
            <View key={i} style={{ gap: u(6) }}>
              <View style={st.tgh}>
                <View style={[st.tdot, { backgroundColor: tm.color }]} />
                <Text style={[st.tghT, { color: G.fg }]}>{i === you.team ? tr('{name} · your team', { name: tm.name }) : tm.name}</Text>
                <Text style={[st.tghN, { color: G.dim }]}>{list.length === 1 ? tr('1 player') : tr('{n} players', { n: list.length })}</Text>
              </View>
              <View style={st.tiles}>
                {list.map(tile)}
                {adds(room_, i)}
              </View>
            </View>
          );
        })
      ) : (
        <View style={st.tiles}>
          {shown.map(tile)}
          {adds(free)}
        </View>
      )}

      <View style={st.sum}>
        <View style={{ gap: u(2), flex: 1 }}>
          <Text style={[st.k, { color: G.mute }]}>{tr('SETTINGS')}</Text>
          <Text style={[st.sumT, { color: G.fg }]}>{[settingsLine(def, play.settings), tr('Mostly {n}', { n: tr(LEVEL_NAME[level]) })].filter(Boolean).join(' · ')}</Text>
        </View>
      </View>

      <Text style={[st.note, { color: G.dim }]}>
        {canPlay ? tr('Tap a rival to see its profile, swap it or kick it.') : tr('Tap a rival to see its profile, swap it or kick it. Rival matches come in the next build step.')}
      </Text>
      <View style={[st.lbar, TABLET && st.lbarTab]}>
        <Pressable onPress={() => setSheet('talk')} style={st.talk} accessibilityRole="button" accessibilityLabel={tr('Talk: stickers and voice')}>
          <PlayerFace slug={me.face} size={u(20)} userId={profile?.id} still />
          <Text style={[st.talkT, { color: G.fg }]}>{tr('Talk')}</Text>
        </Pressable>
        <GBtn style={st.grow} label={!canPlay ? tr('Start · coming soon') : allReady ? tr('Start') : tr('Start · {n} of {n2} ready', { n: ready.length, n2: live.length })} off={!allReady || !canPlay} onPress={start} />
      </View>
    </GameScreen>
  );
}

/** Seat numbers in order, and colours: team colours with teams, else the 8 seat colours (seatsFor's rule). */
function recolour(seats: Seat[], teams: number): Seat[] {
  const you = seats.find((x) => !x.bot)!;
  const bots = seats.filter((x) => x.bot).map((x) => x.bot!);
  const fresh = seatsFor(bots, you.character, teams);
  return fresh.map((x, i) => ({ ...x, team: teams >= 2 ? (seats[i].team ?? x.team) : undefined, color: teams >= 2 ? presetTeam(seats[i].team ?? x.team ?? 0).color : x.color }));
}

function GBtn({ label, onPress, off, style }: { label: string; onPress?: () => void; off?: boolean; style?: object }) {
  const L = useRoomLook();
  return (
    <Pressable onPress={onPress} disabled={off} style={[st.btn, { backgroundColor: off ? L.btnOff : L.btn }, style]} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[st.btnT, { color: off ? '#b9bcc3' : L.onBtn }]}>{label}</Text>
    </Pressable>
  );
}

function HowTo({ def }: { def: GameDef }) {
  const L = useRoomLook();
  const steps = def.modes.find((m) => m.mode === 'bots')?.howTo ?? [];
  return (
    <>
      <Text style={[st.k, { fontFamily: L.semi, color: L.mute }]}>{tr('HOW TO PLAY VS RIVALS')}</Text>
      {steps.map((x, i) => (
        <View key={i} style={st.step}>
          <Text style={[st.stepN, { fontFamily: L.mono, color: L.dim }]}>{i + 1}</Text>
          <Text style={[st.stepT, { fontFamily: L.body, color: L.fg }]}>{x}</Text>
        </View>
      ))}
    </>
  );
}

/** Tap a bot: its profile (with the AI tag, Yazan's pick), then Swap, Mute and Kick (never the last bot). */
function BotSheet({ bot, level, fav, room, canKick, onSwap, onKick }: { bot: Bot; level: number; fav: boolean; room: string; canKick: boolean; onSwap: () => void; onKick: () => void }) {
  const L = useRoomLook();
  const muted = (useTalk((x) => x.muted[room]) ?? []).includes(bot.id);
  return (
    <>
      <View style={st.ssh}>
        <View>
          <PlayerFace slug={bot.character} size={u(52)} />
          <View style={st.lvl}>
            <LevelBadge level={level} size={u(18)} edge={L.raised} />
          </View>
        </View>
        <View style={{ flexShrink: 1, gap: u(3) }}>
          <View style={st.nameRow}>
            <Text style={[st.h, { fontFamily: L.head, color: L.fg, fontSize: u(18) }]}>{bot.name}</Text>
            {/* Favourites (Yazan 2026-11-09): star a rival to bring it back later with Add a favourite. */}
            <Pressable onPress={() => toggleFav(bot)} hitSlop={u(10)} accessibilityRole="button" accessibilityLabel={fav ? tr('Remove {name} from favourites', { name: bot.name }) : tr('Save {name} as a favourite', { name: bot.name })}>
              <Text style={[st.star, { color: fav ? L.amber : L.dim }]}>{fav ? '★' : '☆'}</Text>
            </Pressable>
          </View>
          <View style={st.tags}>
            <View style={[st.ai, { borderColor: L.acc }]}>
              <Text style={[st.aiT, { color: L.acc }]}>{tr('AI player')}</Text>
            </View>
            <Text style={[st.small, { color: L.mute }]}>{tr(TYPE_NAME[bot.type])}</Text>
          </View>
        </View>
      </View>
      <Text style={[st.small, { color: L.mute }]}>{BLURB[bot.type]}</Text>
      <Pressable onPress={onSwap} style={[st.row, { borderColor: L.line }]} accessibilityRole="button">
        <Text style={[st.rowT, { color: L.fg }]}>{tr('Swap for another {n}', { n: tr(TYPE_NAME[bot.type]) })}</Text>
      </Pressable>
      <Pressable onPress={() => toggleMute(room, bot.id)} style={[st.row, { borderColor: L.line }]} accessibilityRole="button">
        <Text style={[st.rowT, { color: L.fg }]}>{muted ? tr('Unmute {name}', { name: bot.name }) : tr('Mute {name}', { name: bot.name })}</Text>
      </Pressable>
      {canKick ? (
        <Pressable onPress={onKick} style={st.row} accessibilityRole="button">
          <Text style={[st.rowT, { color: THEMES.dark.error }]}>{tr('Kick {name}', { name: bot.name })}</Text>
        </Pressable>
      ) : (
        <Text style={[st.small, { color: L.dim, textAlign: 'center' }]}>{tr('A room keeps at least one rival.')}</Text>
      )}
    </>
  );
}

/** Add a rival: one of your favourites, or anyone. */
function AddSheet({ favs, met, onPick }: { favs: Bot[]; met: Record<string, number>; onPick: (b?: Bot) => void }) {
  const L = useRoomLook();
  return (
    <>
      <Text style={[st.k, { fontFamily: L.semi, color: L.mute }]}>{tr('ADD A FAVOURITE')}</Text>
      {favs.map((b) => (
        <Pressable key={b.id} onPress={() => onPick(b)} style={[st.favRow, { borderColor: L.line }]} accessibilityRole="button" accessibilityLabel={tr('Add {name}', { name: b.name })}>
          <View>
            <PlayerFace slug={b.character} size={u(34)} />
            <View style={st.lvl}>
              <LevelBadge level={grownLevel(b, met)} size={u(14)} edge={L.raised} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.rowT, { color: L.fg }]}>{b.name}</Text>
            <Text style={[st.small, { color: L.mute }]}>{tr(TYPE_NAME[b.type])}</Text>
          </View>
          <Text style={[st.star, { color: L.amber }]}>★</Text>
        </Pressable>
      ))}
      <Pressable onPress={() => onPick()} style={[st.row, { borderColor: L.line }]} accessibilityRole="button">
        <Text style={[st.rowT, { color: L.fg }]}>{tr('Any rival')}</Text>
      </Pressable>
    </>
  );
}

const st = StyleSheet.create({
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  star: { fontSize: u(18), lineHeight: u(22) },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: u(10), borderWidth: 1, borderRadius: u(12), paddingVertical: u(8), paddingHorizontal: u(10) },
  h: { fontFamily: F.display, fontSize: u(21), lineHeight: u(25) },
  small: { fontFamily: F.body, fontSize: u(10), lineHeight: u(14) },
  k: { fontFamily: F.bodySemi, fontSize: u(8), letterSpacing: u(0.9) },
  tb: { flexDirection: 'row', justifyContent: 'space-between' },
  tbT: { fontFamily: F.body, fontSize: u(10.5) },
  stl: { flexDirection: 'row', alignItems: 'center', gap: u(7), backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: u(9), paddingVertical: u(6), paddingHorizontal: u(9) },
  sd: { width: u(6), height: u(6), borderRadius: u(3) },
  stlT: { fontFamily: F.body, fontSize: u(10.5), flex: 1 },
  stlN: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8) },
  tile: { width: '31%', flexGrow: 1, maxWidth: '32.5%', backgroundColor: G.panel, borderWidth: 1, borderColor: G.line, borderRadius: u(13), minHeight: u(92) },
  tileIn: { paddingTop: u(11), paddingBottom: u(9), paddingHorizontal: u(5), alignItems: 'center', gap: u(2) },
  tight: { minHeight: u(84) },
  ring: { borderRadius: u(22), borderWidth: u(2.5), borderColor: G.panel, boxShadow: tr('0px 0px 0px 1px {line}', { line: G.line }) },
  tn: { fontFamily: F.bodySemi, fontSize: u(11), marginTop: u(3), maxWidth: '100%' },
  lvl: { position: 'absolute', end: -u(5), bottom: -u(3) },
  tl: { fontFamily: F.body, fontSize: u(9) },
  empty: { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' },
  plus: { fontFamily: F.body, fontSize: u(18), lineHeight: u(20) },
  mu: { position: 'absolute', top: u(6), start: u(8), fontSize: u(9) },
  bub: { position: 'absolute', top: u(-26), end: u(-8), zIndex: 3 },
  tgh: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  tdot: { width: u(7), height: u(7), borderRadius: u(4) },
  tghT: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  tghN: { fontFamily: F.body, fontSize: u(9.5), marginStart: 'auto' },
  sum: { flexDirection: 'row', alignItems: 'center', backgroundColor: G.panel, borderWidth: 1, borderColor: G.line, borderRadius: u(13), paddingVertical: u(9), paddingHorizontal: u(11) },
  sumT: { fontFamily: F.bodySemi, fontSize: u(11) },
  note: { fontFamily: F.body, fontSize: u(10), textAlign: 'center', marginTop: 'auto' },
  lbar: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  // tablet: Talk and Start keep the phone's width, centred (Yazan 2026-11-12)
  lbarTab: { width: '100%', maxWidth: u(300), alignSelf: 'center' },
  talk: { flexDirection: 'row', alignItems: 'center', gap: u(6), borderWidth: 1, borderColor: G.line, backgroundColor: G.panel, borderRadius: u(12), paddingVertical: u(6), paddingStart: u(6), paddingEnd: u(11) },
  talkT: { fontFamily: F.bodySemi, fontSize: u(11.5) },
  grow: { flex: 1 },
  btn: { borderRadius: u(12), paddingVertical: u(11), alignItems: 'center' },
  btnT: { fontFamily: F.bodyBold, fontSize: u(12) },
  step: { flexDirection: 'row', gap: u(8) },
  stepN: { fontSize: u(10), lineHeight: u(16), width: u(10) },
  stepT: { flex: 1, fontSize: u(11), lineHeight: u(16) },
  ssh: { flexDirection: 'row', alignItems: 'center', gap: u(11) },
  tags: { flexDirection: 'row', alignItems: 'center', gap: u(7) },
  ai: { borderWidth: 1, borderRadius: 999, paddingVertical: u(1.5), paddingHorizontal: u(7) },
  aiT: { fontFamily: F.bodySemi, fontSize: u(9) },
  row: { borderWidth: 1, borderColor: 'rgba(199,54,70,0.5)', borderRadius: u(12), paddingVertical: u(10), alignItems: 'center' },
  rowT: { fontFamily: F.bodySemi, fontSize: u(11) },
});
