// The Wheels of Chaos' own versions of the shared screens (rule RS3): mode landing, sign-in notice, setup
// ("Tonight's Bill"), pause ("Intermission") and results ("Curtain Call") in the Velvet stage look. Same logic as
// the shared screens (useLanding, useSetup, useResults); approved by Yazan on 2026-10-05.
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { u } from '@/theme/scale';

import { levelUpLine } from '../engine/levels';
import type { Mode, Play, PlayItem, Seat } from '../engine/types';
import { CHARACTERS } from '../shell/characters';
import { Face } from '../shell/Face';
import type { GameDef } from '../shell/types';
import { useSetup } from '../shell/useSetup';
import { useLanding, useResults } from '../shell/useShellPages';
import { fieldName, STYLES, type FieldKey, type Style } from './core';
import { Bill, Brass, Btn, CB, CD, Chip, CM, Gem, Kicker, Panel, ROMAN, Rule, T, Title, Token, VelvetScreen, VV } from './velvet';

const MODE_NAME: Record<Mode, string> = { solo: 'Solo', offline: 'Pass the phone', online: 'Online' };
const PAPER_RULE = 'rgba(42,26,18,0.18)';

function BackLink({ label, to }: { label: string; to: string }) {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace(to as never))} hitSlop={u(8)} accessibilityRole="link" accessibilityLabel={`Back to ${label}`} style={{ alignSelf: 'flex-start' }}>
      <T f={CM} size={13} color={VV.soft}>{`‹ ${label}`}</T>
    </Pressable>
  );
}

// ---------------------------------------------------------------- landing

function Landing({ def }: { def: GameDef }) {
  const { open, setOpen, resume, left, go, resumePlay, resumeLabel } = useLanding(def);
  return (
    <VelvetScreen scroll>
      <View style={{ gap: u(3) }}>
        <BackLink label="Games" to="/games" />
        <Kicker>Choose how to play</Kicker>
        <Title text="The Wheels of Chaos" size={27} />
        <T f={CM} size={13} color={VV.soft}>Spin of Fate</T>
      </View>
      {def.modes.map((m) => {
        const bm = resume[m.mode];
        const l = left[m.mode];
        const isOpen = open === m.mode;
        const note = m.soon ? 'Coming soon' : l == null ? '' : m.mode === 'online' ? 'Sign in to play' : `${l} of 3 free plays left`;
        return (
          <View key={m.mode} style={m.soon ? { opacity: 0.6 } : undefined}>
            <Bill>
              <View style={s.spread}>
                <T f={CB} size={11} color={VV.redInk} style={{ letterSpacing: u(2) }}>{MODE_NAME[m.mode].toUpperCase()}</T>
                <T f={CM} size={10.5} color={VV.paperSoft}>{note}</T>
              </View>
              <T f={CD} size={18} color={VV.paperInk}>{m.title}</T>
              <T size={12.5} color={VV.paperSoft}>{m.blurb}</T>
              {m.soon ? null : (
                <>
                  <Pressable onPress={() => setOpen(isOpen ? null : m.mode)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} style={{ alignSelf: 'flex-start' }}>
                    <T f={CB} size={12} color={VV.paperInk} style={{ textDecorationLine: 'underline' }}>{isOpen ? 'Hide how to play' : 'How to play'}</T>
                  </Pressable>
                  {isOpen
                    ? m.howTo.map((step, j) => (
                        <View key={j} style={{ flexDirection: 'row', gap: u(8) }}>
                          <T f={CB} size={12.5} color={VV.redInk} style={{ width: u(26) }}>{ROMAN[j] ?? String(j + 1)}</T>
                          <T size={12} color={VV.paperInk} style={{ flex: 1 }}>{step}</T>
                        </View>
                      ))
                    : null}
                  <View style={{ flexDirection: 'row', gap: u(8), marginTop: u(4) }}>
                    {bm ? <Btn label={resumeLabel(bm)} onPress={() => resumePlay(bm)} style={{ flex: 1 }} /> : null}
                    {bm ? <Btn label="New game" paper onPress={() => go(m.mode)} style={{ flex: 1 }} /> : <Btn label="Play" onPress={() => go(m.mode)} style={{ flex: 1 }} />}
                  </View>
                </>
              )}
            </Bill>
          </View>
        );
      })}
    </VelvetScreen>
  );
}

// ---------------------------------------------------------------- gate

