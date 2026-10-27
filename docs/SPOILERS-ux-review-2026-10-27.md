# UX review, 2026-10-27 (round 2)

Trigger: the player reported that confirming a spell needs a button far from the quick bar. Reviewed the whole phone UX
as a serious roguelike player holding the phone in one hand, thumb at the bottom.

## Verdict

The information fixes from round 1 hold up. The weak spot is everything that needs a *second* decision after a tap:
targeting, confirming, closing. Those put the next tap at the top of the screen or on the map, away from the thumb,
and give no feedback about what is being targeted or why nothing happens.

## T. Targeting (highest priority)

**T1. Confirm from the quick bar.** Tapping an ability/wand slot arms it: the slot gets an "armed" style (gold border,
glow). Tapping the *same slot again* fires at the current target. Tapping a different slot switches the armed ability
(or, for an item without a target, uses it and cancels targeting). Tapping the player's own tile cancels. Escape and the
✕ still cancel.

**T2. Cancel near the thumb.** The targeting banner moves from the top of the map to a strip directly above the quick
bar (inside `#mapwrap`, bottom-anchored, above the log): `[Magic Dart] → cellar rat · 3 tiles · 1 MP   [Fire] [✕]`.
The Fire and ✕ buttons are 44px tall and sit at the right end, above the quick bar. Nothing targeting-related stays at
the top.

**T3. Show the range on the map.** While targeting: tiles outside range (Chebyshev distance > range from the player) are
dimmed with a dark overlay; hostile monsters inside range and in line of sight get a thin gold outline; the chosen
target keeps the pink cursor. For `tile` abilities (blink, fireball) the dimming is the same and any in-range visible
tile is valid. Line of sight uses `los(run, a, b)` from `src/game/abilities.ts`.

**T4. Pick targets from the foe strip.** In targeting mode, tapping a chip in `#foes` selects that monster as the target
(if in range and in sight) instead of opening the look panel. Chips that are out of range are drawn at 40% opacity.
Swiping left or right on the map while targeting cycles the target among valid hostiles (sorted by distance) instead
of moving.

**T5. Default and remembered target.** The default target is the last monster targeted if it is still valid, else the
nearest valid hostile. Store `lastTargetId` on the `GameUI` instance (not in the save). If no target is valid, the
strip says "No target in range" and Fire is disabled; the player can still tap a tile for tile abilities.

**T6. Camera.** The player is always centred, so a target at range 7-8 can be off-screen at 13 cells. While targeting,
if the target would be off-screen, shift the camera so both the player and the target are visible (centre on the
midpoint, clamped so the player stays on screen). Restore when targeting ends. Implement as a `renderer.focus: Pos |
null` the renderer blends toward (no need for animation; a straight jump is fine).

**T7. One-tap option.** Add a setting `quickCast` (default off) in Settings/Menu: when on, tapping an ability with a
valid default target fires immediately without arming. Wire it through `loadSettings/saveSettings` in `src/game/save.ts`
(add the field with a default; keep old saved settings valid).

**T8. Wands and scrolls** that target go through the same flow (they already call `startTarget`); the armed slot is
the item's quick slot when it has one.

## U. Everything else

**U1. Level-up needs a confirm.** Tapping a talent card currently learns it instantly; a mis-tap is permanent. Spec:
tapping a card selects it (`.sel` style, already defined), a sticky "Learn <name>" primary button at the bottom of the
sheet confirms; attribute +1 buttons can stay instant (they are small and reversible in spirit). Same pattern for the
shrine and patron choices is not needed (they already have explicit buttons).

**U2. Close buttons at the bottom.** Bottom sheets (`openPanel` without `center`) get a sticky bottom bar with a 44px
"Close" button in addition to the ✕ at the top; tapping the dim overlay still closes. Centre dialogs keep their buttons.

**U3. Quick bar discoverability.** The first time the quick bar is shown in a run, toast "Hold a slot to change it"
(persist a `seenQuickHint` flag in settings). Empty slots show a faint "+".

**U4. Haptics.** `navigator.vibrate` where available: 12 ms when the player takes damage, 30 ms on level-up, 80 ms on
death. A `haptics` setting (default on) in the menu.

**U5. Armed/disabled feedback.** Tapping a slot that cannot be used (cooldown, no MP) already toasts the reason; keep.
Add the reason as a tooltip-like line in the targeting strip if the player arms something and then runs out of MP
(edge case; a toast is enough).

**U6. Menu.** Add the two new settings (Quick cast, Haptics) to the Menu panel as toggles, next to Zoom.

**U7. Help text.** Update the How-to-play panel: "Tap an ability to arm it, tap it again to fire at the marked enemy,
or tap any enemy on the map. Swipe left/right to change target."

**U8. Explore leaves gear behind (player report).** Auto-explore walks to items but only consumables are picked up
automatically (`arrive` in `turn.ts`); weapons, armour and jewellery need a tap on "Pick up", and explore has moved on
by then. Spec, UI-side only: in `autoStep`, after an explore step lands on a tile with items and the pack has room,
issue `{ t: 'pickup' }` as part of the same auto run (setting `autoPickupGear`, default on, in the menu). When the pack
is full, explore stops on that tile with the message already shown by `pickup`.

**U9. Finding what was left behind.** Add an "Items here" section at the top of the Bag panel: every item on this floor
the player has seen but not picked up (`cur(run).items` with `seen`), with its icon, name and distance, and a "Go"
button that closes the panel and starts travel to it (`startAuto('travel', pos)`). Also, when explore finishes, the
message should count them: "Done exploring. 3 items left on this floor (see Bag)."

## Non-goals this round

Game balance, content, the renderer's drawing of monsters, auto-explore rules.

## Files

`src/ui/game.ts`, `src/ui/renderer.ts`, `src/ui/panels.ts`, `src/ui/dom.ts`, `src/style.css`, `src/game/save.ts`
(settings fields only), `src/game/explore.ts` (the "done exploring" message only). Read-only: `src/game/abilities.ts` (`los`, `defaultTarget`, `ABILITIES`), `src/game/preview.ts`.
