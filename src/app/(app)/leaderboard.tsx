import { Text } from 'react-native';

import { Screen } from '@/components/Screen';

export default function Page() {
  return (
    <Screen tab={null} glow={35}>
      <Text style={{ color: '#888', padding: 20 }}>leaderboard</Text>
    </Screen>
  );
}
