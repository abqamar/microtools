import { $, formatBytes, store } from '../lib/core.js';

/* =========================================================
   7. Base64 encoder / decoder (UTF-8 safe)
   ========================================================= */
export const utf8Encoder = new TextEncoder();
export const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

export function base64Encode(text, urlSafe) {
  const bytes = utf8Encoder.encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  const b64 = btoa(binary);
  return urlSafe ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64;
}

export function base64Decode(input) {
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

export function initBase64() {
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
