import type { ReactNode } from 'react';

import { Text } from '@/components/AppText';
import { F } from '@/theme/tokens';

/**
 * 13 (Yazan 2026-11-04): in every game with turns, the name of the player whose turn it is shows bold in that
 * player's own colour (seat colour in Pass the phone, room colour online), so everyone sees at a glance whose go it
 * is. Drop it inside a Text: it inherits the size, only the name changes colour and weight.
 */
export function TurnName({ name, color, before, after }: { name: string; color?: string; before?: string; after?: string }): ReactNode {
  // Player 1 is called "You" in Pass the phone: "You’s turn" reads "Your turn".
  if (name === 'You' && after && /^[’']s\b/.test(after)) {
    name = 'Your';
    after = after.slice(2);
  }
  return (
    <>
      {before ?? ''}
      <Text style={{ color, fontFamily: F.bodyBold }}>{name}</Text>
      {after ?? ''}
    </>
  );
}
