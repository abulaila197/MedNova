// Builds the small public website in website/ (Cloudflare Pages, no build step there), in English and in Arabic
// under /ar/ (Yazan 2026-11-13): home, Privacy Policy and Terms (the same text as the app's Privacy & Terms page),
// account deletion, support, and the https friend link (/add/CODE) that opens the app.
// Run after changing src/features/info/content.ts, src/data/games.ts or the Arabic dictionaries: node scripts/build-website.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const out = path.join(root, 'website');

// content.ts imports '@/data/games' and '@/i18n' (the app's language layer, which needs React Native). Copy the files
// to a temp folder with relative imports and a small stand-in for '@/i18n', once per language, so Node can load them.
// The Arabic run uses the app's own Arabic dictionaries, so the Arabic Privacy Policy and Terms match the app word
// for word.
async function loadContent(lang) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `mn-site-${lang}-`));
  const fix = (code) => code.replace(/'@\/data\/games'/g, "'./games.ts'").replace(/'@\/i18n'/g, "'./i18n.ts'").replace(/from '\.\/([a-z-]+)'/g, "from './$1.ts'");
  const copy = (from, to) => fs.writeFileSync(path.join(tmp, to), fix(fs.readFileSync(path.join(root, from), 'utf8')));
  copy('src/data/games.ts', 'games.ts');
  copy('src/features/info/content.ts', 'content.ts');
  for (const f of ['ar', 'ar-frame', 'ar-play', 'ar-data', 'plural', 'ar-games']) copy(`src/i18n/${f}.ts`, `${f}.ts`);
  const ar = lang === 'ar';
  fs.writeFileSync(
    path.join(tmp, 'i18n.ts'),
    `import { AR } from './ar.ts';
import { AR_FRAME } from './ar-frame.ts';
import { AR_PLAY } from './ar-play.ts';
import { AR_DATA } from './ar-data.ts';
import { agree } from './plural.ts';
import { localizeGames } from './ar-games.ts';
export const isAr = ${ar};
if (isAr) localizeGames();
export function tr(en, vars) {
  let s = isAr ? (AR[en] ?? AR_FRAME[en] ?? AR_PLAY[en] ?? AR_DATA[en] ?? en) : en;
  const bar = s.indexOf('|');
  if (bar > 0 && s === en) s = s.slice(0, bar);
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
  return isAr ? agree(s) : s;
}
export const t = tr;
`,
  );
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  const i18n = await import(pathToFileURL(path.join(tmp, 'i18n.ts')).href);
  const content = await import(pathToFileURL(path.join(tmp, 'content.ts')).href);
  const { GAMES } = await import(pathToFileURL(path.join(tmp, 'games.ts')).href);
  fs.rmSync(tmp, { recursive: true, force: true });
  return { ...content, GAMES, tr: i18n.tr };
}
const C = { en: await loadContent('en'), ar: await loadContent('ar') };
const { CONTACT_EMAIL } = C.en;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// "*words*" marks the accent words, like Rich in the app.
const rich = (s) => esc(s).split('*').map((p, i) => (i % 2 ? `<em>${p}</em>` : p)).join('');
const mail = `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`;
const year = new Date().getFullYear();

// Store pages (Yazan 2026-11-13: store buttons instead of "Coming soon").
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.novagames.mednova';
const APPLE_URL = 'https://apps.apple.com/app/id6831704683';

