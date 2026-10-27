import type { Attr, Item, Monster, Slot } from '../core/types';
import { dist, type Pos } from '../core/geom';
import { ABILITIES } from '../data/abilities';
import { ARMOURS, ARMOUR_EGOS, CONSUMABLES, JEWELS, WEAPONS, WEAPON_EGOS } from '../data/items';
import { MONSTERS } from '../data/monsters';
import { MUTATIONS, MUTATION_SLOTS } from '../data/mutations';
import { STATUSES } from '../data/statuses';
import { DISCIPLINES, TALENTS } from '../data/talents';
import { TERRAIN, T } from '../data/terrain';
import { cur, isVisible } from '../game/state';
import { abilityCost, canUseAbility } from '../game/abilities';
import { isEquipment, isKnown, itemName, itemTile, itemPrice } from '../game/items';
import { playerAbilities, spendAttr, takeTalent, talentOffers } from '../game/progression';
import { ancestryOf, callingOf, playerStats, xpForLevel, RING_SLOTS } from '../game/stats';
import { threat } from '../game/combat';
import { SHRINES } from '../game/levels';
import { PATRONS } from '../data/patrons';
import { favorCost } from '../game/progression';
import { saveRun, deleteSave, saveSettings } from '../game/save';
import { esc, openPanel, toast } from './dom';
import { icon, stackIcon } from './tiles';
import { dollKeys } from './renderer';
import type { GameUI } from './game';

type Next = (() => void) | undefined;

// ------------------------------------------------------------------ descriptions

function itemInfo(ui: GameUI, it: Item): string {
  const run = ui.run;
  const lines: string[] = [];
  const known = isKnown(run, it.base);
  if (it.kind === 'weapon') {
    const w = WEAPONS[it.base];
    lines.push(`<p>${esc(w.desc)}</p><p>Damage ${w.dmg[0]}d${w.dmg[1]}, speed ${w.delay < 100 ? 'fast' : w.delay > 130 ? 'slow' : 'normal'} (${w.delay}), accuracy ${w.acc >= 0 ? '+' : ''}${w.acc}${w.twoHanded ? ', two-handed' : ''}${w.reach ? ', reach 2' : ''}${w.cls === 'bow' ? ', ranged' : ''}.</p>`);
    if (it.known && it.ego) lines.push(`<p class="props">${esc(WEAPON_EGOS[it.ego].name)}: ${esc(WEAPON_EGOS[it.ego].desc)}</p>`);
  } else if (it.kind === 'armour') {
    const a = ARMOURS[it.base];
    lines.push(`<p>${esc(a.desc)}</p><p>AC ${a.ac}${a.ev ? `, EV ${a.ev}` : ''}. Worn on: ${a.slot}.</p>`);
    if (it.known && it.ego) lines.push(`<p class="props">Of ${esc(ARMOUR_EGOS[it.ego].name)}.</p>`);
  } else if (it.kind === 'ring' || it.kind === 'amulet') {
    lines.push(known ? `<p>${esc(JEWELS[it.base].desc)}</p>` : '<p>You will learn what it does when you put it on.</p>');
  } else if (CONSUMABLES[it.base]) {
    lines.push(known ? `<p>${esc(CONSUMABLES[it.base].desc)}</p>` : `<p>You don't know what this ${it.kind} does. Try it and see!</p>`);
    if (it.kind === 'wand' && known) lines.push(`<p>Charges: ${it.charges}</p>`);
  } else if (it.kind === 'essence') lines.push(`<p>The distilled essence of a ${esc(it.family ?? '')} creature. Absorb it to gain a ${esc(it.family ?? '')} mutation (up to ${MUTATION_SLOTS}; more will replace an old one).</p>`);
  else if (it.kind === 'tome') lines.push(`<p>A tome of ${esc(DISCIPLINES[it.base.slice(5)]?.name ?? '')}. ${esc(DISCIPLINES[it.base.slice(5)]?.desc ?? '')} Reading it lets you learn from this discipline.</p>`);
  else if (it.kind === 'note') lines.push('<p>Something written by someone who was here before you.</p>');
  if (it.art?.desc && it.known) lines.unshift(`<p class="story">${esc(it.art.desc)}</p>`);
  if (it.art && it.known) lines.push(`<p class="props">${it.art.props.map((p) => esc(p.text)).join(' · ')}</p>`);
  if (it.cursed && it.known) lines.push('<p class="m-bad">Cursed: once worn, it will not come off.</p>');
  if (!it.known && isEquipment(it) && (it.kind === 'weapon' || it.kind === 'armour')) lines.push('<p class="m-dim">Its enchantment is unknown until you use it.</p>');
  return lines.join('');
}

