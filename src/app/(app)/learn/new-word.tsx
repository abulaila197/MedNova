import { useLocalSearchParams } from 'expo-router';

import type { WordGame } from '@/features/learn/cases';
import { NewWord } from '@/features/learn/NewWord';

export default function Page() {
  const { game } = useLocalSearchParams<{ game?: string }>();
  return <NewWord start={game as WordGame | undefined} />;
}
