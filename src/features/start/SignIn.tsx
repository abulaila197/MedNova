import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { TopInset } from '@/components/TopInset';
import { DISCLAIMER } from '@/features/info/content';
import { supabase } from '@/lib/supabase';
import { call } from '@/online/api';
import { useTheme } from '@/state/app';
import { u, useScreen } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { cssAngle } from './ease';
import { Sky, Stars } from './Sky';

// Sign-in colours from the prototype (d-auth / l-auth: `.auth` and `.auth.lite`).
const C = {
  dark: {
    welcome: '#f8fbff',
    accent: '#6fd6ff',
    cardGrad: ['#10153a', '#0b0f2c'] as const,
    cardEdge: 'rgba(201,184,255,0.22)',
    cardShadow: `0px ${u(24)}px ${u(50)}px ${u(-20)}px rgba(0,0,0,0.9), 0px 0px 0px 1px rgba(0,0,0,0.4)`,
    tabs: '#070a1f',
    tabOff: '#9aa0c4',
    tabOn: ['#5a46c9', '#2a7fb8'] as const,
    tabOnTxt: '#ffffff',
    h3: '#eef0ff',
    lbl: '#b9bee0',
    inBg: '#070a1f',
    inEdge: 'rgba(255,255,255,0.08)',
    inTxt: '#6f7598',
    inValue: '#eef0ff',
    pri: ['#a48bff', '#6fd6ff'] as const,
    priTxt: '#0b0b26',
    or: '#9aa0c4',
    orLine: 'rgba(255,255,255,0.12)',
    ggl: '#ffffff',
    gglEdge: null as string | null,
    link: '#6fd6ff',
    linkLine: 'rgba(111,214,255,0.4)',
    agree: '#9aa0c4',
  },
  light: {
    welcome: '#2a2620',
    accent: '#e5833a',
    cardGrad: ['#fbf9f4', '#fbf9f4'] as const,
    cardEdge: '#dcd6c8',
    cardShadow: `0px ${u(24)}px ${u(50)}px ${u(-24)}px rgba(60,50,30,0.45), 0px 0px 0px 1px rgba(40,36,28,0.04)`,
    tabs: '#efebe2',
    tabOff: '#7a7264',
    tabOn: ['#e9bf4f', '#e5833a'] as const,
    tabOnTxt: '#2a1a06',
    h3: '#2a2620',
    lbl: '#7a7264',
    inBg: '#f3efe6',
    inEdge: '#e2dccf',
    inTxt: '#9a9282',
    inValue: '#2a2620',
    pri: ['#e9bf4f', '#e5833a'] as const,
    priTxt: '#2a1a06',
    or: '#9a9282',
    orLine: '#e2dccf',
    ggl: '#ffffff',
    gglEdge: '#e2dccf' as string | null,
    link: '#b8741f',
    linkLine: 'rgba(184,116,31,0.4)',
    agree: '#8a8274',
  },
};

// Google and Apple sign-in are shown but not live yet: a tap says they are coming. Before a store build, either wire
// them or hide them, since stores reject buttons that do nothing. Sign In tab only: they also create the account.
const SHOW_SOCIAL = true;

const TAB = cssAngle(100, 105, 27);
const PRI = cssAngle(100, 216, 35);

function Apple() {
  return (
    <Svg width={u(12)} height={u(12)} viewBox="0 0 24 24">
      <Path
        fill="#ffffff"
        d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z"
      />
    </Svg>
  );
}

