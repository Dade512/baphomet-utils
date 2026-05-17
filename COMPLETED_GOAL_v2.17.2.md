# v2.17.2 — Resolve Task Button + Disable Device Resolution

## Milestone Identity

```text
Version: v2.17.2
Title: Resolve Task Button + Disable Device Resolution
Repository: baphomet-utils
```

---

# Context

`v2.17.0 — Read-Only Task Progress Widget` and `v2.17.1 — Continue Task Button + Cache Sync` have now been implemented and locally runtime-verified.

The task system currently supports:

1. Creating a multi-round combat task
2. Displaying the active combatant’s task in the widget
3. Spending **1 PF1.5 action** to **Continue Task**
4. Preserving progress across turns
5. Transitioning the widget to:

```text
Ready to resolve
```

once the required number of committed work actions has been reached.

This milestone implements the next deliberate step in the PF1.5 multi-round task loop:

> **Ready to resolve → player chooses Resolve Task → 1 action spent → skill check rolls → outcome categorized.**

---

# Homebrew Rule Decision Confirmed

For PF1.5 multi-round tasks, the resolution check is a **separate final action**, not an automatic side effect of the last `Continue Task` click.

## Required model

| Stage | Actor Choice | Cost | Module Result |
|---|---|---:|---|
| Task work | `Continue Task` | 1 action per committed round | Increments task progress |
| Threshold reached | automatic state change | 0 | Widget becomes `Ready to resolve` |
| Final resolution | `Resolve Task` | 1 action | Skill check rolls and result is classified |

### Design consequences

- Reaching `Ready to resolve` does **not** automatically roll the skill check.
- The player may tactically delay resolution.
- The Resolve step creates a clean window for buffs, Aid Another, repositioning, or GM adjudication before the actual roll.
- The final resolution click is its own **1-action commitment**.

---

# Goal

Implement:

## 1. `Resolve Task` button in the task progress widget

When the active combatant’s current task is already in the existing:

```text
Ready to resolve
```

state, the widget should show a clear:

```text
Resolve Task
```

button.

### Show `Resolve Task` when:
- Combat is active
- There is an active combatant
- The active combatant has a task in the existing ready-to-resolve state
- The task has not already been resolved or closed
- The current user passes the same control/permission rules already used for actionable task controls in the widget

### Do NOT show `Resolve Task` when:
- No active combat exists
- No active combatant exists
- The active combatant has no task
- The task is not ready to resolve
- The task is already resolved / closed
- The current user is not allowed to interact with the widget control

---

## 2. Resolve action cost and execution gate

Clicking `Resolve Task` should:

1. Spend exactly **1 PF1.5 action**
2. Refuse to resolve if the actor cannot spend 1 action
3. Refuse to resolve if the task is not ready
4. Refuse duplicate or invalid resolution attempts
5. Use existing task/action infrastructure instead of duplicating business logic in the widget
6. Refresh the widget immediately after the attempt succeeds or changes task state

### Resolution retry cadence

For this milestone, preserve a conservative combat cadence:

- A failed `Resolve Task` attempt should **not** allow repeated resolution attempts in the same combat round through repeated clicking.
- A task that remains unresolved after failure should remain in `Ready to resolve` state for a later legal resolution attempt.

Use the existing same-round guard pattern if one already exists in the task system; otherwise introduce the smallest milestone-local equivalent that fits the current architecture.

---

# 3. Disable Device resolution path — MVP

This milestone implements the first real task resolver for:

```text
Disable Device
```

Only Disable Device needs full behavior in this milestone.

## Required input data

Use the task system’s existing persisted task state and extend it only as necessary with **plain serializable data**, such as:

- a resolver type / resolution kind
- a resolution skill key
- a resolution DC, where already appropriate to the task model
- any other minimal primitive/object fields required to make resolution possible

### Important serialization rule

Do **NOT** store functions, class instances, closures, or executable handlers inside persisted task flag data.

If a generic dispatcher is needed, persist serializable resolver identifiers on the task and map those identifiers to code-owned handler functions in module code.

---

# 4. Resolution roll behavior

When `Resolve Task` is clicked for a ready Disable Device task:

1. Spend the Resolve action successfully
2. Roll the proper PF1 Disable Device skill check for the task owner
3. Compare the result against the task’s DC
4. Categorize the result into one of three outcomes:

| Outcome | Rule |
|---|---|
| Success | Total meets or exceeds DC |
| Minor failure | Total misses DC by 1–4 |
| Catastrophic failure | Total misses DC by 5 or more |

## Required post-roll task state

