import { $, clamp, debounce, formatBytes } from '../lib/core.js';

/* =========================================================
   Image resizer & compressor (canvas)
   ========================================================= */
export async function decodeImageFile(file) {
  try {
    return await createImageBitmap(file); // respects EXIF orientation in current browsers
  } catch {
    // SVG and some formats are not supported by createImageBitmap; fall back to an <img>.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally { URL.revokeObjectURL(url); }
  }
}

/** Draws `src` at w×h, halving in steps for large downscales so the result stays sharp. */
export function resizeToCanvas(src, w, h, fill) {
  let cur = src, cw = src.width || src.naturalWidth, ch = src.height || src.naturalHeight;
  while (cw / 2 >= w && ch / 2 >= h) {
    const step = document.createElement('canvas');
    step.width = Math.round(cw / 2); step.height = Math.round(ch / 2);
    const g = step.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, step.width, step.height);
    cur = step; cw = step.width; ch = step.height;
  }
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const g = out.getContext('2d');
  if (fill) { g.fillStyle = fill; g.fillRect(0, 0, w, h); }
  g.imageSmoothingQuality = 'high';
  g.drawImage(cur, 0, 0, w, h);
  return out;
}

export function initImageResize() {
  const el = (id) => $(`#imgr-${id}`);
  let src = null, file = null, ratio = 1, previewUrl = null, seq = 0;
  const setStatus = (state, html) => { el('status').dataset.state = state; el('status').innerHTML = `<span>${html}</span>`; };

  async function render() {
    if (!src) return;
    const my = ++seq;
    const w = clamp(parseInt(el('w').value, 10) || 1, 1, 16384), h = clamp(parseInt(el('h').value, 10) || 1, 1, 16384);
    const format = el('format').value;
    el('quality-wrap').hidden = format === 'image/png';
    el('quality-value').textContent = el('quality').value;
    const canvas = resizeToCanvas(src, w, h, format === 'image/jpeg' ? '#ffffff' : null); // JPEG has no transparency
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, format, Number(el('quality').value) / 100));
    if (my !== seq) return;
    if (!blob) { setStatus('invalid', 'Your browser could not encode this format.'); return; }
    if (format === 'image/webp' && blob.type !== 'image/webp') { setStatus('invalid', 'Your browser cannot encode WebP. Choose JPEG or PNG.'); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(blob);
    el('preview').src = previewUrl;
    const ext = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' }[format];
    el('download').href = previewUrl;
    el('download').download = `${file.name.replace(/\.[^.]+$/, '')}-${w}x${h}.${ext}`;
    const saved = 1 - blob.size / file.size;
    el('result').textContent = formatBytes(blob.size);
    el('saved').textContent = saved >= 0 ? `${Math.round(saved * 100)}%` : `+${Math.round(-saved * 100)}%`;
    el('dims').textContent = `${w} × ${h}`;
    setStatus(saved >= 0 ? 'valid' : 'invalid', saved >= 0
      ? `<strong>${formatBytes(file.size)} → ${formatBytes(blob.size)}</strong> (${Math.round(saved * 100)}% smaller)`
      : `<strong>The result is larger than the original</strong> (${formatBytes(blob.size)}). Try a lower quality, smaller size or WebP.`);
  }
  const later = debounce(render, 250);

  async function load(f) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setStatus('invalid', '<strong>Not an image file.</strong>'); return; }
    setStatus('idle', 'Reading image…');
    try { src = await decodeImageFile(f); } catch { setStatus('invalid', '<strong>Could not read this image.</strong> Your browser may not support its format.'); return; }
    file = f;
    const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
    ratio = w / h;
    el('w').value = w; el('h').value = h;
    el('orig').textContent = `${formatBytes(f.size)} · ${w}×${h}`;
    el('format').value = f.type === 'image/png' ? 'image/png' : f.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    el('controls').hidden = false;
    render();
  }

  el('w').addEventListener('input', () => { if (el('lock').checked) el('h').value = Math.max(1, Math.round((parseInt(el('w').value, 10) || 1) / ratio)); later(); });
  el('h').addEventListener('input', () => { if (el('lock').checked) el('w').value = Math.max(1, Math.round((parseInt(el('h').value, 10) || 1) * ratio)); later(); });
  ['format', 'quality'].forEach((id) => el(id).addEventListener('input', later));
  el('pick').addEventListener('click', () => el('file').click());
  el('file').addEventListener('change', () => { load(el('file').files[0]); el('file').value = ''; });
  const drop = el('drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.dataset.drag = 'true'; });
  drop.addEventListener('dragleave', () => { drop.dataset.drag = 'false'; });
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.dataset.drag = 'false'; load(e.dataTransfer.files[0]); });
}
