import { $, debounce, escapeText, highlightJson } from '../lib/core.js';
import { utf8Decoder, utf8Encoder } from './base64.js';
import { relativeTime } from './epoch.js';
import { RSA_HASH_BYTES, base64ToBytes, bytesToBase64, parseRsaPem } from './rsa.js';

/* =========================================================
   JWT decoder & verifier
   ========================================================= */
export const JWT_ALGS = {
  HS256: { kind: 'hmac', hash: 'SHA-256' }, HS384: { kind: 'hmac', hash: 'SHA-384' }, HS512: { kind: 'hmac', hash: 'SHA-512' },
  RS256: { kind: 'rsa', hash: 'SHA-256' }, RS384: { kind: 'rsa', hash: 'SHA-384' }, RS512: { kind: 'rsa', hash: 'SHA-512' },
  PS256: { kind: 'pss', hash: 'SHA-256' }, PS384: { kind: 'pss', hash: 'SHA-384' }, PS512: { kind: 'pss', hash: 'SHA-512' },
  ES256: { kind: 'ec', hash: 'SHA-256', curve: 'P-256' }, ES384: { kind: 'ec', hash: 'SHA-384', curve: 'P-384' }, ES512: { kind: 'ec', hash: 'SHA-512', curve: 'P-521' }
};

export const bytesToBase64Url = (bytes) => bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function decodeJwtPart(part, name) {
  let bytes;
  try { bytes = base64ToBytes(part); } catch { throw new Error(`The ${name} is not valid Base64URL.`); }
  let text;
  try { text = utf8Decoder.decode(bytes); } catch { throw new Error(`The ${name} is not UTF-8 text.`); }
  try { return JSON.parse(text); } catch { throw new Error(`The ${name} is not valid JSON.`); }
}

/** Splits and decodes a compact JWS. Throws with a readable message for anything that is not a JWT. */
export function parseJwt(raw) {
  const token = raw.trim().replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length === 5) throw new Error('This is an encrypted JWT (JWE). Its payload can only be read with the decryption key.');
  if (parts.length !== 3) throw new Error(`A JWT has 3 parts separated by dots; this has ${parts.length}.`);
  return { token, header: decodeJwtPart(parts[0], 'header'), payload: decodeJwtPart(parts[1], 'payload'), parts };
}

export async function verifyJwt(parts, alg, { secret, secretIsBase64, pem }) {
  const spec = JWT_ALGS[alg];
  const data = utf8Encoder.encode(`${parts[0]}.${parts[1]}`);
  const sig = base64ToBytes(parts[2]);
  if (spec.kind === 'hmac') {
    const keyBytes = secretIsBase64 ? base64ToBytes(secret) : utf8Encoder.encode(secret);
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: spec.hash }, false, ['verify']);
    return crypto.subtle.verify('HMAC', key, sig, data);
  }
  const spki = parseRsaPem(pem, 'public'); // also accepts EC "PUBLIC KEY" PEMs
  if (spec.kind === 'ec') {
    const key = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: spec.curve }, false, ['verify']);
    return crypto.subtle.verify({ name: 'ECDSA', hash: spec.hash }, key, sig, data); // JWS ES* signatures are raw r||s, as Web Crypto expects
  }
  const name = spec.kind === 'pss' ? 'RSA-PSS' : 'RSASSA-PKCS1-v1_5';
  const key = await crypto.subtle.importKey('spki', spki, { name, hash: spec.hash }, false, ['verify']);
  return crypto.subtle.verify({ name, saltLength: RSA_HASH_BYTES[spec.hash] }, key, sig, data);
}

