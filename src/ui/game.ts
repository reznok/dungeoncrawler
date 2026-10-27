import type { Monster, Run } from '../core/types';
import { dist, type Pos } from '../core/geom';
import { ABILITIES } from '../data/abilities';
import { CONSUMABLES } from '../data/items';
import { STATUSES } from '../data/statuses';
import { T, TERRAIN } from '../data/terrain';
import { act, popups, canFireAt, type Action } from '../game/turn';
import { exploreStep, fightStep, restStep, stairsStep, travelStep, enemiesInView, hostileAt } from '../game/explore';
import { actorAt, cur, isVisible, msg, view } from '../game/state';
import { playerStats, xpForLevel } from '../game/stats';
import { abilityCost, canUseAbility, los } from '../game/abilities';
import { itemTile, itemName } from '../game/items';
import { playerAbilities, favorCost } from '../game/progression';
import { saveRun, loadSettings, saveSettings } from '../game/save';
import { findPath } from '../world/path';
import { Renderer, ZOOM_CELLS } from './renderer';
import { MONSTERS } from '../data/monsters';
import { threat } from '../game/combat';
import { el, esc, toast, panelDefaults, sinceOverlayClose } from './dom';
import { icon } from './tiles';
import * as P from './panels';

type Auto = null | { kind: 'explore' | 'rest' | 'fight' | 'stairs' | 'travel'; dest?: Pos; steps: number; target?: Monster; known?: Set<number> };
/**
 * A pending targeted action. `key` is the quick-bar key ('a:<ability>' / 'i:<itemBase>') that arms it: tapping that slot
 * again fires. `tile`: any tile in range is a fair pick (fireball, blink). `foes: false`: hostiles are not suggested as
 * targets (blink), `initial` is used instead. `ability`: re-checked (MP, cooldown) before firing. `cost`: shown in the strip.
 */
