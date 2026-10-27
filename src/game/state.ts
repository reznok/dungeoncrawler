import type { Pos } from '../core/geom';
import type { Level, Monster, Player, Run, ActorBase } from '../core/types';
import { Rng } from '../core/rng';
import { T, TERRAIN } from '../data/terrain';

/** Transient (unsaved) view state. */
export const view = {
  visible: new Set<number>(),
  rng: null as Rng | null,
  interrupt: false, // something happened that should stop auto-explore / travel / rest
  newlySeen: [] as Monster[],
};

export function rng(run: Run): Rng {
  if (!view.rng || view.rng.s !== run.rng) {
    view.rng = new Rng(run.rng);
    view.rng.s = run.rng; // share the object so the save always holds the current state
  }
  return view.rng;
}

export function cur(run: Run): Level { return run.levels[run.depth]; }
export function newId(run: Run): number { return run.nextId++; }

export function msg(run: Run, text: string, cls?: string) {
  run.messages.push({ text, cls, turn: run.turn });
  if (run.messages.length > 200) run.messages.splice(0, run.messages.length - 200);
}

export function isPlayer(a: ActorBase): a is Player { return (a as Player).ancestry !== undefined; }

export function inside(l: Level, x: number, y: number): boolean { return x >= 0 && y >= 0 && x < l.w && y < l.h; }
export function tileAt(l: Level, x: number, y: number): number { return inside(l, x, y) ? l.tiles[y * l.w + x] : T.WALL; }

export function monsterAt(l: Level, x: number, y: number): Monster | undefined {
  for (const m of l.monsters) if (m.x === x && m.y === y && m.hp > 0) return m;
  return undefined;
}

export function actorAt(run: Run, x: number, y: number): Player | Monster | undefined {
  const p = run.player;
  if (p.x === x && p.y === y) return p;
  return monsterAt(cur(run), x, y);
}

export function isVisible(run: Run, x: number, y: number): boolean {
  return view.visible.has(y * cur(run).w + x);
}

export function blocksSight(l: Level, x: number, y: number): boolean {
  const t = tileAt(l, x, y);
  if (!TERRAIN[t].see) return true;
  return l.clouds.some((c) => c.x === x && c.y === y && (c.type === 'smoke' || c.type === 'ink'));
}

export function name(run: Run, a: ActorBase, the = true): string {
  if (isPlayer(a)) return 'you';
  const m = a as Monster;
  if (m.name) return m.name;
  return (the ? 'the ' : 'a ') + monsterName(m);
}
export function Name(run: Run, a: ActorBase): string {
  const n = name(run, a);
  return n.charAt(0).toUpperCase() + n.slice(1);
}
// late-bound to avoid an import cycle with data/monsters for names
export let monsterName: (m: Monster) => string = (m) => m.def;
export function setMonsterNamer(f: (m: Monster) => string) { monsterName = f; }

export function nearestFree(run: Run, l: Level, p: Pos, ok: (x: number, y: number) => boolean, maxR = 6): Pos | null {
  for (let r = 0; r <= maxR; r++) {
    const cands: Pos[] = [];
    for (let y = p.y - r; y <= p.y + r; y++) for (let x = p.x - r; x <= p.x + r; x++) {
      if (Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) !== r) continue;
      if (!inside(l, x, y)) continue;
      if (ok(x, y) && !actorAt(run, x, y) && !(run.depth === l.depth ? false : false)) cands.push({ x, y });
    }
    if (cands.length) return rng(run).pick(cands);
  }
  return null;
}
