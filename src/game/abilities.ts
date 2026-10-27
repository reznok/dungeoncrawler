import type { ActorBase, Element, Monster, Player, Run } from '../core/types';
import { dist, line, type Pos, DIRS8 } from '../core/geom';
import { ABILITIES, type AbilityDef } from '../data/abilities';
import { MONSTERS } from '../data/monsters';
import { CLEANSABLE } from '../data/statuses';
import { T, walkable, TERRAIN } from '../data/terrain';
import { actorAt, blocksSight, cur, inside, isPlayer, isVisible, msg, name, Name, nearestFree, rng, tileAt, view } from './state';
import { addStatus, damage, monDef, monsterResist, playerAttack, monsterAttack } from './combat';
import { playerStats } from './stats';
import { pushFx, ELEMENT_COLOR } from './fx';
import { spawnMonster, noise } from './monsters';
import { revealMap } from './fov';
import { favorCost } from './progression';
import { randomItem } from './items';

export function abilityPower(run: Run, caster: ActorBase, rank: number): number {
  if (isPlayer(caster)) return playerStats(run).spellPower + (rank - 1) * 5;
  const def = monDef(caster as Monster);
  return def.level * 2 + 5;
}

function hostile(run: Run, a: ActorBase, b: ActorBase): boolean {
  if (a === b) return false;
  const aSide = isPlayer(a) || (a as Monster).ally ? 'p' : (a as Monster).friendly ? 'n' : 'm';
  const bSide = isPlayer(b) || (b as Monster).ally ? 'p' : (b as Monster).friendly ? 'n' : 'm';
  if (aSide === 'n' || bSide === 'n') return false;
  return aSide !== bSide;
}

export function allActors(run: Run): (Player | Monster)[] {
  return [run.player, ...cur(run).monsters.filter((m) => m.hp > 0)];
}

/** Can `a` see position p (line of sight, no walls)? */
export function los(run: Run, a: Pos, b: Pos): boolean {
  const l = cur(run);
  const path = line(a, b);
  for (let i = 0; i < path.length - 1; i++) if (blocksSight(l, path[i].x, path[i].y)) return false;
  return true;
}

function projectilePath(run: Run, from: Pos, to: Pos, range: number, stopAtActor: boolean): Pos[] {
  const l = cur(run);
  const out: Pos[] = [];
  const far = { x: from.x + (to.x - from.x) * 20, y: from.y + (to.y - from.y) * 20 };
  for (const p of line(from, far)) {
    if (!inside(l, p.x, p.y) || out.length >= range) break;
    const t = tileAt(l, p.x, p.y);
    if (!TERRAIN[t].see && t !== T.DOOR) break;
    if (t === T.DOOR) break;
    out.push(p);
    if (stopAtActor && actorAt(run, p.x, p.y)) break;
    if (!stopAtActor && p.x === to.x && p.y === to.y && false) break;
  }
  return out;
}

function elemBonus(run: Run, caster: ActorBase, el: Element | undefined): number {
  if (!isPlayer(caster)) return 1;
  const s = playerStats(run);
  return 1 + ((el ? s.elemPct[el] ?? 0 : 0) + s.spellPct) / 100;
}

function rollDmg(run: Run, a: AbilityDef, power: number, caster: ActorBase): number {
  const [n, sides] = a.dice ?? [1, 4];
  const extra = Math.floor(power * (a.scale ?? 0) / 10);
  let d = rng(run).roll(n, sides + extra) * elemBonus(run, caster, a.element);
  if (caster.statuses.weak) d *= 0.7;
  return Math.round(d);
}

