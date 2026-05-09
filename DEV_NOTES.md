# DEV_NOTES — baphomet-utils

Internal development notes. Not user-facing.

---

## v2.13.5 — Fix Strike Guard Diagnostics

Fixes two broken diagnostic surfaces from v2.13.4 and adds copy-friendly JSON output to all diagnostic log lines.

**Root normalization fix (`_diagNormalizeRoot`):**
Live testing showed `renderActorSheetPFCharacter` passing a non-HTMLElement argument despite V2 documentation, causing the scan to bail with "element is not HTMLElement". Added `_diagNormalizeRoot(input)` which accepts HTMLElement, DocumentFragment, jQuery wrapper, and generic array-like wrappers (guarding `globalThis.jQuery` before instanceof). All three DOM-scanning diagnostics now use this helper instead of bare `instanceof HTMLElement` checks. On normalization failure, the constructor name of the raw argument is logged so we can identify the actual type.

**AttackDialog hook added (`renderAttackDialog`):**
Generic `renderApplicationV1`/`renderApplicationV2` hooks were not capturing the AttackDialog. Added a targeted `renderAttackDialog` hook as a third capture attempt. If PF1 uses this exact class name, the hook fires directly. The constructor-name filter in `_diagHandleAttackDialogRender` still applies as a guard. All three hooks call the same handler.

**Safe stringify helper (`_diagStringify`):**
Added `_diagStringify(value)` — a try/catch wrapper around `JSON.stringify(value, null, 2)`. All diagnostic log points now emit both an object (for DevTools expand/inspect) and a JSON string (for copy/paste). Affected prefixes: `renderActorSheetPFCharacter controls`, `pf1RenderQuickActions controls`, `AttackDialog controls`, `pf1PreActionUse summary`, `pf1AttackRoll attack summary`.

No gameplay behavior changes. No suppression. No cancellation.

---

## v2.13.4 — PF1.5 Strike Guard Diagnostics

Observer-only diagnostic pass. No gameplay behavior changes.

**Purpose:** Identify PF1 full-attack UI controls and ActionUse payload shape before implementing full-attack suppression in v2.14.0. We do not guess selectors like `.full-attack` or `[data-action="fullAttack"]` in production code; this patch tells us what PF1 actually renders and passes.

**Four diagnostic surfaces added (all debug-gated):**

1. `renderActorSheetPFCharacter` — scans all interactive elements in the rendered actor sheet; highlights anything with "attack", "full", "fullAttack", "iterative", "multiple", or "swing" in any text/class/dataset/title field. PF1 sheets are V2; `element` is HTMLElement.

2. `pf1RenderQuickActions` — scans all interactive elements in the token HUD quick-actions DocumentFragment. DocumentFragment supports `querySelectorAll` directly. Confirms whether a distinct full-attack quick action exists.

3. `renderApplicationV1` + `renderApplicationV2` — both confirmed Foundry v13 hook names, filtered to apps whose constructor name contains "attack". AttackDialog's V1/V2 status is unconfirmed; both hooks are registered so whichever fires will appear in F12. Uses `_baphNormalizeHtml` to handle jQuery or HTMLElement coercion.

4. `pf1PreActionUse` — logs a structured payload summary (constructor, own keys, actor, item, action keys, possible full-attack flags, activation data, rollMode data). **Never returns false.** This hook is confirmed cancellable; the return-false gate is explicitly not triggered in this diagnostic pass.

**What to look for in the output:**
- Which button/element in the actor sheet is the full-attack control (class, data-action, name, text)
- Whether `pf1RenderQuickActions` exposes a distinct full-attack button
- Which hook fires for AttackDialog (V1 or V2) and what controls it contains
- Whether `actionUse.isFullAttack`, `actionUse.fullAttack`, or `actionUse.action.type` distinguishes a full attack from a single Strike
- Which keys on ActionUse are safe to inspect for v2.14.0 suppression logic

**Setting reserved for v2.14.0:** `pf15ModeEnabled` / "PF1.5 Mode" — documented here, not yet registered.

---

## v2.13.2 — Action Panel Alignment Polish

CSS-only layout change. No JS or spend logic changes.

