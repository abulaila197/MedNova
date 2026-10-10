import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { Mode, Seat } from '../engine/types';
import { Btn, Ghost, Kick } from './ui';

/**
 * Shared pause menu. The game hides its case while this is open (pause + hide).
 * Solo: quitting bookmarks the play (rule 7). One phone: tap a player to remove them (rule 17).
 * Settings are not here on purpose (rule 9).
 */
export function PauseMenu({ open, mode, seats, keep = [], onResume, onQuit, onRemove }: { open: boolean; mode: Mode; seats?: Seat[]; keep?: number[]; onResume: () => void; onQuit: () => void; onRemove?: (seat: number) => void }) {
  const t = useTheme();
  const active = (seats ?? []).filter((x) => !x.removed);
  return (
    <Sheet open={open} onClose={onResume}>
      <Kick>{mode === 'online' ? 'Match menu' : 'Paused'}</Kick>
      {mode === 'offline' && onRemove && active.length > 2 ? (
        <View style={{ gap: u(6) }}>
          <Text style={[s.lbl, { color: t.mute }]}>Tap a player to remove them. Their turns are skipped.</Text>
          <View style={s.seats}>
            {active.filter((x) => !keep.includes(x.seat)).map((x) => (
              <Pressable key={x.seat} onPress={() => onRemove(x.seat)} style={[s.seat, { borderColor: t.chipLine, backgroundColor: t.chip }]} accessibilityRole="button" accessibilityLabel={`Remove ${x.name}`}>
                <Text style={[s.seatT, { color: t.fg }]}>{x.name} ✕</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {mode === 'online' ? <Text style={[s.lbl, { color: t.mute }]}>The match keeps running. If you leave, you drop out and rank last.</Text> : null}
      <Btn label={mode === 'online' ? 'Back to the case' : 'Resume'} onPress={onResume} />
      <Ghost label={mode === 'solo' ? 'Leave and save my place' : mode === 'online' ? 'Leave match' : 'End game'} onPress={onQuit} danger={mode !== 'solo'} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  lbl: { fontFamily: F.body, fontSize: u(11), lineHeight: u(15) },
  seats: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6) },
  seat: { borderWidth: 1, borderRadius: u(12), paddingVertical: u(7), paddingHorizontal: u(11) },
  seatT: { fontFamily: F.bodySemi, fontSize: u(11) },
});
