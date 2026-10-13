// Achievement progress, counted from the plays on the phone. Pure: no React Native, so it runs in node tests.
// Seat 0 is always the phone owner (offline: Player 1; online: finishOnline puts you first).
import type { GameKey, Play, PlayItem } from '../../games/engine/types';
import { teamsOf, teamStandings } from '../../games/shell/teams';

export type AchKey =
  | 'first_rounds'
  | 'full_rotation'
  | 'night_shift'
  | 'clean_diagnosis'
  | 'hot_streak'
  | 'two_guess'
  | 'riddle_me_this'
  | 'cold_case'
  | 'full_marks'
  | 'conqueror'
  | 'most_trusted'
  | 'team_player'
  | 'house_call'
  | 'recruiter'
  | 'challenger'
  | 'case_writer'
  | 'ad_watcher'
  | 'pass_stethoscope'
  | 'back_to_basics'
  | 'dossier_reader'
  | 'week_on_call'
  | 'residency'
  | 'career'
  | 'grand_rounds'
  | 'frame_collector'
  | 'title_collector'
  | 'app_tour';

// Goals per tier: Bronze, Silver, Gold and Platinum (about 2.5x Gold, Yazan 2026-10-13). Full Marks and Dossier Reader
// already ask for the whole set at Gold, so they have no Platinum. "Get to know the app" is one step-set (one tier).
export const ACHIEVEMENTS: readonly { key: AchKey; name: string; what: string; goals: number[] }[] = [
  { key: 'first_rounds', name: 'First Rounds', what: 'Finish games', goals: [1, 50, 250, 600] },
  { key: 'full_rotation', name: 'Full Rotation', what: 'Play every game', goals: [1, 5, 20, 50] },
  { key: 'night_shift', name: 'Night Shift', what: 'Finish games after midnight', goals: [1, 10, 50, 125] },
  { key: 'clean_diagnosis', name: 'Clean Diagnosis', what: 'Solve cases on the first clue', goals: [1, 10, 50, 125] },
  { key: 'hot_streak', name: 'Hot Streak', what: 'Reach a streak', goals: [10, 20, 35, 60] },
  { key: 'two_guess', name: 'Two-Guess Wonder', what: 'Solve words in 2 guesses', goals: [1, 5, 20, 50] },
  { key: 'riddle_me_this', name: 'Riddle Me This', what: 'Solve Riddler photos', goals: [25, 150, 500, 1200] },
  { key: 'cold_case', name: 'Cold Case', what: 'Solve Case Files cases', goals: [10, 50, 150, 375] },
  { key: 'full_marks', name: 'Full Marks', what: 'Get 3 stars on crosswords', goals: [10, 20, 31] },
  { key: 'conqueror', name: 'Conqueror', what: 'Win The Conqueror', goals: [1, 10, 50, 125] },
  { key: 'most_trusted', name: 'Most Trusted', what: 'Win Trust Me Not', goals: [1, 10, 50, 125] },
  { key: 'team_player', name: 'Team Player', what: 'Win team matches', goals: [1, 10, 50, 125] },
  { key: 'house_call', name: 'House Call', what: 'Play online with friends', goals: [1, 20, 100, 250] },
  { key: 'recruiter', name: 'Recruiter', what: 'Invite friends who join', goals: [3, 10, 30, 75] },
  { key: 'challenger', name: 'Challenger', what: 'Challenge friends', goals: [10, 20, 30, 75] },
  { key: 'case_writer', name: 'Case Writer', what: 'Write your own cases', goals: [5, 10, 20, 50] },
  { key: 'ad_watcher', name: 'Commercial Break', what: 'Watch ads', goals: [20, 50, 100, 250] },
  { key: 'pass_stethoscope', name: 'Pass the Stethoscope', what: 'Finish pass-the-phone games', goals: [10, 50, 200, 500] },
  { key: 'back_to_basics', name: 'Back to Basics', what: 'Clear review cards', goals: [20, 200, 1000, 2500] },
  { key: 'dossier_reader', name: 'Dossier Reader', what: 'Open dossiers', goals: [50, 200, 511] },
  { key: 'week_on_call', name: 'Week on Call', what: 'Collect daily prizes', goals: [7, 30, 100, 250] },
  { key: 'residency', name: 'Residency', what: 'Collect daily prizes', goals: [180, 365, 730, 1095] },
  { key: 'career', name: 'Career', what: 'Reach levels', goals: [10, 25, 50, 100] },
  { key: 'grand_rounds', name: 'Grand Rounds', what: 'Finish Grand Rounds weeks', goals: [1, 5, 13, 26] },
  { key: 'frame_collector', name: 'Frame Collector', what: 'Own frames from the Style shop', goals: [1, 4, 8, 11] },
  { key: 'title_collector', name: 'Name Tags', what: 'Own titles from the Style shop', goals: [1, 5, 10, 14] },
  { key: 'app_tour', name: 'Get to Know MedNova', what: 'Visit every page outside the games', goals: [1] },
];

