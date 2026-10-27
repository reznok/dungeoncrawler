# SPOILERS: design review, round 3 (2026-10-27)

> Spoilers for the player. Do not read if you want to be surprised.

Reviewer stance: a critical game designer who plays DCSS/ToME/Qud, reading the whole rule set after two review passes. Rounds 1
and 2 fixed early-game fairness and the phone UX. This round is about whether the *rules* hold up for a serious player over a
full run: exploits, tactical texture, the two bosses nobody has reached, and what a death teaches.

## Verdict

The systems are rich and the numbers are mostly sane through D12. Three things a serious player will find within an hour:

1. **Stairs are a free escape.** Nothing follows you. Any fight can be reset by standing on stairs. That removes the single
   biggest tactical question of the genre ("do I take the stairs with that thing next to me?").
2. **Every monster behaves the same**: it walks at you. Goblins with slings and salamander mystics with firebolts walk into melee
   like rats. Fights are "tap Fight until it dies" with no positioning problem to solve.
3. **The bosses are untested and, on paper, unwinnable in melee.** Mother: 420 HP, 6d12 (avg 39) per hit, speed 9. A level-19
   character with ~120 HP and AC 15 needs ~20 hits and dies in 4. The Baker (160 HP, 5d10 at D12) is a wall for a level-14
   character for the same reason. These fights have never been simulated by a non-god bot.

Plus: a death screen that does not tell you what you had left, resting that stops every turn while poisoned, paralysis for 3
turns at depth, and gold that often has nothing to buy.

## A. Rules and content (agent A)

Files: `src/game/turn.ts`, `src/game/monsters.ts`, `src/game/combat.ts`, `src/game/levels.ts`, `src/game/abilities.ts`,
`src/game/preview.ts`, `src/data/monsters.ts`, `src/data/flavor.ts`, `src/data/abilities.ts`, `src/core/types.ts`, `tests/*`.

**A1. Monsters follow you on stairs.** In `changeLevel` (not when `fell`): every monster on the old level that is awake, hostile
(not `ally`, not `friendly`), not `afraid`, not `stationary`/`aquatic`, not asleep/paralysed, and within Chebyshev distance 1 of
the player follows. Cap 4 (nearest first). Remove them from the old level, place each on the new level with `nearestFree`
within 3 of the arrival spot, `awake = true`, `lastSeen = player`, energy 0 (the player gets the first move). Message per
follower, visible: `"${Name} follows you down the stairs!"` / `up`. Summoned monsters (with `summoned`) follow too. Add a
test in `tests/world.test.ts`: spawn an awake jackal next to the player standing on `l.down[0]`, `act({t:'stairs'})`, expect it
on the new level and gone from the old.

**A2. Skirmishers keep their distance.** Export `isSkirmisher(def: MonsterDef): boolean` from `src/game/monsters.ts`: true when
the def is not `mindless`, not `boss`, and has an ability whose `ABILITIES[id].kind` is `bolt | smite | beam | ball`, with
`range >= 4` and `chance >= 0.2`. In `monsterAct`, after the ability loop and before `if (adjacentFoe)`: if `isSkirmisher(def)`
and `sees` and `dist(m, p) <= 2` and `m.hp > m.maxHp * 0.3` and that ranged ability is off cooldown and `r.chance(0.5)`, then
`stepAway(run, m, p)`; if it moved, return (its turn is spent). If it cannot step away, fall through to melee. Give the Baker
the `boss` flag (also makes him immune to paralyse/sleep/confuse/fear in `applyHex`, which is right for a boss). Remove the
unused `stationary_ish` flag from Mother. In `src/game/preview.ts`, add `'keeps its distance'` to `specials` for skirmishers.

**A3. Shallow water is hard to dodge in for monsters too.** `monsterEv` in `combat.ts`: -4 when the monster stands on
`T.SHALLOW` and is not `swim`/`aquatic`/`flying` (min 0). Symmetric with the player's -4.

**A4. Packs wake together.** In `noticeChecks`, when a monster with `def.pack` notices the player, each other monster with the
same `def` within distance 4 that is asleep/unaware wakes with 70% chance (`awake = true`, `lastSeen = player`), no extra
message beyond the first.

**A5. Poison does not interrupt resting until it matters.** In `damage()`, when `opts.cause === 'poison'` and the player stays
at or above 30% max HP, do not set `view.interrupt` (burning still interrupts). The UI half (B2) lets auto-rest continue
through the HP drop.

**A6. Paralysis is capped for the player.** In `applyHex`, when the target is the player and the status is `paralysed`, turns
= min(turns, 2). Ogre mage `paralyse` chance 0.12 → 0.08.

