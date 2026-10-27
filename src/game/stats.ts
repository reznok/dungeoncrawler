import type { Element, Item, Mods, Player, Run, Slot } from '../core/types';
import { ANCESTRIES, CALLINGS } from '../data/characters';
import { ARMOURS, ARMOUR_EGOS, JEWELS, WEAPONS, type WeaponDef } from '../data/items';
import { MUTATIONS } from '../data/mutations';
import { TALENTS } from '../data/talents';
import { PATRONS } from '../data/patrons';

export interface Stats {
  might: number; agility: number; wits: number;
  maxHp: number; maxMp: number;
  ac: number; ev: number; acc: number;
  dmg: number; meleePct: number; rangedPct: number; spellPct: number;
  spellPower: number;
  stealth: number; sight: number;
  regen: number; mpRegen: number;
  speed: number; moveSpeed: number;
  res: Record<'fire' | 'cold' | 'poison' | 'shock' | 'necro', number>;
  crit: number; lifesteal: number; thorns: number; cooldown: number;
  xpPct: number; goldPct: number; backstab: number; riposte: number;
  killHeal: number; killMp: number; cleave: number; block: number;
  elemPct: Partial<Record<Element, number>>;
  summonPct: number; potionPct: number; unarmed: number; hexPower: number;
  poisonHit: number; burnChance: number;
  flags: Set<string>;
  weapon: WeaponDef; weaponItem?: Item;
}

export function ancestryOf(p: Player) { return ANCESTRIES.find((a) => a.id === p.ancestry)!; }
export function callingOf(p: Player) { return CALLINGS.find((c) => c.id === p.calling)!; }

export function weaponOf(p: Player): { def: WeaponDef; item?: Item } {
  const it = p.equip.weapon;
  if (it && WEAPONS[it.base]) return { def: WEAPONS[it.base], item: it };
  return { def: WEAPONS.fists };
}

export function itemMods(it: Item): Mods[] {
  const out: Mods[] = [];
  const ar = ARMOURS[it.base];
  if (ar) {
    out.push({ ac: ar.ac + (it.ench ?? 0), ev: ar.ev ?? 0 });
    if (ar.mods) out.push(ar.mods);
    if (it.ego && ARMOUR_EGOS[it.ego]) out.push(ARMOUR_EGOS[it.ego].mods);
  }
  const j = JEWELS[it.base];
  if (j) out.push(j.mods);
  if (it.art) for (const pr of it.art.props) if (pr.mod) out.push(pr.mod);
  return out;
}

export const RING_SLOTS: Slot[] = ['ring1', 'ring2', 'ring3', 'ring4'];

export function collectMods(run: Run): Mods[] {
  const p = run.player;
  const out: Mods[] = [];
  const anc = ancestryOf(p);
  if (anc.mods) out.push(anc.mods);
  const wcls = weaponOf(p).def.cls;
  for (const [slot, it] of Object.entries(p.equip)) {
    if (!it) continue;
    if (slot === 'weapon' && it.art) { for (const pr of it.art.props) if (pr.mod) out.push(pr.mod); continue; }
    out.push(...itemMods(it));
  }
  for (const [id, rank] of Object.entries(p.talents)) {
    const t = TALENTS[id];
    if (!t?.mods || rank <= 0) continue;
    if (t.cond && !t.cond.includes(wcls)) continue;
    out.push(t.mods(rank));
  }
  for (const id of p.mutations) { const m = MUTATIONS[id]; if (m?.mods) out.push(m.mods); }
  if (p.piety && PATRONS[p.piety.god]) out.push(PATRONS[p.piety.god].passive(p.piety.favor));
  const st = p.statuses;
  if (st.might) out.push({ dmg: 4 + (st.might.power ?? 0) });
  if (st.agile) out.push({ ev: 5, acc: 5 });
  if (st.brilliant) out.push({ spellPower: 8 });
  if (st.stoneskin) out.push({ ac: st.stoneskin.power ?? 5 });
  if (st.corroded) out.push({ ac: -4 });
  if (st.doughy) out.push({ ac: -3 });
  if (st.risen) out.push({ dmg: st.risen.power ?? 4, maxHpPct: 20 });
  if (st.berserk) out.push({ dmgPct: 50, ev: -10, speed: 30 });
  if (st.fatigue) out.push({ speed: -20 });
  if (st.resist) out.push({ rFire: 1, rCold: 1, rPoison: 1, rShock: 1 });
  if (st.invisible) out.push({ ev: 5, stealth: 10 });
  if (st.blind) out.push({ sight: -6, acc: -5 });
  if (st.flying) out.push({ flags: ['flying'] });
  if (st.inspired) out.push({ acc: 50 });
  return out;
}

let cache: { key: string; run: Run; stats: Stats } | null = null;

