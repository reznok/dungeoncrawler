import type { Mods } from '../core/types';
import type { WeaponClass } from './items';

export interface DisciplineDef { id: string; name: string; icon: string; desc: string }
export interface TalentDef {
  id: string;
  name: string;
  disc: string;
  tier: 1 | 2 | 3;
  max: number;
  desc: (rank: number) => string;
  mods?: (rank: number) => Mods;
  ability?: string; // grants an active ability; rank adds power
  cond?: WeaponClass[]; // mods only apply when wielding one of these
}

export const DISCIPLINES: Record<string, DisciplineDef> = Object.fromEntries([
  { id: 'blades', name: 'Swordplay', icon: 'gui/skills/short_blades', desc: 'Swords, daggers and fancy footwork.' },
  { id: 'brutality', name: 'Brutality', icon: 'gui/skills/axes', desc: 'Axes, maces and hitting things very hard.' },
  { id: 'skirmish', name: 'Skirmish', icon: 'gui/skills/polearms', desc: 'Polearms, reach and moving around.' },
  { id: 'archery', name: 'Archery', icon: 'gui/skills/bows', desc: 'Bows, crossbows and pointy distance.' },
  { id: 'brawling', name: 'Brawling', icon: 'gui/skills/unarmed_combat', desc: 'Fists, feet and foreheads.' },
  { id: 'bulwark', name: 'Bulwark', icon: 'gui/skills/shields', desc: 'Shields, armour and refusing to die.' },
  { id: 'shadow', name: 'Shadow', icon: 'gui/skills/stealth', desc: 'Sneaking, stabbing and vanishing.' },
  { id: 'pyromancy', name: 'Pyromancy', icon: 'gui/skills/fire_magic', desc: 'Fire. Lots of it.' },
  { id: 'tempest', name: 'Tempest', icon: 'gui/skills/ice_magic', desc: 'Frost and lightning.' },
  { id: 'arcana', name: 'Arcana', icon: 'gui/skills/spellcasting', desc: 'Raw magic and its many tricks.' },
  { id: 'necromancy', name: 'Necromancy', icon: 'gui/skills/necromancy', desc: 'Death, and things that should have stayed dead.' },
  { id: 'faith', name: 'Faith', icon: 'gui/skills/invocations', desc: 'Holy light, healing and smiting.' },
  { id: 'hexcraft', name: 'Hexcraft', icon: 'gui/skills/hexes', desc: 'Curses, confusion and misery for others.' },
  { id: 'beastcraft', name: 'Beastcraft', icon: 'gui/skills/summonings', desc: 'Calling animals to fight for you.' },
  { id: 'alchemy', name: 'Alchemy', icon: 'gui/skills/poison_magic', desc: 'Bombs, acids and better potions.' },
  { id: 'baking', name: 'Baking', icon: 'item/food/bread_ration', desc: 'The forbidden discipline of Crumbsworth. Bread as a weapon.' },
  { id: 'jest', name: 'Jest', icon: 'gui/skills/evocations', desc: 'Chaos, luck and pies.' },
  { id: 'survival', name: 'Survival', icon: 'gui/skills/fighting', desc: 'Toughness and stubbornness. Anyone can learn it.' },
].map((d) => [d.id, d]));

const T = (d: TalentDef) => d;
const pct = (n: number) => `${n}%`;

