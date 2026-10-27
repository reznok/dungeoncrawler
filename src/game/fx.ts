import type { Pos } from '../core/geom';

export type Fx =
  | { kind: 'bolt'; path: Pos[]; tile: string; depth: number }
  | { kind: 'flash'; at: Pos[]; color: string; depth: number }
  | { kind: 'num'; at: Pos; text: string; color: string; depth: number }
  | { kind: 'shake' };

export const fxQueue: Fx[] = [];
export function pushFx(f: Fx) { fxQueue.push(f); if (fxQueue.length > 60) fxQueue.shift(); }

export const ELEMENT_COLOR: Record<string, string> = {
  phys: '#ddd', fire: '#ff7a2a', cold: '#8ad8ff', poison: '#7dd34a', shock: '#ffef5a', necro: '#b07aff', holy: '#fff6b0', acid: '#c4ff3a', dough: '#f3d29a',
};
