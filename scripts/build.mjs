// Builds the static site: every page from the templates below, one JS bundle per page (esbuild),
// and the stylesheet (Tailwind). Run with `npm run build`.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { CATEGORIES, TOOLS } from '../src/registry.mjs';
import { SITE } from '../src/site.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (...p) => path.join(ROOT_DIR, ...p);
const write = (file, text) => { fs.mkdirSync(path.dirname(r(file)), { recursive: true }); fs.writeFileSync(r(file), text); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const catName = (id) => CATEGORIES.find((c) => c.id === id).name;
const toolsIn = (cat) => TOOLS.filter((t) => t.category === cat);

const icon = (d, cls = 'h-5 w-5') => `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="${d}"/></svg>`;
const ICONS = {
  logo: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085',
  search: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
  sun: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z',
  moon: 'M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z',
  menu: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  close: 'M6 18L18 6M6 6l12 12',
  lock: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
  bolt: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
  gift: 'M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  arrow: 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3'
};
const PRIVACY = '🔒 100% Secure: All processing happens locally in your browser. Your data is never sent to a server.';

// ---------------------------------------------------------------- shared pieces
function head({ title, description, root, pagePath, jsonLd }) {
  const url = SITE.url ? `${SITE.url.replace(/\/$/, '')}/${pagePath}` : '';
  return `<!DOCTYPE html>
<html lang="en" class="dark" data-root="${root}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="#0A0F1E">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${SITE.name}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">${url ? `
  <meta property="og:url" content="${url}">
  <link rel="canonical" href="${url}">` : ''}
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="${root}assets/favicon.svg" type="image/svg+xml">
  <script>
    (function () { try { if (localStorage.getItem('mt-theme') === 'light') document.documentElement.classList.remove('dark'); } catch (e) {} })();
    // Local preview (file:// or localhost): keep empty ad slots visible so the layout can be checked. Live sites collapse them.
    if (location.protocol === 'file:' || /^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(location.hostname)) document.documentElement.classList.add('ads-preview');
  </script>
  <link rel="stylesheet" href="${root}assets/css/styles.css">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SITE.adClient}" crossorigin="anonymous"></script>${jsonLd ? `
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>`;
}

function header(root, active) {
  const nav = [['home', 'index.html', 'Tools'], ['flutter', 'flutter/index.html', 'Flutter'], ['about', 'about.html', 'About']];
  return `
  <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm dark:focus:bg-zinc-900">Skip to content</a>
  <header class="site-header">
    <div class="mx-auto flex h-16 max-w-[90rem] items-center gap-3 px-4 sm:px-6">
      <a href="${root}index.html" class="flex items-center gap-2.5" aria-label="${SITE.name} home">
        <span class="logo-mark">${icon(ICONS.logo, 'h-[18px] w-[18px]')}</span>
        <span class="text-base font-semibold tracking-tight">${SITE.name}</span>
      </a>
      <nav class="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
        ${nav.map(([id, href, label]) => `<a href="${root}${href}" class="header-link"${active === id ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
      </nav>
      <div class="ml-auto flex items-center gap-2">
        <button type="button" class="search-trigger hidden sm:flex" data-palette-open aria-label="Search tools">
          ${icon(ICONS.search, 'h-4 w-4')}<span class="pr-6">Search tools…</span><span class="kbd">⌘K</span>
        </button>
        <button type="button" class="icon-btn sm:hidden" data-palette-open aria-label="Search tools">${icon(ICONS.search, 'h-[18px] w-[18px]')}</button>
        <button id="theme-toggle" type="button" class="icon-btn" aria-label="Toggle dark mode">
          ${icon(ICONS.sun, 'hidden h-[18px] w-[18px] dark:block')}${icon(ICONS.moon, 'h-[18px] w-[18px] dark:hidden')}
        </button>
        <button id="menu-toggle" type="button" class="icon-btn lg:hidden" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">${icon(ICONS.menu, 'h-[18px] w-[18px]')}</button>
      </div>
    </div>
  </header>
  <div id="mobile-menu" class="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-sm lg:hidden" hidden>
    <div class="ml-auto flex h-full w-[min(20rem,88vw)] animate-fade-in flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div class="flex h-16 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
        <span class="text-sm font-semibold">Menu</span>
        <button type="button" class="icon-btn" data-menu-close aria-label="Close menu">${icon(ICONS.close, 'h-[18px] w-[18px]')}</button>
      </div>
      <nav class="thin-scroll flex-1 overflow-y-auto p-3" aria-label="All tools">
        <div class="mb-3 grid grid-cols-3 gap-2 text-center text-sm">
          ${nav.map(([, href, label]) => `<a href="${root}${href}" class="rounded-lg border border-zinc-200 py-2 dark:border-zinc-800">${label}</a>`).join('')}
        </div>
        ${sideGroups(root, null)}
      </nav>
    </div>
  </div>`;
}

function sideGroups(root, current) {
  return CATEGORIES.map((c) => `
        <div data-side-group class="mt-5 first:mt-0">
          <p class="side-heading">${c.name}</p>
          ${toolsIn(c.id).map((t) => `<a href="${root}tools/${t.slug}.html" class="side-link" data-search="${esc(`${t.name} ${t.keywords} ${c.name}`.toLowerCase())}"${t.slug === current ? ' aria-current="page"' : ''}>${icon(t.icon, 'h-4 w-4 shrink-0 opacity-70')}<span class="truncate">${esc(t.name)}</span></a>`).join('\n          ')}
        </div>`).join('');
}

function adSlot(kind, extra = '') {
  const formats = { content: 'auto', rail: 'auto', footer: 'horizontal' };
  return `<div class="ad-slot ad-${kind} ${extra}">
        <ins class="adsbygoogle" style="display:block" data-ad-client="${SITE.adClient}" data-ad-slot="${SITE.adSlots[kind]}" data-ad-format="${formats[kind]}" data-full-width-responsive="true"></ins>
      </div>`;
}

function footer(root) {
  return `
  <footer class="mt-16 border-t border-zinc-200 dark:border-zinc-800">
    <div class="mx-auto max-w-[90rem] space-y-10 px-4 py-10 sm:px-6">
      ${adSlot('footer')}
      <div class="grid gap-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div class="space-y-3">
          <a href="${root}index.html" class="flex items-center gap-2.5"><span class="logo-mark">${icon(ICONS.logo, 'h-[18px] w-[18px]')}</span><span class="font-semibold">${SITE.name}</span></a>
          <p class="flex max-w-sm gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">${icon(ICONS.lock, 'mt-0.5 h-4 w-4 shrink-0')}<span>${PRIVACY.replace(/^\S+\s/, '')}</span></p>
        </div>
        <div>
          <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Categories</p>
          <ul class="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">${CATEGORIES.filter((c) => c.id !== 'flutter').map((c) => `<li><a class="hover:text-zinc-900 dark:hover:text-zinc-100" href="${root}index.html#category=${c.id}">${c.name}</a></li>`).join('')}</ul>
        </div>
        <div>
          <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Flutter</p>
          <ul class="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">${toolsIn('flutter').slice(0, 5).map((t) => `<li><a class="hover:text-zinc-900 dark:hover:text-zinc-100" href="${root}tools/${t.slug}.html">${esc(t.name)}</a></li>`).join('')}<li><a class="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400" href="${root}flutter/index.html">All Flutter tools →</a></li></ul>
        </div>
        <div>
          <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">${SITE.name}</p>
          <ul class="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li><a class="hover:text-zinc-900 dark:hover:text-zinc-100" href="${root}about.html">About</a></li>
            <li><a class="hover:text-zinc-900 dark:hover:text-zinc-100" href="${root}privacy.html">Privacy Policy</a></li>
          </ul>
        </div>
      </div>
      <p class="text-xs text-zinc-500">&copy; <span id="year"></span> ${SITE.name}. Free tools, supported by ads.</p>
    </div>
  </footer>
  <div id="palette" class="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/50 px-4 pt-[12vh] backdrop-blur-sm" hidden>
    <div class="w-full max-w-xl animate-scale-in overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900" role="dialog" aria-modal="true" aria-label="Search tools">
      <div class="flex items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
        ${icon(ICONS.search, 'h-5 w-5 text-zinc-400')}
        <input id="palette-input" type="text" autocomplete="off" spellcheck="false" placeholder="Search ${TOOLS.length} tools…" class="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-zinc-400 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0" role="combobox" aria-expanded="true" aria-controls="palette-list">
        <span class="kbd">Esc</span>
      </div>
      <ul id="palette-list" class="thin-scroll max-h-[50vh] overflow-y-auto p-2" role="listbox"></ul>
      <div class="flex gap-4 border-t border-zinc-200 px-4 py-2.5 text-[11px] text-zinc-500 dark:border-zinc-800"><span><span class="kbd">↑</span> <span class="kbd">↓</span> to move</span><span><span class="kbd">Enter</span> to open</span></div>
    </div>
  </div>`;
}

function toolCard(root, t, headingTag = 'h3') {
  return `<a href="${root}tools/${t.slug}.html" class="tool-card group" data-tool-card="${t.slug}" data-category="${t.category}">
          <div class="flex items-center justify-between"><span class="tool-icon">${icon(t.icon, 'h-5 w-5')}</span>${icon(ICONS.arrow, 'h-4 w-4 -translate-x-1 text-zinc-300 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 dark:text-zinc-600')}</div>
          <div><${headingTag} class="font-semibold text-zinc-900 dark:text-zinc-100">${esc(t.name)}</${headingTag}><p class="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">${esc(t.summary)}</p></div>
          <span class="mt-auto text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">${catName(t.category)}</span>
        </a>`;
}

const page = ({ title, description, root, pagePath, active, body, script, jsonLd, preScript = '' }) => `${head({ title, description, root, pagePath, jsonLd })}
<body>
  <div class="glow-bg" aria-hidden="true"></div>${preScript}
  ${header(root, active)}
${body}
  ${footer(root)}
  <script src="${root}assets/js/pages/${script}.js"></script>
</body>
</html>
`;

// Old single-page links (index.html#json, flutter/index.html#json-to-dart) jump to the new tool pages.
function legacyRedirect(prefix, ids) {
  const map = Object.fromEntries(ids);
  return `
  <script>
    (function () { var m = ${JSON.stringify(map)}; var h = location.hash.slice(1); if (m[h]) location.replace('${prefix}tools/' + m[h] + '.html'); })();
  </script>`;
}

// ---------------------------------------------------------------- pages
function homePage() {
  const root = '';
  const chips = [['all', 'All', TOOLS.length], ...CATEGORIES.map((c) => [c.id, c.name, toolsIn(c.id).length])];
  // Each headline word animates on its own (see src/js/pages/home.js).
  const words = (text, cls = '') => text.split(' ').map((w) => `<span data-word class="${cls}">${w}</span>`).join(' ');
  // Tool icons that drift around the hero on wide screens.
  const floaters = [['json-formatter', 7, 18], ['jwt-decoder', 14, 62], ['qr-code-generator', 4, 84], ['hash-generator', 18, 44],
    ['json-to-dart', 86, 20], ['flutter-colorscheme-generator', 92, 58], ['image-resizer', 80, 82], ['regex-tester', 81, 40]]
    .map(([slug, x, y], i) => `<span class="float-wrap" data-float style="left:${x}%;top:${y}%"><span class="float-icon">${icon(TOOLS.find((t) => t.slug === slug).icon, i % 2 ? 'h-5 w-5' : 'h-6 w-6')}</span></span>`).join('');
  const stats = [[TOOLS.length, '', 'free tools'], [CATEGORIES.length, '', 'categories'], [0, '', 'bytes uploaded'], [0, '$', 'cost, forever']];
  const steps = [
    ['Paste, type or drop', 'Bring a JSON payload, a token, an image or a whole assets folder. Nothing is sent anywhere as you do.', '{ "token": "eyJhbGci…" }'],
    ['Processed on your device', 'Your browser does the work with built-in APIs like Web Crypto and Canvas. The page makes no network requests with your data.', '0 requests · 0 bytes uploaded'],
    ['Copy the result', 'Every output has a one-click copy button, and settings you choose are remembered on this device only.', 'Copied to clipboard']
  ];
  const body = `
  <main id="main">
    <section class="relative overflow-hidden" id="hero">
      <div class="grid-bg absolute inset-0 -z-10" aria-hidden="true"></div>
      <div class="pointer-events-none absolute inset-0 -z-10 hidden lg:block" data-float-layer aria-hidden="true">${floaters}</div>
      <div class="mx-auto max-w-[90rem] px-4 pb-12 pt-14 text-center sm:px-6 sm:pt-24">
        <span class="badge badge-safe" data-reveal>${icon(ICONS.lock, 'h-3.5 w-3.5')} 100% local · nothing is ever uploaded</span>
        <h1 class="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">${words('Developer tools that')} ${words('never see your data', 'gradient-text')}</h1>
        <p class="mx-auto mt-6 max-w-2xl text-base text-zinc-600 dark:text-zinc-400 sm:text-lg" data-reveal>${TOOLS.length} fast, free tools for JSON, security, encoding, images and Flutter. No sign-up, no uploads: everything runs right in your browser.</p>
        <div class="relative mx-auto mt-9 max-w-xl" data-reveal>
          <div class="search-glow" aria-hidden="true"></div>
          ${icon(ICONS.search, 'pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-zinc-400')}
          <input id="home-search" type="search" autocomplete="off" spellcheck="false" placeholder="Search tools, e.g. json, jwt, flutter…" aria-label="Search tools" class="relative h-14 w-full rounded-2xl border border-zinc-200 bg-white/90 pl-12 pr-14 text-base shadow-lg shadow-indigo-500/5 transition placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900/90">
          <span class="kbd absolute right-4 top-1/2 z-10 -translate-y-1/2">/</span>
        </div>
        <dl class="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-y-6 sm:grid-cols-4" data-reveal>
          ${stats.map(([n, prefix, label]) => `<div class="flex flex-col-reverse"><dt class="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-500">${label}</dt><dd class="stat-num">${prefix}<span data-count="${n}">${n}</span></dd></div>`).join('')}
        </dl>
      </div>
    </section>
    <section class="mx-auto max-w-[90rem] px-4 sm:px-6" aria-label="Tools">
      <div class="chip-track no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0" role="toolbar" aria-label="Categories">
        <span class="chip-pill" id="chip-pill" aria-hidden="true"></span>
        ${chips.map(([id, name, n]) => `<button type="button" class="cat-chip" data-cat="${id}" aria-pressed="${id === 'all'}">${name} <span class="count">${n}</span></button>`).join('\n        ')}
      </div>
      <div id="home-grid" class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        ${TOOLS.map((t) => toolCard(root, t, 'h2')).join('\n        ')}
      </div>
      <p id="home-empty" class="py-16 text-center text-sm text-zinc-500" hidden>No tools match. Try a different word, or <button type="button" class="font-medium text-indigo-600 dark:text-indigo-400" data-palette-open>browse all tools</button>.</p>
    </section>
    <section class="mx-auto mt-12 max-w-[90rem] px-4 sm:px-6">${adSlot('content')}</section>
    <section id="how" class="mx-auto mt-24 max-w-4xl px-4 sm:px-6" aria-labelledby="how-title">
      <div class="text-center">
        <p class="text-sm font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400" data-reveal>How it works</p>
        <h2 id="how-title" class="mt-2 text-3xl font-bold sm:text-4xl" data-reveal>Three steps. <span class="gradient-text">Zero servers.</span></h2>
      </div>
      <div class="relative mt-14 grid grid-cols-[2.5rem_1fr] gap-x-6 sm:gap-x-10">
        <div class="how-track" aria-hidden="true"><span class="how-progress" id="how-progress"></span></div>
        <ol class="space-y-14">
          ${steps.map(([h, p, chip], i) => `<li class="how-step" data-step><span class="how-num" aria-hidden="true">${i + 1}</span><h3 class="text-xl font-semibold">${h}</h3><p class="mt-2 max-w-xl leading-relaxed text-zinc-600 dark:text-zinc-400">${p}</p><span class="how-chip">${chip}</span></li>`).join('\n          ')}
        </ol>
      </div>
    </section>
    <section class="mx-auto mt-24 max-w-[90rem] px-4 sm:px-6" aria-labelledby="why">
      <h2 id="why" class="text-center text-3xl font-bold sm:text-4xl" data-reveal>Why developers use ${SITE.name}</h2>
      <div class="mt-10 grid gap-4 md:grid-cols-3">
        ${[[ICONS.lock, 'Private by design', 'Every tool runs in your browser. Tokens, keys, JSON and images are processed on your device and never uploaded. You can check it in your browser\'s Network tab.'],
           [ICONS.bolt, 'Instant results', 'No servers, no waiting. Results update as you type, and every output has a one-click copy button.'],
           [ICONS.gift, 'Free, no sign-up', 'No accounts, no paywalls and no installs. Supported by unobtrusive ads that never sit on top of the tools.']]
          .map(([ic, h, p]) => `<div class="feature" data-reveal data-feature><span class="tool-icon">${icon(ic, 'h-5 w-5')}</span><h3 class="mt-4 font-semibold">${h}</h3><p class="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">${p}</p></div>`).join('\n        ')}
      </div>
    </section>
    <section class="mx-auto mt-24 max-w-[90rem] px-4 sm:px-6">
      <div class="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-transparent to-violet-500/10 p-8 sm:p-12" id="flutter-band" data-reveal>
        <div class="band-orb" data-parallax aria-hidden="true"></div>
        <div class="relative grid items-center gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <h2 class="text-2xl font-bold sm:text-3xl">Built for Flutter developers</h2>
            <p class="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">JSON to Dart models, Material 3 color schemes that match <span class="font-mono text-sm">ColorScheme.fromSeed</span> exactly, app icons for every platform, ARB localization files and more.</p>
          </div>
          <a href="flutter/index.html" class="btn btn-primary px-5">Explore Flutter tools ${icon(ICONS.arrow, 'h-4 w-4')}</a>
        </div>
      </div>
    </section>
  </main>`;
  // Motion runs only with JavaScript and without "reduce motion". If home.js never marks the page ready,
  // the hidden starting states are removed after 2.5 s so content can never stay invisible.
  const motionGate = `
  <script>
    (function () {
      var d = document.documentElement;
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      d.classList.add('motion');
      setTimeout(function () { if (!d.classList.contains('motion-ready')) d.classList.remove('motion'); }, 2500);
    })();
  </script>`;
  const legacy = TOOLS.filter((t) => t.oldPage === 'index').map((t) => [t.oldId, t.slug]).concat([['dart', 'json-to-dart']]);
  return page({
    title: `${SITE.name}: Free, Private Developer Tools (JSON, JWT, Flutter & more)`,
    description: `${TOOLS.length} free developer tools that run 100% in your browser: JSON formatter, JWT decoder, hash and RSA tools, QR codes, image resizer and Flutter tools. Nothing is uploaded.`,
    root, pagePath: '', active: 'home', body, script: 'home', preScript: legacyRedirect('', legacy) + motionGate,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, description: 'Free, private developer tools that run in your browser.' }
  });
}

function toolPage(t) {
  const root = '../';
  const fragment = fs.readFileSync(r('src/tools', `${t.slug}.html`), 'utf8').replace(/^/gm, '      ').trimEnd();
  const related = [...toolsIn(t.category).filter((x) => x.slug !== t.slug), ...TOOLS.filter((x) => x.category !== t.category)].slice(0, 6);
  const body = `
  <div class="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[14.5rem_minmax(0,1fr)_18.75rem]">
    <aside class="hidden lg:block" aria-label="Tools">
      <div class="sticky top-[5.5rem]">
        <div class="relative mb-3">
          ${icon(ICONS.search, 'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400')}
          <input id="side-filter" type="search" placeholder="Filter tools" aria-label="Filter tools" class="h-9 w-full rounded-lg border border-zinc-200 bg-white/70 pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/60">
        </div>
        <nav id="side-nav" class="thin-scroll max-h-[calc(100vh-9rem)] overflow-y-auto overscroll-contain pb-6 pr-1">${sideGroups(root, t.slug)}
        </nav>
      </div>
    </aside>
    <main id="main" class="min-w-0 animate-fade-up">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="${root}index.html">Home</a><span aria-hidden="true">/</span><a href="${root}index.html#category=${t.category}">${catName(t.category)}</a><span aria-hidden="true">/</span><span class="text-zinc-700 dark:text-zinc-300" aria-current="page">${esc(t.name)}</span></nav>
      <header class="mb-6 mt-4 flex items-start gap-4">
        <span class="tool-icon tool-icon-lg hidden sm:grid">${icon(t.icon, 'h-6 w-6')}</span>
        <div class="min-w-0">
          <h1 class="text-2xl font-bold sm:text-3xl">${t.title}</h1>
          <p class="mt-1.5 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">${t.intro}</p>
          <div class="mt-3 flex flex-wrap gap-2"><span class="badge badge-safe">${icon(ICONS.lock, 'h-3.5 w-3.5')} Runs locally in your browser</span><span class="badge badge-cat">${catName(t.category)}</span></div>
        </div>
      </header>
${fragment}
      <div class="mt-8">${adSlot('content')}</div>
      <section class="mt-12" aria-labelledby="related">
        <h2 id="related" class="mb-4 text-lg font-semibold">Related tools</h2>
        <div class="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          ${related.map((x) => toolCard(root, x)).join('\n          ')}
        </div>
      </section>
    </main>
    <aside class="hidden xl:block" aria-label="Advertisement">
      <div class="sticky top-[5.5rem]">${adSlot('rail')}</div>
    </aside>
  </div>`;
  const plainTitle = t.title.replace(/&amp;/g, '&');
  return page({
    title: `${plainTitle}: Free & Private | ${SITE.name}`,
    description: t.description.length > 158 ? `${t.description.slice(0, 155).replace(/\s+\S*$/, '')}…` : t.description,
    root, pagePath: `tools/${t.slug}.html`, active: t.category === 'flutter' ? 'flutter' : 'home', body, script: t.slug,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebApplication', name: plainTitle, description: t.description, applicationCategory: 'DeveloperApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } }
  });
}

