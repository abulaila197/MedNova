import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';

import { Text, TextInput } from '@/components/AppText';
import { GAMES, PARKED_GAMES } from '@/data/games';
import { s as ui, type useInfo } from '@/features/info/ui';
import { PlayerFace } from '@/features/style/Frame';
import { CHARACTERS, MECH_CHARACTERS, SHOP_CHARACTERS, TEAM_CHARACTERS } from '@/games/shell/characters';
import { supabase } from '@/lib/supabase';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

type C = ReturnType<typeof useInfo>;
type Sort = 'active' | 'newest' | 'level' | 'days';
export type AdminPlayer = {
  id: string;
  username: string;
  display_name: string;
  avatar: string | null;
  level: number;
  exp: number;
  created_at: string;
  last_seen: string | null;
  providers: string[];
  unlimited: boolean;
  banned: boolean;
  /** Yazan 2026-11-12: days the player was active since 11 Nov (Egypt time), and the days in a row up to today. */
  active_days?: number;
  active_streak?: number;
};
type Summary = { total: number; online: number; today: number; new: number; banned: number };
type Detail = {
  exp: number;
  level: number;
  tokens: number;
  sparks: number | null;
  plays: number;
  online: number;
  friends: number;
  top_games: { game: string; n: number }[];
  reports: { at: string; chips?: string[]; body?: string }[];
  reports_total: number;
  ban: { reason: string; at: string } | null;
};

