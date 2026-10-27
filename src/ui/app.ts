import type { Run } from '../core/types';
import { ANCESTRIES, CALLINGS, NAMES } from '../data/characters';
import { DISCIPLINES, TALENTS } from '../data/talents';
import { WIN_TEXT, DEATH_QUIPS } from '../data/flavor';
import { MONSTERS } from '../data/monsters';
import { newRun } from '../game/run';
import { loadRun, hasSave, hallOfFame, recordRun, saveRun, deleteSave } from '../game/save';
import { ancestryOf, callingOf, playerStats } from '../game/stats';
import { isKnown, itemName } from '../game/items';
import { GameUI } from './game';
import { el, esc, openPanel } from './dom';
import { icon } from './tiles';

export class App {
  root: HTMLElement;
  game: GameUI | null = null;
  constructor(root: HTMLElement) { this.root = root; }

  title() {
    this.game?.destroy();
    this.game = null;
    const s = el('div', 'screen');
    const save = hasSave();
    const sprites = ['mon/animals/rat', 'item/food/bread_ration', 'mon/undead/laughing_skull', 'mon/humanoids/humans/killer_klown_red', 'mon/undead/drowned_soul', 'mon/demons/crimson_imp', 'mon/aberrations/nameless_horror'];
    s.innerHTML = `<div class="title-wrap">
      <div class="title-sprites">${sprites.map((k) => icon(k, 40)).join('')}</div>
      <div class="logo">THE<br>RISING</div>
      <div class="tagline">The bakery fell into the earth. The bread has started whispering. Somebody has to go down.</div>
      <div class="menu-col">
        ${save ? '<button class="btn primary" data-t="continue">Continue</button>' : ''}
        <button class="btn${save ? '' : ' primary'}" data-t="new">New descent</button>
        <button class="btn" data-t="hall">Hall of the Fallen</button>
      </div>
      <div class="footer-note">Tiles from Dungeon Crawl Stone Soup (CC0). Saves stay on this device.</div>
    </div>`;
    this.root.innerHTML = '';
    this.root.appendChild(s);
    s.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-t]')?.getAttribute('data-t');
      if (t === 'continue') { const run = loadRun(); if (run) this.play(run); else this.create(); }
      if (t === 'new') {
        if (save) {
          const p = openPanel(this.root, 'Start over?', '<p>Your current character will be lost forever.</p><div class="btnrow"><button class="btn danger" data-yes>Start a new one</button><button class="btn" data-close>Cancel</button></div>', { center: true });
          p.body.querySelector('[data-yes]')!.addEventListener('click', () => { deleteSave(); p.close(); this.create(); });
        } else this.create();
      }
      if (t === 'hall') this.hall();
    });
  }

  hall() {
    const list = hallOfFame();
    openPanel(this.root, 'Hall of the Fallen', list.length ? list.map((h) => `<div class="hall-row"><b>${esc(h.name)}</b> the ${esc(h.ancestry)} ${esc(h.calling)}, level ${h.level}: ${h.result === 'won' ? '<b style="color:var(--gold)">defeated Mother!</b>' : `died on depth ${h.depth}${h.killedBy ? ', killed by ' + esc(h.killedBy) : ''}`}. ${h.kills} kills, ${h.turns} turns. <span>${new Date(h.date).toLocaleDateString()}</span></div>`).join('') : '<p class="m-dim">Nobody yet. Be the first to die!</p>');
  }

  create() {
    let anc = ANCESTRIES[Math.floor(Math.random() * ANCESTRIES.length)].id;
    let cal = CALLINGS[Math.floor(Math.random() * CALLINGS.length)].id;
    let name = NAMES[Math.floor(Math.random() * NAMES.length)];
    const s = el('div', 'screen cc');
    const render = () => {
      const a = ANCESTRIES.find((x) => x.id === anc)!;
      const c = CALLINGS.find((x) => x.id === cal)!;
      s.innerHTML = `
        <div class="row"><button class="btn small" data-back>←</button><h2 style="flex:1;margin:0">A new descent</h2></div>
        <h2>Name</h2>
        <div class="row"><input id="nm" maxlength="20" value="${esc(name)}" /><button class="btn small" data-rname>🎲</button></div>
        <h2>Ancestry</h2>
        <div class="grid">${ANCESTRIES.map((x) => `<div class="card${x.id === anc ? ' sel' : ''}" data-anc="${x.id}">${icon(x.tile, 36)}<span>${esc(x.name)}</span></div>`).join('')}</div>
        <div class="info"><b>${esc(a.name)}</b>: ${esc(a.desc)}<ul>${a.quirks.map((q) => `<li>${esc(q)}</li>`).join('')}<li>Might ${a.attrs.might} · Agility ${a.attrs.agility} · Wits ${a.attrs.wits}</li></ul></div>
        <h2>Calling</h2>
        <div class="grid">${CALLINGS.map((x) => `<div class="card${x.id === cal ? ' sel' : ''}" data-cal="${x.id}">${icon(x.icon, 32)}<span>${esc(x.name)}</span></div>`).join('')}</div>
        <div class="info"><b>${esc(c.name)}</b>: ${esc(c.desc)}<ul><li>Starts with: ${c.talents.map((t) => esc(TALENTS[t].name)).join(', ')}</li><li>Drawn to: ${c.disciplines.map((d) => esc(DISCIPLINES[d].name)).join(', ')}${c.id === 'jester' ? ', and two random others' : ''}</li></ul></div>
        <div class="begin"><button class="btn" data-rand>🎲 Surprise me</button><button class="btn primary" data-go>Descend</button></div>`;
    };
    render();
    this.root.innerHTML = '';
    this.root.appendChild(s);
    s.addEventListener('input', (e) => { if ((e.target as HTMLElement).id === 'nm') name = (e.target as HTMLInputElement).value; });
    s.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const a = t.closest('[data-anc]')?.getAttribute('data-anc');
      const c = t.closest('[data-cal]')?.getAttribute('data-cal');
      if (a) { anc = a; render(); }
      if (c) { cal = c; render(); }
      if (t.closest('[data-rname]')) { name = NAMES[Math.floor(Math.random() * NAMES.length)]; render(); }
      if (t.closest('[data-rand]')) { anc = ANCESTRIES[Math.floor(Math.random() * ANCESTRIES.length)].id; cal = CALLINGS[Math.floor(Math.random() * CALLINGS.length)].id; render(); }
      if (t.closest('[data-back]')) this.title();
      if (t.closest('[data-go]')) {
        const seed = (Math.random() * 2 ** 31) >>> 0;
        const ghosts = hallOfFame().filter((h) => h.result === 'dead').map((h) => ({ name: h.name, title: `the ${h.ancestry} ${h.calling}`, level: h.level, depth: h.depth }));
        const run = newRun(seed, (name || 'Nobody').trim().slice(0, 20), anc, cal, ghosts);
        saveRun(run);
        this.play(run);
      }
    });
  }

  play(run: Run) {
    this.root.innerHTML = '';
    this.game = new GameUI(this.root, run, (r, hp) => this.end(r, hp));
    if (import.meta.env.DEV) (window as unknown as { game: GameUI }).game = this.game;
  }

  end(run: Run, hpBefore?: number) {
    const p = run.player;
    const maxHp = playerStats(run).maxHp;
    const unused = p.inventory.filter((it) => (it.kind === 'potion' || it.kind === 'scroll' || (it.kind === 'wand' && (it.charges ?? 0) > 0)) && isKnown(run, it.base))
      .map((it) => { const n = itemName(run, it); return it.qty > 1 ? n : (/^[aeiou]/i.test(n) ? 'an ' : 'a ') + n; });
    recordRun({ name: p.name, ancestry: ancestryOf(p).name, calling: callingOf(p).name, level: p.level, depth: run.stats.deepest, turns: run.turn, result: run.over === 'won' ? 'won' : 'dead', killedBy: run.stats.killedBy, date: Date.now(), kills: run.stats.kills });
    deleteSave();
    this.game?.destroy();
    this.game = null;
    const won = run.over === 'won';
    const s = el('div', 'screen');
    const quip = won ? 'A WINNER IS YOU' : DEATH_QUIPS[Math.floor(Math.random() * DEATH_QUIPS.length)];
    s.innerHTML = `<div class="title-wrap">
      ${icon(won ? MONSTERS.mother.tile : 'dngn/statues/statue_wraith', 72)}
      <div class="end-title ${won ? 'won' : 'dead'}">${won ? 'VICTORY' : 'YOU DIED'}</div>
      <div class="tagline" style="max-width:420px">${esc(won ? WIN_TEXT : `${p.name} the ${ancestryOf(p).name} ${callingOf(p).name} was killed by ${run.stats.killedBy ?? 'something'} on depth ${run.depth}.`)}</div>
      ${won ? '' : `<div class="end-why">${[hpBefore !== undefined ? `HP <b>${Math.max(0, hpBefore)}/${maxHp}</b> before the killing blow` : '', unused.length ? `Unused: <b>${unused.map(esc).join(', ')}</b>` : ''].filter(Boolean).join('<br>')}</div>`}
      <div class="info" style="max-width:360px;width:100%;text-align:left">
        Level ${p.level} · deepest ${run.stats.deepest} · ${run.turn} turns<br>
        ${run.stats.kills} kills · ${run.stats.damageDealt} damage dealt · ${run.stats.damageTaken} taken<br>
        ${run.stats.potions} potions drunk · ${run.stats.scrolls} scrolls read<br>
        ${run.stats.uniques.length ? `Slew: ${run.stats.uniques.map(esc).join(', ')}` : 'No notable kills.'}
      </div>
      <div class="info end-log" style="max-width:360px;width:100%;text-align:left">${run.messages.slice(-12).map((m) => `<div class="${m.cls ? 'm-' + m.cls : ''}">${esc(m.text)}</div>`).join('')}</div>
      <div class="m-dim" style="font-family:var(--pixel)">${esc(quip)}</div>
      <div class="menu-col"><button class="btn primary" data-t="new">Try again</button><button class="btn" data-t="title">Title</button></div>
    </div>`;
    this.root.innerHTML = '';
    this.root.appendChild(s);
    const log = s.querySelector('.end-log');
    if (log) log.scrollTop = log.scrollHeight;
    s.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-t]')?.getAttribute('data-t');
      if (t === 'new') this.create();
      if (t === 'title') this.title();
    });
  }
}