function equippedSlot(ui: GameUI, it: Item): Slot | null {
  for (const [s, v] of Object.entries(ui.run.player.equip)) if (v === it) return s as Slot;
  return null;
}

// ------------------------------------------------------------------ inventory

export function inventory(ui: GameUI) {
  const run = ui.run;
  const p = run.player;
  const render = () => {
    const worn = Object.entries(p.equip).filter(([, v]) => v) as [Slot, Item][];
    const groups: Record<string, Item[]> = {};
    const order = ['weapon', 'armour', 'ring', 'amulet', 'potion', 'scroll', 'wand', 'essence', 'tome', 'note'];
    for (const it of p.inventory) (groups[it.kind] ??= []).push(it);
    let html = `<div class="list-h">Equipped · ${p.gold} gold</div>`;
    html += worn.length ? worn.map(([s, it]) => row(it, s)).join('') : '<div class="m-dim">Nothing. Bold.</div>';
    html += `<div class="list-h">Pack (${p.inventory.length}/26)</div>`;
    for (const k of order) if (groups[k]) html += groups[k].map((it) => row(it)).join('');
    if (!p.inventory.length) html += '<div class="m-dim">Your pack is empty.</div>';
    return html;
  };
  const row = (it: Item, slot?: string) => `<div class="item" data-id="${it.id}">${icon(itemTile(run, it), 34, it.id)}<div class="nm">${esc(itemName(run, it))}${slot ? ` <span class="eq">${slot.replace(/\d/, '')}</span>` : ''}</div></div>`;
  const pnl = openPanel(ui.root, 'Bag', render());
  pnl.body.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest('[data-id]')?.getAttribute('data-id');
    if (!id) return;
    const it = [...p.inventory, ...Object.values(p.equip)].find((x) => x?.id === +id);
    if (it) itemDetail(ui, it, () => { pnl.body.innerHTML = render(); });
  });
}

export function itemDetail(ui: GameUI, it: Item, onChange?: () => void) {
  const run = ui.run;
  const p = run.player;
  const slot = equippedSlot(ui, it);
  const btns: string[] = [];
  if (slot) btns.push('<button class="btn" data-do="remove">Remove</button>');
  else if (isEquipment(it)) btns.push(`<button class="btn primary" data-do="equip">${it.kind === 'weapon' ? 'Wield' : 'Wear'}</button>`);
  if (it.kind === 'potion') btns.push('<button class="btn primary" data-do="use">Drink</button>');
  if (it.kind === 'scroll' || it.kind === 'tome' || it.kind === 'note') btns.push('<button class="btn primary" data-do="use">Read</button>');
  if (it.kind === 'wand') btns.push('<button class="btn primary" data-do="use">Zap</button>');
  if (it.kind === 'essence') btns.push('<button class="btn primary" data-do="use">Absorb</button>');
  if (['potion', 'scroll', 'wand'].includes(it.kind)) btns.push('<button class="btn" data-do="quick">Quick slot</button>');
  if (!slot) btns.push('<button class="btn" data-do="drop">Drop</button>');
  const pnl = openPanel(ui.root, esc(itemName(run, it)), `<div class="detail"><div style="text-align:center">${icon(itemTile(run, it), 64, it.id)}</div>${itemInfo(ui, it)}<div class="btnrow">${btns.join('')}</div></div>`, { center: true });
  pnl.body.addEventListener('click', (e) => {
    const d = (e.target as HTMLElement).closest('[data-do]')?.getAttribute('data-do');
    if (!d) return;
    if (d === 'equip') { ui.doAct({ t: 'equip', itemId: it.id }); pnl.close(); onChange?.(); }
    if (d === 'remove' && slot) { ui.doAct({ t: 'unequip', slot }); pnl.close(); onChange?.(); }
    if (d === 'drop') { ui.doAct({ t: 'drop', itemId: it.id }); pnl.close(); onChange?.(); }
    if (d === 'quick') { const i = p.quick.indexOf(null); p.quick[i >= 0 ? i : p.quick.length - 1] = 'i:' + it.base; ui.refresh(); toast(ui.root, 'Added to quick bar'); }
    if (d === 'use') {
      pnl.close();
      document.querySelectorAll('.overlay').forEach((o) => o.remove());
      useItem(ui, it);
    }
  });
}

