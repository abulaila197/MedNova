import { Screen } from '@/components/Screen';
import { Feed } from '@/features/community/Feed';

export default function Page() {
  return (
    <Screen tab='community' glow={14}>
      <Feed />
    </Screen>
  );
}
