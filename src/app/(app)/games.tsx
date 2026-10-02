import { Text } from 'react-native';

import { Screen } from '@/components/Screen';

export default function Page() {
  return (
    <Screen tab='games' glow={0}>
      <Text style={{ color: '#888', padding: 20 }}>games</Text>
    </Screen>
  );
}
