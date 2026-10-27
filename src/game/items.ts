import type { Item, ItemKind, Mods, Run } from '../core/types';
import type { Rng } from '../core/rng';
import {
  AMULET_LOOKS, ARMOURS, ARMOUR_EGOS, CONSUMABLES, ESSENCE_TILES, GOLD_TILE, JEWELS, NOTE_TILE, POTION_LOOKS, RING_LOOKS,
  SCROLL_LOOKS, SCROLL_SYLLABLES, TOME_TILES, WAND_LOOKS, WEAPONS, WEAPON_EGOS,
} from '../data/items';
import { ART_ADJ, ART_NOUN, ART_TITLES, NOTES } from '../data/flavor';
import { DISCIPLINES } from '../data/talents';
import { UNRANDS } from '../data/unrands';
import { newId, rng } from './state';

export function kindOf(base: string): ItemKind {
  if (WEAPONS[base]) return 'weapon';
  if (ARMOURS[base]) return 'armour';
  if (JEWELS[base]) return JEWELS[base].slot === 'ring' ? 'ring' : 'amulet';
  if (CONSUMABLES[base]) return CONSUMABLES[base].kind;
  if (base.startsWith('essence')) return 'essence';
  if (base.startsWith('tome_')) return 'tome';
  if (base === 'gold') return 'gold';
  if (base === 'note') return 'note';
  return 'misc';
}

export function makeItem(run: Run, base: string, extra: Partial<Item> = {}): Item {
  const kind = kindOf(base);
  const it: Item = { id: newId(run), kind, base, qty: 1, ...extra };
  if (kind === 'wand' && it.charges === undefined) {
    const c = CONSUMABLES[base].charges ?? [3, 6];
    it.charges = rng(run).int(c[0], c[1]);
  }
  return it;
}

/** Assigns random appearances for unidentified item types; called once per run. */
export function rollAppearances(run: Run, r: Rng) {
  const ap: Record<string, string> = {};
  const assign = (ids: string[], looks: string[]) => {
    const ls = r.shuffle([...looks]);
    ids.forEach((id, i) => { ap[id] = ls[i % ls.length]; });
  };
  const cons = Object.values(CONSUMABLES);
  assign(cons.filter((c) => c.kind === 'potion').map((c) => c.id), POTION_LOOKS);
  assign(cons.filter((c) => c.kind === 'wand').map((c) => c.id), WAND_LOOKS);
  assign(Object.values(JEWELS).filter((j) => j.slot === 'ring').map((j) => j.id), RING_LOOKS);
  assign(Object.values(JEWELS).filter((j) => j.slot === 'amulet').map((j) => j.id), AMULET_LOOKS);
  const scrolls = cons.filter((c) => c.kind === 'scroll').map((c) => c.id);
  const sl = r.shuffle([...SCROLL_LOOKS]);
  scrolls.forEach((id, i) => {
    const words = [r.pick(SCROLL_SYLLABLES) + r.pick(SCROLL_SYLLABLES), r.pick(SCROLL_SYLLABLES).toUpperCase()];
    if (r.chance(0.5)) words.push(r.pick(SCROLL_SYLLABLES));
    ap[id] = sl[i % sl.length] + '|' + words.join(' ').toUpperCase();
  });
  run.appearances = ap;
}

export function isKnown(run: Run, base: string): boolean {
  const k = kindOf(base);
  if (k === 'potion' || k === 'scroll' || k === 'wand' || k === 'ring' || k === 'amulet') return run.known.includes(base);
  return true;
}
export function learn(run: Run, base: string) { if (!run.known.includes(base)) run.known.push(base); }

export function itemTile(run: Run, it: Item): string {
  if (it.art?.tile) return it.art.tile;
  switch (it.kind) {
    case 'weapon': return WEAPONS[it.base].tile;
    case 'armour': return ARMOURS[it.base].tile;
    case 'potion': return `item/potion/${run.appearances[it.base] ?? 'unknown'}`;
    case 'scroll': return `item/scroll/${(run.appearances[it.base] ?? 'scroll').split('|')[0]}`;
    case 'wand': return `item/wand/${run.appearances[it.base] ?? 'gem_wood'}`;
    case 'ring': return `item/ring/${run.appearances[it.base] ?? 'plain_black'}`;
    case 'amulet': return `item/amulet/${run.appearances[it.base] ?? 'bone'}`;
    case 'essence': return ESSENCE_TILES[it.family ?? 'beast'] ?? 'item/misc/runes/generic';
    case 'tome': return TOME_TILES[Math.abs(hashStr(it.base)) % TOME_TILES.length];
    case 'gold': return GOLD_TILE;
    case 'note': return NOTE_TILE;
    default: return 'item/misc/misc_box_of_beasts';
  }
}

