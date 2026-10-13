// Text sticker packs sold in the Style shop (Yazan 2026-10-13): no characters, art made by Yazan in Flow.
// Ids are '<pack>-NN' so the server's send_talk check ('pack:<pack>' owned) covers them.
export type TextPack = { key: string; name: string; what: string; stickers: { id: string; src: number; label: string }[] };
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
];
export const textPackOf = (key: string) => TEXT_PACKS.find((p) => p.key === key);
