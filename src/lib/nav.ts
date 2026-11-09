import { router } from 'expo-router';

/** Opens a page from the header, dock or a host sheet. */
export const navTo = (to: string) => router.navigate(to as never);
