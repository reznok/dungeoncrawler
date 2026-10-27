import type { Level, Monster, Run } from '../core/types';
import { DIRS8, dist, type Pos } from '../core/geom';
import { MONSTERS } from '../data/monsters';
import { ABILITIES } from '../data/abilities';
import { T, TERRAIN } from '../data/terrain';
import { actorAt, cur, isVisible, msg, Name, rng, tileAt, view, inside } from './state';
import { addStatus, monDef, monsterAttack } from './combat';
import { execAbility, los, enemiesOf } from './abilities';
import { playerStats } from './stats';
import { distanceMap, UNREACHED } from '../world/path';

export function spawnMonster(run: Run, l: Level, id: string, x: number, y: number, opts: { awake?: boolean } = {}): Monster | null {
  const def = MONSTERS[id];
  if (!def) return null;
  const m: Monster = {
    id: run.nextId++, def: id, x, y, hp: def.hp, maxHp: def.hp, energy: rng(run).int(0, 90),
    statuses: {}, awake: opts.awake ?? false, cooldowns: {},
  };
  if (def.unique) m.name = def.name;
  if (def.flags?.includes('invisible')) m.statuses.invisible = { turns: 99999 };
  // the deep floors bite harder: +5% HP per depth past 6, +1 damage per 3 depths past 6
  if (l.depth > 6) { m.maxHp = m.hp = Math.round(def.hp * (1 + 0.05 * (l.depth - 6))); m.bonus = Math.floor((l.depth - 6) / 3); }
  if (run.player.piety?.god === 'rat' && (id === 'rat' || id === 'orange_rat')) m.friendly = true;
  l.monsters.push(m);
  return m;
}

export function canMonsterEnter(run: Run, m: Monster, x: number, y: number): boolean {
  const l = cur(run);
  if (!inside(l, x, y)) return false;
  const t = tileAt(l, x, y);
  const def = monDef(m);
  const f = def.flags ?? [];
  if (f.includes('aquatic')) return t === T.DEEP || t === T.SHALLOW;
  if (t === T.DEEP) return f.includes('swim') || f.includes('flying');
  if (t === T.LAVA) return f.includes('flying') || (f.includes('rfire') && def.family === 'fire');
  if (t === T.CHASM) return f.includes('flying');
  if (t === T.EXIT && !m.ally) return false;
  return TERRAIN[t].walk;
}

export function noise(run: Run, at: Pos, radius: number) {
  const r = rng(run);
  for (const m of cur(run).monsters) {
    if (m.ally || m.friendly || dist(m, at) > radius) continue;
    if (!m.awake && r.chance(0.75)) { m.awake = true; delete m.statuses.asleep; }
    if (m.awake) m.lastSeen = { x: at.x, y: at.y };
  }
}

let distCache: { tick: number; depth: number; px: number; py: number; d: Float64Array } | null = null;
function playerDist(run: Run): Float64Array {
  const p = run.player;
  if (distCache && distCache.tick === run.tick && distCache.depth === run.depth && distCache.px === p.x && distCache.py === p.y) return distCache.d;
  const l = cur(run);
  const d = distanceMap(l.w, l.h, [p], (x, y) => { const t = l.tiles[y * l.w + x]; return TERRAIN[t].walk || t === T.SHALLOW; }, 40);
  distCache = { tick: run.tick, depth: run.depth, px: p.x, py: p.y, d };
  return d;
}

export function canSeePlayer(run: Run, m: Monster): boolean {
  const p = run.player;
  const l = cur(run);
  if (m.statuses.blind && dist(m, p) > 1) return false;
  if (dist(m, p) > 9) return false;
  if (!view.visible.has(m.y * l.w + m.x)) return false; // symmetric enough
  if (p.statuses.invisible && !monDef(m).flags?.includes('see_invis')) return dist(m, p) <= 1 && rng(run).chance(0.5);
  return true;
}

function tryMove(run: Run, m: Monster, to: Pos): boolean {
  const l = cur(run);
  if (!canMonsterEnter(run, m, to.x, to.y)) return false;
  const occ = actorAt(run, to.x, to.y);
  if (occ) return false;
  if (m.statuses.entangled) return false;
  if (l.tiles[to.y * l.w + to.x] === T.DOOR) { l.tiles[to.y * l.w + to.x] = T.OPEN_DOOR; return true; }
  m.x = to.x; m.y = to.y;
  return true;
}

