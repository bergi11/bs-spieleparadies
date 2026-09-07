// Erzeugt die PNG-Icons unter public/ aus derselben Geometrie wie icon.svg.
// iOS nimmt fuer den Homebildschirm ausschliesslich das apple-touch-icon als
// PNG - SVG und Manifest-Icons werden dort ignoriert. Damit dafuer keine
// Bildbibliothek noetig ist, rastert dieses Skript die vier Kacheln selbst und
// schreibt das PNG ueber node:zlib.
//
// Aufruf: npm run icons

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT_DIR = fileURLToPath(new URL('../public/', import.meta.url));

// Farben aus src/styles.css.
const BG = '#12121a';
const TILES = [
  [96, 96, '#7c5cff'],
  [280, 96, '#3ddc97'],
  [96, 280, '#ffb703'],
  [280, 280, '#ff5d8f'],
];

// --- PNG ---------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(size, pixels) {
  const stride = size * 4;
  // Jede Zeile bekommt ein fuehrendes Filter-Byte, hier immer 0 (kein Filter).
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 Bit je Kanal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Zeichnen ----------------------------------------------------------

function parseColor(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function insideRoundedRect(px, py, x, y, w, h, r) {
  const dx = Math.max(x + r - px, 0, px - (x + w - r));
  const dy = Math.max(y + r - py, 0, py - (y + h - r));
  return dx * dx + dy * dy <= r * r;
}

// 4x4 Unterabtastung je Pixel: ohne Kantenglaettung sehen die Rundungen auf
// dem Homebildschirm ausgefranst aus.
const SAMPLES = 4;

function fillRoundedRect(canvas, x, y, w, h, r, hex) {
  const [sr, sg, sb] = parseColor(hex);
  const size = canvas.size;
  const minX = Math.max(0, Math.floor(x));
  const maxX = Math.min(size - 1, Math.ceil(x + w));
  const minY = Math.max(0, Math.floor(y));
  const maxY = Math.min(size - 1, Math.ceil(y + h));

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      let hits = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const cx = px + (sx + 0.5) / SAMPLES;
          const cy = py + (sy + 0.5) / SAMPLES;
          if (insideRoundedRect(cx, cy, x, y, w, h, r)) hits += 1;
        }
      }
      if (hits === 0) continue;

      const sa = hits / (SAMPLES * SAMPLES);
      const i = (py * size + px) * 4;
      const da = canvas.data[i + 3] / 255;
      const outA = sa + da * (1 - sa);
      for (let k = 0; k < 3; k += 1) {
        const src = [sr, sg, sb][k];
        const dst = canvas.data[i + k];
        canvas.data[i + k] = Math.round((src * sa + dst * da * (1 - sa)) / outA);
      }
      canvas.data[i + 3] = Math.round(outA * 255);
    }
  }
}

// bleed: Hintergrund bis zum Rand, ohne eigene Rundung. iOS und Android
// schneiden das Icon selbst zurecht; runden wir zusaetzlich, entsteht ein
// heller Rand um die Ecken.
// tileScale: schrumpft die Kacheln zur Mitte, damit sie bei maskable im
// sicheren Bereich (innere 80 %) liegen.
function drawIcon(size, { bleed, tileScale }) {
  const canvas = { size, data: Buffer.alloc(size * size * 4) };
  const u = size / 512;
  fillRoundedRect(canvas, 0, 0, size, size, bleed ? 0 : 112 * u, BG);
  for (const [x, y, color] of TILES) {
    const tx = 256 + (x - 256) * tileScale;
    const ty = 256 + (y - 256) * tileScale;
    fillRoundedRect(canvas, tx * u, ty * u, 136 * tileScale * u, 136 * tileScale * u, 24 * tileScale * u, color);
  }
  return encodePng(size, canvas.data);
}

const FILES = [
  ['apple-touch-icon.png', 180, { bleed: true, tileScale: 1 }],
  ['icon-192.png', 192, { bleed: false, tileScale: 1 }],
  ['icon-512.png', 512, { bleed: false, tileScale: 1 }],
  ['icon-maskable-512.png', 512, { bleed: true, tileScale: 0.78 }],
];

for (const [name, size, options] of FILES) {
  const png = drawIcon(size, options);
  writeFileSync(OUT_DIR + name, png);
  console.log(`${name}  ${size}x${size}  ${png.length} Bytes`);
}
