import type { Item, Monster, Run, Slot } from '../core/types';
import { dist, type Pos } from '../core/geom';
import { T, TERRAIN, walkable, MAX_DEPTH } from '../data/terrain';
import { ABILITIES } from '../data/abilities';
import { ARMOURS, CONSUMABLES, JEWELS, WEAPONS } from '../data/items';
import { NOTES, USELESSNESS, SHOPKEEPER_LINES } from '../data/flavor';
import { STATUSES } from '../data/statuses';
import { DISCIPLINES, TALENTS } from '../data/talents';
import { actorAt, cur, inside, isVisible, msg, name, Name, rng, tileAt, view, nearestFree } from './state';
import { addStatus, damage, monDef, playerAttack } from './combat';
import { playerStats, RING_SLOTS, xpForLevel } from './stats';
import { updateFov } from './fov';
import { canMonsterEnter, monsterAct, monsterSpeed, noise, noticeChecks, spawnMonster } from './monsters';
import { abilityCost, canUseAbility, execAbility, randomSpot, los } from './abilities';
import { addToInventory, isEquipment, isKnown, itemName, learn, makeItem, randomItem } from './items';
import { gainMutation, gainXp, levelUp, playerAbilities, canTake, autoQuickSlot } from './progression';
import { createLevel, SHRINES } from './levels';
import { pushFx } from './fx';

export type Action =
  | { t: 'move'; dx: number; dy: number }
  | { t: 'wait' }
  | { t: 'rest' }
  | { t: 'pickup' }
  | { t: 'stairs' }
  | { t: 'ability'; id: string; target: Pos }
  | { t: 'fire'; target: Pos }
  | { t: 'use'; itemId: number; target?: Pos; extraId?: number }
  | { t: 'equip'; itemId: number }
  | { t: 'unequip'; slot: Slot }
  | { t: 'drop'; itemId: number }
  | { t: 'buy'; index: number }
  | { t: 'shrine' }
  | { t: 'fountain'; at: Pos }
  | { t: 'talk'; choice: 'gift' | 'attack' };

export type Popup =
  | { type: 'note'; title: string; text: string }
  | { type: 'shop' }
  | { type: 'shrine'; id: string }
  | { type: 'baker' }
  | { type: 'levelup' }
  | { type: 'story'; title: string; text: string };

export const popups: Popup[] = [];

// ------------------------------------------------------------------ helpers

export function playerCanEnter(run: Run, x: number, y: number): boolean {
  const l = cur(run);
  if (!inside(l, x, y)) return false;
  const t = tileAt(l, x, y);
  const s = playerStats(run);
  if (t === T.DEEP) return s.flags.has('swim') || s.flags.has('flying');
  if (t === T.LAVA || t === T.CHASM) return s.flags.has('flying');
  return TERRAIN[t].walk;
}

function actionCost(run: Run, base: number, move = false): number {
  const p = run.player;
  const s = playerStats(run);
  let c = base / (1 + Math.max(-50, s.speed) / 100);
  if (move) c /= 1 + Math.max(-50, s.moveSpeed) / 100;
  if (p.statuses.haste) c *= 0.5;
  if (p.statuses.slow) c *= 2;
  if (p.statuses.doughy) c *= 1.33;
  return Math.max(20, Math.round(c));
}

function spend(run: Run, cost: number) {
  run.player.energy -= cost;
  advance(run);
}

export function advance(run: Run) {
  const p = run.player;
  updateFov(run);
  let guard = 0;
  while (!run.over && guard++ < 200000) {
    if (p.energy >= 100) {
      if (p.statuses.paralysed || p.statuses.asleep) { p.energy -= 100; }
      else break;
    }
    tickOnce(run);
  }
  updateFov(run);
}

function tickOnce(run: Run) {
  const l = cur(run);
  run.tick++;
  run.player.energy += 10;
  for (const m of [...l.monsters]) {
    if (m.hp <= 0) continue;
    m.energy += monsterSpeed(m);
    let n = 0;
    while (m.energy >= 100 && m.hp > 0 && !run.over && n++ < 4) {
      m.energy -= 100;
      monsterAct(run, m);
    }
    if (run.over) return;
  }
  if (run.tick % 10 === 0) worldTurn(run);
}

function tickStatuses(run: Run, a: Run['player'] | Monster, isP: boolean) {
  for (const [k, st] of Object.entries(a.statuses)) {
    if (k === 'poison' && a.hp > 0) damage(run, a, Math.max(1, st.power ?? 1), 'poison', { cause: 'poison', silent: true });
    if (k === 'burning' && a.hp > 0) damage(run, a, Math.max(1, rng(run).int(1, (st.power ?? 2) * 2)), 'fire', { cause: 'burning', silent: true });
    if (a.hp <= 0) return;
    st.turns--;
    if (st.turns <= 0) {
      delete a.statuses[k];
      if (k === 'berserk') { addStatus(run, a, 'fatigue', 12); }
      if (isP && STATUSES[k] && k !== 'fatigue') msg(run, `You are no longer ${STATUSES[k].name.toLowerCase()}.`, 'dim');
      if (k === 'risen' && isP) { const s = playerStats(run); a.hp = Math.min(a.hp, s.maxHp); }
    }
  }
}

