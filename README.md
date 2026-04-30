# baphomet-utils

Campaign utilities and Gaslamp Gothic theme for **Echoes of Baphomet's Fall** — a PF1.5 homebrew Adventure Path.

**Foundry Version:** V13  
**Current Version:** 2.9.8

---

## Installation

Manifest URL:
```
https://raw.githubusercontent.com/Dade512/baphomet-utils/main/module.json
```

---

## Features

- **Croaker's Ledger Theme** (`noir-theme.css`) — Full Gaslamp Gothic theme for Foundry V13 and PF1e character sheets
- **Condition Overlay** — Visual condition tracking on tokens; panel styled as a brass-and-leather index card
- **Action Tracker** — PF1.5 three-action economy UI with pips calibrated for the parchment aesthetic
- **Roll Card Styler** — Dark leather result bar on all roll cards; nat 20 gold bar and nat 1 blood bar with flavor labels
- **Custom XP Progression** — Campaign-specific modified slow track overriding PF1e's "Fast" track; integrates organically with character sheet level-up, skill points, feats, and class features
- **Weather Engine** — Seeded RNG weather generation with 8 Golarion climate zones, integrated with Simple Calendar Reborn; posts daily weather to chat in Croaker's Ledger style
- **Weather Config UI** — GM-facing weather panel accessible from Scene Controls; change climate zones, toggle auto-posting, reroll weather — no console commands needed

---

## Weather Engine

The weather engine generates deterministic daily weather based on the current date and active climate zone. Same date always produces the same weather unless the climate zone changes.

### Weather Config UI (New in v2.9.0)

Open from **Scene Controls → Token Tools → ☁ Weather Config** (cloud icon, GM only).

The config panel provides:
- **Current weather display** — temperature, precipitation, wind, cloud cover for today's date
- **Climate zone selector** — dropdown with all 8 Golarion zones and descriptions
- **Apply Zone** — changes zone, regenerates weather, and posts to chat
- **Post Today** — sends current weather to GM chat
- **Reroll Today** — regenerates today's weather with a fresh seed
- **Auto-post toggle** — enable/disable automatic chat posting on day advance

### Climate Zones

| Zone | Regions | Character |
|------|---------|-----------|
| `arctic` | Crown of the World, Irrisen | Perpetual cold, long winters, brief cool summers |
| `subarctic` | Northern Brevoy, Mammoth Lords | Harsh winters, cool summers |
| `temperate` | Central Brevoy, Mendev, Ustalav, Druma | Four distinct seasons, moderate rainfall |
| `warm` | Absalom, Taldor, Andoran, Cheliax | Mild winters, warm summers, Mediterranean feel |
| `tropical` | Mwangi Expanse, Sargava | Hot year-round, heavy monsoon rains |
| `arid` | Osirion, Thuvia, Katapesh, Qadira | Scorching days, cold nights, rare rain |
| `mountain` | Mindspin Mountains, Five Kings | Cold, thin air, rapid weather shifts |
| `coastal` | Varisian coast, Hermea, Mediogalti | Moderate temps, frequent fog, steady rain |

### GM API

The console API is still available for macro use:

```js
game.baphometWeather.post()                // Show today's weather in chat
game.baphometWeather.setClimate('arid')    // Party enters Osirion
game.baphometWeather.listClimates()        // Show all available zones
game.baphometWeather.reroll()              // Regenerate today's weather (rare)
game.baphometWeather.toggleChat()          // Toggle auto-posting on day advance
game.baphometWeather.getWeatherFor(4712, 7, 15, 'temperate')  // Query specific date
```

Default zone: **Temperate** (Canorate, Molthune — campaign starting region).

**Note (v2.9.0):** `getWeatherFor()` is now async. If you omit the climate key, it correctly reads the stored zone instead of defaulting to temperate.

---

## Changelog

### v2.9.8 — "The Seams Hold"
Conservative v13 + PF1 compatibility patch. No user-facing behavior changes.

**`scripts/roll-cards.js` — hook rename (v1.2):**
Replaced `Hooks.on('renderChatMessage', ...)` with `Hooks.on('renderChatMessageHTML', ...)`. `renderChatMessage` is the v12 hook name; v13 renamed it to `renderChatMessageHTML` to signal the html argument is always a native `HTMLElement`. The old hook fires for backward compat in some v13 builds but is not guaranteed. Also replaced the inline `HTMLElement/jQuery` normalization with the shared `_baphNormalizeHtml()` helper, consistent with every other hook in the module. All nat 20 / nat 1 detection methods, result bar logic, and label injection are completely unchanged.

