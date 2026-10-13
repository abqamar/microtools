import { $, debounce, escapeText, hydrateCopyButtons, prefersDarkText } from '../lib/core.js';
import { dartFieldName, highlightDart } from './dart.js';

/* =========================================================
   Color → Flutter
   ========================================================= */
export const hex2 = (n) => n.toString(16).padStart(2, '0').toUpperCase();

export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
}

/** Parses CSS hex/rgb()/hsl() and Flutter Color(0x…)/0x…/fromARGB/fromRGBO into { r, g, b, a } (0–255), or null. */
export function parseColorInput(raw) {
  const s = raw.trim().replace(/;$/, '');
  const num = (v, max) => (v.endsWith('%') ? (parseFloat(v) / 100) * max : parseFloat(v));
  const clamp255 = (v) => Math.round(Math.min(255, Math.max(0, v)));
  let m = s.match(/^(?:const\s+)?(?:Color\(\s*)?0x([0-9a-f]{6}|[0-9a-f]{8})\s*\)?$/i);
  if (m) {
    const h = m[1].length === 6 ? `FF${m[1]}` : m[1];
    return { r: parseInt(h.slice(2, 4), 16), g: parseInt(h.slice(4, 6), 16), b: parseInt(h.slice(6, 8), 16), a: parseInt(h.slice(0, 2), 16), shortFlutterHex: m[1].length === 6 };
  }
  m = s.match(/^(?:const\s+)?Color\.fromARGB\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (m) return { a: clamp255(+m[1]), r: clamp255(+m[2]), g: clamp255(+m[3]), b: clamp255(+m[4]) };
  m = s.match(/^(?:const\s+)?Color\.fromRGBO\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i);
  if (m) return { r: clamp255(+m[1]), g: clamp255(+m[2]), b: clamp255(+m[3]), a: clamp255(parseFloat(m[4]) * 255) }; // rounds, as Flutter 3.27+ does
  m = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255 };
  }
  m = s.match(/^(rgba?|hsla?)\(\s*([^)]*)\)$/i);
  if (m) {
    const p = m[2].split(/[\s,/]+/).filter(Boolean);
    if (p.length !== 3 && p.length !== 4) return null;
    const alpha = p.length === 4 ? clamp255(num(p[3], 1) * 255) : 255;
    if (p.slice(0, 3).some((v) => Number.isNaN(parseFloat(v)))) return null;
    if (m[1].toLowerCase().startsWith('rgb')) return { r: clamp255(num(p[0], 255)), g: clamp255(num(p[1], 255)), b: clamp255(num(p[2], 255)), a: alpha };
    const [r, g, b] = hslToRgb(parseFloat(p[0]), parseFloat(p[1]), parseFloat(p[2]));
    return { r, g, b, a: alpha };
  }
  return null;
}

/**
 * Shortest opacity literal that Color.fromRGBO turns back into exactly `a` on every Flutter version:
 * before 3.27 it truncated opacity × 255, since 3.27 it rounds. Any value with a ≤ opacity × 255 < a + 0.5 satisfies both.
 */
export function rgboOpacity(a) {
  if (a === 255) return '1.0';
  if (a === 0) return '0.0';
  for (let d = 2; d <= 6; d++) {
    const op = Math.ceil((a / 255) * 10 ** d) / 10 ** d;
    const v = op * 255;
    if (Math.trunc(v) === a && Math.round(v) === a) return String(op);
  }
  return String((a + 0.25) / 255);
}

