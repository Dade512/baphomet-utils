# GOAL_v2.18.0.md

# Bundled Implementation Goal — v2.17.3 + v2.18.0

## Milestone Identity

```text
Version: v2.18.0
Title: Pending Resolution Bonus Support + Aid Another Baseline
Repository: baphomet-utils
```

## Final Target Version

```text
2.18.0
```

## Purpose of This Goal

This is an intentionally **larger sequential implementation jump** to test Claude Code’s `/goal` workflow on a multi-phase task.

Claude should complete both phases in order:

1. **Phase A — v2.17.3: Abandon Task Control + Task Lifecycle Cleanup**
2. **Phase B — v2.18.0: Pending Resolution Bonus Support + Aid Another Baseline**

The phases are logically connected:

- v2.17.3 finishes the **core task lifecycle**:
  - create
  - continue
  - ready
  - resolve
  - abandon / cleanup

- v2.18.0 adds the first **tactical pre-resolution support mechanic**:
  - helpers spend actions to aid a ready task
  - the task owner resolves later with queued assistance applied

---

# Current Verified Baseline

The module is currently at:

```text
v2.17.2 — Resolve Task Button + Disable Device Resolution
```

This state has been locally runtime-verified in Foundry.

Confirmed working baseline:

- Multi-round tasks can be created
- Task widget renders for active combatants
- `Continue Task` spends 1 action and advances progress
- Tasks transition to `Ready to resolve`
- `Resolve Task` spends 1 action and rolls Disable Device
- Outcomes classify as:
  - success
  - minor failure
  - catastrophic failure
- Player-triggered resolution is adjudicated through a GM-authorized socket path without exposing hidden DCs
- Hidden task metadata remains protected
- Existing validators passed after v2.17.2 correction work

This goal must preserve all of that.

---

# Repository / Workflow Expectations

## Active Goal File Handling

The previously active goal file:

```text
GOAL_v2.17.2.md
```

has now completed local runtime verification.

If the validator or repo workflow expects exactly one active `GOAL_*.md` file, archive or rename it cleanly, for example:

```text
GOAL_v2.17.2.md -> COMPLETED_GOAL_v2.17.2.md
```

Report any such rename in the delivery report.

## Final Versioning

Because this is one bundled implementation run, the repository should finish at:

```text
module.json version: 2.18.0
```

However, documentation should preserve the internal milestone history by recording both:

- `v2.17.3 — Abandon Task Control + Task Lifecycle Cleanup`
- `v2.18.0 — Pending Resolution Bonus Support + Aid Another Baseline`

---

# PHASE A — v2.17.3

# Abandon Task Control + Task Lifecycle Cleanup

## Goal

Implement a clear, player-usable way to abandon an unresolved multi-round task and tighten terminal task cleanup so stale task state does not linger incorrectly.

---

## A1. Add `Abandon Task` UI Control

### Required control

Add a visible secondary control in the task widget:

```text
Abandon Task
```

### Show `Abandon Task` when:
- Combat is active
- There is an active combatant
- The active combatant has an unresolved active task
- The task is either:
  - still in progress, or
  - already `Ready to resolve`
- The current user passes the same ownership/control expectations used by existing actionable task controls

### Do NOT show `Abandon Task` when:
- No task exists
- Task is terminal / already resolved / already abandoned
- User cannot legally act on the task
- Widget itself is not shown

---

## A2. Abandon Behavior

Clicking `Abandon Task` must:

1. Spend **0 actions**
2. Perform **no skill roll**
3. Close/retire the current task cleanly
4. Immediately remove the task widget from the active combatant’s display
5. Refresh other clients through existing cache/update mechanisms
6. Preserve hidden metadata privacy

### UI note

The PF1.5 implementation reference says task abandonment should be a **clear UI option**, with right-click suggested as an example. For fast-paced tactical combat, this goal intentionally prefers a visible secondary widget button instead of right-click-only behavior. Right-click/context-menu polish is not required in this phase.

---

## A3. GM / Player Authority

The current v2.17.2 code already added a GM-authorized socket adjudication path for player-triggered Resolve Task.

Abandon Task must follow an equally safe authority model:

