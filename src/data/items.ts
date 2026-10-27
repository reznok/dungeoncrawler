import type { Mods, Slot } from '../core/types';

export type WeaponClass = 'blade' | 'axe' | 'mace' | 'polearm' | 'dagger' | 'staff' | 'bow' | 'unarmed';

export interface WeaponDef {
  id: string; name: string; tile: string; doll: string;
  dmg: [number, number]; delay: number; acc: number;
  cls: WeaponClass; twoHanded?: boolean; reach?: number; level: number; price: number;
  desc: string;
}
export interface ArmourDef {
  id: string; name: string; tile: string; doll?: string;
  slot: Slot; ac: number; ev?: number; level: number; price: number; desc: string;
  mods?: Mods;
}
export interface JewelDef { id: string; name: string; slot: 'ring' | 'amulet'; mods: Mods; desc: string; level: number; price: number; bad?: boolean; abilities?: string[] }
export interface ConsumableDef { id: string; name: string; kind: 'potion' | 'scroll' | 'wand'; desc: string; level: number; weight: number; price: number; bad?: boolean; ability?: string; charges?: [number, number] }

const W = (d: WeaponDef) => d;
export const WEAPONS: Record<string, WeaponDef> = Object.fromEntries([
  W({ id: 'dagger', name: 'dagger', tile: 'item/weapon/dagger', doll: 'player/hand1/dagger', dmg: [1, 5], delay: 80, acc: 2, cls: 'dagger', level: 1, price: 15, desc: 'Short, quick and sneaky. Devastating against the unaware.' }),
  W({ id: 'short_sword', name: 'short sword', tile: 'item/weapon/short_sword1', doll: 'player/hand1/short_sword', dmg: [1, 7], delay: 90, acc: 1, cls: 'blade', level: 1, price: 25, desc: 'A sensible sword for sensible people.' }),
  W({ id: 'rolling_pin', name: 'rolling pin', tile: 'item/weapon/club', doll: 'player/hand1/club', dmg: [1, 7], delay: 100, acc: 1, cls: 'mace', level: 1, price: 10, desc: 'A rolling pin. Smells of butter and violence.' }),
  W({ id: 'hand_axe', name: 'hand axe', tile: 'item/weapon/hand_axe1', doll: 'player/hand1/hand_axe', dmg: [1, 8], delay: 100, acc: 0, cls: 'axe', level: 1, price: 25, desc: 'Chops wood. Chops other things.' }),
  W({ id: 'spear', name: 'spear', tile: 'item/weapon/spear1', doll: 'player/hand1/spear', dmg: [1, 8], delay: 110, acc: 0, cls: 'polearm', reach: 2, level: 1, price: 25, desc: 'Pointy stick, professional edition. Reaches 2 squares.' }),
  W({ id: 'quarterstaff', name: 'quarterstaff', tile: 'item/weapon/quarterstaff', doll: 'player/hand1/quarterstaff', dmg: [1, 9], delay: 110, acc: 1, cls: 'staff', twoHanded: true, level: 1, price: 15, desc: 'A long stick. Wizards love it. Peasants love it more.' }),
  W({ id: 'shortbow', name: 'shortbow', tile: 'item/weapon/ranged/shortbow1', doll: 'player/hand1/shortbow', dmg: [2, 6], delay: 110, acc: 2, cls: 'bow', twoHanded: true, level: 1, price: 35, desc: 'Shoots arrows. You never seem to run out. Do not ask why.' }),
  W({ id: 'rapier', name: 'rapier', tile: 'item/weapon/rapier1', doll: 'player/hand1/rapier', dmg: [2, 6], delay: 80, acc: 3, cls: 'blade', level: 3, price: 45, desc: 'Elegant, precise, and a bit pretentious.' }),
  W({ id: 'mace', name: 'mace', tile: 'item/weapon/mace1', doll: 'player/hand1/mace', dmg: [2, 6], delay: 110, acc: 0, cls: 'mace', level: 2, price: 30, desc: 'A metal head on a stick. Physics does the rest.' }),
  W({ id: 'long_sword', name: 'long sword', tile: 'item/weapon/long_sword1', doll: 'player/hand1/long_sword_slant', dmg: [2, 7], delay: 110, acc: 1, cls: 'blade', level: 3, price: 50, desc: 'A proper sword.' }),
  W({ id: 'war_axe', name: 'war axe', tile: 'item/weapon/war_axe1', doll: 'player/hand1/war_axe', dmg: [2, 8], delay: 120, acc: -1, cls: 'axe', level: 4, price: 55, desc: 'An axe for war. Not for wood. Never wood.' }),
  W({ id: 'flail', name: 'flail', tile: 'item/weapon/flail1', doll: 'player/hand1/flail', dmg: [2, 8], delay: 120, acc: -1, cls: 'mace', level: 4, price: 50, desc: 'Ball. Chain. Regret (theirs).' }),
  W({ id: 'trident', name: 'trident', tile: 'item/weapon/trident1', doll: 'player/hand1/trident', dmg: [2, 8], delay: 120, acc: 0, cls: 'polearm', reach: 2, level: 4, price: 55, desc: 'Three points. Reaches 2 squares.' }),
  W({ id: 'longbow', name: 'longbow', tile: 'item/weapon/ranged/longbow1', doll: 'player/hand1/bow', dmg: [3, 7], delay: 130, acc: 2, cls: 'bow', twoHanded: true, level: 6, price: 80, desc: 'A bow as tall as you. Its arrows go through doors (not really).' }),
  W({ id: 'scimitar', name: 'scimitar', tile: 'item/weapon/scimitar1', doll: 'player/hand1/scimitar', dmg: [3, 6], delay: 110, acc: 1, cls: 'blade', level: 6, price: 70, desc: 'Curved and cruel.' }),
  W({ id: 'morningstar', name: 'morningstar', tile: 'item/weapon/morningstar1', doll: 'player/hand1/morningstar', dmg: [3, 7], delay: 130, acc: 0, cls: 'mace', level: 6, price: 70, desc: 'A spiked ball on a stick, for mornings.' }),
  W({ id: 'greatsword', name: 'greatsword', tile: 'item/weapon/greatsword1', doll: 'player/hand1/great_sword', dmg: [4, 7], delay: 150, acc: -2, cls: 'blade', twoHanded: true, level: 7, price: 100, desc: 'A sword so big it is mostly a lifestyle.' }),
  W({ id: 'battle_axe', name: 'battleaxe', tile: 'item/weapon/battle_axe1', doll: 'player/hand1/battleaxe', dmg: [4, 8], delay: 160, acc: -3, cls: 'axe', twoHanded: true, level: 8, price: 100, desc: 'Two blades, two hands, zero subtlety.' }),
  W({ id: 'halberd', name: 'halberd', tile: 'item/weapon/halberd1', doll: 'player/hand1/halberd', dmg: [4, 7], delay: 150, acc: -1, cls: 'polearm', twoHanded: true, reach: 2, level: 7, price: 90, desc: 'An axe on a pole on a spear. Reaches 2 squares.' }),
  W({ id: 'great_mace', name: 'great mace', tile: 'item/weapon/mace_large1', doll: 'player/hand1/great_mace', dmg: [4, 8], delay: 160, acc: -3, cls: 'mace', twoHanded: true, level: 8, price: 100, desc: 'Very heavy. Things it hits become flatter.' }),
  W({ id: 'quickblade', name: 'quick blade', tile: 'item/weapon/quickblade1', doll: 'player/hand1/quick_blade', dmg: [2, 5], delay: 60, acc: 4, cls: 'dagger', level: 9, price: 140, desc: 'A blade that moves faster than thought. Unless your thoughts are very fast.' }),
  W({ id: 'executioner_axe', name: "executioner's axe", tile: 'item/weapon/executioner_axe1', doll: 'player/hand1/axe_executioner', dmg: [6, 8], delay: 180, acc: -4, cls: 'axe', twoHanded: true, level: 11, price: 180, desc: 'It has a job to do.' }),
  W({ id: 'demon_blade', name: 'demon blade', tile: 'item/weapon/demon_blade', doll: 'player/hand1/demonblade', dmg: [4, 7], delay: 110, acc: 2, cls: 'blade', level: 11, price: 180, desc: 'Forged in the ovens. Still warm.' }),
  W({ id: 'lajatang', name: 'lajatang', tile: 'item/weapon/lajatang1', doll: 'player/hand1/lajatang1', dmg: [5, 7], delay: 140, acc: 1, cls: 'staff', twoHanded: true, level: 11, price: 160, desc: 'A staff with a blade at each end. Twice the staff.' }),
  W({ id: 'arbalest', name: 'arbalest', tile: 'item/weapon/ranged/arbalest1', doll: 'player/hand1/arbalest', dmg: [5, 8], delay: 160, acc: 3, cls: 'bow', twoHanded: true, level: 10, price: 160, desc: 'A crossbow you crank. Ka-chunk.' }),
  W({ id: 'fists', name: 'fists', tile: 'item/weapon/club', doll: '', dmg: [1, 4], delay: 90, acc: 2, cls: 'unarmed', level: 99, price: 0, desc: 'Your fists.' }),
].map((w) => [w.id, w]));

