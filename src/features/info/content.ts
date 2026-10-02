// Text of the info pages. The first screen of each page is the locked preview word for word;
// everything below it comes from the old MedPuzz pages (FAQ, Privacy Policy, Terms & Conditions,
// About, Contact) with the app renamed to MedNova and the games renamed to the 8 new names.
import { GAMES } from '@/data/games';

export const HABITS = ['Observation', 'Reasoning', 'Pattern recognition', 'Prioritisation', 'Clinical judgment'];
export const ABOUT_GAMES = GAMES.map((g) => `${g.lead} ${g.em}`);

// ---------- Contact ("I want to ___")
export const INTENTS = [
  { key: 'ask a question', hint: 'Ask about MedNova, its games or the platform…' },
  { key: 'report a bug', hint: 'Tell us where it happened…' },
  { key: 'suggest an idea', hint: 'Share an idea, observation or improvement…' },
  { key: 'collaborate', hint: 'Teaching, cases, development or partnership…' },
];

// ---------- FAQ ("Chapters, revised")
export type Faq = { q: string; a: string; scoring?: boolean };
export type Chapter = { n: string; chip: string; title: string; tag: string; items: Faq[] };

const GAME_LIST = GAMES.map((g) => `${g.lead} ${g.em}`);
const listed = `${GAME_LIST.slice(0, -1).join(', ')} and ${GAME_LIST[GAME_LIST.length - 1]}`;

export const CHAPTERS: Chapter[] = [
  {
    n: '01',
    chip: 'Getting started',
    title: 'Getting started',
    tag: 'Foundation',
    items: [
      { q: 'What is MedNova?', a: 'MedNova is an educational medical reasoning game built around clinical cases. It lets you practice interpreting clues, making diagnoses, reviewing missed cases, and tracking game performance.' },
      { q: 'What game modes are available?', a: `MedNova includes ${listed}. Each mode uses a different reasoning or gameplay structure.` },
      { q: 'Can I use MedNova as a guest?', a: 'Yes. Continue as Guest is available alongside account creation and Google sign-in. Guest access is intended for using the game without creating a registered account, while account-based access can support persistent user information and progress.' },
    ],
  },
  {
    n: '02',
    chip: 'Games',
    title: 'Games',
    tag: 'Gameplay',
    items: [
      { q: 'How does Case Files: Unsolved scoring work?', a: 'The earlier you diagnose, the more you score.', scoring: true },
      { q: 'What happens when I answer incorrectly?', a: 'In Case Files: Unsolved, an incorrect diagnosis on an intermediate clue automatically reveals the next clue. In Solo and Local, you can still choose when to reveal a clue, while Next Case is used to continue after the case result. Online uses automatic 10-second clue windows and automatic case progression. In the timed modes, wrong answers apply the penalties specific to that mode.' },
      { q: 'How does The Diagnostic Pursuit work?', a: 'The Diagnostic Pursuit starts with a 3-minute timer. Correct answers add time based on the number of clues left. Revealing a clue or using a hint costs time, wrong answers apply the mode rules, and Skip / Give Up reveals all remaining clues and counts the case as a miss. The difficulty adapts upward with correct diagnoses and can step backward after two wrong answers at the same level. The run ends at 0 seconds or after 20 correct diagnoses.' },
      { q: 'How does The Streak Master work?', a: 'The Streak Master starts with a 3-minute timer. Correct answers add streak points based on the clue number: clue 1 = +5, clue 2 = +4, clue 3 = +3, clue 4 = +2, clue 5 = +1. A wrong answer costs 5 seconds; on clues 1–4 the streak is preserved and the next clue is not revealed automatically; a final-clue wrong answer resets the streak. Skip / Give Up reveals all clues, resets the streak, and moves to the next case. The game ends at 0 seconds or after 20 correct diagnoses.' },
    ],
  },
  {
    n: '03',
    chip: 'Accounts',
    title: 'Accounts',
    tag: 'Identity',
    items: [
      { q: 'What account options are available?', a: 'You can use guest access, create an account through the available registration flow, or choose Google sign-in. Account-backed access can support persistent information and progress.' },
      { q: 'What does Google sign-in do?', a: 'Google sign-in provides an alternative authentication route. MedNova does not need or request your Google password.' },
    ],
  },
  {
    n: '04',
    chip: 'Learning',
    title: 'Learning Space',
    tag: 'Review',
    items: [
      { q: 'When does a case enter Learning Space?', a: 'A case is added to Learning Space when you miss the final clue or use Skip / Give Up. Earlier wrong guesses do not add the case by themselves, and solving a case correctly after earlier wrong guesses does not add it. Timeout does not add a case.' },
      { q: 'Can I review cases I missed?', a: 'Yes. Learning Space is designed to help you revisit missed cases and reinforce the diagnostic reasoning behind them.' },
    ],
  },
  {
    n: '05',
    chip: 'Multiplayer',
    title: 'Multiplayer',
    tag: 'Competition',
    items: [
      { q: 'How does multiplayer work?', a: 'In Case Files: Unsolved multiplayer, Player 1 completes the selected cases first, then Player 2 completes the same cases in the same order. Each case receives a clue-count score, and the lower total score wins.' },
      { q: 'How are leaderboard results calculated?', a: 'Leaderboard rankings are separated by game mode and can be filtered by difficulty. Case Files: Unsolved uses the lower total clue score as the better result. The Diagnostic Pursuit prioritizes cases solved and then remaining time. The Streak Master prioritizes the highest streak and then remaining time.' },
    ],
  },
  {
    n: '06',
    chip: 'Technical',
    title: 'Technical',
    tag: 'Troubleshooting',
    items: [
      { q: 'What statistics can MedNova track?', a: "Game statistics can include cases played or solved, scores, accuracy, streaks, remaining time, selected game mode and difficulty, and leaderboard-related results. Account-backed versions may associate these results with the player's account so progress can persist." },
      { q: 'What should I do if a game or case is not working correctly?', a: 'Use the Report flow and include the game or case affected, what you expected to happen, what happened instead, and any useful reproduction details. This gives the team enough context to investigate the problem.' },
    ],
  },
];

