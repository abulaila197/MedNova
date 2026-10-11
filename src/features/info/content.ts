// Text of the info pages. The first screen of each page is the locked preview word for word;
// the FAQ was rewritten for the live app; About and Contact still come from the old MedPuzz pages,
// with the app and games renamed.
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

// ---------- FAQ ("Chapters, revised"), rewritten 2026-10-11 for the 10 live games (Yazan approved)
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
      { q: 'What is MedNova?', a: 'MedNova teaches medicine through games. You read clues, name diseases, answer questions and solve picture riddles, and the cases you miss come back later in your Learning Space. It is for education only, not medical advice, and every patient in it is fictional.' },
      { q: 'Which games are there?', a: `${GAMES.length === 10 ? 'Ten' : GAMES.length}: ${listed}.` },
      { q: 'Do I need an account?', a: 'No. As a guest you can try every game once. A free account gives you 3 free plays of each mode every day. After those, keep playing by watching an ad or paying 3 tokens per play, or subscribe for $0.99 to play without limits, with no ads and no tokens.' },
    ],
  },
  {
    n: '02',
    chip: 'Games',
    title: 'Games',
    tag: 'Gameplay',
    items: [
      { q: 'How does The Diagnostic Pursuit score?', a: 'Clues arrive one by one. Name the disease on an earlier clue to score more, plus up to 20 points for speed. A wrong guess shows the next clue.', scoring: true },
      { q: 'How does Case Files work?', a: 'Work a case from history to discharge: pick your differentials, read the investigations, then make your diagnosis. Each case pays once; replaying it is free but earns no EXP.' },
      { q: 'How does Nova Medicordle work?', a: "Guess the medical word in six tries. Green is the right letter in the right place, yellow is in the word but elsewhere, grey is not in the word. Play today's word, which earns double, or keep going in Endless." },
      { q: 'How does The Streak Master work?', a: 'Answer as many questions as you can before the clock runs out. Every right answer in a row is worth one point more than the last, and a wrong answer resets your streak.' },
      { q: 'How do The Riddler and Nova Crossword work?', a: 'The Riddler shows a picture rebus that you read as a condition or sign. Nova Crossword is a medical crossword. Both are played level by level, and stars open the next level.' },
      { q: 'What are The Wheels of Chaos, The Silent Artist, The Conqueror and Trust Me Not?', a: 'The Wheels of Chaos spins three wheels that pick your question. The Silent Artist is drawing or acting a disease while the room guesses. The Conqueror is answering to raise troops and take lands. Trust Me Not is surviving a year of famine as one camp, with a traitor or two among you.' },
    ],
  },
  {
    n: '03',
    chip: 'Together',
    title: 'Playing together',
    tag: 'Multiplayer',
    items: [
      { q: 'How do I play with friends?', a: 'Most games have Pass the phone, where you take turns on one phone, and Online, where everyone plays live on their own phone. The Conqueror and Trust Me Not are online only. Many games also let the host split players into teams.' },
      { q: 'Who wins a tie?', a: 'The faster player.' },
    ],
  },
  {
    n: '04',
    chip: 'EXP',
    title: 'EXP and tokens',
    tag: 'Progress',
    items: [
      { q: 'How do I earn EXP?', a: 'By playing Solo and Online. Each game pays for what you get right; for example, Medicordle gives up to 12 EXP a word and The Streak Master 2 EXP per right answer. Pass the phone and The Silent Artist are for fun and earn no EXP.' },
      { q: 'What are levels and tokens?', a: 'EXP raises your level, and each new level gives you 1 token. Tokens pay for extras such as letter hints in Medicordle and a revive in Nova Crossword.' },
    ],
  },
  {
    n: '05',
    chip: 'Learning',
    title: 'Learning Space',
    tag: 'Review',
    items: [
      { q: 'What goes into Learning Space?', a: "What you miss: unsolved Diagnostic Pursuit cases, a wrong first diagnosis in Case Files, missed questions in The Streak Master and Trust Me Not, missed Crossword words and unsolved Riddler conditions. Medicordle, The Silent Artist and The Wheels of Chaos add nothing. In Pass the phone, only the phone owner's misses go in." },
      { q: 'How do I review them?', a: "Today's review shows each missed disease as a flip card with one dossier field on the back. Disease dossiers hold the full file for every disease." },
    ],
  },
  {
    n: '06',
    chip: 'Help',
    title: 'Help',
    tag: 'Support',
    items: [
      { q: "Something isn't working. What do I do?", a: 'Tap the red ! button at the top of any page and tell us what happened, in which game and on which case or question.' },
      { q: 'Where do the cases come from?', a: 'They are written for MedNova to teach reasoning. If you think a fact is wrong, report it with the red ! button.' },
    ],
  },
];

