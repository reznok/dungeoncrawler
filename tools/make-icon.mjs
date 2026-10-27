// Builds public/icon.png (192x192) from a tile in the packed atlas.
import fs from 'node:fs';
import { PNG } from 'pngjs';
const atlas = PNG.sync.read(fs.readFileSync('public/atlas.png'));
const map = JSON.parse(fs.readFileSync('src/generated/atlas.json', 'utf8'));
const [sx, sy] = map['item/food/bread_ration'][0];
const S = 192, scale = 5, off = (S - 32 * scale) / 2;
const out = new PNG({ width: S, height: S });
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const i = (y * S + x) * 4;
  const d = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
  out.data[i] = 40 - d * 25; out.data[i + 1] = 22 - d * 12; out.data[i + 2] = 50 - d * 30; out.data[i + 3] = 255;
  const tx = Math.floor((x - off) / scale), ty = Math.floor((y - off) / scale);
  if (tx >= 0 && ty >= 0 && tx < 32 && ty < 32) {
    const j = ((sy + ty) * atlas.width + sx + tx) * 4;
    const a = atlas.data[j + 3] / 255;
    for (let k = 0; k < 3; k++) out.data[i + k] = out.data[i + k] * (1 - a) + atlas.data[j + k] * a;
  }
}
fs.writeFileSync('public/icon.png', PNG.sync.write(out));
console.log('wrote public/icon.png');
