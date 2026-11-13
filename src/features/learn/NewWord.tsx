import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Back } from '@/components/Back';
import { Text, TextInput } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { InfoScroll, Kicker, s as ui, useInfo } from '@/features/info/ui';
import { useSession } from '@/games/shell/session';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { saveWord, type WordData, type WordGame } from './cases';
import { Box, Field, GameChoice, gameLabel, inp, Label, ph, s } from './NewCase';
import { tr } from '@/i18n';

export const WORD_GAMES: WordGame[] = ['the-silent-artist', 'nova-medicordle', 'the-streak-master', 'imposter'];  // Nova Password parked 2026-11-04
export { gameLabel };

/** Create your own (was Add a word; Yazan 2026-10-26, #37, renamed 2026-10-27): pick the game, then fill in that game's form. */
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
      return name.trim().length < 2 ? { ok: false, why: tr('Add the disease name.') } : { ok: true, w: { name, field: field.trim(), aliases: alts.filter((x) => x.trim()) } };
    if (game === 'nova-medicordle')
      return letters.length < 6 || letters.length > 15 ? { ok: false, why: tr('The word needs 6 to 15 letters.') } : definition.trim().length < 5 ? { ok: false, why: tr('Add a one-line definition.') } : { ok: true, w: { word: letters.toUpperCase(), definition } };
    if (game === 'the-streak-master') {
      const filled = choices.filter((x) => x.trim()).length;
      return stem.trim().length < 10 ? { ok: false, why: tr('Write the question.') } : filled < choices.length ? { ok: false, why: tr('Fill in every choice.') } : answer == null ? { ok: false, why: tr('Tap the right choice.') } : { ok: true, w: { stem, choices, answer } };
    }
    if (game === 'imposter')
      return name.trim().length < 2 || b.trim().length < 2 ? { ok: false, why: tr('Add both diseases.') } : name.trim().toLowerCase() === b.trim().toLowerCase() ? { ok: false, why: tr('The two diseases must differ.') } : { ok: true, w: { a: name, b, category: field.trim() } };
    return name.trim().length < 2 ? { ok: false, why: tr('Add the term.') } : forbidden.some((x) => !x.trim()) ? { ok: false, why: tr('Add all 5 forbidden words.') } : { ok: true, w: { name, forbidden } };
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
      setMsg(many ? tr('That’s 20 words today, the most for one day. Try again tomorrow.') : tr('Not saved. Check your connection and try again.'));
    }
    setBusy(false);
  };

  return (
    <Screen tab="learn" glow={6} wide={460}>
      <InfoScroll>
        <Back label={tr('My diseases')} fallback="/learn" />
        <Kicker style={{ marginTop: u(10) }}>{tr('Word laboratory')}</Kicker>
        <Text style={[ui.H, { color: c.fg, fontFamily: F.display }]}>
          {tr('Create your ')}
          <Text style={[ui.H, { color: t.accent, fontFamily: F.displayItalic }]}>{tr('own')}</Text>
        </Text>
        <GameChoice t={t} on={game} onPick={(g) => (g === 'the-diagnostic-pursuit' ? router.replace('/learn/new-case') : pick(g as WordGame))} words={WORD_GAMES} />

        {game === 'the-silent-artist' ? (
          <Box t={t} n="2" title={tr('The disease to draw')}>
            <Field t={t} label={tr('Disease name *')} v={name} set={setName} ph="Myocardial infarction" />
            <Field t={t} label={tr('Field (optional)')} v={field} set={setField} ph="Cardiology" />
            {alts.map((a, i) => (
              <Field key={i} t={t} label={tr('Other name {n} (optional)', { n: i + 1 })} v={a} set={(v) => setAlts((x) => x.map((y, j) => (j === i ? v : y)))} ph={i === 0 ? 'Heart attack' : 'MI'} />
            ))}
          </Box>
        ) : game === 'nova-medicordle' ? (
          <Box t={t} n="2" title={tr('The word to guess')}>
            <Field t={t} label={tr('Word, letters only * ({n} of 6 to 15)', { n: letters.length })} v={name} set={setName} ph="SCURVY" />
            <Field t={t} label={tr('One-line definition *')} v={definition} set={setDefinition} ph="Vitamin C deficiency causing bleeding and weak collagen." />
          </Box>
        ) : game === 'the-streak-master' ? (
          <Box t={t} n="2" title={tr('The question')}>
            <Label t={t} text={tr('Question *')} />
            <TextInput value={stem} onChangeText={setStem} multiline maxLength={400} placeholder={tr('Which nerve runs beneath the piriformis?')} placeholderTextColor={ph(t)} style={[inp(t), s.big]} />
            <Label t={t} text={tr('Choices * (tap the circle of the right one)')} />
            {choices.map((ch, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: u(8) }}>
                <Pressable onPress={() => setAnswer(i)} accessibilityRole="radio" accessibilityState={{ checked: answer === i }} hitSlop={u(6)}
                  style={{ width: u(18), height: u(18), borderRadius: u(9), borderWidth: 1.5, borderColor: answer === i ? t.accent : t.panelLine, alignItems: 'center', justifyContent: 'center' }}>
                  {answer === i ? <View style={{ width: u(9), height: u(9), borderRadius: u(5), backgroundColor: t.accent }} /> : null}
                </Pressable>
                <TextInput value={ch} onChangeText={(v) => setChoices((x) => x.map((y, j) => (j === i ? v : y)))} maxLength={120} placeholder={tr('Choice {n}', { n: i + 1 })} placeholderTextColor={ph(t)} style={[inp(t), { flex: 1 }]} />
              </View>
            ))}
            {choices.length < 6 ? (
              <Pressable onPress={() => setChoices((x) => [...x, ''])} accessibilityRole="button">
                <Text style={[s.add, { color: t.accent }]}>{tr('+ Add a choice (up to 6, like the game)')}</Text>
              </Pressable>
            ) : null}
          </Box>
        ) : game === 'imposter' ? (
          <Box t={t} n="2" title={tr('Two look-alike diseases')}>
            <Field t={t} label={tr('Disease 1 *')} v={name} set={setName} ph="Pneumonia" />
            <Field t={t} label={tr('Disease 2 *')} v={b} set={setB} ph="Tuberculosis" />
            <Field t={t} label={tr('Field (optional)')} v={field} set={setField} ph="Respiratory" />
          </Box>
        ) : (
          <Box t={t} n="2" title={tr('The term and its forbidden words')}>
            <Field t={t} label={tr('Term *')} v={name} set={setName} ph="Myocardial infarction" />
            {forbidden.map((f, i) => (
              <Field key={i} t={t} label={tr('Forbidden word {n} *', { n: i + 1 })} v={f} set={(v) => setForbidden((x) => x.map((y, j) => (j === i ? v : y)))} ph={['heart', 'attack', 'chest', 'troponin', 'artery'][i]} />
            ))}
          </Box>
        )}

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
