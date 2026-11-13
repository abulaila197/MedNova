
import { tr } from '@/i18n';// Text sticker packs sold in the Style shop (Yazan 2026-10-13): no characters, art made by Yazan in Flow.
// Ids are '<pack>-NN' so the server's send_talk check ('pack:<pack>' owned) covers them.
export type TextPack = { key: string; name: string; what: string; /** Won from daily chests only, never sold. */ chest?: boolean; stickers: { id: string; src: number; label: string }[] };
export const TEXT_PACKS: TextPack[] = [
  { key: 'class', name: tr('Top of the Class'), what: tr('Gold show-off lines'), stickers: [
    { id: 'class-01', src: require('../../assets/stickers/text/class-01.webp'), label: tr('Next!') },
    { id: 'class-02', src: require('../../assets/stickers/text/class-02.webp'), label: tr('Too easy') },
    { id: 'class-03', src: require('../../assets/stickers/text/class-03.webp'), label: tr('I\'m the best') },
    { id: 'class-04', src: require('../../assets/stickers/text/class-04.webp'), label: tr('Called it') },
    { id: 'class-05', src: require('../../assets/stickers/text/class-05.webp'), label: tr('Diagnosis: genius') },
    { id: 'class-06', src: require('../../assets/stickers/text/class-06.webp'), label: tr('Textbook') },
    { id: 'class-07', src: require('../../assets/stickers/text/class-07.webp'), label: tr('Bow down') },
    { id: 'class-08', src: require('../../assets/stickers/text/class-08.webp'), label: tr('Top of the class') },
  ] },
  { key: 'study', name: tr('Study Harder'), what: tr('Friendly taunts on tape'), stickers: [
    { id: 'study-01', src: require('../../assets/stickers/text/study-01.webp'), label: tr('Work harder') },
    { id: 'study-02', src: require('../../assets/stickers/text/study-02.webp'), label: tr('Back to the books') },
    { id: 'study-03', src: require('../../assets/stickers/text/study-03.webp'), label: tr('Nice try') },
    { id: 'study-04', src: require('../../assets/stickers/text/study-04.png'), label: tr('Ask your attending') },
    { id: 'study-05', src: require('../../assets/stickers/text/study-05.webp'), label: tr('Not even close') },
    { id: 'study-06', src: require('../../assets/stickers/text/study-06.webp'), label: tr('Revise that') },
    { id: 'study-07', src: require('../../assets/stickers/text/study-07.webp'), label: tr('So close') },
    { id: 'study-08', src: require('../../assets/stickers/text/study-08.webp'), label: tr('See you in the rematch') },
  ] },
  { key: 'oncall', name: tr('On Call'), what: tr('Ward door signs'), stickers: [
    { id: 'oncall-01', src: require('../../assets/stickers/text/oncall-01.webp'), label: tr('Stat!') },
    { id: 'oncall-02', src: require('../../assets/stickers/text/oncall-02.webp'), label: tr('Code blue') },
    { id: 'oncall-03', src: require('../../assets/stickers/text/oncall-03.webp'), label: tr('Clear!') },
    { id: 'oncall-04', src: require('../../assets/stickers/text/oncall-04.webp'), label: tr('Discharged') },
    { id: 'oncall-05', src: require('../../assets/stickers/text/oncall-05.webp'), label: tr('Night shift') },
    { id: 'oncall-06', src: require('../../assets/stickers/text/oncall-06.webp'), label: tr('Coffee IV please') },
    { id: 'oncall-07', src: require('../../assets/stickers/text/oncall-07.webp'), label: tr('Vitals stable') },
    { id: 'oncall-08', src: require('../../assets/stickers/text/oncall-08.webp'), label: tr('Need a consult') },
  ] },
  // Daily chest packs (Yazan 2026-10-18).
  { key: 'arcade', name: tr('Arcade Trash Talk'), what: tr('Neon pixel taunts'), chest: true, stickers: [
    { id: 'arcade-01', src: require('../../assets/stickers/text/arcade-01.webp'), label: 'GG' },
    { id: 'arcade-02', src: require('../../assets/stickers/text/arcade-02.webp'), label: tr('Skill issue') },
    { id: 'arcade-03', src: require('../../assets/stickers/text/arcade-03.webp'), label: tr('Too slow') },
    { id: 'arcade-04', src: require('../../assets/stickers/text/arcade-04.webp'), label: tr('Game over') },
    { id: 'arcade-05', src: require('../../assets/stickers/text/arcade-05.webp'), label: tr('Combo!') },
    { id: 'arcade-06', src: require('../../assets/stickers/text/arcade-06.webp'), label: tr('Is that all?') },
    { id: 'arcade-07', src: require('../../assets/stickers/text/arcade-07.webp'), label: tr('Insert coin to retry') },
    { id: 'arcade-08', src: require('../../assets/stickers/text/arcade-08.webp'), label: tr('New high score') },
  ] },
  { key: 'comic', name: tr('Comic Knockout'), what: tr('Comic book bursts'), chest: true, stickers: [
    { id: 'comic-01', src: require('../../assets/stickers/text/comic-01.webp'), label: 'BOOM!' },
    { id: 'comic-02', src: require('../../assets/stickers/text/comic-02.webp'), label: tr('Outplayed') },
    { id: 'comic-03', src: require('../../assets/stickers/text/comic-03.webp'), label: tr('Sit down') },
    { id: 'comic-04', src: require('../../assets/stickers/text/comic-04.webp'), label: tr('Not today') },
    { id: 'comic-05', src: require('../../assets/stickers/text/comic-05.webp'), label: tr('Who\'s next?') },
    { id: 'comic-06', src: require('../../assets/stickers/text/comic-06.webp'), label: tr('Watch and learn') },
    { id: 'comic-07', src: require('../../assets/stickers/text/comic-07.webp'), label: tr('Yawn...') },
    { id: 'comic-08', src: require('../../assets/stickers/text/comic-08.webp'), label: 'K.O.' },
  ] },
  { key: 'chrome', name: tr('Chrome Swagger'), what: tr('Glossy chrome lines'), chest: true, stickers: [
    { id: 'chrome-01', src: require('../../assets/stickers/text/chrome-01.webp'), label: tr('Light work') },
    { id: 'chrome-02', src: require('../../assets/stickers/text/chrome-02.webp'), label: tr('Owned') },
    { id: 'chrome-03', src: require('../../assets/stickers/text/chrome-03.webp'), label: tr('Keep up') },
    { id: 'chrome-04', src: require('../../assets/stickers/text/chrome-04.webp'), label: tr('No contest') },
    { id: 'chrome-05', src: require('../../assets/stickers/text/chrome-05.webp'), label: tr('Bye bye') },
    { id: 'chrome-06', src: require('../../assets/stickers/text/chrome-06.webp'), label: tr('Rematch?') },
    { id: 'chrome-07', src: require('../../assets/stickers/text/chrome-07.webp'), label: tr('Built different') },
    { id: 'chrome-08', src: require('../../assets/stickers/text/chrome-08.webp'), label: tr('Flawless') },
  ] },
];
export const textPackOf = (key: string) => TEXT_PACKS.find((p) => p.key === key);
