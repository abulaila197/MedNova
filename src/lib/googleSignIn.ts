import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

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

/**
 * Native Google sign-in on Android and iPhone (Yazan 2026-11-12, for the next build): Google's own account sheet, which shows
 * "MedNova" instead of the xxxx.supabase.co address the web page shows. It needs the Web client ID from Google Cloud
 * in EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (and that ID added to Supabase's Google provider); until then the web page below
 * is used. iPhone joins once EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is set too (Supabase: add that ID and turn on Skip nonce check).
 */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
// iPhone also needs its own iOS client ID (and the plugin's iosUrlScheme in app.json, made from it at build time).
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const isId = (id: string) => id.endsWith('.apps.googleusercontent.com');
export const NATIVE_GOOGLE = isId(WEB_CLIENT_ID) && (Platform.OS === 'android' || (Platform.OS === 'ios' && isId(IOS_CLIENT_ID)));

async function nativeGoogleSignIn() {
  // Loaded only here, so the web build never touches the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleSignin, statusCodes } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, ...(Platform.OS === 'ios' ? { iosClientId: IOS_CLIENT_ID } : {}) });
  if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  // Signed out first, so the account picker shows every time (like prompt=select_account on the web page).
  await GoogleSignin.signOut().catch(() => {});
  try {
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') return false;
    const token = res.data.idToken;
    if (!token) throw new Error('Google sign-in did not finish. Try again.');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
    if (error) throw error;
    return true;
  } catch (e) {
    if ((e as { code?: string })?.code === statusCodes.SIGN_IN_CANCELLED) return false;
    throw e;
  }
}

/** Opens Google's sign-in (native sheet on Android once set up, else the web page). True once signed in, false when closed. */
export async function googleSignIn() {
  if (NATIVE_GOOGLE) return nativeGoogleSignIn();
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

/**
 * Adds Google to the signed-in account (Group 3, Yazan 2026-11-07). An Apple player with "Hide my email" has a
 * private relay address, so on Android they could never reach the same account; with Google added they sign in with
 * Google there. Needs "Manual linking" on in Supabase Auth. True once added, false when the page was closed.
 */
export async function linkGoogle() {
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: AUTH_CALLBACK, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
  const res = await WebBrowser.openAuthSessionAsync(data.url, AUTH_CALLBACK);
  if (res.type !== 'success') return false;
  await sessionFromUrl(res.url);
  return true;
}

/** Which ways in this account has: 'email', 'google', 'apple'. */
export async function signInMethods() {
  const { data } = await supabase.auth.getUserIdentities();
  return (data?.identities ?? []).map((i) => i.provider);
}
