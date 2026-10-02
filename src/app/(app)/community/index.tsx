import { Text } from 'react-native';

import { Screen } from '@/components/Screen';

export default function Page() {
  return (
    <Screen tab='community' glow={14}>
      <Text style={{ color: '#888', padding: 20 }}>community/index</Text>
    </Screen>
  );
}