function hitWith(run: Run, a: AbilityDef, caster: ActorBase, t: ActorBase, power: number, mult = 1) {
  const r = rng(run);
  let el: Element = a.element ?? 'phys';
  if (a.id === 'chaos_bolt') el = r.pick(['fire', 'cold', 'shock', 'poison', 'necro', 'holy', 'dough'] as Element[]);
  const dmg = Math.round(rollDmg(run, a, power, caster) * mult);
  // armour halves physical projectiles
  let final = dmg;
  if (el === 'phys' && a.kind !== 'smite') {
    const ac = isPlayer(t) ? playerStats(run).ac : monDef(t as Monster).ac;
    final = Math.max(0, dmg - r.int(0, Math.round(ac / (a.id === 'stone_spear' ? 2 : 1))));
  }
  const vis = isVisible(run, t.x, t.y);
  if (vis && a.kind !== 'nova') msg(run, `The ${a.name.toLowerCase()} hits ${name(run, t)}.`, isPlayer(t) ? 'hurt' : undefined);
  damage(run, t, final, el, { source: caster, cause: isPlayer(caster) ? 'your own magic' : `${name(run, caster, false)}'s ${a.name.toLowerCase()}` });
  if (t.hp > 0 && a.status) applyHex(run, a, caster, t, power, true);
  if (t.hp > 0 && el === 'fire' && isPlayer(caster)) {
    const s = playerStats(run);
    if (s.burnChance && r.chance(s.burnChance / 100)) addStatus(run, t, 'burning', 3, 2 + Math.floor(power / 6));
  }
  if (a.id === 'chaos_bolt' && t.hp > 0 && r.chance(0.35)) addStatus(run, t, r.pick(['slow', 'confused', 'blind', 'doughy', 'weak', 'marked']), 4);
}

/** Returns true if the hex landed. */
function applyHex(run: Run, a: AbilityDef, caster: ActorBase, t: ActorBase, power: number, rider = false): boolean {
  if (!a.status) return false;
  const r = rng(run);
  let turns = a.statusTurns ?? 5;
  if (isPlayer(t)) {
    const s = playerStats(run);
    const save = Math.min(0.7, 0.12 + s.wits * 0.015 + run.player.level * 0.01);
    if (!rider && r.chance(save)) { msg(run, `You resist.`, 'good'); return false; }
    if (a.status === 'poison' && s.res.poison > 0) return false;
    if (a.status === 'paralysed') turns = Math.min(turns, 2);
  } else {
    const m = t as Monster;
    const def = monDef(m);
    if (def.flags?.includes('boss') && ['paralysed', 'asleep', 'confused', 'afraid'].includes(a.status)) { if (isVisible(run, m.x, m.y)) msg(run, `${Name(run, m)} is unaffected.`, 'dim'); return false; }
    if (def.flags?.includes('mindless') && ['afraid', 'confused', 'asleep'].includes(a.status) && a.status !== 'confused') return false;
    if (a.status === 'poison' && monsterResist(def, 'poison') === 0) return false;
    const hexPower = isPlayer(caster) ? playerStats(run).hexPower : 0;
    const chance = Math.max(0.1, Math.min(0.95, 0.6 + (power - def.level * 2.5) / 40 + hexPower / 100));
    if (!rider && r.chance(1 - chance)) { if (isVisible(run, m.x, m.y)) msg(run, `${Name(run, m)} resists.`, 'dim'); return false; }
    if (def.unique) turns = Math.ceil(turns / 2);
    turns = Math.round(turns * (1 + hexPower / 100));
  }
  addStatus(run, t, a.status, turns, a.statusPower ?? (a.status === 'poison' ? 2 + Math.floor(power / 8) : undefined));
  return true;
}

function boltFx(run: Run, from: Pos, path: Pos[], a: AbilityDef) {
  if (!path.length) return;
  const tile = a.fx ?? 'effect/bolt*';
  pushFx({ kind: 'bolt', path: [from, ...path], tile, depth: run.depth });
}

export function enemiesOf(run: Run, caster: ActorBase): (Player | Monster)[] {
  return allActors(run).filter((o) => hostile(run, caster, o));
}

