import type { Run } from '../core/types';
import { dist, type Pos } from '../core/geom';
import { ABILITIES } from '../data/abilities';
import { CONSUMABLES } from '../data/items';
import { STATUSES } from '../data/statuses';
import { T, TERRAIN } from '../data/terrain';
import { act, popups, canFireAt, type Action } from '../game/turn';
import { exploreStep, fightStep, restStep, stairsStep, travelStep, enemiesInView } from '../game/explore';
import { actorAt, cur, isVisible, msg, view } from '../game/state';
import { playerStats, xpForLevel } from '../game/stats';
import { abilityCost, canUseAbility, defaultTarget } from '../game/abilities';
import { itemTile, itemName } from '../game/items';
import { playerAbilities, favorCost } from '../game/progression';
import { saveRun, loadSettings, saveSettings } from '../game/save';
import { findPath } from '../world/path';
import { Renderer } from './renderer';
import { MONSTERS } from '../data/monsters';
import { threat } from '../game/combat';
import { el, esc, toast } from './dom';
import { icon } from './tiles';
import * as P from './panels';

type Auto = null | { kind: 'explore' | 'rest' | 'fight' | 'stairs' | 'travel'; dest?: Pos; steps: number };
export interface Targeting { label: string; range: number; self?: boolean; onPick: (p: Pos) => void; initial: Pos | null }

export class GameUI {
  run: Run;
  root: HTMLElement;
  renderer!: Renderer;
  canvas!: HTMLCanvasElement;
  hud!: HTMLElement;
  logEl!: HTMLElement;
  quickEl!: HTMLElement;
  ctxEl!: HTMLElement;
  bannerEl!: HTMLElement;
  minimap!: HTMLCanvasElement;
  foesEl!: HTMLElement;
  auto: Auto = null;
  targeting: Targeting | null = null;
  lastStep = 0;
  stepsSinceSave = 0;
  panelOpen = false;
  showMinimap = false;
  settings = loadSettings();
  onEnd: (run: Run) => void;
  alive = true;
  lastHudKey = '';