function flutterPage() {
  const root = '../';
  const body = `
  <main id="main" class="mx-auto max-w-[90rem] px-4 sm:px-6">
    <section class="py-14 text-center sm:py-20">
      <span class="badge badge-cat animate-fade-up">${toolsIn('flutter').length} tools</span>
      <h1 class="mx-auto mt-5 max-w-3xl animate-fade-up text-4xl font-bold [animation-delay:60ms] sm:text-5xl">Flutter <span class="gradient-text">developer tools</span></h1>
      <p class="mx-auto mt-5 max-w-2xl animate-fade-up text-zinc-600 [animation-delay:120ms] dark:text-zinc-400 sm:text-lg">Generate Dart models, Material 3 themes, app icons, asset classes and localization files, privately in your browser.</p>
    </section>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      ${toolsIn('flutter').map((t) => toolCard(root, t, 'h2')).join('\n      ')}
    </div>
    <div class="mt-12">${adSlot('content')}</div>
    <p class="mt-12 text-center text-sm text-zinc-500">Looking for JSON, JWT, hashing or image tools? <a class="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400" href="${root}index.html">Browse all ${TOOLS.length} tools →</a></p>
  </main>`;
  const legacy = TOOLS.filter((t) => t.oldPage === 'flutter').map((t) => [t.oldId, t.slug]);
  return page({
    title: `Free Flutter Developer Tools: JSON to Dart, ColorScheme, App Icons | ${SITE.name}`,
    description: 'Free Flutter tools that run in your browser: JSON to Dart models, Material 3 ColorScheme generator, app icon generator, assets.dart, ARB localization and more.',
    root, pagePath: 'flutter/', active: 'flutter', body, script: 'static', preScript: legacyRedirect(root, legacy)
  });
}

