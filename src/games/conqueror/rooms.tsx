// The Conqueror's own pages after the landing (Yazan 2026-10-18): sign-in gate, join or declare a war, the war council
// lobby and the chronicle at the end, all in the Ink Atlas look over the same room and art as the landing. The steps
// are the shared ones (OwnRoom, useResults); only the look is the game's.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { FeatherArt } from '@/components/FeatherArt';
import { AddPill } from '@/features/friends/AddAfterMatch';
import { LOAD } from '@/features/loading/configs';
import { effectWinner, PlayerTitle, winnerAccount } from '@/features/style/PlayerTitle';
import { WinEffect } from '@/features/style/WinEffect';
import { WinShake } from '@/features/style/WinShake';
import type { RoomLook } from '@/online/look';
import { OwnLobby, OwnOnlineSetup, type RoomKit } from '@/online/OwnRoom';

import { levelUpLine } from '../engine/levels';
import type { Mode, Play, PlayItem } from '../engine/types';
import { ToneSticker } from '../shell/ResultTone';
import { useSession } from '../shell/session';
import type { GameDef } from '../shell/types';
import { useResults } from '../shell/useShellPages';
import { AT, AtlasScreen, Btn, CG, CGB, CGI, CZ, CZM, KINGDOMS, Kicker, Parchment, ROMAN, Room, T, v } from './atlas';

/** The landing's room: the sepia room with the game's art feathered in at the top. */
export function Backdrop({ def, low }: { def: Pick<GameDef, 'key'>; low?: boolean }) {
  const art = LOAD[def.key];
  return (
    <>
      <Room />
      {/* low: the landing page keeps the art under its card, so the title and lines above stay clear (Yazan 2026-10-27). */}
      {art ? <FeatherArt source={art.photo} position={art.fo} opacity={0.6} edges={low ? { top: 0.3, bottom: 0.25 } : { bottom: 0.55 }} style={low ? s.artLow : s.art} /> : null}
    </>
  );
}

/** A cream parchment sheet with the red inner rule. */
export function Sheet({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.sheet, style]}>
      <Parchment />
      <View style={s.rule} pointerEvents="none" />
      {children}
    </View>
  );
}

function BackLink({ label, to }: { label: string; to: string }) {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace(to as never))} accessibilityRole="link" hitSlop={v(8)} style={{ alignSelf: 'flex-start', paddingHorizontal: v(4) }}>
      <T f={CGI} size={16} color={AT.soft}>{`‹ ${label}`}</T>
    </Pressable>
  );
}

/** The room's buttons: red ink, or an outline (ink on parchment, cream on the room). */
function KitBtn({ label, onPress, ghost, off, onPaper, style }: { label: string; onPress?: () => void; ghost?: boolean; off?: boolean; onPaper?: boolean; style?: StyleProp<ViewStyle> }) {
  if (ghost && onPaper)
    return (
      <Pressable onPress={onPress} disabled={off} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.inkGhost, { opacity: off ? 0.4 : pressed ? 0.8 : 1 }, style]}>
        <T f={CZ} size={13} color={AT.ink} style={{ letterSpacing: v(1), textAlign: 'center' }}>{label}</T>
      </Pressable>
    );
  return (
    <View style={[{ flexDirection: 'row' }, style]}>
      <Btn label={label} onPress={onPress} ghost={ghost} disabled={off} />
    </View>
  );
}

const LOOK: RoomLook = {
  page: AT.bg,
  panel: 'rgba(243,230,198,0.07)',
  raised: '#3a2b1e',
  line: AT.line,
  fg: AT.cream,
  mute: AT.soft,
  dim: AT.dim,
  acc: AT.gold,
  ok: AT.right,
  amber: AT.gold,
  btn: AT.red,
  btnOff: '#5a4330',
  onBtn: AT.cream,
  body: CG,
  semi: CGB,
  mono: CZ,
  head: CZ,
};

