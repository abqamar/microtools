import { $, $$, debounce, escapeText, findJsonError, lineColAt, renderJsonErrorSnippet, splitWords, store } from '../lib/core.js';

/* =========================================================
   JSON → Dart model generator
   ========================================================= */
export const DART_RESERVED = new Set(('assert await break case catch class const continue default do else enum extends false final finally for if in is ' +
  'new null rethrow return super switch this throw true try var void while with yield hashCode runtimeType toString noSuchMethod ' +
  'toJson fromJson copyWith props stringify').split(' '));
export const DART_CORE_TYPES = new Set(('Object String List Map Set Iterable Iterator Type Function Symbol Null Never Future Stream DateTime Duration ' +
  'Uri Error Exception Record Enum Pattern Match RegExp Comparable Sink BigInt StackTrace StringBuffer Equatable JsonKey').split(' '));
export const DART_KEYWORDS = new Set('abstract class const extends factory final get import override part required return this null true false with dynamic bool int double num'.split(' '));

/** PascalCase restricted to ASCII letters/digits (valid Dart identifier characters). */
export const dartPascal = (s) => splitWords(String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')) // é → e
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  .join('')
  .replace(/[^A-Za-z0-9]/g, '');

export function dartClassName(s) {
  const p = dartPascal(s);
  if (!p) return 'Model';
  if (/^\d/.test(p)) return `Model${p}`;
  return DART_CORE_TYPES.has(p) ? `${p}Model` : p;
}

export function dartFieldName(key) {
  const p = dartPascal(key);
  if (!p) return 'field';
  let name = /^\d/.test(p) ? `field${p}` : p.charAt(0).toLowerCase() + p.slice(1);
  if (DART_RESERVED.has(name)) name += 'Value';
  return name;
}

export function singularize(w) {
  if (/ies$/i.test(w) && w.length > 4) return w.slice(0, -3) + 'y';
  if (/(ss|x|ch|sh)es$/i.test(w)) return w.slice(0, -2);
  if (/[^sui]s$/i.test(w) && w.length > 3) return w.slice(0, -1);
  return `${w}Item`;
}

export const dartString = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;

/** Describes the structure of a JSON value; arrays merge all elements into one shape. */
export function shapeOf(v) {
  if (v === null) return { t: 'null', nullable: true };
  if (Array.isArray(v)) return { t: 'list', nullable: false, item: v.reduce((acc, x) => mergeShapes(acc, shapeOf(x)), null) };
  if (typeof v === 'object') {
    const fields = new Map();
    for (const [k, x] of Object.entries(v)) fields.set(k, shapeOf(x));
    return { t: 'object', nullable: false, fields };
  }
  if (typeof v === 'number') return { t: Number.isInteger(v) ? 'int' : 'double', nullable: false };
  return { t: typeof v === 'boolean' ? 'bool' : 'String', nullable: false };
}

export function mergeShapes(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.t === 'null') return { ...b, nullable: true };
  if (b.t === 'null') return { ...a, nullable: true };
  const nullable = a.nullable || b.nullable;
  if (a.t === b.t) {
    if (a.t === 'object') {
      // A key missing from some objects becomes nullable.
      const fields = new Map();
      for (const k of new Set([...a.fields.keys(), ...b.fields.keys()])) {
        const fa = a.fields.get(k), fb = b.fields.get(k);
        fields.set(k, fa && fb ? mergeShapes(fa, fb) : { ...(fa || fb), nullable: true });
      }
      return { t: 'object', nullable, fields };
    }
    if (a.t === 'list') return { t: 'list', nullable, item: mergeShapes(a.item, b.item) };
    return { t: a.t, nullable };
  }
  if ((a.t === 'int' && b.t === 'double') || (a.t === 'double' && b.t === 'int')) return { t: 'double', nullable };
  return { t: 'dynamic', nullable: true };
}

/** Turns a root object shape into a flat list of class definitions (root first). */
export function buildDartClasses(rootShape, rootName, allNullable) {
  const classes = [];
  const taken = new Set();
  const uniqueName = (base) => { let n = base, i = 2; while (taken.has(n)) n = base + i++; taken.add(n); return n; };

  function dartType(shape, hint) {
    if (!shape || shape.t === 'null' || shape.t === 'dynamic') return { kind: 'prim', name: 'dynamic' };
    if (shape.t === 'object') return { kind: 'obj', name: buildClass(shape, uniqueName(dartClassName(hint))) };
    if (shape.t === 'list') return { kind: 'list', item: dartType(shape.item, singularize(hint)), itemNullable: !!shape.item && shape.item.nullable };
    return { kind: 'prim', name: shape.t };
  }

  function buildClass(shape, name) {
    const def = { name, fields: [] };
    classes.push(def);
    const used = new Set();
    for (const [key, s] of shape.fields) {
      let fname = dartFieldName(key);
      const base = fname;
      for (let i = 2; used.has(fname); i++) fname = base + i;
      used.add(fname);
      const type = dartType(s, key);
      def.fields.push({ key, name: fname, type, nullable: isDartDynamic(type) || allNullable || s.nullable });
    }
    return name;
  }

  buildClass(rootShape, uniqueName(rootName));
  return classes;
}