function worldTurn(run: Run) {
  const p = run.player;
  const l = cur(run);
  const r = rng(run);
  run.turn++;
  run.stats.turns = run.turn;
  tickStatuses(run, p, true);
  if (run.over) return;
  for (const k of Object.keys(p.cooldowns)) { p.cooldowns[k]--; if (p.cooldowns[k] <= 0) delete p.cooldowns[k]; }
  const s = playerStats(run);
  // regeneration
  if (!p.statuses.poison) {
    p.regenAcc += Math.max(0.01, s.maxHp * (0.004 + s.regen * 0.0015) + 0.04 + (p.statuses.regen ? (p.statuses.regen.power ?? 3) : 0));
    if (p.regenAcc >= 1) { const n = Math.floor(p.regenAcc); p.regenAcc -= n; p.hp = Math.min(s.maxHp, p.hp + n); }
  }
  p.mpAcc += Math.max(0.01, s.maxMp * 0.012 + s.mpRegen * 0.02 + 0.05);
  if (p.mpAcc >= 1) { const n = Math.floor(p.mpAcc); p.mpAcc -= n; p.mp = Math.min(s.maxMp, p.mp + n); }
  if (p.hp > s.maxHp) p.hp = s.maxHp;
  // monsters
  for (const m of [...l.monsters]) {
    if (m.hp <= 0) continue;
    tickStatuses(run, m, false);
    if (m.hp <= 0) continue;
    for (const k of Object.keys(m.cooldowns)) { m.cooldowns[k]--; if (m.cooldowns[k] <= 0) delete m.cooldowns[k]; }
    if (monDef(m).flags?.includes('regen')) m.hp = Math.min(m.maxHp, m.hp + 2);
    else if (run.turn % 8 === 0) m.hp = Math.min(m.maxHp, m.hp + 1);
    if (m.summoned !== undefined) {
      m.summoned--;
      if (m.summoned <= 0) {
        if (isVisible(run, m.x, m.y)) msg(run, `${Name(run, m)} ${m.ally ? 'fades away' : 'vanishes'}.`, 'dim');
        m.hp = 0;
        l.monsters = l.monsters.filter((o) => o !== m);
      }
    }
  }
  // halo
  for (const f of s.flags) {
    const mm = /^halo_(\d)$/.exec(f);
    if (!mm) continue;
    for (const m of l.monsters) if (!m.ally && dist(m, p) <= 1 && ['undead', 'demon'].includes(monDef(m).family)) damage(run, m, 3 * +mm[1], 'holy', { source: p });
  }
  // clouds
  for (const c of l.clouds) {
    c.turns--;
    const a = actorAt(run, c.x, c.y);
    if (a && c.type === 'poison') { if (a === p ? s.res.poison <= 0 : true) addStatus(run, a, 'poison', 3, c.power); }
    if (a && c.type === 'fire') damage(run, a, r.int(2, 4 + c.power), 'fire', { cause: 'a cloud of fire' });
  }
  l.clouds = l.clouds.filter((c) => c.turns > 0);
  // traps nearby
  for (const f of l.features) if (f.kind === 'trap' && f.hidden && dist(f, p) <= 1 && r.chance(0.08 + s.wits * 0.004)) { f.hidden = false; msg(run, `You spot a ${f.id} trap!`, 'warn'); view.interrupt = true; }
  if (s.flags.has('teleportitis') && r.chance(1 / 160)) { msg(run, 'You feel a wrench in your gut. Space folds.', 'warn'); teleportPlayer(run); }
  noticeChecks(run);
}

function teleportPlayer(run: Run) {
  const spot = randomSpot(run, run.player, 0, 99);
  if (spot) { run.player.x = spot.x; run.player.y = spot.y; updateFov(run); view.interrupt = true; }
}

// ------------------------------------------------------------------ actions

