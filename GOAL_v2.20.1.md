# GOAL_v2.20.1.md

# v2.20.1 — Player Task Readiness Socket

## Milestone Identity

```text
Version: v2.20.1
Title: Player Task Readiness Socket
Repository: baphomet-utils
```

**Status:** Active implementation goal

---

# Purpose

`v2.20.0 — Player-Side Task Initiation` successfully added:

- player-side task request UI,
- GM approval modal,
- reuse of the existing `initiateTask` path,
- proper 1-action initiation spend,
- proper first committed work unit,
- correct hidden-data writes to the GM user flag.

However, local runtime testing exposed a critical readiness bug:

> When a non-GM player clicks **Continue Task**, the task’s public progress advances, but it never transitions to **Ready to resolve**.

Observed runtime logs show the same task advancing indefinitely:

```text
roundsCommitted=2 ... readyToResolve=false
roundsCommitted=3 ... readyToResolve=false
...
roundsCommitted=9 ... readyToResolve=false
```

An Opus forensic audit found the exact root cause:

- Hidden `roundsRequired` data is stored on the **GM user flag**.
- `_baphTaskCommit(...)` currently evaluates readiness locally on the committing client.
- When the committing client is a player:
  - `_baphTaskReadHiddenAll()` reads the **player’s** user flag,
  - no hidden `roundsRequired` exists there,
  - `game.user.isGM` is false,
  - `readyToResolve` never flips true.

This bug is not a failure of the `v2.20.0` approval path. It is a pre-existing single-GM hidden-data assumption that player-driven Continue flow exposed.

---

# Goal

Add a GM-authorized **task readiness check socket path** so player-driven Continue Task actions can correctly cause tasks to become **Ready to resolve** when public progress reaches the GM-hidden duration.

At completion:

- Non-GM players can Continue Task on their own active combatant.
- Public `roundsCommitted` still increments through the existing task commit flow.
- After the public commit succeeds, the player emits a readiness-check request to the GM.
- The GM client reads hidden duration data from the GM user flag and compares:
  - `roundsCommitted >= hidden roundsRequired`
- When the threshold is met:
  - GM updates the public task state to `readyToResolve = true`,
  - existing `updateActor` widget refresh propagates to all clients,
  - player sees **Resolve Task** appear.
- Existing GM-side synchronous readiness behavior remains intact.

---

# Authoritative Audit Finding

The forensic audit recommended adding a new socket action alongside the existing task socket patterns already used for:

- `baphTaskResolveAdjudicate`
- `baphTaskAidAdjudicate`

Suggested new action:

```text
baphTaskReadinessCheck
```

The pattern must remain consistent with the current module socket architecture.

---

# Required Functional Behavior

## 1. Non-GM Continue Task emits readiness-check request

Inspect:

```text
scripts/task-tracker.js
```

specifically `_baphTaskCommit(...)`.

After a non-GM player's Continue Task commit:

1. Existing public task progress update must still complete successfully.
2. The client should emit a GM-directed readiness-check socket message.

### Suggested payload shape

```javascript
{
  action: 'baphTaskReadinessCheck',
  payload: {
    combatantId,
    taskId,
    roundsCommitted,
    requestingUserId
  }
}
```

Claude may refine this to match the repo’s existing message conventions, but the payload must include enough GM-side validation context.

---

## 2. GM socket handler validates request

Add a new branch in the existing module socket listener alongside the already-established task adjudication handlers.

The GM-side handler must:

- execute only on GM clients,
- resolve the active combat/combatant/task safely,
- verify the task exists,
- verify the public task belongs to the referenced combatant/actor,
- verify the requesting user is allowed to control that combatant’s actor, or follow the repo’s existing control validation pattern,
- reject malformed/stale requests safely.

Do not trust client-provided `roundsCommitted` alone when the current public actor task state can be read directly. Prefer reading the authoritative public task record from the actor flag and using that current value. If `roundsCommitted` is included in the payload, treat it as advisory/debug context unless the existing socket pattern clearly requires otherwise.

---

## 3. GM reads hidden data and flips readiness

The GM handler must:

1. Read hidden task data using the existing GM-side hidden-data read path.
2. Locate hidden metadata for the specified `taskId`.
3. Extract `roundsRequired`.
4. Compare the authoritative public task’s `roundsCommitted` against the hidden threshold.
5. If:
   - task is still active,
   - task is not already `readyToResolve`,
   - `roundsCommitted >= roundsRequired`,

   then update public task state:

```javascript
readyToResolve = true
```

and write the actor/public task flags through existing repo-consistent helpers.

---

## 4. Existing GM commit flow remains unchanged

When a GM clicks Continue Task:

- existing synchronous readiness logic may continue to set `readyToResolve` directly,
- no regression should occur,
- duplicate GM socket round-trip is not necessary unless a tiny shared-helper refactor is clearly safer.

Do not refactor the entire task readiness system just to unify every code path.

---

## 5. Existing updateActor refresh handles UI convergence

Do not invent a new widget refresh channel.