export const isDartDynamic = (t) => t.kind === 'prim' && t.name === 'dynamic';
export const dartTypeStr = (t) => t.kind === 'list'
  ? `List<${dartTypeStr(t.item)}${t.itemNullable && !isDartDynamic(t.item) ? '?' : ''}>`
  : t.name;
export const dartDeclType = (t, nullable) => dartTypeStr(t) + (nullable && !isDartDynamic(t) ? '?' : '');
export const dartNeedsConversion = (t) => t.kind === 'obj' || (t.kind === 'list' && dartNeedsConversion(t.item));
export const dartHasNested = (c) => c.fields.some((f) => dartNeedsConversion(f.type));

export function dartFromJsonExpr(t, nullable, src, depth) {
  const q = nullable ? '?' : '';
  if (t.kind === 'prim') {
    if (t.name === 'dynamic') return src;
    if (t.name === 'double') return `(${src} as num${q})${q}.toDouble()`;
    return `${src} as ${t.name}${q}`;
  }
  if (t.kind === 'obj') {
    const call = `${t.name}.fromJson(${src} as Map<String, dynamic>)`;
    return nullable ? `${src} == null ? null : ${call}` : call;
  }
  if (isDartDynamic(t.item)) return `${src} as List<dynamic>${q}`;
  const v = depth ? `e${depth + 1}` : 'e';
  return `(${src} as List<dynamic>${q})${q}.map((${v}) => ${dartFromJsonExpr(t.item, t.itemNullable, v, depth + 1)}).toList()`;
}

export function dartToJsonExpr(t, nullable, ref, depth) {
  const q = nullable ? '?' : '';
  if (t.kind === 'obj') return `${ref}${q}.toJson()`;
  if (t.kind === 'prim' || !dartNeedsConversion(t.item)) return ref;
  const v = depth ? `e${depth + 1}` : 'e';
  return `${ref}${q}.map((${v}) => ${dartToJsonExpr(t.item, t.itemNullable, v, depth + 1)}).toList()`;
}

export function genDartClass(c, opts) {
  const I = '  ';
  const { style } = opts;
  const fields = c.fields;
  const blocks = [];

  blocks.push(fields.flatMap((f) => [
    ...(style === 'json_serializable' && f.name !== f.key ? [`${I}@JsonKey(name: ${dartString(f.key)})`] : []),
    `${I}final ${dartDeclType(f.type, f.nullable)} ${f.name};`
  ]));

  blocks.push(fields.length
    ? [`${I}const ${c.name}({`, ...fields.map((f) => `${I}${I}${f.nullable ? '' : 'required '}this.${f.name},`), `${I}});`]
    : [`${I}const ${c.name}();`]);

  if (style === 'json_serializable') {
    blocks.push([`${I}factory ${c.name}.fromJson(Map<String, dynamic> json) => _$${c.name}FromJson(json);`]);
    blocks.push([`${I}Map<String, dynamic> toJson() => _$${c.name}ToJson(this);`]);
  } else {
    blocks.push(fields.length
      ? [`${I}factory ${c.name}.fromJson(Map<String, dynamic> json) => ${c.name}(`,
         ...fields.map((f) => `${I}${I}${I}${f.name}: ${dartFromJsonExpr(f.type, f.nullable, `json[${dartString(f.key)}]`, 0)},`),
         `${I}${I});`]
      : [`${I}factory ${c.name}.fromJson(Map<String, dynamic> json) => const ${c.name}();`]);
    blocks.push(fields.length
      ? [`${I}Map<String, dynamic> toJson() => {`,
         ...fields.map((f) => `${I}${I}${I}${dartString(f.key)}: ${dartToJsonExpr(f.type, f.nullable, f.name, 0)},`),
         `${I}${I}};`]
      : [`${I}Map<String, dynamic> toJson() => {};`]);
  }

  if (opts.copyWith) {
    blocks.push(fields.length
      ? [`${I}${c.name} copyWith({`,
         ...fields.map((f) => `${I}${I}${isDartDynamic(f.type) ? 'dynamic' : `${dartTypeStr(f.type)}?`} ${f.name},`),
         `${I}}) =>`,
         `${I}${I}${c.name}(`,
         ...fields.map((f) => `${I}${I}${I}${f.name}: ${f.name} ?? this.${f.name},`),
         `${I}${I});`]
      : [`${I}${c.name} copyWith() => const ${c.name}();`]);
  }

  if (style === 'equatable') {
    blocks.push([`${I}@override`, `${I}List<Object?> get props => [${fields.map((f) => f.name).join(', ')}];`]);
    if (opts.toStr) blocks.push([`${I}@override`, `${I}bool get stringify => true;`]);
  } else if (opts.toStr) {
    blocks.push([`${I}@override`, `${I}String toString() => '${c.name}(${fields.map((f) => `${f.name}: $${f.name}`).join(', ')})';`]);
  }

  const annotation = style === 'json_serializable' ? [dartHasNested(c) ? '@JsonSerializable(explicitToJson: true)' : '@JsonSerializable()'] : [];
  const head = `class ${c.name}${style === 'equatable' ? ' extends Equatable' : ''} {`;
  const body = blocks.filter((b) => b.length).map((b) => b.join('\n')).join('\n\n');
  return [...annotation, head, body, '}'].join('\n');
}

