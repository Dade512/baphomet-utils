# DEV_NOTES — baphomet-utils

Internal development notes. Not user-facing.

---

## v2.16.0 — Multi-Round Task Scaffold

API-only scaffold for multi-round task tracking. No UI, no Disable Device integration, no automatic resolution.

### Storage Model

**Public task state → actor flags**

```javascript
combatant.actor.setFlag('baphomet-utils', 'tasks', {
  [taskId]: PublicTaskObject
})
```

Readable by anyone with actor ownership. Never contains `roundsRequired`, hidden DCs, or `metadataHidden`. Safe to return to non-GM clients as-is.

**Hidden task data → GM user flags**

```javascript
game.user.setFlag('baphomet-utils', 'hiddenTaskData', {
  [taskId]: HiddenTaskObject
})
```

Written to `game.user` (the GM who creates the task). Readable only by that same GM user client. `roundsRequired` and `metadataHidden` are never written to actor flags under any circumstances.

### Single-GM Assumption

v2.16.0 assumes a single-GM campaign. Hidden data is stored on `game.user` at creation time. If a different GM user later needs to commit or resolve a task, they will not have the hidden data. This is acceptable now and is a documented limitation.

Multi-GM scenarios are future work. Do not add GM-authority election or hidden-data migration in this patch.

### Public Task Object Shape

Stored on actor flags. Fields safe to expose to players.

```javascript
{
  taskId:               string,   // "${combatant.id}-${skillKey}-${Date.now()}"
  skillKey:             string,   // PF1 skill key e.g. 'dvs' for Disable Device
  taskType:             string,   // 'generic', 'disable-device', etc.
  taskName:             string,   // human-readable label
  roundsCommitted:      number,   // rounds of progress so far
  startedRound:         number,   // combat.round when task was created
  lastCommittedRound:   number | null, // last round a commit was made
  status:               'active' | 'paused' | 'resolved' | 'abandoned',
  pausedReason:         string | null, // e.g. 'combat-ended', 'player-choice'
  readyToResolve:       boolean,  // set true by GM client only when roundsCommitted >= roundsRequired
  createdByUserId:      string,   // game.user.id of the GM who created the task
  hiddenDataOwnerUserId: string,  // same as createdByUserId; used to identify the GM's flags
  metadataPublic:       object,   // player-safe notes, tags, display hints
}
```

Not included in public object: `roundsRequired`, `metadataHidden`.

### Hidden Task Object Shape

Stored on GM user flags only.

```javascript
{
  taskId:         string,
  roundsRequired: number,  // the hidden target — never written to actor flags
  metadataHidden: object,  // GM-only: trap DC, treasure notes, etc.
}
```

### readyToResolve Policy

Only the GM client that holds hidden data may set `readyToResolve` to `true`. Evaluation happens inside `commitAction` after a successful action spend:

- If `game.user.isGM` and `hiddenAll[taskId]?.roundsRequired` is present: compare and set.
- If `game.user.isGM` but hidden data is absent: log a warning, leave `readyToResolve` false. Do not guess.
- If non-GM: skip evaluation entirely. The field will be `true` if the GM client already set it.

### Combatant-First API

All public API methods accept a `Combatant` object as the first argument. A string ID fallback is available internally (via `game.combat.combatants.get(id)`) for macro convenience, but the documented API is always `Combatant`-first.

Reason: unlinked tokens produce synthetic actors not in `game.actors`. Using `combatant.actor` ensures we always get the contextually correct actor, even for unlinked tokens.

### game.baphometTasks API

```javascript
game.baphometTasks = {
  createTask(combatant, options),   // GM only
  getTask(combatant, taskId),       // GM gets full object; non-GM gets sanitized
  getTasks(combatant),              // same sanitization as getTask
  commitAction(combatant, taskId),  // 9 gates; spends 1 action; GM or owner
  pauseTask(combatant, taskId, reason), // GM or owner
  resumeTask(combatant, taskId),    // GM or owner
  abandonTask(combatant, taskId),   // GM or owner
  resolveTask(combatant, taskId),   // GM only; STUB in v2.16.0
}
```

### commitAction Gate Order

1. `game.combat` exists
2. Combatant resolves and has actor
3. Combatant is `game.combat.combatant` (active turn only)
4. Current user is GM or `_baphTaskCanControl(combatant)` (mirrors action-tracker ownership check)
5. Task exists on actor flags
6. Task status is not `'paused'`
7. Task status is not `'resolved'` or `'abandoned'`
8. `task.lastCommittedRound !== game.combat.round` (same-round guard)
9. `_spendActionForCombatant(combatant.id, 1, 'task-${skillKey}')` returns `true`

### Global Dependencies

`task-tracker.js` depends on two globals from `action-tracker.js` (which loads first per `module.json`):

- `_spendActionForCombatant(combatantId, count, reason)` — action spend, all-or-nothing, returns boolean
- `_debugLog(msg, ...args)` — debug-gated console logger (gated on `debugLogging` setting)

Since neither file uses an IIFE, both functions are on `window` and accessible. If either is unavailable at runtime, task-tracker will fail clearly (console error). Do not duplicate spend logic.

### Debug Logging

Task-tracker wraps `_debugLog` via `_baphTaskDebugLog(msg, ...args)` which prefixes `[task]` to all messages. Enable `debugLogging` in Module Settings to see all gate decisions, write confirmations, and hidden-data warnings.

### Global Name Collision Policy

`task-tracker.js` uses no IIFE. All module-level names are prefixed:
- Constants: `BAPH_TASK_*`
- Cache: `_baphTaskCache`
- Helper functions: `_baphTask*`
- Public implementations: `_baphTask*` (wrapped into `game.baphometTasks`)

### v2.16.0 Hard Boundaries