function Google() {
  return (
    <Svg width={u(12)} height={u(12)} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}

type Step = 'form' | 'code' | 'forgot' | 'reset';

/** Turns Supabase's messages into short, plain lines. */
function plain(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'That email and password do not match.';
  if (m.includes('already registered')) return 'That email already has an account. Sign in instead.';
  if (m.includes('expired') || m.includes('invalid') && m.includes('token')) return 'That code is wrong or has expired. Send a new one.';
  if (m.includes('password') && m.includes('characters')) return 'Use at least 6 characters for your password.';
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Too many tries. Wait a minute, then try again.';
  if (m.includes('network') || m.includes('fetch')) return 'No connection. Check your internet and try again.';
  return msg;
}

/** Sign in / create account (AU1: email + password, 6-digit email code). Follows the app mode: Nebula, or Warm Stone in light mode. */
export function SignIn() {
  const t = useTheme();
  const lt = t.mode === 'light';
  const c = lt ? C.light : C.dark;
  const { width: w, height: h } = useScreen();
  const ins = useSafeAreaInsets();
  // Matches TopInset, so the space under the card equals the space above the title.
  const topGap = Platform.OS === 'web' ? u(30) : ins.top;
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const [agreed, setAgreed] = useState(false);
  // The page sits at one height for every tab and step: placed so the tallest tab (Sign In, with Google and Apple)
  // has equal space above the title and under the card.
  const [viewH, setViewH] = useState(0);
  const [inH, setInH] = useState(0);
  const [upH, setUpH] = useState(0);
  const tall = Math.max(inH, upH);
  const padBottom = u(14) + ins.bottom;
  const padTop = tall && viewH ? Math.max(u(4), (viewH - tall - topGap) / 2) : u(14);
  const enter = () => router.replace('/games');
  const legal = () => router.push('/privacy');
  const terms = () => router.push({ pathname: '/privacy', params: { doc: 'terms' } });

  const act = async (job: () => Promise<void>) => {
    setBusy(true);
    setNote(null);
    try {
      await job();
    } catch (e) {
      setNote({ text: plain(e instanceof Error ? e.message : String(e)), bad: true });
    } finally {
      setBusy(false);
    }
  };
  const mail = () => email.trim().toLowerCase();

  const signIn = () =>
    act(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: mail(), password });
      if (error && error.message.toLowerCase().includes('not confirmed')) {
        await supabase.auth.resend({ type: 'signup', email: mail() });
        setStep('code');
        setNote({ text: 'Confirm your email first. We sent you a new code.', bad: false });
        return;
      }
      if (error) throw error;
      enter();
    });

  const signUp = () =>
    act(async () => {
      if (!agreed) throw new Error('Tick the box to confirm you are 16 or older and agree to the Terms.');
      const name = username.trim();
      if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) throw new Error('Usernames use 3 to 16 letters, numbers or _.');
      const free = await call<boolean>('username_available', { name });
      if (!free) throw new Error('That username is taken. Try another.');
      const { data, error } = await supabase.auth.signUp({ email: mail(), password, options: { data: { username: name, display_name: name } } });
      if (error) throw error;
      if (data.session) return enter(); // email confirmation switched off on the server
      setStep('code');
      setNote({ text: `We sent a 6-digit code to ${mail()}.`, bad: false });
    });

  const confirm = () =>
    act(async () => {
      const { error } = await supabase.auth.verifyOtp({ email: mail(), token: code.trim(), type: 'signup' });
      if (error) throw error;
      enter();
    });

  const sendReset = () =>
    act(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(mail());
      if (error) throw error;
      setStep('reset');
      setCode('');
      setPassword('');
      setNote({ text: `We sent a 6-digit code to ${mail()}.`, bad: false });
    });

  const reset = () =>
    act(async () => {
      const v = await supabase.auth.verifyOtp({ email: mail(), token: code.trim(), type: 'recovery' });
      if (v.error) throw v.error;
      const u2 = await supabase.auth.updateUser({ password });
      if (u2.error) throw u2.error;
      enter();
    });

  const resend = () =>
    act(async () => {
      const { error } = step === 'reset' ? await supabase.auth.resetPasswordForEmail(mail()) : await supabase.auth.resend({ type: 'signup', email: mail() });
      if (error) throw error;
      setNote({ text: 'A new code is on its way.', bad: false });
    });

  const back = () => {
    setStep('form');
    setCode('');
    setNote(null);
  };

  const tabBtn = (key: 'in' | 'up', label: string) => {
    const on = tab === key;
    return (
      <Pressable
        key={key}
        onPress={() => {
          setTab(key);
          setNote(null);
        }}
        style={s.tab}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}>
        {on ? <LinearGradient colors={c.tabOn} start={TAB.start} end={TAB.end} style={[StyleSheet.absoluteFill, { borderRadius: u(9) }]} /> : null}
        <Text style={[s.tabTxt, { color: on ? c.tabOnTxt : c.tabOff }]}>{label}</Text>
      </Pressable>
    );
  };
  const inStyle = [s.in, { backgroundColor: c.inBg, borderColor: c.inEdge, color: c.inValue }];
  const field = (label: string, input: ReactNode) => (
    <>
      <Text style={[s.lbl, { color: c.lbl }]}>{label}</Text>
      <View>{input}</View>
    </>
  );
  const primary = (label: string, onPress: () => void, off = false) => (
    <Pressable onPress={onPress} disabled={busy || off} accessibilityRole="button" accessibilityState={{ disabled: busy || off }} style={[s.pri, (busy || off) && { opacity: 0.6 }]}>
      <LinearGradient colors={c.pri} start={PRI.start} end={PRI.end} style={[StyleSheet.absoluteFill, { borderRadius: u(12) }]} />
      <Text style={[s.priTxt, { color: c.priTxt }]}>{busy ? 'One moment…' : label}</Text>
    </Pressable>
  );
  const link = (label: string, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={s.guest}>
      <Text style={[s.guestTxt, { color: c.link }]}>{label}</Text>
      <View style={[s.guestLine, { backgroundColor: c.linkLine }]} />
    </Pressable>
  );
  const emailIn = (
    <TextInput
      value={email}
      onChangeText={setEmail}
      placeholder="you@example.com"
      placeholderTextColor={c.inTxt}
      autoCapitalize="none"
      autoComplete="email"
      keyboardType="email-address"
      style={inStyle}
      accessibilityLabel="Email address"
    />
  );
  const passIn = (placeholder: string, auto: 'current-password' | 'new-password') => (
    <TextInput
      value={password}
      onChangeText={setPassword}
      placeholder={placeholder}
      placeholderTextColor={c.inTxt}
      secureTextEntry
      autoComplete={auto}
      style={inStyle}
      accessibilityLabel="Password"
    />
  );
  const codeIn = (
    <TextInput
      value={code}
      onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
      placeholder="6-digit code"
      placeholderTextColor={c.inTxt}
      keyboardType="number-pad"
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      maxLength={6}
      style={[inStyle, s.code]}
      accessibilityLabel="6-digit code"
    />
  );
  const noteLine = note ? <Text style={[s.note, { color: note.bad ? (lt ? '#c0392b' : '#ff8a8a') : c.lbl }]}>{note.text}</Text> : null;

  let body: ReactNode;
  if (step === 'code') {
    body = (
      <>
        <Text style={[s.h3, { color: c.h3 }]}>Check your email</Text>
        {noteLine}
        {field('CODE', codeIn)}
        {primary('Confirm', confirm)}
        {link('Send a new code', resend)}
        {link('Back', back)}
      </>
    );
  } else if (step === 'forgot') {
    body = (
      <>
        <Text style={[s.h3, { color: c.h3 }]}>Reset your password</Text>
        {noteLine}
        {field('EMAIL ADDRESS', emailIn)}
        {primary('Send code', sendReset)}
        {link('Back', back)}
      </>
    );
  } else if (step === 'reset') {
    body = (
      <>
        <Text style={[s.h3, { color: c.h3 }]}>Choose a new password</Text>
        {noteLine}
        {field('CODE', codeIn)}
        {field('NEW PASSWORD', passIn('At least 6 characters', 'new-password'))}
        {primary('Save and sign in', reset)}
        {link('Send a new code', resend)}
        {link('Back', back)}
      </>
    );
  } else {
    body = (
      <>
        <View style={[s.tabs, { backgroundColor: c.tabs }]} accessibilityRole="tablist">
          {tabBtn('in', 'Sign In')}
          {tabBtn('up', 'Create Account')}
        </View>
        <Text style={[s.h3, { color: c.h3 }]}>{tab === 'in' ? 'Welcome back' : 'Create your account'}</Text>
        {tab === 'up'
          ? field(
              'USERNAME',
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="3 to 16 letters or numbers"
                placeholderTextColor={c.inTxt}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={16}
                style={inStyle}
                accessibilityLabel="Username"
              />,
            )
          : null}
        {field('EMAIL ADDRESS', emailIn)}
        {field('PASSWORD', passIn(tab === 'in' ? 'Enter your password' : 'At least 6 characters', tab === 'in' ? 'current-password' : 'new-password'))}
        {tab === 'up' ? (
          <Pressable
            onPress={() => setAgreed((v) => !v)}
            style={s.tick}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            accessibilityLabel="I am 16 or older and agree to the Terms and Privacy Policy">
            <View style={[s.box, { backgroundColor: c.inBg, borderColor: agreed ? c.accent : c.inEdge }]}>
              {agreed ? (
                <>
                  <LinearGradient colors={c.pri} start={PRI.start} end={PRI.end} style={[StyleSheet.absoluteFill, { borderRadius: u(3) }]} />
                  <Svg width={u(9)} height={u(9)} viewBox="0 0 12 12">
                    <Path d="M2.5 6.3l2.3 2.3 4.7-5" stroke={c.priTxt} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </>
              ) : null}
            </View>
            <Text style={[s.agree, s.tickTxt, { color: c.lbl }]}>
              I am 16 or older and agree to the{' '}
              <Text style={{ color: c.link }} onPress={terms} accessibilityRole="link">
                Terms
              </Text>{' '}
              and{' '}
              <Text style={{ color: c.link }} onPress={legal} accessibilityRole="link">
                Privacy Policy
              </Text>
              .
            </Text>
          </Pressable>
        ) : null}
        {noteLine}
        {primary(tab === 'in' ? 'Sign In' : 'Create Account', tab === 'in' ? signIn : signUp, tab === 'up' && !agreed)}
        {tab === 'in' ? link('Forgot password?', () => (setStep('forgot'), setNote(null))) : null}
        {SHOW_SOCIAL && tab === 'in' ? (
          <>
            <View style={s.or}>
              <View style={[s.orLine, { backgroundColor: c.orLine }]} />
              <Text style={[s.orTxt, { color: c.or }]}>OR</Text>
              <View style={[s.orLine, { backgroundColor: c.orLine }]} />
            </View>
            <Pressable
              onPress={() => setNote({ text: 'Google sign-in is coming soon. Use your email for now.', bad: false })}
              accessibilityRole="button"
              style={[s.ggl, { backgroundColor: c.ggl }, c.gglEdge ? { borderWidth: 1, borderColor: c.gglEdge } : null]}>
              <Google />
              <Text style={s.gglTxt}>Continue with Google</Text>
            </Pressable>
            <Pressable
              onPress={() => setNote({ text: 'Apple sign-in is coming soon. Use your email for now.', bad: false })}
              accessibilityRole="button"
              style={[s.ggl, { backgroundColor: '#000000' }, lt ? null : { borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }]}>
              <Apple />
              <Text style={[s.gglTxt, { color: '#ffffff' }]}>Continue with Apple</Text>
            </Pressable>
          </>
        ) : null}
        {link('Continue as guest', enter)}
        <Text style={[s.agree, { color: c.agree }]}>
          {tab === 'up' ? 'Continuing as a guest means you agree to the' : 'By continuing you agree to the'}{' '}
          <Text style={{ color: c.link }} onPress={legal} accessibilityRole="link">
            Privacy Policy
          </Text>{' '}
          and{' '}
          <Text style={{ color: c.link }} onPress={terms} accessibilityRole="link">
            Terms
          </Text>
          .
        </Text>
        <Text style={[s.agree, { color: c.agree }]}>{DISCLAIMER}</Text>
      </>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: lt ? '#e7e2d8' : '#070a1c' }]}>
      <Sky w={w} h={h} light={lt} />
      {lt ? null : <Stars si={0} hd={h / u(1)} />}
      <TopInset />
      <ScrollView
        style={{ flex: 1 }}
        onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, ch) => {
          if (step !== 'form') return;
          const hh = ch - padTop - padBottom;
          if (tab === 'up') setUpH((v) => Math.max(v, hh));
          else setInH((v) => Math.max(v, hh));
        }}
        contentContainerStyle={{ paddingTop: padTop, paddingBottom: padBottom, paddingHorizontal: u(18) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View>
          <Text style={[s.welcome, { color: c.welcome }]}>Welcome to</Text>
          <Text style={[s.brand, { color: c.accent }]}>MedNova</Text>
        </View>

        <View style={[s.card, { borderColor: c.cardEdge, boxShadow: c.cardShadow }]}>
          <LinearGradient colors={c.cardGrad} style={[StyleSheet.absoluteFill, { borderRadius: u(21) }]} />
          {body}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
    welcome: { fontFamily: F.display, fontSize: u(21), lineHeight: u(20.58), letterSpacing: u(-1.2), alignSelf: 'flex-start' },
  brand: { fontFamily: F.display, fontSize: u(52), lineHeight: u(50.96), letterSpacing: u(-1.2), alignSelf: 'center', marginTop: u(2) },
  card: { marginTop: u(28), borderWidth: 1, borderRadius: u(22), padding: u(14), gap: u(8) },
  tabs: { flexDirection: 'row', padding: u(3), borderRadius: u(12) },
  tab: { flex: 1, height: u(27), borderRadius: u(9), alignItems: 'center', justifyContent: 'center' },
  tabTxt: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  h3: { fontFamily: F.display, fontSize: u(22), lineHeight: u(28), marginTop: u(4) },
  lbl: { fontFamily: F.mono, fontSize: u(7.5), lineHeight: u(10), letterSpacing: u(1.2) },
  in: {
    height: u(33),
    borderRadius: u(11),
    borderWidth: 1,
    paddingHorizontal: u(11),
    paddingVertical: 0,
    fontFamily: F.body,
    fontSize: u(10.5),
    outlineStyle: 'none',
  } as object,
  pri: { height: u(35), borderRadius: u(12), alignItems: 'center', justifyContent: 'center' },
  priTxt: { fontFamily: F.bodyBold, fontSize: u(12) },
  or: { flexDirection: 'row', alignItems: 'center', gap: u(8), height: u(10) },
  orLine: { flex: 1, height: 1 },
  orTxt: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.5) },
  ggl: { height: u(31), borderRadius: u(12), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: u(7) },
  gglTxt: { fontFamily: F.bodySemi, fontSize: u(10.5), color: '#16162b' },
  guest: { alignSelf: 'center', height: u(13), justifyContent: 'center' },
  guestTxt: { fontFamily: F.body, fontSize: u(10.5), lineHeight: u(13) },
  guestLine: { position: 'absolute', left: 0, right: 0, top: u(13.4), height: Math.max(1, u(0.8)) },
  agree: { fontFamily: F.body, fontSize: u(8), lineHeight: u(10), textAlign: 'center' },
  tick: { flexDirection: 'row', alignItems: 'center', gap: u(8), marginTop: u(2) },
  box: { width: u(14), height: u(14), borderRadius: u(4), borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tickTxt: { flex: 1, fontSize: u(9), lineHeight: u(12), textAlign: 'left' },
  note: { fontFamily: F.body, fontSize: u(9), lineHeight: u(12) },
  code: { fontFamily: F.mono, fontSize: u(14), letterSpacing: u(6), textAlign: 'center' },
});
