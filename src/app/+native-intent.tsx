import { sessionFromUrl } from '@/lib/googleSignIn';

/**
 * The Google sign-in link (mednova://auth-callback) is not a page. While the app is open the sign-in page reads it
 * itself; if Android closed the app while the Google page was open, the app starts from that link, so the session
 * is read here and the app opens as usual.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (!path.includes('auth-callback')) return path;
  if (initial) void sessionFromUrl(path).catch(() => {});
  return null;
}
