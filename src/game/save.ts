import type { Run } from '../core/types';
import { SAVE_VERSION } from './run';
import { view } from './state';
import { updateFov } from './fov';

const KEY = 'dc-save-v1';
const HALL = 'dc-hall-v1';
const SETTINGS = 'dc-settings-v1';

function store(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function saveRun(run: Run) {
  const s = store();
  if (!s) return;
  try {
    if (run.over) { s.removeItem(KEY); return; }
    s.setItem(KEY, JSON.stringify(run));
  } catch (e) {
    console.warn('save failed', e);
  }
}

export function loadRun(): Run | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as Run;
    if (run.version !== SAVE_VERSION) return null;
    view.rng = null;
    updateFov(run);
    return run;
  } catch (e) {
    console.warn('load failed', e);
    return null;
  }
}

export function hasSave(): boolean { return !!store()?.getItem(KEY); }
export function deleteSave() { store()?.removeItem(KEY); }

export interface HallEntry { name: string; ancestry: string; calling: string; level: number; depth: number; turns: number; result: 'dead' | 'won'; killedBy?: string; date: number; kills: number }

export function hallOfFame(): HallEntry[] {
  try { return JSON.parse(store()?.getItem(HALL) ?? '[]'); } catch { return []; }
}
export function recordRun(e: HallEntry) {
  const list = hallOfFame();
  list.unshift(e);
  try { store()?.setItem(HALL, JSON.stringify(list.slice(0, 30))); } catch { /* ignore */ }
}

export interface Settings {
  zoom: number; autoPickup: boolean; confirmStairs: boolean; seenIntro: boolean;
  /** Tapping a targeted ability fires at its default target at once instead of arming it. */
  quickCast: boolean;
  haptics: boolean;
  /** Auto-explore also picks up weapons, armour and jewellery it walks onto. */
  autoPickupGear: boolean;
  seenQuickHint: boolean;
}
export function loadSettings(): Settings {
  const d: Settings = { zoom: 1, autoPickup: true, confirmStairs: false, seenIntro: false, quickCast: false, haptics: true, autoPickupGear: true, seenQuickHint: false };
  try { return { ...d, ...JSON.parse(store()?.getItem(SETTINGS) ?? '{}') }; } catch { return d; }
}
export function saveSettings(s: Settings) { try { store()?.setItem(SETTINGS, JSON.stringify(s)); } catch { /* ignore */ } }
