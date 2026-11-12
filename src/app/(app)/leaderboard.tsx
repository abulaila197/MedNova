import { Screen } from '@/components/Screen';
import { Leaderboard } from '@/features/profile/Leaderboard';

export default function Page() {
  return (
    <Screen tab={null} glow={35} wide={460} symbols>
      <Leaderboard />
    </Screen>
  );
}