- GM users may execute abandonment directly where current architecture permits.
- Non-GM players may abandon tasks they are permitted to control.
- If abandoning a task requires removal or synchronization of GM-only hidden metadata, use the existing module socket pattern or the smallest compatible extension of it.
- Do **not** expose hidden metadata or hidden DCs to players.

---

## A4. Task Lifecycle Cleanup

This phase must explicitly review and harden task cleanup behavior for terminal states.

### Terminal states to inspect:
- success resolution
- catastrophic failure resolution
- abandonment

### Required cleanup standard

Claude must inspect current task storage and implement the safest repo-consistent cleanup model:

- No abandoned task should remain as an active widget task.
- No resolved/catastrophic/abandoned task should remain eligible for continue/resolve/assist actions.
- Public task state and hidden task metadata must not become orphaned or contradictory.
- If the existing architecture intentionally retains terminal task records for history/audit, preserve that decision but ensure:
  - widget/UI ignores terminal records,
  - hidden metadata does not become stale or incorrectly reused,
  - delivery report explains the terminal-state retention model.
- If the existing architecture favors removal/compaction of terminal task records, implement that consistently and explain it.

### Scope allowance

A small targeted helper/refactor for shared terminal cleanup is allowed if it:
- reduces duplicate cleanup logic,
- is directly used by success/catastrophic/abandon handling,
- does not become a broad task-system rewrite.

---

## A5. Chat / Feedback

Abandonment may produce a concise chat or notification message if that matches current task feedback conventions.

Desired message shape:

- clear enough that the table understands the task was abandoned,
- no hidden duration or hidden DC exposure,
- not noisy.

If current module patterns prefer notification over chat for cancellation, follow the established pattern and document it.

---

# PHASE B — v2.18.0

# Pending Resolution Bonus Support + Aid Another Baseline

## Goal

Add a reusable pending-resolution-bonus path to ready tasks, then implement a first practical tactical use case:

```text
Aid Another for ready-to-resolve tasks
```

The goal is to support the gameplay beat preserved by the separate Resolve Task step:

> an ally spends an action before the primary actor resolves, adding a pending bonus to that task’s eventual resolution roll.

---

# B0. Mechanical Assumption — State Explicitly in Delivery

The PF1.5 implementation reference confirms:

- **Aid Another:** 1 action by the aiding character
- Adds **+2** by default, or potentially **+N** with relevant feats

The supplied project references do **not** clearly confirm whether this module’s PF1.5 Aid Another implementation should require a separate successful aid check before granting the bonus.

## Therefore, implement this bounded assumption unless the repo contains more specific confirmed rules:

> **v2.18.0 baseline:** Aiding a ready task costs 1 action and queues a deterministic **+2 pending resolution bonus** for that task. Feat-scaled +N support and any helper-roll/DC-10 mechanic are deferred unless already fully defined in repo-local rules.

This is a deliberate architecture-first baseline, not a silent rules invention. Report it clearly.

---

## B1. Pending Resolution Bonus Data Model

Implement a serializable pending-bonus model on the task state sufficient to support Aid Another now and future situational bonuses later.

### Requirements
- Plain serializable data only
- No functions/classes/closures in persisted task flags
- Bonus amount must be visible to resolution logic
- Bonus records must be clear enough to:
  - prevent accidental duplicate same-source aid contributions where required,
  - clear consumed bonuses after a resolve attempt,
  - clear queued bonuses when a task is abandoned or terminally closed

### Suggested conceptual shape

Claude may refine this to match existing repo conventions, but the model should support information equivalent to:

```javascript
pendingResolutionBonuses: [
  {
    sourceCombatantId: string,
    sourceActorId: string,
    sourceUserId: string | null,
    amount: number,
    label: string,
    roundAdded: number
  }
]
```

or a repo-consistent equivalent.

---

## B2. Aid Eligibility

Aid Another in this milestone should target **ready-to-resolve tasks only**.

### Eligible target task:
- same active combat
- task is active and `Ready to resolve`
- task is not resolved / abandoned / terminal
- task belongs to another combatant, not the aider themself
- task is visible through the existing public-safe task read path

### Aider requirements:
- aider is the current active combatant
- aider is controlled by the acting user, using current ownership/control patterns
- aider can spend exactly **1 PF1.5 action**
- aider has not already aided that same task in the same round if the chosen implementation enforces one contribution per source per task per round

