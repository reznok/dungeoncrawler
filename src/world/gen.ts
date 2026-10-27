import { Rng } from '../core/rng';
import { DIRS4, DIRS8, type Pos } from '../core/geom';
import { T, walkable, type Theme } from '../data/terrain';
import { distanceMap, UNREACHED } from './path';

export interface Room { x: number; y: number; w: number; h: number }
export interface GenResult { w: number; h: number; tiles: number[]; rooms: Room[]; up: Pos[]; down: Pos[] }

export function generateMap(rng: Rng, depth: number, theme: Theme, opts: { w?: number; h?: number; downCount?: number; style?: string } = {}): GenResult {
  const w = opts.w ?? 48, h = opts.h ?? 40;
  for (let attempt = 0; attempt < 20; attempt++) {
    const tiles = new Array(w * h).fill(T.WALL);
    const style = opts.style ?? rng.pick(theme.gen);
    let rooms: Room[] = [];
    if (style === 'rooms') rooms = carveRooms(rng, w, h, tiles, rng.int(7, 11));
    else if (style === 'caves') carveCaves(rng, w, h, tiles);
    else if (style === 'halls') rooms = carveHalls(rng, w, h, tiles);
    else { rooms = carveRooms(rng, w, h, tiles, rng.int(4, 7)); carveCaveBlobs(rng, w, h, tiles, rng.int(2, 4)); }
    keepLargestRegion(w, h, tiles);
    const floorCount = tiles.filter((t) => t === T.FLOOR).length;
    if (floorCount < w * h * 0.18) continue;
    if (rng.chance(theme.waterChance)) addPools(rng, w, h, tiles, T.DEEP, T.SHALLOW, rng.int(1, 3));
    if (theme.lavaChance && rng.chance(theme.lavaChance)) addPools(rng, w, h, tiles, T.LAVA, T.FLOOR, rng.int(1, 3));
    if (theme.treeChance && rng.chance(theme.treeChance)) scatter(rng, w, h, tiles, T.TREE, rng.int(4, 12));
    if (depth > 2 && rng.chance(0.25)) scatter(rng, w, h, tiles, T.STATUE, rng.int(1, 3));
    ensureConnected(w, h, tiles);
    const res = placeStairs(rng, w, h, tiles, depth, opts.downCount ?? (depth >= 15 ? 0 : rng.int(1, 3)));
    if (!res) continue;
    return { w, h, tiles, rooms, up: res.up, down: res.down };
  }
  throw new Error('level generation failed');
}

function inb(w: number, h: number, x: number, y: number) { return x > 0 && y > 0 && x < w - 1 && y < h - 1; }

function carveRect(w: number, tiles: number[], r: Room, t: number = T.FLOOR) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) tiles[y * w + x] = t;
}

function carveRooms(rng: Rng, w: number, h: number, tiles: number[], count: number): Room[] {
  const rooms: Room[] = [];
  for (let tries = 0; tries < 300 && rooms.length < count; tries++) {
    const rw = rng.int(4, 10), rh = rng.int(3, 8);
    const r = { x: rng.int(1, w - rw - 2), y: rng.int(1, h - rh - 2), w: rw, h: rh };
    if (rooms.some((o) => r.x < o.x + o.w + 2 && r.x + r.w + 2 > o.x && r.y < o.y + o.h + 2 && r.y + r.h + 2 > o.y)) continue;
    rooms.push(r);
  }
  for (const r of rooms) carveRect(w, tiles, r);
  // connect each room to the next, plus a few loops
  const order = [...rooms].sort((a, b) => a.x + a.y * 0.3 - (b.x + b.y * 0.3));
  for (let i = 1; i < order.length; i++) corridor(rng, w, h, tiles, center(order[i - 1]), center(order[i]));
  for (let i = 0; i < Math.floor(rooms.length / 3); i++) corridor(rng, w, h, tiles, center(rng.pick(rooms)), center(rng.pick(rooms)));
  // doors where corridors meet rooms
  for (const r of rooms) {
    for (let x = r.x - 1; x <= r.x + r.w; x++) for (const y of [r.y - 1, r.y + r.h]) maybeDoor(rng, w, h, tiles, x, y);
    for (let y = r.y; y < r.y + r.h; y++) for (const x of [r.x - 1, r.x + r.w]) maybeDoor(rng, w, h, tiles, x, y);
  }
  return rooms;
}

