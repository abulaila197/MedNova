import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { sfxVerdict } from '@/lib/sound';
import { u, useScreen } from '@/theme/scale';

import { groupById } from './data';
import type { Board, BoardRun, Verdict } from './core';
import { HelperButton } from '../shell/ui';
import { Bar, GroupRow, Note, Stamp, TableBtn, Tiles, useTileFit } from './Table';
import { tr } from '@/i18n';

/**
 * The board in play: found groups on top, the boxes, then the free space where "One away" and the hint show, and the
 * buttons. `onSubmit` judges the four picked boxes and returns what happened. `who` names who found each group
 * (Pass the phone), `hint` is the hint button (Solo only).
 */
export function BoardView({ board, run, top, onSubmit, onShuffle, hint, tip = tr('Tap 4 boxes, then Submit'), who, locked, extra, rightStamp }: {
  board: Board; run: BoardRun; top: ReactNode; onSubmit: (tiles: number[]) => Verdict; onShuffle: () => void;
  hint?: { label: string; onPress: () => void; disabled?: boolean } | null; tip?: string; who?: Record<number, string>; locked?: boolean; extra?: ReactNode; rightStamp?: string;
}) {
  const { width } = useScreen();
  // The boxes take the width they are given (full width on a tablet), four to a row, up to 620 wide.
  const [box, setBox] = useState(0);
  const W = Math.min(box || Math.min(width, 430) - u(32), 620);
  const [picked, setPicked] = useState<number[]>([]);
  const { fit, measure } = useTileFit(board, W);
  // A found group lands on top: bring the boxes left back into view.
  const scroller = useRef<ScrollView>(null);
  const found = run.found.length;
  useEffect(() => {
    if (found) scroller.current?.scrollToEnd({ animated: true });
  }, [found]);
  const [stamp, setStamp] = useState<{ text: string; tone: 'red' | 'gold'; n: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  // Boxes that left the table (a group found) drop out of the pick.
  const live = picked.filter((t) => run.order.includes(t));
  const show = (text: string, tone: 'red' | 'gold') => {
    if (timer.current) clearTimeout(timer.current);
    setStamp((x) => ({ text, tone, n: (x?.n ?? 0) + 1 }));
    timer.current = setTimeout(() => setStamp(null), 1800);
  };
  const tap = (t: number) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : p.length >= 4 ? p : [...p, t]));
  const send = () => {
    if (live.length !== 4) return;
    const v = onSubmit(live);
    if (v === 'right') {
      void sfxVerdict(true);
      if (rightStamp) show(rightStamp, 'gold');
      else setPicked([]);
    } else if (v === 'oneAway') {
      void sfxVerdict(false);
      show(tr('One away'), 'red');
    } else if (v === 'wrong') {
      void sfxVerdict(false);
      show(tr('Not a group'), 'red');
    } else if (v === 'repeat') show(tr('Already tried'), 'gold');
  };
  const topic = run.revealed != null ? groupById.get(board.groups[run.revealed].id)?.n : null;
  return (
    <View style={{ flex: 1, gap: u(8) }} onLayout={(e) => setBox(e.nativeEvent.layout.width)}>
      {top}
      {/* Found groups, the boxes and the free space scroll together above the pinned buttons (Yazan 2026-11-24): the
          boxes keep one size that fits their words, and a short screen scrolls instead of squeezing them. */}
      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ gap: u(8) }} showsVerticalScrollIndicator={false}>
        {run.found.map((slot) => (
          <GroupRow key={slot} board={board} slot={slot} who={who?.[slot]} />
        ))}
        {fit ? (
          <View style={{ width: W, alignSelf: 'center' }}>
            <Tiles board={board} order={run.order} picked={live} onTap={locked ? undefined : tap} width={W} fit={fit} />
          </View>
        ) : null}
      </ScrollView>
      {/* The verdict ("Not a group", "One away") and the tip have their own line right above the buttons, outside the
          scrolling board (Yazan 2026-11-24): tall boards used to push them off screen or behind the buttons. */}
      <View style={{ minHeight: u(46), justifyContent: 'center', alignItems: 'center', gap: u(8) }}>
        {stamp ? <Stamp key={stamp.n} text={stamp.text} tone={stamp.tone} /> : topic ? <Note>{tr('Hint: one group is “{topic}”', { topic })}</Note> : <Note>{tip}</Note>}
        {extra}
      </View>
      {measure}
      <Bar>
        <TableBtn label={tr('Shuffle')} onPress={onShuffle} disabled={locked} />
        <TableBtn label={tr('Deselect')} onPress={() => setPicked([])} disabled={locked || !live.length} />
        {hint ? <HelperButton label={hint.label} tone="purple" onPress={hint.onPress} disabled={locked || hint.disabled} style={{ flex: 1.3, borderRadius: 999, paddingVertical: u(10), paddingHorizontal: u(4) }} /> : null}
        <TableBtn label={tr('Submit')} go flex={hint ? 1.2 : 1.4} onPress={send} disabled={locked || live.length !== 4} />
      </Bar>
    </View>
  );
}
