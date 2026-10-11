import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Back } from '@/components/Back';
import { Text } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { u } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

const FIELDS = ['Cardiology', 'Respiratory', 'Gastro', 'Neurology', 'Infectious', 'Endocrine', 'Renal', 'Paediatrics', 'Obs & Gyn', 'Other'];
const STEPS = ['Patient', 'Presentation', 'Findings', 'Key findings'];

/** Write a custom case (preview): the old "Submit Custom Medical Case" fields, without the reference link. */
export function NewCase() {
  const c = useInfo();
  const t = c.t;
  const q = useLocalSearchParams<{ look?: string; step?: string }>();
  const look = q.look === 'b' ? 'b' : 'a';
  const [step, setStep] = useState(Math.max(0, Math.min(3, Number(q.step ?? 1) - 1)));
  return (
    <Screen tab="learn" glow={6}>
      <InfoScroll>
        <Back label="My cases" fallback="/learn" />
        <Kicker style={{ marginTop: u(10) }}>Case laboratory</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {'Write a '}
          <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>case</Text>
        </Text>
        {look === 'a' ? (
          <>
            <Box t={t} n="1" title="Patient">
              <PatientFields t={t} />
            </Box>
            <Box t={t} n="2" title="Presentation">
              <Field t={t} label="First presentation (ER or clinic) *" big ph="A 34-year-old woman comes to the ER with sudden shortness of breath..." />
            </Box>
            <Box t={t} n="3" title="Findings">
              <FindingFields t={t} />
            </Box>
            <Box t={t} n="4" title="Key findings">
              <KeyFields t={t} />
            </Box>
            <Save t={t} />
          </>
        ) : (
          <>
            <View style={s.steps}>
              {STEPS.map((n, i) => (
                <Pressable key={n} onPress={() => setStep(i)} style={s.step} accessibilityRole="tab">
                  <View style={[s.stepBar, { backgroundColor: i <= step ? t.accent : t.panelLine }]} />
                  <Text style={[s.stepT, { color: i === step ? t.fg : t.mute }]}>{`${i + 1} ${n}`}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[s.sheet, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
              <Text style={[s.sheetH, { color: t.fg }]}>{STEPS[step]}</Text>
              {step === 0 ? <PatientFields t={t} /> : step === 1 ? <Field t={t} label="First presentation (ER or clinic) *" big ph="A 34-year-old woman comes to the ER with sudden shortness of breath..." /> : step === 2 ? <FindingFields t={t} /> : <KeyFields t={t} />}
            </View>
            <View style={s.nav}>
              {step > 0 ? (
                <Pressable onPress={() => setStep(step - 1)} style={[s.ghost, { borderColor: t.panelLine }]}>
                  <Text style={[s.ghostT, { color: t.fg }]}>Back</Text>
                </Pressable>
              ) : (
                <View />
              )}
              {step < 3 ? (
                <Pressable onPress={() => setStep(step + 1)}>
                  <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.next}>
                    <Text style={[s.nextT, { color: t.onGrad }]}>Next</Text>
                  </LinearGradient>
                </Pressable>
              ) : null}
            </View>
            {step === 3 ? <Save t={t} /> : null}
          </>
        )}
      </InfoScroll>
    </Screen>
  );
}

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

function Field({ t, label, ph, big }: { t: Theme; label: string; ph?: string; big?: boolean }) {
  return (
    <View style={{ gap: u(5) }}>
      <Text style={[s.lab, { color: t.mute }]}>{label}</Text>
      <TextInput multiline={big} placeholder={ph} placeholderTextColor={t.mode === 'light' ? 'rgba(107,106,102,0.6)' : 'rgba(154,160,196,0.55)'} style={[s.in, big && s.big, { color: t.fg, borderColor: t.panelLine, backgroundColor: t.panel2 }]} />
    </View>
  );
}

function Chips({ t, items, on }: { t: Theme; items: string[]; on: number }) {
  return (
    <View style={s.chips}>
      {items.map((x, i) => (
        <View key={x} style={[s.chip, { borderColor: i === on ? t.accent : t.panelLine, backgroundColor: i === on ? (t.mode === 'light' ? 'rgba(229,131,58,0.1)' : 'rgba(111,214,255,0.1)') : 'transparent' }]}>
          <Text style={[s.chipT, { color: i === on ? t.fg : t.mute }]}>{x}</Text>
        </View>
      ))}
    </View>
  );
}

function PatientFields({ t }: { t: Theme }) {
  return (
    <>
      <Field t={t} label="Diagnosis *" ph="Pulmonary embolism" />
      <Text style={[s.lab, { color: t.mute }]}>Medical field (optional)</Text>
      <Chips t={t} items={FIELDS} on={1} />
      <View style={s.two}>
        <View style={{ flex: 1.4, gap: u(5) }}>
          <Text style={[s.lab, { color: t.mute }]}>Gender *</Text>
          <Chips t={t} items={['Female', 'Male', 'Other']} on={0} />
        </View>
        <View style={{ flex: 1 }}>
          <Field t={t} label="Age *" ph="34" />
        </View>
      </View>
    </>
  );
}

function FindingFields({ t }: { t: Theme }) {
  return (
    <>
      <Field t={t} label="History finding" ph="Long-haul flight 3 days ago" />
      <Field t={t} label="Clinical exam finding" ph="Swollen, tender left calf" />
      <Field t={t} label="Investigation finding" ph="Raised D-dimer" />
    </>
  );
}

function KeyFields({ t }: { t: Theme }) {
  return (
    <>
      <Field t={t} label="Characteristic finding 1" ph="Filling defect on CT pulmonary angiogram" />
      <Field t={t} label="Characteristic finding 2" ph="" />
      <Text style={[s.add, { color: t.accent }]}>+ Add another characteristic finding</Text>
    </>
  );
}

function Save({ t }: { t: Theme }) {
  return (
    <>
      <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.save}>
        <Text style={[s.nextT, { color: t.onGrad, fontSize: u(12) }]}>Save to My cases</Text>
      </LinearGradient>
      <Text style={[s.foot, { color: t.mute }]}>Saved as a private note. Once it's approved you can play it yourself, solo or as host of an online room.</Text>
    </>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(5) },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: u(9), paddingVertical: u(4) },
  chipT: { fontFamily: F.bodyMedium, fontSize: u(9.5) },
  two: { flexDirection: 'row', gap: u(10) },
  add: { fontFamily: F.bodySemi, fontSize: u(10.5) },
  save: { marginTop: u(16), height: u(38), borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  foot: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(14), textAlign: 'center', marginTop: u(8), paddingHorizontal: u(8) },
  steps: { flexDirection: 'row', gap: u(6), marginTop: u(14) },
  step: { flex: 1, gap: u(5) },
  stepBar: { height: u(3), borderRadius: 2 },
  stepT: { fontFamily: F.bodySemi, fontSize: u(8.5) },
  sheet: { marginTop: u(14), borderWidth: 1, borderRadius: u(18), padding: u(14), gap: u(10) },
  sheetH: { fontFamily: F.display, fontSize: u(20), lineHeight: u(24) },
  nav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: u(14) },
  ghost: { height: u(34), paddingHorizontal: u(20), borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  ghostT: { fontFamily: F.bodySemi, fontSize: u(11) },
  next: { height: u(34), paddingHorizontal: u(26), borderRadius: 999, justifyContent: 'center' },
  nextT: { fontFamily: F.bodyBold, fontSize: u(11) },
});
