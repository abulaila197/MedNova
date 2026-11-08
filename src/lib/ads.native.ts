// Rewarded ads on phones (Group 2, Yazan 2026-11-07). The web stand-in is ads.ts; keep the exports the same.
// Rewards are paid by the server only: Google calls our admob-ssv function when an ad is watched to the end, and the
// phone then asks the server whether its reward (by nonce) arrived. A phone can't pay itself by calling an RPC.
import { Platform } from 'react-native';
import mobileAds, { AdEventType, AdsConsent, AdsConsentPrivacyOptionsRequirementStatus, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';

import { newId } from '@/games/engine/ids';

export type AdKind = 'sparks' | 'store';
export type AdResult = { earned: boolean; nonce: string };

export const ADS_ON = true;

// AdMob units (Yazan's AdMob account pub-3390074715930067, 2026-11-06). "Sparks reward" = Recharge, "Shop reward" = shop.
const UNITS: Record<'android' | 'ios', Record<AdKind, string>> = {
  android: { sparks: 'ca-app-pub-3390074715930067/3326178438', store: 'ca-app-pub-3390074715930067/1713713868' },
  ios: { sparks: 'ca-app-pub-3390074715930067/2341408980', store: 'ca-app-pub-3390074715930067/5461387188' },
};
const unit = (kind: AdKind) => (__DEV__ ? TestIds.REWARDED : UNITS[Platform.OS === 'ios' ? 'ios' : 'android'][kind]);

let started: Promise<void> | null = null;
let canAsk = false;

/** Consent first (EU message, then Apple's tracking question through the same form), then the ads SDK. */
export function startAds(): Promise<void> {
  started ??= (async () => {
    try {
      // Shows the EU / US-state message only where the law needs it; on iPhone the IDFA explainer then Apple's prompt.
      const info = await AdsConsent.gatherConsent();
      canAsk = info.canRequestAds;
    } catch {
      // No connection or no form: Google still lets us ask for (non-personalised) ads where consent isn't needed.
      try {
        canAsk = (await AdsConsent.getConsentInfo()).canRequestAds;
      } catch {
        canAsk = false;
      }
    }
    if (canAsk) await mobileAds().initialize().catch(() => {});
  })();
  return started;
}

/** Loads and shows one rewarded ad. Rejects with 'no_ad' when none could load (or consent was refused). */
export async function showRewarded(kind: AdKind, userId: string): Promise<AdResult> {
  await startAds();
  if (!canAsk) {
    // The player may have answered the consent form since: look again before giving up.
    canAsk = (await AdsConsent.getConsentInfo().catch(() => ({ canRequestAds: false }))).canRequestAds;
    if (!canAsk) throw new Error('no_ad');
    await mobileAds().initialize().catch(() => {});
  }
  const nonce = newId('ad');
  const ad = RewardedAd.createForAdRequest(unit(kind), {
    serverSideVerificationOptions: { userId, customData: `${kind}:${nonce}` },
  });
  return new Promise<AdResult>((resolve, reject) => {
    let earned = false;
    let shown = false;
    const offs: (() => void)[] = [];
    const done = (fn: () => void) => {
      clearTimeout(timer);
      offs.forEach((o) => o());
      fn();
    };
    // An ad that doesn't load within 15 s counts as none.
    const timer = setTimeout(() => {
      if (!shown) done(() => reject(new Error('no_ad')));
    }, 15000);
    offs.push(
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        shown = true;
        clearTimeout(timer);
        ad.show().catch(() => done(() => reject(new Error('no_ad'))));
      }),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => done(() => resolve({ earned, nonce }))),
      ad.addAdEventListener(AdEventType.ERROR, () => done(() => (shown ? resolve({ earned, nonce }) : reject(new Error('no_ad'))))),
    );
    ad.load();
  });
}

export async function privacyChoicesNeeded(): Promise<boolean> {
  try {
    const info = await AdsConsent.getConsentInfo();
    return info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  } catch {
    return false;
  }
}

export async function openPrivacyChoices(): Promise<void> {
  await startAds();
  await AdsConsent.showPrivacyOptionsForm().catch(() => {});
}
