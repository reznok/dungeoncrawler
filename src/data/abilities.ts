import type { Element } from '../core/types';

export type AbilityKind =
  | 'bolt' | 'beam' | 'ball' | 'nova' | 'smite' | 'cone'
  | 'heal' | 'buff' | 'hex' | 'summon' | 'blink' | 'teleport'
  | 'dash' | 'cleave' | 'strike' | 'cloud' | 'map' | 'shout' | 'devour' | 'drain' | 'mass_hex' | 'cleanse';

export interface AbilityDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  kind: AbilityKind;
  target: 'self' | 'enemy' | 'tile' | 'corpse';
  range: number;
  mp?: number;
  hp?: number; // blood magic cost
  cooldown?: number;
  element?: Element;
  dice?: [number, number];
  scale?: number; // extra die sides per 10 power
  radius?: number;
  status?: string;
  statusTurns?: number;
  statusPower?: number;
  summon?: string;
  count?: number;
  heal?: number; // base heal; +power/2
  mult?: number; // strike/cleave/dash damage multiplier
  cloud?: string;
  fx?: string; // projectile/flash tile
  verb?: string; // monster message: "{m} {verb}."
  noise?: number;
  resist?: Attr; // hexes: target resists with
  self?: boolean; // ball can hurt caster
}
type Attr = 'will';

const A = (d: AbilityDef) => d;

