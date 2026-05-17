# RUNTIME VERIFICATION REQUIRED

## v2.20.1 — Player Task Readiness Socket

**Implementation candidate is prepared. Runtime verification is still required.**

---

## Status

The v2.20.1 implementation is code-complete and has passed local static validation:

- `node tools/validate.mjs --incremental` — see delivery report for exact counts
- `node tools/validate.mjs` — see delivery report for exact counts

**Runtime testing in local Foundry has NOT been performed by Claude.**

All behavioral claims in this file are based on code inspection, not runtime observation.

---

## What was implemented

**`scripts/task-tracker.js`:**

1. **`_baphTaskCommit` — non-GM socket emit (line ~658):**
   After a successful non-GM Continue Task write, the player client emits:
   ```javascript
   game.socket.emit(`module.baphomet-utils`, {
     action:  'baphTaskReadinessCheck',
     payload: { combatantId, taskId, roundsCommitted, requestingUserId },
   });
   ```
   GM clients skip this (their synchronous readiness check already ran).

2. **Socket listener — `baphTaskReadinessCheck` branch (inside `pf1PostReady`):**
   GM-side handler validates the requesting user's ownership of the combatant's actor, reads the authoritative public task state from actor flags, reads `roundsRequired` from GM user hidden flags, and sets `readyToResolve = true` when `roundsCommitted >= roundsRequired`.
   The actor flag write propagates through the existing `updateActor` hook to all clients.

**`module.json`:**
- Version bumped to `2.20.1`

**`README.md` / `DEV_NOTES.md` / `SERVER_TESTING_CHECKLIST.md`:** Updated for v2.20.1

**`GOAL_v2.19.2.md`:** Archived as `COMPLETED_GOAL_v2.19.2.md` (prior milestone complete; required to satisfy single-active-goal constraint).

---

## What Michael must do before tagging or deploying

1. Hard-reload all browser tabs (GM + player).
2. Execute the complete checklist in `SERVER_TESTING_CHECKLIST.md` — sections A through G.
3. Pay special attention to:
   - **Section A:** After the third total Continue Task click (with `roundsRequired = 3`), the task widget must become **Ready to resolve** on the player's screen.
   - **Section B:** Player console and chat must never show the actual `roundsRequired` value.
   - **Section C:** Resolve Task must work correctly after the socket readiness flip.
   - **Section G:** All prior flows (pip sync, Aid, Resolve, Abandon, GM task builder) must remain intact.
4. Confirm module version `2.20.1` appears in Module Management.

**Do not begin the next milestone until runtime verification is complete.**

---

## Local dev server

```
http://192.168.56.1:30001
```

Module folder (junction to working repo):

```
S:\FoundryVTTData\Data\modules\baphomet-utils
```
