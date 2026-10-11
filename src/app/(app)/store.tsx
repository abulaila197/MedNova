import { useLocalSearchParams } from 'expo-router';

import { StorePage } from '@/features/store/StorePage';

export default function Page() {
  // Keyed by the query so a look switch (?look=b) starts fresh.
  const q = useLocalSearchParams();
  return <StorePage key={JSON.stringify(q)} />;
}
