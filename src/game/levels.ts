import type { Feature, Level, Run } from '../core/types';
import { dist, type Pos } from '../core/geom';
import { MONSTERS, UNIQUES, type MonsterDef } from '../data/monsters';
import { T, THEMES, themeForDepth, walkable, MAX_DEPTH } from '../data/terrain';
import { FEELINGS, NOTES, SHOP_NAMES } from '../data/flavor';
import { generateMap, type Room } from '../world/gen';
import { distanceMap, UNREACHED } from '../world/path';
import { rng } from './state';
import { spawnMonster } from './monsters';
import { itemPrice, makeItem, randomItem } from './items';

export const SHRINES: Record<string, { name: string; tile: string; desc: string; offer: string }> = {
  hunger: { name: 'Shrine of the Hungry God', tile: 'dngn/altars/kikubaaqudgha', desc: 'A shrine with a mouth. It is drooling.', offer: 'Feed it 10% of your max HP, forever. Gain a talent.' },
  gold: { name: 'Shrine of the Golden Calf', tile: 'dngn/altars/gozag0', desc: 'A shrine of gold coins, all of them glued down.', offer: 'Give it all your gold (at least 50). Receive something good.' },
  chaos: { name: 'Shrine of Whatever', tile: 'dngn/altars/xom0', desc: 'A shrine that keeps changing shape. It giggles.', offer: 'Receive two random mutations. No refunds.' },
  rng: { name: 'Altar of RNGesus', tile: 'dngn/altars/nemelex1', desc: 'Pray to the random number god. Results may vary.', offer: 'A 50/50: a great item, or a great many monsters.' },
  sacrifice: { name: 'Altar of the Speedrunner', tile: 'dngn/altars/okawaru', desc: 'Someone has carved "GO FAST" into the stone.', offer: 'Sacrifice every potion you carry. Gain a level.' },
  mirror: { name: 'Mirror of Second Chances', tile: 'dngn/altars/ecumenical', desc: 'You see yourself, but different.', offer: 'Forget all your talents, and choose them again.' },
};

export const SHADOW_TILES: Record<string, string> = {
  human: 'mon/nonliving/shadows/shadow_human', dwarf: 'mon/nonliving/shadows/shadow_dwarf', elf: 'mon/nonliving/shadows/shadow_elf',
  gnoll: 'mon/nonliving/shadows/shadow_gnoll', kobold: 'mon/nonliving/shadows/shadow_kobold', frog: 'mon/nonliving/shadows/shadow_barachi',
  troll: 'mon/nonliving/shadows/shadow_troll', spriggan: 'mon/nonliving/shadows/shadow_spriggan', ghoul: 'mon/nonliving/shadows/shadow_revenant',
  mummy: 'mon/nonliving/shadows/shadow_mummy', octopode: 'mon/nonliving/shadows/shadow_octopode', gargoyle: 'mon/nonliving/shadows/shadow_gargoyle',
};

export interface GhostInfo { name: string; title: string; level: number; depth: number }

/** Run-start setup: which uniques appear on which floors. */
export function planUniques(run: Run) {
  const r = rng(run);
  const taken = new Set<number>();
  for (const u of r.shuffle([...UNIQUES])) {
    if (r.chance(0.3)) continue;
    const opts: number[] = [];
    for (let d = u.minDepth ?? 1; d <= (u.maxDepth ?? MAX_DEPTH - 1); d++) if (!taken.has(d) && d !== 6 && d !== 12 && d < MAX_DEPTH) opts.push(d);
    if (!opts.length) continue;
    const d = r.pick(opts);
    taken.add(d);
    run.uniques[u.id] = d;
  }
}

export function createLevel(run: Run, depth: number): Level {
  const r = rng(run);
  let theme = themeForDepth(depth);
  let event: string | undefined;
  if (depth >= 2 && depth <= 5 && !run.flags.office && r.chance(0.3)) { theme = THEMES.office; event = 'office'; run.flags.office = true; }
  else if (depth >= 7 && depth <= 11 && !run.flags.crypt && r.chance(0.3)) { theme = THEMES.crypt; event = 'crypt'; run.flags.crypt = true; }
  const style = depth === MAX_DEPTH ? 'halls' : undefined;
  const g = generateMap(r, depth, theme, { style });
  const l: Level = {
    depth, w: g.w, h: g.h, tiles: g.tiles, seen: new Array(g.w * g.h).fill(0), theme: theme.id,
    monsters: [], items: [], features: [], clouds: [], up: g.up, down: g.down, visited: false, corpses: [], event,
  };
  populate(run, l, g.rooms);
  return l;
}