export function act(run: Run, a: Action): boolean {
  if (run.over) return false;
  const p = run.player;
  const l = cur(run);
  const r = rng(run);
  const s = playerStats(run);
  view.interrupt = false;
  switch (a.t) {
    case 'wait': spend(run, 100); return true;
    case 'rest': {
      if (l.monsters.some((m) => !m.ally && !m.friendly && m.awake && isVisible(run, m.x, m.y))) { msg(run, 'You cannot rest with enemies nearby!', 'warn'); return false; }
      spend(run, 100); return true;
    }
    case 'move': {
      let { dx, dy } = a;
      if (p.statuses.confused && r.chance(0.4)) { const d = r.pick([[-1, 0], [1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]); dx = d[0]; dy = d[1]; msg(run, 'You stumble.', 'dim'); }
      const nx = p.x + dx, ny = p.y + dy;
      const target = actorAt(run, nx, ny);
      if (target && target !== p) {
        const m = target as Monster;
        if (m.friendly) { if (m.def === 'baker') popups.push({ type: 'baker' }); return false; }
        if (m.ally) {
          // swap places with allies
          if (p.statuses.entangled) { msg(run, 'You are stuck!', 'warn'); return false; }
          m.x = p.x; m.y = p.y; p.x = nx; p.y = ny;
          spend(run, actionCost(run, 100, true));
          return true;
        }
        if (s.weapon.cls === 'bow') { fireAt(run, m); return true; }
        playerAttack(run, m);
        noise(run, p, 4);
        spend(run, actionCost(run, s.weapon.delay));
        return true;
      }
      const t = tileAt(l, nx, ny);
      if (t === T.DOOR) { l.tiles[ny * l.w + nx] = T.OPEN_DOOR; spend(run, actionCost(run, 100)); return true; }
      if (t === T.FOUNTAIN) return act(run, { t: 'fountain', at: { x: nx, y: ny } });
      if (!playerCanEnter(run, nx, ny)) {
        if (t === T.DEEP) msg(run, 'The water is too deep. You would sink like a well-made loaf.', 'dim');
        else if (t === T.LAVA) msg(run, 'That is lava. You decide not to.', 'dim');
        return false;
      }
      if (p.statuses.entangled) { msg(run, 'You struggle against your bonds.', 'warn'); if (r.chance(0.35)) delete p.statuses.entangled; spend(run, 100); return true; }
      p.x = nx; p.y = ny;
      // reach attacks: none here; arrival effects
      arrive(run);
      spend(run, actionCost(run, 100, true));
      return true;
    }
    case 'fire': {
      const m = actorAt(run, a.target.x, a.target.y) as Monster | undefined;
      if (!m || m === (p as unknown)) return false;
      if (s.weapon.cls === 'bow') { if (!los(run, p, m) || dist(p, m) > 8) { msg(run, 'No clear shot.', 'dim'); return false; } fireAt(run, m); return true; }
      const reach = s.weapon.reach ?? 1;
      if (dist(p, m) <= reach && los(run, p, m)) {
        playerAttack(run, m);
        spend(run, actionCost(run, s.weapon.delay));
        return true;
      }
      return false;
    }
    case 'pickup': {
      const here = l.items.filter((fi) => fi.x === p.x && fi.y === p.y);
      if (!here.length) { msg(run, 'There is nothing here.', 'dim'); return false; }
      let got = 0;
      for (const fi of here) {
        if (addToInventory(run, fi.item)) { l.items = l.items.filter((o) => o !== fi); got++; msg(run, `You pick up ${itemName(run, fi.item)}.`); }
        else { msg(run, 'Your pack is full.', 'warn'); break; }
      }
      if (got) spend(run, 100);
      return got > 0;
    }
    case 'stairs': return useStairs(run);
    case 'ability': {
      const why = canUseAbility(run, a.id);
      if (why) { msg(run, why, 'warn'); return false; }
      const known = playerAbilities(run).find((x) => x.id === a.id);
      if (!known) return false;
      const ab = ABILITIES[a.id];
      if (ab.target !== 'self' && dist(p, a.target) > ab.range && ab.kind !== 'strike') { msg(run, 'Out of range.', 'warn'); return false; }
      if (!execAbility(run, p, a.id, a.target, known.rank)) return false;
      const c = abilityCost(run, a.id);
      p.mp -= c.mp;
      if (c.cooldown) p.cooldowns[a.id] = c.cooldown;
      noise(run, p, 3);
      spend(run, actionCost(run, 100));
      return true;
    }
    case 'use': return useItem(run, a.itemId, a.target, a.extraId);
    case 'equip': return equip(run, a.itemId);
    case 'unequip': {
      const it = p.equip[a.slot];
      if (!it) return false;
      if (it.cursed) { msg(run, `${itemName(run, it)} is cursed and will not come off!`, 'bad'); return false; }
      if (p.inventory.length >= 26) { msg(run, 'Your pack is full.', 'warn'); return false; }
      delete p.equip[a.slot];
      p.inventory.push(it);
      clampVitals(run);
      msg(run, `You take off ${itemName(run, it)}.`);
      spend(run, 100);
      return true;
    }
    case 'drop': {
      const it = p.inventory.find((i) => i.id === a.itemId);
      if (!it) return false;
      p.inventory = p.inventory.filter((i) => i !== it);
      l.items.push({ x: p.x, y: p.y, item: it, seen: true });
      msg(run, `You drop ${itemName(run, it)}.`);
      spend(run, 50);
      return true;
    }
    case 'buy': {
      const f = l.features.find((f0) => f0.kind === 'shop' && f0.x === p.x && f0.y === p.y);
      const entry = f?.stock?.[a.index];
      if (!f || !entry) return false;
      if (p.gold < entry.price) { msg(run, '"No gold, no goods, friend."', 'warn'); return false; }
      if (!addToInventory(run, entry.item)) { msg(run, 'Your pack is full.', 'warn'); return false; }
      p.gold -= entry.price;
      f.stock!.splice(a.index, 1);
      msg(run, `You buy ${itemName(run, entry.item)} for ${entry.price} gold. ${r.pick(SHOPKEEPER_LINES)}`, 'good');
      return true;
    }
    case 'shrine': return useShrine(run);
    case 'fountain': {
      const f = l.features.find((f0) => f0.kind === 'fountain' && f0.x === a.at.x && f0.y === a.at.y);
      if (!f || f.used) { msg(run, 'The fountain is dry.', 'dim'); return false; }
      const roll = r.next();
      if (roll < 0.35) { p.hp = s.maxHp; msg(run, 'The water is cool and clean. You feel completely refreshed.', 'good'); }
      else if (roll < 0.55) { p.mp = s.maxMp; msg(run, 'The water fizzes with magic.', 'good'); }
      else if (roll < 0.7) { addStatus(run, p, 'poison', 6, 2 + run.depth); msg(run, 'Ugh. Something died in this fountain.', 'bad'); }
      else if (roll < 0.8) { const m = spawnMonster(run, l, 'blink_frog', a.at.x, a.at.y + 1, { awake: true }); if (m) { const spot = nearestFree(run, l, a.at, (x, y) => walkable(l.tiles[y * l.w + x]), 2); if (spot) { m.x = spot.x; m.y = spot.y; } } msg(run, 'A frog jumps out of the fountain! It looks annoyed.', 'warn'); }
      else if (roll < 0.9) { gainXp(run, xpForLevel(p.level + 1) - xpForLevel(p.level) >> 2); msg(run, 'You drink deep and feel wiser. Somehow.', 'good'); }
      else { const it = randomItem(run, run.depth, { cat: 'potion' }); l.items.push({ x: p.x, y: p.y, item: it }); msg(run, 'You fish something out of the fountain.', 'good'); }
      if (r.chance(0.5)) { f.used = true; msg(run, 'The fountain dries up.', 'dim'); }
      spend(run, 100);
      return true;
    }
    case 'talk': {
      const baker = l.monsters.find((m) => m.def === 'baker' && m.friendly);
      if (!baker) return false;
      run.flags.bakerMet = true;
      if (a.choice === 'gift') {
        msg(run, '"Here. Take these. My wife made them, before." He presses two warm flasks into your hands, and a folded note.', 'story');
        addToInventory(run, makeItem(run, 'p_heal', { qty: 2 }));
        addToInventory(run, makeItem(run, 'p_experience'));
        learn(run, 'p_heal'); learn(run, 'p_experience');
        msg(run, '"I have to go down. She is waiting. Don\'t follow me." He walks away into the dark.', 'story');
        l.monsters = l.monsters.filter((m) => m !== baker);
      } else {
        baker.friendly = false;
        baker.awake = true;
        msg(run, '"So be it." His eyes go white with flour.', 'bad');
      }
      spend(run, 100);
      return true;
    }
  }
  return false;
}

function fireAt(run: Run, m: Monster) {
  const p = run.player;
  const s = playerStats(run);
  pushFx({ kind: 'bolt', path: [{ x: p.x, y: p.y }, { x: m.x, y: m.y }], tile: 'effect/arrow*', depth: run.depth });
  if (s.flags.has('pierce_shots')) {
    const path = [];
    let x = p.x, y = p.y;
    const dx = m.x - p.x, dy = m.y - p.y;
    const n = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 1; i <= 8; i++) { x = p.x + Math.round(dx * i / n); y = p.y + Math.round(dy * i / n); path.push({ x, y }); }
    for (const q of path) { const t = actorAt(run, q.x, q.y) as Monster | undefined; if (t && t !== (p as unknown) && !t.ally) playerAttack(run, t, { ranged: true }); if (!TERRAIN[tileAt(cur(run), q.x, q.y)].see) break; }
  } else playerAttack(run, m, { ranged: true });
  noise(run, p, 3);
  spend(run, actionCost(run, s.weapon.delay));
}

