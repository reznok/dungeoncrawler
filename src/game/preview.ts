import type { Monster, Run } from '../core/types';
import { MONSTERS } from '../data/monsters';
import { ABILITIES } from '../data/abilities';
import { STATUSES } from '../data/statuses';
import { chanceToHit, monsterEv } from './combat';
import { isSkirmisher } from './monsters';
import { playerStats } from './stats';

export interface FightPreview { youHit: number; itHits: number; itsDamage: number; speed: 'fast' | 'slow' | 'normal'; specials: string[] }

const pretty = (id: string) => id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** Rough odds for the examine panel: hit chances in %, average damage per hit after armour, speed and special attacks. */
export function previewFight(run: Run, m: Monster): FightPreview {
  const def = MONSTERS[m.def];
  const s = playerStats(run);
  const mEv = monsterEv(run, m);
  const mAcc = def.acc ?? Math.round(7 + def.level * 1.3);
  const pEv = run.player.statuses.paralysed || run.player.statuses.asleep ? 0 : s.ev;
  const [n, sides] = def.dmg;
  let avg = n * (sides + 1) / 2 + (m.bonus ?? 0);
  if (m.statuses.weak) avg *= 0.7;
  if (m.statuses.risen) avg += m.statuses.risen.power ?? 4;
  if (m.statuses.berserk) avg *= 1.5;
  const speed = def.speed ?? 10;
  const specials: string[] = [];
  for (const a of def.abilities ?? []) { const nm = ABILITIES[a.id]?.name ?? pretty(a.id); if (!specials.includes(nm)) specials.push(nm); }
  if (def.hit) specials.push(`${STATUSES[def.hit.status]?.name ?? pretty(def.hit.status)} on hit`);
  if (isSkirmisher(def)) specials.push('keeps its distance');
  return {
    youHit: Math.round(100 * chanceToHit(s.acc, mEv)),
    itHits: Math.round(100 * chanceToHit(mAcc, pEv)),
    itsDamage: Math.max(1, Math.round(avg - s.ac / 2)),
    speed: speed > 10 ? 'fast' : speed < 10 ? 'slow' : 'normal',
    specials,
  };
}