v2.16.0 does NOT implement:
- Continue Task button or any task UI
- Task progress widget
- Disable Device integration (dev warning in action-tracker.js is unchanged)
- `pf1PreActionUse` suppression
- `actor.rollSkill()` or any skill roll invocation
- `resolveTask` logic (stub only — logs and returns false)
- `updateActor` cache listener (deferred to v2.17.1)
- MAP, swing tracking, or attack changes
- Skill auto-spend changes
- Condition math changes
- ESM migration
- PF1 prototype patches or `pf1.config` mutation

### Roadmap

| Version | Release Name | Scope |
|---------|-------------|-------|
| **v2.16.0** | Multi-Round Task Scaffold | `task-tracker.js`, public actor flags, GM user flags, `game.baphometTasks` API, no UI |
| **v2.17.0** | Read-Only Task Progress Widget | Display task progress in/near action panel; no player controls |
| **v2.17.1** | Continue Task Button + Cache Sync | Continue button, player-client writes, `updateActor` cache listener |
| **v2.18.0** | Disable Device Integration | Task creation triggered by skill use; careful around pre-roll suppression |
| **v2.19.0** | Task Resolution Polish | GM duration dialog, hidden duration UX, Quick Disable/Trapfinder, failure handling, full `resolveTask` |

---

## v2.15.1 — Action Panel Label Cleanup

Cosmetic only. No mechanics changed.

The Spend 3 button's example label was updated from `D.DEV / F. CAST` to `F.CAST / RUN`. The old label referenced Disable Device, which no longer costs 3 immediate actions as of v2.15.0 — it uses the PF1.5 Multi-Round Task Pattern instead. The new label reflects generic 3-action uses (e.g. a full-action cast or a long run) without implying any specific rule.

The button still spends exactly 3 action pips via `manual-3`. All spend behavior, condition-lock enforcement, and all-or-nothing logic are unchanged.

---

## v2.15.0 — Disable Device Task Prep

Safety patch only. No new automation features.

**Disable Device is now governed by the PF1.5 Multi-Round Task Pattern.**

The previous `dev: 3` implementation has been removed. Disable Device is not a 3-action auto-spendable skill — it is a multi-round task where the actor commits 1 action per round with **Continue Disabling** until the check resolves. Duration varies by complexity (simple: 1 round; typical: 1d4 rounds; complex: 2d4 rounds).

**Current runtime behavior (v2.15.0):**
- In active combat, a Disable Device roll triggers an explicit warning notification: *"Disable Device: PF1.5 multi-round task — commit 1 action/round. Task tracking not yet automated."*
- Zero pips are spent automatically.
- The PF1 roll itself still proceeds (no pre-roll blocking).
- `dev` has been removed from `SKILL_ACTION_COSTS` and from the default `skillAutoAllowlist`.
- A one-time migration (`skillAllowlistMigrated215`) removes `dev` from the stored allowlist on first GM load; customized allowlists are left untouched.

**Task subsystem not yet implemented.** This patch is a safe holding state. The task-progress subsystem is a distinct future feature and will be implemented as its own release.

**When the task subsystem is built, it should be reusable for:**
- Disable Device (primary driver)
- Survival tracking (e.g. foraging over multiple rounds)
- Extended Heal treatment (longer-duration medicine checks)
- Jury-rigging and improvised repairs
- Ritual interruption tracking
- Custom GM-defined multi-round tasks

---

## v2.14.0 — Hide PF1 Full Attack Button

Implements the first live PF1.5 action economy enforcement: hiding the Full Attack button from AttackDialog when PF1.5 Mode is enabled.

**New setting: `pf15ModeEnabled` ("PF1.5 Mode")**
- World scope, default **true** (all actors in this campaign are PF1.5)
- Master toggle for PF1.5 action economy enforcement
- Currently controls: Full Attack button suppression
- Future scope (v2.15.0+): Strike auto-spend, swing tracking, MAP injection

**Implementation:**
`_diagHandleAttackDialogRender` (called by `renderApplicationV1`, `renderApplicationV2`, and `renderAttackDialog` hooks) restructured so root normalization always runs unconditionally. When `pf15ModeEnabled` is true:
```javascript
root.querySelector('button[name="attack_full"]')?.remove();
```
Confirmed selector from v2.13.5 live diagnostics: `button[name="attack_full"]` is the Full Attack button; `button[name="attack_single"]` is the Single Attack button and is untouched.

Diagnostic scan runs after suppression (if `debugLogging` is ON) so the log reflects what the player actually sees. `pf15ModeEnabled` value included in the diagnostic summary.

**Not added in this release:**
- No attack auto-spend (pf1AttackRoll still diagnostic-only)
- No pf1PreActionUse cancellation
- No swing tracking or MAP injection
- No reaction/AoO automation
- No ESM migration

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

## Known Deferred Items

- `FormApplication` in `local-lore-oracle` settings.js — fires v13 deprecation console warnings but is functional. Migrate to `ApplicationV2` in a future pass.
- `baphomet-utils` now has `scripts/settings.js` — any future GM-configurable options (beyond weather UI and automation scaffold) should land there.
- ESM migration — deferred. See "Staged ESM Migration" section in prior notes. Do not do mid-campaign.

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
- End-to-end test: all features (theme, conditions, action tracker, task tracker, roll cards, XP, weather engine, weather UI) pass smoke tests

**Recommended approach:**
Introduce `scripts/main.mjs` as the orchestrator entry point. Convert each existing file to ESM (`export function`, `import { x } from './y.js'`). Declare only `main.mjs` in `"esmodules"`. Remove `"scripts"` array. This matches the pattern used by `local-lore-oracle`.

**Do NOT do this mid-campaign** without a full test session.
