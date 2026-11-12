import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { GradBtn, InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { useSession } from '@/games/shell/session';
import { ADS_ON, openPrivacyChoices, privacyChoicesNeeded } from '@/lib/ads';
import { linkGoogle, signInMethods } from '@/lib/googleSignIn';
import { askPushNow, PUSH_ON, pushAllowed } from '@/lib/push';
import { tapped } from '@/lib/sound';
import { supabase } from '@/lib/supabase';
import { loadVoicePick, setVoicePick, useVoicePick, type VoicePick } from '@/state/voicePick';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

type Prefs = { social: boolean; reminders: boolean };
const WAYS: Record<string, string> = { email: 'email', google: 'Google', apple: 'Apple' };

/**
 * Settings (Group 2, Yazan 2026-11-07): the two notification switches (friends and gifts, one reminder a day) and
 * Privacy choices for ads. Notification choices live on the server, so they follow the account to every phone.
 * Group 3: "Sign-in" lists the ways into the account and adds Google, so an Apple player who hid their email can
 * open the same account on Android.
 */
export default function Page() {
  const c = useInfo();
  const uid = useSession((x) => x.userId);
  const [allowed, setAllowed] = useState<'yes' | 'no' | 'ask' | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [choices, setChoices] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ways, setWays] = useState<string[] | null>(null);
  const [linkNote, setLinkNote] = useState<{ text: string; bad: boolean } | null>(null);
  const [linking, setLinking] = useState(false);

  const look = useCallback(() => {
    if (PUSH_ON) pushAllowed().then(setAllowed, () => setAllowed('no'));
    if (ADS_ON) privacyChoicesNeeded().then(setChoices, () => {});
  }, []);
  useEffect(() => {
    look();
    // Coming back from the phone's own settings: read the permission again.
    const sub = AppState.addEventListener('change', (st) => st === 'active' && look());
    return () => sub.remove();
  }, [look]);
  useEffect(() => {
    if (!uid) return;
    supabase.rpc('push_my_prefs').then(({ data }) => data && setPrefs(data as Prefs), () => {});
    signInMethods().then(setWays, () => {});
  }, [uid]);

  const addGoogle = async () => {
    setLinking(true);
    setLinkNote(null);
    try {
      if (await linkGoogle()) {
        setWays(await signInMethods());
        setLinkNote({ text: 'Google added. Sign in with Google on any phone to open this account.', bad: false });
      }
    } catch (e) {
      const m = String((e as Error).message ?? '').toLowerCase();
      setLinkNote({
        text: m.includes('already') ? 'That Google account already has its own MedNova account. Pick another Google account.' : 'Couldn’t add Google. Check your connection and try again.',
        bad: true,
      });
    } finally {
      setLinking(false);
    }
  };

  const set = async (next: Prefs) => {
    const was = prefs;
    setPrefs(next);
    setErr(null);
    const { error } = await supabase.rpc('push_set_prefs', next);
    if (error) {
      setPrefs(was);
      setErr('Couldn’t save that. Check your connection and try again.');
    }
  };
  const turnOn = async () => {
    const ok = await askPushNow(uid).catch(() => false);
    setAllowed(ok ? 'yes' : await pushAllowed().catch(() => 'no' as const));
  };

  return (
    <Screen tab={null} glow={21} wide={460} symbols>
      <InfoScroll>
        <Kicker>Settings</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>Settings</Text>

        {uid && Platform.OS !== 'web' && ways ? (
          <>
            <View style={{ marginTop: u(14) }}>
              <Kicker inSec>Sign-in</Kicker>
            </View>
            <Text style={[ui.p, { color: c.mute }]}>
              You sign in with {ways.map((w) => WAYS[w] ?? w).join(' and ')}.
              {ways.includes('google') ? ' Use Google to open this account on any phone.' : ' Add Google to open this same account on an Android phone or any other phone.'}
            </Text>
            {!ways.includes('google') ? <GradBtn label={linking ? 'Opening Google…' : 'Add Google sign-in'} onPress={linking ? () => {} : addGoogle} style={{ marginTop: u(10) }} /> : null}
            {linkNote ? <Text style={[s.err, { color: linkNote.bad ? c.t.error : c.t.accent }]}>{linkNote.text}</Text> : null}
          </>
        ) : null}

        <View style={{ marginTop: u(uid && Platform.OS !== 'web' && ways ? 22 : 14) }}>
          <Kicker inSec>Notifications</Kicker>
        </View>
        {!PUSH_ON ? (
          <Text style={[ui.p, { color: c.mute }]}>Notifications are only in the phone app.</Text>
        ) : !uid ? (
          <>
            <Text style={[ui.p, { color: c.mute }]}>Sign in to get notifications about friends, gifts and your daily reward.</Text>
            <GradBtn label="Sign in" onPress={() => router.navigate('/auth')} style={{ marginTop: u(10) }} />
          </>
        ) : (
          <>
            {allowed === 'no' ? (
              <View style={[s.note, { borderColor: c.line, backgroundColor: c.surf }]}>
                <Text style={[s.noteT, { color: c.fg }]}>Notifications are off for MedNova in your phone’s settings.</Text>
                <GradBtn label="Open phone settings" onPress={() => Linking.openSettings().catch(() => {})} style={{ marginTop: u(8) }} />
              </View>
            ) : allowed === 'ask' ? (
              <View style={[s.note, { borderColor: c.line, backgroundColor: c.surf }]}>
                <Text style={[s.noteT, { color: c.fg }]}>Your phone hasn’t been asked yet.</Text>
                <GradBtn label="Turn on notifications" onPress={turnOn} style={{ marginTop: u(8) }} />
              </View>
            ) : null}
            <Row
              title="Friends and gifts"
              sub="Friend requests, challenges and gifts in your Inbox."
              on={prefs?.social ?? true}
              off={!prefs}
              onChange={(v) => prefs && set({ ...prefs, social: v })}
            />
            <Row
              title="Reminders"
              sub="One a day at most: your daily reward, a full Sparks bar, or Grand Rounds closing."
              on={prefs?.reminders ?? true}
              off={!prefs}
              onChange={(v) => prefs && set({ ...prefs, reminders: v })}
            />
            {err ? <Text style={[s.err, { color: c.t.error }]}>{err}</Text> : null}
          </>
        )}

        <VoiceRow />

        <View style={{ marginTop: u(22) }}>
          <Kicker inSec>Ads and privacy</Kicker>
        </View>
        {!ADS_ON ? (
          <Text style={[ui.p, { color: c.mute }]}>Ads are only in the phone app.</Text>
        ) : (
          <>
            <Text style={[ui.p, { color: c.mute }]}>
              {choices
                ? 'Change what you agreed to about ads and data, any time.'
                : 'Where you live, the law asks for no ad choices. Ads in MedNova are never personalised from your games.'}
            </Text>
            {choices ? <GradBtn label="Privacy choices" onPress={() => openPrivacyChoices().then(look)} style={{ marginTop: u(10) }} /> : null}
            {Platform.OS === 'ios' ? (
              <Pressable onPress={() => Linking.openSettings().catch(() => {})} style={{ marginTop: u(10) }} accessibilityRole="link">
                <Text style={[s.link, { color: c.t.accent, borderBottomColor: c.t.accent }]}>Ad tracking: change it in iPhone Settings</Text>
              </Pressable>
            ) : null}
          </>
        )}
        <Pressable onPress={() => router.navigate('/privacy')} style={{ marginTop: u(14) }} accessibilityRole="link">
          <Text style={[s.link, { color: c.t.accent, borderBottomColor: c.t.accent }]}>Read our Privacy Policy</Text>
        </Pressable>
      </InfoScroll>
    </Screen>
  );
}

