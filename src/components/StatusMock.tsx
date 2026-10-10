import { Platform, View } from 'react-native';
import { Text } from '@/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/** Top space for the system status bar. On the web preview it draws a phone status bar like the prototype. */
export function TopInset({ color }: { color: string }) {
  const ins = useSafeAreaInsets();
  if (Platform.OS !== 'web') return <View style={{ height: ins.top }} />;
  return (
    <View style={{ height: u(30), flexDirection: 'row', justifyContent: 'space-between', paddingTop: u(12), paddingHorizontal: u(22), zIndex: 30 }}>
      <Text style={{ color, fontSize: u(11), fontFamily: F.bodySemi }}>9:41</Text>
      <View style={{ position: 'absolute', top: u(9), left: '50%', marginLeft: u(-40), width: u(80), height: u(21), borderRadius: u(20), backgroundColor: '#000' }} />
      <Text style={{ color, fontSize: u(11), fontFamily: F.bodySemi }}>●●● ▮</Text>
    </View>
  );
}
