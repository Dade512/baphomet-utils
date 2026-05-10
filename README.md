# baphomet-utils

Campaign utilities and Gaslamp Gothic theme for **Echoes of Baphomet's Fall** — a PF1.5 homebrew Adventure Path.

**Foundry Version:** V13  
**Current Version:** 2.16.0

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
- **Task Tracker** — API-only multi-round task scaffold for skills like Disable Device; no UI yet
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

## Task Tracker (new in v2.16.0)

API-only scaffold for multi-round task tracking. No UI in this release.

```js
// Create a task (GM only)
const taskId = await game.baphometTasks.createTask(combatant, {
  skillKey: 'dvs',
  taskType: 'disable-device',
  taskName: 'Disable Poison Dart Trap',
  roundsRequired: 3,           // hidden from players
  metadataPublic: {},
  metadataHidden: { dc: 22, trapName: 'Vipertongue Repeater' }
});

// Commit an action on the active combatant's turn
await game.baphometTasks.commitAction(combatant, taskId);

// Pause / resume / abandon
await game.baphometTasks.pauseTask(combatant, taskId, 'player-choice');
await game.baphometTasks.resumeTask(combatant, taskId);
await game.baphometTasks.abandonTask(combatant, taskId);

// Read task state
const task = game.baphometTasks.getTask(combatant, taskId);
const all  = game.baphometTasks.getTasks(combatant);
```

Player-visible task state is stored on actor flags. Hidden duration (`roundsRequired`) and GM notes are stored on the GM user's flags and never exposed to players. See DEV_NOTES.md for the full storage model.

---

## Changelog

### v2.16.0 — "The Ledger Opens a Long Account"
API-only multi-round task scaffold. No UI, no Disable Device integration, no automatic resolution.

- Added `scripts/task-tracker.js` — new file, loads after `action-tracker.js`.
- Added `game.baphometTasks` — public API for creating and managing multi-round tasks in combat.
- Public task state stored on actor flags (player-visible). Hidden task duration stored on GM user flags (never exposed to players).
- All 8 API methods implemented: `createTask`, `getTask`, `getTasks`, `commitAction`, `pauseTask`, `resumeTask`, `abandonTask`, `resolveTask` (stub).
- `commitAction` enforces 9 sequential gates including same-round double-spend protection.
- Combat end (`deleteCombat`) pauses all active tasks with reason `combat-ended` instead of silently abandoning them.
- In-memory task cache built on `pf1PostReady`; updated on every own API write. No `updateActor` listener yet.
- `resolveTask` is stubbed — logs only, returns false. Full resolution in v2.19.0.
- Disable Device warning in `action-tracker.js` is unchanged.
- No UI, no Continue Task button, no task progress widget.

### v2.15.1 — "The Ledger Relabels"
Cosmetic label change only. No mechanics changed.

- Updated the 3-action panel example label from `D.DEV / F. CAST` to `F.CAST / RUN`.
- The old label referenced Disable Device, which no longer costs 3 immediate actions as of v2.15.0.
- The button still spends exactly 3 action pips (`manual-3`). No spend behavior changed.

### v2.15.0 — "The Ledger Waits Its Turn"
Disable Device safety patch and task system prep. No new automation features.

- Removed Disable Device (`dev`) from automatic skill action spending.
- Disable Device now warns in combat instead of spending 3 actions: a notification appears and 0 pips are spent, while the PF1 roll continues normally.
- Added one-time migration (`skillAllowlistMigrated215`) to remove `dev` from the default skill auto-spend allowlist on first GM load; customized allowlists are never overwritten.
- Prepared for the future PF1.5 Multi-Round Task subsystem (Disable Device, Survival tracking, extended Heal, jury-rigging, ritual interruption, and custom GM tasks).

### v2.14.0 — "The Ledger Closes the Wrong Door"
First live PF1.5 action economy enforcement. There is no Full Attack in PF1.5.

