import { createContext, useContext } from 'react';

import { F } from '@/theme/tokens';

import { G } from './grey';

/**
 * The colours and faces of the room's pop-up parts (lobby sheets, Talk). Grey for every game (ON15) unless a game with
 * its own look sets its own around them (Yazan 2026-10-18: own-look games keep their look until you leave).
 */
export type RoomLook = typeof G & { body: string; semi: string; mono: string; head: string };

export const GREY_LOOK: RoomLook = { ...G, body: F.body, semi: F.bodySemi, mono: F.mono, head: F.display };

const Ctx = createContext<RoomLook>(GREY_LOOK);
export const RoomLookProvider = Ctx.Provider;
export const useRoomLook = () => useContext(Ctx);
