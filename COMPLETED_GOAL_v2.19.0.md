# GOAL_v2.19.0.md

# v2.19.0 — Task Initiation UI + GM Task Builder

## Milestone Identity

```text
Version: v2.19.0
Title: Task Initiation UI + GM Task Builder
Repository: baphomet-utils
```

**Module:** `baphomet-utils`  
**Status:** Active implementation goal

---

# Purpose

The multi-round task subsystem is now functionally complete from the middle of the lifecycle onward:

- Continue Task
- Aid Task
- Ready-to-resolve transition
- Resolve Task
- success / minor failure / catastrophic failure adjudication
- Abandon Task
- player/GM socket authority for cross-client/private adjudication
- pending Aid bonus banking and consumption

What is still missing is the **front door**:

> a table-usable, rules-correct way for the GM to initiate a supported multi-round task during live combat without using developer console helpers.

This milestone implements that front door.

---

# Canonical Rules Basis

The authoritative `Multi-Round Task Pattern — Complete Specification` establishes:

- A multi-round task begins when the player declares the task and commits **1 action**.
- The GM or task source sets `roundsRequired`, typically:
  - **1d4** for a simple trap-style task,
  - **2d4** for a difficult trap-style task,
  - or a GM-set manual value.
- The initial commitment is part of the task’s work requirement.
- Once committed work reaches `roundsRequired`, the task becomes **Ready to resolve**.
- Standard mundane locks remain **single-action Disable Device checks**, not multi-round tasks.
- Trap-style operations such as disable / arm / sabotage / jury-rig use the task scaffold.

This milestone must align the implementation with that rule flow.

---

# Current Verified Baseline

As of locally verified `v2.18.1`, the module supports:

- active multi-round task state,
- public-safe task widget rendering,
- hidden rounds/DC handling,
- Continue Task,
- Aid Task during both active and ready stages,
- DC 10 Aid Another checks,
- queued successful Aid bonuses,
- Resolve Task with bonus application,
- Abandon Task,
- player/GM socket authority where hidden or cross-actor task writes require it,
- task state cleanup after Resolve/Abandon.

`v2.19.0` must preserve all of that.

---

# High-Level Goal

Implement a **GM-only combat task initiation workflow** for the **current active combatant**.

The result should allow the GM to:

1. Click a visible **Begin Task** / **Create Task** style control in the existing action/task HUD area when the active combatant has no unresolved task.
2. Complete a compact builder dialog for a supported multi-round Disable Device task.
3. Confirm creation.
4. Have the module:
   - validate the actor/combatant/task state,
   - spend exactly **1 PF1.5 action** from the task owner,
   - count that as the **first committed round** of task work,
   - create the task in flag state,
   - immediately render the correct widget state,
   - transition directly to **Ready to resolve** if the secret/manual rounds required threshold is already met.

---

# Milestone Scope

## In scope
- GM-only Begin/Create Task HUD control
- GM task builder dialog
- Supported multi-round Disable Device task initiation
- Initial 1-action spend
- Initial action counts as first committed work unit
- Secret/simple/difficult/manual rounds-required selection
- Hidden/public state handling
- Existing task lifecycle integration
- Docs/checklist/version bump

## Out of scope
- Player-side task builder
- Trap entity automation
- Trap source selection from scene objects
- Standard mundane lockpick UI
- automatic lock/single-action Disable Device workflow
- magical lock object integration
- Trapfinder / Quick Disable feature detection
- task templates beyond supported Disable Device multi-round task creation
- interruption-on-damage prompts
- GM active task dashboard
- cleanup/pruning timers
- new resolver types beyond the already supported Disable Device resolution path

---

# Core Design Decision

## Builder is GM-only for v2.19.0

The authoritative rules require GM knowledge for secret task duration and hidden DC management. Since no trap-entity configuration layer exists yet, the milestone should expose task creation to the GM only.

### Required behavior
- GM can see/use the initiation control.
- Non-GM players do not see or cannot activate this builder.
- The task itself remains player-visible afterward through the existing public-safe task widget once created.

---

# UX Placement