export function genFreezedClass(c) {
  const I = '  ';
  const params = c.fields.map((f) =>
    `${I}${I}${f.name !== f.key ? `@JsonKey(name: ${dartString(f.key)}) ` : ''}${f.nullable ? '' : 'required '}${dartDeclType(f.type, f.nullable)} ${f.name},`);
  return [
    '@freezed',
    `abstract class ${c.name} with _$${c.name} {`,
    ...(dartHasNested(c) ? [`${I}@JsonSerializable(explicitToJson: true)`] : []),
    params.length ? `${I}const factory ${c.name}({\n${params.join('\n')}\n${I}}) = _${c.name};` : `${I}const factory ${c.name}() = _${c.name};`,
    '',
    `${I}factory ${c.name}.fromJson(Map<String, dynamic> json) => _$${c.name}FromJson(json);`,
    '}'
  ].join('\n');
}

export function generateDart(classes, opts) {
  const file = opts.fileBase;
  const headers = {
    plain: '',
    equatable: "import 'package:equatable/equatable.dart';\n\n",
    json_serializable: `import 'package:json_annotation/json_annotation.dart';\n\npart '${file}.g.dart';\n\n`,
    // @JsonSerializable on a freezed factory works but trips the analyzer; freezed's docs recommend this ignore.
    freezed: `${classes.some(dartHasNested) ? '// ignore_for_file: invalid_annotation_target\n\n' : ''}import 'package:freezed_annotation/freezed_annotation.dart';\n\npart '${file}.freezed.dart';\npart '${file}.g.dart';\n\n`
  };
  const code = classes.map((c) => (opts.style === 'freezed' ? genFreezedClass(c) : genDartClass(c, opts))).join('\n\n');
  return `${headers[opts.style]}${code}\n`;
}

export function highlightDart(code) {
  const re = /(\/\/[^\n]*)|('(?:\\.|[^'\\\n])*')|(@\w+)|([A-Za-z_$][\w$]*)/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += escapeText(code.slice(last, m.index));
    let cls = null;
    if (m[1]) cls = 'text-zinc-500 italic';
    else if (m[2]) cls = 'j-str';
    else if (m[3]) cls = 'j-num';
    else if (DART_KEYWORDS.has(m[0])) cls = 'j-bool';
    else if (/^_?\$?[A-Z]/.test(m[0])) cls = 'j-key';
    out += cls ? `<span class="${cls}">${escapeText(m[0])}</span>` : escapeText(m[0]);
    last = re.lastIndex;
  }
  return out + escapeText(code.slice(last));
}

export const DART_SETUP = {
  plain: '# No packages needed: plain Dart classes.',
  equatable: 'flutter pub add equatable',
  json_serializable: 'flutter pub add json_annotation dev:build_runner dev:json_serializable\ndart run build_runner build --delete-conflicting-outputs',
  freezed: 'flutter pub add freezed_annotation json_annotation dev:build_runner dev:freezed dev:json_serializable\ndart run build_runner build --delete-conflicting-outputs'
};