Adds a **PF1.5 Mode** world setting (default ON). When enabled, the PF1 Full Attack button (`button[name="attack_full"]`) is removed from AttackDialog on render. The Single Attack button is untouched and rolls normally. Selector confirmed via v2.13.5 live diagnostics. No attack auto-spend, no swing tracking, no MAP injection, no pf1PreActionUse cancellation — those come later.

### v2.13.5 — "The Ledger Reads More Carefully"
Fixes two broken diagnostic surfaces from v2.13.4 and adds copy-friendly JSON output. Diagnostic-only; no gameplay changes.

`_diagNormalizeRoot` replaces bare `instanceof HTMLElement` checks — live testing showed PF1 passing a non-HTMLElement wrapper to `renderActorSheetPFCharacter`, causing the scan to bail silently. New helper accepts HTMLElement, DocumentFragment, jQuery wrapper, and generic array-like wrappers. Added targeted `renderAttackDialog` hook alongside the existing generic render hooks. All diagnostic log points now emit both the object (for DevTools inspection) and a JSON string (for copy/paste).

### v2.13.4 — "The Ledger Looks Before It Cuts"
Observer-only diagnostic pass. No gameplay behavior changes.

Adds four debug-gated diagnostic hooks to identify PF1 full-attack UI controls and `ActionUse` payload shape before implementing full-attack suppression in v2.14.0: `renderActorSheetPFCharacter` (scans actor sheet interactive elements for attack-related controls), `pf1RenderQuickActions` (scans token HUD quick actions), `renderApplication`/`renderApplicationV2` (logs AttackDialog contents when visible), and `pf1PreActionUse` (logs structured ActionUse payload — never cancels). All output gated behind Action Tracker Debug Logging. No pips spent, no controls hidden, no actions cancelled.

### v2.13.2 — "The Ledger Aligns"
CSS-only layout polish. No spend logic changes.

Action panel rows switched from flex to CSS grid (`grid-template-columns: 2.3rem 1fr`). Cost badge column is now a fixed width; label column fills the remainder with centred text. All three labels align at the same horizontal midpoint. Panel width unchanged.

### v2.13.1 — "The Ledger Abbreviates"
Label polish and behavioral documentation only. No spend logic changes.

Spend 3 row label changed from `DISABLE / FULL` to `D.DEV / F. CAST` for better visual alignment with the other rows. Cost remains 3 actions; spend behavior, reason key, and all-or-nothing enforcement are unchanged. Off-turn skill auto-spend block confirmed working and documented in DEV_NOTES.

### v2.13.0 — "The Ledger Decides"
Replaces the single Stride button with a compact floating Action Spend Panel.

Three generic manual spend buttons appear in a small parchment panel during active combat: **Swing / Move** (1 action), **Cast / Ready** (2 actions), **Disable / Full** (3 actions). Labels are illustrative only — they do not enforce action-type rules. Any spend is a plain pip deduction. The panel header shows the active combatant name. All spends are all-or-nothing: spending 2 with only 1 pip available spends 0 and warns. Condition-locked pips are never consumed. Ownership is re-validated at click time. Position still controlled by the per-client **Action Spend Panel Position** setting (setting key `moveButtonPosition` unchanged). Old `baph-stride-*` CSS classes removed; new `baph-action-panel*` classes replace them with the same position offsets. No attack automation, no token drag, no MAP/Strike counter, no ESM migration.

### v2.12.0 — "The Ledger Moves"
Adds a floating Stride button for one-click action spending during combat.

A fixed-position **Stride** button appears on screen during active combat. Clicking it spends 1 action from the current active combatant (`game.combat.combatant`) — not from any selected token. The button is visible only to users who can control the active combatant (or the GM). It disappears when combat ends and refreshes automatically on turn advance. Position is controlled by the per-client **Stride Button Position** setting (bottom-right by default, with three other corners available). The `bottom-right` variant sits to the left of the Foundry sidebar. On failure (no pips remaining, wrong user, combat ended mid-click), the button shows a notification and refreshes the pip row without spending anything. No token drag automation, no attack auto-spend, no MAP/Strike counter, no ESM migration.

