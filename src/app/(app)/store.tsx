import { useLocalSearchParams } from 'expo-router';

import { StorePage } from '@/features/store/StorePage';

export default function Page() {
  const { look } = useLocalSearchParams<{ look?: string }>();
  return <StorePage look={look === 'b' ? 'b' : 'a'} />;
}
