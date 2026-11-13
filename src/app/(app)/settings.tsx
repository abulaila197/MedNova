import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';
import { AppState, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
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
import { langChoice, setLangChoice, t, type LangChoice } from '@/i18n';

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
        setLinkNote({ text: t('Google added. Sign in with Google on any phone to open this account.'), bad: false });
      }
    } catch (e) {
      const m = String((e as Error).message ?? '').toLowerCase();
      setLinkNote({
        text: m.includes('already') ? t('That Google account already has its own MedNova account. Pick another Google account.') : t('Couldn’t add Google. Check your connection and try again.'),
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
      setErr(t('Couldn’t save that. Check your connection and try again.'));
    }
  };
  const turnOn = async () => {
    const ok = await askPushNow(uid).catch(() => false);
    setAllowed(ok ? 'yes' : await pushAllowed().catch(() => 'no' as const));
  };

  return (
    <Screen tab={null} glow={21} wide={460} symbols>
      <InfoScroll>
        <Kicker>{t('Settings')}</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>{t('Settings')}</Text>

        <LanguageRow />

        {uid && Platform.OS !== 'web' && ways ? (
          <>
            <View style={{ marginTop: u(14) }}>
              <Kicker inSec>{t('Sign-in')}</Kicker>
            </View>
            <Text style={[ui.p, { color: c.mute }]}>
              {t('You sign in with {ways}.', { ways: ways.map((w) => t(WAYS[w] ?? w)).join(t(' and ')) })}
              {ways.includes('google') ? t(' Use Google to open this account on any phone.') : t(' Add Google to open this same account on an Android phone or any other phone.')}
            </Text>
            {!ways.includes('google') ? <GradBtn label={linking ? t('Opening Google…') : t('Add Google sign-in')} onPress={linking ? () => {} : addGoogle} style={{ marginTop: u(10) }} /> : null}
            {linkNote ? <Text style={[s.err, { color: linkNote.bad ? c.t.error : c.t.accent }]}>{linkNote.text}</Text> : null}
          </>
        ) : null}

        <View style={{ marginTop: u(uid && Platform.OS !== 'web' && ways ? 22 : 14) }}>
          <Kicker inSec>{t('Notifications')}</Kicker>
        </View>
        {!PUSH_ON ? (
          <Text style={[ui.p, { color: c.mute }]}>{t('Notifications are only in the phone app.')}</Text>
        ) : !uid ? (
          <>
            <Text style={[ui.p, { color: c.mute }]}>{t('Sign in to get notifications about friends, gifts and your daily reward.')}</Text>
            <GradBtn label={t('Sign in')} onPress={() => router.navigate('/auth')} style={{ marginTop: u(10) }} />
          </>
        ) : (
          <>
            {allowed === 'no' ? (
              <View style={[s.note, { borderColor: c.line, backgroundColor: c.surf }]}>
                <Text style={[s.noteT, { color: c.fg }]}>{t('Notifications are off for MedNova in your phone’s settings.')}</Text>
                <GradBtn label={t('Open phone settings')} onPress={() => Linking.openSettings().catch(() => {})} style={{ marginTop: u(8) }} />
              </View>
            ) : allowed === 'ask' ? (
              <View style={[s.note, { borderColor: c.line, backgroundColor: c.surf }]}>
                <Text style={[s.noteT, { color: c.fg }]}>{t('Your phone hasn’t been asked yet.')}</Text>
                <GradBtn label={t('Turn on notifications')} onPress={turnOn} style={{ marginTop: u(8) }} />
              </View>
            ) : null}
            <Row
              title={t('Friends and gifts')}
              sub={t('Friend requests, challenges and gifts in your Inbox.')}
              on={prefs?.social ?? true}
              off={!prefs}
              onChange={(v) => prefs && set({ ...prefs, social: v })}
            />
            <Row
              title={t('Reminders')}
              sub={t('One a day at most: your daily reward, a full Sparks bar, or Grand Rounds closing.')}
              on={prefs?.reminders ?? true}
              off={!prefs}
              onChange={(v) => prefs && set({ ...prefs, reminders: v })}
            />
            {err ? <Text style={[s.err, { color: c.t.error }]}>{err}</Text> : null}
          </>
        )}

        <VoiceRow />

        <View style={{ marginTop: u(22) }}>
          <Kicker inSec>{t('Ads and privacy')}</Kicker>
        </View>
        {!ADS_ON ? (
          <Text style={[ui.p, { color: c.mute }]}>{t('Ads are only in the phone app.')}</Text>
        ) : (
          <>
            <Text style={[ui.p, { color: c.mute }]}>
              {choices
                ? t('Change what you agreed to about ads and data, any time.')
                : t('Where you live, the law asks for no ad choices. Ads in MedNova are never personalised from your games.')}
            </Text>
            {choices ? <GradBtn label={t('Privacy choices')} onPress={() => openPrivacyChoices().then(look)} style={{ marginTop: u(10) }} /> : null}
            {Platform.OS === 'ios' ? (
              <Pressable onPress={() => Linking.openSettings().catch(() => {})} style={{ marginTop: u(10) }} accessibilityRole="link">
                <Text style={[s.link, { color: c.t.accent, borderBottomColor: c.t.accent }]}>{t('Ad tracking: change it in iPhone Settings')}</Text>
              </Pressable>
            ) : null}
          </>
        )}
        <Pressable onPress={() => router.navigate('/privacy')} style={{ marginTop: u(14) }} accessibilityRole="link">
          <Text style={[s.link, { color: c.t.accent, borderBottomColor: c.t.accent }]}>{t('Read our Privacy Policy')}</Text>
        </Pressable>
      </InfoScroll>
      <LangSheet />
    </Screen>
  );
}

