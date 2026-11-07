// Rewarded ads (Group 2, Yazan 2026-11-07). The web preview has no ads: this file is the stand-in there; phones load
// ads.native.ts. Both files keep the same exports.

/** What an ad pays: 'sparks' = +10 Sparks (Recharge, 20 a day), 'store' = 1 token (Nova shop, 5 a day). */
export type AdKind = 'sparks' | 'store';
/** earned: watched to the end. nonce: the id the server's reward row carries (it arrives from Google, not the phone). */
export type AdResult = { earned: boolean; nonce: string };

/** True where real ads can show (phones only). */
export const ADS_ON = false;

/** Consent first (EU message, then Apple's tracking question), then the ads SDK. Safe to call more than once. */
export async function startAds(): Promise<void> {}

/** Loads and shows one rewarded ad. Rejects with 'no_ad' when none could load. */
export async function showRewarded(_kind: AdKind, _userId: string): Promise<AdResult> {
  throw new Error('no_ad');
}

/** Whether this player must be offered the 'Privacy choices' form (EU and some US states). */
export async function privacyChoicesNeeded(): Promise<boolean> {
  return false;
}

/** Opens Google's privacy choices form so the player can change their ad consent. */
export async function openPrivacyChoices(): Promise<void> {}
