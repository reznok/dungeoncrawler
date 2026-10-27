// Recursive shadowcasting. Returns a Set of indices (y * w + x) that are visible.

const MULT = [
  [1, 0, 0, -1, -1, 0, 0, 1],
  [0, 1, -1, 0, 0, -1, 1, 0],
  [0, 1, 1, 0, 0, -1, -1, 0],
  [1, 0, 0, 1, -1, 0, 0, -1],
];

export function computeFov(w: number, h: number, ox: number, oy: number, radius: number, blocks: (x: number, y: number) => boolean): Set<number> {
  const vis = new Set<number>();
  vis.add(oy * w + ox);
  const r2 = radius * radius + radius;
  function cast(row: number, start: number, end: number, xx: number, xy: number, yx: number, yy: number) {
    if (start < end) return;
    let newStart = 0;
    for (let j = row; j <= radius; j++) {
      let dx = -j - 1;
      const dy = -j;
      let blocked = false;
      while (dx <= 0) {
        dx += 1;
        const X = ox + dx * xx + dy * xy;
        const Y = oy + dx * yx + dy * yy;
        const lSlope = (dx - 0.5) / (dy + 0.5);
        const rSlope = (dx + 0.5) / (dy - 0.5);
        if (start < rSlope) continue;
        if (end > lSlope) break;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        if (dx * dx + dy * dy <= r2) vis.add(Y * w + X);
        const b = blocks(X, Y);
        if (blocked) {
          if (b) { newStart = rSlope; continue; }
          blocked = false;
          start = newStart;
        } else if (b && j < radius) {
          blocked = true;
          cast(j + 1, start, lSlope, xx, xy, yx, yy);
          newStart = rSlope;
        }
      }
      if (blocked) break;
    }
  }
  for (let o = 0; o < 8; o++) cast(1, 1.0, 0.0, MULT[0][o], MULT[1][o], MULT[2][o], MULT[3][o]);
  return vis;
}