function floorSpots(l: Level, avoid: Pos[], minD: number): Pos[] {
  const out: Pos[] = [];
  for (let y = 1; y < l.h - 1; y++) for (let x = 1; x < l.w - 1; x++) {
    if (l.tiles[y * l.w + x] !== T.FLOOR) continue;
    if (avoid.some((a) => dist(a, { x, y }) < minD)) continue;
    out.push({ x, y });
  }
  return out;
}

function spawnTable(depth: number): MonsterDef[] {
  return Object.values(MONSTERS).filter((d) => !d.unique && (d.rarity ?? 10) > 0 && d.level <= depth + 1 && d.level >= depth - 4);
}

function pickMonster(run: Run, depth: number, ood: boolean): MonsterDef | undefined {
  const r = rng(run);
  const lvl = ood ? depth + r.int(3, 5) : depth;
  const pool = Object.values(MONSTERS).filter((d) => !d.unique && (d.rarity ?? 10) > 0 && d.level <= lvl + 1 && d.level >= lvl - 4 && d.id !== 'starter_spawn');
  const usable = pool.length ? pool : spawnTable(depth);
  return r.weighted(usable, (d) => (d.rarity ?? 10) * Math.max(0.2, 1.6 - Math.abs(d.level - lvl) * 0.35));
}

