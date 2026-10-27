import type { ActorBase, Element, Monster, Player, Run } from '../core/types';
import { MONSTERS, monsterXp, type MonsterDef } from '../data/monsters';
import { STATUSES } from '../data/statuses';
import { WEAPONS, WEAPON_EGOS } from '../data/items';
import { DEATH_QUIPS } from '../data/flavor';
import { cur, isPlayer, isVisible, msg, name, Name, rng, view, nearestFree } from './state';
import { playerStats, resistMult, type Stats } from './stats';
import { gainXp, gainFavor } from './progression';
import { pushFx, ELEMENT_COLOR } from './fx';
import { addToInventory, makeItem, randomItem } from './items';
import { walkable } from '../data/terrain';
import { dist } from '../core/geom';

export function monDef(m: Monster): MonsterDef { return MONSTERS[m.def]; }

export function addStatus(run: Run, t: ActorBase, id: string, turns: number, power?: number) {
  const cur0 = t.statuses[id];
  if (id === 'berserk' && t.statuses.fatigue) { if (isPlayer(t)) msg(run, 'You are too tired to go berserk.', 'dim'); return; }
  if (cur0) {
    cur0.turns = Math.max(cur0.turns, turns);
    if (power !== undefined) cur0.power = Math.max(cur0.power ?? 0, power);
  } else {
    t.statuses[id] = { turns, power };
    const def = STATUSES[id];
    if (def && (isPlayer(t) || isVisible(run, t.x, t.y))) {
      const who = Name(run, t);
      const verb = isPlayer(t) ? 'are' : 'is';
      if (id !== 'asleep' || isPlayer(t)) msg(run, `${who} ${verb} ${def.name.toLowerCase()}.`, isPlayer(t) ? (def.good ? 'good' : 'bad') : 'dim');
    }
  }
  if (id === 'asleep' && !isPlayer(t)) (t as Monster).awake = false;
}

export function monsterResist(def: MonsterDef, el: Element): number {
  const f = def.flags ?? [];
  if (el === 'poison' && (f.includes('nopoison') || def.family === 'undead' || def.family === 'construct')) return 0;
  if (el === 'fire' && f.includes('rfire')) return 0.4;
  if (el === 'fire' && def.family === 'dough') return 1.25; // it bakes
  if (el === 'cold' && def.family === 'fire') return 1.5;
  if (el === 'fire' && def.family === 'aquatic') return 0.6;
  if (el === 'necro' && (def.family === 'undead' || def.family === 'construct')) return 0;
  if (el === 'holy') return def.family === 'undead' || def.family === 'demon' ? 2 : def.family === 'dough' ? 1 : 0.7;
  if (el === 'acid' && def.family === 'ooze') return 0;
  if (el === 'shock' && def.family === 'aquatic') return 1.5;
  return 1;
}

export interface DmgOpts { source?: ActorBase | null; silent?: boolean; cause?: string; noSplit?: boolean }