Switched `.baph-action-spend-btn` from `display: flex` to `display: grid; grid-template-columns: 2.3rem 1fr`. The fixed `2.3rem` cost column ensures all three pip badges occupy identical width. The `1fr` label column fills the remainder and centres its text via `justify-content: center; text-align: center` on `.baph-action-spend-label`. Result:

```
[ 1 ]  SWING / MOVE
[ 2 ]  CAST / READY
[ 3 ]  D.DEV / F. CAST
```

All labels are now horizontally centred in the same column. `min-width` and `flex-shrink` removed from `.baph-action-spend-cost` (grid controls width directly). Panel outer width unchanged.

---

## v2.13.1 — Action Panel Label Polish

One label change and one behavioral note. No spend logic changes.

**Spend 3 label:** `Disable / Full` → `D.Dev / F. Cast`. Rendered as `D.DEV / F. CAST` by CSS `text-transform: uppercase`. Aligns better visually with `SWING / MOVE` and `CAST / READY`. Cost, reason key, and spend behavior are unchanged.

**Off-turn skill behavior (documented, not changed):**

Skill auto-spend correctly blocks off-turn spending. Console confirms:
```
"Goblin - Echoes Fodder" is not the active combatant — no spend
```
However, PF1 skill rolls still appear in the chat log because `pf1ActorRollSkill(actor, chatMessage, skillKey)` fires *after* the roll and chat message already exist. This is by design in PF1e — the hook is a post-roll notification, not a pre-roll gate.

Preventing off-turn skill chat cards entirely would require a pre-skill-roll hook that can cancel the roll. No such hook has been identified in the current PF1e v13 API. Do not implement pre-roll blocking without a confirmed cancellable hook. The current behavior (block pip spend, allow chat card) is correct and expected.

---

## v2.13.0 — Floating Action Spend Panel

Replaces the single Stride button (v2.12.0) with a compact three-button Action Spend Panel.

**Buttons:**

| Cost | Label | Reason key |
|---|---|---|
| 1 pip | Swing / Move | `manual-1` |
| 2 pips | Cast / Ready | `manual-2` |
| 3 pips | Disable / Full | `manual-3` |

Labels are descriptive hints only. They do not enforce action-type rules. Any spend is a generic pip deduction.

**Panel header:** Shows the active combatant name. Truncates with ellipsis if too long.

**Visibility:** Active combat only. Current user must be GM or able to control the active combatant.

**Spend behavior:** All-or-nothing via existing `_spendActionForCombatant`. Spending 2 with only 1 pip available spends 0 and warns. Condition-locked pips are never consumed.

**Position:** Still controlled by the existing `moveButtonPosition` setting (key unchanged). Label updated to "Action Spend Panel Position".

**Old Stride helpers removed:** `_getStrideButtonId`, `_removeStrideButton`, `_shouldShowStrideButton`, `_renderStrideButton` and `.baph-stride-*` CSS classes are all gone. Replaced by `_getActionPanelId`, `_removeActionPanel`, `_shouldShowActionPanel`, `_buildActionSpendButton`, `_renderActionPanel` and `.baph-action-panel*` CSS classes.

**Hook registrations unchanged:** `renderCombatTracker`, `updateCombat`, `combatStart`, `deleteCombat`, `ready`.

**Not added:** Attack automation, token drag, MAP/Strike counter, ESM migration.

---

## Rules Clarifications (confirmed, not yet requiring code changes)

### Dazzled

Dazzled is not yet implemented. When added, it will be a **minor penalty condition only** (toggle, no tier). It does not block reactions or attacks of opportunity. If fiction requires "you were not ready," use **Off-Guard** (the existing `offGuard` toggle) as the mechanical wrapper instead. A Dazzled condition in PF1.5 would apply a –1 penalty to attack rolls and sight-based Perception, consistent with standard PF1 behavior.

Implementation path when ready: add a `dazzled` toggle entry to `CONDITIONS` in `condition-overlay.js` with a `buildChanges` targeting `attack` (–1 penalty). No changes to `_readConditionActionLoss` or `_applyConditionLocks` needed.

### Action-Loss Stacking Rule (Staggered / Nauseated / Stunned / Slowed)

The confirmed PF1.5 rule:

> Compute actions lost from each applicable action-loss source, take the maximum actions lost, cap at 3, then subtract from the 3-action pool (floor 0).

