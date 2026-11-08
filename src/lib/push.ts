// Push notifications (Group 2, Yazan 2026-11-07: social + gentle reminders, at most 1 reminder a day). The web preview
// has none: this file is the stand-in there; phones load push.native.ts. Keep the exports the same.

/** True where notifications exist (phones). */
export const PUSH_ON = false;
/** After a finished game: asks once for notification permission (never on the first screen). */
export function askPushAfterFirstGame(): void {}
/** On sign-in: links this phone's push address to the account if notifications are allowed. */
export async function linkPush(_uid: string | null): Promise<void> {}
/** Opens the page a tapped notification points to (social: Friends / Inbox / room; reminders: Games, Rounds). */
export function followPushTaps(): () => void {
  return () => {};
}
/** Whether the phone itself lets MedNova notify ('ask' = never asked yet). */
export async function pushAllowed(): Promise<'yes' | 'no' | 'ask'> {
  return 'no';
}
/** Asks the phone for permission now (from Settings), then links the phone. */
export async function askPushNow(_uid: string | null): Promise<boolean> {
  return false;
}
/** On sign-out: this phone stops getting the old account's notifications. */
export async function unlinkPush(): Promise<void> {}
