// Home page: live search and category filter over the tool grid.
import { $, $$ } from '../lib/core.js';
import { bootPage, searchTools } from '../lib/layout.js';

bootPage();

const search = $('#home-search');
const cards = $$('[data-tool-card]');
const chips = $$('[data-cat]');
const empty = $('#home-empty');
const fromHash = () => (location.hash.match(/^#category=([a-z]+)$/) || [])[1];
let category = chips.some((c) => c.dataset.cat === fromHash()) ? fromHash() : 'all';

function apply() {
  const matches = new Set(searchTools(search.value).map((t) => t.slug));
  let shown = 0;
  for (const card of cards) {
    const show = matches.has(card.dataset.toolCard) && (category === 'all' || card.dataset.category === category);
    card.hidden = !show;
    if (show) shown++;
  }
  chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === category)));
  empty.hidden = shown > 0;
}

search.addEventListener('input', apply);
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