| Source | Type | Effect |
|---|---|---|
| Staggered | Floor (baseBlock) | 2 actions lost |
| Nauseated | Floor (baseBlock) | 2 actions lost |
| Stunned X | Additive | +X actions lost |
| Slowed X | Additive | +X actions lost |
| Paralyzed | Full incapacitation | All 3 actions + reaction locked (bypasses math) |

Formula: `actionsLost = min(max(baseBlock, additive), 3)`

Worked examples:
- Staggered alone → max(2, 0) = **2 lost** → 1 action remains
- Slowed 1 alone → max(0, 1) = **1 lost** → 2 actions remain
- Staggered + Slowed 1 → max(2, 1) = **2 lost** → 1 action remains
- Staggered + Slowed 2 → max(2, 2) = **2 lost** → 1 action remains
- Staggered + Slowed 3 → max(2, 3) = **3 lost** → 0 actions remain
- Stunned 2 + Slowed 1 → max(0, 3) = **3 lost** → 0 actions remain

The current `_readConditionActionLoss` implementation matches this rule exactly. No code change required. These examples are now also documented in the function's comment block in `action-tracker.js`.

---

## v2.12.0 — Add Floating Stride Button

Adds a fixed-position Stride button visible during active combat. Clicking it spends 1 action from the current active combatant.

**Source of truth:** `game.combat.combatant`. Never reads from selected tokens.

**Visibility rules:**
- Only shown during active combat (`game.combat.active` and `game.combat.combatant` both truthy)
- Only shown to the current user if they are GM or can control the active combatant (`_canUserControlCombatant`)
- Hidden automatically when combat ends

**Click behavior:**
- Re-validates combatant and user permissions at click time
- Calls `_spendActionForCombatant(combatant.id, 1, 'stride')` (synchronous, all-or-nothing)
- On success: refreshes pip row, re-renders button
- On failure (no pips, no permissions, combat ended): shows `ui.notifications.warn`, refreshes pip row, re-renders button. No partial spending.

**Position:** Controlled by the existing `moveButtonPosition` client setting (now live). Values: `bottom-right` (default), `bottom-left`, `top-right`, `top-left`. The `bottom-right` variant uses `right: 330px` to avoid overlapping Foundry's sidebar.

**Hooks registered:**
- `renderCombatTracker` → `_renderStrideButton()` (re-renders on any tracker refresh)
- `updateCombat` → `_renderStrideButton()` (belt-and-suspenders for turn advances)
- `combatStart` → `_renderStrideButton()` (shows button when combat begins)
- `deleteCombat` → `_removeStrideButton()` (removes button when combat ends)
- `ready` once → `_renderStrideButton()` (handles reload into an active combat)

**CSS:** Added to `styles/action-tracker.css` (v1.5). Parchment background, brass border, iron-gall text. No glow, no neon.

**Deferred:** Attack auto-spend, MAP/Strike counter, token drag automation, ESM migration.

---

## v2.11.2 — Expand Knowledge Skill Auto-Spend

Expands Knowledge skill auto-spend to cover all standard PF1 Knowledge sub-skills.

**New Knowledge keys added (all cost 1 action):**

| Key | Skill |
|-----|-------|
| kdu | Knowledge Dungeoneering |
| ken | Knowledge Engineering |
| kge | Knowledge Geography |
| khi | Knowledge History |
| kno | Knowledge Nobility |
| kpl | Knowledge Planes |

(kar, kre, kna, klo were already present from v2.11.0–2.11.1.)

**Allowlist migration:** One-time migration on first GM `ready` after this update. Detects the exact v2.11.1 string (`acr,blf,int,ste,hea,umd,dev,slt,kar,kre,kna,klo`) and replaces it with the v2.11.2 string (`acr,blf,int,ste,hea,umd,dev,slt,kar,kdu,ken,kge,khi,klo,kna,kno,kpl,kre`). Customized allowlists are not overwritten. `skillAllowlistMigrated212` flag written regardless.

**Failed spend logging:** Added explicit `_debugLog` at the call site when `_spendActionForCombatant` returns `false`. Previously the failure path was silent at the handler level (the reason was logged inside the helper but not surfaced at the spend attempt line). Now logs: `skill auto-spend: failed — spend blocked or insufficient actions for {name} [{key}], needed {cost}`.