function stepToward(run: Run, m: Monster, goal: Pos): boolean {
  // greedy with sidestep
  const opts = DIRS8.map((d) => ({ x: m.x + d.x, y: m.y + d.y })).sort((a, b) => dist(a, goal) - dist(b, goal) || (Math.abs(a.x - goal.x) + Math.abs(a.y - goal.y)) - (Math.abs(b.x - goal.x) + Math.abs(b.y - goal.y)));
  for (const o of opts.slice(0, 3)) {
    if (dist(o, goal) >= dist(m, goal) && o !== opts[0]) continue;
    if (tryMove(run, m, o)) return true;
  }
  return false;
}

function stepTowardPlayer(run: Run, m: Monster): boolean {
  const l = cur(run);
  const d = playerDist(run);
  const here = d[m.y * l.w + m.x];
  if (here >= UNREACHED) return stepToward(run, m, run.player);
  const r = rng(run);
  const cands = r.shuffle(DIRS8.map((dd) => ({ x: m.x + dd.x, y: m.y + dd.y })))
    .filter((o) => inside(l, o.x, o.y) && d[o.y * l.w + o.x] < here)
    .sort((a, b) => d[a.y * l.w + a.x] - d[b.y * l.w + b.x]);
  for (const o of cands) if (tryMove(run, m, o)) return true;
  return false;
}

function stepAway(run: Run, m: Monster, from: Pos): boolean {
  const opts = DIRS8.map((d) => ({ x: m.x + d.x, y: m.y + d.y })).filter((o) => dist(o, from) > dist(m, from));
  rng(run).shuffle(opts);
  for (const o of opts) if (tryMove(run, m, o)) return true;
  return false;
}

function randomStep(run: Run, m: Monster): boolean {
  const opts = rng(run).shuffle(DIRS8.map((d) => ({ x: m.x + d.x, y: m.y + d.y })));
  for (const o of opts) if (tryMove(run, m, o)) return true;
  return false;
}

/** One action for a monster. */
export function monsterAct(run: Run, m: Monster) {
  const def = monDef(m);
  const r = rng(run);
  const p = run.player;
  if (m.statuses.paralysed || m.statuses.asleep) return;
  if (m.friendly) return;
  if (m.ally) return allyAct(run, m);
  if (!m.awake) {
    // wanderers stroll even unaware
    return;
  }
  const flags = def.flags ?? [];
  if (flags.includes('erratic') && r.chance(0.4)) { randomStep(run, m); return; }
  if (m.statuses.confused && r.chance(0.5)) {
    const d = r.pick(DIRS8);
    const t = actorAt(run, m.x + d.x, m.y + d.y);
    if (t && t !== m) monsterAttack(run, m, t);
    else tryMove(run, m, { x: m.x + d.x, y: m.y + d.y });
    return;
  }
  const sees = canSeePlayer(run, m);
  if (sees) m.lastSeen = { x: p.x, y: p.y };
  // invisible-sometimes uniques
  if (flags.includes('invisible_sometimes') && !m.statuses.invisible && r.chance(0.08)) { addStatus(run, m, 'invisible', 6); if (isVisible(run, m.x, m.y)) msg(run, `${Name(run, m)} fades from view.`, 'warn'); }
  // barks
  if (sees && def.lines && r.chance(def.unique ? 0.12 : 0.04)) msg(run, `${Name(run, m)}: ${r.pick(def.lines)}`, 'speech');
  const adjacentFoe = enemiesOf(run, m).find((o) => dist(o, m) <= 1 && (o !== p || sees || dist(o, m) <= 1));
  if (m.statuses.afraid) {
    if (!stepAway(run, m, p) && adjacentFoe) monsterAttack(run, m, adjacentFoe);
    return;
  }
  if (sees || (adjacentFoe && adjacentFoe !== p)) {
    // abilities
    for (const ab of def.abilities ?? []) {
      if ((m.cooldowns[ab.id] ?? 0) > 0) continue;
      if (!r.chance(ab.chance)) continue;
      const a = ABILITIES[ab.id];
      if (!a) continue;
      let target: Pos = p;
      if (a.target === 'self') target = m;
      if (a.kind === 'heal' && m.hp > m.maxHp * 0.6) continue;
      if ((a.kind === 'buff' || a.kind === 'summon') && dist(m, p) > 7) continue;
      if (a.target !== 'self' && (dist(m, p) > a.range || !los(run, m, p))) continue;
      if ((a.kind === 'strike' || a.kind === 'drain') && dist(m, p) > 1) continue;
      if (ab.id === 'blink_away' && dist(m, p) > 2 && m.hp > m.maxHp * 0.4) continue;
      if (a.kind === 'buff' && m.statuses[a.status!]) continue;
      if (execAbility(run, m, ab.id, target)) {
        m.cooldowns[ab.id] = a.kind === 'summon' ? 10 : 3;
        return;
      }
    }
  }
  if (adjacentFoe) { monsterAttack(run, m, adjacentFoe); return; }
  if (flags.includes('stationary')) return;
  if (m.statuses.entangled) return;
  if (sees) { stepTowardPlayer(run, m); return; }
  if (m.lastSeen) {
    if (m.x === m.lastSeen.x && m.y === m.lastSeen.y) { m.lastSeen = undefined; return; }
    if (!stepToward(run, m, m.lastSeen)) m.lastSeen = undefined;
    return;
  }
  // wander
  if (!m.wander || (m.x === m.wander.x && m.y === m.wander.y) || r.chance(0.05)) {
    const l = cur(run);
    for (let i = 0; i < 20; i++) {
      const x = r.int(1, l.w - 2), y = r.int(1, l.h - 2);
      if (canMonsterEnter(run, m, x, y)) { m.wander = { x, y }; break; }
    }
  }
  if (m.wander && !stepToward(run, m, m.wander)) m.wander = undefined;
}

