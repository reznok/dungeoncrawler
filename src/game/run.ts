import type { Player, Run } from '../core/types';
import { Rng } from '../core/rng';
import { ANCESTRIES, CALLINGS } from '../data/characters';
import { CONSUMABLES, WEAPONS } from '../data/items';
import { MONSTERS } from '../data/monsters';
import { cur, msg, setMonsterNamer, view } from './state';
import { addToInventory, isEquipment, learn, makeItem, rollAppearances } from './items';
import { playerStats } from './stats';
import { createLevel, planUniques, planPatrons, type GhostInfo } from './levels';
import { updateFov } from './fov';
import { autoQuickSlot, playerAbilities } from './progression';

setMonsterNamer((m) => MONSTERS[m.def]?.name ?? m.def);

export const SAVE_VERSION = 1;

export function newRun(seed: number, name: string, ancestryId: string, callingId: string, ghosts: GhostInfo[] = []): Run {
  const anc = ANCESTRIES.find((a) => a.id === ancestryId)!;
  const cal = CALLINGS.find((c) => c.id === callingId)!;
  const r = new Rng(seed);
  const player: Player = {
    id: 1, x: 0, y: 0, hp: 1, energy: 100, statuses: {},
    name, ancestry: anc.id, calling: cal.id, level: 1, xp: 0,
    attrs: { ...anc.attrs }, attrPoints: 0, pendingTalents: 0, mp: 0,
    inventory: [], equip: {}, talents: {}, mutations: [], disciplines: [],
    quick: [null, null, null, null, null, null], gold: cal.gold, cooldowns: {}, regenAcc: 0, mpAcc: 0, bonusHp: 0,
  };
  const run: Run = {
    version: SAVE_VERSION, seed, rng: r.s, turn: 0, tick: 0, depth: 1, levels: {}, player,
    appearances: {}, known: [], messages: [], nextId: 2, flags: {}, uniques: {},
    stats: { kills: 0, deepest: 1, turns: 0, damageDealt: 0, damageTaken: 0, potions: 0, scrolls: 0, uniques: [], started: Date.now() },
  };
  view.rng = null;
  rollAppearances(run, r);
  // Jester: two random extra disciplines
  if (cal.id === 'jester') {
    const extra = r.sample(['blades', 'shadow', 'pyromancy', 'hexcraft', 'alchemy', 'beastcraft', 'baking', 'tempest', 'brawling'], 2);
    player.disciplines.push(...extra);
  }
  for (const t of cal.talents) player.talents[t] = 1;
  for (const k of cal.kit) {
    const it = makeItem(run, k.base, { qty: k.qty ?? 1, ench: k.ench, known: true });
    if (CONSUMABLES[k.base]) learn(run, k.base);
    if (isEquipment(it)) {
      const slot = it.kind === 'weapon' ? (player.equip.weapon ? null : 'weapon') : null;
      if (it.kind === 'weapon' && slot) player.equip.weapon = it;
      else if (it.kind === 'armour') {
        // equip if allowed
        const s = playerStats(run);
        const a = it.base;
        const slotName = a === 'buckler' ? 'offhand' : a === 'cloak' ? 'cloak' : a === 'wizard_hat' ? 'head' : 'body';
        if (slotName === 'body' && s.flags.has('no_body')) addToInventory(run, it);
        else player.equip[slotName] = it;
      } else addToInventory(run, it);
    } else addToInventory(run, it);
  }
  if (cal.knowsPotions) for (const c of Object.values(CONSUMABLES)) if (c.kind === 'potion') learn(run, c.id);
  if (player.equip.weapon && WEAPONS[player.equip.weapon.base]?.twoHanded && player.equip.offhand) { addToInventory(run, player.equip.offhand); delete player.equip.offhand; }
  // everyone starts knowing curing, and carries one
  learn(run, 'p_curing');
  addToInventory(run, makeItem(run, 'p_curing'));
  planUniques(run);
  planPatrons(run);
  run.flags.ghosts = JSON.stringify(ghosts.filter((g) => g.depth > 1 && g.depth < 15).slice(0, 8));
  run.levels[1] = createLevel(run, 1);
  const l = cur(run);
  l.visited = true;
  player.x = l.up[0].x; player.y = l.up[0].y;
  const s = playerStats(run);
  player.hp = s.maxHp; player.mp = s.maxMp;
  for (const ab of playerAbilities(run)) autoQuickSlot(run, 'a:' + ab.id);
  const potion = player.inventory.find((i) => i.kind === 'potion');
  if (potion) autoQuickSlot(run, 'i:' + potion.base);
  msg(run, `${name} the ${anc.name} ${cal.name} descends into the cellar beneath the ruined bakery of Crumbsworth.`, 'story');
  msg(run, 'Somewhere far below, Mother is waiting. Tap to move, swipe to step, hold to look.', 'story');
  updateFov(run);
  return run;
}