export function useItem(ui: GameUI, it: Item) {
  const run = ui.run;
  const p = run.player;
  if (isEquipment(it)) { if (equippedSlot(ui, it)) return; ui.doAct({ t: 'equip', itemId: it.id }); return; }
  if (it.kind === 'note') { ui.doAct({ t: 'use', itemId: it.id }); ui.showPopups(); return; }
  if (it.kind === 'wand') {
    const def = CONSUMABLES[it.base];
    const a = ABILITIES[def.ability ?? ''];
    const range = a?.range ?? 7;
    const initial = (() => { const ms = cur(run).monsters.filter((m) => !m.ally && !m.friendly && isVisible(run, m.x, m.y) && dist(m, p) <= range); ms.sort((x, y) => dist(x, p) - dist(y, p)); return ms[0] ? { x: ms[0].x, y: ms[0].y } : null; })();
    ui.startTarget({ label: 'Zap ' + itemName(run, it), range, initial, onPick: (pos) => ui.doAct({ t: 'use', itemId: it.id, target: pos }) });
    return;
  }
  if (it.kind === 'scroll' && it.base === 's_blink' && isKnown(run, it.base)) {
    ui.startTarget({ label: 'Blink where?', range: 7, initial: null, onPick: (pos) => ui.doAct({ t: 'use', itemId: it.id, target: pos }) });
    return;
  }
  if (it.kind === 'scroll' && it.base === 's_identify' && isKnown(run, it.base)) {
    const pool = [...p.inventory.filter((o) => o !== it && (!isKnown(run, o.base) || (isEquipment(o) && !o.known))), ...Object.values(p.equip).filter((o): o is Item => !!o && !o.known)];
    if (pool.length > 1) {
      const pnl = openPanel(ui.root, 'Identify what?', pool.map((o) => `<div class="item" data-id="${o.id}">${icon(itemTile(run, o), 32, o.id)}<div class="nm">${esc(itemName(run, o))}</div></div>`).join(''));
      pnl.body.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).closest('[data-id]')?.getAttribute('data-id');
        if (!id) return;
        pnl.close();
        ui.doAct({ t: 'use', itemId: it.id, extraId: +id });
      });
      return;
    }
  }
  if (it.kind === 'scroll' && it.base === 's_blink') {
    ui.startTarget({ label: 'Read the scroll... at where?', range: 7, initial: null, onPick: (pos) => ui.doAct({ t: 'use', itemId: it.id, target: pos }) });
    return;
  }
  ui.doAct({ t: 'use', itemId: it.id, target: { x: p.x, y: p.y } });
}

// ------------------------------------------------------------------ character