function allyAct(run: Run, m: Monster) {
  const p = run.player;
  const l = cur(run);
  const foes = l.monsters.filter((o) => !o.ally && !o.friendly && o.hp > 0 && view.visible.has(o.y * l.w + o.x) && dist(o, m) <= 8);
  foes.sort((a, b) => dist(a, m) - dist(b, m));
  const def = monDef(m);
  const target = foes[0];
  if (target) {
    for (const ab of def.abilities ?? []) {
      const a = ABILITIES[ab.id];
      if (!a || (m.cooldowns[ab.id] ?? 0) > 0 || !rng(run).chance(ab.chance)) continue;
      if (a.target !== 'self' && (dist(m, target) > a.range || !los(run, m, target))) continue;
      if (execAbility(run, m, ab.id, a.target === 'self' ? m : target)) { m.cooldowns[ab.id] = 3; return; }
    }
    if (dist(target, m) <= 1) { monsterAttack(run, m, target); return; }
    if (stepToward(run, m, target)) return;
  }
  if (dist(m, p) > 2) stepToward(run, m, p);
  else if (rng(run).chance(0.3)) randomStep(run, m);
}

/** Per world turn: sleeping monsters may notice the player. */
export function noticeChecks(run: Run) {
  const p = run.player;
  const l = cur(run);
  const s = playerStats(run);
  const r = rng(run);
  for (const m of l.monsters) {
    if (m.awake || m.ally || m.friendly || m.statuses.asleep) continue;
    if (!view.visible.has(m.y * l.w + m.x)) continue;
    const d = dist(m, p);
    if (d > 10) continue;
    let c = Math.max(0.02, Math.min(0.5, 0.3 - s.stealth * 0.012));
    if (d <= 3) c *= 2;
    if (p.statuses.invisible) c *= 0.2;
    if (r.chance(c)) {
      m.awake = true;
      m.lastSeen = { x: p.x, y: p.y };
      if (!monDef(m).flags?.includes('mindless') && isVisible(run, m.x, m.y)) msg(run, `${Name(run, m)} notices you.`, 'warn');
      view.interrupt = true;
    }
  }
}

export function monsterSpeed(m: Monster): number {
  let sp = monDef(m).speed ?? 10;
  if (m.statuses.slow) sp *= 0.5;
  if (m.statuses.haste) sp *= 2;
  if (m.statuses.doughy) sp *= 0.75;
  if (m.statuses.berserk) sp *= 1.3;
  return sp;
}
