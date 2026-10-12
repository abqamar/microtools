import { $, $$, debounce, escapeText, loadVendor } from '../lib/core.js';

/* =========================================================
   Text diff checker (jsdiff)
   ========================================================= */
export function renderLineDiff(parts) {
  const CONTEXT = 3;
  const rows = [];
  for (const part of parts) {
    const lines = part.value.replace(/\n$/, '').split('\n');
    const kind = part.added ? 'add' : part.removed ? 'del' : 'same';
    lines.forEach((line) => rows.push({ kind, line }));
  }
  // Collapse long unchanged runs, keeping a few lines of context around each change.
  const html = [];
  for (let i = 0; i < rows.length;) {
    if (rows[i].kind !== 'same') {
      const r = rows[i++];
      const cls = r.kind === 'add' ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-800 dark:text-rose-300';
      html.push(`<div class="-mx-4 px-4 ${cls}">${r.kind === 'add' ? '+' : '-'} ${escapeText(r.line) || ' '}</div>`);
      continue;
    }
    let j = i;
    while (j < rows.length && rows[j].kind === 'same') j++;
    const run = rows.slice(i, j);
    const head = i === 0 ? 0 : CONTEXT, tail = j === rows.length ? 0 : CONTEXT;
    if (run.length > head + tail + 2) {
      run.slice(0, head).forEach((r) => html.push(`<div>  ${escapeText(r.line) || ' '}</div>`));
      html.push(`<div class="select-none text-zinc-400">  ⋯ ${run.length - head - tail} unchanged lines ⋯</div>`);
      run.slice(run.length - tail).forEach((r) => html.push(`<div>  ${escapeText(r.line) || ' '}</div>`));
    } else run.forEach((r) => html.push(`<div>  ${escapeText(r.line) || ' '}</div>`));
    i = j;
  }
  return html.join('');
}

export function renderInlineDiff(parts) {
  return parts.map((p) => {
    const text = escapeText(p.value);
    if (p.added) return `<ins class="rounded bg-emerald-500/25 text-emerald-800 no-underline dark:text-emerald-200">${text}</ins>`;
    if (p.removed) return `<del class="rounded bg-rose-500/25 text-rose-800 dark:text-rose-200">${text}</del>`;
    return text;
  }).join('');
}

export function initDiff() {
  const el = (id) => $(`#diff-${id}`);
  let mode = 'lines';
  let seq = 0;

  async function update() {
    const my = ++seq;
    const a = el('a').value, b = el('b').value;
    const status = el('status');
    if (!a && !b) { el('output').innerHTML = ''; status.dataset.state = 'idle'; status.textContent = 'Paste two texts to compare.'; return; }
    try { await loadVendor('diff'); } catch (e) { status.dataset.state = 'invalid'; status.textContent = e.message; return; }
    if (my !== seq) return;
    const ignore = el('ignore-ws').checked;
    const D = window.Diff;
    const parts = mode === 'lines' ? D.diffLines(a, b, { ignoreWhitespace: ignore })
      : mode === 'words' ? (ignore ? D.diffWords(a, b) : D.diffWordsWithSpace(a, b))
      : D.diffChars(a, b);
    const unit = mode === 'lines' ? 'line' : mode === 'words' ? 'word' : 'character';
    const count = (p) => (mode === 'lines' ? p.count || p.value.replace(/\n$/, '').split('\n').length : mode === 'words' ? p.value.split(/\s+/).filter(Boolean).length || 1 : p.value.length);
    const added = parts.filter((p) => p.added).reduce((n, p) => n + count(p), 0);
    const removed = parts.filter((p) => p.removed).reduce((n, p) => n + count(p), 0);
    el('output').innerHTML = mode === 'lines' ? renderLineDiff(parts) : renderInlineDiff(parts);
    status.dataset.state = 'valid';
    status.innerHTML = added || removed
      ? `<span><strong class="text-emerald-700 dark:text-emerald-400">+${added}</strong> <strong class="text-rose-700 dark:text-rose-400">−${removed}</strong> ${unit}${added + removed === 1 ? '' : 's'} changed</span>`
      : '<span><strong>No differences</strong> · the texts are identical' + (ignore ? ' (ignoring whitespace)' : '') + '.</span>';
  }

  $$('[data-diff-mode]').forEach((btn) => btn.addEventListener('click', () => {
    mode = btn.dataset.diffMode;
    $$('[data-diff-mode]').forEach((x) => x.setAttribute('aria-checked', String(x === btn)));
    update();
  }));
  $$('[data-diff-mode]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.diffMode === mode)));
  const later = debounce(update, 250);
  el('a').addEventListener('input', later);
  el('b').addEventListener('input', later);
  el('ignore-ws').addEventListener('change', update);
  el('swap').addEventListener('click', () => { [el('a').value, el('b').value] = [el('b').value, el('a').value]; update(); });
  el('sample').addEventListener('click', () => {
    el('a').value = 'name: microtools\nversion: 1.0.0\n\ndependencies:\n  http: ^1.1.0\n  provider: ^6.0.5\n  intl: ^0.18.0\n\nflutter:\n  uses-material-design: true\n';
    el('b').value = 'name: microtools\nversion: 1.1.0\n\ndependencies:\n  http: ^1.2.2\n  riverpod: ^2.5.1\n  intl: ^0.18.0\n\nflutter:\n  uses-material-design: true\n  generate: true\n';
    update();
  });
}
