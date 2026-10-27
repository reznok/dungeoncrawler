import type { Attr, Run } from '../core/types';
import { TALENTS, TIER_REQ, type TalentDef } from '../data/talents';
import { MUTATIONS, MUTATION_SLOTS } from '../data/mutations';
import { ABILITIES } from '../data/abilities';
import { msg, rng } from './state';
import { playerStats, xpForLevel, callingOf, ancestryOf } from './stats';
import { pushFx } from './fx';

export const MAX_LEVEL = 27;

export function gainXp(run: Run, amount: number) {
  const p = run.player;
  const s = playerStats(run);
  amount = Math.round(amount * (1 + s.xpPct / 100));
  if (amount <= 0 || p.level >= MAX_LEVEL) return;
  p.xp += amount;
  while (p.level < MAX_LEVEL && p.xp >= xpForLevel(p.level + 1)) levelUp(run);
}

export function levelUp(run: Run) {
  const p = run.player;
  const before = playerStats(run);
  p.level++;
  p.pendingTalents++;
  if (p.level % 3 === 0) p.attrPoints++;
  const after = playerStats(run);
  p.hp = Math.min(after.maxHp, p.hp + (after.maxHp - before.maxHp) + Math.round(after.maxHp * 0.15));
  p.mp = Math.min(after.maxMp, p.mp + (after.maxMp - before.maxMp) + Math.round(after.maxMp * 0.2));
  msg(run, `Welcome to level ${p.level}! Choose a new talent.`, 'good');
  pushFx({ kind: 'num', at: { x: p.x, y: p.y }, text: 'LEVEL UP!', color: '#ffe066', depth: run.depth });
}

export function discRank(run: Run, disc: string): number {
  let n = 0;
  for (const [id, r] of Object.entries(run.player.talents)) if (TALENTS[id]?.disc === disc) n += r;
  return n;
}

export function canTake(run: Run, t: TalentDef): boolean {
  const cur = run.player.talents[t.id] ?? 0;
  if (cur >= t.max) return false;
  return discRank(run, t.disc) >= TIER_REQ[t.tier];
}

/** Rolls level-up talent offers (saved on the player so reloading cannot reroll them). */
export function talentOffers(run: Run): string[] {
  const p = run.player;
  if (p.offers?.length) return p.offers;
  const r = rng(run);
  const s = playerStats(run);
  const n = s.flags.has('extra_offer') ? 4 : 3;
  const affinity = new Set([...callingOf(p).disciplines, ...p.disciplines]);
  const avail = Object.values(TALENTS).filter((t) => canTake(run, t));
  const offers: string[] = [];
  const pickFrom = (pool: TalentDef[]) => {
    const cands = pool.filter((t) => !offers.includes(t.id));
    const t = r.weighted(cands, (t) => {
      let w = affinity.has(t.disc) ? 10 : 1;
      if (p.talents[t.id]) w *= 1.6; // ranking up what you have is likely
      if (t.tier > 1) w *= 1.3;
      return w;
    });
    if (t) offers.push(t.id);
  };
  for (let i = 0; i < n - 1; i++) pickFrom(avail);
  // wildcard from outside your affinities
  pickFrom(avail.filter((t) => !affinity.has(t.disc)));
  while (offers.length < n && offers.length < avail.length) pickFrom(avail);
  p.offers = offers;
  return offers;
}

export function takeTalent(run: Run, id: string) {
  const p = run.player;
  const t = TALENTS[id];
  if (!t || p.pendingTalents <= 0) return;
  const before = playerStats(run);
  p.talents[id] = (p.talents[id] ?? 0) + 1;
  p.pendingTalents--;
  p.offers = undefined;
  const after = playerStats(run);
  if (after.maxHp > before.maxHp) p.hp += after.maxHp - before.maxHp;
  if (after.maxMp > before.maxMp) p.mp += after.maxMp - before.maxMp;
  msg(run, `You learn ${t.name}${p.talents[id] > 1 ? ` (rank ${p.talents[id]})` : ''}.`, 'good');
  if (t.ability) autoQuickSlot(run, 'a:' + t.ability);
}

export function spendAttr(run: Run, a: Attr) {
  const p = run.player;
  if (p.attrPoints <= 0) return;
  const before = playerStats(run);
  p.attrs[a]++;
  p.attrPoints--;
  const after = playerStats(run);
  p.hp += Math.max(0, after.maxHp - before.maxHp);
  p.mp += Math.max(0, after.maxMp - before.maxMp);
}

export function autoQuickSlot(run: Run, key: string) {
  const q = run.player.quick;
  if (q.includes(key)) return;
  const i = q.indexOf(null);
  if (i >= 0) q[i] = key;
}

/** All abilities the player can use, with rank (power). */
export function playerAbilities(run: Run): { id: string; rank: number; source: string }[] {
  const p = run.player;
  const out = new Map<string, { id: string; rank: number; source: string }>();
  const add = (id: string, rank: number, source: string) => {
    if (!ABILITIES[id]) return;
    const o = out.get(id);
    if (!o || o.rank < rank) out.set(id, { id, rank, source });
  };
  for (const [tid, r] of Object.entries(p.talents)) { const t = TALENTS[tid]; if (t?.ability && r > 0) add(t.ability, r, t.name); }
  for (const a of ancestryOf(p).abilities ?? []) add(a, 1, ancestryOf(p).name);
  for (const mid of p.mutations) { const m = MUTATIONS[mid]; if (m?.ability) add(m.ability, 1, m.name); }
  for (const it of Object.values(p.equip)) {
    if (!it) continue;
    if (it.base === 'a_rage') add('berserk', 1, 'amulet');
  }
  return [...out.values()];
}

export function gainMutation(run: Run, family?: string): string | null {
  const p = run.player;
  const r = rng(run);
  const pool = Object.values(MUTATIONS).filter((m) => (!family || m.family === family) && !p.mutations.includes(m.id));
  if (!pool.length) { msg(run, 'Nothing happens. You have absorbed all this essence can teach.', 'dim'); return null; }
  const m = r.pick(pool);
  const before = playerStats(run);
  if (p.mutations.length >= MUTATION_SLOTS) {
    const lost = r.pick(p.mutations);
    p.mutations = p.mutations.filter((x) => x !== lost);
    msg(run, `Your ${MUTATIONS[lost].name.toLowerCase()} withers away to make room.`, 'warn');
  }
  p.mutations.push(m.id);
  const after = playerStats(run);
  if (after.maxHp > before.maxHp) p.hp += after.maxHp - before.maxHp;
  p.hp = Math.min(p.hp, after.maxHp);
  msg(run, `You mutate: ${m.name}! ${m.desc}`, m.bad ? 'warn' : 'good');
  if (m.ability) autoQuickSlot(run, 'a:' + m.ability);
  if (m.mods?.flags?.includes('no_helmet') && p.equip.head) {
    const it = p.equip.head;
    delete p.equip.head;
    p.inventory.push(it);
    msg(run, 'Your helmet no longer fits. You take it off.', 'warn');
  }
  return m.id;
}
