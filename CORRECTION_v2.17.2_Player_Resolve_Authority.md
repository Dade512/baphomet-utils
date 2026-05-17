# CORRECTION_v2.17.2_Player_Resolve_Authority.md

## Purpose

This is a **targeted correction pass** for the already-implemented milestone:

```text
v2.17.2 — Resolve Task Button + Disable Device Resolution
```

The initial implementation appears to work correctly when the **GM client** clicks `Resolve Task`, but the delivery report identified an important limitation:

> Non-GM players can click `Resolve Task`, spend the action, and trigger the Disable Device roll, but automatic outcome classification is skipped because hidden task DC data is GM-only.

That behavior is not acceptable as the finished v2.17.2 player-facing flow.

---

# Correction Goal

Fix `Resolve Task` so that:

> **A player-controlled actor may click Resolve Task, spend the action, roll Disable Device, and still receive the correct automated task outcome classification through an authorized GM-side adjudication path — without exposing hidden DC data to the player.**

---

# Required End-State

## Player-triggered Resolve Task flow

When a non-GM player controls the active combatant and clicks:

```text
Resolve Task
```

the system should:

1. Validate that the task is ready to resolve
2. Spend exactly **1 PF1.5 action**
3. Trigger the actor’s Disable Device roll
4. Capture the roll total using the existing confirmed mechanism, or an equivalent repo-confirmed safe mechanism
5. Send an adjudication request through an appropriate GM-authorized path
6. Have the GM-authorized code:
   - access the hidden DC
   - classify the outcome:
     - success
     - minor failure
     - catastrophic failure
   - update task state
   - post the same outcome chat message currently produced by GM-side resolution
7. Refresh all clients correctly through the existing update/cache path

---

# Core Privacy Requirement

The hidden DC must remain hidden.

The player client must **not** receive:

- hidden task metadata
- hidden DC
- GM-only task state
- any payload that leaks the hidden target number directly

The GM-authorized adjudication path may receive only the minimum information needed to identify and adjudicate the specific request, such as:

- actor/combatant/task identifiers
- captured roll total
- request source user ID if useful for validation

The authoritative DC lookup must remain on the GM-capable side.

---

# Existing Behavior to Preserve

Do **not** regress the already working GM-side flow.

The correction must preserve:

- GM clicking `Resolve Task`
- 1-action resolve cost
- Disable Device roll creation
- success / minor failure / catastrophic failure classification
- existing result chat output
- same-round retry protection
- existing Continue Task behavior
- task ready-state widget behavior
- hidden task metadata protection
- cross-client refresh/cache behavior from v2.17.1 and v2.17.2

---

# Technical Direction

Use the repo’s existing architecture where possible.

## Preferred approach

If the module already has a confirmed socket / GM mediation pattern, reuse it.

If it does not, add the smallest safe module-owned request path necessary to support this single feature:

- player resolves locally enough to spend the action and roll
- GM-authorized listener performs the hidden-DC classification and writes the task outcome

Do **not** build a broad new socket framework beyond what this correction requires.

---

# Validation / Authority Expectations

The GM-side adjudicator should verify enough context to reject bad or stale requests, such as:

- task exists
- actor/combatant/task IDs still match
- task is still active and ready to resolve
- task was not already resolved
- request is from a user who can legally control the active combatant or otherwise passes the module’s existing interaction rules
- captured roll total is present and finite

Exact implementation details should follow the repo’s current architecture and available Foundry v13 patterns.

---

# Chat Output

Player-triggered resolution should result in the **same visible outcome experience** as GM-triggered resolution.

The table should see the same classification output already introduced in v2.17.2:

- success
- ordinary failure / retry later
- catastrophic failure / GM adjudicates trap consequence

Do not expose the DC publicly unless the existing GM-side implementation already intentionally does so. The current report states it does **not**, and that privacy should remain intact.

---

# Non-Goals

This correction is **only** about player-triggered Resolve Task authority/adjudication.

