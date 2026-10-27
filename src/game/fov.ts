import type { Pos } from '../core/geom';
import type { Run } from '../core/types';
import { computeFov } from '../world/fov';
import { blocksSight, cur, view } from './state';
import { playerStats } from './stats';
import { THEMES } from '../data/terrain';
import { monDef } from './combat';

export function updateFov(run: Run) {
  const l = cur(run);
  const p = run.player;
  const s = playerStats(run);
  let radius = s.sight + (THEMES[l.theme]?.sight ?? 0);
  radius = Math.max(1, radius);
  const before = new Set(l.monsters.filter((m) => view.visible.has(m.y * l.w + m.x)).map((m) => m.id));
  view.visible = computeFov(l.w, l.h, p.x, p.y, radius, (x, y) => blocksSight(l, x, y));
  for (const i of view.visible) l.seen[i] = 1;
  // newly seen hostiles interrupt travel
  view.newlySeen = [];
  for (const m of l.monsters) {
    if (m.ally || m.friendly || m.hp <= 0) continue;
    if (!view.visible.has(m.y * l.w + m.x)) continue;
    if (m.statuses.invisible && !s.flags.has('see_invis')) continue;
    if (!before.has(m.id)) view.newlySeen.push(m);
    if (!m.noticed) { m.noticed = true; }
  }
  if (view.newlySeen.length) view.interrupt = true;
  for (const it of l.items) if (view.visible.has(it.y * l.w + it.x)) it.seen = true;
  for (const f of l.features) if (view.visible.has(f.y * l.w + f.x) && f.kind !== 'trap') f.hidden = false;
}

export function revealMap(run: Run, from: Pos, radius: number) {
  const l = cur(run);
  for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) {
    if (Math.max(Math.abs(x - from.x), Math.abs(y - from.y)) > radius) continue;
    const i = y * l.w + x;
    // reveal walls next to open ground, and open ground
    l.seen[i] = 1;
  }
}

/** Monsters the player can sense but not see (gnoll nose etc.). */
export function sensedMonsters(run: Run) {
  const s = playerStats(run);
  if (!s.flags.has('sniff')) return [];
  const p = run.player;
  const l = cur(run);
  return l.monsters.filter((m) => !m.ally && m.hp > 0 && Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= 7 && !view.visible.has(m.y * l.w + m.x) && monDef(m).family !== 'construct');
}
