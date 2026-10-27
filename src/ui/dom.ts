export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export interface PanelOpts { center?: boolean; onClose?: () => void; noClose?: boolean; tabs?: string }

/** Opens a bottom sheet (or centred dialog). Returns the body element and a close function. */
export function openPanel(root: HTMLElement, title: string, body: string, opts: PanelOpts = {}): { el: HTMLElement; body: HTMLElement; close: () => void } {
  const ov = el('div', 'overlay');
  if (opts.center) ov.style.alignItems = 'center';
  const panel = el('div', 'panel' + (opts.center ? ' center' : ''));
  panel.innerHTML = `<div class="panel-h"><h3>${title}</h3>${opts.noClose ? '' : '<button class="x" data-close>✕</button>'}</div>${opts.tabs ?? ''}<div class="panel-b">${body}</div>`;
  ov.appendChild(panel);
  root.appendChild(ov);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
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

export function toast(root: HTMLElement, text: string, ms = 1400) {
  const t = el('div', 'toast', esc(text));
  root.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