Add a compact GM-only initiation control in or near the existing combat action/task HUD surface.

Preferred visibility:

### Show the control when:
- combat is active,
- an active combatant exists,
- the current user is GM,
- the active combatant has no unresolved active task,
- the active combatant is otherwise a valid task owner.

### Hide or disable the control when:
- no combat exists,
- no active combatant exists,
- current user is not GM,
- the active combatant already has an unresolved active task,
- the widget/action panel context is not available.

Exact label may be:

```text
Begin Task
```

or

```text
Create Task
```

Choose the one that best fits existing module UX and document the final label.

---

# Builder Dialog — Required Inputs

The builder dialog should be compact and immediately usable during combat.

## Required fields

### 1. Task name
- Human-readable label, e.g.:
  - `Disable Poison Dart Trap`
  - `Rearm Needle Mechanism`
  - `Sabotage Trigger Plate`
- Required.
- Trim whitespace and reject blank names.

### 2. Task action / flavor
Supported preset values should align with the canonical task spec:

```text
disable
arm
sabotage
jury_rig
custom
```

This is flavor metadata only and must not alter core mechanics.

If `custom` is selected, the task name carries the table-facing flavor. No additional complex custom authoring UI is required.

### 3. Rounds required mode
Provide a clear GM selection such as:

```text
Simple — secret 1d4 rounds
Difficult — secret 2d4 rounds
Manual — GM enters exact rounds
```

Exact phrasing may vary, but the dialog must support:

- `1d4` secret roll,
- `2d4` secret roll,
- manual positive integer.

### 4. Resolution DC
- Numeric positive integer input.
- Required.
- Hidden from players using the existing hidden metadata/private adjudication path.

## Optional fields
Do **not** add optional fields unless the current repo architecture already supports them cleanly and they can be added without scope creep. In particular, avoid building a wide custom authoring form in this milestone.

---

# Supported Task Type Constraint

## v2.19.0 exposes only the already-supported Disable Device multi-round resolution path

The task system currently has a validated Disable Device resolver. Therefore the builder should create supported **Disable Device** multi-round tasks only.

### Required behavior
- Persist the appropriate existing `skillKey` / resolver metadata for Disable Device.
- Do not expose a free-form skill picker that can create unsupported task types.
- Do not expose Survival/Heal/custom resolver task creation yet.
- If an explicit skill display is included in the dialog, it should be fixed/read-only to Disable Device for this milestone.

---

# Critical Mechanical Requirement — Initiation Costs 1 Action

Task initiation must be rules-correct.

When the GM confirms the builder:

1. Validate active combatant and task owner.
2. Validate there is no unresolved active task already present.
3. Validate task configuration values.
4. Spend exactly **1 PF1.5 action** from the task owner.
5. If action spend fails:
   - no task should be created,
   - no hidden metadata should be written,
   - user should receive clear feedback.
6. If action spend succeeds:
   - create the task,
   - record the initial task work contribution.

## Initial progress rule

The creation event itself counts as the first committed round/work unit.

### Therefore:
- `roundsCommitted` (or equivalent progress representation) should begin at **1** for tasks created through the builder.
- If `roundsRequired <= 1`, the created task should immediately enter **Ready to resolve** state after creation.
- If `roundsRequired > 1`, the widget should appear in normal in-progress state, with public-safe progress reflecting that work has begun.

This is the most important mechanical difference between a production task-initiation flow and the earlier developer-console create-task helper behavior.

---

# Secret Duration Handling

For preset modes:

## Simple
- GM client rolls secret `1d4`.
- Actual rounds required is stored in hidden/private task state as existing architecture requires.
- Players do not see the rolled total.

## Difficult
- GM client rolls secret `2d4`.
- Actual rounds required is stored in hidden/private task state as existing architecture requires.
- Players do not see the rolled total.

## Manual
- GM enters an exact positive integer.
- It is treated as hidden/private duration data unless current public-task architecture already exposes only safe progress summaries.
- Do not reveal the target duration in player-facing UI.

If a chat message or notification confirms task creation, it must not reveal the hidden rolled/manual duration.

