import { Screen } from '@/components/Screen';
import { Profile } from '@/features/profile/Profile';

export default function Page() {
  return (
    <Screen tab={null} glow={28}>
      <Profile />
    </Screen>
  );
}
