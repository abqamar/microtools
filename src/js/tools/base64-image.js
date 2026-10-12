import { $, $$, debounce, escapeText, formatBytes } from '../lib/core.js';
import { utf8Encoder } from './base64.js';
import { base64ToBytes } from './rsa.js';

/* =========================================================
   Base64 image viewer
   ========================================================= */
export const IMG_TYPES = {
  png: { name: 'PNG', mime: 'image/png', ext: 'png' },
  jpeg: { name: 'JPEG', mime: 'image/jpeg', ext: 'jpg' },
  gif: { name: 'GIF', mime: 'image/gif', ext: 'gif' },
  webp: { name: 'WebP', mime: 'image/webp', ext: 'webp' },
  bmp: { name: 'BMP', mime: 'image/bmp', ext: 'bmp' },
  ico: { name: 'ICO', mime: 'image/x-icon', ext: 'ico' },
  tiff: { name: 'TIFF', mime: 'image/tiff', ext: 'tiff' },
  avif: { name: 'AVIF', mime: 'image/avif', ext: 'avif' },
  heic: { name: 'HEIC', mime: 'image/heic', ext: 'heic' },
  svg: { name: 'SVG', mime: 'image/svg+xml', ext: 'svg' }
};

/** Identifies the format from the file's own bytes (magic numbers), never from what the input claims. */
export function sniffImageType(b) {
  const hex = (n) => Array.from(b.subarray(0, n), (x) => x.toString(16).padStart(2, '0')).join('');
  const ascii = (start, end) => String.fromCharCode(...b.subarray(start, end));
  if (hex(8) === '89504e470d0a1a0a') return IMG_TYPES.png;
  if (hex(3) === 'ffd8ff') return IMG_TYPES.jpeg;
  if (/^GIF8[79]a$/.test(ascii(0, 6))) return IMG_TYPES.gif;
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return IMG_TYPES.webp;
  if (ascii(0, 2) === 'BM' && b.length > 26) return IMG_TYPES.bmp;
  if (hex(4) === '00000100') return IMG_TYPES.ico;
  if (hex(4) === '49492a00' || hex(4) === '4d4d002a') return IMG_TYPES.tiff;
  if (ascii(4, 8) === 'ftyp') {
    // ISO base media file: the ftyp box lists the major and compatible brands.
    const boxSize = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    const brands = ascii(8, Math.min(b.length, Math.max(16, boxSize), 256)); // capped: the size field is untrusted
    if (/avi[fs]/.test(brands)) return IMG_TYPES.avif;
    if (/hei[cxms]|hev[cxms]|mif1|msf1/.test(brands)) return IMG_TYPES.heic;
  }
  const head = new TextDecoder().decode(b.subarray(0, 4096)).replace(/^\uFEFF/, '').trimStart();
  if (head.startsWith('<') && /<svg[\s>]/i.test(head)) return IMG_TYPES.svg;
  if (ascii(0, 4) === '%PDF') return { notImage: 'a PDF document' };
  if (hex(4) === '504b0304') return { notImage: 'a ZIP archive (or a .docx, .xlsx or .apk file)' };
  return null;
}

/** Accepts raw Base64 (standard or URL-safe) or a data: URI. Returns the bytes and the declared MIME type, if any. */
export function parseImageInput(text) {
  const s = text.trim();
  const m = s.match(/^data:([^;,]*)((?:;[^;,]*)*),([\s\S]*)$/i);
  if (!m) return { bytes: base64ToBytes(s), declared: null };
  const declared = m[1].trim().toLowerCase() || null;
  if (/;base64/i.test(m[2])) return { bytes: base64ToBytes(m[3]), declared };
  return { bytes: utf8Encoder.encode(decodeURIComponent(m[3])), declared }; // e.g. data:image/svg+xml,%3Csvg…
}