function statsKey(run: Run): string {
  const p = run.player;
  let k = `${run.tick}|${p.level}|${p.talents.last_stand ? p.hp : ''}|${p.bonusHp}|${p.attrs.might},${p.attrs.agility},${p.attrs.wits}|${p.mutations.join()}|`;
  for (const [s, v] of Object.entries(p.statuses)) k += s + (v.power ?? '') + ',';
  k += '|' + (p.piety ? p.piety.god + p.piety.favor : '') + '|';
  for (const [t, r] of Object.entries(p.talents)) k += t + r + ',';
  k += '|';
  for (const [s, it] of Object.entries(p.equip)) if (it) k += s + it.id + ':' + (it.ench ?? 0) + (it.ego ?? '') + ',';
  return k;
}

export function playerStats(run: Run): Stats {
  const key = statsKey(run);
  if (cache && cache.run === run && cache.key === key && !run.player.statuses.risen) return cache.stats;
  const stats = computeStats(run);
  cache = { key, run, stats };
  return stats;
}

function computeStats(run: Run): Stats {
  const p = run.player;
  const anc = ancestryOf(p);
  const mods = collectMods(run);
  const sum = (k: keyof Mods) => mods.reduce((a, m) => a + ((m[k] as number | undefined) ?? 0), 0);
  const flags = new Set<string>();
  for (const m of mods) for (const f of m.flags ?? []) flags.add(f);
  const might = p.attrs.might + sum('might');
  const agility = p.attrs.agility + sum('agility');
  const wits = p.attrs.wits + sum('wits');
  const lvl = p.level;
  let maxHp = anc.hp[0] + 6 + anc.hp[1] * (lvl - 1) + (might - 10) * (1 + lvl * 0.25) + sum('maxHp') + p.bonusHp;
  maxHp *= 1 + sum('maxHpPct') / 100;
  const maxMp = Math.max(0, Math.round(anc.mp[0] + anc.mp[1] * (lvl - 1) + (wits - 10) * (0.5 + lvl * 0.1) + sum('maxMp')));
  const w = weaponOf(p);
  const elemPct: Partial<Record<Element, number>> = {};
  for (const m of mods) for (const [k, v] of Object.entries(m.elemPct ?? {})) elemPct[k as Element] = (elemPct[k as Element] ?? 0) + (v ?? 0);
  let ac = sum('ac');
  let block = sum('block');
  const shield = p.equip.offhand && ARMOURS[p.equip.offhand.base];
  for (const f of flags) {
    const m = /^shield_wall_(\d)$/.exec(f);
    if (m && shield) { ac += 2 * +m[1]; block += 6 * +m[1]; }
  }
  if (shield) block += 4;
  const lowHp = p.hp < maxHp * 0.3;
  let dmgPct = sum('dmgPct');
  if (flags.has('last_stand') && lowHp) { dmgPct += 50; ac += 5; }
  const s: Stats = {
    might, agility, wits,
    maxHp: Math.max(1, Math.round(maxHp)),
    maxMp,
    ac: Math.max(0, ac),
    ev: Math.max(0, Math.round(4 + agility * 0.6 + sum('ev'))),
    acc: Math.round(6 + agility * 0.5 + lvl * 0.5 + w.def.acc + (w.item?.ench ?? 0) + sum('acc')),
    dmg: Math.round((might - 10) * 0.5 + sum('dmg')),
    meleePct: sum('meleePct') + dmgPct,
    rangedPct: sum('rangedPct') + dmgPct,
    spellPct: sum('spellPct'),
    spellPower: Math.max(1, Math.round(wits + lvl * 0.7 + sum('spellPower'))),
    stealth: Math.round(agility * 0.6 + sum('stealth')),
    sight: Math.max(1, 8 + sum('sight')),
    regen: sum('regen'),
    mpRegen: sum('mpRegen'),
    speed: sum('speed'),
    moveSpeed: sum('moveSpeed'),
    res: {
      fire: clampRes(sum('rFire')), cold: clampRes(sum('rCold')), poison: clampRes(sum('rPoison')),
      shock: clampRes(sum('rShock')), necro: clampRes(sum('rNecro')),
    },
    crit: 3 + agility * 0.3 + sum('crit'),
    lifesteal: sum('lifesteal'), thorns: sum('thorns'), cooldown: Math.min(60, sum('cooldown')),
    xpPct: sum('xpPct'), goldPct: sum('goldPct'), backstab: sum('backstab'), riposte: sum('riposte'),
    killHeal: sum('killHeal'), killMp: sum('killMp'), cleave: sum('cleave'), block: Math.min(50, block),
    elemPct, summonPct: sum('summonPct'), potionPct: sum('potionPct'), unarmed: sum('unarmed'), hexPower: sum('hexPower'),
    poisonHit: sum('poisonHit'), burnChance: sum('burnChance'),
    flags, weapon: w.def, weaponItem: w.item,
  };
  if (p.equip.weapon?.ego === 'speed') s.speed += 20;
  return s;
}

function clampRes(n: number) { return Math.max(-1, Math.min(3, n)); }

export function xpForLevel(level: number): number {
  return Math.round(25 * Math.pow(level - 1, 2.2));
}

export function resistMult(res: number): number {
  if (res >= 3) return 0;
  if (res === 2) return 1 / 3;
  if (res === 1) return 0.5;
  if (res <= -1) return 1.5;
  return 1;
}