function clampVitals(run: Run) {
  const s = playerStats(run);
  run.player.hp = Math.min(run.player.hp, s.maxHp);
  run.player.mp = Math.min(run.player.mp, s.maxMp);
}

/** Effects of stepping onto a tile. */
function arrive(run: Run) {
  const p = run.player;
  const l = cur(run);
  const r = rng(run);
  // auto-pickup
  for (const fi of l.items.filter((o) => o.x === p.x && o.y === p.y)) {
    const k = fi.item.kind;
    if (k === 'gold' || k === 'potion' || k === 'scroll' || k === 'wand' || k === 'essence' || k === 'tome' || k === 'note') {
      if (k === 'gold') fi.item.qty = Math.round(fi.item.qty * (1 + playerStats(run).goldPct / 100));
      if (addToInventory(run, fi.item)) {
        l.items = l.items.filter((o) => o !== fi);
        msg(run, k === 'gold' ? `You pick up ${fi.item.qty} gold.` : `You pick up ${itemName(run, fi.item)}.`, k === 'gold' ? 'gold' : undefined);
        if (k === 'note') { const n = NOTES[fi.item.noteId ?? 0]; popups.push({ type: 'note', title: n.title, text: n.text }); }
      }
    } else {
      msg(run, `You see here ${itemName(run, fi.item)}.`, 'dim');
    }
  }
  for (const f of l.features) {
    if (f.x !== p.x || f.y !== p.y) continue;
    if (f.kind === 'trap') triggerTrap(run, f);
    else if (f.kind === 'shop') { popups.push({ type: 'shop' }); }
    else if (f.kind === 'shrine' && !f.used) popups.push({ type: 'shrine', id: f.id });
    else if (f.kind === 'note' && !f.used) { f.used = true; popups.push({ type: 'note', title: 'A notice on the wall', text: String(f.data?.text ?? '') }); }
  }
  const t = tileAt(l, p.x, p.y);
  if (t === T.DOWN) msg(run, 'There are stairs down here.', 'dim');
  if (t === T.UP) msg(run, 'There are stairs up here.', 'dim');
  if (t === T.SHALLOW && r.chance(0.05)) msg(run, 'Your boots squelch.', 'dim');
}

function triggerTrap(run: Run, f: { id: string; hidden?: boolean; x: number; y: number }) {
  const p = run.player;
  const r = rng(run);
  const s = playerStats(run);
  if (!f.hidden && r.chance(0.6 + s.agility * 0.01)) { msg(run, `You carefully avoid the ${f.id} trap.`, 'dim'); return; }
  f.hidden = false;
  view.interrupt = true;
  switch (f.id) {
    case 'dart': msg(run, 'A dart shoots out of the wall!', 'bad'); damage(run, p, r.roll(2, 4) + run.depth, 'phys', { cause: 'a dart trap' }); if (r.chance(0.4)) addStatus(run, p, 'poison', 5, 2 + Math.floor(run.depth / 2)); break;
    case 'net': msg(run, 'A net drops on you!', 'bad'); addStatus(run, p, 'entangled', 4); break;
    case 'teleport': msg(run, 'You are yanked through space!', 'warn'); teleportPlayer(run); break;
    case 'alarm': msg(run, 'An alarm blares! "WEE-OO WEE-OO WEE-OO"', 'bad'); noise(run, p, 40); break;
    case 'pie': msg(run, 'A pie springs out of the floor and hits you square in the face!', 'bad'); addStatus(run, p, 'blind', 4); break;
    case 'fire': msg(run, 'Flames burst from the floor!', 'bad'); damage(run, p, r.roll(3, 6) + run.depth, 'fire', { cause: 'a fire trap' }); break;
    case 'shaft':
      if (run.depth < MAX_DEPTH - 1) { msg(run, 'The floor gives way! You fall down a shaft!', 'bad'); changeLevel(run, run.depth + 1, true); }
      break;
  }
}

