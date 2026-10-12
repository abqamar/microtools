import { downloadBlob, encodePngRgb, makeZip } from '../lib/binary.js';
import { $, $$, escapeText, pad, store } from '../lib/core.js';

/* =========================================================
   App icon generator
   ========================================================= */
export const IOS_ICON_DIR = 'ios/Runner/Assets.xcassets/AppIcon.appiconset/';
// Same files, order and idioms as the AppIcon set that `flutter create` generates.
export const IOS_ICONS = [
  ['20x20', 'iphone', '2x'], ['20x20', 'iphone', '3x'], ['29x29', 'iphone', '1x'], ['29x29', 'iphone', '2x'], ['29x29', 'iphone', '3x'],
  ['40x40', 'iphone', '2x'], ['40x40', 'iphone', '3x'], ['60x60', 'iphone', '2x'], ['60x60', 'iphone', '3x'],
  ['20x20', 'ipad', '1x'], ['20x20', 'ipad', '2x'], ['29x29', 'ipad', '1x'], ['29x29', 'ipad', '2x'], ['40x40', 'ipad', '1x'], ['40x40', 'ipad', '2x'],
  ['76x76', 'ipad', '1x'], ['76x76', 'ipad', '2x'], ['83.5x83.5', 'ipad', '2x'], ['1024x1024', 'ios-marketing', '1x']
].map(([size, idiom, scale]) => ({ size, idiom, scale, filename: `Icon-App-${size}@${scale}.png`, px: Math.round(parseFloat(size) * parseInt(scale, 10)) }));

export function iosContentsJson() {
  const images = IOS_ICONS.map((i) => `    {\n      "size" : "${i.size}",\n      "idiom" : "${i.idiom}",\n      "filename" : "${i.filename}",\n      "scale" : "${i.scale}"\n    }`);
  return `{\n  "images" : [\n${images.join(',\n')}\n  ],\n  "info" : {\n    "version" : 1,\n    "author" : "xcode"\n  }\n}\n`;
}

export function iconFileList(platforms) {
  const list = [];
  if (platforms.android) {
    for (const [dpi, px] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) list.push({ name: `android/app/src/main/res/mipmap-${dpi}/ic_launcher.png`, px });
    list.push({ name: 'store/google-play-icon-512.png', px: 512 });
  }
  if (platforms.ios) {
    // Several iOS entries share a size; render each distinct file once.
    const seen = new Set();
    for (const i of IOS_ICONS) if (!seen.has(i.filename)) { seen.add(i.filename); list.push({ name: IOS_ICON_DIR + i.filename, px: i.px, opaque: true }); }
  }
  if (platforms.web) {
    list.push({ name: 'web/favicon.png', px: 16 }, { name: 'web/icons/Icon-192.png', px: 192 }, { name: 'web/icons/Icon-512.png', px: 512 },
      { name: 'web/icons/Icon-maskable-192.png', px: 192, maskable: true }, { name: 'web/icons/Icon-maskable-512.png', px: 512, maskable: true });
  }
  return list;
}

/** Downscales in halving steps (sharper than one big drawImage), returning a canvas of exactly w×h. */
export function scaledCanvas(src, w, h) {
  let cur = src, cw = src.width || src.naturalWidth, ch = src.height || src.naturalHeight;
  while (cw / 2 >= w && ch / 2 >= h) {
    const step = document.createElement('canvas');
    step.width = Math.round(cw / 2); step.height = Math.round(ch / 2);
    const g = step.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, step.width, step.height);
    cur = step; cw = step.width; ch = step.height;
  }
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const g = out.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, w, h);
  return out;
}

export function renderIcon(src, px, { bg, padding, opaque, maskable }) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const g = canvas.getContext('2d');
  if (opaque || maskable) { g.fillStyle = bg; g.fillRect(0, 0, px, px); }
  const area = px * (maskable ? 0.8 : 1) * (1 - 2 * padding); // maskable icons keep content inside the central 80% safe zone
  const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
  const scale = area / Math.max(sw, sh);
  const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
  g.drawImage(scaledCanvas(src, w, h), Math.round((px - w) / 2), Math.round((px - h) / 2));
  return canvas;
}

