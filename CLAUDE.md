# CLAUDE.md — baphomet-utils Repository Rules

## Project Identity

You are working on:

```text
baphomet-utils
```

A custom Foundry VTT module for Michael’s Pathfinder 1.5 hybrid campaign environment.

The module supports:

- Foundry VTT v13.350+
- Pathfinder 1e (`pf1`) system
- PF1.5 house-rule mechanics layered on top of PF1
- Croaker’s Ledger visual language and UI style

This repository is **module code only**:

- JavaScript logic
- CSS styling
- Foundry API integration
- PF1/PF1.5 mechanical automation
- developer documentation

Do **not** produce:

- campaign lore
- session logs
- narrative content
- encounter design
- story/worldbuilding material

---

## Active Milestone Rule

All implementation work must be governed by the single active root-level file:

```text
GOAL_v*.md
```

Exactly one `GOAL_v*.md` should exist in the repository root at any time. Completed milestones are renamed `COMPLETED_GOAL_v*.md` and retained for history. The current `GOAL_v*.md` defines the active scope, file allowlist, and done definition.

### Required behavior

Before editing code:

1. Read this `CLAUDE.md`.
2. List the repository root and identify the single active `GOAL_v*.md` file.
3. Read the active goal file end-to-end.
4. Read any reference documents explicitly required by the active goal.
5. State the exact files you expect to touch.
6. Stay within the file allowlist in the active goal.

### Stop condition

If more than one root-level `GOAL_v*.md` file exists (excluding `COMPLETED_GOAL_v*.md`), or no goal file exists when a goal-driven task is requested:

```text
STOP and ask Michael which milestone is active.
```

Do not infer the active goal.

---

## Runtime Truth Boundary

Claude may prepare a deployable candidate. Claude may **not** claim that a feature works in Foundry unless the active goal explicitly includes browser automation that actually verifies it.

Foundry runtime behavior is authoritative.

### Never claim:

- “tested in Foundry”
- “works live”
- “runtime confirmed”
- “fully verified”

unless the transcript contains the actual runtime test output.

### Required milestone boundary

At the end of a goal-driven implementation, create:

```text
RUNTIME_VERIFICATION_REQUIRED.md
```

This file must clearly state:

- the implementation candidate is prepared
- runtime verification is still required
- Michael must run the local Foundry checklist before tagging or deploying
- the next milestone must not begin until runtime verification is complete

---

## Local Development Environment

Local Foundry development uses:

```text
Foundry Data Path:
S:\FoundryVTTData
```

Local dev server address:

```text
http://192.168.56.1:30001
```

The local Foundry module folder:

```text
S:\FoundryVTTData\Data\modules\baphomet-utils
```

is a Windows junction pointing to the actual working repository:

```text
S:\Campaign Material\Modules\baphomet-utils
```

Therefore:

```text
Edit repository files → reload local Foundry → test immediately
```

Do not assume production-server testing unless Michael explicitly says so.

---

## Source-of-Truth Reference Documents

Claude cannot rely on external project knowledge. Use the repository-local docs under:

```text
docs/reference/
```

### Core PF1.5 mechanics

Read and obey when relevant:

```text
docs/reference/pf1.5/PF1.5_Module_Mechanics_Reference.md
docs/reference/pf1.5/PF1.5_Combat_Skill_Action_Costs.md
docs/reference/pf1.5/Background Skills.md
docs/reference/pf1.5/house-rules-and-aesthetic.md
```

### Foundry / PF1 API safety

Read and obey before using or changing Foundry/PF1 API interactions:

```text
docs/reference/foundry-v13/00_READ_FIRST_Foundry_v13_API_Safety_and_Migration.md
docs/reference/foundry-v13/99_Combined_Foundry_v13_PF1_[KnowledgeFiles.md].md
docs/reference/foundry-v13/foundry-and-pf1.md
```

### Module workflow/review docs

Use when reviewing architecture or release quality:

```text
docs/reference/module-workflow/00_READ_FIRST_Foundry_PF1_Module_Dev_Index.md
docs/reference/module-workflow/00_READ_FIRST_Foundry_PF1_Module_Review_Checklist.md
```

---

## No API Invention Rule

If a Foundry VTT v13 class, method, hook, signature, or PF1 hook/payload is not confirmed in the local reference documents:

```text
STOP and ask Michael for the specific class page, hook reference, or runtime diagnostic.
```

