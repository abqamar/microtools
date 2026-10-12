
/* =========================================================
   Shared binary helpers: CRC-32, zip (stored), PNG without alpha
   ========================================================= */
export const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Builds a .zip (no compression: PNGs are already compressed). files: [{ name, data: Uint8Array }]. */
export function makeZip(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true); local.setUint32(18, f.data.length, true); local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
    locals.push(new Uint8Array(local.buffer), name, f.data);
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true); central.setUint16(4, 20, true); central.setUint16(6, 20, true); central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true); central.setUint16(12, dosTime, true); central.setUint16(14, dosDate, true);
    central.setUint32(16, crc, true); central.setUint32(20, f.data.length, true); central.setUint32(24, f.data.length, true);
    central.setUint16(28, name.length, true); central.setUint32(42, offset, true);
    centrals.push(new Uint8Array(central.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = centrals.reduce((n, a) => n + a.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...locals, ...centrals, new Uint8Array(end.buffer)], { type: 'application/zip' });
}

export async function zlibDeflate(data) {
  if (typeof CompressionStream === 'function') {
    const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate')); // 'deflate' = zlib format, as PNG needs
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  // Fallback: zlib stream of uncompressed (stored) blocks.
  const parts = [Uint8Array.of(0x78, 0x01)];
  for (let off = 0; off < data.length || off === 0; off += 65535) {
    const chunk = data.subarray(off, off + 65535);
    const last = off + 65535 >= data.length;
    parts.push(Uint8Array.of(last ? 1 : 0, chunk.length & 0xff, chunk.length >> 8, ~chunk.length & 0xff, (~chunk.length >> 8) & 0xff), chunk);
    if (last) break;
  }
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) { a = (a + data[i]) % 65521; b = (b + a) % 65521; }
  parts.push(Uint8Array.of(b >> 8, b & 0xff, a >> 8, a & 0xff));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Encodes a canvas as an RGB PNG with no alpha channel (canvas.toBlob always writes RGBA). */
export async function encodePngRgb(canvas) {
  const w = canvas.width, h = canvas.height;
  const px = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const raw = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0, o = 0; y < h; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; raw[o++] = px[i]; raw[o++] = px[i + 1]; raw[o++] = px[i + 2]; }
  }
  const chunk = (type, data) => {
    const body = new Uint8Array(4 + data.length);
    body.set(new TextEncoder().encode(type)); body.set(data, 4);
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length); out.set(body, 4); dv.setUint32(8 + data.length, crc32(body));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 2; // 8-bit, colour type 2 = RGB
  const parts = [Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), chunk('IHDR', ihdr), chunk('IDAT', await zlibDeflate(raw)), chunk('IEND', new Uint8Array(0))];
  return new Uint8Array(await new Blob(parts).arrayBuffer());
}

export function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
