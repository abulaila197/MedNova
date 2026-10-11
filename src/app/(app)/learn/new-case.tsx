import { useLocalSearchParams } from 'expo-router';

import { NewCase } from '@/features/learn/NewCase';

export default function Page() {
  // Keyed by the query so a look switch (?look=b) starts fresh.
  const q = useLocalSearchParams();
  return <NewCase key={JSON.stringify(q)} />;
}