**A7. Boss fights get a simulation and a tuning pass.** Add `tests/boss.test.ts`, skipped unless `SIM=1` like `sim.test.ts`
(copy its `smartTurn`; it is fine to duplicate). Build a character with a helper `geared(level, kit)`: `newRun`, then set
`player.level`, `xp = xpForLevel(level)`, take `level - 1` talents by calling `talentOffers`/`takeTalent` with a seeded pick,
spend attr points on might, equip the kit (make items with `makeItem` and `known: true`), give 3 `p_heal` + 2 `p_curing` + 1
`s_blink` (all learned), full HP/MP. Then `run.levels[depth] = createLevel(run, depth)`, `changeLevel`-style placement at the
stairs (set `run.depth`, `visited`, player at `l.up[0]`, `updateFov`), and run `smartTurn` until `run.over` or 6000 steps.
Cases, 12 seeds each, troll sellsword and elf hedge wizard:
  - Mother, D15: level 19, demon blade +3 / plate +2 / kite shield / helmet (wizard: quarterstaff +2, robe +3, wizard hat,
    ring of wizardry). Target: the naive bot wins 25-50% of fights. Also level 15 with the same kit: target ≤ 10%.
  - Baker, D12 (set `run.flags.bakerMet = true` so he spawns hostile): level 14, long sword +2 / chain mail +1 / kite shield.
    Target: 40-60%.
  Tune to hit the targets: start from Mother `hp 360, dmg [5,10], speed 8`, starter spawn `hp 24`, Baker `hp 130, dmg [4,9]`,
  and exempt `boss`/`unique` monsters from the depth HP/damage scaling in `spawnMonster` (they are tuned by hand). Adjust
  further as the numbers say; keep Mother's phases (spawns at 66%, rises + haste at 33%). Record the final win rates in a
  comment at the top of the test. The god run in `sim.test.ts` must still win.

**A8. The Bazaar.** New floor event in `createLevel`/`populate`: depths 5-11, once per run (`run.flags.bazaar`), 20% chance,
when no other event claims the floor. Three shops of different kinds via `placeShop` (shop kinds are picked randomly; ensure
the three differ), one extra gold pile of `r.int(30, 60)`, and `l.feeling = 'You hear haggling. Several voices, all of them
lying.'`. Add 2 bazaar-only shop names to `SHOP_NAMES` or inline: "The Bazaar of Bad Ideas", "Honest Ibn's".

**A9. Boris polish.** `monsterDies`: the `|| true` becomes two messages: visible → `"I'll be back," says Boris, crumbling... and
reforming somewhere else.`; not visible → `Somewhere on this floor, a voice: "I'll be back."`.

**A10. Depth scaling exemptions.** As in A7: `spawnMonster` applies the `l.depth > 6` HP/damage scaling only to monsters that
are neither `unique` nor `boss`. (Uniques already have hand-tuned numbers and their own depth bands.)

After the changes: `npx tsc --noEmit -p .`, `npx vitest run bot world threat`, then `SIM=1 npx vitest run boss` (and tune),
then `SIM=1 npx vitest run sim` once at the end and report the death depth distribution and the god run result. Do not commit.

## B. Phone UI (agent B)

Files: `src/ui/*`, `src/style.css`, `src/game/save.ts` (settings fields only). Read-only: everything under `src/game`.

**B1. Fight on low HP needs a second tap.** In `onButton('fight')`: if `run.player.hp < maxHp * 0.3` and the last Fight tap
was more than 1500 ms ago (or none), do not act; `buzz(30)`, toast `"Badly hurt. Tap Fight again to attack anyway."`,
remember the time; a second tap within 1500 ms attacks. The `Tab` key goes through the same gate. The threshold uses
`playerStats(run).maxHp`.

**B2. Rest continues through poison.** In `autoStep`, for `a.kind === 'rest'`: an HP drop does not stop the run when
`run.player.statuses.poison` is set, no hostile is in view (`enemiesInView(run, true).length === 0`), `!view.interrupt`, and
HP stays ≥ 30% of max. (Agent A stops poison ticks from raising `view.interrupt` above 30%.) Below 30%, or when anything else
happens, stop as today.

**B3. Stairs with company.** In `onButton('stairs')` when the player is on stairs: if any monster that would follow is
adjacent (awake, hostile, not `afraid`, not `stationary`/`aquatic`, not `asleep`/`paralysed`; same rule as A1), open a centre
dialog: `"<names> will follow you. Take the stairs anyway?"` with `Go` (primary) and `Stay`. Otherwise take the stairs at once.
Keyboard `>`/`<` goes through the same check.

**B4. The death screen teaches.** In `App.end()`:
  - Under the cause line, a line `Unused: 2 potions of heal wounds, a scroll of blinking` listing the *identified*
    consumables (potions, scrolls, wands with charges) still in the inventory at death, by `itemName`; omit the line when
    there are none. Won runs skip it.
  - Show the last 12 messages instead of 6, in a scrollable box (max-height ~40vh).
  - Add `HP ${hpBefore}/${maxHp} before the killing blow` where `hpBefore` is the player's HP before the final damage: record it
    in `GameUI` (`this.lastHp` is already tracked per action; pass `lastHp` through `onEnd` or stash it on `run.stats` is not
    allowed since `src/game` is read-only for B; keep it in the `GameUI` instance and pass it to `onEnd(run, lastHp)`).
  - The quip stays.

**B5. Help text.** Add to the How-to-play panel: "Monsters standing next to you follow you on the stairs." and "Some monsters
keep their distance and shoot. Corner them or close in with a dash."

After the changes: `npx tsc --noEmit -p .`, `npx vitest run bot world`. Do not commit.

## Not changed on purpose

- Resting stays free (the brief wants a resumable, unhurried run); wandering spawns are the only clock.
- Monsters still do not flee at low HP: fleeing monsters are misery on a phone.
- Mimics stay unannounced: the lore notes warn, and the chest is a choice.
- Alarm traps still wake the floor.