const LANGS: { k: LangChoice; label: string }[] = [
  { k: 'phone', label: 'Like my phone' },
  { k: 'en', label: 'English' },
  { k: 'ar', label: 'العربية' },
];

/** The app's language (Yazan 2026-11-13): follow the phone, or English, or Arabic. A change restarts the app. */
// Changing the language restarts the app, so it asks first (Yazan 2026-11-13).
const useLangAsk = create<{ k: LangChoice | null }>(() => ({ k: null }));
const langName = (k: LangChoice) => (k === 'phone' ? t('your phone’s language') : k === 'en' ? 'English' : 'العربية');

function LangSheet() {
  const c = useInfo();
  const ask = useLangAsk((x) => x.k);
  const close = () => useLangAsk.setState({ k: null });
  return (
    <Sheet open={!!ask} onClose={close}>
      <View style={{ gap: u(10), paddingTop: u(2), paddingBottom: u(30) }}>
        <Text style={[s.askH, { color: c.fg }]}>{t('Change the language?')}</Text>
        <Text style={[ui.p, { color: c.mute }]}>{t('MedNova will close and open again in {name}. Are you sure?', { name: ask ? langName(ask) : '' })}</Text>
        <Pressable onPress={() => ask && setLangChoice(ask)} accessibilityRole="button" style={{ marginTop: u(4) }}>
          <LinearGradient colors={[c.t.gradA, c.t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.yes}>
            <Text style={[s.yesT, { color: c.t.onGrad }]}>{t('Yes, restart')}</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={close} accessibilityRole="button" style={s.cancel}>
          <Text style={[s.cancelT, { color: c.mute }]}>{t('Cancel')}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

function LanguageRow() {
  const c = useInfo();
  const pick = langChoice();
  const setAsk = (k: LangChoice) => useLangAsk.setState({ k });
  return (
    <>
      <View style={{ marginTop: u(14) }}>
        <Kicker inSec>{t('Language')}</Kicker>
      </View>
      <View style={[s.row, { borderBottomColor: c.line, flexDirection: 'column', alignItems: 'stretch', gap: u(8) }]}>
        <View>
          <Text style={[s.rowT, { color: c.fg }]}>{t('App language')}</Text>
          <Text style={[s.rowS, { color: c.mute }]}>{t('Follow your phone, or pick one. The app restarts in the new language.')}</Text>
        </View>
        <View style={[s.pill, { backgroundColor: c.surf, borderColor: c.line, alignSelf: 'flex-start' }]}>
          {LANGS.map((v) => (
            <Pressable key={v.k} onPress={tapped(() => v.k !== pick && setAsk(v.k))} accessibilityRole="button" accessibilityState={{ selected: pick === v.k }} accessibilityLabel={`${t('App language')}: ${t(v.label)}`}>
              {pick === v.k ? (
                <LinearGradient colors={[c.t.gradA, c.t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.opt}>
                  <Text style={[s.optT, { color: c.t.onGrad }]}>{t(v.label)}</Text>
                </LinearGradient>
              ) : (
                <View style={s.opt}>
                  <Text style={[s.optT, { color: c.mute }]}>{t(v.label)}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </>
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
        <Kicker inSec>{t('Voice lines')}</Kicker>
      </View>
      <View style={[s.row, { borderBottomColor: c.line, flexDirection: 'column', alignItems: 'stretch', gap: u(8) }]}>
        <View>
          <Text style={[s.rowT, { color: c.fg }]}>{t('Your voice')}</Text>
          <Text style={[s.rowS, { color: c.mute }]}>{t('The voice your lines play in. My character: a female character speaks in the female voice. Rivals always follow their character.')}</Text>
        </View>
        <View style={[s.pill, { backgroundColor: c.surf, borderColor: c.line, alignSelf: 'flex-start' }]}>
          {VOICES.map((v) => (
            <Pressable key={v.k} onPress={tapped(() => setVoicePick(v.k))} accessibilityRole="button" accessibilityState={{ selected: pick === v.k }} accessibilityLabel={`${t('Your voice')}: ${t(v.label)}`}>
              {pick === v.k ? (
                <LinearGradient colors={[c.t.gradA, c.t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.opt}>
                  <Text style={[s.optT, { color: c.t.onGrad }]}>{t(v.label)}</Text>
                </LinearGradient>
              ) : (
                <View style={s.opt}>
                  <Text style={[s.optT, { color: c.mute }]}>{t(v.label)}</Text>
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
          <Pressable key={String(v)} disabled={off} onPress={tapped(() => v !== on && onChange(v))} accessibilityRole="button" accessibilityState={{ selected: on === v }} accessibilityLabel={`${title} ${v ? t('On') : t('Off')}`}>
            {on === v ? (
              <LinearGradient colors={[c.t.gradA, c.t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.opt}>
                <Text style={[s.optT, { color: c.t.onGrad }]}>{v ? t('On') : t('Off')}</Text>
              </LinearGradient>
            ) : (
              <View style={s.opt}>
                <Text style={[s.optT, { color: c.mute }]}>{v ? t('On') : t('Off')}</Text>
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
  askH: { fontFamily: F.display, fontSize: u(19), lineHeight: u(23) },
  yes: { height: u(38), borderRadius: u(19), alignItems: 'center', justifyContent: 'center' },
  yesT: { fontFamily: F.display, fontSize: u(14), lineHeight: u(18) },
  cancel: { alignSelf: 'center', paddingVertical: u(6), paddingHorizontal: u(14) },
  cancelT: { fontFamily: F.bodySemi, fontSize: u(11) },
  link: { fontFamily: F.bodySemi, fontSize: u(10.5), alignSelf: 'flex-start', borderBottomWidth: 1 },
});