/** The Diagnostic Pursuit clue points (DP: 100, 80, 60, 40, 20, 10; speed bonus on top). */
export const SCORING = [
  { k: 'CLUE 1', v: '100' },
  { k: '2', v: '80' },
  { k: '3', v: '60' },
  { k: '4', v: '40' },
  { k: '5', v: '20' },
  { k: '6', v: '10' },
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
    k: 'Who we are',
    plain: 'MedNova is run by *its owner,* not a company.',
    legal: [
      { p: 'MedNova is an educational medical reasoning game. It is run by its owner, who decides how your information is used (the "controller"). This policy explains what the app really collects, why, where it is kept and what you can do about it.' },
      { p: 'MedNova is for education only. It is not medical advice, and all cases and patients in it are fictional.' },
    ],
  },
  {
    n: '02',
    k: 'Your account',
    plain: 'An account needs your *email, a password and a username.*',
    legal: [
      { b: 'Sign-up.', p: 'When you create an account we receive your email address, a password and the username you choose (also used as your display name). Sign-in and email codes are handled by Supabase Auth. Your password is stored by Supabase only as a one-way hash; MedNova never sees or stores it in plain text.' },
      { b: 'Profile.', p: 'Your account has a profile with your username, display name, avatar (the character you pick) and a friend code that others can use to add you.' },
      { b: 'Guests.', p: 'You can play as a guest without an account. Guest progress stays on your phone and is not linked to you on our servers.' },
    ],
  },
  {
    n: '03',
    k: 'Your play',
    plain: 'We keep your *games, scores and wallet.*',
    legal: [
      {
        li: [
          'Plays and scores: which games you play, your answers and results, scores, streaks and times.',
          'Learning: the cases you miss and the cards you collect, so you can review them later.',
          'EXP and tokens: your wallet is kept on your phone and, when you are signed in, synced to your account.',
        ],
      },
    ],
  },
  {
    n: '04',
    k: 'Friends and online play',
    plain: 'Playing with others means *some of your data is shared with them.*',
    legal: [
      {
        li: [
          'Friends: friend requests, your friends list and the people you block.',
          'Presence: when you were last seen in the app, shown to your friends.',
          'Invites and challenges you send or receive.',
          'Online rooms and matches: the rooms you create or join, your team and character, guesses and results.',
          'Room chat: the stickers and preset voice lines you send in a room. There is no free-text chat.',
          'Silent Artist: the drawings you make in an online room are sent live to the other players in that room.',
          'Reports: if you report a drawing, we keep the report and the drawing so it can be reviewed.',
        ],
      },
      { p: 'Other players can see your username, avatar, scores in shared games and anything you send in a room. Do not use your real name as a username if you do not want it shown.' },
    ],
  },
  {
    n: '05',
    k: 'On your phone',
    plain: 'Some data *stays on your device.*',
    legal: [{ p: 'MedNova stores your sign-in session, settings, saved plays and wallet on your phone so the app works offline and opens quickly. Deleting the app removes this local data.' }],
  },
  {
    n: '06',
    k: 'Where it is kept',
    plain: 'Our servers are *in the EU,* in Frankfurt.',
    legal: [
      { p: 'Account and game data is stored with Supabase, which acts as our processor and hosts it on servers in Frankfurt, Germany (EU). Supabase handles it only on our instructions. If you use MedNova from outside the EU, your data travels to these servers.' },
      { p: 'MedNova does not use analytics, advertising or tracking tools, and does not sell your data.' },
    ],
  },
  {
    n: '07',
    k: 'Why we use it',
    plain: 'We use your data only to *run the game* for you.',
    legal: [
      {
        li: [
          'To create and secure your account and sign you in.',
          'To save your progress, scores, wallet and learning cards.',
          'To run friends, invites, online rooms and matches.',
          'To keep play safe: blocking, reviewing reports and stopping misuse.',
          'To answer your messages and bug reports.',
        ],
      },
      { b: 'Legal basis.', p: 'Under the EU GDPR and Egypt\'s Personal Data Protection Law (No. 151 of 2020), we use your data because it is needed to provide the service you asked for (our contract with you), and for our legitimate interest in keeping MedNova safe and working.' },
    ],
  },
  {
    n: '08',
    k: 'How long we keep it',
    plain: 'Until you *delete your account.*',
    legal: [{ p: 'We keep your account data for as long as your account exists. When you delete your account, your account and the rows linked to it (profile, plays, wallet, misses, cards, friends and blocks) are removed from our servers. Data on your phone stays until you delete the app.' }],
  },
  {
    n: '09',
    k: 'Deleting your account',
    plain: 'You can delete it *yourself, in the app.*',
    legal: [{ p: 'Open Profile and tap "Delete my account", then confirm. Your account is deleted straight away and the app returns to guest mode. If you cannot open the app, write to us and we will delete it for you.' }],
  },
  {
    n: '10',
    k: 'Your rights',
    plain: 'Your data is yours: you can *see, fix or delete* it.',
    legal: [
      {
        li: [
          'Access: ask for a copy of the data we hold about you.',
          'Correction: ask us to fix data that is wrong.',
          'Deletion: delete your account in the app, or ask us to.',
          'Objection: object to how we use your data, or ask us to limit it.',
        ],
      },
      { p: 'These rights come from the GDPR and Egypt\'s Personal Data Protection Law. To use them, write to us (see Contact). You may also complain to your local data protection authority.' },
    ],
  },
  {
    n: '11',
    k: 'Age',
    plain: 'MedNova is for people *16 or older.*',
    legal: [{ p: 'You must be 16 or older to create an account. We do not knowingly collect data from children under 16. If you think a child has made an account, write to us and we will delete it.' }],
  },
  {
    n: '12',
    k: 'Changes',
    plain: 'If this policy changes, *this page changes.*',
    legal: [{ p: 'We update this policy when MedNova\'s features or data use change. The current version is always on this page.' }],
  },
  {
    n: '13',
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
    legal: [{ p: 'MedNova is an educational medical reasoning game built around clinical case puzzles, diagnostic practice, learning tools, statistics and online play with friends. It is run by its owner.' }],
  },
  {
    n: '02',
    k: 'Educational purpose',
    plain: 'It helps you practise. It does *not replace clinical judgment.*',
    legal: [
      { p: 'MedNova is intended for education, practice, and entertainment. Its cases and game results are not a substitute for professional medical education, clinical supervision, diagnosis, treatment, or independent professional judgment. Users remain responsible for how they apply information outside the game.' },
      { p: 'MedNova is not medical advice. All cases and people in it are fictional.' },
    ],
  },
  {
    n: '03',
    k: 'Age',
    plain: 'You must be *16 or older.*',
    legal: [{ p: 'You must be 16 or older to create a MedNova account. By creating an account you confirm that you are 16 or older and that you agree to these Terms and the Privacy Policy.' }],
  },
  {
    n: '04',
    k: 'Accounts',
    plain: 'Keep your *password to yourself.*',
    legal: [{ p: 'You may create an account with your email address and a password, or continue as a guest. You are responsible for providing accurate information and for keeping your account credentials secure. Do not share your password with other people. You can delete your account at any time from Profile.' }],
  },
  {
    n: '05',
    k: 'Scores and leaderboards',
    plain: 'Scores follow the *rules of each game.*',
    legal: [{ p: 'MedNova records game results according to the rules displayed in the game. Scores, streaks, EXP, tokens and leaderboard rankings are calculated by the relevant game. Results, EXP and tokens have no money value and may be reset, corrected, removed, or changed when necessary to address errors, misuse, or changes to the platform.' }],
  },
  {
    n: '06',
    k: 'Your content',
    plain: 'What you share with others is *your responsibility.*',
    legal: [
      { p: 'Your username, the drawings you make in Silent Artist and the stickers and voice lines you send in online rooms are seen by other players. You are responsible for them. Do not use content that is offensive, hateful, sexual, violent, harassing, misleading, or that includes real patient information or other people\'s personal data.' },
      { p: 'MedNova has zero tolerance for objectionable content or abusive users. You can block any player and report any drawing. We review reports and may remove content, change a username, or suspend or close an account that breaks these rules.' },
    ],
  },
  {
    n: '07',
    k: 'Acceptable use',
    plain: 'Play fair and *keep MedNova safe.*',
    legal: [
      {
        li: [
          'Do not attempt to interfere with the operation or security of MedNova.',
          'Do not manipulate scores, leaderboards, timers, wallets, or account systems through unauthorized methods.',
          'Do not harass, threaten, or impersonate other players.',
          'Do not share objectionable, unlawful, or privacy-invasive content in usernames, drawings, or rooms.',
        ],
      },
    ],
  },
  {
    n: '08',
    k: 'Privacy',
    plain: 'Your data is covered by the *Privacy Policy.*',
    legal: [{ p: 'Your use of MedNova is also governed by the Privacy Policy, which explains what account, gameplay, social and online-play information is handled and what your rights are.' }],
  },
  {
    n: '09',
    k: 'Intellectual property',
    plain: "MedNova's games and art *belong to MedNova.*",
    legal: [{ p: "MedNova's software, branding, interface, cases and platform content are protected by applicable intellectual-property laws. Its graphics are original or used under public-domain or CC0 licences. Except where expressly permitted, you may not copy, redistribute, reverse engineer, or commercially exploit protected MedNova materials." }],
  },
  {
    n: '10',
    k: 'Availability',
    plain: 'Games and rules *may change* as MedNova grows.',
    legal: [{ p: 'Features may be changed, suspended, or discontinued as MedNova develops. We may update game rules, case libraries, scoring presentation, sign-in options, or other platform functionality when necessary.' }],
  },
  {
    n: '11',
    k: 'Suspension',
    plain: 'Serious misuse can *close an account.*',
    legal: [{ p: 'Access may be restricted or an account may be suspended or terminated when necessary to address serious misuse, objectionable content, security risks, unlawful activity, or violations of these Terms. Where appropriate, users may contact MedNova to ask about an account-related decision.' }],
  },
  {
    n: '12',
    k: 'No guarantee',
    plain: 'We work hard, but *mistakes can happen.*',
    legal: [{ p: 'MedNova is provided as an evolving educational platform. While reasonable efforts are made to keep the service reliable and the information useful, no software or educational content can be guaranteed to be completely error-free or continuously available.' }],
  },
  {
    n: '13',
    k: 'Contact',
    plain: 'Questions about these Terms? *Write to us.*',
    legal: [{ p: `For questions about these Terms, contact MedNova at ${CONTACT}.` }],
  },
];

// One-line medical disclaimer shown on sign-in, About and each Learn dossier.
export const DISCLAIMER = 'For education only, not medical advice. All cases are fictional.';
