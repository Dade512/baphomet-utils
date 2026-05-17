# PF1.5 Module Mechanics Reference
## Project Knowledge File for `baphomet-utils` and Companion Modules

**Purpose:** This document is the authoritative mechanical reference for the Echoes of Baphomet's Fall Foundry VTT module work. It is loaded into both Claude (Anthropic) and Lyra (GPT-5.5) project contexts. When this file conflicts with PF1 system defaults, the system defaults LOSE for any mechanic in PF1.5 scope. When this file conflicts with Foundry engine behavior, this file LOSES — engine behavior wins for raw API mechanics.

**Last verified canon source:** `Homebrew_Master_File.md` Section 2 (PF1 Three Action Hybrid System v1.2)

---

## 1. The 3-Action Economy

PF1.5 replaces standard/move/swift/full-round with a flat action economy:

- **3 Actions per turn** — Move, Strike, Cast, Use Skill, Manipulate, etc.
- **1 Reaction per round** — AoOs, Legacy Item abilities, class features (Parry, Counter-Spell, etc.)
- **5-Foot Step is FREE** — does not consume an action; one per turn; not allowed in turns where any Move action was used; does not provoke AoOs

**Implementation:** Action and reaction counts are tracked via module flags. PF1 has NO native PF1.5 awareness — every PF1.5 mechanic is module-side.

```javascript
// Action tracker - module flag
actor.getFlag(MODULE_ID, 'actions') || 0     // 0-3, increment as spent
actor.getFlag(MODULE_ID, 'reactions') || 0   // 0-1, increment as spent
actor.getFlag(MODULE_ID, 'swings') || 0      // attack swings made this turn (separate from actions)
```

**Reset hooks:**
- Reset on `combatTurn` for the active combatant
- Reset on `combatStart` for all combatants
- `pf1CombatTurnSkip` is a separate edge case — it fires only on skips, not as a per-turn hook

---

## 2. Attacks and the Multiple Attack Penalty (MAP)

### THE CORE RULE — MEMORIZE THIS

**There is no PF1 "full attack" in PF1.5.** The full-attack action is mechanically meaningless in our system. Every attack is a single **Strike** that costs **1 action** and produces **1 swing**.

### Strike Mechanics

| Property | Value |
|---|---|
| Action cost | 1 action |
| Swings advanced | +1 |
| Reaction cost | 0 |

### MAP — Tracked by Swing Count, NOT Action Sequence

| Swing # This Turn | Attack Bonus |
|---|---|
| 1st Strike | Full BAB |
| 2nd Strike | Full BAB |
| 3rd Strike | -5 penalty |
| 4th+ Strike | -5 cumulative per additional swing past the 2nd |

**Critical:** MAP is based on *total swings made this turn*, not which action slot the swing is in.