Do not invent APIs.

Do not smooth past uncertainty.

Do not assume behavior from older Foundry versions.

When using a Foundry or PF1 API in a plan, implementation note, or delivery report:

```text
Name the local reference document that supports it.
```

Example:

```text
Using `pf1ActorRollSkill` because it is listed in
`docs/reference/foundry-v13/99_Combined_Foundry_v13_PF1_[KnowledgeFiles.md].md`.
```

---

## Foundry VTT v13 Technical Rules

Target:

```text
Foundry VTT v13.350+
PF1 system
```

### Required

- Use v13-safe APIs.
- Use namespaced v13 API paths where applicable.
- Treat modern render hook element arguments as `HTMLElement` only when confirmed by local docs/runtime data.
- Normalize DOM roots safely if a hook surface may return wrappers or legacy structures.
- Maintain compatibility with current module architecture unless the active goal explicitly authorizes refactoring.

### Do not do unless explicitly requested

- Do not migrate the module from `"scripts"` to `"esmodules"`.
- Do not perform global architecture rewrites.
- Do not patch PF1 prototypes.
- Do not mutate `pf1.config`.
- Do not assume deprecated globals are safe long-term.
- Do not introduce jQuery assumptions into v13 hook code.
- Do not alter unrelated module systems for “cleanup.”

---

## PF1.5 Mechanics Precedence

PF1.5 campaign mechanics override PF1 default assumptions when within PF1.5 module scope.

The authoritative rule files are:

```text
PF1.5_Module_Mechanics_Reference.md
PF1.5_Combat_Skill_Action_Costs.md
```

### High-priority PF1.5 rules

#### Action economy

PF1.5 uses:

```text
3 Actions + 1 Reaction
```

Do not reintroduce PF1 standard/move/swift/full-round assumptions unless the active goal explicitly maps one to PF1.5 behavior.

#### No PF1 Full Attack

There is no PF1 “full attack” in PF1.5.

Every attack is a single Strike that costs 1 action and produces 1 swing.

The current module already suppresses the PF1 Full Attack button in `AttackDialog` while PF1.5 Mode is enabled.

Do not restore or bypass that suppression.

#### MAP / strike tracking

MAP/swing tracking is future work unless the active goal explicitly includes it.

Do not implement MAP opportunistically.

#### Dazzled

Dazzled is binary and imposes only:

```text
-1 to attacks
-1 to sight-based Perception
```

It does not block:

- reactions
- AoOs
- action economy

Do not alter Dazzled behavior unless the active goal explicitly says so.

#### Staggered + Slowed

Use:

```text
actions lost = max(actions lost from each condition source)
remaining actions = max(0, 3 - actions lost)
```

Do not convert this into additive loss.

#### Combat skill costs

Default in-combat active skill cost:

```text
1 action
```

Exceptions and categories are defined in:

```text
PF1.5_Combat_Skill_Action_Costs.md
```

Important examples:

- reactive skill use can be free
- movement-tied skill use should not double-charge
- Disable Device uses Multi-Round Task Pattern, not 3 actions at once
- certain skills should warn instead of consuming actions in combat

---

## Current Implemented Systems

Treat these as existing behavior that should not be regressed unless the active goal explicitly changes them.

### Action panel

Floating tactical action panel with:

```text
Spend 1
Spend 2
Spend 3
```

Current labels include:

```text
1 — Swing / Move
2 — Cast / Ready
3 — F.Cast / Run
```

Manual action spending is all-or-nothing and uses current active combatant state.

### Skill auto-spend

Approved skill rolls can spend actions automatically for the active combatant when enabled.

Perception remains excluded.

Disable Device currently:

- does not auto-spend
- warns that PF1.5 multi-round task handling applies
- does not yet run through task automation automatically

### Full Attack suppression

PF1 Full Attack is hidden from the `AttackDialog` when PF1.5 Mode is enabled.

### Multi-Round Task Scaffold

Current version includes API-only multi-round task scaffolding:

```text
game.baphometTasks
```

with methods for:

- `createTask`
- `getTask`
- `getTasks`
- `commitAction`
- `pauseTask`
- `resumeTask`
- `abandonTask`
- `resolveTask` — stub only

Public task state is stored on actor flags.

Hidden task duration/metadata is stored on the creating GM user’s flags.

Current single-GM hidden-data workflow is accepted.

---

## Croaker’s Ledger UI Rules

