import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Calm } from '@/components/Calm';
import { Screen } from '@/components/Screen';
import { NemesisButton } from '@/bots/NemesisButton';
import { ChestButton } from '@/features/chests/ChestButton';
import { DailyButton } from '@/features/daily/DailyButton';
import { InboxButton } from '@/features/inbox/InboxButton';
import { useTheme } from '@/state/app';
import { TABLET, u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { LISTED } from './focus';
import { GameTagSheet } from './GameTag';
import { GameInfoSheet, GameList, Strip } from './GameList';
import { isAr, tr } from '@/i18n';


/** Gap between tablet strips, design px. */
const ROW_GAP = 8;
/** The tablet grid never scrolls back to a game, so it needs no strip positions. */
const noTop = () => {};

/**
 * The Games entrance page, "The programme" (option C, Yazan 2026-11-11): every game as a numbered strip, like a show's
 * running order. On a phone the list rolls slowly upward and no game can be tapped: the one Start opens the swipe pages.
 * On an Android tablet (Yazan 2026-11-12) all of them fit at once, standing still, and a tap on one opens that game.
 */
export function Programme() {
  return TABLET ? <TabletProgramme /> : <ListProgramme />;
}

/** The one Games page on a phone (Yazan 2026-11-12): every game in a still list, each box opens its loading page. */
function ListProgramme() {
  const [headH, setHeadH] = useState(0);
  return (
    <Screen tab="games" glow={0} symbols>
      <View style={s.fill}>
        {/* Calm edge under the title (Yazan 2026-11-16): the background turns plain navy where the list fades in. */}
        {headH ? <Calm stops={[[0, 0], [0.45, 0.35], [1, 1]]} style={{ top: 0, height: headH + u(2) }} /> : null}
        <Head end={tr('tap one to play')} onHeight={setHeadH} split />
        {headH ? <GameList top={headH + u(2)} /> : null}
        <Side split />
      </View>
      <GameTagSheet />
      <GameInfoSheet />
    </Screen>
  );
}

/** `split` (phone, Yazan 2026-11-13): two buttons each side of the title, so the games start higher. */
function Side({ split }: { split?: boolean }) {
  if (split)
    return (
      <>
        <InboxButton style={[s.sideL, { top: u(10) }]} />
        <DailyButton style={[s.sideL, { top: u(41) }]} />
        <ChestButton style={{ top: u(10) }} />
        <NemesisButton style={{ top: u(41) }} />
      </>
    );
  return (
    <>
      <InboxButton />
      <DailyButton />
      <ChestButton />
      <NemesisButton />
    </>
  );
}

function Head({ end, onHeight, split }: { end: string; onHeight?: (h: number) => void; split?: boolean }) {
  const t = useTheme();
  return (
    <View style={[s.head, split ? s.headSplit : null]} onLayout={onHeight ? (e) => onHeight(e.nativeEvent.layout.height) : undefined}>
      {split ? null : <Text style={[s.k, { color: t.accent }]}>{tr('TONIGHT ON THE WARD')}</Text>}
      <Text style={[s.h, { color: t.white }, split ? [s.mid, s.hSplit, isAr && s.hSplitAr] : null]}>
        {/* "+10 games" (Yazan 2026-11-13), not the exact count; Arabic keeps ألعاب كثير. */}
        {tr('{COUNT} games, ', { COUNT: '+10' })}
        <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>{end}</Text>
      </Text>
    </View>
  );
}

function TabletProgramme() {
  return (
    <Screen tab="games" glow={0} wide symbols>
      <View style={s.fill}>
        <Head end={tr('tap one to play')} />
        {/* rows of two, each the phone's own strip with its tags and ? (Yazan 2026-11-18); an odd last game sits alone at the start */}
        <View style={s.tGrid}>
          {Array.from({ length: Math.ceil(LISTED.length / 2) }, (_, r) => (
            <View key={r} style={s.tLine}>
              {[0, 1].map((c) => {
                const j = r * 2 + c;
                const g = LISTED[j];
                return g ? <View key={g.key} style={s.tCell}><Strip g={g} j={j} onTop={noTop} /></View> : <View key={c} style={s.tGap} />;
              })}
            </View>
          ))}
        </View>
        <Side />
      </View>
      <GameTagSheet />
      <GameInfoSheet />
    </Screen>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  head: { paddingTop: u(10), paddingStart: u(16), paddingEnd: u(44), paddingBottom: u(8), gap: u(2) },
  headSplit: { paddingStart: u(52), paddingEnd: u(52), minHeight: u(76), justifyContent: 'center' },
  sideL: { end: undefined, start: u(16) },
  mid: { textAlign: 'center' },
  hSplit: { fontSize: u(20), lineHeight: u(23) },
  // Arabic runs longer: about 11% smaller so the title sits on one line on normal phones (Yazan 2026-11-16, B).
  hSplitAr: { fontSize: u(17.8), lineHeight: u(20.5) },
  k: { fontFamily: F.mono, fontSize: u(9), lineHeight: u(12), letterSpacing: u(1.44) },
  h: { fontFamily: F.display, fontSize: u(24), lineHeight: u(26), letterSpacing: u(-0.4) },
  // tablet (Yazan 2026-11-12): the phone's own strips, two to a row, each one a button
  tGrid: { gap: u(ROW_GAP), paddingStart: u(16), paddingEnd: u(52), paddingTop: u(6) },
  tLine: { flexDirection: 'row', gap: u(10) },
  tGap: { flex: 1 },
  tCell: { flex: 1, minWidth: 0 },
});