function useStairs(run: Run): boolean {
  const p = run.player;
  const l = cur(run);
  const t = tileAt(l, p.x, p.y);
  if (t === T.DOWN) { changeLevel(run, run.depth + 1, false); return true; }
  if (t === T.UP) { changeLevel(run, run.depth - 1, false); return true; }
  if (t === T.EXIT) { msg(run, 'You could leave. Crumbsworth would starve, or worse. You turn back to the dark.', 'story'); return false; }
  msg(run, 'There are no stairs here.', 'dim');
  return false;
}

export function changeLevel(run: Run, depth: number, fell: boolean) {
  const p = run.player;
  const old = cur(run);
  const goingDown = depth > run.depth;
  // adjacent allies follow
  const followers = old.monsters.filter((m) => m.ally && dist(m, p) <= 2);
  old.monsters = old.monsters.filter((m) => !followers.includes(m));
  if (!run.levels[depth]) run.levels[depth] = createLevel(run, depth);
  run.depth = depth;
  const l = cur(run);
  let spot: Pos | null = null;
  if (fell) spot = randomSpot(run, { x: 0, y: 0 }, 0, 99);
  else spot = goingDown ? l.up[0] : (l.down[0] ?? l.up[0]);
  if (!spot) spot = l.up[0];
  p.x = spot.x; p.y = spot.y;
  // make room
  const blocker = actorAt(run, p.x, p.y);
  if (blocker && blocker !== p) { const s2 = nearestFree(run, l, p, (x, y) => walkable(l.tiles[y * l.w + x]), 4); if (s2) { blocker.x = s2.x; blocker.y = s2.y; } }
  for (const m of followers) {
    const s2 = nearestFree(run, l, p, (x, y) => walkable(l.tiles[y * l.w + x]), 3);
    if (s2) { m.x = s2.x; m.y = s2.y; l.monsters.push(m); }
  }
  run.stats.deepest = Math.max(run.stats.deepest, depth);
  if (!l.visited) {
    l.visited = true;
    msg(run, `${depth === MAX_DEPTH ? 'THE PROVING CHAMBER' : `Depth ${depth}`}. ${l.feeling ?? ''}`, 'story');
    if (depth === 6 && !run.flags.bakerMet) msg(run, 'You hear someone humming a nursery rhyme. It sounds like a man trying not to cry.', 'story');
    if (depth === 12 && !run.flags.bakerDead) msg(run, 'The ovens roar. Somewhere ahead, a familiar voice is singing to the dough.', 'story');
    if (depth === MAX_DEPTH) popups.push({ type: 'story', title: 'The Proving Chamber', text: 'The walls are crystal and they pulse slowly, like breathing. The floor is warm. Every sound you make comes back to you as a lullaby. At the far end of the chamber, something vast and pale is rising, and falling, and rising.' });
  } else {
    msg(run, `You return to depth ${depth}.`, 'dim');
  }
  view.interrupt = true;
  p.energy = Math.max(p.energy, 100);
  updateFov(run);
}

// ------------------------------------------------------------------ items

function equipSlotFor(run: Run, it: Item): Slot | null {
  const p = run.player;
  const s = playerStats(run);
  if (it.kind === 'weapon') return 'weapon';
  if (it.kind === 'armour') return ARMOURS[it.base].slot;
  if (it.kind === 'amulet') return 'amulet';
  if (it.kind === 'ring') {
    const slots = s.flags.has('octopode') ? RING_SLOTS : RING_SLOTS.slice(0, 2);
    return slots.find((sl) => !p.equip[sl]) ?? slots.find((sl) => !p.equip[sl]?.cursed) ?? null;
  }
  return null;
}

function equip(run: Run, itemId: number): boolean {
  const p = run.player;
  const it = p.inventory.find((i) => i.id === itemId);
  if (!it || !isEquipment(it)) return false;
  const s = playerStats(run);
  const slot = equipSlotFor(run, it);
  if (!slot) { msg(run, 'You cannot wear that.', 'warn'); return false; }
  if (slot === 'body' && s.flags.has('no_body')) { msg(run, 'Eight arms. Zero shirts that fit.', 'warn'); return false; }
  if (slot === 'feet' && s.flags.has('no_boots')) { msg(run, 'You have no feet. Well, you have eight of something.', 'warn'); return false; }
  if (slot === 'head' && s.flags.has('no_helmet')) { msg(run, 'It will not fit over your... head situation.', 'warn'); return false; }
  const wdef = it.kind === 'weapon' ? WEAPONS[it.base] : null;
  if (slot === 'offhand' && p.equip.weapon && WEAPONS[p.equip.weapon.base]?.twoHanded) { msg(run, 'You need a free hand for that. Your weapon takes both.', 'warn'); return false; }
  const toRemove: Slot[] = [slot];
  if (wdef?.twoHanded && p.equip.offhand) toRemove.push('offhand');
  for (const sl of toRemove) {
    const old = p.equip[sl];
    if (old?.cursed) { msg(run, `You cannot remove ${itemName(run, old)}. It is cursed!`, 'bad'); return false; }
  }
  p.inventory = p.inventory.filter((i) => i !== it);
  for (const sl of toRemove) { const old = p.equip[sl]; if (old) { p.inventory.push(old); delete p.equip[sl]; } }
  p.equip[slot] = it;
  const wasKnown = it.known;
  it.known = true;
  if (it.kind === 'ring' || it.kind === 'amulet') learn(run, it.base);
  msg(run, `You ${slot === 'weapon' ? 'wield' : 'put on'} ${itemName(run, it)}.`);
  if (it.cursed) msg(run, 'It tightens around you with a nasty little squeeze. Cursed!', 'bad');
  else if (!wasKnown && it.art) msg(run, `It is an artifact! ${it.art.props.map((pr) => pr.text).join(', ')}.`, 'good');
  if (it.art && JEWELS[it.base] === undefined && (it.kind === 'ring' || it.kind === 'amulet')) learn(run, it.base);
  clampVitals(run);
  spend(run, slot === 'body' ? 200 : 100);
  return true;
}

