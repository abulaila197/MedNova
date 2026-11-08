import { Screen } from '@/components/Screen';
import { Wallpapers } from '@/features/community/Wallpapers';

export default function Page() {
  return (
    <Screen tab='community' glow={14}>
      <Wallpapers />
    </Screen>
  );
}
