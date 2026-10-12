import { $, $$, clamp, debounce } from '../lib/core.js';

/* =========================================================
   4. UUID generator
   ========================================================= */
export function uuidv4() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function initUuid() {
  const countEl = $('#uuid-count');
  const upperEl = $('#uuid-upper');
  const hyphensEl = $('#uuid-hyphens');
  const out = $('#uuid-output');
  const summary = $('#uuid-summary');
  let uuids = [];

  function render() {
    out.value = uuids.map((u) => {
      let s = hyphensEl.checked ? u : u.replace(/-/g, '');
      return upperEl.checked ? s.toUpperCase() : s;
    }).join('\n');
    summary.textContent = `${uuids.length} UUID${uuids.length === 1 ? '' : 's'}`;
  }

  function generate() {
    const n = clamp(parseInt(countEl.value, 10) || 1, 1, 1000);
    uuids = Array.from({ length: n }, uuidv4);
    render();
  }

  countEl.addEventListener('input', debounce(generate, 150));
  countEl.addEventListener('change', () => { countEl.value = clamp(parseInt(countEl.value, 10) || 1, 1, 1000); generate(); });
  upperEl.addEventListener('change', render);
  hyphensEl.addEventListener('change', render);
  $('#uuid-generate').addEventListener('click', generate);
  $$('[data-uuid-count]').forEach((b) => b.addEventListener('click', () => { countEl.value = b.dataset.uuidCount; generate(); }));
  generate();
}
