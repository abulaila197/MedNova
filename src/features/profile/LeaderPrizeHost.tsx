import { useEffect, useState } from 'react';

import { Congrats } from '@/components/Congrats';
import { GAMES } from '@/data/games';
import { useSession } from '@/games/shell/session';
import { supabase } from '@/lib/supabase';
import { syncAccount } from '@/lib/sync';
import { tr } from '@/i18n';

type Paid = { month: string; board: string; rank: number; tokens: number };
const MONTHS = [tr('January'), tr('February'), tr('March'), tr('April'), tr('May'), tr('June'), tr('July'), tr('August'), tr('September'), tr('October'), tr('November'), tr('December')];
const place = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const boardName = (b: string) => (b === 'all' ? tr('All games') : (GAMES.find((g) => g.key === b)?.em ?? b));

/**
 * Monthly leaderboard prizes (#73): once a session after sign-in, asks the server to pay any prize from a month that
 * ended, and shows what arrived.
 */
export function LeaderPrizeHost() {
  const userId = useSession((x) => x.userId);
  const [paid, setPaid] = useState<Paid[]>([]);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    supabase.rpc('lb_claim').then(({ data }) => {
      const got = ((data as { paid?: Paid[] } | null)?.paid ?? []).filter((x) => x.tokens > 0);
      if (!live || !got.length) return;
      setPaid(got);
      syncAccount(userId).catch(() => {});
    });
    return () => {
      live = false;
    };
  }, [userId]);
  if (!paid.length) return null;
  const month = MONTHS[Number(paid[0].month.slice(5, 7)) - 1] ?? '';
  const line = paid.map((x) => tr('{n} in {n2}', { n: place(x.rank), n2: boardName(x.board) })).join(', ');
  return (
    <Congrats
      open
      tokens={paid.reduce((n, x) => n + x.tokens, 0)}
      title={tr('{month}\'s leaderboard', { month })}
      line={tr('You finished {line}. Your tokens are in your wallet.', { line })}
      onClose={() => setPaid([])}
    />
  );
}