### Success
- Mark/close the task so it no longer remains active in the widget
- Produce clear chat feedback that the task succeeded
- Do not auto-trigger any unrelated downstream world automation unless already safely present and explicitly required by existing task architecture

### Minor failure
- Task remains available in `Ready to resolve`
- It may be retried on a later legal resolution attempt
- Produce clear chat feedback that the attempt failed without catastrophic consequence

### Catastrophic failure
- Task remains handled according to the Disable Device failure model selected by current task architecture
- For this milestone, **do not automate trap triggering**
- Produce clear chat feedback that this was a catastrophic failure and that the GM should adjudicate/apply the trap consequence manually where appropriate

---

# 5. Chat output and information safety

The resolution attempt should create concise, readable chat output for table use.

## Chat output should communicate:
- Actor/task context in a player-readable way
- That a Disable Device resolution attempt occurred
- The result category:
  - success
  - failure
  - catastrophic failure

## Privacy / hidden metadata rules
- Do not leak hidden task metadata through the widget or chat output
- Do not expose hidden duration data
- Do not expose the task DC publicly unless the current repo/task rules already intentionally make it public
- Respect the existing public-safe task read path and runtime-truth boundary from prior milestones

---

# 6. Generic resolver architecture — minimal spine only

This milestone should avoid hard-coding the entire future task system around one exact Disable Device branch if a small reusable resolver dispatch layer can be added cleanly.

## Preferred architecture
Use persisted serializable identifiers, for example conceptually:

- `resolutionKind`
- `resolutionSkillId`
- `resolutionDC`

Then use code-owned resolver handling in the module logic.

## Do NOT overbuild
This milestone does **not** require:
- Survival resolution
- Heal resolution
- Ritual interruption resolution
- Custom GM-defined resolver UIs
- Full generalized task authoring UI
- Generic consequence automation

The architectural goal is only:

> **Make Disable Device resolve correctly now without painting future task types into a corner.**

---

# 7. Aid Another / temporary bonus handling

The homebrew rule rationale preserves a tactical buff/Aid Another window before resolution.

For this milestone:

- If the repo already has a confirmed, reusable pending bonus or Aid Another mechanism that naturally applies to this roll path, preserve/use it.
- Do **not** invent a new Aid Another subsystem solely for this milestone.
- If no appropriate existing mechanism exists, document that as a deliberate follow-up note rather than adding unsupported architecture.

---

# Explicit Non-Goals

Do **NOT** implement any of the following in v2.17.2:

- No automatic task resolution on the last `Continue Task` click
- No auto-triggering trap effects or trap damage
- No trap entity/world integration unless already present and absolutely required for minimal task completion
- No `Abandon Task` button
- No broader task management UI
- No Survival / Heal / custom task resolution
- No full Aid Another subsystem
- No new generic consequence engine
- No unrelated refactor of the action tracker
- No unrelated refactor of the combat-task scaffold
- No GitHub/live-deploy workflow changes

---

# Runtime Safety Requirements

- Preserve current 2.17.0 and 2.17.1 widget behavior
- Preserve existing Continue Task behavior
- Preserve hidden-task privacy rules
- Preserve same-client immediate UI refresh behavior
- Preserve cross-client stale-cache protection already added in 2.17.1
- Do not break existing combat-turn hide/reappear behavior
- Do not break existing PF1.5 action button behavior
- Do not break Disable Device warning behavior already present elsewhere in the module
- Do not break Full Attack suppression in PF1.5 mode

---

# API / Architecture Rules

Follow `CLAUDE.md` and repo-local Foundry v13 / PF1 / PF1.5 references.

Especially:

- Do not invent Foundry v13 or PF1 APIs
- Do not use undocumented system paths without repo-local confirmation
- Prefer the existing action/task service layer over widget-local state changes
- Keep widget code thin; state transitions belong in the task system
- Use existing PF1/Foundry-safe roll/chat patterns already present in the repo where available
- Keep persistent task data serializable
- Preserve the module’s current runtime-truth boundaries

---

# Allowed File Touch List

Claude may inspect any files needed, but implementation edits should stay narrowly scoped.

```text
scripts/action-tracker.js
scripts/task-tracker.js
styles/action-tracker.css
module.json
README.md
DEV_NOTES.md
SERVER_TESTING_CHECKLIST.md
RUNTIME_VERIFICATION_REQUIRED.md
GOAL_v2.17.2.md
COMPLETED_GOAL_v2.17.1.md
```

The repo validator requires the previously active goal file to be renamed/archived:

If that rename is required by the existing validation workflow, it is permitted and should be reported clearly.

If Claude needs to edit any additional implementation file beyond this list, it must explain why in the delivery report.

