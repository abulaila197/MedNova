import { Screen } from '@/components/Screen';
import { Soon } from '@/features/community/Soon';

// The Community tab shows Still rising until there is real community content.
// The feed (community/feed) and story (community/story) pages are kept but not linked.
export default function Page() {
  return (
    <Screen tab='community' glow={14}>
      <Soon />
    </Screen>
  );
}
