# GOAL_v2.19.1.md

# v2.19.1 — Cross-Client Action Pip Sync

## Milestone Identity

```text
Version: v2.19.1
Title: Cross-Client Action Pip Sync
Repository: baphomet-utils
```

**Status:** Active implementation goal

---

# Purpose

Local Foundry runtime testing exposed a real live-play UX issue:

> When one client spends an action pip, the other connected client does not immediately see the pip decrement.

Examples:
- Player spends an action → player window updates, GM window remains stale.
- GM spends an action → GM window updates, player window remains stale.

An Opus diagnostic audit confirmed that this is **not a v2.19.0 regression**. It is an older architectural condition:

- `pipState` is currently a client-local in-memory `Map`.
- Pip spends mutate only the local browser’s memory and DOM.
- No document flag is written.
- No socket event is emitted.
- No remote client hook has anything to react to.

The task widget already has cross-client refresh behavior, but the action pip row does not.

This milestone fixes that.

---

# Audit Finding to Treat as Authoritative

The audit identified:

- `scripts/action-tracker.js:376`
  - `const pipState = new Map();`
- local spend path:
  - `game.baphometActions.spendAction(...)`
  - `_spendActionForCombatant(...)`
  - `_refreshPipRow(...)`
- no cross-client synchronization of pip state
- no document writes for pip changes
- no remote rerender trigger for action pip decrements

The audit recommended proceeding directly to this bounded patch.

---

# Goal

Make the Action Spend Panel’s pip state **authoritatively shared across connected clients during combat**, while preserving existing local responsiveness and current action economy behavior.

At completion:

- A spend on one client visibly updates the remote client.
- A turn-start/reset update visibly updates the remote client.
- The action panel remains correct after reloads during an active combat if the selected storage model supports persistence.
- Existing PF1.5 action spending behavior remains unchanged.

---

# Critical Design Requirement

## Do not treat this as a cosmetic-only rerender patch

A remote rerender hook alone is insufficient if the true pip state remains client-local.

This milestone must introduce a **shared authoritative pip state source** suitable for cross-client reads.

---

# Storage Model

Claude should inspect the current repo and choose the smallest safe, v13-confirmed storage model.

## Preferred path if fully supported by repo-local references

Use **combatant-scoped flag state**, because action/reaction pips are:

- combat-turn scoped,
- tied to a specific combatant instance,
- naturally disposable with encounter deletion,
- safer for unlinked token combatants than actor-global state.

Example conceptual namespace only:

```text
flags.baphomet-utils.pipState
```

or an equivalent repo-consistent name.

## Acceptable fallback

If combatant-flag writes/update hooks are not repo-confirmed or conflict with current architecture, use an **actor flag** model that mirrors the existing task sync strategy.

If choosing actor flags, the delivery report must explain:
- why combatant flags were not used,
- how combat-only state avoids creating problematic long-term actor clutter,
- how multiple combatant representations are handled if relevant.

## Not acceptable

- Socket-only sync with no document-backed state, unless the goal is blocked and Claude clearly reports why a document-backed model cannot be implemented safely.
- Leaving `pipState` as the authoritative source and merely trying to rerender remote panels.

---

# Required Functional Behavior

## 1. Action spends sync cross-client

When the current combatant spends actions through existing paths:

- Spend 1
- Spend 2
- Spend 3
- task initiation
- Continue Task
- Resolve Task
- Aid Task
- any other existing action path that calls the centralized action-spend logic

the shared pip state must update and remote clients must refresh.

### Required remote result
- If GM spends an action on their window, the player window’s panel should visibly update.
- If player spends an action on their window, the GM window’s panel should visibly update.

---

## 2. Reaction spends sync cross-client

If reaction pip tracking already exists in the current action tracker:

- reaction spends must use the same shared-state architecture,
- remote windows must refresh accordingly.

Do not invent new reaction features; only preserve/synchronize what already exists.

---

## 3. Turn-start / reset behavior syncs cross-client

Whenever the action tracker currently resets pips for a new turn/round:

- the reset state must be written to the shared authoritative state,
- remote clients must refresh to the reset pips.

Runtime expectation:
- New turn appears with correct full/condition-adjusted pips on both GM and player windows.

---

## 4. Local responsiveness remains good

The spending client should still feel immediate.

It is acceptable to:
- update local UI optimistically and then persist shared state, or
- write shared state and rerender on update,

as long as:
- the user sees a prompt, reliable pip decrement,
- state does not flicker or duplicate-spend,
- remote clients converge to the same result.

Use the safest repo-consistent implementation.

---

## 5. Preserve existing action economy semantics

Do not change:
- 3-action + 1-reaction baseline
- existing condition-based action reductions
- existing same-round double-spend protections
- existing task action costs
- existing Full Attack suppression
- existing skill auto-spend behavior
- existing turn reset logic beyond what is required to synchronize it

This milestone is synchronization work, not a rules redesign.

---

# Hook / Refresh Requirements

Use a document update hook appropriate to the chosen storage model.

## If using combatant flags
- Use a confirmed `updateCombatant`-style hook if repo-local docs support it.
- Only react when the relevant module pip flag changed.
- Refresh the local action pip row/panel for the affected combatant.

## If using actor flags
- Use an `updateActor` path similar in spirit to the existing task cache sync hook.
- Only react when the relevant module pip flag changed.
- Refresh the displayed action pip row/panel as needed.