// Every text on the site that is not from the app. Arabic follows the app: Egyptian Arabic for the pages, formal
// Arabic for the Privacy Policy and Terms (those come from the app's own dictionaries). MedNova and Nova stay in
// English letters.
const S = {
  en: {
    nav: ['Privacy', 'Terms', 'Delete account', 'Support'],
    other: 'عربي', otherLabel: 'اقرأ بالعربي',
    foot: 'For education only, not medical advice. All cases and patients are fictional.',
    play: 'Get it on <b>Google Play</b>', apple: 'Download on the <b>App Store</b>',
    homeTitle: 'MedNova · Medical games',
    homeDesc: 'MedNova teaches medicine through games: diagnose from clues, solve medical crosswords and riddles, and play with friends.',
    homeKick: 'Free on the App Store and Google Play',
    homeH1: 'Learn medicine <em>by playing.</em>',
    homeLead: 'Name the disease from clues, fill medical crosswords, read picture riddles and race rivals, with no internet needed. Play party games with friends on one phone. The cases you miss come back later so you can review them.',
    games: '+10 games',
    privacy: ['Privacy Policy', 'Privacy, in <em>plain words.</em>'],
    terms: ['Terms of Use', 'The rules, in <em>plain words.</em>'],
    legalDesc: (n) => `The MedNova ${n}.`,
    delTitle: 'Delete your account · MedNova', delDesc: 'How to delete your MedNova account and data.',
    del: `<p class="kick">MedNova · Account deletion</p><h1>Delete your <em>MedNova account.</em></h1>
<section><p class="kick">In the app</p><h2>The quickest way: <em>do it yourself.</em></h2><ol class="steps"><li>Open MedNova and sign in.</li><li>Go to <b>Profile</b>.</li><li>Tap <b>Delete my account</b>, then confirm.</li></ol><p class="legal">Your account is deleted straight away and the app returns to guest mode.</p></section>
<section><p class="kick">By email</p><h2>Can't open the app? <em>Write to us.</em></h2><p class="legal">Email ${mail} from the email address you signed up with, with the subject <b>Delete my account</b>, and include your username. We delete the account and reply to confirm, within 30 days at the latest.</p></section>
<section><p class="kick">What is deleted</p><h2>Your account and <em>everything linked to it.</em></h2><ul><li>Your sign-in (email and password), profile, username, avatar and friend code.</li><li>Your plays, scores, wallet, tokens, missed cases and learning cards.</li><li>Your friends list, requests, invites and blocks.</li><li>Your notification settings and push addresses, and your ad reward records.</li></ul><p class="legal next">Data saved on your phone stays there until you delete the app. Anything bought through the App Store or Google Play stays on your store account; cancel a subscription in your store settings.</p></section>`,
    supTitle: 'Support · MedNova', supDesc: 'Get help with MedNova.',
    sup: `<p class="kick">MedNova · Support</p><h1>Need a hand? <em>We read every message.</em></h1>
<section><p class="kick">In the app</p><h2>Something broke? Tap the <em>red ! button.</em></h2><p class="legal">It is at the top of every page. Tell us what happened, in which game and on which case or question, and it reaches us with the details we need.</p></section>
<section><p class="kick">By email</p><h2>Anything else, <em>write to us.</em></h2><p class="legal">${mail}</p><p class="legal next">Questions, ideas, a fact you think is wrong, purchases, or working with us on teaching and cases. Please include your username if it is about your account.</p></section>`,
    supCards: [['delete-account/', 'Delete your account'], ['privacy/', 'Privacy Policy']],
    openTitle: 'Open in MedNova', openDesc: 'Open this MedNova invite in the app.',
    openKick: 'Friend invite', openH1: 'You are invited to <em>be friends.</em>', openBtn: 'Open MedNova',
    openHow: 'If nothing happens, MedNova is not on this phone yet. Get it below, then open Profile, tap + Add friend and enter the code above.',
    nfTitle: 'Not found · MedNova', nfH1: 'This page <em>isn’t here.</em>', nfBtn: 'Go to MedNova',
  },
  ar: {
    nav: ['الخصوصية', 'الشروط', 'مسح الحساب', 'الدعم'],
    other: 'English', otherLabel: 'Read in English',
    foot: 'للتعليم بس، مش نصيحة طبية. كل الحالات والمرضى من الخيال.',
    play: 'نزّله من <b>Google Play</b>', apple: 'نزّله من <b>App Store</b>',
    homeTitle: 'MedNova · ألعاب طبية',
    homeDesc: 'MedNova بيعلّمك الطب باللعب: شخّص من الأدلة، حل كلمات متقاطعة وفوازير طبية، والعب مع صحابك.',
    homeKick: 'ببلاش على App Store و Google Play',
    homeH1: 'اتعلّم الطب <em>وانت بتلعب.</em>',
    homeLead: 'اعرف المرض من الأدلة، املا كلمات متقاطعة طبية، حل فوازير بالصور، واتحدّى المنافسين من غير نت. والعب ألعاب جماعية مع صحابك على موبايل واحد. والحالات اللي بتغلط فيها بترجعلك بعدين عشان تراجعها.',
    games: '\u2066+10\u2069 ألعاب',
    privacy: ['سياسة الخصوصية', 'الخصوصية، <em>بكلام واضح.</em>'],
    terms: ['شروط الاستخدام', 'القواعد، <em>بكلام واضح.</em>'],
    legalDesc: (n) => `${n} في MedNova.`,
    delTitle: 'امسح حسابك · MedNova', delDesc: 'إزاي تمسح حسابك وبياناتك في MedNova.',
    del: `<p class="kick">MedNova · مسح الحساب</p><h1>امسح حسابك <em>في MedNova.</em></h1>
<section><p class="kick">من التطبيق</p><h2>أسرع طريقة: <em>اعملها بنفسك.</em></h2><ol class="steps"><li>افتح MedNova وسجّل دخولك.</li><li>روح على <b>البروفايل</b>.</li><li>دوس <b>امسح حسابي</b>، وبعدين أكّد.</li></ol><p class="legal">حسابك بيتمسح على طول، والتطبيق بيرجع لوضع الضيف.</p></section>
<section><p class="kick">بالإيميل</p><h2>مش قادر تفتح التطبيق؟ <em>ابعتلنا.</em></h2><p class="legal">ابعت إيميل على ${mail} من نفس الإيميل اللي سجّلت بيه، والعنوان <b>امسح حسابي</b>، واكتب اسم المستخدم بتاعك. هنمسح الحساب ونرد عليك نأكّد، في خلال 30 يوم بالكتير.</p></section>
<section><p class="kick">إيه اللي بيتمسح</p><h2>حسابك و<em>كل حاجة مربوطة بيه.</em></h2><ul><li>بيانات الدخول (الإيميل والباسورد)، البروفايل، اسم المستخدم، الصورة وكود الصداقة.</li><li>لعبك، نقطك، محفظتك، عملاتك، الحالات اللي غلطت فيها وكروت المذاكرة.</li><li>قايمة صحابك، الطلبات، الدعوات واللي عملتلهم بلوك.</li><li>إعدادات الإشعارات وعناوين الإشعارات، وسجلات مكافآت الإعلانات.</li></ul><p class="legal next">البيانات المحفوظة على موبايلك بتفضل عليه لحد ما تمسح التطبيق. وأي حاجة اشتريتها من App Store أو Google Play بتفضل على حساب المتجر بتاعك؛ والاشتراك بيتلغي من إعدادات المتجر.</p></section>`,
    supTitle: 'الدعم · MedNova', supDesc: 'خد مساعدة في MedNova.',
    sup: `<p class="kick">MedNova · الدعم</p><h1>محتاج مساعدة؟ <em>بنقرا كل رسالة.</em></h1>
<section><p class="kick">من التطبيق</p><h2>في حاجة باظت؟ دوس <em>زرار ! الأحمر.</em></h2><p class="legal">هتلاقيه فوق في كل صفحة. قولنا إيه اللي حصل، في أنهي لعبة وعلى أنهي حالة أو سؤال، والرسالة بتوصلنا بالتفاصيل اللي محتاجينها.</p></section>
<section><p class="kick">بالإيميل</p><h2>أي حاجة تانية، <em>ابعتلنا.</em></h2><p class="legal">${mail}</p><p class="legal next">أسئلة، أفكار، معلومة شايفها غلط، مشتريات، أو لو عايز تشتغل معانا في التعليم والحالات. ولو الموضوع عن حسابك اكتب اسم المستخدم بتاعك.</p></section>`,
    supCards: [['delete-account/', 'امسح حسابك'], ['privacy/', 'سياسة الخصوصية']],
    openTitle: 'افتح في MedNova', openDesc: 'افتح الدعوة دي في تطبيق MedNova.',
    openKick: 'دعوة صداقة', openH1: 'معزوم <em>تبقوا صحاب.</em>', openBtn: 'افتح MedNova',
    openHow: 'لو مفيش حاجة حصلت، يبقى MedNova لسه مش على الموبايل ده. نزّله من تحت، وبعدين افتح البروفايل، دوس + ضيف صاحب واكتب الكود اللي فوق.',
    nfTitle: 'مش موجودة · MedNova', nfH1: 'الصفحة دي <em>مش هنا.</em>', nfBtn: 'روح لـ MedNova',
  },
};
const SLUGS = ['privacy', 'terms', 'delete-account', 'support'];
const base = (lang) => (lang === 'ar' ? '/ar/' : '/');

