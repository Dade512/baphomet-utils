# GOAL_v2.18.1.md

# v2.18.1 — Aid Another Rules Alignment

## Milestone Identity

Title: Aid Another Rules Alignment
**Module:** `baphomet-utils`  
**Status:** Active implementation goal

---

# Purpose

`v2.18.0` successfully established the architecture for:

- `Abandon Task`
- pending resolution bonuses
- `Aid Task` UI
- GM-authorized socket mutation for cross-actor task aid
- Resolve-time application and consumption of queued bonuses

That architecture has now been runtime-verified locally and should be preserved.

A new authoritative rules document has been supplied:

```text
Multi-Round Task Pattern — Complete Specification
```

This document supersedes the earlier abbreviated scaffold description for the multi-round task subsystem.

This milestone aligns the existing `Aid Task` implementation with that complete task specification.

---

# Current Verified Baseline

The module currently supports:

- Multi-round task creation
- Continue Task
- Ready-to-resolve transition
- Resolve Task
- GM-authorized player Resolve adjudication
- Success / minor failure / catastrophic failure classification
- Abandon Task
- Aid Task panel and pending aid bonus plumbing
- Pending aid bonus application during Resolve Task
- Aid bonus consumption after Resolve fires

The core architecture is working. This milestone should **correct and refine Aid Another rules behavior**, not rebuild the subsystem.

---

# Authoritative Rules to Align

The new canonical task spec establishes:

1. **Aid may be offered during both task stages**
   - Continuation phase
   - Ready-to-resolve phase

2. **Aid Another costs 1 action**
   - Action is spent whether the aid attempt succeeds or fails.

3. **Aid requires a skill check**
   - The helper rolls the task’s relevant skill vs **DC 10**.
   - Success banks **+2** toward the task owner’s eventual Resolve check.
   - Failure banks **no bonus**.

4. **Multiple helpers can stack**
   - Each successful helper contributes +2.

5. **Aid bonuses are consumed when Resolve fires**
   - Success, minor failure, or catastrophic failure all consume queued aid bonuses.

6. **Active sustained buffs are not Aid**
   - Bardic Inspire Competence, Guidance, and similar effects are not banked in task state.
   - They should continue applying naturally through PF1’s standard skill-roll/buff stack at Resolve time.

---

# Ambiguity Reconciliation — Required Implementation Assumption

The authoritative rules text includes both of these ideas:

- “A single character can Aid once per task.”
- After a minor Resolve failure, aid bonuses are consumed and “aiders must Aid again to reapply bonuses.”

These statements conflict if interpreted literally as permanent once-per-task aid.

## Implement this reconciliation unless repo-local rules state otherwise:

> **One Aid contribution per character per pending Resolve attempt.**  
> A helper may successfully Aid a given task at most once before that task’s next Resolve roll fires. Once Resolve fires, queued aid bonuses and contributor records are consumed/cleared. If the task remains `Ready to resolve` after a minor failure, the same helper may Aid again before the later retry.

This preserves:
- no duplicate stacking by one helper before the same resolution attempt,
- consumed bonuses after a Resolve attempt,
- the ability to rebuild aid for a retry after a minor failure.

If Claude finds a repo-local document that clearly establishes a different cadence, it should follow the confirmed rule and report the conflict.

---

# Goal Summary

Implement:

## 1. Aid eligibility expansion
Allow `Aid Task` against eligible tasks in either state:
- active / still in progress
- ready to resolve

## 2. DC 10 aid check
Replace the current deterministic +2 aid flow with:
- spend exactly 1 PF1.5 action,
- roll the relevant task skill for the aiding actor,
- compare against DC 10,
- bank +2 only on success,
- bank nothing on failure.

## 3. Contributor cadence alignment
Adjust duplicate protection to the reconciliation rule above:
- one successful aid contribution per helper per pending Resolve attempt,
- contribution records clear when Resolve fires,
- same helper can aid again after a later minor-failure retry creates a new pending Resolve attempt.

## 4. Preserve the current stable architecture
Do not break:
- player/GM Aid socket authority,
- pending bonus storage,
- Resolve-time bonus application,
- hidden DC privacy,
- Abandon Task cleanup,
- v2.18.0 runtime-verified task flow.

---

# Detailed Requirements

## A. Aid Availability During Active and Ready Stages

The aid panel should include eligible tasks when:

- task status is active,
- task is not terminal,
- task has not been abandoned,
- task has not been resolved,
- task belongs to another combatant,
- the active aider can legally interact with the Aid control,
- the task is either:
  - still in progress, or
  - ready to resolve.

### Do not restrict aid only to `Ready to resolve`.

Aiding an in-progress task should bank assistance until the eventual Resolve Task roll fires.

---

## B. Aid Roll Behavior

When the active aider clicks `Aid Task`:

