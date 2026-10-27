import type { Attr, Mods } from '../core/types';

export interface AncestryDef {
  id: string; name: string; tile: string; desc: string;
  attrs: Record<Attr, number>;
  hp: [number, number]; // base, per level
  mp: [number, number];
  mods?: Mods;
  abilities?: string[];
  quirks: string[];
}

export interface CallingDef {
  id: string; name: string; icon: string; desc: string;
  disciplines: string[];
  talents: string[];
  kit: { base: string; qty?: number; ench?: number }[];
  gold: number;
  knowsPotions?: boolean;
}

export const ANCESTRIES: AncestryDef[] = [
  { id: 'human', name: 'Human', tile: 'player/base/human_m', desc: 'Adaptable and stubborn.', attrs: { might: 10, agility: 10, wits: 10 }, hp: [12, 5], mp: [4, 2], quirks: ['Sees 4 talent offers per level instead of 3.'], mods: { flags: ['extra_offer'] } },
  { id: 'dwarf', name: 'Dwarf', tile: 'player/base/dwarf_m', desc: 'Short, stout and suspicious of magic.', attrs: { might: 12, agility: 8, wits: 9 }, hp: [15, 6], mp: [2, 1.5], quirks: ['+2 AC, resists poison.', 'Weaker magic.'], mods: { ac: 2, rPoison: 1, spellPower: -2 } },
  { id: 'elf', name: 'Elf', tile: 'player/base/elf_m', desc: 'Graceful, clever, a bit fragile and quite smug about it.', attrs: { might: 8, agility: 11, wits: 13 }, hp: [9, 4], mp: [7, 3], quirks: ['+1 sight, +2 spell power.'], mods: { sight: 1, spellPower: 2 } },
  { id: 'gnoll', name: 'Gnoll', tile: 'player/base/gnoll_m', desc: 'A hyena person with an incredible nose.', attrs: { might: 11, agility: 11, wits: 8 }, hp: [12, 5], mp: [3, 1.5], quirks: ['Smells nearby monsters through walls.'], mods: { flags: ['sniff'] } },
  { id: 'kobold', name: 'Kobold', tile: 'player/base/kobold_m', desc: 'Small, sneaky and very motivated.', attrs: { might: 8, agility: 12, wits: 9 }, hp: [9, 4.5], mp: [3, 2], quirks: ['+5 stealth, +2 EV.'], mods: { stealth: 5, ev: 2 } },
  { id: 'frog', name: 'Frogfolk', tile: 'player/base/frog_m', desc: 'An amphibian with legs like springs.', attrs: { might: 10, agility: 12, wits: 8 }, hp: [11, 5], mp: [3, 1.5], quirks: ['Swims through deep water.', 'Can leap.'], mods: { flags: ['swim'] }, abilities: ['leap'] },
  { id: 'troll', name: 'Troll', tile: 'player/base/troll_m', desc: 'Huge, hungry and always healing.', attrs: { might: 14, agility: 8, wits: 6 }, hp: [16, 7], mp: [1, 1], quirks: ['Regenerates very fast.', 'Big claws.', 'Loud (-3 stealth), weak magic.'], mods: { regen: 8, unarmed: 4, stealth: -3, spellPower: -4 } },
  { id: 'spriggan', name: 'Spriggan', tile: 'player/base/spriggan_m', desc: 'Tiny, quick and fond of running away.', attrs: { might: 7, agility: 14, wits: 10 }, hp: [7, 4], mp: [4, 2], quirks: ['Moves 30% faster, +4 stealth, +3 EV.', 'Fragile.'], mods: { moveSpeed: 30, stealth: 4, ev: 3 } },
  { id: 'ghoul', name: 'Ghoul', tile: 'player/base/ghoul_m', desc: 'A hungry corpse with good manners.', attrs: { might: 12, agility: 10, wits: 7 }, hp: [13, 6], mp: [2, 1], quirks: ['Claws. Resists poison and necrotic.', 'Barely regenerates; heals by devouring corpses.'], mods: { unarmed: 3, rPoison: 1, rNecro: 1, regen: -4 }, abilities: ['devour'] },
  { id: 'mummy', name: 'Mummy', tile: 'player/base/mummy_m', desc: 'Dead, wrapped, and annoyed about it.', attrs: { might: 10, agility: 9, wits: 11 }, hp: [12, 5], mp: [4, 2], quirks: ['Resists poison, cold and necrotic.', 'Burns easily.', 'Cannot drink potions.'], mods: { rPoison: 1, rCold: 1, rNecro: 1, rFire: -1, flags: ['no_potions'] } },
  { id: 'octopode', name: 'Octopode', tile: 'player/base/octopode1', desc: 'An octopus in the dungeon. Eight arms, four rings, zero shirts.', attrs: { might: 9, agility: 12, wits: 10 }, hp: [11, 5], mp: [4, 2], quirks: ['Wears 4 rings.', 'Cannot wear body armour or boots.', 'Swims.'], mods: { flags: ['swim', 'octopode', 'no_body', 'no_boots'] } },
  { id: 'gargoyle', name: 'Gargoyle', tile: 'player/base/gargoyle_m', desc: 'A living statue. Hard to hurt, hard to hurry.', attrs: { might: 11, agility: 8, wits: 10 }, hp: [11, 5], mp: [3, 2], quirks: ['+5 AC, resists poison and shock.', '-2 EV.'], mods: { ac: 5, rPoison: 1, rShock: 1, ev: -2 } },
];

