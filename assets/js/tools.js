/* MicroTools — general tools (index.html). Requires core.js. */
'use strict';

const TOOLS = [
  { id: 'luhn', name: 'Luhn Validator', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z' },
  { id: 'card-generator', name: 'Test Card Generator', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zM16.5 12.75h1.5' },
  { id: 'json', name: 'JSON Formatter', icon: 'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5' },
  { id: 'password', name: 'Password Generator', icon: 'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z' },
  { id: 'rsa', name: 'RSA Keys (PEM)', icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z' },
  { id: 'uuid', name: 'UUID Generator', icon: 'M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5' },
  { id: 'lorem', name: 'Lorem Ipsum', icon: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12' },
  { id: 'epoch', name: 'Epoch Converter', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'base64', name: 'Base64 Encode/Decode', icon: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5' },
  { id: 'base64-image', name: 'Base64 Image Viewer', icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z' },
  { id: 'case', name: 'Case Converter', icon: 'M3 19.5L7.5 6l4.5 13.5M4.5 15h6m4.5-2.25c0-1.243 1.007-2.25 2.25-2.25s2.25 1.007 2.25 2.25v6.75m0-3.75h-2.625a1.875 1.875 0 100 3.75H19.5' }
];

/* =========================================================
   1. Luhn validator
   ========================================================= */
function luhnIsValid(digits) {
  let sum = 0, dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/** Check digit that should be appended to `payload` to make it Luhn-valid. */
function luhnCheckDigit(payload) {
  let sum = 0, dbl = true;
  for (let i = payload.length - 1; i >= 0; i--) {
    let d = payload.charCodeAt(i) - 48;
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return (10 - (sum % 10)) % 10;
}

const CARD_TYPES = [
  { name: 'American Express', re: /^3[47]/, lengths: [15], groups: [4, 6, 5] },
  { name: 'Visa', re: /^4/, lengths: [13, 16, 19] },
  { name: 'Mastercard', re: /^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/, lengths: [16] },
  { name: 'Discover', re: /^(6011|65|64[4-9])/, lengths: [16, 19] },
  { name: 'JCB', re: /^35(2[89]|[3-8])/, lengths: [16, 17, 18, 19] },
  { name: 'Diners Club', re: /^3(0[0-5]|[689])/, lengths: [14, 16, 19], groups: [4, 6, 4] },
  { name: 'UnionPay', re: /^62/, lengths: [16, 17, 18, 19] }
];

function detectLuhnType(digits) {
  const card = CARD_TYPES.find((c) => c.re.test(digits));
  // A 15-digit number is only a card if that issuer actually uses 15 digits (e.g. Amex); otherwise it's an IMEI.
  if (card && !(digits.length === 15 && !card.lengths.includes(15))) return { name: card.name, lengths: card.lengths, groups: card.groups };
  if (digits.length === 15) return { name: 'IMEI', lengths: [15], groups: [2, 6, 6, 1] };
  return { name: digits.length > 15 ? 'Card (unknown issuer)' : 'Unknown', lengths: null };
}

function formatGroups(digits, groups) {
  if (!groups) return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  const out = [];
  let i = 0;
  for (const g of groups) { if (i >= digits.length) break; out.push(digits.slice(i, i + g)); i += g; }
  if (i < digits.length) out.push(digits.slice(i));
  return out.join(' ');
}

function initLuhn() {
  const input = $('#luhn-input');
  const status = $('#luhn-status');
  const els = { type: $('#luhn-type'), length: $('#luhn-length'), check: $('#luhn-check'), expected: $('#luhn-expected'), formatted: $('#luhn-formatted') };

  const setStatus = (state, html) => { status.dataset.state = state; input.dataset.state = state === 'idle' ? '' : state; status.innerHTML = html; };
  const ICON_OK = '<svg class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  const ICON_BAD = '<svg class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';

  function update() {
    const raw = input.value;
    const digits = raw.replace(/[\s-]/g, '');
    els.length.textContent = /^\d*$/.test(digits) ? digits.length : '—';

    if (!raw.trim()) {
      setStatus('idle', 'Start typing a number to validate it.');
      Object.assign(els.type, { textContent: '—' });
      els.check.textContent = '—'; els.expected.textContent = '—'; els.formatted.textContent = '';
      return;
    }
    if (!/^\d+$/.test(digits)) {
      setStatus('invalid', `${ICON_BAD}<span>Only digits, spaces and dashes are allowed.</span>`);
      els.type.textContent = '—'; els.check.textContent = '—'; els.expected.textContent = '—'; els.formatted.textContent = '';
      return;
    }

    const type = detectLuhnType(digits);
    const expected = luhnCheckDigit(digits.slice(0, -1));
    els.type.textContent = type.name;
    els.check.textContent = digits.slice(-1);
    els.expected.textContent = digits.length > 1 ? expected : '—';
    els.formatted.textContent = formatGroups(digits, type.groups);

    if (digits.length < 8) {
      setStatus('invalid', `${ICON_BAD}<span>Too short — keep typing (${digits.length} digit${digits.length === 1 ? '' : 's'}).</span>`);
      return;
    }
    if (luhnIsValid(digits)) {
      const lengthWarn = type.lengths && !type.lengths.includes(digits.length)
        ? ` <span class="font-normal opacity-80">(passes checksum, but ${type.name} numbers are usually ${type.lengths.join('/')} digits)</span>` : '';
      setStatus('valid', `${ICON_OK}<span>Valid — passes the Luhn checksum.${lengthWarn}</span>`);
    } else {
      setStatus('invalid', `${ICON_BAD}<span>Invalid — fails the Luhn checksum. The last digit should be <strong class="font-mono">${expected}</strong>.</span>`);
    }
  }

  input.addEventListener('input', update);
  $$('[data-luhn-sample]').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.luhnSample; update(); input.focus(); }));
  update();
}

/* =========================================================
   Test card number generator
   ========================================================= */
// Issuer prefix ranges (inclusive, equal-length strings) and card length per brand.
const TEST_CARD_BRANDS = {
  visa: { name: 'Visa', ranges: [['4', '4']], length: 16 },
  mastercard: { name: 'Mastercard', ranges: [['51', '55'], ['2221', '2720']], length: 16 },
  amex: { name: 'American Express', ranges: [['34', '34'], ['37', '37']], length: 15 },
  discover: { name: 'Discover', ranges: [['6011', '6011'], ['65', '65'], ['644', '649']], length: 16 },
  jcb: { name: 'JCB', ranges: [['3528', '3589']], length: 16 },
  diners: { name: 'Diners Club', ranges: [['300', '305'], ['36', '36'], ['38', '39']], length: 14 },
  unionpay: { name: 'UnionPay', ranges: [['62', '62']], length: 16 }
};

function generateTestCard(brandKey) {
  const brand = TEST_CARD_BRANDS[brandKey];
  const [lo, hi] = brand.ranges[secureRandomInt(brand.ranges.length)];
  const prefix = String(Number(lo) + secureRandomInt(Number(hi) - Number(lo) + 1)).padStart(lo.length, '0');
  let body = prefix;
  while (body.length < brand.length - 1) body += secureRandomInt(10);
  const number = body + luhnCheckDigit(body);
  const now = new Date();
  const expiry = new Date(now.getFullYear(), now.getMonth() + 1 + secureRandomInt(60), 1); // 1–60 months ahead
  const cvvLength = brandKey === 'amex' ? 4 : 3;
  const cvv = Array.from({ length: cvvLength }, () => secureRandomInt(10)).join('');
  return { brand: brand.name, number, expiry: `${pad(expiry.getMonth() + 1)}/${String(expiry.getFullYear()).slice(-2)}`, cvv };
}

function formatTestCards(cards, { format, spaced, extras }) {
  const num = (c) => (spaced ? formatGroups(c.number, detectLuhnType(c.number).groups) : c.number);
  if (format === 'json') {
    return JSON.stringify(cards.map((c) => (extras ? { brand: c.brand, number: num(c), expiry: c.expiry, cvv: c.cvv } : { brand: c.brand, number: num(c) })), null, 2);
  }
  if (format === 'csv') {
    const quote = (v) => `"${v}"`;
    return [extras ? 'brand,number,expiry,cvv' : 'brand,number',
      ...cards.map((c) => [c.brand, num(c), ...(extras ? [c.expiry, c.cvv] : [])].map(quote).join(','))].join('\n');
  }
  const width = Math.max(...cards.map((c) => num(c).length));
  return cards.map((c) => (extras ? `${num(c).padEnd(width)}  ${c.expiry}  ${c.cvv.padEnd(4)}  ${c.brand}` : num(c))).join('\n');
}

function initCardGenerator() {
  const el = (id) => $(`#cardgen-${id}`);
  let cards = [];

  function render() {
    el('output').value = cards.length ? formatTestCards(cards, { format: el('format').value, spaced: el('spaced').checked, extras: el('extras').checked }) : '';
    el('summary').textContent = `${cards.length} test card${cards.length === 1 ? '' : 's'}`;
  }

  function generate() {
    const n = clamp(parseInt(el('count').value, 10) || 1, 1, 100);
    const keys = Object.keys(TEST_CARD_BRANDS);
    const brand = el('brand').value;
    cards = Array.from({ length: n }, () => generateTestCard(brand === 'mix' ? keys[secureRandomInt(keys.length)] : brand));
    render();
  }

  el('generate').addEventListener('click', generate);
  el('brand').addEventListener('change', generate);
  el('count').addEventListener('input', debounce(generate, 150));
  el('count').addEventListener('change', () => { el('count').value = clamp(parseInt(el('count').value, 10) || 1, 1, 100); generate(); });
  ['format', 'spaced', 'extras'].forEach((id) => el(id).addEventListener('change', render));
  generate();
}

/* =========================================================
   2. JSON validator & formatter
   ========================================================= */
function initJson() {
  const input = $('#json-input');
  const output = $('#json-output');
  const indentSel = $('#json-indent');
  const status = $('#json-status');
  const statusText = $('#json-status-text');
  const gotoBtn = $('#json-goto');
  let errorPos = null;

  const SAMPLE = '{"name":"MicroTools","version":2,"private":true,"rating":4.9,"tags":["json","formatter","validator"],"author":{"name":"Ada Lovelace","email":null},"features":[{"id":1,"enabled":true},{"id":2,"enabled":false}]}';

  function process() {
    const src = input.value;
    errorPos = null;
    gotoBtn.classList.add('hidden');

    if (!src.trim()) {
      status.dataset.state = 'idle';
      input.dataset.state = '';
      statusText.textContent = 'Paste or type JSON to validate it.';
      output.innerHTML = '';
      output.dataset.raw = '';
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(src);
    } catch (nativeErr) {
      const err = findJsonError(src) || { pos: src.length, msg: nativeErr.message };
      const { line, col } = lineColAt(src, err.pos);
      errorPos = err.pos;
      status.dataset.state = 'invalid';
      input.dataset.state = 'invalid';
      statusText.innerHTML = `<strong>Invalid JSON</strong> — ${escapeText(err.msg)} <span class="whitespace-nowrap font-mono text-xs opacity-80">(line ${line}, column ${col})</span>`;
      gotoBtn.classList.remove('hidden');
      output.innerHTML = renderJsonErrorSnippet(src, err.pos);
      output.dataset.raw = '';
      return;
    }

    const mode = indentSel.value;
    const indent = mode === 'min' ? undefined : mode === 'tab' ? '\t' : Number(mode);
    const pretty = JSON.stringify(parsed, null, indent);
    const type = Array.isArray(parsed) ? `array · ${parsed.length} item${parsed.length === 1 ? '' : 's'}`
      : parsed !== null && typeof parsed === 'object' ? `object · ${Object.keys(parsed).length} key${Object.keys(parsed).length === 1 ? '' : 's'}`
      : typeof parsed;
    status.dataset.state = 'valid';
    input.dataset.state = 'valid';
    statusText.innerHTML = `<strong>Valid JSON</strong> <span class="font-mono text-xs opacity-80">${type} · ${formatBytes(new Blob([pretty]).size)}</span>`;
    output.innerHTML = highlightJson(pretty);
    output.dataset.raw = pretty;
  }

  const processDebounced = debounce(process, 120);
  input.addEventListener('input', processDebounced);
  indentSel.addEventListener('change', () => { store.set('mt-json-indent', indentSel.value); process(); });
  $('#json-sample').addEventListener('click', () => { input.value = SAMPLE; process(); });
  $('#json-clear').addEventListener('click', () => { input.value = ''; process(); input.focus(); });
  gotoBtn.addEventListener('click', () => {
    if (errorPos === null) return;
    const { line } = lineColAt(input.value, errorPos);
    input.focus();
    input.setSelectionRange(errorPos, Math.min(errorPos + 1, input.value.length));
    const lh = parseFloat(getComputedStyle(input).lineHeight) || 24;
    input.scrollTop = Math.max(0, (line - 4) * lh);
  });
  // Tab key inserts indentation inside the editor
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    const { selectionStart: s, selectionEnd: end } = input;
    input.setRangeText('  ', s, end, 'end');
    processDebounced();
  });

  const savedIndent = store.get('mt-json-indent');
  if (savedIndent && [...indentSel.options].some((o) => o.value === savedIndent)) indentSel.value = savedIndent;
  process();
}

/* =========================================================
   3. Password generator
   ========================================================= */
const PW_SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~|'
};

function generatePassword(length, setKeys) {
  const sets = setKeys.map((k) => PW_SETS[k]);
  const pool = sets.join('');
  // Guarantee at least one character from every selected set.
  const chars = sets.map((s) => s[secureRandomInt(s.length)]);
  while (chars.length < length) chars.push(pool[secureRandomInt(pool.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return { password: chars.join(''), poolSize: pool.length };
}

function humanizeSeconds(sec) {
  if (sec < 1) return 'instantly';
  const units = [['year', 31557600], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  for (const [name, s] of units) {
    if (sec >= s) {
      const v = sec / s;
      if (name === 'year' && v >= 1e6) {
        const exp = Math.floor(Math.log10(v));
        return exp > 15 ? 'longer than the age of the universe' : `~10^${exp} years`;
      }
      const n = Math.round(v);
      return `~${n.toLocaleString()} ${name}${n === 1 ? '' : 's'}`;
    }
  }
  return 'instantly';
}

function initPassword() {
  const out = $('#pw-output');
  const slider = $('#pw-length');
  const lengthLabel = $('#pw-length-value');
  const boxes = $$('[data-pw-set]');
  const bars = $$('.pw-bar');
  const strengthEl = $('#pw-strength');
  const entropyEl = $('#pw-entropy');
  const hint = $('#pw-hint');

  const LEVELS = [
    { max: 45, label: 'Weak', bars: 1, color: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
    { max: 64, label: 'Fair', bars: 2, color: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
    { max: 90, label: 'Strong', bars: 3, color: 'bg-lime-500', text: 'text-lime-600 dark:text-lime-400' },
    { max: Infinity, label: 'Very strong', bars: 4, color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' }
  ];
  const BAR_COLORS = LEVELS.map((l) => l.color);
  const IDLE_BAR = ['bg-zinc-200', 'dark:bg-zinc-800'];

  function generate() {
    const length = Number(slider.value);
    const keys = boxes.filter((b) => b.checked).map((b) => b.dataset.pwSet);
    lengthLabel.textContent = length;
    const { password, poolSize } = generatePassword(length, keys);
    out.textContent = password;

    const bits = length * Math.log2(poolSize);
    const level = LEVELS.find((l) => bits < l.max);
    bars.forEach((bar, idx) => {
      bar.classList.remove(...BAR_COLORS, ...IDLE_BAR);
      if (idx < level.bars) bar.classList.add(level.color);
      else bar.classList.add(...IDLE_BAR);
    });
    strengthEl.className = `font-semibold ${level.text}`;
    strengthEl.textContent = level.label;
    // Offline attack at 10 billion guesses/sec; on average half the keyspace is searched.
    const crackSeconds = Math.pow(2, bits - 1) / 1e10;
    entropyEl.textContent = `${Math.round(bits)} bits of entropy · cracked ${humanizeSeconds(crackSeconds)} at 10B guesses/s`;
  }

  slider.addEventListener('input', generate);
  boxes.forEach((box) => box.addEventListener('change', () => {
    if (!boxes.some((b) => b.checked)) {
      box.checked = true;
      hint.classList.remove('hidden');
      setTimeout(() => hint.classList.add('hidden'), 2500);
      return;
    }
    generate();
  }));
  $('#pw-regen').addEventListener('click', generate);
  generate();
}

/* =========================================================
   RSA key pair, encryption and signatures (Web Crypto)
   ========================================================= */
const RSA_HASH_BYTES = { 'SHA-256': 32, 'SHA-384': 48, 'SHA-512': 64 };
// DER AlgorithmIdentifier for rsaEncryption (OID 1.2.840.113549.1.1.1, NULL parameters).
const RSA_ALG_ID = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];

function concatBytes(parts) {
  const arrays = parts.map((p) => (p instanceof Uint8Array ? p : Uint8Array.from(p)));
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

const derLength = (n) => {
  if (n < 128) return [n];
  const bytes = [];
  while (n) { bytes.unshift(n & 0xff); n >>>= 8; }
  return [0x80 | bytes.length, ...bytes];
};

/** DER tag-length-value from one or more byte parts. */
function der(tag, ...parts) {
  const body = concatBytes(parts);
  return concatBytes([[tag, ...derLength(body.length)], body]);
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function base64ToBytes(input) {
  let s = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.replace(/=+$/, '').length % 4 === 1) throw new Error('Not valid Base64');
  s = s.replace(/=+$/, '');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

const derToPem = (bytes, label) => `-----BEGIN ${label}-----\n${bytesToBase64(bytes).match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`;

/** Reads a PEM key into the DER format Web Crypto imports (SPKI or PKCS#8), converting PKCS#1 RSA keys. */
function parseRsaPem(text, kind) {
  const m = text.match(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/);
  if (!m) throw new Error('Not a PEM key. Expected -----BEGIN … KEY----- and -----END … KEY----- lines.');
  const label = m[1];
  let body;
  try { body = base64ToBytes(m[2]); } catch { throw new Error('The PEM body is not valid Base64.'); }
  if (kind === 'public') {
    if (label === 'PUBLIC KEY') return body;
    if (label === 'RSA PUBLIC KEY') return der(0x30, RSA_ALG_ID, der(0x03, [0x00], body)); // PKCS#1 → SPKI
    if (label.includes('PRIVATE')) throw new Error('This is a private key. Paste it in the private key box.');
    if (label === 'CERTIFICATE') throw new Error('Certificates are not supported. Extract the key with: openssl x509 -pubkey -noout -in cert.pem');
  } else {
    if (label === 'PRIVATE KEY') return body;
    if (label === 'RSA PRIVATE KEY') return der(0x30, [0x02, 0x01, 0x00], RSA_ALG_ID, der(0x04, body)); // PKCS#1 → PKCS#8
    if (label === 'ENCRYPTED PRIVATE KEY') throw new Error('Password-protected keys are not supported. Remove the password with: openssl pkcs8 -in key.pem -out plain.pem');
    if (label.includes('PUBLIC')) throw new Error('This is a public key. Paste it in the public key box.');
  }
  throw new Error(`Unsupported PEM type "${label}".`);
}

async function importRsaKey(pem, kind, hash, scheme) {
  const data = parseRsaPem(pem, kind);
  const format = kind === 'public' ? 'spki' : 'pkcs8';
  const sigName = scheme === 'pss' ? 'RSA-PSS' : 'RSASSA-PKCS1-v1_5';
  try {
    const oaep = await crypto.subtle.importKey(format, data, { name: 'RSA-OAEP', hash }, false, [kind === 'public' ? 'encrypt' : 'decrypt']);
    const sig = await crypto.subtle.importKey(format, data, { name: sigName, hash }, false, [kind === 'public' ? 'verify' : 'sign']);
    return { oaep, sig, bits: oaep.algorithm.modulusLength };
  } catch {
    throw new Error('Could not import this key. Only RSA keys are supported.');
  }
}

function rsaSigParams(scheme, hash) {
  return scheme === 'pss' ? { name: 'RSA-PSS', saltLength: RSA_HASH_BYTES[hash] } : { name: 'RSASSA-PKCS1-v1_5' };
}

function initRsa() {
  const el = (id) => $(`#rsa-${id}`);
  const keys = { pub: null, priv: null };
  const seq = { keys: 0, enc: 0, dec: 0, sign: 0, ver: 0 }; // drop results from superseded async runs
  let generated = false;

  const opts = () => ({ hash: el('hash').value, scheme: el('scheme').value });
  const setKeyStatus = (state, html) => { el('key-status').dataset.state = state; el('key-status').innerHTML = html; };
  const setNote = (id, text, bad) => { el(id).textContent = text; el(id).className = `text-xs ${bad ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500 dark:text-zinc-400'}`; };

  async function encrypt() {
    const my = ++seq.enc;
    const text = el('enc-input').value;
    const bytes = utf8Encoder.encode(text);
    el('enc-output').value = '';
    if (!keys.pub) { el('enc-count').textContent = ''; setNote('enc-status', 'Add or generate a public key first.'); return; }
    const max = keys.pub.bits / 8 - 2 * RSA_HASH_BYTES[opts().hash] - 2;
    el('enc-count').textContent = `${bytes.length} / ${max} bytes`;
    if (!text) { setNote('enc-status', ''); return; }
    if (bytes.length > max) { setNote('enc-status', `Too long: RSA-OAEP with a ${keys.pub.bits}-bit key and ${opts().hash} can encrypt at most ${max} bytes.`, true); return; }
    const ct = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, keys.pub.oaep, bytes);
    if (my !== seq.enc) return;
    el('enc-output').value = bytesToBase64(new Uint8Array(ct));
    setNote('enc-status', 'Encrypted. RSA-OAEP output is randomized, so it changes every time.');
  }

  async function decrypt() {
    const my = ++seq.dec;
    const input = el('dec-input').value.trim();
    el('dec-output').value = '';
    el('dec-input').dataset.state = '';
    if (!input) { setNote('dec-status', ''); return; }
    if (!keys.priv) { setNote('dec-status', 'Add or generate a private key first.'); return; }
    let bytes;
    try { bytes = base64ToBytes(input); } catch { el('dec-input').dataset.state = 'invalid'; setNote('dec-status', 'The ciphertext is not valid Base64.', true); return; }
    try {
      const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, keys.priv.oaep, bytes));
      if (my !== seq.dec) return;
      el('dec-input').dataset.state = 'valid';
      try {
        el('dec-output').value = utf8Decoder.decode(plain);
        setNote('dec-status', 'Decrypted.');
      } catch {
        el('dec-output').value = bytesToBase64(plain);
        setNote('dec-status', 'Decrypted, but the result is binary data, so it is shown as Base64.');
      }
    } catch {
      if (my !== seq.dec) return;
      el('dec-input').dataset.state = 'invalid';
      setNote('dec-status', 'Decryption failed: wrong private key, a different hash setting, or corrupted ciphertext.', true);
    }
  }

  async function sign() {
    const my = ++seq.sign;
    const text = el('sign-input').value;
    el('sign-output').value = '';
    if (!keys.priv) { setNote('sign-status', 'Add or generate a private key first.'); return; }
    if (!text) { setNote('sign-status', ''); return; }
    const { hash, scheme } = opts();
    const sig = await crypto.subtle.sign(rsaSigParams(scheme, hash), keys.priv.sig, utf8Encoder.encode(text));
    if (my !== seq.sign) return;
    el('sign-output').value = bytesToBase64(new Uint8Array(sig));
    setNote('sign-status', `Signed with ${scheme === 'pss' ? 'RSA-PSS' : 'RSASSA-PKCS1-v1_5'} and ${hash}.`);
  }

  async function verify() {
    const my = ++seq.ver;
    const status = el('ver-status');
    // One wrapping span keeps the bold label and its text in a single flex item.
    const setVer = (state, html) => { status.dataset.state = state; status.innerHTML = `<span>${html}</span>`; };
    const message = el('ver-message').value;
    const sigText = el('ver-signature').value.trim();
    if (!keys.pub) { setVer('idle', 'Add or generate a public key first.'); return; }
    if (!message || !sigText) { setVer('idle', 'Enter a message and its signature.'); return; }
    let sig;
    try { sig = base64ToBytes(sigText); } catch { setVer('invalid', '<strong>Invalid</strong>: the signature is not valid Base64.'); return; }
    const { hash, scheme } = opts();
    const ok = await crypto.subtle.verify(rsaSigParams(scheme, hash), keys.pub.sig, sig, utf8Encoder.encode(message));
    if (my !== seq.ver) return;
    if (ok) setVer('valid', '<strong>Valid signature</strong>: this message was signed by the matching private key and has not been changed.');
    else setVer('invalid', '<strong>Invalid signature</strong>: the message was changed, the wrong key was used, or the signature scheme/hash differs.');
  }

  const runAll = () => { encrypt(); decrypt(); sign(); verify(); };

  async function loadKeys() {
    const my = ++seq.keys;
    const { hash, scheme } = opts();
    const pubPem = el('public').value.trim();
    const privPem = el('private').value.trim();
    const errors = [];
    let pub = null, priv = null;
    if (pubPem) {
      try { pub = await importRsaKey(pubPem, 'public', hash, scheme); el('public').dataset.state = 'valid'; }
      catch (e) { errors.push(`Public key: ${e.message}`); el('public').dataset.state = 'invalid'; }
    } else el('public').dataset.state = '';
    if (privPem) {
      try { priv = await importRsaKey(privPem, 'private', hash, scheme); el('private').dataset.state = 'valid'; }
      catch (e) { errors.push(`Private key: ${e.message}`); el('private').dataset.state = 'invalid'; }
    } else el('private').dataset.state = '';
    if (my !== seq.keys) return;
    keys.pub = pub;
    keys.priv = priv;

    if (errors.length) setKeyStatus('invalid', `<span>${errors.map(escapeText).join('<br>')}</span>`);
    else if (pub && priv) {
      // Check the pair matches by signing a probe with the private key and verifying it with the public key.
      const probe = utf8Encoder.encode('microtools-pair-check');
      const params = rsaSigParams(scheme, hash);
      const matches = await crypto.subtle.verify(params, pub.sig, await crypto.subtle.sign(params, priv.sig, probe), probe);
      if (my !== seq.keys) return;
      if (matches) setKeyStatus('valid', `<strong>RSA ${pub.bits}-bit key pair ready</strong>`);
      else setKeyStatus('invalid', '<span><strong>These keys are not a matching pair.</strong> Encrypt/decrypt and sign/verify between them will fail.</span>');
    } else if (pub || priv) setKeyStatus('valid', `<strong>RSA ${(pub || priv).bits}-bit ${pub ? 'public' : 'private'} key loaded</strong>`);
    else setKeyStatus('idle', 'Generate a key pair or paste your own PEM keys.');
    runAll();
  }

  async function generate() {
    const btn = el('generate');
    const bits = Number(el('size').value);
    btn.disabled = true;
    btn.textContent = 'Generating…';
    setKeyStatus('idle', `Generating a ${bits}-bit key pair${bits >= 4096 ? ' (this can take a few seconds)' : ''}…`);
    try {
      const pair = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: el('hash').value },
        true, ['encrypt', 'decrypt']);
      el('public').value = derToPem(new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey)), 'PUBLIC KEY');
      el('private').value = derToPem(new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey)), 'PRIVATE KEY');
      generated = true;
      await loadKeys();
    } catch (e) {
      setKeyStatus('invalid', `<span><strong>Key generation failed</strong>: ${escapeText(e.message || String(e))}</span>`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate key pair';
    }
  }

  const loadKeysDebounced = debounce(loadKeys, 250);
  el('generate').addEventListener('click', generate);
  el('public').addEventListener('input', loadKeysDebounced);
  el('private').addEventListener('input', loadKeysDebounced);
  el('hash').addEventListener('change', loadKeys);
  el('scheme').addEventListener('change', loadKeys);
  el('enc-input').addEventListener('input', debounce(encrypt, 200));
  el('dec-input').addEventListener('input', debounce(decrypt, 200));
  el('sign-input').addEventListener('input', debounce(sign, 200));
  el('ver-message').addEventListener('input', debounce(verify, 200));
  el('ver-signature').addEventListener('input', debounce(verify, 200));
  el('enc-send').addEventListener('click', () => { el('dec-input').value = el('enc-output').value; decrypt(); el('dec-input').scrollIntoView({ block: 'center', behavior: 'smooth' }); });
  el('sign-send').addEventListener('click', () => {
    el('ver-message').value = el('sign-input').value;
    el('ver-signature').value = el('sign-output').value;
    verify();
    el('ver-message').scrollIntoView({ block: 'center', behavior: 'smooth' });
  });

  el('enc-input').value = 'Hello from MicroTools!';
  el('sign-input').value = 'I approve this message.';
  // Generate the first key pair only when the tool is opened, so other tools don't pay for it.
  onActivate.rsa = () => { if (!generated && !el('public').value.trim() && !el('private').value.trim()) generate(); };
}

/* =========================================================
   4. UUID generator
   ========================================================= */
function uuidv4() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function initUuid() {
  const countEl = $('#uuid-count');
  const upperEl = $('#uuid-upper');
  const hyphensEl = $('#uuid-hyphens');
  const out = $('#uuid-output');
  const summary = $('#uuid-summary');
  let uuids = [];

  function render() {
    out.value = uuids.map((u) => {
      let s = hyphensEl.checked ? u : u.replace(/-/g, '');
      return upperEl.checked ? s.toUpperCase() : s;
    }).join('\n');
    summary.textContent = `${uuids.length} UUID${uuids.length === 1 ? '' : 's'}`;
  }

  function generate() {
    const n = clamp(parseInt(countEl.value, 10) || 1, 1, 1000);
    uuids = Array.from({ length: n }, uuidv4);
    render();
  }

  countEl.addEventListener('input', debounce(generate, 150));
  countEl.addEventListener('change', () => { countEl.value = clamp(parseInt(countEl.value, 10) || 1, 1, 1000); generate(); });
  upperEl.addEventListener('change', render);
  hyphensEl.addEventListener('change', render);
  $('#uuid-generate').addEventListener('click', generate);
  $$('[data-uuid-count]').forEach((b) => b.addEventListener('click', () => { countEl.value = b.dataset.uuidCount; generate(); }));
  generate();
}

/* =========================================================
   5. Lorem ipsum generator
   ========================================================= */
const LOREM_WORDS = Array.from(new Set((
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
  'enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in ' +
  'reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa ' +
  'qui officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nunc pulvinar sapien ligula viverra ' +
  'mauris fermentum vestibulum ante primis faucibus orci luctus ultrices posuere cubilia curae donec neque auctor aliquam ' +
  'vel ullamcorper massa porta integer feugiat scelerisque varius morbi tristique senectus netus malesuada fames turpis ' +
  'egestas pellentesque habitant leo sagittis purus semper lectus at volutpat diam venenatis tellus elementum blandit ' +
  'cursus risus suscipit gravida dictum fusce placerat mattis nibh praesent sodales rhoncus quam nisl condimentum facilisis'
).split(' ')));
const LOREM_OPENING = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
const LOREM_LIMITS = { paragraphs: 50, sentences: 200, words: 2000 };

const randRange = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function loremWords(n) {
  const words = [];
  while (words.length < n) {
    const w = LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)];
    if (w !== words[words.length - 1]) words.push(w);
  }
  return words;
}

