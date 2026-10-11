/* MicroTools — Flutter tools (flutter/index.html). Requires core.js. */
'use strict';

const FLUTTER_TOOLS = [
  { id: 'json-to-dart', name: 'JSON to Dart', icon: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9' },
  { id: 'env-to-dart', name: '.env to Dart', icon: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z' },
  { id: 'assets-to-dart', name: 'Assets to Dart', icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z' }
];

/* =========================================================
   JSON → Dart model generator
   ========================================================= */
const DART_RESERVED = new Set(('assert await break case catch class const continue default do else enum extends false final finally for if in is ' +
  'new null rethrow return super switch this throw true try var void while with yield hashCode runtimeType toString noSuchMethod ' +
  'toJson fromJson copyWith props stringify').split(' '));
const DART_CORE_TYPES = new Set(('Object String List Map Set Iterable Iterator Type Function Symbol Null Never Future Stream DateTime Duration ' +
  'Uri Error Exception Record Enum Pattern Match RegExp Comparable Sink BigInt StackTrace StringBuffer Equatable JsonKey').split(' '));
const DART_KEYWORDS = new Set('abstract class const extends factory final get import override part required return this null true false with dynamic bool int double num'.split(' '));

/** PascalCase restricted to ASCII letters/digits (valid Dart identifier characters). */
const dartPascal = (s) => splitWords(String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')) // é → e
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  .join('')
  .replace(/[^A-Za-z0-9]/g, '');

function dartClassName(s) {
  const p = dartPascal(s);
  if (!p) return 'Model';
  if (/^\d/.test(p)) return `Model${p}`;
  return DART_CORE_TYPES.has(p) ? `${p}Model` : p;
}

function dartFieldName(key) {
  const p = dartPascal(key);
  if (!p) return 'field';
  let name = /^\d/.test(p) ? `field${p}` : p.charAt(0).toLowerCase() + p.slice(1);
  if (DART_RESERVED.has(name)) name += 'Value';
  return name;
}

function singularize(w) {
  if (/ies$/i.test(w) && w.length > 4) return w.slice(0, -3) + 'y';
  if (/(ss|x|ch|sh)es$/i.test(w)) return w.slice(0, -2);
  if (/[^sui]s$/i.test(w) && w.length > 3) return w.slice(0, -1);
  return `${w}Item`;
}

const dartString = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;

/** Describes the structure of a JSON value; arrays merge all elements into one shape. */
function shapeOf(v) {
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

function mergeShapes(a, b) {
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
function buildDartClasses(rootShape, rootName, allNullable) {
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

const isDartDynamic = (t) => t.kind === 'prim' && t.name === 'dynamic';
const dartTypeStr = (t) => t.kind === 'list'
  ? `List<${dartTypeStr(t.item)}${t.itemNullable && !isDartDynamic(t.item) ? '?' : ''}>`
  : t.name;
const dartDeclType = (t, nullable) => dartTypeStr(t) + (nullable && !isDartDynamic(t) ? '?' : '');
const dartNeedsConversion = (t) => t.kind === 'obj' || (t.kind === 'list' && dartNeedsConversion(t.item));
const dartHasNested = (c) => c.fields.some((f) => dartNeedsConversion(f.type));

function dartFromJsonExpr(t, nullable, src, depth) {
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

function dartToJsonExpr(t, nullable, ref, depth) {
  const q = nullable ? '?' : '';
  if (t.kind === 'obj') return `${ref}${q}.toJson()`;
  if (t.kind === 'prim' || !dartNeedsConversion(t.item)) return ref;
  const v = depth ? `e${depth + 1}` : 'e';
  return `${ref}${q}.map((${v}) => ${dartToJsonExpr(t.item, t.itemNullable, v, depth + 1)}).toList()`;
}

function genDartClass(c, opts) {
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

function genFreezedClass(c) {
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

function generateDart(classes, opts) {
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

function highlightDart(code) {
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

const DART_SETUP = {
  plain: '# No packages needed: plain Dart classes.',
  equatable: 'flutter pub add equatable',
  json_serializable: 'flutter pub add json_annotation dev:build_runner dev:json_serializable\ndart run build_runner build --delete-conflicting-outputs',
  freezed: 'flutter pub add freezed_annotation json_annotation dev:build_runner dev:freezed dev:json_serializable\ndart run build_runner build --delete-conflicting-outputs'
};

function initDart() {
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

/* =========================================================
   .env → Dart (obfuscated class or --dart-define setup)
   ========================================================= */

/** Index of the quote closing `s[0]`, or -1. Double quotes allow backslash escapes; single quotes are literal. */
function findClosingQuote(s, q) {
  for (let i = 1; i < s.length; i++) {
    if (q === '"' && s[i] === '\\') { i++; continue; }
    if (s[i] === q) return i;
  }
  return -1;
}

/** Parses .env text. Returns the variables (last duplicate wins) and human-readable notes about skipped lines. */
function parseDotEnv(src) {
  const vars = new Map();
  const notes = [];
  src.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    const at = `line ${idx + 1}`;
    if (!line || line.startsWith('#')) return;
    const m = line.match(/^(?:export\s+)?([^=\s]+)\s*=\s*(.*)$/);
    if (!m) { notes.push(`${at}: no '=' found, skipped`); return; }
    const [, key, rest] = m;
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(key)) { notes.push(`${at}: '${key}' is not a valid variable name, skipped`); return; }
    let value;
    if (rest[0] === '"' || rest[0] === "'") {
      const end = findClosingQuote(rest, rest[0]);
      if (end < 0) { notes.push(`${at}: unterminated quote, skipped`); return; }
      value = rest.slice(1, end);
      if (rest[0] === '"') value = value.replace(/\\([nrt"\\])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\' }[c]));
    } else {
      // Unquoted: a ' #' starts an inline comment (the leading space also handles `KEY= # comment`).
      value = ` ${rest}`.replace(/\s+#.*$/, '').trim();
    }
    if (vars.has(key)) notes.push(`${at}: '${key}' is defined again and overrides the earlier value`);
    vars.set(key, value);
  });
  return { vars, notes };
}

function envValueType(value, infer) {
  if (!infer) return 'String';
  if (/^(true|false)$/i.test(value)) return 'bool';
  if (/^-?\d{1,18}$/.test(value)) return 'int';
  if (/^-?\d+\.\d+$/.test(value)) return 'double';
  return 'String';
}

function envFields(vars, infer) {
  const used = new Set();
  return [...vars].map(([key, value]) => {
    let name = dartFieldName(key);
    const base = name;
    for (let i = 2; used.has(name); i++) name = base + i;
    used.add(name);
    return { key, value, name, type: envValueType(value, infer) };
  });
}

const envUtf8 = new TextEncoder();

/** XORs the UTF-8 bytes of `value` with a fresh cryptographically random key of the same length. */
function xorObfuscate(value) {
  const bytes = envUtf8.encode(value);
  const key = crypto.getRandomValues(new Uint8Array(bytes.length));
  return { data: Array.from(bytes, (b, i) => b ^ key[i]), key: Array.from(key) };
}

function dartIntList(arr, indent) {
  if (!arr.length) return 'const <int>[]';
  if (arr.length <= 16) return `const [${arr.join(', ')}]`;
  const rows = [];
  for (let i = 0; i < arr.length; i += 16) rows.push(`${indent}  ${arr.slice(i, i + 16).join(', ')},`);
  return `const [\n${rows.join('\n')}\n${indent}]`;
}

function generateEnvObfuscated(fields, className) {
  const I = '  ';
  const members = fields.map((f) => {
    const { data, key } = xorObfuscate(f.value);
    const call = `_decode(\n${I}${I}${dartIntList(data, I + I)},\n${I}${I}${dartIntList(key, I + I)},\n${I})`;
    const expr = f.type === 'int' ? `int.parse(${call})`
      : f.type === 'double' ? `double.parse(${call})`
      : f.type === 'bool' ? `${call}.toLowerCase() == 'true'`
      : call;
    return `${I}/// ${f.key}\n${I}static final ${f.type} ${f.name} = ${expr};`;
  });
  return [
    '// Generated by MicroTools. Do not commit this file.',
    '// Values are XOR-obfuscated so they do not appear as plain strings in the',
    '// binary. This is not encryption: the key ships alongside the data.',
    "import 'dart:convert';",
    '',
    `abstract final class ${className} {`,
    ...members.flatMap((m) => [m, '']),
    `${I}static String _decode(List<int> data, List<int> key) =>`,
    `${I}${I}${I}utf8.decode([for (var i = 0; i < data.length; i++) data[i] ^ key[i]]);`,
    '}',
    ''
  ].join('\n');
}

function generateEnvDefine(fields, className) {
  const I = '  ';
  const members = fields.map((f) => {
    // There is no double.fromEnvironment, so doubles stay Strings here.
    const type = f.type === 'double' ? 'String' : f.type;
    return `${I}/// ${f.key}\n${I}static const ${type} ${f.name} = ${type}.fromEnvironment(${dartString(f.key)});`;
  });
  return [
    '// Values are compiled in at build time:',
    '//   flutter run --dart-define-from-file=dart_defines.json',
    `abstract final class ${className} {`,
    members.join('\n\n'),
    '}',
    ''
  ].join('\n');
}

function envDefinesJson(fields) {
  // bool.fromEnvironment only accepts the exact string "true", so inferred bools are lower-cased.
  return `${JSON.stringify(Object.fromEntries(fields.map((f) => [f.key, f.type === 'bool' ? f.value.toLowerCase() : f.value])), null, 2)}\n`;
}

const ENV_NOTES = {
  obfuscated: 'Obfuscation is not encryption. The decoding key ships inside your app next to the data, so a determined attacker can recover every value. It only stops casual string dumps. Use it for client-side keys (Maps, Firebase, Sentry DSN) and keep real secrets on your server.',
  define: 'Values passed with --dart-define are compiled into the app as plain text and can be extracted from the APK or IPA. This keeps secrets out of your source code and git history, not out of the app. Keep real secrets on your server.'
};

function initEnv() {
  const input = $('#env-input');
  const output = $('#env-output');
  const status = $('#env-status');
  const classInput = $('#env-class');
  const inferEl = $('#env-infer');
  const modeBtns = $$('[data-env-mode]');
  const jsonWrap = $('#env-json-wrap');
  const jsonOut = $('#env-json');
  const setup = $('#env-setup');
  let mode = 'obfuscated';

  const SAMPLE = [
    '# Sample .env: replace with your own values',
    'API_BASE_URL=https://api.example.com',
    'API_KEY="sk_test_51Hc9ExampleKey"',
    "MAPS_KEY='AIzaSyExample-123'",
    'TIMEOUT_SECONDS=30',
    'ENABLE_LOGS=true',
    'SENTRY_DSN=https://abc@o0.ingest.sentry.io/0  # inline comments are ignored',
    'export APP_NAME="My App"',
    ''
  ].join('\n');

  const saveOptions = () => store.set('mt-env-options', JSON.stringify({ mode, className: classInput.value, infer: inferEl.checked }));
  const setStatus = (state, html) => { status.dataset.state = state; input.dataset.state = state === 'idle' ? '' : state; status.innerHTML = html; };

  function syncControls() {
    modeBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.envMode === mode)));
    $('#env-note').textContent = ENV_NOTES[mode];
    jsonWrap.hidden = mode !== 'define';
    setup.parentElement.classList.toggle('xl:col-span-2', mode !== 'define');
  }

  function generate() {
    const className = dartClassName(classInput.value.trim() || 'Env');
    const fileBase = splitWords(className).map((w) => w.toLowerCase()).join('_');
    $('#env-filename').textContent = `· lib/${fileBase}.dart`;
    setup.textContent = mode === 'define'
      ? `# .gitignore\n.env\ndart_defines.json\n\nflutter run --dart-define-from-file=dart_defines.json\nflutter build apk --dart-define-from-file=dart_defines.json --obfuscate --split-debug-info=build/symbols`
      : `# .gitignore (this file contains your values)\n.env\nlib/${fileBase}.dart\n\n# Release builds: also obfuscate Dart symbol names\nflutter build apk --obfuscate --split-debug-info=build/symbols`;
    output.dataset.raw = '';
    jsonOut.dataset.raw = '';

    const { vars, notes } = parseDotEnv(input.value);
    if (!vars.size) {
      output.innerHTML = '';
      jsonOut.innerHTML = '';
      if (notes.length) setStatus('invalid', `<span><strong>No variables found</strong> · ${escapeText(notes.join(' · '))}</span>`);
      else setStatus('idle', 'Paste a .env file to generate Dart code.');
      return;
    }

    const fields = envFields(vars, inferEl.checked);
    const code = mode === 'define' ? generateEnvDefine(fields, className) : generateEnvObfuscated(fields, className);
    output.innerHTML = highlightDart(code);
    output.dataset.raw = code;
    if (mode === 'define') {
      const json = envDefinesJson(fields);
      jsonOut.innerHTML = highlightJson(json);
      jsonOut.dataset.raw = json;
    }
    const summary = `<strong>${fields.length} variable${fields.length === 1 ? '' : 's'}</strong>`;
    setStatus('valid', `<span>${summary}${notes.length ? ` · <span class="font-normal">${escapeText(notes.join(' · '))}</span>` : ''}</span>`);
  }

  const generateDebounced = debounce(generate, 150);
  input.addEventListener('input', generateDebounced);
  classInput.addEventListener('input', () => { saveOptions(); generateDebounced(); });
  inferEl.addEventListener('change', () => { saveOptions(); generate(); });
  modeBtns.forEach((b) => b.addEventListener('click', () => { mode = b.dataset.envMode; syncControls(); saveOptions(); generate(); }));
  $('#env-sample').addEventListener('click', () => { input.value = SAMPLE; generate(); });

  try {
    const saved = JSON.parse(store.get('mt-env-options') || 'null');
    if (saved) {
      if (ENV_NOTES[saved.mode]) mode = saved.mode;
      if (typeof saved.className === 'string') classInput.value = saved.className;
      inferEl.checked = saved.infer !== false;
    }
  } catch { /* ignore corrupt saved options */ }

  input.value = SAMPLE;
  syncControls();
  generate();
}

/* =========================================================
   Assets folder → assets.dart
   ========================================================= */
const ASSET_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'wbmp', 'svg']);
const ASSET_VARIANT_DIR = /^\d+(\.\d+)?x$/; // Flutter resolution variants: 2.0x/, 3.0x/

const assetDir = (p) => p.slice(0, p.lastIndexOf('/') + 1);
const assetFile = (p) => p.slice(p.lastIndexOf('/') + 1);
const assetBase = (p) => assetFile(p).replace(/\.[^.]+$/, '');
const assetExt = (p) => assetFile(p).split('.').pop().toLowerCase();

/** Splits relative paths into usable assets (sorted by folder, then name), skipped resolution variants and ignored files. */
function classifyAssetPaths(paths) {
  const assets = new Set();
  const ignored = [];
  let variants = 0;
  for (const raw of paths) {
    const segs = raw.split('/').filter(Boolean);
    const name = segs[segs.length - 1] || '';
    if (segs.some((s) => s.startsWith('.')) || !name.includes('.') || !ASSET_EXTS.has(assetExt(name))) { ignored.push(name); continue; }
    if (segs.slice(0, -1).some((s) => ASSET_VARIANT_DIR.test(s))) { variants++; continue; }
    assets.add(segs.join('/'));
  }
  const sorted = [...assets].sort((a, b) => assetDir(a).localeCompare(assetDir(b)) || assetFile(a).localeCompare(assetFile(b)));
  return { assets: sorted, ignored, variants };
}

/** Makes every name in `names` unique by appending 2, 3, … (also avoiding `taken`). */
function uniqueNames(names, taken = new Set()) {
  const used = new Set(taken);
  return names.map((n) => { let u = n; for (let i = 2; used.has(u); i++) u = n + i; used.add(u); return u; });
}

/** Dart identifiers for the files in one scope: file name, then name + extension, then full path, for clashing names only. */
function assetNames(paths, taken = new Set()) {
  // The full-path form leaves out a first folder shared by every path (e.g. assets/images/logo.svg → imagesLogoSvg).
  const first = paths.length ? paths[0].split('/')[0] : '';
  const shared = paths.every((p) => p.includes('/') && p.split('/')[0] === first);
  const relPath = (p) => (shared ? p.slice(first.length + 1) : p);
  const forms = [
    (p) => dartFieldName(assetBase(p)),
    (p) => dartFieldName(`${assetBase(p)}_${assetExt(p)}`),
    (p) => dartFieldName(`${relPath(p).replace(/\.[^.]+$/, '')}_${assetExt(p)}`)
  ];
  let names = paths.map(forms[0]);
  for (let level = 1; level < forms.length; level++) {
    const counts = {};
    names.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
    names = names.map((n, i) => (counts[n] > 1 || taken.has(n) ? forms[level](paths[i]) : n));
  }
  return uniqueNames(names, taken);
}

const assetsHeader = (count) => `// Generated by MicroTools from ${count} asset${count === 1 ? '' : 's'}. Regenerate when files change.`;

function generateAssetsFlat(paths, className) {
  const names = assetNames(paths);
  const lines = [];
  let lastDir = null;
  paths.forEach((p, i) => {
    const dir = assetDir(p);
    if (dir !== lastDir) {
      if (lastDir !== null) lines.push('');
      lines.push(`  // ${dir || '(root)'}`);
      lastDir = dir;
    }
    lines.push(`  static const String ${names[i]} = ${dartString(p)};`);
  });
  return [assetsHeader(paths.length), `abstract final class ${className} {`, ...lines, '}', ''].join('\n');
}

/** Folder tree of the asset paths. A first folder shared by every path (usually `assets/`) becomes the root. */
function buildAssetTree(paths) {
  const first = paths[0].split('/')[0];
  const strip = paths.every((p) => p.includes('/') && p.split('/')[0] === first) ? 1 : 0;
  const root = { dirs: new Map(), files: [], segs: [] };
  for (const p of paths) {
    let node = root;
    const segs = p.split('/').slice(strip, -1);
    segs.forEach((s, i) => {
      if (!node.dirs.has(s)) node.dirs.set(s, { dirs: new Map(), files: [], segs: segs.slice(0, i + 1) });
      node = node.dirs.get(s);
    });
    node.files.push(p);
  }
  return root;
}

function generateAssetsNested(paths, className) {
  const root = buildAssetTree(paths);
  const classNames = new Set([className]);
  const blocks = [];

  function emit(node, cls, isRoot) {
    const dirs = [...node.dirs];
    const dirNames = uniqueNames(dirs.map(([name]) => dartFieldName(name)));
    const fileNames = assetNames(node.files, new Set(dirNames));
    const childClasses = dirs.map(([, child]) => {
      // Public `$`-prefixed names (flutter_gen convention) avoid the library_private_types_in_public_api lint.
      const base = `$${className}${child.segs.map((s) => dartPascal(s) || 'Folder').join('')}`;
      const [name] = uniqueNames([base], classNames);
      classNames.add(name);
      return name;
    });
    const members = isRoot
      ? [...dirs.map((_, i) => `  static const ${childClasses[i]} ${dirNames[i]} = ${childClasses[i]}();`),
         ...node.files.map((p, i) => `  static const String ${fileNames[i]} = ${dartString(p)};`)]
      : [`  const ${cls}();`, '',
         ...dirs.map((_, i) => `  ${childClasses[i]} get ${dirNames[i]} => const ${childClasses[i]}();`),
         ...node.files.map((p, i) => `  String get ${fileNames[i]} => ${dartString(p)};`)];
    blocks.push([`${isRoot ? 'abstract final' : 'final'} class ${cls} {`, ...members, '}'].join('\n'));
    dirs.forEach(([, child], i) => emit(child, childClasses[i], false));
  }

  emit(root, className, true);
  return [assetsHeader(paths.length), blocks.join('\n\n'), ''].join('\n');
}

/** pubspec.yaml entries: Flutter does not include subfolders automatically, so every folder is listed. */
function assetsPubspec(paths) {
  const entries = [...new Set(paths.map((p) => assetDir(p) || p))].sort();
  return `flutter:\n  assets:\n${entries.map((e) => `    - ${e}`).join('\n')}\n`;
}

function readDirEntries(dirEntry) {
  const reader = dirEntry.createReader();
  const all = [];
  return new Promise((resolve, reject) => {
    // readEntries returns results in batches; keep reading until an empty batch.
    const next = () => reader.readEntries((batch) => { if (!batch.length) resolve(all); else { all.push(...batch); next(); } }, reject);
    next();
  });
}

/** Walks a File System Access API handle (Chrome/Edge). Unlike readEntries, this also works on file:// pages. */
async function collectHandlePaths(handle, prefix, out) {
  const path = prefix + handle.name;
  if (handle.kind === 'file') { out.push(path); return; }
  if (handle.name.startsWith('.')) { out.push(path); return; } // e.g. .git: report as ignored, don't walk it
  for await (const child of handle.values()) await collectHandlePaths(child, `${path}/`, out);
}

async function collectEntryPaths(entry, out) {
  if (entry.isFile) { out.push(entry.fullPath.replace(/^\//, '')); return; }
  if (!entry.isDirectory) return;
  if (entry.name.startsWith('.')) { out.push(entry.fullPath.replace(/^\//, '')); return; } // e.g. .git: report as ignored, don't walk it
  for (const child of await readDirEntries(entry)) await collectEntryPaths(child, out);
}

function initAssets() {
  const drop = $('#assets-drop');
  const picker = $('#assets-picker');
  const output = $('#assets-output');
  const pubspec = $('#assets-pubspec');
  const status = $('#assets-status');
  const classInput = $('#assets-class');
  const prefixInput = $('#assets-prefix');
  const styleBtns = $$('[data-assets-style]');
  let style = 'flat';
  let rawPaths = [];
  let prefixEdited = false;

  const SAMPLE = [
    'assets/images/logo.png', 'assets/images/splash.jpg', 'assets/images/2.0x/logo.png', 'assets/images/3.0x/logo.png',
    'assets/icons/home.svg', 'assets/icons/settings.svg', 'assets/icons/arrow-back.svg', 'assets/icons/logo.svg',
    'assets/illustrations/onboarding_1.webp', 'assets/illustrations/onboarding_2.webp',
    'assets/.DS_Store', 'assets/fonts/Inter-Regular.ttf'
  ];

  const saveOptions = () => store.set('mt-assets-options', JSON.stringify({ style, className: classInput.value }));
  const setStatus = (state, html) => { status.dataset.state = state; status.innerHTML = html; };
  const normalizedPrefix = () => {
    const p = prefixInput.value.trim().replace(/^\/+/, '');
    return p && !p.endsWith('/') ? `${p}/` : p;
  };

  function generate() {
    const className = dartClassName(classInput.value.trim() || 'Assets');
    const fileBase = splitWords(className).map((w) => w.toLowerCase()).join('_');
    $('#assets-filename').textContent = `· lib/${fileBase}.dart`;
    output.dataset.raw = pubspec.dataset.raw = '';
    output.innerHTML = pubspec.innerHTML = '';

    if (!rawPaths.length) { setStatus('idle', 'Drop a folder to generate your assets class.'); return; }

    const { assets, ignored, variants } = classifyAssetPaths(rawPaths);
    const notes = [];
    if (variants) notes.push(`${variants} resolution variant${variants === 1 ? '' : 's'} skipped (Flutter picks 2.0x/3.0x automatically)`);
    if (ignored.length) notes.push(`${ignored.length} non-image file${ignored.length === 1 ? '' : 's'} ignored: ${ignored.slice(0, 4).join(', ')}${ignored.length > 4 ? '…' : ''}`);
    const noteHtml = notes.length ? ` · <span class="font-normal">${escapeText(notes.join(' · '))}</span>` : '';
    if (!assets.length) { setStatus('invalid', `<span><strong>No images or SVGs found</strong>${noteHtml}</span>`); return; }

    const paths = assets.map((p) => normalizedPrefix() + p);
    const code = style === 'nested' ? generateAssetsNested(paths, className) : generateAssetsFlat(paths, className);
    const yaml = assetsPubspec(paths);
    output.innerHTML = highlightDart(code);
    output.dataset.raw = code;
    pubspec.textContent = yaml;
    pubspec.dataset.raw = yaml;
    const folders = new Set(paths.map(assetDir)).size;
    setStatus('valid', `<span><strong>${paths.length} asset${paths.length === 1 ? '' : 's'} in ${folders} folder${folders === 1 ? '' : 's'}</strong>${noteHtml}</span>`);
  }

  function load(paths) {
    rawPaths = paths;
    // Paths should start at the project's assets folder; if a subfolder was dropped, suggest the assets/ prefix.
    if (!prefixEdited && paths.length) prefixInput.value = paths.every((p) => p.split('/')[0] === 'assets') ? '' : 'assets/';
    generate();
  }

  // Keep a missed drop from navigating the browser to the dropped file.
  ['dragover', 'drop'].forEach((type) => window.addEventListener(type, (e) => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault();
  }));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.dataset.drag = 'true'; });
  drop.addEventListener('dragleave', (e) => { if (!drop.contains(e.relatedTarget)) drop.dataset.drag = 'false'; });
  drop.addEventListener('drop', async (e) => {
    e.preventDefault();
    drop.dataset.drag = 'false';
    // Both APIs must be called synchronously, before the first await, or the drop data is gone.
    const items = [...e.dataTransfer.items].filter((item) => item.kind === 'file');
    const handles = items.map((item) => (item.getAsFileSystemHandle ? item.getAsFileSystemHandle().catch(() => null) : null));
    const entries = items.map((item) => item.webkitGetAsEntry && item.webkitGetAsEntry());
    if (!items.length) return;
    setStatus('idle', 'Reading folder…');

    let paths = [];
    let lastError = null;
    try {
      // Preferred: File System Access API. The older entries API fails on file:// pages in Chrome (EncodingError).
      const resolved = await Promise.all(handles);
      if (!resolved.every(Boolean)) throw new Error('File System Access API unavailable');
      for (const h of resolved) await collectHandlePaths(h, '', paths);
    } catch (err) {
      lastError = err;
      paths = [];
      try {
        for (const entry of entries.filter(Boolean)) await collectEntryPaths(entry, paths);
        lastError = null;
      } catch (err2) {
        lastError = err2;
      }
    }
    if (lastError) {
      const hint = location.protocol === 'file:'
        ? 'This browser blocks reading dropped folders on pages opened as a local file. Use “choose a folder”, or open the site from a web server.'
        : 'Use the “choose a folder” button instead.';
      setStatus('invalid', `<span><strong>Could not read the dropped folder</strong> (${escapeText(lastError.name || 'Error')}). ${hint}</span>`);
      return;
    }
    load(paths);
  });
  $('#assets-pick').addEventListener('click', () => picker.click());
  picker.addEventListener('change', () => { load([...picker.files].map((f) => f.webkitRelativePath || f.name)); picker.value = ''; });

  classInput.addEventListener('input', () => { saveOptions(); generate(); });
  prefixInput.addEventListener('input', () => { prefixEdited = true; generate(); });
  styleBtns.forEach((b) => b.addEventListener('click', () => {
    style = b.dataset.assetsStyle;
    styleBtns.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    saveOptions();
    generate();
  }));
  $('#assets-sample').addEventListener('click', () => load(SAMPLE));
  $('#assets-clear').addEventListener('click', () => { prefixEdited = false; prefixInput.value = ''; load([]); });

  try {
    const saved = JSON.parse(store.get('mt-assets-options') || 'null');
    if (saved) {
      if (saved.style === 'nested' || saved.style === 'flat') style = saved.style;
      if (typeof saved.className === 'string') classInput.value = saved.className;
    }
  } catch { /* ignore corrupt saved options */ }
  styleBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.assetsStyle === style)));
  load(SAMPLE);
}

/* =========================================================
   Boot
   ========================================================= */
$('#year').textContent = new Date().getFullYear();
hydrateCopyButtons();
initTheme();
initDart();
initEnv();
initAssets();
initToolRouter(FLUTTER_TOOLS, { storageKey: 'mt-last-flutter-tool' });
initAds();
