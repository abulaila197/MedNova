import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Image } from 'expo-image';
import { Congrats } from '@/components/Congrats';
import { Sheet } from '@/components/Sheet';
import { defaultKV } from '@/games/engine/storage';
import { useSession } from '@/games/shell/session';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { CHESTS } from '@/features/chests/data';

import { Beat } from './Ribbon';
import { CHEST_NAME, claimRounds, loadRounds, readyOf, useRoundsStore, weekName } from './useRounds';
import { useLock } from '@/lib/useLock';

const kv = defaultKV();
const SHOWN = 'rounds:popped';

/** The "Mission done" pop-up: shows once for each mission reached this week, with its chest to collect. */
export function RoundsHost() {
  const t = useTheme();
  const userId = useSession((s) => s.userId);
  const r = useRoundsStore((s) => s.r);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [won, setWon] = useState(0);
  const lock = useLock();
  useEffect(() => {
    void loadRounds(true);
  }, [userId]);
  const ready = readyOf(r)[0];
  const key = r && ready ? `${r.week}:${ready.tier}` : null;
  useEffect(() => {
    if (!userId || !key) return;
    void kv.get<string>(SHOWN).then((k) => {
      if (k !== key) setOpen(true);
    });
  }, [key, userId]);
  const close = () => {
    setOpen(false);
    setFailed(false);
    if (key) void kv.set(SHOWN, key);
  };
  const prize = won ? <Congrats open tokens={won} title="Every week stamped" line="A stamp from all 16 Grand Rounds weeks. Your tokens are in your wallet, and a new count starts now." onClose={() => setWon(0)} /> : null;
  if (!r || !ready) return prize;
  return (
    <>
      {prize}
      <Sheet open={open} onClose={close}>
        <View style={s.wrap}>
          <Text style={[s.k, { color: t.kick }]}>{`GRAND ROUNDS · MISSION ${ready.tier} DONE`}</Text>
          <Text style={[s.h, { color: t.fg }]}>
            {`${ready.of} Sparks on `}
            <Text style={[s.h, { color: t.accent, fontFamily: F.displayItalic }]}>{weekName(r.this)}</Text>
          </Text>
          <Image source={CHESTS[ready.chest].art} style={s.chest} contentFit="contain" accessibilityLabel={CHEST_NAME[ready.chest]} />
          {ready.tier === 3 ? <Text style={[s.fail, { color: t.mute }]}>The last mission also stamps this week.</Text> : null}
          <View style={{ alignSelf: 'stretch', marginTop: u(6) }}>
            <Beat r={r} more={false} />
          </View>
          <Pressable
            disabled={busy}
            onPress={() =>
              lock(async () => {
                setBusy(true);
                setFailed(false);
                const x = await claimRounds(ready.tier);
                setBusy(false);
                // Offline the prize isn't collected: say so and stay open (it can also be collected on the Grand Rounds page) (AP8).
                if (!x.ok && x.why === 'offline') return setFailed(true);
                if (x.ok && x.prize) setWon(x.prize);
                close();
              })
            }
            accessibilityRole="button"
            style={[{ alignSelf: 'stretch', marginTop: u(12) }, busy && { opacity: 0.6 }]}>
            <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.btn}>
              <Text style={[s.btnT, { color: t.onGrad }]}>{`Collect the ${CHEST_NAME[ready.chest].toLowerCase()}`}</Text>
            </LinearGradient>
          </Pressable>
          {failed ? <Text style={[s.fail, { color: t.mute }]}>Could not reach MedNova. Try again in a moment.</Text> : null}
        </View>
      </Sheet>
    </>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: u(4), paddingTop: u(6) },
  k: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.7) },
  h: { fontFamily: F.display, fontSize: u(21), lineHeight: u(26), textAlign: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: u(5), height: u(42), borderRadius: 999 },
  btnT: { fontFamily: F.bodyBold, fontSize: u(13) },
  chest: { width: u(96), height: u(96), marginTop: u(6) },
  fail: { fontFamily: F.bodyMedium, fontSize: u(11), textAlign: 'center', marginTop: u(6) },
});
