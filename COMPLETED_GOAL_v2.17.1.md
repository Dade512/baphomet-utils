# v2.17.1 — Continue Task Button + Cache Sync

## Milestone Identity

```text
Version: v2.17.1
Title: Continue Task Button + Cache Sync
Repository: baphomet-utils
```

## Milestone Summary

`v2.17.0 — Read-Only Task Progress Widget` has been completed and runtime-verified locally in the `Echoes Dev Sandbox`.

The task widget currently:

- Appears near the existing PF1.5 action panel
- Displays the active combatant’s current active task
- Shows public-safe progress as:
  - `Progress: N committed`
  - `Ready to resolve`
- Uses the existing public task access path rather than directly exposing hidden task flags
- Disappears/reappears correctly as combat turns change
- Removes itself when combat is deleted
- Passed local runtime regression checks for existing action buttons and PF1.5 automation behavior

This milestone advances that read-only widget into a small interactive control surface.

---

# Goal

Implement:

## 1. A `Continue Task` button in the existing task progress widget

When the active combatant has an unresolved active task, the widget should include a clearly readable:

```text
Continue Task
```

button.

Clicking the button should:

1. Spend exactly **1 PF1.5 action**
2. Commit exactly **1 unit of progress** to the active task
3. Refresh the widget immediately so the player sees the new progress state
4. Preserve all existing task metadata/privacy rules

---

## 2. Widget refresh / cache-sync hardening

The widget should stay accurate after a task continuation event.

This milestone must account for:

### Same-client refresh
The client who clicks `Continue Task` should see the widget update immediately without requiring:
- manual rerender,
- turn advance,
- closing/reopening combat UI,
- or reloading Foundry.

### Cross-client refresh
Other connected clients should not remain visibly stale after the task progress changes.

Use the repo’s existing architecture and confirmed update/signaling patterns. Do not invent a new socket or document-sync framework unless the current codebase makes that clearly necessary.

### Turn-switch persistence
After continuing a task:
- advancing away from the combatant should hide the widget as before,
- returning to that combatant should restore the updated task progress accurately.

---

# Core Behavior Requirements

## Button visibility

### Show `Continue Task` when:
- There is an active combat
- There is an active combatant
- The active combatant has an active unresolved task
- The task is not already in the existing `Ready to resolve` state

### Do NOT show `Continue Task` when:
- No combat is active
- No active combatant exists
- The active combatant has no task
- The current task is already `Ready to resolve`
- The widget itself is not shown

---

## Continue behavior

Use the existing task/action infrastructure already present in the repo.

The implementation must:

- Spend **1** action and no more
- Refuse to continue the task if the actor cannot spend 1 action
- Preserve the existing action failure behavior and warnings where applicable
- Increment progress once per successful click
- Avoid accidental double-spend / double-commit from one click
- Leave the task unresolved if it is not yet complete
- Transition the widget to the existing `Ready to resolve` display when the continuation causes the threshold to be reached

---

# Explicit Non-Goals

Do **NOT** implement any of the following in this milestone:

- No actual Disable Device / Survival / Heal task resolution rolls
- No success/failure outcome handling
- No trap trigger logic
- No `Resolve Task` button unless it already exists and only requires a required minimal integration change
- No task abandonment UI
- No new multi-round task creation workflow
- No GM setup/config screen
- No unrelated refactors of the task system or action tracker
- No unrelated UI redesign of the action panel

This milestone is strictly:

> **Continue the current task from the widget, spend 1 action, update progress, keep the widget synchronized.**

---

# PF1.5 Mechanical Requirements

The implementation must preserve the established multi-round task rule:

- A character commits **1 action per round** to continue working on an active multi-round task
- The progress state persists across turns and interruptions
- Progress completion does not itself resolve the skill check during this milestone
- Once progress is complete, the widget should display the already-established:
  - `Ready to resolve`

The implementation must not reintroduce any PF1 standard/move/full-round assumptions.

---

# Runtime Safety Requirements

- Do not leak hidden task duration or protected metadata to players
- Continue using the existing public-safe task read path for widget rendering
- Do not directly expose internal flags in the widget
- Do not break current 2.17.0 widget behavior
- Do not break:
  - Spend 1 / Spend 2 / Spend 3 action buttons
  - Disable Device warning behavior
  - Full Attack suppression in PF1.5 mode
  - Existing combat-turn widget appearance/disappearance behavior

---

# API / Architecture Rules

Follow `CLAUDE.md` and repo-local reference docs.

Especially:

