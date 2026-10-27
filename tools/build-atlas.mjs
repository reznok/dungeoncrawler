// Packs every tile the game references into public/atlas.png + src/generated/atlas.json.
//
// Tile keys are DCSS rltiles paths without ".png", written as string literals anywhere in src/
// (e.g. 'mon/animals/rat'). A key ending in "*" packs every file whose name starts with the prefix
// followed by digits/underscore/letters, as variants (e.g. 'dngn/wall/brick_brown*').
//
// Usage: node tools/build-atlas.mjs <path to crawl-ref/source/rltiles>
//        (or set CRAWL_TILES)
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const root = process.argv[2] || process.env.CRAWL_TILES;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node tools/build-atlas.mjs <crawl-ref/source/rltiles>');
  process.exit(1);
}
const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const srcDir = path.join(projectRoot, 'src');
const KEY_RE = /['"`]((?:dngn|mon|item|player|effect|misc|gui)\/[A-Za-z0-9_\-/]+\*{0,2})['"`]/g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'generated') walk(p, out); }
    else if (/\.(ts|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

const keys = new Set();
for (const f of walk(srcDir)) {
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(KEY_RE)) keys.add(m[1]);
}

const missing = [];
const entries = []; // { key, files[] }
for (const key of [...keys].sort()) {
  if (key.endsWith('/**')) {
    const dir = path.join(root, key.slice(0, -3));
    if (!fs.existsSync(dir)) { missing.push(key); continue; }
    for (const n of fs.readdirSync(dir).filter((n) => n.endsWith('.png'))) {
      entries.push({ key: key.slice(0, -2) + n.slice(0, -4), files: [path.join(dir, n)] });
    }
  } else if (key.endsWith('*')) {
    const prefix = key.slice(0, -1);
    const dir = path.join(root, path.dirname(prefix));
    const base = path.basename(prefix);
    if (!fs.existsSync(dir)) { missing.push(key); continue; }
    const files = fs.readdirSync(dir)
      .filter((n) => n.endsWith('.png') && n.startsWith(base) && /^[0-9_]*$/.test(n.slice(base.length, -4).replace(/[a-z]$/, '')))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
      .map((n) => path.join(dir, n));
    if (!files.length) { missing.push(key); continue; }
    entries.push({ key, files });
  } else {
    const f = path.join(root, key + '.png');
    if (!fs.existsSync(f)) { missing.push(key); continue; }
    entries.push({ key, files: [f] });
  }
}

// Load images, shelf-pack.
const images = [];
function readPng(f) {
  let buf = fs.readFileSync(f);
  const end = buf.indexOf('IEND');
  if (end > 0) buf = buf.subarray(0, end + 8); // some files carry junk after IEND
  return PNG.sync.read(buf);
}
for (const e of entries) for (const f of e.files) images.push({ key: e.key, png: readPng(f) });
const W = 1024;
let x = 0, y = 0, shelf = 0;
const order = [...images].sort((a, b) => b.png.height - a.png.height);
for (const im of order) {
  if (x + im.png.width > W) { x = 0; y += shelf; shelf = 0; }
  im.x = x; im.y = y;
  x += im.png.width; shelf = Math.max(shelf, im.png.height);
}
const H = y + shelf;
const atlas = new PNG({ width: W, height: H });
const map = {};
for (const im of images) {
  PNG.bitblt(im.png, atlas, 0, 0, im.png.width, im.png.height, im.x, im.y);
  (map[im.key] ||= []).push([im.x, im.y, im.png.width, im.png.height]);
}
fs.mkdirSync(path.join(projectRoot, 'public'), { recursive: true });
fs.mkdirSync(path.join(srcDir, 'generated'), { recursive: true });
fs.writeFileSync(path.join(projectRoot, 'public', 'atlas.png'), PNG.sync.write(atlas));
fs.writeFileSync(path.join(srcDir, 'generated', 'atlas.json'), JSON.stringify(map));
console.log(`packed ${images.length} images for ${entries.length} keys into ${W}x${H}`);
if (missing.length) {
  console.log('MISSING:\n  ' + missing.join('\n  '));
  process.exitCode = 2;
}