const AR = (d: ArmourDef) => d;
export const ARMOURS: Record<string, ArmourDef> = Object.fromEntries([
  AR({ id: 'robe', name: 'robe', tile: 'item/armour/robe1', doll: 'player/body/robe_blue', slot: 'body', ac: 2, level: 1, price: 15, desc: 'Comfortable. Mystical. Machine washable.' }),
  AR({ id: 'apron', name: "baker's apron", tile: 'item/armour/robe2', doll: 'player/body/shirt_white1', slot: 'body', ac: 2, level: 99, price: 10, desc: 'Floury. +2 AC. Pockets.' }),
  AR({ id: 'leather', name: 'leather armour', tile: 'item/armour/leather_armour1', doll: 'player/body/leather_armour', slot: 'body', ac: 3, ev: -1, level: 1, price: 25, desc: 'Sturdy hide.' }),
  AR({ id: 'ring_mail', name: 'ring mail', tile: 'item/armour/ring_mail1', doll: 'player/body/ringmail', slot: 'body', ac: 5, ev: -2, level: 3, price: 45, desc: 'Metal rings sewn onto leather. Jingles.' }),
  AR({ id: 'scale_mail', name: 'scale mail', tile: 'item/armour/scale_mail1', doll: 'player/body/scalemail', slot: 'body', ac: 7, ev: -3, level: 5, price: 70, desc: 'Overlapping metal scales. You look like a fish knight.' }),
  AR({ id: 'chain_mail', name: 'chain mail', tile: 'item/armour/chain_mail1', doll: 'player/body/chainmail', slot: 'body', ac: 8, ev: -4, level: 6, price: 90, desc: 'Heavy chain. Fine protection.' }),
  AR({ id: 'plate', name: 'plate armour', tile: 'item/armour/plate1', doll: 'player/body/plate', slot: 'body', ac: 11, ev: -6, level: 9, price: 160, desc: 'A suit of steel. You are a can now.' }),
  AR({ id: 'troll_hide', name: 'troll hide', tile: 'item/armour/troll_leather_armour', doll: 'player/body/troll_hide', slot: 'body', ac: 5, ev: -2, level: 7, price: 140, desc: 'Troll skin. Still regenerates, a little.', mods: { regen: 2 } }),
  AR({ id: 'fire_dragon_armour', name: 'oven dragon scales', tile: 'item/armour/fire_dragon_armour', doll: 'player/body/dragonarm_red', slot: 'body', ac: 9, ev: -3, level: 11, price: 300, desc: 'Scales of a dragon that lived in the ovens.', mods: { rFire: 2, rCold: -1 } }),
  AR({ id: 'buckler', name: 'buckler', tile: 'item/armour/shields/buckler1', doll: 'player/hand2/buckler_round', slot: 'offhand', ac: 2, ev: 1, level: 1, price: 20, desc: 'A small shield. Good for parrying and for serving pie.' }),
  AR({ id: 'kite_shield', name: 'kite shield', tile: 'item/armour/shields/kite_shield1', doll: 'player/hand2/kite_shield_kite1', slot: 'offhand', ac: 4, ev: -1, level: 4, price: 50, desc: 'A proper shield. Not for flying.' }),
  AR({ id: 'tower_shield', name: 'tower shield', tile: 'item/armour/shields/tower_shield1', doll: 'player/hand2/tower_shield_green', slot: 'offhand', ac: 6, ev: -3, level: 8, price: 90, desc: 'A door you carry around.' }),
  AR({ id: 'cap', name: 'cap', tile: 'item/armour/headgear/hat1', doll: 'player/head/cap_black1', slot: 'head', ac: 1, level: 1, price: 10, desc: 'A cap. Keeps the drips off.' }),
  AR({ id: 'helmet', name: 'helmet', tile: 'item/armour/headgear/helmet1', doll: 'player/head/iron1', slot: 'head', ac: 2, level: 3, price: 30, desc: 'A metal bowl for your head.' }),
  AR({ id: 'wizard_hat', name: 'wizard hat', tile: 'item/armour/headgear/wizard_hat', doll: 'player/head/wizard_purple', slot: 'head', ac: 0, level: 3, price: 40, desc: 'Pointy. +2 spell power, because of the point.', mods: { spellPower: 2 } }),
  AR({ id: 'boots', name: 'boots', tile: 'item/armour/boots1', doll: 'player/boots/short_brown', slot: 'feet', ac: 1, level: 1, price: 15, desc: 'Boots for walking. Into danger.' }),
  AR({ id: 'gloves', name: 'gloves', tile: 'item/armour/glove1', doll: '', slot: 'hands', ac: 1, level: 2, price: 15, desc: 'Gloves. Do not touch the mould with bare hands.' }),
  AR({ id: 'cloak', name: 'cloak', tile: 'item/armour/cloak1_leather', doll: 'player/cloak/brown', slot: 'cloak', ac: 1, level: 1, price: 15, desc: 'Dramatic swishing included.' }),
].map((a) => [a.id, a]));

