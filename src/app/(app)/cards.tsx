import { useLocalSearchParams } from 'expo-router';

import { CollectionPage } from '@/features/cards/CollectionPage';

export default function Page() {
  // Keyed by the query so a look switch (?look=b) starts fresh.
  const q = useLocalSearchParams();
  return <CollectionPage key={JSON.stringify(q)} />;
}