/** Applies damage after resistances. Returns damage dealt. Handles death. */
export function damage(run: Run, t: ActorBase, amount: number, el: Element, opts: DmgOpts = {}): number {
  if (t.hp <= 0) return 0;
  let dmg = amount;
  if (isPlayer(t)) {
    const s = playerStats(run);
    const key = el === 'fire' || el === 'cold' || el === 'poison' || el === 'shock' || el === 'necro' ? el : null;
    if (key) dmg *= resistMult(s.res[key]);
  } else {
    dmg *= monsterResist(monDef(t as Monster), el);
  }
  if (t.statuses.marked) dmg *= 1.5;
  dmg = Math.round(dmg);
  if (dmg <= 0) return 0;
  const sh = t.statuses.shielded;
  if (sh && (sh.power ?? 0) > 0) {
    const absorbed = Math.min(dmg, sh.power ?? 0);
    sh.power = (sh.power ?? 0) - absorbed;
    dmg -= absorbed;
    if ((sh.power ?? 0) <= 0) { delete t.statuses.shielded; if (isPlayer(t)) msg(run, 'Your ward shatters.', 'warn'); }
    if (dmg <= 0) return 0;
  }
  t.hp -= dmg;
  if (isVisible(run, t.x, t.y)) pushFx({ kind: 'num', at: { x: t.x, y: t.y }, text: String(dmg), color: isPlayer(t) ? '#ff5050' : ELEMENT_COLOR[el] ?? '#fff', depth: run.depth });
  if (isPlayer(t)) {
    run.stats.damageTaken += dmg;
    view.interrupt = true;
    const s = playerStats(run);
    if (t.hp > 0 && t.hp < s.maxHp * 0.25 && s.flags.has('divine_shield') && (run.player.shieldReadyTurn ?? 0) <= run.turn) {
      addStatus(run, t, 'shielded', 30, 10 + run.player.level * 2);
      run.player.shieldReadyTurn = run.turn + 50;
      msg(run, 'A divine shield flares around you!', 'good');
    }
    if (t.hp <= 0) playerDies(run, opts.cause ?? (opts.source ? name(run, opts.source, false) : 'something'));
  } else {
    const m = t as Monster;
    if (opts.source && isPlayer(opts.source)) run.stats.damageDealt += dmg;
    m.awake = true;
    if (m.statuses.asleep) delete m.statuses.asleep;
    if (m.def === 'mother' && m.hp > 0) motherPhase(run, m);
    if (m.hp <= 0) monsterDies(run, m, opts.source ?? null);
    else if (!opts.noSplit && monDef(m).flags?.includes('splits') && dmg >= 4 && (m.split ?? 0) < 3) split(run, m);
  }
  return dmg;
}

function motherPhase(run: Run, m: Monster) {
  const phase = Number(run.flags.motherPhase ?? 0);
  const frac = m.hp / m.maxHp;
  const l = cur(run);
  const spawn = (n: number) => {
    for (let i = 0; i < n; i++) {
      const spot = nearestFree(run, l, m, (x, y) => walkable(l.tiles[y * l.w + x]), 3);
      if (!spot) break;
      const s = { id: run.nextId++, def: 'starter_spawn', x: spot.x, y: spot.y, hp: 30, maxHp: 30, energy: 0, statuses: {}, awake: true, cooldowns: {} } as Monster;
      l.monsters.push(s);
    }
  };
  if (phase < 1 && frac < 0.66) {
    run.flags.motherPhase = 1;
    msg(run, 'Mother shudders. Lumps of her break away and crawl toward you.', 'bad');
    msg(run, 'Mother: "Why are you hurting me? I only ever fed you."', 'speech');
    spawn(4);
  } else if (phase < 2 && frac < 0.33) {
    run.flags.motherPhase = 2;
    msg(run, 'Mother RISES. She fills half the chamber. The air is thick with yeast.', 'bad');
    msg(run, `Mother speaks in your grandmother's voice: "${run.player.name}. Come home. Come home and be bread."`, 'speech');
    addStatus(run, m, 'risen', 60, 8);
    addStatus(run, m, 'haste', 10);
    spawn(5);
  }
}

function split(run: Run, m: Monster) {
  if (m.hp < 6) return;
  const l = cur(run);
  const spot = nearestFree(run, l, m, (x, y) => walkable(l.tiles[y * l.w + x]), 1);
  if (!spot) return;
  const half = Math.floor(m.hp / 2);
  m.hp -= half;
  const child: Monster = { ...m, id: run.nextId++, x: spot.x, y: spot.y, hp: half, statuses: {}, cooldowns: {}, split: (m.split ?? 0) + 1, energy: 0, carried: undefined };
  m.split = (m.split ?? 0) + 1;
  l.monsters.push(child);
  if (isVisible(run, m.x, m.y)) msg(run, `${Name(run, m)} splits in two!`, 'warn');
}

export function playerDies(run: Run, cause: string) {
  const p = run.player;
  const s = playerStats(run);
  if (run.flags.godmode) { p.hp = s.maxHp; return; }
  if (s.flags.has('unbreakable') && p.usedUnbreakable !== run.depth) {
    p.usedUnbreakable = run.depth;
    p.hp = 1;
    msg(run, 'You refuse to die. Not here. Not like this.', 'good');
    return;
  }
  p.hp = 0;
  run.over = 'dead';
  run.stats.killedBy = cause;
  msg(run, `${rng(run).pick(DEATH_QUIPS)} You were killed by ${cause}.`, 'bad');
}

