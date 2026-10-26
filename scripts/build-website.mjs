// Builds the small public website in website/ (Cloudflare Pages, no build step there): home, Privacy Policy and
// Terms (the same text as the app's Privacy & Terms page), account deletion, support, and the https friend and
// room links (/add/CODE, /join/CODE?g=GAME) that open the app.
// Run after changing src/features/info/content.ts or src/data/games.ts: node scripts/build-website.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const out = path.join(root, 'website');

// content.ts imports '@/data/games'; copy both to a temp folder with a relative import so Node can load them.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mn-site-'));
fs.copyFileSync(path.join(root, 'src/data/games.ts'), path.join(tmp, 'games.ts'));
const content = fs.readFileSync(path.join(root, 'src/features/info/content.ts'), 'utf8').replace("'@/data/games'", "'./games.ts'");
fs.writeFileSync(path.join(tmp, 'content.ts'), content);
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
const { PRIVACY, TERMS, CONTACT_EMAIL } = await import(pathToFileURL(path.join(tmp, 'content.ts')).href);
const { GAMES } = await import(pathToFileURL(path.join(tmp, 'games.ts')).href);
fs.rmSync(tmp, { recursive: true, force: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// "*words*" marks the accent words, like Rich in the app.
const rich = (s) => esc(s).split('*').map((p, i) => (i % 2 ? `<em>${p}</em>` : p)).join('');
const mail = `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`;
const year = new Date().getFullYear();

const NAV = [
  ['/privacy/', 'Privacy'],
  ['/terms/', 'Terms'],
  ['/delete-account/', 'Delete account'],
  ['/support/', 'Support'],
];

function page({ slug, title, desc, body, robots = 'index,follow', script = '' }) {
  const nav = NAV.map(([href, label]) => `<a href="${href}"${href === `/${slug}/` ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="#0d1738">
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<header class="top"><a class="brand" href="/"><img src="/assets/icon-192.png" alt="" width="34" height="34"><span>Med<em>Nova</em></span></a><nav>${nav}</nav></header>
<main>
${body}
</main>
<footer><p>© ${year} MedNova · For education only, not medical advice. All cases and patients are fictional.</p><p>${mail}</p></footer>
${script}
</body>
</html>
`;
}

function legalBlock(b, first) {
  if (b.li) return `<ul${first ? '' : ' class="next"'}>${b.li.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`;
  return `<p class="legal${first ? '' : ' next'}">${b.b ? `<b>${esc(b.b)}</b> ` : ''}${esc(b.p)}</p>`;
}

function legalPage(slug, name, sections, lead) {
  const secs = sections
    .map((x) => `<section id="${x.k.toLowerCase().replace(/[^a-z0-9]+/g, '-')}"><p class="kick">${esc(x.n)} · ${esc(x.k)}</p><h2>${rich(x.plain)}</h2>${x.legal.map((b, i) => legalBlock(b, i === 0)).join('')}</section>`)
    .join('\n');
  return page({
    slug,
    title: `${name} · MedNova`,
    desc: `The MedNova ${name}.`,
    body: `<p class="kick">MedNova · ${esc(name)}</p><h1>${lead}</h1>\n${secs}`,
  });
}

const files = {};

files['index.html'] = page({
  slug: '',
  title: 'MedNova · Medical games',
  desc: 'MedNova teaches medicine through games: diagnose from clues, solve medical crosswords and riddles, and play with friends.',
  body: `<section class="hero"><img src="/assets/icon-192.png" alt="MedNova app icon" width="96" height="96"><p class="kick">Coming soon to the App Store and Google Play</p><h1>Learn medicine <em>by playing.</em></h1><p class="lead">Name the disease from clues, fill medical crosswords, read picture riddles and play live with friends. The cases you miss come back later so you can review them.</p></section>
<section><p class="kick">${GAMES.length} games</p><ul class="games">${GAMES.map((g) => `<li><b>${esc(`${g.lead} ${g.em}`)}</b><span>${esc(g.desc)}</span></li>`).join('')}</ul></section>
<section class="cards">${NAV.map(([href, label]) => `<a class="card" href="${href}">${label}<span aria-hidden="true">→</span></a>`).join('')}</section>`,
});

files['privacy/index.html'] = legalPage('privacy', 'Privacy Policy', PRIVACY, 'Privacy, in <em>plain words.</em>');
files['terms/index.html'] = legalPage('terms', 'Terms of Use', TERMS, 'The rules, in <em>plain words.</em>');

files['delete-account/index.html'] = page({
  slug: 'delete-account',
  title: 'Delete your account · MedNova',
  desc: 'How to delete your MedNova account and data.',
  body: `<p class="kick">MedNova · Account deletion</p><h1>Delete your <em>MedNova account.</em></h1>
<section><p class="kick">In the app</p><h2>The quickest way: <em>do it yourself.</em></h2><ol class="steps"><li>Open MedNova and sign in.</li><li>Go to <b>Profile</b>.</li><li>Tap <b>Delete my account</b>, then confirm.</li></ol><p class="legal">Your account is deleted straight away and the app returns to guest mode.</p></section>
<section><p class="kick">By email</p><h2>Can't open the app? <em>Write to us.</em></h2><p class="legal">Email ${mail} from the email address you signed up with, with the subject <b>Delete my account</b>, and include your username. We delete the account and reply to confirm, within 30 days at the latest.</p></section>
<section><p class="kick">What is deleted</p><h2>Your account and <em>everything linked to it.</em></h2><ul><li>Your sign-in (email and password), profile, username, avatar and friend code.</li><li>Your plays, scores, wallet, tokens, missed cases and learning cards.</li><li>Your friends list, requests, invites and blocks.</li></ul><p class="legal next">Data saved on your phone stays there until you delete the app. Anything bought through the App Store or Google Play stays on your store account; cancel a subscription in your store settings.</p></section>`,
});

files['support/index.html'] = page({
  slug: 'support',
  title: 'Support · MedNova',
  desc: 'Get help with MedNova.',
  body: `<p class="kick">MedNova · Support</p><h1>Need a hand? <em>We read every message.</em></h1>
<section><p class="kick">In the app</p><h2>Something broke? Tap the <em>red ! button.</em></h2><p class="legal">It is at the top of every page. Tell us what happened, in which game and on which case or question, and it reaches us with the details we need.</p></section>
<section><p class="kick">By email</p><h2>Anything else, <em>write to us.</em></h2><p class="legal">${mail}</p><p class="legal next">Questions, ideas, a fact you think is wrong, purchases, or working with us on teaching and cases. Please include your username if it is about your account.</p></section>
<section class="cards"><a class="card" href="/delete-account/">Delete your account<span aria-hidden="true">→</span></a><a class="card" href="/privacy/">Privacy Policy<span aria-hidden="true">→</span></a></section>`,
});

// /add/CODE and /join/CODE?g=GAME are rewritten to this page (_redirects). It opens the app on the same
// mednova:// link the app already handles, and shows the code to type in by hand if the app is not installed.
const names = Object.fromEntries(GAMES.map((g) => [g.key, `${g.lead} ${g.em}`]));
files['open/index.html'] = page({
  slug: 'open',
  title: 'Open in MedNova',
  desc: 'Open this MedNova invite in the app.',
  robots: 'noindex',
  body: `<section class="hero open"><img src="/assets/icon-192.png" alt="" width="96" height="96"><p class="kick" id="kind">MedNova invite</p><h1 id="head">Open this in <em>MedNova.</em></h1><p class="code" id="code" hidden></p><a class="btn" id="go" href="/">Open MedNova</a><p class="lead" id="how">If nothing happens, MedNova is not on this phone yet. It is coming soon to the App Store and Google Play.</p></section>`,
  script: `<script>
(function () {
  var NAMES = ${JSON.stringify(names)};
  var m = location.pathname.match(/^\\/(add|join)\\/([A-Za-z0-9-]{1,24})\\/?$/);
  if (!m) return;
  var kind = m[1], code = m[2].toUpperCase();
  var g = new URLSearchParams(location.search).get('g') || '';
  if (!/^[a-z0-9-]{1,40}$/.test(g)) g = '';
  var link = 'mednova://' + kind + '/' + code + (kind === 'join' && g ? '?g=' + encodeURIComponent(g) : '');
  var $ = function (id) { return document.getElementById(id); };
  $('code').hidden = false;
  $('code').textContent = code;
  $('go').href = link;
  if (kind === 'add') {
    $('kind').textContent = 'Friend invite';
    $('head').innerHTML = 'You are invited to <em>be friends.</em>';
    $('how').textContent = 'Tap Open MedNova. No app yet? Once you have it, open Profile, tap + Add friend and enter the code above.';
  } else {
    $('kind').textContent = NAMES[g] ? NAMES[g] + ' room' : 'Room invite';
    $('head').innerHTML = 'Join the room <em>and play.</em>';
    $('how').textContent = 'Tap Open MedNova. No app yet? Once you have it, open the game, choose Online and type the room code above.';
  }
  location.href = link;
})();
</script>`,
});

files['404.html'] = page({
  slug: '404',
  title: 'Not found · MedNova',
  desc: 'Page not found.',
  robots: 'noindex',
  body: `<section class="hero"><p class="kick">404</p><h1>This page <em>isn't here.</em></h1><a class="btn" href="/">Go to MedNova</a></section>`,
});

files['_redirects'] = `/add/*   /open/  200
/join/*  /open/  200
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

files['robots.txt'] = 'User-agent: *\nDisallow: /open/\n';

for (const [rel, text] of Object.entries(files)) {
  const p = path.join(out, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}
console.log(`website: ${Object.keys(files).length} files written`);
