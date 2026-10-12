import { $, debounce, escapeText, findJsonError, formatBytes, highlightJson, lineColAt, renderJsonErrorSnippet, store } from '../lib/core.js';

/* =========================================================
   2. JSON validator & formatter
   ========================================================= */
export function initJson() {
  const input = $('#json-input');
  const output = $('#json-output');
  const indentSel = $('#json-indent');
  const status = $('#json-status');
  const statusText = $('#json-status-text');
  const gotoBtn = $('#json-goto');
  let errorPos = null;

  const SAMPLE = '{"name":"MicroTools","version":2,"private":true,"rating":4.9,"tags":["json","formatter","validator"],"author":{"name":"Ada Lovelace","email":null},"features":[{"id":1,"enabled":true},{"id":2,"enabled":false}]}';

  function process() {
    const src = input.value;
    errorPos = null;
    gotoBtn.classList.add('hidden');

    if (!src.trim()) {
      status.dataset.state = 'idle';
      input.dataset.state = '';
      statusText.textContent = 'Paste or type JSON to validate it.';
      output.innerHTML = '';
      output.dataset.raw = '';
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(src);
    } catch (nativeErr) {
      const err = findJsonError(src) || { pos: src.length, msg: nativeErr.message };
      const { line, col } = lineColAt(src, err.pos);
      errorPos = err.pos;
      status.dataset.state = 'invalid';
      input.dataset.state = 'invalid';
      statusText.innerHTML = `<strong>Invalid JSON</strong> — ${escapeText(err.msg)} <span class="whitespace-nowrap font-mono text-xs opacity-80">(line ${line}, column ${col})</span>`;
      gotoBtn.classList.remove('hidden');
      output.innerHTML = renderJsonErrorSnippet(src, err.pos);
      output.dataset.raw = '';
      return;
    }

    const mode = indentSel.value;
    const indent = mode === 'min' ? undefined : mode === 'tab' ? '\t' : Number(mode);
    const pretty = JSON.stringify(parsed, null, indent);
    const type = Array.isArray(parsed) ? `array · ${parsed.length} item${parsed.length === 1 ? '' : 's'}`
      : parsed !== null && typeof parsed === 'object' ? `object · ${Object.keys(parsed).length} key${Object.keys(parsed).length === 1 ? '' : 's'}`
      : typeof parsed;
    status.dataset.state = 'valid';
    input.dataset.state = 'valid';
    statusText.innerHTML = `<strong>Valid JSON</strong> <span class="font-mono text-xs opacity-80">${type} · ${formatBytes(new Blob([pretty]).size)}</span>`;
    output.innerHTML = highlightJson(pretty);
    output.dataset.raw = pretty;
  }

  const processDebounced = debounce(process, 120);
  input.addEventListener('input', processDebounced);
  indentSel.addEventListener('change', () => { store.set('mt-json-indent', indentSel.value); process(); });
  $('#json-sample').addEventListener('click', () => { input.value = SAMPLE; process(); });
  $('#json-clear').addEventListener('click', () => { input.value = ''; process(); input.focus(); });
  gotoBtn.addEventListener('click', () => {
    if (errorPos === null) return;
    const { line } = lineColAt(input.value, errorPos);
    input.focus();
    input.setSelectionRange(errorPos, Math.min(errorPos + 1, input.value.length));
    const lh = parseFloat(getComputedStyle(input).lineHeight) || 24;
    input.scrollTop = Math.max(0, (line - 4) * lh);
  });
  // Tab key inserts indentation inside the editor
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    const { selectionStart: s, selectionEnd: end } = input;
    input.setRangeText('  ', s, end, 'end');
    processDebounced();
  });

  const savedIndent = store.get('mt-json-indent');
  if (savedIndent && [...indentSel.options].some((o) => o.value === savedIndent)) indentSel.value = savedIndent;
  process();
}
