# GOAL_v2.17.0.md — Read-Only Task Progress Widget

## Milestone Identity

```text
Version: v2.17.0
Title: Read-Only Task Progress Widget
Repository: baphomet-utils
```

This milestone builds the **first player-visible UI surface** for the existing PF1.5 Multi-Round Task scaffold.

The existing task subsystem from `v2.16.0` is API-only. This milestone adds a **read-only display** showing the current active combatant’s open task progress near the existing floating action panel.

This milestone does **not** add a Continue Task button, task writes from the UI, Disable Device automation, or resolution behavior.

---

# Required Pre-Read

Before planning or editing, read these files end-to-end:

```text
CLAUDE.md
```

## PF1.5 mechanics

```text
docs/reference/pf1.5/PF1.5_Module_Mechanics_Reference.md
docs/reference/pf1.5/PF1.5_Combat_Skill_Action_Costs.md
docs/reference/pf1.5/house-rules-and-aesthetic.md
```

## Foundry / PF1 API safety

```text
docs/reference/foundry-v13/00_READ_FIRST_Foundry_v13_API_Safety_and_Migration.md
docs/reference/foundry-v13/99_Combined_Foundry_v13_PF1_[KnowledgeFiles.md].md
docs/reference/foundry-v13/foundry-and-pf1.md
```

## Existing module implementation

Read the relevant current source:

```text
scripts/action-tracker.js
scripts/task-tracker.js
styles/action-tracker.css
module.json
README.md
DEV_NOTES.md
```

---

# Current Verified Starting State

The current live/tested module version is:

```text
v2.16.0 — Multi-Round Task Scaffold
```

Verified behaviors already present:

- Floating action panel works.
- Spend 1 / Spend 2 / Spend 3 work.
- Spend 3 label reads:
  ```text
  F.Cast / Run
  ```
- Approved skill auto-spend works.
- Disable Device does not auto-spend and instead warns that PF1.5 multi-round task handling applies.
- PF1 Full Attack is hidden in `AttackDialog` while PF1.5 Mode is enabled.
- `game.baphometTasks` API exists.
- Multi-round tasks can be created, committed, paused, resumed, abandoned.
- Task action commitment spends exactly 1 action.
- Same-round double commitment is blocked.
- `readyToResolve` becomes true once hidden required rounds are met.
- Active tasks pause on combat deletion with:
  ```text
  pausedReason: "combat-ended"
  ```
- Public actor task flags do not leak hidden metadata or required duration.

---

# Milestone Goal

Add a **read-only task progress widget** that displays the active combatant’s current task state during combat.

The widget should make task progress visible at a glance without allowing any task interaction yet.

---

# Core Functional Requirements

## 1. Widget Visibility

The widget should appear only when all of the following are true:

1. There is an active combat encounter.
2. There is a current active combatant.
3. That combatant has at least one task that is:
   ```text
   status: "active"
   ```
   or, if explicitly justified in code/comments, a task that is active-like and useful to display.

If there is no displayable task, the widget should not be visible.

---

## 2. Which Task to Display

For `v2.17.0`, display **one task only**.

Preferred selection rule:

```text
Display the first active task returned for the current active combatant.
```

Do not build a task picker, multi-task stack, dropdown, carousel, or expandable list.

If multiple active tasks exist, this is a future UI problem. For this milestone, pick one deterministically and document that limitation.

---

## 3. Task Information Shown

The widget should show:

```text
Task label/name
Progress indicator
Status note if ready to resolve
```

Recommended data:

```text
taskName
roundsCommitted
readyToResolve
```

### Hidden duration protection

Do **not** expose hidden round requirements to players if those values are not public task data.

This milestone must not leak:

```text
roundsRequired
metadataHidden
GM-only trap/task details
```

### Display guidance

Because `roundsRequired` is hidden, the player-facing display should not assume it can render:

```text
2 / 4
```

unless the code is operating in a GM-only-safe merged read path and the design explicitly handles player/non-player differences.

Preferred player-safe default:

```text
Progress: 2 committed
```

If the task is ready to resolve:

```text
Ready to resolve
```

or a similarly concise phrase.

A GM may see richer output only if this is already safely available through existing task API reads and can be implemented without hidden-data leaks. If uncertain, use the player-safe display for everyone in this milestone.

---

## 4. Widget Placement

The widget should visually associate with the existing floating action panel.

Preferred behavior:

```text
Render adjacent to or directly above the floating action panel.
```

It should not:

- block existing Spend 1 / 2 / 3 buttons
- overlap the combat tracker
- obscure major Foundry UI controls
- require repositioning the whole action panel unless absolutely necessary

If the existing action panel has a natural extension container, use it.

---

## 5. Widget Styling

The widget must follow Croaker’s Ledger design language.

Use or extend existing action panel styling patterns where possible.

### Visual style

- muted parchment / leather / brass aesthetic
- high-readability dark text
- compact tactical presentation
- no neon
- no glow
- no glossy sci-fi paneling
- no glassmorphism

### CSS discipline

Prefer existing:

```text
--baph-*
```

custom properties if available.

Do not introduce arbitrary raw hex values unless necessary and documented.

---

## 6. Render / Refresh Behavior

The widget should update when the relevant displayed task state may change.

At minimum, refresh when:

- combat turn changes
- combat round changes if already handled in the same render pathway
- the action panel is rendered/refreshed
- task state changes through existing task API writes, if a safe existing signal/path is already available without creating a new synchronization subsystem

### Important limitation

Do **not** add the full cross-client `updateActor` cache sync system in this milestone unless it is absolutely required for the widget to render correct same-client state and is explicitly justified in the delivery report.

The planned future milestone remains:

```text
v2.17.1 — Continue Task Button + Cache Sync
```

So `v2.17.0` should stay read-only and conservative.

---

# Explicit Non-Goals

Do **not** implement any of the following in this milestone:

## No task interaction

- No Continue Task button
- No Commit Task button
- No Pause button
- No Resume button
- No Abandon button
- No Resolve button

## No Disable Device integration

- Do not intercept Disable Device rolls.
- Do not auto-create Disable Device tasks.
- Do not replace the current Disable Device warning.
- Do not roll Disable Device at completion.

## No task resolution work

- Do not implement `resolveTask`.
- Do not create task-completion chat cards.
- Do not create hidden DC resolution workflows.

## No new mechanic automation

- No MAP / swing tracking
- No attack auto-spend
- No reaction/AoO automation
- No movement automation
- No Background Skills work

## No architecture drift