const J = (d: JewelDef) => d;
export const JEWELS: Record<string, JewelDef> = Object.fromEntries([
  J({ id: 'r_protection', name: 'ring of protection', slot: 'ring', mods: { ac: 4 }, desc: '+4 AC.', level: 2, price: 80 }),
  J({ id: 'r_evasion', name: 'ring of evasion', slot: 'ring', mods: { ev: 4 }, desc: '+4 EV.', level: 2, price: 80 }),
  J({ id: 'r_strength', name: 'ring of might', slot: 'ring', mods: { might: 3 }, desc: '+3 Might.', level: 3, price: 100 }),
  J({ id: 'r_dexterity', name: 'ring of agility', slot: 'ring', mods: { agility: 3 }, desc: '+3 Agility.', level: 3, price: 100 }),
  J({ id: 'r_intelligence', name: 'ring of wits', slot: 'ring', mods: { wits: 3 }, desc: '+3 Wits.', level: 3, price: 100 }),
  J({ id: 'r_fire', name: 'ring of fire resistance', slot: 'ring', mods: { rFire: 1 }, desc: 'Resist fire.', level: 4, price: 80 }),
  J({ id: 'r_ice', name: 'ring of cold resistance', slot: 'ring', mods: { rCold: 1 }, desc: 'Resist cold.', level: 4, price: 80 }),
  J({ id: 'r_poison', name: 'ring of poison resistance', slot: 'ring', mods: { rPoison: 1 }, desc: 'Resist poison.', level: 3, price: 70 }),
  J({ id: 'r_regen', name: 'ring of regeneration', slot: 'ring', mods: { regen: 6 }, desc: 'Heal faster.', level: 5, price: 150 }),
  J({ id: 'r_wizardry', name: 'ring of wizardry', slot: 'ring', mods: { spellPower: 4, maxMp: 3 }, desc: '+4 spell power, +3 MP.', level: 5, price: 140 }),
  J({ id: 'r_slaying', name: 'ring of slaying', slot: 'ring', mods: { acc: 3, dmg: 3 }, desc: '+3 accuracy, +3 damage.', level: 6, price: 160 }),
  J({ id: 'r_stealth', name: 'ring of stealth', slot: 'ring', mods: { stealth: 5 }, desc: 'Much stealthier.', level: 3, price: 70 }),
  J({ id: 'r_see_invis', name: 'ring of see invisible', slot: 'ring', mods: { flags: ['see_invis'] }, desc: 'See invisible creatures.', level: 5, price: 90 }),
  J({ id: 'r_teleport', name: 'ring of teleportitis', slot: 'ring', mods: { flags: ['teleportitis'] }, desc: 'Randomly teleports you. Fun!', level: 3, price: 20, bad: true }),
  J({ id: 'r_hunger', name: 'ring of loud chewing', slot: 'ring', mods: { stealth: -8 }, desc: 'You chew loudly. Constantly. On nothing.', level: 2, price: 5, bad: true }),
  J({ id: 'a_life', name: 'amulet of vitality', slot: 'amulet', mods: { maxHpPct: 15 }, desc: '+15% max HP.', level: 4, price: 150 }),
  J({ id: 'a_mana', name: 'amulet of the deep well', slot: 'amulet', mods: { maxMp: 6, mpRegen: 4 }, desc: '+6 MP, faster MP regeneration.', level: 4, price: 150 }),
  J({ id: 'a_rage', name: 'amulet of rage', slot: 'amulet', mods: { dmg: 2 }, abilities: ['berserk'], desc: 'Lets you go berserk. +2 damage.', level: 3, price: 100 }),
  J({ id: 'a_guardian', name: 'amulet of the guardian spirit', slot: 'amulet', mods: { ac: 3, ev: 3, flags: ['guardian'] }, desc: '+3 AC and EV. Warns of danger.', level: 6, price: 180 }),
  J({ id: 'a_vampire', name: 'amulet of the leech', slot: 'amulet', mods: { lifesteal: 12 }, desc: 'Melee hits heal you a little.', level: 7, price: 200 }),
  J({ id: 'a_speed', name: 'amulet of the hare', slot: 'amulet', mods: { moveSpeed: 25 }, desc: 'You move faster.', level: 6, price: 180 }),
  J({ id: 'a_harmless', name: 'amulet of mostly harmless', slot: 'amulet', mods: { flags: ['towel'] }, desc: 'Don\'t panic. It does nothing, but you feel like you know where your towel is.', level: 1, price: 42 }),
].map((j) => [j.id, j]));

