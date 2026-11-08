// The Conqueror's war chronicle results, in the app's look since 2026-11-02 (beige sheet, app buttons). The sign-in,
// online setup and lobby are the shared app pages now.
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AddPill } from '@/features/friends/AddAfterMatch';
import { effectWinner, PlayerTitle, winnerAccount } from '@/features/style/PlayerTitle';
import { WinEffect } from '@/features/style/WinEffect';
import { WinShake } from '@/features/style/WinShake';

import { levelUpLine } from '../engine/levels';
import type { Play, PlayItem } from '../engine/types';
import { ToneSticker } from '../shell/ResultTone';
import { useSession } from '../shell/session';
import type { GameDef } from '../shell/types';
import { useResults } from '../shell/useShellPages';
import { AT, AtlasScreen, Btn, CG, CGB, CGI, CZ, CZM, Kicker, ROMAN, T, v } from './atlas';

/** A beige sheet (app look, 2026-11-02). */
export function Sheet({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.sheet, style]}>
      {children}
    </View>
  );
}

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
      <AtlasScreen scroll>
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
    borderRadius: v(12),
    borderWidth: 1,
    borderColor: '#cdb88c',
    padding: v(16),
    gap: v(8),
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: v(10),
    shadowOffset: { width: 0, height: v(4) },
    elevation: 4,
  },
  rule: { position: 'absolute', left: v(5), right: v(5), top: v(5), bottom: v(5), borderWidth: 1, borderColor: 'rgba(91,69,196,0.4)', borderRadius: v(4) },
  mark: { width: v(12), height: v(12), borderRadius: v(12), borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)' },
  inkGhost: { paddingVertical: v(12), borderRadius: v(12), borderWidth: 1.5, borderColor: 'rgba(59,36,18,0.55)', alignItems: 'center' },
  dash: { width: v(44), height: 1, backgroundColor: 'rgba(91,69,196,0.55)', marginVertical: v(4) },
  stats: { flexDirection: 'row', paddingVertical: v(6) },
  line: { height: 1, backgroundColor: 'rgba(59,36,18,0.22)', marginVertical: v(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: v(9), paddingVertical: v(3) },
});
