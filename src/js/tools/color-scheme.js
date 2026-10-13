import { $, $$, debounce, escapeText, loadVendor, prefersDarkText, relativeLuminance } from '../lib/core.js';
import { highlightDart } from './dart.js';
import { parseColorInput } from './flutter-color.js';

/* =========================================================
   Material 3 ColorScheme generator (material-color-utilities)
   ========================================================= */
// Flutter ColorScheme roles, in Flutter's order. MCU names differ only for onInverseSurface.
export const SCHEME_ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'primaryFixed', 'primaryFixedDim', 'onPrimaryFixed', 'onPrimaryFixedVariant',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer', 'secondaryFixed', 'secondaryFixedDim', 'onSecondaryFixed', 'onSecondaryFixedVariant',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer', 'tertiaryFixed', 'tertiaryFixedDim', 'onTertiaryFixed', 'onTertiaryFixedVariant',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'surface', 'onSurface', 'surfaceDim', 'surfaceBright', 'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest', 'onSurfaceVariant',
  'outline', 'outlineVariant', 'shadow', 'scrim', 'inverseSurface', 'onInverseSurface', 'inversePrimary', 'surfaceTint'
];
export const SCHEME_TILES = [
  ['primary', 'onPrimary'], ['onPrimary', 'primary'], ['primaryContainer', 'onPrimaryContainer'], ['secondary', 'onSecondary'], ['secondaryContainer', 'onSecondaryContainer'],
  ['tertiary', 'onTertiary'], ['tertiaryContainer', 'onTertiaryContainer'], ['error', 'onError'], ['errorContainer', 'onErrorContainer'],
  ['surface', 'onSurface'], ['surfaceContainerLow', 'onSurface'], ['surfaceContainerHighest', 'onSurfaceVariant'], ['inverseSurface', 'onInverseSurface'], ['outline', 'surface'], ['outlineVariant', 'onSurface']
];

export function computeScheme(seedArgb, variant, isDark) {
  const Scheme = window.MCU.schemes[variant];
  const scheme = new Scheme(window.MCU.Hct.fromInt(seedArgb), isDark, 0.0);
  const out = {};
  for (const role of SCHEME_ROLES) out[role] = scheme[role === 'onInverseSurface' ? 'inverseOnSurface' : role] >>> 0;
  out.surfaceTint = out.primary; // Flutter's fromSeed sets surfaceTint to primary (differs from MCU for fidelity/content/monochrome)
  return out;
}

export const argbHex = (argb) => `0x${(argb >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
export const argbCss = (argb) => `#${(argb & 0xffffff).toString(16).padStart(6, '0')}`;

export function schemeCode(seedArgb, variant, light, dark, mode) {
  const variantLine = variant === 'tonalSpot' ? '' : `\n      dynamicSchemeVariant: DynamicSchemeVariant.${variant},`;
  if (mode === 'seed') {
    return `MaterialApp(
  theme: ThemeData(
    colorScheme: ColorScheme.fromSeed(
      seedColor: const Color(${argbHex(seedArgb)}),${variantLine}
    ),
  ),
  darkTheme: ThemeData(
    colorScheme: ColorScheme.fromSeed(
      seedColor: const Color(${argbHex(seedArgb)}),
      brightness: Brightness.dark,${variantLine}
    ),
  ),
  // home: …
)
`;
  }
  const block = (name, brightness, s) => `const ColorScheme ${name} = ColorScheme(\n  brightness: Brightness.${brightness},\n${SCHEME_ROLES.map((r) => `  ${r}: Color(${argbHex(s[r])}),`).join('\n')}\n);`;
  return `// Generated from seed ${argbHex(seedArgb)} (${variant}).\n${block('lightColorScheme', 'light', light)}\n\n${block('darkColorScheme', 'dark', dark)}\n\n// MaterialApp(\n//   theme: ThemeData(colorScheme: lightColorScheme),\n//   darkTheme: ThemeData(colorScheme: darkColorScheme),\n// )\n`;
}

