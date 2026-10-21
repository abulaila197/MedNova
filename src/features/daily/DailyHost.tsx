import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { localDay } from '@/games/engine/gate';
import { defaultKV } from '@/games/engine/storage';
import { useSession } from '@/games/shell/session';
import { supabase } from '@/lib/supabase';
import { syncAccount } from '@/lib/sync';
import { useBack } from '@/lib/useBack';
import { usePopups } from '@/state/popups';
import { useStart } from '@/state/start';

import { useWelcome } from '../welcome/WelcomeHost';
import { DailyPopup } from './DailyPopup';

const kv = defaultKV();
const GUEST_SEEN = 'daily:guest_seen';

type Open = { day: number; collected: boolean };

/**
 * Shows the daily pop-up on the first Games page visit of the player's day, once the intro is over.
 * Signed in: the server says where the calendar is and pays the claim. Guests see it once a day, locked (DL4).
 */
export function DailyHost() {
  const path = usePathname();
  const intro = useStart((s) => s.intro);
  const userId = useSession((s) => s.userId);
  const known = useSession((s) => s.known);
  // The welcome tour comes first on the very first open (Yazan, 2026-10-13).
  const welcomed = useWelcome((s) => s.state === 'done');
  const [open, setOpen] = useState<Open | null>(null);
  const checked = useRef<string | null>(null); // `${user}:${date}` already looked at
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const claiming = useRef(false);
  // Looks again when the app comes back to the front and at the phone's midnight, so a Games page left open
  // over midnight still gets the new day's pop-up (AP12a).
  const [wake, setWake] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st === 'active' && setWake((n) => n + 1));
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5).getTime() - now.getTime();
    const id = setTimeout(() => setWake((n) => n + 1), midnight);
    return () => {
      sub.remove();
      clearTimeout(id);
    };
  }, [wake]);

  useEffect(() => {
    if (!known || intro || !welcomed || path !== '/games') return;
    const today = localDay();
    const key = `${userId ?? 'guest'}:${today}`;
    if (checked.current === key) return;
    checked.current = key;
    void (async () => {
      if (!userId) {
        if ((await kv.get<string>(GUEST_SEEN).catch(() => null)) === today) return;
        await kv.set(GUEST_SEEN, today).catch(() => {});
        setOpen({ day: 1, collected: false });
        return;
      }
      const { data, error: e } = await supabase.rpc('daily_status');
      if (e || !data) {
        if (checked.current === key) checked.current = null; // offline: try again on the next visit
        return;
      }
      const st = data as { next_day: number; last_date: string | null };
      if (st.last_date === today) return;
      setOpen({ day: st.next_day, collected: false });
    })();
  }, [known, intro, welcomed, path, userId, wake]);

  // The found-card pop-up waits while this one is up.
  useEffect(() => usePopups.setState({ daily: !!open }), [open]);

  // Android back closes the pop-up (PB3).
  useBack(!!open, () => setOpen(null));
  if (!open) return null;

  const collect = async () => {
    if (claiming.current) return; // a double tap claims once (AP10a)
    claiming.current = true;
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('daily_claim', {
      local_date: localDay(),
    });
    setBusy(false);
    claiming.current = false;
    const r = data as { ok: boolean; day?: number; why?: string } | null;
    if (e || !r) return setError('Could not reach MedNova. Check your connection and try again.');
    if (!r.ok)
      return setError(r.why === 'done' ? "You've already grabbed today's reward." : "Your phone's date looks off, so today's reward can't be given. Check your date settings.");
    setOpen({ day: r.day ?? open.day, collected: true });
    if (userId) syncAccount(userId).catch(() => {}); // brings the new tokens down to the wallet
  };

  return (
    <DailyPopup
      day={open.day}
      collected={open.collected}
      signedIn={!!userId}
      busy={busy}
      error={error}
      onCollect={collect}
      onSignIn={() => {
        setOpen(null);
        router.navigate('/auth');
      }}
      onClose={() => setOpen(null)}
    />
  );
}
