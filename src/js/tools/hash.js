import { $, $$, debounce, formatBytes, hydrateCopyButtons } from '../lib/core.js';
import { utf8Encoder } from './base64.js';
import { bytesToBase64, concatBytes } from './rsa.js';

/* =========================================================
   Hash generator (MD5 implemented here; SHA via Web Crypto)
   ========================================================= */
export const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);
export const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];

/** MD5 (RFC 1321). Not secure for passwords or signatures, but still common for checksums. */
export function md5(bytes) {
  const len = bytes.length;
  const total = ((len + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[len] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, (len << 3) >>> 0, true);
  dv.setUint32(total - 4, Math.floor(len / 0x20000000), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Uint32Array(16);
  for (let off = 0; off < total; off += 64) {
    for (let j = 0; j < 16; j++) M[j] = dv.getUint32(off + j * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
      else { F = C ^ (B | ~D); g = (7 * i) & 15; }
      F = (F + A + MD5_K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      const s = MD5_S[(i >> 4) * 4 + (i & 3)];
      B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const out = new Uint8Array(16);
  const odv = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((w, i) => odv.setUint32(i * 4, w, true));
  return out;
}

export function hmacMd5(keyBytes, data) {
  let key = keyBytes.length > 64 ? md5(keyBytes) : keyBytes;
  const k = new Uint8Array(64);
  k.set(key);
  const ipad = k.map((b) => b ^ 0x36), opad = k.map((b) => b ^ 0x5c);
  return md5(concatBytes([opad, md5(concatBytes([ipad, data]))]));
}

export const HASH_ALGS = [
  { id: 'md5', label: 'MD5', note: 'not collision-resistant; checksums only' },
  { id: 'sha1', label: 'SHA-1', web: 'SHA-1', note: 'not collision-resistant' },
  { id: 'sha256', label: 'SHA-256', web: 'SHA-256' },
  { id: 'sha384', label: 'SHA-384', web: 'SHA-384' },
  { id: 'sha512', label: 'SHA-512', web: 'SHA-512' }
];

export async function computeHashes(data, hmacKey) {
  const out = {};
  for (const alg of HASH_ALGS) {
    if (alg.id === 'md5') out.md5 = hmacKey !== null ? hmacMd5(hmacKey, data) : md5(data);
    else if (hmacKey !== null) {
      // Web Crypto rejects zero-length HMAC keys; an empty key is equivalent to one block of zero bytes.
      const key = await crypto.subtle.importKey('raw', hmacKey.length ? hmacKey : new Uint8Array(1), { name: 'HMAC', hash: alg.web }, false, ['sign']);
      out[alg.id] = new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
    } else out[alg.id] = new Uint8Array(await crypto.subtle.digest(alg.web, data));
  }
  return out;
}

export const bytesToHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export function initHash() {
  const el = (id) => $(`#hash-${id}`);
  const results = el('results');
  let source = 'text';
  let fileBytes = null;
  let seq = 0;

  results.innerHTML = HASH_ALGS.map((a) => `
    <div class="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <div class="mb-1 flex items-center justify-between gap-2">
        <span class="text-xs font-semibold text-zinc-500 dark:text-zinc-400">${a.label}${a.note ? ` <span class="font-normal text-zinc-400">· ${a.note}</span>` : ''}</span>
        <button type="button" data-copy="#hash-out-${a.id}"></button>
      </div>
      <div id="hash-out-${a.id}" class="break-all font-mono text-sm text-zinc-800 dark:text-zinc-200"></div>
    </div>`).join('');
  hydrateCopyButtons(results);

  async function update() {
    const my = ++seq;
    const data = source === 'file' ? fileBytes : utf8Encoder.encode(el('text').value);
    if (!data) { HASH_ALGS.forEach((a) => { $(`#hash-out-${a.id}`).textContent = ''; }); return; }
    const hmacKey = el('hmac').checked ? utf8Encoder.encode(el('key').value) : null;
    const hashes = await computeHashes(data, hmacKey);
    if (my !== seq) return;
    const enc = el('encoding').value;
    HASH_ALGS.forEach((a) => {
      const bytes = hashes[a.id];
      $(`#hash-out-${a.id}`).textContent = enc === 'base64' ? bytesToBase64(bytes) : enc === 'HEX' ? bytesToHex(bytes).toUpperCase() : bytesToHex(bytes);
    });
  }

  async function loadFile(file) {
    if (!file) return;
    el('file-name').textContent = `${file.name} · ${formatBytes(file.size)} · hashing…`;
    try {
      fileBytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      fileBytes = null;
      await update();
      el('file-name').textContent = `Could not read ${file.name}. It may have been moved, or the browser lacks permission to read it.`;
      return;
    }
    await update();
    el('file-name').textContent = `${file.name} · ${formatBytes(file.size)}`;
  }

  const setSource = (s) => {
    source = s;
    $$('[data-hash-src]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.hashSrc === s)));
    el('text').hidden = s !== 'text';
    el('file-wrap').hidden = s !== 'file';
    update();
  };
  $$('[data-hash-src]').forEach((b) => b.addEventListener('click', () => setSource(b.dataset.hashSrc)));
  el('text').addEventListener('input', debounce(update, 150));
  el('key').addEventListener('input', debounce(update, 150));
  el('encoding').addEventListener('change', update);
  el('hmac').addEventListener('change', () => { el('key').hidden = !el('hmac').checked; update(); });
  el('pick').addEventListener('click', () => el('file').click());
  el('file').addEventListener('change', () => loadFile(el('file').files[0]));
  const drop = el('file-wrap');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.dataset.drag = 'true'; });
  drop.addEventListener('dragleave', () => { drop.dataset.drag = 'false'; });
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.dataset.drag = 'false'; loadFile(e.dataTransfer.files[0]); });
  el('text').value = 'Hello, MicroTools!';
  setSource('text');
}
