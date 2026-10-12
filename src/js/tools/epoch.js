import { $, pad } from '../lib/core.js';

/* =========================================================
   6. Epoch / Unix timestamp converter
   ========================================================= */
export const UNIT_FACTORS = { s: 1000, ms: 1, us: 1e-3, ns: 1e-6 };
export const UNIT_NAMES = { s: 'seconds', ms: 'milliseconds', us: 'microseconds', ns: 'nanoseconds' };
export const MAX_DATE_MS = 8.64e15;
export const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function detectTimestampUnit(str) {
  const digits = str.replace(/^-/, '').split('.')[0].length;
  if (digits <= 11) return 's';
  if (digits <= 14) return 'ms';
  if (digits <= 17) return 'us';
  return 'ns';
}

export function relativeTime(ms) {
  const diff = (ms - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const units = [['year', 31557600], ['month', 2629800], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  for (const [unit, sec] of units) {
    if (abs >= sec || unit === 'second') return rtf.format(Math.round(diff / sec), unit);
  }
}

export function toDatetimeLocalValue(date, utc) {
  const g = utc
    ? [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()]
    : [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
  return `${pad(g[0], 4)}-${pad(g[1])}-${pad(g[2])}T${pad(g[3])}:${pad(g[4])}:${pad(g[5])}`;
}

export function initEpoch() {
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

  setInterval(() => { if (!document.hidden) tick(); }, 1000);

  input.value = Math.floor(Date.now() / 1000);
  convertTimestamp();
  setDateNow();
  tick();
}
