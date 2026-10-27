import atlasMap from '../generated/atlas.json';

type Rect = [number, number, number, number];
const MAP = atlasMap as unknown as Record<string, Rect[]>;

export const atlas = { img: null as HTMLImageElement | null, w: 1024, h: 1024, url: '' };

export function loadAtlas(): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    atlas.url = new URL('atlas.png', document.baseURI).href;
    img.onload = () => {
      atlas.img = img; atlas.w = img.naturalWidth; atlas.h = img.naturalHeight;
      document.documentElement.style.setProperty('--atlas', `url(${atlas.url})`);
      resolve();
    };
    img.onerror = () => reject(new Error('atlas failed to load'));
    img.src = atlas.url;
  });
}

export function hasTile(key: string): boolean { return !!MAP[key]; }

export function rectFor(key: string, seed = 0): Rect | null {
  const r = MAP[key];
  if (!r || !r.length) return null;
  return r[Math.abs(seed) % r.length];
}

export function variantCount(key: string): number { return MAP[key]?.length ?? 0; }

/** Draws a tile into a size x size cell at (dx, dy). Oversized sprites are anchored bottom-centre. */
export function drawTile(ctx: CanvasRenderingContext2D, key: string, seed: number, dx: number, dy: number, size: number, alpha = 1) {
  const r = rectFor(key, seed);
  if (!r || !atlas.img) return false;
  const [sx, sy, sw, sh] = r;
  const scale = size / 32;
  const w = sw * scale, h = sh * scale;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(atlas.img, sx, sy, sw, sh, Math.round(dx + (size - w) / 2), Math.round(dy + size - h), Math.round(w), Math.round(h));
  if (alpha !== 1) ctx.globalAlpha = 1;
  return true;
}

/** An inline sprite for the DOM. */
export function icon(key: string, size = 32, seed = 0): string {
  const r = rectFor(key, seed);
  if (!r) return `<span class="ico" style="width:${size}px;height:${size}px"></span>`;
  const [sx, sy, sw, sh] = r;
  const scale = size / Math.max(sw, sh);
  return `<span class="ico" style="width:${Math.round(sw * scale)}px;height:${Math.round(sh * scale)}px;background-size:${atlas.w * scale}px ${atlas.h * scale}px;background-position:${-sx * scale}px ${-sy * scale}px"></span>`;
}

/** Several layered sprites (paper doll) as one DOM element. */
export function stackIcon(keys: string[], size = 32): string {
  return `<span style="position:relative;display:inline-block;width:${size}px;height:${size}px;flex:none">${keys.map((k) => `<span style="position:absolute;left:0;top:0">${icon(k, size)}</span>`).join('')}</span>`;
}
