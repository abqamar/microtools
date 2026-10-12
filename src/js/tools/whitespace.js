import { $, $$, escapeText } from '../lib/core.js';

/* =========================================================
   Whitespace remover
   ========================================================= */
export const WS_PATTERNS = {
  spaces: { label: 'space', re: / /g },
  tabs: { label: 'tab', re: /\t/g },
  breaks: { label: 'line break', re: /\r\n|[\n\r\u2028\u2029]/g }, // \r\n counts as one break
  // Non-breaking and other Unicode spaces, zero-width characters, BOM, vertical tab and form feed.
  invisible: { label: 'invisible character', re: /[\u00a0\u1680\u2000-\u200d\u202f\u205f\u2060\u3000\ufeff\v\f]/g }
};

/** Removes the selected whitespace kinds. Returns the cleaned text and how many of each kind were removed. */
export function removeWhitespace(text, kinds) {
  const counts = {};
  let out = text;
  for (const kind of kinds) {
    const { re } = WS_PATTERNS[kind];
    counts[kind] = (out.match(re) || []).length;
    out = out.replace(re, '');
  }
  return { text: out, counts };
}

export function initWhitespace() {
  const input = $('#ws-input');
  const output = $('#ws-output');
  const status = $('#ws-status');
  const boxes = $$('[data-ws]');
  const SAMPLE = 'MIIEvQIBADANBgkqhkiG\n9w0BAQEFAASCBKcwggSjAgEAAoIBAQDAwFTq3RqQ bw3p\npOgzm6I6EzBARXfHXkwI9/\nSceNthiJqhMTGrpauN Ao4QQ68/FU7C4DAyOjqTBDt2\nQSWVouM1jbhLqXFlJXQU9235F+hNk8KQpCAML2wq9+\nEmVMCGC1 EedbFVblCb/fQ5';

  function update() {
    const text = input.value;
    const kinds = boxes.filter((b) => b.checked).map((b) => b.dataset.ws);
    const { text: cleaned, counts } = removeWhitespace(text, kinds);
    output.value = cleaned;
    $('#ws-in-stats').textContent = text ? `${text.length.toLocaleString()} chars` : '';
    $('#ws-out-stats').textContent = text ? `· ${cleaned.length.toLocaleString()} chars` : '';
    if (!text) { status.dataset.state = 'idle'; status.textContent = 'Paste text to clean it.'; return; }
    const parts = kinds.filter((k) => counts[k]).map((k) => `${counts[k].toLocaleString()} ${WS_PATTERNS[k].label}${counts[k] === 1 ? '' : 's'}`);
    status.dataset.state = 'valid';
    status.innerHTML = parts.length
      ? `<span><strong>Removed ${(text.length - cleaned.length).toLocaleString()} characters</strong> · ${escapeText(parts.join(', '))}</span>`
      : '<span><strong>Nothing to remove</strong> · no selected whitespace found.</span>';
  }

  input.addEventListener('input', update);
  boxes.forEach((b) => b.addEventListener('change', update));
  $('#ws-sample').addEventListener('click', () => { input.value = SAMPLE; update(); });
  $('#ws-clear').addEventListener('click', () => { input.value = ''; update(); input.focus(); });
  update();
}
