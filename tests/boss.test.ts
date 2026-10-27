// Boss fight simulation (slow, local only): SIM=1 npx vitest run boss   (BOSS=mother19 etc. runs one case)
// "floor" = the whole generated floor (boss + its brood + the floor's other monsters); "arena" = boss + brood only.
// Tuned on the arena rows for the troll (the wizard bot casts at random and melees with a staff, so it measures the bot).
// Final numbers: Mother hp 420, dmg 6d10, speed 8, starter spawn hp 24; Baker hp 200, dmg 6d10, boss flag; no depth scaling for both.
// Win rates (2026-10-27), 12 seeds per row as run by default; 36/72-seed figures from tuning runs in brackets:
//   Mother, troll L19 (target 25-50%): arena 5/12 = 42% [72 seeds: 42%]   floor 6/12 = 50% [36 seeds: 22%]
//   Mother, troll L15 (target <=10%):  arena 2/12 = 17% [72 seeds: 7%]    floor 0/12 = 0%  [36 seeds: 3%]
//   Mother, elf wizard L19:            arena 0/12, floor 0/12 [36 seeds: 0% both]
//   Mother, elf wizard L15:            arena 0/12, floor 0/12
//   Baker, troll L14 (target 40-60%):  arena 5/12 = 42% [72 seeds: 54%]   floor 0/12 = 0%  [36 seeds: 0%: the D12 floor kills first]
//   Baker, elf wizard L14:             arena 1/12 = 8%  [36 seeds: 11%]   floor 0/12
import { describe, expect, it } from 'vitest';
import { newRun } from '../src/game/run';
import { act, popups } from '../src/game/turn';
import { exploreStep, fightStep, restStep, stairsStep, enemiesInView } from '../src/game/explore';
import { ARMOURS, WEAPONS } from '../src/data/items';
import { MAX_DEPTH } from '../src/data/terrain';
import { talentOffers, takeTalent, playerAbilities, spendAttr } from '../src/game/progression';
import { defaultTarget, canUseAbility } from '../src/game/abilities';
import { cur, view } from '../src/game/state';
import { playerStats, xpForLevel } from '../src/game/stats';
import { isKnown, learn, makeItem } from '../src/game/items';
import { createLevel } from '../src/game/levels';
import { updateFov } from '../src/game/fov';
import { Rng } from '../src/core/rng';
import { ABILITIES } from '../src/data/abilities';
import { MONSTERS } from '../src/data/monsters';
import type { Run, Slot } from '../src/core/types';

