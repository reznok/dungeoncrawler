export const T = {
  WALL: 0, FLOOR: 1, DOOR: 2, OPEN_DOOR: 3, DOWN: 4, UP: 5, SHALLOW: 6, DEEP: 7, LAVA: 8,
  TREE: 9, STATUE: 10, ALTAR: 11, SHOP: 12, FOUNTAIN: 13, EXIT: 14, CHASM: 15, GRATE: 16,
} as const;

export interface TerrainDef { name: string; walk: boolean; see: boolean; flyOnly?: boolean; swim?: boolean; desc: string }

export const TERRAIN: TerrainDef[] = [];
TERRAIN[T.WALL] = { name: 'wall', walk: false, see: false, desc: 'Solid rock. Or solid something.' };
TERRAIN[T.FLOOR] = { name: 'floor', walk: true, see: true, desc: 'The floor. Sticky in places.' };
TERRAIN[T.DOOR] = { name: 'closed door', walk: true, see: false, desc: 'A closed door. Walk into it to open it.' };
TERRAIN[T.OPEN_DOOR] = { name: 'open door', walk: true, see: true, desc: 'An open door.' };
TERRAIN[T.DOWN] = { name: 'stairs down', walk: true, see: true, desc: 'Stairs leading deeper. Always deeper.' };
TERRAIN[T.UP] = { name: 'stairs up', walk: true, see: true, desc: 'Stairs leading back up.' };
TERRAIN[T.SHALLOW] = { name: 'shallow water', walk: true, see: true, desc: 'Ankle-deep water. Hard to dodge in.' };
TERRAIN[T.DEEP] = { name: 'deep water', walk: false, see: true, swim: true, desc: 'Deep, dark water. Swimmers and fliers only.' };
TERRAIN[T.LAVA] = { name: 'lava', walk: false, see: true, flyOnly: true, desc: 'Molten rock. It is exactly as hot as it looks.' };
TERRAIN[T.TREE] = { name: 'petrified tree', walk: false, see: false, desc: 'A tree turned to stone. Something is carved in the bark: "R + M 4EVR".' };
TERRAIN[T.STATUE] = { name: 'statue', walk: false, see: true, desc: 'A statue. Its eyes seem to follow you. Statues do that.' };
TERRAIN[T.ALTAR] = { name: 'shrine', walk: true, see: true, desc: 'A shrine to something that is still listening.' };
TERRAIN[T.SHOP] = { name: 'shop', walk: true, see: true, desc: 'A shop. Someone set up a shop down here. Of course they did.' };
TERRAIN[T.FOUNTAIN] = { name: 'fountain', walk: false, see: true, desc: 'A fountain. Quaff from it if you are brave (stand next to it).' };
TERRAIN[T.EXIT] = { name: 'way out', walk: true, see: true, desc: 'The way back to the surface. Mother is not up there.' };
TERRAIN[T.CHASM] = { name: 'chasm', walk: false, see: true, flyOnly: true, desc: 'A drop into darkness.' };
TERRAIN[T.GRATE] = { name: 'iron grate', walk: false, see: true, desc: 'Iron bars. You can see through but not pass.' };

export function walkable(t: number): boolean { return TERRAIN[t]?.walk ?? false; }
export function transparent(t: number): boolean { return TERRAIN[t]?.see ?? false; }

export interface Theme {
  id: string;
  name: string;
  wall: string; floor: string;
  door?: string;
  water?: string;
  gen: ('rooms' | 'caves' | 'mixed' | 'halls')[];
  waterChance: number;
  lavaChance?: number;
  treeChance?: number;
  sight?: number; // darkness: modifies sight radius
}

export const THEMES: Record<string, Theme> = {
  cellar: { id: 'cellar', name: 'The Cellar', wall: 'dngn/wall/brick_brown*', floor: 'dngn/floor/pebble_brown*', gen: ['rooms', 'rooms', 'mixed'], waterChance: 0.15 },
  mould: { id: 'mould', name: 'The Mouldering', wall: 'dngn/wall/wall_stone_lair*', floor: 'dngn/floor/moss*', gen: ['caves', 'mixed', 'caves'], waterChance: 0.3, treeChance: 0.3 },
  drowned: { id: 'drowned', name: 'The Drowned Choir', wall: 'dngn/wall/wall_stone_shoals*', floor: 'dngn/floor/limestone*', gen: ['mixed', 'caves', 'halls'], waterChance: 0.9 },
  ovens: { id: 'ovens', name: 'The Ovens', wall: 'dngn/wall/volcanic_wall*', floor: 'dngn/floor/volcanic_floor*', gen: ['rooms', 'mixed', 'caves'], waterChance: 0, lavaChance: 0.7 },
  unbaked: { id: 'unbaked', name: 'The Unbaked', wall: 'dngn/wall/wall_flesh*', floor: 'dngn/floor/floor_nerves*', gen: ['caves', 'mixed'], waterChance: 0.2, sight: -1 },
  proving: { id: 'proving', name: 'The Proving Chamber', wall: 'dngn/wall/crystal_wall_lightmagenta*', floor: 'dngn/floor/etched*', gen: ['halls'], waterChance: 0 },
  crypt: { id: 'crypt', name: 'The Crypt', wall: 'dngn/wall/crypt*', floor: 'dngn/floor/crypt*', gen: ['rooms'], waterChance: 0 },
  office: { id: 'office', name: 'The Permit Office', wall: 'dngn/wall/stone2_gray*', floor: 'dngn/floor/rect_gray*', gen: ['rooms'], waterChance: 0 },
};

export function themeForDepth(depth: number): Theme {
  if (depth <= 3) return THEMES.cellar;
  if (depth <= 6) return THEMES.mould;
  if (depth <= 9) return THEMES.drowned;
  if (depth <= 12) return THEMES.ovens;
  if (depth <= 14) return THEMES.unbaked;
  return THEMES.proving;
}

export const MAX_DEPTH = 15;

export const TERRAIN_TILES: Record<number, string> = {
  [T.DOOR]: 'dngn/doors/closed_door',
  [T.OPEN_DOOR]: 'dngn/doors/open_door',
  [T.DOWN]: 'dngn/gateways/stone_stairs_down',
  [T.UP]: 'dngn/gateways/stone_stairs_up',
  [T.SHALLOW]: 'dngn/water/shallow_water',
  [T.DEEP]: 'dngn/water/deep_water',
  [T.LAVA]: 'dngn/floor/lava*',
  [T.TREE]: 'dngn/trees/tree_petrified*',
  [T.STATUE]: 'dngn/statues/statue_ancient_hero',
  [T.ALTAR]: 'dngn/altars/unknown',
  [T.SHOP]: 'dngn/shops/shop_general',
  [T.FOUNTAIN]: 'dngn/decor/blue_fountain',
  [T.EXIT]: 'dngn/gateways/exit_dungeon',
  [T.CHASM]: 'dngn/floor/mystic_chasm*',
  [T.GRATE]: 'dngn/grate',
};
