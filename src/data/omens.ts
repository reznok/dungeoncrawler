// One omen per run (sometimes none): a twist that colours the whole descent.
export interface OmenDef { id: string; name: string; text: string }

export const OMENS: OmenDef[] = [
  { id: 'blood_moon', name: 'Blood Moon', text: 'The moon was red the night you went down. Everything below is tougher, and worth more for it.' },
  { id: 'harvest', name: 'Bountiful Harvest', text: 'The dungeon is generous this season. There is more loot lying around than usual.' },
  { id: 'rat_year', name: 'Year of the Rat', text: 'It is the Year of the Rat. You can hear them in the walls. So many of them.' },
  { id: 'fog', name: 'The Long Fog', text: 'A thick fog has rolled into the deep. You see less, but you are harder to see.' },
  { id: 'gold_rush', name: 'Gold Rush', text: 'Word got out that there is gold down there. There is. Prices are up too.' },
  { id: 'haunted', name: "All Souls' Night", text: "It is All Souls' Night. The dead are restless, and the line between them and you is thin." },
  { id: 'lucky', name: 'Four-Leaf Clover', text: 'You found a four-leaf clover on the way in. Things just seem to go your way. Mostly.' },
];
