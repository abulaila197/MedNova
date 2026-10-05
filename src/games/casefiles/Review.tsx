import { StyleSheet, View } from 'react-native';

import { u } from '@/theme/scale';

import { CF, scoreRun, type CaseDef, type Run } from './core';
import { Btn, Card, CaseTitle, Kicker, NR, NoirScreen, Stamp, T } from './noir';

/**
 * The case review once the file is closed (CF1, CF7): the stamp, the points line by line, your narrowed list
 * against the doc's, and the doc's first list for reference. The right name is shown here, at the very end.
 */
export function Review({ def, run, replay, onDone, doneLabel = 'See results' }: { def: CaseDef; run: Run; replay?: boolean; onDone: () => void; doneLabel?: string }) {
  const sc = scoreRun(def, run);
  const hit = (x: string) => def.dd2.some((slot) => slot.includes(x));
  const free = (x: string) => x === def.final || x === def.parent;
  const lines = [
    { k: `Differential (${sc.ddRight} right, ${sc.ddWrong} wrong)`, v: sc.dd },
    { k: 'Diagnosis', v: sc.provisional },
    ...(run.provisional?.correct ? [] : [{ k: 'Last call', v: sc.redemption }]),
    { k: 'Time bonus', v: sc.time },
  ];
  return (
    <NoirScreen scroll>
      <View style={{ gap: u(2) }}>
        <Kicker>{`Case review · ${def.id}`}</Kicker>
        <CaseTitle title={def.title} />
      </View>
      <Stamp word={sc.stamp} />
      <Card style={{ gap: u(4) }}>
        <T size={11} color={NR.red} style={{ letterSpacing: 2 }}>THE DIAGNOSIS</T>
        <T size={17} color={NR.cardInk}>{def.final}</T>
      </Card>
      <View style={s.box}>
        {lines.map((l) => (
          <View key={l.k} style={s.line}>
            <T size={13} color={NR.soft} style={{ flex: 1 }}>{l.k}</T>
            <T size={13}>+{l.v}</T>
          </View>
        ))}
        <View style={[s.line, s.total]}>
          <T size={15}>Total</T>
          <T size={15} color={NR.red}>{sc.total}</T>
        </View>
        {replay ? <T size={11} color={NR.dim}>A replay: no EXP this time.</T> : null}
      </View>
      <View style={s.box}>
        <Kicker>Your narrowed list</Kicker>
        {(run.filtered ?? []).map((x) => (
          <T key={x} size={13} color={free(x) ? NR.soft : hit(x) ? NR.green : NR.red}>
            {free(x) ? '·' : hit(x) ? `+${CF.points.ddRight}` : `-${CF.points.ddWrong}`}  {x}
            {x === def.final ? '  (the diagnosis, not scored here)' : free(x) ? '  (another name for the diagnosis, not scored)' : ''}
          </T>
        ))}
      </View>
      <View style={s.box}>
        <Kicker>The narrowed list in the file</Kicker>
        <T size={13} style={{ lineHeight: u(19) }}>{[def.final, ...def.dd2.map((slot) => slot.join(' or '))].join('  /  ')}</T>
        <Kicker>The first list in the file</Kicker>
        <T size={12.5} color={NR.soft} style={{ lineHeight: u(18) }}>{def.dd1.join('  /  ')}</T>
      </View>
      <Btn label={doneLabel} onPress={onDone} />
    </NoirScreen>
  );
}

const s = StyleSheet.create({
  box: { borderTopWidth: 1, borderColor: NR.line, paddingTop: u(10), gap: u(4) },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: u(8) },
  total: { borderTopWidth: 1, borderColor: NR.line, paddingTop: u(6), marginTop: u(4) },
});