const C = (d: ConsumableDef) => d;
export const CONSUMABLES: Record<string, ConsumableDef> = Object.fromEntries([
  // potions
  C({ id: 'p_curing', name: 'potion of curing', kind: 'potion', desc: 'Heals some and cures poison, confusion and other ailments.', level: 1, weight: 30, price: 25 }),
  C({ id: 'p_heal', name: 'potion of heal wounds', kind: 'potion', desc: 'Heals a lot of health. Tastes like cherry cough syrup and victory.', level: 2, weight: 18, price: 50 }),
  C({ id: 'p_mana', name: 'potion of magic', kind: 'potion', desc: 'Restores magic.', level: 2, weight: 12, price: 40 }),
  C({ id: 'p_might', name: 'potion of might', kind: 'potion', desc: 'Temporarily increases damage.', level: 1, weight: 10, price: 30 }),
  C({ id: 'p_agility', name: 'potion of nimbleness', kind: 'potion', desc: 'Temporarily increases evasion and accuracy.', level: 1, weight: 8, price: 30 }),
  C({ id: 'p_brilliance', name: 'potion of brilliance', kind: 'potion', desc: 'Temporarily increases spell power.', level: 2, weight: 7, price: 30 }),
  C({ id: 'p_haste', name: 'potion of haste', kind: 'potion', desc: 'Makes you fast for a while.', level: 3, weight: 9, price: 60 }),
  C({ id: 'p_berserk', name: 'potion of berserk rage', kind: 'potion', desc: 'Sends you into a rage.', level: 2, weight: 8, price: 30 }),
  C({ id: 'p_invis', name: 'potion of invisibility', kind: 'potion', desc: 'Makes you invisible.', level: 4, weight: 6, price: 50 }),
  C({ id: 'p_resist', name: 'potion of resistance', kind: 'potion', desc: 'Resist fire, cold, poison and shock for a while.', level: 5, weight: 6, price: 60 }),
  C({ id: 'p_flight', name: 'potion of flight', kind: 'potion', desc: 'You float. Over water, lava and chasms.', level: 4, weight: 5, price: 40 }),
  C({ id: 'p_experience', name: 'potion of experience', kind: 'potion', desc: 'Grants a level. Tastes like a montage.', level: 6, weight: 1.5, price: 400 }),
  C({ id: 'p_mutation', name: 'potion of mutation', kind: 'potion', desc: 'Grants a random mutation. Could be anything.', level: 3, weight: 5, price: 60 }),
  C({ id: 'p_gain', name: 'potion of potential', kind: 'potion', desc: 'Permanently raises a random attribute by 1.', level: 4, weight: 2, price: 300 }),
  C({ id: 'p_porridge', name: 'potion of porridge', kind: 'potion', desc: 'It is porridge. In a potion bottle. Restores 1 health and your will to live.', level: 1, weight: 4, price: 5 }),
  C({ id: 'p_poison', name: 'potion of poison', kind: 'potion', desc: 'Poisons the drinker. Do not drink. You will drink it.', level: 1, weight: 8, price: 5, bad: true }),
  C({ id: 'p_sleep', name: 'potion of naptime', kind: 'potion', desc: 'You fall asleep. In a dungeon. Good luck.', level: 2, weight: 3, price: 5, bad: true }),
  C({ id: 'p_regret', name: 'potion of regret', kind: 'potion', desc: 'Confuses the drinker. Also you will think about that thing you said in 2009.', level: 1, weight: 5, price: 5, bad: true }),
  // scrolls
  C({ id: 's_identify', name: 'scroll of identify', kind: 'scroll', desc: 'Identifies an item.', level: 1, weight: 25, price: 20 }),
  C({ id: 's_teleport', name: 'scroll of teleportation', kind: 'scroll', desc: 'Teleports you to a random spot on this level.', level: 1, weight: 14, price: 30 }),
  C({ id: 's_blink', name: 'scroll of blinking', kind: 'scroll', desc: 'Blinks you to a spot you choose nearby.', level: 2, weight: 10, price: 30 }),
  C({ id: 's_enchant_weapon', name: 'scroll of enchant weapon', kind: 'scroll', desc: '+1 to your weapon.', level: 1, weight: 12, price: 50 }),
  C({ id: 's_enchant_armour', name: 'scroll of enchant armour', kind: 'scroll', desc: '+1 to a piece of armour.', level: 1, weight: 14, price: 50 }),
  C({ id: 's_mapping', name: 'scroll of magic mapping', kind: 'scroll', desc: 'Maps this level.', level: 2, weight: 9, price: 40 }),
  C({ id: 's_fear', name: 'scroll of fear', kind: 'scroll', desc: 'Frightens nearby monsters.', level: 2, weight: 8, price: 30 }),
  C({ id: 's_fog', name: 'scroll of fog', kind: 'scroll', desc: 'Surrounds you with fog.', level: 1, weight: 8, price: 20 }),
  C({ id: 's_remove_curse', name: 'scroll of remove curse', kind: 'scroll', desc: 'Removes curses from your worn items.', level: 1, weight: 9, price: 30 }),
  C({ id: 's_immolation', name: 'scroll of immolation', kind: 'scroll', desc: 'Explodes in flames around you. Including on you.', level: 3, weight: 5, price: 30 }),
  C({ id: 's_acquirement', name: 'scroll of acquirement', kind: 'scroll', desc: 'Creates a good item.', level: 4, weight: 2, price: 300 }),
  C({ id: 's_noise', name: 'scroll of noise', kind: 'scroll', desc: 'Makes a terrible noise. Everything hears.', level: 1, weight: 7, price: 5, bad: true }),
  C({ id: 's_summoning', name: 'scroll of unwanted company', kind: 'scroll', desc: 'Summons hostile monsters.', level: 2, weight: 5, price: 5, bad: true }),
  C({ id: 's_amnesia', name: 'scroll of amnesia', kind: 'scroll', desc: 'Forget the map of this level.', level: 1, weight: 5, price: 5, bad: true }),
  C({ id: 's_useless', name: 'scroll of random uselessness', kind: 'scroll', desc: 'Does something. Probably not anything useful.', level: 1, weight: 6, price: 5 }),
  C({ id: 's_vuln', name: 'scroll of vulnerability', kind: 'scroll', desc: 'You become marked for death for a while.', level: 3, weight: 4, price: 5, bad: true }),
  // wands
  C({ id: 'w_flame', name: 'wand of flame', kind: 'wand', desc: 'Shoots bolts of fire.', level: 1, weight: 8, price: 60, ability: 'firebolt', charges: [4, 8] }),
  C({ id: 'w_frost', name: 'wand of frost', kind: 'wand', desc: 'Shoots shards of ice.', level: 1, weight: 8, price: 60, ability: 'frost_shard', charges: [4, 8] }),
  C({ id: 'w_lightning', name: 'wand of lightning', kind: 'wand', desc: 'Shoots lightning that pierces.', level: 5, weight: 5, price: 100, ability: 'lightning', charges: [3, 6] }),
  C({ id: 'w_slow', name: 'wand of slowing', kind: 'wand', desc: 'Slows a monster.', level: 2, weight: 6, price: 50, ability: 'slow', charges: [4, 8] }),
  C({ id: 'w_confuse', name: 'wand of confusion', kind: 'wand', desc: 'Confuses a monster.', level: 2, weight: 6, price: 50, ability: 'confuse', charges: [4, 8] }),
  C({ id: 'w_paralyse', name: 'wand of paralysis', kind: 'wand', desc: 'Paralyses a monster.', level: 5, weight: 4, price: 90, ability: 'paralyse', charges: [3, 6] }),
  C({ id: 'w_acid', name: 'wand of acid', kind: 'wand', desc: 'Corrosive splash.', level: 4, weight: 5, price: 80, ability: 'acid_flask', charges: [3, 6] }),
  C({ id: 'w_polymorph', name: 'wand of polymorph', kind: 'wand', desc: 'Turns a monster into another random monster. What could go wrong?', level: 3, weight: 4, price: 60, ability: 'polymorph', charges: [3, 6] }),
  C({ id: 'w_whatever', name: 'wand of whatever', kind: 'wand', desc: 'Does a random wand thing. A real roll of the dice.', level: 1, weight: 4, price: 40, ability: 'random', charges: [5, 10] }),
  C({ id: 'w_digging', name: 'wand of digging', kind: 'wand', desc: 'Digs through walls in a line.', level: 3, weight: 4, price: 60, ability: 'dig', charges: [4, 8] }),
].map((c) => [c.id, c]));

