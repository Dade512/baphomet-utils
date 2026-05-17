# GOAL_v2.20.0.md

# v2.20.0 — Player-Side Task Initiation

## Milestone Identity

```text
Version: v2.20.0
Title: Player-Side Task Initiation
Repository: baphomet-utils
```

**Status:** Active implementation goal

---

# Purpose

After v2.19.1, the multi-round task system has a complete GM-driven lifecycle. The GM can create tasks via the task builder, players can Continue / Aid / Resolve / Abandon, and pip state synchronizes cross-client.

The remaining live-play friction:

> Currently, only the GM can initiate a task. If a player wants to attempt a multi-round skill action (disable a trap, work on a complex lock, perform extended tracking), the GM must stop their other work and create the task on the player's behalf through the task builder UI.

This breaks play flow — especially during exploration or downtime moments where the player is the one driving the narrative and the GM is reacting.

This milestone enables players to **request** task initiation through their character sheet, with a **GM approval handshake** that preserves the existing hidden-data privacy model.

---

# Design Principles (Authoritative)

## 1. Hidden data privacy is non-negotiable

The hidden DC and `roundsRequired` MUST remain on GM user flags only. Players never see these values, even during initiation. The request → approval flow is the mechanism by which the GM sets those hidden values without exposing them to the requesting player.

## 2. Reuse existing architecture; do not invent new patterns

The socket adjudication pattern already exists for Aid Another (player-rolled, GM-adjudicated). Player-side task initiation should follow the same general shape:

```text
Player client emits request → GM client receives → GM modal prompt → 
GM submits hidden values → task is created via existing createTask path → 
both clients refresh
```

No new storage model. No new flag namespaces. No new socket message format beyond what the request handshake requires.

## 3. GM authority is preserved

The GM can **reject** any player-initiated request. Rejection is an explicit option in the GM's modal prompt, not an awkward escape hatch. A rejected request produces a chat message to the requesting player ("GM declined — try a different approach") and does not create a task.

## 4. Single-GM assumption remains acceptable

If multiple GMs are connected, the request goes to whichever GM client first claims it. This matches the existing single-GM assumption in the hidden-data model. Multi-GM handoff is not in scope.

## 5. Modal, not notification

The GM-side approval prompt MUST be a modal dialog, not a chat-whispered notification. Players initiate tasks rarely enough that a modal interruption is acceptable, and the cost of a missed request (player blocked waiting indefinitely) is too high to rely on chat visibility.

---

# Goal

Enable players to initiate multi-round tasks from their character sheet, with GM modal approval setting the hidden DC and duration before task creation.

At completion:

- A "Begin Skill Task" button or equivalent exists on the player's character sheet
- Clicking it opens a player-side dialog asking for skill selection and a free-text description of what they're attempting
- The request fires via socket to GM clients
- GM receives a modal prompt with skill, description, requesting player, and inputs for DC and `roundsRequired`
- GM can approve (task is created via existing path) or reject (chat message, no task)
- Existing GM-side task creation path remains fully functional and unchanged for direct GM-initiated tasks

---

# Critical Design Requirement

## Do not duplicate the createTask path

Player-initiated approval should funnel through the **same `initiateTask` (or equivalent) entry point** that the GM task builder uses today. The only difference is *how the inputs are gathered*. The task object produced, the storage path, the widget rendering, the action-spend behavior, the Continue/Aid/Resolve handlers — all identical to current GM-created tasks.

This is critical for two reasons:
1. It guarantees behavioral consistency between GM-initiated and player-initiated tasks.
2. It prevents two parallel task-creation paths from drifting out of sync over future milestones.

## Action spend and first-commit semantics

When the GM approves a player-initiated task request, the resulting task must follow the same action-spend and progress semantics as a GM-initiated task:

- **1 action is spent** from the requesting player's active combatant at the moment the GM approves.
- **The initiation counts as the first committed round of work** (`roundsCommitted: 1`, `lastCommittedRound: startRound`).
- If `roundsRequired <= 1`, the task immediately enters `readyToResolve` state.
- Hidden DC and `roundsRequired` are stored on the approving GM's user flags only.

This matches the existing `initiateTask` behavior exactly. The player-side request flow is just a UI front-end for that same function call. Do not implement a parallel "create task without spending an action" path.

## Active combatant requirement

A player can only request task initiation when **their character is the currently active combatant in active combat.** This mirrors the existing `initiateTask` Gate 3 / Gate 4 requirements:

- Combatant must be `game.combat.combatant` (active turn)
- Current user must be able to control that combatant

The player-side button should be disabled (or surface a warning) when the player's character is not the active combatant. The GM modal should also display the active-combatant status of the request so the GM knows the request is mechanically valid before approving.

---

# Required Functional Behavior

## 1. Player-side sheet button / entry point

Add a "Begin Skill Task" button (or equivalent entry point) accessible from the player's character sheet. Exact placement and label should follow existing Croaker's Ledger UI conventions.

Clicking the button opens a player-side dialog with:

- **Skill selector:** Currently restricted to **Disable Device only.** The selector should be implemented as a registry-driven dropdown so additional multi-round skills can be added in future milestones without UI rework, but for v2.20.0 Disable Device is the sole entry. If only one skill is registered, the selector may display as a read-only label rather than a dropdown.
- **Description field:** Free-text input where the player describes what they're attempting (e.g., "Picking the magical lock on the abbot's door," "Disabling the poison-dart trap on the floor tile").
- **Submit / Cancel buttons.**

The dialog should clearly indicate that the request will be sent to the GM for approval.

## 2. Request socket message

On Submit, the player client emits a socket message containing:

```text
- requestId (UUID for matching response)
- requestingUserId
- requestingActorId
- requestingCombatantId   (REQUIRED for GM-side active-combatant validation)
- skillId (PF1 skill key, e.g., 'dvs')
- description (player-provided text)
- timestamp
```

The request does NOT include any DC or duration values — those are set by the GM.

**Why `requestingCombatantId` is required:**

The GM-side handler MUST validate the request before approving. Required checks:

- The combatant exists in the currently active combat
- The combatant matches `game.combat.combatant?.id` (active turn)
- The requesting user controls that combatant's actor (or is a GM)
- The combatant's actor matches `requestingActorId` (consistency check)

Without `requestingCombatantId`, the GM client cannot enforce the active-combatant gate without additional lookups, and a malformed or malicious client could in theory request a task on behalf of a different combatant's actor.

## 3. GM-side modal prompt

Active GM client(s) receive the socket message and the first to claim it surfaces a modal dialog with:

- **Read-only:** requesting player name, requesting character name, requested skill, player's description
- **Input: DC** (number, GM sets the resolution DC)
- **Input: Rounds Required** (number, GM sets the hidden duration — should support 1, 1d4 rolled, 2d4 rolled, or custom value)
- **Optional dropdown helper:** "Simple trap (1d4)," "Difficult trap (2d4)," "Custom" with auto-roll for the dice-based options
- **Approve button** (submits and creates the task)
- **Reject button** (sends rejection chat message; no task created)

The modal MUST be blocking — GM cannot dismiss without explicit Approve or Reject.

## 4. Approval path

On Approve:

- GM client validates the request (combatant exists, is active turn, user owns it)
- GM client invokes the existing `initiateTask` function with the player-provided fields (combatant, taskName, skill) AND the GM-provided fields (DC, roundsRequired)
- `initiateTask` spends 1 action from the active combatant, sets `roundsCommitted: 1`, stores hidden DC/duration on GM user flags
- If `roundsRequired <= 1`, task immediately enters `readyToResolve` state
- Both clients refresh — player sees task widget appear in their HUD with the appropriate active or ready-to-resolve state
- Optional: chat message announces the task to the table (`initiateTask` already posts a chat message of its own)