**Perception (`per`) remains excluded.** Attack auto-spend deferred. No Move/Stride button. No ESM migration.

---

## v2.11.1 — Migrate Confirmed Skill Allowlist

Fixed the root cause of all skills being rejected in v2.11.0: Foundry preserves existing world setting values, so updating the `default` in `game.settings.register` does not overwrite a value already stored in the world database. The world still held the old provisional v2.9.9 string (`acrobatics,bluff,...`).

**Changes:**

- `klo` (Knowledge Local) added to `SKILL_ACTION_COSTS` (cost 1) and the default allowlist. Confirmed from v2.11.0 live debug output.
- `skillAutoAllowlist` default updated to `acr,blf,int,ste,hea,umd,dev,slt,kar,kre,kna,klo`.
- One-time migration registered in `scripts/settings.js`. On the first GM `ready` after this update, if the world setting still holds the exact old provisional string, it is replaced with the confirmed string. If the GM has customized the allowlist to anything else, it is left untouched.
- Migration flag `skillAllowlistMigrated211` registered as a hidden world setting (`config: false`). Written to `true` after migration runs (whether or not a replacement was needed). Ensures migration runs exactly once per world.

**Migration detection string (exact match required):**
```
acrobatics,bluff,intimidate,stealth,heal,useMagicDevice,disableDevice,sleightOfHand,knowledge
```

**Replacement string:**
```
acr,blf,int,ste,hea,umd,dev,slt,kar,kre,kna,klo
```

Perception (`per`) remains excluded. Attack auto-spend remains deferred. No other behavior changes.

---

## v2.11.0 — Skill Auto-Spend

Skill auto-spend is now live behind the `autoSkillSpend` world setting (default OFF).

**Confirmed hook signature:**
```
pf1ActorRollSkill(actor, chatMessage, skillKey)
```
Confirmed via v2.10.x diagnostic testing.

**Confirmed skill keys and action costs:**

| Key | Skill | Cost |
|-----|-------|------|
| acr | Acrobatics | 1 |
| blf | Bluff | 1 |
| int | Intimidate | 1 |
| ste | Stealth | 1 |
| hea | Heal | 1 |
| umd | Use Magic Device | 1 |
| dev | Disable Device | 3 (all-or-nothing) |
| slt | Sleight of Hand | 1 |
| kar | Knowledge (Arcana) | 1 |
| kre | Knowledge (Religion) | 1 |
| kna | Knowledge (Nature) | 1 |

**Excluded:** `per` (Perception) — passive/reactive sense, excluded intentionally.

**Disable Device / dev:** Costs 3 actions. If fewer than 3 pips are available, nothing is spent. All-or-nothing is enforced by `_spendActionForCombatant`.

**Dedupe guard:** `_isSkillSpendDuped` keys on `actor.id:skillKey:chatMessage.id` with a 500ms window. If the hook fires multiple times for the same roll, only the first event spends pips.

**Attack auto-spend deferred:** `pf1AttackRoll` confirmed as `(ItemAction, D20RollPF, Object)`. Dedupe behavior not yet designed — unclear whether it fires once per attack action, per iterative roll, or per damage/card event. Will be addressed after observing behavior in live play.

**Move / Stride button deferred** to a future release.

---

## v2.10.1 — Diagnostic Cleanup

Cleaned up `_summarizeHookArg` in `scripts/action-tracker.js` to remove all `arg?.data` probing.

**Root cause:** PF1 emits `ItemAction.data has been deprecated. Use the data directly on the action instead.` compatibility warnings whenever `.data` is accessed on an ItemAction object. The v2.10.0 diagnostic summarizer accessed `arg?.data?.actor`, `arg?.data?.skill`, `arg?.data?.skillId`, and `arg?.data?.skillKey`, triggering these warnings on every `pf1AttackRoll` fire.

**Fix:** All `.data` paths removed from the summarizer. No replacement `.data` access was added. The summarizer now probes non-deprecated paths only:
- Actor paths: `arg?.actor`, `arg?.item?.actor`, `arg?.action?.actor`, `arg?.subject?.actor`, `arg?.parent?.actor`, `arg?.parent`
- Skill key paths: direct (`skill`, `skillId`, `skillKey`, `key`, `id`, `name`), via `arg?.action.*`, via `arg?.subject.*`

