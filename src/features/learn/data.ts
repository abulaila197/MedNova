// Sample content for My cases (preview 2026-10-11: private note, waiting for approval, approved = playable by its maker).

export type Case = { title: string; area: string; state: string };
export const MY_CASES: Case[] = [
  { title: 'Pulmonary embolism', area: 'Respiratory · F, 34', state: 'Approved' },
  { title: 'Secondary syphilis', area: 'Infectious · M, 27', state: 'Waiting for approval' },
  { title: 'Central retinal artery occlusion', area: 'Ophthalmology · M, 68', state: 'Private note' },
];
