import type { Run, Monster } from '../core/types';
import { hash2, type Pos } from '../core/geom';
import { T, THEMES, TERRAIN_TILES } from '../data/terrain';
import { MONSTERS } from '../data/monsters';
import { ARMOURS, WEAPONS } from '../data/items';
import { cur, view } from '../game/state';
import { fxQueue, type Fx } from '../game/fx';
import { itemTile } from '../game/items';
import { playerStats, ancestryOf } from '../game/stats';
import { sensedMonsters } from '../game/fov';
import { SHRINES } from '../game/levels';
import { PATRONS } from '../data/patrons';
import { threat } from '../game/combat';
import { drawTile } from './tiles';

const SHOP_TILES: Record<string, string> = {
  general: 'dngn/shops/shop_general', weapon: 'dngn/shops/shop_weapon', armour: 'dngn/shops/shop_armour', potions: 'dngn/shops/shop_potions',
  scrolls: 'dngn/shops/shop_scrolls', jewellery: 'dngn/shops/shop_jewellery', wands: 'dngn/shops/shop_wands',
};
const TRAP_TILES: Record<string, string> = {
  dart: 'dngn/traps/bolt', net: 'dngn/traps/net', teleport: 'dngn/traps/teleport', alarm: 'dngn/traps/alarm', pie: 'dngn/traps/pressure_plate', shaft: 'dngn/traps/shaft', fire: 'dngn/traps/zot',
};
const CLOUD_TILES: Record<string, string> = {
  smoke: 'effect/cloud_grey_smoke', poison: 'effect/cloud_poison*', fire: 'effect/cloud_fire*', ink: 'effect/cloud_black_smoke',
};
const THREAT_TILES: Record<string, string> = {
  trivial: 'misc/sensed_monster_trivial', easy: 'misc/sensed_monster_easy', tough: 'misc/sensed_monster_tough', nasty: 'misc/sensed_monster_nasty',
};

export function dollKeys(run: Run): string[] {
  const p = run.player;
  const keys: string[] = [];
  const cloak = p.equip.cloak && ARMOURS[p.equip.cloak.base]?.doll;
  if (cloak) keys.push(cloak);
  keys.push(ancestryOf(p).tile);
  const feet = p.equip.feet && ARMOURS[p.equip.feet.base]?.doll; if (feet) keys.push(feet);
  const body = p.equip.body && ARMOURS[p.equip.body.base]?.doll; if (body) keys.push(body);
  const head = p.equip.head && ARMOURS[p.equip.head.base]?.doll; if (head) keys.push(head);
  const w = p.equip.weapon && WEAPONS[p.equip.weapon.base]?.doll; if (w) keys.push(w);
  const off = p.equip.offhand && ARMOURS[p.equip.offhand.base]?.doll; if (off) keys.push(off);
  return keys;
}

interface LiveFx { fx: Fx; start: number; dur: number }

