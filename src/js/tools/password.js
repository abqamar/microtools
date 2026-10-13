import { $, $$, secureRandomInt } from '../lib/core.js';

/* =========================================================
   3. Password generator
   ========================================================= */
export const PW_SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~|'
};

export function generatePassword(length, setKeys) {
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

export function humanizeSeconds(sec) {
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

export function initPassword() {
  const out = $('#pw-output');
  const slider = $('#pw-length');
  const lengthLabel = $('#pw-length-value');
  const boxes = $$('[data-pw-set]');
  const bars = $$('.pw-bar');
  const strengthEl = $('#pw-strength');
  const entropyEl = $('#pw-entropy');
  const hint = $('#pw-hint');

  const LEVELS = [
    { max: 45, label: 'Weak', bars: 1, color: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' },
    { max: 64, label: 'Fair', bars: 2, color: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
    { max: 90, label: 'Strong', bars: 3, color: 'bg-lime-500', text: 'text-lime-700 dark:text-lime-400' },
    { max: Infinity, label: 'Very strong', bars: 4, color: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' }
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
