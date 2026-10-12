import { downloadBlob, makeZip } from '../lib/binary.js';
import { $, $$, debounce, escapeText, highlightJson } from '../lib/core.js';
import { DART_RESERVED, dartFieldName } from './dart.js';

/* =========================================================
   ARB localization converter
   ========================================================= */
/** RFC 4180 CSV parser. Detects comma, semicolon (European Excel) or tab delimiters. */
export function parseCsv(text) {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0];
  const delim = [',', ';', '\t'].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ',');
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"' && field === '') inQuotes = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export const csvField = (v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Placeholders gen-l10n needs declared: top-level {name} and ICU {name, plural|select|…}. */
export function arbPlaceholders(message) {
  const out = {};
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    const c = message[i];
    if (c === '{') {
      if (depth === 0) {
        const m = message.slice(i).match(/^\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:,\s*([a-z]+))?/);
        if (m && !out[m[1]]) {
          const kind = m[2];
          out[m[1]] = kind === 'plural' || kind === 'selectordinal' ? { type: 'int' }
            : kind === 'number' ? { type: 'num' }
            : kind === 'date' ? { type: 'DateTime', format: 'yMd' }
            : { type: 'String' };
        }
      }
      depth++;
    } else if (c === '}') depth = Math.max(0, depth - 1);
  }
  return out;
}

export const ARB_KEY = /^[a-z][A-Za-z0-9_]*$/;
export const LOCALE_RE = /^[a-z]{2,3}([_-][A-Za-z0-9]{2,8})*$/;

export function buildArb(locale, entries, isTemplate) {
  const arb = { '@@locale': locale };
  for (const { key, value, description } of entries) {
    if (value === undefined || value === '') continue;
    arb[key] = value;
    if (isTemplate) {
      const meta = {};
      if (description) meta.description = description;
      const ph = arbPlaceholders(value);
      if (Object.keys(ph).length) meta.placeholders = ph;
      if (Object.keys(meta).length) arb[`@${key}`] = meta;
    }
  }
  return arb;
}

export function csvToArb(text, prefix, templateLocale) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('Add a header row (key, en, fr, …) and at least one translation row.');
  const header = rows[0].map((h) => h.trim());
  const descCol = header.findIndex((h, i) => i > 0 && /^(description|desc|context|@description)$/i.test(h));
  const localeCols = header.map((h, i) => ({ h: h.replace(/-/g, '_'), i })).filter(({ i }) => i > 0 && i !== descCol);
  const badHeaders = localeCols.filter(({ h }) => !LOCALE_RE.test(h)).map(({ h }) => h || '(empty)');
  if (badHeaders.length) throw new Error(`These column headers are not locale codes: ${badHeaders.join(', ')}. Use codes like en, fr, pt_BR.`);
  if (!localeCols.length) throw new Error('No locale columns found. The header should look like: key,en,fr');
  const locales = localeCols.map((c) => c.h);
  const template = locales.includes(templateLocale) ? templateLocale : locales[0];
  const notes = [];
  const seen = new Set(), badKeys = [], dupes = [];
  const data = rows.slice(1).map((r) => ({ key: (r[0] || '').trim(), row: r })).filter((x) => x.key && !x.key.startsWith('@'));
  for (const { key } of data) {
    if (!ARB_KEY.test(key) || DART_RESERVED.has(key)) badKeys.push(key);
    if (seen.has(key)) dupes.push(key);
    seen.add(key);
  }
  if (badKeys.length) notes.push(`keys gen-l10n will reject (must be lowerCamelCase Dart identifiers): ${[...new Set(badKeys)].slice(0, 6).join(', ')}`);
  if (dupes.length) notes.push(`duplicate keys (last wins): ${[...new Set(dupes)].slice(0, 6).join(', ')}`);
  const files = localeCols.map(({ h, i }) => {
    const entries = data.map(({ key, row }) => ({ key, value: row[i] === undefined ? '' : row[i], description: descCol >= 0 ? (row[descCol] || '').trim() : '' }));
    const missing = entries.filter((e) => !e.value).length;
    if (missing && h !== template) notes.push(`${h}: ${missing} untranslated`);
    if (missing && h === template) notes.push(`template ${h} is missing ${missing} message${missing === 1 ? '' : 's'}`);
    return { name: `${prefix}_${h}.arb`, text: `${JSON.stringify(buildArb(h, entries, h === template), null, 2)}\n` };
  });
  return { files, locales, template, count: data.length, notes };
}

