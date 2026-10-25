import { supabase } from '@/lib/supabase';
import { useAccount } from '@/state/account';

/** Put on a character you own; the server checks it is yours (set_avatar). */
export async function wearCharacter(slug: string): Promise<{ ok: boolean; why?: string }> {
  const { data, error } = await supabase.rpc('set_avatar', { slug });
  const r = data as { ok?: boolean; why?: string } | null;
  if (error || !r) return { ok: false, why: 'net' };
  if (!r.ok) return { ok: false, why: r.why ?? 'not owned' };
  const p = useAccount.getState().profile;
  if (p) useAccount.setState({ profile: { ...p, avatar: slug } });
  return { ok: true };
}