- Strike → Move → Strike: both Strikes at full BAB (only 2 swings made).
- Move → Move → Strike: Strike at full BAB (1 swing made).
- Strike → Strike → Strike: 1st full, 2nd full, 3rd at −5.
- Strike → Strike → Move → (Reaction Strike via AoO): AoO at full BAB (reactions don't advance MAP); MAP for next turn's strikes still resets.

**Maximum 3 Strikes per turn from actions alone.** Extra attacks come only from feats (TWF, Rapid Shot) or class features (Haste, Flurry).

### Reactions and AoOs

- AoOs are always at **full BAB**.
- AoOs do **NOT** advance MAP.
- AoOs cost **0 actions** and **1 reaction**.
- Once a reaction is spent, no further reactions until the start of the actor's next turn.

### Haste, TWF, and Bonus Attacks

These cases need explicit rulings — they are NOT covered as crisply as Strikes in canon:

- **Haste:** Grants an extra attack at full BAB at the highest BAB per canonical PF1. **Provisional ruling:** the Haste attack costs 1 action like any other Strike, BUT the Haste swing itself ignores MAP (always at full BAB). It still increments the swing counter for purposes of OTHER strikes' MAP.
- **TWF off-hand:** Each off-hand attack costs 1 action and increments swings. The TWF feat chain (Incremental Mastery — main hand clean at ITWF, both clean at GTWF) grants opportunity to make off-hand attacks; the feats don't free the attacks from the economy.
- **Rapid Shot, Manyshot, etc.:** Same principle. Feats *enable* extra swings within the 3-action turn; each swing still costs 1 action and advances MAP.

When in doubt: **the Strike costs 1 action, advances 1 swing, follows MAP unless explicitly stated otherwise.**

### Module Implementation Pattern

```javascript
Hooks.on('pf1PreActionUse', (actionUse) => {
  const actor = actionUse.actor;
  const item = actionUse.item;

  if (!isAttackAction(item, actionUse)) return; // non-attacks: action cost only

  if (isReaction(actionUse)) {
    if (!spendReaction(actor)) return false;
    return; // reactions do NOT increment swing counter
  }

  if (!spendAction(actor, 1)) return false;

  const swings = actor.getFlag(MODULE_ID, 'swings') || 0;
  const mapPenalty = swings >= 2 ? -5 * (swings - 1) : 0;

  if (mapPenalty < 0) {
    // Inject penalty into rollConfig — verify exact field path against PF1 system
    // ⚠️ UNCONFIRMED PATH — verify
    actionUse.attackBonus = (actionUse.attackBonus || 0) + mapPenalty;
  }

  actor.setFlag(MODULE_ID, 'swings', swings + 1);
});
```

### UI Rules for the PF1 Full-Attack Button

The full-attack button MUST be hidden or disabled for PF1.5-flagged actors. Letting it surface invites mis-rolls and breaks the action economy.

---

## 3. Spells

- **Cantrips / 0-level:** 1 action.
- **1st-level and higher (standard cast):** 2 actions.
- **Full-round spells (Summon Monster, etc.):** 3 actions.
- **Quickened spells:** 1 action (via metamagic).
- **Spell-Like Abilities:** Match the action cost of the equivalent spell unless specified.

This prevents spell spam while preserving caster mobility.

---

## 4. Skills and Other Activities

- Most active skill uses (Disable Device, Acrobatics tumble, etc.): **1 action** unless the skill explicitly takes longer.
- Drawing a weapon, sheathing a weapon, picking up an item, opening a door: **1 action each** (was a "move action" in PF1 — same cost, simpler labeling).
- Total Defense: **1 action** for +4 dodge AC until start of next turn.
- Withdraw: **2 actions** to move full speed without provoking AoOs from the starting square.
- Charge: **2 actions** (move + attack); attack at full BAB +2, AC −2 until next turn.
- Run: **3 actions** for ×4 speed in a straight line.

---

## 5. Conditions

PF1.5 uses PF2e-style **tiered** and **toggle** conditions, replacing standard PF1e conditions of the same name.

### Tiered Conditions (graded 0–N)

These store as integer flags. 0 = inactive, no negative tiers.

| Condition | Max Tier | Effect Per Tier |
|---|---|---|
| Frightened | 4 | −1 per tier on attacks/saves/skill checks/ability checks; flee at tier 4 |
| Sickened | 4 | −1 per tier on attacks/damage/saves/skills |
| Stunned | 4 | Lose actions per tier (1/2/3/all); −2 AC; flat-footed |
| Slowed | 4 | Lose actions per tier (see action economy interaction below) |

### Binary / Toggle Conditions

These are on/off only. Numbering them is an error.

- **Fascinated** (binary — confirmed via Fix 4 of campaign continuity audit)
- **Confused** (binary — defaults to PF1e behavior)
- **Staggered** (binary — lose 1 action per turn while active; do NOT write "Staggered X")
- **Paralyzed** (binary — helpless)
- **Pinned** (binary)
- **Prone** (binary)
- **Flat-Footed** (binary — no Dex to AC; no AoOs)
- **Dazzled** (binary — −1 attack rolls, −1 Perception checks involving sight; **no other effects**)
- **Helpless** (binary)

### Critical: Dazzled Does NOT Block Reactions

Dazzled is a minor visual penalty only. It does NOT affect action economy, AoOs, or reactions. If a homebrew ruling needs "you weren't ready" mechanics, use **Flat-Footed** as the wrapper, not a custom Dazzled extension.

### Staggered + Slowed Stacking

Both reduce available actions, but they do NOT add. Take the **maximum actions lost** between them:

```javascript
const stagFromCondition = actor.statuses.has('staggered') ? 1 : 0;
const slowedTier = actor.getFlag(MODULE_ID, 'tieredCondition.slowed') || 0;
const actionsLost = Math.max(stagFromCondition, slowedTier);
const finalActions = Math.max(0, 3 - actionsLost);
```

| Combination | Actions Lost | Final Actions |
|---|---|---|
| Staggered alone | 1 | 2 |
| Slowed 1 alone | 1 | 2 |
| Slowed 2 alone | 2 | 1 |
| Slowed 3 alone | 3 | 0 |
| Staggered + Slowed 1 | max(1,1) = 1 | 2 |
| Staggered + Slowed 2 | max(1,2) = 2 | 1 |
| Staggered + Slowed 3 | max(1,3) = 3 | 0 |

### Reading Conditions (Canonical Path)

```javascript
// Use these:
actor.statuses.has('staggered')                    // toggle conditions
actor.system.conditions.staggered                  // also valid
actor.getFlag(MODULE_ID, 'tieredCondition.slowed') // module-owned tiered conditions

// AVOID:
actor.system.attributes.conditions  // STALE - do not use
actor.hasCondition()                // does not exist
actor.addCondition()                // does not exist
actor.removeCondition()             // does not exist
```

---

## 6. Critical Hits

- **No-confirm crits.** A natural 20 is automatically a critical hit (no confirmation roll).
- Threat range still applies: 19–20 weapons threaten on 19 or 20, but the threat itself is still rolled. If the natural die shows a 20, auto-confirmed; if it shows a 19, the threat must still beat AC normally for the hit to be a crit (some readings differ — verify against current Homebrew Master).
- Crit multipliers function as canon (×2, ×3, etc.).

---

## 7. Damage Scaling

Damage scales by **half character level** added as innate damage to all attacks (rounded down):

| Character Level | Innate Damage |
|---|---|
| 1 | +0 |
| 2 | +1 |
| 3 | +1 |
| 4 | +2 |
| 5 | +2 |
| 6 | +3 |
| ... | (½ level, rounded down) |

This is in addition to all other damage modifiers (Str, weapon, enhancement, etc.). It does NOT apply to spell damage unless explicitly stated.

For NPCs and creatures: apply **+½ HD** to damage on the same scale. This is the campaign's "innate damage scaling" rule and must be applied consistently.

---

## 8. Legacy Items

Legacy Items replace the PF1 "Big Six" magic item economy:

- Each PC gets one Legacy Item — chosen by **Form** (weapon, armor, focus, etc.) and **Path** (mechanical progression archetype).
- Legacy Items advance through tiers as the campaign progresses (Tier 1 → 2 → 3 → 4 → Ascendant).
- Tier advancement is narrative + mechanical: each tier unlocks new abilities AND adjusts the underlying numerical bonus.
- Avoid "+N enhancement bonus" language — instead use "Legacy Item Form advances to Tier N" or "Legacy Item Tier N progression."
- Legacy Item abilities frequently consume the Reaction.

---

## 9. Class Restrictions

- **No Sorcerers.** The Sorcerer class is not playable in this campaign.
- All other PF1 classes are available unless explicitly noted in the Homebrew Master.

---

## 10. Foundry Module Implementation Anti-Patterns (FORBIDDEN)

These break either the engine or the campaign rules. Never use:

- Patching `ActorPF.prototype` / `ItemPF.prototype` / any PF1 prototype.
- Mutating `pf1.config` at runtime.
- Writing to another module's flag namespace.
- `actor.hasCondition()`, `actor.addCondition()`, `actor.removeCondition()` — DO NOT EXIST.
- `renderChatMessage` (v12 only — use `renderChatMessageHTML` for v13).
- `renderItemActionSheet` (does not exist in PF1 — use `pf1DisplayCard`).
- `combatRoundChange` (not a v13 hook — use `combatRound`).
- Treating `pf1CombatTurnSkip` as a per-turn hook (only fires on skips).
- Async pre-hook handlers expecting cancellation — Promises are never `false`.
- Hardcoded `system.*` data paths beyond `actor.system.conditions`.
- jQuery on V2 render hook results — V2 passes `HTMLElement`.
- Pure white (`#fff`), neon glow, gradient hover states in module UI.
- Treating PF1 "full attack" as a meaningful action in PF1.5.

---

## 11. PF1.5-Specific Code Markers

When writing module code, use these comment markers:

```javascript
// MODULE DESIGN PATTERN — NOT NATIVE PF1
// ⚠️ UNCONFIRMED PATH — verify against PF1 system version
```

When PF1.5 mechanics are ambiguous, **flag the ambiguity rather than smoothing past it.** Surface tradeoffs between UI clarity, v13 compatibility, PF1.5 behavior, and PF1 default fallback. Never silently choose.

---

## 12. Quick Reference Card

| Action | Cost | Notes |
|---|---|---|
| Strike (single attack) | 1 action, 1 swing | MAP based on swing count |
| AoO / Reaction | 0 actions, 1 reaction | Full BAB, no MAP advance |
| 5-Foot Step | Free | Once per turn, not after Move |
| Move | 1 action | Standard movement |
| Withdraw | 2 actions | No AoO from starting square |
| Charge | 2 actions | +2 attack, −2 AC |
| Run | 3 actions | ×4 speed, straight line |
| Cast 0-level | 1 action | |
| Cast 1+ level | 2 actions | |
| Cast Full-round | 3 actions | |
| Quickened spell | 1 action | Via metamagic |
| Total Defense | 1 action | +4 dodge AC |
| Skill check (active) | 1 action | Default |
| Draw / Sheathe weapon | 1 action | |

---

## 13. When in Doubt

1. **Consult `Homebrew_Master_File.md` Section 2** (PF1 Three Action Hybrid System) for canon.
2. **Default behavior:** PF1 single-attack semantics, modified by the rules above.
3. **Surface ambiguity** rather than picking silently. Mark with `// ⚠️` and explain the conflict.
4. **PF1.5 wins over PF1 defaults** for any mechanic in PF1.5 scope. PF1 wins for raw engine behavior outside PF1.5 scope.

---

*This document is maintained alongside `Homebrew_Master_File.md`. When the master file updates, this reference must be revised to match. Last revision: PF1.5 v1.2 framework with v1.3 patch pending.*
