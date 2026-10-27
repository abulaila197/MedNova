import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Back } from '@/components/Back';
import { Text, TextInput } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { GAMES } from '@/data/games';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { useSession } from '@/games/shell/session';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { saveWord, type WordData, type WordGame } from './cases';
import { Box, Chips, Field, inp, Label, ph, s } from './NewCase';

export const WORD_GAMES: WordGame[] = ['the-silent-artist', 'nova-medicordle', 'the-streak-master', 'imposter', 'nova-password'];
export const gameLabel = (g: string) => {
  const x = GAMES.find((y) => y.key === g);
  return x ? `${x.lead.replace(/^The /, '')} ${x.em}`.trim() : g;
};

/** Add a word (Yazan 2026-10-26, #37): pick the game, then fill in that game's form. */
export function NewWord({ start }: { start?: WordGame }) {
  const c = useInfo();
  const t = c.t;
  const signedIn = !!useSession((x) => x.userId);
  const [game, setGame] = useState<WordGame>(start && WORD_GAMES.includes(start) ? start : 'the-silent-artist');
  const [name, setName] = useState('');
  // Typed by the player and optional (Yazan 2026-10-27).
  const [field, setField] = useState('');
  const [alts, setAlts] = useState(['', '']);
  const [definition, setDefinition] = useState('');
  const [stem, setStem] = useState('');
  const [choices, setChoices] = useState(['', '', '', '']);
  const [answer, setAnswer] = useState<number | null>(null);
  const [b, setB] = useState('');
  const [forbidden, setForbidden] = useState(['', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const letters = name.replace(/[^A-Za-z]/g, '');
  const form = (): { ok: true; w: WordData[WordGame] } | { ok: false; why: string } => {
    if (game === 'the-silent-artist')
      return name.trim().length < 2 ? { ok: false, why: 'Add the disease name.' } : { ok: true, w: { name, field: field.trim(), aliases: alts.filter((x) => x.trim()) } };
    if (game === 'nova-medicordle')
      return letters.length < 6 || letters.length > 15 ? { ok: false, why: 'The word needs 6 to 15 letters.' } : definition.trim().length < 5 ? { ok: false, why: 'Add a one-line definition.' } : { ok: true, w: { word: letters.toUpperCase(), definition } };
    if (game === 'the-streak-master') {
      const filled = choices.filter((x) => x.trim()).length;
      return stem.trim().length < 10 ? { ok: false, why: 'Write the question.' } : filled < choices.length ? { ok: false, why: 'Fill in every choice.' } : answer == null ? { ok: false, why: 'Tap the right choice.' } : { ok: true, w: { stem, choices, answer } };
    }
    if (game === 'imposter')
      return name.trim().length < 2 || b.trim().length < 2 ? { ok: false, why: 'Add both diseases.' } : name.trim().toLowerCase() === b.trim().toLowerCase() ? { ok: false, why: 'The two diseases must differ.' } : { ok: true, w: { a: name, b, category: field.trim() } };
    return name.trim().length < 2 ? { ok: false, why: 'Add the term.' } : forbidden.some((x) => !x.trim()) ? { ok: false, why: 'Add all 5 forbidden words.' } : { ok: true, w: { name, forbidden } };
  };

  const pick = (g: WordGame) => {
    setGame(g);
    setField('');
    setMsg('');
  };
  const save = async () => {
    if (!signedIn) return router.navigate('/auth');
    const f = form();
    if (!f.ok) return setMsg(f.why);
    setBusy(true);
    setMsg('');
    try {
      await saveWord(game, f.w);
      if (router.canGoBack()) router.back();
      else router.replace('/learn');
    } catch (e) {
      const many = String((e as { message?: string })?.message ?? '').includes('too many');
      setMsg(many ? 'That’s 20 words today, the most for one day. Try again tomorrow.' : 'Not saved. Check your connection and try again.');
    }
    setBusy(false);
  };

  return (
    <Screen tab="learn" glow={6}>
      <InfoScroll>
        <Back label="My diseases" fallback="/learn" />
        <Kicker style={{ marginTop: u(10) }}>Word laboratory</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {'Add a '}
          <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>word</Text>
        </Text>
        <Box t={t} n="1" title="Game">
          <Chips t={t} items={WORD_GAMES.map(gameLabel)} on={WORD_GAMES.indexOf(game)} onPick={(i) => pick(WORD_GAMES[i])} />
        </Box>

        {game === 'the-silent-artist' ? (
          <Box t={t} n="2" title="The disease to draw">
            <Field t={t} label="Disease name *" v={name} set={setName} ph="Myocardial infarction" />
            <Field t={t} label="Field (optional)" v={field} set={setField} ph="Cardiology" />
            {alts.map((a, i) => (
              <Field key={i} t={t} label={`Other name ${i + 1} (optional)`} v={a} set={(v) => setAlts((x) => x.map((y, j) => (j === i ? v : y)))} ph={i === 0 ? 'Heart attack' : 'MI'} />
            ))}
          </Box>
        ) : game === 'nova-medicordle' ? (
          <Box t={t} n="2" title="The word to guess">
            <Field t={t} label={`Word, letters only * (${letters.length} of 6 to 15)`} v={name} set={setName} ph="SCURVY" />
            <Field t={t} label="One-line definition *" v={definition} set={setDefinition} ph="Vitamin C deficiency causing bleeding and weak collagen." />
          </Box>
        ) : game === 'the-streak-master' ? (
          <Box t={t} n="2" title="The question">
            <Label t={t} text="Question *" />
            <TextInput value={stem} onChangeText={setStem} multiline maxLength={400} placeholder="Which nerve runs beneath the piriformis?" placeholderTextColor={ph(t)} style={[inp(t), s.big]} />
            <Label t={t} text="Choices * (tap the circle of the right one)" />
            {choices.map((ch, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: u(8) }}>
                <Pressable onPress={() => setAnswer(i)} accessibilityRole="radio" accessibilityState={{ checked: answer === i }} hitSlop={u(6)}
                  style={{ width: u(18), height: u(18), borderRadius: u(9), borderWidth: 1.5, borderColor: answer === i ? t.accent : t.panelLine, alignItems: 'center', justifyContent: 'center' }}>
                  {answer === i ? <View style={{ width: u(9), height: u(9), borderRadius: u(5), backgroundColor: t.accent }} /> : null}
                </Pressable>
                <TextInput value={ch} onChangeText={(v) => setChoices((x) => x.map((y, j) => (j === i ? v : y)))} maxLength={120} placeholder={`Choice ${i + 1}`} placeholderTextColor={ph(t)} style={[inp(t), { flex: 1 }]} />
              </View>
            ))}
            {choices.length < 6 ? (
              <Pressable onPress={() => setChoices((x) => [...x, ''])} accessibilityRole="button">
                <Text style={[s.add, { color: t.accent }]}>+ Add a choice (up to 6, like the game)</Text>
              </Pressable>
            ) : null}
          </Box>
        ) : game === 'imposter' ? (
          <Box t={t} n="2" title="Two look-alike diseases">
            <Field t={t} label="Disease 1 *" v={name} set={setName} ph="Pneumonia" />
            <Field t={t} label="Disease 2 *" v={b} set={setB} ph="Tuberculosis" />
            <Field t={t} label="Field (optional)" v={field} set={setField} ph="Respiratory" />
          </Box>
        ) : (
          <Box t={t} n="2" title="The term and its forbidden words">
            <Field t={t} label="Term *" v={name} set={setName} ph="Myocardial infarction" />
            {forbidden.map((f, i) => (
              <Field key={i} t={t} label={`Forbidden word ${i + 1} *`} v={f} set={(v) => setForbidden((x) => x.map((y, j) => (j === i ? v : y)))} ph={['heart', 'attack', 'chest', 'troponin', 'artery'][i]} />
            ))}
          </Box>
        )}

        {msg ? <Text style={[s.msg, { color: t.error }]}>{msg}</Text> : null}
        <Pressable disabled={busy} onPress={save} accessibilityRole="button" style={busy && { opacity: 0.6 }}>
          <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.save}>
            <Text style={[s.saveT, { color: t.onGrad }]}>{signedIn ? 'Save to My diseases' : 'Sign in to save'}</Text>
          </LinearGradient>
        </Pressable>
        <Text style={[s.foot, { color: t.mute }]}>You can practise it alone straight away. Once it’s approved it also plays in rooms you host, and you get 10 tokens.</Text>
      </InfoScroll>
    </Screen>
  );
}