export const ATLAS_KIT: RoomKit = {
  look: LOOK,
  Screen: ({ children, top }) => (
    <AtlasScreen scroll under={<AtlasUnder />} top={top}>
      {children}
    </AtlasScreen>
  ),
  Paper: Sheet,
  Btn: KitBtn,
  Title: ({ text }) => (
    <T f={CZ} size={26} color={AT.gold} style={{ lineHeight: v(31) }}>{text}</T>
  ),
  Mark: ({ color }) => <View style={[s.mark, { backgroundColor: color }]} />,
  f: { head: CGB, body: CG, kick: CZM, num: CZ },
  z: v,
  k: 1.12,
  room: { fg: AT.cream, soft: AT.soft, dim: AT.dim, acc: AT.gold },
  paper: { fg: AT.ink, soft: AT.inkSoft, acc: AT.red, rule: 'rgba(59,36,18,0.22)', onAcc: AT.cream },
  ok: '#3f7a3a',
  wait: '#c58a1f',
  seat: (i) => KINGDOMS[i % KINGDOMS.length],
  words: {
    game: 'The Conqueror',
    setup: 'Go to war',
    find: 'Join a war',
    findNote: 'a code or an open war',
    host: 'Declare war',
    hostNote: 'your own rules',
    code: 'War code',
    open: 'Open wars',
    none: 'No open wars right now. Declare one yourself.',
    create: 'Declare war',
    lobby: 'The war council',
    players: 'Kingdoms',
    invite: 'Empty throne · invite',
    start: 'Start the war',
    leave: 'Leave the council',
    gone: 'This council has broken up',
  },
};

const AtlasUnder = () => <Backdrop def={{ key: 'the-conqueror' }} />;

// ---------------------------------------------------------------- gate

export function Gate({ def }: { def: GameDef; mode: Mode }) {
  return (
    <AtlasScreen under={<Backdrop def={def} />}>
      <View style={{ flex: 1, justifyContent: 'center', gap: v(14) }}>
        <BackLink label="The Conqueror" to={`/play/${def.key}`} />
        <Sheet style={{ alignItems: 'center', paddingVertical: v(24) }}>
          <Kicker color={AT.inkSoft}>Before you march</Kicker>
          <T f={CZ} size={24} color={AT.ink} style={{ textAlign: 'center', lineHeight: v(30) }}>Sign in to go to war</T>
          <View style={s.dash} />
          <T f={CGI} size={16} color={AT.inkSoft} style={{ textAlign: 'center', lineHeight: v(20) }}>
            Online needs an account, so the other rulers see your name and your results are kept.
          </T>
          <View style={{ alignSelf: 'stretch', gap: v(9), marginTop: v(8) }}>
            <KitBtn label="Sign in" onPress={() => router.push('/auth')} />
            <KitBtn label="Back" ghost onPaper onPress={() => (router.canGoBack() ? router.back() : router.replace(`/play/${def.key}` as never))} />
          </View>
        </Sheet>
      </View>
    </AtlasScreen>
  );
}

export const OnlineSetup = ({ def, prefill }: { def: GameDef; prefill?: Record<string, unknown> }) => <OwnOnlineSetup kit={ATLAS_KIT} def={def} prefill={prefill} />;
export const Lobby = ({ def, roomId }: { def: GameDef; roomId: string }) => <OwnLobby kit={ATLAS_KIT} def={def} roomId={roomId} />;

// ---------------------------------------------------------------- results: the war chronicle