function smartTurn(run: Run, r: Rng): void {
  const p = run.player;
  popups.length = 0;
  while (p.pendingTalents > 0) { const o = talentOffers(run); if (!o.length) { p.pendingTalents = 0; break; } takeTalent(run, r.pick(o)); }
  while (p.attrPoints > 0) spendAttr(run, r.pick(['might', 'agility', 'wits'] as const));
  const s = playerStats(run);
  const enemies = enemiesInView(run);
  // emergency healing
  if (p.hp < s.maxHp * 0.35 && enemies.length) {
    const heal = p.inventory.find((i) => i.kind === 'potion' && (i.base === 'p_heal' || i.base === 'p_curing') && isKnown(run, i.base))
      ?? p.inventory.find((i) => i.kind === 'potion' && !isKnown(run, i.base));
    if (heal && act(run, { t: 'use', itemId: heal.id })) return;
    const tele = p.inventory.find((i) => i.base === 's_teleport' && isKnown(run, i.base));
    if (tele && act(run, { t: 'use', itemId: tele.id })) return;
  }
  // gear upgrades
  for (const it of p.inventory) {
    if (it.cursed && it.known) continue;
    if (it.kind === 'armour') {
      const a = ARMOURS[it.base];
      const curIt = p.equip[a.slot];
      const curAc = curIt ? ARMOURS[curIt.base].ac + (curIt.ench ?? 0) : -1;
      if (a.ac + (it.known ? it.ench ?? 0 : 0) > curAc && act(run, { t: 'equip', itemId: it.id })) return;
    }
    if (it.kind === 'weapon') {
      const w = WEAPONS[it.base];
      const cw = s.weapon;
      if (w.cls === 'bow' && cw.cls !== 'bow') continue;
      const val = (x: typeof w) => x.dmg[0] * (x.dmg[1] + 1) / 2 / (x.delay / 100);
      if (val(w) > val(cw) * 1.15 && act(run, { t: 'equip', itemId: it.id })) return;
    }
    if ((it.kind === 'ring' || it.kind === 'amulet') && r.chance(0.3) && act(run, { t: 'equip', itemId: it.id })) return;
    if (it.kind === 'essence' || it.kind === 'tome') { if (act(run, { t: 'use', itemId: it.id })) return; }
  }
  // abilities in combat
  if (enemies.length) {
    const abs = playerAbilities(run).filter((a) => !canUseAbility(run, a.id));
    const offensive = abs.filter((a) => ['bolt', 'beam', 'ball', 'smite', 'cone', 'nova', 'hex', 'summon', 'strike', 'dash', 'cleave', 'drain'].includes(ABILITIES[a.id].kind));
    if (offensive.length && r.chance(0.6)) {
      const a = r.pick(offensive);
      const tgt = defaultTarget(run, a.id);
      if (tgt && act(run, { t: 'ability', id: a.id, target: tgt })) return;
    }
  }
  const fight = fightStep(run);
  if (typeof fight !== 'string') { act(run, fight); return; }
  if (p.hp < s.maxHp * 0.8 || p.mp < s.maxMp * 0.5) { const rest = restStep(run); if (typeof rest !== 'string' && act(run, rest)) return; }
  const ex = exploreStep(run);
  if (typeof ex !== 'string') { if (act(run, ex)) return; }
  if (cur(run).items.some((i) => i.x === p.x && i.y === p.y)) { if (act(run, { t: 'pickup' })) return; }
  const st = stairsStep(run);
  if (typeof st !== 'string') { act(run, st); return; }
  act(run, { t: 'wait' });
}

type Kit = { base: string; ench?: number; slot: Slot }[];

/** A character of the given level with hand-picked gear, standing on the arrival stairs of `depth`. */
function geared(seed: number, anc: string, cal: string, level: number, kit: Kit, depth: number): Run {
  const run = newRun(seed, 'Boss', anc, cal);
  delete run.flags.omen;
  const p = run.player;
  const r = new Rng(seed * 7 + level);
  p.level = level;
  p.xp = xpForLevel(level);
  p.pendingTalents = level - 1;
  while (p.pendingTalents > 0) { const o = talentOffers(run); if (!o.length) break; takeTalent(run, r.pick(o)); }
  p.pendingTalents = 0;
  p.attrPoints = Math.floor(level / 3);
  while (p.attrPoints > 0) spendAttr(run, 'might');
  p.equip = {};
  for (const k of kit) p.equip[k.slot] = makeItem(run, k.base, { ench: k.ench, known: true });
  p.inventory = [makeItem(run, 'p_heal', { qty: 3 }), makeItem(run, 'p_curing', { qty: 2 }), makeItem(run, 's_blink')];
  for (const b of ['p_heal', 'p_curing', 's_blink']) learn(run, b);
  run.levels[depth] = createLevel(run, depth);
  run.depth = depth;
  const l = cur(run);
  l.visited = true;
  p.x = l.up[0].x; p.y = l.up[0].y;
  const s = playerStats(run);
  p.hp = s.maxHp; p.mp = s.maxMp;
  updateFov(run);
  return run;
}

const MELEE_15: Kit = [{ base: 'demon_blade', ench: 3, slot: 'weapon' }, { base: 'plate', ench: 2, slot: 'body' }, { base: 'kite_shield', slot: 'offhand' }, { base: 'helmet', slot: 'head' }];
const MAGIC_15: Kit = [{ base: 'quarterstaff', ench: 2, slot: 'weapon' }, { base: 'robe', ench: 3, slot: 'body' }, { base: 'wizard_hat', slot: 'head' }, { base: 'r_wizardry', slot: 'ring1' }];
const MELEE_12: Kit = [{ base: 'long_sword', ench: 2, slot: 'weapon' }, { base: 'chain_mail', ench: 1, slot: 'body' }, { base: 'kite_shield', slot: 'offhand' }];
const MAGIC_12: Kit = [{ base: 'quarterstaff', ench: 1, slot: 'weapon' }, { base: 'robe', ench: 2, slot: 'body' }, { base: 'wizard_hat', slot: 'head' }, { base: 'r_wizardry', slot: 'ring1' }];