function Gate({ def, mode }: { def: GameDef; mode: Mode }) {
  const online = mode === 'online';
  return (
    <VelvetScreen>
      <View style={{ gap: u(16), paddingTop: u(30) }}>
        <BackLink label="The Wheels of Chaos" to={`/play/${def.key}`} />
        <Bill>
          <T f={CB} size={11} color={VV.redInk} style={{ letterSpacing: u(2) }}>{online ? 'A NOTICE · ONLINE' : 'A NOTICE · FREE PLAYS USED'}</T>
          <T f={CD} size={22} color={VV.paperInk}>{online ? 'Sign in to race' : 'Keep playing'}</T>
          <T size={13} color={VV.paperSoft}>
            {online
              ? 'Online needs an account so other players see your name and your results are kept.'
              : 'You have played your 3 free Solo and Pass the phone games. Sign in to keep going. Your points and EXP from these games come with you.'}
          </T>
          <View style={{ gap: u(8), marginTop: u(6) }}>
            <Btn label="Sign in" onPress={() => router.push('/auth')} />
            <Btn label="Back" paper onPress={() => (router.canGoBack() ? router.back() : router.replace(`/play/${def.key}` as never))} />
          </View>
        </Bill>
      </View>
    </VelvetScreen>
  );
}

// ---------------------------------------------------------------- setup: tonight's bill

function Setup({ def, mode, prefill, prefillSeats }: { def: GameDef; mode: Mode; prefill?: Record<string, unknown>; prefillSeats?: Seat[] }) {
  const { opts, vals, setVals, range, seats, setSeat, pickCharacter, addSeat, removeSeat, busy, start } = useSetup(def, mode, prefill, prefillSeats);
  return (
    <VelvetScreen scroll>
      <View style={{ gap: u(3) }}>
        <BackLink label="The Wheels of Chaos" to={`/play/${def.key}`} />
        <Kicker>{MODE_NAME[mode]}</Kicker>
        <Title text="Tonight's Bill" />
      </View>
      <Bill tight>
        <View style={{ alignItems: 'center', gap: u(1) }}>
          <T f={CM} size={10} color={VV.paperSoft} style={{ letterSpacing: u(2.4) }}>THE WHEELS OF CHAOS PRESENTS</T>
          <T f={CD} size={17} color={VV.redInk}>Spin of Fate</T>
          <T f={CM} size={11} color={VV.paperSoft}>★  ★  ★</T>
        </View>
        {opts.map((o) => (
          <View key={o.key} style={{ gap: u(5) }}>
            <Rule c={PAPER_RULE} />
            <T f={CB} size={12} color={VV.paperInk} style={{ letterSpacing: u(1.2) }}>{o.label.toUpperCase()}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: u(6) }}>
              {o.choices.map((c) => (
                <Token small key={String(c.value)} label={c.label} sub={c.note} on={vals[o.key] === c.value} onPress={() => setVals((p) => ({ ...p, [o.key]: c.value }))} />
              ))}
            </View>
          </View>
        ))}
        {range ? (
          <>
            <Rule c={PAPER_RULE} />
            <View style={s.spread}>
              <T f={CB} size={12} color={VV.paperInk} style={{ letterSpacing: u(1.2) }}>STARRING</T>
              {seats.length < range.max ? (
                <Pressable onPress={addSeat} hitSlop={u(8)} accessibilityRole="button" accessibilityLabel="Add a player">
                  <T f={CB} size={11.5} color={VV.redInk}>+ Add a player</T>
                </Pressable>
              ) : null}
            </View>
            {seats.map((x, i) => (
              <View key={i} style={{ gap: u(5) }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: u(10) }}>
                <T f={CB} size={14} color={VV.redInk} style={{ width: u(26) }}>{ROMAN[i]}</T>
                <View style={s.line}>
                  <TextInput
                    value={x.name}
                    onChangeText={(v) => setSeat(i, { name: v })}
                    maxLength={14}
                    placeholder={`Player ${i + 1}`}
                    placeholderTextColor={VV.paperSoft}
                    style={s.input}
                    accessibilityLabel={`Player ${i + 1} name`}
                  />
                  <Gem c={x.color ?? VV.redInk} size={11} />
                </View>
                {seats.length > range.min ? (
                  <Pressable onPress={() => removeSeat(i)} hitSlop={u(6)} accessibilityRole="button" accessibilityLabel={`Remove player ${i + 1}`}>
                    <T size={12} color={VV.paperSoft} style={{ paddingBottom: u(4) }}>✕</T>
                  </Pressable>
                ) : null}
              </View>
              {/* AV1: the 9 characters, the chosen one ringed in stage red. */}
              <View style={s.faces}>
                {CHARACTERS.map((c) => {
                  const on = x.character === c.slug;
                  const taken = seats.some((o, j) => j !== i && o.character === c.slug);
                  return (
                    <Pressable key={c.slug} disabled={taken} onPress={() => pickCharacter(i, c.slug)} hitSlop={u(1)} accessibilityRole="button" accessibilityState={{ selected: on, disabled: taken }} accessibilityLabel={`${c.name} for player ${i + 1}`} style={[s.face, { opacity: on ? 1 : taken ? 0.18 : 0.55, borderColor: on ? VV.redInk : 'transparent' }]}>
                      <Face slug={c.slug} size={u(16)} />
                    </Pressable>
                  );
                })}
              </View>
              </View>
            ))}
            <T size={11} color={VV.paperSoft} style={{ lineHeight: u(15) }}>{def.playersNote?.(seats.length) ?? ''}</T>
          </>
        ) : null}
      </Bill>
      <T f={CM} size={11.5} color={VV.dim} style={{ textAlign: 'center' }}>Settings lock once the curtain rises.</T>
      <Btn label="Raise the curtain" onPress={start} disabled={busy} />
    </VelvetScreen>
  );
}