Use the Croaker’s Ledger visual language.

### Palette

- parchment: `#d1c6b4`, `#beb09b`
- leather: `#8a7b66`
- primary text: `#2a231d`
- faded inactive text: `#5e5246`
- tarnished brass accent: `#9e7d43`
- dried blood accent: `#6e2a22`

### Typography

- headers/labels: `Courier Prime`
- body text: `Alegreya`
- mechanical values/numbers: `IBM Plex Mono`

### Visual tone

- battered ledger
- utilitarian tactical readability
- no glowing borders
- no neon
- no glossy sci-fi panels
- no modern glassmorphism

### CSS discipline

Prefer existing `--baph-*` custom properties where available.

Do not introduce arbitrary new raw hex values unless necessary and documented.

---

## Scope Discipline

### Do only the active goal

If a bug, improvement, or related future feature is discovered outside the active goal:

1. Do not implement it.
2. Add it to the report as:
   ```text
   Follow-up docket item
   ```
3. Continue the active goal only.

### Examples of unacceptable scope drift

- Implementing Disable Device task integration during a read-only task widget milestone
- Adding MAP because attack data is nearby
- Refactoring settings files “while already there”
- Changing existing action panel mechanics when only the display is requested
- Rewriting actor flag storage unless the goal explicitly authorizes it

---

## File Touching Rules

The active `GOAL_v*.md` file defines the allowed file list for the milestone.

Do not edit files outside that allowlist.

If a file outside the allowlist appears necessary:

```text
STOP and ask Michael before touching it.
```

---

## Documentation and Versioning Rules

If the active goal includes a version bump, update all expected versioned docs:

- `module.json`
- `README.md`
- `DEV_NOTES.md`

Do not bump beyond the active milestone version.

Do not silently change the release title.

Keep README and DEV_NOTES aligned with actual behavior.

---

## Validation Rule

Before presenting work as complete for a goal-driven milestone, run:

```text
node tools/validate.mjs
```

If validation fails:

1. fix the issue if it is within scope
2. re-run validation
3. do not claim completion until the validator passes

At goal completion, transcript output should include:

- validator pass/fail result
- changed files summary
- diff scope summary
- runtime checklist/sentinel creation confirmation

---

## Goal Turn Cap

Every goal-driven autonomous run must obey a hard turn cap.

Default:

```text
40 turns maximum
```

If completion has not been reached by then:

1. stop work
2. create:
   ```text
   _goal_aborted.md
   ```
3. summarize:
   - completed work
   - remaining work
   - blocking issue
   - exact recommended next step

Do not continue indefinitely.

---

## Runtime Sentinel Rule

At the end of a milestone implementation candidate, create:

```text
RUNTIME_VERIFICATION_REQUIRED.md
```

This file must say that:

- code candidate exists
- runtime testing remains required
- Michael must execute the local Foundry checklist
- no next milestone should begin until runtime verification is complete

Do not delete this file yourself unless the active goal explicitly instructs it and Michael has confirmed testing is complete.

---

## Git / Deployment Rules

Do not assume permission to:

- commit
- push
- open PRs
- tag releases
- deploy to the Linux production server

unless the active goal explicitly authorizes those actions.

Current default workflow:

```text
Claude prepares candidate locally
→ Michael reviews/tests locally
→ Michael handles GitHub/deploy steps unless stated otherwise
```

Note: GitHub deployment is currently on hold while local testing continues. Treat all work as local-first until Michael explicitly clears a tag for upstream push.

---

## Required Delivery Report Format

When finishing a scoped implementation pass, report:

1. Goal/version implemented.
2. Files changed.
3. Whether all changes stayed inside the allowlist.
4. Reference docs consulted.
5. Key implementation points.
6. Explicitly untouched systems.
7. Validator result.
8. Runtime verification status.
9. Created support files:
   - `SERVER_TESTING_CHECKLIST.md`
   - `RUNTIME_VERIFICATION_REQUIRED.md`
   - `_goal_aborted.md` if applicable
10. Follow-up docket items, if any.

---

## Final Reminder

This repository is not a general Foundry playground.

It is a live-play Pathfinder 1.5 module where:

- mechanical correctness matters
- runtime truth matters
- scope control matters
- conservative changes beat clever guesses

When uncertain:

```text
STOP.
Name what is unclear.
Name the missing reference or runtime proof.
Ask Michael.
```