export function initDart() {
  const input = $('#dart-input');
  const output = $('#dart-output');
  const status = $('#dart-status');
  const classInput = $('#dart-class');
  const nullableEl = $('#dart-nullable');
  const copyWithEl = $('#dart-copywith');
  const toStringEl = $('#dart-tostring');
  const toStringText = $('#dart-tostring-text');
  const styleBtns = $$('[data-dart-style]');
  const setup = $('#dart-setup');
  let style = 'plain';

  const SAMPLE = JSON.stringify({
    id: 1, first_name: 'Ada', email: 'ada@example.com', is_active: true, balance: 1520.75, avatar: null,
    tags: ['admin', 'beta'],
    address: { street: '12 Main St', city: 'Toronto', geo: { lat: 43.65, lng: -79.38 } },
    orders: [{ order_id: 'A-100', total: 49.99, items: 3 }, { order_id: 'A-101', total: 12, items: 1, coupon: 'FALL10' }]
  }, null, 2);

  function saveOptions() {
    store.set('mt-dart-options', JSON.stringify({
      style, className: classInput.value, nullable: nullableEl.checked, copyWith: copyWithEl.checked, toStr: toStringEl.checked
    }));
  }

  function syncControls() {
    styleBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.dartStyle === style)));
    const freezed = style === 'freezed';
    copyWithEl.disabled = toStringEl.disabled = freezed;
    $('#dart-copywith-wrap').title = $('#dart-tostring-wrap').title = freezed ? 'freezed generates copyWith, toString, == and hashCode for you' : '';
    toStringText.textContent = style === 'equatable' ? 'toString() (stringify)' : 'toString()';
    setup.textContent = DART_SETUP[style];
    setup.dataset.raw = style === 'plain' ? '' : DART_SETUP[style];
  }

  const setStatus = (state, html) => { status.dataset.state = state; input.dataset.state = state === 'idle' ? '' : state; status.innerHTML = html; };

  function generate() {
    const src = input.value;
    const rootName = dartClassName(classInput.value.trim() || 'Root');
    const fileBase = splitWords(rootName).map((w) => w.toLowerCase()).join('_');
    $('#dart-filename').textContent = `· ${fileBase}.dart`;
    output.dataset.raw = '';

    if (!src.trim()) {
      setStatus('idle', 'Paste a JSON object to generate Dart models.');
      output.innerHTML = '';
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(src);
    } catch (nativeErr) {
      const err = findJsonError(src) || { pos: src.length, msg: nativeErr.message };
      const { line, col } = lineColAt(src, err.pos);
      setStatus('invalid', `<span><strong>Invalid JSON</strong> — ${escapeText(err.msg)} <span class="whitespace-nowrap font-mono text-xs opacity-80">(line ${line}, column ${col})</span></span>`);
      output.innerHTML = renderJsonErrorSnippet(src, err.pos);
      return;
    }

    let shape = shapeOf(parsed);
    if (shape.t === 'list') shape = shape.item;
    if (!shape || shape.t !== 'object') {
      setStatus('invalid', '<span><strong>Unsupported input</strong> — the root must be a JSON object or an array of objects.</span>');
      output.innerHTML = '';
      return;
    }

    const classes = buildDartClasses(shape, rootName, nullableEl.checked);
    const freezed = style === 'freezed';
    const code = generateDart(classes, {
      style, fileBase, copyWith: !freezed && copyWithEl.checked, toStr: !freezed && toStringEl.checked
    });
    output.innerHTML = highlightDart(code);
    output.dataset.raw = code;
    const rootNote = Array.isArray(parsed) ? ' · root is an array, so parse it with <code class="font-mono">(json as List).map(…)</code>' : '';
    setStatus('valid', `<span><strong>Generated ${classes.length} class${classes.length === 1 ? '' : 'es'}</strong>${rootNote}</span>`);
  }

  const generateDebounced = debounce(generate, 150);
  input.addEventListener('input', generateDebounced);
  classInput.addEventListener('input', () => { saveOptions(); generateDebounced(); });
  [nullableEl, copyWithEl, toStringEl].forEach((el) => el.addEventListener('change', () => { saveOptions(); generate(); }));
  styleBtns.forEach((b) => b.addEventListener('click', () => { style = b.dataset.dartStyle; syncControls(); saveOptions(); generate(); }));
  $('#dart-sample').addEventListener('click', () => { input.value = SAMPLE; generate(); });

  try {
    const saved = JSON.parse(store.get('mt-dart-options') || 'null');
    if (saved) {
      if (DART_SETUP[saved.style]) style = saved.style;
      if (typeof saved.className === 'string') classInput.value = saved.className;
      nullableEl.checked = !!saved.nullable;
      copyWithEl.checked = saved.copyWith !== false;
      toStringEl.checked = !!saved.toStr;
    }
  } catch { /* ignore corrupt saved options */ }

  input.value = SAMPLE;
  syncControls();
  generate();
}
