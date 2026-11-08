import { Share } from 'react-native';

import { logChallenge } from '@/features/chests/useChests';

/** Opens the share sheet; a finished share counts toward the daily challenges (Yazan 2026-10-18). */
export function shareText(message: string) {
  return Share.share({ message })
    .then((r) => {
      if (r.action === Share.sharedAction) logChallenge('share');
    })
    .catch(() => {});
}
