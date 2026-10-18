import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Back } from '@/components/Back';
import { Text } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { search } from '@/games/diagnostic/core';
import { INDEX, guessName } from '@/games/diagnostic/data';
import { useSession } from '@/games/shell/session';
import { u } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

import { saveCase } from './cases';

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
    const missing = !answer ? 'Pick the diagnosis from the list.' : gender == null ? 'Pick a gender.' : !age || !(a >= 0 && a <= 120) ? 'Add an age.' : presentation.trim().length < 10 ? 'Describe the first presentation.' : '';
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
      setMsg(many ? 'That’s 20 cases today, the most for one day. Try again tomorrow.' : 'Not saved. Check your connection and try again.');
    }
    setBusy(false);
  };

  return (
    <Screen tab="learn" glow={6}>
      <InfoScroll>
        <Back label="My cases" fallback="/learn" />
        <Kicker style={{ marginTop: u(10) }}>Case laboratory</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {'Write a '}
          <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>case</Text>
        </Text>
        <Box t={t} n="1" title="Patient">
          <Label t={t} text="Diagnosis *" />
          <TextInput value={dx} onChangeText={(v) => (setDx(v), setAnswer(null))} placeholder="Start typing, then pick it from the list" placeholderTextColor={ph(t)} style={inp(t)} autoCorrect={false} />
          {sugs.length ? (
            <View style={[s.sugs, { borderColor: t.panelLine, backgroundColor: t.panel2 }]}>
              {sugs.map((g) => (
                <Pressable key={g.id} onPress={() => (setAnswer(g.id), setDx(guessName(g.id)))} style={[s.sug, { borderColor: t.panelLine }]} accessibilityRole="button">
                  <Text style={[s.sugT, { color: t.fg }]}>{guessName(g.id)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Label t={t} text="Medical field (optional)" />
          <Chips t={t} items={FIELDS} on={field} onPick={setField} />
          <View style={s.two}>
            <View style={{ flex: 1.4, gap: u(5) }}>
              <Label t={t} text="Gender *" />
              <Chips t={t} items={[...GENDERS]} on={gender} onPick={setGender} />
            </View>
            <View style={{ flex: 1, gap: u(5) }}>
              <Label t={t} text="Age *" />
              <TextInput value={age} onChangeText={(v) => setAge(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" placeholder="34" placeholderTextColor={ph(t)} style={inp(t)} />
            </View>
          </View>
        </Box>
        <Box t={t} n="2" title="Presentation">
          <Label t={t} text="First presentation (ER or clinic) *" />
          <TextInput value={presentation} onChangeText={setPresentation} multiline maxLength={1500} placeholder="A 34-year-old woman comes to the ER with sudden shortness of breath..." placeholderTextColor={ph(t)} style={[inp(t), s.big]} />
        </Box>
        <Box t={t} n="3" title="Findings">
          <Field t={t} label="History finding" v={history} set={setHistory} ph="Long-haul flight 3 days ago" />
          <Field t={t} label="Clinical exam finding" v={exam} set={setExam} ph="Swollen, tender left calf" />
          <Field t={t} label="Investigation finding" v={investigation} set={setInvestigation} ph="Raised D-dimer" />
        </Box>
        <Box t={t} n="4" title="Key findings">
          {findings.map((f, i) => (
            <Field key={i} t={t} label={`Characteristic finding ${i + 1}`} v={f} set={(v) => setFindings((x) => x.map((y, j) => (j === i ? v : y)))} ph={i === 0 ? 'Filling defect on CT pulmonary angiogram' : ''} />
          ))}
          {findings.length < 6 ? (
            <Pressable onPress={() => setFindings((x) => [...x, ''])} accessibilityRole="button">
              <Text style={[s.add, { color: t.accent }]}>+ Add another characteristic finding</Text>
            </Pressable>
          ) : null}
        </Box>
        {msg ? <Text style={[s.msg, { color: t.red }]}>{msg}</Text> : null}
        <Pressable disabled={busy} onPress={save} accessibilityRole="button" style={busy && { opacity: 0.6 }}>
          <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.save}>
            <Text style={[s.saveT, { color: t.onGrad }]}>{signedIn ? 'Save to My cases' : 'Sign in to save'}</Text>
          </LinearGradient>
        </Pressable>
        <Text style={[s.foot, { color: t.mute }]}>Saved as a private note. Once it’s approved you can play it yourself as practice.</Text>
      </InfoScroll>
    </Screen>
  );
}

const ph = (t: Theme) => 'rgba(154,160,196,0.55)';
const inp = (t: Theme) => [s.in, { color: t.fg, borderColor: t.panelLine, backgroundColor: t.panel2 }];

function Box({ t, n, title, children }: { t: Theme; n: string; title: string; children: ReactNode }) {
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

const Label = ({ t, text }: { t: Theme; text: string }) => <Text style={[s.lab, { color: t.mute }]}>{text}</Text>;

function Field({ t, label, v, set, ph: hint }: { t: Theme; label: string; v: string; set: (v: string) => void; ph?: string }) {
  return (
    <View style={{ gap: u(5) }}>
      <Label t={t} text={label} />
      <TextInput value={v} onChangeText={set} maxLength={300} placeholder={hint} placeholderTextColor={ph(t)} style={inp(t)} />
    </View>
  );
}

function Chips({ t, items, on, onPick }: { t: Theme; items: string[]; on: number | null; onPick: (i: number) => void }) {
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

const s = StyleSheet.create({
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
