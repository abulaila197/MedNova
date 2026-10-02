import { Screen } from '@/components/Screen';
import { Soon } from '@/features/community/Soon';

export default function Page() {
  return (
    <Screen tab='community' glow={14}>
      <Soon />
    </Screen>
  );
}