/** Executes an ability. Returns false if it could not be used (nothing spent). */
export function execAbility(run: Run, caster: Player | Monster, id: string, target: Pos, rank = 1): boolean {
  const a = ABILITIES[id] ?? (id === 'polymorph' || id === 'dig' || id === 'random' ? ({ id, name: id, kind: 'hex', target: 'enemy', range: 7 } as AbilityDef) : undefined);
  if (!a) return false;
  const r = rng(run);
  const l = cur(run);
  const power = abilityPower(run, caster, rank);
  const player = isPlayer(caster);
  const casterVisible = player || isVisible(run, caster.x, caster.y);
  if (!player && a.verb && casterVisible) msg(run, `${Name(run, caster)} ${a.verb}.`, 'warn');
  if (a.noise) noise(run, caster, a.noise);

  if (id === 'random') {
    const pick = r.pick(['firebolt', 'frost_shard', 'lightning', 'slow', 'confuse', 'polymorph', 'summon_rat', 'blink_away', 'heal', 'pie', 'fireball', 'doughify']);
    msg(run, 'The wand sputters, coughs, and does... something.', 'dim');
    if (pick === 'summon_rat' || pick === 'heal' || pick === 'blink_away') return execAbility(run, caster, pick, caster, rank);
    return execAbility(run, caster, pick, target, rank);
  }
  if (id === 'dm_fiat' && player) {
    const roll = r.int(1, 20);
    msg(run, `The Dungeon Master rolls a d20... ${roll}!`, 'story');
    if (roll === 20) { const it = randomItem(run, run.depth + 5, { good: true }); it.known = true; l.items.push({ x: caster.x, y: caster.y, item: it, seen: true }); msg(run, 'NATURAL TWENTY! Loot falls from the sky.', 'good'); return true; }
    if (roll === 1) { msg(run, 'Critical failure. The DM sighs and summons a mimic "for narrative reasons".', 'bad'); spawnNear(run, caster, 'mimic', false); return true; }
    if (roll >= 15) { caster.hp = playerStats(run).maxHp; msg(run, "You feel fully rested. Don't ask how.", 'good'); }
    else if (roll >= 8) { for (const t of enemiesOf(run, caster).filter((t0) => dist(t0, caster) <= 5)) addStatus(run, t, 'afraid', 8); msg(run, 'The monsters suddenly remember they left the oven on.', 'good'); return true; }
  }
  if (id === 'speed_warp' && player) {
    const down = l.down[0];
    const spot = down && nearestFree(run, l, down, (x, y) => walkable(tileAt(l, x, y)), 3);
    if (!spot) { msg(run, 'There is no warp zone on this floor.', 'dim'); return false; }
    pushFx({ kind: 'flash', at: [{ x: caster.x, y: caster.y }], color: '#4ef', depth: run.depth });
    caster.x = spot.x; caster.y = spot.y;
    msg(run, 'You clip through the level geometry. Skip!', 'good');
    return true;
  }
  if (id === 'polymorph') {
    const t = actorAt(run, target.x, target.y);
    if (!t || isPlayer(t)) { msg(run, 'Nothing happens.', 'dim'); return true; }
    const m = t as Monster;
    const def = monDef(m);
    if (def.unique) { msg(run, `${Name(run, m)} shrugs off the change.`, 'dim'); return true; }
    const pool = Object.values(MONSTERS).filter((d) => !d.unique && (d.rarity ?? 10) > 0 && Math.abs(d.level - def.level) <= 3 && d.id !== def.id && !d.flags?.includes('aquatic'));
    const nd = r.pick(pool);
    const old = Name(run, m);
    m.def = nd.id; m.maxHp = nd.hp; m.hp = Math.min(m.hp, nd.hp) || nd.hp; m.statuses = {};
    msg(run, `${old} turns into ${name(run, m, false)}!`, 'warn');
    boltFx(run, caster, line(caster, target), { ...a, fx: 'effect/chaos*' });
    return true;
  }
  if (id === 'dig') {
    const path = line(caster, { x: caster.x + (target.x - caster.x) * 10, y: caster.y + (target.y - caster.y) * 10 }).slice(0, 8);
    let dug = 0;
    for (const p of path) {
      if (!inside(l, p.x, p.y) || p.x === 0 || p.y === 0 || p.x === l.w - 1 || p.y === l.h - 1) break;
      const t = l.tiles[p.y * l.w + p.x];
      if (t === T.WALL || t === T.TREE || t === T.STATUE) { l.tiles[p.y * l.w + p.x] = T.FLOOR; dug++; }
    }
    msg(run, dug ? 'The rock crumbles away.' : 'Nothing to dig.', 'dim');
    return true;
  }

  switch (a.kind) {
    case 'bolt': {
      const shots = a.count ?? 1;
      for (let i = 0; i < shots; i++) {
        const pierce = player && id !== 'pie' && (a.id === 'rapid_shot' || a.id === 'pin_shot') && playerStats(run).flags.has('pierce_shots');
        const path = projectilePath(run, caster, target, a.range, !pierce);
        boltFx(run, caster, path, a);
        const hits = path.map((p) => actorAt(run, p.x, p.y)).filter((t): t is Player | Monster => !!t && t !== caster);
        for (const t of pierce ? hits : hits.slice(0, 1)) {
          // a chance to dodge physical projectiles
          const ev = isPlayer(t) ? playerStats(run).ev : monDef(t as Monster).ev;
          if (a.element === 'phys' && r.chance(Math.min(0.4, ev * 0.015))) { if (isVisible(run, t.x, t.y)) msg(run, `${Name(run, t)} ${isPlayer(t) ? 'dodge' : 'dodges'} the ${a.name.toLowerCase()}.`, 'dim'); continue; }
          hitWith(run, a, caster, t, power, player && (a.id === 'rapid_shot' || a.id === 'pin_shot') ? 1 + playerStats(run).rangedPct / 100 + (rank - 1) * 0.15 : 1);
        }
      }
      return true;
    }
    case 'beam': {
      const path = projectilePath(run, caster, target, a.range, false);
      boltFx(run, caster, path, a);
      for (const p of path) { const t = actorAt(run, p.x, p.y); if (t && t !== caster) hitWith(run, a, caster, t, power); }
      return true;
    }
    case 'ball': {
      const path = projectilePath(run, caster, target, a.range, true);
      const reach = path.findIndex((p) => p.x === target.x && p.y === target.y);
      const travelled = reach >= 0 ? path.slice(0, reach + 1) : path;
      boltFx(run, caster, travelled, a);
      const c = travelled[travelled.length - 1] ?? target;
      const rad = a.radius ?? 1;
      const area: Pos[] = [];
      for (let y = c.y - rad; y <= c.y + rad; y++) for (let x = c.x - rad; x <= c.x + rad; x++) if (inside(l, x, y) && walkable(tileAt(l, x, y))) area.push({ x, y });
      pushFx({ kind: 'flash', at: area, color: ELEMENT_COLOR[a.element ?? 'phys'], depth: run.depth });
      for (const p of area) {
        const t = actorAt(run, p.x, p.y);
        if (!t || (t === caster && !a.self)) continue;
        if (!player && !hostile(run, caster, t) && t !== caster) continue;
        hitWith(run, a, caster, t, power);
      }
      return true;
    }
    case 'nova': {
      const rad = a.radius ?? 1;
      const victims = enemiesOf(run, caster).filter((t) => dist(t, caster) <= rad && los(run, caster, t));
      pushFx({ kind: 'flash', at: victims.map((v) => ({ x: v.x, y: v.y })), color: ELEMENT_COLOR[a.element ?? 'phys'], depth: run.depth });
      if (player && !victims.length) msg(run, 'Nothing is in range.', 'dim');
      for (const t of victims) hitWith(run, a, caster, t, power);
      return true;
    }
    case 'smite': {
      const t = actorAt(run, target.x, target.y);
      if (!t || t === caster) return false;
      pushFx({ kind: 'flash', at: [{ x: t.x, y: t.y }], color: ELEMENT_COLOR[a.element ?? 'phys'], depth: run.depth });
      hitWith(run, a, caster, t, power);
      return true;
    }
    case 'cone': {
      const dx = Math.sign(target.x - caster.x), dy = Math.sign(target.y - caster.y);
      if (!dx && !dy) return false;
      const area: Pos[] = [];
      for (let y = caster.y - a.range; y <= caster.y + a.range; y++) for (let x = caster.x - a.range; x <= caster.x + a.range; x++) {
        if (!inside(l, x, y) || (x === caster.x && y === caster.y)) continue;
        const vx = x - caster.x, vy = y - caster.y;
        const d = Math.max(Math.abs(vx), Math.abs(vy));
        if (d > a.range) continue;
        const dot = (vx * dx + vy * dy) / (Math.hypot(vx, vy) * Math.hypot(dx, dy));
        if (dot < 0.7) continue;
        if (!los(run, caster, { x, y }) || blocksSight(l, x, y)) continue;
        area.push({ x, y });
      }
      pushFx({ kind: 'flash', at: area, color: ELEMENT_COLOR[a.element ?? 'phys'], depth: run.depth });
      for (const p of area) { const t = actorAt(run, p.x, p.y); if (t && hostile(run, caster, t)) hitWith(run, a, caster, t, power); }
      return true;
    }
    case 'heal': {
      let amt = (a.heal ?? 10) + Math.round(power * 0.8);
      if (player) {
        const s = playerStats(run);
        caster.hp = Math.min(s.maxHp, caster.hp + amt);
        if (id === 'hearth_heal') for (const k of CLEANSABLE) delete caster.statuses[k];
        msg(run, id === 'hearth_heal' ? 'Warmth spreads through you, like a kitchen in winter.' : 'You feel better.', 'good');
      } else {
        const m = caster as Monster;
        amt = Math.round(amt * 0.8);
        m.hp = Math.min(m.maxHp, m.hp + amt);
      }
      pushFx({ kind: 'num', at: { x: caster.x, y: caster.y }, text: '+' + amt, color: '#6f6', depth: run.depth });
      return true;
    }
    case 'buff': {
      const pw = a.statusPower !== undefined ? a.statusPower + (player ? Math.floor(power / 5) + (rank - 1) * 3 : 0) : undefined;
      addStatus(run, caster, a.status!, (a.statusTurns ?? 10) + (player ? (rank - 1) * 3 : 0), a.id === 'shield' ? 12 + Math.round(power * 0.8) + (rank - 1) * 6 : a.id === 'hearth_ward' ? 20 + Math.round((run.player.piety?.favor ?? 0) / 3) : pw);
      if (a.status === 'invisible' && player) for (const m of l.monsters) if (!m.ally && !monDef(m).flags?.includes('see_invis')) m.lastSeen = undefined;
      return true;
    }
    case 'hex': {
      const t = actorAt(run, target.x, target.y);
      if (!t || t === caster) return false;
      if (a.fx) boltFx(run, caster, line(caster, t), a);
      const pw = power + (player ? (rank - 1) * 5 : 0);
      const turns0 = a.statusTurns;
      const a2 = { ...a, statusTurns: (turns0 ?? 5) + (player && a.id === 'stun_strike' ? rank - 1 : 0) };
      const landed = applyHex(run, a2, caster, t, pw);
      if (landed && id === 'dm_fumble') addStatus(run, t, 'confused', 5);
      return true;
    }
    case 'mass_hex': {
      const victims = enemiesOf(run, caster).filter((t) => dist(t, caster) <= (a.radius ?? 4) && los(run, caster, t));
      for (const t of victims) applyHex(run, a, caster, t, power);
      if (!victims.length && player) msg(run, 'Nobody is around to be affected.', 'dim');
      return true;
    }
    case 'summon': {
      const kind = a.summon ?? 'rat';
      let count = a.count ?? 1;
      if (player && id === 'summon_rat') count += rank - 1;
      if (id === 'summon_minion' && !player) {
        // monsters calling for help: spawn their own kind or a follower
        const def = monDef(caster as Monster);
        const fol = def.followers?.id ?? 'rat';
        for (let i = 0; i < 2; i++) spawnNear(run, caster, fol, false);
        return true;
      }
      let made = 0;
      for (let i = 0; i < count; i++) {
        const m = spawnNear(run, caster, kind, player || !!(caster as Monster).ally);
        if (!m) continue;
        made++;
        if (player) {
          const s = playerStats(run);
          const bonus = 1 + s.summonPct / 100 + (rank - 1) * 0.25 + run.player.level * 0.03;
          m.maxHp = Math.round(m.maxHp * bonus);
          m.hp = m.maxHp;
          m.summoned = 40 + rank * 20 + (kind === 'bear' || kind === 'loaf_golem' ? 40 : 0);
        } else if (!(caster as Monster).ally) {
          m.summoned = 30;
        }
      }
      if (player) msg(run, made ? `You call ${made > 1 ? 'some help' : 'for help'}.` : 'Nothing answers.', made ? 'good' : 'dim');
      return made > 0 || !player;
    }
    case 'blink': {
      if (player) {
        const dest = target;
        if (dist(caster, dest) > a.range || !isVisible(run, dest.x, dest.y) || !walkable(tileAt(l, dest.x, dest.y)) || actorAt(run, dest.x, dest.y)) {
          msg(run, 'You cannot go there.', 'dim');
          return false;
        }
        pushFx({ kind: 'flash', at: [{ x: caster.x, y: caster.y }, dest], color: '#b6f', depth: run.depth });
        caster.x = dest.x; caster.y = dest.y;
        if (id === 'shadowstep') {
          addStatus(run, caster, 'invisible', 2);
          const adj = enemiesOf(run, caster).filter((t) => dist(t, caster) <= 1);
          if (adj.length) playerAttack(run, adj[0] as Monster, { mult: 1.3 });
        }
        return true;
      }
      return execAbility(run, caster, 'blink_away', caster, rank);
    }
    case 'teleport': {
      const spot = randomSpot(run, caster, 4, 9);
      if (!spot) return false;
      pushFx({ kind: 'flash', at: [{ x: caster.x, y: caster.y }], color: '#b6f', depth: run.depth });
      caster.x = spot.x; caster.y = spot.y;
      return true;
    }
    case 'dash': {
      const t = actorAt(run, target.x, target.y);
      if (!t || t === caster || dist(caster, t) > a.range) return false;
      const path = line(caster, t);
      for (const p of path.slice(0, -1)) {
        if (!walkable(tileAt(l, p.x, p.y)) || actorAt(run, p.x, p.y)) break;
        caster.x = p.x; caster.y = p.y;
      }
      if (dist(caster, t) > 1) { if (player) msg(run, 'You cannot reach.', 'dim'); return true; }
      if (player) playerAttack(run, t as Monster, { mult: (a.mult ?? 1) + (rank - 1) * 0.15 });
      else monsterAttack(run, caster as Monster, t);
      return true;
    }
    case 'cleave': {
      const adj = enemiesOf(run, caster).filter((t) => dist(t, caster) <= 1);
      if (!adj.length) { if (player) msg(run, 'Nothing to hit.', 'dim'); return false; }
      if (player) { msg(run, 'You spin!', 'good'); for (const t of adj) playerAttack(run, t as Monster, { mult: (a.mult ?? 1) + (rank - 1) * 0.15, secondary: true }); }
      else for (const t of adj) monsterAttack(run, caster as Monster, t);
      return true;
    }
    case 'strike': {
      const t = actorAt(run, target.x, target.y);
      if (!t || t === caster || dist(t, caster) > 1) { if (player) msg(run, 'Nothing there to hit.', 'dim'); return false; }
      if (player) {
        const m = t as Monster;
        let mult = (a.mult ?? 1) + (rank - 1) * 0.2;
        if (id === 'backstab' && (!m.awake || m.statuses.afraid || m.statuses.paralysed || m.statuses.asleep)) mult *= 3;
        const hit = playerAttack(run, m, { mult });
        if (hit && a.status && m.hp > 0 && r.chance(0.6)) addStatus(run, m, a.status, (a.statusTurns ?? 2) + (rank - 1));
      } else monsterAttack(run, caster as Monster, t);
      return true;
    }
    case 'cloud': {
      const c = a.target === 'self' ? { x: caster.x, y: caster.y } : target;
      const rad = a.radius ?? 1;
      for (let y = c.y - rad; y <= c.y + rad; y++) for (let x = c.x - rad; x <= c.x + rad; x++) {
        if (!inside(l, x, y) || !walkable(tileAt(l, x, y))) continue;
        if (rad > 1 && Math.hypot(x - c.x, y - c.y) > rad + 0.5) continue;
        l.clouds = l.clouds.filter((o) => !(o.x === x && o.y === y));
        l.clouds.push({ x, y, type: a.cloud ?? 'smoke', turns: r.int(6, 12), power: a.statusPower ?? 3 + Math.floor(power / 8) });
      }
      return true;
    }
    case 'map': {
      revealMap(run, caster, a.radius ?? 18);
      msg(run, 'The shape of the place unfolds in your mind.', 'good');
      return true;
    }
    case 'shout': {
      noise(run, caster, a.noise ?? 15);
      if (a.status) {
        const victims = enemiesOf(run, caster).filter((t) => dist(t, caster) <= (a.radius ?? 5));
        for (const t of victims) {
          if (!isPlayer(t) && monDef(t as Monster).level > (isPlayer(caster) ? run.player.level + 2 : 99)) continue;
          applyHex(run, { ...a, statusTurns: (a.statusTurns ?? 6) + (rank - 1) * 2 }, caster, t, power);
        }
      }
      if (player) msg(run, 'You let out a terrible shout!', 'good');
      return true;
    }
    case 'devour': {
      const i = l.corpses.findIndex((c) => dist(c, caster) <= 1);
      if (i < 0) { msg(run, 'There is nothing here to eat. (Thankfully.)', 'dim'); return false; }
      l.corpses.splice(i, 1);
      const s = playerStats(run);
      const amt = (a.heal ?? 20) + run.player.level * 3;
      caster.hp = Math.min(s.maxHp, caster.hp + amt);
      msg(run, r.pick(['You devour the corpse. Crunchy.', 'You eat the corpse with surprising table manners.', 'Nom.']), 'good');
      return true;
    }
    case 'drain': {
      const t = actorAt(run, target.x, target.y);
      if (!t || t === caster || dist(t, caster) > 1) { if (player) msg(run, 'You need to be next to your victim.', 'dim'); return false; }
      const before = t.hp;
      hitWith(run, a, caster, t, power);
      const gained = Math.max(0, Math.round((before - Math.max(0, t.hp)) / 2));
      if (player) caster.hp = Math.min(playerStats(run).maxHp, caster.hp + gained);
      else (caster as Monster).hp = Math.min((caster as Monster).maxHp, caster.hp + gained);
      return true;
    }
    case 'cleanse': {
      for (const k of CLEANSABLE) delete caster.statuses[k];
      if (player) msg(run, 'You feel clean. Spiritually. Physically, still dungeon-grimy.', 'good');
      return true;
    }
  }
  return false;
}