// ---------------------------------------------------------------- pause: intermission

/** Pause + hide: a brass placard over the closed curtain. Same props as the shared PauseMenu. */
export function WheelsPause({ open, mode, seats, keep = [], onResume, onQuit, onRemove }: { open: boolean; mode: Mode; seats?: Seat[]; keep?: number[]; onResume: () => void; onQuit: () => void; onRemove?: (seat: number) => void }) {
  if (!open) return null;
  const active = (seats ?? []).filter((x) => !x.removed);
  const removable = mode === 'offline' && onRemove && active.length > 2 ? active.filter((x) => !keep.includes(x.seat)) : [];
  return (
    // A whole page over the game, so the question is hidden and the game header stays.
    <View style={[StyleSheet.absoluteFill, { zIndex: 20 }]}>
      <VelvetScreen dark={0.18}>
        <View style={{ flex: 1, justifyContent: 'center', gap: u(16) }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', gap: u(150), marginBottom: -u(2) }}>
              <View style={s.cord} />
              <View style={s.cord} />
            </View>
            <Brass r={12} style={{ alignSelf: 'stretch' }} inner={{ backgroundColor: VV.panel }}>
              <View style={{ paddingVertical: u(18), paddingHorizontal: u(16), alignItems: 'center', gap: u(4) }}>
                <T f={CM} size={10.5} color={VV.soft} style={{ letterSpacing: u(2.4) }}>THE WHEELS STAND STILL</T>
                <T f={CD} size={28} color={VV.gold}>Intermission</T>
                <T size={12.5} color={VV.soft} style={{ textAlign: 'center' }}>The question is hidden while you pause.</T>
              </View>
            </Brass>
          </View>
          {removable.length ? (
            <View style={{ gap: u(8) }}>
              <T size={12} color={VV.soft} style={{ textAlign: 'center' }}>Tap a player to send them off. Their turns and cards are skipped.</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: u(8) }}>
                {removable.map((x) => (
                  <Chip key={x.seat} label={`${x.name}  ✕`} color={x.color} onPress={() => onRemove!(x.seat)} />
                ))}
              </View>
            </View>
          ) : null}
          <View style={{ gap: u(10), marginTop: u(6) }}>
            <Btn label="Resume the show" onPress={onResume} />
            <Btn label={mode === 'solo' ? 'Leave and save my place' : 'End game'} ghost onPress={onQuit} />
          </View>
        </View>
      </VelvetScreen>
    </View>
  );
}

// ---------------------------------------------------------------- results: curtain call

const MARK: Record<PlayItem['outcome'], string> = { right: '✓', wrong: '✕', skipped: '–', timed_out: '⏱' };