### Stacking baseline
- Multiple **different** aiders may contribute separate +2 bonuses to the same ready task.
- A single aider should not be able to spam duplicate Aid Another contributions to the same task in the same round.
- If Claude finds current repo rules that make a different stacking rule clearly required, report and follow the confirmed repo rule instead.

---

## B3. Aid UI

Add a compact, combat-usable UI affordance for the active aider.

Because the existing task widget is centered on the active combatant’s own task, and Aid Another must happen on the aider’s turn, the feature needs a small separate assisting surface when eligible ready tasks exist.

### Preferred UI direction

When the active combatant can aid one or more ally ready tasks, show a compact section near the existing action/task UI, conceptually:

```text
Ready Tasks to Aid
[Target Actor] — [Task Name] — Aid Task
```

The exact markup is up to Claude, but it must be:
- readable in tactical combat,
- Croaker’s Ledger consistent,
- not visually noisy,
- safe for zero / one / multiple eligible task targets.

### Button label
Use:

```text
Aid Task
```

or a task-specific variation that remains compact and obvious.

---

## B4. Aid Execution Flow

Clicking `Aid Task` must:

1. Spend exactly **1 PF1.5 action** from the aider
2. Refuse cleanly if the aider cannot spend 1 action
3. Refuse if the target task is stale, not ready, terminal, or otherwise invalid
4. Add exactly **+2 pending resolution bonus** to the selected target task under the B0 baseline
5. Update all clients so:
   - the target task shows queued aid if such display is implemented,
   - duplicate same-round aid is not re-offered incorrectly,
   - the active aider’s action tracker refreshes accurately
6. Produce concise chat/notification feedback that aid was committed

---

## B5. GM / Player Authority for Aid

This feature often requires updating a **different actor’s task state** than the player currently owns.

Therefore:

- GM clicks may use direct write paths where safe.
- Non-GM players aiding another combatant’s task must route task-state mutation through the existing GM-authorized socket pattern or a minimal extension of it.
- Hidden DC and hidden task metadata must never be transmitted to the aider.
- Socket validation should confirm enough context to reject stale or invalid aid requests.

### Suggested validation categories
- action type matches expected Aid Task socket action
- GM-side listener only adjudicates on GM client
- active combat exists
- source combatant exists and matches active turn expectations if appropriate
- requesting user can legally control the aider
- target combatant/task exists
- target task is ready, active, not terminal
- source and target are not the same combatant
- duplicate aid contribution is rejected if already recorded for that source/task/round

---

## B6. Resolve Task Must Apply Pending Aid

When the task owner later clicks `Resolve Task`, queued aid must affect the actual resolution attempt.

### Required behavior
- Sum all pending aid contributions for that task
- Apply the total bonus exactly once to the Disable Device resolution attempt
- The bonus should affect the roll path in a way that the resulting roll total used for adjudication includes the aid
- Prefer a confirmed PF1-safe roll path that causes the visible roll/chat total to reflect the applied bonus where practical

### Confirmed implementation options
Repo-local references indicate:
- `actor.rollSkill(skillId, options)` is confirmed, including options such as `skipDialog` and `bonus`
- `pf1PreActorRollSkill` may modify roll config before the roll
- `pf1GetRollData` is the preferred cross-cutting data injection path for custom roll bonuses

Claude should use the safest repo-confirmed option that fits the current resolution architecture.

### Bonus consumption
After a resolution roll actually fires:
- pending bonuses are consumed/cleared regardless of:
  - success,
  - minor failure,
  - catastrophic failure
- if the task remains ready after a minor failure, aid must be re-committed for the next resolution attempt
- if resolution does **not** fire because the Resolve Task action is blocked before roll, pending aid should remain queued

---

## B7. Task Widget Feedback

The target task widget should surface pending aid in a public-safe way if practical.

Preferred display:

```text
Aid queued: +2
```

or:

```text
Assistance queued: +4
```

for stacked assistance.

Do not display:
- hidden DC,
- hidden duration,
- hidden metadata.

---

## B8. Abandon / Cleanup Integration

Aid and lifecycle cleanup must work together.

If a task with queued pending aid is:
- abandoned,
- resolved successfully,
- terminally closed via catastrophic failure,