const VOICES: { k: VoicePick; label: string }[] = [
  { k: 'character', label: 'My character' },
  { k: 'female', label: 'Female' },
  { k: 'male', label: 'Male' },
];

/** Your voice lines in rooms (Yazan 2026-11-12): follow your character, or always Female or Male. */
function VoiceRow() {
  const c = useInfo();
  const pick = useVoicePick((x) => x.pick);
  useEffect(() => {
    void loadVoicePick();
  }, []);
  return (
    <>
      <View style={{ marginTop: u(22) }}>
        <Kicker inSec>Voice lines</Kicker>
      </View>
      <View style={[s.row, { borderBottomColor: c.line, flexDirection: 'column', alignItems: 'stretch', gap: u(8) }]}>
        <View>
          <Text style={[s.rowT, { color: c.fg }]}>Your voice</Text>
          <Text style={[s.rowS, { color: c.mute }]}>The voice your lines play in. My character: a female character speaks in the female voice. Rivals always follow their character.</Text>
        </View>
        <View style={[s.pill, { backgroundColor: c.surf, borderColor: c.line, alignSelf: 'flex-start' }]}>
          {VOICES.map((v) => (
            <Pressable key={v.k} onPress={tapped(() => setVoicePick(v.k))} accessibilityRole="button" accessibilityState={{ selected: pick === v.k }} accessibilityLabel={`Voice: ${v.label}`}>
              {pick === v.k ? (
                <LinearGradient colors={[c.t.gradA, c.t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.opt}>
                  <Text style={[s.optT, { color: c.t.onGrad }]}>{v.label}</Text>
                </LinearGradient>
              ) : (
                <View style={s.opt}>
                  <Text style={[s.optT, { color: c.mute }]}>{v.label}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );
}

/** One setting with an On / Off pill (the menu's Sound / Mute look). */
function Row({ title, sub, on, off, onChange }: { title: string; sub: string; on: boolean; off: boolean; onChange: (v: boolean) => void }) {
  const c = useInfo();
  return (
    <View style={[s.row, { borderBottomColor: c.line }]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowT, { color: c.fg }]}>{title}</Text>
        <Text style={[s.rowS, { color: c.mute }]}>{sub}</Text>
      </View>
      <View style={[s.pill, { backgroundColor: c.surf, borderColor: c.line }, off && { opacity: 0.5 }]}>
        {([true, false] as const).map((v) => (
          <Pressable key={String(v)} disabled={off} onPress={tapped(() => v !== on && onChange(v))} accessibilityRole="button" accessibilityState={{ selected: on === v }} accessibilityLabel={`${title} ${v ? 'on' : 'off'}`}>
            {on === v ? (
              <LinearGradient colors={[c.t.gradA, c.t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.opt}>
                <Text style={[s.optT, { color: c.t.onGrad }]}>{v ? 'On' : 'Off'}</Text>
              </LinearGradient>
            ) : (
              <View style={s.opt}>
                <Text style={[s.optT, { color: c.mute }]}>{v ? 'On' : 'Off'}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  note: { borderWidth: 1, borderRadius: u(14), padding: u(12), marginTop: u(8) },
  noteT: { fontFamily: F.body, fontSize: u(11), lineHeight: u(16) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(12), paddingVertical: u(12), borderBottomWidth: 1 },
  rowT: { fontFamily: F.display, fontSize: u(15), lineHeight: u(18) },
  rowS: { fontFamily: F.body, fontSize: u(10), lineHeight: u(14.5), marginTop: u(3) },
  pill: { flexDirection: 'row', borderWidth: 1, borderRadius: 999, padding: u(3) },
  opt: { paddingVertical: u(5), paddingHorizontal: u(11), borderRadius: 999 },
  optT: { fontFamily: F.bodySemi, fontSize: u(9.5) },
  err: { fontFamily: F.bodyMedium, fontSize: u(10.5), marginTop: u(8) },
  link: { fontFamily: F.bodySemi, fontSize: u(10.5), alignSelf: 'flex-start', borderBottomWidth: 1 },
});
