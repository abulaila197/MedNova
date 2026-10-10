import { createRef } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/** The app's page card (set in the (app) layout): what the doors are cut from. */
export const pageCard = createRef<View>();

/** A picture of the page as it is right now, or null when the phone can't take one (the doors are then skipped). */
export async function snapPage(): Promise<string | null> {
  if (!pageCard.current) return null;
  try {
    return await captureRef(pageCard, { format: 'jpg', quality: 0.92, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile' });
  } catch {
    return null;
  }
}