then pending bonuses must be cleared or naturally removed with the task.

If a task suffers a minor failure:
- the pending aid is consumed with that failed attempt,
- the task remains ready for future resolve attempts,
- no stale aid total remains on the task.

---

# Non-Goals Across Both Phases

Do **NOT** implement any of the following unless already absolutely necessary to satisfy the explicit goal:

- No trap consequence automation
- No automated trap entity disabling
- No Survival / Heal / other resolver implementations
- No custom task authoring screen
- No broad task-history UI
- No group/cooperative-round-reduction system
- No generalized party teamwork engine
- No broad bonus framework outside task-resolution bonuses
- No feat-detection system for Aid Another +N unless rules and data paths are already confirmed and the change is trivially scoped
- No DC-10 helper skill-check mechanic unless repo-local rules explicitly confirm that this module should use it
- No broad combat HUD redesign
- No unrelated action tracker refactor
- No unrelated socket architecture rewrite
- No GitHub/live deployment work

---

# API / Architecture Rules

Follow:
- `CLAUDE.md`
- repo-local Foundry v13 references
- repo-local PF1 references
- PF1.5 rules references

Especially:
- Do not invent APIs
- Do not use unconfirmed PF1/Foundry paths
- Keep task flag data serializable
- Prefer module-owned task service functions over widget-local business logic
- Reuse the established socket authority model where applicable
- Preserve hidden metadata boundaries
- Preserve current player-triggered Resolve Task privacy guarantees
- Preserve current Croaker’s Ledger styling principles

---

