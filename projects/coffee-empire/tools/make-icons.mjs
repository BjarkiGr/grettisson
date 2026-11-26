/* Generate app icons + splash screen from the game's own pixel art.
   Pure Node (zlib) PNG encoder — no image libraries needed. Produces:
   assets/icon.png (1024, App Store), assets/splash.png (2732, launch screen),
   assets/icon-192.png / icon-512.png (PWA manifest). */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
require(path.join(root, 'src', 'sprites.js'));
const CE = globalThis.CE;

/* ---------- Minimal PNG writer ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
}
function png(w, h, pixel) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const row = y * stride;
    raw[row] = 0; /* filter: none */
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = row + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; /* 8-bit RGBA */
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- Draw the cup sprite on the espresso background ---------- */
const MAP = CE.SPRITE_MAPS.cup;
const PAL = CE.SPRITE_PAL;
const BG = hex('#2b1a12');
function spritePixel(mx, my) {
  const row = MAP[my];
  if (!row) return null;
  const col = PAL[row[mx]];
  return col ? hex(col) : null;
}
function icon(size, spriteFrac, bg) {
  const scale = Math.max(1, Math.floor(size * spriteFrac / 16));
  const ox = Math.floor((size - scale * 16) / 2);
  const oy = Math.floor((size - scale * 16) / 2);
  const back = bg === undefined ? BG : bg; /* null = transparent */
  return png(size, size, (x, y) => {
    const mx = Math.floor((x - ox) / scale), my = Math.floor((y - oy) / scale);
    if (mx >= 0 && mx < 16 && my >= 0 && my < 16) {
      const p = spritePixel(mx, my);
      if (p) return p;
    }
    return back || [0, 0, 0, 0];
  });
}
/* Rectangular splash: solid background, cup centered on the short edge. */
function splash(w, h) {
  const scale = Math.max(1, Math.floor(Math.min(w, h) * 0.3 / 16));
  const ox = Math.floor((w - scale * 16) / 2);
  const oy = Math.floor((h - scale * 16) / 2);
  return png(w, h, (x, y) => {
    const mx = Math.floor((x - ox) / scale), my = Math.floor((y - oy) / scale);
    if (mx >= 0 && mx < 16 && my >= 0 && my < 16) {
      const p = spritePixel(mx, my);
      if (p) return p;
    }
    return BG;
  });
}

const assets = path.join(root, 'assets');
fs.mkdirSync(assets, { recursive: true });
fs.writeFileSync(path.join(assets, 'icon.png'), icon(1024, 0.72));
fs.writeFileSync(path.join(assets, 'icon-512.png'), icon(512, 0.72));
fs.writeFileSync(path.join(assets, 'icon-192.png'), icon(192, 0.72));
fs.writeFileSync(path.join(assets, 'splash.png'), icon(2732, 0.28));
console.log('assets/: icon.png (1024), icon-512.png, icon-192.png, splash.png (2732) generated.');

/* ---------- Native project assets (after `npx cap add android/ios`) ---------- */
const androidRes = path.join(root, 'android', 'app', 'src', 'main', 'res');
if (fs.existsSync(androidRes)) {
  const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [dpi, size] of Object.entries(densities)) {
    const dir = path.join(androidRes, 'mipmap-' + dpi);
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), icon(size, 0.72));
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), icon(size, 0.72));
    /* Adaptive foreground: 108dp canvas, art inside the 66dp safe zone. */
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), icon(Math.round(size * 2.25), 0.45, null));
  }
  const splashes = {
    'drawable-port-mdpi': [320, 480], 'drawable-port-hdpi': [480, 800], 'drawable-port-xhdpi': [720, 1280],
    'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920],
    'drawable-land-mdpi': [480, 320], 'drawable-land-hdpi': [800, 480], 'drawable-land-xhdpi': [1280, 720],
    'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280]
  };
  for (const [dir, [w, h]] of Object.entries(splashes)) {
    fs.writeFileSync(path.join(androidRes, dir, 'splash.png'), splash(w, h));
  }
  fs.writeFileSync(path.join(androidRes, 'drawable', 'splash.png'), splash(960, 1600));
  console.log('android: launcher icons + splash screens generated.');
}
const iosAssets = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets');
if (fs.existsSync(iosAssets)) {
  fs.writeFileSync(path.join(iosAssets, 'AppIcon.appiconset', 'AppIcon-512@2x.png'), icon(1024, 0.72));
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    fs.writeFileSync(path.join(iosAssets, 'Splash.imageset', name), icon(2732, 0.28));
  }
  console.log('ios: AppIcon + launch splash generated.');
}