function hashStr(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

export function baseName(run: Run, it: Item): string {
  switch (it.kind) {
    case 'weapon': return WEAPONS[it.base].name;
    case 'armour': return ARMOURS[it.base].name;
    case 'ring': case 'amulet':
      return isKnown(run, it.base) ? JEWELS[it.base].name : `${(run.appearances[it.base] ?? '').replace(/_/g, ' ')} ${it.kind}`;
    case 'potion': case 'wand':
      return isKnown(run, it.base) ? CONSUMABLES[it.base].name : `${(run.appearances[it.base] ?? '').replace(/^gem_/, '').replace(/_/g, ' ')} ${it.kind}`;
    case 'scroll':
      return isKnown(run, it.base) ? CONSUMABLES[it.base].name : `scroll labelled "${(run.appearances[it.base] ?? '|???').split('|')[1]}"`;
    case 'essence': return `essence of ${it.family}`;
    case 'tome': return `tome of ${DISCIPLINES[it.base.slice(5)]?.name ?? '???'}`;
    case 'gold': return `${it.qty} gold`;
    case 'note': return NOTES[it.noteId ?? 0]?.title ?? 'a note';
    default: return it.base;
  }
}

export function itemName(run: Run, it: Item): string {
  if (it.kind === 'gold') return `${it.qty} gold`;
  if (it.art && it.known) return it.art.name;
  let n = baseName(run, it);
  if (it.kind === 'weapon' || it.kind === 'armour') {
    if (it.known) {
      const e = it.ench ?? 0;
      n = `${e >= 0 ? '+' : ''}${e} ${n}`;
      if (it.ego) n += ` of ${it.kind === 'weapon' ? WEAPON_EGOS[it.ego]?.name : ARMOUR_EGOS[it.ego]?.name}`;
    } else if (it.art || it.ego || (it.ench ?? 0) !== 0) {
      n = (it.art ? 'strange ' : 'runed ') + n;
    }
  }
  if (it.kind === 'wand' && isKnown(run, it.base)) n += ` (${it.charges})`;
  if (it.qty > 1) n = `${it.qty} ${plural(n)}`;
  if (it.cursed && it.known) n += ' {cursed}';
  return n;
}

function plural(n: string): string {
  if (n.startsWith('potion')) return n.replace('potion', 'potions');
  if (n.startsWith('scroll')) return n.replace('scroll', 'scrolls');
  if (/ potion$/.test(n)) return n + 's';
  if (n.startsWith('essence')) return n.replace('essence', 'essences');
  return n + 's';
}

export function stackable(it: Item): boolean { return it.kind === 'potion' || it.kind === 'scroll' || it.kind === 'essence'; }

export const INVENTORY_MAX = 26;

/** Scrolls and notes are paper: they never take pack space (user, 2026-10-27). */
export function takesSpace(it: Item): boolean { return it.kind !== 'scroll' && it.kind !== 'note'; }
export function packCount(run: Run): number { return run.player.inventory.filter(takesSpace).length; }

/** Adds to inventory, stacking where possible. Returns false if full. */
export function addToInventory(run: Run, it: Item): boolean {
  const inv = run.player.inventory;
  if (it.kind === 'gold') { run.player.gold += it.qty; return true; }
  if (stackable(it)) {
    const same = inv.find((o) => o.base === it.base && o.family === it.family);
    if (same) { same.qty += it.qty; return true; }
  }
  if (takesSpace(it) && packCount(run) >= INVENTORY_MAX) return false;
  inv.push(it);
  return true;
}

// ---------------------------------------------------------------- generation

type Cat = 'weapon' | 'armour' | 'jewel' | 'potion' | 'scroll' | 'wand' | 'tome';
const CAT_WEIGHT: Record<Cat, number> = { weapon: 11, armour: 13, jewel: 6, potion: 32, scroll: 26, wand: 7, tome: 2.5 };

export function randomItem(run: Run, depth: number, opts: { good?: boolean; cat?: Cat } = {}): Item {
  const r = rng(run);
  const cat = opts.cat ?? r.weighted(Object.keys(CAT_WEIGHT) as Cat[], (c) => CAT_WEIGHT[c])!;
  const lvl = depth + (opts.good ? 4 : 0);
  switch (cat) {
    case 'weapon': {
      const pool = Object.values(WEAPONS).filter((w) => w.level <= lvl + 1 && w.id !== 'fists');
      const def = r.weighted(pool, (w) => 1 + Math.max(0, 6 - Math.abs(w.level - lvl) * 0.8))!;
      return enchantGear(run, makeItem(run, def.id), lvl, opts.good);
    }
    case 'armour': {
      const pool = Object.values(ARMOURS).filter((a) => a.level <= lvl + 1);
      const def = r.weighted(pool, (a) => 1 + Math.max(0, 6 - Math.abs(a.level - lvl) * 0.8))!;
      return enchantGear(run, makeItem(run, def.id), lvl, opts.good);
    }
    case 'jewel': {
      const pool = Object.values(JEWELS).filter((j) => j.level <= lvl + 2 && (!opts.good || !j.bad));
      const def = r.pick(pool);
      const it = makeItem(run, def.id);
      if (def.bad && r.chance(0.7)) it.cursed = true;
      if (!opts.good && depth >= 4 && r.chance(0.06)) return makeArtifact(run, it, lvl);
      return it;
    }
    case 'tome': {
      const d = r.pick(Object.keys(DISCIPLINES));
      return makeItem(run, 'tome_' + d);
    }
    default: {
      const kind = cat;
      const pool = Object.values(CONSUMABLES).filter((c) => c.kind === kind && c.level <= lvl + 1 && (!opts.good || !c.bad));
      const def = r.weighted(pool, (c) => c.weight)!;
      const it = makeItem(run, def.id);
      if (kind !== 'wand' && r.chance(0.25)) it.qty = r.int(2, 3);
      return it;
    }
  }
}

function enchantGear(run: Run, it: Item, lvl: number, good?: boolean): Item {
  const r = rng(run);
  const roll = r.next();
  if (!good && roll < 0.12) {
    it.ench = -r.int(1, 3);
    if (r.chance(0.5)) it.cursed = true;
  } else if (good || roll > 0.55) {
    it.ench = r.int(1, Math.min(6, 1 + Math.floor(lvl / 3)));
  }
  const egoChance = good ? 0.5 : 0.08 + lvl * 0.012;
  if (r.chance(egoChance)) {
    it.ego = it.kind === 'weapon' ? r.pick(Object.keys(WEAPON_EGOS)) : r.pick(Object.keys(ARMOUR_EGOS));
    if (it.kind === 'weapon' && WEAPONS[it.base].cls === 'bow' && ['vampiric'].includes(it.ego)) it.ego = 'flaming';
  }
  const artChance = good ? 0.35 : 0.015 + lvl * 0.004;
  if (r.chance(artChance)) return makeArtifact(run, it, lvl);
  return it;
}

const ART_PROPS: { w: number; make: (r: Rng, lvl: number) => { mod: Mods; text: string } }[] = [
  { w: 3, make: (r, l) => { const n = r.int(1, 2 + Math.floor(l / 4)); return { mod: { might: n }, text: `+${n} Might` }; } },
  { w: 3, make: (r, l) => { const n = r.int(1, 2 + Math.floor(l / 4)); return { mod: { agility: n }, text: `+${n} Agility` }; } },
  { w: 3, make: (r, l) => { const n = r.int(1, 2 + Math.floor(l / 4)); return { mod: { wits: n }, text: `+${n} Wits` }; } },
  { w: 3, make: (r, l) => { const n = r.int(2, 4 + Math.floor(l / 3)); return { mod: { ac: n }, text: `+${n} AC` }; } },
  { w: 3, make: (r, l) => { const n = r.int(2, 4 + Math.floor(l / 3)); return { mod: { ev: n }, text: `+${n} EV` }; } },
  { w: 2, make: (r, l) => { const n = r.int(5, 10 + l * 2); return { mod: { maxHp: n }, text: `+${n} max HP` }; } },
  { w: 2, make: (r, l) => { const n = r.int(2, 4 + Math.floor(l / 2)); return { mod: { maxMp: n }, text: `+${n} max MP` }; } },
  { w: 2, make: (r, l) => { const n = r.int(2, 4 + Math.floor(l / 2)); return { mod: { spellPower: n }, text: `+${n} spell power` }; } },
  { w: 2, make: (r, l) => { const n = r.int(1, 3 + Math.floor(l / 4)); return { mod: { dmg: n }, text: `+${n} damage` }; } },
  { w: 2, make: (r, l) => { const n = r.int(2, 4 + Math.floor(l / 3)); return { mod: { acc: n }, text: `+${n} accuracy` }; } },
  { w: 2, make: () => ({ mod: { rFire: 1 }, text: 'resist fire' }) },
  { w: 2, make: () => ({ mod: { rCold: 1 }, text: 'resist cold' }) },
  { w: 2, make: () => ({ mod: { rPoison: 1 }, text: 'resist poison' }) },
  { w: 1, make: () => ({ mod: { rShock: 1 }, text: 'resist shock' }) },
  { w: 1, make: () => ({ mod: { rNecro: 1 }, text: 'resist necrotic' }) },
  { w: 2, make: (r) => { const n = r.int(2, 5); return { mod: { regen: n }, text: `+${n} regeneration` }; } },
  { w: 1, make: (r) => { const n = r.int(5, 12); return { mod: { stealth: n }, text: `+${n} stealth` }; } },
  { w: 1, make: () => ({ mod: { flags: ['see_invis'] }, text: 'see invisible' }) },
  { w: 1, make: (r) => { const n = r.int(5, 10); return { mod: { lifesteal: n }, text: `${n}% life steal` }; } },
  { w: 1, make: (r) => { const n = r.int(5, 12); return { mod: { crit: n }, text: `+${n}% critical chance` }; } },
  { w: 1, make: (r) => { const n = r.int(10, 20); return { mod: { moveSpeed: n }, text: `move ${n}% faster` }; } },
  { w: 1, make: () => ({ mod: { sight: 1 }, text: '+1 sight' }) },
  { w: 1, make: (r) => { const n = r.int(10, 25); return { mod: { xpPct: n }, text: `+${n}% XP` }; } },
];
const ART_BAD: { make: (r: Rng) => { mod: Mods; text: string } }[] = [
  { make: (r) => { const n = r.int(1, 3); return { mod: { might: -n }, text: `-${n} Might` }; } },
  { make: (r) => { const n = r.int(1, 3); return { mod: { wits: -n }, text: `-${n} Wits` }; } },
  { make: (r) => { const n = r.int(2, 5); return { mod: { stealth: -n * 2 }, text: 'noisy' }; } },
  { make: () => ({ mod: { rFire: -1 }, text: 'fire vulnerable' }) },
  { make: () => ({ mod: { rCold: -1 }, text: 'cold vulnerable' }) },
  { make: () => ({ mod: { flags: ['teleportitis'] }, text: 'teleports you at random' }) },
  { make: (r) => { const n = r.int(5, 12); return { mod: { maxHp: -n }, text: `-${n} max HP` }; } },
  { make: () => ({ mod: { flags: ['hates_you'] }, text: 'it whispers insults (no effect)' }) },
];

export function makeArtifact(run: Run, it: Item, lvl: number): Item {
  const r = rng(run);
  const used = String(run.flags.unrands ?? '').split(',');
  const fixed = UNRANDS.filter((u) => !used.includes(u.id) && u.minDepth <= lvl && kindOf(u.base) === it.kind);
  if (fixed.length && r.chance(0.3)) {
    const u = r.pick(fixed);
    run.flags.unrands = [...used.filter(Boolean), u.id].join(',');
    it.base = u.base;
    it.art = { name: u.name, props: u.props, desc: u.desc, unrand: u.id };
    it.ench = u.ench ?? it.ench ?? 0;
    it.ego = u.ego;
    it.cursed = false;
    return it;
  }
  const props = [];
  const n = r.int(2, lvl > 8 ? 4 : 3);
  const chosen = new Set<number>();
  while (props.length < n) {
    const i = ART_PROPS.indexOf(r.weighted(ART_PROPS, (p) => p.w)!);
    if (chosen.has(i)) continue;
    chosen.add(i);
    props.push(ART_PROPS[i].make(r, lvl));
  }
  if (r.chance(0.3)) props.push(r.pick(ART_BAD).make(r));
  const itemWord = baseName(run, { ...it, known: true }).replace(/^(ring|amulet) of .*$/, it.kind === 'ring' ? 'Ring' : 'Amulet').replace(/\b\w/g, (c) => c.toUpperCase());
  const title = r.pick(ART_TITLES).replace('{adj}', r.pick(ART_ADJ)).replace('{noun}', r.pick(ART_NOUN)).replace('{item}', itemWord);
  it.art = { name: title.charAt(0).toUpperCase() + title.slice(1), props };
  if (it.kind === 'weapon' || it.kind === 'armour') it.ench = Math.max(it.ench ?? 0, r.int(1, 3 + Math.floor(lvl / 4)));
  it.cursed = false;
  return it;
}

export function itemPrice(run: Run, it: Item): number {
  let p = 20;
  if (WEAPONS[it.base]) p = WEAPONS[it.base].price;
  else if (ARMOURS[it.base]) p = ARMOURS[it.base].price;
  else if (JEWELS[it.base]) p = JEWELS[it.base].price;
  else if (CONSUMABLES[it.base]) p = CONSUMABLES[it.base].price;
  else if (it.kind === 'tome') p = 250;
  if (it.ench) p += Math.max(-p / 2, it.ench * 25);
  if (it.ego) p += 60;
  if (it.art) p = p * 2 + 150;
  return Math.max(3, Math.round(p * it.qty));
}

export function isEquipment(it: Item): boolean { return it.kind === 'weapon' || it.kind === 'armour' || it.kind === 'ring' || it.kind === 'amulet'; }
