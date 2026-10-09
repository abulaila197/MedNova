import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { openAdd } from '@/features/profile/Friends';
import { useAccount } from '@/state/account';

/** Share link mednova://add/CODE (FR1): opens Profile with the Add friend sheet and the code filled in. */
export default function AddLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const signedIn = useAccount((a) => !!a.profile);
  useEffect(() => {
    if (signedIn && code) openAdd(code);
  }, [signedIn, code]);
  return <Redirect href={signedIn ? '/profile' : '/auth'} />;
}
