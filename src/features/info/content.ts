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

// ---------- FAQ ("Chapters, revised"): rewritten 2026-10-11 for the 10 live games, refreshed 2026-11-01 for the 13 games, 10 since 2026-11-04,
// Sparks, missions, chests, watching and the online busy line (Yazan picked a full refresh, Group 11).
export type Faq = { q: string; a: string; scoring?: boolean };
export type Chapter = { n: string; chip: string; title: string; tag: string; items: Faq[] };

const GAME_LIST = GAMES.map((g) => `${g.lead} ${g.em}`);
const listed = `${GAME_LIST.slice(0, -1).join(', ')} and ${GAME_LIST[GAME_LIST.length - 1]}`;
const COUNT_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen'];
const gameCount = COUNT_WORDS[GAMES.length] ?? String(GAMES.length);

export const CHAPTERS: Chapter[] = [
  {
    n: '01',
    chip: 'Getting started',
    title: 'Getting started',
    tag: 'Foundation',
    items: [
      { q: 'What is MedNova?', a: 'MedNova teaches medicine through games. You read clues, name diseases, answer questions, draw, give clues and solve picture riddles, and what you miss comes back later in your Learning Space. It is for education only, not medical advice, and every patient in it is fictional.' },
      { q: 'Which games are there?', a: `${gameCount}: ${listed}.` },
      { q: 'Do I need an account?', a: 'No. As a guest you get 5 free plays across all games. A free account plays with Sparks, keeps your progress on our servers and lets you add friends and play online.' },
      { q: 'What are Sparks?', a: 'Sparks are what a game costs to play. Your bar holds 100 and refills one Spark every 10 minutes, faster when you wear a character with more stars. Each game costs Sparks by how long it lasts, and you pay at your first answer. The Medicordle Daily word is always free. To refill sooner, use Watch an ad for 10 Sparks (20 a day) or swap tokens 1 for 1. With MedNova Unlimited your Sparks never run out.' },
    ],
  },
  {
    n: '02',
    chip: 'Games',
    title: 'Games',
    tag: 'Gameplay',
    items: [
      { q: 'How does The Diagnostic Pursuit score?', a: 'Clues arrive one by one. Name the disease on an earlier clue to score more, plus up to 20 points for speed. A wrong guess shows the next clue.', scoring: true },
      { q: 'How does Case Files work?', a: 'Work a case from history to discharge: write your differentials, read the examination and investigations, then make your diagnosis. Each case pays once; replaying it is free but earns no EXP.' },
      { q: 'How does Nova Medicordle work?', a: "Guess the medical word in six tries. Green is the right letter in the right place, yellow is in the word but elsewhere, grey is not in the word. The Daily word has 6 letters and earns double; Endless also has Classic 5 with 5-letter words." },
      { q: 'How do The Streak Master and The Quiz Parade work?', a: 'The Streak Master is a race against the clock: every right answer in a row is worth one point more than the last, and a wrong answer resets your streak. The Quiz Parade marches through seven kinds of question, each on its own clock, and harder kinds score more.' },
      { q: 'How do The Riddler and Nova Crossword work?', a: 'The Riddler shows a picture riddle that you read as a condition or sign. Nova Crossword is a medical crossword: tap a square to light up its word, double tap to open it, and you have 3 hearts per puzzle (5 online). Both are played level by level, and stars open the next level.' },
      { q: 'How does The Wheels of Chaos work?', a: 'One wheel with three rings picks how many questions you get, their style and their field. Reach the target first, 25 or 50 points. With friends, each act ends in a Boss Round, and in the final round whoever is last can swap a turn for a Redemption round, once a game.' },
      { q: 'What are The Silent Artist and The Imposter?', a: 'In The Silent Artist you pick one of 3 secret words and draw it (or act it out on one phone) while everyone guesses. In The Imposter everyone gets the same word except one player, and you give clues and vote to catch them.' },
    ],
  },
  {
    n: '03',
    chip: 'Together',
    title: 'Playing together',
    tag: 'Multiplayer',
    items: [
      { q: 'How do I play with friends?', a: 'Most games have Pass the phone, where you take turns on one phone, and Online, where everyone plays live on their own phone. Host a room and share its code, join an open room, or challenge a friend from their profile. Many games also let the host split players into teams.' },
      { q: 'Can I watch a friend play?', a: 'Yes. Tap Watch on a friend who is in a match. They get a Yes or No first, and can let you always watch. Up to 3 people can watch a match; if it is full, try again at the rematch.' },
      { q: 'Why does it say the servers are busy?', a: 'When a lot of people are playing online at once, a new match waits its turn. Your room stays open with a banner showing your place in line, and the match starts by itself. Matches already running are never stopped.' },
      { q: 'Why is Online resting?', a: 'Online play shares a weekly allowance. If a week\'s share runs out, new online matches rest until the day shown, and matches already running finish. Solo and Pass the phone always work.' },
      { q: 'Who wins a tie?', a: 'The faster player. On a leaderboard, whoever got there first.' },
    ],
  },
  {
    n: '04',
    chip: 'Rewards',
    title: 'EXP, tokens and rewards',
    tag: 'Progress',
    items: [
      { q: 'How do I earn EXP?', a: 'By playing Solo and Online. Each game pays for what you get right; for example, Medicordle gives up to 12 EXP a word and The Streak Master 2 EXP per right answer. Pass the phone and Silent Artist practice are for fun and earn no EXP.' },
      { q: 'What are levels and tokens?', a: 'EXP raises your level, and each new level pays tokens. Tokens buy extras such as hints, revives and helpers, and looks in the Style shop: characters, frames, titles, win effects and sticker packs.' },
      { q: 'What are daily missions and the daily gift?', a: 'Every day: Warm-up, Full Shift and Overtime, done in order, paying 10, 30 and 50 tokens. Only games that use Sparks count, and each game counts once per mission. The daily gift calendar pays tokens and Sparks each day you claim it.' },
      { q: 'What are Grand Rounds and chests?', a: 'Grand Rounds gives you 3 missions each week, and each one pays a chest: wooden, golden, then diamond. Finish all three 4 weeks in a row for an epic chest. Chests hold tokens, chat stickers, rare win effects and Nova Mechs cards; a card you already have turns into tokens.' },
      { q: 'How do cards and leaderboards work?', a: 'Collect the Original pack through the card hunt, the Nova Mechs from chests, and the Style shop robots with tokens; finishing a pack pays a prize. Each month the top players on the leaderboards win tokens.' },
    ],
  },
  {
    n: '05',
    chip: 'Learning',
    title: 'Learning Space',
    tag: 'Review',
    items: [
      { q: 'What goes into Learning Space?', a: "What you miss: unsolved Diagnostic Pursuit cases, a wrong first diagnosis in Case Files, missed questions in The Streak Master, The Quiz Parade and The Wheels of Chaos, missed Crossword words and unsolved Riddler conditions. The word and party games add nothing. In Pass the phone, only the phone owner's misses go in." },
      { q: 'How do I review them?', a: "Today's review shows each miss as a flip card. A missed disease shows 3 of its clues: name it, then tap to see the answer on the back. A missed question shows the question and its choices, with the answer on the back. Disease dossiers hold the full file for every disease." },
      { q: 'Can I add my own cases and words?', a: 'Yes. In Learn you can write your own case or word. You can practise it straight away; once it is approved, you can also play it with friends.' },
    ],
  },
  {
    n: '06',
    chip: 'Shop',
    title: 'Nova Shop and purchases',
    tag: 'Purchases',
    items: [
      { q: 'What can I buy?', a: 'Open the menu, then Nova Shop. Token packs add tokens to your account. The Sovereign package is a one-time buy: the Sovereign robot, its frame and 500 tokens. MedNova Unlimited is a monthly subscription with unlimited Sparks and no ads, plus 500 tokens on your first month (once per account). Everything is paid through Google Play or the App Store.' },
      { q: 'How do I cancel MedNova Unlimited?', a: 'In your Google Play or App Store subscriptions. You keep Unlimited until the paid month ends.' },
      { q: 'I changed phone or account. How do I get my purchases back?', a: 'Sign in, open Nova Shop and tap Restore purchases at the bottom. It asks first, then checks your store account. MedNova Unlimited and the Sovereign package come back; token packs are already on your MedNova account. If you restore on a different MedNova account, Unlimited moves to it and leaves the old one.' },
      { q: 'Can I get a refund?', a: 'Refunds go through Google Play or the App Store. If a purchase is refunded, what it gave is taken back: the tokens from a pack, Sovereign and its frame, or Unlimited. The full rules are in the Terms, section 06.' },
    ],
  },
  {
    n: '07',
    chip: 'Help',
    title: 'Help',
    tag: 'Support',
    items: [
      { q: "Something isn't working. What do I do?", a: 'Tap the red ! button at the top of any page and tell us what happened, in which game and on which case or question.' },
      { q: 'Where do the cases come from?', a: 'They are written for MedNova to teach reasoning. If you think a fact is wrong, report it with the red ! button.' },
      { q: 'How do I delete my account?', a: 'Open your Profile and tap Delete my account, then confirm. Everything linked to it is removed from our servers.' },
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

export const CONTACT_EMAIL = 'Support.novagames@gmail.com';
const CONTACT = CONTACT_EMAIL;

export const PRIVACY: Section[] = [
  {
    n: '01',
    k: 'Who we are',
    plain: 'MedNova is run by *its owner,* not a company.',
    legal: [
      { p: 'MedNova is an educational medical reasoning game. It is run by its owner, who decides how your information is used (the "controller"). On Google Play the developer is listed as Yazan Yousif and on the App Store as Yazan Mohamed. MedNova is built and supported by a small team in Egypt. This policy explains what the app really collects, why, where it is kept and what you can do about it.' },
      { p: 'MedNova is for education only. It is not medical advice, and all cases and patients in it are fictional.' },
    ],
  },
  {
    n: '02',
    k: 'Your account',
    plain: 'An account needs your *email (or Google) and a username.*',
    legal: [
      { b: 'Sign-up.', p: 'When you create an account we receive your email address, a password and the username you choose (also used as your display name). Sign-in and email codes are handled by Supabase Auth. Your password is stored by Supabase only as a one-way hash; MedNova never sees or stores it in plain text.' },
      { b: 'Google sign-in.', p: 'If you sign in with Google, Google confirms who you are and shares your email address and basic profile (name and picture) with us. We never see your Google password, and we use only your email to make your account.' },
      // Apple sign-in (Yazan 2026-11-08, audit fix 4).
      { b: 'Sign in with Apple.', p: 'On iPhone you can sign in with Apple. Apple confirms who you are and shares your name and an email address with us; if you choose Hide My Email, we get a private relay address from Apple instead of your real one. We never see your Apple ID password. We also keep a token from Apple so that, when you delete your account, we can tell Apple to remove MedNova from the apps using your Apple ID.' },
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
          'Sparks: your Sparks bar, what each play cost and when it refills.',
          'Rewards: your daily gift days, daily missions, Grand Rounds stamps, chests and what they held, achievements and cards.',
          'Style: the characters, frames, titles, win effects and stickers you own and wear, and gifts you send or receive.',
          'Leaderboards and likes: your place on the boards, monthly prizes, and the wallpapers and posts you like.',
          'Your cases and words: what you write in Learn, and whether it was approved.',
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
          'Room chat: the stickers and preset voice lines you send in a room. There is no free-text chat, but in some games the clues and guesses you type are shown to the other players.',
          'Watching: who asked to watch your match, your Yes or No, and the friends you always allow. Up to 3 people can watch a match, and they see it as the players do.',
          'Inbox: messages and gifts sent to you, and which you claimed.',
          'Silent Artist: the drawings you make in an online room are sent live to the other players in that room.',
          'Reports: if you report a drawing, we keep the report and the drawing so it can be reviewed.',
        ],
      },
      { p: 'Other players can see your username, avatar, scores in shared games and anything you send in a room. Do not use your real name as a username if you do not want it shown.' },
      { p: 'While you are in a room or match, your phone keeps a live connection to our server so it hears changes at once. To keep online play running for everyone, the server also counts how many players are in matches and for how long.' },
    ],
  },
  {
    n: '05',
    k: 'On your phone',
    plain: 'Some data *stays on your device.*',
    legal: [
      { p: 'MedNova stores your sign-in session, settings, saved plays and wallet on your phone so the app works offline and opens quickly. Deleting the app removes this local data.' },
      { b: 'Photos.', p: 'When you save a wallpaper, your phone may ask to let MedNova add photos. MedNova only adds the picture you save; it never reads your gallery.' },
    ],
  },
  {
    n: '06',
    k: 'Ads',
    plain: 'Ads are *your choice:* you watch one only to earn a reward.',
    legal: [
      { p: 'MedNova shows rewarded ads only when you tap "Watch an ad" (for Sparks or a token). Ads are served by Google AdMob. To show and measure ads, and to stop fraud, Google may collect your device\'s advertising ID, your rough location from your internet address, and how you interact with the ad. We send Google your account id with each rewarded ad only so Google can tell our server you earned the reward.' },
      { b: 'Your choice.', p: 'In the EU, the UK and some US states, the app asks for your consent before any personalised ads, and you can change your answer at any time in Settings > Privacy choices. On iPhone, the app asks whether it may track you across apps; you can change this in iPhone Settings > Privacy > Tracking. If you say no, you may still see ads that are not personalised. You can also reset or delete your advertising ID in your phone\'s settings.' },
      { p: 'Google\'s use of this data is described in Google\'s Privacy Policy (policies.google.com/privacy) and at policies.google.com/technologies/partner-sites.' },
    ],
  },
  {
    n: '07',
    k: 'Crash reports and stats',
    plain: 'We see *crashes and which pages are used,* not who you are.',
    legal: [
      { p: 'MedNova uses Google Firebase Crashlytics to receive a report when the app crashes (the error, the phone model and system version, the app version and your account id, so we can find and fix the problem), and Google Analytics for Firebase to count which pages are opened and which games are started and finished. These stats include an app-instance id and device details, but not your name, email or anything you type, and the advertising features of Analytics are turned off.' },
    ],
  },
  {
    n: '08',
    k: 'Notifications',
    plain: 'Notifications are *off until you say yes.*',
    legal: [
      { p: 'If you allow notifications, your phone gives us a push address, which we keep with your account to send friend requests, game invites, Inbox gifts and at most one reminder a day (your daily reward, a full Sparks bar, or Grand Rounds closing). They are delivered through Expo\'s push service and Google Firebase Cloud Messaging or Apple Push Notification service. Turn either kind off in Settings, or turn all of them off in your phone\'s settings. Signing out removes the push address.' },
    ],
  },
  {
    n: '09',
    k: 'Purchases',
    plain: 'Payments go through *Google Play or the App Store.*',
    legal: [
      { p: 'Token packs and MedNova Unlimited are bought through Google Play or the App Store, which handle the payment. We never see your card or bank details. We receive a record of what you bought and when (through RevenueCat, our purchase service), linked to your account id, so we can add your tokens or Unlimited. The store also keeps its own record under its own privacy policy.' },
    ],
  },
  {
    n: '10',
    k: 'Where it is kept',
    plain: 'Our servers are *in the EU,* in Frankfurt.',
    legal: [
      { p: 'Account and game data is stored with Supabase, which acts as our processor and hosts it on servers in Frankfurt, Germany (EU). Supabase handles it only on our instructions. If you use MedNova from outside the EU, your data travels to these servers.' },
      { p: 'Other services that handle some data for us, each only for the job described above: Google (AdMob ads, Firebase crash reports, stats and notifications), Expo (delivering notifications), Apple and Google (purchases and notifications) and RevenueCat (purchase records). Some of them process data outside the EU, under their own safeguards such as the EU Standard Contractual Clauses.' },
      { p: 'MedNova does not sell your data, and never shares your answers, scores or messages with advertisers.' },
    ],
  },
  {
    n: '11',
    k: 'Why we use it',
    plain: 'We use your data only to *run the game* for you.',
    legal: [
      {
        li: [
          'To create and secure your account and sign you in.',
          'To save your progress, scores, wallet, Sparks and learning cards.',
          'To run daily missions, Grand Rounds, chests, cards, leaderboards and their prizes.',
          'To run friends, invites, online rooms and matches.',
          'To keep play safe: blocking, reviewing reports and stopping misuse.',
          'To answer your messages and bug reports, and to review the cases and words you write.',
          'To show the rewarded ads you choose to watch and pay their rewards, and to process your purchases.',
          'To send the notifications you allowed.',
          'To find and fix crashes and see which games and pages are used, so we can improve them.',
        ],
      },
      { p: 'When you write to us through Contact or the red ! button, we keep your message, where it happened and any email you give, so we can answer and fix the problem.' },
      { b: 'Legal basis.', p: 'Under the EU GDPR and the data protection laws that apply to you, we use your data because it is needed to provide the service you asked for (our contract with you), for our legitimate interest in keeping MedNova safe, working and improving (crash reports and stats), and, for personalised ads and notifications, because you agreed. You can withdraw your agreement at any time in Settings.' },
    ],
  },
  {
    n: '12',
    k: 'How long we keep it',
    plain: 'Until you *delete your account.*',
    legal: [{ p: 'We keep your account data for as long as your account exists. When you delete your account, your account and the rows linked to it (profile, plays, wallet, Sparks, rewards, items, misses, cards, friends, blocks, push addresses and ad reward records) are removed from our servers. Crash reports and stats are kept by Firebase for up to 14 months and are not linked to your name. Purchase records may be kept as long as tax law requires. Data on your phone stays until you delete the app.' }],
  },
  {
    n: '13',
    k: 'Deleting your account',
    plain: 'You can delete it *yourself, in the app.*',
    legal: [{ p: 'Open Profile and tap "Delete my account", then confirm. Your account is deleted straight away and the app returns to guest mode. If you cannot open the app, write to us and we will delete it for you.' }],
  },
  {
    n: '14',
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
      { p: 'These rights come from the data protection laws that apply to you, including the EU and UK GDPR, the Saudi Personal Data Protection Law (PDPL) and the Egyptian Personal Data Protection Law (Law No. 151 of 2020). To use them, write to us (see Contact). You may also complain to your local data protection authority.' },
    ],
  },
  {
    n: '15',
    k: 'Age',
    plain: 'MedNova is for people *16 or older.*',
    legal: [{ p: 'You must be 16 or older to create an account. We do not knowingly collect data from children under 16. If you think a child has made an account, write to us and we will delete it.' }],
  },
  {
    n: '16',
    k: 'Changes',
    plain: 'If this policy changes, *this page changes.*',
    legal: [{ p: 'We update this policy when MedNova\'s features or data use change. The current version is always on this page.' }],
  },
  {
    n: '17',
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
    legal: [{ p: 'MedNova is an educational medical reasoning game built around clinical case puzzles, diagnostic practice, learning tools, statistics and online play with friends. It is run by its owner, listed as the developer Yazan Yousif on Google Play and Yazan Mohamed on the App Store, and built and supported by a small team in Egypt.' }],
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
    legal: [
      { p: 'MedNova records game results according to the rules displayed in the game. Scores, streaks, EXP, tokens and leaderboard rankings are calculated by the relevant game. Results, EXP and tokens have no money value and may be reset, corrected, removed, or changed when necessary to address errors, misuse, or changes to the platform.' },
      { b: 'Sparks, rewards and items.', p: 'Sparks, tokens, chests, cards and Style items are part of the game. They have no money value, cannot be exchanged for money, and are not transferable except as the app allows (for example a gift to a friend). Chest odds are shown in the app. Prices, odds, prizes and refill times may change.' },
    ],
  },
  {
    n: '06',
    k: 'Purchases and ads',
    plain: 'Buying is *optional;* ads are only the ones you choose.',
    legal: [
      { p: 'Token packs and MedNova Unlimited are sold through Google Play or the App Store and follow their payment, refund and cancellation rules. MedNova Unlimited is a monthly subscription that renews automatically until you cancel it in your Google Play or App Store subscriptions; cancelling stops the next renewal, and you keep Unlimited until the paid month ends. Prices are shown in the store before you pay.' },
      { p: 'Tokens and items you buy are a licence to use them in MedNova. They have no money value. If a purchase does not arrive, write to us and we will fix it.' },
      // Refund rules (Yazan 2026-11-08). They match what the revenuecat function does when a store refunds.
      { b: 'Refunds: who decides.', p: 'Refunds go through Google Play or the App Store and follow their rules. On the App Store, Apple decides every refund request. On Google Play you can ask Google for a refund within 48 hours of buying; after that, write to us.' },
      { b: 'Token packs.', p: 'We accept a refund request sent to us only if none of the tokens from that pack have been spent. If a store refunds a token pack, the same number of tokens is taken off your balance (it never goes below zero).' },
      { b: 'Sovereign package.', p: 'We accept a refund request sent to us only if its 500 tokens have not been spent. If the package is refunded, Sovereign and its frame are removed from your account and you go back to Bolt and the normal frame.' },
      { b: 'MedNova Unlimited.', p: 'You can cancel any time in your Google Play or App Store subscriptions. You keep Unlimited until the paid month ends, and there is no refund for a month that has already started. If a store refunds a month, Unlimited ends straight away; if it was your first month, the 500 welcome tokens are taken off your balance too.' },
      { b: 'Your rights.', p: 'Nothing in these refund rules limits the rights the law gives you where you live.' },
      { p: 'Rewarded ads appear only when you tap "Watch an ad". A reward is paid once Google confirms the ad was watched to the end, up to the daily limits shown in the app.' },
    ],
  },
  {
    n: '07',
    k: 'Your content',
    plain: 'What you share with others is *your responsibility.*',
    legal: [
      { p: 'Your username, the drawings you make in Silent Artist, the clues and guesses you type in online games and the stickers and voice lines you send in online rooms are seen by other players. You are responsible for them. Do not use content that is offensive, hateful, sexual, violent, harassing, misleading, or that includes real patient information or other people\'s personal data.' },
      { p: 'Cases and words you write in Learn must be your own or shared with permission, medically responsible, and free of anything that could identify a real patient. We review them before they can be played with others.' },
      { p: 'MedNova has zero tolerance for objectionable content or abusive users. You can block any player and report any player, drawing or case. We review reports and may remove content, change a username, or suspend or close an account that breaks these rules.' },
    ],
  },
  {
    n: '08',
    k: 'Acceptable use',
    plain: 'Play fair and *keep MedNova safe.*',
    legal: [
      {
        li: [
          'Do not attempt to interfere with the operation or security of MedNova.',
          'Do not manipulate scores, leaderboards, timers, wallets, or account systems through unauthorized methods.',
          'Do not harass, threaten, or impersonate other players.',
          'Do not share objectionable, unlawful, or privacy-invasive content in usernames, drawings, stories, cases, or rooms.',
        ],
      },
    ],
  },
  {
    n: '09',
    k: 'Privacy',
    plain: 'Your data is covered by the *Privacy Policy.*',
    legal: [{ p: 'Your use of MedNova is also governed by the Privacy Policy, which explains what account, gameplay, social and online-play information is handled and what your rights are.' }],
  },
  {
    n: '10',
    k: 'Intellectual property',
    plain: "MedNova's games and content *belong to MedNova.*",
    legal: [{ p: "MedNova's software, branding, games, cases and written content belong to MedNova and are protected by intellectual-property laws. Artwork was made for MedNova, including with AI image tools. Some photos are the owner's own, and others are public domain or CC0. The game voice lines were recorded for MedNova with the speaker's permission, and the app sounds are public domain (CC0, by Kenney). Fonts and open-source software are used under their own licences, listed in About. Except where expressly permitted, you may not copy, redistribute, reverse engineer or commercially exploit MedNova materials." }],
  },
  {
    n: '11',
    k: 'Availability',
    plain: 'Games and rules *may change* as MedNova grows.',
    legal: [{ p: 'Features may be changed, suspended, or discontinued as MedNova develops. We may update game rules, case libraries, scoring presentation, sign-in options, or other platform functionality when necessary.' }],
  },
  {
    n: '12',
    k: 'Suspension',
    plain: 'Serious misuse can *close an account.*',
    legal: [{ p: 'Access may be restricted or an account may be suspended or terminated when necessary to address serious misuse, objectionable content, security risks, unlawful activity, or violations of these Terms. Where appropriate, users may contact MedNova to ask about an account-related decision.' }],
  },
  {
    n: '13',
    k: 'No guarantee',
    plain: 'We work hard, but *mistakes can happen.*',
    legal: [{ p: 'MedNova is provided as an evolving educational platform. While reasonable efforts are made to keep the service reliable and the information useful, no software or educational content can be guaranteed to be completely error-free or continuously available.' }],
  },
  // Audit fix 5 + call 4 (Yazan 2026-11-08): liability, ending an account, changes and governing law.
  {
    n: '14',
    k: 'Limits of liability',
    plain: 'MedNova is a game, and our *responsibility has limits.*',
    legal: [
      { p: 'MedNova is provided "as is" for education and entertainment. To the extent the law allows, MedNova and its owner are not liable for indirect or consequential losses, for decisions made using the app, for loss of game progress or virtual items, or for problems caused by your device, connection or third-party services.' },
      { p: 'Where the law does not allow these limits, they apply only as far as the law permits. Nothing in these Terms limits liability that cannot be limited by law, or your rights as a consumer.' },
    ],
  },
  {
    n: '15',
    k: 'Ending your account',
    plain: 'You can *leave any time.*',
    legal: [{ p: 'You can stop using MedNova and delete your account at any time from Profile, or ask us to delete it. Deleting your account removes your progress, tokens and items, and they cannot be restored. A subscription is managed by your app store, so cancel it there as well. We may end accounts as described under Suspension.' }],
  },
  {
    n: '16',
    k: 'Changes to these Terms',
    plain: 'If the Terms change, *we will tell you.*',
    legal: [{ p: 'We may update these Terms when MedNova changes. The current version is always in the app and on our website. For important changes we will tell you in the app before they apply. If you keep using MedNova after a change, the new Terms apply; if you do not agree, you can delete your account.' }],
  },
  {
    n: '17',
    k: 'Governing law',
    plain: 'These Terms follow *the laws of Saudi Arabia.*',
    legal: [{ p: 'These Terms are governed by the laws of the Kingdom of Saudi Arabia, and disputes go to its competent courts. This does not take away any rights the consumer laws of your own country give you.' }],
  },
  {
    n: '18',
    k: 'Contact',
    plain: 'Questions about these Terms? *Write to us.*',
    legal: [{ p: `For questions about these Terms, contact MedNova at ${CONTACT}.` }],
  },
];

// One-line medical disclaimer shown on sign-in, About and each Learn dossier.
export const DISCLAIMER = 'For education only, not medical advice. All cases are fictional.';