export function character(ui: GameUI) {
  const run = ui.run;
  const p = run.player;
  const render = () => {
    const s = playerStats(run);
    const anc = ancestryOf(p), cal = callingOf(p);
    const res = (n: number) => n >= 3 ? 'immune' : n > 0 ? '+'.repeat(n) : n < 0 ? 'weak' : '·';
    const talents = Object.entries(p.talents).filter(([, r]) => r > 0).map(([id, r]) => {
      const t = TALENTS[id];
      return `<div class="item" style="cursor:default">${icon(t.ability ? ABILITIES[t.ability]?.icon ?? DISCIPLINES[t.disc].icon : DISCIPLINES[t.disc].icon, 28)}<div class="nm">${esc(t.name)}${t.max > 1 ? ` <span class="sub">${r}/${t.max}</span>` : ''}<div class="sub">${esc(t.desc(r))}</div></div></div>`;
    }).join('');
    const muts = p.mutations.map((id) => { const m = MUTATIONS[id]; return `<div class="item" style="cursor:default">${icon(m.icon, 28)}<div class="nm">${esc(m.name)}<div class="sub">${esc(m.desc)}</div></div></div>`; }).join('');
    const attrRow = (a: Attr, label: string, desc: string) => `<div class="attr"><span class="nm"><b style="color:var(--gold)">${label}</b> ${s[a]} <span class="sub">${desc}</span></span>${p.attrPoints > 0 ? `<button class="btn small" data-attr="${a}">+1</button>` : ''}</div>`;
    return `
      <div style="display:flex;gap:12px;align-items:center">${stackIcon(dollKeys(run), 64)}<div><div style="font-size:20px;font-weight:700">${esc(p.name)}</div><div class="sub" style="color:var(--dim)">Level ${p.level} ${esc(anc.name)} ${esc(cal.name)}</div><div class="sub" style="color:var(--dim)">XP ${p.xp} / ${xpForLevel(p.level + 1)} · ${p.gold} gold</div></div></div>
      ${p.pendingTalents > 0 || p.attrPoints > 0 ? '<button class="btn primary" style="width:100%;margin-top:8px" data-lvl>Spend level-up points</button>' : ''}
      <div class="list-h">Attributes${p.attrPoints ? ` (${p.attrPoints} to spend)` : ''}</div>
      ${attrRow('might', 'Might', 'melee damage, health')}${attrRow('agility', 'Agility', 'accuracy, dodging, stealth')}${attrRow('wits', 'Wits', 'spell power, magic')}
      <div class="list-h">Stats</div>
      <div class="statgrid">
        <div>Health<b>${p.hp}/${s.maxHp}</b></div><div>Magic<b>${p.mp}/${s.maxMp}</b></div>
        <div>Armour (AC)<b>${s.ac}</b></div><div>Evasion (EV)<b>${s.ev}</b></div>
        <div>Accuracy<b>${s.acc}</b></div><div>Damage bonus<b>${s.dmg >= 0 ? '+' : ''}${s.dmg}${s.meleePct ? ` / +${s.meleePct}%` : ''}</b></div>
        <div>Spell power<b>${s.spellPower}</b></div><div>Stealth<b>${s.stealth}</b></div>
        <div>Crit chance<b>${Math.round(s.crit)}%</b></div><div>Speed<b>${s.speed >= 0 ? '+' : ''}${s.speed}%${s.moveSpeed ? ` (move +${s.moveSpeed}%)` : ''}</b></div>
        <div>Weapon<b>${esc(s.weapon.name)}</b></div><div>Sight<b>${s.sight}</b></div>
        <div>rFire<b>${res(s.res.fire)}</b></div><div>rCold<b>${res(s.res.cold)}</b></div>
        <div>rPoison<b>${res(s.res.poison)}</b></div><div>rShock<b>${res(s.res.shock)}</b></div>
        <div>rNecro<b>${res(s.res.necro)}</b></div><div>Regen<b>${s.regen >= 0 ? '+' : ''}${s.regen}</b></div>
      </div>
      <div class="list-h">Quirks</div><div class="sub" style="color:var(--dim);font-size:14px">${anc.quirks.map(esc).join(' ')}</div>
      ${p.piety ? `<div class="list-h">Patron</div><div class="item" style="cursor:default">${icon(PATRONS[p.piety.god].altar, 32)}<div class="nm">${esc(PATRONS[p.piety.god].name)}<div class="sub">Favour ${p.piety.favor} · ${esc(PATRONS[p.piety.god].passiveText)}</div></div></div>` : ''}
      <div class="list-h">Talents</div>${talents || '<div class="m-dim">None yet.</div>'}
      <div class="list-h">Mutations (${p.mutations.length}/${MUTATION_SLOTS})</div>${muts || '<div class="m-dim">None. Yet.</div>'}
      <div class="list-h">Disciplines you are drawn to</div><div style="font-size:14px">${[...new Set([...cal.disciplines, ...p.disciplines])].map((d) => esc(DISCIPLINES[d].name)).join(', ')}</div>
      <div class="list-h">This run</div><div class="statgrid"><div>Depth<b>${run.depth} (max ${run.stats.deepest})</b></div><div>Turns<b>${run.turn}</b></div><div>Kills<b>${run.stats.kills}</b></div><div>Uniques slain<b>${run.stats.uniques.length}</b></div></div>`;
  };
  const pnl = openPanel(ui.root, 'Character', render());
  pnl.body.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const a = t.closest('[data-attr]')?.getAttribute('data-attr') as Attr | undefined;
    if (a) { spendAttr(run, a); ui.refresh(); pnl.body.innerHTML = render(); saveRun(run); }
    if (t.closest('[data-lvl]')) { pnl.close(); levelUp(ui); }
  });
}

