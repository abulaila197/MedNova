import { router, useIsFocused } from 'expo-router';
import { useEffect } from 'react';

import { SignIn } from '@/features/start/SignIn';
import { useAccount } from '@/state/account';

export default function Auth() {
  // A slow offline launch opened sign-in before the saved session was read: once it arrives, go on to Games.
  const restored = useAccount((s) => s.restored);
  const focused = useIsFocused();
  useEffect(() => {
    if (restored && focused) {
      useAccount.setState({ restored: false });
      router.replace('/games');
    }
  }, [restored, focused]);
  return <SignIn />;
}
