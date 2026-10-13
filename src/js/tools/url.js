import { $, debounce, escapeText } from '../lib/core.js';

/* =========================================================
   URL encoder, decoder & parser
   ========================================================= */
export function initUrl() {
  const el = (id) => $(`#url-${id}`);
  const showError = (id, msg) => { el(id).textContent = msg || ''; el(id).classList.toggle('hidden', !msg); };

  const encode = () => {
    const fn = el('enc-mode').value === 'full' ? encodeURI : encodeURIComponent;
    try { el('encoded').value = fn(el('plain').value); showError('enc-error'); el('encoded').dataset.state = ''; }
    catch { showError('enc-error', 'The text contains an unpaired surrogate character and cannot be encoded.'); }
  };
  const decode = () => {
    const fn = el('enc-mode').value === 'full' ? decodeURI : decodeURIComponent;
    try { el('plain').value = fn(el('encoded').value); showError('enc-error'); el('encoded').dataset.state = ''; }
    catch { showError('enc-error', 'Malformed percent-encoding: every % must be followed by two hex digits forming valid UTF-8.'); el('encoded').dataset.state = 'invalid'; }
  };
  el('plain').addEventListener('input', encode);
  el('encoded').addEventListener('input', decode);
  el('enc-mode').addEventListener('change', encode);

  let url = null;
  let params = [];

  function rebuild() {
    if (!url) { el('rebuilt').textContent = ''; return; }
    const u = new URL(url.href);
    u.search = new URLSearchParams(params.filter((p) => p.key !== '' || p.value !== '').map((p) => [p.key, p.value])).toString();
    el('rebuilt').textContent = u.href;
  }

  function renderParams() {
    const box = el('params');
    box.innerHTML = '';
    if (!params.length) { box.innerHTML = '<p class="text-sm text-zinc-400">No query parameters.</p>'; return; }
    params.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'flex gap-2';
      row.innerHTML = '<input type="text" spellcheck="false" class="field w-2/5 font-mono" aria-label="Parameter name"><input type="text" spellcheck="false" class="field flex-1 font-mono" aria-label="Parameter value"><button type="button" class="chip" aria-label="Remove parameter"><svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>';
      const [k, v, del] = row.children;
      k.value = p.key; v.value = p.value;
      k.addEventListener('input', () => { p.key = k.value; rebuild(); });
      v.addEventListener('input', () => { p.value = v.value; rebuild(); });
      del.addEventListener('click', () => { params.splice(i, 1); renderParams(); rebuild(); });
      box.appendChild(row);
    });
  }

  function parse() {
    const raw = el('input').value.trim();
    showError('parse-error');
    el('parts').innerHTML = '';
    url = null;
    params = [];
    if (raw) {
      try { url = new URL(raw); } catch {
        try { url = new URL(`https://${raw}`); showError('parse-error', 'No scheme given, so https:// was assumed.'); }
        catch { showError('parse-error', 'This is not a valid URL.'); }
      }
    }
    if (url) {
      const part = (label, value) => `<div class="stat"><dt>${label}</dt><dd class="whitespace-normal break-all">${escapeText(value) || '<span class="text-zinc-400">—</span>'}</dd></div>`;
      el('parts').innerHTML = [
        part('Protocol', url.protocol), part('Host', url.hostname), part('Port', url.port || `${url.protocol === 'https:' ? '443' : url.protocol === 'http:' ? '80' : ''} (default)`),
        part('Path', decodeURIComponentSafe(url.pathname)), part('Fragment', decodeURIComponentSafe(url.hash)), part('Origin', url.origin),
        ...(url.username ? [part('Username', url.username)] : [])
      ].join('');
      params = [...url.searchParams].map(([key, value]) => ({ key, value }));
    }
    renderParams();
    rebuild();
  }

  el('input').addEventListener('input', debounce(parse, 150));
  el('add-param').addEventListener('click', () => { if (!url) return; params.push({ key: '', value: '' }); renderParams(); rebuild(); el('params').querySelector('div:last-child input').focus(); });
  el('input').value = 'https://example.com/search?q=flutter%20widgets&page=2&lang=en#results';
  el('plain').value = 'name=Ada Lovelace&city=Zürich';
  encode();
  parse();
}

export function decodeURIComponentSafe(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}