export function levelUp(ui: GameUI, next?: Next) {
  const run = ui.run;
  const p = run.player;
  if (p.pendingTalents <= 0 && p.attrPoints <= 0) { next?.(); return; }
  const render = () => {
    let html = '';
    if (p.attrPoints > 0) {
      const s = playerStats(run);
      html += `<div class="list-h">Raise an attribute (${p.attrPoints})</div><div class="btnrow">
        <button class="btn" data-attr="might">Might ${s.might}</button><button class="btn" data-attr="agility">Agility ${s.agility}</button><button class="btn" data-attr="wits">Wits ${s.wits}</button></div>`;
    }
    if (p.pendingTalents > 0) {
      const offers = talentOffers(run);
      html += `<div class="list-h">Choose a talent${p.pendingTalents > 1 ? ` (${p.pendingTalents} to choose)` : ''}</div>`;
      if (!offers.length) html += '<div class="m-dim">There is nothing left to learn. Impressive.</div>';
      for (const id of offers) {
        const t = TALENTS[id];
        const r = (p.talents[id] ?? 0) + 1;
        const ab = t.ability ? ABILITIES[t.ability] : null;
        const cost = ab ? [ab.mp ? `${ab.mp} MP` : '', ab.cooldown ? `${ab.cooldown}-turn cooldown` : ''].filter(Boolean).join(', ') : '';
        html += `<div class="talent" data-t="${id}">${icon(ab?.icon ?? DISCIPLINES[t.disc].icon, 40)}<div style="flex:1"><div class="tn">${esc(t.name)}${t.max > 1 ? ` ${'★'.repeat(r)}${'☆'.repeat(t.max - r)}` : ''}</div><div class="tm">${esc(DISCIPLINES[t.disc].name)} · tier ${t.tier}${r > 1 ? ' · rank up' : ' · new'}${cost ? ' · ' + cost : ''}</div><div class="td">${esc(t.desc(r))}</div>${ab ? `<div class="tm">${esc(ab.desc)}</div>` : ''}</div></div>`;
      }
    }
    return html;
  };
  const pnl = openPanel(ui.root, `Level ${p.level}`, render(), { onClose: () => { ui.refresh(); next?.(); } });
  pnl.body.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const a = t.closest('[data-attr]')?.getAttribute('data-attr') as Attr | undefined;
    const tid = t.closest('[data-t]')?.getAttribute('data-t');
    if (a) spendAttr(run, a);
    if (tid) takeTalent(run, tid);
    if (!a && !tid) return;
    saveRun(run);
    ui.refresh();
    if (p.pendingTalents <= 0 && p.attrPoints <= 0) pnl.close();
    else pnl.body.innerHTML = render();
  });
}

// ------------------------------------------------------------------ abilities / quick bar

export function abilities(ui: GameUI) {
  const run = ui.run;
  const p = run.player;
  const render = () => {
    const list = playerAbilities(run);
    if (!list.length) return '<div class="m-dim">You have no abilities yet. Level up and pick some talents!</div>';
    return list.map((a) => {
      const d = ABILITIES[a.id];
      const c = abilityCost(run, a.id);
      const why = canUseAbility(run, a.id);
      const inQ = p.quick.includes('a:' + a.id);
      const fc = favorCost(run, a.id);
      return `<div class="item" data-ab="${a.id}" style="${why ? 'opacity:.6' : ''}">${icon(d.icon, 36)}<div class="nm">${esc(d.name)} <span class="sub">${a.rank > 1 ? 'rank ' + a.rank : ''}</span><div class="sub">${[fc ? fc + ' favour' : c.mp ? c.mp + ' MP' : '', c.cooldown ? c.cooldown + 't cooldown' : '', d.range ? 'range ' + d.range : 'self', p.cooldowns[a.id] ? `<b style="color:var(--warn)">${p.cooldowns[a.id]} turns</b>` : ''].filter(Boolean).join(' · ')}</div><div class="sub">${esc(d.desc)}</div></div><button class="btn small" data-pin="${a.id}">${inQ ? '★' : '☆'}</button></div>`;
    }).join('');
  };
  const pnl = openPanel(ui.root, 'Abilities', render());
  pnl.body.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const pin = t.closest('[data-pin]')?.getAttribute('data-pin');
    if (pin) {
      const key = 'a:' + pin;
      const i = p.quick.indexOf(key);
      if (i >= 0) p.quick[i] = null;
      else { const j = p.quick.indexOf(null); p.quick[j >= 0 ? j : p.quick.length - 1] = key; }
      ui.refresh(); pnl.body.innerHTML = render();
      return;
    }
    const id = t.closest('[data-ab]')?.getAttribute('data-ab');
    if (id) { pnl.close(); ui.useAbility(id); }
  });
}

export function quickAssign(ui: GameUI, slot: number) {
  const run = ui.run;
  const p = run.player;
  const opts: string[] = [];
  for (const a of playerAbilities(run)) opts.push(`<div class="item" data-k="a:${a.id}">${icon(ABILITIES[a.id].icon, 32)}<div class="nm">${esc(ABILITIES[a.id].name)}</div></div>`);
  const bases = new Set<string>();
  for (const it of p.inventory) if (['potion', 'scroll', 'wand'].includes(it.kind) && !bases.has(it.base)) { bases.add(it.base); opts.push(`<div class="item" data-k="i:${it.base}">${icon(itemTile(run, it), 32, it.id)}<div class="nm">${esc(itemName(run, it))}</div></div>`); }
  const pnl = openPanel(ui.root, `Quick slot ${slot + 1}`, `${opts.join('') || '<div class="m-dim">Nothing to assign yet.</div>'}<div class="btnrow"><button class="btn" data-k="">Clear slot</button></div>`);
  pnl.body.addEventListener('click', (e) => {
    const k = (e.target as HTMLElement).closest('[data-k]')?.getAttribute('data-k');
    if (k === null || k === undefined) return;
    p.quick[slot] = k || null;
    ui.refresh();
    saveRun(run);
    pnl.close();
  });
}

