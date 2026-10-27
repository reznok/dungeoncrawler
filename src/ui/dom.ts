export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * `foot`: extra buttons for the bottom bar of a bottom sheet; they sit right of its Close button.
 * `shield`: swallow every tap for the first SHIELD_MS, so a thumb mashing Fight cannot pick something in a sheet the game
 * opened on its own (level-up, shop, notes...). Defaults to `panelDefaults.shield`, which `GameUI.showPopups` sets.
 */
export interface PanelOpts { center?: boolean; onClose?: () => void; noClose?: boolean; tabs?: string; foot?: string; shield?: boolean }

export const SHIELD_MS = 500;
export const panelDefaults = { shield: false };
let lastClose = -1e9;
/** ms since an overlay last closed: the bars under a sheet ignore the taps that follow a close for a moment. */
export function sinceOverlayClose(): number { return performance.now() - lastClose; }

/** Opens a bottom sheet (or centred dialog). Bottom sheets get a Close bar at the bottom, in reach of the thumb. Returns the body element and a close function. */
export function openPanel(root: HTMLElement, title: string, body: string, opts: PanelOpts = {}): { el: HTMLElement; body: HTMLElement; close: () => void } {
  const ov = el('div', 'overlay');
  if (opts.shield ?? panelDefaults.shield) {
    const until = performance.now() + SHIELD_MS;
    ov.classList.add('shielded');
    setTimeout(() => ov.classList.remove('shielded'), SHIELD_MS);
    ov.addEventListener('click', (e) => { if (performance.now() < until) { e.stopPropagation(); e.preventDefault(); } }, true);
  }
  if (opts.center) ov.style.alignItems = 'center';
  const panel = el('div', 'panel' + (opts.center ? ' center' : ''));
  const foot = !opts.center && !opts.noClose ? `<div class="panel-f">${opts.foot ?? ''}<button class="btn" data-close>Close</button></div>` : '';
  panel.innerHTML = `<div class="panel-h"><h3>${title}</h3>${opts.noClose ? '' : '<button class="x" data-close>✕</button>'}</div>${opts.tabs ?? ''}<div class="panel-b">${body}</div>${foot}`;
  ov.appendChild(panel);
  root.appendChild(ov);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    lastClose = performance.now();
    ov.remove();
    opts.onClose?.();
  };
  ov.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === ov && !opts.noClose) close();
    if (t.closest('[data-close]')) close();
  });
  return { el: panel, body: panel.querySelector('.panel-b') as HTMLElement, close };
}

export function toast(root: HTMLElement, text: string, ms = 1400, cls = '') {
  const t = el('div', 'toast' + (cls ? ' ' + cls : ''), esc(text));
  root.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