function spawnNear(run: Run, at: Pos, kind: string, ally: boolean): Monster | null {
  const l = cur(run);
  const spot = nearestFree(run, l, at, (x, y) => walkable(tileAt(l, x, y)), 3);
  if (!spot) return null;
  const m = spawnMonster(run, l, kind, spot.x, spot.y, { awake: true });
  if (m && ally) m.ally = true;
  return m;
}

export function randomSpot(run: Run, from: Pos, minD: number, maxD: number): Pos | null {
  const l = cur(run);
  const r = rng(run);
  for (let i = 0; i < 200; i++) {
    const x = r.int(1, l.w - 2), y = r.int(1, l.h - 2);
    const d = dist({ x, y }, from);
    if (d < minD || (maxD < 99 && d > maxD)) continue;
    if (!walkable(tileAt(l, x, y)) || actorAt(run, x, y)) continue;
    const t = tileAt(l, x, y);
    if (t === T.DOWN || t === T.UP || t === T.EXIT) continue;
    return { x, y };
  }
  return null;
}

/** For the UI: default target for an ability (nearest visible enemy). */
export function defaultTarget(run: Run, id: string): Pos | null {
  const a = ABILITIES[id];
  if (a && a.target === 'self') return { x: run.player.x, y: run.player.y };
  const p = run.player;
  const range = a?.range ?? 7;
  const cands = cur(run).monsters.filter((m) => m.hp > 0 && !m.ally && !m.friendly && isVisible(run, m.x, m.y) && dist(m, p) <= range && (!m.statuses.invisible || playerStats(run).flags.has('see_invis')));
  cands.sort((a1, b1) => dist(a1, p) - dist(b1, p));
  return cands[0] ? { x: cands[0].x, y: cands[0].y } : null;
}

