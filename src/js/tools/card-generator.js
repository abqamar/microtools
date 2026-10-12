import { $, clamp, debounce, pad, secureRandomInt } from '../lib/core.js';
import { detectLuhnType, formatGroups, luhnCheckDigit } from './luhn.js';

/* =========================================================
   Test card number generator
   ========================================================= */
// Issuer prefix ranges (inclusive, equal-length strings) and card length per brand.
export const TEST_CARD_BRANDS = {
  visa: { name: 'Visa', ranges: [['4', '4']], length: 16 },
  mastercard: { name: 'Mastercard', ranges: [['51', '55'], ['2221', '2720']], length: 16 },
  amex: { name: 'American Express', ranges: [['34', '34'], ['37', '37']], length: 15 },
  discover: { name: 'Discover', ranges: [['6011', '6011'], ['65', '65'], ['644', '649']], length: 16 },
  jcb: { name: 'JCB', ranges: [['3528', '3589']], length: 16 },
  diners: { name: 'Diners Club', ranges: [['300', '305'], ['36', '36'], ['38', '39']], length: 14 },
  unionpay: { name: 'UnionPay', ranges: [['62', '62']], length: 16 }
};

export function generateTestCard(brandKey) {
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

export function formatTestCards(cards, { format, spaced, extras }) {
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

export function initCardGenerator() {
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
