import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { useLoading } from '@/features/loading/store';
import { useWelcome } from '@/features/welcome/WelcomeHost';
import { defaultKV } from '@/games/engine/storage';
import { useSession } from '@/games/shell/session';
import { useBack } from '@/lib/useBack';
import { usePopups } from '@/state/popups';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { DECK } from './deck';
import { loadHunt, useHunt } from './hunt';
import { Sleeve } from './Sleeve';

const kv = defaultKV();
const seenKey = (uid: string) => `cards:seen:${uid}`;
const CHECK_MS = 30_000; // asks the server at most this often while moving between pages

/** Not on the way into a game: its loading page, the game itself, or sign-in. */
const quiet = (path: string) => path.startsWith('/play') || path.startsWith('/auth');

/**
 * Shows a card the moment its mission is met (Yazan 2026-10-21), one card at a time, last in line: after the welcome
 * tour, help pop-ups and the daily reward, and never between Play and the game.
 */
export function CardHost() {
  const t = useTheme();
  const path = usePathname();
  const uid = useSession((s) => s.userId);
  const welcomed = useWelcome((s) => s.state === 'done');
  const blocked = usePopups((s) => s.daily || s.help);
  const loading = useLoading((s) => !!s.run || s.busy);
  const found = useHunt((s) => s.status?.found);
  const [held, setHeld] = useState<{ uid: string | null; keys: string[] }>({ uid: null, keys: [] });
  const queue = held.uid === uid ? held.keys : []; // a new account starts with an empty queue
  const setQueue = (f: (q: string[]) => string[]) => setHeld((h) => ({ uid, keys: f(h.uid === uid ? h.keys : []) }));
  const last = useRef(0);

  // Ask the server for newly met missions on page changes and when the app comes back to the front.
  const [wake, setWake] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st === 'active' && setWake((n) => n + 1));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!uid || quiet(path) || Date.now() - last.current < CHECK_MS) return;
    last.current = Date.now();
    loadHunt().catch(() => {});
  }, [uid, path, wake]);

  // Any found card this phone hasn't shown yet joins the queue.
  useEffect(() => {
    if (!uid || !found) return;
    void (async () => {
      const seen = (await kv.get<string[]>(seenKey(uid)).catch(() => null)) ?? [];
      const fresh = found.filter((k) => !seen.includes(k));
      if (fresh.length) setQueue((q) => [...q, ...fresh.filter((k) => !q.includes(k))]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, found]);

  const key = queue[0];
  const card = DECK.find((c) => c.key === key);
  const show = !!card && !!uid && welcomed && !blocked && !loading && !quiet(path);
  const done = async () => {
    if (!uid || !key) return;
    const seen = (await kv.get<string[]>(seenKey(uid)).catch(() => null)) ?? [];
    await kv.set(seenKey(uid), [...new Set([...seen, key])]).catch(() => {});
    setQueue((q) => q.slice(1));
  };
  useBack(show, () => void done());
  if (!show || !card) return null;

  const w = u(150);
  return (
    <View style={[StyleSheet.absoluteFill, s.wrap]}>
      <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,6,16,0.6)' }]} onPress={() => void done()} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View entering={ZoomIn.duration(320)} exiting={FadeOut.duration(200)} style={[s.card, { backgroundColor: t.panel2, borderColor: t.panelLine }]}>
        <Text style={[s.kick, { color: t.kick }]}>NEW CARD FOUND</Text>
        <Sleeve t={t} card={card} w={w} locked={false} style={{ marginTop: u(12) }} />
        <Text style={[s.name, { color: t.fg }]}>{card.name}</Text>
        <Text style={[s.stars, { color: t.accent }]}>{'★'.repeat(card.stars)}</Text>
        <Text style={[s.what, { color: t.mute }]}>{card.mission}</Text>
        <View style={s.row}>
          <Pressable onPress={() => void done()} style={[s.btn, { borderColor: t.panelLine }]} accessibilityRole="button">
            <Text style={[s.btnT, { color: t.fg }]}>Nice!</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void done();
              router.navigate('/cards' as never);
            }}
            style={[s.btn, { borderColor: t.accent }]}
            accessibilityRole="button">
            <Text style={[s.btnT, { color: t.accent }]}>My cards</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { zIndex: 31, alignItems: 'center', justifyContent: 'center' },
  card: { width: u(236), borderWidth: 1, borderRadius: u(22), padding: u(16), alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: u(24), shadowOffset: { width: 0, height: u(10) } },
  kick: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.4) },
  name: { fontFamily: F.display, fontSize: u(22), lineHeight: u(26), marginTop: u(12) },
  stars: { fontSize: u(12), marginTop: u(2), letterSpacing: u(2) },
  what: { fontFamily: F.body, fontSize: u(10.5), lineHeight: u(15), textAlign: 'center', marginTop: u(6) },
  row: { flexDirection: 'row', gap: u(8), marginTop: u(14), alignSelf: 'stretch' },
  btn: { flex: 1, height: u(34), borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnT: { fontFamily: F.bodyBold, fontSize: u(12) },
});