function staticPage(name, title, description) {
  const article = fs.readFileSync(r('src/pages', `${name}.html`), 'utf8').replace(/^/gm, '      ').trimEnd();
  const body = `
  <main id="main" class="mx-auto max-w-3xl animate-fade-up px-4 py-12 sm:px-6 sm:py-16">
    <article class="prose prose-zinc max-w-none dark:prose-invert prose-headings:tracking-tight prose-a:text-indigo-600 dark:prose-a:text-indigo-400">
${article}
    </article>
  </main>`;
  return page({ title, description, root: '', pagePath: `${name}.html`, active: name, body, script: 'static' });
}

// ---------------------------------------------------------------- build
const t0 = Date.now();
write('index.html', homePage());
write('flutter/index.html', flutterPage());
for (const t of TOOLS) write(`tools/${t.slug}.html`, toolPage(t));
write('about.html', staticPage('about', `About ${SITE.name}: Private, Free Developer Tools`, `${SITE.name} is a collection of fast, free, privacy-first developer tools that run entirely in your browser.`));
write('privacy.html', staticPage('privacy', `Privacy Policy | ${SITE.name}`, `${SITE.name} privacy policy: all tools run locally in your browser and never upload your data.`));
// Remove pages for tools that no longer exist in the registry.
for (const f of fs.readdirSync(r('tools'))) if (f.endsWith('.html') && !TOOLS.some((t) => `${t.slug}.html` === f)) fs.unlinkSync(r('tools', f));

