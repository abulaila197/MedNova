import type { ImageSource } from 'expo-image';

/**
 * The SuperNova team (Yazan 2026-11-11): the six people who helped build MedNova. Never sold or won; only Admin gives
 * them (Admin page, Unlock character), as style items 'team:<key>'. 3 stars, as printed on the cards.
 */
export type TeamMember = { key: string; name: string; title: string; stars: 3; card: ImageSource; face: ImageSource };

export const TEAM: TeamMember[] = [
  { key: 'mohamed', name: 'Mohamed', title: 'SuperNova team', stars: 3, card: require('../../../assets/team/mohamed-card.webp'), face: require('../../../assets/team/mohamed-face.webp') },
  { key: 'maged', name: 'Maged', title: 'SuperNova team', stars: 3, card: require('../../../assets/team/maged-card.webp'), face: require('../../../assets/team/maged-face.webp') },
  { key: 'dina', name: 'Dina', title: 'SuperNova team', stars: 3, card: require('../../../assets/team/dina-card.webp'), face: require('../../../assets/team/dina-face.webp') },
  { key: 'abdo', name: 'Abdo', title: 'SuperNova team', stars: 3, card: require('../../../assets/team/abdo-card.webp'), face: require('../../../assets/team/abdo-face.webp') },
  { key: 'osama', name: 'Osama', title: 'SuperNova team', stars: 3, card: require('../../../assets/team/osama-card.webp'), face: require('../../../assets/team/osama-face.webp') },
  { key: 'razan', name: 'Razan', title: 'SuperNova team', stars: 3, card: require('../../../assets/team/razan-card.webp'), face: require('../../../assets/team/razan-face.webp') },
];

export const teamOf = (key?: string | null) => TEAM.find((m) => m.key === key);

/** Shown on locked cards (Yazan 2026-11-11). */
export const TEAM_LOCKED_LINE = 'Only given by Admin to the SuperNova team';

/** The back of a given card. */
export const TEAM_THANKS = 'Thank you for helping build MedNova.';