/** The pages "Get to Know MedNova" asks for (the server checks the same list). */
export const TOUR_STEPS: readonly { key: string; name: string; path: string }[] = [
  { key: 'learn', name: 'Learn', path: '/learn' },
  { key: 'shelf', name: 'Dossier shelf', path: '/learn/shelf' },
  { key: 'newcase', name: 'Write a case', path: '/learn/new-case' },
  { key: 'community', name: 'Community', path: '/community' },
  { key: 'wallpapers', name: 'Wallpapers', path: '/community/wallpapers' },
  { key: 'profile', name: 'Profile', path: '/profile' },
  { key: 'friends', name: 'Friends', path: '/friends' },
  { key: 'leaderboard', name: 'Leaderboard', path: '/leaderboard' },
  { key: 'achievements', name: 'Achievements', path: '/achievements' },
  { key: 'rounds', name: 'Grand Rounds', path: '/rounds' },
  { key: 'cards', name: 'Card hunt', path: '/cards' },
  { key: 'store', name: 'Store', path: '/store' },
  { key: 'style', name: 'Style shop', path: '/style' },
  { key: 'faq', name: 'FAQ', path: '/faq' },
  { key: 'about', name: 'About', path: '/about' },
  { key: 'contact', name: 'Contact', path: '/contact' },
  { key: 'privacy', name: 'Privacy', path: '/privacy' },
  { key: 'licences', name: 'Licences', path: '/licences' },
];

/** The tour step a page path counts for, if any. */
export const tourStepOf = (path: string) => TOUR_STEPS.find((x) => x.path === path)?.key;

/** Tokens paid for bronze, silver and gold. */
export const TIER_TOKENS = [1, 3, 5] as const;

/**
 * Case Writer pays 3/4/5 (AC9) and Commercial Break 5/10/20; every other achievement pays TIER_TOKENS. Platinum pays
 * the three added up (Yazan 2026-10-13). "Get to Know MedNova" pays 5 once.
 */
export const tierTokens = (key: AchKey): readonly number[] => {
  if (key === 'app_tour') return [5];
  const b = key === 'case_writer' ? [3, 4, 5] : key === 'ad_watcher' ? [5, 10, 20] : [...TIER_TOKENS];
  return [...b, b[0] + b[1] + b[2]];
};

/** Counts only the server knows (invites redeemed, challenges sent, cases written, ads watched). */
export type SocialCounts = Partial<Record<'recruiter' | 'challenger' | 'case_writer' | 'ad_watcher' | 'grand_rounds' | 'frame_collector' | 'title_collector', number>>;

export type AchInputs = {
  plays: Play[];
  items: PlayItem[];
  /** The signed-in user id: only their plays (and guest plays) count. */
  me?: string;
  friendIds?: string[];
  prizeDays: number;
  level: number;
  reviewCards: number;
  dossiersOpened: number;
  /** Levels with 3 stars in the saved crossword bests ('crossword:best'), which outlive discarded plays. */
  crosswordThreeStars?: number;
  social?: SocialCounts;
  /** Pages visited for "Get to Know MedNova". */
  tour?: string[];
};

const GAMES: GameKey[] = [
  'case-files-unsolved', 'the-conqueror', 'nova-crossword', 'the-diagnostic-pursuit', 'nova-medicordle',
  'the-riddler', 'the-silent-artist', 'the-streak-master', 'trust-me-not', 'the-wheels-of-chaos',
];

const OWNER = 0;

/** The phone owner placed first (ties share 1st). */
const won = (p: Play) => p.standings.length > 1 && p.standings.some((s) => s.seat === OWNER && s.rank === 1);

