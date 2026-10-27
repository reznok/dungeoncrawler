import type { Mods } from '../core/types';

export interface PatronPower { ability: string; favor: number; cost: number }
export interface PatronDef {
  id: string;
  name: string;
  title: string;
  altar: string;
  desc: string;
  pitch: string; // what they say when you approach
  passive: (favor: number) => Mods;
  passiveText: string;
  powers: PatronPower[];
  likes: string;
}

export const PATRONS: Record<string, PatronDef> = Object.fromEntries(([
  {
    id: 'hettie', name: 'Saint Hettie of the Hearth', title: 'Hearthkeeper', altar: 'dngn/altars/elyvilon',
    desc: 'A little altar with a loaf of bread on it, still warm. Someone has carved a woman\'s face into the stone, smiling.',
    pitch: 'A warm voice, very far away and very tired: "Oh, love. You\'re going down there too? Then let me keep you warm."',
    passive: (f) => ({ regen: 2 + Math.floor(f / 40), maxHp: Math.floor(f / 10) }), passiveText: 'Faster healing and more health as her favour grows.',
    powers: [{ ability: 'hearth_heal', favor: 10, cost: 8 }, { ability: 'hearth_ward', favor: 40, cost: 15 }, { ability: 'hearth_fire', favor: 90, cost: 25 }],
    likes: 'Killing the things that serve Mother.',
  },
  {
    id: 'dm', name: 'The Dungeon Master', title: 'Player Character', altar: 'dngn/altars/nemelex1',
    desc: 'An altar shaped like a folding cardboard screen. Behind it, something rolls dice and mutters about "the rules as written".',
    pitch: 'A voice from behind the screen: "Okay. Okay. Roll for initiative. No, the d20. The POINTY one."',
    passive: (f) => ({ crit: 4 + Math.floor(f / 25), xpPct: 5 + Math.floor(f / 20) }), passiveText: 'More critical hits and more experience.',
    powers: [{ ability: 'dm_initiative', favor: 10, cost: 10 }, { ability: 'dm_fumble', favor: 35, cost: 12 }, { ability: 'dm_fiat', favor: 80, cost: 30 }],
    likes: 'Killing things. Making it interesting.',
  },
  {
    id: 'speed', name: 'The Speedrunner', title: 'Any%', altar: 'dngn/altars/okawaru',
    desc: 'The altar has a timer carved into it, still counting. Someone has scratched "NO BACKTRACKING" underneath.',
    pitch: 'A voice, very fast: "Okay-okay-okay listen you have to go FAST, every second counts, do NOT go back upstairs, that resets the run."',
    passive: (f) => ({ moveSpeed: 10 + Math.floor(f / 10), speed: Math.floor(f / 25) }), passiveText: 'Move and act faster. Going back upstairs angers it.',
    powers: [{ ability: 'speed_skip', favor: 10, cost: 8 }, { ability: 'haste_self', favor: 40, cost: 20 }, { ability: 'speed_warp', favor: 70, cost: 40 }],
    likes: 'Going deeper. Fast.',
  },
  {
    id: 'rat', name: 'The Rat King', title: 'Rat Friend', altar: 'dngn/altars/beogh',
    desc: 'An altar made of rats, all tangled together by their tails. They are alive. They are looking at you hopefully.',
    pitch: 'Ten thousand tiny voices: "Friend? Friend! Squeak. FRIEND."',
    passive: (f) => ({ summonPct: 20 + Math.floor(f / 5), rPoison: f >= 60 ? 1 : 0 }), passiveText: 'Stronger allies; rats will not attack you.',
    powers: [{ ability: 'rat_swarm', favor: 10, cost: 10 }, { ability: 'rat_plague', favor: 40, cost: 15 }, { ability: 'rat_king', favor: 90, cost: 35 }],
    likes: 'Killing things that are not rats.',
  },
  {
    id: 'thing', name: 'The Thing Beneath', title: 'Beloved of the Deep', altar: 'dngn/altars/lugonu',
    desc: 'It is not an altar. It is a hole in the floor that looks like an altar if you squint. Something below is breathing.',
    pitch: 'You do not hear a voice. You simply know that it has been waiting for you, specifically, for a very long time.',
    passive: (f) => ({ spellPower: 3 + Math.floor(f / 15), maxHpPct: -5, flags: ['see_invis'] }), passiveText: 'Great power. A little less of you. Sees what hides.',
    powers: [{ ability: 'thing_eye', favor: 15, cost: 10 }, { ability: 'thing_maw', favor: 45, cost: 18 }, { ability: 'thing_unmake', favor: 100, cost: 40 }],
    likes: 'Death, any death, but especially Mother\'s.',
  },
] as PatronDef[]).map((p) => [p.id, p]));

export const MAX_FAVOR = 200;