export function Results({ def, play, items }: { def: GameDef; play: Play; items: PlayItem[] }) {
  const { colorOf, rematch, changeSettings, backToGames } = useResults(def, play, items);
  const me = useSession((x) => x.userId);
  const winner = winnerAccount(play, me);
  const fx = effectWinner(play, me);
  const seatOf = new Map(play.seats.map((x) => [x.seat, x]));
  const first = play.standings.find((r) => r.rank === 1);
  const mine = play.standings.find((r) => r.seat === 0);
  const right = Number(play.settings.right) || 0;
  const stats = [
    { value: String(mine?.score ?? play.score), label: 'Lands held' },
    { value: String(right), label: 'Right answers' },
    { value: `+${play.expEarned}`, label: 'EXP' },
  ];
  return (
    <WinShake>
      <AtlasScreen scroll under={<Backdrop def={def} />}>
        {fx ? <WinEffect userId={fx} /> : null}
        <ToneSticker play={play} items={items} uid={me}>
          <View style={{ gap: v(3), paddingHorizontal: v(4) }}>
            <Kicker>The Conqueror · Online</Kicker>
            <T f={CZ} size={27} color={AT.gold} style={{ lineHeight: v(32) }}>The war is over</T>
          </View>
        </ToneSticker>
        <Sheet>
          <Kicker color={AT.red}>The chronicle</Kicker>
          {first ? (
            <T f={CGI} size={18} color={AT.ink} style={{ lineHeight: v(22) }}>
              {first.seat === 0 ? 'You take the realm.' : `${first.name} takes the realm.`}
            </T>
          ) : null}
          <View style={s.stats}>
            {stats.map((x) => (
              <View key={x.label} style={{ alignItems: 'center', flex: 1 }}>
                <T f={CZ} size={25} color={x.label === 'EXP' ? AT.red : AT.ink} style={{ lineHeight: v(30) }}>{x.value}</T>
                <T f={CZM} size={9} color={AT.inkSoft} style={{ letterSpacing: v(1.2), textAlign: 'center' }}>{x.label.toUpperCase()}</T>
              </View>
            ))}
          </View>
          {play.levelUp ? (
            <T f={CZM} size={11} color={AT.red} style={{ textAlign: 'center', letterSpacing: v(1.5) }}>{levelUpLine(play.levelUp)!.toUpperCase()}</T>
          ) : null}
          <View style={s.line} />
          <Kicker color={AT.inkSoft}>Kingdoms</Kicker>
          {play.standings.map((r) => (
            <View key={r.seat} style={s.row}>
              <T f={CZ} size={13} color={AT.red} style={{ width: v(26) }}>{ROMAN[r.rank - 1] ?? String(r.rank)}</T>
              <View style={[s.mark, { backgroundColor: colorOf.get(r.seat) ?? AT.ink }]} />
              <View style={{ flex: 1 }}>
                <T f={CGB} size={16} color={AT.ink} style={{ lineHeight: v(19) }}>{r.name}</T>
                {r.rank === 1 && winner ? <PlayerTitle userId={winner} size={10.5} accent={AT.red} mode="light" /> : null}
              </View>
              {r.seat > 0 && seatOf.get(r.seat)?.userId ? <AddPill userId={seatOf.get(r.seat)!.userId!} name={r.name} ink={AT.ink} dim={AT.inkSoft} font={CGB} /> : null}
              <T f={CG} size={14} color={AT.inkSoft}>{`${r.score} ${r.score === 1 ? 'land' : 'lands'}`}</T>
            </View>
          ))}
          <T f={CGI} size={13} color={AT.inkSoft} style={{ marginTop: v(4) }}>{`Every right answer earned 2 EXP.`}</T>
        </Sheet>
        <View style={{ flexDirection: 'row', gap: v(10) }}>
          <Btn label="Rematch" onPress={rematch} />
          <Btn label="Change settings" ghost onPress={changeSettings} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Btn label="Back to games" ghost onPress={backToGames} />
        </View>
      </AtlasScreen>
    </WinShake>
  );
}

const s = StyleSheet.create({
  art: { position: 'absolute', left: 0, right: 0, top: 0, height: '62%' },
  artLow: { position: 'absolute', left: 0, right: 0, top: '40%', height: '60%' },
  sheet: {
    backgroundColor: AT.paper,
    borderRadius: v(6),
    borderWidth: 1,
    borderColor: '#5a3a1e',
    padding: v(16),
    gap: v(8),
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: v(10),
    shadowOffset: { width: 0, height: v(4) },
    elevation: 4,
  },
  rule: { position: 'absolute', left: v(5), right: v(5), top: v(5), bottom: v(5), borderWidth: 1, borderColor: 'rgba(142,28,28,0.4)', borderRadius: v(4) },
  mark: { width: v(12), height: v(12), borderRadius: v(6), borderWidth: 1.5, borderColor: 'rgba(243,230,198,0.85)' },
  inkGhost: { paddingVertical: v(12), borderRadius: v(6), borderWidth: 1.5, borderColor: 'rgba(59,36,18,0.55)', alignItems: 'center' },
  dash: { width: v(44), height: 1, backgroundColor: 'rgba(142,28,28,0.55)', marginVertical: v(4) },
  stats: { flexDirection: 'row', paddingVertical: v(6) },
  line: { height: 1, backgroundColor: 'rgba(59,36,18,0.22)', marginVertical: v(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: v(9), paddingVertical: v(3) },
});
