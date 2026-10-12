import { $, $$, clamp, debounce, loadVendor } from '../lib/core.js';
import { utf8Encoder } from './base64.js';

/* =========================================================
   QR code generator (qrcode-generator)
   ========================================================= */
export const escapeWifi = (s) => s.replace(/([\\;,:"])/g, '\\$1');

export function initQr() {
  const el = (id) => $(`#qr-${id}`);
  let type = 'text';
  let qr = null;

  function content() {
    if (type === 'text') return el('text').value;
    const enc = el('enc').value;
    return `WIFI:T:${enc};S:${escapeWifi(el('ssid').value)};${enc === 'nopass' ? '' : `P:${escapeWifi(el('pass').value)};`}${el('hidden').checked ? 'H:true;' : ''};`;
  }

  function draw(canvas, size) {
    const n = qr.getModuleCount();
    const margin = 4; // quiet zone, in modules
    const cell = size / (n + margin * 2);
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = el('bg').value;
    g.fillRect(0, 0, size, size);
    g.fillStyle = el('fg').value;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) g.fillRect(Math.floor((c + margin) * cell), Math.floor((r + margin) * cell), Math.ceil(cell), Math.ceil(cell));
    }
  }

  async function update() {
    const status = el('status');
    const text = content();
    try { await loadVendor('qrcode'); } catch (e) { status.dataset.state = 'invalid'; status.textContent = e.message; return; }
    if (!text) { qr = null; el('canvas').getContext('2d').clearRect(0, 0, 9999, 9999); status.dataset.state = 'idle'; status.textContent = 'Enter some text.'; return; }
    window.qrcode.stringToBytes = (s) => Array.from(utf8Encoder.encode(s)); // the library default keeps only the low byte of each character
    try {
      qr = window.qrcode(0, el('ecc').value);
      qr.addData(text, 'Byte');
      qr.make();
    } catch {
      qr = null;
      status.dataset.state = 'invalid';
      status.innerHTML = '<span><strong>Too much data</strong> for a QR code at this error-correction level. Shorten the text or lower the error correction.</span>';
      return;
    }
    draw(el('canvas'), 512);
    const n = qr.getModuleCount();
    status.dataset.state = 'valid';
    status.innerHTML = `<span><strong>QR version ${(n - 17) / 4}</strong> · ${n}×${n} modules · ${utf8Encoder.encode(text).length} bytes</span>`;
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  el('png').addEventListener('click', () => {
    if (!qr) return;
    const c = document.createElement('canvas');
    draw(c, clamp(parseInt(el('size').value, 10) || 512, 64, 2048));
    c.toBlob((blob) => download(blob, 'qr-code.png'), 'image/png');
  });
  el('svg').addEventListener('click', () => {
    if (!qr) return;
    const n = qr.getModuleCount(), m = 4, total = n + m * 2;
    let path = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c + m} ${r + m}h1v1h-1z`;
    const size = clamp(parseInt(el('size').value, 10) || 512, 64, 2048);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${el('bg').value}"/><path fill="${el('fg').value}" d="${path}"/></svg>`;
    download(new Blob([svg], { type: 'image/svg+xml' }), 'qr-code.svg');
  });
  $$('[data-qr-type]').forEach((b) => b.addEventListener('click', () => {
    type = b.dataset.qrType;
    $$('[data-qr-type]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    el('text-wrap').hidden = type !== 'text';
    el('wifi-wrap').hidden = type !== 'wifi';
    update();
  }));
  $$('[data-qr-type]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.qrType === type)));
  const later = debounce(update, 150);
  ['text', 'ssid', 'pass'].forEach((id) => el(id).addEventListener('input', later));
  ['enc', 'hidden', 'ecc', 'fg', 'bg'].forEach((id) => el(id).addEventListener('input', update));
  update();
}
