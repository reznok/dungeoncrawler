export interface StatusDef { name: string; good: boolean; desc: string; color: string }

export const STATUSES: Record<string, StatusDef> = {
  poison: { name: 'Poisoned', good: false, desc: 'Loses health every turn.', color: '#7c4' },
  burning: { name: 'Burning', good: false, desc: 'On fire. Takes fire damage every turn.', color: '#f73' },
  slow: { name: 'Slowed', good: false, desc: 'Acts at half speed.', color: '#88f' },
  haste: { name: 'Hasted', good: true, desc: 'Acts at double speed.', color: '#4ef' },
  confused: { name: 'Confused', good: false, desc: 'Stumbles in random directions.', color: '#e7e' },
  paralysed: { name: 'Paralysed', good: false, desc: 'Cannot act.', color: '#f44' },
  afraid: { name: 'Afraid', good: false, desc: 'Will not approach; flees.', color: '#cc4' },
  blind: { name: 'Blinded', good: false, desc: 'Can barely see. There is cream everywhere.', color: '#aaa' },
  berserk: { name: 'Berserk', good: true, desc: '+50% damage, faster, -10 EV. Fatigue follows.', color: '#f55' },
  fatigue: { name: 'Fatigued', good: false, desc: 'Too tired to go berserk, and a bit slower.', color: '#996' },
  weak: { name: 'Weakened', good: false, desc: 'Deals 30% less damage.', color: '#a86' },
  risen: { name: 'Risen', good: true, desc: 'Bigger, stronger, fluffier.', color: '#fd8' },
  regen: { name: 'Regenerating', good: true, desc: 'Heals quickly.', color: '#6f6' },
  stoneskin: { name: 'Stoneskin', good: true, desc: 'Extra armour.', color: '#bbb' },
  invisible: { name: 'Invisible', good: true, desc: 'Hard to see and hard to hit.', color: '#9cf' },
  entangled: { name: 'Stuck', good: false, desc: 'Cannot move (can still attack).', color: '#ca6' },
  shielded: { name: 'Warded', good: true, desc: 'A ward absorbs incoming damage.', color: '#8cf' },
  corroded: { name: 'Corroded', good: false, desc: '-4 AC.', color: '#9a3' },
  marked: { name: 'Marked', good: false, desc: 'Takes 50% more damage.', color: '#f0a' },
  doughy: { name: 'Doughy', good: false, desc: 'Partly dough. Slower, softer (-3 AC), smells delicious.', color: '#edb' },
  asleep: { name: 'Asleep', good: false, desc: 'Sleeping.', color: '#66a' },
  might: { name: 'Mighty', good: true, desc: '+damage.', color: '#f93' },
  agile: { name: 'Nimble', good: true, desc: '+evasion and accuracy.', color: '#9f9' },
  brilliant: { name: 'Brilliant', good: true, desc: '+spell power.', color: '#c9f' },
  resist: { name: 'Resistant', good: true, desc: 'Resists fire, cold, poison and shock.', color: '#fc6' },
  flying: { name: 'Flying', good: true, desc: 'Floating over water, lava and chasms.', color: '#cff' },
  silenced: { name: 'Silenced', good: false, desc: 'Cannot cast spells.', color: '#777' },
  inspired: { name: 'Inspired', good: true, desc: 'Every hit lands.', color: '#ff6' },
};

export const CLEANSABLE = ['poison', 'burning', 'slow', 'confused', 'blind', 'weak', 'corroded', 'marked', 'doughy', 'entangled', 'silenced', 'afraid'];
