import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Sheet } from '@/components/Sheet';
import { useSession } from '@/games/shell/session';
import { useAccount } from '@/state/account';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { EFFECTS, FRAMES, PLATINUM_TITLES, TITLES } from './catalog';
import { Framed, type FrameKey } from './Frame';
import { CHARACTERS } from '@/games/shell/characters';
import { MECHS } from '@/features/chests/data';
import { ROBOTS } from '@/features/shop/robots';

import { useOfflineRetry } from '@/features/offline/useOfflineRetry';

import { flushInBackground, giftsSeen, loadStyle, refusedSeen, useStyle } from './useStyle';

const nameOf = (id: string) => {
  const [kind, key] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
  const all = kind === 'frame' ? FRAMES : kind === 'title' ? [...TITLES, ...PLATINUM_TITLES] : kind === 'effect' ? EFFECTS : [];
  const found = all.find((x) => x.key === key)?.name;
  if (kind === 'avatar') return [...CHARACTERS.map((c) => ({ key: c.slug, name: c.name })), ...MECHS, ...ROBOTS].find((c) => c.key === key)?.name ?? 'that character';
  if (kind === 'effect' && key === 'null') return 'taking off your win effect';
  return kind === 'pack' ? 'a sticker pack' : kind === 'frame' ? `the ${found} frame` : kind === 'title' ? `the title ${found}` : `the ${found} win effect`;
};

/** Keeps your style in step with the account and shows a pop-up when a friend sends you a gift. */
export function StyleHost() {
  const t = useTheme();
  const userId = useSession((s) => s.userId);
  const gifts = useStyle((s) => s.gifts);
  const avatar = useAccount((a) => a.profile?.avatar ?? 'yara');
  const refused = useStyle((s) => s.refused);
  useOfflineRetry();
  useEffect(() => {
    void loadStyle();
  }, [userId]);
  // Wear changes made offline go up when the app comes back, and every minute while some still wait (#58).
  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener('change', (st) => st === 'active' && void flushInBackground());
    const id = setInterval(() => void flushInBackground(), 60000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, [userId]);
  const g = gifts[0];
  // A change the server refused once back online is put back, with a note (Yazan 2026-10-26).
  if (!g && refused.length)
    return (
      <Sheet open onClose={refusedSeen}>
        <View style={s.wrap}>
          <Text style={[s.k, { color: t.kick }]}>PUT BACK</Text>
          <Text style={[s.h, { color: t.fg }]}>{`Couldn’t save ${refused.map(nameOf).join(', ')}`}</Text>
          <Text style={[s.p, { color: t.mute, textAlign: 'center' }]}>You changed it while offline, but your account says it isn’t yours any more, so your look is back to what your account has.</Text>
          <View style={s.row}>
            <Pressable onPress={refusedSeen} style={[s.btn, { borderColor: t.panelLine }]} accessibilityRole="button">
              <Text style={[s.btnT, { color: t.fg }]}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Sheet>
    );
  const frame = g?.item.startsWith('frame:') ? (g.item.slice(6) as FrameKey) : null;
  return (
    <Sheet open={!!g} onClose={() => void giftsSeen()}>
      {g ? (
        <View style={s.wrap}>
          {frame ? <Framed slug={avatar} size={u(96)} frame={frame} /> : null}
          <Text style={[s.k, { color: t.kick }]}>A GIFT FOR YOU</Text>
          <Text style={[s.h, { color: t.fg }]}>
            {`${g.from} sent you `}
            <Text style={[s.h, { color: t.accent, fontFamily: F.displayItalic }]}>{nameOf(g.item)}</Text>
          </Text>
          {gifts.length > 1 ? <Text style={[s.p, { color: t.mute }]}>{`And ${gifts.length - 1} more.`}</Text> : null}
          <View style={s.row}>
            <Pressable onPress={() => void giftsSeen()} style={[s.btn, { borderColor: t.panelLine }]} accessibilityRole="button">
              <Text style={[s.btnT, { color: t.fg }]}>Thanks</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void giftsSeen();
                router.navigate(`/style?tab=${g.item.startsWith('title:') ? 'titles' : g.item.startsWith('effect:') ? 'effects' : g.item.startsWith('pack:') ? 'stickers' : 'frames'}` as never);
              }}
              style={[s.btn, { borderColor: t.accent }]}
              accessibilityRole="button">
              <Text style={[s.btnT, { color: t.accent }]}>Put it on</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: u(6), paddingTop: u(6) },
  k: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.7), marginTop: u(4) },
  h: { fontFamily: F.display, fontSize: u(20), lineHeight: u(25), textAlign: 'center' },
  p: { fontFamily: F.body, fontSize: u(11) },
  row: { flexDirection: 'row', gap: u(8), marginTop: u(10) },
  btn: { borderWidth: 1, borderRadius: 999, height: u(34), paddingHorizontal: u(18), justifyContent: 'center' },
  btnT: { fontFamily: F.bodySemi, fontSize: u(12) },
});