# Expected Files Likely In Scope

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
GOAL_v2.18.0.md
```

Likely workflow rename/archive:

```text
GOAL_v2.17.2.md -> COMPLETED_GOAL_v2.17.2.md
```

If additional files must be touched, explain exactly why in the delivery report.

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

Claude must write/refresh `SERVER_TESTING_CHECKLIST.md` with a practical local Foundry verification plan for the combined scope below.

## Phase A — Abandon Task + Cleanup

### A1. Abandon in-progress task
1. Create a multi-round Disable Device task not yet ready to resolve
2. Confirm `Abandon Task` appears
3. Click `Abandon Task`
4. Confirm:
   - 0 actions spent
   - no roll occurs
   - widget disappears
   - task is no longer continuable
   - no hidden metadata leaks

### A2. Abandon ready task
1. Create a task and advance it to `Ready to resolve`
2. Confirm `Resolve Task` and `Abandon Task` are available as intended
3. Click `Abandon Task`
4. Confirm:
   - 0 actions spent
   - no resolve roll fires
   - widget disappears
   - ready task cannot be resolved afterward

### A3. Player abandon authority
1. As non-GM owner of a combatant, abandon that actor’s unresolved task
2. Confirm:
   - abandonment works without exposing hidden metadata
   - cleanup reaches GM-authorized state as needed
   - all clients refresh

### A4. Terminal-state cleanup regression
Verify success, catastrophic failure, and abandonment do not leave tasks incorrectly actionable.
If Claude adds console probes/checks for terminal flag cleanup, include them.

---

## Phase B — Aid Another / Pending Bonus

### B1. Aid UI availability
1. Create a ready-to-resolve task for one combatant
2. Advance to a different allied combatant’s turn
3. Confirm a compact ready-task aid UI appears for the active aider
4. Confirm the task owner does not see an invalid self-aid option

### B2. Aid action success
1. With 1+ actions available, click `Aid Task`
2. Confirm:
   - aider spends exactly 1 action
   - target task receives +2 pending aid
   - target task widget shows queued aid if implemented
   - concise feedback/chat appears

### B3. Player-to-GM aid authority
1. Use a non-GM player controlling the aider
2. Aid another combatant’s ready task
3. Confirm:
   - the socket/authority path succeeds automatically with GM online
   - target task state updates
   - no hidden DC/metadata leaks to player

### B4. Duplicate same-round aid guard
1. Attempt to aid the same task twice from the same aider in the same round
2. Confirm:
   - duplicate aid is rejected
   - no extra action is spent incorrectly, or the implemented behavior is clearly documented and safe
   - pending bonus does not double incorrectly

### B5. Multiple helpers stack
1. Have two different aiders aid the same ready task
2. Confirm pending aid total stacks as intended, e.g. +4 baseline
3. Confirm UI/chat stays readable

### B6. Resolve applies queued aid
1. Resolve a task with queued aid
2. Confirm:
   - queued aid affects the actual resolution roll/adjudication path
   - outcome/chat indicates applied assistance if implemented
   - hidden DC stays hidden
   - pending aid clears after the roll

### B7. Minor failure consumes aid
1. Resolve with queued aid but produce a minor failure
2. Confirm:
   - task remains ready as before
   - queued aid is consumed/cleared
   - aid must be re-added before a later resolve attempt

### B8. Abandon clears aid
1. Queue aid on a ready task
2. Abandon that task
3. Confirm:
   - pending aid disappears with the task cleanup
   - no orphaned/ghost aid remains

### B9. Aid no-action failure
1. Reduce aider to 0 actions
2. Try `Aid Task`
3. Confirm:
   - aid does not register
   - no invalid task mutation occurs
   - warning/failure feedback is clear

---

## Combined Regression

Confirm still working:
- Spend 1 / Spend 2 / Spend 3
- Continue Task
- Ready-to-resolve transition
- Resolve Task GM path
- Resolve Task player path
- success / minor failure / catastrophic failure
- Disable Device standalone warning behavior
- Full Attack suppression in PF1.5 mode
- task widget turn-switch behavior
- socket path does not leak hidden task metadata
- no new `baphomet-utils` console errors

---

# Required Delivery Report

At completion, Claude must return:

## 1. Overall result
- Completed / Partially completed / Blocked

## 2. Phase-by-phase result
- Phase A — v2.17.3 result
- Phase B — v2.18.0 result

## 3. Files changed
- Exact file list
- Note prior-goal archive/rename if performed

## 4. Implementation summary — Phase A
- `Abandon Task` visibility
- player/GM authority path
- zero-action behavior
- terminal-state cleanup model
- whether terminal tasks are retained or removed and why

## 5. Implementation summary — Phase B
- pending bonus data model
- Aid Task UI
- action cost enforcement
- GM/socket authority for aiding another actor’s task
- duplicate/stacking behavior
- resolution-time aid application
- aid consumption/cleanup behavior

## 6. Mechanical assumptions
- State the B0 Aid Another assumption used
- State whether any confirmed repo-local rule altered that assumption
- State which Aid Another details remain deferred

## 7. API / architecture notes
- socket actions added or extended
- hidden-data privacy confirmation
- PF1 roll bonus application approach
- serialization confirmation

## 8. Scope discipline
- Confirm non-goals were not implemented
- Confirm no unrelated refactor was performed

## 9. Validator result
- exact commands run
- exact pass / warn / fail counts

## 10. Runtime verification required
- paste the combined checklist Michael should run in Foundry

## 11. Known limitations / follow-up notes
- especially any remaining:
  - GM-online requirements
  - multi-GM behavior
  - feat-scaled Aid Another
  - helper-roll/DC-10 ambiguity
  - group cooperative tasks
  - other resolver types

---

# Allowed File Touch List

```text
scripts/task-tracker.js
scripts/action-tracker.js
styles/action-tracker.css
module.json
README.md
DEV_NOTES.md
SERVER_TESTING_CHECKLIST.md
RUNTIME_VERIFICATION_REQUIRED.md
GOAL_v2.18.0.md
COMPLETED_GOAL_v2.17.2.md
```

---

# Done Definition

This bundled goal is complete when:

## Phase A complete
- `Abandon Task` exists and works for unresolved/ready tasks
- abandonment costs 0 actions
- player and GM abandonment paths are safe
- terminal task cleanup is consistent and documented
- no hidden metadata leaks

## Phase B complete
- ready ally tasks can be aided from the active aider’s turn
- aiding costs exactly 1 action
- queued aid grants +2 baseline pending resolution bonus
- player-triggered aid reaches the target task through a safe authority path
- queued aid affects the later Resolve Task roll/adjudication
- queued aid is consumed or cleared at the proper lifecycle points
- hidden DC remains hidden

## Whole goal complete
- module final version is `2.18.0`
- docs/checklists reflect both v2.17.3 and v2.18.0
- validators pass
- delivery report is complete
