import './style.css';
import { loadAtlas } from './ui/tiles';
import { App } from './ui/app';

async function main() {
  const root = document.getElementById('app')!;
  root.innerHTML = '<div class="screen"><div class="title-wrap"><div class="logo" style="font-size:28px">Loading…</div></div></div>';
  try {
    await loadAtlas();
  } catch (e) {
    root.innerHTML = `<div class="screen"><div class="title-wrap">Could not load the tiles. Check your connection and reload.</div></div>`;
    return;
  }
  const app = new App(root);
  app.title();
}

// stop iOS double-tap zoom and pull-to-refresh
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if ((e.target as HTMLElement).closest('.panel-b, .screen')) return; e.preventDefault(); }, { passive: false });

main();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline play is optional */ });
}