function useItem(run: Run, itemId: number, target?: Pos, extraId?: number): boolean {
  const p = run.player;
  const it = p.inventory.find((i) => i.id === itemId);
  if (!it) return false;
  const s = playerStats(run);
  const r = rng(run);
  const consume = () => { it.qty--; if (it.qty <= 0) p.inventory = p.inventory.filter((i) => i !== it); };
  switch (it.kind) {
    case 'potion': {
      if (s.flags.has('no_potions')) { msg(run, 'You are a mummy. You have no working throat.', 'warn'); return false; }
      const known = isKnown(run, it.base);
      learn(run, it.base);
      consume();
      run.stats.potions++;
      quaff(run, it.base);
      if (!known) msg(run, `(That was a ${CONSUMABLES[it.base].name}.)`, 'dim');
      if (s.flags.has('philosopher')) { p.hp = Math.min(s.maxHp, p.hp + Math.round(s.maxHp * 0.15)); p.mp = Math.min(s.maxMp, p.mp + 5); }
      spend(run, 100);
      return true;
    }
    case 'scroll': {
      if (p.statuses.blind) { msg(run, 'You cannot read while blind. There is cream in your eyes.', 'warn'); return false; }
      if (p.statuses.confused) { msg(run, 'The letters swim around. You cannot read.', 'warn'); return false; }
      if (it.base === 's_blink' && !target) return false;
      const known = isKnown(run, it.base);
      const ok = readScroll(run, it, target, extraId);
      if (!ok) return false;
      learn(run, it.base);
      consume();
      run.stats.scrolls++;
      if (!known) msg(run, `(That was a ${CONSUMABLES[it.base].name}.)`, 'dim');
      spend(run, 100);
      return true;
    }
    case 'wand': {
      if (!target) return false;
      if ((it.charges ?? 0) <= 0) { msg(run, 'The wand is empty. You shake it. Still empty.', 'warn'); return false; }
      const def = CONSUMABLES[it.base];
      const rank = 1 + Math.floor(p.level / 6);
      execAbility(run, p, def.ability!, target, rank);
      it.charges = (it.charges ?? 1) - 1;
      learn(run, it.base);
      if (it.charges <= 0) msg(run, 'The wand is now empty.', 'dim');
      spend(run, 100);
      return true;
    }
    case 'essence': {
      consume();
      msg(run, `You crush the essence of ${it.family} in your fist. It soaks into your skin.`, 'story');
      gainMutation(run, it.family);
      spend(run, 100);
      return true;
    }
    case 'tome': {
      const disc = it.base.slice(5);
      consume();
      if (!p.disciplines.includes(disc)) p.disciplines.push(disc);
      const avail = Object.values(TALENTS).filter((t) => t.disc === disc && canTake(run, t));
      msg(run, `You read the tome of ${DISCIPLINES[disc]?.name}. Your mind fills with new possibilities.`, 'good');
      if (avail.length) {
        p.pendingTalents++;
        p.offers = r.sample(avail, Math.min(3, avail.length)).map((t) => t.id);
        popups.push({ type: 'levelup' });
      }
      spend(run, 100);
      return true;
    }
    case 'note': {
      const n = NOTES[it.noteId ?? 0];
      popups.push({ type: 'note', title: n.title, text: n.text });
      return false;
    }
  }
  return false;
}

