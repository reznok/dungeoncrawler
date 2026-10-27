// Seeded, serialisable RNG (sfc32). The whole run uses one instance stored in the save.

export interface RngState { a: number; b: number; c: number; d: number }

export class Rng {
  s: RngState;
  constructor(seed: number | RngState) {
    if (typeof seed === 'number') {
      this.s = { a: 0x9e3779b9, b: 0x243f6a88, c: 0xb7e15162, d: seed >>> 0 };
      for (let i = 0; i < 15; i++) this.next();
    } else {
      this.s = { ...seed };
    }
  }
  next(): number {
    let { a, b, c, d } = this.s;
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = c << 21 | c >>> 11;
    c = c + t | 0;
    const s = this.s; // mutate in place: the run's save shares this object
    s.a = a; s.b = b; s.c = c; s.d = d;
    return (t >>> 0) / 4294967296;
  }
  /** Integer in [lo, hi] inclusive. */
  int(lo: number, hi: number): number { return lo + Math.floor(this.next() * (hi - lo + 1)); }
  /** True with probability p (0..1). */
  chance(p: number): boolean { return this.next() < p; }
  /** 1 in n. */
  oneIn(n: number): boolean { return this.int(1, n) === 1; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  /** Picks n distinct elements. */
  sample<T>(arr: readonly T[], n: number): T[] { return this.shuffle([...arr]).slice(0, n); }
  weighted<T>(items: readonly T[], weight: (t: T) => number): T | undefined {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) return undefined;
    let r = this.next() * total;
    for (const it of items) {
      r -= Math.max(0, weight(it));
      if (r < 0) return it;
    }
    return items[items.length - 1];
  }
  /** Dice like 2d6. */
  roll(n: number, sides: number): number {
    let t = 0;
    for (let i = 0; i < n; i++) t += this.int(1, sides);
    return t;
  }
  /** Random rounding: 2.3 -> 2 (70%) or 3 (30%). */
  round(x: number): number { const f = Math.floor(x); return f + (this.next() < x - f ? 1 : 0); }
}
