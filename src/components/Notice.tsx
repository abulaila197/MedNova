import { safeEnter } from '@/lib/enter';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { create } from 'zustand';

import { Text } from '@/components/AppText';
import { isOnline } from '@/lib/net';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { tr } from '@/i18n';

/**
 * One small pop-up with an (x) for every "couldn't do it" or "you're offline" message (Yazan 2026-11-16): a line on
 * the page could sit out of sight when the player had scrolled, so the message now comes to the middle of the screen.
 */
type Note = { kick?: string; title?: string; line: string; good?: boolean };
const useNotice = create<{ note: Note | null }>(() => ({ note: null }));

export function notice(n: Note) {
  useNotice.setState({ note: n });
}

/** No internet: the one offline message. */
export function noticeOffline() {
  notice({ kick: tr('NO INTERNET'), title: tr('You’re offline'), line: tr('Connect to the internet and try again.') });
}

/** Something failed: offline says so, otherwise the given line. */
export function noticeFail(line: string, title = tr('Something went wrong')) {
  if (!isOnline()) return noticeOffline();
  notice({ title, line });
}

/** A plain message (no title); offline, the offline message instead. Empty does nothing, so it can stand in for a line's setter. */
export function noticeLine(line: string | null | undefined | false) {
  if (!line) return;
  if (!isOnline()) return noticeOffline();
  notice({ line });
}

export function NoticeHost() {
  const t = useTheme();
  const n = useNotice((s) => s.note);
  if (!n) return null;
  const close = () => useNotice.setState({ note: null });
  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3,4,12,0.72)' }]} onPress={close} accessibilityLabel={tr('Close')} />
      <View style={s.mid} pointerEvents="box-none">
        <Animated.View entering={safeEnter(ZoomIn.springify().damping(15))} style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
          <View style={s.top}>
            <Text style={[s.kick, { color: n.good ? t.accent : t.kick }]} numberOfLines={1}>
              {n.kick ?? ''}
            </Text>
            <Pressable onPress={close} hitSlop={u(12)} accessibilityRole="button" accessibilityLabel={tr('Close')} style={[s.x, { borderColor: t.panelLine }]}>
              <Text style={[s.xT, { color: t.mute }]}>×</Text>
            </Pressable>
          </View>
          {n.title ? <Text style={[s.h, { color: t.fg }]}>{n.title}</Text> : null}
          <Text style={[s.p, { color: n.title ? t.mute : t.fg }, !n.title && s.pBig]}>{n.line}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  mid: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: u(24) },
  card: { width: u(248), borderWidth: 1, borderRadius: u(22), paddingTop: u(12), paddingHorizontal: u(18), paddingBottom: u(20) },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: u(26) },
  kick: { flex: 1, fontFamily: F.mono, fontSize: u(8), letterSpacing: u(2) },
  x: { width: u(26), height: u(26), borderRadius: u(13), borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginStart: u(8) },
  xT: { fontSize: u(15), lineHeight: u(18) },
  h: { fontFamily: F.display, fontSize: u(19), lineHeight: u(24), textAlign: 'center', marginTop: u(6) },
  p: { fontFamily: F.body, fontSize: u(11), lineHeight: u(16), textAlign: 'center', marginTop: u(6) },
  pBig: { fontFamily: F.bodySemi, fontSize: u(12.5), lineHeight: u(18), marginTop: u(10) },
});
