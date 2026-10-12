import { $, debounce, escapeText, findJsonError, lineColAt, loadVendor } from '../lib/core.js';

/* =========================================================
   YAML ⇄ JSON (js-yaml)
   ========================================================= */
export function initYaml() {
  const el = (id) => $(`#yaml-${id}`);
  const status = el('status');
  const setStatus = (state, html) => { status.dataset.state = state; status.innerHTML = `<span>${html}</span>`; };
  const indent = () => Number(el('indent').value);

  async function yamlToJson() {
    const src = el('yaml').value;
    el('yaml').dataset.state = el('json').dataset.state = '';
    if (!src.trim()) { el('json').value = ''; setStatus('idle', 'Paste YAML or JSON to convert it.'); return; }
    try { await loadVendor('yaml'); } catch (e) { setStatus('invalid', escapeText(e.message)); return; }
    try {
      const data = window.jsyaml.load(src);
      el('json').value = JSON.stringify(data, null, indent()) ?? '';
      el('yaml').dataset.state = 'valid';
      setStatus('valid', '<strong>Valid YAML</strong> · converted to JSON');
    } catch (e) {
      el('yaml').dataset.state = 'invalid';
      const where = e.mark ? ` (line ${e.mark.line + 1}, column ${e.mark.column + 1})` : '';
      setStatus('invalid', `<strong>Invalid YAML</strong>${where}: ${escapeText(e.reason || e.message)}`);
    }
  }

  async function jsonToYaml() {
    const src = el('json').value;
    el('yaml').dataset.state = el('json').dataset.state = '';
    if (!src.trim()) { el('yaml').value = ''; setStatus('idle', 'Paste YAML or JSON to convert it.'); return; }
    let data;
    try { data = JSON.parse(src); } catch (nativeErr) {
      const err = findJsonError(src) || { pos: src.length, msg: nativeErr.message };
      const { line, col } = lineColAt(src, err.pos);
      el('json').dataset.state = 'invalid';
      setStatus('invalid', `<strong>Invalid JSON</strong> (line ${line}, column ${col}): ${escapeText(err.msg)}`);
      return;
    }
    try { await loadVendor('yaml'); } catch (e) { setStatus('invalid', escapeText(e.message)); return; }
    el('yaml').value = window.jsyaml.dump(data, { indent: indent(), lineWidth: -1, noRefs: true });
    el('json').dataset.state = 'valid';
    setStatus('valid', '<strong>Valid JSON</strong> · converted to YAML');
  }

  el('yaml').addEventListener('input', debounce(yamlToJson, 200));
  el('json').addEventListener('input', debounce(jsonToYaml, 200));
  el('indent').addEventListener('change', yamlToJson);
  el('sample').addEventListener('click', () => {
    el('yaml').value = 'name: my_app\ndescription: A new Flutter project.\nversion: 1.0.0+1\n\nenvironment:\n  sdk: ">=3.4.0 <4.0.0"\n\ndependencies:\n  flutter:\n    sdk: flutter\n  http: ^1.2.2\n  provider: ^6.1.2\n\nflutter:\n  uses-material-design: true\n  assets:\n    - assets/images/\n    - assets/icons/\n';
    yamlToJson();
  });
}