export function quaff(run: Run, base: string) {
  const p = run.player;
  const s = playerStats(run);
  const r = rng(run);
  const pot = 1 + s.potionPct / 100;
  switch (base) {
    case 'p_curing': p.hp = Math.min(s.maxHp, p.hp + Math.round((8 + s.maxHp * 0.2) * pot)); for (const k of ['poison', 'confused', 'blind', 'weak', 'doughy', 'slow']) delete p.statuses[k]; msg(run, 'You feel better.', 'good'); break;
    case 'p_heal': p.hp = Math.min(s.maxHp, p.hp + Math.round((20 + s.maxHp * 0.5) * pot)); msg(run, 'Your wounds close up. Cherry flavour.', 'good'); break;
    case 'p_mana': p.mp = Math.min(s.maxMp, p.mp + Math.round((5 + s.maxMp * 0.6) * pot)); msg(run, 'Magic courses through you.', 'good'); break;
    case 'p_might': addStatus(run, p, 'might', Math.round(25 * pot), 2); break;
    case 'p_agility': addStatus(run, p, 'agile', Math.round(25 * pot)); break;
    case 'p_brilliance': addStatus(run, p, 'brilliant', Math.round(25 * pot)); break;
    case 'p_haste': addStatus(run, p, 'haste', Math.round(15 * pot)); break;
    case 'p_berserk': addStatus(run, p, 'berserk', Math.round(12 * pot)); break;
    case 'p_invis': addStatus(run, p, 'invisible', Math.round(20 * pot)); break;
    case 'p_resist': addStatus(run, p, 'resist', Math.round(30 * pot)); break;
    case 'p_flight': addStatus(run, p, 'flying', Math.round(30 * pot)); break;
    case 'p_experience': levelUp(run); p.xp = Math.max(p.xp, xpForLevel(p.level)); break;
    case 'p_mutation': msg(run, 'You feel... different.', 'warn'); gainMutation(run); break;
    case 'p_gain': { const a = r.pick(['might', 'agility', 'wits'] as const); p.attrs[a]++; msg(run, `You feel ${a === 'might' ? 'stronger' : a === 'agility' ? 'nimbler' : 'cleverer'}!`, 'good'); break; }
    case 'p_porridge': p.hp = Math.min(s.maxHp, p.hp + 1); msg(run, r.pick(['It is porridge. Not too hot, not too cold. Just right.', 'Warm porridge. You feel like your grandmother is proud of you.']), 'good'); break;
    case 'p_poison': if (s.res.poison > 0) msg(run, 'You feel slightly ill. Your stomach shrugs it off.', 'dim'); else addStatus(run, p, 'poison', 8, 2 + Math.floor(run.depth / 2)); break;
    case 'p_sleep': msg(run, 'You feel very, very sleepy...', 'bad'); addStatus(run, p, 'asleep', 6); break;
    case 'p_regret': addStatus(run, p, 'confused', 8); msg(run, 'You think about that thing you said in 2009. You feel confused.', 'bad'); break;
  }
}

function readScroll(run: Run, it: Item, target?: Pos, extraId?: number): boolean {
  const p = run.player;
  const r = rng(run);
  const l = cur(run);
  switch (it.base) {
    case 's_identify': {
      const unknown = p.inventory.filter((o) => o !== it && (!isKnown(run, o.base) || (isEquipment(o) && !o.known)));
      const worn = Object.values(p.equip).filter((o): o is Item => !!o && !o.known);
      const pool = [...unknown, ...worn];
      if (!pool.length) { msg(run, 'You have nothing to identify. The scroll is wasted.', 'dim'); return true; }
      const pick = pool.find((o) => o.id === extraId) ?? pool[0];
      learn(run, pick.base);
      pick.known = true;
      msg(run, `It is ${itemName(run, pick)}.`, 'good');
      if (pick.art) msg(run, `${pick.art.props.map((x) => x.text).join(', ')}.`, 'good');
      return true;
    }
    case 's_teleport': msg(run, 'You teleport!', 'good'); teleportPlayer(run); return true;
    case 's_blink': {
      if (!target || !isVisible(run, target.x, target.y) || !playerCanEnter(run, target.x, target.y) || actorAt(run, target.x, target.y) || dist(p, target) > 7) { msg(run, 'You cannot blink there.', 'dim'); return false; }
      p.x = target.x; p.y = target.y; msg(run, 'You blink.', 'good'); return true;
    }
    case 's_enchant_weapon': {
      const w = p.equip.weapon;
      if (!w) { msg(run, 'Your fists glow briefly. That did nothing.', 'dim'); return true; }
      w.ench = (w.ench ?? 0) + 1; w.cursed = false; w.known = true;
      msg(run, `Your ${itemName(run, w)} glows.`, 'good');
      return true;
    }
    case 's_enchant_armour': {
      const pieces = (['body', 'offhand', 'head', 'feet', 'cloak', 'hands'] as Slot[]).map((sl) => p.equip[sl]).filter((x): x is Item => !!x);
      if (!pieces.length) { msg(run, 'You feel a strange urge to wear armour.', 'dim'); return true; }
      const a = p.equip.body ?? r.pick(pieces);
      a.ench = (a.ench ?? 0) + 1; a.cursed = false; a.known = true;
      msg(run, `Your ${itemName(run, a)} glows silver.`, 'good');
      return true;
    }
    case 's_mapping': for (let i = 0; i < l.seen.length; i++) l.seen[i] = 1; for (const f of l.features) if (f.kind === 'trap') f.hidden = false; msg(run, 'A map of the level appears in your mind.', 'good'); return true;
    case 's_fear': for (const m of l.monsters) if (!m.ally && isVisible(run, m.x, m.y)) addStatus(run, m, 'afraid', 12); msg(run, 'You hear a terrifying scream. It was you. It worked.', 'good'); return true;
    case 's_fog': execAbility(run, p, 'fog', p); msg(run, 'Fog billows around you.', 'good'); return true;
    case 's_remove_curse': for (const o of Object.values(p.equip)) if (o) o.cursed = false; msg(run, 'You feel like someone is helping you.', 'good'); return true;
    case 's_immolation': {
      msg(run, 'The scroll bursts into flames around you!', 'warn');
      for (const m of [...l.monsters]) if (dist(m, p) <= 2) damage(run, m, r.roll(3, 8) + run.depth, 'fire', { source: p });
      damage(run, p, r.roll(2, 6), 'fire', { cause: 'a scroll of immolation' });
      return true;
    }
    case 's_acquirement': { const good = randomItem(run, run.depth + 4, { good: true, cat: r.pick(['weapon', 'armour', 'jewel', 'wand', 'tome']) }); good.known = true; l.items.push({ x: p.x, y: p.y, item: good, seen: true }); msg(run, `Something appears at your feet: ${itemName(run, good)}!`, 'good'); return true; }
    case 's_noise': msg(run, 'The scroll emits an ear-splitting AIRHORN.', 'bad'); noise(run, p, 40); return true;
    case 's_summoning': {
      msg(run, 'Monsters appear! They did not want to be here either.', 'bad');
      for (let i = 0; i < r.int(2, 3); i++) { const spot = nearestFree(run, l, p, (x, y) => walkable(l.tiles[y * l.w + x]), 3); const pool = ['rat', 'jackal', 'goblin', 'gnoll', 'skeletal_warrior', 'hell_hound', 'abomination']; const id = pool[Math.min(pool.length - 1, Math.floor(run.depth / 2.5))]; if (spot) spawnMonster(run, l, id, spot.x, spot.y, { awake: true }); }
      return true;
    }
    case 's_amnesia': l.seen.fill(0); msg(run, 'Wait, where are you? Who are you? Ah, right. Dungeon.', 'bad'); return true;
    case 's_useless': msg(run, r.pick(USELESSNESS), 'dim'); return true;
    case 's_vuln': addStatus(run, p, 'marked', 20); msg(run, 'You feel very exposed.', 'bad'); return true;
  }
  return false;
}