The actor public task flag update caused by the GM readiness flip should already trigger existing cross-client widget refresh behavior through the established `updateActor` hook.

Confirm this in the delivery report.

---

# Important Privacy Rule

The hidden `roundsRequired` value must **not** be transmitted to the player.

The readiness socket should move only:
- task/combatant identity,
- requestor identity,
- optional public progress context.

The actual hidden duration comparison occurs entirely on the GM client.

---

# Explicit Non-Goals

Do **NOT** implement:

- trap entity integration,
- player-side task request UI changes,
- sheet button relabeling unless strictly necessary for compilation,
- feat-scaled Aid,
- Quick Disable / Trapfinder,
- interruption-on-damage prompts,
- new task resolver types,
- pip flag permission fixes if not already handled by `v2.19.2`,
- any hidden-data storage redesign,
- any multiplayer multi-GM arbitration redesign.

---

# Allowed File Touch List

```text
scripts/task-tracker.js
module.json
README.md
DEV_NOTES.md
SERVER_TESTING_CHECKLIST.md
RUNTIME_VERIFICATION_REQUIRED.md
GOAL_v2.20.1.md
COMPLETED_GOAL_v2.19.2.md
```

If a very small action-tracker touch is truly required due to where current socket dispatch/render glue lives, stop and explain why before broadening scope unless the necessity is obvious and directly tied to the readiness fix.

Goal-file archiving/renaming should follow the repo’s existing convention and be explained in the delivery report.

---

# Versioning

Update module version to:

```text
2.20.1
```

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

## A. Player-approved task reaches Ready to resolve
1. Open Foundry as GM and non-GM player.
2. Begin combat with the player-controlled character active.
3. Player clicks **Request Skill Task**.
4. GM approves a task with a known manual hidden duration, e.g.:
   - roundsRequired = 3
5. Confirm task appears at:
   - `1 committed`
6. Advance to the player’s next turns and click Continue Task.
7. Confirm:
   - after second total commitment: not ready yet,
   - after third total commitment: widget becomes **Ready to resolve**,
   - player sees **Resolve Task**.

## B. Hidden duration remains private
1. During the above test, inspect player-facing UI/chat.
2. Confirm actual `roundsRequired` is never shown.

## C. Resolve Task works after socket readiness flip
1. Once player sees **Resolve Task**, click it.
2. Confirm:
   - skill roll fires,
   - adjudication works as before,
   - success/minor/catastrophic classification path remains intact.

## D. GM-created task + player Continue works
1. GM creates a task directly using Begin Task.
2. Let the player control the actor and click Continue Task on later turns.
3. Confirm the task becomes Ready to resolve at the hidden threshold through the same GM readiness socket.

## E. GM-created task + GM Continue still works
1. GM creates a task directly.
2. GM clicks Continue Task.
3. Confirm GM-side synchronous readiness still works correctly.

## F. Stale/malformed socket requests fail safely
If practical via console or simulated stale state:
1. Attempt a readiness check for:
   - missing task,
   - non-active or stale combatant,
   - mismatched actor/task.
2. Confirm no crash and no bad task mutation.

## G. Regression checks
Confirm still working:
- player-side Request Skill Task flow,
- GM approval modal,
- rejection/expiration behavior if practical,
- Continue Task,
- Aid Task,
- Resolve Task,
- Abandon Task,
- hidden DC privacy,
- pip sync fixes from `v2.19.2`,
- no new `baphomet-utils` console errors.

---

# Required Delivery Report

Return:

## 1. Overall result
- Completed / Partially completed / Blocked

## 2. Files changed
- Exact file list
- Any goal-file rename/archive behavior and why

## 3. Root-cause correction summary
- Why non-GM Continue Task could never set readiness
- How the new GM readiness socket fixes it

## 4. Socket architecture
- New action name
- Payload fields
- GM-side validation
- How authoritative public task state is read
- How hidden duration is read and applied

## 5. Privacy preservation
- Confirm hidden roundsRequired never leaves GM-side storage
- Confirm no hidden metadata is sent to player

## 6. Existing behavior preserved
- GM synchronous commit path
- player task request/approval path
- Resolve/Aid/Abandon flows
- updateActor refresh path

## 7. Scope discipline
- Confirm no unrelated task-system redesign
- Confirm no hidden-data architecture rewrite
- Confirm no unrelated UI work

## 8. Validator result
- exact commands run
- exact pass / warn / fail counts

## 9. Runtime checklist
- paste the updated checklist Michael should run

## 10. Known limitations / follow-up
- single-GM hidden-data assumption remains,
- multi-GM arbitration remains deferred,
- other deferred task-system features remain out of scope.

---

# Done Definition

This milestone is complete when:

- player-driven Continue Task can trigger GM-authorized readiness evaluation,
- public task state flips to `readyToResolve = true` at the GM-hidden duration threshold,
- player sees Resolve Task appear without the GM manually intervening,
- GM-driven task flows remain intact,
- hidden duration remains private,
- validators pass,
- delivery report is complete.
