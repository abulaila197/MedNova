import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Back } from '@/components/Back';
import { Text, TextInput } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { GAMES } from '@/data/games';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { search } from '@/games/diagnostic/core';
import { INDEX, guessName } from '@/games/diagnostic/data';
import { useSession } from '@/games/shell/session';
import { u } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

import { saveCase } from './cases';
import { tr } from '@/i18n';

const FIELDS = ['Cardiology', 'Respiratory', 'Gastro', 'Neurology', 'Infectious', 'Endocrine', 'Renal', 'Paediatrics', 'Obs & Gyn', 'Other'];
const GENDERS = ['Female', 'Male', 'Other'] as const;

/** Write a case (locked look A, one page): the old "Submit Custom Medical Case" fields, without the reference link. */
export function NewCase() {
  const c = useInfo();
  const t = c.t;
  const signedIn = !!useSession((x) => x.userId);
  const [dx, setDx] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [field, setField] = useState<number | null>(null);
  const [gender, setGender] = useState<number | null>(null);
  const [age, setAge] = useState('');
  const [presentation, setPresentation] = useState('');
  const [history, setHistory] = useState('');
  const [exam, setExam] = useState('');
  const [investigation, setInvestigation] = useState('');
  const [findings, setFindings] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const sugs = useMemo(() => (answer ? [] : search(INDEX, dx)), [dx, answer]);

  const save = async () => {
    if (!signedIn) return router.navigate('/auth');
    const a = Number(age);
    const missing = !answer ? tr('Pick the diagnosis from the list.') : gender == null ? tr('Pick a gender.') : !age || !(a >= 0 && a <= 120) ? tr('Add an age.') : presentation.trim().length < 10 ? tr('Describe the first presentation.') : '';
    if (missing) return setMsg(missing);
    setBusy(true);
    setMsg('');
    try {
      await saveCase({ diagnosis: guessName(answer!), answer_id: answer, field: field == null ? null : FIELDS[field], gender: GENDERS[gender!], age: a, presentation, history, exam, investigation, findings: findings.filter((x) => x.trim()) });
      if (router.canGoBack()) router.back();
      else router.replace('/learn');
    } catch (e) {
      // The server allows 20 new cases a day; say that instead of blaming the connection (AP12d).
      const many = String((e as { message?: string })?.message ?? '').includes('too many');
      setMsg(many ? tr('That’s 20 cases today, the most for one day. Try again tomorrow.') : tr('Not saved. Check your connection and try again.'));
    }
    setBusy(false);
  };

  return (
    <Screen tab="learn" glow={6} wide={460}>
      <InfoScroll>
        <Back label={tr('My diseases')} fallback="/learn" />
        <Kicker style={{ marginTop: u(10) }}>{tr('Case laboratory')}</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {tr('Create your ')}
          <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>{tr('own')}</Text>
        </Text>
        <GameChoice t={t} on="the-diagnostic-pursuit" onPick={(g) => g !== 'the-diagnostic-pursuit' && router.replace(`/learn/new-word?game=${g}` as never)} />
        <Box t={t} n="2" title={tr('Patient')}>
          <Label t={t} text={tr('Diagnosis *')} />
          <TextInput value={dx} onChangeText={(v) => (setDx(v), setAnswer(null))} placeholder={tr('Start typing, then pick it from the list')} placeholderTextColor={ph(t)} style={inp(t)} autoCorrect={false} />
          {sugs.length ? (
            <View style={[s.sugs, { borderColor: t.panelLine, backgroundColor: t.panel2 }]}>
              {sugs.map((g) => (
                <Pressable key={g.id} onPress={() => (setAnswer(g.id), setDx(guessName(g.id)))} style={[s.sug, { borderColor: t.panelLine }]} accessibilityRole="button">
                  <Text style={[s.sugT, { color: t.fg }]}>{guessName(g.id)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Label t={t} text={tr('Medical field (optional)')} />
          <Chips t={t} items={FIELDS} on={field} onPick={setField} />
          <View style={s.two}>
            <View style={{ flex: 1.4, gap: u(5) }}>
              <Label t={t} text={tr('Gender *')} />
              <Chips t={t} items={GENDERS.map((g) => tr(g === 'Other' ? 'Other|gender' : g))} on={gender} onPick={setGender} />
            </View>
            <View style={{ flex: 1, gap: u(5) }}>
              <Label t={t} text={tr('Age *')} />
              <TextInput value={age} onChangeText={(v) => setAge(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" placeholder="34" placeholderTextColor={ph(t)} style={inp(t)} />
            </View>
          </View>
        </Box>
        <Box t={t} n="3" title={tr('Presentation')}>
          <Label t={t} text={tr('First presentation (ER or clinic) *')} />
          <TextInput value={presentation} onChangeText={setPresentation} multiline maxLength={1500} placeholder={tr('A 34-year-old woman comes to the ER with sudden shortness of breath...')} placeholderTextColor={ph(t)} style={[inp(t), s.big]} />
        </Box>
        <Box t={t} n="4" title={tr('Findings')}>
          <Field t={t} label={tr('History finding')} v={history} set={setHistory} ph="Long-haul flight 3 days ago" />
          <Field t={t} label={tr('Clinical exam finding')} v={exam} set={setExam} ph="Swollen, tender left calf" />
          <Field t={t} label={tr('Investigation finding')} v={investigation} set={setInvestigation} ph="Raised D-dimer" />
        </Box>
        <Box t={t} n="5" title={tr('Key findings')}>
          {findings.map((f, i) => (
            <Field key={i} t={t} label={tr('Characteristic finding {n}', { n: i + 1 })} v={f} set={(v) => setFindings((x) => x.map((y, j) => (j === i ? v : y)))} ph={i === 0 ? 'Filling defect on CT pulmonary angiogram' : ''} />
          ))}
          {findings.length < 6 ? (
            <Pressable onPress={() => setFindings((x) => [...x, ''])} accessibilityRole="button">
              <Text style={[s.add, { color: t.accent }]}>{tr('+ Add another characteristic finding')}</Text>
            </Pressable>
          ) : null}
        </Box>
        {msg ? <Text style={[s.msg, { color: t.error }]}>{msg}</Text> : null}
        <Pressable disabled={busy} onPress={save} accessibilityRole="button" style={busy && { opacity: 0.6 }}>
          <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.save}>
            <Text style={[s.saveT, { color: t.onGrad }]}>{signedIn ? tr('Save to My diseases') : tr('Sign in to save')}</Text>
          </LinearGradient>
        </Pressable>
        <Text style={[s.foot, { color: t.mute }]}>{tr('You can practise it alone straight away. Once it’s approved you get 10 tokens.')}</Text>
      </InfoScroll>
    </Screen>
  );
}

export const ph = (t: Theme) => 'rgba(154,160,196,0.55)';
export const inp = (t: Theme) => [s.in, { color: t.fg, borderColor: t.panelLine, backgroundColor: t.panel2 }];

export function Box({ t, n, title, children }: { t: Theme; n: string; title: string; children: ReactNode }) {
  return (
    <View style={[s.box, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
      <View style={s.boxH}>
        <Text style={[s.boxN, { color: t.kick }]}>{n.padStart(2, '0')}</Text>
        <Text style={[s.boxT, { color: t.fg }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export const Label = ({ t, text }: { t: Theme; text: string }) => <Text style={[s.lab, { color: t.mute }]}>{text}</Text>;

export function Field({ t, label, v, set, ph: hint }: { t: Theme; label: string; v: string; set: (v: string) => void; ph?: string }) {
  return (
    <View style={{ gap: u(5) }}>
      <Label t={t} text={label} />
      <TextInput value={v} onChangeText={set} maxLength={300} placeholder={hint} placeholderTextColor={ph(t)} style={inp(t)} />
    </View>
  );
}

/** A game's name as the Games page shows it ("Race to Diagnosis", "Sketch It"). */
export const gameLabel = (g: string) => {
  const x = GAMES.find((y) => y.key === g);
  return x ? `${x.lead.replace(/^The /, '')} ${x.em}`.trim() : g;
};

/** Words the Create your own page can make, after Race to Diagnosis cases (kept here so both pages share it). */
const WORD_KEYS = ['the-silent-artist', 'nova-medicordle', 'the-streak-master', 'imposter'];

/**
 * Step 1 of Create your own: the game. Race to Diagnosis cases and the other games' words share one page (Yazan
 * 2026-11-12: no separate "Write a DP case" button); picking another game swaps in that game's form.
 */
export function GameChoice({ t, on, onPick, words = WORD_KEYS }: { t: Theme; on: string; onPick: (g: string) => void; words?: string[] }) {
  const keys = ['the-diagnostic-pursuit', ...words];
  return (
    <Box t={t} n="1" title={tr('Game')}>
      <Chips t={t} items={keys.map(gameLabel)} on={keys.indexOf(on)} onPick={(i) => onPick(keys[i])} />
    </Box>
  );
}

export function Chips({ t, items, on, onPick }: { t: Theme; items: string[]; on: number | null; onPick: (i: number) => void }) {
  return (
    <View style={s.chips}>
      {items.map((x, i) => (
        <Pressable key={x} onPress={() => onPick(i)} accessibilityRole="button" accessibilityState={{ selected: i === on }} style={[s.chip, { borderColor: i === on ? t.accent : t.panelLine, backgroundColor: i === on ? 'rgba(111,214,255,0.1)' : 'transparent' }]}>
          <Text style={[s.chipT, { color: i === on ? t.fg : t.mute }]}>{x}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const s = StyleSheet.create({
  box: { marginTop: u(12), borderWidth: 1, borderRadius: u(18), padding: u(14), gap: u(10) },
  boxH: { flexDirection: 'row', alignItems: 'baseline', gap: u(8) },
  boxN: { fontFamily: F.mono, fontSize: u(9), letterSpacing: u(1) },
  boxT: { fontFamily: F.display, fontSize: u(16), lineHeight: u(19) },
  lab: { fontFamily: F.bodyMedium, fontSize: u(9.5) },
  in: { height: u(34), borderWidth: 1, borderRadius: u(11), paddingHorizontal: u(11), fontFamily: F.body, fontSize: u(11) },
  big: { height: u(78), paddingTop: u(9), textAlignVertical: 'top' },
  sugs: { borderWidth: 1, borderRadius: u(11), overflow: 'hidden', marginTop: -u(4) },
  sug: { paddingVertical: u(8), paddingHorizontal: u(11), borderBottomWidth: 1 },
  sugT: { fontFamily: F.body, fontSize: u(10.5) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(5) },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: u(9), paddingVertical: u(4) },
  chipT: { fontFamily: F.bodyMedium, fontSize: u(9.5) },
  two: { flexDirection: 'row', gap: u(10) },
  add: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  msg: { fontFamily: F.bodyMedium, fontSize: u(10.5), marginTop: u(12), textAlign: 'center' },
  save: { marginTop: u(16), height: u(38), borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  saveT: { fontFamily: F.bodyBold, fontSize: u(12) },
  foot: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(14), textAlign: 'center', marginTop: u(8), paddingHorizontal: u(8) },
});
