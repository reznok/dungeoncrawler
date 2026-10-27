# SPOILERS: design review, 2026-10-27

> Spoilers for the player. Do not read if you want to be surprised.

Reviewer stance: a serious roguelike player (DCSS, ToME, Qud) on a phone. The question is not "does it run" but "would I keep
playing, and would I trust a death?" Findings are ordered by impact. Each has an owner (A = game logic, B = mobile UX).

## Verdict before fixes

Playable, with a real build system and lots of content, but the first three floors kill through things the player cannot
read or react to, and the phone UI hides information a serious player needs. The middle game is untested by humans.

## A. Game logic and balance

**A1. Threat labels lie.** `threat()` in `src/game/combat.ts` marks a level-1 rat "dangerous" for a level-1 character
(`diff = level*1.6 - playerLevel` is 0.6, which lands in "tough"). Players stop trusting labels immediately.
Spec: rate threat from numbers, not levels. Compare the monster's expected damage per player turn (accounting for speed
and pack size is not needed) and HP against the player's current HP and expected damage. Suggested: trivial if it dies
in ≤2 of your hits and cannot take more than 10% of your HP per turn; easy if it dies in ≤5 hits and takes <25%/turn;
nasty if it can take ≥50% of your HP per turn or needs >12 hits; tough otherwise. Uniques bump one step.

**A2. Out-of-depth spawns start too early and swing too hard.** `pickMonster` allows OOD from depth 3 with +2/+3
levels. The sim shows deaths on D3 to wolf spiders and killer bees. Spec: no OOD before depth 5; +2 levels on 5-8,
+3 on 9-12, +4 after. OOD monsters never spawn as packs (pack size 1) and always get the "danger" level feeling.

**A3. Killer bees are a run-ender.** Speed 20, pack 2-4, poison, at depth 4-5 vs ~35 HP. Spec: dmg 1-3, speed 15, pack
2-3, poison power 1.

**A4. Jackal packs at depth 2.** Pack 3-5, speed 12, at a point where the player has ~20 HP. Spec: pack 2-3.

**A5. Mimic is too tanky early.** `openChest` gives `15 + depth*8` HP; at D3 that is 39 HP against a character dealing
~4 per hit. Spec: `8 + depth*5` HP, dmg scales `[1+floor(d/4), 4+floor(d/3)]`, no mimics before depth 4.

**A6. Uniques on D1-2.** Natasha (minDepth 2, placed at D1 in an earlier plan), Yiuf at D2 kill level-1 characters. Spec:
every unique `minDepth >= 3`. Hunting uniques (awake, tracking from the stairs) only from depth 5.

**A7. No active ability for several callings at start.** Sellsword (blade_mastery only), Duelist (riposte, footwork),
Brawler (iron_fist, toughness), Hunter (marksman, volley: ok), Alchemist (bomb: ok). Early floors become tap-Fight-
repeat. Spec: every calling starts with at least one active talent. Sellsword gets `lunge`; Duelist gets `lunge` instead
of footwork; Brawler gets `headbutt` instead of toughness. Keep their passives too (3 starting talents is fine).

**A8. No panic button.** Permadeath on a phone with no escape item in any kit. Spec: every kit includes one scroll of
blinking, pre-identified. Alchemist and Hexer keep what they have.

**A9. First talent arrives too late.** XP to level 2 is 25; D1 gives ~15-20. Spec: `xpForLevel(2) = 12` by changing
the curve to `Math.round(12 * Math.pow(level - 1, 2.3))`, which keeps the late curve similar (L10 ≈ 1900, L20 ≈ 10500).

**A10. Sleep is a death sentence.** Potion of naptime: 6 turns asleep; player damage does not wake the player. Spec:
damage to the player removes `asleep`; naptime is 4 turns; the weight of naptime drops to 3.

**A11. Level-up never prompts.** `pendingTalents` just lights a HUD button. Spec: when a level-up happens and no hostile
is in view at the end of the action, push a `levelup` popup (once per level). The HUD button stays for later.

**A12. Rest is free and infinite.** Acceptable for a resumable long game, but auto-rest should stop when a monster
*wakes* nearby, not only when it comes into view; `noticeChecks` already sets `view.interrupt`. Verify, no change expected.

**A13. Monsters regenerate 1 HP every 8 turns while the player kites.** Fine. No change.

## B. Mobile UX

**B1. The message log eats map taps.** `#log` has `pointer-events: auto` and covers the bottom ~15% of the map; tapping
a tile below the player sometimes opens the history. Spec: the log is `pointer-events: none`; add a small "history" button
(bottom-left, 36px) that opens it. Reduce the log to 4 lines, 13px, so more of the map shows.

**B2. Sight radius 8 but only 5 tiles visible either side.** Enemies "in view" are off-screen. Spec: default zoom shows
13 cells across ("Normal" = 13, "Far" = 16, "Close" = 10). Keep pinch zoom.

**B3. Tapping a distant monster takes one step then stops.** `autoStep` cancels travel when enemies are in view. Spec:
when the travel destination holds a hostile, keep travelling (the destination is a fight), stopping only if a *different*
new enemy appears or HP drops.

**B4. Examine panel has no numbers.** Serious players want to know. Spec: in `P.examine`, for a hostile show: "You hit it
about N% of the time; it hits you about M%", "It hits for about X" (average of its damage dice plus bonus, minus half your
AC, min 1), its speed (fast/slow/normal), and the names of its special attacks/abilities (from `def.abilities`, the
ability names, and `def.hit.status`). Put the math in a new `src/game/preview.ts` so the UI does not import combat
internals; `chanceToHit` is exported from `combat.ts` already, monster accuracy is `def.acc ?? 7 + level*1.3`.

**B5. Item detail has no comparison.** Spec: for armour/weapons/jewellery, show a line "Currently: <equipped item>" and for
armour the AC/EV delta ("AC +2, EV -1"); for weapons the average damage per 100 energy for both.

**B6. Level-up panel: no way to see what a talent's ability costs before taking it.** Already shown ("2 MP, 6-turn
cooldown"). No change.

**B7. HUD lacks numbers for XP.** Minor. Show "XP 12/25" in the hud-meta when there is room (`D1 · L1 · 12/25`).

**B8. Quick bar: tapping an empty slot opens assignment, fine; but the bar shows "+" with no hint.** Minor. No change.

**B9. The minimap is only reachable through Menu → Map or the `m` key.** Spec: a small map button at the top-right of
the map (36px) toggles it.

## Not changed on purpose

- Permadeath, unidentified consumables, resting without a clock: part of the genre and the brief.
- The Fight button attacks the nearest enemy only: tapping a monster targets it.

## Process

- A and B are implemented by separate agents on disjoint files. A: `src/data/monsters.ts`, `src/data/characters.ts`,
  `src/data/items.ts`, `src/game/levels.ts`, `src/game/combat.ts`, `src/game/stats.ts`, `src/game/turn.ts`,
  `src/game/run.ts`, `tests/`. B: `src/ui/*`, `src/style.css`, `src/game/explore.ts`, `src/game/preview.ts` (new).
- Both run `npx tsc --noEmit -p .` and `npx vitest run bot world`. Neither commits.
- Afterwards: rerun `SIM=1 npx vitest run sim` and compare with the baseline (36 bots: deaths D1-D9, median D4).