export function initJwt() {
  const el = (id) => $(`#jwt-${id}`);
  let current = null;
  let seq = 0;
  const setBox = (id, state, html) => { el(id).dataset.state = state; el(id).innerHTML = `<span>${html}</span>`; };

  function showJson(id, obj) {
    const json = obj === undefined ? '' : JSON.stringify(obj, null, 2);
    el(id).innerHTML = json ? highlightJson(json) : '';
    el(id).dataset.raw = json;
  }

  function claimBox(label, seconds) {
    const date = new Date(seconds * 1000);
    const valid = Number.isFinite(seconds) && !Number.isNaN(date.getTime());
    return `<div class="stat"><dt>${label}</dt><dd class="whitespace-normal">${valid ? `${escapeText(date.toLocaleString())} <span class="text-zinc-500">(${escapeText(relativeTime(date.getTime()))})</span>` : 'invalid'}</dd></div>`;
  }

  async function verify() {
    const my = ++seq;
    if (!current) { setBox('verify', 'idle', 'Enter the secret or key to verify the signature.'); return; }
    const alg = current.header.alg;
    if (alg === 'none') { setBox('verify', 'invalid', '<strong>Unsigned token</strong> (alg "none"). Anyone can create or change it; never accept it.'); return; }
    if (!JWT_ALGS[alg]) { setBox('verify', 'idle', `Verification of "${escapeText(String(alg))}" is not supported here.`); return; }
    const isHmac = JWT_ALGS[alg].kind === 'hmac';
    const secret = el('secret').value;
    const pem = el('key').value.trim();
    if (isHmac ? !secret : !pem) { setBox('verify', 'idle', `Enter the ${isHmac ? 'secret' : 'public key'} to verify the signature.`); return; }
    try {
      const ok = await verifyJwt(current.parts, alg, { secret, secretIsBase64: el('secret-b64').checked, pem });
      if (my !== seq) return;
      if (ok) setBox('verify', 'valid', '<strong>Signature verified</strong>: the token was signed with this key and has not been changed.');
      else setBox('verify', 'invalid', `<strong>Invalid signature</strong>: wrong ${isHmac ? 'secret' : 'key'}, or the token was modified.`);
    } catch (e) {
      if (my !== seq) return;
      setBox('verify', 'invalid', `<strong>Could not verify</strong>: ${escapeText(e.message || 'the key could not be used')}`);
    }
  }

  function decode() {
    const raw = el('input').value;
    current = null;
    el('claims').innerHTML = '';
    el('alg').textContent = '';
    if (!raw.trim()) { showJson('header'); showJson('payload'); setBox('status', 'idle', 'Paste a JWT to decode it.'); el('input').dataset.state = ''; verify(); return; }
    try {
      current = parseJwt(raw);
    } catch (e) {
      showJson('header'); showJson('payload');
      el('input').dataset.state = 'invalid';
      setBox('status', 'invalid', `<strong>Not a valid JWT.</strong> ${escapeText(e.message)}`);
      verify();
      return;
    }
    const { header, payload } = current;
    showJson('header', header);
    showJson('payload', payload);
    el('input').dataset.state = 'valid';
    el('alg').textContent = `(${header.alg || 'no alg'})`;
    const isHmac = JWT_ALGS[header.alg] && JWT_ALGS[header.alg].kind === 'hmac';
    el('secret-wrap').hidden = !isHmac;
    el('key-wrap').hidden = isHmac || !JWT_ALGS[header.alg];

    const boxes = [];
    if (payload.exp !== undefined) boxes.push(claimBox('Expires (exp)', Number(payload.exp)));
    if (payload.iat !== undefined) boxes.push(claimBox('Issued at (iat)', Number(payload.iat)));
    if (payload.nbf !== undefined) boxes.push(claimBox('Not before (nbf)', Number(payload.nbf)));
    el('claims').innerHTML = boxes.join('');

    const now = Date.now() / 1000;
    if (typeof payload.exp === 'number' && payload.exp < now) setBox('status', 'invalid', `<strong>Decoded, but expired</strong> ${escapeText(relativeTime(payload.exp * 1000))}.`);
    else if (typeof payload.nbf === 'number' && payload.nbf > now) setBox('status', 'invalid', `<strong>Decoded, but not valid yet</strong>: becomes valid ${escapeText(relativeTime(payload.nbf * 1000))}.`);
    else setBox('status', 'valid', `<strong>Decoded</strong> · ${escapeText(header.alg || 'no algorithm')}${typeof payload.exp === 'number' ? ` · expires ${escapeText(relativeTime(payload.exp * 1000))}` : ' · no expiry'}`);
    verify();
  }

  async function makeSample() {
    const now = Math.floor(Date.now() / 1000);
    const enc = (obj) => bytesToBase64Url(utf8Encoder.encode(JSON.stringify(obj)));
    const head = enc({ alg: 'HS256', typ: 'JWT' });
    const body = enc({ sub: '1234567890', name: 'Ada Lovelace', role: 'admin', iat: now, exp: now + 3600 });
    const key = await crypto.subtle.importKey('raw', utf8Encoder.encode('your-256-bit-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, utf8Encoder.encode(`${head}.${body}`)));
    return `${head}.${body}.${bytesToBase64Url(sig)}`;
  }

  el('input').addEventListener('input', debounce(decode, 150));
  ['secret', 'key'].forEach((id) => el(id).addEventListener('input', debounce(verify, 200)));
  el('secret-b64').addEventListener('change', verify);
  el('sample').addEventListener('click', async () => { el('input').value = await makeSample(); el('secret').value = 'your-256-bit-secret'; el('secret-b64').checked = false; decode(); });
  el('clear').addEventListener('click', () => { el('input').value = ''; decode(); el('input').focus(); });
  decode();
}