export function monsterDies(run: Run, m: Monster, killer: ActorBase | null) {
  const l = cur(run);
  const def = monDef(m);
  const r = rng(run);
  m.hp = 0;
  // Boris always comes back once.
  if (def.flags?.includes('returns') && !m.returned) {
    m.returned = true;
    const spot = nearestFree(run, l, { x: r.int(1, l.w - 2), y: r.int(1, l.h - 2) }, (x, y) => walkable(l.tiles[y * l.w + x]), 20);
    if (spot) {
      m.hp = Math.round(m.maxHp * 0.6);
      m.x = spot.x; m.y = spot.y;
      if (isVisible(run, m.x, m.y) || true) msg(run, `"I'll be back," says ${m.name ?? 'the lich'}, crumbling... and reforming somewhere else.`, 'warn');
      return;
    }
  }
  l.monsters = l.monsters.filter((o) => o !== m);
  const seen = isVisible(run, m.x, m.y);
  if (seen) msg(run, `${Name(run, m)} ${def.family === 'undead' || def.family === 'construct' ? 'is destroyed' : 'dies'}!`, m.ally ? 'warn' : undefined);
  if (m.ally || m.summoned !== undefined) return;
  const byPlayer = !!killer && (isPlayer(killer) || (killer as Monster).ally);
  if (byPlayer) {
    run.stats.kills++;
    gainXp(run, Math.round(monsterXp(def) * (run.flags.omen === 'blood_moon' ? 1.4 : 1)));
    if (def.unique) { run.uniques[def.id] = -1; run.stats.uniques.push(m.name ?? def.name); }
    const p = run.player;
    const s = playerStats(run);
    if (s.killHeal) p.hp = Math.min(s.maxHp, p.hp + s.killHeal);
    if (s.killMp) p.mp = Math.min(s.maxMp, p.mp + s.killMp);
    if (s.flags.has('kill_haste')) addStatus(run, p, 'haste', 3);
    if (p.piety) {
      const g = p.piety.god;
      let f = 1;
      if (g === 'hettie') f = ['dough', 'demon', 'undead', 'flesh'].includes(def.family) ? 3 : 1;
      if (g === 'dm') f = def.unique ? 8 : 1 + (r.chance(0.2) ? 1 : 0);
      if (g === 'speed') f = r.chance(0.5) ? 1 : 0;
      if (g === 'rat') f = ['rat', 'orange_rat'].includes(def.id) ? -10 : 1;
      if (g === 'thing') f = def.unique ? 6 : 1 + (def.level > run.depth ? 1 : 0);
      gainFavor(run, f, f < 0 ? 'The Rat King weeps for his child.' : undefined);
    }
    if (s.flags.has('punchline')) {
      msg(run, 'Confetti explodes everywhere! Ba-dum tss.', 'good');
      pushFx({ kind: 'flash', at: [{ x: m.x, y: m.y }], color: '#ff66cc', depth: run.depth });
      for (const o of l.monsters) if (!o.ally && dist(o, m) <= 1) addStatus(run, o, 'confused', 4);
    }
  }
  // drops
  const drop = (it: ReturnType<typeof makeItem>) => l.items.push({ x: m.x, y: m.y, item: it });
  for (const it of m.carried ?? []) drop(it);
  if (def.essence && r.chance(def.essence)) drop(makeItem(run, 'essence', { family: def.family }));
  if (def.unique) drop(randomItem(run, run.depth + 2, { good: true }));
  else if (def.family === 'humanoid' && r.chance(0.35)) drop(r.chance(0.5) ? makeItem(run, 'gold', { qty: r.int(3, 8 + run.depth * 4) }) : randomItem(run, run.depth));
  else if (r.chance(0.06)) drop(randomItem(run, run.depth));
  if (!['undead', 'construct', 'ooze', 'fungus'].includes(def.family) && l.corpses.length < 40) l.corpses.push({ x: m.x, y: m.y });
  if (def.id === 'mother') {
    run.over = 'won';
    msg(run, 'MOTHER FALLS.', 'good');
  }
  if (def.id === 'baker') {
    msg(run, '"Hettie... I\'m sorry... I just wanted... to bring her home..."', 'story');
    run.flags.bakerDead = true;
  }
}