1. Confirm the target task is still valid.
2. Confirm the aider is legal and can act.
3. Spend exactly **1 PF1.5 action** from the aider.
4. Roll the relevant task skill using repo-confirmed PF1 roll APIs.
5. Compare the resulting total against **DC 10**.
6. On success:
   - bank a **+2** pending resolution bonus,
   - record the aider as a successful contributor for this pending Resolve attempt,
   - post concise success feedback.
7. On failure:
   - bank **no** pending bonus,
   - do **not** mark the actor as a successful contributor unless a narrower “attempted this round” guard is needed to prevent button spam,
   - post concise failure feedback.

### Important:
- The action is spent on both success and failure.
- Failed Aid should not create a phantom +2.
- The visible PF1 roll/card should reflect the helper’s actual Aid check if current repo patterns already show roll cards for such rolls.

---

## C. Retry / Duplicate Behavior

Implement the reconciliation rule described above.

### Before a given Resolve roll:
- A helper who already successfully Aided this pending Resolve attempt should not be able to bank another +2 on that same task before Resolve fires.

### After Resolve fires:
- queued aid bonus entries clear,
- successful aid contributor records clear,
- if the task remains `Ready to resolve` due to minor failure, the same helper may Aid again before the later retry.

### Failed Aid attempts:
The canonical spec only prohibits a character from **Aiding** again, but because a failed Aid action contributes no bonus, decide the narrowest practical spam-prevention approach consistent with current UX. Preferred behavior:

- A failed aid attempt spends the action.
- It may optionally be blocked from immediate repeated attempts in the same combat round, using existing per-round action guard conventions if appropriate.
- It should **not** permanently consume that character’s future ability to help during the same unresolved task attempt unless the current implementation already has a clearly established reason.

Document the final choice in the delivery report.

---

## D. Socket / Authority Path

The existing non-GM aid path must remain safe and functional.

For player-triggered Aid Task:

- The player may roll the Aid check locally if that is the current confirmed architecture.
- Any mutation of another actor’s task state must still be performed through the GM-authorized socket path.
- The GM-authorized handler should receive only the minimum required data:
  - source combatant / actor identity,
  - target combatant / task identity,
  - roll total or outcome context needed for the DC 10 aid adjudication,
  - request user identity if required for validation.
- Hidden task DC and hidden metadata must never be sent to the helper.

Because Aid DC is a fixed public DC 10, it is acceptable for the DC 10 comparison to occur on either:
- the player side before a success-only socket mutation, or
- the GM-authorized side after receiving the roll total.

Choose the safer repo-consistent approach and report it.

---

## E. Resolve-Time Aid Integration

Preserve the current v2.18.0 behavior:

- pending successful Aid bonuses sum into the owner’s later Resolve Task roll,
- Resolve roll/adjudication uses the bonus,
- queued aid clears after the Resolve roll fires,
- minor failure does not retain the consumed aid bonus,
- later retry can receive new Aid contributions.

---

## F. Task Widget / Aid Panel Feedback

The UI should remain readable and fast.

### Target owner widget
If already implemented:
- continue showing queued aid bonus total, e.g. `Aid queued: +2`
- update dynamically as successful Aid checks occur.

### Aider panel
Aid entries should clearly distinguish:
- can aid,
- already successfully aided this pending Resolve attempt,
- task no longer eligible / stale entries removed.

If prior UI shows `Aided ✓`, preserve or refine it as needed.

---

# Explicit Non-Goals

Do **NOT** implement in v2.18.1:

- no trap auto-triggering,
- no task initiation UI,
- no lock/trap preset UI,
- no Continue Working-after-Ready behavior unless required to fix a direct regression,
- no Trapfinder / Quick Disable detection,
- no interruption-on-damage prompt,
- no GM active-task dashboard,
- no task pruning timers,
- no broad buff inspection display,
- no feat-scaled Aid Another +N,
- no custom helper skill/DC authoring,
- no additional resolver types,
- no broad combat HUD redesign.

---

# Important Architecture Rule

The authoritative rules document includes illustrative pseudocode with function-valued fields such as `onSuccess` or `onFailureCatastrophic` inside the task object.

Do **NOT** adopt that literal storage pattern.

Preserve the current safer implementation standard:

- persisted task data must remain plain, serializable flag data,
- executable resolver behavior stays in code-owned functions / dispatch logic,
- no functions, class instances, or closures stored in actor/task flags.

---

# Likely Files In Scope

Claude may inspect any needed file, but edits should stay focused.

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
GOAL_v2.18.1.md
```

The prior active goal:

```text
GOAL_v2.18.0.md
```

may be archived/renamed if repo validator conventions require only one active goal file.

Report any rename explicitly.

---

# Versioning

Update the module version to:

```text
2.18.1
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