export const POTION_LOOKS = ['ruby', 'emerald', 'golden', 'murky', 'fizzy', 'bubbly', 'cloudy', 'black', 'brilliant_blue', 'brown', 'cyan', 'dark', 'effervescent', 'magenta', 'orange', 'pink', 'puce', 'purple_red', 'silver', 'sky_blue', 'white', 'yellow'];
export const SCROLL_LOOKS = ['scroll-blue', 'scroll-brown', 'scroll-cyan', 'scroll-green', 'scroll-grey', 'scroll-purple', 'scroll-red', 'scroll-yellow'];
export const WAND_LOOKS = ['gem_bone', 'gem_brass', 'gem_bronze', 'gem_copper', 'gem_glass', 'gem_gold', 'gem_iron', 'gem_ivory', 'gem_lead', 'gem_plastic', 'gem_silver', 'gem_wood'];
export const RING_LOOKS = ['agate', 'brass', 'bronze', 'clay', 'copper', 'coral', 'diamond', 'emerald', 'glass', 'gold', 'granite', 'iron', 'ivory', 'jade', 'moonstone', 'opal', 'pearl', 'ruby', 'silver', 'steel', 'tiger_eye', 'tourmaline', 'wooden'];
export const AMULET_LOOKS = ['amethyst', 'beryl', 'blue', 'bone', 'brass', 'bronze', 'cabochon', 'cameo', 'citrine', 'copper', 'diamond', 'emerald', 'filigree', 'fluorescent', 'garnet', 'golden', 'jade', 'jasper', 'lapis_lazuli', 'malachite', 'pearl', 'peridot'];

