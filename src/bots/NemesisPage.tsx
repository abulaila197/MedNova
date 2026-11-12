import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { LevelBadge } from '@/components/LevelBadge';
import { Screen } from '@/components/Screen';
import { GAMES } from '@/data/games';
import { CHESTS } from '@/features/chests/data';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { PlayerFace } from '@/features/style/Frame';
import type { GameKey } from '@/games/engine/types';
import { useSession } from '@/games/shell/session';
import { sfx } from '@/lib/sound';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { Image } from 'expo-image';

import { claimBossChest, rivalOfDay, sawBossWin, todayWin } from './daily';
import { grownLevel, loadRivals, regulars, toggleFav, useRivals, type Record_ } from './memory';
import { openRoomWith } from './openRoom';
import { recordText } from './revenge';
import { TYPE_NAME, type Bot } from './types';

const gameName = (k: string) => {
  const g = GAMES.find((x) => x.key === k);
  return g ? `${g.lead} ${g.em}` : k;
};
const agoText = (at: number) => {
  const d = Math.floor((Date.now() - at) / 86_400_000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 7 ? `${d} days ago` : d < 30 ? `${Math.floor(d / 7)} wk ago` : `${Math.floor(d / 30)} mo ago`;
};

/**
 * Nemesis (G6, Yazan 2026-11-10): the rival of the day up top, then your regulars (the rivals you've played most) with
 * your head-to-head record, the last result and Play again, which opens a room with that rival.
 */
export function NemesisPage() {
  const c = useInfo();
  const t = c.t;
  const { rival } = useLocalSearchParams<{ rival?: string }>();
  const loaded = useRivals((x) => x.loaded);
  const met = useRivals((x) => x.met);
  const record = useRivals((x) => x.record);
  const favs = useRivals((x) => x.favs);
  const day = useRivals((x) => todayWin(x.day));
  const signedIn = !!useSession((x) => x.userId);
  const [busy, setBusy] = useState(false);
  useFocusEffect(
    useCallback(() => {
      void loadRivals().then(() => {
        sawBossWin();
        void claimBossChest();
      });
    }, []),
  );
  const boss = rivalOfDay();
  const list = regulars({ met, record, favs });
  const go = async (game: GameKey, bot: Bot, prefill?: Record<string, unknown>) => {
    if (busy) return;
    void sfx('tap');
    setBusy(true);
    try {
      await openRoomWith(game, bot, prefill);
    } finally {
      setBusy(false);
    }
  };
  const bossRec = record[boss.bot.id];
  return (
    <Screen tab={null} glow={21} wide={460}>
      <InfoScroll>
        <Kicker>Vs rivals</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {'Your '}
          <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>Nemesis</Text>
        </Text>
        <Text style={[ui.p, { color: c.mute }]}>The rivals you keep meeting, and what the score is between you. Beat the rival of the day for a golden chest.</Text>

        {/* Rival of the day: one Genius, one game, the same for everyone today. */}
        <View style={[s.boss, { borderColor: day?.won ? '#5fd38a' : t.accent, backgroundColor: c.surf }]}>
          <LinearGradient colors={[`${t.accent}22`, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text style={[s.k, { color: day?.won ? '#5fd38a' : c.kick }]}>{day?.won ? 'RIVAL OF THE DAY · BEATEN' : 'RIVAL OF THE DAY'}</Text>
          <View style={s.bossRow}>
            <View>
              <PlayerFace slug={boss.bot.character} size={u(56)} still />
              <View style={s.lvl}>
                <LevelBadge level={grownLevel(boss.bot, met)} size={u(18)} edge={c.surf} />
              </View>
            </View>
            <View style={{ flex: 1, gap: u(2) }}>
              <Text style={[s.name, { color: c.fg }]}>{boss.bot.name}</Text>
              <Text style={[s.small, { color: c.mute }]}>{`Genius · ${gameName(boss.game)}${bossRec ? ` · ${recordText(bossRec)}` : ''}`}</Text>
              <Text style={[s.small, { color: c.mute }]}>
                {day?.won
                  ? day.paid
                    ? 'Golden chest filed. It waits on your Chests page.'
                    : signedIn
                      ? 'Golden chest earned. It is filed next time you are online.'
                      : 'Golden chest earned. Sign in to collect it.'
                  : `Finish above ${boss.bot.name.split(' ')[0]} in a Vs rivals match of ${gameName(boss.game)} today.`}
              </Text>
            </View>
            <Image source={CHESTS.golden.art} style={[s.chest, day?.won && day.paid ? null : { opacity: 0.55 }]} contentFit="contain" />
          </View>
          <Pressable onPress={() => go(boss.game, boss.bot, { botLevel: 'hard', botCount: 3 })} disabled={busy} style={s.goWrap} accessibilityRole="button" accessibilityLabel={`Challenge ${boss.bot.name}`}>
            <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.go}>
              <Text style={[s.goT, { color: t.onGrad }]}>{day?.won ? 'Play it again' : 'Challenge'}</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <Kicker style={ui.xsec}>Your regulars</Kicker>
        {!loaded ? null : list.length ? (
          <View style={{ gap: u(8), marginTop: u(8) }}>
            {list.map(({ bot, rec, met: n }) => (
              <Regular key={bot.id} bot={bot} rec={rec} met={n} level={grownLevel(bot, met)} fav={favs.includes(bot.id)} lit={rival === bot.id} onPlay={() => go(rec.game as GameKey, bot, rec.settings)} />
            ))}
          </View>
        ) : (
          <Text style={[ui.p, { color: c.mute }]}>Nobody yet. Finish a Vs rivals match and the rivals you met gather here, with the score between you.</Text>
        )}
      </InfoScroll>
    </Screen>
  );
}

function Regular({ bot, rec, met, level, fav, lit, onPlay }: { bot: Bot; rec: Record_; met: number; level: number; fav: boolean; lit: boolean; onPlay: () => void }) {
  const c = useInfo();
  const t = c.t;
  const lead = rec.w > rec.l ? 'you' : rec.w < rec.l ? 'them' : 'even';
  return (
    <View style={[s.row, { backgroundColor: c.surf, borderColor: lit ? t.accent : c.line }]}>
      <View>
        <PlayerFace slug={bot.character} size={u(40)} still />
        <View style={s.lvlS}>
          <LevelBadge level={level} size={u(15)} edge={c.surf} />
        </View>
      </View>
      <View style={{ flex: 1, gap: u(1) }}>
        <View style={s.nameRow}>
          <Text style={[s.rName, { color: c.fg }]} numberOfLines={1}>
            {bot.name}
          </Text>
          <Pressable onPress={() => toggleFav(bot)} hitSlop={u(8)} accessibilityRole="button" accessibilityLabel={fav ? `Remove ${bot.name} from favourites` : `Save ${bot.name} as a favourite`}>
            <Text style={[s.star, { color: fav ? '#f5b041' : c.mute }]}>{fav ? '★' : '☆'}</Text>
          </Pressable>
        </View>
        <Text style={[s.small, { color: c.mute }]}>{`${TYPE_NAME[bot.type]} · AI player · met ${met} ${met === 1 ? 'time' : 'times'}`}</Text>
        <Text style={[s.small, { color: c.mute }]}>{`Last: you ${rec.last} in ${gameName(rec.game)}, ${agoText(rec.at)}`}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: u(6) }}>
        <Text style={[s.score, { color: lead === 'you' ? '#5fd38a' : lead === 'them' ? t.red : c.fg }]}>{`${rec.w}–${rec.l}`}</Text>
        <Pressable onPress={onPlay} style={[s.again, { borderColor: t.accent }]} accessibilityRole="button" accessibilityLabel={`Play ${bot.name} again`}>
          <Text style={[s.againT, { color: t.accent }]}>Play again</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  k: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12), letterSpacing: u(1.7) },
  boss: { marginTop: u(14), borderWidth: 1, borderRadius: u(16), padding: u(12), gap: u(10), overflow: 'hidden' },
  bossRow: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  lvl: { position: 'absolute', right: u(-4), bottom: u(-2) },
  lvlS: { position: 'absolute', right: u(-4), bottom: u(-3) },
  name: { fontFamily: F.display, fontSize: u(18), lineHeight: u(22) },
  small: { fontFamily: F.body, fontSize: u(10.5), lineHeight: u(14) },
  chest: { width: u(44), height: u(44) },
  goWrap: { alignSelf: 'flex-start' },
  go: { borderRadius: u(14), paddingVertical: u(8), paddingHorizontal: u(18) },
  goT: { fontFamily: F.bodyBold, fontSize: u(12), lineHeight: u(15) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(10), borderWidth: 1, borderRadius: u(14), paddingVertical: u(9), paddingHorizontal: u(11) },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  rName: { fontFamily: F.display, fontSize: u(14), lineHeight: u(18), flexShrink: 1 },
  star: { fontSize: u(13), lineHeight: u(16) },
  score: { fontFamily: F.display, fontSize: u(17), lineHeight: u(20) },
  again: { borderWidth: 1, borderRadius: 999, paddingVertical: u(4), paddingHorizontal: u(9) },
  againT: { fontFamily: F.bodySemi, fontSize: u(9.5), lineHeight: u(12) },
});
