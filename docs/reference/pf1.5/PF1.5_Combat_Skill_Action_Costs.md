# Combat Skill Action Costs — PF1.5 Reference for Module Implementation

**Authoritative reference for `baphomet-utils` and companion module skill-resolution logic.**
**Companion to `PF1.5_Module_Mechanics_Reference.md`.**

---

## Core Rules

1. **Default in-combat skill cost = 1 action.** Exceptions are listed explicitly per skill.
2. **Reactive skill uses are free.** Passive Perception, passive Sense Motive, Spellcraft-to-identify-as-cast, etc.
3. **Movement-tied skill use does not double-charge.** Stealth-while-moving, Acrobatics-while-tumbling, Climb-while-moving, etc., consume the Move action's slot only — no additional skill-action cost on top.
4. **Multi-round tasks** are tracked via the task-progress system (see Disable Device below for the pattern). The actor commits 1 action per round to "continue working"; check resolves after the required number of round-commitments.
5. **Cannot-be-used-in-combat skills** (Diplomacy, Disguise, Linguistics, Profession) should warn the player or be disabled in encounter mode.

---

## Skill-by-Skill Table

| Skill | Default Cost | Common Exceptions / Notes |
|---|---|---|
| **Acrobatics** | 1 action | Tumble through enemy square = 1 action (costs movement). Standing from prone via Acrobatics = 1 action (replaces normal stand-up cost, doesn't provoke if check succeeds). Balance/jump checks during forced movement = no extra cost. |
| **Bluff** | 1 action | **Feint in combat = 1 action** (denies target Dex to AC against your next attack before end of next turn). Creating a diversion to Hide = 1 action. Innate Bluff during conversation = no cost (out of combat). |
| **Climb** | 1 action | Each round of climbing during combat = 1 action per move. Threatened-square climb still 1 action; failure may cause fall. |
| **Diplomacy** | **Cannot be used in combat** | PF1 default: 1+ minutes minimum. Hostile/aggressive parley = GM ruling. Module: do not auto-resolve in encounter mode. |
| **Disable Device** | **Multi-round task** (see Multi-Round Task Pattern below) | **Default:** GM-set duration — 1 round simple / 1d4 rounds typical / 2d4 rounds complex. Each round = 1 action committed to "Continue Disabling." Check rolls at completion. **Quick Disable feat / Trapfinder feature:** 1 action total, single attempt. **Simple lock (open):** 1 action per attempt. |
| **Disguise** | **Cannot be used in combat** | Requires 1d3+ minutes. Quick disguise feat = still out-of-combat only. |
| **Escape Artist** | 1 action | Per attempt. Escape from grapple/pin/manacles/rope all 1 action each. CMB-vs-grapple is interchangeable cost. |
| **Fly** | 1 action | Per maneuver. Hover, change direction beyond 45°, dive, etc. each cost 1 action. Routine straight-line flying = part of normal Move. |
| **Handle Animal** | 1 action | "Push" a trained animal beyond its training = 1 action. Issuing a known command to a trained animal = free or 1 action depending on complexity (GM call). |
| **Heal** | 1 action | First aid (stabilize dying creature) = 1 action. Treat poison/disease in combat = 1 action per attempt. Long-term care = out-of-combat only. |
| **Intimidate** | 1 action | **Demoralize in combat = 1 action** (Shaken for 1 round on success; longer with margin). Coerce target out of combat = minutes. |
| **Knowledge (any)** | 1 action | Identify creature via Knowledge = 1 action *or* free as part of perceiving the creature (GM call — most tables allow free identification on first sighting). Recall lore mid-combat = 1 action. |
| **Linguistics** | **Cannot be used in combat** | Reading/translating takes minutes minimum. |
| **Perception** | 1 action | **Active search** of an area = 1 action. **Passive Perception** (notice ambush, hidden creature) = no cost, opposed roll. Spotting something obvious = no cost. |
| **Perform** | 1 action | Bardic Performance maintenance = 1 action to start, then often free or part of other actions to maintain (class-feature-dependent). |
| **Profession** | **Cannot be used in combat** | Long-form work skill. |
| **Ride** | 1 action *or free* | Most riding maneuvers (guide with knees, fight from saddle, cover, fast mount/dismount) = 1 action. Ride checks integrated with mount's Move = part of movement, no additional cost. |
| **Sense Motive** | 1 action | **Active read** during conversation = 1 action. **Passive sense** (notice someone's lying mid-speech) = no cost, opposed roll. Hunch about a situation = 1 action. |
| **Sleight of Hand** | 1 action | Pickpocket = 1 action. Hide weapon/object on self = 1 action. Palm an item from a surface = 1 action. |
| **Spellcraft** | 1 action | **Identify a spell as it's cast** = no cost (reactive, automatic if trained). Identify a magic item via detect magic = 1 action. Counterspell via Spellcraft = uses prepared counterspell action (which has its own action cost). |
| **Stealth** | 1 action | **Initial hide** = 1 action. **Sneak** (move while hidden) = part of Move action, no additional cost. **Re-hide** after attacking = 1 action. **Sniping** (attack and re-hide same turn) = 2 actions total (attack + re-hide). |
| **Survival** | Variable | **Tracking in combat** = multi-round task pattern (1 action per round, GM-set duration). **Most uses out of combat.** Quick survival checks (notice tracks, identify weather change) = 1 action. |
| **Swim** | 1 action | Per move while swimming. Combat in water uses standard Strike costs; Swim checks gate movement only. |
| **Use Magic Device** | 1 action *or* spell-cost | Activate item with command word = 1 action. Cast spell from scroll/wand via UMD = uses spell's normal action cost (1/2/3) + UMD check. Emulating an alignment/race for item use = 1 action. |

---

## Multi-Round Task Pattern (Option A Implementation)

Some skill tasks take multiple rounds to complete. The actor commits 1 action per round to "continue working," and a single skill check resolves the entire effort at the end.

### How It Works

1. **Task is initiated.** GM (or trap stat block) sets the rounds required:
   - **Simple:** 1 round
   - **Typical:** 1d4 rounds (rolled when task begins, hidden from player)
   - **Complex:** 2d4 rounds
   - **Custom:** Any GM-defined value
2. **Each round, the actor commits 1 action** to "Continue [task]." This consumes 1 action from their 3-action turn but leaves the other 2 actions free for movement, defense, communication, 5-foot step, etc.
3. **After the required number of round-commitments**, the next 1-action commitment triggers the actual skill check resolution.
4. **Interruption is allowed.** The actor can pause work (skip a round, or commit to combat) and resume later. The module should preserve task-progress state across interruptions.
5. **Failure handling** (skill-specific):
   - **Disable Device:** Failure by 5+ usually triggers the trap; failure by 4 or less = no progress (must restart or continue).
   - **Other multi-round skills:** GM ruling per task.

### Skills That Use Multi-Round Task Pattern

- **Disable Device** (default for trap disable, complex locks)
- **Survival** (tracking in combat over difficult terrain)
- **Heal** (extended treatment in combat — rare)
- Custom GM-defined tasks (jury-rigging, ritual interruption, etc.)

### Skills That Have Multi-Round Variants But Default to Single-Action

- **Climb** (each round of climbing = 1 action; not "task" pattern, just per-round movement)
- **Swim** (same as Climb)
- **Fly** (same)

These are technically multi-round to traverse long distances, but each round resolves independently — they're not "build progress to one check" tasks.

### Module Implementation Notes

```javascript
// Pseudocode for multi-round task tracking
class CombatTask {
  actorId: string;
  skillId: string;             // 'dvs' for Disable Device, 'sur' for Survival, etc.
  taskName: string;            // human-readable: "Disable Trap (poison dart)"
  roundsRequired: number;      // hidden from player if GM rolls 1d4
  roundsCommitted: number;     // increments each round actor commits action
  startedRound: number;        // combat round when task started
  resolved: boolean;           // true once final check has fired
  metadata: object;            // trap DC, treasure DC, etc.
}

// On combatTurn for active actor:
//   - If actor has open task and chooses "Continue [task]":
//     - Spend 1 action
//     - Increment roundsCommitted
//     - If roundsCommitted >= roundsRequired: trigger check resolution next action
//   - If actor abandons or pauses task: preserve state, do not consume action
//   - If task is interrupted by damage/condition: GM ruling on whether progress is lost
```

### UI Considerations

- **The "Continue [task]" button** should appear in the actor's combat HUD whenever they have an open task. Clicking it consumes 1 action and increments progress.
- **Progress indicator** (e.g., "Disable Trap: 2/4 rounds") should be visible to the player so they can plan around it.
- **For tasks with hidden duration** (1d4 rounds rolled by GM), show progress as "Working..." without revealing the target. The check fires when the GM-set count is reached.
- **Task abandonment** should be a clear UI option (right-click → Abandon Task) so players don't get locked into multi-round commitments by accident.

---

## Reactive Skill Checks (Always Free)

These DO NOT increment the action counter:

- **Passive Perception** vs Stealth, traps, ambushes, hidden creatures
- **Passive Sense Motive** vs Bluff, lies, deception
- **Spellcraft** to identify a spell as it's being cast (automatic if trained, no action)
- **Class-feature-substituted reactive skills** (some Rogue talents, Inquisitor abilities, etc.)

The module should distinguish "active skill use" from "reactive skill check" — Foundry's `actor.rollSkill()` does not natively do this. A UI toggle or contextual flag is needed.

---

## Skills That Cannot Be Used in Combat

These have minimum time requirements measured in minutes or longer:

- **Diplomacy** (1+ minute minimum for any change in attitude)
- **Disguise** (1d3+ minutes for full disguise; 1d3 minutes minimum)
- **Linguistics** (reading/translating; not a quick-resolution skill)
- **Profession** (long-form work; not a combat skill)

The module should:
- **Warn the player** when they attempt one of these in combat-mode ("This skill takes 1 minute — use during downtime?")
- **Allow GM override** (some emergency uses might be valid; e.g., shouting hostile diplomacy at someone trying to charge you — but those are GM-adjudicated)
- **Not auto-consume an action** if the skill cannot resolve in combat

---

## Movement-Tied Skill Use (No Double-Charge)

These skills are integrated with the Move action and do NOT cost an additional action:

- **Stealth** while moving (Sneak)
- **Acrobatics** while tumbling through threatened squares
- **Climb** while moving up/down a surface
- **Swim** while moving through water
- **Fly** while moving on routine flight (straight-line, no maneuvers)
- **Ride** checks integrated with mount's Move

The skill check gates whether the movement succeeds. The action cost is the Move action only.

**Exception:** If the skill use is *separate* from movement (e.g., Stealth re-hide after attacking, Fly hover/maneuver), it costs 1 action separately.

---

## Aided Checks and Group Tasks

- **Aid Another:** 1 action by the aiding character. Adds +2 (or +N with relevant feats) to the primary character's check.
- **Cooperative checks** (multiple PCs working on one task): each contributing PC spends 1 action per round of contribution. For multi-round tasks, multiple PCs contributing in the same round can reduce the required round count proportionally (GM call).

---

## Feat-Modified Skill Costs

Several feats modify default skill action costs. The module should check for these on the actor:

| Feat / Class Feature | Effect |
|---|---|
| **Quick Disable** (Rogue talent / Trapfinder) | Disable Device = 1 action total (no multi-round task) |
| **Improved Feint** | Feint = free action once per turn (not 1 action) |
| **Skill Focus** | No action-cost change (just skill bonus) |
| **Quick Bull Rush / Quick Trip / etc.** | Combat maneuver-related, not skill — no action change |

When the module detects one of these feats on the actor, it should adjust the action cost for the relevant skill.

---

## Summary for Module Logic

```javascript
// Pseudocode for skill resolution in combat
function resolveSkillCheck(actor, skill, context) {
  const inCombat = game.combat?.combatants.has(actor.id);
  
  if (!inCombat) return rollSkillNormally(actor, skill);
  
  // Cannot-be-used-in-combat check
  if (CANNOT_USE_IN_COMBAT.includes(skill.id)) {
    return warnPlayerAndConfirm(actor, skill);
  }
  
  // Reactive use — free, no action cost
  if (context.isReactive) {
    return rollSkillNormally(actor, skill);
  }
  
  // Movement-tied use — already covered by Move action
  if (context.isMovementTied) {
    return rollSkillNormally(actor, skill);
  }
  
  // Multi-round task initiation
  if (MULTI_ROUND_TASKS.includes(skill.id) && !hasFeat(actor, 'quickDisable')) {
    return initiateMultiRoundTask(actor, skill, context);
  }
  
  // Multi-round task continuation
  if (actor.hasOpenTask(skill.id)) {
    return continueMultiRoundTask(actor, skill);
  }
  
  // Default: 1 action, immediate resolution
  if (!spendAction(actor, 1)) return false;
  return rollSkillNormally(actor, skill);
}
```

---

## Three Rules for Lyra to Internalize

1. **Default = 1 action.** When PF1 says "standard action," PF1.5 says "1 action." When PF1 says "move action," PF1.5 says "1 action." This is the universal default.

2. **Multi-round tasks use the Continue pattern.** Disable Device, complex Survival tracking, and similar tasks commit 1 action per round over multiple rounds. The actor retains agency over their other 2 actions per round. Module tracks task-progress state.

3. **Reactive uses are free; movement-tied uses don't double-charge.** Three exception classes that override the 1-action default. The module must distinguish these — Foundry's default skill-roll handler does not.

When the module sees a skill roll fire in combat, default to **1 action** and apply the table's exceptions. When in doubt, surface the ambiguity rather than smoothing past it.

---

*This document is maintained alongside `PF1.5_Module_Mechanics_Reference.md`. Last revision: includes Option A multi-round task pattern for Disable Device.*