function page(lang, { slug, title, desc, body, robots = 'index,follow', script = '' }) {
  const L = S[lang];
  const nav = SLUGS.map((x, i) => `<a href="${base(lang)}${x}/"${x === slug ? ' aria-current="page"' : ''}>${L.nav[i]}</a>`).join('');
  // The same page in the other language (the 404 and invite pages switch to the other home).
  const here = slug && SLUGS.includes(slug) ? `${slug}/` : '';
  const other = lang === 'ar' ? 'en' : 'ar';
  const swap = `<a class="lang" href="${base(other)}${here}" hreflang="${other}" lang="${other}" aria-label="${L.otherLabel}">${L.other}</a>`;
  const alt = slug === '' || SLUGS.includes(slug) ? `<link rel="alternate" hreflang="en" href="https://mednova-1ua.pages.dev/${here}">\n<link rel="alternate" hreflang="ar" href="https://mednova-1ua.pages.dev/ar/${here}">\n` : '';
  return `<!doctype html>
<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="#0d1738">
${alt}<link rel="icon" href="/assets/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<header class="top"><a class="brand" href="${base(lang)}" dir="ltr"><img src="/assets/icon-192.png" alt="" width="34" height="34"><span>Med<em>Nova</em></span></a><nav>${nav}${swap}</nav></header>
<main>
${body}
</main>
<footer><p>© ${year} MedNova · ${L.foot}</p><p>${mail}</p></footer>
${script}
</body>
</html>
`;
}