export const TALENTS: Record<string, TalentDef> = Object.fromEntries([
  // ---- Swordplay
  T({ id: 'blade_mastery', name: 'Blade Mastery', disc: 'blades', tier: 1, max: 3, cond: ['blade', 'dagger'], desc: (r) => `With blades or daggers: +${2 * r} accuracy, +${pct(10 * r)} melee damage.`, mods: (r) => ({ acc: 2 * r, meleePct: 10 * r }) }),
  T({ id: 'riposte', name: 'Riposte', disc: 'blades', tier: 1, max: 3, desc: (r) => `${pct(12 * r)} chance to counter-attack when an enemy misses you in melee.`, mods: (r) => ({ riposte: 12 * r }) }),
  T({ id: 'lunge', name: 'Lunge', disc: 'blades', tier: 1, max: 3, ability: 'lunge', desc: (r) => `Ability: dash to an enemy and strike it. Rank ${r}: +${pct(15 * (r - 1))} damage.` }),
  T({ id: 'whirlwind', name: 'Whirlwind', disc: 'blades', tier: 2, max: 3, ability: 'cleave', desc: (r) => `Ability: attack every adjacent enemy. Rank ${r}: +${pct(15 * (r - 1))} damage.` }),
  T({ id: 'precision', name: 'Precision', disc: 'blades', tier: 2, max: 3, desc: (r) => `+${pct(6 * r)} critical hit chance.`, mods: (r) => ({ crit: 6 * r }) }),
  T({ id: 'blade_dance', name: 'Blade Dance', disc: 'blades', tier: 3, max: 1, cond: ['blade', 'dagger'], desc: () => 'With blades or daggers: act 20% faster and +4 EV.', mods: () => ({ speed: 20, ev: 4 }) }),
  // ---- Brutality
  T({ id: 'heavy_hitter', name: 'Heavy Hitter', disc: 'brutality', tier: 1, max: 3, cond: ['axe', 'mace', 'staff'], desc: (r) => `With axes, maces or staves: +${pct(15 * r)} melee damage.`, mods: (r) => ({ meleePct: 15 * r }) }),
  T({ id: 'crushing_blow', name: 'Crushing Blow', disc: 'brutality', tier: 1, max: 3, ability: 'power_strike', desc: (r) => `Ability: a strike for 180% damage. Rank ${r}: +${pct(20 * (r - 1))} more.` }),
  T({ id: 'cleaving', name: 'Cleaving', disc: 'brutality', tier: 1, max: 3, desc: (r) => `${pct(15 * r)} chance for melee attacks to also hit another adjacent enemy.`, mods: (r) => ({ cleave: 15 * r }) }),
  T({ id: 'bonk', name: 'Bonk', disc: 'brutality', tier: 2, max: 2, ability: 'stun_strike', desc: (r) => `Ability: a strike that may stun for ${1 + r} turns.` }),
  T({ id: 'juggernaut', name: 'Juggernaut', disc: 'brutality', tier: 2, max: 3, desc: (r) => `+${2 * r} AC, +${10 * r} max HP.`, mods: (r) => ({ ac: 2 * r, maxHp: 10 * r }) }),
  T({ id: 'executioner', name: 'Executioner', disc: 'brutality', tier: 3, max: 1, desc: () => '+60% damage against enemies below 30% health.', mods: () => ({ flags: ['executioner'] }) }),
  // ---- Skirmish
  T({ id: 'reach_mastery', name: 'Polearm Mastery', disc: 'skirmish', tier: 1, max: 3, cond: ['polearm', 'staff'], desc: (r) => `With polearms or staves: +${2 * r} accuracy, +${pct(12 * r)} melee damage.`, mods: (r) => ({ acc: 2 * r, meleePct: 12 * r }) }),
  T({ id: 'footwork', name: 'Footwork', disc: 'skirmish', tier: 1, max: 3, desc: (r) => `+${2 * r} EV, move ${pct(6 * r)} faster.`, mods: (r) => ({ ev: 2 * r, moveSpeed: 6 * r }) }),
  T({ id: 'tumble', name: 'Tumble', disc: 'skirmish', tier: 1, max: 1, ability: 'leap', desc: () => 'Ability: leap up to 3 squares.' }),
  T({ id: 'war_cry', name: 'War Cry', disc: 'skirmish', tier: 2, max: 2, ability: 'shout', desc: (r) => `Ability: a shout that frightens nearby enemies for ${4 + 2 * r} turns.` }),
  T({ id: 'hit_and_run', name: 'Hit and Run', disc: 'skirmish', tier: 2, max: 1, desc: () => 'Killing an enemy hastes you for 3 turns.', mods: () => ({ flags: ['kill_haste'] }) }),
  T({ id: 'impale', name: 'Impale', disc: 'skirmish', tier: 3, max: 1, desc: () => 'Polearm and spear attacks also hit whatever stands behind the target.', mods: () => ({ flags: ['impale'] }) }),
  // ---- Archery
  T({ id: 'marksman', name: 'Marksman', disc: 'archery', tier: 1, max: 3, cond: ['bow'], desc: (r) => `With bows: +${2 * r} accuracy, +${pct(12 * r)} damage.`, mods: (r) => ({ acc: 2 * r, rangedPct: 12 * r }) }),
  T({ id: 'volley', name: 'Volley', disc: 'archery', tier: 1, max: 3, ability: 'rapid_shot', desc: (r) => `Ability: three quick shots. Rank ${r}: +${pct(15 * (r - 1))} damage.` }),
  T({ id: 'pin_shot', name: 'Pinning Shot', disc: 'archery', tier: 1, max: 2, ability: 'pin_shot', desc: () => 'Ability: a shot that pins the target in place.' }),
  T({ id: 'eagle_eye', name: 'Eagle Eye', disc: 'archery', tier: 2, max: 2, desc: (r) => `+${r} sight, +${pct(5 * r)} critical chance.`, mods: (r) => ({ sight: r, crit: 5 * r }) }),
  T({ id: 'point_blank', name: 'Point Blank', disc: 'archery', tier: 2, max: 1, desc: () => 'No penalty for shooting adjacent enemies; +20% ranged damage at close range.', mods: () => ({ flags: ['point_blank'] }) }),
  T({ id: 'piercing', name: 'Piercing Arrows', disc: 'archery', tier: 3, max: 1, desc: () => 'Your shots pierce through every creature in a line.', mods: () => ({ flags: ['pierce_shots'] }) }),
  // ---- Brawling
  T({ id: 'iron_fist', name: 'Iron Fist', disc: 'brawling', tier: 1, max: 3, desc: (r) => `Unarmed: +${3 * r} damage die, +${r} accuracy.`, mods: (r) => ({ unarmed: 3 * r, acc: r }) }),
  T({ id: 'flurry', name: 'Flurry', disc: 'brawling', tier: 1, max: 3, cond: ['unarmed'], desc: (r) => `Unarmed: act ${pct(10 * r)} faster.`, mods: (r) => ({ speed: 10 * r }) }),
  T({ id: 'headbutt', name: 'Headbutt', disc: 'brawling', tier: 1, max: 2, ability: 'stun_strike', desc: () => 'Ability: a headbutt that may stun.' }),
  T({ id: 'iron_skin', name: 'Iron Skin', disc: 'brawling', tier: 2, max: 3, desc: (r) => `+${2 * r} AC.`, mods: (r) => ({ ac: 2 * r }) }),
  T({ id: 'brawl_wind', name: 'Second Wind', disc: 'brawling', tier: 2, max: 2, ability: 'regen_self', desc: () => 'Ability: regenerate rapidly for a while.' }),
  T({ id: 'one_inch', name: 'One-Inch Punch', disc: 'brawling', tier: 3, max: 1, desc: () => '+10% critical chance; critical hits deal triple damage.', mods: () => ({ crit: 10, flags: ['brutal_crits'] }) }),
  // ---- Bulwark
  T({ id: 'shield_wall', name: 'Shield Wall', disc: 'bulwark', tier: 1, max: 3, desc: (r) => `With a shield: +${2 * r} AC, ${pct(6 * r)} chance to block melee hits.`, mods: (r) => ({ flags: ['shield_wall_' + r] }) }),
  T({ id: 'toughness', name: 'Toughness', disc: 'bulwark', tier: 1, max: 3, desc: (r) => `+${8 * r} max HP.`, mods: (r) => ({ maxHp: 8 * r }) }),
  T({ id: 'ward', name: 'Ward', disc: 'bulwark', tier: 1, max: 3, ability: 'shield', desc: (r) => `Ability: a ward that absorbs ${12 + 6 * (r - 1)}+ damage.` }),
  T({ id: 'stoneskin', name: 'Stoneskin', disc: 'bulwark', tier: 2, max: 2, ability: 'stoneskin', desc: () => 'Ability: harden your skin for extra AC.' }),
  T({ id: 'retaliation', name: 'Retaliation', disc: 'bulwark', tier: 2, max: 3, desc: (r) => `Melee attackers take ${2 * r} damage.`, mods: (r) => ({ thorns: 2 * r }) }),
  T({ id: 'unbreakable', name: 'Unbreakable', disc: 'bulwark', tier: 3, max: 1, desc: () => 'Once per floor, survive a killing blow with 1 HP.', mods: () => ({ flags: ['unbreakable'] }) }),
  // ---- Shadow
  T({ id: 'stealthy', name: 'Stealthy', disc: 'shadow', tier: 1, max: 3, desc: (r) => `+${4 * r} stealth.`, mods: (r) => ({ stealth: 4 * r }) }),
  T({ id: 'backstab', name: 'Backstab', disc: 'shadow', tier: 1, max: 3, desc: (r) => `+${pct(50 * r)} damage against unaware, fleeing or helpless enemies.`, mods: (r) => ({ backstab: 50 * r }) }),
  T({ id: 'smoke_bomb', name: 'Smoke Bomb', disc: 'shadow', tier: 1, max: 1, ability: 'fog', desc: () => 'Ability: smoke around you blocks sight.' }),
  T({ id: 'shadowstep', name: 'Shadow Step', disc: 'shadow', tier: 2, max: 2, ability: 'shadowstep', desc: () => 'Ability: step to a visible spot.' }),
  T({ id: 'poison_blades', name: 'Poisoned Blades', disc: 'shadow', tier: 2, max: 3, desc: (r) => `${pct(15 * r)} chance to poison on melee hits.`, mods: (r) => ({ poisonHit: 15 * r }) }),
  T({ id: 'vanish', name: 'Vanish', disc: 'shadow', tier: 3, max: 1, ability: 'invisible', desc: () => 'Ability: become invisible.' }),
  // ---- Pyromancy
  T({ id: 'firebolt', name: 'Firebolt', disc: 'pyromancy', tier: 1, max: 3, ability: 'firebolt', desc: (r) => `Ability: a bolt of fire. Rank ${r}: +${5 * (r - 1)} power.` }),
  T({ id: 'kindling', name: 'Kindling', disc: 'pyromancy', tier: 1, max: 3, desc: (r) => `+${pct(15 * r)} fire damage.`, mods: (r) => ({ elemPct: { fire: 15 * r } }) }),
  T({ id: 'warmth', name: 'Inner Warmth', disc: 'pyromancy', tier: 1, max: 2, desc: (r) => `Fire resistance +${r}.`, mods: (r) => ({ rFire: r }) }),
  T({ id: 'fireball', name: 'Fireball', disc: 'pyromancy', tier: 2, max: 3, ability: 'fireball', desc: (r) => `Ability: an exploding fireball. Rank ${r}: +${5 * (r - 1)} power.` }),
  T({ id: 'combustion', name: 'Combustion', disc: 'pyromancy', tier: 2, max: 3, desc: (r) => `Fire damage has a ${pct(20 * r)} chance to set targets ablaze.`, mods: (r) => ({ burnChance: 20 * r }) }),
  T({ id: 'oven_breath', name: 'Oven Breath', disc: 'pyromancy', tier: 3, max: 2, ability: 'flame_cloud', desc: () => 'Ability: breathe a cone of oven heat.' }),
  // ---- Tempest
  T({ id: 'frost_shard', name: 'Frost Shard', disc: 'tempest', tier: 1, max: 3, ability: 'frost_shard', desc: (r) => `Ability: a slowing shard of ice. Rank ${r}: +${5 * (r - 1)} power.` }),
  T({ id: 'cold_blood', name: 'Cold Blood', disc: 'tempest', tier: 1, max: 3, desc: (r) => `+${pct(15 * r)} cold and shock damage.`, mods: (r) => ({ elemPct: { cold: 15 * r, shock: 15 * r } }) }),
  T({ id: 'frostbound', name: 'Frostbound', disc: 'tempest', tier: 1, max: 2, desc: (r) => `Cold resistance +${r}, shock resistance +${r - 1 > 0 ? 1 : 0}.`, mods: (r) => ({ rCold: r, rShock: r > 1 ? 1 : 0 }) }),
  T({ id: 'cone_of_cold', name: 'Cone of Cold', disc: 'tempest', tier: 2, max: 3, ability: 'freezing_cone', desc: () => 'Ability: a cone of cold.' }),
  T({ id: 'lightning', name: 'Lightning Bolt', disc: 'tempest', tier: 2, max: 3, ability: 'lightning', desc: () => 'Ability: a piercing bolt of lightning.' }),
  T({ id: 'static_storm', name: 'Static Storm', disc: 'tempest', tier: 3, max: 2, ability: 'chain_lightning', desc: () => 'Ability: lightning strikes every enemy around you.' }),
  // ---- Arcana
  T({ id: 'magic_dart', name: 'Magic Dart', disc: 'arcana', tier: 1, max: 3, ability: 'magic_dart', desc: (r) => `Ability: an unerring dart. Rank ${r}: +${5 * (r - 1)} power.` }),
  T({ id: 'focus', name: 'Focus', disc: 'arcana', tier: 1, max: 3, desc: (r) => `+${3 * r} spell power.`, mods: (r) => ({ spellPower: 3 * r }) }),
  T({ id: 'mana_well', name: 'Mana Well', disc: 'arcana', tier: 1, max: 3, desc: (r) => `+${4 * r} max MP, faster MP regeneration.`, mods: (r) => ({ maxMp: 4 * r, mpRegen: 2 * r }) }),
  T({ id: 'blink', name: 'Blink', disc: 'arcana', tier: 2, max: 1, ability: 'blink', desc: () => 'Ability: teleport to a visible spot nearby.' }),
  T({ id: 'haste', name: 'Haste', disc: 'arcana', tier: 2, max: 1, ability: 'haste_self', desc: () => 'Ability: act twice as fast for a while.' }),
  T({ id: 'archmage', name: 'Archmage', disc: 'arcana', tier: 3, max: 1, desc: () => '+6 spell power, abilities recharge 25% faster.', mods: () => ({ spellPower: 6, cooldown: 25 }) }),
  // ---- Necromancy
  T({ id: 'drain_life', name: 'Drain Life', disc: 'necromancy', tier: 1, max: 3, ability: 'drain_life', desc: (r) => `Ability: drink the life of an adjacent creature. Rank ${r}: +${5 * (r - 1)} power.` }),
  T({ id: 'grave_chill', name: 'Grave Chill', disc: 'necromancy', tier: 1, max: 3, ability: 'agony', desc: () => 'Ability: necrotic damage at range.' }),
  T({ id: 'deathly', name: 'Deathly', disc: 'necromancy', tier: 1, max: 3, desc: (r) => `+${pct(15 * r)} necrotic damage, necrotic resistance +${r > 1 ? 1 : 0}.`, mods: (r) => ({ elemPct: { necro: 15 * r }, rNecro: r > 1 ? 1 : 0 }) }),
  T({ id: 'raise_dead', name: 'Raise the Fallen', disc: 'necromancy', tier: 2, max: 3, ability: 'raise_dead', desc: (r) => `Ability: raise skeletons. Rank ${r}: stronger skeletons.` }),
  T({ id: 'soul_harvest', name: 'Soul Harvest', disc: 'necromancy', tier: 2, max: 3, desc: (r) => `Kills restore ${2 * r} HP and ${r} MP.`, mods: (r) => ({ killHeal: 2 * r, killMp: r }) }),
  T({ id: 'lichdom', name: 'Lichdom', disc: 'necromancy', tier: 3, max: 1, desc: () => 'Become partly undead: resist poison, cold and necrotic, +10 MP and +6 spell power, but -20% max HP.', mods: () => ({ rPoison: 1, rCold: 1, rNecro: 1, maxMp: 10, spellPower: 6, maxHpPct: -20 }) }),
  // ---- Faith
  T({ id: 'smite', name: 'Smite', disc: 'faith', tier: 1, max: 3, ability: 'smite', desc: (r) => `Ability: holy fire on a target. Rank ${r}: +${5 * (r - 1)} power.` }),
  T({ id: 'mend', name: 'Mend', disc: 'faith', tier: 1, max: 3, ability: 'heal', desc: (r) => `Ability: heal yourself. Rank ${r}: +${5 * (r - 1)} power.` }),
  T({ id: 'blessed', name: 'Blessed', disc: 'faith', tier: 1, max: 3, desc: (r) => `+${pct(15 * r)} holy damage, +${5 * r} max HP.`, mods: (r) => ({ elemPct: { holy: 15 * r }, maxHp: 5 * r }) }),
  T({ id: 'purify', name: 'Purify', disc: 'faith', tier: 2, max: 1, ability: 'cleanse', desc: () => 'Ability: remove ailments.' }),
  T({ id: 'halo', name: 'Halo', disc: 'faith', tier: 2, max: 2, desc: (r) => `Undead and demons next to you take ${3 * r} holy damage each turn.`, mods: (r) => ({ flags: ['halo_' + r] }) }),
  T({ id: 'divine_shield', name: 'Divine Shield', disc: 'faith', tier: 3, max: 1, desc: () => 'When you fall below 25% health, a ward appears (every 50 turns).', mods: () => ({ flags: ['divine_shield'] }) }),
  // ---- Hexcraft
  T({ id: 'slow', name: 'Slow', disc: 'hexcraft', tier: 1, max: 2, ability: 'slow', desc: () => 'Ability: slow a target.' }),
  T({ id: 'befuddle', name: 'Befuddle', disc: 'hexcraft', tier: 1, max: 2, ability: 'confuse', desc: () => 'Ability: confuse a target.' }),
  T({ id: 'malice', name: 'Malice', disc: 'hexcraft', tier: 1, max: 3, desc: (r) => `Your hexes are ${pct(15 * r)} harder to resist and last longer.`, mods: (r) => ({ hexPower: 15 * r }) }),
  T({ id: 'mark', name: 'Mark for Death', disc: 'hexcraft', tier: 2, max: 1, ability: 'mark', desc: () => 'Ability: the target takes 50% more damage.' }),
  T({ id: 'enfeeble', name: 'Enfeeble', disc: 'hexcraft', tier: 2, max: 1, ability: 'weaken', desc: () => 'Ability: weaken a target.' }),
  T({ id: 'dread', name: 'Dread', disc: 'hexcraft', tier: 3, max: 1, ability: 'fear', desc: () => 'Ability: frighten every enemy nearby.' }),
  T({ id: 'hold', name: 'Hold', disc: 'hexcraft', tier: 3, max: 1, ability: 'paralyse', desc: () => 'Ability: paralyse a target.' }),
  // ---- Beastcraft
  T({ id: 'call_rats', name: 'Call Rats', disc: 'beastcraft', tier: 1, max: 3, ability: 'summon_rat', desc: (r) => `Ability: rats fight for you. Rank ${r}: more and tougher rats.` }),
  T({ id: 'pack_leader', name: 'Pack Leader', disc: 'beastcraft', tier: 1, max: 3, desc: (r) => `Your allies have +${pct(25 * r)} health and damage.`, mods: (r) => ({ summonPct: 25 * r }) }),
  T({ id: 'wild_heart', name: 'Wild Heart', disc: 'beastcraft', tier: 1, max: 3, desc: (r) => `+${6 * r} max HP, +${r} regeneration.`, mods: (r) => ({ maxHp: 6 * r, regen: r }) }),
  T({ id: 'call_pack', name: 'Call the Pack', disc: 'beastcraft', tier: 2, max: 3, ability: 'summon_wolf', desc: () => 'Ability: wolves answer.' }),
  T({ id: 'thick_hide', name: 'Thick Hide', disc: 'beastcraft', tier: 2, max: 3, desc: (r) => `+${2 * r} AC.`, mods: (r) => ({ ac: 2 * r }) }),
  T({ id: 'bear', name: 'Bear Necessities', disc: 'beastcraft', tier: 3, max: 2, ability: 'summon_bear', desc: () => 'Ability: summon a bear.' }),
  // ---- Alchemy
  T({ id: 'bomb', name: 'Flask Bomb', disc: 'alchemy', tier: 1, max: 3, ability: 'bomb', desc: (r) => `Ability: throw a fire bomb. Rank ${r}: +${5 * (r - 1)} power.` }),
  T({ id: 'brewer', name: 'Brewer', disc: 'alchemy', tier: 1, max: 3, desc: (r) => `Potions are ${pct(25 * r)} stronger.`, mods: (r) => ({ potionPct: 25 * r }) }),
  T({ id: 'iron_stomach', name: 'Iron Stomach', disc: 'alchemy', tier: 1, max: 2, desc: (r) => `Poison resistance +${r > 1 ? 2 : 1}... and you can drink anything.`, mods: (r) => ({ rPoison: r }) }),
  T({ id: 'acid_flask', name: 'Acid Flask', disc: 'alchemy', tier: 2, max: 2, ability: 'acid_flask', desc: () => 'Ability: corrosive splash.' }),
  T({ id: 'miasma', name: 'Miasma', disc: 'alchemy', tier: 2, max: 2, ability: 'poison_cloud', desc: () => 'Ability: a cloud of poison.' }),
  T({ id: 'philosopher', name: "Philosopher's Gut", disc: 'alchemy', tier: 3, max: 1, desc: () => 'Every potion you drink also heals 15% and restores 5 MP.', mods: () => ({ flags: ['philosopher'] }) }),
  // ---- Baking
  T({ id: 'hurl_loaf', name: 'Hurl Loaf', disc: 'baking', tier: 1, max: 3, ability: 'bread_bolt', desc: (r) => `Ability: hurl a scalding loaf. Rank ${r}: +${5 * (r - 1)} power.` }),
  T({ id: 'knead', name: "Baker's Hands", disc: 'baking', tier: 1, max: 3, desc: (r) => `+${6 * r} max HP, +${r} regeneration, +${r} Might. Strong from years of kneading.`, mods: (r) => ({ maxHp: 6 * r, regen: r, might: r }) }),
  T({ id: 'proof', name: 'Proof', disc: 'baking', tier: 1, max: 2, ability: 'doughify', desc: () => 'Ability: turn a target partly into dough (slow, soft).' }),
  T({ id: 'rise', name: 'Rise', disc: 'baking', tier: 2, max: 3, ability: 'might_self', desc: () => 'Ability: rise like good dough: +damage and +max HP for a while.' }),
  T({ id: 'loaf_golem', name: 'Loaf Golem', disc: 'baking', tier: 2, max: 3, ability: 'loaf_golem', desc: () => 'Ability: knead a golem of sourdough to fight for you.' }),
  T({ id: 'baguette', name: 'Baguette of Judgement', disc: 'baking', tier: 3, max: 2, ability: 'baguette_beam', desc: () => 'Ability: a beam of impossibly long bread.' }),
  // ---- Jest
  T({ id: 'pie', name: 'Pie to the Face', disc: 'jest', tier: 1, max: 2, ability: 'pie', desc: () => 'Ability: throw a pie. Blinds.' }),
  T({ id: 'pratfall', name: 'Pratfall', disc: 'jest', tier: 1, max: 3, desc: (r) => `+${3 * r} EV. You fall over in exactly the right way.`, mods: (r) => ({ ev: 3 * r }) }),
  T({ id: 'lucky', name: 'Dumb Luck', disc: 'jest', tier: 1, max: 3, desc: (r) => `+${pct(5 * r)} critical chance, +${pct(10 * r)} gold.`, mods: (r) => ({ crit: 5 * r, goldPct: 10 * r }) }),
  T({ id: 'chaos_bolt', name: 'Bolt of Whatever', disc: 'jest', tier: 2, max: 3, ability: 'chaos_bolt', desc: () => 'Ability: a bolt of a random element with a random side effect.' }),
  T({ id: 'distract', name: 'Look Over There!', disc: 'jest', tier: 2, max: 1, ability: 'confuse', desc: () => 'Ability: confuse a target.' }),
  T({ id: 'punchline', name: 'Punchline', disc: 'jest', tier: 3, max: 1, desc: () => 'Enemies you kill explode in confetti, confusing those nearby.', mods: () => ({ flags: ['punchline'] }) }),
  // ---- Survival
  T({ id: 'vigor', name: 'Vigor', disc: 'survival', tier: 1, max: 3, desc: (r) => `+${pct(8 * r)} max HP.`, mods: (r) => ({ maxHpPct: 8 * r }) }),
  T({ id: 'hardy', name: 'Hardy', disc: 'survival', tier: 1, max: 2, desc: (r) => `Poison resistance +1, +${2 * r} regeneration.`, mods: (r) => ({ rPoison: 1, regen: 2 * r }) }),
  T({ id: 'scavenger', name: 'Scavenger', disc: 'survival', tier: 1, max: 2, desc: (r) => `+${pct(20 * r)} gold and +${pct(5 * r)} XP.`, mods: (r) => ({ goldPct: 20 * r, xpPct: 5 * r }) }),
  T({ id: 'surv_wind', name: 'Second Wind', disc: 'survival', tier: 2, max: 1, ability: 'regen_self', desc: () => 'Ability: regenerate rapidly for a while.' }),
  T({ id: 'fleet', name: 'Fleet', disc: 'survival', tier: 2, max: 2, desc: (r) => `Move ${pct(10 * r)} faster.`, mods: (r) => ({ moveSpeed: 10 * r }) }),
  T({ id: 'last_stand', name: 'Last Stand', disc: 'survival', tier: 3, max: 1, desc: () => '+50% damage and +5 AC when below 30% health.', mods: () => ({ flags: ['last_stand'] }) }),
].map((t) => [t.id, t]));

export const TIER_REQ = { 1: 0, 2: 2, 3: 5 } as const;