function populate(run: Run, l: Level, rooms: Room[]) {
  const r = rng(run);
  const depth = l.depth;
  const arrival = [...l.up];
  const used = new Set<number>();
  const take = (spots: Pos[]): Pos | null => {
    for (let i = 0; i < 40 && spots.length; i++) {
      const p = r.pick(spots);
      if (!used.has(p.y * l.w + p.x)) { used.add(p.y * l.w + p.x); return p; }
    }
    return null;
  };
  const spots = floorSpots(l, arrival, 7);
  let feeling: string = 'normal';

  if (depth === MAX_DEPTH) return populateFinal(run, l, spots, take);

  // ---- monsters
  const count = Math.round(7 + depth * 0.7 + r.int(0, 5));
  for (let i = 0; i < count; i++) {
    const ood = r.chance(0.05 + depth * 0.004);
    const def = pickMonster(run, depth, ood);
    if (!def) continue;
    if (ood && def.level > depth + 2) feeling = 'danger';
    const at = take(def.flags?.includes('aquatic') ? floorSpotsOfType(l, [T.DEEP]) : spots);
    if (!at) continue;
    const awake = r.chance(0.2);
    const m = spawnMonster(run, l, def.id, at.x, at.y, { awake });
    if (!m) continue;
    const n = def.pack ? r.int(def.pack[0], def.pack[1]) - 1 : 0;
    for (let k = 0; k < n; k++) placeNear(run, l, at, def.id, awake);
    if (def.followers) for (let k = 0; k < r.int(def.followers.n[0], def.followers.n[1]); k++) placeNear(run, l, at, def.followers.id, awake);
  }
  // event extras
  if (l.event === 'office') {
    for (let i = 0; i < 6; i++) { const at = take(spots); if (at) spawnMonster(run, l, r.pick(['goblin', 'kobold', 'hobgoblin']), at.x, at.y); }
    const at = take(spots);
    if (at) l.features.push({ kind: 'note', x: at.x, y: at.y, id: 'office', data: { text: 'NOTICE: All adventurers must obtain Form 27-B (stroke 6) before engaging in combat. Unauthorised heroics will be fined.' } });
  }
  if (l.event === 'crypt') {
    for (let i = 0; i < 6; i++) { const at = take(spots); if (at) spawnMonster(run, l, r.pick(['skeletal_warrior', 'wight', 'necrophage', 'laughing_skull', 'weeping_skull']), at.x, at.y); }
  }
  // unique
  for (const [id, d] of Object.entries(run.uniques)) {
    if (d !== depth) continue;
    const at = take(spots);
    if (!at) continue;
    const hunting = r.chance(0.3);
    const m = spawnMonster(run, l, id, at.x, at.y, { awake: hunting || r.chance(0.4) });
    if (m && hunting) m.lastSeen = { ...l.up[0] };
    const def = MONSTERS[id];
    if (m && def.followers) for (let k = 0; k < r.int(def.followers.n[0], def.followers.n[1]); k++) placeNear(run, l, at, def.followers.id, m.awake);
    if (feeling === 'normal') feeling = 'unique';
  }
  // ghosts of previous characters who died at this depth
  const ghosts: GhostInfo[] = JSON.parse(String(run.flags.ghosts ?? '[]'));
  const ghost = ghosts.find((g) => g.depth === depth);
  if (ghost && r.chance(0.6)) {
    const at = take(spots);
    const m = at && spawnMonster(run, l, 'player_ghost', at.x, at.y, { awake: false });
    if (m) {
      m.name = `the ghost of ${ghost.name} ${ghost.title}`;
      m.maxHp = m.hp = 12 + ghost.level * 7;
      m.bonus = Math.floor(ghost.level / 2);
      feeling = 'unique';
    }
    run.flags.ghosts = JSON.stringify(ghosts.filter((g) => g !== ghost));
  }
  // your shadow
  if (depth >= 8 && depth <= 11 && !run.flags.shadow && r.chance(0.35)) {
    run.flags.shadow = true;
    const at = take(spots);
    const m = at && spawnMonster(run, l, 'shadow_twin', at.x, at.y, { awake: false });
    if (m) {
      const p = run.player;
      m.maxHp = m.hp = 20 + p.level * 8;
      m.bonus = Math.floor(p.level / 2);
      m.name = `${p.name}'s shadow`;
      m.tile = SHADOW_TILES[p.ancestry] ?? SHADOW_TILES.human;
      l.feeling = 'You catch a glimpse of yourself in the dark. You were not holding a mirror.';
    }
  }
  // treasure box (sometimes it bites)
  if (depth >= 2 && r.chance(0.4)) {
    const at = take(spots);
    if (at) l.features.push({ kind: 'chest', x: at.x, y: at.y, id: r.chance(0.3) ? 'mimic' : 'loot' });
  }
  // story: the Baker
  if (depth === 6 && !run.flags.bakerMet) {
    const at = take(spots);
    if (at) {
      const m = spawnMonster(run, l, 'baker', at.x, at.y, { awake: true });
      if (m) { m.friendly = true; m.hp = m.maxHp; }
    }
  }
  if (depth === 12 && !run.flags.bakerDead) {
    const at = take(floorSpots(l, arrival, 14));
    if (at) {
      const m = spawnMonster(run, l, 'baker', at.x, at.y, { awake: false });
      if (m) for (let k = 0; k < 3; k++) placeNear(run, l, at, 'starter_spawn', false);
    }
  }

  // ---- items
  const nItems = r.int(5, 9);
  for (let i = 0; i < nItems; i++) { const at = take(spots); if (at) l.items.push({ x: at.x, y: at.y, item: randomItem(run, depth) }); }
  const nGold = r.int(2, 5);
  for (let i = 0; i < nGold; i++) { const at = take(spots); if (at) l.items.push({ x: at.x, y: at.y, item: makeItem(run, 'gold', { qty: r.int(4, 10 + depth * 6) }) }); }
  // lore note
  const usedNotes = String(run.flags.notes ?? '').split(',').filter(Boolean).map(Number);
  if (r.chance(0.65) && usedNotes.length < NOTES.length) {
    const story = [11, 12, 13, 14]; // the Baker's journal, in order
    let id: number;
    const nextStory = story.find((s) => !usedNotes.includes(s));
    if (nextStory !== undefined && depth >= 2 + story.indexOf(nextStory) * 2 && r.chance(0.6)) id = nextStory;
    else { const free = NOTES.map((_, i) => i).filter((i) => !usedNotes.includes(i) && !story.includes(i)); id = free.length ? r.pick(free) : -1; }
    const at = take(spots);
    if (at && id >= 0) { l.items.push({ x: at.x, y: at.y, item: makeItem(run, 'note', { noteId: id }) }); run.flags.notes = [...usedNotes, id].join(','); }
  }
  // treasure vault
  if (rooms.length > 2 && r.chance(0.25 + depth * 0.01)) {
    const room = r.pick(rooms);
    feeling = feeling === 'normal' ? 'treasure' : feeling;
    for (let i = 0; i < r.int(2, 4); i++) {
      const at = { x: r.int(room.x, room.x + room.w - 1), y: r.int(room.y, room.y + room.h - 1) };
      if (l.tiles[at.y * l.w + at.x] !== T.FLOOR || used.has(at.y * l.w + at.x)) continue;
      used.add(at.y * l.w + at.x);
      l.items.push({ x: at.x, y: at.y, item: randomItem(run, depth + 2, { good: r.chance(0.5) }) });
    }
    const def = pickMonster(run, depth + 2, false);
    if (def) for (let i = 0; i < r.int(2, 4); i++) placeNear(run, l, { x: room.x + (room.w >> 1), y: room.y + (room.h >> 1) }, def.id, false);
  }

  // ---- features
  if (depth >= 2) {
    const nTraps = r.int(1, 2 + Math.floor(depth / 3));
    const traps = ['dart', 'net', 'teleport', 'alarm', 'pie', 'shaft', 'fire'].filter((t) => t !== 'shaft' || depth < MAX_DEPTH - 1);
    for (let i = 0; i < nTraps; i++) { const at = take(spots); if (at) l.features.push({ kind: 'trap', x: at.x, y: at.y, id: r.pick(traps), hidden: true }); }
  }
  if (depth >= 2 && r.chance(0.35)) placeShop(run, l, take(spots));
  if (depth >= 3 && r.chance(0.3)) {
    const at = take(spots);
    if (at) {
      const shrine = r.pick(Object.keys(SHRINES));
      l.tiles[at.y * l.w + at.x] = T.ALTAR;
      l.features.push({ kind: 'shrine', x: at.x, y: at.y, id: shrine });
    }
  }
  if (r.chance(0.2)) {
    const at = take(spots);
    if (at) { l.tiles[at.y * l.w + at.x] = T.FOUNTAIN; l.features.push({ kind: 'fountain', x: at.x, y: at.y, id: 'fountain' }); }
  }
  l.feeling = l.feeling ?? r.pick(FEELINGS[feeling]);
}