function maybeDoor(rng: Rng, w: number, h: number, tiles: number[], x: number, y: number) {
  if (!inb(w, h, x, y) || tiles[y * w + x] !== T.FLOOR) return;
  const horiz = tiles[y * w + x - 1] === T.WALL && tiles[y * w + x + 1] === T.WALL;
  const vert = tiles[(y - 1) * w + x] === T.WALL && tiles[(y + 1) * w + x] === T.WALL;
  if ((horiz || vert) && rng.chance(0.45)) tiles[y * w + x] = T.DOOR;
}

function center(r: Room): Pos { return { x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) }; }

function corridor(rng: Rng, w: number, h: number, tiles: number[], a: Pos, b: Pos) {
  let { x, y } = a;
  const horizFirst = rng.chance(0.5);
  const step = (tx: number, ty: number) => {
    while (x !== tx) { x += Math.sign(tx - x); if (inb(w, h, x, y) && tiles[y * w + x] === T.WALL) tiles[y * w + x] = T.FLOOR; }
    while (y !== ty) { y += Math.sign(ty - y); if (inb(w, h, x, y) && tiles[y * w + x] === T.WALL) tiles[y * w + x] = T.FLOOR; }
  };
  if (horizFirst) { step(b.x, y); step(b.x, b.y); } else { step(x, b.y); step(b.x, b.y); }
}

function carveCaves(rng: Rng, w: number, h: number, tiles: number[]) {
  let g = new Array(w * h).fill(0).map((_, i) => {
    const x = i % w, y = (i / w) | 0;
    return !inb(w, h, x, y) ? 1 : rng.chance(0.45) ? 1 : 0;
  });
  for (let it = 0; it < 5; it++) {
    const n = g.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      let c = 0;
      for (const d of DIRS8) c += g[(y + d.y) * w + x + d.x];
      n[y * w + x] = c >= 5 || (it < 2 && c <= 1) ? 1 : 0;
    }
    g = n;
  }
  for (let i = 0; i < w * h; i++) if (!g[i]) tiles[i] = T.FLOOR;
}

function carveCaveBlobs(rng: Rng, w: number, h: number, tiles: number[], n: number) {
  for (let k = 0; k < n; k++) {
    let x = rng.int(4, w - 5), y = rng.int(4, h - 5);
    for (let s = 0; s < rng.int(40, 120); s++) {
      if (inb(w, h, x, y)) tiles[y * w + x] = T.FLOOR;
      const d = rng.pick(DIRS4);
      x = Math.min(w - 2, Math.max(1, x + d.x)); y = Math.min(h - 2, Math.max(1, y + d.y));
    }
  }
}

function carveHalls(rng: Rng, w: number, h: number, tiles: number[]): Room[] {
  const rooms: Room[] = [];
  const cols = 2, rows = 2;
  const cw = Math.floor((w - 2) / cols), ch = Math.floor((h - 2) / rows);
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const rw = rng.int(cw - 8, cw - 3), rh = rng.int(ch - 8, ch - 3);
    const r = { x: 1 + cx * cw + rng.int(1, cw - rw - 1), y: 1 + cy * ch + rng.int(1, ch - rh - 1), w: rw, h: rh };
    carveRect(w, tiles, r);
    // pillars
    for (let y = r.y + 2; y < r.y + r.h - 2; y += 3) for (let x = r.x + 2; x < r.x + r.w - 2; x += 4) if (rng.chance(0.6)) tiles[y * w + x] = T.WALL;
    rooms.push(r);
  }
  for (let i = 1; i < rooms.length; i++) corridor(rng, w, h, tiles, center(rooms[i - 1]), center(rooms[i]));
  corridor(rng, w, h, tiles, center(rooms[0]), center(rooms[rooms.length - 1]));
  return rooms;
}

function regionLabels(w: number, h: number, tiles: number[], pass: (t: number) => boolean): { labels: Int32Array; sizes: number[] } {
  const labels = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (labels[i] !== -1 || !pass(tiles[i])) continue;
    const id = sizes.length;
    let size = 0;
    const st = [i];
    labels[i] = id;
    while (st.length) {
      const j = st.pop()!;
      size++;
      const x = j % w, y = (j / w) | 0;
      for (const d of DIRS8) {
        const nx = x + d.x, ny = y + d.y;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx;
        if (labels[k] === -1 && pass(tiles[k])) { labels[k] = id; st.push(k); }
      }
    }
    sizes.push(size);
  }
  return { labels, sizes };
}