function useShrine(run: Run): boolean {
  const p = run.player;
  const l = cur(run);
  const r = rng(run);
  const f = l.features.find((f0) => f0.kind === 'shrine' && f0.x === p.x && f0.y === p.y);
  if (!f || f.used) return false;
  const s = playerStats(run);
  switch (f.id) {
    case 'hunger': {
      const cost = Math.max(3, Math.round(s.maxHp * 0.1));
      p.bonusHp -= cost;
      p.hp = Math.min(p.hp, playerStats(run).maxHp);
      p.pendingTalents++;
      msg(run, 'The shrine takes a bite out of you. It does not hurt. That is the scary part. You gain a talent.', 'story');
      popups.push({ type: 'levelup' });
      break;
    }
    case 'gold': {
      if (p.gold < 50) { msg(run, 'The shrine sniffs your purse and is unimpressed.', 'dim'); return false; }
      const lvl = run.depth + Math.min(8, Math.floor(p.gold / 100));
      p.gold = 0;
      const it = randomItem(run, lvl, { good: true, cat: r.pick(['weapon', 'armour', 'jewel']) });
      it.known = true;
      l.items.push({ x: p.x, y: p.y, item: it, seen: true });
      msg(run, `Your gold melts into the shrine. Something rises up in its place: ${itemName(run, it)}.`, 'good');
      break;
    }
    case 'chaos': msg(run, 'The shrine giggles. You feel yourself change.', 'story'); gainMutation(run); gainMutation(run); break;
    case 'rng': {
      if (r.chance(0.5)) {
        const it = randomItem(run, run.depth + 5, { good: true });
        it.known = true;
        l.items.push({ x: p.x, y: p.y, item: it, seen: true });
        msg(run, `RNGesus smiles upon you! ${itemName(run, it)} appears.`, 'good');
      } else {
        msg(run, 'RNGesus is displeased. Monsters pour from the shadows!', 'bad');
        for (let i = 0; i < r.int(3, 5); i++) {
          const spot = randomSpot(run, p, 3, 7);
          const pool = Object.keys({ rat: 1 });
          if (spot) { const lvlPool = ['jackal', 'gnoll', 'wolf_spider', 'skeletal_warrior', 'crimson_imp', 'hell_hound', 'abomination']; spawnMonster(run, l, lvlPool[Math.min(lvlPool.length - 1, Math.floor(run.depth / 2))] ?? pool[0], spot.x, spot.y, { awake: true }); }
        }
      }
      break;
    }
    case 'sacrifice': {
      const pots = p.inventory.filter((i) => i.kind === 'potion');
      if (!pots.length) { msg(run, 'You have no potions to sacrifice.', 'dim'); return false; }
      p.inventory = p.inventory.filter((i) => i.kind !== 'potion');
      msg(run, `You pour ${pots.reduce((a, b) => a + b.qty, 0)} potions onto the altar. GO FAST.`, 'story');
      levelUp(run);
      p.xp = Math.max(p.xp, xpForLevel(p.level));
      break;
    }
    case 'mirror': {
      let refund = 0;
      for (const v of Object.values(p.talents)) refund += v;
      p.talents = {};
      p.pendingTalents += refund;
      p.offers = undefined;
      p.quick = p.quick.map((q) => (q && q.startsWith('a:') ? null : q));
      for (const ab of playerAbilities(run)) autoQuickSlot(run, 'a:' + ab.id);
      msg(run, `The mirror shatters, and so do your habits. You have ${refund} talents to choose again.`, 'story');
      popups.push({ type: 'levelup' });
      break;
    }
  }
  f.used = true;
  run.flags[`shrine_${run.depth}`] = SHRINES[f.id].name;
  return true;
}

export function canFireAt(run: Run, m: Monster): boolean {
  const s = playerStats(run);
  const p = run.player;
  if (s.weapon.cls === 'bow') return dist(p, m) <= 8 && los(run, p, m);
  const reach = s.weapon.reach ?? 1;
  return dist(p, m) <= reach && dist(p, m) > 1 && los(run, p, m);
}

export { canMonsterEnter, name };