### v2.11.2 — "The Ledger Knows More"
Expands Knowledge skill auto-spend to the full standard PF1 set. No other behavior changes.

Added six Knowledge sub-skills to `SKILL_ACTION_COSTS` (all cost 1 action): Knowledge Dungeoneering (`kdu`), Engineering (`ken`), Geography (`kge`), History (`khi`), Nobility (`kno`), and Planes (`kpl`). Combined with kar, kre, kna, klo from prior releases, all ten standard PF1 Knowledge sub-skills are now covered. Allowlist default updated accordingly. One-time migration upgrades existing confirmed v2.11.1 allowlists on first GM load; customized allowlists are never overwritten. Explicit failure log added to the skill handler when a spend attempt is blocked (e.g. insufficient pips for Disable Device). `per` (Perception) remains excluded.

### v2.11.1 — "The Ledger Remembers"
Migration fix. No new automation features.

**Root cause of v2.11.0 skill-spend failure:** Foundry world settings persist stored values across module updates — updating the `default` field in `game.settings.register` does not overwrite what's already saved in the world database. The world still held the old provisional allowlist from v2.9.9 (`acrobatics,bluff,...`), so every confirmed key was rejected as "not in allowlist."

**Fix:** One-time migration in `scripts/settings.js` detects the exact old provisional string on first GM load and replaces it with confirmed PF1 keys. Custom allowlists are untouched. Migration flag `skillAllowlistMigrated211` ensures it runs exactly once. `klo` (Knowledge Local, confirmed from live v2.11.0 debug output) added to `SKILL_ACTION_COSTS` and the default allowlist.

**On first load after update:** Check F12 for the migration log line (styled in Croaker red if a replacement ran, plain text if the setting was already up-to-date or customized).

### v2.11.0 — "The Ledger Spends"
Skill auto-spend is now live. Attack auto-spend and Move/Stride remain deferred.

**`scripts/action-tracker.js` — live skill auto-spend (v1.11):**
Adds a live `pf1ActorRollSkill` handler that automatically spends action pips when an active combatant makes a skill check. Gated behind `Auto-Spend on Skill Roll` in Module Settings (default OFF — you must enable it deliberately). Eleven skills supported with confirmed PF1 key strings from v2.10.x diagnostic testing: Acrobatics, Bluff, Intimidate, Stealth, Heal, Use Magic Device, Disable Device (3 pips, all-or-nothing), Sleight of Hand, Knowledge Arcana, Knowledge Religion, Knowledge Nature. Perception excluded intentionally. A 500ms dedupe guard prevents double-spending if the hook fires multiple times for the same roll. Nine decision gates with debug logging at each — enable `Action Tracker Debug Logging` to trace every spend decision in F12.

`pf1AttackRoll` remains diagnostic-only. Attack auto-spend deferred pending dedupe design.

**`scripts/settings.js` v1.1:**
`autoSkillSpend` and `skillAutoAllowlist` updated to reflect live status and confirmed PF1 key strings. `autoAttackSpend` and `moveButtonPosition` remain FUTURE.

### v2.10.1 — "The Ledger Stops Shouting"
Diagnostic cleanup only. No auto-spending active.

**`scripts/action-tracker.js` — diagnostic summarizer cleanup (v1.10):**
Removed all `arg?.data` probing from `_summarizeHookArg`. PF1 emits `ItemAction.data has been deprecated` compatibility warnings on every access to `.data` on an ItemAction object, and the v2.10.0 summarizer was triggering those on every `pf1AttackRoll` fire. All four `.data` paths (`arg?.data?.actor`, `arg?.data?.skill`, `arg?.data?.skillId`, `arg?.data?.skillKey`) are gone. Replaced with equivalent-or-broader non-deprecated paths via `arg?.action.*`, `arg?.subject.*`, `arg?.parent.*`. No `.data` access anywhere in the diagnostics block. Hooks remain observer-only; no pips are spent.

### v2.10.0 — "The Ledger Listens"
Diagnostic-only pass. No action auto-spending is active in this version.

