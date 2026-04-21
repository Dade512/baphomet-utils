# baphomet-utils

Campaign utilities and Gaslamp Gothic theme for **Echoes of Baphomet's Fall** — a PF1.5 homebrew Adventure Path.

**Foundry Version:** V13  
**Current Version:** 2.9.7

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
- **Bug fix:** the Reroll button (and `game.baphometWeather.reroll()`) was producing the same weather every time. The weather seed was deterministic on `(year, dayOfYear, climateName)` — calling `generateTodayWeather(true)` correctly skipped the cache, but then re-derived the same seed and ran the same RNG stream, so output was identical. Added a per-day `rerollSalt` to the weather state, included in the seed string. Salt increments on each forced reroll within a day, resets to 0 when the calendar day changes.
- Same-day cache reads after a reroll still return the rerolled weather — closing and reopening the Weather Config UI no longer drifts back to the canonical (salt 0) variant.
- `setClimate` intentionally does NOT bump the salt. Switching climate should land on that climate's canonical weather for today, not on "reroll #N of the previous climate's history."
- Console log now appends `[reroll #N]` to the daily weather line when salt > 0, for debugging.

### v2.9.2 — "Stop Telling Me About the Weather Every Six Seconds"
- **Bug fix:** Weather card was posting to chat after every combat turn. PF1e's combat tracker advances the in-game clock by ~6 seconds per turn, and SCR fires `simple-calendar-date-time-change` on ANY time change — not just date changes. The hook handler now tracks `lastPostedDate` in module state and only posts when the calendar day actually changes. Removed the `force=true` from the hook's regenerate call so the engine's own date cache also short-circuits intra-day re-runs. Belt and suspenders.
- No user-visible change to normal day-advance behavior. Just no more chat spam during combat.

### v2.9.1 — "The Reroll Stops Talking to Itself"
- **Cleanup:** `weather-ui.js` `#onRerollToday` had a redundant `today()` call sandwiched between `reroll()` and `post()`. Since `post()` internally reads the same cache `reroll()` populates, the middle call was wasted work. Cleaner flow now: `reroll()` → `post()` → re-render.
- **Fix:** The `post()` call in `#onRerollToday` was unawaited, which could let the panel re-render before the chat write completed. Now properly `await`-ed.
- No user-visible behavior change — reroll still posts exactly one chat message. Internal only.

### v2.9.0 — "The Ledger Opens Its Desk"
- **New:** `scripts/weather-ui.js` + `styles/weather-ui.css` — GM-facing weather configuration panel built on ApplicationV2. Access from Scene Controls → Token Tools → cloud icon. Change climate zones, toggle auto-post, reroll weather, post to chat — all without touching the console.
- **Critical Fix:** `Math.clamp` → `Math.clamped` in condition tier clamping (`condition-overlay.js`) and cloud cover calculation (`weather-engine.js`). `Math.clamp` is not standard JS; Foundry provides `Math.clamped`. Could hard-fail condition application and weather generation.
- **Critical Fix:** `getWeatherFor` API was mixing sync + async — `_getWeatherState().then(...)` without `await` made the climate key a Promise object, silently defaulting to `'temperate'` regardless of active zone. Now properly `async`/`await`.
- **Cleanup:** Trimmed verbose debug logging in weather-engine.js for production use.
- **Manifest:** Minimum compatibility raised from v12 to v13. Code depends on v13 hooks, CSS structure, and ApplicationV2.

### v2.8.0 — "The Ledger Reads the Sky"
- **New:** `data/climate-zones.js` — 8 Golarion climate zones with per-season temperature, precipitation, and wind parameters. Each zone includes descriptive text generators for immersive chat output.
- **New:** `scripts/weather-engine.js` — Seeded RNG weather generation integrated with Simple Calendar Reborn. Deterministic daily weather (temperature high/low, precipitation type and intensity, wind speed and gusts, cloud cover). GM climate zone switching via `game.baphometWeather` API. Auto-posts to chat on day advance as a GM whisper in Croaker's Ledger style.

### v2.7.0 — "The Ledger Counts Slower"
- **Updated:** `scripts/xp-progression.js` — Revised early-game XP ramp for smoother acceleration into mid-levels. New values: 2k/5k/10k/18k/28k/42k (was 1k/3k/6k/10k/15k/21k). Session pacing updated for ~120 session campaign. Levels 8–20 unchanged.
- **New:** GitHub Actions release workflow — automatic zip build and release asset attachment on tag push.

### v2.6.0 — "The Ledger Counts the Cost"
- **New:** `scripts/xp-progression.js` — Custom XP progression system. Overwrites PF1e's "Fast" XP track with the campaign's modified slow track table.

### v2.5.1 — "The Ink Holds"
- **Critical Fix:** Roll card result bar no longer wraps `h3.dice-total` in a `<div>`. Zero DOM reparenting.
- **Fix:** Brass accent color deepened to `#846528` for text-on-parchment links. WCAG AA compliant.

### v2.5.0 — "The Ledger Notes the Result"
- **New:** `scripts/roll-cards.js` — Roll Card Styler. Dark leather result bar, nat 20 gold bar, nat 1 blood bar.
- **Fix:** Auto-decrement for Frightened/Stunned conditions rewritten with debounced multi-hook system.

### v2.4.0 — "Croaker's Ledger"
- Full theme pivot to battered mercenary ledger aesthetic

### v2.3.0–v2.3.2 — Accessibility and contrast fixes

### v2.2.0 — "The Ledger Rebound"
- Gaslamp Gothic palette overhaul, layout/logic bug fixes

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
git tag v2.9.2
git push origin main --tags
```

The GitHub Actions workflow builds the module zip and attaches both `module.json` and `baphomet-utils.zip` to the release.

---

## Test Checklist (v2.9.2)

1. **Scene Controls button:** Log in as GM → Token Controls toolbar shows ☁ cloud icon → click opens Weather Config panel
2. **Current weather display:** Panel shows today's temp/precip/wind/clouds (requires Simple Calendar active)
3. **Zone switch:** Select a different climate zone → click Apply Zone → weather regenerates → chat message posts
4. **Auto-post toggle:** Toggle OFF → advance day in Simple Calendar → no chat post. Toggle ON → advance → chat posts.
5. **Post Today:** Click → current weather posted to GM chat
6. **Reroll:** Click → weather regenerates with new values → panel updates
7. **getWeatherFor without key:** In console, `await game.baphometWeather.getWeatherFor(4712, 7, 15)` → uses stored zone, NOT hardcoded temperate
8. **No Math.clamp errors:** Apply a condition (e.g., `game.baphometConditions.apply(actor, 'frightened', 3)`) → no console error
9. **Non-GM guard:** Log in as player → no cloud icon in scene controls → `game.baphometWeather` API returns null for generation calls
10. **No Simple Calendar:** Disable SCR → open weather panel → shows graceful "Simple Calendar not detected" message