export function abilityCost(run: Run, id: string): { mp: number; cooldown: number } {
  const a = ABILITIES[id];
  if (!a) return { mp: 0, cooldown: 0 };
  const s = playerStats(run);
  return { mp: a.mp ?? 0, cooldown: Math.round((a.cooldown ?? 0) * (1 - s.cooldown / 100)) };
}

export function canUseAbility(run: Run, id: string): string | null {
  const p = run.player;
  const a = ABILITIES[id];
  if (!a) return 'Unknown ability.';
  const c = abilityCost(run, id);
  const fc = favorCost(run, id);
  if (fc && (p.piety?.favor ?? 0) < fc) return `Not enough favour for ${a.name} (${fc} needed).`;
  if ((p.cooldowns[id] ?? 0) > 0) return `${a.name} is recharging (${p.cooldowns[id]} turns).`;
  if (p.mp < c.mp) return `Not enough magic for ${a.name}.`;
  if (p.statuses.silenced && c.mp > 0) return 'You are silenced.';
  if (p.statuses.berserk && c.mp > 0) return 'You are too angry to concentrate!';
  return null;
}

export { DIRS8 };
export function nearestEnemy(run: Run): Monster | null {
  const p = run.player;
  const ms = cur(run).monsters.filter((m) => m.hp > 0 && !m.ally && !m.friendly && isVisible(run, m.x, m.y) && (!m.statuses.invisible || playerStats(run).flags.has('see_invis')));
  ms.sort((a, b) => dist(a, p) - dist(b, p));
  return ms[0] ?? null;
}
export function viewInterrupt() { view.interrupt = true; }
