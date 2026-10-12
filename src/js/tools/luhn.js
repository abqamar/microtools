import { $, $$ } from '../lib/core.js';

/* =========================================================
   1. Luhn validator
   ========================================================= */
export function luhnIsValid(digits) {
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
export function luhnCheckDigit(payload) {
  let sum = 0, dbl = true;
  for (let i = payload.length - 1; i >= 0; i--) {
    let d = payload.charCodeAt(i) - 48;
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return (10 - (sum % 10)) % 10;
}

export const CARD_TYPES = [
  { name: 'American Express', re: /^3[47]/, lengths: [15], groups: [4, 6, 5] },
  { name: 'Visa', re: /^4/, lengths: [13, 16, 19] },
  { name: 'Mastercard', re: /^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/, lengths: [16] },
  { name: 'Discover', re: /^(6011|65|64[4-9])/, lengths: [16, 19] },
  { name: 'JCB', re: /^35(2[89]|[3-8])/, lengths: [16, 17, 18, 19] },
  { name: 'Diners Club', re: /^3(0[0-5]|[689])/, lengths: [14, 16, 19], groups: [4, 6, 4] },
  { name: 'UnionPay', re: /^62/, lengths: [16, 17, 18, 19] }
];

export function detectLuhnType(digits) {
  const card = CARD_TYPES.find((c) => c.re.test(digits));
  // A 15-digit number is only a card if that issuer actually uses 15 digits (e.g. Amex); otherwise it's an IMEI.
  if (card && !(digits.length === 15 && !card.lengths.includes(15))) return { name: card.name, lengths: card.lengths, groups: card.groups };
  if (digits.length === 15) return { name: 'IMEI', lengths: [15], groups: [2, 6, 6, 1] };
  return { name: digits.length > 15 ? 'Card (unknown issuer)' : 'Unknown', lengths: null };
}

export function formatGroups(digits, groups) {
  if (!groups) return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  const out = [];
  let i = 0;
  for (const g of groups) { if (i >= digits.length) break; out.push(digits.slice(i, i + g)); i += g; }
  if (i < digits.length) out.push(digits.slice(i));
  return out.join(' ');
}

export function initLuhn() {
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