  constructor(root: HTMLElement, run: Run, onEnd: (run: Run) => void) {
    this.root = root;
    this.run = run;
    this.onEnd = onEnd;
    this.build();
    this.renderer.setZoom(this.settings.zoom === 0 ? 9 : this.settings.zoom === 2 ? 13 : 11);
    requestAnimationFrame((t) => this.frame(t));
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onHide);
    this.refresh();
    if (!this.settings.seenIntro) { this.settings.seenIntro = true; saveSettings(this.settings); P.help(this); }
    else this.showPopups();
  }

  destroy() {
    this.alive = false;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onHide);
    this.root.innerHTML = '';
  }

  onResize = () => { this.renderer.resize(); };
  onHide = () => { saveRun(this.run); };

  build() {
    const r = this.root;
    r.innerHTML = '';
    this.hud = el('div'); this.hud.id = 'hud';
    const wrap = el('div'); wrap.id = 'mapwrap';
    this.canvas = el('canvas'); this.canvas.id = 'map';
    this.logEl = el('div'); this.logEl.id = 'log';
    this.ctxEl = el('div'); this.ctxEl.id = 'ctx';
    this.bannerEl = el('div'); this.bannerEl.id = 'banner'; this.bannerEl.style.display = 'none';
    this.minimap = el('canvas'); this.minimap.id = 'minimap'; this.minimap.style.display = 'none';
    this.foesEl = el('div'); this.foesEl.id = 'foes';
    wrap.append(this.canvas, this.logEl, this.ctxEl, this.foesEl, this.bannerEl, this.minimap);
    this.quickEl = el('div'); this.quickEl.id = 'quick';
    const actions = el('div'); actions.id = 'actions';
    const A = (id: string, ico: string, label: string) => `<div class="act" data-a="${id}">${icon(ico, 24)}<span>${label}</span></div>`;
    actions.innerHTML =
      A('explore', 'gui/commands/explore', 'Explore') + A('fight', 'gui/commands/autofight', 'Fight') + A('rest', 'gui/commands/resting', 'Rest') +
      A('stairs', 'gui/commands/find_downstair', 'Stairs') + A('bag', 'gui/commands/inventory', 'Bag') + A('menu', 'gui/commands/game_menu', 'Menu');
    r.append(this.hud, wrap, this.quickEl, actions);
    this.renderer = new Renderer(this.canvas);
    this.renderer.resize();
    actions.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
      if (a) this.onButton(a);
    });
    this.quickEl.addEventListener('click', (e) => {
      const q = (e.target as HTMLElement).closest('[data-q]');
      if (q) this.useQuick(+q.getAttribute('data-q')!);
    });
    this.quickEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const q = (e.target as HTMLElement).closest('[data-q]');
      if (q) P.quickAssign(this, +q.getAttribute('data-q')!);
    });
    this.bindLongPress(this.quickEl, (target) => { const q = target.closest('[data-q]'); if (q) P.quickAssign(this, +q.getAttribute('data-q')!); });
    this.hud.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.lvlup')) P.levelUp(this);
      else P.character(this);
    });
    this.logEl.addEventListener('click', () => P.messageLog(this));
    this.ctxEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-c]')?.getAttribute('data-c');
      if (b === 'pickup') this.doAct({ t: 'pickup' });
      if (b === 'stairs') this.doAct({ t: 'stairs' });
      if (b === 'shop') P.shop(this);
      if (b === 'altar') { const f = cur(this.run).features.find((x) => x.kind === 'altar' && x.x === this.run.player.x && x.y === this.run.player.y); if (f) P.patron(this, f.id); }
      if (b === 'shrine') { const f = cur(this.run).features.find((x) => x.kind === 'shrine' && x.x === this.run.player.x && x.y === this.run.player.y); if (f) P.shrine(this, f.id); }
    });
    this.bannerEl.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-cancel]')) this.cancelTarget(); });
    this.minimap.addEventListener('click', () => { this.showMinimap = false; this.minimap.style.display = 'none'; });
    this.foesEl.addEventListener('click', (e) => {
      const f = (e.target as HTMLElement).closest('[data-foe]')?.getAttribute('data-foe');
      if (!f) return;
      const [x, y] = f.split(',').map(Number);
      P.examine(this, { x, y });
    });
    this.bindCanvas();
  }

  // ------------------------------------------------------------------ input

  bindLongPress(node: HTMLElement, cb: (t: HTMLElement) => void) {
    let timer = 0;
    node.addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement;
      timer = window.setTimeout(() => { timer = 0; cb(t); suppressClick = true; }, 500);
    });
    let suppressClick = false;
    const clear = () => { if (timer) clearTimeout(timer); timer = 0; };
    node.addEventListener('pointerup', clear);
    node.addEventListener('pointerleave', clear);
    node.addEventListener('pointercancel', clear);
    node.addEventListener('click', (e) => { if (suppressClick) { e.stopImmediatePropagation(); suppressClick = false; } }, true);
  }

  bindCanvas() {
    const c = this.canvas;
    let start: { x: number; y: number; t: number; id: number } | null = null;
    let longTimer = 0;
    let longFired = false;
    let pinch: { d: number; cells: number } | null = null;
    const pointers = new Map<number, { x: number; y: number }>();
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cells: this.renderer.cells };
        start = null;
        clearTimeout(longTimer);
        return;
      }
      start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      longFired = false;
      longTimer = window.setTimeout(() => {
        if (!start) return;
        longFired = true;
        const cell = this.renderer.cellAt(this.run, start.x, start.y);
        P.examine(this, cell);
      }, 450);
    });
    c.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const cells = Math.round(Math.max(7, Math.min(19, pinch.cells * pinch.d / d)));
        if (cells !== this.renderer.cells) this.renderer.setZoom(cells);
        return;
      }
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 14) clearTimeout(longTimer);
    });
    const end = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pinch) { if (pointers.size === 0) pinch = null; return; }
      clearTimeout(longTimer);
      if (!start || longFired || e.pointerId !== start.id) { start = null; return; }
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      const d = Math.hypot(dx, dy);
      const s0 = start;
      start = null;
      if (d > 26) {
        const ang = Math.atan2(dy, dx);
        const oct = Math.round(ang / (Math.PI / 4));
        const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
        const [mx, my] = dirs[(oct + 8) % 8];
        this.stopAuto();
        if (this.targeting) return;
        this.doAct({ t: 'move', dx: mx, dy: my });
        return;
      }
      this.onTap(this.renderer.cellAt(this.run, s0.x, s0.y));
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); start = null; pinch = null; clearTimeout(longTimer); });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onTap(cell: Pos) {
    const run = this.run;
    const p = run.player;
    const l = cur(run);
    if (this.auto) { this.stopAuto(); return; }
    if (this.targeting) {
      const tg = this.targeting;
      if (tg.self) { this.cancelTarget(); tg.onPick(p); return; }
      if (dist(cell, p) > tg.range) { toast(this.root, 'Out of range'); return; }
      this.cancelTarget();
      tg.onPick(cell);
      return;
    }
    if (cell.x < 0 || cell.y < 0 || cell.x >= l.w || cell.y >= l.h) return;
    if (cell.x === p.x && cell.y === p.y) {
      if (l.items.some((i) => i.x === p.x && i.y === p.y)) return this.doAct({ t: 'pickup' });
      const t = l.tiles[p.y * l.w + p.x];
      if (t === T.DOWN || t === T.UP) return this.doAct({ t: 'stairs' });
      if (t === T.SHOP) return P.shop(this);
      const f = l.features.find((x) => x.kind === 'shrine' && x.x === p.x && x.y === p.y && !x.used);
      if (f) return P.shrine(this, f.id);
      const alt = l.features.find((x) => x.kind === 'altar' && x.x === p.x && x.y === p.y);
      if (alt) return P.patron(this, alt.id);
      return this.doAct({ t: 'wait' });
    }
    const target = actorAt(run, cell.x, cell.y);
    if (target && target !== p && isVisible(run, cell.x, cell.y)) {
      const m = target as import('../core/types').Monster;
      if (m.friendly && dist(m, p) <= 1) { P.baker(this); return; }
      if (dist(cell, p) <= 1) return this.doAct({ t: 'move', dx: cell.x - p.x, dy: cell.y - p.y });
      if (!m.ally && canFireAt(run, m)) return this.doAct({ t: 'fire', target: cell });
    }
    if (dist(cell, p) === 1 && l.tiles[cell.y * l.w + cell.x] === T.FOUNTAIN) return this.doAct({ t: 'fountain', at: cell });
    if (dist(cell, p) === 1) return this.doAct({ t: 'move', dx: cell.x - p.x, dy: cell.y - p.y });
    if (!l.seen[cell.y * l.w + cell.x]) return;
    // travel
    const path = findPath(l.w, l.h, p, cell, (x, y) => !!l.seen[y * l.w + x] && (TERRAIN[l.tiles[y * l.w + x]].walk || l.tiles[y * l.w + x] === T.DOOR));
    if (!path) { toast(this.root, 'No known path'); return; }
    this.renderer.path = path;
    this.startAuto('travel', cell);
  }

  onKey = (e: KeyboardEvent) => {
    if (this.panelOpen || document.querySelector('.overlay')) { if (e.key === 'Escape') (document.querySelector('.overlay [data-close]') as HTMLElement | null)?.click(); return; }
    const k = e.key;
    const dirs: Record<string, [number, number]> = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], k: [0, -1], j: [0, 1], h: [-1, 0], l: [1, 0], y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1],
      '8': [0, -1], '2': [0, 1], '4': [-1, 0], '6': [1, 0], '7': [-1, -1], '9': [1, -1], '1': [-1, 1], '3': [1, 1],
    };
    if (this.targeting && k === 'Escape') { this.cancelTarget(); return; }
    if (this.targeting && (k === 'Enter' || k === 'f')) { if (this.renderer.cursor) this.onTap(this.renderer.cursor); return; }
    if (dirs[k]) { e.preventDefault(); this.stopAuto(); this.doAct({ t: 'move', dx: dirs[k][0], dy: dirs[k][1] }); return; }
    if (k === '.' || k === '5' || k === 's') return this.doAct({ t: 'wait' });
    if (k === 'o') return this.onButton('explore');
    if (k === 'Tab') { e.preventDefault(); return this.onButton('fight'); }
    if (k === 'R' || k === 'r') return this.onButton('rest');
    if (k === '>' || k === '<') return this.onButton('stairs');
    if (k === 'g' || k === ',') return this.doAct({ t: 'pickup' });
    if (k === 'i') return P.inventory(this);
    if (k === 'a') return P.abilities(this);
    if (k === 'c' || k === '@') return P.character(this);
    if (k === 'm') return this.toggleMinimap();
    if (/^F[1-6]$/.test(k)) { e.preventDefault(); this.useQuick(+k.slice(1) - 1); }
  };

  onButton(a: string) {
    if (this.targeting) this.cancelTarget();
    switch (a) {
      case 'explore': return this.toggleAuto('explore');
      case 'fight': { const s = fightStep(this.run); if (typeof s === 'string') { msg(this.run, s, 'dim'); this.refresh(); } else this.doAct(s); return; }
      case 'rest': return this.toggleAuto('rest');
      case 'stairs': {
        const t = cur(this.run).tiles[this.run.player.y * cur(this.run).w + this.run.player.x];
        if (t === T.DOWN || t === T.UP) return this.doAct({ t: 'stairs' });
        return this.toggleAuto('stairs');
      }
      case 'bag': return P.inventory(this);
      case 'menu': return P.mainMenu(this);
    }
  }

  toggleMinimap() {
    this.showMinimap = !this.showMinimap;
    this.minimap.style.display = this.showMinimap ? 'block' : 'none';
    if (this.showMinimap) this.renderer.drawMinimap(this.run, this.minimap);
  }

  // ------------------------------------------------------------------ actions

  doAct(a: Action): boolean {
    if (this.run.over) return false;
    const ok = act(this.run, a);
    this.after();
    return ok;
  }

  after() {
    const run = this.run;
    this.stepsSinceSave++;
    if (!this.auto || this.stepsSinceSave > 25) { saveRun(run); this.stepsSinceSave = 0; }
    this.refresh();
    if (run.over) {
      this.stopAuto();
      saveRun(run);
      setTimeout(() => this.onEnd(run), 900);
      return;
    }
    if (popups.length) { this.stopAuto(); this.showPopups(); }
  }

  showPopups() {
    if (document.querySelector('.overlay')) return;
    const pop = popups.shift();
    if (!pop) return;
    const next = () => setTimeout(() => this.showPopups(), 50);
    switch (pop.type) {
      case 'note': P.note(this, pop.title, pop.text, next); break;
      case 'story': P.story(this, pop.title, pop.text, next); break;
      case 'shop': P.shop(this, next); break;
      case 'shrine': P.shrine(this, pop.id, next); break;
      case 'baker': P.baker(this, next); break;
      case 'levelup': P.levelUp(this, next); break;
      case 'patron': P.patron(this, pop.id, next); break;
    }
  }

  useQuick(i: number) {
    const key = this.run.player.quick[i];
    if (!key) { P.quickAssign(this, i); return; }
    if (key.startsWith('a:')) this.useAbility(key.slice(2));
    else {
      const it = this.run.player.inventory.find((x) => x.base === key.slice(2));
      if (!it) { toast(this.root, 'None left'); return; }
      P.useItem(this, it);
    }
  }

  useAbility(id: string) {
    const why = canUseAbility(this.run, id);
    if (why) { toast(this.root, why, 1800); return; }
    const a = ABILITIES[id];
    if (!a) return;
    if (a.target === 'self') { this.doAct({ t: 'ability', id, target: { x: this.run.player.x, y: this.run.player.y } }); return; }
    this.startTarget({
      label: a.name, range: a.kind === 'strike' || a.kind === 'drain' ? 1 : a.range, initial: defaultTarget(this.run, id),
      onPick: (pos) => this.doAct({ t: 'ability', id, target: pos }),
    });
  }

  startTarget(t: Targeting) {
    this.stopAuto();
    this.targeting = t;
    this.renderer.cursor = t.initial;
    const tip = t.initial ? 'Tap a target (or the marked one)' : 'Tap a target';
    this.bannerEl.innerHTML = `<b>${esc(t.label)}</b><span style="color:var(--dim)">${tip}</span>${t.initial ? '<button class="btn small" data-fire>Fire</button>' : ''}<button class="btn small" data-cancel>✕</button>`;
    this.bannerEl.style.display = 'flex';
    this.bannerEl.querySelector('[data-fire]')?.addEventListener('click', () => { if (t.initial) { this.cancelTarget(); t.onPick(t.initial); } });
  }

  cancelTarget() {
    this.targeting = null;
    this.renderer.cursor = null;
    this.bannerEl.style.display = 'none';
  }

  // ------------------------------------------------------------------ auto

  toggleAuto(kind: 'explore' | 'rest' | 'stairs') {
    if (this.auto?.kind === kind) { this.stopAuto(); return; }
    this.startAuto(kind);
  }

  startAuto(kind: NonNullable<Auto>['kind'], dest?: Pos) {
    this.auto = { kind, dest, steps: 0 };
    view.interrupt = false;
    this.lastStep = 0;
    this.refresh();
  }

  stopAuto() {
    if (!this.auto) return;
    this.auto = null;
    this.renderer.path = [];
    saveRun(this.run);
    this.refresh();
  }

  autoStep() {
    const a = this.auto!;
    const run = this.run;
    let step: Action | string | null;
    switch (a.kind) {
      case 'explore': step = exploreStep(run); break;
      case 'rest': step = restStep(run); break;
      case 'stairs': step = stairsStep(run); break;
      case 'fight': step = fightStep(run); break;
      case 'travel': step = travelStep(run, a.dest!); if (!step) step = ''; break;
    }
    if (typeof step === 'string' || !step) {
      if (step) msg(run, step, 'dim');
      this.stopAuto();
      return;
    }
    if (a.kind === 'travel' && enemiesInView(run).length && a.steps > 0) { this.stopAuto(); return; }
    const hpBefore = run.player.hp;
    const ok = act(run, step);
    a.steps++;
    if (a.kind === 'travel' && this.renderer.path.length) this.renderer.path.shift();
    if (!ok || view.interrupt || run.player.hp < hpBefore) { this.after(); this.stopAuto(); return; }
    if (a.kind === 'stairs' && step.t === 'stairs') { this.after(); this.stopAuto(); return; }
    this.after();
  }

  frame(now: number) {
    if (!this.alive) return;
    if (this.auto && !this.renderer.busy(now) && !document.querySelector('.overlay')) {
      const delay = this.auto.kind === 'rest' ? 8 : 55;
      if (now - this.lastStep > delay) {
        this.lastStep = now;
        // resting can run several turns per frame
        const n = this.auto.kind === 'rest' ? 5 : 1;
        for (let i = 0; i < n && this.auto; i++) this.autoStep();
      }
    }
    this.renderer.draw(this.run, now);
    if (this.showMinimap && Math.floor(now / 250) !== Math.floor((now - 17) / 250)) this.renderer.drawMinimap(this.run, this.minimap);
    requestAnimationFrame((t) => this.frame(t));
  }

  // ------------------------------------------------------------------ HUD

  refresh() {
    const run = this.run;
    const p = run.player;
    const s = playerStats(run);
    const xpNow = p.xp - xpForLevel(p.level), xpNeed = xpForLevel(p.level + 1) - xpForLevel(p.level);
    const chips = Object.entries(p.statuses).filter(([k]) => STATUSES[k]).map(([k, v]) => `<span class="chip" style="color:${STATUSES[k].color}">${STATUSES[k].name}${v.turns < 999 ? ' ' + v.turns : ''}</span>`).join('');
    const pend = p.pendingTalents > 0 || p.attrPoints > 0;
    this.hud.innerHTML = `
      <div class="hud-row">
        <div class="bar"><i style="width:${Math.max(0, 100 * p.hp / s.maxHp)}%"></i><span>HP ${Math.max(0, p.hp)}/${s.maxHp}</span></div>
        <div class="bar mp"><i style="width:${s.maxMp ? 100 * p.mp / s.maxMp : 0}%"></i><span>MP ${p.mp}/${s.maxMp}</span></div>
        <span class="hud-meta">D${run.depth} · L${p.level}</span>
        ${pend ? '<button class="lvlup">LEVEL UP</button>' : ''}
      </div>
      <div class="xpbar"><i style="width:${Math.min(100, 100 * xpNow / Math.max(1, xpNeed))}%"></i></div>
      ${chips ? `<div class="chips">${chips}</div>` : ''}`;
    // log
    const msgs = run.messages.slice(-5);
    this.logEl.innerHTML = msgs.map((m, i) => `<div class="${m.cls ? 'm-' + m.cls : ''}${m.turn < run.turn - 1 && i < msgs.length - 2 ? ' old' : ''}">${esc(m.text)}</div>`).join('');
    // quick bar
    this.quickEl.innerHTML = p.quick.map((q, i) => {
      if (!q) return `<div class="qs empty" data-q="${i}">+</div>`;
      if (q.startsWith('a:')) {
        const id = q.slice(2);
        const a = ABILITIES[id];
        if (!a || !playerAbilities(run).some((x) => x.id === id)) return `<div class="qs empty" data-q="${i}">+</div>`;
        const cd = p.cooldowns[id] ?? 0;
        const c = abilityCost(run, id);
        const fc = favorCost(run, id);
        const short = fc ? (p.piety?.favor ?? 0) < fc : p.mp < c.mp;
        return `<div class="qs${cd ? ' cd' : ''}${short ? ' nomp' : ''}" data-q="${i}" data-cd="${cd}">${icon(a.icon, 34)}${fc ? `<span class="qn" style="color:#fd6">${fc}</span>` : c.mp ? `<span class="qn" style="color:#9cf">${c.mp}</span>` : ''}</div>`;
      }
      const base = q.slice(2);
      const items = p.inventory.filter((x) => x.base === base);
      const n = items.reduce((a, b) => a + (b.kind === 'wand' ? b.charges ?? 0 : b.qty), 0);
      const it = items[0];
      const tile = it ? itemTile(run, it) : CONSUMABLES[base] ? 'item/potion/unknown' : 'item/misc/misc_box_of_beasts';
      return `<div class="qs${n ? '' : ' empty'}" data-q="${i}">${icon(tile, 32)}<span class="qn">${n}</span></div>`;
    }).join('');
    // visible enemies
    const foes = enemiesInView(run).sort((a, b) => dist(a, p) - dist(b, p)).slice(0, 5);
    this.foesEl.innerHTML = foes.map((m) => {
      const d = MONSTERS[m.def];
      const col = { trivial: '#888', easy: '#8fdf7a', tough: '#ffb35c', nasty: '#ff6a5c' }[threat(run, m)];
      return `<div class="foe" data-foe="${m.x},${m.y}" style="border-color:${col}">${icon(m.tile ?? d.tile, 26, m.id)}<i style="width:${Math.max(0, 100 * m.hp / m.maxHp)}%"></i></div>`;
    }).join('');
    // context buttons
    const l = cur(run);
    const here = l.items.filter((i) => i.x === p.x && i.y === p.y);
    const t = l.tiles[p.y * l.w + p.x];
    let ctx = '';
    if (here.length) ctx += `<button class="btn" data-c="pickup">${icon(itemTile(run, here[0].item), 24)} Pick up${here.length > 1 ? ` (${here.length})` : ''}</button>`;
    if (t === T.DOWN) ctx += `<button class="btn" data-c="stairs">▼ Descend</button>`;
    if (t === T.UP) ctx += `<button class="btn" data-c="stairs">▲ Ascend</button>`;
    if (t === T.SHOP) ctx += `<button class="btn" data-c="shop">Shop</button>`;
    if (t === T.ALTAR && l.features.some((f) => f.kind === 'shrine' && f.x === p.x && f.y === p.y && !f.used)) ctx += `<button class="btn" data-c="shrine">Shrine</button>`;
    if (t === T.ALTAR && l.features.some((f) => f.kind === 'altar' && f.x === p.x && f.y === p.y)) ctx += `<button class="btn" data-c="altar">Altar</button>`;
    this.ctxEl.innerHTML = ctx;
    for (const b of document.querySelectorAll('#actions .act')) {
      const a = b.getAttribute('data-a');
      b.classList.toggle('on', !!this.auto && (a === this.auto.kind || (a === 'stairs' && this.auto.kind === 'stairs')));
    }
  }

  itemLabel(id: number): string {
    const it = this.run.player.inventory.find((i) => i.id === id);
    return it ? itemName(this.run, it) : '';
  }
}
