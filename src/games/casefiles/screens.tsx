// Case Files' own versions of the shared screens (rule RS3): mode landing, sign-in gate, setup, pause and
// results, drawn as typed sheets pinned to the Evidence board. Same logic as the shared screens (useLanding,
// useSetup, useResults); only the look is the game's own. Approved by Yazan on 2026-10-05.
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { u } from '@/theme/scale';

import { levelUpLine } from '../engine/levels';
import type { Mode, Play, PlayItem, Seat } from '../engine/types';
import { CHARACTERS } from '../shell/characters';
import { Face } from '../shell/Face';
import type { GameDef } from '../shell/types';
import { useSetup } from '../shell/useSetup';
import { useLanding, useResults } from '../shell/useShellPages';
import { caseById, caseLabel } from './data';
import { CaseTitle, Kicker, NoirScreen, NR, T } from './noir';

/** Ink colours for players and teams on paper (the app's cyan/violet would clash with the board). */
export const INK = ['#c8232f', '#3d6b9c', '#b8862a', '#5e8a63', '#7d5b9e', '#7a7a74'];
export const INK_TEAMS = ['Team Red', 'Team Blue', 'Team Ochre', 'Team Green', 'Team Violet', 'Team Graphite'].map((name, i) => ({ name, color: INK[i] }));

const PAPER = { bg: NR.card, ink: NR.cardInk, soft: NR.cardSoft, rule: 'rgba(22,22,22,0.16)' };
const MODE_NAME: Record<Mode, string> = { solo: 'Solo', offline: 'Pass the phone', online: 'Online' };

// ---------------------------------------------------------------- paper pieces

/** A cream sheet pinned to the board: a red pin head on top, tilted a touch. */
function Sheet({ children, tilt = 0, style, dense }: { children: ReactNode; tilt?: number; style?: StyleProp<ViewStyle>; dense?: boolean }) {
  return (
    <View style={[{ transform: [{ rotate: `${tilt}deg` }] }, style]}>
      <View style={[sh.sheet, dense ? { gap: u(4), paddingTop: u(12), paddingBottom: u(9) } : null]}>{children}</View>
      <View style={sh.pin} />
    </View>
  );
}

/** Solid red button with cream type, for use on paper; ghost is an ink outline. */
function PaperBtn({ label, ghost, onPress, style }: { label: string; ghost?: boolean; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [sh.pbtn, ghost ? { backgroundColor: 'transparent', borderColor: PAPER.ink } : null, { opacity: pressed ? 0.75 : 1 }, style]}>
      <T size={ghost ? 13 : 14} color={ghost ? PAPER.ink : '#f6efe2'} style={{ letterSpacing: 1, textAlign: 'center', textTransform: ghost ? 'none' : 'uppercase' }}>{label}</T>
    </Pressable>
  );
}

/** Dark-room button, the same as in play. */
function RoomBtn({ label, ghost, onPress, disabled, style }: { label: string; ghost?: boolean; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [sh.rbtn, ghost ? { borderColor: NR.line, backgroundColor: 'transparent', paddingVertical: u(10) } : null, { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }, style]}>
      <T size={ghost ? 13 : 14.5} color={ghost ? NR.soft : NR.white} style={{ letterSpacing: 1, textAlign: 'center', textTransform: ghost ? 'none' : 'uppercase' }}>{label}</T>
    </Pressable>
  );
}

const Ink = ({ children, size = 13, color = PAPER.ink, style, lines }: { children: ReactNode; size?: number; color?: string; style?: object; lines?: number }) => (
  <T size={size} color={color} style={style} lines={lines}>{children}</T>
);

/** "‹ Games" in typewriter type: back, or to `to` when the page was opened directly. */
function BackLink({ label, to }: { label: string; to: string }) {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace(to as never))} hitSlop={u(8)} accessibilityRole="link" accessibilityLabel={`Back to ${label}`} style={{ alignSelf: 'flex-start' }}>
      <T size={13} color={NR.soft}>{`‹ ${label}`}</T>
    </Pressable>
  );
}

