# SERVER_TESTING_CHECKLIST — v2.20.1 — Player Task Readiness Socket

Runtime validation checklist. Execute in local Foundry before tagging or deploying.

Local dev server: `http://192.168.56.1:30001`
Module folder: `S:\FoundryVTTData\Data\modules\baphomet-utils` (junction to working repo)

**Requires two connected browser sessions** — GM window and a non-GM player window.

---

## A. Player-approved task reaches Ready to resolve

1. Open Foundry as GM and as a non-GM player.
2. Begin combat with the player-controlled character as the active combatant.
3. Player clicks **Request Skill Task**.
4. GM approves with a known manual duration — e.g., `roundsRequired = 3`, DC = 18.
5. Confirm task widget shows `1 committed` (initiation counts as first round).
6. On the player's next turn, player clicks **Continue Task**.
7. Confirm:
   - `roundsCommitted` advances to 2.
   - Task is still **not** Ready to resolve (2 < 3).
8. On the following turn, player clicks **Continue Task** again.
9. Confirm:
   - `roundsCommitted` advances to 3.
   - Task widget transitions to **Ready to resolve**.
   - Player sees **Resolve Task** button appear.
10. Confirm player console shows **no** `baphomet-utils` errors during the above.

---

## B. Hidden duration remains private

1. During the test above, inspect:
   - Player-facing chat messages.
   - Player browser console.
   - Player-visible task widget.
2. Confirm `roundsRequired` (e.g., `3`) is never shown in any player-visible surface.
3. Confirm `baphTaskReadinessCheck` payload does not contain the hidden threshold
   (socket payload visible if you log `game.socket.on(...)` in dev console).

---

## C. Resolve Task works after socket readiness flip

1. Once the player sees **Resolve Task**, click it.
2. Confirm:
   - Skill roll fires correctly (roll card appears).
   - GM-side adjudication runs: success / minor failure / catastrophic failure classification.
   - Chat message posted by `Baphomet Tasks` alias.
   - Hidden DC is not revealed in any output.

---

## D. GM-created task + player Continue reaches Ready to resolve

1. GM creates a task directly using **Begin Task** in the task widget.
2. Let the player control the combatant and click **Continue Task** on subsequent turns.
3. Confirm:
   - Task advances normally each turn.
   - At the hidden threshold, task transitions to Ready to resolve via the same GM readiness socket.
   - Player sees Resolve Task appear without GM manually intervening.

---

## E. GM-created task + GM Continue still works

1. GM creates a task using **Begin Task**.
2. GM clicks **Continue Task** on subsequent turns (GM controls or uses GM session).
3. Confirm:
   - GM-side synchronous readiness check sets `readyToResolve = true` at the correct round.
   - No socket round-trip required or observed.
   - Behavior matches pre-v2.20.1 GM commit flow.

---

## F. Stale or malformed socket requests fail safely

If practical via console or simulated stale state:

1. Attempt a `baphTaskReadinessCheck` for:
   - A task ID that does not exist on the actor.
   - A stale combatant ID after combat ends.
   - A requesting user who does not own the actor.
2. Confirm:
   - No crash.
   - No unintended task state mutation.
   - Console log shows rejection reason.

---

## G. Regression checks

Confirm still working from v2.19.2 and prior:

- Player-side **Request Skill Task** flow.
- GM approval modal (task name, duration preset, DC, approve/reject).
- GM rejection path (whispered chat to player).
- Continue Task on the active combatant.
- Aid Task panel and Aid Another skill check.
- Resolve Task with success/minor-failure/catastrophic-failure classification.
- Abandon Task with chat notification.
- Hidden DC privacy (never shown in player-facing output).
- Pip sync from `v2.19.2` — no permission errors on NPC turn resets.
- No new `baphomet-utils` console errors.
- Module version `2.20.1` visible in Module Management.
