import { $, clamp, debounce } from '../lib/core.js';

/* =========================================================
   5. Lorem ipsum generator
   ========================================================= */
export const LOREM_WORDS = Array.from(new Set((
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
  'enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in ' +
  'reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa ' +
  'qui officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nunc pulvinar sapien ligula viverra ' +
  'mauris fermentum vestibulum ante primis faucibus orci luctus ultrices posuere cubilia curae donec neque auctor aliquam ' +
  'vel ullamcorper massa porta integer feugiat scelerisque varius morbi tristique senectus netus malesuada fames turpis ' +
  'egestas pellentesque habitant leo sagittis purus semper lectus at volutpat diam venenatis tellus elementum blandit ' +
  'cursus risus suscipit gravida dictum fusce placerat mattis nibh praesent sodales rhoncus quam nisl condimentum facilisis'
).split(' ')));
export const LOREM_OPENING = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
export const LOREM_LIMITS = { paragraphs: 50, sentences: 200, words: 2000 };

export const randRange = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function loremWords(n) {
  const words = [];
  while (words.length < n) {
    const w = LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)];
    if (w !== words[words.length - 1]) words.push(w);
  }
  return words;
}

export function loremSentence() {
  const words = loremWords(randRange(6, 15));
  if (words.length > 8 && Math.random() < 0.6) {
    const at = randRange(3, words.length - 4);
    words[at] += ',';
  }
  return capitalize(words.join(' ')) + (Math.random() < 0.08 ? '?' : '.');
}

export function loremParagraph(startClassic) {
  const count = randRange(4, 7);
  const sentences = Array.from({ length: count }, loremSentence);
  if (startClassic) sentences[0] = LOREM_OPENING;
  return sentences.join(' ');
}

export function generateLorem(unit, count, classic) {
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

export function initLorem() {
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