export function schemeMock(s) {
  const c = (r) => argbCss(s[r]);
  return `<div class="overflow-hidden rounded-2xl border" style="background:${c('surface')};border-color:${c('outlineVariant')}">
    <div class="flex items-center justify-between px-4 py-3" style="background:${c('surfaceContainer')};color:${c('onSurface')}"><span class="font-medium">My App</span><span style="color:${c('onSurfaceVariant')}">⋮</span></div>
    <div class="space-y-3 p-4">
      <div class="rounded-xl p-3" style="background:${c('surfaceContainerLow')};color:${c('onSurface')}"><div class="text-sm font-medium">Card title</div><div class="text-xs" style="color:${c('onSurfaceVariant')}">Supporting text on surfaceContainerLow</div></div>
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <span class="rounded-full px-4 py-1.5 font-medium" style="background:${c('primary')};color:${c('onPrimary')}">Filled</span>
        <span class="rounded-full px-4 py-1.5 font-medium" style="background:${c('secondaryContainer')};color:${c('onSecondaryContainer')}">Tonal</span>
        <span class="rounded-full border px-4 py-1.5 font-medium" style="border-color:${c('outline')};color:${c('primary')}">Outlined</span>
        <span class="ml-auto grid h-12 w-12 place-items-center rounded-2xl text-xl" style="background:${c('primaryContainer')};color:${c('onPrimaryContainer')}">+</span>
      </div>
    </div>
  </div>`;
}

const channels = (argb) => [(argb >> 16) & 255, (argb >> 8) & 255, argb & 255];
/** The tile's paired text colour, or black/white when that pair is not readable (e.g. outline on surface). */
function tileText(bg, fg) {
  const [lb, lf] = [relativeLuminance(...channels(bg)), relativeLuminance(...channels(fg))];
  const ratio = (Math.max(lb, lf) + 0.05) / (Math.min(lb, lf) + 0.05);
  if (ratio >= 4.5) return argbCss(fg);
  return prefersDarkText(...channels(bg)) ? '#000000' : '#ffffff';
}

export function initColorScheme() {
  const el = (id) => $(`#scheme-${id}`);
  let codeMode = 'seed';
  const setStatus = (state, html) => { el('status').dataset.state = state; el('status').innerHTML = `<span>${html}</span>`; };

  async function render() {
    try { await loadVendor('mcu'); } catch (e) { setStatus('invalid', escapeText(e.message)); return; }
    const parsed = parseColorInput(el('seed').value);
    el('seed').dataset.state = parsed ? 'valid' : 'invalid';
    if (!parsed) { setStatus('invalid', '<strong>Unrecognised seed color.</strong> Use a hex value like #6750A4.'); return; }
    const seed = ((0xff << 24) | (parsed.r << 16) | (parsed.g << 8) | parsed.b) >>> 0;
    el('picker').value = argbCss(seed);
    const variant = el('variant').value;
    const light = computeScheme(seed, variant, false), dark = computeScheme(seed, variant, true);
    for (const [id, s] of [['light', light], ['dark', dark]]) {
      el(`mock-${id}`).innerHTML = schemeMock(s);
      el(id).innerHTML = SCHEME_TILES.map(([bg, fg]) => `<div class="min-w-0 overflow-hidden rounded-lg p-2 font-mono text-[10px] leading-tight" style="background:${argbCss(s[bg])};color:${tileText(s[bg], s[fg])}" title="${bg}"><div class="truncate font-sans text-[11px] font-medium">${bg}</div>${argbCss(s[bg]).toUpperCase()}</div>`).join('');
    }
    const code = schemeCode(seed, variant, light, dark, codeMode);
    el('code').innerHTML = highlightDart(code);
    el('code').dataset.raw = code;
    setStatus('valid', `<strong>${variant}</strong> scheme from ${argbCss(seed).toUpperCase()} · matches Flutter's <span class="font-mono">ColorScheme.fromSeed</span>`);
  }

  el('seed').addEventListener('input', debounce(render, 150));
  el('picker').addEventListener('input', () => { el('seed').value = el('picker').value.toUpperCase(); render(); });
  el('variant').addEventListener('change', render);
  $$('[data-scheme-code]').forEach((b) => b.addEventListener('click', () => {
    codeMode = b.dataset.schemeCode;
    $$('[data-scheme-code]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    render();
  }));
  $$('[data-scheme-code]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.schemeCode === codeMode)));
  render();
}