export const SCORING = [
  { k: 'CLUE 1', v: '100' },
  { k: '2', v: '80' },
  { k: '3', v: '60' },
  { k: '4', v: '40' },
  { k: '5', v: '20' },
  { k: 'NONE', v: '−30', neg: true },
];

// ---------- Privacy & Terms ("Plain words")
// A legal block is a paragraph (optionally led by a bold phrase) or a bullet list.
export type Legal = { b?: string; p: string } | { li: string[] };
export type Section = { n: string; k: string; plain: string; legal: Legal[] };

export const CONTACT_EMAIL = 'amoriameen.71@gmail.com';
const CONTACT = `${CONTACT_EMAIL} or +20 101 078 3851`;

export const PRIVACY: Section[] = [
  {
    n: '01',
    k: 'Scope',
    plain: 'It covers your account and *your play.*',
    legal: [{ p: 'This Privacy Policy describes the information MedNova may handle when you create an account, sign in with Google, continue as a guest, play clinical cases, use Learning Space, create custom cases, or participate in statistics and leaderboards.' }],
  },
  {
    n: '02',
    k: 'Information we collect',
    plain: 'We keep your *account details* and your game results.',
    legal: [
      { b: 'Account information.', p: 'Display name or account name, email address associated with an account, and authentication and account identifiers needed to operate the account.' },
      { b: 'Google sign-in information.', p: 'If you choose Google sign-in, MedNova may receive the account information made available through the authentication process, such as your Google account identifier, name, and email address. MedNova does not need or request your Google password.' },
      { b: 'Gameplay and statistics.', p: 'MedNova may record gameplay information such as cases attempted or completed, answers and outcomes, clue usage, scores, streaks, remaining time, game mode, difficulty, Learning Space results, and leaderboard results.' },
      { b: 'User-created content.', p: 'If you create custom cases, the information and case content you submit may be associated with your account so the feature can operate and your contributions can be managed.' },
    ],
  },
  {
    n: '03',
    k: 'Passwords and security',
    plain: 'Your password is *never stored* in plain text.',
    legal: [
      { p: "For email/password accounts, passwords should be transmitted over a secure connection and stored on the server only in a properly protected, one-way hashed form. MedNova should never store or display a user's plain-text password. Authentication systems may also use security controls designed to protect accounts against unauthorized access." },
      { b: 'Google authentication:', p: 'MedNova does not receive your Google password. Google handles the authentication step and returns the information necessary for MedNova to establish the account session.' },
    ],
  },
  {
    n: '04',
    k: 'How it is used',
    plain: 'Your information is used to *run MedNova* for you.',
    legal: [
      {
        li: [
          'To create, authenticate, and maintain user accounts.',
          'To provide game modes, save relevant progress, and operate Learning Space.',
          'To calculate and display statistics, scores, streaks, and leaderboard results.',
          'To manage custom cases and user contributions.',
          'To respond to support requests and reported issues.',
          'To protect the service, prevent misuse, and maintain reliable operation.',
        ],
      },
    ],
  },
  {
    n: '05',
    k: 'Leaderboards',
    plain: 'Others can see your *display name* and scores.',
    legal: [{ p: "Leaderboard features may display a player's chosen display name together with game performance information such as score, streak, cases solved, accuracy, or remaining time, depending on the game mode. Do not use a real name as your public display name if you do not want it shown in leaderboard results." }],
  },
  {
    n: '06',
    k: 'Guest use',
    plain: 'You can play *without an account.*',
    legal: [{ p: 'Guest mode allows you to use the game without creating a registered account. Some account-linked features, persistence, or leaderboard functionality may be limited or handled differently for guests.' }],
  },
  {
    n: '07',
    k: 'Sharing',
    plain: 'Technical providers see your data *only as needed.*',
    legal: [{ p: 'MedNova may use authentication, hosting, database, security, or other technical service providers necessary to operate the service. Information may be transmitted to those providers only as needed for the relevant service. Google authentication is optional and is used only when you choose that sign-in method.' }],
  },
  {
    n: '08',
    k: 'Retention and deletion',
    plain: 'We keep your data only *as long as it is needed.*',
    legal: [{ p: 'Account and gameplay information should be retained only for as long as reasonably necessary to provide the requested account, statistics, leaderboard, security, and service functions, or as otherwise required for legitimate operational or legal purposes. Where account deletion is supported, you may request deletion of account-associated personal information.' }],
  },
  {
    n: '09',
    k: 'Your choices',
    plain: 'You choose *how you sign in,* and can ask us to delete your data.',
    legal: [
      {
        li: [
          'You may choose guest access instead of creating an account.',
          'You may choose whether to use Google sign-in.',
          'You may request correction or deletion of account information, subject to applicable requirements and technical limitations.',
          'You can contact MedNova with privacy questions or requests.',
        ],
      },
    ],
  },
  {
    n: '10',
    k: 'Changes',
    plain: 'If this policy changes, *this page changes.*',
    legal: [{ p: "This Privacy Policy may be updated when MedNova's features, authentication system, data practices, or legal requirements change. The updated version will be posted on this page." }],
  },
  {
    n: '11',
    k: 'Contact',
    plain: 'Privacy questions? *Write to us.*',
    legal: [{ p: `For privacy questions or requests, contact MedNova at ${CONTACT}.` }],
  },
];