write('ads.txt', `google.com, ${SITE.adClient.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n`);
if (SITE.url) {
  const base = SITE.url.replace(/\/$/, '');
  const urls = ['', 'flutter/', 'about.html', 'privacy.html', ...TOOLS.map((t) => `tools/${t.slug}.html`)];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${base}/${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
} else {
  write('robots.txt', 'User-agent: *\nAllow: /\n');
}

// Runtime catalogue for quick search and the home grid (no page-only fields like intros).
write('src/js/generated/catalog.js', `// Generated by scripts/build.mjs from src/registry.mjs. Do not edit.
export const CATALOG = ${JSON.stringify(TOOLS.map(({ slug, name, summary, keywords, category, icon: ic }) => ({ slug, name, summary, keywords, category, icon: ic })))};
export const CATEGORY_NAMES = ${JSON.stringify(Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name])))};
`);
const entries = { home: r('src/js/pages/home.js'), static: r('src/js/pages/static.js') };
for (const t of TOOLS) {
  const file = r('.build/entries', `${t.slug}.js`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `import { bootPage } from '${r('src/js/lib/layout.js')}';\nimport { ${t.init} } from '${r('src/js/tools', `${t.module}.js`)}';\n\nbootPage();\n${t.init}();\n`);
  entries[t.slug] = file;
}
fs.rmSync(r('assets/js/pages'), { recursive: true, force: true });
await esbuild.build({ entryPoints: entries, outdir: r('assets/js/pages'), bundle: true, minify: true, format: 'iife', target: 'es2020', legalComments: 'none', logLevel: 'warning' });

execFileSync(r('node_modules/.bin/tailwindcss'), ['-i', r('src/styles.css'), '-o', r('assets/css/styles.css'), '--minify'], { stdio: ['ignore', 'ignore', 'inherit'] });
console.log(`Built ${TOOLS.length + 4} pages, ${Object.keys(entries).length} scripts and the stylesheet in ${Date.now() - t0} ms.`);
