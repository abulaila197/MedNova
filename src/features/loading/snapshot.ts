import { createRef } from 'react';
import { PixelRatio, Platform, type View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';

/** The app's page card (set in the (app) layout): what the doors are cut from. */
export const pageCard = createRef<View>();

/** At most 2x on Android (sizes there are in pixels): the doors only move for a moment, and a 3x picture costs over twice the memory. */
const MAX_RATIO = 2;

const sizeOf = (v: View) => new Promise<{ w: number; h: number }>((done) => v.measureInWindow((_x, _y, w, h) => done({ w, h })));

/** A picture of the page as it is right now, or null when the phone can't take one (the doors are then skipped). */
export async function snapPage(): Promise<string | null> {
  const card = pageCard.current;
  if (!card) return null;
  try {
    let size: { width: number; height: number } | null = null;
    if (Platform.OS === 'android' && PixelRatio.get() > MAX_RATIO) {
      const { w, h } = await sizeOf(card);
      if (w > 0 && h > 0) size = { width: Math.round(w * MAX_RATIO), height: Math.round(h * MAX_RATIO) };
    }
    return await captureRef(pageCard, { format: 'jpg', quality: 0.85, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile', ...size });
  } catch {
    return null;
  }
}

/** Deletes a picture's temp file once its run has ended. */
export function dropShot(uri: string | null) {
  if (!uri || Platform.OS === 'web') return;
  try {
    releaseCapture(uri);
  } catch {
    // already gone
  }
}