export function chanceToHit(acc: number, ev: number): number {
  return Math.max(0.12, Math.min(0.97, 0.55 + (acc - ev) * 0.035));
}

function monsterAcc(def: MonsterDef): number { return def.acc ?? Math.round(7 + def.level * 1.3); }
function monsterEv(m: Monster): number {
  const def = monDef(m);
  if (m.statuses.paralysed || m.statuses.asleep || m.statuses.entangled) return 0;
  return def.ev - (m.statuses.doughy ? 3 : 0);
}
function monsterAc(m: Monster): number {
  return Math.max(0, monDef(m).ac - (m.statuses.corroded ? 4 : 0) - (m.statuses.doughy ? 3 : 0));
}

export function isHelpless(m: Monster): boolean {
  return !m.awake || !!m.statuses.paralysed || !!m.statuses.asleep || !!m.statuses.afraid || !!m.statuses.confused;
}

export interface AttackOpts { mult?: number; noRiposte?: boolean; ranged?: boolean; bonusStatus?: { id: string; turns: number }; secondary?: boolean }

/** Player attacks monster with wielded weapon (melee or ranged). Returns true on hit. */
export function playerAttack(run: Run, m: Monster, opts: AttackOpts = {}): boolean {
  const p = run.player;
  const s = playerStats(run);
  const r = rng(run);
  const w = s.weapon;
  const helpless = isHelpless(m);
  let acc = s.acc;
  if (opts.ranged && dist(p, m) <= 1 && !s.flags.has('point_blank')) acc -= 6;
  const hit = helpless || r.chance(chanceToHit(acc, monsterEv(m)));
  m.awake = true;
  if (!hit) {
    if (isVisible(run, m.x, m.y)) msg(run, `You miss ${name(run, m)}.`, 'dim');
    return false;
  }
  const unarmed = w.cls === 'unarmed';
  let dmg = unarmed ? r.roll(1, 4 + s.unarmed) : r.roll(w.dmg[0], w.dmg[1]);
  dmg += s.dmg + (s.weaponItem?.ench ?? 0);
  dmg *= 1 + (opts.ranged ? s.rangedPct : s.meleePct) / 100;
  if (opts.ranged && s.flags.has('point_blank') && dist(p, m) <= 2) dmg *= 1.2;
  dmg *= opts.mult ?? 1;
  if (p.statuses.weak) dmg *= 0.7;
  let crit = false;
  if (r.chance(s.crit / 100)) { crit = true; dmg *= s.flags.has('brutal_crits') ? 3 : 1.5; }
  if (helpless) {
    let bonus = 0.5 + s.backstab / 100;
    if (w.cls === 'dagger') bonus += 1;
    dmg *= 1 + bonus;
  }
  if (s.flags.has('executioner') && m.hp < m.maxHp * 0.3) dmg *= 1.6;
  dmg = Math.max(0, Math.round(dmg - r.int(0, monsterAc(m))));
  const vis = isVisible(run, m.x, m.y);
  const verb = opts.ranged ? 'shoot' : unarmed ? r.pick(['punch', 'pummel', 'smack', 'clobber']) : hitVerb(w.cls, dmg, m.maxHp);
  if (vis) msg(run, `You ${verb} ${name(run, m)}${crit ? ' critically' : ''}${helpless ? ' while it is helpless' : ''}${dmg === 0 ? ', but do no damage' : ''}.`);
  const startHp = m.hp;
  if (dmg > 0) damage(run, m, dmg, 'phys', { source: p });
  // weapon ego
  const ego = s.weaponItem?.ego;
  if (ego && m.hp > 0) applyEgo(run, m, ego, dmg);
  if (s.poisonHit && m.hp > 0 && r.chance(s.poisonHit / 100) && monsterResist(monDef(m), 'poison') > 0) addStatus(run, m, 'poison', 5, 2 + Math.floor(p.level / 3));
  if (s.flags.has('ignite_hits') && m.hp > 0 && r.chance(0.2)) addStatus(run, m, 'burning', 3, 2 + Math.floor(p.level / 3));
  if (s.flags.has('spore_breath') && m.hp > 0 && r.chance(0.12)) addStatus(run, m, 'confused', 3);
  if (opts.bonusStatus && m.hp > 0) addStatus(run, m, opts.bonusStatus.id, opts.bonusStatus.turns);
  const dealt = startHp - Math.max(0, m.hp);
  if (s.lifesteal && dealt > 0 && !opts.ranged) p.hp = Math.min(s.maxHp, p.hp + Math.max(1, Math.round(dealt * s.lifesteal / 100)));
  // cleave
  if (!opts.ranged && !opts.secondary && s.cleave && r.chance(s.cleave / 100)) {
    const others = cur(run).monsters.filter((o) => o !== m && o.hp > 0 && !o.ally && !o.friendly && dist(o, p) <= 1);
    if (others.length) playerAttack(run, r.pick(others), { secondary: true });
  }
  if (!opts.ranged && !opts.secondary && s.flags.has('impale') && (w.cls === 'polearm' || w.cls === 'staff')) {
    const bx = m.x + Math.sign(m.x - p.x), by = m.y + Math.sign(m.y - p.y);
    const behind = cur(run).monsters.find((o) => o.x === bx && o.y === by && o.hp > 0 && !o.ally);
    if (behind) playerAttack(run, behind, { secondary: true });
  }
  return true;
}