function loremSentence() {
  const words = loremWords(randRange(6, 15));
  if (words.length > 8 && Math.random() < 0.6) {
    const at = randRange(3, words.length - 4);
    words[at] += ',';
  }
  return capitalize(words.join(' ')) + (Math.random() < 0.08 ? '?' : '.');
}

function loremParagraph(startClassic) {
  const count = randRange(4, 7);
  const sentences = Array.from({ length: count }, loremSentence);
  if (startClassic) sentences[0] = LOREM_OPENING;
  return sentences.join(' ');
}

function generateLorem(unit, count, classic) {
  if (unit === 'words') {
    const opening = LOREM_OPENING.replace(/[.,]/g, '').toLowerCase().split(' ');
    const words = classic ? opening.slice(0, count).concat(loremWords(Math.max(0, count - opening.length))) : loremWords(count);
    return capitalize(words.join(' ')) + '.';
  }
  if (unit === 'sentences') {
    const sentences = Array.from({ length: count }, loremSentence);
    if (classic) sentences[0] = LOREM_OPENING;
    return sentences.join(' ');
  }
  return Array.from({ length: count }, (_, i) => loremParagraph(classic && i === 0)).join('\n\n');
}

function initLorem() {
  const countEl = $('#lorem-count');
  const unitEl = $('#lorem-unit');
  const classicEl = $('#lorem-classic');
  const out = $('#lorem-output');
  const stats = $('#lorem-stats');

  function generate() {
    const max = LOREM_LIMITS[unitEl.value];
    countEl.max = max;
    const count = clamp(parseInt(countEl.value, 10) || 1, 1, max);
    const text = generateLorem(unitEl.value, count, classicEl.checked);
    out.value = text;
    const words = text.split(/\s+/).filter(Boolean).length;
    stats.textContent = `${words.toLocaleString()} words · ${text.length.toLocaleString()} characters`;
  }

  countEl.addEventListener('input', debounce(generate, 120));
  countEl.addEventListener('change', () => { countEl.value = clamp(parseInt(countEl.value, 10) || 1, 1, LOREM_LIMITS[unitEl.value]); generate(); });
  unitEl.addEventListener('change', () => {
    const defaults = { paragraphs: 3, sentences: 5, words: 50 };
    countEl.value = defaults[unitEl.value];
    generate();
  });
  classicEl.addEventListener('change', generate);
  $('#lorem-generate').addEventListener('click', generate);
  generate();
}