/** The owner's team placed first, scored the way the results page scores it (Medicordle offline adds up). */
function teamWon(p: Play) {
  const teams = teamsOf(p);
  const mine = p.seats.find((s) => s.seat === OWNER)?.team;
  if (!teams || mine == null || p.standings.length < 2) return false;
  const how = p.game === 'nova-medicordle' && p.mode === 'offline' ? 'sum' : 'average';
  return teamStandings(p.standings, p.seats, teams, how).some((t) => t.id === mine && t.rank === 1);
}

/** Medicordle rows used on a solved word: solo/online store the count; offline counts every player's row on the shared board. */
function rowsUsed(i: PlayItem, p: Play) {
  if (p.mode !== 'offline') return Number(i.gameData.guesses) || 0;
  const turns = (i.gameData.turns as { seat: number; word: string | null }[] | undefined) ?? [];
  return turns.filter((t) => t.word).length;
}

export function achievementProgress(i: AchInputs): Record<AchKey, number> {
  // Only finished plays: an unfinished bookmark is dropped (with its items) when a new game starts.
  // Playing your own custom case is practice and never counts.
  const plays = i.plays.filter((p) => p.status === 'finished' && !p.settings?.custom && (!i.me || p.userId == null || p.userId === i.me));
  const byId = new Map(plays.map((p) => [p.id, p]));
  const mine = i.items.filter((x) => x.seat === OWNER && byId.has(x.playId)).map((x) => ({ x, p: byId.get(x.playId)! }));
  const of = (g: GameKey) => mine.filter((m) => m.p.game === g);
  const solved = (g: GameKey) => of(g).filter((m) => m.x.outcome === 'right');

  const friends = new Set(i.friendIds ?? []);
  const perGame = GAMES.map((g) => plays.filter((p) => p.game === g).length);
  const night = plays.filter((p) => p.endedAt != null && new Date(p.endedAt).getHours() < 5).length;
  const threeStars = new Set(
    of('nova-crossword')
      .filter((m) => m.p.mode === 'solo' && Number(m.x.gameData.stars) === 3)
      .map((m) => Number(m.x.gameData.level)),
  ).size;

  return {
    first_rounds: plays.length,
    full_rotation: Math.min(...perGame),
    night_shift: night,
    clean_diagnosis: solved('the-diagnostic-pursuit').filter((m) => Number(m.x.gameData.cluesShown) === 1).length,
    hot_streak: Math.max(0, ...of('the-streak-master').map((m) => Number(m.x.gameData.streak) || 0)),
    two_guess: solved('nova-medicordle').filter((m) => {
      const n = rowsUsed(m.x, m.p);
      return n > 0 && n <= 2;
    }).length,
    riddle_me_this: solved('the-riddler').length,
    cold_case: solved('case-files-unsolved').length,
    // Online stars are by place, not by words left, so only Solo puzzles count.
    full_marks: Math.max(threeStars, i.crosswordThreeStars ?? 0),
    conqueror: plays.filter((p) => p.game === 'the-conqueror' && won(p)).length,
    most_trusted: plays.filter((p) => p.game === 'trust-me-not' && won(p)).length,
    team_player: plays.filter(teamWon).length,
    house_call: plays.filter((p) => p.mode === 'online' && p.seats.some((s) => s.seat !== OWNER && s.userId && friends.has(s.userId))).length,
    recruiter: i.social?.recruiter ?? 0,
    challenger: i.social?.challenger ?? 0,
    case_writer: i.social?.case_writer ?? 0,
    ad_watcher: i.social?.ad_watcher ?? 0,
    pass_stethoscope: plays.filter((p) => p.mode === 'offline').length,
    back_to_basics: i.reviewCards,
    dossier_reader: i.dossiersOpened,
    week_on_call: i.prizeDays,
    residency: i.prizeDays,
    career: i.level,
    grand_rounds: i.social?.grand_rounds ?? 0,
    frame_collector: i.social?.frame_collector ?? 0,
    title_collector: i.social?.title_collector ?? 0,
    app_tour: TOUR_STEPS.every((x) => i.tour?.includes(x.key)) ? 1 : 0,
  };
}

/** Tiers reached: 0 none, 1 bronze, 2 silver, 3 gold, 4 platinum. */
export function tiersReached(key: AchKey, count: number): number {
  const a = ACHIEVEMENTS.find((x) => x.key === key);
  return a ? a.goals.filter((g) => count >= g).length : 0;
}