export const CALLINGS: CallingDef[] = [
  { id: 'sellsword', name: 'Sellsword', icon: 'gui/skills/long_blades', desc: 'Fights for coin. Fights well. Straightforward and sturdy.', disciplines: ['blades', 'brutality', 'bulwark'], talents: ['blade_mastery'], kit: [{ base: 'short_sword' }, { base: 'leather' }, { base: 'buckler' }, { base: 'p_curing', qty: 2 }], gold: 20 },
  { id: 'wizard', name: 'Hedge Wizard', icon: 'gui/skills/spellcasting', desc: 'Self-taught magic from a mail-order course. Fragile, then frightening.', disciplines: ['arcana', 'pyromancy', 'tempest'], talents: ['magic_dart', 'firebolt'], kit: [{ base: 'quarterstaff' }, { base: 'robe' }, { base: 'wizard_hat' }, { base: 'p_mana', qty: 2 }], gold: 15 },
  { id: 'graverobber', name: 'Grave Robber', icon: 'gui/skills/necromancy', desc: 'Digs up the dead for a living. Some of them dig back.', disciplines: ['necromancy', 'shadow', 'hexcraft'], talents: ['drain_life', 'stealthy'], kit: [{ base: 'dagger' }, { base: 'leather' }, { base: 'cloak' }, { base: 'p_curing', qty: 1 }], gold: 30 },
  { id: 'baker', name: 'Disgraced Baker', icon: 'item/food/bread_ration', desc: 'Apprenticed to the Baker of Crumbsworth until The Incident. Knows things about dough nobody should.', disciplines: ['baking', 'brutality', 'alchemy'], talents: ['hurl_loaf', 'knead'], kit: [{ base: 'rolling_pin' }, { base: 'apron' }, { base: 'p_curing', qty: 2 }], gold: 10 },
  { id: 'exorcist', name: 'Exorcist', icon: 'gui/skills/invocations', desc: 'Drives out evil. Has seen things. Sleeps with a mace.', disciplines: ['faith', 'bulwark', 'hexcraft'], talents: ['smite', 'mend'], kit: [{ base: 'mace' }, { base: 'ring_mail' }, { base: 'buckler' }], gold: 10 },
  { id: 'beastcaller', name: 'Beastcaller', icon: 'gui/skills/summonings', desc: 'Talks to animals. They talk back. They are mostly rude.', disciplines: ['beastcraft', 'survival', 'skirmish'], talents: ['call_rats', 'wild_heart'], kit: [{ base: 'spear' }, { base: 'leather' }, { base: 'p_curing', qty: 1 }], gold: 15 },
  { id: 'duelist', name: 'Duelist', icon: 'gui/skills/short_blades', desc: 'All flourish, all finesse, all ego.', disciplines: ['blades', 'skirmish', 'shadow'], talents: ['riposte', 'footwork'], kit: [{ base: 'rapier' }, { base: 'leather' }, { base: 'cloak' }], gold: 25 },
  { id: 'brawler', name: 'Brawler', icon: 'gui/skills/unarmed_combat', desc: 'Weapons are for people who cannot punch.', disciplines: ['brawling', 'survival', 'bulwark'], talents: ['iron_fist', 'toughness'], kit: [{ base: 'leather' }, { base: 'p_curing', qty: 2 }], gold: 10 },
  { id: 'hunter', name: 'Hunter', icon: 'gui/skills/bows', desc: 'Shoots first. Asks questions never.', disciplines: ['archery', 'skirmish', 'survival'], talents: ['marksman', 'volley'], kit: [{ base: 'shortbow' }, { base: 'leather' }, { base: 'dagger' }], gold: 15 },
  { id: 'alchemist', name: 'Alchemist', icon: 'gui/skills/poison_magic', desc: 'Has tasted every potion, twice. Knows them all on sight.', disciplines: ['alchemy', 'hexcraft', 'arcana'], talents: ['bomb', 'brewer'], kit: [{ base: 'dagger' }, { base: 'robe' }, { base: 'p_curing', qty: 2 }, { base: 'p_heal', qty: 1 }], gold: 30, knowsPotions: true },
  { id: 'hexer', name: 'Hexer', icon: 'gui/skills/hexes', desc: 'Petty, spiteful and very good at it.', disciplines: ['hexcraft', 'necromancy', 'arcana'], talents: ['slow', 'befuddle'], kit: [{ base: 'quarterstaff' }, { base: 'robe' }, { base: 'w_slow' }], gold: 20 },
  { id: 'jester', name: 'Court Jester', icon: 'gui/skills/evocations', desc: 'The king laughed once. Then the king died. Unrelated. Probably.', disciplines: ['jest'], talents: ['pie', 'pratfall'], kit: [{ base: 'rolling_pin' }, { base: 'robe' }, { base: 'w_whatever' }], gold: 5 },
];

export const NAMES = ['Gwendolyn', 'Bartholomew', 'Pip', 'Agatha', 'Morwen', 'Toast', 'Ignatius', 'Hilda', 'Crumb', 'Ulfric', 'Beatrix', 'Odo', 'Mabel', 'Fennick', 'Jory', 'Wilhelmina', 'Gus', 'Esmerelda', 'Barnaby Jr.', 'Hamish', 'Ysolde', 'Kevin', 'Rook', 'Tansy', 'Leeroy', 'Brioche', 'Sir Reginald', 'Mungo', 'Pumpernickel', 'Ada'];
