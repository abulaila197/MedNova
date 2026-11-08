import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Sign in with Apple (Group 3, Yazan 2026-11-07): iPhone only. Apple's own sheet gives an ID token, and Supabase
// signs in with it (Apple provider, Client ID = the bundle ID, no secret). Android and web never show the button.
export const APPLE_ON = Platform.OS === 'ios';

/** True once signed in, false when the player closed Apple's sheet. */
export async function appleSignIn() {
  // Apple gets the SHA-256 of the nonce; Supabase gets the raw one and checks they match.
  const raw = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  let cred: AppleAuthentication.AppleAuthenticationCredential;
  try {
    cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw e;
  }
  if (!cred.identityToken) throw new Error('Apple sign-in did not finish. Try again.');
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken, nonce: raw });
  if (error) throw error;
  // Apple rule 5.1.1(v): the server keeps a refresh token so deleting the account can revoke the Apple link. Best
  // effort: signing in never waits for it or fails because of it.
  if (cred.authorizationCode) void supabase.functions.invoke('apple-token', { body: { code: cred.authorizationCode } }).catch(() => {});
  return true;
}
