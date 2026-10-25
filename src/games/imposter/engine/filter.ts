import blocklist from '../data/blocklist.json';
import { MEDICAL_ALLOWLIST } from './medicalAllowlist';
import { createProfanityChecker } from './profanity';

/** The clue and guess filter: badwords-list (scripts/build-imposter-blocklist.mjs), with medical words always allowed. */
export const PROFANITY = createProfanityChecker({ blocklist, allowlist: MEDICAL_ALLOWLIST });
