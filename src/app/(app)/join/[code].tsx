import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { useSession } from '@/games/shell/session';
import { JOIN_SAY, joinRoom } from '@/online/api';
import { useAccount } from '@/state/account';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/** Room Share link mednova://join/CODE?g=GAME (#50): joins the room and opens its lobby. Guests sign in first. */
export default function JoinLink() {
  const { code, g } = useLocalSearchParams<{ code: string; g?: string }>();
  const signedIn = useSession((s) => !!s.userId);
  const avatar = useAccount((a) => a.profile?.avatar);
  const t = useTheme();
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!signedIn || !code) return;
    let live = true;
    joinRoom(String(code).replace(/\D/g, '').slice(0, 6), avatar)
      .then((r) => {
        if (!live) return;
        if ((r.result === 'joined' || r.result === 'spectating') && r.room_id && g) router.replace(`/play/${g}/lobby?room=${r.room_id}`);
        else setMsg(JOIN_SAY[r.result] ?? JOIN_SAY.error);
      })
      .catch(() => live && setMsg(JOIN_SAY.error));
    return () => {
      live = false;
    };
  }, [signedIn, code, g, avatar]);
  if (!signedIn) return <Redirect href="/auth" />;
  return (
    <Screen tab={null}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: u(10), paddingHorizontal: u(24) }}>
        <Text style={{ fontFamily: F.display, fontSize: u(20), color: t.fg, textAlign: 'center' }}>{msg ?? 'Joining the room…'}</Text>
        {msg ? (
          <Text onPress={() => router.replace('/games')} style={{ fontFamily: F.bodySemi, fontSize: u(11), color: t.accent }}>
            Back to games
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
