// AdMob server-side verification (Group 2, 2026-11-07). Google calls this URL (GET) when a player watched a rewarded
// ad to the end; we check Google's signature, then pay through ad_reward_grant (+10 Sparks or 1 token, with the daily
// caps). Deployed with verify_jwt off: Google sends no Supabase key, the ECDSA signature is the check.
// Set as the "Server-side verification" callback URL on all 4 rewarded units in AdMob.
// Docs: developers.google.com/admob/android/ssv
import { createClient } from 'npm:@supabase/supabase-js@2';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Promise<Response>): void };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let keys: { at: number; byId: Map<string, CryptoKey> } | null = null;

const b64 = (s: string) => {
  const std = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(std + '='.repeat((4 - (std.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** Google's keys, kept for a day (they rotate rarely). */
async function getKey(id: string, fresh = false): Promise<CryptoKey | undefined> {
  if (!keys || fresh || Date.now() - keys.at > 86_400_000) {
    const res = await fetch(KEYS_URL);
    const json = (await res.json()) as { keys: { keyId: number; base64: string }[] };
    const byId = new Map<string, CryptoKey>();
    for (const k of json.keys) {
      byId.set(String(k.keyId), await crypto.subtle.importKey('spki', b64(k.base64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']));
    }
    keys = { at: Date.now(), byId };
  }
  return keys.byId.get(id);
}

/** DER ECDSA signature -> the 64-byte r||s form WebCrypto checks. */
function derToRaw(der: Uint8Array): Uint8Array<ArrayBuffer> {
  let i = 2;
  if (der[1] & 0x80) i += der[1] & 0x7f;
  const part = () => {
    if (der[i++] !== 0x02) throw new Error('der');
    const len = der[i++];
    let v = der.slice(i, i + len);
    i += len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);
    return out;
  };
  const r = part();
  const s = part();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const q = url.search.slice(1);
  const cut = q.indexOf('&signature=');
  if (cut < 0) return new Response('bad request', { status: 400 });
  const message = new TextEncoder().encode(q.slice(0, cut));
  const p = url.searchParams;
  const sig = p.get('signature') ?? '';
  const keyId = p.get('key_id') ?? '';
  try {
    let key = await getKey(keyId);
    if (!key) key = await getKey(keyId, true);
    if (!key) return new Response('unknown key', { status: 400 });
    const good = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(b64(sig)), message);
    if (!good) return new Response('bad signature', { status: 403 });
  } catch {
    return new Response('bad signature', { status: 403 });
  }
  const uid = p.get('user_id') ?? '';
  const tx = p.get('transaction_id') ?? '';
  // AdMob's "Verify URL" test sends no user: say yes so the setting saves.
  if (!UUID.test(uid)) return new Response('ok (no MedNova user)', { status: 200 });
  const { data, error } = await admin.rpc('ad_reward_grant', { tx, uid, custom: p.get('custom_data') ?? '' });
  if (error) return new Response('error', { status: 500 }); // Google retries later
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