function keepLargestRegion(w: number, h: number, tiles: number[]) {
  const { labels, sizes } = regionLabels(w, h, tiles, (t) => t !== T.WALL);
  if (!sizes.length) return;
  const best = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < w * h; i++) if (tiles[i] !== T.WALL && labels[i] !== best) tiles[i] = T.WALL;
  // walls on the border
  for (let x = 0; x < w; x++) { tiles[x] = T.WALL; tiles[(h - 1) * w + x] = T.WALL; }
  for (let y = 0; y < h; y++) { tiles[y * w] = T.WALL; tiles[y * w + w - 1] = T.WALL; }
}

function addPools(rng: Rng, w: number, h: number, tiles: number[], core: number, rim: number, n: number) {
  for (let k = 0; k < n; k++) {
    const cx = rng.int(4, w - 5), cy = rng.int(4, h - 5);
    const r = rng.int(2, 4);
    for (let y = cy - r - 1; y <= cy + r + 1; y++) for (let x = cx - r - 1; x <= cx + r + 1; x++) {
      if (!inb(w, h, x, y) || tiles[y * w + x] !== T.FLOOR) continue;
      const d = Math.hypot(x - cx, y - cy) + rng.next() * 0.8;
      if (d <= r - 0.5) tiles[y * w + x] = core;
      else if (d <= r + 1 && rim !== T.FLOOR) tiles[y * w + x] = rim;
    }
  }
}

function scatter(rng: Rng, w: number, h: number, tiles: number[], t: number, n: number) {
  for (let k = 0; k < n * 5 && n > 0; k++) {
    const x = rng.int(2, w - 3), y = rng.int(2, h - 3);
    if (tiles[y * w + x] !== T.FLOOR) continue;
    // keep corridors open: only place where all 4 neighbours are floor
    if (DIRS4.every((d) => tiles[(y + d.y) * w + x + d.x] === T.FLOOR)) { tiles[y * w + x] = t; n--; }
  }
}

/** Converts blocking terrain that splits the walkable map back into passable terrain. */
function ensureConnected(w: number, h: number, tiles: number[]) {
  for (let pass = 0; pass < 6; pass++) {
    const { labels, sizes } = regionLabels(w, h, tiles, walkable);
    if (sizes.length <= 1) return;
    const best = sizes.indexOf(Math.max(...sizes));
    // turn deep water / lava / trees / statues adjacent to small regions into shallow water / floor
    let changed = false;
    for (let i = 0; i < w * h; i++) {
      const t = tiles[i];
      if (t === T.DEEP || t === T.LAVA || t === T.TREE || t === T.STATUE) {
        const x = i % w, y = (i / w) | 0;
        const touches = DIRS8.some((d) => { const j = (y + d.y) * w + x + d.x; return labels[j] >= 0 && labels[j] !== best; });
        if (touches) { tiles[i] = t === T.DEEP ? T.SHALLOW : T.FLOOR; changed = true; }
      }
    }
    if (!changed) {
      for (let i = 0; i < w * h; i++) if (labels[i] >= 0 && labels[i] !== best) tiles[i] = T.WALL;
      return;
    }
  }
}

function placeStairs(rng: Rng, w: number, h: number, tiles: number[], depth: number, downCount: number): { up: Pos[]; down: Pos[] } | null {
  const floors: Pos[] = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (tiles[y * w + x] === T.FLOOR) floors.push({ x, y });
  if (floors.length < 30) return null;
  const up = rng.pick(floors);
  tiles[up.y * w + up.x] = depth === 1 ? T.EXIT : T.UP;
  const d = distanceMap(w, h, [up], (x, y) => walkable(tiles[y * w + x]));
  const far = floors.filter((p) => d[p.y * w + p.x] < UNREACHED && d[p.y * w + p.x] > 15);
  const down: Pos[] = [];
  for (let i = 0; i < downCount; i++) {
    const cands = far.filter((p) => tiles[p.y * w + p.x] === T.FLOOR && down.every((o) => Math.abs(o.x - p.x) + Math.abs(o.y - p.y) > 10));
    if (!cands.length) break;
    const p = rng.pick(cands);
    tiles[p.y * w + p.x] = T.DOWN;
    down.push(p);
  }
  if (downCount > 0 && !down.length) return null;
  return { up: [up], down };
}
