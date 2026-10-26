import { wearCharacterNow } from '@/features/style/useStyle';

/** Put on a character you own; the server checks it is yours (set_avatar). Offline it is saved and sent later (#58). */
export async function wearCharacter(slug: string): Promise<{ ok: boolean; why?: string; queued?: boolean }> {
  const r = await wearCharacterNow(slug);
  return r.ok ? { ok: true, queued: r.queued } : { ok: false, why: r.why === 'offline' ? 'net' : r.why };
}
