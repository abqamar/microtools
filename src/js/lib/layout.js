// Behaviour shared by every page: theme, copy buttons, quick search (⌘K), mobile menu, sidebar filter and ads.
import { CATALOG, CATEGORY_NAMES } from '../generated/catalog.js';
import { $, $$, escapeText, hydrateCopyButtons, initAds, initCopyButtons, initTheme } from './core.js';

// Relative path from the current page to the site root ('' or '../'), set by the build on <html data-root>.
const ROOT = document.documentElement.dataset.root || '';
export const toolUrl = (slug) => `${ROOT}tools/${slug}.html`;
export const iconSvg = (d, cls = 'h-5 w-5') =>
  `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="${d}"/></svg>`;

/** Tools matching every word of `query` (name, summary, keywords, category), best name matches first. */
export function searchTools(query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return CATALOG.slice();
  return CATALOG
    .map((t) => {
      const name = t.name.toLowerCase();
      const hay = `${name} ${t.summary} ${t.keywords} ${CATEGORY_NAMES[t.category]}`.toLowerCase();
      if (!terms.every((w) => hay.includes(w))) return null;
      return { t, score: terms.reduce((s, w) => s + (name.startsWith(w) ? 3 : name.includes(w) ? 2 : 1), 0) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);
}

const isTyping = () => {
  const a = document.activeElement;
  return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
};

function initPalette() {
  const dialog = $('#palette');
  if (!dialog) return;
  const input = $('#palette-input');
  const list = $('#palette-list');
  let items = [], index = 0, lastFocus = null;

  const setIndex = (i) => {
    index = i;
    $$('[data-index]', list).forEach((li) => li.setAttribute('aria-selected', String(Number(li.dataset.index) === index)));
    input.setAttribute('aria-activedescendant', items.length ? `palette-opt-${index}` : '');
    const active = $(`#palette-opt-${index}`);
    if (active) active.scrollIntoView({ block: 'nearest' });
  };

  function render() {
    items = searchTools(input.value).slice(0, 8);
    list.innerHTML = items.length
      ? items.map((t, i) => `
        <li role="option" id="palette-opt-${i}" class="palette-item" data-index="${i}" aria-selected="false">
          <span class="tool-icon h-8 w-8 rounded-lg">${iconSvg(t.icon, 'h-4 w-4')}</span>
          <span class="min-w-0 flex-1"><span class="block font-medium">${escapeText(t.name)}</span><span class="block truncate text-xs text-zinc-500 dark:text-zinc-400">${escapeText(t.summary)}</span></span>
          <span class="hidden text-[11px] text-zinc-400 sm:block">${escapeText(CATEGORY_NAMES[t.category])}</span>
        </li>`).join('')
      : '<li class="px-3 py-10 text-center text-sm text-zinc-500">No tools match your search.</li>';
    setIndex(0);
  }

  function open() {
    lastFocus = document.activeElement;
    dialog.hidden = false;
    document.body.style.overflow = 'hidden';
    input.value = '';
    render();
    input.focus();
  }
  function close() {
    dialog.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  const go = (i) => { if (items[i]) location.href = toolUrl(items[i].slug); };

  document.addEventListener('keydown', (e) => {
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (dialog.hidden) open(); else close(); return; }
    if (e.key === '/' && dialog.hidden && !isTyping() && !$('#home-search')) { e.preventDefault(); open(); return; }
    if (dialog.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) setIndex((index + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) setIndex((index - 1 + items.length) % items.length); }
    else if (e.key === 'Enter') { e.preventDefault(); go(index); }
  });
  input.addEventListener('input', render);
  list.addEventListener('click', (e) => { const li = e.target.closest('[data-index]'); if (li) go(Number(li.dataset.index)); });
  list.addEventListener('mousemove', (e) => { const li = e.target.closest('[data-index]'); if (li && Number(li.dataset.index) !== index) setIndex(Number(li.dataset.index)); });
  dialog.addEventListener('mousedown', (e) => { if (e.target === dialog) close(); });
  $$('[data-palette-open]').forEach((b) => b.addEventListener('click', open));
}

function initMenu() {
  const menu = $('#mobile-menu');
  const toggle = $('#menu-toggle');
  if (!menu || !toggle) return;
  const set = (open) => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => set(menu.hidden));
  menu.addEventListener('click', (e) => { if (e.target === menu || e.target.closest('a,[data-menu-close]')) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) set(false); });
}

function initSidebar() {
  const nav = $('#side-nav');
  if (!nav) return;
  const current = $('[aria-current="page"]', nav);
  if (current) nav.scrollTop = Math.max(0, current.offsetTop - nav.clientHeight / 2); // keep the open tool visible
  const filter = $('#side-filter');
  if (!filter) return;
  filter.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase();
    $$('[data-side-group]', nav).forEach((group) => {
      let visible = 0;
      $$('.side-link', group).forEach((a) => {
        const show = !q || a.dataset.search.includes(q);
        a.hidden = !show;
        if (show) visible++;
      });
      group.hidden = visible === 0;
    });
  });
}

export function bootPage() {
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
  hydrateCopyButtons();
  initCopyButtons();
  initTheme();
  initPalette();
  initMenu();
  initSidebar();
  initAds();
}
