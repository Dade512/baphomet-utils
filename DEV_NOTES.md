# DEV_NOTES — baphomet-utils

Internal development notes. Not user-facing.

---

## v2.20.1 — Player Task Readiness Socket

### Root cause

`_baphTaskCommit` evaluated `readyToResolve` with a guard:

```javascript
if (game.user.isGM) {
  const hiddenAll = _baphTaskReadHiddenAll();
  // ... compare roundsCommitted >= roundsRequired ...
}
```

Non-GM clients skipped this block entirely. `_baphTaskReadHiddenAll()` returns `{}` for non-GM callers by design (hidden data is stored on the GM user flag, not the player's user flag). So when a player clicked Continue Task, public progress advanced but `readyToResolve` was never set, leaving the task stuck indefinitely.

### Fix

After a successful non-GM `_baphTaskCommit` write, the player client emits:

```javascript
game.socket.emit(`module.baphomet-utils`, {
  action:  'baphTaskReadinessCheck',
  payload: {
    combatantId:        combatant.id,
    taskId,
    roundsCommitted:    task.roundsCommitted,   // advisory/debug only
    requestingUserId:   game.user.id,
  },
});
```

The GM socket handler for `baphTaskReadinessCheck`:

1. Validates `requestingUserId` owns the combatant's actor (same pattern as `baphTaskResolveAdjudicate`).
2. Reads the authoritative public task state from actor flags directly (does not trust the `roundsCommitted` in the payload).
3. Reads `roundsRequired` from the GM user flag via `_baphTaskReadHiddenAll()`.
4. If `rcTask.roundsCommitted >= rcHidden.roundsRequired` and the task is still `active` and not already `readyToResolve`, sets `readyToResolve = true` and writes actor flags.
5. The actor flag write triggers the existing `updateActor` hook on all clients, which refreshes the task widget. The player sees Resolve Task appear.

### Privacy preservation

The `baphTaskReadinessCheck` payload contains:
```
combatantId, taskId, roundsCommitted (advisory), requestingUserId
```

`roundsRequired` is never included. The hidden duration comparison occurs entirely on the GM client using data read from GM user flags.

### Socket message table (updated for v2.20.1)

| Action | Direction | Processed by |
|---|---|---|
| `baphTaskRequest` | player → GM | GM clients |
| `baphTaskRequestResponse` | GM → player | Player (non-GM) clients — before GM gate |
| `baphTaskResolveAdjudicate` | player → GM | GM clients |
| `baphTaskAidAdjudicate` | player → GM | GM clients |
| `baphTaskReadinessCheck` | player → GM | GM clients |

### GM commit path unchanged

When the GM clicks Continue Task, `game.user.isGM` is true. The existing synchronous readiness check in `_baphTaskCommit` continues to run. No socket round-trip needed for the GM path.

### updateActor refresh path

The GM's `_baphTaskWriteActorTasks()` call inside the readiness-check handler triggers `actor.setFlag()`, which propagates an `updateActor` hook to all clients. The existing `Hooks.on('updateActor', ...)` in task-tracker.js rebuilds the task cache entry and calls `_renderActionPanel()` on every connected client. No new refresh channel needed.

### Confirmed API references used in v2.20.1

- `game.socket.emit(channel, message)` / `game.socket.on(channel, handler)` — socket already in use since v2.17.2 for `baphTaskResolveAdjudicate`
- `CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER` — already used in existing socket handlers
- `actor.setFlag()` → `updateActor` hook propagation — established cross-client refresh pattern from v2.17.1

---

## v2.20.0 — Player-Side Task Initiation

### Architecture overview

Player-initiated task creation follows the same socket adjudication pattern established for Aid Another (player-rolls, GM-adjudicates). The key difference: the player provides no hidden data; only the GM does.

```
Player client                    GM client
──────────                       ─────────
"Request Skill Task" button
→ _openRequestTaskDialog()
→ emit baphTaskRequest            ← receive baphTaskRequest
                                  → _baphHandleTaskRequest()
                                  → _baphShowGMApprovalForPayload()
                                  → _openGMApprovalModal() [action-tracker.js]
                                  → GM fills DC + roundsRequired
                                  → game.baphometTasks.initiateTask()
                                  → emit baphTaskRequestResponse
← receive baphTaskRequestResponse
→ _baphHandleRequestResponse() [action-tracker.js]
→ clear timer, close overlay, notify
```

### Socket message types (v2.20.0)

| Action | Direction | Processed by |
|---|---|---|
| `baphTaskRequest` | player → GM | GM clients (existing `if (!game.user.isGM) return` gate) |
| `baphTaskRequestResponse` | GM → player | Player (non-GM) clients — handled BEFORE the GM gate |

The socket handler restructuring adds a pre-GM-gate block for `baphTaskRequestResponse` so that non-GM clients can receive the response without restructuring the existing handler pattern.

### Cross-file global pattern

`action-tracker.js` (loads first) exposes:
- `_openGMApprovalModal(payload, validation)` — opens the GM modal overlay
- `_baphHandleRequestResponse(payload)` — processes the player-side response
- `_removeRequestTaskOverlay()` / `_removeGMApprovalModal()` — cleanup helpers
- `_baphSignalNextGMRequest()` — calls `_baphProcessNextGMRequest` after modal closes

`task-tracker.js` (loads after) exposes:
- `_baphProcessNextGMRequest()` — dequeues and shows next pending request

All cross-file calls happen at runtime (inside event handlers and async callbacks), never at module load time.

### Skill registry

```javascript
const BAPH_MULTI_ROUND_SKILL_REGISTRY = [
  { key: 'dev', label: 'Disable Device' },
];
```

Registry-driven: adding future multi-round skills is a config change here, not a UI rewrite. If the registry has more than one entry, the player dialog automatically switches from a read-only label to a dropdown selector.

### Privacy preservation

The `baphTaskRequest` socket payload contains:
```
requestId, requestingUserId, requestingActorId, requestingCombatantId,
skillId, description, timestamp
```

No DC or duration values are ever included. The GM sets these locally via the approval modal, and they are stored exclusively on GM user flags via the existing `_baphTaskWriteHiddenAll` path.

### GM request queue

If two player requests arrive before the GM has handled the first, the second is queued in `_baphGMRequestQueue`. After the GM approves or rejects, `_baphSignalNextGMRequest` → `_baphProcessNextGMRequest` dequeues the next item and opens a new modal. The runtime checklist (test F) covers this path.

### Request expiry

The player's overlay starts a 60-second `setTimeout`. If `_baphActiveRequestId` still matches when it fires, the timer clears itself, removes the overlay, and shows a `ui.notifications.warn`. GM-side requests older than 70 s (a 10 s buffer) are silently discarded if they somehow arrive late.

### Confirmed API references used in v2.20.0

- `game.socket.emit(channel, message)` / `game.socket.on(channel, handler)` — socket already in use since v2.17.2 for `baphTaskResolveAdjudicate`
- `game.baphometTasks.initiateTask(combatant, options)` — established in v2.19.0; approval path calls it unchanged
- `CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER` — already used in socket handlers for `baphTaskResolveAdjudicate` and `baphTaskAidAdjudicate`
- `ChatMessage.create({ whisper: [userId] })` — whispered rejection message to player

---

## v2.19.2 — Pip Flag Write Authority

### Root cause

`_maybeResetForNewTurn()` runs on every connected client during `renderCombatTracker`. It unconditionally called `_writePipFlag(combatantId)`, which called `combatant.setFlag(...)` without first checking whether the current user has document-update authority over that Combatant. Non-GM player clients produced:

```
User [player] lacks permission to update Combatant [...]
baphomet-utils | _writePipFlag error: Error: User [...] lacks permission to update Combatant [...]
```

### Fix

A single guard added to `_writePipFlag`, after the `combatant` null-check:

```javascript
if (!combatant.isOwner) return;
```

Non-authorized clients now silently no-op without logging an error.

### Authority model

| Client | `combatant.isOwner` for player-owned combatant | For GM-owned NPC combatant |
|--------|-----------------------------------------------|---------------------------|
| GM     | `true`                                        | `true`                    |
| Player | `true` (owns their own actor/combatant)       | `false`                   |

GM clients continue to write pip state for all combatants. Player clients write only for combatants they own. Cross-client sync is preserved: the `updateCombatant` hook fires on all clients from the GM's authoritative write.

### API reference

`combatant.isOwner` — `docs/reference/foundry-v13/99_Combined_Foundry_v13_PF1_[KnowledgeFiles.md].md`, checklist item: "actor.isOwner checked before updates in multiplayer context"; also lines 557, 1840, 2159, 3862 (same file).

Note: The Opus forensic audit recommended `canUserModify(user, 'update')`, which is not present in any local reference doc. `isOwner` is the repo-confirmed equivalent and produces identical gating for this use case.

### Scope

One line added to `scripts/action-tracker.js`. No pip-sync architecture changes. No call-site changes. No settings changes. No socket changes.

---

## v2.19.1 — Cross-Client Action Pip Sync

### Root cause

`pipState` (action-tracker.js:376) was a plain JavaScript `Map`, entirely client-local. No document flag was written and no socket message was sent on pip spends. Each browser tab maintained its own pip view; remote clients never updated.

### Storage model: Combatant flag

Chosen over actor flags because pips are combat-encounter state, not actor-persistent state. Combatant documents are naturally disposable on `deleteCombat`. Avoids actor flag accumulation across multiple encounters.

Flag stored at:
```text
flags.baphomet-utils.pipState
```

Flag shape:
```javascript
{
  actions:      [bool, bool, bool],  // true = available
  reaction:     [bool],
  reflexPip:    [bool],              // [] if no Combat Reflexes
  resetForRound: number | null,      // combat.round at time of last reset
}
```

`resetForRound` is included so a reloaded client hydrating from the flag will correctly set `_resetForRound` and skip redundant turn-start resets for the current round.

### Write points (action-tracker.js)

| Function | When |
|---|---|
| `_writePipFlag` | Called fire-and-forget (no await) from all spend/reset paths |
| `game.baphometActions.spendAction` | After successful spend (spent > 0) |
| `game.baphometActions.spendReaction` | After reaction spend |
| `game.baphometActions.reset` | After macro/API reset |
| `_maybeResetForNewTurn` | After turn-start reset + condition locks applied |
| `_togglePip` | After manual pip toggle in sidebar |

### Read points (action-tracker.js)

- `_initState`: reads `combatant.getFlag('baphomet-utils', 'pipState')` synchronously (getFlag reads in-memory document data). If flag present, hydrates pip arrays and `_resetForRound`. Otherwise initializes fresh.
- `Hooks.on('updateCombatant', ...)`: re-reads authoritative flag via `getFlag`, updates local `pipState` entry, calls `_refreshPipRow`. Fires on ALL clients.

### Existing `pipState` Map

Retained as a local cache (read-through). `_initState` still populates it. All spend/render paths still read from it synchronously. The flag is the authoritative cross-client source; the Map is the local performance cache.

Stale-cache overwrite risk: guarded by the array-length checks in `_initState` and the `updateCombatant` hook (hydrates AFTER the write, which is always the newest value).

### Confirmed API references

- `Hooks.on('updateCombatant', (combatant, changes, options, userId) => {})` — `99_Combined_Foundry_v13_PF1_[KnowledgeFiles.md].md` line 2767
- `doc.setFlag(moduleId, key, value)` / `doc.getFlag(moduleId, key)` — `foundry-and-pf1.md` line 361
- `foundry.documents.Combatant` — listed as document class at multiple reference file locations

---

## v2.19.0 — Task Initiation UI + GM Task Builder

### Overview

Adds the front door for the multi-round task subsystem: GM-only task creation from the combat HUD. No developer console required for live play.

### New function: `_baphTaskInitiate` (task-tracker.js)

Distinct from `_baphTaskCreate` (developer helper):

- `createTask()` — starts with `roundsCommitted: 0`. Used for console testing.
- `initiateTask()` — starts with `roundsCommitted: 1`. The initiation action IS the first committed work unit per the canonical spec.

Gate sequence (any failure returns `false`):
1. GM-only
2. Active combat exists
3. Valid combatant with actor (`_baphTaskResolveCombatant`)
4. Combatant is the active combatant
5. No existing active task for this combatant
6. Task name non-empty (trimmed)
7. `roundsRequired` is a positive integer
8. `dc` is a positive integer
9. `_spendActionForCombatant(combatant.id, 1, 'task-initiate')` succeeds

On success:
- Writes public task with `roundsCommitted: 1`, `readyToResolve: roundsRequired <= 1`
- Writes hidden data (`roundsRequired`, `dc`) to GM user flags only
- Posts a public-safe chat message (no hidden values leaked)
- Calls `_renderActionPanel()` to refresh the HUD

### New UI: Begin Task button + builder overlay (action-tracker.js)

`_renderBeginTaskWidget(combatant, position)` — renders a minimal task-widget-styled div with only the "Begin Task" button. Only called by `_renderTaskWidget` when `game.user.isGM` and no active task.

`_openTaskBuilderOverlay(combatant)` — DOM overlay (ID `baph-task-builder`). Stores the initiating combatant ID in `overlay.dataset.combatantId` for stale-turn detection at confirm time.

Overlay is NOT removed by `_renderActionPanel()` re-renders, so the GM can fill the form across combat tracker refreshes. Removed by:
- Confirm button click
- Cancel button click
- `deleteCombat` hook

Secret duration rolls use `Math.floor(Math.random() * 4) + 1` (1d4), summed twice for 2d4. Computed entirely GM-side; never transmitted.

### Storage model (unchanged)

- Public task state: actor flags `baphomet-utils.tasks`
- Hidden data: GM user flags `baphomet-utils.hiddenTaskData`

Builder-created tasks are identical in storage shape to console-created tasks. No special lifecycle path.

### Roadmap

| Version | Scope |
|---|---|
| **v2.19.0** | GM task initiation UI (this release) |
| **v2.20.0** | Player-side initiation, trap entity integration, or Quick Disable — TBD |

---

## v2.18.1 — Aid Another Rules Alignment

Rules-alignment pass on the Aid Another mechanic introduced in v2.18.0. Architecture unchanged; behavior corrected to match the authoritative Multi-Round Task Pattern spec.

### Aid Eligibility

Previously restricted to `readyToResolve === true` tasks. Now: any task with `status === 'active'` is eligible, covering both in-progress and ready-to-resolve tasks. Aid banked during the in-progress phase is held in `pendingResolutionBonuses` until the eventual Resolve roll fires.

### Aid Check — DC 10 Roll

Previously a deterministic +2 with no roll. Now:
- 1 action spent (unchanged)
- `actor.rollSkill(task.skillKey, {skipDialog:true})` fires
- Total captured via `pf1ActorRollSkill` hook (same pattern as Resolve Task)
- Compare vs DC 10 (fixed public DC, not the hidden resolution DC)
- Success (≥ 10): bank +2 to `pendingResolutionBonuses`, record aider in `successfulAidContributors`
- Failure (< 10): no bonus banked. Action still spent. Aider may retry.

### Contributor Cadence

New field `successfulAidContributors: string[]` on each public task object (array of combatant IDs). Cleared by `_baphTaskAdjudicate` after every Resolve attempt alongside `pendingResolutionBonuses`.

| Event | `pendingResolutionBonuses` | `successfulAidContributors` |
|---|---|---|
| Aid success | +1 entry | +1 combatant ID |
| Aid failure | unchanged | unchanged |
| Resolve (any outcome) | cleared | cleared |
| Abandon | cleared | cleared |

This means: after a minor failure, the same helper may Aid again for the next retry.

### Duplicate Guard

Old: `bonuses.some(b => b.roundAdded === currentRound)` — blocked per-round.
New: `successfulAidContributors.includes(aider.id)` — blocked per-Resolve-attempt.

Failed attempts do NOT add to `successfulAidContributors`, so a helper may retry after a failure (3-action economy is the deterrent).

### Socket Changes

`baphTaskAidAdjudicate` socket payload now includes `rollTotal`. GM side receives the total and performs the DC 10 comparison. This is consistent with the resolve path (player rolls, GM classifies). Hidden task DC never transmitted.

### Suppression Flags

`var _baphAidTaskRollActive = false` added (global window property, same pattern as `_baphResolveTaskRollActive`). Read by action-tracker.js to:
- Suppress the Disable Device no-auto-spend warning during Aid rolls of dev tasks
- Suppress the general skill auto-spend handler during any task-system-initiated roll

### Roadmap

| Version | Scope |
|---|---|
| **v2.18.1** | Aid Another rules alignment (this release) |
| **v2.19.0** | Feat-scaled Aid +N, additional resolver types, task resolution polish |
| **v2.20.0** | Task initiation UI, Disable Device integration |

---

## v2.18.0 — Pending Resolution Bonus Support + Aid Another Baseline

### Pending Resolution Bonus Data Model

`pendingResolutionBonuses` field added to all new tasks (and to `_baphTaskSanitize`). Safe to expose to all clients — contains no hidden DC or hidden metadata.

```javascript
pendingResolutionBonuses: [
  {
    sourceCombatantId: string,   // combatant that spent the action
    sourceActorId:     string,   // actor ID for display/dedup
    sourceUserId:      string,   // user who triggered aidTask
    amount:            number,   // always 2 at v2.18.0 baseline
    label:             string,   // 'Aid Another'
    roundAdded:        number,   // combat.round when queued
  }
]
```

Cleared in:
- `_baphTaskAdjudicate` — after any resolve attempt (success, minor failure, catastrophic)
- `_baphTaskAbandon` — on task abandon

### Aid Another — B0 Mechanical Assumption

Baseline assumption used (no confirmed repo-local rule overrides):
- Aiding costs exactly **1 PF1.5 action** from the aider
- Queues **+2 deterministic bonus** (no helper-roll / DC-10 check)
- Multiple different aiders may stack; same aider limited to one contribution per task per round

Deferred per non-goals:
- Feat-scaled +N
- DC-10 helper skill-check mechanic
- Group cooperative round-reduction

### Aid Roll Application

`bonus` option on `actor.rollSkill()` is confirmed in `99_Combined_Foundry_v13_PF1_[KnowledgeFiles.md].md`. Total pending bonus summed and passed as `{ skipDialog: true, bonus: N }`. Bonus shows in the PF1 roll card total, making it visible to the table.

### Aid Socket Action

New socket action `baphTaskAidAdjudicate` on `module.baphomet-utils` channel:
- Player emits: `{ aiderCombatantId, aiderActorId, aiderActorName, targetCombatantId, targetTaskId, requestingUserId, roundAdded }`
- GM validates ownership, task state, duplicate guard, then writes +2 to target actor flags
- Hidden DC and metadataHidden never transmitted

### Aid Panel UI

`baph-aid-panel` DOM element. Positioned above task widget (`bottom: 20rem` for bottom variants). Lists each eligible ally ready task with name and `Aid` button. Shows `Aided ✓` when already aided this round.

### Terminal Task Audit Model (v2.17.3 + v2.18.0)

Resolved/abandoned task records are **retained** in actor flags for GM audit. The widget and all API actions (`commitAction`, `resolveTask`, `abandonTask`, `aidTask`) ignore records where `status` is `'resolved'` or `'abandoned'`. No automatic removal/compaction. Hidden data (on GM user flags) is likewise retained.

### Known Limitations

- **GM must be online** for player-triggered aidTask (socket path)
- **Multiple GMs** not handled (first GM to process the socket message wins)
- **Aid panel positioning** (`bottom: 20rem`) should be verified at runtime — exact height of the task widget varies by task state
- **Feat-scaled Aid Another +N** deferred
- **DC-10 helper-roll mechanic** deferred

---

## v2.17.3 — Abandon Task Control + Task Lifecycle Cleanup

### Abandon Task Button

Shown in task widget when `task.status === 'active'` and user controls the combatant. Always shown alongside Continue Task or Resolve Task. Costs 0 actions; no skill roll.

### Authority Model

Player-controlled combatants: player owns the actor and can call `actor.setFlag()` directly. No socket required for abandon (contrast: Resolve Task and Aid Task require the GM-side socket path because the GM must read the hidden DC or write to a different actor).

### Terminal Guard

`_baphTaskAbandon` now rejects tasks with `status === 'resolved' || status === 'abandoned'`. Previously this guard was absent.

### Lifecycle Cleanup Summary

| Status      | Widget shown? | Can continue? | Can resolve? | Can abandon? | Can be aided? |
|-------------|--------------|---------------|--------------|--------------|---------------|
| active      | Yes          | Yes (if !ready) | Yes (if ready) | Yes        | Yes (if ready) |
| paused      | No           | No            | No           | No           | No            |
| resolved    | No           | No            | No           | No           | No            |
| abandoned   | No           | No            | No           | No           | No            |

---

## v2.17.2 — Resolve Task Button + Disable Device Resolution

### Resolve Task Button

The widget now shows a **Resolve Task** button when:
- `task.readyToResolve === true`
- `task.status === 'active'`
- The current user can control the active combatant (`_canUserControlCombatant`)

Button click flow:
1. `game.baphometTasks.resolveTask(combatant, taskId)` is called (async)
2. `resolveTask` enforces gates (active combat, active combatant, user control, readyToResolve, status not terminal, same-round guard)
3. Gate 9: spends 1 action via `_spendActionForCombatant`
4. Registers `pf1ActorRollSkill` hook to capture roll total
5. Sets `_baphResolveTaskRollActive = true` (suppresses 'dev' auto-spend warning)
6. Calls `actor.rollSkill(task.skillKey, { skipDialog: true })`
7. Hook captures `chatMessage.rolls[0].total`; flag and hook cleaned up in `finally`
8. GM clients: reads DC from `metadataHidden.dc`, classifies, posts chat, updates task state
9. Non-GM clients: roll fires, `lastResolvedAttemptRound` written, no auto-classification
10. Writes updated task flags → `updateActor` hook fires → all clients refresh widget

### Cross-Script Flag: `_baphResolveTaskRollActive`

Declared as `var` in `task-tracker.js` (window-accessible) and read in `action-tracker.js`'s `pf1ActorRollSkill` handler. The `var` is intentional — `let`/`const` at the top level of classic scripts are not window properties, so they cannot be read across files at runtime. This flag allows the 'dev' early-gate warning to remain active for standalone Disable Device rolls while being suppressed during automated task resolution rolls.

### Outcome Classification

| Outcome | Condition | Task State After |
|---|---|---|
| Success | `roll >= DC` | `status: 'resolved'`, `readyToResolve: false` |
| Minor failure | `DC - roll` in [1, 4] | `status: 'active'`, `readyToResolve: true`, round blocked |
| Catastrophic failure | `DC - roll >= 5` | `status: 'resolved'`, `readyToResolve: false` |

Classification chat message does not include the DC value (hidden metadata preserved).

### Same-Round Guard

Added `lastResolvedAttemptRound: null` to the public task schema (parallel to `lastCommittedRound`). Set to `game.combat.round` on every resolve attempt that passes the action spend gate. Prevents same-round double-resolution regardless of outcome (minor failure remains ready for next round). Included in `_baphTaskSanitize`.

### Player-Triggered Resolve Path (Correction Pass)

Non-GM players clicking Resolve Task now receive full automated classification via a socket-based GM adjudication path:

1. Player client: gates pass, action spent, `lastResolvedAttemptRound = currentRound`
2. Player client: roll fires via `actor.rollSkill()`, total captured via `pf1ActorRollSkill` hook
3. Player client: writes `lastResolvedAttemptRound` to actor flags (one `setFlag` — blocks same-round retry)
4. Player client: emits `game.socket('module.baphomet-utils', { action: 'baphTaskResolveAdjudicate', payload: { combatantId, taskId, rollTotal, requestingUserId } })`
5. GM client: socket listener receives message
6. GM client: validates (combat active, combatant found, user has OWNER+ on actor, task readyToResolve, status active)
7. GM client: calls `_baphTaskAdjudicate(combatant, taskId, task, rollTotal)` — reads hidden DC, classifies, posts chat, writes status (second `setFlag`)
8. All clients: `updateActor` fires → cache refresh → widget re-renders

**Hidden DC is never transmitted to the player.** The socket payload contains only identifiers and the roll total. The DC lookup happens exclusively on the GM client.

### Socket Architecture

- `module.json` must have `"socket": true` for `game.socket` to be available on this module's channel.
- Socket channel: `module.baphomet-utils`
- Message action: `baphTaskResolveAdjudicate`
- Listener registered in `pf1PostReady` alongside the `game.baphometTasks` API setup.
- All clients receive all socket messages; non-GM clients ignore `baphTaskResolveAdjudicate`.
- Single-GM campaign model: exactly one GM client processes each request. Multi-GM authority election is not implemented (unchanged from prior milestones).

### Aid Another / Bonus Support

No Aid Another or pending bonus mechanism exists in the current module architecture. `actor.rollSkill(skillKey, { skipDialog: true })` rolls the base skill with no situational modifier dialog. Aid Another support is deferred to a future milestone.

---

## v2.17.1 — Continue Task Button + Cache Sync

### Continue Task Button

The widget now includes a **Continue Task** button when:
- The active task is `status: 'active'` and `readyToResolve: false`
- The current user can control the active combatant (`_canUserControlCombatant`)

Button click flow:
1. `game.baphometTasks.commitAction(combatant, taskId)` is called (async)
2. `commitAction` enforces all 9 existing gates (including action spend + same-round guard)
3. On success: `_renderActionPanel()` is called → widget re-renders with fresh data
4. On failure: `ui.notifications.warn(...)` + `_renderActionPanel()` to reset state

Spending is handled by `commitAction` → `_spendActionForCombatant()` — the same path as direct API calls. No new action-spend logic was introduced.

### Cross-Client Cache Sync (`updateActor` hook)

Added `Hooks.on('updateActor', ...)` in `task-tracker.js`. When actor task flags are updated by `actor.setFlag()` (called internally by `commitAction`), Foundry propagates `updateActor` to all connected clients.

On each client:
1. Hook checks for baphomet-utils flag changes — fast bail for all other actor updates
2. Finds the combatant for the updated actor in the current combat
3. Rebuilds that combatant's `_baphTaskCache` entry from the now-authoritative live actor data
4. Calls `_renderActionPanel()` → widget re-renders with fresh progress

This ensures that a GM continuing a task for an NPC, or a player continuing their own task, is visible to everyone immediately — no turn advance, no page reload required.

### Known Limitation: Same-Round Guard is UX-visible

`commitAction` enforces a same-round guard (Gate 8): a player cannot commit twice in the same round. If they click Continue Task after already committing, the button stays visible but the action fails with a notification. The button is not disabled between attempts because disabling it would require storing per-round click state that is not currently maintained in the widget lifecycle. This is acceptable; the notification is clear.

### Follow-Up Milestone

Resolution workflow is not implemented. `resolveTask` remains a stub (logged only). Disable Device resolution, success/failure outcomes, and trap trigger logic are future work.

---

## v2.17.0 — Read-Only Task Progress Widget

Read-only task display near the floating action panel. Display-only; no interaction added.

### Widget Behavior

- Widget appears during active combat when the active combatant has at least one task with `status === 'active'`.
- Shows the **first** active task found (by `Object.values(tasks).find`). If multiple active tasks exist, only the first is displayed. Multi-task display is future work.
- Widget disappears automatically when the combatant changes, combat ends, or the active task is no longer active.
- Widget is visible to **all users** (not just the combatant controller) — it reads only public actor flag data.

### Hidden Data Protection

The widget reads task data via `game.baphometTasks.getTasks(combatant)` which applies `_baphTaskSanitize()` for non-GM clients. `roundsRequired` and `metadataHidden` are never present in the data the widget receives. The widget never reads actor flags directly.

Player-safe display format:
- Default: `Progress: N committed` (N = `roundsCommitted`)
- When `readyToResolve` is true: `Ready to resolve`
- No fraction display (e.g. no `2 / 4`) — that would imply knowledge of `roundsRequired`.

### Refresh Lifecycle

The widget piggybacks on the existing action panel lifecycle:
- `renderCombatTracker` → `_renderActionPanel()` → `_renderTaskWidget()`
- `updateCombat` → `_renderActionPanel()` → `_renderTaskWidget()`
- `combatStart` → `_renderActionPanel()` → `_renderTaskWidget()`
- `deleteCombat` → `_removeActionPanel()` + `_removeTaskWidget()` (explicit)
- `ready` → `_renderActionPanel()` → `_renderTaskWidget()`

No `updateActor` listener added. If a task is committed via the API and the combat tracker does not re-render, the widget will not update until the next panel lifecycle event. Full cache sync is deferred to v2.17.1.

### Follow-Up Milestone

```
v2.17.1 — Continue Task Button + Cache Sync
```

That milestone adds the Continue Task button to the widget and wires the `updateActor` listener so the widget refreshes immediately when task state changes via the API.

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
