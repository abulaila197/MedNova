// Text sticker packs sold in the Style shop (Yazan 2026-10-13): no characters, art made by Yazan in Flow.
// Ids are '<pack>-NN' so the server's send_talk check ('pack:<pack>' owned) covers them.
export type TextPack = { key: string; name: string; what: string; /** Won from daily chests only, never sold. */ chest?: boolean; stickers: { id: string; src: number; label: string }[] };
export const TEXT_PACKS: TextPack[] = [
  { key: 'class', name: 'Top of the Class', what: 'Gold show-off lines', stickers: [
    { id: 'class-01', src: require('../../assets/stickers/text/class-01.png'), label: 'Next!' },
    { id: 'class-02', src: require('../../assets/stickers/text/class-02.png'), label: 'Too easy' },
    { id: 'class-03', src: require('../../assets/stickers/text/class-03.png'), label: "I'm the best" },
    { id: 'class-04', src: require('../../assets/stickers/text/class-04.png'), label: 'Called it' },
    { id: 'class-05', src: require('../../assets/stickers/text/class-05.png'), label: 'Diagnosis: genius' },
    { id: 'class-06', src: require('../../assets/stickers/text/class-06.png'), label: 'Textbook' },
    { id: 'class-07', src: require('../../assets/stickers/text/class-07.png'), label: 'Bow down' },
    { id: 'class-08', src: require('../../assets/stickers/text/class-08.png'), label: 'Top of the class' },
  ] },
  { key: 'study', name: 'Study Harder', what: 'Friendly taunts on tape', stickers: [
    { id: 'study-01', src: require('../../assets/stickers/text/study-01.png'), label: 'Work harder' },
    { id: 'study-02', src: require('../../assets/stickers/text/study-02.png'), label: 'Back to the books' },
    { id: 'study-03', src: require('../../assets/stickers/text/study-03.png'), label: 'Nice try' },
    { id: 'study-04', src: require('../../assets/stickers/text/study-04.png'), label: 'Ask your attending' },
    { id: 'study-05', src: require('../../assets/stickers/text/study-05.png'), label: 'Not even close' },
    { id: 'study-06', src: require('../../assets/stickers/text/study-06.png'), label: 'Revise that' },
    { id: 'study-07', src: require('../../assets/stickers/text/study-07.png'), label: 'So close' },
    { id: 'study-08', src: require('../../assets/stickers/text/study-08.png'), label: 'See you in the rematch' },
  ] },
  { key: 'oncall', name: 'On Call', what: 'Ward door signs', stickers: [
    { id: 'oncall-01', src: require('../../assets/stickers/text/oncall-01.png'), label: 'Stat!' },
    { id: 'oncall-02', src: require('../../assets/stickers/text/oncall-02.png'), label: 'Code blue' },
    { id: 'oncall-03', src: require('../../assets/stickers/text/oncall-03.png'), label: 'Clear!' },
    { id: 'oncall-04', src: require('../../assets/stickers/text/oncall-04.png'), label: 'Discharged' },
    { id: 'oncall-05', src: require('../../assets/stickers/text/oncall-05.png'), label: 'Night shift' },
    { id: 'oncall-06', src: require('../../assets/stickers/text/oncall-06.png'), label: 'Coffee IV please' },
    { id: 'oncall-07', src: require('../../assets/stickers/text/oncall-07.png'), label: 'Vitals stable' },
    { id: 'oncall-08', src: require('../../assets/stickers/text/oncall-08.png'), label: 'Need a consult' },
  ] },
  // Daily chest packs (Yazan 2026-10-18).
  { key: 'arcade', name: 'Arcade Trash Talk', what: 'Neon pixel taunts', chest: true, stickers: [
    { id: 'arcade-01', src: require('../../assets/stickers/text/arcade-01.png'), label: 'GG' },
    { id: 'arcade-02', src: require('../../assets/stickers/text/arcade-02.png'), label: 'Skill issue' },
    { id: 'arcade-03', src: require('../../assets/stickers/text/arcade-03.png'), label: 'Too slow' },
    { id: 'arcade-04', src: require('../../assets/stickers/text/arcade-04.png'), label: 'Game over' },
    { id: 'arcade-05', src: require('../../assets/stickers/text/arcade-05.png'), label: 'Combo!' },
    { id: 'arcade-06', src: require('../../assets/stickers/text/arcade-06.png'), label: 'Is that all?' },
    { id: 'arcade-07', src: require('../../assets/stickers/text/arcade-07.png'), label: 'Insert coin to retry' },
    { id: 'arcade-08', src: require('../../assets/stickers/text/arcade-08.png'), label: 'New high score' },
  ] },
  { key: 'comic', name: 'Comic Knockout', what: 'Comic book bursts', chest: true, stickers: [
    { id: 'comic-01', src: require('../../assets/stickers/text/comic-01.png'), label: 'BOOM!' },
    { id: 'comic-02', src: require('../../assets/stickers/text/comic-02.png'), label: 'Outplayed' },
    { id: 'comic-03', src: require('../../assets/stickers/text/comic-03.png'), label: 'Sit down' },
    { id: 'comic-04', src: require('../../assets/stickers/text/comic-04.png'), label: 'Not today' },
    { id: 'comic-05', src: require('../../assets/stickers/text/comic-05.png'), label: 'Who\'s next?' },
    { id: 'comic-06', src: require('../../assets/stickers/text/comic-06.png'), label: 'Watch and learn' },
    { id: 'comic-07', src: require('../../assets/stickers/text/comic-07.png'), label: 'Yawn...' },
    { id: 'comic-08', src: require('../../assets/stickers/text/comic-08.png'), label: 'K.O.' },
  ] },
  { key: 'chrome', name: 'Chrome Swagger', what: 'Glossy chrome lines', chest: true, stickers: [
    { id: 'chrome-01', src: require('../../assets/stickers/text/chrome-01.png'), label: 'Light work' },
    { id: 'chrome-02', src: require('../../assets/stickers/text/chrome-02.png'), label: 'Owned' },
    { id: 'chrome-03', src: require('../../assets/stickers/text/chrome-03.png'), label: 'Keep up' },
    { id: 'chrome-04', src: require('../../assets/stickers/text/chrome-04.png'), label: 'No contest' },
    { id: 'chrome-05', src: require('../../assets/stickers/text/chrome-05.png'), label: 'Bye bye' },
    { id: 'chrome-06', src: require('../../assets/stickers/text/chrome-06.png'), label: 'Rematch?' },
    { id: 'chrome-07', src: require('../../assets/stickers/text/chrome-07.png'), label: 'Built different' },
    { id: 'chrome-08', src: require('../../assets/stickers/text/chrome-08.png'), label: 'Flawless' },
  ] },
];
export const textPackOf = (key: string) => TEXT_PACKS.find((p) => p.key === key);