// ------------------------------------------------------------------ world interactions

export function examine(ui: GameUI, cell: Pos) {
  const run = ui.run;
  const l = cur(run);
  if (cell.x < 0 || cell.y < 0 || cell.x >= l.w || cell.y >= l.h) return;
  const i = cell.y * l.w + cell.x;
  if (!l.seen[i]) { toast(ui.root, 'You have not seen that place.'); return; }
  const parts: string[] = [];
  const vis = isVisible(run, cell.x, cell.y);
  const p = run.player;
  if (cell.x === p.x && cell.y === p.y) parts.push(`<div class="item" style="cursor:default">${stackIcon(dollKeys(run), 40)}<div class="nm">You. ${esc(p.name)}. Looking good, considering.</div></div>`);
  const m = vis ? l.monsters.find((o) => o.x === cell.x && o.y === cell.y && o.hp > 0) as Monster | undefined : undefined;
  if (m && (!m.statuses.invisible || playerStats(run).flags.has('see_invis'))) {
    const d = MONSTERS[m.def];
    const th = threat(run, m);
    const hpTxt = m.hp >= m.maxHp ? 'unhurt' : m.hp > m.maxHp * 0.6 ? 'lightly wounded' : m.hp > m.maxHp * 0.3 ? 'badly wounded' : 'almost dead';
    const sts = Object.keys(m.statuses).filter((k) => STATUSES[k] && k !== 'invisible').map((k) => STATUSES[k].name.toLowerCase());
    const color = { trivial: 'var(--dim)', easy: 'var(--good)', tough: 'var(--warn)', nasty: 'var(--bad)' }[th];
    parts.push(`<div class="detail"><div style="display:flex;gap:10px;align-items:center">${icon(m.tile ?? d.tile, 56, m.id)}<div><b style="font-size:18px">${esc(m.name ?? d.name)}</b><div class="sub" style="color:${color}">${m.ally ? 'Your ally' : m.friendly ? 'Not hostile' : th === 'nasty' ? 'Extremely dangerous' : th === 'tough' ? 'Dangerous' : th === 'easy' ? 'Manageable' : 'Harmless'} · ${hpTxt}${m.awake ? '' : ' · unaware'}${sts.length ? ' · ' + sts.join(', ') : ''}</div></div></div><p>${esc(d.desc)}</p></div>`);
  }
  for (const fi of l.items.filter((o) => o.x === cell.x && o.y === cell.y)) parts.push(`<div class="item" style="cursor:default">${icon(itemTile(run, fi.item), 32, fi.item.id)}<div class="nm">${esc(itemName(run, fi.item))}</div></div>`);
  const f = l.features.find((o) => o.x === cell.x && o.y === cell.y && !(o.kind === 'trap' && o.hidden));
  if (f?.kind === 'trap') parts.push(`<p class="m-warn">A ${esc(f.id)} trap.</p>`);
  if (f?.kind === 'chest' && !f.used) parts.push('<p>A sturdy box. Probably full of treasure. Probably.</p>');
  if (f?.kind === 'shop') parts.push(`<p>${esc(String(f.data?.name ?? 'A shop'))}.</p>`);
  if (f?.kind === 'altar') parts.push(`<p><b>An altar of ${esc(PATRONS[f.id].name)}</b>. ${esc(PATRONS[f.id].desc)}</p>`);
  if (f?.kind === 'shrine') parts.push(`<p><b>${esc(SHRINES[f.id].name)}</b>. ${esc(SHRINES[f.id].desc)}${f.used ? ' It is quiet now.' : ''}</p>`);
  const t = l.tiles[i];
  parts.push(`<p class="m-dim">${esc(TERRAIN[t].name.charAt(0).toUpperCase() + TERRAIN[t].name.slice(1))}. ${esc(TERRAIN[t].desc)}${vis ? '' : ' (remembered)'}</p>`);
  if (l.corpses.some((c) => c.x === cell.x && c.y === cell.y)) parts.push('<p class="m-dim">A corpse lies here.</p>');
  openPanel(ui.root, 'Look', parts.join(''), { center: true });
}

