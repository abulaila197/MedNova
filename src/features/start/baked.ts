/**
 * The one switch for the start flow's pre-rendered art (Yazan 2026-10-19). true: the Sky, the slide veils and the
 * slide 3 photo fade are still images, and the intro wordmark's glow is a pre-blurred image inside the Lottie, so
 * nothing is drawn or blurred live. false: the original live drawing (SVG gradients, masks, Lottie Gaussian Blur).
 * Both look the same; before/after screenshots are in build/fix-audit/fixes/bake/. The images are rebuilt with
 * scripts/bake-start-art/ (see finish.py) whenever Sky.tsx, the SCENES veils or the wordmark change.
 */
export const BAKED_ART = true;

export const BAKED = {
  sky: require('@/assets/onboarding/baked/sky.png'),
  veils: [
    require('@/assets/onboarding/baked/veil-1.png'),
    require('@/assets/onboarding/baked/veil-2.png'),
    require('@/assets/onboarding/baked/veil-3.png'),
  ],
  /** nova-community.jpg with Scene's 'top' fade mask baked into its alpha (lossless). */
  communityFade: require('@/assets/onboarding/baked/nova-community-fade.webp'),
  wordmark: require('@/assets/motion/mednova-wordmark-baked.json'),
};
