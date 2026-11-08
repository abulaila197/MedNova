import { Screen } from '@/components/Screen';
import { Soon } from '@/features/community/Soon';

/** Still rising: where Nova merch's + leads for now. */
export default function Page() {
  return (
    <Screen tab='community' glow={14}>
      <Soon />
    </Screen>
  );
}