function hitVerb(cls: string, dmg: number, maxHp: number): string {
  const big = dmg > maxHp * 0.5;
  switch (cls) {
    case 'blade': return big ? 'slice' : 'hit';
    case 'dagger': return big ? 'skewer' : 'stab';
    case 'axe': return big ? 'cleave' : 'chop';
    case 'mace': return big ? 'smash' : 'bash';
    case 'polearm': return big ? 'impale' : 'jab';
    case 'staff': return big ? 'wallop' : 'whack';
    default: return 'hit';
  }
}

function applyEgo(run: Run, m: Monster, ego: string, base: number) {
  const r = rng(run);
  const p = run.player;
  switch (ego) {
    case 'flaming': damage(run, m, r.int(1, 4 + Math.floor(base / 2)), 'fire', { source: p, noSplit: true }); break;
    case 'freezing': damage(run, m, r.int(1, 4 + Math.floor(base / 2)), 'cold', { source: p, noSplit: true }); if (m.hp > 0 && r.chance(0.25)) addStatus(run, m, 'slow', 3); break;
    case 'venom': if (r.chance(0.6) && monsterResist(monDef(m), 'poison') > 0) addStatus(run, m, 'poison', 5, 3 + Math.floor(p.level / 3)); break;
    case 'draining': damage(run, m, r.int(1, 3 + Math.floor(base / 3)), 'necro', { source: p, noSplit: true }); break;
    case 'vampiric': if (monDef(m).family !== 'undead' && monDef(m).family !== 'construct') { const s = playerStats(run); p.hp = Math.min(s.maxHp, p.hp + Math.max(1, Math.round(base * 0.3))); } break;
    case 'holy': damage(run, m, r.int(1, 3 + Math.floor(base / 2)), 'holy', { source: p, noSplit: true }); break;
    case 'electric': if (r.chance(0.3)) { msg(run, 'Lightning arcs from your weapon!', 'good'); damage(run, m, r.roll(2, 8), 'shock', { source: p, noSplit: true }); } break;
    case 'chaos': applyEgo(run, m, r.pick(['flaming', 'freezing', 'venom', 'draining', 'electric']), base); if (m.hp > 0 && r.chance(0.1)) addStatus(run, m, r.pick(['confused', 'slow', 'blind', 'doughy']), 4); break;
    case 'crumbs': if (r.chance(0.2)) msg(run, 'Crumbs go everywhere.', 'dim'); break;
  }
}