/** Tiles across the screen for the saved zoom setting: 0 Far, 1 Normal, 2 Close. */
export const ZOOM_CELLS = [16, 13, 10];

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr = 1;
  cells = 13;
  ts = 32; // device px per tile
  ox = 0; oy = 0; // device px offset of map cell (0,0)
  live: LiveFx[] = [];
  cursor: Pos | null = null;
  path: Pos[] = [];
  shake = 0;
  /** Camera centre (in cells, may be fractional) instead of the player, e.g. to keep a far target on screen. */
  focus: Pos | null = null;
  /** While targeting: tiles beyond `r` (Chebyshev) from the player are dimmed and `foes` get a gold outline. */
  range: { r: number; foes: Pos[] } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.ts = Math.max(16, Math.floor(this.canvas.width / this.cells));
  }

  setZoom(cells: number) { this.cells = cells; this.resize(); }

  busy(now: number): boolean { return this.live.some((l) => l.fx.kind === 'bolt' && now - l.start < l.dur); }

  pullFx(now: number, depth: number) {
    while (fxQueue.length) {
      const fx = fxQueue.shift()!;
      if ('depth' in fx && fx.depth !== depth) continue;
      let dur = 300;
      if (fx.kind === 'bolt') dur = Math.min(320, 40 * fx.path.length + 40);
      if (fx.kind === 'num') dur = 900;
      if (fx.kind === 'flash') dur = 260;
      if (fx.kind === 'shake') { this.shake = now + 200; continue; }
      // stagger bolts so volleys read as separate shots
      const lastBolt = [...this.live].reverse().find((l) => l.fx.kind === 'bolt');
      const start = fx.kind === 'bolt' && lastBolt && now - lastBolt.start < lastBolt.dur ? lastBolt.start + lastBolt.dur * 0.6 : now;
      this.live.push({ fx, start, dur });
    }
    this.live = this.live.filter((l) => now - l.start < l.dur);
  }

  /** Whole cells visible from the centre to each edge, minus a margin: how far a cell may sit from the camera and still be fully on screen. */
  halfView(): { w: number; h: number } {
    return { w: this.canvas.width / this.ts / 2 - 1, h: this.canvas.height / this.ts / 2 - 1 };
  }

  /** Map cell under a client point. */
  cellAt(run: Run, clientX: number, clientY: number): Pos {
    const r = this.canvas.getBoundingClientRect();
    const x = (clientX - r.left) * this.dpr, y = (clientY - r.top) * this.dpr;
    return { x: Math.floor((x - this.ox) / this.ts), y: Math.floor((y - this.oy) / this.ts) };
  }

  draw(run: Run, now: number) {
    const ctx = this.ctx;
    const l = cur(run);
    const p = run.player;
    const ts = this.ts;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.pullFx(now, run.depth);
    let sx = 0, sy = 0;
    if (this.shake > now) { sx = (Math.random() - 0.5) * ts * 0.2; sy = (Math.random() - 0.5) * ts * 0.2; }
    const cam = this.focus ?? p;
    this.ox = Math.round(this.canvas.width / 2 - (cam.x + 0.5) * ts + sx);
    this.oy = Math.round(this.canvas.height / 2 - (cam.y + 0.5) * ts + sy);
    const x0 = Math.max(0, Math.floor(-this.ox / ts)), y0 = Math.max(0, Math.floor(-this.oy / ts));
    const x1 = Math.min(l.w - 1, Math.ceil((this.canvas.width - this.ox) / ts)), y1 = Math.min(l.h - 1, Math.ceil((this.canvas.height - this.oy) / ts));
    const theme = THEMES[l.theme] ?? THEMES.cellar;
    const vis = view.visible;
    const s = playerStats(run);
    const featAt = new Map<number, (typeof l.features)[number]>();
    for (const f of l.features) featAt.set(f.y * l.w + f.x, f);
    // terrain
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * l.w + x;
      if (!l.seen[i]) continue;
      const dx = this.ox + x * ts, dy = this.oy + y * ts;
      const t = l.tiles[i];
      const h = hash2(x, y, l.depth);
      if (t === T.WALL) drawTile(ctx, theme.wall, h, dx, dy, ts);
      else {
        if (t !== T.DEEP && t !== T.LAVA && t !== T.CHASM) drawTile(ctx, theme.floor, h, dx, dy, ts);
        let key = TERRAIN_TILES[t];
        const f = featAt.get(i);
        if (t === T.SHOP && f) key = SHOP_TILES[f.id] ?? key;
        if (t === T.ALTAR && f) key = (f.kind === 'altar' ? PATRONS[f.id]?.altar : SHRINES[f.id]?.tile) ?? key;
        if (t === T.DOWN && run.depth === 14) key = 'dngn/gateways/enter_zot_open';
        if (key) drawTile(ctx, key, h, dx, dy, ts);
        if (f && f.kind === 'trap' && !f.hidden) drawTile(ctx, TRAP_TILES[f.id] ?? 'dngn/traps/pressure_plate', 0, dx, dy, ts);
        if (f && f.kind === 'chest' && !f.used) drawTile(ctx, 'item/misc/misc_box_of_beasts', 0, dx, dy, ts);
      }
    }
    // items
    for (const fi of l.items) {
      const i = fi.y * l.w + fi.x;
      if (!l.seen[i] || !fi.seen || fi.x < x0 || fi.x > x1 || fi.y < y0 || fi.y > y1) continue;
      drawTile(ctx, itemTile(run, fi.item), fi.item.id, this.ox + fi.x * ts, this.oy + fi.y * ts, ts);
    }
    // fog of war
    ctx.fillStyle = 'rgba(4,2,12,0.58)';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * l.w + x;
      if (l.seen[i] && !vis.has(i)) ctx.fillRect(this.ox + x * ts, this.oy + y * ts, ts, ts);
    }
    // clouds
    for (const c of l.clouds) {
      if (!vis.has(c.y * l.w + c.x)) continue;
      drawTile(ctx, CLOUD_TILES[c.type] ?? 'effect/cloud_grey_smoke', c.turns, this.ox + c.x * ts, this.oy + c.y * ts, ts, 0.85);
    }
    // sensed monsters
    for (const m of sensedMonsters(run)) drawTile(ctx, THREAT_TILES[threat(run, m)], 0, this.ox + m.x * ts, this.oy + m.y * ts, ts);
    // monsters
    for (const m of l.monsters) {
      if (m.hp <= 0 || !vis.has(m.y * l.w + m.x)) continue;
      if (m.statuses.invisible && !s.flags.has('see_invis') && !m.ally) continue;
      this.drawMonster(run, m, ts);
    }
    // targeting: dim everything outside the range square, outline the hostiles that can be targeted
    if (this.range) {
      const r = this.range.r;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.rect(0, 0, this.canvas.width, this.canvas.height);
      ctx.rect(this.ox + (p.x - r) * ts, this.oy + (p.y - r) * ts, (2 * r + 1) * ts, (2 * r + 1) * ts);
      ctx.fill('evenodd');
      ctx.strokeStyle = '#f2c35b';
      ctx.lineWidth = Math.max(1, ts / 20);
      for (const f of this.range.foes) ctx.strokeRect(this.ox + f.x * ts + 1.5, this.oy + f.y * ts + 1.5, ts - 3, ts - 3);
    }
    // player
    const px = this.ox + p.x * ts, py = this.oy + p.y * ts;
    const alpha = p.statuses.invisible ? 0.5 : 1;
    for (const k of dollKeys(run)) drawTile(ctx, k, 0, px, py, ts, alpha);
    // travel path
    if (this.path.length) {
      ctx.fillStyle = 'rgba(242,195,91,0.35)';
      for (const q of this.path) ctx.fillRect(this.ox + q.x * ts + ts * 0.4, this.oy + q.y * ts + ts * 0.4, ts * 0.2, ts * 0.2);
    }
    // cursor
    if (this.cursor) {
      ctx.strokeStyle = '#ff5c8a';
      ctx.lineWidth = Math.max(2, ts / 14);
      ctx.strokeRect(this.ox + this.cursor.x * ts + 2, this.oy + this.cursor.y * ts + 2, ts - 4, ts - 4);
    }
    this.drawFx(now, ts);
  }

  private drawMonster(run: Run, m: Monster, ts: number) {
    const ctx = this.ctx;
    const def = MONSTERS[m.def];
    const dx = this.ox + m.x * ts, dy = this.oy + m.y * ts;
    if (m.ally) drawTile(ctx, 'misc/halo_friendly', 0, dx, dy, ts);
    if (m.friendly) drawTile(ctx, 'misc/halo_neutral', 0, dx, dy, ts);
    const ghost = m.statuses.invisible ? 0.45 : 1;
    drawTile(ctx, m.tile ?? def.tile, m.id, dx, dy, ts, ghost);
    // health bar
    if (m.hp < m.maxHp) {
      const f = Math.max(0, m.hp / m.maxHp);
      ctx.fillStyle = '#000a';
      ctx.fillRect(dx + 2, dy + ts - 5 * (ts / 32), ts - 4, 4 * (ts / 32));
      ctx.fillStyle = m.ally ? '#6fdc6f' : f > 0.5 ? '#e0c040' : '#e04030';
      ctx.fillRect(dx + 2, dy + ts - 5 * (ts / 32), (ts - 4) * f, 4 * (ts / 32));
    }
    if (!m.awake && !m.ally && !m.friendly) {
      ctx.fillStyle = '#9cf';
      ctx.font = `${Math.round(ts * 0.32)}px 'Pixelify Sans', monospace`;
      ctx.fillText('z', dx + ts * 0.72, dy + ts * 0.3);
    }
    if (def.unique && !m.ally) {
      ctx.strokeStyle = '#f2c35b';
      ctx.lineWidth = Math.max(1, ts / 24);
      ctx.strokeRect(dx + 1, dy + 1, ts - 2, ts - 2);
    }
  }

  private drawFx(now: number, ts: number) {
    const ctx = this.ctx;
    for (const lf of this.live) {
      const t = (now - lf.start) / lf.dur;
      if (t < 0) continue;
      const f = lf.fx;
      if (f.kind === 'bolt') {
        if (t > 1 || f.path.length < 2) continue;
        const segs = f.path.length - 1;
        const pos = t * segs;
        const i = Math.min(segs - 1, Math.floor(pos));
        const a = f.path[i], b = f.path[i + 1];
        const k = pos - i;
        const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
        drawTile(ctx, f.tile, Math.floor(now / 60), this.ox + x * ts, this.oy + y * ts, ts);
      } else if (f.kind === 'flash') {
        ctx.fillStyle = f.color;
        ctx.globalAlpha = Math.max(0, 0.55 * (1 - t));
        for (const q of f.at) ctx.fillRect(this.ox + q.x * ts, this.oy + q.y * ts, ts, ts);
        ctx.globalAlpha = 1;
      } else if (f.kind === 'num') {
        const big = f.text.length > 4;
        ctx.font = `700 ${Math.round(ts * (big ? 0.42 : 0.5))}px 'Pixelify Sans', monospace`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = Math.min(1, 2 * (1 - t));
        const x = this.ox + (f.at.x + 0.5) * ts, y = this.oy + (f.at.y + 0.2) * ts - t * ts * 0.8;
        ctx.lineWidth = Math.max(2, ts / 12);
        ctx.strokeStyle = '#000';
        ctx.strokeText(f.text, x, y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, x, y);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
      }
    }
  }

  /** Small overview map. */
  drawMinimap(run: Run, c: HTMLCanvasElement) {
    const l = cur(run);
    const scale = 3;
    if (c.width !== l.w * scale) { c.width = l.w * scale; c.height = l.h * scale; }
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) {
      const i = y * l.w + x;
      if (!l.seen[i]) continue;
      const t = l.tiles[i];
      ctx.fillStyle = t === T.WALL ? '#4a3d52' : t === T.DOWN ? '#ffd23a' : t === T.UP || t === T.EXIT ? '#3ad2ff' : t === T.DEEP || t === T.SHALLOW ? '#2a5aa0' : t === T.LAVA ? '#c0401a' : t === T.SHOP || t === T.ALTAR ? '#e070ff' : '#8a7f78';
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
    for (const m of l.monsters) if (view.visible.has(m.y * l.w + m.x) && !m.ally) { ctx.fillStyle = '#ff4040'; ctx.fillRect(m.x * scale, m.y * scale, scale, scale); }
    ctx.fillStyle = '#fff';
    ctx.fillRect(run.player.x * scale - 1, run.player.y * scale - 1, scale + 2, scale + 2);
  }
}