- No ESM migration
- No PF1 prototype patching
- No `pf1.config` mutation
- No unrelated settings cleanup
- No unrelated condition-overlay edits
- No unrelated action panel spend logic changes

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
_goal_aborted.md
```

If a file outside this list appears necessary:

```text
STOP and ask Michael before touching it.
```

---

# Versioning

This milestone must update:

```text
module.json
```

from:

```text
2.16.0
```

to:

```text
2.17.0
```

Update release notes in:

```text
README.md
DEV_NOTES.md
```

Use release title:

```text
v2.17.0 — Read-Only Task Progress Widget
```

Do not invent a different title.

---

# Implementation Guidance

This is guidance, not a forced architecture. Follow existing code patterns unless the reference docs or current code show a better safe route.

## Likely approach

The widget may be implemented as an extension to the existing action panel render logic, because it should visually associate with that panel and follow its lifecycle.

Likely work areas:

```text
scripts/action-tracker.js
styles/action-tracker.css
```

The task read may use the existing task scaffold API or task helpers from:

```text
scripts/task-tracker.js
```

However:

- do not mutate task state from the widget
- do not bypass hidden-data sanitization rules
- do not read GM-hidden flag data directly from UI code unless already exposed safely and intentionally

## Preferred display examples

Not exact copy requirements, but acceptable patterns:

```text
Task
Disable Test Lock
Progress: 1 committed
```

or:

```text
Task: Disable Test Lock
1 round committed
```

If ready:

```text
Task: Disable Test Lock
Ready to resolve
```

Keep it compact.

---

# Expected Documentation Updates

## README.md

Add a changelog entry for:

```text
v2.17.0 — Read-Only Task Progress Widget
```

Mention:

- read-only current-task display added near action panel
- displays current active combatant task progress
- no Continue Task button yet
- no Disable Device automation yet

## DEV_NOTES.md

Document:

- widget is display-only
- one task shown at a time
- hidden round requirements are not exposed in the UI
- expected future milestone:
  ```text
  v2.17.1 — Continue Task Button + Cache Sync
  ```

---

# Validation Requirements

Before claiming implementation candidate completion, run:

```text
node tools/validate.mjs
```

If validation fails:

1. correct in-scope issues
2. run again
3. do not present the work as complete until validator passes

---

# Required Completion Artifacts

Before `/goal` may consider the milestone complete, the transcript must show that:

1. `module.json` was updated to version `2.17.0`.
2. Only allowlisted files were edited.
3. `README.md` was updated with the exact v2.17.0 release title.
4. `DEV_NOTES.md` was updated with milestone notes.
5. `SERVER_TESTING_CHECKLIST.md` was created or updated for v2.17.0 runtime validation.
6. `RUNTIME_VERIFICATION_REQUIRED.md` was created.
7. `node tools/validate.mjs` completed successfully.
8. The delivery report explicitly says runtime verification is still required.
9. No forbidden scope items were implemented.

---

# Required Runtime Testing Checklist Content

Create or update:

```text
SERVER_TESTING_CHECKLIST.md
```

for this milestone.

It must include local Foundry runtime test steps for at least:

1. Confirm module reports version `2.17.0`.
2. Confirm existing action panel still appears.
3. Confirm no task widget appears when the active combatant has no active task.
4. Create a test task via `game.baphometTasks.createTask(...)`.
5. Confirm widget appears for the active combatant.
6. Confirm widget displays the task name.
7. Confirm widget shows committed progress without leaking hidden metadata.
8. Commit one task action through the API.
9. Confirm displayed progress updates appropriately after the commit or after the documented refresh trigger.
10. Advance to another combatant and confirm widget disappears or changes appropriately.
11. Return to the task owner and confirm the widget returns.
12. Confirm a task marked ready to resolve displays the ready state, if supported by implementation.
13. Confirm Spend 1 / Spend 2 / Spend 3 buttons still work.
14. Confirm Disable Device warning behavior remains unchanged.
15. Confirm Full Attack suppression remains unchanged.
16. Confirm no new console errors attributable to `baphomet-utils`.

---

# Runtime Sentinel File

Create:

```text
RUNTIME_VERIFICATION_REQUIRED.md
```

with content stating:

- v2.17.0 implementation candidate is prepared
- runtime testing in local Foundry is required
- Michael must execute `SERVER_TESTING_CHECKLIST.md`
- do not tag, deploy, or proceed to the next milestone until the checklist is complete

---

# Goal Turn Cap

Maximum autonomous turn budget:

```text
40 turns
```

If the work is not complete within 40 turns:

1. stop
2. create:
   ```text
   _goal_aborted.md
   ```
3. summarize:
   - work completed
   - work remaining
   - blocker
   - exact recommended next step

---

# Required Delivery Report

When finished, report:

1. Goal/version implemented.
2. Files changed.
3. Confirmation all changes stayed inside the allowlist.
4. Reference docs consulted.
5. Key implementation decisions.
6. How hidden task data was kept private.
7. Explicitly untouched systems.
8. Validator result.
9. Runtime verification status.
10. Support files created:
    - `SERVER_TESTING_CHECKLIST.md`
    - `RUNTIME_VERIFICATION_REQUIRED.md`
    - `_goal_aborted.md` if applicable
11. Follow-up docket items, if any.

---

# Final Reminder

This milestone produces a **candidate implementation**, not a runtime-verified release.

Success condition:

```text
A scoped v2.17.0 candidate exists, docs are updated, validator passes,
runtime checklist exists, runtime sentinel exists, and no out-of-scope work occurred.
```

It is **not** complete in the practical release sense until Michael validates it in local Foundry.