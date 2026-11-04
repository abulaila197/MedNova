import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';

import { useSession } from '@/games/shell/session';
import { isHelpSeen, loadHelpSeen, markHelpSeen, useHelpSeen } from '@/state/helpSeen';
import { usePopups } from '@/state/popups';

import { HELP } from './help';
import { useWelcome } from './WelcomeHost';
import { WelcomeTour } from './WelcomeTour';

/** Shows a page's help once, on its first visit after the welcome tour (Yazan 2026-10-21). Seen is kept on the account too (2026-11-04). */
export function HelpHost() {
  const path = usePathname();
  const welcomed = useWelcome((s) => s.state === 'done');
  const [page, setPage] = useState<string | null>(null);
  const uid = useSession((s) => s.userId);
  const ready = useHelpSeen((s) => s.ready && s.owner === uid);
  useEffect(() => loadHelpSeen(), [uid]);

  useEffect(() => {
    if (!welcomed || !ready || page === path || !HELP[path]) return;
    let live = true;
    void isHelpSeen(path)
      .catch(() => false)
      .then((seen) => {
        if (live && !seen) setPage(path);
      });
    return () => {
      live = false;
    };
  }, [path, welcomed, ready, page]);
  // Left the page before finishing: it hides, and shows again on the next visit.
  const open = !!page && page === path;
  useEffect(() => usePopups.setState({ help: open }), [open]);

  if (!open || !page) return null;
  const close = () => {
    markHelpSeen(page);
    setPage(null);
  };
  return <WelcomeTour key={page} stops={HELP[page]} lastLabel="Got it" skipLabel="Skip" onClose={close} />;
}
