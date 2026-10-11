import { useLocalSearchParams } from 'expo-router';

import { FriendsPage } from '@/features/friends/FriendsPage';

export default function Page() {
  // Keyed by the query so a look switch (?look=b) starts fresh.
  const q = useLocalSearchParams();
  return <FriendsPage key={JSON.stringify(q)} />;
}