export interface Targeting {
  label: string; range: number; self?: boolean; onPick: (p: Pos) => void; initial: Pos | null;
  key?: string; tile?: boolean; foes?: boolean; ability?: string; cost?: string; icon?: string;
}

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
  mapBtn!: HTMLElement;
  wrapEl!: HTMLElement;
  auto: Auto = null;
  targeting: Targeting | null = null;
  /** The monster last aimed at; the default target while it stays valid (not saved). */
  lastTargetId: number | null = null;
  lastHp = 0;
  lastLevel = 0;
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
    this.lastHp = run.player.hp;
    this.lastLevel = run.player.level;
    this.build();
    this.renderer.setZoom(ZOOM_CELLS[this.settings.zoom] ?? 13);
    requestAnimationFrame((t) => this.frame(t));
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onHide);
    this.refresh();
    if (!this.settings.seenIntro) { this.settings.seenIntro = true; saveSettings(this.settings); P.help(this); }
    else this.showPopups();
    setTimeout(this.quickHint, 800);
  }

  /** First run with the quick bar: say how to change a slot, once the screen is free of panels. */
  quickHint = () => {
    if (!this.alive || this.settings.seenQuickHint) return;
    if (document.querySelector('.overlay')) { setTimeout(this.quickHint, 1000); return; }
    this.settings.seenQuickHint = true;
    saveSettings(this.settings);
    toast(this.root, 'Hold a slot to change it', 3200, 'hint');
  };

  buzz(ms: number) {
    if (!this.settings.haptics) return;
    try { navigator.vibrate?.(ms); } catch { /* not supported */ }
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
    const wrap = el('div'); wrap.id = 'mapwrap'; this.wrapEl = wrap;
    this.canvas = el('canvas'); this.canvas.id = 'map';
    this.logEl = el('div'); this.logEl.id = 'log';
    this.ctxEl = el('div'); this.ctxEl.id = 'ctx';
    this.bannerEl = el('div'); this.bannerEl.id = 'banner'; this.bannerEl.style.display = 'none';
    this.minimap = el('canvas'); this.minimap.id = 'minimap'; this.minimap.style.display = 'none';
    this.foesEl = el('div'); this.foesEl.id = 'foes';
    const histBtn = el('button', 'mapbtn', icon('gui/commands/message_history', 24)); histBtn.id = 'histbtn'; histBtn.setAttribute('aria-label', 'Message history');
    this.mapBtn = el('button', 'mapbtn', icon('gui/commands/display_map', 24)); this.mapBtn.id = 'mapbtn'; this.mapBtn.setAttribute('aria-label', 'Map');
    wrap.append(this.canvas, this.logEl, histBtn, this.ctxEl, this.foesEl, this.bannerEl, this.minimap, this.mapBtn);
    this.quickEl = el('div'); this.quickEl.id = 'quick';
    const actions = el('div'); actions.id = 'actions';
    const A = (id: string, ico: string, label: string) => `<div class="act" data-a="${id}">${icon(ico, 24)}<span>${label}</span></div>`;
    actions.innerHTML =
      A('explore', 'gui/commands/explore', 'Explore') + A('fight', 'gui/commands/autofight', 'Fight') + A('rest', 'gui/commands/resting', 'Rest') +
      A('stairs', 'gui/commands/find_downstair', 'Stairs') + A('bag', 'gui/commands/inventory', 'Bag') + A('menu', 'gui/commands/game_menu', 'Menu');
    r.append(this.hud, wrap, this.quickEl, actions);
    this.renderer = new Renderer(this.canvas);
    this.renderer.resize();
    // a tap right after a sheet closes is the same mashing thumb: it must not fall through to Fight
    const settled = () => sinceOverlayClose() > 250;
    actions.addEventListener('click', (e) => {
      if (!settled()) return;
      const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
      if (a) this.onButton(a);
    });
    this.quickEl.addEventListener('click', (e) => {
      if (!settled()) return;
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
    histBtn.addEventListener('click', () => P.messageLog(this));
    this.mapBtn.addEventListener('click', () => this.toggleMinimap());
    this.ctxEl.addEventListener('click', (e) => {
      if (!settled()) return;
      const b = (e.target as HTMLElement).closest('[data-c]')?.getAttribute('data-c');
      if (b === 'pickup') this.doAct({ t: 'pickup' });
      if (b === 'stairs') this.doAct({ t: 'stairs' });
      if (b === 'shop') P.shop(this);
      if (b === 'altar') { const f = cur(this.run).features.find((x) => x.kind === 'altar' && x.x === this.run.player.x && x.y === this.run.player.y); if (f) P.patron(this, f.id); }
      if (b === 'shrine') { const f = cur(this.run).features.find((x) => x.kind === 'shrine' && x.x === this.run.player.x && x.y === this.run.player.y); if (f) P.shrine(this, f.id); }
    });
    this.bannerEl.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-cancel]')) this.cancelTarget();
      else if (t.closest('[data-fire]')) this.fireTarget();
    });
    this.minimap.addEventListener('click', () => { if (this.showMinimap) this.toggleMinimap(); });
    this.foesEl.addEventListener('click', (e) => {
      const f = (e.target as HTMLElement).closest('[data-foe]')?.getAttribute('data-foe');
      if (!f) return;
      const [x, y] = f.split(',').map(Number);
      if (!this.targeting) { P.examine(this, { x, y }); return; }
      const m = this.targetFoes().find((o) => o.x === x && o.y === y);
      if (m) this.setTarget(m);
      else toast(this.root, dist({ x, y }, this.run.player) > this.targeting.range ? 'Out of range' : 'Not in sight');
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
      if (d > 26 && this.targeting) {
        // while aiming, a sideways swipe changes the target instead of moving
        if (Math.abs(dx) > Math.abs(dy)) this.cycleTarget(dx > 0 ? 1 : -1);
        return;
      }
      if (d > 26) {
        const ang = Math.atan2(dy, dx);
        const oct = Math.round(ang / (Math.PI / 4));
        const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
        const [mx, my] = dirs[(oct + 8) % 8];
        this.stopAuto();
        this.doAct({ t: 'move', dx: mx, dy: my });
        return;
      }
      if (sinceOverlayClose() > 250) this.onTap(this.renderer.cellAt(this.run, s0.x, s0.y));
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
      if (tg.self) { this.pick(p); return; }
      if (cell.x === p.x && cell.y === p.y) { this.cancelTarget(); return; }
      if (dist(cell, p) > tg.range) { toast(this.root, 'Out of range'); return; }
      this.pick(cell);
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
      if (m.friendly && dist(m, p) <= 1 && m.def === 'baker') { P.baker(this); return; }
      if (m.friendly && dist(m, p) <= 1 && m.def === 'bard') { P.bard(this); return; }
      if (dist(cell, p) <= 1) return this.doAct({ t: 'move', dx: cell.x - p.x, dy: cell.y - p.y });
      if (!m.ally && canFireAt(run, m)) return this.doAct({ t: 'fire', target: cell });
    }
    if (dist(cell, p) === 1 && l.tiles[cell.y * l.w + cell.x] === T.FOUNTAIN) return this.doAct({ t: 'fountain', at: cell });
    if (dist(cell, p) === 1) return this.doAct({ t: 'move', dx: cell.x - p.x, dy: cell.y - p.y });
    if (!l.seen[cell.y * l.w + cell.x]) return;
    this.travelTo(cell);
  }

  /** Auto-travel to a known cell along remembered tiles. */
  travelTo(cell: Pos): boolean {
    const l = cur(this.run);
    const path = findPath(l.w, l.h, this.run.player, cell, (x, y) => !!l.seen[y * l.w + x] && (TERRAIN[l.tiles[y * l.w + x]].walk || l.tiles[y * l.w + x] === T.DOOR));
    if (!path) { toast(this.root, 'No known path'); return false; }
    this.renderer.path = path;
    this.startAuto('travel', cell);
    return true;
  }

  onKey = (e: KeyboardEvent) => {
    if (this.panelOpen || document.querySelector('.overlay')) { if (e.key === 'Escape') (document.querySelector('.overlay [data-close]') as HTMLElement | null)?.click(); return; }
    const k = e.key;
    const dirs: Record<string, [number, number]> = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], k: [0, -1], j: [0, 1], h: [-1, 0], l: [1, 0], y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1],
      '8': [0, -1], '2': [0, 1], '4': [-1, 0], '6': [1, 0], '7': [-1, -1], '9': [1, -1], '1': [-1, 1], '3': [1, 1],
    };
    if (this.targeting && k === 'Escape') { this.cancelTarget(); return; }
    if (this.targeting && (k === 'Enter' || k === 'f')) { this.fireTarget(); return; }
    if (this.targeting && k === 'Tab') { e.preventDefault(); this.cycleTarget(e.shiftKey ? -1 : 1); return; }
    if (dirs[k] && this.targeting) this.cancelTarget();
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
    this.mapBtn.style.display = this.showMinimap ? 'none' : '';
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
    const p = run.player;
    if (run.over === 'dead') this.buzz(80);
    else if (p.level > this.lastLevel) this.buzz(30);
    else if (p.hp < this.lastHp) this.buzz(12);
    this.lastHp = p.hp;
    this.lastLevel = p.level;
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
    // the game opened this, not the player: its sheet ignores taps for a moment (see openPanel's shield)
    panelDefaults.shield = true;
    try { this.openPopup(pop, next); } finally { panelDefaults.shield = false; }
  }

  private openPopup(pop: (typeof popups)[number], next: () => void) {
    switch (pop.type) {
      case 'note': P.note(this, pop.title, pop.text, next); break;
      case 'story': P.story(this, pop.title, pop.text, next); break;
      case 'shop': P.shop(this, next); break;
      case 'shrine': P.shrine(this, pop.id, next); break;
      case 'baker': P.baker(this, next); break;
      case 'levelup': P.levelUp(this, next); break;
      case 'patron': P.patron(this, pop.id, next); break;
      case 'bard': P.bard(this, next); break;
    }
  }

  useQuick(i: number) {
    const key = this.run.player.quick[i];
    const tg = this.targeting;
    if (tg) {
      // the armed slot fires; any other slot drops the aim and does its own thing
      if (key && key === tg.key) { this.fireTarget(); return; }
      this.cancelTarget();
    }
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
    const c = abilityCost(this.run, id), fc = favorCost(this.run, id);
    this.startTarget({
      label: a.name, range: a.kind === 'strike' || a.kind === 'drain' ? 1 : a.range, initial: null,
      key: 'a:' + id, ability: id, icon: a.icon, tile: a.target !== 'enemy',
      // blinks go to empty spots; Shadow Step is the blink that strikes whoever is there
      foes: (a.kind !== 'blink' && a.kind !== 'teleport') || id === 'shadowstep',
      cost: fc ? `${fc} favour` : c.mp ? `${c.mp} MP` : '',
      onPick: (pos) => this.doAct({ t: 'ability', id, target: pos }),
    });
  }

  /** Hostiles the armed action can hit: visible, in range and in line of sight, nearest first. */
  targetFoes(): Monster[] {
    const t = this.targeting, run = this.run, p = run.player;
    if (!t || t.foes === false) return [];
    return enemiesInView(run).filter((m) => dist(m, p) <= t.range && los(run, p, m)).sort((a, b) => dist(a, p) - dist(b, p) || a.id - b.id);
  }

  /** Arms a targeted action: the default target is the last monster aimed at if still valid, else the nearest. */
  startTarget(t: Targeting) {
    this.stopAuto();
    this.targeting = t;
    const foes = this.targetFoes();
    const m = foes.find((o) => o.id === this.lastTargetId) ?? foes[0];
    const target = t.foes === false ? t.initial : m ? { x: m.x, y: m.y } : null;
    if (this.settings.quickCast && target && t.foes !== false && !(t.ability && canUseAbility(this.run, t.ability))) { this.pick(target); return; }
    this.renderer.cursor = target;
    this.refresh();
  }

  setTarget(m: Monster) {
    this.renderer.cursor = { x: m.x, y: m.y };
    this.lastTargetId = m.id;
    this.refresh();
  }

  cycleTarget(dir: number) {
    const foes = this.targetFoes();
    if (!foes.length) { toast(this.root, 'No target in range'); return; }
    const c = this.renderer.cursor;
    const i = c ? foes.findIndex((m) => m.x === c.x && m.y === c.y) : -1;
    this.setTarget(foes[i < 0 ? 0 : (i + dir + foes.length) % foes.length]);
  }

  /** Fires the armed action at `pos`, remembering the monster there as the next default target. */
  pick(pos: Pos) {
    const t = this.targeting;
    if (!t) return;
    const m = hostileAt(this.run, pos);
    if (m) this.lastTargetId = m.id;
    this.cancelTarget();
    t.onPick(pos);
  }

  /** Fire button / second tap on the armed slot / Enter. */
  fireTarget() {
    const t = this.targeting, c = this.renderer.cursor;
    if (!t) return;
    const why = t.ability ? canUseAbility(this.run, t.ability) : null;
    if (why) { toast(this.root, why, 1800); this.cancelTarget(); return; }
    if (!c) { toast(this.root, t.tile ? 'Tap a tile in range' : 'No target in range'); return; }
    this.pick(c);
  }

  cancelTarget() {
    this.targeting = null;
    this.renderer.cursor = null;
    this.refresh();
  }

  /** Targeting strip above the quick bar, range overlay and camera; called from refresh(). */
  drawTarget() {
    const t = this.targeting, r = this.renderer, run = this.run, p = run.player;
    this.wrapEl.classList.toggle('tgt', !!t);
    if (!t) { this.bannerEl.style.display = 'none'; r.range = null; r.focus = null; return; }
    const foes = this.targetFoes();
    r.range = { r: t.range, foes: foes.map((m) => ({ x: m.x, y: m.y })) };
    const c = r.cursor;
    const why = t.ability ? canUseAbility(run, t.ability) : null;
    let what: string;
    if (why) what = `<span class="m-warn">${esc(why)}</span>`;
    else if (!c) what = t.foes === false ? `Tap a spot within ${t.range}` : t.tile ? 'No target in range · tap a tile' : 'No target in range';
    else {
      const m = actorAt(run, c.x, c.y);
      const d = dist(c, p);
      const nm = m && m !== p && isVisible(run, c.x, c.y) ? (m as Monster).name ?? MONSTERS[(m as Monster).def].name : 'that spot';
      what = `→ ${esc(nm)} · ${d} tile${d === 1 ? '' : 's'}`;
    }
    const ico = t.icon ? icon(t.icon, 32) : '';
    this.bannerEl.innerHTML = `${ico}<div class="tg-t"><div><b>${esc(t.label)}</b>${t.cost ? ` <span class="tg-c">${esc(t.cost)}</span>` : ''}</div><div class="tg-w">${what}</div></div>` +
      `<button class="btn tg-b primary" data-fire ${c && !why ? '' : 'disabled'}>Fire</button><button class="btn tg-b" data-cancel aria-label="Cancel">✕</button>`;
    this.bannerEl.style.display = 'flex';
    // keep a far target on screen: centre between the two, never losing the player
    r.focus = null;
    if (c) {
      const hv = r.halfView(), dx = c.x - p.x, dy = c.y - p.y;
      const down = hv.h - 2; // the strip and log cover the bottom rows
      if (Math.abs(dx) > hv.w || dy < -hv.h || dy > down) {
        const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
        r.focus = { x: p.x + cl(dx / 2, -hv.w, hv.w), y: p.y + cl(dy / 2, -down, hv.h) };
      }
    }
  }

  // ------------------------------------------------------------------ auto

  toggleAuto(kind: 'explore' | 'rest' | 'stairs') {
    if (this.auto?.kind === kind) { this.stopAuto(); return; }
    this.startAuto(kind);
  }

  startAuto(kind: NonNullable<Auto>['kind'], dest?: Pos) {
    this.auto = { kind, dest, steps: 0 };
    // travelling to a hostile is walking into a fight: only a different enemy or damage stops it
    const target = kind === 'travel' && dest ? hostileAt(this.run, dest) : undefined;
    if (target) { this.auto.target = target; this.auto.known = new Set(enemiesInView(this.run).map((m) => m.id)); }
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
      case 'travel': {
        const tg = a.target;
        if (tg) {
          if (tg.hp <= 0 || !enemiesInView(run).includes(tg) || dist(tg, run.player) <= 1) { this.stopAuto(); return; }
          if (tg.x !== a.dest!.x || tg.y !== a.dest!.y) { a.dest = { x: tg.x, y: tg.y }; this.renderer.path = []; }
        }
        step = travelStep(run, a.dest!); if (!step) step = ''; break;
      }
    }
    if (typeof step === 'string' || !step) {
      if (step) msg(run, step, 'dim');
      this.stopAuto();
      return;
    }
    if (a.kind === 'travel' && !a.target && enemiesInView(run).length && a.steps > 0) { this.stopAuto(); return; }
    const hpBefore = run.player.hp;
    const ok = act(run, step);
    a.steps++;
    if (a.kind === 'travel' && this.renderer.path.length) this.renderer.path.shift();
    const interrupted = a.target ? enemiesInView(run).some((m) => m !== a.target && !a.known!.has(m.id)) : view.interrupt;
    if (!ok || interrupted || run.player.hp < hpBefore) { this.after(); this.stopAuto(); return; }
    if (a.kind === 'stairs' && step.t === 'stairs') { this.after(); this.stopAuto(); return; }
    // gear is not auto-picked by the game; explore takes it with it (a full pack stops here with "Your pack is full.")
    if (a.kind === 'explore' && this.settings.autoPickupGear && this.unvisitedItemsHere()) {
      if (!act(run, { t: 'pickup' }) || view.interrupt || run.player.hp < hpBefore) { this.after(); this.stopAuto(); return; }
    }
    this.after();
  }

  /** Items on the player's tile that explore has not already walked away from (so dropped junk is not picked up again). */
  unvisitedItemsHere(): boolean {
    const p = this.run.player;
    return cur(this.run).items.some((fi) => fi.x === p.x && fi.y === p.y && !(fi as { visited?: boolean }).visited);
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
        <div class="bar${p.hp < s.maxHp * 0.3 ? ' low' : ''}"><i style="width:${Math.max(0, 100 * p.hp / s.maxHp)}%"></i><span>HP ${Math.max(0, p.hp)}/${s.maxHp}</span></div>
        <div class="bar mp"><i style="width:${s.maxMp ? 100 * p.mp / s.maxMp : 0}%"></i><span>MP ${p.mp}/${s.maxMp}</span></div>
        <span class="hud-meta">D${run.depth} · L${p.level}<span class="hud-xp"> · ${Math.max(0, xpNow)}/${xpNeed}</span></span>
        ${pend ? '<button class="lvlup">LEVEL UP</button>' : ''}
      </div>
      <div class="xpbar"><i style="width:${Math.min(100, 100 * xpNow / Math.max(1, xpNeed))}%"></i></div>
      ${chips ? `<div class="chips">${chips}</div>` : ''}`;
    // log
    const msgs = run.messages.slice(-4);
    this.logEl.innerHTML = msgs.map((m, i) => `<div class="${m.cls ? 'm-' + m.cls : ''}${m.turn < run.turn - 1 && i < msgs.length - 2 ? ' old' : ''}">${esc(m.text)}</div>`).join('');
    // quick bar
    const armed = this.targeting?.key;
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
        return `<div class="qs${cd ? ' cd' : ''}${short ? ' nomp' : ''}${q === armed ? ' armed' : ''}" data-q="${i}" data-cd="${cd}">${icon(a.icon, 34)}${fc ? `<span class="qn" style="color:#fd6">${fc}</span>` : c.mp ? `<span class="qn" style="color:#9cf">${c.mp}</span>` : ''}</div>`;
      }
      const base = q.slice(2);
      const items = p.inventory.filter((x) => x.base === base);
      const n = items.reduce((a, b) => a + (b.kind === 'wand' ? b.charges ?? 0 : b.qty), 0);
      const it = items[0];
      const tile = it ? itemTile(run, it) : CONSUMABLES[base] ? 'item/potion/unknown' : 'item/misc/misc_box_of_beasts';
      return `<div class="qs${n ? '' : ' empty'}${q === armed ? ' armed' : ''}" data-q="${i}">${icon(tile, 32)}<span class="qn">${n}</span></div>`;
    }).join('');
    // visible enemies
    const foes = enemiesInView(run).sort((a, b) => dist(a, p) - dist(b, p)).slice(0, 5);
    const aimable = this.targeting ? new Set(this.targetFoes()) : null;
    const cursor = this.renderer.cursor;
    this.foesEl.innerHTML = foes.map((m) => {
      const d = MONSTERS[m.def];
      const col = { trivial: '#888', easy: '#8fdf7a', tough: '#ffb35c', nasty: '#ff6a5c' }[threat(run, m)];
      const cls = aimable ? (aimable.has(m) ? '' : ' far') + (cursor && cursor.x === m.x && cursor.y === m.y ? ' tgt' : '') : '';
      return `<div class="foe${cls}" data-foe="${m.x},${m.y}" style="border-color:${col}">${icon(m.tile ?? d.tile, 26, m.id)}<i style="width:${Math.max(0, 100 * m.hp / m.maxHp)}%"></i></div>`;
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
    this.drawTarget();
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
