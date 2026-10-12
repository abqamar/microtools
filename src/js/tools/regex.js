import { $, $$, debounce, escapeText } from '../lib/core.js';

/* =========================================================
   Regex tester (runs in a Web Worker so a runaway pattern can be stopped)
   ========================================================= */
export const REGEX_WORKER_SRC = `
self.onmessage = (e) => {
  const { id, pattern, flags, text, replacement } = e.data;
  try {
    const re = new RegExp(pattern, flags);
    const matches = [];
    const pack = (m) => ({ index: m.index, text: m[0], groups: m.slice(1), named: m.groups ? { ...m.groups } : null });
    let truncated = false;
    if (re.global || re.sticky) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        if (matches.length >= 1000) { truncated = true; break; }
        matches.push(pack(m));
        if (m[0] === '') re.lastIndex = m.index + 1; // avoid an endless loop on empty matches
      }
    } else {
      const m = re.exec(text);
      if (m) matches.push(pack(m));
    }
    self.postMessage({ id, ok: true, matches, truncated, replaced: text.replace(re, replacement) });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err.message });
  }
};`;

export function initRegex() {
  const el = (id) => $(`#regex-${id}`);
  let worker = null, timer = null, reqId = 0;
  const setStatus = (state, html) => { el('status').dataset.state = state; el('status').innerHTML = `<span>${html}</span>`; };

  function getWorker() {
    if (!worker) {
      try { worker = new Worker(URL.createObjectURL(new Blob([REGEX_WORKER_SRC], { type: 'text/javascript' }))); }
      catch { worker = false; } // no workers (e.g. blocked); fall back to the main thread
      if (worker) worker.onmessage = (e) => { if (e.data.id === reqId) { clearTimeout(timer); show(e.data); } };
    }
    return worker;
  }

  function show(res) {
    const text = el('text').value;
    if (!res.ok) {
      el('pattern').dataset.state = 'invalid';
      setStatus('invalid', `<strong>Invalid pattern</strong>: ${escapeText(res.error)}`);
      el('highlight').textContent = text; el('groups').innerHTML = ''; el('replaced').textContent = '';
      return;
    }
    el('pattern').dataset.state = res.matches.length ? 'valid' : '';
    let html = '', last = 0;
    res.matches.forEach((m, i) => {
      if (m.index < last) return;
      html += escapeText(text.slice(last, m.index));
      html += `<mark class="rounded px-0.5 text-inherit ${i % 2 ? 'bg-sky-300/60 dark:bg-sky-400/30' : 'bg-amber-300/70 dark:bg-amber-400/30'}">${escapeText(m.text) || '<span class="opacity-60">∅</span>'}</mark>`;
      last = m.index + m.text.length;
    });
    el('highlight').innerHTML = html + escapeText(text.slice(last));
    const groupCount = Math.max(0, ...res.matches.map((m) => m.groups.length));
    const names = [...new Set(res.matches.flatMap((m) => (m.named ? Object.keys(m.named) : [])))];
    el('groups').innerHTML = res.matches.length ? `
      <table class="w-full text-left font-mono text-xs">
        <thead class="text-zinc-500"><tr><th class="py-1 pr-3">#</th><th class="py-1 pr-3">Index</th><th class="py-1 pr-3">Match</th>${Array.from({ length: groupCount }, (_, g) => `<th class="py-1 pr-3">$${g + 1}</th>`).join('')}${names.map((n) => `<th class="py-1 pr-3">&lt;${escapeText(n)}&gt;</th>`).join('')}</tr></thead>
        <tbody>${res.matches.slice(0, 200).map((m, i) => `<tr class="border-t border-zinc-200 dark:border-zinc-800"><td class="py-1 pr-3 text-zinc-400">${i + 1}</td><td class="py-1 pr-3">${m.index}</td><td class="py-1 pr-3">${escapeText(m.text)}</td>${Array.from({ length: groupCount }, (_, g) => `<td class="py-1 pr-3">${m.groups[g] === undefined || m.groups[g] === null ? '<span class="text-zinc-400">—</span>' : escapeText(m.groups[g])}</td>`).join('')}${names.map((n) => `<td class="py-1 pr-3">${m.named && m.named[n] != null ? escapeText(m.named[n]) : '<span class="text-zinc-400">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>` : '';
    el('replaced').textContent = res.replaced;
    setStatus(res.matches.length ? 'valid' : 'idle', res.matches.length
      ? `<strong>${res.matches.length}${res.truncated ? '+' : ''} match${res.matches.length === 1 ? '' : 'es'}</strong>${res.truncated ? ' (showing the first 1,000)' : ''}`
      : 'No matches.');
  }

  function run() {
    const flags = $$('[data-regex-flag]').filter((b) => b.checked).map((b) => b.dataset.regexFlag).join('');
    const msg = { id: ++reqId, pattern: el('pattern').value, flags, text: el('text').value, replacement: el('replace').value };
    const w = getWorker();
    if (!w) { // main-thread fallback
      try {
        const re = new RegExp(msg.pattern, msg.flags);
        const matches = [];
        if (re.global) { for (const m of msg.text.matchAll(re)) { matches.push({ index: m.index, text: m[0], groups: m.slice(1), named: m.groups || null }); if (matches.length >= 1000) break; } }
        else { const m = re.exec(msg.text); if (m) matches.push({ index: m.index, text: m[0], groups: m.slice(1), named: m.groups || null }); }
        show({ ok: true, matches, truncated: matches.length >= 1000, replaced: msg.text.replace(re, msg.replacement) });
      } catch (e) { show({ ok: false, error: e.message }); }
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      // Catastrophic backtracking: stop the worker and start a fresh one next time.
      worker.terminate(); worker = null;
      el('pattern').dataset.state = 'invalid';
      setStatus('invalid', '<strong>Stopped after 2 seconds.</strong> This pattern backtracks too much on this text (catastrophic backtracking). Make nested quantifiers like (a+)+ more specific.');
    }, 2000);
    w.postMessage(msg);
  }

  const later = debounce(run, 200);
  ['pattern', 'text', 'replace'].forEach((id) => el(id).addEventListener('input', later));
  $$('[data-regex-flag]').forEach((b) => b.addEventListener('change', run));
  run();
}