## A. Aid visible during active task
1. Create a multi-round task that is not yet ready to resolve.
2. Advance to another combatant’s turn.
3. Confirm the Aid panel offers `Aid Task` for that in-progress task.

## B. Aid visible during ready task
1. Advance a task to `Ready to resolve`.
2. Advance to another combatant’s turn.
3. Confirm the Aid panel offers `Aid Task` for the ready task.

## C. Successful Aid check
1. Use an aiding actor with a strong relevant skill.
2. Click `Aid Task`.
3. Confirm:
   - exactly 1 action spent,
   - a relevant skill check rolls,
   - a result of 10+ banks +2,
   - target widget shows queued aid if implemented,
   - chat/feedback indicates success.

## D. Failed Aid check
1. Use a weak aider or control the roll/DC circumstance to fail DC 10.
2. Click `Aid Task`.
3. Confirm:
   - exactly 1 action spent,
   - a relevant skill check rolls,
   - no pending aid bonus is added,
   - feedback indicates failed aid,
   - no hidden data leaks.

## E. Multiple helpers stack
1. Have two different helpers successfully Aid the same pending Resolve attempt.
2. Confirm queued aid total becomes +4.
3. Resolve the task.
4. Confirm the owner’s Resolve roll uses the combined +4.

## F. Same helper duplicate guard
1. Have one helper successfully Aid the task.
2. Before Resolve fires, attempt to Aid the same task again with that same helper.
3. Confirm duplicate successful contribution is blocked / not banked again.

## G. Aid consumed after Resolve
1. Queue one or more Aid successes.
2. Resolve the task.
3. Confirm aid bonus is consumed/cleared after the roll fires.

## H. Minor failure retry resets aid contributors
1. Queue Aid.
2. Resolve with a minor failure result so the task remains ready.
3. Confirm:
   - previous aid bonus is cleared,
   - same prior helper may Aid again before the later retry,
   - the new Aid result can bank a fresh +2 if successful.

## I. Player-socket Aid path
1. As a non-GM player controlling the aider, Aid another actor’s task.
2. Confirm:
   - the aid skill roll fires,
   - successful aid updates the target task automatically through the GM-authorized path,
   - pending bonus appears where appropriate,
   - no hidden metadata leaks.

## J. Abandon cleanup regression
1. Queue a successful Aid bonus on a task.
2. Abandon that task.
3. Confirm:
   - task widget disappears,
   - queued aid vanishes with the abandoned task,
   - no orphaned aid UI remains.

## K. Resolve regression
Confirm still working:
- Resolve Task GM path,
- Resolve Task player path,
- success classification,
- minor failure classification,
- catastrophic failure classification,
- hidden DC remains hidden.

## L. General regression
Confirm still working:
- Spend 1 / Spend 2 / Spend 3,
- Continue Task,
- Abandon Task,
- task widget turn switching,
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

## 3. Rules alignment summary
- Aid now available in which task stages
- Aid check behavior vs DC 10
- Success/failure handling
- Contributor lockout model used
- How the ambiguity reconciliation was implemented

## 4. Authority / socket summary
- GM path
- non-GM player path
- whether DC 10 comparison happens client-side or GM-side
- data transmitted through socket
- confirmation hidden task metadata remains private

## 5. Roll integration
- How the Aid check is rolled
- How pending successful Aid bonuses still apply to Resolve Task
- How bonuses/contributors are consumed/reset after Resolve

## 6. UI summary
- Aid panel changes
- target widget queued-aid display
- duplicate/blocked state display

## 7. Scope discipline
- confirm non-goals were not implemented
- confirm task flag data remains serializable
- confirm illustrative function fields from the spec were not persisted

## 8. Validator result
- exact commands run
- exact pass / warn / fail counts

## 9. Runtime checklist
- paste the updated checklist Michael should run

## 10. Known limitations / follow-up notes
- DC-10 Aid is now aligned
- feat-scaled +N still deferred
- any handling of failed repeat attempts per round
- any notes for future interruption / initiation / dashboard milestones

---

# Done Definition

This milestone is complete when:

- Aid Task appears for both in-progress and ready multi-round tasks.
- Aid Task spends exactly 1 action.
- Aid Task rolls the relevant skill vs DC 10.
- Success banks +2; failure banks no bonus.
- Multiple successful helpers stack correctly.
- A single helper cannot double-bank Aid before the same Resolve attempt.
- After Resolve fires, aid bonus/contributor state is consumed and reset.
- After a minor failure, the same helper may Aid again before a later retry.
- Player-triggered Aid remains socket-safe and privacy-safe.
- Existing Resolve/Abandon/task flow remains intact.
- Module version is 2.18.1.
- Validators pass.

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
GOAL_v2.18.1.md
COMPLETED_GOAL_v2.18.0.md
```
