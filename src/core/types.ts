import type { Pos } from './geom';
import type { RngState } from './rng';

export type Element = 'phys' | 'fire' | 'cold' | 'poison' | 'shock' | 'necro' | 'holy' | 'acid' | 'dough';
export type Attr = 'might' | 'agility' | 'wits';
export type Slot = 'weapon' | 'offhand' | 'body' | 'head' | 'feet' | 'cloak' | 'hands' | 'ring1' | 'ring2' | 'ring3' | 'ring4' | 'amulet';

/** Stat modifiers granted by gear, talents, mutations, statuses. All additive. */
export interface Mods {
  maxHp?: number; maxHpPct?: number; maxMp?: number;
  ac?: number; ev?: number; acc?: number;
  dmg?: number; dmgPct?: number; spellPower?: number;
  stealth?: number; sight?: number;
  regen?: number; mpRegen?: number;
  speed?: number; // percent: +20 = 20% faster actions
  moveSpeed?: number; // percent, movement only
  might?: number; agility?: number; wits?: number;
  rFire?: number; rCold?: number; rPoison?: number; rShock?: number; rNecro?: number;
  crit?: number; // percent
  lifesteal?: number; // percent of melee damage
  thorns?: number; // flat damage to melee attackers
  cooldown?: number; // percent cooldown reduction
  xpPct?: number; goldPct?: number;
  backstab?: number; // percent extra damage vs unaware/fleeing/helpless
  riposte?: number; // percent chance to counter when missed
  killHeal?: number; killMp?: number;
  cleave?: number; // percent chance to also hit another adjacent enemy
  block?: number; // percent chance to block a melee hit entirely
  meleePct?: number; rangedPct?: number; spellPct?: number;
  elemPct?: Partial<Record<Element, number>>;
  summonPct?: number; potionPct?: number;
  unarmed?: number; // extra damage die sides for unarmed
  hexPower?: number;
  poisonHit?: number; // percent chance to poison on melee hit
  burnChance?: number; // percent chance fire damage ignites
  flags?: string[];
}

export interface Status { turns: number; power?: number; source?: string }

export interface ActorBase {
  id: number;
  x: number; y: number;
  hp: number;
  energy: number;
  statuses: Record<string, Status>;
}

export interface Monster extends ActorBase {
  def: string;
  maxHp: number;
  awake: boolean;
  ally?: boolean;
  summoned?: number; // turns left before dissipating
  lastSeen?: Pos;
  wander?: Pos;
  cooldowns: Record<string, number>;
  name?: string; // uniques / renamed
  noticed?: boolean; // has been announced to the player
  split?: number; // generations of splitting (slimes)
  carried?: Item[]; // stolen goods, dropped on death
  returned?: boolean;
  friendly?: boolean; // neutral NPC: never attacks, never attacked by allies
  tile?: string; // tile override
  bonus?: number; // extra melee damage (scaled monsters: ghosts, shadows, mimics)
  talked?: boolean;
}

export type ItemKind = 'weapon' | 'armour' | 'ring' | 'amulet' | 'potion' | 'scroll' | 'wand' | 'essence' | 'tome' | 'gold' | 'note' | 'misc';

export interface ArtProp { mod?: Mods; text: string }

export interface Item {
  id: number;
  kind: ItemKind;
  base: string; // def id
  qty: number;
  ench?: number;
  ego?: string;
  art?: { name: string; props: ArtProp[]; tile?: string; desc?: string; unrand?: string };
  charges?: number;
  cursed?: boolean;
  known?: boolean; // enchant/ego/artifact props revealed
  noteId?: number;
  family?: string; // essences
}

export interface FloorItem { x: number; y: number; item: Item; seen?: boolean }

export type FeatureKind = 'trap' | 'shop' | 'shrine' | 'fountain' | 'note' | 'npc' | 'event' | 'chest';
export interface Feature {
  kind: FeatureKind;
  x: number; y: number;
  id: string; // trap type / shop type / shrine id ...
  hidden?: boolean;
  used?: boolean;
  stock?: { item: Item; price: number }[];
  data?: Record<string, unknown>;
}

export interface Cloud { x: number; y: number; type: string; turns: number; power: number }

export interface Level {
  depth: number;
  w: number; h: number;
  tiles: number[];
  seen: number[]; // 0 unknown, 1 remembered
  theme: string;
  monsters: Monster[];
  items: FloorItem[];
  features: Feature[];
  clouds: Cloud[];
  up: Pos[];
  down: Pos[];
  feeling?: string;
  event?: string;
  visited: boolean;
  corpses: Pos[];
}

export interface Player extends ActorBase {
  name: string;
  ancestry: string;
  calling: string;
  level: number;
  xp: number;
  attrs: Record<Attr, number>;
  attrPoints: number;
  pendingTalents: number;
  mp: number;
  inventory: Item[];
  equip: Partial<Record<Slot, Item>>;
  talents: Record<string, number>;
  mutations: string[];
  disciplines: string[]; // unlocked by tomes / calling
  quick: (string | null)[]; // 'a:<abilityId>' or 'i:<itemBase>'
  gold: number;
  cooldowns: Record<string, number>;
  regenAcc: number;
  mpAcc: number;
  offers?: string[]; // current level-up talent offers (saved so they cannot be rerolled by reloading)
  bonusHp: number; // permanent max HP changes from events
  usedUnbreakable?: number; // depth where Unbreakable last fired
  shieldReadyTurn?: number;
}

export interface Msg { text: string; cls?: string; turn: number }

export interface RunStats { kills: number; deepest: number; turns: number; damageDealt: number; damageTaken: number; potions: number; scrolls: number; uniques: string[]; started: number; killedBy?: string }

export interface Run {
  version: number;
  seed: number;
  rng: RngState;
  turn: number; // world turns (10 ticks each)
  tick: number;
  depth: number;
  levels: Record<number, Level>;
  player: Player;
  appearances: Record<string, string>; // item def id -> appearance id
  known: string[]; // identified item def ids
  messages: Msg[];
  nextId: number;
  flags: Record<string, number | string | boolean>;
  uniques: Record<string, number>; // unique id -> depth placed (or -1 killed)
  stats: RunStats;
  over?: 'dead' | 'won';
}
