import { $, hydrateCopyButtons, splitWords } from '../lib/core.js';

/* =========================================================
   8. Case converter
   ========================================================= */
export const CASES = [
  { id: 'upper', label: 'UPPERCASE', fn: (s) => s.toUpperCase() },
  { id: 'lower', label: 'lowercase', fn: (s) => s.toLowerCase() },
  { id: 'title', label: 'Title Case', fn: (s) => s.toLowerCase().replace(/(^|[\s\-–—_(\[{"'“‘/])(\p{L})/gu, (m, p, c) => p + c.toUpperCase()) },
  {
    id: 'camel', label: 'camelCase',
    fn: (s) => s.split('\n').map((line) => splitWords(line)
      .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
      .join('')).join('\n')
  },
  {
    id: 'sentence', label: 'Sentence case',
    fn: (s) => s.toLowerCase()
      .replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (m, p, c) => p + c.toUpperCase())
      .replace(/\bi\b/g, 'I')
  }
];

export function initCase() {
  const input = $('#case-input');
  const stats = $('#case-stats');
  const container = $('#case-outputs');

  container.innerHTML = CASES.map((c) => `
    <div class="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800 ${c.id === 'sentence' ? 'md:col-span-2' : ''}">
      <div class="mb-2 flex items-center justify-between gap-2">
        <span class="text-xs font-semibold text-zinc-500 dark:text-zinc-400">${c.label}</span>
        <button type="button" data-copy="#case-${c.id}"></button>
      </div>
      <div id="case-${c.id}" class="max-h-48 min-h-[1.5rem] overflow-auto whitespace-pre-wrap break-words font-mono text-sm text-zinc-800 dark:text-zinc-200"></div>
    </div>`).join('');
  hydrateCopyButtons(container);

  function update() {
    const text = input.value;
    CASES.forEach((c) => { $(`#case-${c.id}`).textContent = text ? c.fn(text) : ''; });
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text ? text.split('\n').length : 0;
    stats.textContent = `${text.length} chars · ${words} words · ${lines} lines`;
  }

  input.addEventListener('input', update);
  update();
}