export const TERMS: Section[] = [
  {
    n: '01',
    k: 'About MedNova',
    plain: 'MedNova is a game for *clinical reasoning.*',
    legal: [{ p: 'MedNova is an educational medical reasoning platform built around clinical case puzzles, diagnostic practice, learning tools, statistics, and competitive game modes.' }],
  },
  {
    n: '02',
    k: 'Educational purpose',
    plain: 'It helps you practise. It does *not replace clinical judgment.*',
    legal: [{ p: 'MedNova is intended for education, practice, and entertainment. Its cases and game results are not a substitute for professional medical education, clinical supervision, diagnosis, treatment, or independent professional judgment. Users remain responsible for how they apply information outside the game.' }],
  },
  {
    n: '03',
    k: 'Accounts',
    plain: 'Keep your *password to yourself.*',
    legal: [
      { p: 'You may create an account using the available account-registration flow, sign in with Google, or continue as a guest. You are responsible for providing accurate information and for keeping your account credentials secure. Do not share your password with other people.' },
      { p: "When using Google sign-in, authentication is handled through Google's authentication service. You must also follow the applicable terms and policies of that service." },
    ],
  },
  {
    n: '04',
    k: 'Scores and leaderboards',
    plain: 'Scores follow the *rules of each game.*',
    legal: [{ p: 'MedNova records game results according to the rules displayed in the game. Scores, streaks, cases solved, accuracy, remaining time, and leaderboard rankings are calculated by the relevant game mode. Leaderboard results may be reset, corrected, removed, or changed when necessary to address errors, misuse, or changes to the platform.' }],
  },
  {
    n: '05',
    k: 'Custom cases',
    plain: 'Never submit *real patient information.*',
    legal: [
      { p: 'If you submit a custom medical case, you are responsible for the content you provide and for having the right to submit it. Do not submit confidential patient information, personally identifiable patient information, copyrighted material you do not have permission to use, or content that is unlawful or unsafe.' },
      { p: 'MedNova may review, modify, reject, remove, or stop displaying submitted cases when reasonably necessary to operate the platform, maintain quality, protect users, or address reports.' },
    ],
  },
  {
    n: '06',
    k: 'Acceptable use',
    plain: 'Play fair and *keep MedNova safe.*',
    legal: [
      {
        li: [
          'Do not attempt to interfere with the operation or security of MedNova.',
          'Do not manipulate scores, leaderboards, timers, or account systems through unauthorized methods.',
          'Do not use the platform to upload malicious, unlawful, abusive, or privacy-invasive content.',
          'Do not submit real patient information or other sensitive personal information in custom cases.',
        ],
      },
    ],
  },
  {
    n: '07',
    k: 'Privacy',
    plain: 'Your data is covered by the *Privacy Policy.*',
    legal: [{ p: 'Your use of MedNova is also governed by the Privacy Policy, which explains how account, authentication, gameplay, statistics, and leaderboard information may be handled.' }],
  },
  {
    n: '08',
    k: 'Intellectual property',
    plain: "MedNova's games and art *belong to MedNova.*",
    legal: [{ p: "MedNova's software, branding, interface, original graphics, and platform content are protected by applicable intellectual-property laws. Except where expressly permitted, you may not copy, redistribute, reverse engineer, or commercially exploit protected MedNova materials." }],
  },
  {
    n: '09',
    k: 'Availability',
    plain: 'Games and rules *may change* as MedNova grows.',
    legal: [{ p: 'Features may be changed, suspended, or discontinued as MedNova develops. We may update game rules, case libraries, scoring presentation, authentication features, or other platform functionality when necessary.' }],
  },
  {
    n: '10',
    k: 'Suspension',
    plain: 'Serious misuse can *close an account.*',
    legal: [{ p: 'Access may be restricted or an account may be suspended or terminated when necessary to address serious misuse, security risks, unlawful activity, or violations of these Terms. Where appropriate, users may contact MedNova to ask about an account-related decision.' }],
  },
  {
    n: '11',
    k: 'No guarantee',
    plain: 'We work hard, but *mistakes can happen.*',
    legal: [{ p: 'MedNova is provided as an evolving educational platform. While reasonable efforts are made to keep the service reliable and the information useful, no software or educational content can be guaranteed to be completely error-free or continuously available.' }],
  },
  {
    n: '12',
    k: 'Contact',
    plain: 'Questions about these Terms? *Write to us.*',
    legal: [{ p: `For questions about these Terms, contact MedNova at ${CONTACT}.` }],
  },
];