**`scripts/xp-progression.js` — lifecycle hook (v1.2):**
Replaced `Hooks.once('init', ...)` with `Hooks.once('pf1PostInit', ...)`. `init` fires during Foundry's own initialization, before PF1e has bootstrapped `CONFIG.PF1` — writing the XP table at that point is a race that PF1e can win by overwriting values immediately after. `pf1PostInit` fires after PF1e has fully populated its config, which is the correct point to override PF1-owned data. Added a guard that checks `CONFIG?.PF1?.CHARACTER_EXP_LEVELS?.fast` exists before writing; logs a clear warning and returns safely if the path is absent rather than throwing. Campaign XP values are byte-for-byte identical.

**`scripts/action-tracker.js` — ownership hardening (v1.7):**
Broadened the `isOwner` computation in `_refreshPipRow()` and the `renderCombatTracker` injection from `game.user.isGM || combatant.isOwner` to additionally include `combatant.actor?.isOwner || combatant.token?.isOwner`. The original check is correct for fully-linked tokens; the fallbacks cover unlinked tokens and edge cases where the actor or token ownership chain resolves before `combatant.isOwner` does (e.g., during combatant setup or when another module manipulates the combatant object). No change to turn reset, pip state management, condition reading, or any other behavior.

**`DEV_NOTES.md` — new file:**
Documents the deferred ESM migration task (`"scripts"` → `"esmodules"`) with rationale, recommended approach (`scripts/main.mjs` entry point), and an explicit "do not do mid-campaign" caution.

### v2.9.7 — "Render Is the Truth"
- **Bug fix (action tracker reset timing):** the combatant whose turn was just ENDED was getting their pips reset, instead of the new active combatant having theirs reset at turn START. This was misleading — reactions and unspent actions appeared to refresh prematurely. Root cause: the three turn-change hook handlers (`pf1PostTurnChange` / `combatTurn` / `combatRound`) were trying to compute "the new active combatant" by reading `combat.current.turn` during the hook fire, but that value's freshness during those hooks is unreliable across versions and across module interactions (notably `monks-combat-details`, which triggers initiative re-rolls on round advance).
- **Architecture:** switched the action tracker from hook-based turn detection to a **render-based self-correcting** approach. Each pipState entry now carries a `_resetForRound` marker. Inside `renderCombatTracker` (which Foundry guarantees fires after combat state is fully updated), we look at which combatant entry has the `.active` CSS class — that's Foundry's own truth. If their `_resetForRound` doesn't match `combat.round`, we reset their state and update the marker. Idempotent across multiple renders, independent of hook firing order, self-correcting on any later render. Removed the three turn-change hook handlers, the dedupe Set, and `_handleTurnChange`.
- **Behavior unchanged in intent:** pips still reset at the START of each combatant's own next turn. Reactions spent during other creatures' turns persist correctly until your turn comes back around — which is what we wanted from the start, but is now actually what happens.
- One log line per actual reset (`Reset pips for {name} (round N)`) so the reset cadence is observable in F12 if anything goes sideways.

### v2.9.6 — "Twin Trackers, Safer Hooks"
- **Bug fix (action tracker popout desync):** when the Encounter Tracker was popped out into its own window, clicking a pip would only update the sidebar tracker or the popout — not both. The click reached the right state (state is keyed on combatantId and shared between the two rendered rows), but `_refreshPipRow` was using `querySelector`, which only returns the first match in document order. Switched to `querySelectorAll` and the function now replaces every matching row. Sidebar and popout stay in sync regardless of where the click happens.
- **Bug fix (turn-hook crashes):** `combatTurn` and `combatRound` handlers in both `action-tracker.js` and `condition-overlay.js` could throw `Cannot read properties of undefined (reading 'length')` / `(reading '0')` during a transient state where `combat.turns` is briefly undefined or empty. Observed specifically when `monks-combat-details` triggers initiative re-rolls on round advance. Added `Array.isArray` + length guards and index clamping in all four hook paths. The hooks now no-op safely when combat data isn't ready, rather than throwing.
- **Cleanup:** removed `[DIAG]` diagnostic console.log calls from the action tracker's manual-click chain. v1.4's button conversion + isOwner re-derivation fixed the click bug; the diagnostics served their purpose and are no longer needed.
- **Documented:** pip reset timing is at the start of the creature's own next turn (correct for PF2-style reaction economy — reactions spent during other creatures' turns should persist until this combatant acts again). This was already the behavior; the behavior docstring just made it explicit.