export const ABILITIES: Record<string, AbilityDef> = Object.fromEntries([
  // ---- conjurations
  A({ id: 'magic_dart', name: 'Magic Dart', icon: 'gui/spells/conjuration/magic_dart', desc: 'A dart of force that never misses.', kind: 'smite', target: 'enemy', range: 7, mp: 1, element: 'phys', dice: [1, 6], scale: 2, fx: 'effect/magic_dart*' }),
  A({ id: 'firebolt', name: 'Firebolt', icon: 'gui/spells/fire/bolt_of_fire', desc: 'Hurls a bolt of fire at the first creature in its path.', kind: 'bolt', target: 'enemy', range: 7, mp: 3, element: 'fire', dice: [3, 6], scale: 3, fx: 'effect/flame*', verb: 'hurls a bolt of fire' }),
  A({ id: 'fireball', name: 'Fireball', icon: 'gui/spells/fire/fireball', desc: 'An exploding ball of flame. Mind your eyebrows.', kind: 'ball', target: 'tile', range: 7, mp: 6, element: 'fire', dice: [3, 8], scale: 3, radius: 1, fx: 'effect/flame*', self: true, noise: 8, verb: 'throws a fireball' }),
  A({ id: 'frost_shard', name: 'Frost Shard', icon: 'gui/spells/ice/throw_icicle', desc: 'A shard of ice that may slow its target.', kind: 'bolt', target: 'enemy', range: 7, mp: 2, element: 'cold', dice: [2, 6], scale: 3, status: 'slow', statusTurns: 3, fx: 'effect/icicle*', verb: 'flings a shard of ice' }),
  A({ id: 'freezing_cone', name: 'Cone of Cold', icon: 'gui/spells/ice/freezing_cloud', desc: 'A cone of biting cold.', kind: 'cone', target: 'tile', range: 4, mp: 5, element: 'cold', dice: [3, 7], scale: 3, fx: 'effect/frost*' }),
  A({ id: 'lightning', name: 'Lightning Bolt', icon: 'gui/spells/air/lightning_bolt', desc: 'A beam of lightning that passes through everything in a line.', kind: 'beam', target: 'tile', range: 8, mp: 6, element: 'shock', dice: [3, 9], scale: 3, fx: 'effect/zap*', noise: 10, verb: 'calls lightning' }),
  A({ id: 'chain_lightning', name: 'Static Storm', icon: 'gui/spells/air/chain_lightning', desc: 'Lightning strikes every enemy around you.', kind: 'nova', target: 'self', range: 0, radius: 3, mp: 10, element: 'shock', dice: [4, 8], scale: 3, fx: 'effect/electric_arc*', noise: 12 }),
  A({ id: 'venom_bolt', name: 'Venom Bolt', icon: 'gui/spells/alchemy/venom_bolt', desc: 'A gob of venom. Poisons strongly.', kind: 'bolt', target: 'enemy', range: 7, mp: 4, element: 'poison', dice: [2, 6], scale: 2, status: 'poison', statusTurns: 6, statusPower: 3, fx: 'effect/poison_arrow*', verb: 'spits venom' }),
  A({ id: 'stone_spear', name: 'Stone Spear', icon: 'gui/spells/earth/lehudibs_crystal_spear', desc: 'A heavy spear of rock. Ignores half of armour.', kind: 'bolt', target: 'enemy', range: 6, mp: 5, element: 'phys', dice: [4, 8], scale: 4, fx: 'effect/crystal_spear*', verb: 'hurls a spear of stone' }),
  A({ id: 'drain_life', name: 'Drain Life', icon: 'gui/spells/necromancy/vampiric_draining', desc: 'Touch an adjacent creature and drink its life.', kind: 'drain', target: 'enemy', range: 1, mp: 3, element: 'necro', dice: [2, 8], scale: 3, fx: 'effect/drain*', verb: 'drains life' }),
  A({ id: 'agony', name: 'Grave Chill', icon: 'gui/spells/necromancy/agony', desc: 'Necrotic cold rots the target from within.', kind: 'smite', target: 'enemy', range: 6, mp: 4, element: 'necro', dice: [3, 6], scale: 3, fx: 'effect/drain*', verb: 'curses you with grave chill' }),
  A({ id: 'smite', name: 'Smite', icon: 'gui/invocations/tso_cleansing_flame', desc: 'Holy fire falls on the target. Undead and demons take double.', kind: 'smite', target: 'enemy', range: 7, mp: 3, element: 'holy', dice: [2, 8], scale: 3, fx: 'effect/light_beam*' }),
  A({ id: 'bread_bolt', name: 'Hurl Scalding Loaf', icon: 'item/food/bread_ration', desc: 'A loaf straight from a memory of the oven. Very hot. Very crusty.', kind: 'bolt', target: 'enemy', range: 7, mp: 2, element: 'fire', dice: [2, 6], scale: 3, fx: 'item/food/bread_ration', verb: 'hurls a scalding loaf' }),
  A({ id: 'baguette_beam', name: 'Baguette of Judgement', icon: 'item/weapon/quarterstaff', desc: 'A beam of pure, impossibly long bread pierces every foe in a line.', kind: 'beam', target: 'tile', range: 7, mp: 5, element: 'dough', dice: [3, 8], scale: 4, fx: 'effect/light_beam*' }),
  A({ id: 'pie', name: 'Pie to the Face', icon: 'effect/pie*', desc: 'A cream pie. Blinds and humiliates.', kind: 'bolt', target: 'enemy', range: 6, mp: 2, element: 'phys', dice: [1, 3], scale: 0, status: 'blind', statusTurns: 4, fx: 'effect/pie*', verb: 'throws a pie at you' }),
  A({ id: 'chaos_bolt', name: 'Bolt of Whatever', icon: 'gui/spells/monster/chain_of_chaos', desc: 'Its element is decided after it hits. Nobody knows how.', kind: 'bolt', target: 'enemy', range: 7, mp: 3, element: 'phys', dice: [3, 7], scale: 4, fx: 'effect/chaos*' }),
  // ---- hexes
  A({ id: 'slow', name: 'Slow', icon: 'gui/spells/monster/sleep', desc: 'Slows the target to a crawl.', kind: 'hex', target: 'enemy', range: 7, mp: 3, status: 'slow', statusTurns: 8, fx: 'effect/bolt*', verb: 'gestures slowly at you' }),
  A({ id: 'confuse', name: 'Befuddle', icon: 'gui/spells/monster/mindburst', desc: 'Confuses the target.', kind: 'hex', target: 'enemy', range: 7, mp: 3, status: 'confused', statusTurns: 6, fx: 'effect/chaos*', verb: 'befuddles you' }),
  A({ id: 'fear', name: 'Dread', icon: 'gui/spells/monster/mourning_wail', desc: 'Fills enemies around you with dread.', kind: 'mass_hex', target: 'self', range: 0, radius: 4, mp: 5, status: 'afraid', statusTurns: 8 }),
  A({ id: 'paralyse', name: 'Hold', icon: 'gui/spells/monster/paralysis_gaze', desc: 'Holds the target still.', kind: 'hex', target: 'enemy', range: 6, mp: 6, status: 'paralysed', statusTurns: 3, fx: 'effect/bolt*', verb: 'stares; you cannot move' }),
  A({ id: 'mark', name: 'Mark for Death', icon: 'gui/spells/monster/sentinel_mark', desc: 'The target takes 50% more damage from everything.', kind: 'hex', target: 'enemy', range: 7, mp: 3, status: 'marked', statusTurns: 10, verb: 'marks you for death' }),
  A({ id: 'doughify', name: 'Proof', icon: 'item/food/bread_ration', desc: 'Turns the target partly into dough: slow, soft, and smells nice.', kind: 'hex', target: 'enemy', range: 6, mp: 4, status: 'doughy', statusTurns: 8, verb: 'kneads the air at you' }),
  A({ id: 'sleep', name: 'Lullaby', icon: 'gui/spells/monster/sleep', desc: 'Puts the target to sleep.', kind: 'hex', target: 'enemy', range: 6, mp: 4, status: 'asleep', statusTurns: 10, verb: 'sings softly' }),
  A({ id: 'weaken', name: 'Enfeeble', icon: 'gui/spells/necromancy/excruciating_wounds', desc: 'Saps the target\'s strength.', kind: 'hex', target: 'enemy', range: 6, mp: 3, status: 'weak', statusTurns: 10, verb: 'saps your strength' }),
  // ---- buffs and utility
  A({ id: 'heal', name: 'Mend', icon: 'gui/abilities/heal_wounds', desc: 'Heals your wounds.', kind: 'heal', target: 'self', range: 0, mp: 4, heal: 10, cooldown: 4 }),
  A({ id: 'blink', name: 'Blink', icon: 'gui/spells/translocation/blink', desc: 'Teleports you to a visible spot nearby.', kind: 'blink', target: 'tile', range: 5, mp: 3, cooldown: 3 }),
  A({ id: 'leap', name: 'Leap', icon: 'gui/abilities/hop', desc: 'A big frog jump to a visible spot.', kind: 'blink', target: 'tile', range: 3, cooldown: 6 }),
  A({ id: 'stoneskin', name: 'Stoneskin', icon: 'gui/spells/earth/petrify', desc: 'Your skin hardens: +AC.', kind: 'buff', target: 'self', range: 0, mp: 4, status: 'stoneskin', statusTurns: 30, statusPower: 5, cooldown: 10 }),
  A({ id: 'haste_self', name: 'Haste', icon: 'gui/spells/air/swiftness', desc: 'You move and act faster for a while.', kind: 'buff', target: 'self', range: 0, mp: 8, status: 'haste', statusTurns: 12, cooldown: 30 }),
  A({ id: 'berserk', name: 'Berserk', icon: 'gui/spells/monster/battlecry', desc: 'Rage: more damage and speed, less evasion. Tired afterwards.', kind: 'buff', target: 'self', range: 0, status: 'berserk', statusTurns: 12, cooldown: 40, verb: 'goes berserk' }),
  A({ id: 'invisible', name: 'Vanish', icon: 'gui/abilities/evoke_invisibility', desc: 'Become invisible. Most monsters lose track of you.', kind: 'buff', target: 'self', range: 0, mp: 6, status: 'invisible', statusTurns: 15, cooldown: 30 }),
  A({ id: 'regen_self', name: 'Second Wind', icon: 'gui/spells/monster/regeneration', desc: 'Regenerate quickly for a while.', kind: 'buff', target: 'self', range: 0, status: 'regen', statusTurns: 15, statusPower: 3, cooldown: 40 }),
  A({ id: 'shield', name: 'Ward', icon: 'gui/spells/ice/ozocubus_armour', desc: 'A ward that absorbs damage.', kind: 'buff', target: 'self', range: 0, mp: 5, status: 'shielded', statusTurns: 30, statusPower: 12, cooldown: 15 }),
  A({ id: 'might_self', name: 'Rise', icon: 'item/food/bread_ration', desc: 'You rise like good dough: +damage, +max HP for a while.', kind: 'buff', target: 'self', range: 0, mp: 4, status: 'risen', statusTurns: 20, statusPower: 4, cooldown: 25 }),
  A({ id: 'cleanse', name: 'Purify', icon: 'gui/invocations/elyvilon_purification', desc: 'Removes poison, slow, confusion, weakness and other ailments.', kind: 'cleanse', target: 'self', range: 0, mp: 3, cooldown: 10 }),
  A({ id: 'mapping', name: 'Sense Surroundings', icon: 'gui/spells/monster/sentinel_mark', desc: 'Maps the area around you.', kind: 'map', target: 'self', range: 0, mp: 4, radius: 18, cooldown: 40 }),
  A({ id: 'shadowstep', name: 'Shadow Step', icon: 'gui/spells/monster/shadow/shadow_bind', desc: 'Step through shadows to a visible spot and strike whoever is there.', kind: 'blink', target: 'tile', range: 6, mp: 4, cooldown: 8 }),
  A({ id: 'fog', name: 'Smoke Bomb', icon: 'effect/cloud_grey_smoke', desc: 'Fills the area around you with smoke.', kind: 'cloud', target: 'self', range: 0, radius: 2, cloud: 'smoke', cooldown: 20 }),
  A({ id: 'poison_cloud', name: 'Miasma', icon: 'gui/spells/alchemy/mephitic_cloud', desc: 'A cloud of poison at a spot.', kind: 'cloud', target: 'tile', range: 6, mp: 5, radius: 1, cloud: 'poison', statusPower: 3, verb: 'exhales miasma' }),
  A({ id: 'flame_cloud', name: 'Oven Breath', icon: 'gui/abilities/breathe_fire', desc: 'A cone of burning air.', kind: 'cone', target: 'tile', range: 4, mp: 5, element: 'fire', dice: [3, 6], scale: 3, fx: 'effect/flame*', verb: 'breathes oven heat' }),
  A({ id: 'shout', name: 'War Cry', icon: 'gui/spells/monster/battlecry', desc: 'A terrible shout. Frightens weak foes nearby and wakes everything.', kind: 'shout', target: 'self', range: 0, radius: 5, status: 'afraid', statusTurns: 6, cooldown: 20, noise: 20 }),
  A({ id: 'devour', name: 'Devour', icon: 'gui/spells/necromancy/corpse_rot', desc: 'Eat a fresh corpse beneath or beside you. Heals a lot. Disgusting.', kind: 'devour', target: 'self', range: 1, heal: 20, cooldown: 5 }),
  // ---- martial
  A({ id: 'power_strike', name: 'Crushing Blow', icon: 'gui/abilities/bestial_takedown', desc: 'A heavy melee strike for extra damage.', kind: 'strike', target: 'enemy', range: 1, mp: 2, mult: 1.8, cooldown: 3 }),
  A({ id: 'cleave', name: 'Whirlwind', icon: 'gui/spells/monster/shezas_dance', desc: 'Attack every adjacent enemy.', kind: 'cleave', target: 'self', range: 1, mp: 3, mult: 1.0, cooldown: 4 }),
  A({ id: 'lunge', name: 'Lunge', icon: 'gui/spells/translocation/electric_charge', desc: 'Dash up to 4 squares toward an enemy and strike it.', kind: 'dash', target: 'enemy', range: 4, mp: 2, mult: 1.3, cooldown: 5 }),
  A({ id: 'stun_strike', name: 'Bonk', icon: 'gui/spells/monster/seismic_stomp', desc: 'A strike to the head. May leave them seeing stars.', kind: 'strike', target: 'enemy', range: 1, mp: 2, mult: 1.0, status: 'paralysed', statusTurns: 2, cooldown: 6 }),
  A({ id: 'backstab', name: 'Twist the Knife', icon: 'gui/spells/necromancy/excruciating_wounds', desc: 'A brutal strike. Triple damage against unaware or fleeing foes.', kind: 'strike', target: 'enemy', range: 1, mult: 1.2, cooldown: 4 }),
  A({ id: 'rapid_shot', name: 'Volley', icon: 'gui/spells/conjuration/force_lance', desc: 'Fire three shots at a target.', kind: 'bolt', target: 'enemy', range: 8, mp: 3, element: 'phys', dice: [3, 5], scale: 2, count: 3, fx: 'effect/arrow*', cooldown: 4 }),
  A({ id: 'pin_shot', name: 'Pinning Shot', icon: 'gui/spells/monster/harpoon_shot', desc: 'A shot that pins the target in place.', kind: 'bolt', target: 'enemy', range: 8, mp: 2, element: 'phys', dice: [2, 6], scale: 2, status: 'entangled', statusTurns: 4, fx: 'effect/arrow*', cooldown: 6 }),
  A({ id: 'bomb', name: 'Flask Bomb', icon: 'effect/alembic_potion*', desc: 'A flask of something volatile.', kind: 'ball', target: 'tile', range: 6, mp: 3, element: 'fire', dice: [3, 6], scale: 3, radius: 1, fx: 'effect/alembic_potion*', self: true, noise: 8 }),
  A({ id: 'acid_flask', name: 'Acid Flask', icon: 'effect/cloud_acid*', desc: 'Corrodes armour and flesh alike.', kind: 'ball', target: 'tile', range: 6, mp: 3, element: 'acid', dice: [2, 6], scale: 3, radius: 1, status: 'corroded', statusTurns: 10, fx: 'effect/cloud_acid*', self: true }),
  // ---- summoning
  A({ id: 'summon_rat', name: 'Call Rats', icon: 'gui/spells/summoning/summon_small_mammal', desc: 'Calls rats to fight for you. They will not stay.', kind: 'summon', target: 'self', range: 0, mp: 3, summon: 'rat', count: 2, cooldown: 8 }),
  A({ id: 'summon_wolf', name: 'Call the Pack', icon: 'gui/spells/summoning/call_canine_familiar', desc: 'Wolves answer your howl.', kind: 'summon', target: 'self', range: 0, mp: 6, summon: 'wolf', count: 2, cooldown: 20 }),
  A({ id: 'summon_bear', name: 'Bear Necessities', icon: 'gui/spells/summoning/summon_small_mammal', desc: 'A large, angry bear. It is on your side. Probably.', kind: 'summon', target: 'self', range: 0, mp: 9, summon: 'bear', count: 1, cooldown: 35 }),
  A({ id: 'raise_dead', name: 'Raise the Fallen', icon: 'gui/spells/necromancy/animate_dead', desc: 'Raises skeletons from nearby corpses (or the bones of the floor).', kind: 'summon', target: 'self', range: 0, mp: 5, summon: 'skeleton', count: 2, cooldown: 15 }),
  A({ id: 'loaf_golem', name: 'Knead Loaf Golem', icon: 'item/food/bread_ration', desc: 'Kneads a golem out of sourdough. It is warm and loyal and has no thoughts.', kind: 'summon', target: 'self', range: 0, mp: 6, summon: 'loaf_golem', count: 1, cooldown: 25 }),
  A({ id: 'summon_imp', name: 'Call Imp', icon: 'gui/spells/summoning/call_imp', desc: 'An imp, bound to help. It complains the whole time.', kind: 'summon', target: 'self', range: 0, mp: 4, summon: 'imp', count: 1, cooldown: 12 }),
  A({ id: 'summon_minion', name: 'Summon', icon: 'gui/spells/summoning/summon_demon', desc: 'Calls help.', kind: 'summon', target: 'self', range: 0, verb: 'calls for help' }),
  // ---- patron powers (cost favour, not magic)
  A({ id: 'hearth_heal', name: "Hearth's Comfort", icon: 'gui/invocations/elyvilon_heal_self', desc: 'Warmth fills you. Heals and cleanses.', kind: 'heal', target: 'self', range: 0, heal: 25, cooldown: 3 }),
  A({ id: 'hearth_ward', name: 'Warm Embrace', icon: 'gui/invocations/elyvilon_purification', desc: 'A warm ward wraps around you.', kind: 'buff', target: 'self', range: 0, status: 'shielded', statusTurns: 40, cooldown: 10 }),
  A({ id: 'hearth_fire', name: "Oven's Wrath", icon: 'gui/invocations/tso_cleansing_flame', desc: 'Holy fire bursts out around you.', kind: 'nova', target: 'self', range: 0, radius: 3, element: 'holy', dice: [5, 8], scale: 3, cooldown: 8 }),
  A({ id: 'dm_initiative', name: 'Roll for Initiative', icon: 'gui/invocations/nemelex_triple_draw', desc: 'You get an extra few turns. Natural 20!', kind: 'buff', target: 'self', range: 0, status: 'haste', statusTurns: 6, cooldown: 15 }),
  A({ id: 'dm_fumble', name: 'Critical Fumble', icon: 'gui/invocations/nemelex_deal_four', desc: 'The DM rules that your target rolled a 1. It is confused and vulnerable.', kind: 'hex', target: 'enemy', range: 7, status: 'marked', statusTurns: 10, cooldown: 6 }),
  A({ id: 'dm_fiat', name: 'DM Fiat', icon: 'gui/invocations/nemelex_stack_five', desc: 'The DM decides something dramatic happens. You will find out what.', kind: 'nova', target: 'self', range: 0, radius: 5, element: 'phys', dice: [6, 6], scale: 2, cooldown: 20 }),
  A({ id: 'speed_skip', name: 'Frame Skip', icon: 'gui/spells/translocation/blink', desc: 'Clip through space to a visible spot.', kind: 'blink', target: 'tile', range: 6, cooldown: 2 }),
  A({ id: 'speed_warp', name: 'Warp Zone', icon: 'gui/spells/translocation/portal_projectile', desc: 'Teleport right next to the stairs down. Skip, skip, skip.', kind: 'teleport', target: 'self', range: 0, cooldown: 30 }),
  A({ id: 'rat_swarm', name: 'Squeak of Summoning', icon: 'gui/spells/summoning/summon_small_mammal', desc: 'Rats. Many rats.', kind: 'summon', target: 'self', range: 0, summon: 'rat', count: 5, cooldown: 10 }),
  A({ id: 'rat_plague', name: 'Plague', icon: 'gui/spells/alchemy/olgrebs_toxic_radiance', desc: 'A wave of rat-borne sickness poisons everything around you.', kind: 'nova', target: 'self', range: 0, radius: 4, element: 'poison', dice: [2, 6], scale: 2, status: 'poison', statusTurns: 8, cooldown: 12 }),
  A({ id: 'rat_king', name: 'Royal Guard', icon: 'gui/spells/summoning/monstrous_menagerie', desc: 'The rats of unusual size answer their king.', kind: 'summon', target: 'self', range: 0, summon: 'orange_rat', count: 4, cooldown: 25 }),
  A({ id: 'thing_eye', name: 'Open the Eye', icon: 'gui/spells/monster/sentinel_mark', desc: 'The Thing shows you the shape of this place.', kind: 'map', target: 'self', range: 0, radius: 30, cooldown: 25 }),
  A({ id: 'thing_maw', name: 'The Hungry Dark', icon: 'gui/spells/necromancy/vampiric_draining', desc: 'Darkness bites a creature and feeds you what it takes.', kind: 'drain', target: 'enemy', range: 6, element: 'necro', dice: [4, 8], scale: 3, cooldown: 5 }),
  A({ id: 'thing_unmake', name: 'Unmake', icon: 'gui/spells/necromancy/symbol_of_torment', desc: 'You say a word you should not know. Something stops existing.', kind: 'smite', target: 'enemy', range: 7, element: 'necro', dice: [10, 10], scale: 4, cooldown: 30 }),
  // ---- monster-only
  A({ id: 'spit_acid', name: 'Spit Acid', icon: 'gui/spells/monster/spit_acid', desc: 'Spits acid.', kind: 'bolt', target: 'enemy', range: 5, element: 'acid', dice: [2, 5], scale: 1, status: 'corroded', statusTurns: 6, fx: 'effect/cloud_acid*', verb: 'spits acid' }),
  A({ id: 'arrow', name: 'Shoot', icon: 'gui/spells/conjuration/force_lance', desc: 'Shoots an arrow.', kind: 'bolt', target: 'enemy', range: 8, element: 'phys', dice: [1, 8], scale: 2, fx: 'effect/arrow*', verb: 'shoots' }),
  A({ id: 'sling', name: 'Sling Stone', icon: 'gui/spells/conjuration/force_lance', desc: 'Slings a stone.', kind: 'bolt', target: 'enemy', range: 7, element: 'phys', dice: [1, 6], scale: 1, fx: 'effect/sling_bullet*', verb: 'slings a stone' }),
  A({ id: 'spore', name: 'Spore Burst', icon: 'gui/spells/monster/sporulate', desc: 'Bursts in a cloud of spores.', kind: 'nova', target: 'self', range: 0, radius: 1, element: 'poison', dice: [2, 6], scale: 1, status: 'confused', statusTurns: 3, fx: 'effect/cloud_poison*', verb: 'bursts into spores' }),
  A({ id: 'web', name: 'Spin Web', icon: 'gui/spells/monster/ensnare', desc: 'Shoots sticky web.', kind: 'hex', target: 'enemy', range: 5, status: 'entangled', statusTurns: 3, fx: 'effect/throwing_net*', verb: 'shoots a web' }),
  A({ id: 'howl', name: 'Howl', icon: 'gui/spells/monster/hunting_call', desc: 'Howls to rouse the pack.', kind: 'shout', target: 'self', range: 0, radius: 12, noise: 15, verb: 'howls' }),
  A({ id: 'drown', name: 'Drowning Grasp', icon: 'gui/spells/monster/call_tide', desc: 'Water fills your lungs.', kind: 'smite', target: 'enemy', range: 5, element: 'cold', dice: [2, 8], scale: 2, verb: 'sings a drowned hymn; water fills your lungs' }),
  A({ id: 'blink_away', name: 'Blink Away', icon: 'gui/spells/translocation/blink', desc: 'Blinks away.', kind: 'teleport', target: 'self', range: 0, verb: 'blinks away' }),
  A({ id: 'heal_other', name: 'Heal Ally', icon: 'gui/abilities/heal_wounds', desc: 'Heals itself.', kind: 'heal', target: 'self', range: 0, heal: 15, verb: 'is surrounded by a soft glow' }),
  A({ id: 'haste_ally', name: 'Quicken', icon: 'gui/spells/air/swiftness', desc: 'Hastes itself.', kind: 'buff', target: 'self', range: 0, status: 'haste', statusTurns: 8, verb: 'speeds up' }),
  A({ id: 'gaze_drain', name: 'Draining Gaze', icon: 'gui/spells/monster/draining_gaze', desc: 'Drains your magic.', kind: 'smite', target: 'enemy', range: 6, element: 'necro', dice: [2, 6], scale: 2, verb: 'gazes at you; you feel drained' }),
  A({ id: 'form_27b', name: 'Paperwork', icon: 'item/scroll/scroll', desc: 'Demands paperwork.', kind: 'hex', target: 'enemy', range: 6, status: 'slow', statusTurns: 4, fx: 'item/scroll/scroll', verb: 'serves you form 27-B (stroke 6). You feel bureaucratically slowed' }),
  A({ id: 'mother_rise', name: 'Rise', icon: 'item/food/bread_ration', desc: 'Mother rises.', kind: 'buff', target: 'self', range: 0, status: 'risen', statusTurns: 30, statusPower: 6, verb: 'RISES' }),
  A({ id: 'mother_spawn', name: 'Starter Spawn', icon: 'item/food/bread_ration', desc: 'Mother buds.', kind: 'summon', target: 'self', range: 0, summon: 'starter_spawn', count: 2, verb: 'buds off lumps of living starter' }),
  A({ id: 'mother_call', name: 'The Call of Mother', icon: 'gui/spells/monster/siren_song', desc: '...', kind: 'hex', target: 'enemy', range: 9, status: 'doughy', statusTurns: 4, verb: 'calls to you in your grandmother\'s voice. You feel yourself softening' }),
].map((a) => [a.id, a]));