export function flattenForArb(obj, path = [], out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && typeof v === 'object') flattenForArb(v, [...path, k], out);
    else out.push({ key: dartFieldName([...path, k].join('_')), value: v === null ? '' : String(v), description: '' });
  }
  return out;
}

export function arbToCsv(arbs) {
  const locales = arbs.map((a) => a.locale);
  const keys = [], desc = {};
  for (const { data } of arbs) {
    for (const [k, v] of Object.entries(data)) {
      if (k.startsWith('@')) { if (k !== '@@locale' && v && v.description && !desc[k.slice(1)]) desc[k.slice(1)] = v.description; continue; }
      if (!keys.includes(k)) keys.push(k);
    }
  }
  const lines = [['key', 'description', ...locales].map(csvField).join(',')];
  for (const k of keys) lines.push([k, desc[k] || '', ...arbs.map((a) => (typeof a.data[k] === 'string' ? a.data[k] : ''))].map(csvField).join(','));
  return `${lines.join('\n')}\n`;
}

export function initArb() {
  const el = (id) => $(`#arb-${id}`);
  let mode = 'csv', files = [], uploaded = null;
  const setStatus = (state, html) => { el('status').dataset.state = state; el('status').innerHTML = `<span>${html}</span>`; };
  const SAMPLES = {
    csv: 'key,description,en,fr,es\nappTitle,The application title,My App,Mon application,Mi aplicación\nhello,Greeting on the home screen,"Hello, {name}!","Bonjour, {name} !","¡Hola, {name}!"\nitemCount,Number of items in the cart,"{count, plural, =0{No items} =1{1 item} other{{count} items}}","{count, plural, =0{Aucun article} =1{1 article} other{{count} articles}}","{count, plural, =0{Sin artículos} =1{1 artículo} other{{count} artículos}}"\nlogout,,Log out,Se déconnecter,\n',
    json: '{\n  "appTitle": "My App",\n  "home": {\n    "title": "Welcome",\n    "greeting": "Hello, {name}!"\n  },\n  "settings": {\n    "darkMode": "Dark mode"\n  }\n}\n',
    arb: '{\n  "@@locale": "en",\n  "appTitle": "My App",\n  "@appTitle": { "description": "The application title" },\n  "hello": "Hello, {name}!",\n  "@hello": { "placeholders": { "name": { "type": "String" } } }\n}\n'
  };

  function showFile() {
    const f = files[Number(el('file-select').value) || 0];
    if (!f) { el('output').innerHTML = ''; el('output').dataset.raw = ''; return; }
    el('output').innerHTML = f.name.endsWith('.csv') ? escapeText(f.text) : highlightJson(f.text);
    el('output').dataset.raw = f.text;
  }

  function setFiles(list) {
    files = list;
    el('file-select').innerHTML = files.map((f, i) => `<option value="${i}">${escapeText(f.name)}</option>`).join('');
    el('download').textContent = files.length > 1 ? `Download all (${files.length} files, .zip)` : 'Download';
    el('download').disabled = !files.length;
    showFile();
  }

  function convert() {
    const text = el('input').value;
    const prefix = (el('prefix').value.trim() || 'app').replace(/[^A-Za-z0-9_]/g, '_');
    el('input').dataset.state = '';
    try {
      if (mode === 'csv') {
        if (!text.trim()) { setFiles([]); el('template').innerHTML = ''; setStatus('idle', 'Paste a CSV with a key column and one column per locale.'); return; }
        const res = csvToArb(text, prefix, el('template').value);
        const current = el('template').value;
        el('template').innerHTML = res.locales.map((l) => `<option value="${l}">${l}</option>`).join('');
        el('template').value = res.locales.includes(current) ? current : res.template;
        setFiles(res.files);
        el('input').dataset.state = 'valid';
        setStatus(res.notes.length ? 'invalid' : 'valid', `<strong>${res.count} messages · ${res.files.length} locales</strong> (template: ${res.template})${res.notes.length ? ` · ${escapeText(res.notes.join(' · '))}` : ''}`);
      } else if (mode === 'json') {
        if (!text.trim()) { setFiles([]); setStatus('idle', 'Paste a JSON object of messages. Nested keys are flattened to camelCase.'); return; }
        let obj;
        try { obj = JSON.parse(text); } catch { throw new Error('This is not valid JSON.'); }
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('The JSON must be an object of key/message pairs.');
        const locale = (el('locale').value.trim() || 'en').replace(/-/g, '_');
        if (!LOCALE_RE.test(locale)) throw new Error(`"${locale}" is not a locale code.`);
        const entries = flattenForArb(obj);
        setFiles([{ name: `${prefix}_${locale}.arb`, text: `${JSON.stringify(buildArb(locale, entries, true), null, 2)}\n` }]);
        el('input').dataset.state = 'valid';
        setStatus('valid', `<strong>${entries.length} messages</strong> converted to ${escapeText(`${prefix}_${locale}.arb`)}`);
      } else {
        const sources = uploaded || (text.trim() ? [{ name: 'pasted.arb', text }] : []);
        if (!sources.length) { setFiles([]); setStatus('idle', 'Choose one or more .arb files, or paste one ARB file.'); return; }
        const arbs = sources.map((s, i) => {
          let data;
          try { data = JSON.parse(s.text); } catch { throw new Error(`${s.name} is not valid JSON.`); }
          const fromName = s.name.match(/_([A-Za-z]{2,3}(?:_[A-Za-z0-9]+)*)\.arb$/);
          return { locale: data['@@locale'] || (fromName ? fromName[1] : `locale${i + 1}`), data };
        });
        setFiles([{ name: 'translations.csv', text: arbToCsv(arbs) }]);
        setStatus('valid', `<strong>${arbs.length} ARB file${arbs.length === 1 ? '' : 's'}</strong> combined into translations.csv (${arbs.map((a) => a.locale).join(', ')})`);
      }
    } catch (e) {
      setFiles([]);
      el('input').dataset.state = 'invalid';
      setStatus('invalid', `<strong>Could not convert.</strong> ${escapeText(e.message)}`);
    }
  }

  function setMode(m) {
    mode = m;
    uploaded = null;
    $$('[data-arb-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.arbMode === m)));
    el('template-wrap').hidden = m !== 'csv';
    el('locale-wrap').hidden = m !== 'json';
    el('prefix-wrap').hidden = m === 'arb';
    el('pick').hidden = m !== 'arb';
    el('input-label').textContent = m === 'csv' ? 'CSV' : m === 'json' ? 'JSON' : 'ARB (or choose files above)';
    el('input').value = SAMPLES[m];
    convert();
  }

  $$('[data-arb-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.arbMode)));
  el('input').addEventListener('input', debounce(() => { uploaded = null; convert(); }, 250));
  ['prefix', 'locale'].forEach((id) => el(id).addEventListener('input', debounce(convert, 250)));
  el('template').addEventListener('change', convert);
  el('file-select').addEventListener('change', showFile);
  el('sample').addEventListener('click', () => setMode(mode));
  el('pick').addEventListener('click', () => el('files').click());
  el('files').addEventListener('change', async () => {
    const list = [...el('files').files];
    if (!list.length) return;
    uploaded = await Promise.all(list.map(async (f) => ({ name: f.name, text: await f.text() })));
    el('input').value = '';
    el('files').value = '';
    convert();
  });
  el('download').addEventListener('click', () => {
    if (!files.length) return;
    if (files.length === 1) { downloadBlob(new Blob([files[0].text], { type: 'text/plain' }), files[0].name); return; }
    downloadBlob(makeZip(files.map((f) => ({ name: f.name, data: new TextEncoder().encode(f.text) }))), 'l10n.zip');
  });
  setMode('csv');
}
