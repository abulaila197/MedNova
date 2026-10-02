import { Screen } from '@/components/Screen';
import { Story } from '@/features/community/Story';

export default function Page() {
  return (
    <Screen tab='community' glow={14}>
      <Story />
    </Screen>
  );
}