/** Typewriter tick box: an empty square, or one struck with a red X. */
function Box({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={u(5)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: u(5) }}>
      <View style={[sh.box, on ? { borderColor: NR.red } : null]}>{on ? <Text style={sh.x}>✕</Text> : null}</View>
      <Ink size={13}>{label}</Ink>
    </Pressable>
  );
}

/** A typed line on the form: an optional diamond tag, then an underlined value. */
function Field({ children, tag, onTag, tagLabel }: { children: ReactNode; tag?: string; onTag?: () => void; tagLabel?: string }) {
  const diamond = tag ? <View style={[sh.tag, { backgroundColor: tag }]} /> : null;
  return (
    <View style={sh.field}>
      {onTag ? (
        <Pressable onPress={onTag} hitSlop={u(8)} accessibilityRole="button" accessibilityLabel={tagLabel}>
          {diamond}
        </Pressable>
      ) : diamond}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function Rule() {
  return <View style={{ height: 1, backgroundColor: PAPER.rule, marginVertical: u(2) }} />;
}

const Label = ({ children }: { children: string }) => (
  <Ink size={11} color={PAPER.soft} style={{ letterSpacing: 2 }}>{children}</Ink>
);

function BoardCorner() {
  // The felt board peeks in at the top right, feathered into the room.
  return (
    <View style={sh.corner} pointerEvents="none">
      <Image source={require('@/assets/casefiles/board.jpg')} style={[StyleSheet.absoluteFill, { opacity: 0.55 }]} contentFit="cover" />
      <LinearGradient colors={['#2e2e2d', 'rgba(46,46,45,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 0.75, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(46,46,45,0)', '#2c2c2b']} start={{ x: 0.5, y: 0.3 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
    </View>
  );
}

// ---------------------------------------------------------------- landing

function Landing({ def }: { def: GameDef }) {
  const { open, setOpen, resume, left, go, resumePlay, resumeLabel } = useLanding(def);
  return (
    <NoirScreen scroll>
      <BoardCorner />
      <View style={{ gap: u(14) }}>
        <View style={{ gap: u(4) }}>
          <BackLink label="Games" to="/games" />
          <Kicker>Choose how to play</Kicker>
          <CaseTitle title="Case Files" size={32} />
          <T size={13} color={NR.soft}>Unsolved Differentials</T>
        </View>
        {def.modes.map((m, i) => {
          const bm = resume[m.mode];
          const l = left[m.mode];
          const isOpen = open === m.mode;
          const note = m.soon ? 'Coming soon' : l == null ? '' : m.mode === 'online' ? 'Sign in to play' : `${l} of 3 free plays left`;
          return (
            <Sheet key={m.mode} tilt={i % 2 ? 0.6 : -0.5} style={m.soon ? { opacity: 0.6 } : undefined}>
              <View style={sh.spread}>
                <Ink size={11} color={NR.red} style={{ letterSpacing: 2 }}>{MODE_NAME[m.mode].toUpperCase()}</Ink>
                <Ink size={10.5} color={PAPER.soft}>{note}</Ink>
              </View>
              <Ink size={19}>{m.title}</Ink>
              <Ink size={12.5} color={PAPER.soft}>{m.blurb}</Ink>
              {m.soon ? null : (
                <>
                  <Pressable onPress={() => setOpen(isOpen ? null : m.mode)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} style={{ alignSelf: 'flex-start' }}>
                    <Ink size={12.5} style={{ textDecorationLine: 'underline' }}>{isOpen ? 'Hide how to play' : 'How to play'}</Ink>
                  </Pressable>
                  {isOpen
                    ? m.howTo.map((step, j) => (
                        <View key={j} style={{ flexDirection: 'row', gap: u(8) }}>
                          <Ink size={12} color={NR.red}>{String(j + 1).padStart(2, '0')}</Ink>
                          <Ink size={12} style={{ flex: 1 }}>{step}</Ink>
                        </View>
                      ))
                    : null}
                  <View style={{ flexDirection: 'row', gap: u(8), marginTop: u(4) }}>
                    {bm ? <PaperBtn label={resumeLabel(bm)} onPress={() => resumePlay(bm)} style={{ flex: 1 }} /> : null}
                    <PaperBtn label={bm ? 'New game' : 'Play'} ghost={!!bm} onPress={() => go(m.mode)} style={{ flex: 1 }} />
                  </View>
                </>
              )}
            </Sheet>
          );
        })}
      </View>
    </NoirScreen>
  );
}

// ---------------------------------------------------------------- gate

/** Rules 19-20 as a pinned notice. */
function Gate({ def, mode }: { def: GameDef; mode: Mode }) {
  const online = mode === 'online';
  return (
    <NoirScreen>
      <View style={{ gap: u(16), paddingTop: u(30) }}>
        <BackLink label="Case Files" to={`/play/${def.key}`} />
        <Sheet tilt={-0.8}>
          <Ink size={11} color={NR.red} style={{ letterSpacing: 2 }}>{online ? 'NOTICE · ONLINE' : 'NOTICE · FREE PLAYS USED'}</Ink>
          <Ink size={22}>{online ? 'Sign in to race' : 'Keep playing'}</Ink>
          <Ink size={13} color={PAPER.soft}>
            {online
              ? 'Online needs an account so other detectives see your name and your results are kept.'
              : 'You have played your 3 free Solo and Pass the phone games. Sign in to keep going. Your misses, points and EXP from these games come with you.'}
          </Ink>
          <View style={{ gap: u(8), marginTop: u(6) }}>
            <PaperBtn label="Sign in" onPress={() => router.push('/auth')} />
            <PaperBtn label="Back" ghost onPress={() => (router.canGoBack() ? router.back() : router.replace(`/play/${def.key}` as never))} />
          </View>
        </Sheet>
      </View>
    </NoirScreen>
  );
}

// ---------------------------------------------------------------- setup

/** The intake form: teams as typed tick boxes, investigators on typed lines, team marks as ink squares. */
function Setup({ def, mode, prefill, prefillSeats }: { def: GameDef; mode: Mode; prefill?: Record<string, unknown>; prefillSeats?: Seat[] }) {
  const st = useSetup(def, mode, prefill, prefillSeats);
  const { opts, vals, setVals, range, seats, setSeat, pickCharacter, addSeat, removeSeat, canTeam, teams, teamCount, renameTeam, teamChoices, preset, emptyTeam, busy, start } = st;
  return (
    <NoirScreen scroll>
      <View style={{ gap: u(7) }}>
        <View style={{ gap: u(2) }}>
          <BackLink label="Case Files" to={`/play/${def.key}`} />
          <Kicker>{MODE_NAME[mode]}</Kicker>
          <CaseTitle title="Case intake" size={24} />
        </View>
        <Sheet tilt={-0.4} style={{ marginTop: u(4) }} dense>
          <View style={sh.spread}>
            <Ink size={11} color={NR.red} style={{ letterSpacing: 2 }}>INTAKE FORM</Ink>
            <Ink size={11} color={PAPER.soft}>{range ? `Form CF-${range.max}` : 'Form CF-1'}</Ink>
          </View>
          {opts.map((o) => (
            <View key={o.key} style={{ gap: u(3) }}>
              <Ink size={12} color={PAPER.soft}>{o.label}</Ink>
              <View style={sh.boxes}>
                {o.choices.map((c) => (
                  <Box key={String(c.value)} label={c.label} on={vals[o.key] === c.value} onPress={() => setVals((p) => ({ ...p, [o.key]: c.value }))} />
                ))}
              </View>
            </View>
          ))}
          {canTeam ? (
            <>
              <Ink size={12} color={PAPER.soft}>Teams</Ink>
              <View style={sh.boxes}>
                {teamChoices.map((c) => (
                  <Box key={c.value} label={c.label} on={(teams?.length ?? 0) === c.value} onPress={() => teamCount(c.value)} />
                ))}
              </View>
              {teams ? (
                <View style={sh.tnames}>
                  {teams.map((tm, i) => (
                    <View key={tm.id} style={sh.tname}>
                      <Field tag={tm.color}>
                        <TextInput
                          value={tm.name}
                          onChangeText={(v) => renameTeam(i, v)}
                          maxLength={16}
                          placeholder={preset(tm.id).name}
                          placeholderTextColor={PAPER.soft}
                          style={sh.input}
                          accessibilityLabel={`Team ${i + 1} name`}
                        />
                      </Field>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
          {range ? (
            <>
              {canTeam || opts.length ? <Rule /> : null}
              <View style={sh.spread}>
                <Ink size={12} color={PAPER.soft}>Investigators</Ink>
                {seats.length < range.max ? (
                  <Pressable onPress={addSeat} hitSlop={u(8)} accessibilityRole="button" accessibilityLabel="Add investigator">
                    <Ink size={12} color={NR.red}>+ Add investigator</Ink>
                  </Pressable>
                ) : null}
              </View>
              {seats.map((x, i) => {
                const tm = teams?.find((y) => y.id === x.team);
                return (
                  <View key={i} style={{ gap: u(4) }}>
                  <View style={sh.seat}>
                    <Ink size={12} color={PAPER.soft} style={{ width: u(20) }}>{String(i + 1).padStart(2, '0')}</Ink>
                    <Field tag={tm?.color ?? x.color}>
                      <TextInput
                        value={x.name}
                        onChangeText={(v) => setSeat(i, { name: v })}
                        maxLength={14}
                        placeholder={`Player ${i + 1}`}
                        placeholderTextColor={PAPER.soft}
                        style={[sh.input, { fontSize: u(13.5) }]}
                        accessibilityLabel={`Investigator ${i + 1} name`}
                      />
                    </Field>
                    {teams ? (
                      <View style={{ flexDirection: 'row', gap: u(5), paddingBottom: u(3) }}>
                        {teams.map((y) => {
                          const on = x.team === y.id;
                          return (
                            <Pressable
                              key={y.id}
                              onPress={() => setSeat(i, { team: y.id })}
                              hitSlop={u(3)}
                              style={[sh.mark, { borderColor: y.color, backgroundColor: on ? y.color : 'transparent' }]}
                              accessibilityRole="button"
                              accessibilityState={{ selected: on }}
                              accessibilityLabel={`Put investigator ${i + 1} in ${y.name}`}
                            />
                          );
                        })}
                      </View>
                    ) : null}
                    {seats.length > range.min ? (
                      <Pressable onPress={() => removeSeat(i)} hitSlop={u(6)} accessibilityRole="button" accessibilityLabel={`Remove investigator ${i + 1}`}>
                        <Ink size={12} color={PAPER.soft} style={{ paddingBottom: u(3) }}>✕</Ink>
                      </Pressable>
                    ) : null}
                  </View>
                  {/* AV1: the 9 characters as small photos clipped to the form; the chosen one is circled in ink. */}
                  <View style={sh.faces}>
                    {CHARACTERS.map((c) => {
                      const taken = seats.some((o, j) => j !== i && o.character === c.slug);
                      const on = x.character === c.slug;
                      return (
                        <Pressable
                          key={c.slug}
                          disabled={taken}
                          onPress={() => pickCharacter(i, c.slug)}
                          hitSlop={u(1)}
                          style={[sh.face, { opacity: on ? 1 : taken ? 0.18 : 0.6, borderColor: on ? PAPER.ink : 'transparent' }]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on, disabled: taken }}
                          accessibilityLabel={`${c.name} for investigator ${i + 1}`}
                        >
                          <Face slug={c.slug} size={u(16)} />
                        </Pressable>
                      );
                    })}
                  </View>
                  </View>
                );
              })}
              <Ink size={11} color={PAPER.soft}>
                {`${teams ? 'Tap a square by each investigator to pick their team.' : 'Tap a photo to pick an investigator’s character.'} ${def.playersNote?.(seats.length) ?? ''}`.trim()}
              </Ink>
            </>
          ) : (
            <Ink size={12.5} color={PAPER.soft}>You work the case alone. Pick it from the library next.</Ink>
          )}
        </Sheet>
        <T size={11.5} color={emptyTeam ? NR.red : NR.dim} style={{ textAlign: 'center' }}>
          {emptyTeam ? `${emptyTeam.name} has no investigators yet.` : 'Settings lock once the case is opened.'}
        </T>
        <RoomBtn label="Open the case" onPress={start} disabled={busy || !!emptyTeam} />
      </View>
    </NoirScreen>
  );
}

// ---------------------------------------------------------------- pause

/** Pause + hide: the case goes face down, a pinned sheet with a PAUSED stamp. Same props as the shared PauseMenu. */
export function CasePause({ open, mode, seats, keep = [], onResume, onQuit, onRemove }: { open: boolean; mode: Mode; seats?: Seat[]; keep?: number[]; onResume: () => void; onQuit: () => void; onRemove?: (seat: number) => void }) {
  if (!open) return null;
  const active = (seats ?? []).filter((x) => !x.removed);
  const removable = mode === 'offline' && onRemove && active.length > 2 ? active.filter((x) => !keep.includes(x.seat)) : [];
  return (
    // A whole page of its own over the case, so the case is hidden and the game header stays.
    <View style={[StyleSheet.absoluteFill, { zIndex: 20 }]}>
      <NoirScreen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <T size={13} color={NR.dim} style={{ textAlign: 'center' }}>The case is face down while you pause.</T>
      </View>
      <Sheet>
        <View style={sh.paused}>
          <Ink size={22} color={NR.red} style={{ letterSpacing: 5 }}>PAUSED</Ink>
        </View>
        {removable.length ? (
          <>
            <Ink size={12} color={PAPER.soft}>Tap an investigator to take them off the case. Their turns are skipped.</Ink>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: u(8) }}>
              {removable.map((x) => (
                <Pressable key={x.seat} onPress={() => onRemove!(x.seat)} style={[sh.chip, { borderColor: x.color ?? PAPER.ink }]} accessibilityRole="button" accessibilityLabel={`Remove ${x.name}`}>
                  <View style={[sh.tag, { backgroundColor: x.color ?? PAPER.ink, marginBottom: 0 }]} />
                  <Ink size={13}>{`${x.name}  ✕`}</Ink>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        <PaperBtn label="Resume" onPress={onResume} style={{ marginTop: u(6) }} />
        <PaperBtn label={mode === 'solo' ? 'Leave and save my place' : 'End game'} ghost onPress={onQuit} />
      </Sheet>
      </NoirScreen>
    </View>
  );
}

// ---------------------------------------------------------------- results

const MARK: Record<PlayItem['outcome'], string> = { right: '✓', wrong: '✕', skipped: '–', timed_out: '⏱' };

/** The final report: a typed sheet with a CLOSED stamp (rule 14 buttons below it). */
function Results({ def, play, items }: { def: GameDef; play: Play; items: PlayItem[] }) {
  const { multi, nameOf, colorOf, teamRows, stats, missed, rematch, changeSettings, backToGames, openDossier } = useResults(def, play, items);
  const c = items[0] ? caseById.get(items[0].itemId) : undefined;
  const top = stats.flatMap((x, i) => (i === 0 ? [x, { value: `+${play.expEarned}`, label: 'EXP' }] : [x]));
  return (
    <NoirScreen scroll>
      <View style={{ gap: u(12) }}>
        <View style={{ gap: u(4) }}>
          <Kicker>{`Case Files · ${MODE_NAME[play.mode]}`}</Kicker>
          <CaseTitle title="Case closed" size={28} />
        </View>
        <Sheet tilt={-0.3}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ gap: u(2), flex: 1 }}>
              <Ink size={11} color={NR.red} style={{ letterSpacing: 2 }}>FINAL REPORT</Ink>
              {c ? <Ink size={11} color={PAPER.soft}>{`${caseLabel(c.id)} · ${c.title}`}</Ink> : null}
            </View>
            <View style={sh.closed}>
              <Ink size={15} color={NR.red} style={{ letterSpacing: 3 }}>CLOSED</Ink>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: u(6) }}>
            {top.map((x) => (
              <View key={x.label} style={{ alignItems: 'center' }}>
                <Ink size={26} color={x.label === 'EXP' ? NR.red : PAPER.ink}>{x.value}</Ink>
                <Ink size={10} color={PAPER.soft} style={{ letterSpacing: 1.6 }}>{x.label.toUpperCase()}</Ink>
              </View>
            ))}
          </View>
          {play.levelUp ? (
            <Ink size={12} color={NR.red} style={{ textAlign: 'center', letterSpacing: 2 }}>{levelUpLine(play.levelUp)!.toUpperCase()}</Ink>
          ) : null}
          {teamRows ? (
            <>
              <Rule />
              <Label>TEAMS</Label>
              {teamRows.map((r) => (
                <View key={r.id} style={sh.row}>
                  <Ink size={12} color={PAPER.soft} style={{ width: u(16) }}>{r.rank}</Ink>
                  <View style={[sh.tag, { backgroundColor: r.color, marginBottom: 0 }]} />
                  <Ink size={13.5} style={{ flex: 1 }}>{r.name}</Ink>
                  <Ink size={13.5}>{String(r.score)}</Ink>
                </View>
              ))}
              <Ink size={11} color={PAPER.soft}>A team scores its players’ average.</Ink>
            </>
          ) : null}
          {play.standings.length > 1 ? (
            <>
              <Rule />
              <Label>INVESTIGATORS</Label>
              {play.standings.map((r) => (
                <View key={r.seat} style={sh.row}>
                  <Ink size={12} color={PAPER.soft} style={{ width: u(16) }}>{r.rank}</Ink>
                  <View style={[sh.tag, { backgroundColor: colorOf.get(r.seat) ?? PAPER.ink, marginBottom: 0 }]} />
                  <Ink size={13.5} style={{ flex: 1 }}>{r.name}</Ink>
                  <Ink size={13.5}>{String(r.score)}</Ink>
                </View>
              ))}
            </>
          ) : null}
          <Rule />
          <Label>DIAGNOSES</Label>
          {items.map((i) => {
            const label = def.itemLabel?.(i) ?? i.itemId;
            return (
              <View key={i.id} style={sh.row}>
                <Ink size={13} color={i.outcome === 'right' ? NR.green : NR.red} style={{ width: u(16) }}>{MARK[i.outcome]}</Ink>
                <Ink size={12.5} style={{ flex: 1 }} lines={1}>{multi ? (nameOf.get(i.seat) ?? 'Nobody') : label}</Ink>
                {/* RS1: dossier links only here, once the game has ended. */}
                {i.answerKey ? (
                  <Pressable onPress={() => openDossier(i.answerKey!)} hitSlop={u(6)} accessibilityRole="link" accessibilityLabel={`Open the dossier for ${label}`}>
                    <Ink size={12} color={NR.red} style={{ textDecorationLine: 'underline' }}>Dossier ›</Ink>
                  </Pressable>
                ) : null}
                <Ink size={12.5} style={{ width: u(26), textAlign: 'right' }}>{String(i.points)}</Ink>
              </View>
            );
          })}
          {missed ? <Ink size={11} color={PAPER.soft}>{multi ? 'Your missed cases are waiting in Today’s review.' : 'Missed cases are waiting in Today’s review.'}</Ink> : null}
        </Sheet>
        <View style={{ flexDirection: 'row', gap: u(10) }}>
          <RoomBtn label="Rematch" onPress={rematch} style={{ flex: 1 }} />
          <RoomBtn label="Change settings" ghost onPress={changeSettings} style={{ flex: 1 }} />
        </View>
        <RoomBtn label="Back to games" ghost onPress={backToGames} />
      </View>
    </NoirScreen>
  );
}

export const caseFilesScreens = { Landing, Gate, Setup, Results };

const sh = StyleSheet.create({
  sheet: { backgroundColor: PAPER.bg, borderRadius: u(4), paddingHorizontal: u(16), paddingTop: u(18), paddingBottom: u(14), gap: u(8), shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: u(10), shadowOffset: { width: 0, height: u(5) } },
  pin: { position: 'absolute', top: -u(5), left: '50%', marginLeft: -u(7), width: u(14), height: u(14), borderRadius: u(7), backgroundColor: NR.red, borderWidth: 1, borderColor: '#7d1219', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: u(2), shadowOffset: { width: u(1), height: u(2) } },
  pbtn: { borderRadius: u(6), borderWidth: 1.5, borderColor: NR.red, backgroundColor: NR.red, paddingVertical: u(11), alignItems: 'center' },
  rbtn: { borderRadius: u(12), borderWidth: 1.5, borderColor: NR.red, backgroundColor: NR.redSoft, alignItems: 'center', justifyContent: 'center', paddingVertical: u(12), paddingHorizontal: u(10) },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', columnGap: u(10) },
  boxes: { flexDirection: 'row', columnGap: u(14), rowGap: u(6), flexWrap: 'wrap' },
  box: { width: u(15), height: u(15), borderWidth: 1.5, borderColor: PAPER.ink, alignItems: 'center', justifyContent: 'center' },
  x: { color: NR.red, fontSize: u(13), lineHeight: u(14), fontWeight: '700' },
  field: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: u(6), borderBottomWidth: 1, borderBottomColor: PAPER.rule, paddingBottom: u(3) },
  input: { fontFamily: NR.type, fontSize: u(13), color: PAPER.ink, padding: 0, minWidth: 0, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  tnames: { flexDirection: 'row', flexWrap: 'wrap', columnGap: u(12), rowGap: u(5) },
  tname: { flexBasis: '45%', flexGrow: 1, flexDirection: 'row' },
  seat: { flexDirection: 'row', alignItems: 'flex-end', gap: u(10) },
  tag: { width: u(8), height: u(8), borderRadius: u(1), transform: [{ rotate: '45deg' }], marginBottom: u(4) },
  mark: { width: u(14), height: u(14), borderWidth: 1.5 },
  faces: { flexDirection: 'row', flexWrap: 'wrap', gap: u(2), paddingLeft: u(16) },
  face: { padding: 1, borderRadius: u(12), borderWidth: 1.5 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: u(6), borderWidth: 1.5, borderRadius: u(4), paddingVertical: u(6), paddingHorizontal: u(10) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  paused: { alignSelf: 'flex-start', borderWidth: 3, borderColor: NR.red, paddingHorizontal: u(10), transform: [{ rotate: '-5deg' }], marginBottom: u(4) },
  closed: { transform: [{ rotate: '-8deg' }], borderWidth: 2.5, borderColor: NR.red, paddingHorizontal: u(8), marginTop: u(14), marginRight: u(4), marginLeft: u(14) },
  corner: { position: 'absolute', right: -u(16), top: -u(14), width: u(210), height: u(190) },
});
