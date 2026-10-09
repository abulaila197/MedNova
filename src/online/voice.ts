// ON28: the 12 shared voice lines (Kokoro voice 'Lewis').
export const VOICE: { id: string; line: string; src: number }[] = [
  { id: 'good-luck', line: "Good luck!", src: require('../../assets/voice/good-luck.m4a') },
  { id: 'nice-one', line: "Nice one!", src: require('../../assets/voice/nice-one.m4a') },
  { id: 'so-close', line: "So close!", src: require('../../assets/voice/so-close.m4a') },
  { id: 'hurry-up', line: "Hurry up!", src: require('../../assets/voice/hurry-up.m4a') },
  { id: 'well-played', line: "Well played", src: require('../../assets/voice/well-played.m4a') },
  { id: 'oops', line: "Oops!", src: require('../../assets/voice/oops.m4a') },
  { id: 'rematch', line: "Rematch?", src: require('../../assets/voice/rematch.m4a') },
  { id: 'gg', line: "GG", src: require('../../assets/voice/gg.m4a') },
  { id: 'thank-you', line: "Thank you!", src: require('../../assets/voice/thank-you.m4a') },
  { id: 'sorry', line: "Sorry!", src: require('../../assets/voice/sorry.m4a') },
  { id: 'ready', line: "Ready!", src: require('../../assets/voice/ready.m4a') },
  { id: 'help-me', line: "Help me!", src: require('../../assets/voice/help-me.m4a') },
];
export const voiceById = new Map(VOICE.map((v) => [v.id, v]));