/** Monster melee attack on a target (player or monster). */
export function monsterAttack(run: Run, m: Monster, t: Player | Monster) {
  const def = monDef(m);
  const r = rng(run);
  const vis = isVisible(run, m.x, m.y) || isPlayer(t);
  if (isPlayer(t)) {
    const s = playerStats(run);
    let ev = s.ev;
    if (t.statuses.paralysed || t.statuses.asleep) ev = 0;
    if (cur(run).tiles[t.y * cur(run).w + t.x] === 6) ev -= 4; // shallow water
    if (!r.chance(chanceToHit(monsterAcc(def), ev))) {
      if (vis) msg(run, `${Name(run, m)} misses you.`, 'dim');
      if (s.riposte && r.chance(s.riposte / 100) && dist(m, t) <= 1) { msg(run, 'You riposte!', 'good'); playerAttack(run, m, { noRiposte: true }); }
      return;
    }
    if (s.block && r.chance(s.block / 100)) { msg(run, `You block ${name(run, m)}'s attack.`, 'dim'); return; }
    let dmg = r.roll(def.dmg[0], def.dmg[1]) + (m.bonus ?? 0);
    if (m.statuses.weak) dmg *= 0.7;
    if (m.statuses.risen) dmg += m.statuses.risen.power ?? 4;
    if (m.statuses.berserk) dmg *= 1.5;
    dmg = Math.max(0, Math.round(dmg - r.int(0, s.ac)));
    const el = (def.flags?.includes('random_element') ? r.pick(['fire', 'cold', 'poison', 'shock', 'acid'] as Element[]) : (def.element as Element)) ?? 'phys';
    const verb = def.verb ?? 'hits';
    msg(run, `${Name(run, m)} ${verb} you${dmg === 0 ? ' but does no damage' : ''}.`, dmg > 0 ? 'hurt' : 'dim');
    if (dmg > 0) damage(run, t, dmg, el, { source: m, cause: name(run, m, false) });
    if (def.hit && t.hp > 0 && r.chance(def.hit.chance)) {
      const res = def.hit.status === 'poison' ? s.res.poison : def.hit.status === 'burning' ? s.res.fire : 0;
      if (res <= 0) addStatus(run, t, def.hit.status, def.hit.turns, def.hit.power);
    }
    if (def.flags?.includes('lifesteal') && dmg > 0) m.hp = Math.min(m.maxHp, m.hp + Math.round(dmg / 2));
    if (def.flags?.includes('steals_gold') && t.gold > 0 && r.chance(0.4)) {
      const amt = Math.min(t.gold, r.int(5, 15 + run.depth * 5));
      t.gold -= amt;
      (m.carried ??= []).push(makeItem(run, 'gold', { qty: amt }));
      msg(run, `${Name(run, m)} snatches ${amt} gold and runs!`, 'bad');
      addStatus(run, m, 'afraid', 20);
    }
    if (def.flags?.includes('steals_item') && r.chance(0.35)) {
      const cands = t.inventory.filter((it) => it.kind !== 'note');
      if (cands.length) {
        const it = r.pick(cands);
        t.inventory = t.inventory.filter((o) => o !== it);
        (m.carried ??= []).push(it);
        msg(run, `${Name(run, m)} deftly lifts something from your pack and bows. "Much obliged."`, 'bad');
        addStatus(run, m, 'afraid', 15);
      }
    }
    if (s.thorns && dmg > 0 && m.hp > 0) damage(run, m, s.thorns, 'phys', { source: t, noSplit: true });
  } else {
    // monster vs monster
    if (!r.chance(chanceToHit(monsterAcc(def), monsterEv(t)))) { if (vis) msg(run, `${Name(run, m)} misses ${name(run, t)}.`, 'dim'); return; }
    let dmg = r.roll(def.dmg[0], def.dmg[1]);
    if (m.ally) dmg *= 1 + playerStats(run).summonPct / 100;
    dmg = Math.max(0, Math.round(dmg - r.int(0, monsterAc(t))));
    if (vis) msg(run, `${Name(run, m)} ${def.verb ?? 'hits'} ${name(run, t)}.`, 'dim');
    if (dmg > 0) damage(run, t, dmg, 'phys', { source: m });
  }
}

/** For UI: a rough description of how dangerous a monster is relative to the player. */
export function threat(run: Run, m: Monster): 'trivial' | 'easy' | 'tough' | 'nasty' {
  const def = monDef(m);
  const lvl = run.player.level;
  const diff = def.level * 1.6 + (def.unique ? 4 : 0) - lvl;
  if (diff < -6) return 'trivial';
  if (diff < 0) return 'easy';
  if (diff < 5) return 'tough';
  return 'nasty';
}

export function weaponReach(): number { return 1; }
export { WEAPONS, WEAPON_EGOS };
export type { Stats };
export function giveItem(run: Run, base: string) { addToInventory(run, makeItem(run, base)); }
