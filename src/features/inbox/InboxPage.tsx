import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { TokenCoin } from '@/components/PulseStar';
import { Screen } from '@/components/Screen';
import { CHESTS } from '@/features/chests/data';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { Bolt } from '@/features/sparks/Bolt';
import { useSession } from '@/games/shell/session';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { collect, hasGift, loadInbox, readAll, useInbox, type Message } from './useInbox';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/**
 * Inbox (Yazan 2026-10-27): messages and gifts from the MedNova team, newest first. Opening the page reads them;
 * a gift reaches the wallet only when the player taps Collect.
 */
export function InboxPage() {
  const c = useInfo();
  const t = c.t;
  const uid = useSession((x) => x.userId);
  const list = useInbox((x) => x.list);
  const failed = useInbox((x) => x.failed);
  // On every visit, and again when the player signs in or out here.
  useFocusEffect(
    useCallback(() => {
      void loadInbox().then(readAll);
    }, []),
  );
  useEffect(() => {
    void loadInbox().then(readAll);
  }, [uid]);
  return (
    <Screen tab={null} glow={21}>
      <InfoScroll>
        <Kicker>From the MedNova team</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {'Your '}
          <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>inbox</Text>
        </Text>
        {!uid ? <Text style={[s.foot, { color: t.accent }]}>Sign in to get messages and gifts.</Text> : null}
        {uid && failed && !list ? <Text style={[s.foot, { color: t.accent }]}>Can’t reach MedNova right now. Check your connection.</Text> : null}
        {uid && list && !list.length ? <Text style={[s.foot, { color: c.mute }]}>Nothing here yet. Gifts and news from us land here.</Text> : null}
        {(list ?? []).map((m) => (
          <Card key={m.id} m={m} />
        ))}
      </InfoScroll>
    </Screen>
  );
}

function Card({ m }: { m: Message }) {
  const c = useInfo();
  const t = c.t;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const gift = hasGift(m);
  const take = async () => {
    if (busy) return;
    setBusy(true);
    setErr(false);
    if (!(await collect(m.id))) setErr(true);
    setBusy(false);
  };
  return (
    <View style={[s.card, { backgroundColor: c.surf, borderColor: gift && !m.collected ? t.accent : c.line }]}>
      <Text style={[s.k, { color: c.kick }]}>{when(m.at).toUpperCase()}</Text>
      <Text style={[s.h, { color: c.fg }]}>{m.title}</Text>
      {m.body ? <Text style={[s.body, { color: c.mute }]}>{m.body}</Text> : null}
      {gift ? (
        <View style={s.gifts}>
          {m.tokens > 0 ? (
            <View style={[s.chip, { backgroundColor: t.chip, borderColor: t.chipLine }]}>
              <TokenCoin size={u(13)} progress={0} track="transparent" />
              <Text style={[s.chipT, { color: c.fg }]}>{m.tokens}</Text>
            </View>
          ) : null}
          {m.sparks > 0 ? (
            <View style={[s.chip, { backgroundColor: t.chip, borderColor: t.chipLine }]}>
              <Bolt size={u(12)} />
              <Text style={[s.chipT, { color: c.fg }]}>{m.sparks}</Text>
            </View>
          ) : null}
          {m.chest ? (
            <View style={[s.chip, { backgroundColor: t.chip, borderColor: t.chipLine }]}>
              <Image source={CHESTS[m.chest].art} style={s.chest} contentFit="contain" />
              <Text style={[s.chipT, { color: c.fg }]}>{CHESTS[m.chest].name}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {gift ? (
        m.collected ? (
          <Text style={[s.done, { color: '#5fd38a' }]}>COLLECTED</Text>
        ) : (
          <Pressable onPress={take} disabled={busy} accessibilityRole="button" style={s.goWrap}>
            <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.go}>
              <Text style={[s.goT, { color: t.onGrad }]}>{busy ? 'Collecting…' : 'Collect'}</Text>
            </LinearGradient>
          </Pressable>
        )
      ) : null}
      {err ? <Text style={[s.err, { color: t.error }]}>Couldn’t collect. Check your connection and try again.</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: u(16), paddingHorizontal: u(12), paddingTop: u(10), paddingBottom: u(12), marginTop: u(12) },
  k: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3) },
  h: { fontFamily: F.display, fontSize: u(15), marginTop: u(2) },
  body: { fontFamily: F.body, fontSize: u(10), lineHeight: u(15), marginTop: u(4) },
  gifts: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6), marginTop: u(10) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: u(4), borderWidth: 1, borderRadius: 999, paddingHorizontal: u(9), paddingVertical: u(4) },
  chipT: { fontFamily: F.bodySemi, fontSize: u(10) },
  chest: { width: u(16), height: u(16) },
  goWrap: { alignSelf: 'flex-start', marginTop: u(10) },
  go: { borderRadius: u(12), paddingVertical: u(7), paddingHorizontal: u(18) },
  goT: { fontFamily: F.bodyBold, fontSize: u(11) },
  done: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.3), marginTop: u(10) },
  err: { fontFamily: F.body, fontSize: u(9), marginTop: u(6) },
  foot: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(14), marginTop: u(12) },
});
