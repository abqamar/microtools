
/* =========================================================
   Utilities
   ========================================================= */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const escapeText = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
export const debounce = (fn, ms) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const pad = (n, len = 2) => String(n).padStart(len, '0');
export const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } }
};
export const announce = (msg) => { const el = $('#sr-announcer'); el.textContent = ''; requestAnimationFrame(() => { el.textContent = msg; }); };
export const formatBytes = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;

/** Unbiased secure random integer in [0, max). */
export function secureRandomInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let x;
  do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
  return x % max;
}

/* =========================================================
   Vendored libraries (loaded on first use, served from this site)
   ========================================================= */
// Resolves to …/assets/ whether the page is index.html or flutter/index.html.
export const ASSET_BASE = document.currentScript ? document.currentScript.src.replace(/js\/.*$/, '') : 'assets/';
export const vendorPromises = {};

/** Loads assets/js/vendor/{name}.js once; resolves when its global is ready. */
export function loadVendor(name) {
  if (!vendorPromises[name]) {
    vendorPromises[name] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${ASSET_BASE}js/vendor/${name}.js`;
      s.onload = resolve;
      s.onerror = () => { delete vendorPromises[name]; reject(new Error(`Could not load the ${name} library.`)); };
      document.head.appendChild(s);
    });
  }
  return vendorPromises[name];
}

/* =========================================================
   Clipboard
   ========================================================= */
export const COPY_ICON = '<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/></svg>';

export function hydrateCopyButtons(root = document) {
  $$('button[data-copy]', root).forEach((btn) => {
    if (btn.dataset.hydrated) return;
    const label = btn.dataset.copyLabel || 'Copy';
    btn.classList.add('copy-btn');
    btn.innerHTML = `${COPY_ICON}<span data-label="${label}">${label}</span>`;
    btn.dataset.hydrated = '1';
  });
}

export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

export function flashButton(btn, message, ok) {
  const label = btn.querySelector('[data-label]');
  if (!label) return;
  clearTimeout(btn._flashTimer);
  label.textContent = message;
  btn.dataset.copied = String(ok);
  btn._flashTimer = setTimeout(() => {
    label.textContent = label.dataset.label;
    delete btn.dataset.copied;
  }, 1400);
}

export function initCopyButtons() {
  document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-copy]');
  if (!btn) return;
  const src = $(btn.dataset.copy);
  if (!src) return;
  const text = src.dataset.raw !== undefined ? src.dataset.raw : ('value' in src ? src.value : src.textContent);
  if (!text || !text.trim()) { flashButton(btn, 'Empty', false); return; }
  const ok = await copyText(text);
  flashButton(btn, ok ? 'Copied!' : 'Failed', ok);
  announce(ok ? 'Copied to clipboard' : 'Copy failed');
  });
}

/* =========================================================
   Theme
   ========================================================= */
export function initTheme() {
  $('#theme-toggle').addEventListener('click', () => {
    const dark = document.documentElement.classList.toggle('dark');
    store.set('mt-theme', dark ? 'dark' : 'light');
    $('meta[name="theme-color"]').setAttribute('content', dark ? '#0A0F1E' : '#F6F8FC');
  });
}

/* =========================================================
   JSON parsing helpers (shared by the JSON and Dart tools)
   ========================================================= */
/** Locates the first syntax error in `src`. Returns { pos, msg } or null if valid. */
export function findJsonError(src) {
  let i = 0;
  const fail = (msg, at = i) => { throw { pos: at, msg }; };
  const ws = () => { while (i < src.length && (src[i] === ' ' || src[i] === '\t' || src[i] === '\n' || src[i] === '\r')) i++; };
  const found = () => (i >= src.length ? 'end of input' : `'${src[i]}'`);

  function value() {
    ws();
    const c = src[i];
    if (c === '{') return object();
    if (c === '[') return array();
    if (c === '"') return string();
    if (c === '-' || (c >= '0' && c <= '9')) return number();
    for (const lit of ['true', 'false', 'null']) if (src.startsWith(lit, i)) { i += lit.length; return; }
    if (c === "'") fail('Strings must use double quotes, not single quotes');
    fail(`Unexpected ${found()} — expected a value`);
  }
  function object() {
    i++; ws();
    if (src[i] === '}') { i++; return; }
    for (;;) {
      ws();
      if (src[i] === '}') fail("Trailing comma before '}' is not allowed");
      if (src[i] === "'") fail('Property names must use double quotes, not single quotes');
      if (src[i] !== '"') fail(`Expected a double-quoted property name, found ${found()}`);
      string(); ws();
      if (src[i] !== ':') fail(`Expected ':' after property name, found ${found()}`);
      i++; value(); ws();
      if (src[i] === ',') { i++; continue; }
      if (src[i] === '}') { i++; return; }
      fail(`Expected ',' or '}' after property value, found ${found()}`);
    }
  }
  function array() {
    i++; ws();
    if (src[i] === ']') { i++; return; }
    for (;;) {
      ws();
      if (src[i] === ']') fail("Trailing comma before ']' is not allowed");
      value(); ws();
      if (src[i] === ',') { i++; continue; }
      if (src[i] === ']') { i++; return; }
      fail(`Expected ',' or ']' after array element, found ${found()}`);
    }
  }
  function string() {
    const start = i++;
    while (i < src.length) {
      const c = src[i];
      if (c === '"') { i++; return; }
      if (c === '\\') {
        const n = src[i + 1];
        if (n === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(src.substr(i + 2, 4))) fail('Invalid unicode escape — expected \\u followed by 4 hex digits');
          i += 6; continue;
        }
        if (n === undefined || !'"\\/bfnrt'.includes(n)) fail(`Invalid escape sequence '\\${n ?? ''}'`);
        i += 2; continue;
      }
      if (c < ' ') fail(c === '\n' ? 'Unterminated string — line breaks must be escaped as \\n' : 'Unescaped control character in string');
      i++;
    }
    fail('Unterminated string', start);
  }
  function number() {
    const re = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
    re.lastIndex = i;
    if (!re.exec(src)) fail('Invalid number');
    i = re.lastIndex;
  }

  try {
    value(); ws();
    if (i < src.length) fail(`Unexpected ${found()} after the end of the JSON value`);
    return null;
  } catch (e) {
    if (e && typeof e.pos === 'number') return e;
    return { pos: 0, msg: 'Input is too deeply nested to analyse' };
  }
}

export function highlightJson(json) {
  return escapeText(json).replace(
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = 'j-num';
      if (m[0] === '"') cls = m.endsWith(':') ? 'j-key' : 'j-str';
      else if (m === 'true' || m === 'false') cls = 'j-bool';
      else if (m === 'null') cls = 'j-null';
      return `<span class="${cls}">${m}</span>`;
    }
  );
}

export function lineColAt(src, pos) {
  const before = src.slice(0, pos);
  const line = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');
  return { line, col };
}

export function renderJsonErrorSnippet(src, pos) {
  const { line, col } = lineColAt(src, pos);
  const lines = src.split('\n');
  const from = Math.max(0, line - 4);
  const to = Math.min(lines.length, line + 2);
  const width = String(to).length;
  const WINDOW = 100;
  let html = '';
  for (let n = from; n < to; n++) {
    let text = lines[n];
    let caretCol = col;
    if (n === line - 1 && text.length > WINDOW) {
      // Keep very long (e.g. minified) lines readable by windowing around the error.
      const start = Math.max(0, col - 1 - WINDOW / 2);
      const prefix = start > 0 ? '…' : '';
      text = prefix + text.slice(start, start + WINDOW) + (start + WINDOW < lines[n].length ? '…' : '');
      caretCol = col - start + prefix.length;
    } else if (text.length > WINDOW) {
      text = text.slice(0, WINDOW) + '…';
    }
    const num = `<span class="ln">${String(n + 1).padStart(width)}</span>`;
    if (n === line - 1) {
      html += `<div class="json-err-line">${num}${escapeText(text) || ' '}</div>`;
      const caretPad = text.slice(0, caretCol - 1).replace(/[^\t]/g, ' ');
      html += `<div class="json-caret"><span class="ln">${' '.repeat(width)}</span>${caretPad}^</div>`;
    } else {
      html += `<div>${num}${escapeText(text) || ' '}</div>`;
    }
  }
  return html;
}

/* =========================================================
   Word splitting (shared by the Case and Dart tools)
   ========================================================= */
export function splitWords(line) {
  return line
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/* =========================================================
   Google AdSense
   ========================================================= */
export function initAds() {
  $$('ins.adsbygoogle').forEach((ins) => {
    // Skip until a real publisher ID replaces the placeholder.
    if (!ins.dataset.adClient || ins.dataset.adClient.includes('XXXX') || ins.dataset.adsbygoogleStatus) return;
    // Slots hidden at this screen size (e.g. the right rail on mobile) have no width; AdSense would error on them.
    if (!ins.offsetWidth) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* ad blocked or not approved */ }
  });
}
