// Balance simulation (slow, local only): SIM=1 npx vitest run sim
import { describe, expect, it } from 'vitest';
import { newRun } from '../src/game/run';
import { act, popups } from '../src/game/turn';
import { exploreStep, fightStep, restStep, stairsStep, enemiesInView } from '../src/game/explore';
import { ANCESTRIES, CALLINGS } from '../src/data/characters';
import { ARMOURS, WEAPONS } from '../src/data/items';
import { talentOffers, takeTalent, playerAbilities, spendAttr } from '../src/game/progression';
import { defaultTarget, canUseAbility } from '../src/game/abilities';
import { cur, view } from '../src/game/state';
import { playerStats } from '../src/game/stats';
import { isKnown } from '../src/game/items';
import { Rng } from '../src/core/rng';
import { ABILITIES } from '../src/data/abilities';
import type { Run } from '../src/core/types';

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
  if (p.hp < s.maxHp * 0.8 || p.mp < s.maxMp * 0.5) { const rest = restStep(run); if (typeof rest !== 'string') { act(run, rest); return; } }
  const ex = exploreStep(run);
  if (typeof ex !== 'string') { if (act(run, ex)) return; }
  if (cur(run).items.some((i) => i.x === p.x && i.y === p.y)) { if (act(run, { t: 'pickup' })) return; }
  const st = stairsStep(run);
  if (typeof st !== 'string') { act(run, st); return; }
  act(run, { t: 'wait' });
}

describe.skipIf(!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SIM)('balance simulation', () => {
  it('plays many characters without cheating', async () => {
    const results: string[] = [];
    let n = 0;
    for (const anc of ANCESTRIES) for (const cal of CALLINGS) {
      if ((n++) % 4 !== 0) continue;
      const run = newRun(5000 + n, 'Sim', anc.id, cal.id);
      const r = new Rng(n);
      let steps = 0;
      while (!run.over && steps < 30000) { smartTurn(run, r); view.interrupt = false; steps++; if (steps % 300 === 0) await new Promise((res) => setTimeout(res, 0)); }
      results.push(`${anc.name.padEnd(9)} ${cal.name.padEnd(16)} ${run.over ?? 'timeout'} D${run.depth} L${run.player.level} turns ${run.turn} killed by ${run.stats.killedBy ?? '-'}`);
    }
    console.log(results.join('\n'));
    expect(results.length).toBeGreaterThan(0);
  }, 1800000);

  it('a god-mode bot can reach the bottom and win', async () => {
    const run = newRun(77, 'God', 'troll', 'sellsword');
    run.flags.godmode = true;
    const r = new Rng(3);
    let steps = 0;
    while (!run.over && steps < 60000) { smartTurn(run, r); view.interrupt = false; steps++; if (steps % 300 === 0) await new Promise((res) => setTimeout(res, 0)); }
    console.log('god run', run.over, 'depth', run.depth, 'level', run.player.level, 'turns', run.turn);
    expect(run.over).toBe('won');
  }, 1800000);
});
