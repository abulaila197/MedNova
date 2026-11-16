import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { notice } from '@/components/Notice';
import { agoText } from '@/lib/copies';
import { isOnline, onBackOnline } from '@/lib/net';
import { tr } from '@/i18n';

// Each page says it once while the internet is away; the next time it goes away, it says it again.
const told = new Set<string>();
onBackOnline(() => told.clear());

/**
 * A page shown from its saved copy while the server can't be reached (#59). It was a line at the top of the page,
 * out of sight once the player scrolled; now a pop-up with an (x), once per page (Yazan 2026-11-16).
 */
export function OfflineLine({ at }: { at: number | null | undefined; style?: object }) {
  const path = usePathname();
  const shown = at != null;
  useEffect(() => {
    if (!shown || told.has(path)) return;
    told.add(path);
    const when = agoText(at!);
    notice(
      isOnline()
        ? { kick: tr('SAVED COPY'), title: tr('Couldn’t reach MedNova'), line: tr('What you see was last updated {n}.', { n: when }) }
        : { kick: tr('NO INTERNET'), title: tr('You’re offline'), line: tr('What you see was last updated {n}.', { n: when }) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, path]);
  return null;
}