/* =========================================================
   6. Epoch / Unix timestamp converter
   ========================================================= */
const UNIT_FACTORS = { s: 1000, ms: 1, us: 1e-3, ns: 1e-6 };
const UNIT_NAMES = { s: 'seconds', ms: 'milliseconds', us: 'microseconds', ns: 'nanoseconds' };
const MAX_DATE_MS = 8.64e15;
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

function detectTimestampUnit(str) {
  const digits = str.replace(/^-/, '').split('.')[0].length;
  if (digits <= 11) return 's';
  if (digits <= 14) return 'ms';
  if (digits <= 17) return 'us';
  return 'ns';
}

function relativeTime(ms) {
  const diff = (ms - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const units = [['year', 31557600], ['month', 2629800], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  for (const [unit, sec] of units) {
    if (abs >= sec || unit === 'second') return rtf.format(Math.round(diff / sec), unit);
  }
}

function toDatetimeLocalValue(date, utc) {
  const g = utc
    ? [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()]
    : [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
  return `${pad(g[0], 4)}-${pad(g[1])}-${pad(g[2])}T${pad(g[3])}:${pad(g[4])}:${pad(g[5])}`;
}

function initEpoch() {
  const nowS = $('#epoch-now-s');
  const nowMs = $('#epoch-now-ms');
  const input = $('#epoch-input');
  const unitSel = $('#epoch-unit');
  const errorEl = $('#epoch-error');
  const res = { local: $('#epoch-local'), utc: $('#epoch-utc'), iso: $('#epoch-iso'), relative: $('#epoch-relative'), detected: $('#epoch-detected') };
  const dateInput = $('#epoch-date');
  const tzSel = $('#epoch-tz');
  const outS = $('#epoch-out-s');
  const outMs = $('#epoch-out-ms');
  const outIso = $('#epoch-out-iso');
  const localFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' });
  let lastMs = null;

  function tick() {
    const now = Date.now();
    nowS.textContent = Math.floor(now / 1000);
    nowMs.textContent = now;
    if (lastMs !== null) res.relative.textContent = relativeTime(lastMs);
  }

  function clearResults() {
    lastMs = null;
    res.local.textContent = res.utc.textContent = res.iso.textContent = res.relative.textContent = res.detected.textContent = '';
  }

  function convertTimestamp() {
    const raw = input.value.trim().replace(/[\s,_]/g, '');
    errorEl.classList.add('hidden');
    if (!raw) { input.dataset.state = ''; clearResults(); return; }
    if (!/^-?\d+(\.\d+)?$/.test(raw)) {
      input.dataset.state = 'invalid';
      errorEl.textContent = 'Enter a numeric Unix timestamp (optionally negative or with decimals).';
      errorEl.classList.remove('hidden');
      clearResults();
      return;
    }
    const unit = unitSel.value === 'auto' ? detectTimestampUnit(raw) : unitSel.value;
    const ms = Number(raw) * UNIT_FACTORS[unit];
    if (!Number.isFinite(ms) || Math.abs(ms) > MAX_DATE_MS) {
      input.dataset.state = 'invalid';
      errorEl.textContent = 'Timestamp is outside the supported date range (±275,760 years from 1970).';
      errorEl.classList.remove('hidden');
      clearResults();
      return;
    }
    const date = new Date(ms);
    lastMs = ms;
    input.dataset.state = 'valid';
    res.local.textContent = localFmt.format(date);
    res.utc.textContent = date.toUTCString();
    res.iso.textContent = date.toISOString();
    res.relative.textContent = relativeTime(ms);
    res.detected.textContent = `· as ${UNIT_NAMES[unit]}`;
  }

  function convertDate() {
    const v = dateInput.value;
    if (!v) { outS.textContent = outMs.textContent = outIso.textContent = ''; dateInput.dataset.state = ''; return; }
    const iso = v.length === 16 ? `${v}:00` : v;
    const date = new Date(tzSel.value === 'utc' ? `${iso}Z` : iso);
    if (Number.isNaN(date.getTime())) { dateInput.dataset.state = 'invalid'; outS.textContent = outMs.textContent = outIso.textContent = ''; return; }
    dateInput.dataset.state = '';
    outMs.textContent = date.getTime();
    outS.textContent = Math.floor(date.getTime() / 1000);
    outIso.textContent = date.toISOString();
  }

  function setDateNow() { dateInput.value = toDatetimeLocalValue(new Date(), tzSel.value === 'utc'); convertDate(); }

  input.addEventListener('input', convertTimestamp);
  unitSel.addEventListener('change', convertTimestamp);
  $('#epoch-use-now').addEventListener('click', () => { input.value = Math.floor(Date.now() / 1000); unitSel.value = 'auto'; convertTimestamp(); });
  dateInput.addEventListener('input', convertDate);
  tzSel.addEventListener('change', () => {
    // Keep the same instant, re-expressed in the newly selected zone.
    const ms = Number(outMs.textContent);
    if (outMs.textContent && Number.isFinite(ms)) dateInput.value = toDatetimeLocalValue(new Date(ms), tzSel.value === 'utc');
    convertDate();
  });
  $('#epoch-date-now').addEventListener('click', setDateNow);

  let timer = null;
  onActivate.epoch = () => {
    tick();
    if (!timer) timer = setInterval(() => { if (appState.active === 'epoch' && !document.hidden) tick(); }, 1000);
  };

  input.value = Math.floor(Date.now() / 1000);
  convertTimestamp();
  setDateNow();
  tick();
}

/* =========================================================
   7. Base64 encoder / decoder (UTF-8 safe)
   ========================================================= */
const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

function base64Encode(text, urlSafe) {
  const bytes = utf8Encoder.encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  const b64 = btoa(binary);
  return urlSafe ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64;
}

function base64Decode(input) {
  let s = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('Contains characters that are not valid Base64.');
  s = s.replace(/=+$/, '');
  if (s.length % 4 === 1) throw new Error('Invalid length — the Base64 string appears truncated.');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  try {
    return { text: utf8Decoder.decode(bytes), bytes: bytes.length };
  } catch {
    throw new Error(`Decoded ${bytes.length} bytes, but they are binary data, not valid UTF-8 text.`);
  }
}

function initBase64() {
  const plain = $('#b64-plain');
  const encoded = $('#b64-encoded');
  const urlSafe = $('#b64-urlsafe');
  const errorEl = $('#b64-error');
  const plainStats = $('#b64-plain-stats');
  const encodedStats = $('#b64-encoded-stats');

  const setError = (msg) => {
    errorEl.textContent = msg || '';
    errorEl.classList.toggle('hidden', !msg);
    encoded.dataset.state = msg ? 'invalid' : '';
  };
  const updateStats = () => {
    plainStats.textContent = plain.value ? `· ${formatBytes(utf8Encoder.encode(plain.value).length)}` : '';
    encodedStats.textContent = encoded.value ? `· ${encoded.value.replace(/\s/g, '').length.toLocaleString()} chars` : '';
  };

  function encode() {
    setError('');
    encoded.value = base64Encode(plain.value, urlSafe.checked);
    updateStats();
  }
  function decode() {
    if (!encoded.value.trim()) { setError(''); plain.value = ''; updateStats(); return; }
    try {
      plain.value = base64Decode(encoded.value).text;
      setError('');
    } catch (e) {
      setError(e.message);
    }
    updateStats();
  }

  plain.addEventListener('input', encode);
  encoded.addEventListener('input', decode);
  urlSafe.addEventListener('change', () => { store.set('mt-b64-urlsafe', urlSafe.checked ? '1' : '0'); encode(); });
  $('#b64-clear').addEventListener('click', () => { plain.value = ''; encoded.value = ''; setError(''); updateStats(); plain.focus(); });

  urlSafe.checked = store.get('mt-b64-urlsafe') === '1';
  updateStats();
}

/* =========================================================
   Base64 image viewer
   ========================================================= */
const IMG_TYPES = {
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
function sniffImageType(b) {
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
  const head = new TextDecoder().decode(b.subarray(0, 4096)).replace(/^﻿/, '').trimStart();
  if (head.startsWith('<') && /<svg[\s>]/i.test(head)) return IMG_TYPES.svg;
  if (ascii(0, 4) === '%PDF') return { notImage: 'a PDF document' };
  if (hex(4) === '504b0304') return { notImage: 'a ZIP archive (or a .docx, .xlsx or .apk file)' };
  return null;
}

/** Accepts raw Base64 (standard or URL-safe) or a data: URI. Returns the bytes and the declared MIME type, if any. */
function parseImageInput(text) {
  const s = text.trim();
  const m = s.match(/^data:([^;,]*)((?:;[^;,]*)*),([\s\S]*)$/i);
  if (!m) return { bytes: base64ToBytes(s), declared: null };
  const declared = m[1].trim().toLowerCase() || null;
  if (/;base64/i.test(m[2])) return { bytes: base64ToBytes(m[3]), declared };
  return { bytes: utf8Encoder.encode(decodeURIComponent(m[3])), declared }; // e.g. data:image/svg+xml,%3Csvg…
}

function initBase64Image() {
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

/* =========================================================
   8. Case converter
   ========================================================= */
const CASES = [
  { id: 'upper', label: 'UPPERCASE', fn: (s) => s.toUpperCase() },
  { id: 'lower', label: 'lowercase', fn: (s) => s.toLowerCase() },
  { id: 'title', label: 'Title Case', fn: (s) => s.toLowerCase().replace(/(^|[\s\-–—_(\[{"'“‘/])(\p{L})/gu, (m, p, c) => p + c.toUpperCase()) },
  {
    id: 'camel', label: 'camelCase',
    fn: (s) => s.split('\n').map((line) => splitWords(line)
      .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
      .join('')).join('\n')
  },
  {
    id: 'sentence', label: 'Sentence case',
    fn: (s) => s.toLowerCase()
      .replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (m, p, c) => p + c.toUpperCase())
      .replace(/\bi\b/g, 'I')
  }
];

function initCase() {
  const input = $('#case-input');
  const stats = $('#case-stats');
  const container = $('#case-outputs');

  container.innerHTML = CASES.map((c) => `
    <div class="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800 ${c.id === 'sentence' ? 'md:col-span-2' : ''}">
      <div class="mb-2 flex items-center justify-between gap-2">
        <span class="text-xs font-semibold text-zinc-500 dark:text-zinc-400">${c.label}</span>
        <button type="button" data-copy="#case-${c.id}"></button>
      </div>
      <div id="case-${c.id}" class="max-h-48 min-h-[1.5rem] overflow-auto whitespace-pre-wrap break-words font-mono text-sm text-zinc-800 dark:text-zinc-200"></div>
    </div>`).join('');
  hydrateCopyButtons(container);

  function update() {
    const text = input.value;
    CASES.forEach((c) => { $(`#case-${c.id}`).textContent = text ? c.fn(text) : ''; });
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text ? text.split('\n').length : 0;
    stats.textContent = `${text.length} chars · ${words} words · ${lines} lines`;
  }

  input.addEventListener('input', update);
  update();
}

/* =========================================================
   Boot
   ========================================================= */
$('#year').textContent = new Date().getFullYear();
hydrateCopyButtons();
initTheme();
initLuhn();
initCardGenerator();
initJson();
initPassword();
initRsa();
initUuid();
initLorem();
initEpoch();
initBase64();
initBase64Image();
initCase();
// JSON to Dart moved to the Flutter section; keep old links working.
initToolRouter(TOOLS, { storageKey: 'mt-last-tool', redirects: { dart: 'flutter/index.html#json-to-dart' } });
initAds();