### v2.9.5 — "Coins, Not Cards"
- **Action tracker pips converted from `<div>` to `<button type="button">`.** Manual pip clicks were reported as unresponsive after a recent update. Native buttons handle clicks more reliably than divs in the combat-tracker sidebar — Foundry's built-in handlers, Token Action HUD, accessibility tooling, and various delegated event paths all expect real button elements. The CSS gets a small `appearance: none; padding: 0; font: inherit;` reset so the coin-on-parchment styling lands identically.
- **Action tracker row event suppression slimmed.** Was blocking five events (mousedown/mouseup/click/pointerdown/pointerup); now blocks just `mousedown` (Foundry's `_onCombatantMouseDown` trigger that opens the actor sheet) and `click` (belt-and-suspenders). The other three were over-broad and could conflict with delegated handlers from other modules.
- **Action tracker `_refreshPipRow` now re-derives `isOwner` from the live combatant** rather than reading from the old DOM's stale dataset. Defends against a subtle perpetuation bug: if any initial render captured `isOwner=false` (game.user not yet resolved, ownership flag not yet propagated, etc.), the old code would carry that broken state forward forever and the pips would never become clickable.
- **Diagnostic logging (action tracker, temporary):** three `console.log` calls trace the manual-pip-click chain (click handler → `_togglePip` state mutation → `_refreshPipRow` DOM update). `[DIAG]` prefix. If the button conversion alone fixes the click issue, the logs come out in v2.9.6.
- **No new hooks added.** The action tracker remains manual-click-to-spend by design (auto-decrement on attack roll was an idea floated and rejected — not a previous feature).

### v2.9.4 — "Hardening Pass"
- **Bug fix (weather):** the SC date-time-change hook's day-marker (`lastPostedDate`) was only updated when chat posting was enabled. With chat off, the marker never advanced — so every subsequent SC time bump (including 6-second combat ticks) re-entered the full handler, re-read settings, and re-called `generateTodayWeather`. Worse, re-enabling chat mid-day could surprise the GM with a back-posted weather card. Renamed to `lastProcessedDate` and updated unconditionally; days are now marked processed regardless of whether they were posted. The v2.9.2 combat-spam guard now actually short-circuits cleanly in both toggle states.
- **Hardening (action tracker):** turn-change handler refactored to match the v2.5 condition-overlay pattern. Previously, the `combatTurn` fallback was gated by `Hooks.events['pf1PostTurnChange']?.length > 1` — a brittle check that counts ANY listeners on the hook, including ones from unrelated modules, and could fail open or fail closed depending on load order. New approach: all three turn-related hooks fire unconditionally; a dedupe Set keyed on `(combatId, round, turn, activeCombatantId)` ensures only the first hook to arrive does the work.
- **Leak fix (condition overlay):** the Token HUD condition panel's `MutationObserver` was a closure-local variable. Manually closing the panel (clicking the button again) removed the panel but left the observer attached until the HUD itself mutated. Hoisted the observer reference to the outer scope and added a shared `_teardown()` so both close paths disconnect cleanly.
- **New file:** `scripts/dom-utils.js` — tiny shared helper `_baphNormalizeHtml(html)` that coerces a hook's html argument to a native `HTMLElement`, with a `globalThis.jQuery`-guarded jQuery unwrap. Replaces inline `instanceof jQuery` checks in action-tracker and condition-overlay. Loaded first in `module.json`'s scripts array so other files can call it at top level.
- No user-facing behavior changes other than the weather state-marker fix. All other changes are internal hardening that should make future Foundry updates and module-interaction edge cases less prone to regression.

### v2.9.3 — "The Reroll Actually Rerolls"
- **Bug fix:** the Reroll button (and `game.baphometWeather.reroll()`) was producing the same weather every time. Added a per-day `rerollSalt` to the weather state, included in the seed string.

### v2.9.2 — "Stop Telling Me About the Weather Every Six Seconds"
- **Bug fix:** Weather card was posting to chat after every combat turn. Hook handler now tracks `lastPostedDate` and only posts when the calendar day actually changes.

### v2.9.1 — "The Reroll Stops Talking to Itself"
- **Cleanup:** `weather-ui.js` `#onRerollToday` redundant `today()` call removed. Unawaited `post()` call fixed.

### v2.9.0 — "The Ledger Opens Its Desk"
- **New:** Weather Config UI (ApplicationV2). Access from Scene Controls → cloud icon.
- **Critical Fix:** `Math.clamp` → `Math.clamped` in condition overlay and weather engine.
- **Critical Fix:** `getWeatherFor` async/await race fixed.
- **Manifest:** Minimum compatibility raised to v13.

### v2.8.0 — "The Ledger Reads the Sky"
- **New:** `data/climate-zones.js` and `scripts/weather-engine.js` — seeded RNG weather with Simple Calendar Reborn integration.

### v2.7.0 — "The Ledger Counts Slower"
- **Updated:** Early-game XP ramp revised. Levels 8–20 unchanged.

### v2.6.0 — "The Ledger Counts the Cost"
- **New:** `scripts/xp-progression.js` — custom XP table overriding PF1e "Fast" track.

### v2.5.1 — "The Ink Holds"
- **Critical Fix:** Roll card result bar no longer wraps `h3.dice-total` in a `<div>`. Zero DOM reparenting.

### v2.5.0 — "The Ledger Notes the Result"
- **New:** `scripts/roll-cards.js` — Roll Card Styler. Dark leather result bar, nat 20 gold bar, nat 1 blood bar.

### v2.4.0 — "Croaker's Ledger"
- Full theme pivot to battered mercenary ledger aesthetic.

---

## Aesthetic Rules — Croaker's Ledger

| Rule | Value |
|------|-------|
| Brightest value | `#e8dfd0` (fresh vellum) — no pure white |
| Background (main) | `#d1c6b4` (field parchment) |
| Background (worn) | `#beb09b` (mud-stained parchment) |
| Sidebar / chrome | `#8a7b66` (scuffed leather) |
| Primary text | `#2a231d` (oxidized iron gall ink) |
| Secondary text | `#5e5246` (watered-down faded ink) |
| Accent (text) | `#846528` (oxidized bronze — readable) |
| Accent (chrome) | `#9e7d43` (tarnished brass — decorative) |
| Accent hover | `#b8943e` (polished brass — active states) |
| Danger / active tab | `#6e2a22` (dried blood) |
| No neon/cyan/digital glow | Everything reads as physical materials |
| Font: Labels/Headings | Courier Prime |
| Font: Body/Descriptions | Alegreya |
| Font: Numbers only | IBM Plex Mono |

---

## Server Deployment

```
/opt/foundrydata/Data/modules/baphomet-utils/
```

---

## Release Workflow

Pushing a version tag automatically builds and publishes a GitHub release:

```bash
git tag v2.9.8
git push origin main --tags
```

The GitHub Actions workflow builds the module zip and attaches both `module.json` and `baphomet-utils.zip` to the release.

---

## Test Checklist (v2.9.8)

1. **Roll cards — hook fires:** Make a d20 roll in chat. Confirm the dark leather result bar appears on the roll card.
2. **Roll cards — nat 20:** Roll a nat 20 (or adjust dice). Confirm gold bar styling and "⚔ Critical Success" label appear.
3. **Roll cards — nat 1:** Roll a nat 1. Confirm blood-red bar styling and "✖ Critical Failure" label appear.
4. **Roll cards — no double-apply:** Scroll up through old roll cards on re-render. Confirm no duplicate styling or labels.
5. **XP progression — applies:** Open any PC's character sheet → Level tab. Confirm XP thresholds match the campaign table (e.g., Level 2 = 2,000 XP). If PF1e system is active and `pf1PostInit` fires correctly, this will match.
6. **XP progression — console check:** Open F12 → Console. After world load, confirm the success log: `Custom XP Progression v1.2: Overwrote "fast" track with campaign table`. If the warning fires instead, `CONFIG.PF1.CHARACTER_EXP_LEVELS` was not found — check PF1e system is active.
7. **Action tracker — pip clicks:** Start combat. Confirm pip rows appear below combatant names. Click an action pip — confirm it toggles spent/available.
8. **Action tracker — player owns token:** Log in as a player who owns a combatant. Confirm their pips are clickable. Confirm another player's pips are disabled (grayed out / not clickable).
9. **Action tracker — unlinked token ownership:** If applicable, test with an unlinked token the player owns via actor permission. Pips should be clickable (v1.7 fallback).
10. **Action tracker — turn reset:** Advance turns in combat. Confirm the previously active combatant's pips do NOT reset. Confirm the newly active combatant's pips DO reset at turn start. Check F12 for `Reset pips for {name} (round N)` log line.
11. **Scene Controls button:** Log in as GM → Token Controls toolbar shows ☁ cloud icon → click opens Weather Config panel.
12. **No Math.clamp errors:** Apply a condition → confirm no console error. (Regression check from v2.9.0.)
