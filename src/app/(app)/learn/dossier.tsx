import { Text } from 'react-native';

import { Screen } from '@/components/Screen';

export default function Page() {
  return (
    <Screen tab='learn' glow={6}>
      <Text style={{ color: '#888', padding: 20 }}>learn/dossier</Text>
    </Screen>
  );
}