export function shop(ui: GameUI, next?: Next) {
  const run = ui.run;
  const p = run.player;
  const f = cur(run).features.find((o) => o.kind === 'shop' && o.x === p.x && o.y === p.y);
  if (!f) { next?.(); return; }
  const render = () => `<p class="m-dim">${esc(String(f.data?.name ?? 'A shop'))}. You have <b style="color:var(--gold)">${p.gold}</b> gold.</p>` +
    ((f.stock ?? []).map((s, i) => `<div class="item" data-i="${i}">${icon(itemTile(run, s.item), 34, s.item.id)}<div class="nm">${esc(itemName(run, s.item))}<div class="sub">${s.price} gold</div></div><button class="btn small" data-buy="${i}" ${p.gold < s.price ? 'disabled' : ''}>Buy</button></div>`).join('') || '<p class="m-dim">Sold out. "Come back never!"</p>');
  const pnl = openPanel(ui.root, 'Shop', render(), { onClose: next });
  pnl.body.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const b = t.closest('[data-buy]')?.getAttribute('data-buy');
    if (b !== null && b !== undefined) { ui.doAct({ t: 'buy', index: +b }); pnl.body.innerHTML = render(); return; }
    const i = t.closest('[data-i]')?.getAttribute('data-i');
    if (i !== null && i !== undefined) { const s = f.stock?.[+i]; if (s) itemPreview(ui, s.item); }
  });
}

function itemPreview(ui: GameUI, it: Item) {
  openPanel(ui.root, esc(itemName(ui.run, it)), `<div class="detail"><div style="text-align:center">${icon(itemTile(ui.run, it), 64, it.id)}</div>${itemInfo(ui, it)}<p class="m-dim">Worth about ${itemPrice(ui.run, it)} gold.</p></div>`, { center: true });
}

export function shrine(ui: GameUI, id: string, next?: Next) {
  const s = SHRINES[id];
  const pnl = openPanel(ui.root, esc(s.name), `<div style="text-align:center">${icon(s.tile, 64)}</div><p class="story">${esc(s.desc)}</p><p><b style="color:var(--gold)">The offer:</b> ${esc(s.offer)}</p><div class="btnrow"><button class="btn primary" data-yes>Accept</button><button class="btn" data-close>Walk away</button></div>`, { center: true, onClose: next });
  pnl.body.querySelector('[data-yes]')!.addEventListener('click', () => { pnl.close(); ui.doAct({ t: 'shrine' }); });
}

export function patron(ui: GameUI, id: string, next?: Next) {
  const pat = PATRONS[id];
  const cur0 = ui.run.player.piety && PATRONS[ui.run.player.piety.god];
  const powers = pat.powers.map((pw) => `<div class="item" style="cursor:default">${icon(ABILITIES[pw.ability].icon, 28)}<div class="nm">${esc(ABILITIES[pw.ability].name)}<div class="sub">${esc(ABILITIES[pw.ability].desc)} (at ${pw.favor} favour, costs ${pw.cost})</div></div></div>`).join('');
  const pnl = openPanel(ui.root, esc(pat.name), `<div style="text-align:center">${icon(pat.altar, 64)}</div>
    <p class="story">${esc(pat.desc)}</p><p class="m-speech">${esc(pat.pitch)}</p>
    <p><b style="color:var(--gold)">Blessing:</b> ${esc(pat.passiveText)}</p><p><b style="color:var(--gold)">Favour from:</b> ${esc(pat.likes)}</p>
    <div class="list-h">Powers</div>${powers}
    ${cur0 ? `<p class="m-warn">You already serve ${esc(cur0.name)}. They will not take kindly to being abandoned.</p>` : ''}
    <div class="btnrow"><button class="btn primary" data-yes>Kneel</button><button class="btn" data-close>Not today</button></div>`, { center: true, onClose: next });
  pnl.body.querySelector('[data-yes]')!.addEventListener('click', () => { pnl.close(); ui.doAct({ t: 'worship', id }); });
}

export function baker(ui: GameUI, next?: Next) {
  const pnl = openPanel(ui.root, 'Barnaby the Baker', `<div style="text-align:center">${icon(MONSTERS.baker.tile, 64)}</div>
    <p class="story">A tall man in a floury apron sits on an upturned bucket, kneading nothing. His hands never stop.</p>
    <p class="m-speech">"You're going down too? Then you'll meet her. Mother. She took my Hettie, you know. Took her right down into the dough."</p>
    <p class="m-speech">"I'm going to get her back. Mother says she'll give her back if I bring her what she wants. She just wants to be fed. That's all anything wants."</p>
    <p class="m-speech">"Here. Take something for the road. You look like you need it more than me."</p>
    <div class="btnrow"><button class="btn primary" data-c="gift">Accept his gift</button><button class="btn danger" data-c="attack">"You're working for her." (Attack)</button><button class="btn" data-close>Leave him be</button></div>`, { center: true, onClose: next });
  pnl.body.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest('[data-c]')?.getAttribute('data-c') as 'gift' | 'attack' | undefined;
    if (!c) return;
    pnl.close();
    ui.doAct({ t: 'talk', choice: c });
  });
}

