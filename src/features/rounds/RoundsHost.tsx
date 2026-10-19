import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { TokenCoin } from '@/components/PulseStar';
import { Sheet } from '@/components/Sheet';
import { engine } from '@/games/engine';
import { defaultKV } from '@/games/engine/storage';
import { useSession } from '@/games/shell/session';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { Beat } from './Ribbon';
import { claimRounds, isComplete, loadRounds, useRoundsStore, weekName } from './useRounds';
import { useLock } from '@/lib/useLock';

const kv = defaultKV();
const SHOWN = 'rounds:popped';

/** The "Week done" pop-up: shows once a week when every part of the goal is full, with the prize to collect. */
export function RoundsHost() {
  const t = useTheme();
  const userId = useSession((s) => s.userId);
  const r = useRoundsStore((s) => s.r);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const lock = useLock();
  useEffect(() => {
    void loadRounds(true);
  }, [userId]);
  useEffect(() => {
    if (!r) return;
    void engine.gate.expireBoost(r.week);
    if (!userId || r.claimed || !isComplete(r)) return;
    void kv.get<number>(SHOWN).then((w) => {
      if (w !== r.week) setOpen(true);
    });
  }, [r, userId]);
  const close = () => {
    setOpen(false);
    setFailed(false);
    if (r) void kv.set(SHOWN, r.week);
  };
  if (!r) return null;
  return (
    <Sheet open={open} onClose={close}>
      <View style={s.wrap}>
        <Text style={[s.k, { color: t.kick }]}>GRAND ROUNDS · WEEK DONE</Text>
        <Text style={[s.h, { color: t.fg }]}>
          {'You finished '}
          <Text style={[s.h, { color: t.accent, fontFamily: F.displayItalic }]}>{weekName(r.this)}</Text>
        </Text>
        <View style={{ alignSelf: 'stretch', marginTop: u(6) }}>
          <Beat r={r} more={false} />
        </View>
        <Pressable
          disabled={busy}
          onPress={() =>
            lock(async () => {
              setBusy(true);
              setFailed(false);
              const x = await claimRounds();
              setBusy(false);
              // Offline the prize isn't collected: say so and stay open (it can also be collected on the Grand Rounds page) (AP8).
              if (!x.ok && x.why === 'offline') return setFailed(true);
              close();
            })
          }
          accessibilityRole="button"
          style={[{ alignSelf: 'stretch', marginTop: u(12) }, busy && { opacity: 0.6 }]}>
          <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.btn}>
            <Text style={[s.btnT, { color: t.onGrad }]}>{`Collect ${r.prize}`}</Text>
            <TokenCoin size={u(13)} progress={0} track="transparent" />
          </LinearGradient>
        </Pressable>
        {failed ? <Text style={[s.fail, { color: t.mute }]}>Could not reach MedNova. Try again in a moment.</Text> : null}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: u(4), paddingTop: u(6) },
  k: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.7) },
  h: { fontFamily: F.display, fontSize: u(21), lineHeight: u(26), textAlign: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: u(5), height: u(42), borderRadius: 999 },
  btnT: { fontFamily: F.bodyBold, fontSize: u(13) },
  fail: { fontFamily: F.bodyMedium, fontSize: u(11), textAlign: 'center', marginTop: u(6) },
});
