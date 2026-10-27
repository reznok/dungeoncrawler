export interface Pos { x: number; y: number }

export const DIRS8: readonly Pos[] = [
  { x: 0, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 0 }, { x: 1, y: 1 },
  { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 },
];
export const DIRS4: readonly Pos[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

/** Chebyshev distance (8-way moves). */
export function dist(a: Pos, b: Pos): number { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
export function eq(a: Pos, b: Pos): boolean { return a.x === b.x && a.y === b.y; }
export function sign(n: number): number { return n > 0 ? 1 : n < 0 ? -1 : 0; }

/** Bresenham line from a to b, excluding a, including b. */
export function line(a: Pos, b: Pos): Pos[] {
  const out: Pos[] = [];
  let x0 = a.x, y0 = a.y;
  const dx = Math.abs(b.x - x0), dy = -Math.abs(b.y - y0);
  const sx = x0 < b.x ? 1 : -1, sy = y0 < b.y ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 200; i++) {
    if (x0 === b.x && y0 === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
    out.push({ x: x0, y: y0 });
  }
  return out;
}

/** Ray from a through b, continued to length n (excluding a). */
export function ray(a: Pos, b: Pos, n: number): Pos[] {
  if (eq(a, b)) return [];
  const far = { x: a.x + (b.x - a.x) * 30, y: a.y + (b.y - a.y) * 30 };
  return line(a, far).slice(0, n);
}

export function hash2(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}