---

# Existing Task Conflict Handling

If the active combatant already has an unresolved active task:

- the initiation control should be hidden or disabled,
- the create handler must still defensively reject the request,
- the user should receive a concise warning such as:
  - `This combatant already has an active task.`

Do not add a confirmation wizard or automatic abandon-and-replace flow in this milestone.

---

# Public / Private Data Safety

Preserve current hidden-task privacy rules:

- Do not expose hidden rounds-required values to players.
- Do not expose resolution DC to players.
- Do not expose hidden metadata through sockets, UI text, or chat.
- Public-facing widget content should continue using the existing sanitized task read path.

The builder runs GM-side, but after task creation the usual player-facing lifecycle must behave exactly like existing runtime-verified tasks.

---

# Existing Lifecycle Integration

Tasks created through the builder must work immediately with:

- Continue Task
- Aid Task during active stage
- Aid Task during ready stage
- queued Aid display/application
- Resolve Task
- Abandon Task
- socket-mediated player actions
- success / minor failure / catastrophic failure classification
- cleanup behavior from prior milestones

No separate or special-case “builder-created task” lifecycle should exist.

---

# Chat / Notification Feedback

Use current module conventions.

On successful creation, surface concise confirmation that a task has begun, e.g.:

- actor begins the task,
- task name/action may be shown,
- hidden rounds/DC must not be shown.

If the module currently prefers notification rather than chat for some creation events, follow the existing pattern and document it.

On validation failures:
- show concise notification feedback,
- avoid chat spam.

---

# Dialog / Foundry API Rules

Follow `CLAUDE.md` and repo-local confirmed V13 references.

Especially:

- Do not invent Foundry v13 APIs.
- Do not use undocumented legacy dialog/application paths unless already repo-confirmed.
- Reuse established module UI patterns if any exist.
- If no repo-confirmed dialog/application pattern exists and the needed V13 API is not confirmed in project docs, stop and report the blocker rather than hallucinating an API.

---

# Allowed File Touch List

Claude may inspect any needed file, but implementation edits should stay focused.

Likely touched files:

```text
scripts/task-tracker.js
scripts/action-tracker.js
styles/action-tracker.css
module.json
README.md
DEV_NOTES.md
SERVER_TESTING_CHECKLIST.md
RUNTIME_VERIFICATION_REQUIRED.md
GOAL_v2.19.0.md
```

If an existing UI template file is already part of the module and is the correct place for the builder, Claude may touch it, but should explain why in the delivery report.

The prior active goal:

```text
GOAL_v2.18.1.md
```

may be archived/renamed if repo validator conventions require exactly one active goal file.

Report any rename explicitly.

---

# Versioning

Update the module version to:

```text
2.19.0
```

---

# Validation Requirements

Run:

```bash
node tools/validate.mjs --incremental
```

Then run:

```bash
node tools/validate.mjs
```

Report exact pass / warn / fail counts.

---

# Required Runtime Verification Checklist

Claude should refresh `SERVER_TESTING_CHECKLIST.md` for this milestone.

## A. GM-only initiation control visibility
1. Enter combat with an active combatant that has no unresolved task.
2. As GM, confirm the Begin/Create Task control appears.
3. As a non-GM player, confirm the control does not appear or cannot be used.

## B. Builder opens and validates fields
1. As GM, click the initiation control.
2. Confirm the builder opens.
3. Confirm blank task name is rejected.
4. Confirm missing/invalid DC is rejected.
5. Confirm invalid manual rounds value is rejected.

## C. Simple task creation — action spend + initial progress
1. Give active combatant at least 1 available action.
2. Create a Simple secret-duration task.
3. Confirm:
   - exactly 1 action is spent from the task owner,
   - task widget appears,
   - task is created with the correct visible player-safe display,
   - hidden duration is not revealed.

## D. Difficult task creation
1. Create a Difficult secret-duration task.
2. Confirm:
   - task creation succeeds,
   - exactly 1 action is spent,
   - task enters in-progress or ready state depending on the secret roll,
   - hidden duration is not revealed.

