import { DIRS8, type Pos } from '../core/geom';

export const UNREACHED = 1e9;

/** Breadth-first distance map from the given sources over 8-way moves. */
export function distanceMap(w: number, h: number, sources: Pos[], passable: (x: number, y: number) => boolean, maxDist = 9999): Float64Array {
  const d = new Float64Array(w * h).fill(UNREACHED);
  const q: number[] = [];
  for (const s of sources) {
    const i = s.y * w + s.x;
    if (d[i] !== 0) { d[i] = 0; q.push(i); }
  }
  let head = 0;
  while (head < q.length) {
    const i = q[head++];
    const x = i % w, y = (i / w) | 0;
    const nd = d[i] + 1;
    if (nd > maxDist) continue;
    for (const dir of DIRS8) {
      const nx = x + dir.x, ny = y + dir.y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (d[ni] <= nd) continue;
      if (!passable(nx, ny)) continue;
      d[ni] = nd;
      q.push(ni);
    }
  }
  return d;
}

/** Neighbour of `from` with the lowest distance, or null if none is lower. */
export function downhill(w: number, h: number, d: Float64Array, from: Pos, ok: (x: number, y: number) => boolean): Pos | null {
  let best: Pos | null = null;
  let bestD = d[from.y * w + from.x];
  for (const dir of DIRS8) {
    const nx = from.x + dir.x, ny = from.y + dir.y;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const v = d[ny * w + nx];
    // prefer orthogonal moves on ties for nicer paths
    if (v < bestD || (best && v === bestD && v < d[from.y * w + from.x] && (dir.x === 0 || dir.y === 0))) {
      if (!ok(nx, ny)) continue;
      bestD = v;
      best = { x: nx, y: ny };
    }
  }
  return best;
}

/** Full path from `from` to `to` (excluding from), or null. */
export function findPath(w: number, h: number, from: Pos, to: Pos, passable: (x: number, y: number) => boolean): Pos[] | null {
  const d = distanceMap(w, h, [to], (x, y) => passable(x, y) || (x === from.x && y === from.y));
  if (d[from.y * w + from.x] >= UNREACHED) return null;
  const path: Pos[] = [];
  let cur = from;
  for (let i = 0; i < 2000; i++) {
    if (cur.x === to.x && cur.y === to.y) break;
    const nxt = downhill(w, h, d, cur, () => true);
    if (!nxt) return null;
    path.push(nxt);
    cur = nxt;
  }
  return path;
}
