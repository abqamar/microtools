// Home page: live search, category filter, and the page's motion design (Framer Motion's DOM API, no React).
import { animateMini as animate, hover, inView, scroll, spring, stagger } from 'framer-motion/dom';
import { $, $$ } from '../lib/core.js';
import { bootPage, searchTools } from '../lib/layout.js';

bootPage();

// The inline gate in the page adds .motion only with JavaScript and without "reduce motion".
const html = document.documentElement;
const motion = html.classList.contains('motion');
if (motion) html.classList.add('motion-ready'); // tells the gate's failsafe that animations are running

const SPRING = { type: spring, stiffness: 260, damping: 24 };
const SOFT = { type: spring, stiffness: 150, damping: 20 };

/** Runs an animation and then writes the final keyframes inline, so CSS starting states never come back. */
function play(target, keyframes, options) {
  const els = target instanceof Element ? [target] : [...target];
  if (!els.length) return;
  const a = animate(els, keyframes, options);
  a.finished.then(() => els.forEach((el) => {
    for (const [prop, value] of Object.entries(keyframes)) el.style[prop] = Array.isArray(value) ? value[value.length - 1] : value;
  }));
}

/* ---------------------------------------------------------------- search & category filter */
const search = $('#home-search');
const cards = $$('[data-tool-card]');
const chips = $$('[data-cat]');
const empty = $('#home-empty');
const pill = $('#chip-pill');
const revealed = new Set();
const fromHash = () => (location.hash.match(/^#category=([a-z]+)$/) || [])[1];
let category = chips.some((c) => c.dataset.cat === fromHash()) ? fromHash() : 'all';

function movePill(instant) {
  const active = chips.find((c) => c.dataset.cat === category);
  if (!pill || !active || !motion) return;
  const frame = { transform: `translate(${active.offsetLeft}px, ${active.offsetTop}px)`, width: `${active.offsetWidth}px`, height: `${active.offsetHeight}px` };
  if (instant) Object.assign(pill.style, frame);
  else play(pill, frame, { type: spring, stiffness: 380, damping: 32 });
}

function apply() {
  const matches = new Set(searchTools(search.value).map((t) => t.slug));
  const appeared = [];
  let shown = 0;
  for (const card of cards) {
    const show = matches.has(card.dataset.toolCard) && (category === 'all' || card.dataset.category === category);
    if (show && card.hidden && revealed.has(card)) appeared.push(card);
    card.hidden = !show;
    if (show) shown++;
  }
  chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === category)));
  empty.hidden = shown > 0;
  movePill(false);
  // Cards coming back into the grid after filtering get a quick staggered pop-in.
  if (motion && appeared.length) play(appeared, { opacity: [0, 1], transform: ['translateY(12px) scale(.97)', 'none'] }, { ...SPRING, delay: stagger(0.025) });
}

search.addEventListener('input', apply);
window.addEventListener('pageshow', apply); // Back/forward: the browser restores the typed query, so re-apply it
chips.forEach((chip) => chip.addEventListener('click', () => {
  category = chip.dataset.cat;
  history.replaceState(null, '', category === 'all' ? location.pathname : `#category=${category}`);
  apply();
}));
window.addEventListener('hashchange', () => { const c = fromHash(); if (c) { category = c; apply(); } });
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== search && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
    e.preventDefault();
    search.focus();
  }
});
apply();
movePill(true);
window.addEventListener('resize', () => movePill(true));