export function note(ui: GameUI, title: string, text: string, next?: Next) {
  openPanel(ui.root, esc(title), `<div class="note">${esc(text)}</div>`, { center: true, onClose: next });
}

export function story(ui: GameUI, title: string, text: string, next?: Next) {
  openPanel(ui.root, esc(title), `<p class="story">${esc(text)}</p><div class="btnrow"><button class="btn primary" data-close>Continue</button></div>`, { center: true, onClose: next });
}

export function messageLog(ui: GameUI) {
  const msgs = [...ui.run.messages].reverse();
  openPanel(ui.root, 'Messages', msgs.map((m) => `<div class="${m.cls ? 'm-' + m.cls : ''}" style="padding:3px 0;border-bottom:1px dotted var(--line);font-size:14px">${esc(m.text)}</div>`).join(''));
}

export function help(ui: GameUI) {
  openPanel(ui.root, 'How to play', `<div class="help">
    <p><b>Tap</b> a square to walk there. Tap a monster next to you to attack it. Tap yourself to wait a turn, pick something up or use stairs.</p>
    <p><b>Swipe</b> anywhere on the map to take one step in that direction.</p>
    <p><b>Hold</b> a square to look at what is there.</p>
    <p><b>Pinch</b> to zoom.</p>
    <p><b>Explore</b> walks around automatically until something interesting happens. <b>Fight</b> attacks the nearest enemy. <b>Rest</b> waits until you are healed. <b>Stairs</b> walks to the nearest way down.</p>
    <p>The <b>quick bar</b> holds abilities and items. Tap an empty slot (or hold a full one) to change it.</p>
    <p>When you level up, tap <b>LEVEL UP</b> to pick a new talent. Your build is yours to make.</p>
    <p>Potions, scrolls, wands and jewellery are <b>unidentified</b> until you try them. Living dangerously is part of it.</p>
    <p>Death is permanent. Your game saves automatically after every move; close the tab whenever you like.</p>
    <p class="m-dim">Keyboard: arrows / hjklyubn to move, o explore, Tab fight, r rest, &gt; stairs, g pick up, i bag, a abilities, c character, m map, F1–F6 quick bar.</p>
    <div class="btnrow"><button class="btn primary" data-close>Got it</button></div></div>`, { center: true, onClose: () => ui.showPopups() });
}

export function mainMenu(ui: GameUI) {
  const zoomNames = ['Far', 'Normal', 'Close'];
  const pnl = openPanel(ui.root, 'Menu', `<div class="menu-col" style="max-width:none">
    <button class="btn" data-m="char">${icon('gui/commands/status', 24)} Character</button>
    <button class="btn" data-m="abil">${icon('gui/commands/ability', 24)} Abilities</button>
    <button class="btn" data-m="log">${icon('gui/commands/message_history', 24)} Messages</button>
    <button class="btn" data-m="map">${icon('gui/commands/display_map', 24)} Map</button>
    <button class="btn" data-m="zoom">Zoom: ${zoomNames[ui.settings.zoom] ?? 'Normal'}</button>
    <button class="btn" data-m="help">${icon('gui/commands/help', 24)} How to play</button>
    <button class="btn" data-m="quit">Save &amp; quit to title</button>
    <button class="btn danger" data-m="abandon">Abandon this run</button></div>`);
  pnl.body.addEventListener('click', (e) => {
    const m = (e.target as HTMLElement).closest('[data-m]')?.getAttribute('data-m');
    if (!m) return;
    if (m === 'zoom') {
      ui.settings.zoom = (ui.settings.zoom + 1) % 3;
      saveSettings(ui.settings);
      ui.renderer.setZoom([9, 11, 14][ui.settings.zoom]);
      (e.target as HTMLElement).closest('[data-m]')!.textContent = `Zoom: ${zoomNames[ui.settings.zoom]}`;
      return;
    }
    pnl.close();
    if (m === 'char') character(ui);
    if (m === 'abil') abilities(ui);
    if (m === 'log') messageLog(ui);
    if (m === 'map') ui.toggleMinimap();
    if (m === 'help') help(ui);
    if (m === 'quit') { saveRun(ui.run); location.reload(); }
    if (m === 'abandon') {
      const c = openPanel(ui.root, 'Abandon run?', '<p>This character will be gone forever. Mother wins this round.</p><div class="btnrow"><button class="btn danger" data-yes>Abandon</button><button class="btn" data-close>Keep playing</button></div>', { center: true });
      c.body.querySelector('[data-yes]')!.addEventListener('click', () => { deleteSave(); location.reload(); });
    }
  });
}

export { RING_SLOTS, T };
