import { describe, expect, it } from 'vitest';
import { newRun } from '../src/game/run';
import { cur } from '../src/game/state';
import { spawnMonster } from '../src/game/monsters';
import { threat } from '../src/game/combat';

describe('threat labels', () => {
  const run = newRun(1, 'T', 'human', 'sellsword');
  const at = { x: run.player.x + 1, y: run.player.y };
  it('a cellar rat is no threat to a fresh sellsword', () => {
    const rat = spawnMonster(run, cur(run), 'rat', at.x, at.y)!;
    expect(['trivial', 'easy']).toContain(threat(run, rat));
  });
  it('Mother is nasty for a fresh sellsword', () => {
    const mother = spawnMonster(run, cur(run), 'mother', at.x, at.y)!;
    expect(threat(run, mother)).toBe('nasty');
  });
});
