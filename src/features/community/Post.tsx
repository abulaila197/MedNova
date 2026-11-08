import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { PulseStar } from '@/components/PulseStar';
import { useLike } from '@/features/community/likes';
import { tapped } from '@/lib/sound';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/**
 * An announcement from the MedNova team (Yazan, 2026-10-13: the Community page is announcements). The like
 * counter sits next to the post: one shared count for everyone (#25).
 */
export function Post({ id, kick, lead, em, body }: { id: string; kick: string; lead: string; em: string; body: string[] }) {
  const t = useTheme();
  const like = useLike(`post:${id}`);
  const liked = like.mine;
  return (
    <View style={[s.card, { backgroundColor: t.panel2, borderColor: t.panelLine }]}>
      <View style={s.from}>
        <PulseStar width={u(18)} height={u(18)} glow={0.3} />
        <Text style={[s.who, { color: t.fg }]}>The MedNova team</Text>
        <Text style={[s.kick, { color: t.kick }]}>{kick}</Text>
      </View>
      <Text style={[s.title, { color: t.white }]}>
        {lead} <Text style={{ fontFamily: F.displayItalic, color: t.accent }}>{em}</Text>
      </Text>
      {body.map((p, i) => (
        <Text key={i} style={[s.body, { color: t.soft }]}>
          {p}
        </Text>
      ))}
      <Pressable onPress={tapped(like.toggle)} style={[s.like, { borderColor: liked ? t.accent : t.chipLine, backgroundColor: t.chip }]} accessibilityRole="button" accessibilityState={{ selected: liked }} accessibilityLabel={liked ? 'Unlike' : 'Like'}>
        <Text style={[s.heart, { color: liked ? t.accent : t.mute }]}>{liked ? '♥' : '♡'}</Text>
        <Text style={[s.count, { color: liked ? t.accent : t.fg }]}>{like.n}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: u(18), borderWidth: 1, padding: u(14), gap: u(8) },
  from: { flexDirection: 'row', alignItems: 'center', gap: u(7) },
  who: { fontFamily: F.bodySemi, fontSize: u(11), flex: 1 },
  kick: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.4) },
  title: { fontFamily: F.display, fontSize: u(21), lineHeight: u(24), marginTop: u(2) },
  body: { fontFamily: F.body, fontSize: u(12.5), lineHeight: u(18.5) },
  like: { flexDirection: 'row', alignItems: 'center', gap: u(6), alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: u(12), paddingVertical: u(5), marginTop: u(2) },
  heart: { fontSize: u(13) },
  count: { fontFamily: F.bodySemi, fontSize: u(11.5) },
});