**`scripts/action-tracker.js` — diagnostic hooks (v1.9):**
Added debug-gated `Hooks.on` listeners for `pf1AttackRoll` and `pf1ActorRollSkill`. When **Action Tracker Debug Logging** is enabled in Module Settings, every firing of these hooks logs the full raw argument list plus a shallow structured summary to the browser console (F12). The summary checks common actor paths, constructor names, top-level keys, and possible skill key fields without deep-traversing any Foundry document. No pips are spent. No state is mutated. Three new helpers support the summarizer: `_summarizePossibleActor`, `_summarizeHookArg`, `_summarizeHookArgs`. A duplicate-registration guard (`_baphActionDiagnosticsRegistered`) prevents double-registration if the ready hook fires unexpectedly more than once. A second `Hooks.once('ready')` block registers the diagnostics, kept separate from the macro API block for clarity.

All other module behavior is unchanged from v2.9.9. Manual pip clicking, turn reset, condition locking, weather, XP progression, and roll cards are untouched.

### v2.9.9 — "Automation Prep"
Scaffold-only patch. No user-facing behavior changes with default settings.

**`module.json`:**
Compatibility `minimum` tightened to `13.350` (matching `verified`). Added `relationships.requires` declaring the PF1e system dependency formally. No manifest or download changes.

**`scripts/settings.js` — new file:**
Centralised settings registration. Five new automation settings added, all inert and defaulting OFF: `autoAttackSpend`, `autoSkillSpend`, `skillAutoAllowlist`, `moveButtonPosition`, `debugLogging`. These register the Module Settings UI entries for future v2.10.0 automation but wire no behavior. Enabling them has no effect in this version.

**`scripts/action-tracker.js` — automation scaffold (v1.8):**
Added `_debugLog()` helper (gated on `debugLogging` setting), five inert automation helpers (`_getActiveCombatant`, `_getActiveCombatantForActor`, `_canUserControlCombatant`, `_spendActionForCombatant`, `_spendActionForActor`), and the `SKILL_ACTION_COSTS` scaffold constant (provisional key names, unverified). No hooks call any of these yet. `spendAction` and `spendReaction` on the macro API now return booleans (`true` if a pip was actually spent, `false` otherwise) — callers that ignored the return value are unaffected. `_spendActionForCombatant` enforces all-or-nothing spending: a 3-action cost requires 3 available pips or nothing is spent. Routine `console.log` calls gated behind `_debugLog` so they only appear in F12 when debug logging is enabled.

**`DEV_NOTES.md`:**
v2.10.0 automation plan updated: removed unverified pseudocode claiming specific hook argument signatures. Replaced with a diagnostic-first plan — v2.10.0's first step is to log raw `pf1AttackRoll` and `pf1ActorRollSkill` payloads with `debugLogging` enabled to confirm argument positions and skill key format before any spend wiring is added.

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

### v2.9.4 — "Hardening Pass"
- **Bug fix (weather):** the SC date-time-change hook's day-marker (`lastPostedDate`) was only updated when chat posting was enabled. With chat off, the marker never advanced — so every subsequent SC time bump (including 6-second combat ticks) re-entered the full handler, re-read settings, and re-called `generateTodayWeather`. Worse, re-enabling chat mid-day could surprise the GM with a back-posted weather card. Renamed to `lastProcessedDate` and updated unconditionally; days are now marked processed regardless of whether they were posted. The v2.9.2 combat-spam guard now actually short-circuits cleanly in both toggle states.
- **Hardening (action tracker):** turn-change handler refactored to match the v2.5 condition-overlay pattern.
- **Leak fix (condition overlay):** the Token HUD condition panel's `MutationObserver` hoisted to outer scope; `_teardown()` shared so both close paths disconnect cleanly.
- **New file:** `scripts/dom-utils.js` — tiny shared helper `_baphNormalizeHtml(html)`.

### v2.9.3 — "The Reroll Actually Rerolls"
- **Bug fix:** the Reroll button was producing the same weather every time. Added a per-day `rerollSalt` to the weather state.

### v2.9.2 — "Stop Telling Me About the Weather Every Six Seconds"
- **Bug fix:** Weather card was posting to chat after every combat turn.

