import { create } from 'zustand';

/**
 * Which first-come pop-ups are on screen, so the lower-priority ones wait their turn (Yazan 2026-10-21):
 * the welcome tour and help pop-ups first, then the daily reward, then a newly found card.
 */
export const usePopups = create<{ daily: boolean; help: boolean }>(() => ({ daily: false, help: false }));