## 5. Rejection path

On Reject:

- No task is created
- Chat message whispered to the requesting player only (or visible to all, per GM preference — modal should offer this toggle if cheap to implement)
- Player's request dialog closes; they receive notification that the GM declined

## 6. Request expiration

If no GM responds within a reasonable window (suggested: 60 seconds), the player's request times out and they receive a notification ("No GM available — request expired"). This prevents indefinite blocking if the GM is AFK.

## 7. Preserve existing GM-initiated path

The existing GM task builder UI must remain fully functional and unchanged for direct GM-initiated task creation. Player-side initiation is purely additive.

---

# UI Specification

## Player Sheet Button

Placement: somewhere accessible from the main character sheet (a button in the skills section, an action in the sheet header, or equivalent). Croaker's Ledger styling.

Label suggestion: "Begin Skill Task" or "Request Skill Task" (the word "request" makes the GM-approval nature explicit; either is acceptable).

## Player Initiation Dialog

```text
┌─────────────────────────────────┐
│  Begin Skill Task               │
├─────────────────────────────────┤
│  Skill: [Disable Device    ▼]   │
│                                 │
│  What are you attempting?       │
│  ┌─────────────────────────────┐│
│  │ [free text input]           ││
│  │                             ││
│  └─────────────────────────────┘│
│                                 │
│  Your request will be sent to   │
│  the GM for approval.           │
│                                 │
│         [Submit]   [Cancel]     │
└─────────────────────────────────┘
```

## GM Approval Modal

```text
┌─────────────────────────────────────────┐
│  Player Task Request                    │
├─────────────────────────────────────────┤
│  Player: Michael                        │
│  Character: Kael                        │
│  Skill: Disable Device                  │
│                                         │
│  Description:                           │
│  "Disabling the poison-dart trap        │
│   on the floor tile"                    │
│                                         │
│  ─── GM Settings (hidden from player) ──│
│                                         │
│  Difficulty: [Difficult trap ▼]         │
│              [ Simple (1d4)  ]          │
│              [ Difficult (2d4)]         │
│              [ Custom        ]          │
│                                         │
│  Rounds Required:  [5]   [🎲 Roll]      │
│  DC:               [25]                 │
│                                         │
│         [Approve]   [Reject]            │
└─────────────────────────────────────────┘
```

The dice helper auto-rolls 1d4 or 2d4 when a difficulty preset is selected, populating the Rounds Required field. GM can override before submitting.

---

# Storage / Hidden Data Model

No new storage model. The created task uses the existing pattern:

- **Public actor flag:** task progress, skill, description, status
- **GM user flag:** hidden DC, hidden roundsRequired, hidden metadata

Player-initiated tasks are indistinguishable from GM-initiated tasks once created. The initiation pathway is the only difference.

---

# Socket Message Schema

## Request (player → GM)

```javascript
{
  type: 'taskRequest',
  requestId: 'uuid-string',
  requestingUserId: 'user-id',
  requestingActorId: 'actor-id',
  requestingCombatantId: 'combatant-id',  // REQUIRED for active-combatant validation
  skillId: 'dev',
  description: 'player-provided text',
  timestamp: 1234567890
}
```

## Response (GM → player)

```javascript
{
  type: 'taskRequestResponse',
  requestId: 'uuid-string',  // matches request
  approved: true | false,
  reason: 'optional rejection reason text',
  taskId: 'task-uuid-if-approved'
}
```

Use existing module socket namespace (`baphomet-utils.socket` or equivalent — verify against existing socket infrastructure).

---

# Allowed File Touch List

Implementation edits should stay narrow.

Allowed files:

```text
scripts/task-tracker.js
scripts/action-tracker.js  (only if sheet button injection requires it; otherwise leave alone)
styles/noir-theme.css       (only if new UI requires styling additions)
module.json
README.md
DEV_NOTES.md
SERVER_TESTING_CHECKLIST.md
RUNTIME_VERIFICATION_REQUIRED.md
GOAL_v2.20.0.md
```

The prior active goal:

```text
GOAL_v2.19.1.md
```

should be renamed to `COMPLETED_GOAL_v2.19.1.md` per the CLAUDE.md convention.

If Claude determines another file is absolutely required (e.g., a new `scripts/task-initiation-dialog.js` for organizational reasons), stop and explain why before touching it.

---

# Versioning

Update the module version to:

```text
2.20.0
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

## A. Player can initiate request

1. As a player, confirm the "Begin Skill Task" button is **disabled** (or warns on click) when the player's character is not the active combatant in active combat.
2. Begin combat with the player's character as the active combatant.
3. As the player, click the "Begin Skill Task" button on the character sheet.
4. Confirm:
   - dialog opens with skill selector showing Disable Device (as the only currently-registered multi-round skill),
   - submit button is disabled until description is non-empty.
5. Fill in skill (Disable Device) and description ("test trap").
6. Click Submit.
7. Confirm:
   - dialog closes,
   - player receives "Request sent to GM" notification,
   - no console error from `baphomet-utils`.

## B. GM receives modal prompt

1. As GM in another browser session, confirm modal appears within one update cycle of the player's submission.
2. Confirm modal displays:
   - requesting player name,
   - requesting character name,
   - **active-combatant validation status** (e.g., "Active turn: yes" / "Active turn: no"),
   - selected skill,
   - description text,
   - difficulty preset dropdown,
   - rounds required input,
   - DC input,
   - Approve and Reject buttons.
3. Confirm modal cannot be dismissed by clicking outside or pressing Escape.
4. If the requesting combatant is NOT the active combatant (e.g., the turn advanced before the GM responded), the Approve button should be disabled or surface a warning. GM may still Reject.

## C. GM approves request

1. Select "Difficult trap" preset; confirm Rounds Required auto-rolls 2d4 and populates field.
2. Manually enter DC: 25.
3. Click Approve.
4. Confirm:
   - modal closes,
   - **1 action is spent from the requesting player's active combatant** (verify pip count decremented),
   - task appears in player's task widget,
   - task widget shows post-initiation state: `Working... 1/[hidden]` (or `Ready to resolve` if GM set roundsRequired=1),
   - player cannot see actual round count,
   - GM sees task with full hidden values per existing behavior,
   - chat message announces the task per `initiateTask` standard behavior.

## D. GM rejects request

1. Initiate a second request as the player.
2. As GM, click Reject in the modal.
3. Confirm:
   - modal closes,
   - chat message appears notifying the player (whispered or public per modal toggle),
   - no task is created,
   - player can initiate a new request without issue.

## E. Request expiration

1. Initiate a request as the player.
2. As GM, do not respond to the modal (or close GM browser briefly to simulate AFK).
3. Wait 60 seconds.
4. Confirm:
   - player receives "Request expired — no GM available" notification,
   - if GM later tries to respond, the request is no longer actionable.

## F. Multiple sequential requests

1. Initiate three requests as the player (different skills or descriptions).
2. As GM, confirm each modal appears in sequence (not overlapping).
3. Approve one, reject one, let one expire.
4. Confirm each outcome resolves cleanly.

## G. Existing GM-initiated path regression

Confirm still working:
- GM task builder UI creates tasks directly without going through the player-initiation flow,
- existing tasks Continue / Aid / Resolve / Abandon as before,
- existing pip sync (v2.19.1) remains functional during player-initiated tasks,
- no duplicate task creation if GM uses both paths for the same actor.

## H. Cross-client refresh

1. After GM approves a player-initiated task, confirm:
   - player sees task widget on their HUD,
   - GM sees task in GM-side view,
   - any other connected client with visibility sees task progress per existing privacy rules.

## I. General task system regression

Confirm still working:
- Continue Task,
- Aid Task (DC 10 roll, +2 banked),
- Resolve Task (success / minor failure / catastrophic failure),
- Abandon Task,
- hidden DC/duration privacy,
- task widget public/private behavior,
- standalone Disable Device warning behavior (rolling DV outside a task still warns),
- skill auto-spend behavior,
- Full Attack suppression,
- no new `baphomet-utils` console errors.

---

# Required Delivery Report

At completion, Claude must return:

## 1. Overall result
- Completed / Partially completed / Blocked

## 2. Files changed
- Exact file list
- Prior-goal archive/rename confirmation

## 3. Implementation summary
- Sheet button placement and styling approach
- Player dialog implementation
- Socket message handler implementation
- GM modal implementation
- How createTask path was reused (or why a parallel path was necessary)

## 4. Socket architecture
- Message types used
- Request/response correlation mechanism
- Timeout behavior
- Multi-GM behavior (which GM client claims the request)

## 5. Privacy preservation
- Confirm hidden DC and roundsRequired are never sent in the request message
- Confirm they exist only on GM user flags after creation
- Confirm the player widget shows duration placeholder, not actual count

## 6. Scope discipline
- Confirm no changes to existing GM-initiated task creation path
- Confirm no changes to existing Continue/Aid/Resolve/Abandon behavior
- Confirm no changes to hidden-data storage architecture
- Confirm no changes to pip sync architecture (v2.19.1)

## 7. Validator result
- Exact commands run
- Exact pass / warn / fail counts

## 8. Runtime checklist
- Paste the updated checklist Michael should run

## 9. Known limitations / follow-up notes
- Multi-GM concurrent-claim handling (likely follow-up)
- Trap entity integration (follow-up — v2.21.0+)
- Sheet button discoverability / placement refinement (potential follow-up)
- Anything else intentionally deferred

---

# Done Definition

This milestone is complete when:

- Players can initiate task requests from their character sheet,
- GM receives a modal approval prompt with hidden-data input fields,
- Approval creates a task via the existing `initiateTask` path,
- Rejection produces a chat message and no task is created,
- Request expiration handles AFK GM gracefully,
- Hidden DC and roundsRequired remain on GM user flags only,
- Existing GM-initiated task creation path is unchanged,
- Existing task lifecycle (Continue/Aid/Resolve/Abandon) is unchanged,
- Module version is 2.20.0,
- Validators pass,
- `RUNTIME_VERIFICATION_REQUIRED.md` is created,
- `COMPLETED_GOAL_v2.19.1.md` rename is performed,
- Delivery report is complete.

---

# Out of Scope (Deferred)

The following are intentionally NOT in this milestone:

- **Trap entity integration.** Scene tiles or notes flagged as "disable-able" do not auto-surface task initiation. Player initiates via sheet button only. Trap entity work is a separate v2.21.0+ milestone.
- **Feat-scaled Aid bonus.** Confirmed unnecessary for current campaign — Kender do not have a Helpful-equivalent trait and no other Aid-scaling feats are in use. Flat +2 remains correct.
- **Interruption-on-damage prompts.** Manual pause/resume continues to be the workflow. Auto-interruption on HP damage is a separate v2.21.0+ milestone.
- **Quick Disable feat detection.** Manual GM override (skip task scaffold for Quick Disable PCs) continues. Detection-based skip is a separate later milestone.
- **Multi-GM concurrent-claim arbitration.** First-GM-to-claim assumption is acceptable for the single-GM campaign workflow.
- **Player-initiated tasks for skills not currently in the multi-round registry.** Only Disable Device is eligible for player initiation in v2.20.0. Survival, Heal, and other skills that may eventually become multi-round tasks remain GM-initiated only until their respective resolver paths are implemented in future milestones. The skill selector should be registry-driven so adding new skills later is a config change, not a UI rewrite.