export const unitFloat = (v) => String(Math.round((v / 255) * 10000) / 10000).replace(/^(\d+)$/, '$1.0');
export const flutterHex = (c) => `0x${hex2(c.a)}${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;

export function colorFormats(c) {
  const [h, s, l] = rgbToHsl(c.r, c.g, c.b);
  const alphaPct = `${Math.round((c.a / 255) * 100)}%`;
  return [
    { label: 'Color', code: `Color(${flutterHex(c)})` },
    { label: 'Color.fromARGB', code: `Color.fromARGB(${c.a}, ${c.r}, ${c.g}, ${c.b})` },
    { label: 'Color.fromRGBO', code: `Color.fromRGBO(${c.r}, ${c.g}, ${c.b}, ${rgboOpacity(c.a)})` },
    { label: 'Color.from (Flutter 3.27+)', code: `Color.from(alpha: ${unitFloat(c.a)}, red: ${unitFloat(c.r)}, green: ${unitFloat(c.g)}, blue: ${unitFloat(c.b)})` },
    { label: 'CSS hex', code: `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${c.a < 255 ? hex2(c.a) : ''}` },
    { label: 'CSS rgb', code: c.a < 255 ? `rgb(${c.r} ${c.g} ${c.b} / ${alphaPct})` : `rgb(${c.r} ${c.g} ${c.b})` },
    { label: 'CSS hsl', code: c.a < 255 ? `hsl(${h} ${s}% ${l}% / ${alphaPct})` : `hsl(${h} ${s}% ${l}%)` }
  ];
}

export const SWATCH_MIX = { 50: ['w', 0.9], 100: ['w', 0.75], 200: ['w', 0.6], 300: ['w', 0.4], 400: ['w', 0.2], 500: ['w', 0], 600: ['b', 0.12], 700: ['b', 0.24], 800: ['b', 0.36], 900: ['b', 0.48] };

export function materialSwatch(c) {
  const mix = (v, target, t) => Math.round(v + (target - v) * t);
  return Object.entries(SWATCH_MIX).map(([shade, [to, t]]) => {
    const target = to === 'w' ? 255 : 0;
    return { shade: Number(shade), color: { r: mix(c.r, target, t), g: mix(c.g, target, t), b: mix(c.b, target, t), a: 255 } };
  });
}

export function initFlutterColor() {
  const el = (id) => $(`#fcolor-${id}`);
  const outputs = el('outputs');
  let color = null;

  function renderMaterial() {
    if (!color) { el('shades').innerHTML = ''; el('material').innerHTML = ''; el('material').dataset.raw = ''; return; }
    const base = { ...color, a: 255 };
    const shades = materialSwatch(base);
    el('shades').innerHTML = shades.map(({ shade, color: s }) => {
      const light = prefersDarkText(s.r, s.g, s.b);
      return `<div class="flex h-14 flex-col justify-end rounded-lg p-1.5 font-mono text-[10px] ${light ? 'text-black' : 'text-white'}" style="background:#${hex2(s.r)}${hex2(s.g)}${hex2(s.b)}">${shade}</div>`;
    }).join('');
    const name = dartFieldName(el('name').value.trim() || 'brand');
    const code = [`const MaterialColor ${name} = MaterialColor(${flutterHex(base)}, <int, Color>{`,
      ...shades.map(({ shade, color: s }) => `  ${shade}: Color(${flutterHex(s)}),`), '});', ''].join('\n');
    el('material').innerHTML = highlightDart(code);
    el('material').dataset.raw = code;
  }

  function render(fromPicker) {
    const status = el('status');
    if (!fromPicker) color = parseColorInput(el('input').value);
    el('input').dataset.state = color ? 'valid' : 'invalid';
    if (!color) {
      status.dataset.state = 'invalid';
      status.innerHTML = '<span><strong>Unrecognised color.</strong> Try #6750A4, rgb(103 80 164), hsl(262 34% 48%) or Color(0xFF6750A4).</span>';
      outputs.innerHTML = '';
      renderMaterial();
      return;
    }
    el('picker').value = `#${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`.toLowerCase();
    el('alpha').value = color.a;
    el('alpha-value').textContent = `${Math.round((color.a / 255) * 100)}%`;
    el('swatch').firstElementChild.style.background = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
    status.dataset.state = 'valid';
    status.innerHTML = color.shortFlutterHex
      ? '<span><strong>Note:</strong> in Flutter, <span class="font-mono">Color(0xRRGGBB)</span> with 6 digits is fully transparent. Shown here as opaque <span class="font-mono">0xFF…</span>.</span>'
      : `<span><strong>${escapeText(flutterHex(color))}</strong> · ${Math.round((color.a / 255) * 100)}% opacity</span>`;
    outputs.innerHTML = colorFormats(color).map((f, i) => `
      <div class="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
        <div class="mb-1 flex items-center justify-between gap-2"><span class="text-xs font-semibold text-zinc-500 dark:text-zinc-400">${f.label}</span><button type="button" data-copy="#fcolor-out-${i}"></button></div>
        <div id="fcolor-out-${i}" class="break-all font-mono text-sm">${escapeText(f.code)}</div>
      </div>`).join('');
    hydrateCopyButtons(outputs);
    renderMaterial();
  }

  el('input').addEventListener('input', debounce(() => render(false), 150));
  el('picker').addEventListener('input', () => {
    const v = el('picker').value;
    color = { r: parseInt(v.slice(1, 3), 16), g: parseInt(v.slice(3, 5), 16), b: parseInt(v.slice(5, 7), 16), a: color ? color.a : 255 };
    el('input').value = v.toUpperCase();
    render(true);
  });
  el('alpha').addEventListener('input', () => {
    if (!color) return;
    color = { ...color, a: Number(el('alpha').value), shortFlutterHex: false };
    el('input').value = colorFormats(color)[4].code;
    render(true);
  });
  el('name').addEventListener('input', debounce(renderMaterial, 150));
  render(false);
}