const PAGE = 50;
/** The app pings last_seen every minute while open (friends.ts), so 2 minutes = online now. */
const ONLINE_MS = 2 * 60 * 1000;
const REFRESH_MS = 30 * 1000;
const GREEN = '#3ecf8e';
const SORTS: { k: Sort; label: string }[] = [
  { k: 'active', label: 'Last active' },
  { k: 'newest', label: 'Newest' },
  { k: 'level', label: 'Level' },
  { k: 'days', label: 'Active days' },
];
/** Unlimited the admin can give (Yazan 2026-11-11), added on top of any time left. */
const UNLIMITED_DAYS: { d: number; label: string }[] = [
  { d: 7, label: '7 days' },
  { d: 30, label: '1 month' },
  { d: 90, label: '3 months' },
  { d: 365, label: '1 year' },
];
/** Every character a player can own (Bolt and Iris are open to all; Admin stays yours). */
const UNLOCKABLE = [...CHARACTERS, ...MECH_CHARACTERS, ...SHOP_CHARACTERS].filter((x) => !['bolt', 'iris', 'admin'].includes(x.slug));
const PROVIDER: Record<string, string> = { google: 'Google', apple: 'Apple', email: 'Email' };
const gameName = (key: string) => {
  const g = [...GAMES, ...PARKED_GAMES].find((x) => x.key === key);
  return g ? `${g.lead} ${g.em}` : key;
};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "30 Sep", with the year only when it isn't this year. */
const day = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MON[d.getMonth()]}${d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`}`;
};
const ago = (iso: string | null) => {
  if (!iso) return 'never';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d} d ago` : day(iso);
};
const isOnline = (p: AdminPlayer) => !!p.last_seen && Date.now() - new Date(p.last_seen).getTime() < ONLINE_MS;

/**
 * Players (Yazan 2026-11-09): live counts and the list of every account, with actions per player:
 * message or gift (fills the Send to Inbox form), take tokens back, details, reset a rude name, ban or unban.
 * Refreshes every 30 seconds while the page is open and the app is in front.
 */
export function Players({ c, onMessage, onTakeBack }: { c: C; onMessage: (p: AdminPlayer) => void; onTakeBack: (p: AdminPlayer) => void }) {
  const [sum, setSum] = useState<Summary | null>(null);
  const [rows, setRows] = useState<AdminPlayer[] | null>(null);
  const [more, setMore] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('active');
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const shown = useRef(PAGE); // how many rows the live refresh reloads
  const ask = useRef(0); // a slow answer for an older search must not replace a newer list

  const load = useCallback(
    async (count: number) => {
      const id = ++ask.current;
      const [a, b] = await Promise.all([
        supabase.rpc('admin_players_summary'),
        supabase.rpc('admin_players', { q: q.trim().replace(/^@/, ''), sort, lim: count, off: 0 }),
      ]);
      if (id !== ask.current) return;
      setErr(!!(a.error || b.error));
      if (!a.error) setSum(a.data as Summary);
      if (!b.error) {
        const list = (b.data as AdminPlayer[]) ?? [];
        setRows(list);
        setMore(list.length >= count);
      }
    },
    [q, sort],
  );

  // A new search or sort starts from the first 50 again, after a short pause in typing.
  useEffect(() => {
    shown.current = PAGE;
    const t = setTimeout(() => void load(PAGE), 300);
    return () => clearTimeout(t);
  }, [load]);
  // Live: reload what is shown every 30 seconds while the app is in front.
  useEffect(() => {
    const t = setInterval(() => {
      if (AppState.currentState === 'active') void load(shown.current);
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const loadMore = () => {
    shown.current += PAGE;
    void load(shown.current);
  };
  const patch = (id: string, p: Partial<AdminPlayer>) => setRows((l) => (l ?? []).map((r) => (r.id === id ? { ...r, ...p } : r)));

  const stats: [string, number | undefined, string?][] = [
    ['Accounts', sum?.total],
    ['Online now', sum?.online, GREEN],
    ['Active 24 h', sum?.today],
    ['New 24 h', sum?.new],
  ];
  return (
    <>
      <Text style={[ui.H, s.H, s.gapL, { color: c.fg }]}>Players</Text>
      <Text style={[ui.p, { color: c.mute }]}>Every account, live: refreshes every 30 seconds. Tap a player for actions. Guests are not counted; they only exist on their phones. Active days count from 11 Nov, Egypt time.</Text>
      <View style={[s.stats, s.gap]}>
        {stats.map(([label, n, col]) => (
          <View key={label} style={[s.stat, { borderColor: c.line, backgroundColor: c.surf }]}>
            <Text style={[s.statN, { color: col ?? c.fg }]}>{n == null ? '…' : n.toLocaleString('en-GB')}</Text>
            <Text style={[s.small, { color: c.mute }]}>{label}</Text>
          </View>
        ))}
      </View>
      {sum?.banned ? <Text style={[s.small, s.gapS, { color: c.mute }]}>{`${sum.banned} banned`}</Text> : null}

      <TextInput value={q} onChangeText={setQ} placeholder="Search a username or name" placeholderTextColor={c.mute} autoCapitalize="none" autoCorrect={false} style={[s.in, s.gap, { backgroundColor: c.surf, borderColor: c.line, color: c.fg }]} />
      <View style={[s.chips, s.gapS]}>
        {SORTS.map((x) => (
          <Pressable key={x.k} onPress={() => setSort(x.k)} accessibilityRole="tab" accessibilityState={{ selected: sort === x.k }} style={[s.chip, { borderColor: sort === x.k ? c.chipOnLine : c.line, backgroundColor: sort === x.k ? c.chipOnFill : 'transparent' }]}>
            <Text style={[s.chipT, { color: sort === x.k ? c.fg : c.mute }]}>{x.label}</Text>
          </Pressable>
        ))}
      </View>
      {err ? <Text style={[s.small, s.gapS, { color: c.t.error }]}>Could not load players. Check the connection.</Text> : null}
      {rows && !rows.length ? <Text style={[s.small, s.gapS, { color: c.mute }]}>{q.trim() ? 'No player matches that.' : 'No players yet.'}</Text> : null}

      <View style={s.list}>
        {(rows ?? []).map((p) => (
          <View key={p.id} style={[s.card, { borderColor: open === p.id ? c.chipOnLine : c.line, opacity: p.banned ? 0.6 : 1 }]}>
            <Pressable onPress={() => setOpen(open === p.id ? null : p.id)} accessibilityRole="button" accessibilityState={{ expanded: open === p.id }} accessibilityLabel={`@${p.username}, actions`} style={s.row}>
              <View>
                <PlayerFace slug={p.avatar || 'yara'} size={u(30)} userId={p.id} still />
                {isOnline(p) ? <View style={[s.dot, { borderColor: c.surf }]} /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.name, { color: c.fg }]} numberOfLines={1}>{p.display_name || p.username}</Text>
                <Text style={[s.small, { color: c.mute }]} numberOfLines={1}>{`@${p.username} · Lv ${p.level} · ${p.providers.map((x) => PROVIDER[x] ?? x).join(', ') || 'Email'}`}</Text>
                <Text style={[s.small, { color: isOnline(p) ? GREEN : c.mute }]} numberOfLines={1}>
                  {`${isOnline(p) ? 'Online now' : `Seen ${ago(p.last_seen)}`} · Joined ${day(p.created_at)}`}
                </Text>
                {p.active_days != null ? (
                  <Text style={[s.small, { color: c.mute }]} numberOfLines={1}>
                    {`Active ${p.active_days} ${p.active_days === 1 ? 'day' : 'days'} · ${p.active_streak ? `🔥 ${p.active_streak} in a row` : 'no streak now'}`}
                  </Text>
                ) : null}
              </View>
              <View style={s.tags}>
                {p.unlimited ? <Tag text="Unlimited" color={c.t.accent} /> : null}
                {p.banned ? <Tag text="Banned" color={c.t.error} /> : null}
              </View>
            </Pressable>
            {open === p.id ? <Actions c={c} p={p} onMessage={onMessage} onTakeBack={onTakeBack} onChange={(x) => (patch(p.id, x), void load(shown.current))} /> : null}
          </View>
        ))}
      </View>
      {more ? (
        <Pressable onPress={loadMore} accessibilityRole="button" style={[s.chip, s.gapS, { borderColor: c.line, alignSelf: 'center' }]}>
          <Text style={[s.chipT, { color: c.fg }]}>Load more</Text>
        </Pressable>
      ) : null}
    </>
  );
}

function Chip({ c, label, onPress, color }: { c: C; label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[s.chip, { borderColor: color ?? c.line }]}>
      <Text style={[s.chipT, { color: color ?? c.fg }]}>{label}</Text>
    </Pressable>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <View style={[s.tag, { borderColor: color }]}>
      <Text style={[s.tagT, { color }]}>{text}</Text>
    </View>
  );
}

/** One player's details and actions. Rename and ban ask for a second tap. */
function Actions({ c, p, onMessage, onTakeBack, onChange }: { c: C; p: AdminPlayer; onMessage: (p: AdminPlayer) => void; onTakeBack: (p: AdminPlayer) => void; onChange: (x: Partial<AdminPlayer>) => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [sure, setSure] = useState<'' | 'rename' | 'ban'>('');
  // Give Unlimited / Unlock character: the choices open under the chips; each sends the player an Inbox note.
  const [pane, setPane] = useState<'' | 'unlimited' | 'character'>('');
  const [why, setWhy] = useState('');
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const busy = useRef(false);
  const reload = useCallback(() => {
    supabase.rpc('admin_player', { target: p.id }).then(({ data, error }) => (error ? setMsg({ text: 'Could not load details.', bad: true }) : setD(data as Detail)));
  }, [p.id]);
  useEffect(reload, [reload]);

  const rename = async () => {
    if (sure !== 'rename') return setSure('rename');
    if (busy.current) return;
    busy.current = true;
    const { data, error } = await supabase.rpc('admin_reset_name', { target: p.id });
    busy.current = false;
    setSure('');
    if (error) return setMsg({ text: 'Not saved. Check the connection.', bad: true });
    onChange({ username: String(data), display_name: 'Doctor' });
    setMsg({ text: 'Name reset. They pick a new one the next time they open the app.' });
  };
  const ban = async () => {
    if (!p.banned && sure !== 'ban') return setSure('ban');
    if (busy.current) return;
    busy.current = true;
    const { error } = await supabase.rpc('admin_ban', { target: p.id, banned: !p.banned, reason: why.trim() });
    busy.current = false;
    setSure('');
    if (error) return setMsg({ text: 'Not saved. Check the connection.', bad: true });
    onChange({ banned: !p.banned });
    setMsg({ text: p.banned ? 'Unbanned. They can challenge friends and join the leaderboard again.' : 'Banned: no friend challenges, chat or leaderboard. Solo and Vs rivals still work.' });
    setWhy('');
    reload();
  };

  const giveUnlimited = async (days: number, label: string) => {
    if (busy.current) return;
    busy.current = true;
    const { data, error } = await supabase.rpc('admin_give_unlimited', { target: p.id, days });
    busy.current = false;
    if (error) return setMsg({ text: 'Not saved. Check the connection.', bad: true });
    setPane('');
    onChange({ unlimited: true });
    const till = (data as { until?: string } | null)?.until;
    setMsg({ text: `${label} of Unlimited given${till ? `, until ${day(till)}` : ''}. They got an Inbox note and a notification.` });
  };
  const unlock = async (slug: string, name: string) => {
    if (busy.current) return;
    busy.current = true;
    const { data, error } = await supabase.rpc('admin_unlock_character', { target: p.id, slug });
    busy.current = false;
    if (error) return setMsg({ text: 'Not saved. Check the connection.', bad: true });
    const r = data as { ok: boolean; why?: string } | null;
    if (!r?.ok) return setMsg({ text: r?.why === 'owned' ? `They already have ${name}.` : 'That character can’t be given.', bad: r?.why !== 'owned' });
    setPane('');
    setMsg({ text: `${name} unlocked. They got an Inbox note and a notification.` });
  };

  const facts = d
    ? [
        `Level ${d.level} · ${d.exp.toLocaleString('en-GB')} EXP`,
        `${d.tokens.toLocaleString('en-GB')} tokens · ${d.sparks ?? 'full'} Sparks`,
        `${d.plays} games played · ${d.online} old online matches · ${d.friends} friends`,
        d.top_games.length ? `Plays most: ${d.top_games.map((g) => `${gameName(g.game)} (${g.n})`).join(', ')}` : '',
      ].filter(Boolean)
    : [];
  return (
    <View style={[s.more, { borderTopColor: c.line }]}>
      {!d && !msg ? <Text style={[s.small, { color: c.mute }]}>Loading…</Text> : null}
      {facts.map((f) => (
        <Text key={f} style={[s.small, { color: c.fg }]}>{f}</Text>
      ))}
      {d ? (
        <Text style={[s.small, { color: d.reports_total ? c.t.error : c.mute }]}>
          {d.reports_total ? `${d.reports_total} report${d.reports_total === 1 ? '' : 's'} against them` : 'No reports against them'}
        </Text>
      ) : null}
      {(d?.reports ?? []).map((r, i) => (
        <Text key={i} style={[s.small, { color: c.mute }]} numberOfLines={2}>{`${day(r.at)} · ${(r.chips ?? []).slice(1).join(', ')}${r.body ? ` · “${r.body}”` : ''}`}</Text>
      ))}
      {d?.ban ? <Text style={[s.small, { color: c.t.error }]}>{`Banned ${day(d.ban.at)}${d.ban.reason ? ` · ${d.ban.reason}` : ''}`}</Text> : null}

      <View style={[s.chips, s.gapS]}>
        <Chip c={c} label="Message or gift" onPress={() => onMessage(p)} />
        <Chip c={c} label="Take tokens back" onPress={() => onTakeBack(p)} />
        <Chip c={c} label={p.unlimited ? 'Add Unlimited time' : 'Give Unlimited'} onPress={() => setPane(pane === 'unlimited' ? '' : 'unlimited')} color={pane === 'unlimited' ? c.t.accent : undefined} />
        <Chip c={c} label="Unlock character" onPress={() => setPane(pane === 'character' ? '' : 'character')} color={pane === 'character' ? c.t.accent : undefined} />
        <Chip c={c} label={sure === 'rename' ? 'Tap again to reset name' : 'Reset name'} onPress={rename} color={sure === 'rename' ? c.t.error : undefined} />
        <Chip c={c} label={p.banned ? 'Unban' : sure === 'ban' ? 'Tap again to ban' : 'Ban'} onPress={ban} color={p.banned ? undefined : c.t.error} />
      </View>
      {pane === 'unlimited' ? (
        <View style={[s.chips, s.gapS]}>
          {UNLIMITED_DAYS.map((x) => (
            <Chip key={x.d} c={c} label={x.label} onPress={() => giveUnlimited(x.d, x.label)} color={c.t.accent} />
          ))}
        </View>
      ) : null}
      {pane === 'character' ? (
        <View style={[s.chips, s.gapS]}>
          {UNLOCKABLE.map((x) => (
            <Chip key={x.slug} c={c} label={x.name} onPress={() => unlock(x.slug, x.name)} color={x.ring} />
          ))}
        </View>
      ) : null}
      {pane === 'character' ? (
        <View style={s.gapS}>
          {/* SuperNova team (Yazan 2026-11-11): only given from here, to the people who helped build MedNova. */}
          <Text style={[s.small, { color: c.mute }]}>SuperNova team</Text>
          <View style={[s.chips, s.gapS]}>
            {TEAM_CHARACTERS.map((x) => (
              <Chip key={x.slug} c={c} label={x.name} onPress={() => unlock(x.slug, x.name)} color={x.ring} />
            ))}
          </View>
        </View>
      ) : null}
      {sure === 'ban' ? (
        <TextInput value={why} onChangeText={setWhy} placeholder="Reason (only you see it)" placeholderTextColor={c.mute} maxLength={200} style={[s.in, s.gapS, { backgroundColor: c.surf, borderColor: c.line, color: c.fg }]} />
      ) : null}
      {sure === 'rename' ? <Text style={[s.small, { color: c.mute }]}>{`@${p.username} goes back to a default name, and the app asks them to pick a new one.`}</Text> : null}
      {sure ? (
        <Pressable onPress={() => setSure('')} accessibilityRole="button">
          <Text style={[s.small, { color: c.t.accent }]}>Cancel</Text>
        </Pressable>
      ) : null}
      {msg ? <Text style={[s.small, { color: msg.bad ? c.t.error : c.fg }]}>{msg.text}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  H: { fontFamily: F.display },
  gap: { marginTop: u(16) },
  gapS: { marginTop: u(8) },
  gapL: { marginTop: u(32) },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6) },
  stat: { flexGrow: 1, flexBasis: '45%', borderWidth: 1, borderRadius: u(14), paddingVertical: u(8), paddingHorizontal: u(12) },
  statN: { fontFamily: F.display, fontSize: u(20) },
  in: { borderWidth: 1, borderRadius: u(14), paddingHorizontal: u(12), height: u(38), fontFamily: F.body, fontSize: u(11) },
  list: { gap: u(6), marginTop: u(10) },
  card: { borderWidth: 1, borderRadius: u(14), paddingVertical: u(8), paddingHorizontal: u(10) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  dot: { position: 'absolute', right: -u(1), bottom: -u(1), width: u(10), height: u(10), borderRadius: u(5), borderWidth: u(2), backgroundColor: GREEN },
  name: { fontFamily: F.display, fontSize: u(13) },
  small: { fontFamily: F.body, fontSize: u(9), marginTop: u(2) },
  tags: { alignItems: 'flex-end', gap: u(4) },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: u(6), paddingVertical: u(1) },
  tagT: { fontFamily: F.bodySemi, fontSize: u(8) },
  more: { borderTopWidth: 1, marginTop: u(8), paddingTop: u(6), gap: u(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6) },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: u(12), paddingVertical: u(6) },
  chipT: { fontFamily: F.bodySemi, fontSize: u(10) },
});
