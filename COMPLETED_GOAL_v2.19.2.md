# GOAL_v2.19.2.md

# v2.19.2 — Pip Flag Write Authority

## Milestone Identity

```text
Version: v2.19.2
Title: Pip Flag Write Authority
Repository: baphomet-utils
```

**Status:** Active implementation goal

---

# Purpose

`v2.19.1` moved PF1.5 action pip state from a client-local `Map` to shared Combatant flag storage:

```text
flags.baphomet-utils.pipState
```

This was the correct architectural direction and enabled cross-client pip synchronization.

However, local two-client Foundry testing revealed a multiplayer authority bug:

```text
User [player] lacks permission to update Combatant [...]
baphomet-utils | _writePipFlag error: Error: User [...] lacks permission to update Combatant [...]
```

These errors occur when a non-GM client runs turn-reset logic for a combatant it cannot modify, most visibly for GM-owned NPC combatants.

An Opus forensic audit confirmed:

- The pip-sync architecture remains valid.
- The actual problem is narrowly scoped:
  - `_maybeResetForNewTurn()` runs on every client during `renderCombatTracker`.
  - It calls `_writePipFlag(combatantId)`.
  - `_writePipFlag()` currently attempts `combatant.setFlag(...)` without first checking whether the current user can update that Combatant document.
- GM clients successfully write the same reset, so sync still works, but non-GM failed writes pollute the console and obscure real errors.

This milestone adds the missing write-authority guard.

---

# Authoritative Audit Finding

From the forensic audit:

> Combatant flags remain the right storage model.  
> The fix is to gate `_writePipFlag` on document update permission so non-authorized clients silently no-op instead of attempting invalid Combatant updates.

The audit recommended adding an update-permission check equivalent to:

```javascript
if (!combatant.canUserModify(game.user, 'update')) return;
```

Claude must verify the exact API against repo-local Foundry v13 documentation before implementation. The audit states `canUserModify(user, action)` is confirmed locally, but repo-local docs remain the source of truth.

---

# Goal

Prevent unauthorized non-GM clients from attempting to write Combatant pip-state flags they do not have permission to update, without changing pip-sync behavior for authorized clients.

At completion:

- `_writePipFlag(...)` no longer emits permission errors when a non-GM player client observes GM-owned NPC turn resets.
- GM clients continue persisting reset state for all active combatants as before.
- Player-owned combatants still persist their own action/reaction pip spends and resets correctly where permission allows.
- Cross-client pip sync from `v2.19.1` remains intact.

---

# Required Functional Behavior

## 1. Add authority gate to `_writePipFlag`

Inspect:

```text
scripts/action-tracker.js
```

and update `_writePipFlag(combatantId)` so it exits early when the current user cannot update the target Combatant document.

### Required logic shape

After:
- resolving `state`,
- resolving `combatant`,
- confirming both exist,

add a permission/write-authority gate.

Conceptually:

```javascript
if (!combatant.canUserModify(game.user, 'update')) return;
```

or the repo-confirmed equivalent.

### Important
- Do not log an error for this expected no-op.
- Do not emit a warning notification.
- The absence of permission here is normal on a player client viewing NPC turn resets.

---

## 2. Preserve all existing write paths

Do not remove existing `_writePipFlag(...)` call sites unless absolutely necessary.

The forensic audit identified five current call sites:

- `_togglePip`
- `game.baphometActions.reset`
- `game.baphometActions.spendAction`
- `game.baphometActions.spendReaction`
- `_maybeResetForNewTurn`

These can remain as-is because the write gate belongs at the shared write helper.

---

## 3. Preserve cross-client pip synchronization

Do not alter:

- Combatant flag storage model
- `PIP_FLAG_KEY`
- `updateCombatant` refresh hook
- pip-state hydration logic
- local `pipState` read-through cache model
- action/reaction pip semantics

This is a permission guard patch, not a pip-sync redesign.

---

# Explicit Non-Goals

Do **NOT** implement:

