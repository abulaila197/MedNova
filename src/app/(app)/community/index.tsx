import { Screen } from '@/components/Screen';
import { Feed } from '@/features/community/Feed';

// The Community tab opens the feed (Yazan, 2026-10-13): Nova Wallpapers and Nova merch on top. Still rising moved to
// community/soon (Nova merch's +); the wallpapers open the story page.
export default function Page() {
  return (
    <Screen tab='community' glow={14}>
      <Feed />
    </Screen>
  );
}