- Do not invent Foundry v13 or PF1 APIs
- Do not use unconfirmed APIs unless the repo already uses them and they are being preserved as existing behavior
- Prefer existing module-owned public helper APIs and existing update paths
- Use the currently established task system instead of duplicating task state logic in the widget
- Preserve runtime-truth boundaries established in prior milestones
- Keep changes narrowly scoped to this milestone

---

# Expected Files Likely In Scope

Claude should inspect the repo and use judgment, but this milestone is expected to primarily touch some subset of:

- `scripts/action-tracker.js`
- Existing task-system script file(s), only if needed to expose or reuse a safe continuation path
- `styles/action-tracker.css`
- `module.json`
- `README.md`
- `DEV_NOTES.md`
- `SERVER_TESTING_CHECKLIST.md`
- `RUNTIME_VERIFICATION_REQUIRED.md`

Do not edit files outside the active milestone unless absolutely necessary. If a needed file is outside this likely list, explain why before proceeding.

---

# UI / Croaker’s Ledger Requirements

The new button should visually belong to the current task widget and existing Croaker’s Ledger styling.

Requirements:

- Readable immediately during combat
- No flashy modern styling
- No neon, no white-glow UI treatment, no glossy game-button aesthetic
- Use existing ledger/parchment/brass styling conventions
- Button label should remain direct and practical:
  - `Continue Task`
- Maintain high contrast and obvious clickability
- Do not make the widget materially larger or visually noisy unless necessary for usability

---

# Allowed File Touch List

Claude Code may edit **only** the following files for this milestone:

```text
module.json
scripts/action-tracker.js
scripts/task-tracker.js
styles/action-tracker.css
README.md
DEV_NOTES.md
SERVER_TESTING_CHECKLIST.md
RUNTIME_VERIFICATION_REQUIRED.md
GOAL_v2.17.1.md
COMPLETED_GOAL_v2.17.0.md
```

---

# Validation Requirements

Run:

```bash
node tools/validate.mjs --incremental
```

Then run the full validator if the incremental pass indicates that is appropriate:

```bash
node tools/validate.mjs
```

Report pass/warn/fail counts exactly.

---

# Required Runtime Verification Checklist

After implementation, Michael will verify in local Foundry. The delivery report must include a checklist for these tests:

## A. Basic button appearance
1. Enter combat with no active task:
   - No task widget or no Continue button, depending on current widget behavior
2. Create an active task for the active combatant:
   - Widget appears
   - `Continue Task` button appears

## B. Successful continuation
1. Click `Continue Task`
2. Confirm:
   - Exactly 1 action is spent
   - Progress increments by exactly 1
   - Widget updates immediately
   - No console error from `baphomet-utils`

## C. No-action failure
1. Reduce available actions to 0
2. Click `Continue Task`
3. Confirm:
   - Task progress does not increment
   - Action state does not change incorrectly
   - Existing warning/failure behavior appears

## D. Turn-switch persistence
1. Continue task once
2. Advance combat away from the task owner
3. Confirm widget disappears
4. Return combat to the task owner
5. Confirm:
   - Widget reappears
   - Updated progress is preserved

## E. Ready-to-resolve transition
1. Continue the task until completion threshold is reached
2. Confirm:
   - Widget changes to `Ready to resolve`
   - `Continue Task` button no longer appears
   - No resolution roll fires yet

## F. Regression pass
Confirm still working:
- Spend 1 / Spend 2 / Spend 3 action buttons
- Disable Device warning behavior
- Full Attack suppression in PF1.5 mode
- Existing task widget appearance/disappearance behavior
- No new `baphomet-utils` console errors

---

# Required Claude Delivery Report

At completion, return:

## 1. Milestone result
- Completed / Partially completed / Blocked

## 2. Files changed
- Exact file list

## 3. Implementation summary
- What the Continue Task button does
- How progress is committed
- How immediate refresh is handled
- How cross-client / stale-cache concerns were addressed

## 4. Scope discipline
- Confirm non-goals were not implemented
- Confirm no unrelated refactor was performed

## 5. Validator result
- Exact command(s) run
- Exact pass / warn / fail counts

## 6. Runtime verification required
- Paste the checklist Michael should run in Foundry

## 7. Known limitations or follow-up notes
- Especially anything that should be deferred to:
  - `v2.17.2`
  - or the eventual task-resolution milestone

---

# Done Definition

This milestone is complete when:

- The active task widget shows a working `Continue Task` button for unresolved tasks
- Clicking it spends exactly 1 action and commits exactly 1 progress unit
- The widget refreshes immediately and does not visibly stale out
- It cleanly transitions to `Ready to resolve`
- It preserves all current privacy/UI/task-system guarantees
- Validation passes
- Claude provides a clean runtime test checklist for Michael