// Whole folders packed for appearance lookups (the atlas packer expands "/**").
export const LOOK_DIRS = ['item/potion/**', 'item/scroll/**', 'item/wand/**', 'item/ring/**', 'item/amulet/**'];
export const LOOK_TILES = {
  potion: (l: string) => `item/potion/${l}`,
  scroll: (l: string) => `item/scroll/${l}`,
  wand: (l: string) => `item/wand/${l}`,
  ring: (l: string) => `item/ring/${l}`,
  amulet: (l: string) => `item/amulet/${l}`,
};

/** Scroll labels are generated nonsense; each run has its own. */
export const SCROLL_SYLLABLES = ['zot', 'blarg', 'xyzzy', 'plugh', 'frob', 'nitz', 'ka', 'boom', 'snerk', 'quux', 'oog', 'ulp', 'glorp', 'wub', 'fnord', 'mumble', 'bork', 'zz', 'ack', 'hork', 'gax', 'wib', 'yerp', 'flimbo'];

export const WEAPON_EGOS: Record<string, { name: string; desc: string }> = {
  flaming: { name: 'flaming', desc: 'Extra fire damage.' },
  freezing: { name: 'freezing', desc: 'Extra cold damage; may slow.' },
  venom: { name: 'venom', desc: 'Poisons.' },
  draining: { name: 'draining', desc: 'Extra necrotic damage.' },
  vampiric: { name: 'vampiric', desc: 'Heals you on hit.' },
  speed: { name: 'speed', desc: 'Attacks faster.' },
  holy: { name: 'holy wrath', desc: 'Extra damage to undead and demons.' },
  electric: { name: 'electrocution', desc: 'Sometimes zaps for big shock damage.' },
  chaos: { name: 'whatever', desc: 'Random extra effects.' },
  crumbs: { name: 'crumbs', desc: 'Leaves crumbs. Does nothing else. You love it.' },
};
export const ARMOUR_EGOS: Record<string, { name: string; mods: Mods }> = {
  fire_res: { name: 'fire resistance', mods: { rFire: 1 } },
  cold_res: { name: 'cold resistance', mods: { rCold: 1 } },
  poison_res: { name: 'poison resistance', mods: { rPoison: 1 } },
  protection: { name: 'protection', mods: { ac: 3 } },
  evasion: { name: 'evasion', mods: { ev: 3 } },
  stealth: { name: 'stealth', mods: { stealth: 4 } },
  regen: { name: 'regeneration', mods: { regen: 4 } },
  spirit: { name: 'the spirit', mods: { maxMp: 4 } },
  sight: { name: 'far sight', mods: { sight: 1 } },
};

/** Tile shown for each family's essence. */
export const ESSENCE_TILES: Record<string, string> = {
  beast: 'item/misc/runes/rune_swamp', vermin: 'item/misc/runes/rune_spider', fungus: 'item/misc/runes/rune_slime',
  ooze: 'item/misc/runes/rune_slime', undead: 'item/misc/runes/rune_tomb', demon: 'item/misc/runes/rune_gehenna',
  aquatic: 'item/misc/runes/rune_shoals', fire: 'item/misc/runes/rune_dis', flesh: 'item/misc/runes/rune_abyss',
  dough: 'item/misc/runes/rune_elven', construct: 'item/misc/runes/rune_vaults', humanoid: 'item/misc/runes/generic',
  eye: 'item/misc/runes/rune_cerebov',
};

export const GOLD_TILE = 'item/gold/06';
export const NOTE_TILE = 'item/scroll/scroll';
export const TOME_TILES = ['item/book/red', 'item/book/cyan', 'item/book/gold', 'item/book/purple', 'item/book/dark_green', 'item/book/plaid', 'item/book/metal_blue'];