### v2.9.1 — "The Reroll Stops Talking to Itself"
- **Cleanup:** `weather-ui.js` redundant `today()` call removed.

### v2.9.0 — "The Ledger Opens Its Desk"
- **New:** Weather Config UI (ApplicationV2).
- **Critical Fix:** `Math.clamp` → `Math.clamped`.
- **Critical Fix:** `getWeatherFor` async/await race fixed.
- **Manifest:** Minimum compatibility raised to v13.

### v2.8.0 — "The Ledger Reads the Sky"
- **New:** Weather engine with climate zones and Simple Calendar Reborn integration.

### v2.7.0 — "The Ledger Counts Slower"
- **Updated:** Early-game XP ramp revised.

### v2.6.0 — "The Ledger Counts the Cost"
- **New:** Custom XP progression table.

### v2.5.1 — "The Ink Holds"
- **Critical Fix:** Roll card result bar no longer wraps `h3.dice-total`.

### v2.5.0 — "The Ledger Notes the Result"
- **New:** Roll Card Styler.

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
git tag v2.16.0
git push origin main --tags
```

The GitHub Actions workflow builds the module zip and attaches both `module.json` and `baphomet-utils.zip` to the release.

---

## Test Checklist (v2.16.0)

1. **Task creation (GM console):** Start combat. Run `await game.baphometTasks.createTask(game.combat.combatant, { skillKey: 'dvs', taskType: 'disable-device', taskName: 'Test Task', roundsRequired: 2, metadataHidden: { dc: 15 } })`. Confirm taskId is returned.
2. **Actor flags written:** After createTask, open F12 → run `game.combat.combatant.actor.getFlag('baphomet-utils', 'tasks')`. Confirm the task appears with correct public fields. Confirm `roundsRequired` is absent.
3. **GM user flags written:** Run `game.user.getFlag('baphomet-utils', 'hiddenTaskData')`. Confirm the hidden entry exists with `roundsRequired: 2` and `metadataHidden`.
4. **commitAction advances progress:** Run `await game.baphometTasks.commitAction(game.combat.combatant, taskId)`. Confirm returns `true`. Re-read actor flags — `roundsCommitted` should be 1, `lastCommittedRound` should equal `game.combat.round`. Confirm 1 action pip is spent in the tracker.
5. **readyToResolve set on threshold:** After 2 commits (advance a round between them), confirm `readyToResolve: true` on the actor flag.
6. **Same-round guard:** Run `commitAction` twice in the same round. Second call should return `false` and log a warning.
7. **Non-active combatant guard:** Try commitAction on a combatant that is NOT the current active. Should return `false`.
8. **Pause / resume cycle:** `pauseTask` → confirm status `paused`. `commitAction` on paused task → returns `false`. `resumeTask` → confirm status `active`. `commitAction` → succeeds.
9. **Abandon preserves data:** `abandonTask` → status `abandoned`. Actor flags still have the task entry. Hidden GM user flags unchanged.
10. **deleteCombat pause:** Start combat, create a task, end combat. Re-read actor flags — task should be `status: 'paused'`, `pausedReason: 'combat-ended'`. GM notification should appear.
11. **Non-GM sanitization:** Log in as a player who owns a combatant. Run `game.baphometTasks.getTask(...)`. Confirm returned object has no `roundsRequired` or `metadataHidden`.
12. **resolveTask stub:** Run `game.baphometTasks.resolveTask(...)`. Should return `false` and log a stub message. No rolls fired.
13. **Disable Device warning unchanged:** Roll Disable Device in combat (action-tracker.js behavior). Confirm the existing warning notification still fires. Confirm task-tracker does NOT create any task automatically.
14. **Action tracker pip behavior unchanged:** Manual pip clicks, turn reset, condition locks, skill auto-spend, action panel — all should behave identically to v2.15.1.
15. **debug logging:** Enable `debugLogging` in Module Settings. Run createTask and commitAction. Confirm `[task]`-prefixed log lines appear in F12 for each gate and write.
