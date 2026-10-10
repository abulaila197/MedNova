import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { u } from '@/theme/scale';

/** Top space for the system status bar. The web preview has none, so it keeps a phone's spacing there. */
export function TopInset() {
  const ins = useSafeAreaInsets();
  return <View style={{ height: Platform.OS === 'web' ? u(30) : ins.top }} />;
}