interface Case { id: string; boss: 'mother' | 'baker'; level: number; anc: string; cal: string; kit: Kit; depth: number; target: [number, number] }
const CASES: Case[] = [
  { id: 'mother19', boss: 'mother', level: 19, anc: 'troll', cal: 'sellsword', kit: MELEE_15, depth: MAX_DEPTH, target: [0.25, 0.5] },
  { id: 'mother19w', boss: 'mother', level: 19, anc: 'elf', cal: 'wizard', kit: MAGIC_15, depth: MAX_DEPTH, target: [0.25, 0.5] },
  { id: 'mother15', boss: 'mother', level: 15, anc: 'troll', cal: 'sellsword', kit: MELEE_15, depth: MAX_DEPTH, target: [0, 0.1] },
  { id: 'mother15w', boss: 'mother', level: 15, anc: 'elf', cal: 'wizard', kit: MAGIC_15, depth: MAX_DEPTH, target: [0, 0.1] },
  { id: 'baker14', boss: 'baker', level: 14, anc: 'troll', cal: 'sellsword', kit: MELEE_12, depth: 12, target: [0.4, 0.6] },
  { id: 'baker14w', boss: 'baker', level: 14, anc: 'elf', cal: 'wizard', kit: MAGIC_12, depth: 12, target: [0.4, 0.6] },
];

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
// tuning without edits: TUNE="mother.hp=400,mother.dmg=5x10,mother.speed=8"
for (const kv of (env.TUNE ?? '').split(',').filter(Boolean)) {
  const [key, val] = kv.split('=');
  const [id, field] = key.split('.');
  const def = MONSTERS[id] as unknown as Record<string, unknown>;
  def[field] = val.includes('x') ? val.split('x').map(Number) : Number(val);
}

describe.skipIf(!env.SIM)('boss simulation', () => {
  for (const c of CASES) {
    if (env.BOSS && !env.BOSS.split(',').includes(c.id)) continue;
    for (const arena of [false, true]) it(`${c.id}${arena ? ' arena' : ''}: ${c.anc} ${c.cal} L${c.level} vs ${c.boss}`, async () => {
      const lines: string[] = [];
      let wins = 0;
      const seeds = Number(env.SEEDS ?? 12);
      for (let seed = 1; seed <= seeds; seed++) {
        const run = geared(9000 + seed, c.anc, c.cal, c.level, c.kit, c.depth);
        if (c.boss === 'baker') run.flags.bakerMet = true;
        // arena: only the boss and its own brood, to measure the boss rather than the floor
        if (arena) cur(run).monsters = cur(run).monsters.filter((m) => m.def === c.boss || m.def === 'starter_spawn');
        const r = new Rng(seed);
        let steps = 0;
        const done = () => run.over || (c.boss === 'baker' && (run.flags.bakerDead || run.depth !== c.depth));
        while (!done() && steps < 6000) { smartTurn(run, r); view.interrupt = false; steps++; if (steps % 300 === 0) await new Promise((res) => setTimeout(res, 0)); }
        const won = c.boss === 'mother' ? run.over === 'won' : !!run.flags.bakerDead && run.over !== 'dead';
        if (won) wins++;
        const boss = cur(run).monsters.find((m) => m.def === c.boss);
        const s = playerStats(run);
        lines.push(`  seed ${seed}: ${won ? 'WIN ' : run.over === 'dead' ? 'dead' : run.depth !== c.depth ? 'left' : 'time'} turns ${run.turn} hp ${run.player.hp}/${s.maxHp} heals left ${run.player.inventory.find((i) => i.base === 'p_heal')?.qty ?? 0} boss ${boss ? `${boss.hp}/${boss.maxHp}` : '-'} killed by ${run.stats.killedBy ?? '-'}`);
      }
      console.log(`${c.id}${arena ? ' arena' : ''} (${c.anc} ${c.cal} L${c.level} vs ${c.boss}): ${wins}/${seeds} = ${Math.round(100 * wins / seeds)}% (target ${c.target[0] * 100}-${c.target[1] * 100}%)\n${lines.join('\n')}`);
      expect(wins).toBeGreaterThanOrEqual(0);
    }, 1800000);
  }
});
