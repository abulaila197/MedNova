import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';

import { defaultKV } from '@/games/engine/storage';
import { usePopups } from '@/state/popups';

import { HELP } from './help';
import { useWelcome } from './WelcomeHost';
import { WelcomeTour } from './WelcomeTour';

const kv = defaultKV();
const seenKey = (page: string) => `help:seen:${page}`;

/** Shows a page's help once per phone, on its first visit after the welcome tour (Yazan 2026-10-21). */
export function HelpHost() {
  const path = usePathname();
  const welcomed = useWelcome((s) => s.state === 'done');
  const [page, setPage] = useState<string | null>(null);

  useEffect(() => {
    if (!welcomed || page === path || !HELP[path]) return;
    let live = true;
    void kv
      .get<boolean>(seenKey(path))
      .catch(() => null)
      .then((seen) => {
        if (live && !seen) setPage(path);
      });
    return () => {
      live = false;
    };
  }, [path, welcomed, page]);
  // Left the page before finishing: it hides, and shows again on the next visit.
  const open = !!page && page === path;
  useEffect(() => usePopups.setState({ help: open }), [open]);

  if (!open || !page) return null;
  const close = () => {
    kv.set(seenKey(page), true).catch(() => {});
    setPage(null);
  };
  return <WelcomeTour key={page} stops={HELP[page]} lastLabel="Got it" skipLabel="Skip" onClose={close} />;
}