function Results({ def, play, items }: { def: GameDef; play: Play; items: PlayItem[] }) {
  const { multi, mine, right, nameOf, colorOf, rematch, changeSettings, backToGames, openDossier } = useResults(def, play, items);
  const target = Number(play.settings.target) || 50;
  const top = play.standings.filter((r) => r.rank === 1);
  const headline = multi ? (top.length === 1 ? top[0].name : 'A draw') : String(play.score);
  const sub = multi
    ? top.length === 1
      ? `takes the stage with ${top[0].score}`
      : `${top.map((x) => x.name).join(' and ')} share the stage with ${top[0]?.score ?? 0}`
    : play.score >= target
      ? 'points · target reached'
      : 'points · the show ended early';
  const stats = [
    { value: String(multi ? (play.standings.find((r) => r.seat === 0)?.score ?? 0) : play.score), label: multi ? 'Your points' : 'Points' },
    { value: `+${play.expEarned}`, label: 'EXP' },
    { value: `${right}/${mine.length}`, label: 'Right' },
  ];
  return (
    <VelvetScreen scroll>
      <View style={{ gap: u(3) }}>
        <Kicker>{MODE_NAME[play.mode]}</Kicker>
        <Title text="Curtain Call" size={28} />
      </View>
      <Brass r={14}>
        <LinearGradient colors={['#8e1a2c', '#5c0c18']} style={{ paddingVertical: u(11), paddingHorizontal: u(14), alignItems: 'center', gap: u(2) }}>
          <T f={CM} size={10.5} color={VV.cream} style={{ letterSpacing: u(2.4) }}>{`FIRST TO ${target}`}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(10) }}>
            <T f={CD} size={14} color={VV.gold}>★</T>
            <T f={CD} size={26} color={VV.gold}>{headline}</T>
            <T f={CD} size={14} color={VV.gold}>★</T>
          </View>
          <T f={CB} size={13} color={VV.cream} style={{ textAlign: 'center' }}>{sub}</T>
        </LinearGradient>
      </Brass>
      <Panel inner={{ paddingVertical: u(11), gap: u(6) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          {stats.map((x) => (
            <View key={x.label} style={{ alignItems: 'center' }}>
              <T f={CD} size={20} color={x.label === 'EXP' ? VV.gold : VV.ink}>{x.value}</T>
              <T f={CM} size={9.5} color={VV.dim} style={{ letterSpacing: u(1.4) }}>{x.label.toUpperCase()}</T>
            </View>
          ))}
        </View>
        {play.levelUp ? (
          <T f={CD} size={13} color={VV.gold} style={{ textAlign: 'center', letterSpacing: u(1.2) }}>{`★  ${levelUpLine(play.levelUp)}  ★`}</T>
        ) : null}
        {play.standings.length > 1 ? (
          <>
            <Rule />
            <Kicker color={VV.dim}>The cast</Kicker>
            {play.standings.map((r) => (
              <View key={r.seat} style={s.row}>
                <T f={CB} size={14} color={VV.dim} style={{ width: u(26) }}>{ROMAN[r.rank - 1] ?? String(r.rank)}</T>
                <Gem c={colorOf.get(r.seat)} size={9} />
                <T f={CB} size={15} color={r.rank === 1 ? VV.gold : VV.ink} style={{ flex: 1 }}>{r.name}</T>
                <T f={CD} size={16} color={VV.brass}>{String(r.score)}</T>
              </View>
            ))}
          </>
        ) : null}
        <Rule />
        <Kicker color={VV.dim}>Questions</Kicker>
        {items.map((i) => {
          const label = def.itemLabel?.(i) ?? i.itemId;
          const st = STYLES[i.gameData.style as Style]?.name ?? '';
          const what = [multi ? nameOf.get(i.seat) : null, st, i.gameData.field ? fieldName(i.gameData.field as FieldKey) : null].filter(Boolean).join(' · ');
          return (
            <View key={i.id} style={s.row}>
              <T f={CB} size={13} color={i.outcome === 'right' ? VV.right : VV.wrong} style={{ width: u(16) }}>{MARK[i.outcome]}</T>
              <View style={{ flex: 1 }}>
                <T f="InterTight_600SemiBold" size={12.5} color={VV.ink}>{label}</T>
                <T size={10.5} color={VV.dim}>{what}</T>
              </View>
              {/* RS1: dossier links only here, once the game has ended. */}
              {i.answerKey ? (
                <Pressable onPress={() => openDossier(i.answerKey!)} hitSlop={u(6)} accessibilityRole="link" accessibilityLabel={`Open the dossier for ${label}`}>
                  <T f={CB} size={11.5} color={VV.brass} style={{ textDecorationLine: 'underline' }}>Dossier ›</T>
                </Pressable>
              ) : null}
              <T f={CB} size={12.5} color={VV.soft} style={{ width: u(18), textAlign: 'right' }}>{String(i.points)}</T>
            </View>
          );
        })}
        <T size={11} color={VV.dim}>The Wheels of Chaos doesn’t send anything to Learn.</T>
      </Panel>
      <View style={{ gap: u(7) }}>
        <Btn label="Rematch" onPress={rematch} />
        <Btn label="Change settings" ghost onPress={changeSettings} />
        <Btn label="Back to games" ghost onPress={backToGames} />
      </View>
    </VelvetScreen>
  );
}

export const wheelsScreens = { Landing, Gate, Setup, Results };

const s = StyleSheet.create({
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', columnGap: u(10) },
  line: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: u(8), borderBottomWidth: 1, borderBottomColor: 'rgba(42,26,18,0.25)', paddingBottom: u(4) },
  faces: { flexDirection: 'row', flexWrap: 'wrap', gap: u(2), paddingLeft: u(20) },
  face: { padding: 1, borderRadius: u(12), borderWidth: 1.5 },
  input: { flex: 1, minWidth: 0, fontFamily: CB, fontSize: u(15), color: VV.paperInk, padding: 0, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  cord: { width: 2, height: u(26), backgroundColor: '#b8893f' },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(9) },
});
