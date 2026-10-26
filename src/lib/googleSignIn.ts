import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

// Google sign-in (Yazan 2026-10-26, option A): Supabase's Google page opens in an in-app browser and comes back to
// this link with the session in the address. Supabase allows it through the mednova://** redirect URL.
export const AUTH_CALLBACK = 'mednova://auth-callback';

/** Signs in from the link Google sent back (#access_token=…&refresh_token=…, or ?error_description=…). */
export async function sessionFromUrl(url: string) {
  const parts = url.split(/[?#]/).slice(1).join('&');
  const p = new URLSearchParams(parts);
  const err = p.get('error_description') ?? p.get('error');
  if (err) throw new Error(err);
  const access_token = p.get('access_token');
  const refresh_token = p.get('refresh_token');
  if (!access_token || !refresh_token) throw new Error('Google sign-in did not finish. Try again.');
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

/** Opens Google's sign-in page. True once signed in, false when the player closed the page. */
export async function googleSignIn() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: AUTH_CALLBACK, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
  const res = await WebBrowser.openAuthSessionAsync(data.url, AUTH_CALLBACK);
  if (res.type !== 'success') return false;
  await sessionFromUrl(res.url);
  return true;
}
