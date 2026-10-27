import type { Mods } from '../core/types';

export interface MutationDef { id: string; name: string; family: string; icon: string; desc: string; mods?: Mods; ability?: string; bad?: boolean }

const U = (d: MutationDef) => d;

export const MUTATIONS: Record<string, MutationDef> = Object.fromEntries([
  // beast
  U({ id: 'claws', name: 'Claws', family: 'beast', icon: 'gui/mutations/claws_2', desc: 'Sharp claws: +4 unarmed damage die, +2 melee damage.', mods: { unarmed: 4, dmg: 2 } }),
  U({ id: 'fur', name: 'Shaggy Fur', family: 'beast', icon: 'gui/mutations/shaggy_fur_2', desc: '+2 AC, resist cold. You shed everywhere.', mods: { ac: 2, rCold: 1 } }),
  U({ id: 'keen_nose', name: 'Keen Nose', family: 'beast', icon: 'gui/mutations/acute_vision', desc: 'You smell monsters nearby through walls.', mods: { flags: ['sniff'] } }),
  U({ id: 'fangs', name: 'Fangs', family: 'beast', icon: 'gui/mutations/fangs_2', desc: 'Melee hits heal you a little.', mods: { lifesteal: 6 } }),
  // vermin
  U({ id: 'carapace', name: 'Carapace', family: 'vermin', icon: 'gui/mutations/large_bone_plates_2', desc: '+4 AC, -1 EV. You click when you walk.', mods: { ac: 4, ev: -1 } }),
  U({ id: 'stinger', name: 'Stinger', family: 'vermin', icon: 'gui/mutations/stinger_2', desc: 'Melee hits often poison.', mods: { poisonHit: 35 } }),
  U({ id: 'antennae', name: 'Antennae', family: 'vermin', icon: 'gui/mutations/antennae_2', desc: 'See invisible creatures; +1 sight.', mods: { sight: 1, flags: ['see_invis'] } }),
  U({ id: 'skitter', name: 'Skittering Legs', family: 'vermin', icon: 'gui/mutations/agile_2', desc: 'Move 20% faster. Creepy.', mods: { moveSpeed: 20 } }),
  // fungus
  U({ id: 'spores', name: 'Spore Lungs', family: 'fungus', icon: 'gui/mutations/foul_stench_2', desc: 'Adjacent enemies are sometimes confused by your breath.', mods: { flags: ['spore_breath'] } }),
  U({ id: 'mycelium', name: 'Mycelial Blood', family: 'fungus', icon: 'gui/mutations/regeneration_2', desc: '+5 regeneration. You taste faintly of mushrooms.', mods: { regen: 5 } }),
  U({ id: 'third_eye', name: 'Third Eye (a mushroom)', family: 'fungus', icon: 'gui/mutations/eyeballs_2', desc: '+3 spell power. It is a mushroom on your forehead. It sees things.', mods: { spellPower: 3, flags: ['see_invis'] } }),
  U({ id: 'mushroom_head', name: 'Mushroom Head', family: 'fungus', icon: 'gui/mutations/potion_fungus', desc: 'You cannot wear helmets, but +15 max HP.', mods: { maxHp: 15, flags: ['no_helmet'] }, bad: true }),
  // ooze
  U({ id: 'gelatinous', name: 'Gelatinous Body', family: 'ooze', icon: 'gui/mutations/gelatinous_body_2', desc: '+3 AC, +3 EV, resist acid. Wobbly.', mods: { ac: 3, ev: 3 } }),
  U({ id: 'acid_spit', name: 'Acid Spit', family: 'ooze', icon: 'gui/mutations/spit_poison_2', desc: 'You can spit acid.', ability: 'spit_acid' }),
  U({ id: 'pseudopods', name: 'Pseudopods', family: 'ooze', icon: 'gui/mutations/pseudopods_2', desc: '15% chance to also hit another adjacent enemy.', mods: { cleave: 15 } }),
  // undead
  U({ id: 'deathly_pallor', name: 'Deathly Pallor', family: 'undead', icon: 'gui/mutations/in_touch_with_death_1', desc: 'Resist necrotic and poison. You no longer get cold. Or warm.', mods: { rNecro: 1, rPoison: 1 } }),
  U({ id: 'grave_touch', name: 'Grave Touch', family: 'undead', icon: 'gui/mutations/powered_by_death_2', desc: 'Kills heal you for 4.', mods: { killHeal: 4 } }),
  U({ id: 'hollow', name: 'Hollow', family: 'undead', icon: 'gui/mutations/forlorn', desc: '+20 max MP, -10% max HP. Something is missing.', mods: { maxMp: 20, maxHpPct: -10 }, bad: true }),
  // demon
  U({ id: 'horns', name: 'Horns', family: 'demon', icon: 'gui/mutations/horns_2', desc: '+3 melee damage. Cannot wear helmets.', mods: { dmg: 3, flags: ['no_helmet'] } }),
  U({ id: 'demon_magic', name: 'Demonic Magic', family: 'demon', icon: 'gui/mutations/demonic_magic_2', desc: '+5 spell power.', mods: { spellPower: 5 } }),
  U({ id: 'hellfire_blood', name: 'Hellfire Blood', family: 'demon', icon: 'gui/mutations/ignite_blood_2', desc: 'Resist fire; melee attackers are burned.', mods: { rFire: 1, thorns: 3 } }),
  U({ id: 'black_mark', name: 'Black Mark', family: 'demon', icon: 'gui/mutations/black_mark', desc: 'Your attacks drain life. Monsters find you creepy.', mods: { lifesteal: 8, stealth: -3 } }),
  // aquatic
  U({ id: 'gills', name: 'Gills', family: 'aquatic', icon: 'gui/mutations/mertail', desc: 'You can swim through deep water.', mods: { flags: ['swim'] } }),
  U({ id: 'slick_scales', name: 'Slick Scales', family: 'aquatic', icon: 'gui/mutations/blue_scales_2', desc: '+3 EV, resist cold.', mods: { ev: 3, rCold: 1 } }),
  U({ id: 'ink', name: 'Ink Sacs', family: 'aquatic', icon: 'gui/mutations/foul_shadow_2', desc: 'Squirt a cloud of ink (smoke).', ability: 'fog' }),
  // fire
  U({ id: 'ember_heart', name: 'Ember Heart', family: 'fire', icon: 'gui/mutations/ignite_blood_3', desc: '+20% fire damage, resist fire.', mods: { rFire: 1, elemPct: { fire: 20 } } }),
  U({ id: 'smoulder', name: 'Smoulder', family: 'fire', icon: 'gui/mutations/red_scales_2', desc: '+2 AC; your attacks sometimes ignite.', mods: { ac: 2, flags: ['ignite_hits'] } }),
  U({ id: 'fire_breath', name: 'Fire Breath', family: 'fire', icon: 'gui/abilities/breathe_fire', desc: 'You can breathe fire.', ability: 'flame_cloud' }),
  // flesh
  U({ id: 'extra_arm', name: 'Extra Arm', family: 'flesh', icon: 'gui/mutations/missing_hand', desc: 'An extra arm. +3 accuracy, +2 damage. It waves at people.', mods: { acc: 3, dmg: 2 } }),
  U({ id: 'eyes_everywhere', name: 'Eyes Everywhere', family: 'flesh', icon: 'gui/mutations/eyeballs_3', desc: '+2 sight, see invisible. You blink in many places at once.', mods: { sight: 2, flags: ['see_invis'] } }),
  U({ id: 'tumors', name: 'Tumorous Growth', family: 'flesh', icon: 'gui/mutations/deterioration_2', desc: '+25 max HP, -3 EV. Lumpy.', mods: { maxHp: 25, ev: -3 }, bad: true }),
  U({ id: 'unstable', name: 'Unstable Flesh', family: 'flesh', icon: 'gui/mutations/generic_bad_mutation_2', desc: 'You sometimes teleport at random. -2 AC.', mods: { ac: -2, flags: ['teleportitis'] }, bad: true }),
  // dough
  U({ id: 'crusty', name: 'Crusty', family: 'dough', icon: 'gui/mutations/brown_scales_2', desc: 'A thick golden crust: +4 AC, -1 EV. You smell incredible.', mods: { ac: 4, ev: -1, stealth: -2 } }),
  U({ id: 'rising', name: 'Ever-Rising', family: 'dough', icon: 'gui/mutations/robust_2', desc: '+12% max HP, +2 regeneration.', mods: { maxHpPct: 12, regen: 2 } }),
  U({ id: 'yeasty', name: 'Yeasty', family: 'dough', icon: 'gui/mutations/potion_fungus', desc: 'Mother can hear you now. +4 spell power, -2 Wits. Sometimes you hear her too.', mods: { spellPower: 4, wits: -2 }, bad: true }),
  // construct
  U({ id: 'iron_skin_mut', name: 'Iron Plating', family: 'construct', icon: 'gui/mutations/metallic_scales_2', desc: '+5 AC, -2 EV.', mods: { ac: 5, ev: -2 } }),
  U({ id: 'clockwork', name: 'Clockwork Heart', family: 'construct', icon: 'gui/mutations/efficient_metabolism', desc: 'Resist shock. +10% action speed. Tick tock.', mods: { rShock: 1, speed: 10 } }),
  // humanoid
  U({ id: 'grit', name: 'Grit', family: 'humanoid', icon: 'gui/mutations/strong_willed_2', desc: '+1 to every attribute.', mods: { might: 1, agility: 1, wits: 1 } }),
  U({ id: 'mean_look', name: 'A Mean Look', family: 'humanoid', icon: 'gui/mutations/booming_voice', desc: 'You can frighten foes with a War Cry.', ability: 'shout' }),
  // eye
  U({ id: 'gaze', name: 'Paralysing Gaze', family: 'eye', icon: 'gui/spells/monster/paralysis_gaze', desc: 'You can paralyse with a look.', ability: 'paralyse' }),
].map((m) => [m.id, m]));

export const MUTATION_SLOTS = 5;
