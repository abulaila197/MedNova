import { useEffect, useState, type MutableRefObject, type ReactNode, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { u } from '@/theme/scale';

import { Board, type BoardHandle, type Stroke } from './Board';
import { ChalkTitle, Frame, Note, PausedCover, SL, useSlateRoom } from './slate';

/**
 * The framed board sized to the free space. The shape is fixed the first time it is measured for a turn
 * (`boardKey`), so the drawing never stretches when the controls under it change (who got it, steal).
 */
export function FitBoard({ boardKey, boardRef, shapeRef, ink, size, erase, enabled, initial, paused }: { boardKey: string | number; boardRef?: Ref<BoardHandle>; shapeRef?: MutableRefObject<number>; ink: number; size: number; erase: boolean; enabled: boolean; initial?: Stroke[]; paused?: boolean }) {
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  const [shape, setShape] = useState<{ key: string | number; ratio: number } | null>(null);
  const fw = SL.frameW * 2;
  const room = useSlateRoom();
  let ratio = shape?.key === boardKey ? shape.ratio : null;
  if (area && ratio == null) {
    ratio = Math.max(0.6, Math.min(1.5, (area.h - fw) / Math.max(1, area.w - fw)));
    setShape({ key: boardKey, ratio });
  }
  useEffect(() => {
    if (shapeRef && ratio) shapeRef.current = ratio;
  }, [shapeRef, ratio]);
  const width = area && ratio ? Math.min(area.w, (area.h - fw) / ratio + fw) : 0;
  return (
    <View style={s.fill} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {area && ratio ? (
        <Frame style={{ width }}>
          <Board key={boardKey} ref={boardRef} color={SL.inks[ink]} width={SL.sizes[size]} erase={erase} bg={room.board} enabled={enabled && !paused} initial={initial} ratio={ratio} />
          {paused ? <PausedCover /> : null}
        </Frame>
      ) : null}
    </View>
  );
}

/** Acting turn (SA4): no board, a chalk mime in the frame and the house rules. */
export function ActingCard({ children, paused }: { children?: ReactNode; paused?: boolean }) {
  const c = SL.chalk;
  const room = useSlateRoom();
  return (
    <View style={s.fill}>
      <Frame style={[s.act]}>
        <Svg width={u(84)} height={u(96)} viewBox="0 0 84 96">
          <Circle cx={42} cy={16} r={10} stroke={c} strokeWidth={3} fill="none" />
          <Path d="M42 26 L42 60 M42 36 L20 22 M42 36 L66 24 M42 60 L26 90 M42 60 L58 90" stroke={c} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d="M36 15 l3 0 M45 15 l3 0 M38 21 q4 2 8 0" stroke={c} strokeWidth={1.6} strokeLinecap="round" fill="none" />
        </Svg>
        <ChalkTitle size={26} color={SL.chalk} style={{ textAlign: 'center' }}>
          Act it out
        </ChalkTitle>
        <Note style={{ textAlign: 'center', maxWidth: u(210), color: room.boardSoft }}>No sounds, no words, no mouthing letters, no pointing at things in the room.</Note>
        {children}
        {paused ? <PausedCover /> : null}
      </Frame>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: u(120) },
  act: { alignSelf: 'stretch', flex: 1, alignItems: 'center', justifyContent: 'center', gap: u(10), padding: u(16) },
});
