import type { Monster, Run } from '../core/types';
import { DIRS8, dist, type Pos } from '../core/geom';
import { T, TERRAIN } from '../data/terrain';
import { actorAt, cur, isPlayer, isVisible, msg, view } from './state';
import { distanceMap, downhill, findPath, UNREACHED } from '../world/path';
import { playerCanEnter, canFireAt, type Action } from './turn';
import { nearestEnemy } from './abilities';
import { playerStats } from './stats';
import { MONSTERS } from '../data/monsters';

function knownPassable(run: Run, x: number, y: number): boolean {
  const l = cur(run);
  const i = y * l.w + x;
  if (!l.seen[i]) return false;
  const t = l.tiles[i];
  if (t === T.DOOR) return true;
  if (!playerCanEnter(run, x, y)) return false;
  if (l.features.some((f) => f.kind === 'trap' && !f.hidden && f.x === x && f.y === y)) return false;
  return true;
}

function stepTo(run: Run, next: Pos): Action {
  const p = run.player;
  return { t: 'move', dx: next.x - p.x, dy: next.y - p.y };
}

export function enemiesInView(run: Run, threatsOnly = false) {
  const s = playerStats(run);
  const p = run.player;
  return cur(run).monsters.filter((m) => {
    if (m.ally || m.friendly || m.hp <= 0 || !isVisible(run, m.x, m.y)) return false;
    if (m.statuses.invisible && !s.flags.has('see_invis')) return false;
    if (threatsOnly && dist(m, p) > 2) {
      // things that cannot come for you do not stop exploration
      const f = MONSTERS[m.def].flags ?? [];
      if (f.includes('aquatic') || f.includes('stationary')) return false;
    }
    return true;
  });
}

/** The visible hostile standing on `pos`, if any: travelling there means walking into a fight. */
export function hostileAt(run: Run, pos: Pos): Monster | undefined {
  const a = actorAt(run, pos.x, pos.y);
  if (!a || isPlayer(a) || a.ally || a.friendly || a.hp <= 0) return undefined;
  return enemiesInView(run).includes(a) ? a : undefined;
}

export function travelStep(run: Run, dest: Pos): Action | null {
  const p = run.player;
  const l = cur(run);
  if (p.x === dest.x && p.y === dest.y) return null;
  const path = findPath(l.w, l.h, p, dest, (x, y) => knownPassable(run, x, y) || (x === dest.x && y === dest.y && TERRAIN[l.tiles[y * l.w + x]].walk));
  if (!path || !path.length) return null;
  return stepTo(run, path[0]);
}

export function exploreStep(run: Run): Action | string {
  const p = run.player;
  const l = cur(run);
  if (enemiesInView(run, true).length) return 'There are enemies in view.';
  // targets: frontier tiles and unvisited items
  const targets: Pos[] = [];
  for (let y = 1; y < l.h - 1; y++) for (let x = 1; x < l.w - 1; x++) {
    const i = y * l.w + x;
    if (!l.seen[i] || !knownPassable(run, x, y)) continue;
    if (DIRS8.some((d) => !l.seen[(y + d.y) * l.w + x + d.x])) targets.push({ x, y });
  }
  for (const fi of l.items) {
    const v = fi as { visited?: boolean } & typeof fi;
    if (fi.seen && !v.visited && !(fi.x === p.x && fi.y === p.y)) targets.push({ x: fi.x, y: fi.y });
  }
  for (const f of l.features) if (f.kind === 'chest' && !f.used && l.seen[f.y * l.w + f.x] && !(f.x === p.x && f.y === p.y)) targets.push({ x: f.x, y: f.y });
  for (const fi of l.items) if (fi.x === p.x && fi.y === p.y) (fi as { visited?: boolean }).visited = true;
  if (!targets.length) return 'Done exploring. Tap the stairs button to head down.';
  const d = distanceMap(l.w, l.h, targets, (x, y) => knownPassable(run, x, y) || (x === p.x && y === p.y));
  if (d[p.y * l.w + p.x] >= UNREACHED) return 'Nothing more you can reach.';
  const next = downhill(l.w, l.h, d, p, (x, y) => knownPassable(run, x, y));
  if (!next) return 'Done exploring.';
  return stepTo(run, next);
}

export function stairsStep(run: Run): Action | string {
  const p = run.player;
  const l = cur(run);
  const t = l.tiles[p.y * l.w + p.x];
  if (t === T.DOWN) return { t: 'stairs' };
  const known = l.down.filter((s) => l.seen[s.y * l.w + s.x]);
  if (!known.length) return 'You have not found the way down yet.';
  known.sort((a, b) => dist(a, p) - dist(b, p));
  const step = travelStep(run, known[0]);
  return step ?? 'You cannot reach the stairs.';
}

export function restStep(run: Run): Action | string {
  const p = run.player;
  const s = playerStats(run);
  if (enemiesInView(run, true).length) return 'You cannot rest with enemies in view.';
  const needs = p.hp < s.maxHp || p.mp < s.maxMp || Object.keys(p.statuses).some((k) => ['poison', 'slow', 'confused', 'blind', 'weak', 'fatigue', 'corroded', 'doughy'].includes(k)) || Object.keys(p.cooldowns).length > 0;
  if (!needs) return 'You feel fully rested.';
  return { t: 'rest' };
}

export function fightStep(run: Run): Action | string {
  const p = run.player;
  const m = nearestEnemy(run);
  if (!m) return 'No enemies in sight.';
  if (dist(m, p) <= 1) return { t: 'move', dx: m.x - p.x, dy: m.y - p.y };
  if (canFireAt(run, m)) return { t: 'fire', target: { x: m.x, y: m.y } };
  const l = cur(run);
  const path = findPath(l.w, l.h, p, m, (x, y) => knownPassable(run, x, y) || (x === m.x && y === m.y));
  if (!path || !path.length) return 'You cannot reach it.';
  return stepTo(run, path[0]);
}

export function noteInterrupt(run: Run, reason: string) { view.interrupt = true; msg(run, reason, 'dim'); }
