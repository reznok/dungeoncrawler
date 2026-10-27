# SPOILERS: design document

> The player asked to know nothing about the game. Do not read this if you want to be surprised.

## Premise

**THE RISING.** For three hundred years the village of Crumbsworth has been fed by one bakery and one
sourdough starter, which the bakers call *Mother*. Last week the bakery fell into a sinkhole. The baker
went down after Mother and did not come back. The bread the survivors salvaged has begun to whisper.

You go down. Fifteen depths. At the bottom, Mother has been feeding on something much older than flour.

Tone: whiplash. A crypt of drowned choirboys, then a goblin who wants you to fill in form 27-B before
you may kill him. Grim lore notes next to recipes for cursed scones. Nothing announces which one is
coming next.

## Pillars

1. **Unique character every run.** Random offers at creation (3 of 12 ancestries, 3 of 12 callings), talent
   offers on every level-up (pick 1 of 3), mutations from absorbed essences, randomly generated artifacts,
   unidentified consumables with per-run appearances.
2. **Twists.** Floor events (special floors), uniques with personalities, shrines with bargains, traps,
   level feelings, lore notes, a mid-game betrayal (the Baker), cursed and two-edged rewards.
3. **Challenge.** Permadeath, tough but fair: deaths should feel earned. Threat scales with depth, out-of-depth
   monsters are rare but possible and telegraphed by level feelings.
4. **Phone first.** Portrait, one thumb for moves (tap to travel or attack, swipe to step), auto-explore,
   auto-fight, rest, quick slots. Saves after every action; resume any time.

## Run shape (2-3 hours)

| Depths | Band | Feel |
|---|---|---|
| 1-3 | The Cellar | rats, roaches, kobolds, jackals, goblins; sacks of flour; the bakery's own cellar at D1 |
| 4-6 | The Mouldering | fungi, spiders, gnolls, oozes; spore clouds |
| 7-9 | The Drowned Choir | water, drowned souls, eels, frogs, ghosts; grim |
| 10-12 | The Ovens | fire, salamanders, imps, hounds, ogres; the Baker waits on D12 |
| 13-14 | The Unbaked | flesh, dough and eldritch things |
| 15 | The Proving Chamber | Mother |

Persistent levels (stairs up and down). Each depth has 1-3 down stairs.

## Character

- **Attributes:** Might (melee damage, HP), Agility (accuracy, evasion, stealth), Wits (spell power, MP, ability
  cooldowns). +1 attribute point at every 3rd level.
- **Derived:** HP, MP, AC (damage soak), EV (dodge), accuracy, speed (energy per turn, 10 = normal), stealth,
  sight radius, resistances (fire, cold, poison, shock, necrotic).
- **Leveling:** XP from kills (and some events). Max level 27. A level-up restores a little HP and MP and offers
  3 talents.
- **Talents:** 14 disciplines of 6 talents each. Talents have 1-3 ranks. Offers are weighted to the calling's
  disciplines and to disciplines unlocked by tomes; one offer is always a "wildcard" from anywhere.
  Higher-tier talents need points in their discipline.
- **Mutations:** monsters of some families drop *essences*. Absorbing one grants a random mutation of that family
  (5 slots; a 6th replaces one). Some are two-edged.
- **Ancestries (12):** Human, Dwarf, Elf, Gnoll, Kobold, Frogfolk, Troll, Spriggan, Ghoul, Mummy, Octopode,
  Gargoyle. Each has stat bases, growth, and one or two quirks (mummies cannot drink potions; octopodes wear 4
  rings and no body armour; ghouls heal by devouring corpses; frogfolk swim and leap).
- **Callings (12):** Sellsword, Hedge Wizard, Grave Robber, Disgraced Baker, Exorcist, Beastcaller, Duelist,
  Brawler, Hunter, Alchemist, Hexer, Court Jester. Each gives a kit, a starting talent and discipline affinities.

## Items

Weapons (blades, axes, maces, polearms with reach, daggers, staves, launchers with unlimited shots), armour
(body, shield, helm, boots, cloak, gloves), 2 rings, amulet. Enchantment +N, egos (flaming, freezing, venom,
draining, vampiric, speed, protection...), random artifacts with generated names and 2-4 properties
(some negative). Potions, scrolls and wands start unidentified with random appearances per run. No hunger.
Gold buys from shops. Essences. Tomes unlock disciplines. Lore notes.

## Twists

- **Level feelings** on arrival (hint at out-of-depth threats, treasure, events).
- **Floor events** (one per 2-3 floors, random): the Goblin Permit Office, a Wedding of Ghouls, the Flooded
  Nursery, a Pie Contest, a Bazaar of Bad Ideas, a Mirror Room (your shadow), a Collapsing Floor, a Hunting
  Party (a unique is tracking you).
- **Shrines** of odd powers offering bargains (gain X, lose Y).
- **Uniques** (random selection per run) with their own lines.
- **The Baker** is met at D6 (friendly, gives a gift) and at D12 (has been eaten by Mother's will: boss fight).
- **Mother** (D15): multi-phase. Splits dough spawn, rises (grows) over time; must be fought quickly.

## Tech

TypeScript + Vite, no framework. Canvas 2D for the map, DOM for HUD and menus. All game logic is pure
and serialisable (seeded RNG, state in plain objects) so saving is `JSON.stringify` of the run. Vitest for logic
tests, including a headless bot that plays random actions to catch crashes. GitHub Actions builds and deploys to
Pages. Tiles: Dungeon Crawl Stone Soup tiles (CC0), packed into one atlas by `tools/build-atlas.mjs`.