const stores = (lang) => `<div class="stores"><a class="store" href="${PLAY_URL}">${S[lang].play}</a><a class="store" href="${APPLE_URL}">${S[lang].apple}</a></div>`;

function legalBlock(b, first) {
  if (b.li) return `<ul${first ? '' : ' class="next"'}>${b.li.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`;
  return `<p class="legal${first ? '' : ' next'}">${b.b ? `<b>${esc(b.b)}</b> ` : ''}${esc(b.p)}</p>`;
}

function legalPage(lang, slug, [name, lead], sections) {
  // Section ids come from the English names, so /privacy/#contact and /ar/privacy/#contact point at the same part.
  const ids = (slug === 'privacy' ? C.en.PRIVACY : C.en.TERMS).map((x) => x.k.split('|')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  const secs = sections
    .map((x, i) => `<section id="${ids[i]}"><p class="kick">${esc(x.n)} · ${esc(x.k.split('|')[0])}</p><h2>${rich(x.plain)}</h2>${x.legal.map((b, j) => legalBlock(b, j === 0)).join('')}</section>`)
    .join('\n');
  return page(lang, { slug, title: `${name} · MedNova`, desc: S[lang].legalDesc(name), body: `<p class="kick">MedNova · ${esc(name)}</p><h1>${lead}</h1>\n${secs}` });
}

const files = {};

for (const lang of ['en', 'ar']) {
  const L = S[lang];
  const { GAMES, PRIVACY, TERMS } = C[lang];
  const dir = lang === 'ar' ? 'ar/' : '';
  const b = base(lang);
  files[`${dir}index.html`] = page(lang, {
    slug: '',
    title: L.homeTitle,
    desc: L.homeDesc,
    body: `<section class="hero"><img src="/assets/icon-192.png" alt="MedNova" width="96" height="96"><p class="kick">${L.homeKick}</p><h1>${L.homeH1}</h1><p class="lead">${L.homeLead}</p>${stores(lang)}</section>
<section><p class="kick">${L.games}</p><ul class="games">${GAMES.map((g) => `<li><b>${esc(`${g.lead} ${g.em}`.trim())}</b><span>${esc(g.desc)}</span></li>`).join('')}</ul></section>
<section class="cards">${SLUGS.map((x, i) => `<a class="card" href="${b}${x}/">${L.nav[i]}<span aria-hidden="true">→</span></a>`).join('')}</section>`,
  });
  files[`${dir}privacy/index.html`] = legalPage(lang, 'privacy', L.privacy, PRIVACY);
  files[`${dir}terms/index.html`] = legalPage(lang, 'terms', L.terms, TERMS);
  files[`${dir}delete-account/index.html`] = page(lang, { slug: 'delete-account', title: L.delTitle, desc: L.delDesc, body: L.del });
  files[`${dir}support/index.html`] = page(lang, {
    slug: 'support',
    title: L.supTitle,
    desc: L.supDesc,
    body: `${L.sup}\n<section class="cards">${L.supCards.map(([h, t]) => `<a class="card" href="${b}${h}">${t}<span aria-hidden="true">→</span></a>`).join('')}</section>`,
  });
  // /add/CODE is rewritten to /open/ (_redirects). It opens the app on the same mednova:// link the app handles,
  // and shows the code to type in by hand if the app is not installed. The page picks Arabic when the phone does.
  files[`${dir}open/index.html`] = page(lang, {
    slug: 'open',
    title: L.openTitle,
    desc: L.openDesc,
    robots: 'noindex',
    body: `<section class="hero open"><img src="/assets/icon-192.png" alt="" width="96" height="96"><p class="kick">${L.openKick}</p><h1>${L.openH1}</h1><p class="code" id="code" dir="ltr" hidden></p><a class="btn" id="go" href="${b}">${L.openBtn}</a><p class="lead">${L.openHow}</p>${stores(lang)}</section>`,
    script: `<script>
(function () {
  var m = location.pathname.match(/^\\/(?:ar\\/)?add\\/([A-Za-z0-9-]{1,24})\\/?$/);
  if (!m) return;
  var code = m[1].toUpperCase();
  ${lang === 'en' ? `if (/^ar\\b/i.test(navigator.language || '')) { location.replace('/ar/add/' + m[1] + location.search); return; }` : ''}
  var link = 'mednova://add/' + code;
  var el = document.getElementById('code');
  el.hidden = false;
  el.textContent = code;
  document.getElementById('go').href = link;
  location.href = link;
})();
</script>`,
  });
}

files['404.html'] = page('en', {
  slug: '404',
  title: S.en.nfTitle,
  desc: 'Page not found.',
  robots: 'noindex',
  body: `<section class="hero"><p class="kick">404</p><h1>${S.en.nfH1}</h1><a class="btn" href="/">${S.en.nfBtn}</a></section>`,
});

// Rooms were removed with online play (2026-11-09), so old /join/ links just open the home page.
files['_redirects'] = `/add/*   /open/  200
/ar/add/*  /ar/open/  200
/join/*  /  302
/privacy-policy  /privacy/  301
/delete  /delete-account/  301
`;

files['_headers'] = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/assets/*
  Cache-Control: public, max-age=604800
`;

files['robots.txt'] = 'User-agent: *\nDisallow: /open/\nDisallow: /ar/open/\n';
// AdMob (Group 2): the developer website named in both store listings must list who may sell MedNova's ad space.
files['app-ads.txt'] = 'google.com, pub-3390074715930067, DIRECT, f08c47fec0942fa0\n';

for (const [rel, text] of Object.entries(files)) {
  const p = path.join(out, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}
console.log(`website: ${Object.keys(files).length} files written`);