Diagnostics remain debug-gated behind the `debugLogging` setting and observer-only. No live action automation is enabled.

---

## v2.10.0 — Action Automation Diagnostics

This version begins action automation work with diagnostic-only PF1 hook logging.

Added debug-gated logging for:
- `pf1AttackRoll`
- `pf1ActorRollSkill`

These hooks do not spend action pips. They exist only to verify the actual PF1 runtime payload shape before final automation logic is wired.

**Testing goals:**
- Confirm actor path for attack rolls.
- Confirm actor path for skill rolls.
- Confirm skill key path and format.
- Confirm whether `pf1AttackRoll` fires once per attack action, once per iterative attack, for AoOs, or during damage/card display flow.
- Look for any stable roll/message/action identifier usable for dedupe.

Automation remains disabled until payload extraction and dedupe rules are confirmed.

---

## v2.10.0 — Action Automation (Future Release — Planning Notes)

**Status:** Planned. Scaffold registered in v2.9.9. Do NOT implement mid-campaign.

**What v2.9.9 added (inert):**
- `scripts/settings.js` — all automation settings registered, all default OFF
- `_debugLog`, `_getActiveCombatant`, `_getActiveCombatantForActor`, `_canUserControlCombatant`, `_spendActionForCombatant`, `_spendActionForActor` helpers in `action-tracker.js` (no hooks call them yet)
- `SKILL_ACTION_COSTS` constant in `action-tracker.js` (provisional key names, unverified)

**What v2.10.0 must add:**

### First step: diagnostic payload logging (v2.10.0 — do this before wiring)

The argument signatures for `pf1AttackRoll` and `pf1ActorRollSkill` are **not verified yet**. Do not assume argument positions, field names, or payload shape. The first thing v2.10.0 must do is add temporary diagnostic hooks that log all raw arguments with `debugLogging` enabled.

With `debugLogging` ON in Module Settings, add temporary hooks like these to identify the actual payload shape:

```javascript
// DIAGNOSTIC ONLY — do not ship. Log full argument list.
// Run a few attacks and check F12 for the output.
Hooks.on('pf1AttackRoll', (...args) => {
  _debugLog('pf1AttackRoll raw args:', ...args);
});

// DIAGNOSTIC ONLY — do not ship. Run each skill in the approved list.
Hooks.on('pf1ActorRollSkill', (...args) => {
  _debugLog('pf1ActorRollSkill raw args:', ...args);
});
```

**What to verify from the diagnostic output before wiring any automation:**

- `pf1AttackRoll`: Which argument position (or property) carries the actor? Does it fire once per attack action, once per individual attack roll (iteratives), or once per damage/card event? Does it fire for AoOs? The dedup guard design depends on this.
- `pf1ActorRollSkill`: Which argument position carries the actor? Which argument carries the skill key? Is the skill key a flat string (`acrobatics`), camelCase (`useMagicDevice`), a dot-path (`knowledge.arcana`), or something else? Log all sub-skill knowledge rolls to confirm the format.
- Verify all keys in `SKILL_ACTION_COSTS` against logged output before enabling any skill automation.

Only after logging and confirming the payload shape should spend wiring be added — using the verified argument positions and field names.

### Approved first-pass skill list (v2.10.0)

These skills are included in the default allowlist and `SKILL_ACTION_COSTS`. All key names are **provisional** and must be verified against the actual `pf1ActorRollSkill` hook payload at runtime before automation is enabled.

| Skill | Action cost | Notes |
|---|---|---|
| Acrobatics | 1 | |
| Bluff | 1 | |
| Intimidate | 1 | |
| Stealth | 1 | |
| Heal | 1 | |
| Use Magic Device | 1 | Verify untrained-use edge cases |
| Disable Device | 3 | Verify cost is correct and not context-dependent |
| Sleight of Hand | 1 | |
| Knowledge (all) | 1 | Placeholder key — verify whether PF1 uses a flat key or dot-paths (e.g. `knowledge.arcana`) |

**Excluded from the default allowlist:**
- **Perception** — passive/reactive sense; spending an action on a Perception check conflicts with PF1.5 action economy intent. Remove from allowlist if a player adds it manually.

### Required verification before enabling hooks