export function initBase64Image() {
  const el = (id) => $(`#b64img-${id}`);
  const img = el('img');
  const stage = el('stage');
  const download = el('download');
  let objectUrl = null;
  let token = 0;

  const setStatus = (state, html) => { el('status').dataset.state = state; el('status').innerHTML = `<span>${html}</span>`; };
  const setStats = (format = '—', dims = '—', size = '—', mime = '—') => {
    el('format').textContent = format; el('dims').textContent = dims; el('size').textContent = size; el('mime').textContent = mime;
  };

  function reset() {
    token++;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    img.removeAttribute('src');
    img.classList.add('hidden');
    el('empty').classList.remove('hidden');
    download.removeAttribute('href');
    download.removeAttribute('download');
    download.classList.add('pointer-events-none', 'opacity-50');
    download.setAttribute('aria-disabled', 'true');
    el('input').dataset.state = '';
    setStats();
  }

  function fail(html) {
    reset();
    el('input').dataset.state = 'invalid';
    setStatus('invalid', html);
  }

  function render() {
    const text = el('input').value;
    el('length').textContent = text.trim() ? `· ${text.trim().length.toLocaleString()} chars` : '';
    if (!text.trim()) { reset(); setStatus('idle', 'Paste a Base64 image to preview it.'); return; }

    let parsed;
    try { parsed = parseImageInput(text); } catch {
      fail('<strong>Not valid Base64.</strong> Check that the whole string was copied.');
      return;
    }
    const type = sniffImageType(parsed.bytes);
    if (!type) { fail('<strong>Not a recognised image.</strong> The decoded bytes do not match any image format.'); return; }
    if (type.notImage) { fail(`<strong>Not an image.</strong> The data looks like ${escapeText(type.notImage)}.`); return; }

    reset();
    const my = token;
    const notes = [];
    if (parsed.declared && parsed.declared !== type.mime && !(parsed.declared === 'image/jpg' && type === IMG_TYPES.jpeg)) {
      notes.push(`The data URI says ${parsed.declared}, but the bytes are ${type.name}. Showing it as ${type.name}.`);
    }
    // Browsers draw whatever part of a cut-off PNG/JPEG they can decode, so check for the end marker explicitly.
    const tail = parsed.bytes.subarray(-12);
    const pngEnd = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82].every((x, i) => tail[tail.length - 8 + i] === x); // IEND chunk
    const jpegEnd = tail.length >= 2 && Array.from(tail).some((x, i) => x === 0xff && tail[i + 1] === 0xd9); // EOI (padding allowed)
    if ((type === IMG_TYPES.png && !pngEnd) || (type === IMG_TYPES.jpeg && !jpegEnd)) {
      notes.push('The data looks truncated (no end-of-image marker), so part of the image may be missing. Check that the whole string was copied.');
    }
    if (type === IMG_TYPES.svg) {
      const svgText = new TextDecoder().decode(parsed.bytes);
      if (/<script|\son[a-z]+\s*=|javascript:/i.test(svgText)) {
        notes.push('This SVG contains script code. It is blocked in this preview, but be careful opening the downloaded file directly in a browser.');
      }
    }

    // A Blob URL shown in <img>: images rendered this way cannot run scripts or load external resources.
    objectUrl = URL.createObjectURL(new Blob([parsed.bytes], { type: type.mime }));
    const size = formatBytes(parsed.bytes.length);
    setStats(type.name, '…', size, type.mime);
    setStatus('idle', 'Decoding…');

    img.onload = () => {
      if (my !== token) return;
      img.classList.remove('hidden');
      el('empty').classList.add('hidden');
      el('input').dataset.state = 'valid';
      el('dims').textContent = img.naturalWidth ? `${img.naturalWidth} × ${img.naturalHeight}` : 'scalable';
      download.href = objectUrl;
      download.download = `image.${type.ext}`;
      download.classList.remove('pointer-events-none', 'opacity-50');
      download.removeAttribute('aria-disabled');
      const noteHtml = notes.length ? ` · <span class="font-normal">${notes.map(escapeText).join(' ')}</span>` : '';
      setStatus('valid', `<strong>${type.name} image · ${size}</strong>${noteHtml}`);
    };
    img.onerror = () => {
      if (my !== token) return;
      el('input').dataset.state = 'invalid';
      setStatus('invalid', `<strong>This is a ${type.name} image, but your browser can't display it.</strong> ${
        type === IMG_TYPES.heic || type === IMG_TYPES.tiff ? `${type.name} is mainly supported in Safari.` : 'The data may be corrupted or truncated.'}`);
    };
    img.src = objectUrl;
  }

  function makeSample() {
    const c = document.createElement('canvas');
    c.width = 360; c.height = 180;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 360, 180);
    grad.addColorStop(0, '#4f46e5'); grad.addColorStop(1, '#10b981');
    g.fillStyle = grad;
    g.beginPath(); g.roundRect(10, 10, 340, 160, 24); g.fill();
    g.fillStyle = '#ffffff';
    g.font = '600 30px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('MicroTools', 180, 98);
    g.font = '15px system-ui, sans-serif';
    g.fillText('Decoded locally in your browser', 180, 128);
    return c.toDataURL('image/png');
  }

  const bgClasses = { checker: 'checker', light: 'light', dark: 'dark-bg' };
  const segs = (attr) => $$(`[data-b64img-${attr}]`);
  function setBg(bg) {
    Object.values(bgClasses).forEach((c) => stage.classList.remove(c));
    stage.classList.add(bgClasses[bg]);
    segs('bg').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.b64imgBg === bg)));
  }
  function setFit(fit) {
    img.className = `${img.classList.contains('hidden') ? 'hidden ' : ''}${fit === 'fit' ? 'max-h-[32rem] max-w-full object-contain' : 'max-w-none'}`;
    segs('fit').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.b64imgFit === fit)));
  }

  el('input').addEventListener('input', debounce(render, 250));
  el('sample').addEventListener('click', () => { el('input').value = makeSample(); render(); });
  el('clear').addEventListener('click', () => { el('input').value = ''; render(); el('input').focus(); });
  segs('bg').forEach((b) => b.addEventListener('click', () => setBg(b.dataset.b64imgBg)));
  segs('fit').forEach((b) => b.addEventListener('click', () => setFit(b.dataset.b64imgFit)));
  setBg('checker');
  setFit('fit');
}
