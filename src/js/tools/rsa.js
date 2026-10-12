import { $, debounce, escapeText } from '../lib/core.js';
import { utf8Decoder, utf8Encoder } from './base64.js';

/* =========================================================
   RSA key pair, encryption and signatures (Web Crypto)
   ========================================================= */
export const RSA_HASH_BYTES = { 'SHA-256': 32, 'SHA-384': 48, 'SHA-512': 64 };
// DER AlgorithmIdentifier for rsaEncryption (OID 1.2.840.113549.1.1.1, NULL parameters).
export const RSA_ALG_ID = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];

export function concatBytes(parts) {
  const arrays = parts.map((p) => (p instanceof Uint8Array ? p : Uint8Array.from(p)));
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

export const derLength = (n) => {
  if (n < 128) return [n];
  const bytes = [];
  while (n) { bytes.unshift(n & 0xff); n >>>= 8; }
  return [0x80 | bytes.length, ...bytes];
};

/** DER tag-length-value from one or more byte parts. */
export function der(tag, ...parts) {
  const body = concatBytes(parts);
  return concatBytes([[tag, ...derLength(body.length)], body]);
}

export function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function base64ToBytes(input) {
  let s = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.replace(/=+$/, '').length % 4 === 1) throw new Error('Not valid Base64');
  s = s.replace(/=+$/, '');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export const derToPem = (bytes, label) => `-----BEGIN ${label}-----\n${bytesToBase64(bytes).match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`;

/** Reads a PEM key into the DER format Web Crypto imports (SPKI or PKCS#8), converting PKCS#1 RSA keys. */
export function parseRsaPem(text, kind) {
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

export async function importRsaKey(pem, kind, hash, scheme) {
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

export function rsaSigParams(scheme, hash) {
  return scheme === 'pss' ? { name: 'RSA-PSS', saltLength: RSA_HASH_BYTES[hash] } : { name: 'RSASSA-PKCS1-v1_5' };
}

export function initRsa() {
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
  if (!generated && !el('public').value.trim() && !el('private').value.trim()) generate();
}
