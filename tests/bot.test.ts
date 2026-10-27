import { describe, expect, it } from 'vitest';
import { newRun } from '../src/game/run';
import { act, popups, type Action } from '../src/game/turn';
import { exploreStep, fightStep, restStep, stairsStep } from '../src/game/explore';
import { ANCESTRIES, CALLINGS } from '../src/data/characters';
import { talentOffers, takeTalent, playerAbilities, spendAttr } from '../src/game/progression';
import { defaultTarget } from '../src/game/abilities';
import { cur, view } from '../src/game/state';
import { playerStats } from '../src/game/stats';
import { Rng } from '../src/core/rng';
import type { Run } from '../src/core/types';

/** A simple bot: fights, explores, rests, descends, uses items and abilities. */
function botTurn(run: Run, r: Rng): boolean {
  const p = run.player;
  popups.length = 0;
  while (p.pendingTalents > 0) { const o = talentOffers(run); if (!o.length) { p.pendingTalents = 0; break; } takeTalent(run, r.pick(o)); }
  while (p.attrPoints > 0) spendAttr(run, r.pick(['might', 'agility', 'wits'] as const));
  const s = playerStats(run);
  // use stuff sometimes
  if (r.chance(0.08) && p.inventory.length) {
    const it = r.pick(p.inventory);
    if (it.kind === 'weapon' || it.kind === 'armour' || it.kind === 'ring' || it.kind === 'amulet') return act(run, { t: 'equip', itemId: it.id });
    const tgt = defaultTarget(run, 'firebolt') ?? { x: p.x + 1, y: p.y };
    if (act(run, { t: 'use', itemId: it.id, target: tgt })) return true;
  }
  const abs = playerAbilities(run);
  if (abs.length && r.chance(0.25)) {
    const ab = r.pick(abs);
    const tgt = defaultTarget(run, ab.id);
    if (tgt && act(run, { t: 'ability', id: ab.id, target: tgt })) return true;
  }
  const fight = fightStep(run);
  if (typeof fight !== 'string') return act(run, fight);
  if (p.hp < s.maxHp * 0.7) { const rest = restStep(run); if (typeof rest !== 'string') return act(run, rest); }
  const ex = exploreStep(run);
  if (typeof ex !== 'string') { if (act(run, ex)) return true; }
  const here = cur(run).items.some((i) => i.x === p.x && i.y === p.y);
  if (here) act(run, { t: 'pickup' });
  const st = stairsStep(run);
  if (typeof st !== 'string') return act(run, st);
  const d: Action = { t: 'move', dx: r.int(-1, 1), dy: r.int(-1, 1) };
  if (!act(run, d)) return act(run, { t: 'wait' });
  return true;
}

describe('headless bot', () => {
  for (let i = 0; i < CALLINGS.length; i++) {
    const cal = CALLINGS[i];
    const anc = ANCESTRIES[i % ANCESTRIES.length];
    it(`plays a ${anc.name} ${cal.name} without crashing`, async () => {
      const run = newRun(1000 + i, 'Bot', anc.id, cal.id);
      const r = new Rng(77 + i);
      run.flags.godmode = true;
      let steps = 0;
      while (!run.over && steps < 2500) {
        if (steps % 100 === 0) await new Promise((res) => setTimeout(res, 0)); // let the test runner breathe
        botTurn(run, r);
        steps++;
        view.interrupt = false;
        // god mode for coverage: keep the bot alive so it reaches deep levels
        if (run.player.hp < 5 && !run.over) run.player.hp = playerStats(run).maxHp;
      }
      expect(run.player.level).toBeGreaterThan(1);
      expect(run.stats.deepest).toBeGreaterThan(1);
      // the run must be JSON-serialisable
      const json = JSON.stringify(run);
      expect(JSON.parse(json).player.name).toBe('Bot');
    }, 180000);
  }
});