function populateFinal(run: Run, l: Level, spots: Pos[], take: (s: Pos[]) => Pos | null) {
  const r = rng(run);
  // Mother: farthest point from the stairs
  const d = distanceMap(l.w, l.h, l.up, (x, y) => walkable(l.tiles[y * l.w + x]));
  let best = spots[0], bd = -1;
  for (const s of spots) { const v = d[s.y * l.w + s.x]; if (v < UNREACHED && v > bd) { bd = v; best = s; } }
  spawnMonster(run, l, 'mother', best.x, best.y, { awake: false });
  for (let i = 0; i < 4; i++) placeNear(run, l, best, 'starter_spawn', false);
  for (let i = 0; i < 8; i++) {
    const def = pickMonster(run, 14, false);
    const at = take(spots);
    if (def && at) spawnMonster(run, l, def.id, at.x, at.y);
  }
  for (let i = 0; i < 4; i++) { const at = take(spots); if (at) l.items.push({ x: at.x, y: at.y, item: randomItem(run, 15, { good: r.chance(0.5) }) }); }
  l.feeling = 'It is warm here. It smells of fresh bread. Somewhere ahead, something enormous is breathing slowly, contentedly, like a sleeping parent.';
}

function floorSpotsOfType(l: Level, types: number[]): Pos[] {
  const out: Pos[] = [];
  for (let y = 1; y < l.h - 1; y++) for (let x = 1; x < l.w - 1; x++) if (types.includes(l.tiles[y * l.w + x])) out.push({ x, y });
  return out;
}

function placeNear(run: Run, l: Level, at: Pos, id: string, awake: boolean) {
  const r = rng(run);
  for (let i = 0; i < 20; i++) {
    const x = at.x + r.int(-2, 2), y = at.y + r.int(-2, 2);
    if (x < 1 || y < 1 || x >= l.w - 1 || y >= l.h - 1) continue;
    if (l.tiles[y * l.w + x] !== T.FLOOR && l.tiles[y * l.w + x] !== T.SHALLOW) continue;
    if (l.monsters.some((m) => m.x === x && m.y === y)) continue;
    spawnMonster(run, l, id, x, y, { awake });
    return;
  }
}

function placeShop(run: Run, l: Level, at: Pos | null) {
  if (!at) return;
  const r = rng(run);
  const kind = r.pick(['general', 'weapon', 'armour', 'potions', 'scrolls', 'jewellery', 'wands']);
  const cat = ({ weapon: 'weapon', armour: 'armour', potions: 'potion', scrolls: 'scroll', jewellery: 'jewel', wands: 'wand' } as const)[kind as 'weapon'];
  const stock: Feature['stock'] = [];
  for (let i = 0; i < r.int(4, 7); i++) {
    const it = randomItem(run, l.depth + 1, { cat, good: r.chance(0.3) });
    if (it.kind === 'weapon' || it.kind === 'armour') it.known = true;
    if (it.cursed) continue;
    stock.push({ item: it, price: Math.round(itemPrice(run, it) * r.int(90, 130) / 100) });
  }
  l.tiles[at.y * l.w + at.x] = T.SHOP;
  l.features.push({ kind: 'shop', x: at.x, y: at.y, id: kind, stock, data: { name: r.pick(SHOP_NAMES) } });
}