- **Confirm pf1AttackRoll payload:** verify which field carries the actor, whether it fires for AoOs, whether it fires for iterative attacks separately (if so, a dedup guard is needed keyed on roll ID or timestamp).
- **Confirm pf1ActorRollSkill payload:** verify the exact skill key string format (flat key vs dot-path for sub-skills, casing). Perform test rolls for each skill in the approved list and log the raw key received.
- **Verify SKILL_ACTION_COSTS keys:** log pf1ActorRollSkill for each skill, compare output against the scaffold keys. Update any mismatches before enabling.
- **Verify Disable Device cost:** confirm 3 actions is correct for all contexts in PF1.5 before enabling.
- **Verify Knowledge key format:** confirm whether sub-skills arrive as `knowledge`, `knowledge.arcana`, or some other shape.
- **Unlinked tokens:** `_getActiveCombatantForActor` matches on `actor.id`. Verify that unlinked token synthetic actors resolve correctly, or add a token-ID fallback.

### Dedupe guard (required)

Attack hooks and skill hooks may fire multiple times for the same user action (e.g., iterative attacks, hook re-entrant from PF1 internals). Before going live, implement a short-window dedup:

```javascript
const _recentSpends = new Set();

function _dedupeSpend(key, fn) {
  if (_recentSpends.has(key)) return;
  _recentSpends.add(key);
  setTimeout(() => _recentSpends.delete(key), 500); // 500ms window
  fn();
}
```

### Floating Move / Stride button

- Position preference stored in `moveButtonPosition` setting (already registered)
- Implementation: inject a fixed-position button during combat; clicking spends 1 action and emits a chat message or notification
- Do NOT use token drag movement as the implementation — too unreliable and fires from GM scene panning
- The button should appear only when combat is active AND the current user has a combatant with actions remaining

### Exclusions (never add without explicit GM review)

- **Perception** — excluded from default allowlist; do not include in first pass
- **Token drag movement** — too noisy, wrong abstraction
- **Standard/move/swift/full-round inference** — PF1.5 uses 3-action economy; never map back to PF1 action types

### Stability requirements

- All automation must be gatable to ON/OFF per setting (already registered)
- Enable `debugLogging` during development — every spend decision should appear in F12
- Test with automation ON and OFF to confirm pips stay unchanged when disabled
- Test with no active combat — helpers must return false/null gracefully
- `_getActiveCombatantForActor` only returns the current active combatant — off-turn actors must not trigger pip spends

---

## Staged ESM Migration (Future Task)

**Status:** Deferred. Not in scope for any current patch.

**Why it needs doing eventually:**
`module.json` currently declares scripts via the legacy `"scripts"` array. Foundry v13 mandates ES modules (`"esmodules"`) as the canonical pattern — `"scripts"` loads files as classic scripts (no `import`/`export`, no module scope isolation, global variable pollution). It still works in v13 but is the deprecated path and will eventually be removed.

**When to do it:**
Once a session-boundary exists where a full regression test is practical. This is not a quick rename — converting classic scripts to ESM requires:
- Confirming all inter-file globals (`_baphNormalizeHtml`, `pipState`, etc.) are properly imported/exported rather than relying on global scope load order
- Introducing a `scripts/main.js` or `scripts/main.mjs` as the single entry point declared in `"esmodules"`, which imports the rest
- Or migrating each file independently and declaring all of them in `"esmodules"` (easier, but loses the single-entry-point pattern)
- Verifying `data/climate-zones.js` is also converted (it's loaded first in the scripts array and likely relies on being globally available)
- End-to-end test: all seven features (theme, conditions, action tracker, roll cards, XP, weather engine, weather UI) pass smoke tests

**Recommended approach:**
Introduce `scripts/main.mjs` as the orchestrator entry point. Convert each existing file to ESM (`export function`, `import { x } from './y.js'`). Declare only `main.mjs` in `"esmodules"`. Remove `"scripts"` array. This matches the pattern used by `local-lore-oracle`.

**Do NOT do this mid-campaign** without a full test session.

---

## Known Deferred Items

- `FormApplication` in `local-lore-oracle` settings.js — fires v13 deprecation console warnings but is functional. Migrate to `ApplicationV2` in a future pass.
- `baphomet-utils` now has `scripts/settings.js` — any future GM-configurable options (beyond weather UI and automation scaffold) should land there.