---

# UI / Croaker’s Ledger Requirements

The Resolve control should visually match the existing task widget and Croaker’s Ledger styling.

- Label exactly:
  - `Resolve Task`
- High contrast and immediately legible
- Tactically readable in fast combat
- No glossy modern UI
- No neon/glow treatment
- No visually noisy redesign of the widget
- Reuse current task-widget visual language wherever practical

---

# Validation Requirements

Run:

```bash
node tools/validate.mjs --incremental
```

Then run the full validator if the incremental pass indicates that is appropriate or if the project workflow expects it:

```bash
node tools/validate.mjs
```

Report exact pass / warn / fail counts.

---

# Required Local Runtime Verification Checklist

After implementation, Michael will verify this in local Foundry.

## A. Ready-state button appearance
1. Create a Disable Device task
2. Continue it through the required committed rounds until it reaches:
   - `Ready to resolve`
3. Confirm:
   - `Continue Task` is no longer shown
   - `Resolve Task` appears

## B. Successful Resolve action
1. With at least 1 action available, click `Resolve Task`
2. Confirm:
   - Exactly 1 PF1.5 action is spent
   - A Disable Device check rolls
   - Chat output appears
   - A success result clears/closes the active task widget

## C. Insufficient-action failure
1. Reach `Ready to resolve`
2. Spend all available actions first
3. Click `Resolve Task`
4. Confirm:
   - No roll occurs
   - Task does not close
   - No progress/task state corrupts
   - Existing warning/failure behavior appears

## D. Minor failure path
1. Reach `Ready to resolve`
2. Resolve with a result that misses DC by 1–4, using task setup / DC choice as needed
3. Confirm:
   - Chat reports an ordinary failure state
   - Task remains `Ready to resolve`
   - Resolve button remains available for a later legal attempt
   - The task does not close incorrectly

## E. Catastrophic failure path
1. Reach `Ready to resolve`
2. Resolve with a result that misses DC by 5+
3. Confirm:
   - Chat reports catastrophic failure / GM adjudication language
   - No trap trigger automation fires
   - Task behavior matches the implemented failure-state rule
   - No console error from `baphomet-utils`

## F. Retry cadence / duplicate click protection
1. Attempt a failed resolution
2. Rapid-click `Resolve Task` again or attempt to resolve again in the same combat round
3. Confirm:
   - The system does not perform unintended duplicate resolve rolls
   - It does not spend extra actions incorrectly
   - Any retry block/warning is clean and understandable

## G. Turn-switch and persistence behavior
1. Reach `Ready to resolve`
2. Advance away from the task owner
3. Confirm widget disappears as expected
4. Return to task owner
5. Confirm:
   - `Resolve Task` still appears
   - Ready state persists accurately

## H. Regression pass
Confirm still working:
- Spend 1 / Spend 2 / Spend 3 action buttons
- Continue Task behavior from v2.17.1
- Disable Device warning behavior
- Full Attack suppression in PF1.5 mode
- Task widget hide/reappear behavior on combatant switch
- No new `baphomet-utils` console errors

---

# Required Claude Delivery Report

At completion, return:

## 1. Milestone result
- Completed / Partially completed / Blocked

## 2. Files changed
- Exact file list
- Note any goal-file rename/archive if performed

## 3. Implementation summary
- How `Resolve Task` visibility works
- How 1-action cost is enforced
- How the Disable Device roll is triggered
- How success / minor failure / catastrophic failure are classified
- What happens to the task state after each result
- How immediate widget refresh works

## 4. Architecture notes
- How resolver metadata is stored
- How the resolver dispatch path is structured
- Confirmation that persisted task data stays serializable
- Aid Another / pending bonus handling decision

## 5. Scope discipline
- Confirm non-goals were not implemented
- Confirm there was no unrelated refactor

## 6. Validator result
- Exact command(s) run
- Exact pass / warn / fail counts

## 7. Runtime verification required
- Paste the full checklist Michael should run in Foundry

## 8. Known limitations / follow-up notes
- Especially anything deferred to:
  - future task resolution expansion
  - trap consequence automation
  - abandonment UI
  - Aid Another support if not already available

---

# Done Definition

This milestone is complete when:

- A task in `Ready to resolve` state shows `Resolve Task`
- Clicking Resolve spends exactly 1 action
- Disable Device resolution rolls correctly
- Success / minor failure / catastrophic failure are distinguished
- Task state updates correctly after each outcome
- No hidden metadata leaks
- No trap consequence automation is added
- Existing Continue Task and widget behavior remain intact
- Validators pass
- Claude provides a clean Foundry runtime checklist