## E. Manual 1-round task immediately becomes ready
1. Create a Manual task with rounds required = 1.
2. Confirm:
   - exactly 1 action is spent,
   - task appears already in `Ready to resolve` state,
   - Resolve Task is available,
   - no Continue Task button appears incorrectly.

## F. Manual multi-round task starts with one committed work unit
1. Create a Manual task with rounds required = 3.
2. Confirm:
   - exactly 1 action is spent,
   - task appears in-progress,
   - visible public-safe progress indicates work has begun,
   - only two additional Continue actions are needed before Ready to resolve.

## G. Insufficient-action creation failure
1. Reduce the active combatant to 0 available actions.
2. Attempt to create a task.
3. Confirm:
   - no task is created,
   - no hidden metadata/task flags are written,
   - warning feedback appears.

## H. Existing active task conflict
1. Create a task.
2. While that task is unresolved, attempt to initiate another.
3. Confirm:
   - the Begin/Create Task control is hidden or disabled,
   - direct create handler defensively rejects the second task,
   - no task replacement occurs.

## I. Lifecycle integration regression
For a builder-created task, confirm:
- Continue Task works,
- Aid Task works during active stage,
- Aid Task works during ready stage,
- Resolve Task works,
- Abandon Task works,
- hidden DC/duration remain hidden to players.

## J. Resolution outcomes regression
For builder-created tasks, verify at least:
- one successful resolution,
- one minor failure,
- one catastrophic failure.

## K. Socket/privacy regression
If practical:
- non-GM player resolves or aids a builder-created task,
- GM-authorized socket path still adjudicates correctly,
- no hidden duration/DC leaks.

## L. General regression
Confirm still working:
- Spend 1 / Spend 2 / Spend 3,
- existing task widget turn-switch behavior,
- Full Attack suppression,
- standalone Disable Device warning behavior,
- no new `baphomet-utils` console errors.

---

# Required Delivery Report

At completion, Claude must return:

## 1. Overall result
- Completed / Partially completed / Blocked

## 2. Files changed
- Exact file list
- Note prior-goal archive/rename if performed

## 3. UI summary
- initiation control label and placement
- GM/non-GM visibility behavior
- builder dialog fields and validation

## 4. Task creation semantics
- how active combatant is resolved
- how existing active-task conflict is handled
- how initial 1-action spend is enforced
- how first committed work unit is recorded
- how Ready-to-resolve immediate transition works for 1-round tasks

## 5. Secret duration handling
- how 1d4 / 2d4 / manual modes work
- where actual rounds required are stored
- confirmation that players do not see hidden duration

## 6. Supported task scope
- confirmation builder creates supported Disable Device multi-round tasks only
- confirmation mundane lockpicking was not converted into task flow

## 7. Integration notes
- confirmation builder-created tasks use existing Continue/Aid/Resolve/Abandon lifecycle
- socket/privacy compatibility notes

## 8. Scope discipline
- confirm non-goals were not implemented
- confirm no broad task authoring/dashboard/trap automation was added

## 9. Validator result
- exact commands run
- exact pass / warn / fail counts

## 10. Runtime checklist
- paste the updated checklist Michael should run

## 11. Known limitations / follow-up notes
- anything deferred intentionally, especially:
  - player-side task initiation,
  - trap entity integration,
  - magical lock task modeling,
  - Quick Disable/Trapfinder,
  - interruption prompts,
  - dashboards/cleanup timers.

---

# Done Definition

This milestone is complete when:

- GM can initiate a supported multi-round Disable Device task from the combat UI.
- Non-GM players cannot use the builder.
- Task initiation spends exactly 1 action from the owner.
- That initial action counts as the first committed work unit.
- Secret 1d4, secret 2d4, and manual rounds-required modes all work.
- A manual 1-round task immediately becomes Ready to resolve.
- Existing active task conflicts are blocked safely.
- Builder-created tasks work with Continue, Aid, Resolve, and Abandon.
- Hidden rounds/DC remain protected.
- Module version is 2.19.0.
- Validators pass.