## Avoid over-rendering
The update hook should bail early when:
- the changed document has no relevant pip-state change,
- no visible panel exists,
- the affected combatant is not relevant to the current combat display if such a guard is already available.

---

# Existing `pipState` Map

The current client-local `pipState` Map may remain as:
- a cache,
- a local read-through structure,
- a temporary compatibility layer,

if that reduces churn.

But it must **not** remain the sole authoritative state source for live-play action pips.

If retained:
- define clearly how it is hydrated from shared state,
- define clearly when it is written back,
- avoid situations where stale local cache overwrites newer shared state.

---

# Settings Surface Issue — Do Not Code Against It

A separate observation was raised that the module settings screen looked sparse.

The Opus audit concluded this is **most likely expected player-window behavior**:
- the two visible settings are the two client-scope settings,
- GM/world settings would only appear from the GM tab.

This goal does **not** change settings registration.

## Claude may:
- note in the delivery report that settings were not touched,
- optionally repeat the audit conclusion in Known Limitations / Follow-Up.

## Claude must not:
- change settings registration,
- add settings for pip sync,
- bundle unrelated settings-surface changes into this milestone.

---

# Allowed File Touch List

Implementation edits should stay narrow.

Allowed files:

```text
scripts/action-tracker.js
module.json
README.md
DEV_NOTES.md
SERVER_TESTING_CHECKLIST.md
RUNTIME_VERIFICATION_REQUIRED.md
GOAL_v2.19.1.md
```

The prior active goal:

```text
GOAL_v2.19.0.md
```

may be archived/renamed if validator conventions require exactly one active goal file.

Report any rename explicitly.

If Claude determines another file is absolutely required to implement safe cross-client pip sync, stop and explain why before touching it unless the need is trivially structural and directly related.

---

# Versioning

Update the module version to:

```text
2.19.1
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

## A. GM spend → player sync
1. Open the world as GM and as a non-GM player.
2. Enter combat with a shared visible combatant/action panel.
3. From the GM window, spend 1 action.
4. Confirm:
   - GM panel decrements immediately,
   - player panel updates to match within one normal Foundry update cycle,
   - no console error from `baphomet-utils`.

## B. Player spend → GM sync
1. From the player window, spend 1 action on the player-controlled combatant.
2. Confirm:
   - player panel decrements immediately,
   - GM panel updates to match within one normal Foundry update cycle.

## C. Spend 2 / Spend 3 sync
1. Exercise Spend 2 and Spend 3 actions.
2. Confirm remote client matches the spending client for each cost.

## D. Task-driven spend sync
1. Create/use a builder-created task if needed.
2. Click:
   - Continue Task,
   - Resolve Task,
   - Aid Task.
3. Confirm the remote client’s action pips update for the acting combatant after each action spend.

## E. Turn reset sync
1. Advance combat to reset the combatant’s pips.
2. Confirm:
   - reset pips appear correctly on GM window,
   - reset pips appear correctly on player window,
   - any condition-adjusted action total remains correct if already supported.

## F. Reaction pip sync
If reaction spend UI/path is currently present:
1. Spend a reaction from one client.
2. Confirm the other client updates correctly.

## G. Mid-combat reload resilience
If the chosen document-backed storage model supports it:
1. Spend one or more pips.
2. Refresh/reload one browser tab mid-combat.
3. Confirm the reloaded client reconstructs the correct current pip state rather than resetting to a stale default.

## H. Existing task/widget regression
Confirm still working:
- Begin Task,
- Continue Task,
- Aid Task,
- Resolve Task,
- Abandon Task,
- task widget public/private behavior,
- GM task builder UI.

## I. General action tracker regression
Confirm still working:
- action buttons,
- reaction display/spend if applicable,
- Full Attack suppression,
- standalone Disable Device warning behavior,
- skill auto-spend behavior,
- no duplicate/double-spend regressions,
- no new `baphomet-utils` console errors.

---

# Required Delivery Report

At completion, Claude must return:

## 1. Overall result
- Completed / Partially completed / Blocked

## 2. Files changed
- Exact file list
- Prior-goal archive/rename if performed

## 3. Root-cause correction summary
- How pip state was previously client-local
- What shared authoritative storage model was chosen
- Why that model was selected

## 4. Implementation details
- What state is persisted/shared
- How spends write it
- How resets write it
- How remote clients observe it
- What rerender/refresh path is used

## 5. Existing `pipState` handling
- Removed / retained as cache / rewritten
- How stale-cache overwrite risk is avoided

## 6. Compatibility notes
- actor vs combatant choice rationale
- reload behavior
- linked/unlinked token implications if relevant
- settings surface explicitly untouched

## 7. Scope discipline
- confirm no unrelated rules changes
- confirm no settings changes
- confirm no broad action system redesign

## 8. Validator result
- exact commands run
- exact pass / warn / fail counts

## 9. Runtime checklist
- paste the updated checklist Michael should run

## 10. Known limitations / follow-up notes
- anything still intentionally deferred

---

# Done Definition

This milestone is complete when:

- action pip state is shared across clients rather than purely client-local,
- GM spends visibly update player UI,
- player spends visibly update GM UI,
- resets visibly synchronize,
- task-driven action spends synchronize too,
- chosen document-backed state model is documented,
- existing action/task behavior remains intact,
- module version is 2.19.1,
- validators pass.