export function initAppIcon() {
  const el = (id) => $(`#appicon-${id}`);
  let src = null, srcName = 'icon';
  const setStatus = (state, html) => { el('status').dataset.state = state; el('status').innerHTML = `<span>${html}</span>`; };
  const opts = () => ({ bg: el('bg').value, padding: Number(el('pad').value) / 100 });
  const platforms = () => Object.fromEntries($$('[data-appicon-platform]').map((b) => [b.dataset.appiconPlatform, b.checked]));

  function preview() {
    el('pad-value').textContent = `${el('pad').value}%`;
    if (!src) return;
    const o = opts();
    const samples = [['Android', 192, {}], ['iOS', 180, { opaque: true }], ['Web maskable', 192, { maskable: true }], ['Favicon', 16, {}]];
    el('preview').innerHTML = '';
    for (const [label, px, extra] of samples) {
      const fig = document.createElement('figure');
      fig.className = 'flex flex-col items-center gap-1 text-xs text-zinc-500';
      const c = renderIcon(src, px, { ...o, ...extra });
      c.className = `rounded-2xl border border-zinc-200 dark:border-zinc-800 ${label === 'Web maskable' ? 'rounded-full' : ''}`;
      c.style.width = c.style.height = `${Math.min(96, Math.max(32, px / 2))}px`;
      c.style.imageRendering = px < 32 ? 'pixelated' : 'auto';
      fig.append(c, Object.assign(document.createElement('figcaption'), { textContent: `${label} · ${px}px` }));
      el('preview').append(fig);
    }
  }

  async function load(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setStatus('invalid', '<strong>Not an image file.</strong>'); return; }
    try {
      src = await (async () => {
        try { return await createImageBitmap(file); } catch {
          const url = URL.createObjectURL(file);
          try { const img = new Image(); img.src = url; await img.decode(); return img; } finally { URL.revokeObjectURL(url); }
        }
      })();
    } catch { setStatus('invalid', '<strong>Could not read this image.</strong>'); return; }
    srcName = file.name.replace(/\.[^.]+$/, '') || 'icon';
    const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
    const notes = [];
    if (w !== h) notes.push(`it is ${w}×${h}, not square, so it is centred and padded`);
    if (Math.min(w, h) < 1024 && file.type !== 'image/svg+xml') notes.push(`it is smaller than 1024px, so the largest icons will be upscaled and look soft`);
    el('generate').disabled = false;
    setStatus(notes.length ? 'invalid' : 'valid', `<strong>${escapeText(file.name)}</strong> loaded${notes.length ? `, but ${escapeText(notes.join('; '))}.` : ' · ready to generate.'}`);
    preview();
  }

  async function generate() {
    if (!src) return;
    const list = iconFileList(platforms());
    if (!list.length) { setStatus('invalid', 'Select at least one platform.'); return; }
    el('generate').disabled = true;
    setStatus('idle', `Generating ${list.length} icons…`);
    try {
      const o = opts();
      const files = [];
      for (const item of list) {
        const canvas = renderIcon(src, item.px, { ...o, opaque: item.opaque, maskable: item.maskable });
        const data = item.opaque ? await encodePngRgb(canvas) : new Uint8Array(await (await new Promise((r) => canvas.toBlob(r, 'image/png'))).arrayBuffer());
        files.push({ name: item.name, data });
      }
      if (platforms().ios) files.push({ name: `${IOS_ICON_DIR}Contents.json`, data: new TextEncoder().encode(iosContentsJson()) });
      downloadBlob(makeZip(files), `${srcName}-app-icons.zip`);
      setStatus('valid', `<strong>Downloaded ${files.length} files.</strong> Unzip into your Flutter project root to replace the default icons, then rebuild the app.`);
    } catch (e) {
      setStatus('invalid', `<strong>Could not generate icons:</strong> ${escapeText(e.message || String(e))}`);
    } finally { el('generate').disabled = false; }
  }

  el('pick').addEventListener('click', () => el('file').click());
  el('file').addEventListener('change', () => { load(el('file').files[0]); el('file').value = ''; });
  const drop = el('drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.dataset.drag = 'true'; });
  drop.addEventListener('dragleave', () => { drop.dataset.drag = 'false'; });
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.dataset.drag = 'false'; load(e.dataTransfer.files[0]); });
  ['bg', 'pad'].forEach((id) => el(id).addEventListener('input', preview));
  el('generate').addEventListener('click', generate);
}
