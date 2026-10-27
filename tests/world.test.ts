import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateMap } from '../src/world/gen';
import { distanceMap, UNREACHED } from '../src/world/path';
import { themeForDepth, walkable, T, MAX_DEPTH } from '../src/data/terrain';
import { newRun } from '../src/game/run';
import { createLevel } from '../src/game/levels';
import { MONSTERS } from '../src/data/monsters';
import { ABILITIES } from '../src/data/abilities';
import { TALENTS } from '../src/data/talents';
import { MUTATIONS } from '../src/data/mutations';
import { CALLINGS } from '../src/data/characters';
import { CONSUMABLES, WEAPONS, ARMOURS } from '../src/data/items';
import atlas from '../src/generated/atlas.json';

describe('rng', () => {
  it('is deterministic and serialisable', () => {
    const a = new Rng(42);
    const seq = [a.next(), a.next(), a.next()];
    const b = new Rng(42);
    expect([b.next(), b.next(), b.next()]).toEqual(seq);
    const c = new Rng(JSON.parse(JSON.stringify(a.s)));
    expect(c.next()).toBe(a.next());
  });
});

describe('level generation', () => {
  it('every stair is reachable from the arrival stairs on every depth', () => {
    for (let seed = 1; seed <= 12; seed++) {
      for (let depth = 1; depth <= MAX_DEPTH; depth++) {
        const g = generateMap(new Rng(seed * 100 + depth), depth, themeForDepth(depth));
        const d = distanceMap(g.w, g.h, g.up, (x, y) => walkable(g.tiles[y * g.w + x]));
        for (const s of g.down) expect(d[s.y * g.w + s.x]).toBeLessThan(UNREACHED);
        if (depth < MAX_DEPTH) expect(g.down.length).toBeGreaterThan(0);
        expect(g.tiles[g.up[0].y * g.w + g.up[0].x]).toBe(depth === 1 ? T.EXIT : T.UP);
      }
    }
  });

  it('creates the final floor with Mother on it', () => {
    const run = newRun(5, 'T', 'human', 'sellsword');
    const l = createLevel(run, MAX_DEPTH);
    expect(l.monsters.some((m) => m.def === 'mother')).toBe(true);
    expect(l.down.length).toBe(0);
  });
});

describe('data integrity', () => {
  const tiles = atlas as Record<string, unknown>;
  it('every monster has a tile and valid abilities', () => {
    for (const m of Object.values(MONSTERS)) {
      expect(tiles[m.tile], `${m.id} tile ${m.tile}`).toBeTruthy();
      for (const a of m.abilities ?? []) expect(ABILITIES[a.id], `${m.id} ability ${a.id}`).toBeTruthy();
      if (m.followers) expect(MONSTERS[m.followers.id]).toBeTruthy();
    }
  });
  it('abilities, talents and mutations reference real things', () => {
    for (const a of Object.values(ABILITIES)) {
      expect(tiles[a.icon], `${a.id} icon ${a.icon}`).toBeTruthy();
      if (a.summon) expect(MONSTERS[a.summon], `${a.id} summon`).toBeTruthy();
    }
    for (const t of Object.values(TALENTS)) if (t.ability) expect(ABILITIES[t.ability], `${t.id}`).toBeTruthy();
    for (const m of Object.values(MUTATIONS)) { expect(tiles[m.icon], `${m.id} icon`).toBeTruthy(); if (m.ability) expect(ABILITIES[m.ability]).toBeTruthy(); }
    for (const c of Object.values(CONSUMABLES)) if (c.ability && !['polymorph', 'dig', 'random'].includes(c.ability)) expect(ABILITIES[c.ability], c.id).toBeTruthy();
  });
  it('callings start with real talents and items', () => {
    for (const c of CALLINGS) {
      for (const t of c.talents) expect(TALENTS[t], `${c.id} ${t}`).toBeTruthy();
      for (const k of c.kit) expect(WEAPONS[k.base] || ARMOURS[k.base] || CONSUMABLES[k.base], `${c.id} ${k.base}`).toBeTruthy();
    }
  });
  it('item tiles exist', () => {
    for (const w of Object.values(WEAPONS)) expect(tiles[w.tile], w.id).toBeTruthy();
    for (const a of Object.values(ARMOURS)) { expect(tiles[a.tile], a.id).toBeTruthy(); if (a.doll) expect(tiles[a.doll], a.id + ' doll').toBeTruthy(); }
  });
});

describe('rules', () => {
  it('an adjacent awake monster follows you down the stairs', async () => {
    const { act } = await import('../src/game/turn');
    const { spawnMonster } = await import('../src/game/monsters');
    const { nearestFree } = await import('../src/game/state');
    const run = newRun(11, 'Stairs', 'human', 'sellsword');
    const l = run.levels[1];
    run.player.x = l.down[0].x; run.player.y = l.down[0].y;
    const at = nearestFree(run, l, l.down[0], (x, y) => walkable(l.tiles[y * l.w + x]) && (x !== l.down[0].x || y !== l.down[0].y), 1)!;
    const j = spawnMonster(run, l, 'jackal', at.x, at.y, { awake: true })!;
    expect(act(run, { t: 'stairs' })).toBe(true);
    expect(run.depth).toBe(2);
    expect(run.levels[2].monsters).toContain(j);
    expect(run.levels[1].monsters).not.toContain(j);
    expect(Math.max(Math.abs(j.x - run.player.x), Math.abs(j.y - run.player.y))).toBeLessThanOrEqual(3);
  });

  it('ranged monsters keep their distance, bosses and brutes do not', async () => {
    const { isSkirmisher } = await import('../src/game/monsters');
    expect(isSkirmisher(MONSTERS.goblin)).toBe(true);
    expect(isSkirmisher(MONSTERS.salamander_mystic)).toBe(true);
    expect(isSkirmisher(MONSTERS.rat)).toBe(false);
    expect(isSkirmisher(MONSTERS.baker)).toBe(false);
    expect(isSkirmisher(MONSTERS.acid_blob)).toBe(false);
  });

  it('a bazaar has three different shops', () => {
    let found = 0;
    for (let seed = 1; seed <= 60 && found < 3; seed++) {
      const run = newRun(seed, 'B', 'human', 'sellsword');
      const l = createLevel(run, 7);
      if (l.event !== 'bazaar') continue;
      found++;
      const shops = l.features.filter((f) => f.kind === 'shop');
      expect(shops.length).toBe(3);
      expect(new Set(shops.map((f) => f.id)).size).toBe(3);
      expect(l.feeling).toMatch(/haggling/);
    }
    expect(found).toBeGreaterThan(0);
  });
});

describe('saves', () => {
  it('round-trips a run through JSON and keeps playing', async () => {
    const { act } = await import('../src/game/turn');
    const run = newRun(9, 'Saver', 'troll', 'brawler');
    for (let i = 0; i < 20; i++) act(run, { t: 'wait' });
    const copy = JSON.parse(JSON.stringify(run));
    expect(copy.player.name).toBe('Saver');
    expect(copy.turn).toBe(run.turn);
    for (let i = 0; i < 20; i++) act(copy, { t: 'wait' });
    expect(copy.turn).toBeGreaterThan(run.turn);
  });
});