/* ---------------------------------------------------------------- motion */
const steps = $$('[data-step]');
if (!motion) {
  steps.forEach((s) => { s.dataset.active = 'true'; }); // static page: show every step as complete
} else {
  // Hero: headline words rise in one by one, then the badge, text, search and stats follow.
  play($$('[data-word]'), { opacity: [0, 1], transform: ['translateY(0.45em)', 'none'], filter: ['blur(10px)', 'blur(0px)'] }, { ...SOFT, delay: stagger(0.07, { startDelay: 0.1 }) });
  play($$('#hero [data-reveal]'), { opacity: [0, 1], transform: ['translateY(16px)', 'none'] }, { ...SOFT, delay: stagger(0.12, { startDelay: 0.35 }) });

  // Floating tool icons: fade in, then drift forever; the whole layer leans toward the pointer.
  $$('[data-float]').forEach((el, i) => {
    play(el, { opacity: [0, 1], transform: ['scale(.6)', 'none'] }, { ...SPRING, delay: 0.7 + i * 0.08 });
    animate(el.firstElementChild, { transform: ['translateY(0px) rotate(0deg)', `translateY(-${12 + (i % 3) * 6}px) rotate(${i % 2 ? -6 : 6}deg)`] },
      { duration: 3.2 + (i % 4) * 0.6, delay: i * 0.25, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' });
  });
  const layer = $('[data-float-layer]');
  const hero = $('#hero');
  let target = { x: 0, y: 0 }, current = { x: 0, y: 0 }, raf = 0;
  const lean = () => {
    current.x += (target.x - current.x) * 0.08;
    current.y += (target.y - current.y) * 0.08;
    layer.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`;
    raf = Math.abs(target.x - current.x) + Math.abs(target.y - current.y) > 0.1 ? requestAnimationFrame(lean) : 0;
  };
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    target = { x: ((e.clientX - r.left) / r.width - 0.5) * -24, y: ((e.clientY - r.top) / r.height - 0.5) * -16 };
    if (!raf) raf = requestAnimationFrame(lean);
  });
  hero.addEventListener('pointerleave', () => { target = { x: 0, y: 0 }; if (!raf) raf = requestAnimationFrame(lean); });

  // Stats count up (or down to zero) when they come into view.
  const counters = $$('[data-count]');
  inView(counters[0].closest('dl'), () => {
    counters.forEach((el, i) => {
      const to = Number(el.dataset.count);
      const from = to > 0 ? 0 : i === 2 ? 4096 : 99;
      const start = performance.now() + 500 + i * 120, duration = 1400;
      const tick = (now) => {
        const p = Math.min(1, Math.max(0, (now - start) / duration));
        el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 4))).toLocaleString();
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });

  // Tool cards spring in as they scroll into view, staggered across each row.
  cards.forEach((card, i) => {
    inView(card, () => {
      revealed.add(card);
      if (!card.hidden) play(card, { opacity: [0, 1], transform: ['translateY(28px) scale(.96)', 'none'] }, { ...SPRING, delay: (i % 4) * 0.06 });
      else card.style.opacity = '1';
    }, { margin: '0px 0px -40px 0px' });
  });

  // Hover: the icon springs, and a soft spotlight follows the cursor.
  hover('[data-tool-card]', (card) => {
    const ic = card.querySelector('.tool-icon');
    animate(ic, { transform: 'scale(1.14) rotate(-8deg)' }, { type: spring, stiffness: 420, damping: 14 });
    return () => animate(ic, { transform: 'none' }, { type: spring, stiffness: 300, damping: 18 });
  });
  $('#home-grid').addEventListener('pointermove', (e) => {
    const card = e.target.closest('[data-tool-card]');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });

  // Section headings, features and the Flutter band rise in when reached.
  inView('main > section:not(#hero) [data-reveal]:not([data-feature])', (el) => play(el, { opacity: [0, 1], transform: ['translateY(24px)', 'none'] }, SOFT));
  const features = $$('[data-feature]');
  if (features.length) inView(features[0].parentElement, () => play(features, { opacity: [0, 1], transform: ['translateY(32px) scale(.98)', 'none'] }, { ...SOFT, delay: stagger(0.12) }));

  // How it works: the line fills as you scroll and each step lights up when the line reaches it.
  const how = $('#how');
  const bar = $('#how-progress');
  steps.forEach((step) => inView(step, () => play(step, { opacity: [0, 1], transform: ['translateX(-16px)', 'none'] }, SOFT), { margin: '0px 0px -15% 0px' }));
  scroll((progress) => {
    bar.style.transform = `scaleY(${progress})`;
    steps.forEach((step, i) => { step.dataset.active = String(progress >= (i === 0 ? 0.02 : i / steps.length + 0.08)); });
  }, { target: how, offset: ['start 70%', 'end 55%'] });

  // Flutter band: its glow drifts as the band scrolls past.
  const band = $('#flutter-band');
  const orb = $('[data-parallax]');
  scroll((p) => { orb.style.transform = `translate3d(${-80 * p}px, ${-40 + 120 * p}px, 0)`; }, { target: band, offset: ['start end', 'end start'] });
}