- task readiness sockets,
- player-side task fixes,
- new settings,
- new pip sync architecture,
- action economy rule changes,
- actor-flag fallback storage,
- socket-based pip write relay,
- UI label changes,
- any unrelated task-system edits.

Those belong to separate work.

---

# Allowed File Touch List

Implementation should remain narrow.

```text
scripts/action-tracker.js
module.json
README.md
DEV_NOTES.md
SERVER_TESTING_CHECKLIST.md
RUNTIME_VERIFICATION_REQUIRED.md
GOAL_v2.19.2.md
COMPLETED_GOAL_v2.20.0.md
```

The active goal currently present may be:

```text
GOAL_v2.20.0.md
```

or an earlier in-progress goal, depending on repository state.

Do **not** archive or rename a partially runtime-failed v2.20.0 goal unless repo convention and Michael’s existing files clearly indicate how this correction branch is being tracked. If the validator requires exactly one active `GOAL_*.md`, preserve historical clarity and explain any goal-file renames explicitly in the delivery report.

---

# Versioning

Update module version to:

```text
2.19.2
```

This is intentionally a correction patch to the `v2.19.x` pip-sync line, even though `v2.20.0` work exists locally and requires its own later correction milestone.

If repository versioning state makes a literal rollback from `2.20.0` undesirable or inconsistent, stop and report the versioning conflict before changing version numbers. Do not silently invent a branch/reversion strategy.

---

# Validation Requirements

Run:

```bash
node tools/validate.mjs --incremental
```

Then:

```bash
node tools/validate.mjs
```

Report exact pass / warn / fail counts.

---

# Required Runtime Verification Checklist

Update `SERVER_TESTING_CHECKLIST.md` for this milestone.

## A. Player client no longer logs Combatant write permission errors
1. Open Foundry as GM and as a non-GM player.
2. Start combat with:
   - one player-owned PC,
   - one GM-owned NPC.
3. Advance to the GM-owned NPC’s turn.
4. Confirm the player console does **not** show:
   - `User lacks permission to update Combatant`
   - `_writePipFlag error`

## B. NPC pip reset still syncs
1. On the NPC turn, confirm the GM client still resets the NPC action pips.
2. Confirm the player client’s visible panel reflects the reset through normal cross-client sync, if the NPC panel is visible in that client context.

## C. Player-owned combatant reset still syncs
1. Advance to the player-owned PC’s turn.
2. Confirm:
   - player-side pips reset correctly,
   - GM-side pips sync correctly,
   - no permission errors occur.

## D. Player action spends still sync
1. On the player-owned PC’s turn:
   - Spend 1 action,
   - Spend 2 actions if testable,
   - Spend a reaction if present.
2. Confirm the GM client updates to match.

## E. General regression
Confirm still working:
- manual pip toggles,
- task-driven action spends if exercised,
- Full Attack suppression,
- no new `baphomet-utils` console errors.

---

# Required Delivery Report

At completion, return:

## 1. Overall result
- Completed / Partially completed / Blocked

## 2. Files changed
- Exact file list
- Any goal-file rename/archive behavior and why

## 3. Root-cause correction summary
- Why non-GM clients were attempting invalid Combatant writes
- What authority gate was added
- Which repo-confirmed Foundry API was used

## 4. Behavioral confirmation
- Authorized writes still happen
- Unauthorized writes now silently no-op
- Cross-client pip sync architecture remains unchanged

## 5. Scope discipline
- Confirm no task readiness code changed
- Confirm no settings changed
- Confirm no unrelated action economy logic changed

## 6. Validator result
- exact commands run
- exact pass / warn / fail counts

## 7. Runtime checklist
- paste the updated checklist Michael should run

## 8. Known limitations / follow-up
- Note that player task readiness remains a separate `v2.20.1` correction milestone.

---

# Done Definition

This milestone is complete when:

- `_writePipFlag(...)` is permission-gated,
- non-GM clients no longer spam Combatant-update permission errors on NPC turn resets,
- authorized Combatant pip-state writes continue functioning,
- cross-client pip sync remains intact,
- validators pass,
- delivery report is complete.