Do **NOT** implement:

- trap trigger automation
- Aid Another subsystem
- temporary modifier UI
- Survival / Heal / additional resolver types
- Abandon Task UI
- new task creation UI
- broader permission system redesign
- broad socket framework unrelated to this exact need
- unrelated refactors of task-tracker or action-tracker

---

# Files Likely In Scope

Claude should inspect the repo and use judgment, but edits should stay narrow. Likely files:

- `scripts/task-tracker.js`
- `scripts/action-tracker.js` only if button-handler routing needs adjustment
- `module.json` only if versioning policy requires a correction bump, otherwise leave untouched
- `README.md`
- `DEV_NOTES.md`
- `SERVER_TESTING_CHECKLIST.md`
- `RUNTIME_VERIFICATION_REQUIRED.md`

If a socket helper file or other already-existing module networking file is present and is the correct place for the correction, it may be touched with explicit delivery-report justification.

Do not rename or replace the active goal file unless the validator/reporting workflow genuinely requires it.

---

# Runtime Verification Checklist — Correction Pass

Michael should verify both GM and player paths after the correction.

## A. GM regression path
1. As GM, create a ready-to-resolve Disable Device task
2. Click `Resolve Task`
3. Confirm:
   - 1 action spent
   - Disable Device roll fires
   - outcome is classified
   - chat outcome appears
   - task state updates correctly

## B. Player resolve path — success
1. Log in as a non-GM player who controls the active combatant
2. Create or prepare a ready-to-resolve Disable Device task for that actor
3. Click `Resolve Task`
4. Confirm:
   - 1 action is spent
   - player’s Disable Device roll fires
   - automated outcome classification happens without GM manually clicking anything
   - success outcome clears/closes task as intended
   - no hidden DC is visible to the player

## C. Player resolve path — minor failure
1. Set up a ready-to-resolve task likely to miss by 1–4
2. Player clicks `Resolve Task`
3. Confirm:
   - the automated chat outcome reports ordinary failure / later retry
   - task remains ready as intended
   - no second same-round resolve is allowed

## D. Player resolve path — catastrophic failure
1. Set up a ready-to-resolve task likely to miss by 5+
2. Player clicks `Resolve Task`
3. Confirm:
   - catastrophic failure chat appears
   - no trap consequence automation fires
   - task state matches the existing catastrophic failure rule
   - DC remains hidden

## E. Permission / stale request safety
1. Attempt a resolve from a user who should not control the combatant, if practical
2. Confirm the request is rejected cleanly
3. Confirm no hidden data leaks and no invalid task mutation occurs

## F. Regression
Confirm still working:
- Continue Task
- Resolve Task for GM path
- Spend 1 / Spend 2 / Spend 3
- standalone Disable Device warning behavior
- Full Attack suppression
- task widget turn-switch behavior
- no new `baphomet-utils` console errors

---

# Required Delivery Report

Claude must return:

## 1. Correction result
- Completed / Partially completed / Blocked

## 2. Files changed
- Exact file list

## 3. Architecture summary
- What adjudication path was used
- Whether an existing socket pattern was reused or a minimal one was added
- What data travels from player to GM-authorized handler
- Confirmation that hidden DC remains GM-only

## 4. Runtime behavior summary
- Player-triggered Resolve Task flow
- GM-triggered Resolve Task flow
- Result classification behavior
- Chat/update behavior

## 5. Validation result
- Exact validator commands
- Exact pass/warn/fail counts

## 6. Updated runtime checklist
- Paste the correction-pass checklist Michael should run

## 7. Known limitations
- Anything still intentionally deferred

---

# Done Definition

This correction is complete when:

- A non-GM player can click `Resolve Task`
- The action is spent exactly once
- The Disable Device roll fires
- A GM-authorized path automatically classifies the result using hidden DC data
- Task state updates correctly
- Outcome chat appears
- Hidden DC remains hidden
- Existing GM-side behavior remains intact
- Validators pass
