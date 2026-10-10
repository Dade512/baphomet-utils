/* ============================================================
   ECHOES OF BAPHOMET — PF1.5 CONDITION OVERLAY v2.9
   Applies PF2e-style conditions as PF1e system Buffs.

   v2.45.0 Changes (GOAL_v2.45.0_ABILITY_CHECKS — "Every Roll That Uses It", TD-83):
   - [FIX-1] Canon (rewritten 2026-10-06): a PF1 ability penalty reaches every roll that uses the
     ability, so Clumsy, Enfeebled and Stupefied now reach ability checks. Clumsy writes ac / ref /
     dexSkills / rattack / dexChecks; Enfeebled writes mattack / mwdamage / twdamage / strSkills /
     carryStr / strChecks / cmd (and no longer fort); Stupefied writes will / dc / intSkills /
     wisSkills / chaSkills / intChecks / wisChecks / chaChecks. `dexChecks` already reaches
     initiative (live fact L-3), so Clumsy writes no `init`. Enfeebled's `cmd` lands on the first
     prepare (L-2). Stupefied still writes nothing for attacks (Q2: P-3 kept). Existing buffs are
     rebuilt by the v2.43.0 `refreshConditionChanges` at the first GM load; no new migration code.
   - [FIX-2] The three cards name the new rolls (Dex ability checks and initiative; CMD and Str
     ability checks, not Fortitude; Int-, Wis- and Cha-based ability checks).

   v2.43.0 Changes (GOAL_v2.43.0_CONDITION_CANON — "The Number on the Card"):
   - [FIX-1] Clumsy, Enfeebled and Stupefied write -X to the rolls canon names (CC:33-35, H:384-397)
     instead of lowering an ability score. None of the three writes an ability score, an ability
     check or initiative. Clumsy writes ac / ref / dexSkills / rattack; Enfeebled writes mattack /
     mwdamage / twdamage / fort / strSkills / carryStr; Stupefied writes will / dc / intSkills /
     wisSkills / chaSkills. `tattack`, `cmb`, `nattack` and `ndamage` are deliberately NOT written:
     pf1 already applies the base target to those rolls (SF-3, SF-4, SF-5 — live facts supplied by
     Michael, read on dev with pf1 11.11), so writing them would lower the roll twice.
   - [FIX-2] Frightened and Sickened add `allChecks` (ability checks and initiative, once); Sickened's
     damage change is `wdamage` (weapon damage), not `damage`.
   - [FIX-3] Fatigued writes no changes; applying it sets pf1's own `fatigued` status (-2 Str / -2 Dex).
   - [FIX-4] Fascinated is on/off with one change: -4 to `skill.per`.
   - [FIX-5] The pf1RegisterConditions pass gives pf1's `cowering` and `squeezing` a `cmd` change copied
     from their own `ac` change (R-1: every AC penalty reaches CMD); `neutralizeState().cmdAdded`.
   - [FIX-6] Cards say what canon says. Drained and Persistent Dmg leave the catalog.
   - [FIX-7] `refreshConditionChanges(actors)` and `conditionOrphanAudit(actors)`; both run once at
     `ready` on the active GM's client.
   - [FIX-10] Every write of a Ledger buff's changes ends with one more write (`changesAt`), so pf1's
     second prepare moves CMD for an `ac` change; re-applying a tier rewrites the card.

   v2.42.0 Changes (GOAL_v2.42.0_OFF_GUARD_FLEEING — "Caught Off-Guard"):
   - [FIX-1] The neutralize pass records every pf1 registry entry that ships `loseDexToAC` BEFORE it
     clears anything, derives the pf1 Off-Guard source set (recorded minus the frozen six), then
     clears `loseDexToAC` on `flatFooted`, `cowering` and `pinned` (and Pinned's `dexMod` cap) so
     Off-Guard replaces it. A source set that differs from the pinned ten is warned about, never
     acted on. The canary expects the cleared tier-1 entries.
   - [FIX-2] Off-Guard is derived from Blinded, a running Stunned countdown, Ledger Paralyzed, any
     active pf1 status in the source set, the initiative source, and the GM's force-on flag.
     `_syncOffGuard` is still the sole writer. Every translator check ends with it.
   - [FIX-3] The initiative source: a creature is Off-Guard until its first turn STARTS in a started
     combat the module flagged at `combatStart` (Uncanny Dodge blocks this source only).
   - [FIX-4] `uncannyDodgeAudit()` whispers the GM the actors whose Uncanny Dodge lacks the flag.
   - [FIX-5] `fleeing` joins the catalog; a translated Panicked also writes Fleeing.
   - API: `offGuardState()`, `offGuardSources()`, `loseDexDrift()`, `uncannyDodgeAudit()`.

   v2.41.0 Changes (GOAL_v2.41.0_CONDITION_TRANSLATOR — "What the Icon Means"):
   - [FIX-2/FIX-3] Condition translator (end of file): when one of nine pf1 statuses appears on an
     actor, the active GM's client applies the matching Ledger condition (setting
     `autoConditionTranslate` ON) or whispers the GM a card to Apply or Skip (OFF). A status that
     goes away releases only what the translator itself created and only for the conditions that
     do not count themselves down. Adds `game.baphometConditions.translationTable()`,
     `translatorLog()`, `translatorIdle()` and `resolveTranslation()`.
   - [FIX-4] `paralyzed` and `deafened` no longer emit their own changes (pf1's own statuses write
     Dex/Str 0 and initiative -4); applying either also sets pf1's status, and removing the Ledger
     condition clears that status only when the buff recorded that it set it (`setPf1Status`).

   v2.9 Changes (GOAL_v2.37.3_CONDITION_CANON — "What the Card Claims"):
   - [FIX-5] Off-Guard is now fully helper-managed. `_syncOffGuard(actor)` is the SOLE writer of
     the `offGuard` buff Item, derived from (blinded present) OR (stunnedCountdown > 0) OR
     (paralyzed present), OR the new `offGuardForced` actor flag (module-scoped, boolean) written
     only by the manual GM toggle / macro API force-on path. `applyCondition`/`removeCondition`
     no longer create or delete the `offGuard` Item directly for the `offGuard` key — they only
     set/unset `offGuardForced` and delegate. Idempotent (zero document writes when derived/forced
     inputs are unchanged), non-re-entrant (never calls back into `applyCondition`/
     `removeCondition`), and GM-gated via `_isActiveGMClient()` (mirrors `_handleAutoDecrement`).
     This closes D-5 THE STACKING TRAP: multiple simultaneous sources (e.g. Blinded + Stunned)
     now produce exactly ONE derived `-2 ac` instance, matching canon's non-stacking rule, instead
     of each source emitting its own `-2 ac` independently. Derived-transition chat is posted only
     on an actual create/delete transition (never on a no-op sync) and names the deriving source
     rather than reading as a manual GM action.
   - [FIX-1] `blinded`: deleted the dead `-2 allAttack` change — probe-confirmed (GOAL v2.37.3
     probe 1/2) to resolve to ZERO pf1 `ItemChange` data paths on either actor type, so it has
     never once applied; per the STANDING PRINCIPLE and RULED-1 it is DELETED, not repointed to a
     live key, because repointing would activate an unauthorized penalty that has never applied at
     the table. Also deleted the dead `-4 skills.per` change (RULED-4/FIX-6 — canon grants a
     sense-specific sight-based auto-fail on Perception, not a flat penalty; `skills.per` was also
     independently dead, 0 data paths). `buildChanges` now emits only `-4 ac`; Off-Guard's `-2`
     comes from FIX-5's helper, landing on canon's net −6 (probe-3-confirmed stacking shape, no
     modifier tuning needed). Card text rewritten to drop three unenforced claims (DEX-bonus loss,
     total concealment, STR/DEX skill penalty) and mark half-speed / attackers'-+2-to-hit as
     table-adjudicated, not enforced.
   - [FIX-6/RULED-4] `deafened`: deleted the same dead `-4 skills.per` change (0 data paths, never
     applied to Perception). `-4 init` is UNCHANGED. Card no longer claims a flat Perception
     penalty; the hearing-based auto-fail canon actually grants is table-adjudicated, not
     expressible as an `ItemChange`. The unenforced 20% arcane spell failure claim is left
     unchanged — out of scope, docketed, not fixed here.
   - [FIX-4] `offGuard` card: removed the false claim that flanking is an Off-Guard source in
     PF1.5 (canon: Improved Uncanny Dodge's flanking immunity does not interact with Off-Guard at
     all — that is PF2 bleed-through). Surprise stays — it is canon. Reworded to describe the buff
     as derived (FIX-5) and the GM toggle as a force-on override, not a direct write.
   - `stunned` (FIX-2) / `paralyzed` (FIX-3): `buildChanges` UNCHANGED (`[]` / `-20 dex`
     respectively) — both are now Off-Guard SOURCES read by FIX-5's helper instead of each
     emitting its own `-2 ac`. `stunned`'s countdown lifecycle and `paralyzed`'s Dex-0
     approximation are untouched.
   - `nauseated`'s dead `-20 allAttack` is DELIBERATELY UNTOUCHED — see STANDING PRINCIPLE and
     RULED-1. Repointing it would activate an unauthorized -20 attack penalty that has never once
     applied at the table. Docketed as an activation decision, not fixed as a typo.
   - `_decrementStunnedCountdown`'s call site (inside `_handleAutoDecrement`) now also calls
     `_syncOffGuard` after the countdown pays down, so a countdown reaching zero without routing
     back through `removeCondition` (it does route through `removeCondition('stunned')` at zero,
     which itself re-syncs) still cannot leave a stale derived Off-Guard behind.

   v2.8 Changes (GOAL_v2.34.0_CONDITION_CANON — "The Single Tally"):
   - [MECH-3] Removed the `staggered` CONDITIONS entry entirely. Canon
     (SS5 "Folded / Retired Conditions") forbids a live tracked Staggered
     condition — PF1 Staggered folds into Slowed 1 at the point of
     application. No automated conversion path existed (GM-selected UI
     toggle only), so this is a clean removal, not a redirect.
   - [Stunned countdown] Added a genuine, persisted Stunned countdown
     lifecycle, distinct from the Stunned buff's own `tier` flag (see the
     "STUNNED COUNTDOWN LIFECYCLE" comment block near
     `_decrementStunnedCountdown` below for the full flag shape and
     decrement mechanics, and action-tracker.js's `_readConditionActionLoss`
     for the read side). Handles the round-4 mid-turn-application-skip
     case (SS5:224 "starting NEXT turn") via a proactive breadcrumb read
     rather than re-deriving the departing combatant reactively.
   - [Prior-combatant identification — architecture change] `_getPriorCombatantId`
     (which read `combat.current.turn`/`updateData.turn`, then in a disproven
     fix attempt `combat.combatant`) is REMOVED. Both were reactive reads at
     `combatTurn`/`combatRound`/`pf1PostTurnChange` hook-fire time and both
     were disproven by live two-seat re-verification — Foundry combat-state
     propagation is not guaranteed settled at that exact moment in this
     environment. Replaced with `_getBreadcrumbCombatant`, which reads
     `globalThis.baphometActiveCombatant` — a value STAMPED proactively by
     action-tracker.js's render-based turn-start detection (a point already
     proven safe; see that file's header comment on
     `_stampActiveCombatantBreadcrumb`), not re-derived at hook-fire time.
     Fail-safe: returns null (no decrement performed) if the breadcrumb is
     missing or belongs to a different combat, rather than guessing.
   - [TRUST-4] `_handleAutoDecrement`'s gate changed from bare
     `game.user.isGM` (true for every connected GM-role client
     simultaneously) to `_isActiveGMClient()` — mirrors
     `task-tracker.js`'s `_baphTaskIsActiveGMClient()` pattern
     (`game.user?.isGM && game.user === game.users?.activeGM`). Prevents
     two connected GM-role clients from each independently decrementing
     the same turn transition.

   v2.7 Changes:
   - [BUG FIX] Turn/round hooks (combatTurn, combatRound) could
     throw "Cannot read properties of undefined (reading 'length')"
     during a transient state where combat.turns is briefly
     undefined or empty — observed with monks-combat-details
     triggering initiative re-rolls on round advance. Added
     Array.isArray + length guards in _getPriorCombatantId and
     in the combatRound handler before any turns[] access.

   v2.7.1 Changes:
   - [SECURITY] _postConditionChat: actor.name is now escaped with
     foundry.utils.escapeHTML() before interpolation into chat HTML.
     Previously raw, allowing a maliciously-named actor to inject
     arbitrary HTML into condition notification messages.

   v2.6 Changes:
   - [LEAK FIX] Token HUD condition panel's MutationObserver was
     created on each open as a closure-local variable. Manual
     close (clicking the button again) removed the panel but
     did NOT disconnect the observer — it would linger until
     the HUD itself mutated. Hoisted the observer reference to
     the outer scope so both manual-close and HUD-mediated-close
     paths can disconnect cleanly.
   - [HARDENING] DOM normalization for the renderTokenHUD hook
     now uses the shared _baphNormalizeHtml helper
     (scripts/dom-utils.js) instead of an inline guard.

   v2.5 Changes:
   - [BUG FIX] Auto-decrement (Frightened, Stunned) was not
     firing on turn advance. Root cause: pf1PostTurnChange hook
     may not fire reliably in all PF1e v13 builds, AND the
     combatTurn fallback had a guard that skipped it whenever
     pf1PostTurnChange had any listeners registered.
   
   - New approach: Use Foundry core hooks (combatTurn, combatRound)
     as PRIMARY triggers. pf1PostTurnChange kept as secondary.
     Debounce flag prevents double-decrements if multiple hooks
     fire for the same turn change.
   
   - Added console logging for all auto-decrement events.

   v2.5.1 Changes:
   - Clamp helper: use Math.clamp (the Foundry v13 helper). NOTE: an earlier
     note here had this backwards — Math.clamped is deprecated (since v12) and
     removed in v14, so Math.clamp is the correct, forward-compatible call.

   TIERED, by range:
     1-4:   Frightened, Sickened, Stupefied, Clumsy, Enfeebled
     1-3:   Slowed
     1-10:  Fleeing
     no cap: Stunned (v2.44.0 — `uncapped`; the panel draws buttons 1-12, but a
             larger value is kept and counts down)
   TOGGLE (on/off): Fatigued, Fascinated, Off-Guard,
                    Blinded, Deafened, Nauseated, Confused,
                    Paralyzed
   (Staggered is NOT a live tracked condition — SS5 folds it into Slowed 1
   at the point of application; see v2.8 Changes above, MECH-3.)

   For Foundry VTT v13 + PF1e System
   Source: PF1 Three Action Hybrid System.md §9 and Condition_Conversion.md
   ============================================================ */

const MODULE_ID = 'baphomet-utils';

/* ----------------------------------------------------------
   CORRUPTED EDGE SVG FILTER INJECTION
   ---------------------------------------------------------- */

function _injectCorruptedEdgeFilter() {
  if (document.getElementById('baph-corrupted-edge')) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'baph-svg-filters');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
  svg.setAttribute('aria-hidden', 'true');

  svg.innerHTML = `
    <defs>
      <filter id="baph-corrupted-edge" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="linearRGB">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.065 0.12"
          numOctaves="3"
          seed="7"
          stitchTiles="stitch"
          result="noise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale="3.5"
          xChannelSelector="R"
          yChannelSelector="G"
          result="displaced"
        />
      </filter>
    </defs>
  `;

  document.body.appendChild(svg);
}

/* ----------------------------------------------------------
   CONDITION DEFINITIONS
   ---------------------------------------------------------- */

const CONDITIONS = {

  // ======== TIERED CONDITIONS (value 1–4) ========

  frightened: {
    name: 'Frightened',
    icon: 'icons/svg/terror.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to attack rolls, saving throws, skill checks, and ability checks (initiative included). Decreases by 1 at end of your turn.',
    autoDecrement: true,
    buildChanges(tier) {
      const v = String(-tier);
      // v2.43.0 FIX-2 (P-4): `allChecks` reaches the six ability-check modifiers and initiative, and
      // not skills (SF read live 2026-10-05), so it never overlaps `skills`; no separate `init` change.
      return [
        { formula: v, operator: 'add', target: 'attack',         modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'allSavingThrows', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'skills',         modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'allChecks',      modifier: 'penalty', priority: 0 },
      ];
    }
  },

  sickened: {
    name: 'Sickened',
    icon: 'icons/svg/poison.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to attack rolls, weapon damage rolls, saving throws, skill checks, and ability checks (initiative included). Does not decrease automatically; a specific action, spell or ability removes or reduces it.',
    autoDecrement: false,
    buildChanges(tier) {
      const v = String(-tier);
      // v2.43.0 FIX-2 (P-4): `wdamage` (weapon damage) replaces `damage`, which also reached spells;
      // `allChecks` adds ability checks and initiative once.
      return [
        { formula: v, operator: 'add', target: 'attack',         modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'wdamage',        modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'allSavingThrows', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'skills',         modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'allChecks',      modifier: 'penalty', priority: 0 },
      ];
    }
  },

  stupefied: {
    name: 'Stupefied',
    icon: 'icons/svg/daze.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to spell DCs, Will saves, Int-, Wis- and Cha-based skill checks, and Int-, Wis- and Cha-based ability checks. An attack roll that uses a mental ability takes –X from the GM.',
    autoDecrement: false,
    buildChanges(tier) {
      const v = String(-tier);
      // v2.45.0 FIX-1 (TD-83): -X to the rolls, never an ability score. `intChecks`, `wisChecks` and
      // `chaChecks` add the three mental ability checks (canon: a PF1 ability penalty reaches every
      // roll that uses the ability). No PF1 attack roll uses a mental ability by default, so nothing
      // is written for attacks (Q2: P-3 kept, the GM applies it); no `allChecks`.
      return [
        { formula: v, operator: 'add', target: 'will',      modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'dc',        modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'intSkills', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'wisSkills', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'chaSkills', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'intChecks', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'wisChecks', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'chaChecks', modifier: 'penalty', priority: 0 },
      ];
    }
  },

  clumsy: {
    name: 'Clumsy',
    icon: 'icons/svg/falling.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to AC (and CMD), Reflex saves, ranged and thrown attack rolls, Dex-based skill checks, and Dex ability checks (initiative included). A finesse melee attack, and damage that uses Dexterity, take –X from the GM. Stacks with Off-Guard.',
    autoDecrement: false,
    buildChanges(tier) {
      const v = String(-tier);
      // v2.45.0 FIX-1 (TD-83): -X to the rolls, never `dex`. `dexChecks` adds Dex ability checks, and it
      // already reaches initiative (live fact L-3), so there is no `init` change (it would land twice).
      // `ac` reaches CMD (FIX-10 supplies the second prepare), so there is no `cmd` change.
      // `rattack` alone covers a thrown attack: a thrown roll already adds both `rattack` and `tattack`
      // (SF-3, live fact supplied by Michael), so `tattack` is NOT written, to avoid lowering it twice.
      return [
        { formula: v, operator: 'add', target: 'ac',        modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'ref',       modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'dexSkills', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'rattack',   modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'dexChecks', modifier: 'penalty', priority: 0 },
      ];
    }
  },

  enfeebled: {
    name: 'Enfeebled',
    icon: 'icons/svg/downgrade.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to melee attack rolls, combat maneuver checks, CMD, melee and thrown weapon damage, Str-based skill checks, and Str ability checks; carrying capacity as if Strength were X lower. The –X also reaches a finesse melee attack; whether it should is the GM\'s call. A composite bow\'s Strength damage takes –X from the GM.',
    autoDecrement: false,
    buildChanges(tier) {
      const v = String(-tier);
      // v2.45.0 FIX-1 (TD-83): -X to the rolls, never `str` or `allChecks`. `strChecks` adds Str ability
      // checks; `cmd` adds CMD and lands on the first prepare (live fact L-2). `fort` is gone: canon's
      // Fortitude uses Constitution, so Enfeebled does not reach it.
      // `cmb`, `nattack` and `ndamage` are deliberately NOT written (live facts supplied by Michael,
      // read on dev with pf1 11.11): a real maneuver roll already adds `mattack` (SF-4), and `mattack`
      // and `mwdamage` already reach a natural attack and its damage (SF-5), so each would be lowered
      // twice. `mattack` / `mwdamage` / `twdamage` are the base targets that carry canon's -X.
      return [
        { formula: v, operator: 'add', target: 'mattack',   modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'mwdamage',  modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'twdamage',  modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'strSkills', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'carryStr',  modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'strChecks', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'cmd',       modifier: 'penalty', priority: 0 },
      ];
    }
  },

  stunned: {
    name: 'Stunned',
    icon: 'icons/svg/stoned.svg',
    // v2.44.0 FIX-1: Stunned has no cap. `maxTier` is only the panel's button range (1-12),
    // never a clamp — `uncapped` makes applyCondition and the v2.43.0 rebuild keep any whole
    // number >= 1. Never `Infinity`: the panel draws one button per tier up to `maxTier`.
    maxTier: 12,
    uncapped: true,
    type: 'tiered',
    description: 'You lose X actions on your next turn. If Stunned exceeds 3, excess carries over to subsequent turns. While Stunned is above 0 you are also Off-Guard and cannot take reactions.',
    // v2.34.0: `autoDecrement: true` still marks this as an auto-decrementing condition for
    // the token HUD's "↓" indicator, but `_handleAutoDecrement` skips 'stunned' in its
    // generic per-tier -1 loop — the real decrement is the bespoke, multi-action
    // `_decrementStunnedCountdown` (see that function's comment block below), driven by the
    // separate `stunnedCountdown` actor flag, not this buff's own `tier`.
    // v2.37.3 FIX-2: `buildChanges` stays `[]`, unchanged. `stunned` is now one of FIX-5's
    // Off-Guard SOURCES — `_syncOffGuard` derives Off-Guard from `stunnedCountdown > 0` directly,
    // rather than this condition emitting its own `-2 ac`. No change to the countdown lifecycle.
    autoDecrement: true,
    buildChanges(_tier) {
      return [];
    }
  },

  slowed: {
    name: 'Slowed',
    icon: 'icons/svg/clockwork.svg',
    maxTier: 3,
    type: 'tiered',
    description: 'You lose X actions at the start of each turn (persistent while condition lasts). Does not decrease automatically.',
    autoDecrement: false,
    buildChanges(_tier) {
      return [];
    }
  },

  fascinated: {
    name: 'Fascinated',
    icon: 'icons/svg/eye.svg',
    maxTier: 1,
    type: 'toggle',
    description: 'PF1 Fascinated: entranced by a supernatural or spell effect — you stand or sit quietly, taking no actions other than paying attention to it. –4 on Perception (applied) and on other skill checks made as reactions (by the GM). A potential threat allows a new saving throw; an obvious threat (a weapon drawn, a spell cast, a ranged weapon aimed at you) breaks it. An ally may shake you free (PF1: a standard action).',
    autoDecrement: false,
    buildChanges() {
      // v2.43.0 FIX-4 (R-2, P-5): on/off, PF1 as written. Exactly one change: -4 to Perception.
      // Other reactive skill checks are the GM's; no `skills` change.
      return [
        { formula: '-4', operator: 'add', target: 'skill.per', modifier: 'penalty', priority: 0 },
      ];
    }
  },

  // v2.42.0 FIX-5 (R-2, P-f): behavioural, no numeric changes. `maxTier: 10` is a tracker limit, not
  // a rule (P-f): a fear source longer than 10 rounds is extended by hand from the panel. It counts
  // down with Frightened in `_handleAutoDecrement`, unchanged. Description from canon § Fleeing.
  fleeing: {
    name: 'Fleeing',
    icon: 'icons/svg/door-exit.svg',
    maxTier: 10,
    type: 'tiered',
    description: 'On your turn you must spend your actions moving away from the source of your fear by the most direct safe route. You cannot willingly move toward it or take offensive actions against it (you may defend yourself if cornered). You provoke attacks of opportunity normally — Fleeing is not the Withdraw action. Decreases by 1 at end of your turn.',
    autoDecrement: true,
    buildChanges(_tier) {
      return [];
    }
  },

  // ======== TOGGLE CONDITIONS (on/off, no tiers) ========

  fatigued: {
    name: 'Fatigued',
    icon: 'icons/svg/unconscious.svg',
    maxTier: 1,
    type: 'toggle',
    description: 'PF1 Fatigued: –2 to Strength and Dexterity (pf1\'s own Fatigued status applies them; this condition adds none of its own). Cannot run or charge. Anything that would fatigue you again makes you exhausted. Ends after 8 hours of complete rest.',
    autoDecrement: false,
    buildChanges() {
      // v2.43.0 FIX-3 (R-2): pf1's own `fatigued` status carries -2 Str / -2 Dex and is the only
      // writer; applying this condition sets that status (see `_LEDGER_PF1_STATUS`).
      return [];
    }
  },

  offGuard: {
    name: 'Off-Guard',
    icon: 'icons/svg/target.svg',
    maxTier: 1,
    type: 'toggle',
    // v2.37.3 FIX-4: 'flanking' deleted from the source list — canon (master :867) is explicit
    // that flanking is NOT an Off-Guard source in PF1.5 (Improved Uncanny Dodge's flanking
    // immunity does not interact with Off-Guard at all; that claim was PF2 bleed-through).
    // 'Surprise' stays — canon (master :658). Reworded: v2.37.3 FIX-5 makes this buff fully
    // derived (Blinded / Stunned-countdown>0 / Paralyzed) via _syncOffGuard, the sole writer; the
    // GM toggle below is now a force-on override feeding that helper, never a direct write.
    // v2.42.0 FIX-2: the description names canon's sources (Blinded, Stunned, Paralyzed, Cowering,
    // Pinned, flat-footed, the Dex-0 conditions, not yet having acted in an encounter).
    description: '–2 penalty to AC (and CMD). You are a valid target for precision damage (sneak attack and similar). (Formerly Flat-Footed.) Automatically derived from Blinded, Stunned, Paralyzed, Cowering, Pinned, flat-footed, the Dex-0 conditions (Dying, Helpless, Petrified, Asleep, Stable, Unconscious), and not yet having acted in an encounter (Uncanny Dodge excepted); also granted by surprise. The GM toggle force-applies Off-Guard as an override — it no longer writes the buff directly.',
    autoDecrement: false,
    buildChanges() {
      return [
        { formula: '-2', operator: 'add', target: 'ac', modifier: 'untyped', priority: 0 },
      ];
    }
  },

  blinded: {
    name: 'Blinded',
    icon: 'icons/svg/blind.svg',
    maxTier: 1,
    type: 'toggle',
    // v2.37.3 FIX-1: three unenforced claims removed — 'Loses DEX bonus to AC' (canon v1.6
    // replaced this with Off-Guard), 'total concealment (50% miss chance)' (appears in neither
    // authority), and the attack-penalty implication that backed the now-deleted 'allAttack'
    // change below. FIX-6/RULED-4 also drops the flat Perception-penalty claim — canon grants a
    // sight-based auto-fail, not a flat -4. Sentence order below is deliberate: the auto-fail
    // clause precedes the '-4' AC figure so no dead numeric substring reads as a Perception
    // penalty claim.
    description: 'Cannot see. Automatically fails sight-based Perception checks (table-adjudicated, not enforced). –4 penalty to AC (plus Off-Guard, net –6 AC total). Half speed and attackers\' +2 to hit are table-adjudicated, not enforced.',
    autoDecrement: false,
    buildChanges() {
      return [
        // v2.37.3 FIX-1 / RULED-1: '-2 allAttack' DELETED here, not repointed. Probe 1/2
        // (GOAL_v2.37.3_CONDITION_CANON.md, live against Foundry 13.351 / pf1 11.11) confirmed
        // 'allAttack' resolves to ZERO pf1 ItemChange data paths on both character and npc actors
        // — this change has NEVER applied, on any actor, ever. Per the STANDING PRINCIPLE, a dead
        // key is not silently repointed to a live one: doing so would activate a -2 attack
        // penalty that has never once applied at the table. OPEN CANON QUESTION, docketed and
        // NOT resolved here (see "Follow-up docket items" in GOAL_v2.37.3_CONDITION_CANON.md):
        // whether Blinded should carry an enforced attack penalty at all. Do not re-derive this
        // change from the card's old description text and re-introduce it.
        { formula: '-4', operator: 'add', target: 'ac', modifier: 'penalty', priority: 0 },
        // v2.37.3 FIX-6 / RULED-4: '-4 skills.per' DELETED here, not repointed to 'skill.per'.
        // Canon (master :656, :815) grants a SENSE-SPECIFIC auto-fail on sight-based Perception,
        // not a flat -4 — a flat -4 would also wrongly penalise this creature's hearing-based
        // Perception. 'skills.per' was independently dead (probe 2: 0 data paths), so this moves
        // no numbers. The auto-fail itself is table-adjudicated; no ItemChange expresses it.
      ];
    }
  },

  deafened: {
    name: 'Deafened',
    icon: 'icons/svg/deaf.svg',
    maxTier: 1,
    type: 'toggle',
    // v2.37.3 FIX-6/RULED-4: flat Perception-penalty claim removed — canon (master :657, :816)
    // grants a hearing-based auto-fail, not a flat -4 (see buildChanges comment below). The 20%
    // spell failure claim was out of scope for v2.37.3 (see GOAL_v2.37.3_CONDITION_CANON.md);
    // v2.43.0 made the card every caster's, so it now reads "(every caster)".
    // Sentence order is deliberate: the auto-fail clause precedes the '-4' initiative figure so
    // no dead numeric substring reads as a Perception penalty claim.
    description: 'Cannot hear. Automatically fails hearing-based Perception checks (table-adjudicated, not enforced). pf1\'s own Deaf status applies the –4 penalty to initiative (this buff adds none of its own). 20% spell failure chance on spells with verbal components (every caster).',
    autoDecrement: false,
    buildChanges() {
      // v2.41.0 FIX-4 (D-2, P-5): the module's `-4 init` is RETIRED — pf1's own `deaf` status
      // carries `init:-4:untyped:add:0`, and with both set initiative counted -8. pf1's status is
      // now the only writer; `applyCondition` sets it when it is not already on the actor.
      return [
        // v2.37.3 FIX-6 / RULED-4: '-4 skills.per' DELETED here, not repointed to 'skill.per'.
        // Canon (master :657, :816) grants a SENSE-SPECIFIC auto-fail on hearing-based
        // Perception, not a flat -4 — a flat -4 would also wrongly penalise this creature's
        // sight-based Perception. 'skills.per' was independently dead (probe 2: 0 data paths),
        // so this moves no numbers. The auto-fail itself is table-adjudicated; no ItemChange
        // expresses it. deafened is NOT an Off-Guard source (FIX-5) — this deletion is the only
        // scope for this condition in this release.
      ];
    }
  },

  nauseated: {
    name: 'Nauseated',
    icon: 'icons/svg/acid.svg',
    maxTier: 1,
    type: 'toggle',
    description: 'You lose 1 action at the start of your turn (2 actions remain, as Slowed 1). None of your remaining actions may be used to attack or to cast a spell; you may move, reposition, withdraw, drink a potion, or take other non-offensive actions.',
    autoDecrement: false,
    buildChanges() {
      return [
        { formula: '-20', operator: 'add', target: 'allAttack', modifier: 'penalty', priority: 0 },
      ];
    }
  },

  confused: {
    name: 'Confused',
    icon: 'icons/svg/daze.svg',
    maxTier: 1,
    type: 'toggle',
    description: 'Acts randomly each round: 01–25 act normally, 26–50 babble incoherently, 51–75 deal 1d8+STR to self, 76–100 attack nearest creature. Cannot make attacks of opportunity.',
    autoDecrement: false,
    buildChanges() {
      return [];
    }
  },

  paralyzed: {
    name: 'Paralyzed',
    icon: 'icons/svg/paralysis.svg',
    maxTier: 1,
    type: 'toggle',
    description: 'Cannot move, speak, or take any physical action. pf1\'s own Paralyzed status sets Dex and Str to 0 (this buff adds no penalty of its own). Melee attackers get +4 to hit. Vulnerable to coup de grace.',
    autoDecrement: false,
    buildChanges() {
      // v2.41.0 FIX-4 (D-2, P-5): the module's `-20 dex` is RETIRED — a redundant second writer
      // beside pf1's own `paralyzed` status (Dex and Str set to 0), ruled 2026-08-29 (TD-38 R1;
      // also closes TD-09(d)). pf1's status is now the only writer; `applyCondition` sets it
      // when it is not already on the actor (see `_ledgerSetsPf1Status`).
      // `paralyzed` stays one of FIX-5's Off-Guard SOURCES — `_syncOffGuard` derives Off-Guard
      // from this buff's presence directly, rather than this condition emitting its own `-2 ac`.
      return [];
    }
  },
};

/* ----------------------------------------------------------
   BUFF MANAGEMENT
   ---------------------------------------------------------- */

function _buffName(condKey, tier) {
  const cond = CONDITIONS[condKey];
  if (cond.type === 'toggle') return cond.name;
  return `${cond.name} ${tier}`;
}

function _findExistingBuff(actor, condKey) {
  return actor.items.find(i =>
    i.type === 'buff' &&
    i.getFlag(MODULE_ID, 'conditionKey') === condKey
  );
}

/* ----------------------------------------------------------
   OFF-GUARD — FIX-5, v2.37.3 (GOAL_v2.37.3_CONDITION_CANON, D-5 THE STACKING TRAP)

   Off-Guard is fully helper-managed. `_syncOffGuard` is the SOLE writer of the `offGuard` buff
   Item. Canon states, twice, that Off-Guard does not stack (master :869, reference :306): four
   simultaneous sources still produce exactly ONE `-2 ac` instance. `applyCondition('offGuard', n)`
   and `removeCondition('offGuard')` (below) do NOT create or delete the Item themselves — they
   only set/unset the `offGuardForced` actor flag (the manual GM toggle / macro API's force-on
   override) and delegate here.

     derived = blinded buff present OR (stunnedCountdown > 0) OR paralyzed buff present
     forced  = actor.getFlag(MODULE_ID, 'offGuardForced') === true
     want    = derived || forced
     have    = the existing offGuard buff, if any

     want && !have  -> create the buff (the single -2 ac change, unchanged from CONDITIONS.offGuard)
     !want && have  -> delete the buff
     otherwise      -> NO-OP. No rewrite, no re-create, no chat. This is what makes repeat calls
                       with unchanged inputs perform zero document writes (idempotency — the
                       property that prevents TD-24's churn shape and is what case 7's non-GM-seat
                       churn guard tests).

   Call sites: the end of `applyCondition`/`removeCondition` for any of the three source keys
   (`blinded`, `stunned`, `paralyzed`) and the `offGuard` key itself, and after
   `_decrementStunnedCountdown` runs (inside `_handleAutoDecrement`, below).

   Non-re-entrant: this function manipulates the Item directly via `createEmbeddedDocuments`/
   `delete()` and must NEVER call `applyCondition`/`removeCondition` — the same discipline
   `_decrementStunnedCountdown` already follows (see that function's comment block).

   GM-gated: guarded by `_isActiveGMClient()` (defined further below in this file; a function
   declaration, so hoisting makes it available here), mirroring `_handleAutoDecrement`'s own gate.
   An ungated helper writing Items from every connected GM-role client, or from a non-GM client
   whose flag write happened to go through, would reproduce the FD-06/TD-24 churn signature this
   goal's case 7 exists to guard against.
   ---------------------------------------------------------- */

/* ----------------------------------------------------------
   OFF-GUARD SOURCES — v2.42.0 (GOAL_v2.42.0, FIX-2/FIX-3; R-1, R-3, R-4, R-7)

   `_offGuardDerived(actor)` returns the sorted source tokens that hold (the force-on flag is
   added by `_offGuardSources`):

     ledger:blinded     the Ledger Blinded buff exists
     ledger:stunned     stunnedCountdown > 0
     ledger:paralyzed   the Ledger Paralyzed buff exists
     pf1:<id>           actor.statuses holds an id in the pf1 source set recorded by the neutralize
                        pass (see `_baphNeutralizeState.loseDexSources`)
     initiative         FIX-3 — a combatant whose turn has not started in a started, flagged combat;
                        the ONLY source Uncanny Dodge blocks
     forced             offGuardForced (the GM's force-on flag)

   Grappled, Entangled, Fatigued and flanking are not sources (R-7): they carry no `loseDexToAC`.
   Uncanny Dodge is pf1's item boolean flag, read as `actor.itemFlags.boolean.uncannyDodge` (R-1).
   A combatant belongs to an actor only when `combatant.actor?.uuid === actor.uuid` — never by
   actorId or `combat.getCombatantsByActor`, which also returns an actor's unlinked tokens.
   ---------------------------------------------------------- */

const _OFFGUARD_PF1_LABELS = Object.freeze({
  cowering: 'Cowering', dying: 'Dying', flatFooted: 'Flat-Footed', helpless: 'Helpless',
  paralyzed: 'Paralyzed', petrified: 'Petrified', pinned: 'Pinned', sleep: 'Asleep',
  stable: 'Stable', unconscious: 'Unconscious',
});

function _offGuardPf1SourceIds() {
  return _baphNeutralizeState?.loseDexSources ?? [];
}

function _offGuardHasUncannyDodge(actor) {
  return !!actor?.itemFlags?.boolean?.uncannyDodge;
}

// FIX-3: the initiative source. Holds for an actor that is a combatant (matched by uuid) in a started
// combat the module flagged at its start (P-k, P-g) whose combatant lacks the turn-start mark.
function _offGuardInitiativeHolds(actor) {
  if (!actor || _offGuardHasUncannyDodge(actor)) return false;
  const uuid = actor.uuid;
  for (const combat of Array.from(game.combats ?? [])) {
    if (combat?.started !== true) continue;
    if (combat.getFlag(MODULE_ID, 'offGuardInitiative') !== true) continue;
    for (const combatant of Array.from(combat.combatants ?? [])) {
      if (combatant.actor?.uuid !== uuid) continue;
      if (combatant.getFlag(MODULE_ID, 'offGuardTurnStarted') !== true) return true;
    }
  }
  return false;
}

function _offGuardDerived(actor) {
  const sources = [];
  if (_findExistingBuff(actor, 'blinded')) sources.push('ledger:blinded');
  if ((Number(actor.getFlag(MODULE_ID, 'stunnedCountdown')) || 0) > 0) sources.push('ledger:stunned');
  if (_findExistingBuff(actor, 'paralyzed')) sources.push('ledger:paralyzed');
  for (const id of _offGuardPf1SourceIds()) {
    if (actor.statuses?.has(id)) sources.push(`pf1:${id}`);
  }
  if (_offGuardInitiativeHolds(actor)) sources.push('initiative');
  return sources.sort();
}

// Derived sources plus the GM's force-on flag, sorted.
function _offGuardSources(actor) {
  const sources = _offGuardDerived(actor);
  if (actor.getFlag(MODULE_ID, 'offGuardForced') === true) sources.push('forced');
  return sources.sort();
}

function _offGuardTokenLabel(token) {
  switch (token) {
    case 'ledger:blinded': return 'Blinded';
    case 'ledger:stunned': return 'Stunned';
    case 'ledger:paralyzed': return 'Paralyzed';
    case 'initiative': return 'not yet acted';
    case 'forced': return 'manual override';
    default: {
      const id = String(token).startsWith('pf1:') ? String(token).slice(4) : String(token);
      return _OFFGUARD_PF1_LABELS[id] ?? id;
    }
  }
}

function _offGuardSourceLabel(actor, sources) {
  const labels = [...new Set((sources ?? _offGuardSources(actor)).map(_offGuardTokenLabel))];
  return labels.length ? labels.join(' + ') : 'unknown';
}

// P-j: a transition whose only source, before or after, is the initiative source posts no chat line.
function _offGuardInitiativeOnly(sources) {
  return Array.isArray(sources) && sources.length === 1 && sources[0] === 'initiative';
}

// Named as a distinct function from `_postConditionChat`: a derived Off-Guard transition is not
// a GM action (nobody clicked anything) and must be named as what it is — the chat-noise call the
// goal leaves to the implementer, recorded in the delivery report.
function _postOffGuardSyncChat(actor, created, sourceLabel) {
  const cond = CONDITIONS.offGuard;
  const color = created ? 'var(--baph-gold, #b8943e)' : 'var(--baph-success-bright, #5a9a5a)';
  const label = created
    ? `Off-Guard — derived (${sourceLabel})`
    : 'Off-Guard cleared — no active source';

  const safeActorName = foundry.utils.escapeHTML(actor.name);

  ChatMessage.create({
    content: `<div style="font-family: var(--baph-font-heading, 'Courier Prime', monospace); text-transform: uppercase; letter-spacing: 0.05em; color: ${color}; font-size: 13px;">
      ${safeActorName} — ${label}
    </div>
    ${created ? `<div style="font-family: var(--baph-font-body, 'Alegreya', serif); color: var(--baph-text-secondary, #8a919d); font-size: 12px; margin-top: 2px;">
      ${cond.description}
    </div>` : ''}`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

// v2.42.0 FIX-2: syncs now arrive from the translator's checks as well as from `applyCondition`,
// `removeCondition` and the countdown, so two can overlap for one actor; each reads `have` before it
// writes. They are serialised per actor so the second always reads what the first wrote.
const _offGuardSyncChain = new Map();

async function _syncOffGuard(actor) {
  if (!actor) return;
  if (!_isActiveGMClient()) return;

  const uuid = actor.uuid;
  const run = (_offGuardSyncChain.get(uuid) ?? Promise.resolve())
    .catch(() => {})
    .then(() => _syncOffGuardNow(actor));
  _offGuardSyncChain.set(uuid, run);
  try {
    await run;
  } finally {
    if (_offGuardSyncChain.get(uuid) === run) _offGuardSyncChain.delete(uuid);
  }
}

async function _syncOffGuardNow(actor) {
  const cond = CONDITIONS.offGuard;
  const sources = _offGuardSources(actor);
  const want = sources.length > 0;
  const have = _findExistingBuff(actor, 'offGuard');
  // v2.42.0 P-j: the Off-Guard buff's own `offGuardSources` flag is the authoritative record of the
  // sources that last held, so a reload or a change of active GM reads the same truth. It is written
  // at creation and rewritten below whenever the sorted sources change while the buff stays.
  const before = have?.getFlag(MODULE_ID, 'offGuardSources') ?? null;

  if (want && !have) {
    const changes = cond.buildChanges();
    const descHtml = `<p><strong>${cond.name}:</strong> ${cond.description}</p>`;

    const [created] = await actor.createEmbeddedDocuments('Item', [{
      img: cond.icon,
      name: _buffName('offGuard', 1),
      type: 'buff',
      system: {
        subType: 'temp',
        description: { value: descHtml },
      },
      flags: {
        [MODULE_ID]: {
          conditionKey: 'offGuard',
          tier: 1,
          autoDecrement: cond.autoDecrement,
          conditionType: cond.type,
          offGuardSources: sources,
        }
      }
    }]);

    if (changes.length > 0) {
      await pf1.components.ItemChange.create(changes, { parent: created });
    }
    await created.setActive(true);

    if (!_offGuardInitiativeOnly(sources)) {
      _postOffGuardSyncChat(actor, true, _offGuardSourceLabel(actor, sources));
    }
  } else if (!want && have) {
    await have.delete();
    if (!_offGuardInitiativeOnly(before)) {
      _postOffGuardSyncChat(actor, false, null);
    }
  } else if (want && have) {
    // Buff stays: record the sources only when they differ from the record. No chat, no other write;
    // a repeat call with unchanged sources is a complete no-op.
    const recorded = Array.isArray(before) ? Array.from(before).sort() : null;
    if (!recorded || JSON.stringify(recorded) !== JSON.stringify(sources)) {
      await have.setFlag(MODULE_ID, 'offGuardSources', sources);
    }
  }
  // otherwise: NO-OP. No rewrite, no re-create, no chat — idempotent by construction.
}

/* ----------------------------------------------------------
   THE INITIATIVE SOURCE — v2.42.0 (GOAL_v2.42.0, FIX-3; R-4, P-g, P-k)

   A creature is Off-Guard until its first turn STARTS in an encounter. Two module-owned flags:

     Combat    flags['baphomet-utils'].offGuardInitiative = true  — set by the active GM's client
               at `combatStart`; only a flagged combat feeds the source, so a combat started before
               this release (no turn marks) never makes everyone Off-Guard at its first check (P-k).
     Combatant flags['baphomet-utils'].offGuardTurnStarted = true — set when that combatant's turn
               starts, in a started, flagged combat. It lives on the combatant, so it ends with the
               combat, and a Delay (an initiative write) cannot clear it.

   HOW THE TURN START IS DETECTED: by a read of `combat.combatant` in a LATER MACROTASK
   (`setTimeout(…, 0)`, the translator's scheduling pattern) after `combatStart` and after an
   `updateCombat` whose changes carry `turn` or `round` — never at hook-fire time (three hook-time
   reads of the turn are disproven, see the PROACTIVE BREADCRUMB comment below). It does NOT use
   the render-based `globalThis.baphometActiveCombatant` stamp.

   `combatStart` fires BEFORE `startCombat()` saves { round: 1, turn: 0 } (verified in the served
   Foundry 13 client), so at `combatStart` the combat may still read `started === false`. Both paths
   therefore run the SAME handler, which re-reads `combat.started`, the P-k flag and `combat.combatant`
   at the time it runs and marks only when all three hold; the `combatStart` path awaits the flag
   first. ORDER: the handler awaits the mark's write and only THEN schedules the translator checks
   for the combat's combatants — writing the mark triggers no re-check by itself (the Combatant
   hook below ignores everything but an initiative change), so a check scheduled before the mark
   landed would leave a stale Off-Guard behind. Checks are scheduled ONLY after the mark is
   confirmed: a not-yet-started or unflagged combat, a missing combatant, a non-GM client or a
   failed write schedules nothing.

   Hook references: docs/reference/foundry-v13/99_Combined_Foundry_v13_PF1_[KnowledgeFiles.md] —
   `combatStart(combat, updateData)` (:2337), `updateCombatant(combatant, changes, options, userId)`
   (:2767), the document lifecycle pattern create/update/delete<Document> (:2177, :2306); the
   `updateCombat`, `createCombatant`, `deleteCombatant` and `deleteCombat` hooks are the same ones
   scripts/action-tracker.js already uses.
   ---------------------------------------------------------- */

// Schedule a translator check (FIX-2) for every combatant's actor in a combat.
function _offGuardScheduleCombat(combat) {
  for (const combatant of Array.from(combat?.combatants ?? [])) {
    try { _translatorSchedule(combatant.actor); } catch (err) { /* combatant without a usable actor */ }
  }
}

// One turn-start pass for a combat: mark (active GM only, all conditions re-read now), then
// schedule the checks ONLY once the current combatant's mark is confirmed (FIX-3 Ordering). If any
// condition fails, or the mark's write throws, nothing is scheduled. Safe to run from either path
// and more than once; a combatant already marked has its mark landed, so scheduling is correct.
async function _offGuardTurnStartRun(combat) {
  try {
    if (!_isActiveGMClient()) return;
    if (combat?.started !== true) return;
    if (combat.getFlag(MODULE_ID, 'offGuardInitiative') !== true) return;
    const current = combat.combatant;
    if (!current) return;
    if (current.getFlag(MODULE_ID, 'offGuardTurnStarted') !== true) {
      await current.setFlag(MODULE_ID, 'offGuardTurnStarted', true);
    }
    if (current.getFlag(MODULE_ID, 'offGuardTurnStarted') !== true) return;
  } catch (err) {
    console.error(`${MODULE_ID} | Off-Guard turn-start mark failed`, err);
    return;
  }
  _offGuardScheduleCombat(combat);
}

function _offGuardTurnStartLater(combat) {
  setTimeout(() => { _offGuardTurnStartRun(combat); }, 0);
}

async function _offGuardOnCombatStart(combat) {
  try {
    if (_isActiveGMClient() && combat.getFlag(MODULE_ID, 'offGuardInitiative') !== true) {
      await combat.setFlag(MODULE_ID, 'offGuardInitiative', true);
    }
  } catch (err) {
    console.error(`${MODULE_ID} | Off-Guard combat flag failed`, err);
  }
  _offGuardTurnStartLater(combat);
}

Hooks.on('combatStart', (combat) => { _offGuardOnCombatStart(combat); });

Hooks.on('updateCombat', (combat, changes) => {
  if (!foundry.utils.hasProperty(changes, 'turn') && !foundry.utils.hasProperty(changes, 'round')) return;
  _offGuardTurnStartLater(combat);
});

Hooks.on('createCombatant', (combatant) => {
  try { _translatorSchedule(combatant.actor); } catch (err) { /* combatant without a usable actor */ }
});

Hooks.on('deleteCombatant', (combatant) => {
  try { _translatorSchedule(combatant.actor); } catch (err) { /* combatant without a usable actor */ }
});

Hooks.on('deleteCombat', (combat) => _offGuardScheduleCombat(combat));

// Only an initiative change (a Delay, a re-roll) re-derives. The turn-start mark is itself a Combatant
// flag write and must trigger no re-check.
Hooks.on('updateCombatant', (combatant, changes) => {
  if (!foundry.utils.hasProperty(changes, 'initiative')) return;
  try { _translatorSchedule(combatant.actor); } catch (err) { /* combatant without a usable actor */ }
});

/* ----------------------------------------------------------
   RETIRED SECOND WRITERS — v2.41.0 (GOAL_v2.41.0, FIX-4, D-2, P-5)

   Ledger `paralyzed` and `deafened` no longer write Dex/initiative themselves: pf1's own
   `paralyzed` (Dex and Str set to 0) and `deaf` (initiative -4) statuses are the only writers.
   Applying either Ledger condition from the panel or the API therefore also sets pf1's status
   (`actor.setCondition`, confirmed PF1 method — docs/reference/foundry-v13/
   99_Combined_Foundry_v13_PF1_[KnowledgeFiles.md].md), but only when it is not already on the
   actor, and then records `flags['baphomet-utils'].setPf1Status = true` on the Ledger buff.
   Removing the Ledger condition clears pf1's status ONLY when that flag is present, so a status
   a spell, a buff or the GM set independently survives the Ledger toggle's removal (Michael's
   refinement, 2026-10-01).

   v2.43.0 FIX-3 (R-2): Ledger `fatigued` joins them. It writes no changes of its own; pf1's own
   `fatigued` status (-2 Str / -2 Dex) is the only writer and follows the same set/clear rule.
   ---------------------------------------------------------- */

const _LEDGER_PF1_STATUS = Object.freeze({ paralyzed: 'paralyzed', deafened: 'deaf', fatigued: 'fatigued' });

async function _ledgerSetsPf1Status(actor, condKey) {
  const status = _LEDGER_PF1_STATUS[condKey];
  if (!status) return;
  if (actor.statuses?.has(status)) return;
  await actor.setCondition(status, true);
  const buff = _findExistingBuff(actor, condKey);
  if (buff) await buff.setFlag(MODULE_ID, 'setPf1Status', true);
}

function _pf1StatusToClear(buff, condKey) {
  const status = _LEDGER_PF1_STATUS[condKey];
  return status && buff?.getFlag(MODULE_ID, 'setPf1Status') === true ? status : null;
}

/* ----------------------------------------------------------
   v2.44.0 FIX-3 — the Stunned reaction lock

   While `stunnedCountdown` is above 0 a creature cannot take reactions. The pips live in
   action-tracker.js; `game.baphometActions.syncStunLock(actor)` (active GM's client only, a no-op
   elsewhere) locks or restores them for the actor's combatants. It is called, awaited, after every
   write or unset of `stunnedCountdown`. A failure never breaks the write that called it.
   ---------------------------------------------------------- */

async function _syncStunLock(actor) {
  try {
    await game.baphometActions?.syncStunLock?.(actor);
  } catch (err) {
    console.warn(`${MODULE_ID} | syncStunLock failed for ${actor?.name ?? 'unknown actor'}`, err);
  }
}

/* ----------------------------------------------------------
   v2.43.0 — THE CARD, THE SIGNATURE AND THE SECOND WRITE (FIX-7, FIX-10)

   `_conditionCardHtml` is the card text `applyCondition`'s create branch writes (the same
   expression); the `existing` branch and the load rebuild use it so a re-apply or a rebuild
   writes exactly what a fresh buff would carry.

   `_stampChangesAt` (FIX-10, B-1): pf1 moves CMD for a negative `ac` change only on the SECOND
   prepare after it is written. After every write of a Ledger buff's changes, one more update that
   really changes data (`flags.baphomet-utils.changesAt`; Foundry skips an update with no diff)
   makes that second prepare happen. Strictly increasing so two stamps in one millisecond still diff.
   ---------------------------------------------------------- */

function _conditionCardHtml(cond, tier) {
  return cond.type === 'tiered'
    ? `<p><strong>${cond.name} ${tier}:</strong> ${cond.description.replace(/–X/g, `–${tier}`).replace(/\bX\b/g, String(tier))}</p>`
    : `<p><strong>${cond.name}:</strong> ${cond.description}</p>`;
}

async function _stampChangesAt(buff) {
  const previous = Number(buff.getFlag(MODULE_ID, 'changesAt')) || 0;
  await buff.setFlag(MODULE_ID, 'changesAt', Math.max(Date.now(), previous + 1));
}

async function applyCondition(actor, condKey, tier) {
  if (!actor || !CONDITIONS[condKey]) return;

  const cond = CONDITIONS[condKey];
  // v2.44.0 FIX-1 (R-2): an `uncapped` condition (Stunned) takes any whole number >= 1 as written —
  // `maxTier` is only its panel's button range. Every other condition keeps the clamp.
  tier = cond.uncapped
    ? Math.max(0, Math.floor(Number(tier) || 0))
    : Math.clamp(tier, 0, cond.maxTier);

  if (tier === 0) return removeCondition(actor, condKey);

  // v2.37.3 FIX-5: Off-Guard is fully helper-managed. This branch does NOT create/update the
  // buff Item — it only sets the force-on override flag and delegates to `_syncOffGuard`, the
  // buff's sole writer. Preserves the public API (`game.baphometConditions.apply(actor,
  // 'offGuard', 1)`) and the GM panel toggle while leaving exactly one code path that touches
  // the Item. `_syncOffGuard` posts its own transition chat; no generic chat is posted here.
  if (condKey === 'offGuard') {
    await actor.setFlag(MODULE_ID, 'offGuardForced', true);
    await _syncOffGuard(actor);
    return;
  }

  const existing = _findExistingBuff(actor, condKey);

  if (existing) {
    const changes = cond.buildChanges(tier);
    await existing.update({
      name: _buffName(condKey, tier),
      // v2.43.0 FIX-10 (A-1): the card is rewritten for the new tier, as the create branch writes it.
      'system.description.value': _conditionCardHtml(cond, tier),
      'system.changes': [],
      [`flags.${MODULE_ID}.tier`]: tier,
    });
    if (changes.length > 0) {
      await pf1.components.ItemChange.create(changes, { parent: existing });
    }
    if (!existing.system.active) {
      await existing.setActive(true);
    }
    await _stampChangesAt(existing); // v2.43.0 FIX-10 (B-1): the last write to the buff
  } else {
    const changes = cond.buildChanges(tier);

    const descHtml = cond.type === 'tiered'
      ? `<p><strong>${cond.name} ${tier}:</strong> ${cond.description.replace(/–X/g, `–${tier}`).replace(/\bX\b/g, String(tier))}</p>`
      : `<p><strong>${cond.name}:</strong> ${cond.description}</p>`;

    const [created] = await actor.createEmbeddedDocuments('Item', [{
      img: cond.icon,
      name: _buffName(condKey, tier),
      type: 'buff',
      system: {
        subType: 'temp',
        description: { value: descHtml },
      },
      flags: {
        [MODULE_ID]: {
          conditionKey: condKey,
          tier: tier,
          autoDecrement: cond.autoDecrement,
          conditionType: cond.type,
        }
      }
    }]);

    if (changes.length > 0) {
      await pf1.components.ItemChange.create(changes, { parent: created });
    }
    await created.setActive(true);
    await _stampChangesAt(created); // v2.43.0 FIX-10 (B-1): the last write to the buff
  }

  // v2.41.0 FIX-4 (P-5): paralyzed / deafened also set pf1's own status (no-op for any other key).
  await _ledgerSetsPf1Status(actor, condKey);

  // v2.34.0: Stunned countdown lifecycle — this is an EXTERNAL (re)application (GM UI tier
  // button, macro API `game.baphometConditions.apply`, or `adjustCondition`'s tier-up path —
  // never the internal decrement, which writes stunnedCountdown/removes the buff directly and
  // never calls back into applyCondition; see `_decrementStunnedCountdown`'s comment block).
  // (Re)initializes the countdown to the freshly-applied tier and stamps when this happened,
  // via a live (safe, non-hook-fire-time) read of game.combat. The stamp is compared against
  // the proactive breadcrumb at decrement time to implement the round-4 mid-turn-application
  // skip (SS5:224). stunnedCountdown is genuinely distinct from this buff's own `tier` flag
  // above, which stays at the originally-applied value (display/history only).
  if (condKey === 'stunned') {
    await actor.setFlag(MODULE_ID, 'stunnedCountdown', tier);
    await actor.setFlag(MODULE_ID, 'stunnedAppliedAt', {
      combatId: game.combat?.id ?? null,
      round:    game.combat?.round ?? null,
      turn:     game.combat?.turn ?? null,
      // v2.44.1 FIX-B (TD-84): who was current when the stun was applied. `turn` is an array index
      // that a mid-turn initiative change moves; the combatant and the round name the turn.
      combatantId: game.combat?.combatant?.id ?? null,
    });
    await _syncStunLock(actor); // v2.44.0 FIX-3: the countdown was just written — lock the Reaction pips
  }

  _postConditionChat(actor, cond, tier, 'apply');

  // v2.37.3 FIX-5: 'blinded'/'stunned'/'paralyzed' are the three Off-Guard SOURCE conditions —
  // resync the derived buff after any external (re)application of one of them. Placed after the
  // stunnedCountdown flag write above so a fresh 'stunned' application is visible to the derive
  // check immediately.
  if (condKey === 'blinded' || condKey === 'stunned' || condKey === 'paralyzed') {
    await _syncOffGuard(actor);
  }
}

async function removeCondition(actor, condKey) {
  // v2.37.3 FIX-5: Off-Guard is fully helper-managed. This branch does NOT delete the buff Item
  // itself — it only unsets the force-on override flag and delegates to `_syncOffGuard`, which
  // leaves the buff in place if a derived source (blinded/stunned/paralyzed) is still active.
  if (condKey === 'offGuard') {
    await actor.unsetFlag(MODULE_ID, 'offGuardForced');
    await _syncOffGuard(actor);
    return;
  }

  const existing = _findExistingBuff(actor, condKey);

  // v2.44.0 FIX-5 (TD-79 (a)): a key no longer in the catalog (`drained`, `persistentDamage`, removed
  // in v2.43.0) — delete the buff if there is one, post no chat, and return. Never throw.
  if (!CONDITIONS[condKey]) {
    if (existing) await existing.delete();
    return;
  }

  // v2.34.0: clear the Stunned countdown lifecycle flags regardless of whether a buff was
  // found — defensive: no removal path (GM "X" button, adjustCondition reaching tier 0, or
  // _decrementStunnedCountdown's own zero-remainder cleanup) should leave a stale countdown
  // or stamp behind.
  if (condKey === 'stunned') {
    await actor.unsetFlag(MODULE_ID, 'stunnedCountdown');
    await actor.unsetFlag(MODULE_ID, 'stunnedAppliedAt');
  }

  if (!existing) {
    // v2.37.3 FIX-5: still resync — e.g. a 'stunned' removal with no buff present (defensive
    // path above) may have just cleared stunnedCountdown and changed the derived state.
    if (condKey === 'blinded' || condKey === 'stunned' || condKey === 'paralyzed') {
      await _syncOffGuard(actor);
    }
    if (condKey === 'stunned') await _syncStunLock(actor); // v2.44.0 FIX-3: restore what the stun locked
    return;
  }

  const cond = CONDITIONS[condKey];
  const pf1StatusToClear = _pf1StatusToClear(existing, condKey); // v2.41.0 FIX-4 (P-5): read before the buff is gone
  // v2.44.0 FIX-4 (D-3, Q5): a Ledger Stunned the translator made from pf1's condition toggle
  // (mark `{ status: 'stunned', source: 'condition toggle' }`) takes pf1's own `stunned` status with
  // it. Read before the buff is gone. A buff-sourced stun, or a Stunned with no/other mark, never clears it.
  const stunMark = condKey === 'stunned' ? existing.getFlag(MODULE_ID, 'translatedFrom') : null;
  const clearToggleStun = stunMark?.status === 'stunned' && stunMark?.source === 'condition toggle';
  await existing.delete();
  if (pf1StatusToClear) await actor.setCondition(pf1StatusToClear, false);
  if (clearToggleStun && actor.statuses?.has('stunned')) await actor.setCondition('stunned', false);
  _postConditionChat(actor, cond, 0, 'remove');
  if (condKey === 'stunned') await _syncStunLock(actor); // v2.44.0 FIX-3: the buff is gone — restore the locked pips

  // v2.37.3 FIX-5: resync the derived Off-Guard buff after removing a source condition.
  if (condKey === 'blinded' || condKey === 'stunned' || condKey === 'paralyzed') {
    await _syncOffGuard(actor);
  }
}

async function adjustCondition(actor, condKey, delta) {
  const existing = _findExistingBuff(actor, condKey);
  const currentTier = existing?.getFlag(MODULE_ID, 'tier') ?? 0;
  const newTier = Math.max(0, currentTier + delta);
  return applyCondition(actor, condKey, newTier);
}

function _postConditionChat(actor, cond, tier, action) {
  const isRemove = action === 'remove';
  const color = isRemove ? 'var(--baph-success-bright, #5a9a5a)' : 'var(--baph-gold, #b8943e)';
  const label = isRemove
    ? `${cond.name} removed`
    : cond.type === 'toggle'
      ? `${cond.name}`
      : `${cond.name} ${tier}`;

  // v2.7.1: escape actor.name before interpolating into HTML.
  // cond.name, label, and cond.description are internal constants
  // and do not require escaping.
  const safeActorName = foundry.utils.escapeHTML(actor.name);

  ChatMessage.create({
    content: `<div style="font-family: var(--baph-font-heading, 'Courier Prime', monospace); text-transform: uppercase; letter-spacing: 0.05em; color: ${color}; font-size: 13px;">
      ${safeActorName} — ${label}
    </div>
    ${!isRemove ? `<div style="font-family: var(--baph-font-body, 'Alegreya', serif); color: var(--baph-text-secondary, #8a919d); font-size: 12px; margin-top: 2px;">
      ${cond.description.replace(/–X/g, `–${tier}`).replace(/\bX\b/g, String(tier))}
    </div>` : ''}`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

/* ----------------------------------------------------------
   UI: Token HUD Condition Panel
   ---------------------------------------------------------- */

function _buildConditionPanel(actor) {
  const panel = document.createElement('div');
  panel.classList.add('baph-condition-panel');

  const tieredHeader = document.createElement('div');
  tieredHeader.classList.add('baph-section-header');
  tieredHeader.textContent = 'Conditions';
  panel.appendChild(tieredHeader);

  const grid = document.createElement('div');
  grid.classList.add('baph-conditions-grid');

  const tieredLabel = document.createElement('div');
  tieredLabel.style.cssText = 'grid-column: 1 / -1; font-family: var(--baph-font-heading, monospace); font-size: 8px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--baph-text-muted, #5c6370); padding: 2px 0 1px; border-bottom: 1px solid var(--baph-border, #2a2f38);';
  tieredLabel.textContent = '— Tiered —';
  grid.appendChild(tieredLabel);

  for (const [key, cond] of Object.entries(CONDITIONS)) {
    if (cond.type !== 'tiered') continue;
    grid.appendChild(_buildTieredRow(actor, key, cond));
  }

  const toggleLabel = document.createElement('div');
  toggleLabel.style.cssText = tieredLabel.style.cssText;
  toggleLabel.textContent = '— Status —';
  grid.appendChild(toggleLabel);

  for (const [key, cond] of Object.entries(CONDITIONS)) {
    if (cond.type !== 'toggle') continue;
    grid.appendChild(_buildToggleRow(actor, key, cond));
  }

  panel.appendChild(grid);
  return panel;
}

function _buildTieredRow(actor, key, cond) {
  const existing = _findExistingBuff(actor, key);
  const currentTier = existing?.getFlag(MODULE_ID, 'tier') ?? 0;

  const row = document.createElement('div');
  row.classList.add('baph-condition-row');
  if (currentTier > 0) row.classList.add('active');

  const labelRow = document.createElement('div');
  labelRow.style.display = 'flex';
  labelRow.style.alignItems = 'center';

  const label = document.createElement('span');
  label.classList.add('baph-condition-label');
  // v2.44.0 FIX-1 (Q1): above the button range (an uncapped Stunned 15) the label carries the tier
  // and no button is selected — `t === currentTier` below can never hold.
  label.textContent = currentTier > cond.maxTier ? `${cond.name} ${currentTier}` : cond.name;
  label.title = cond.description;
  labelRow.appendChild(label);

  if (cond.autoDecrement) {
    const indicator = document.createElement('span');
    indicator.classList.add('baph-auto-indicator');
    indicator.textContent = '↓';
    indicator.title = 'Auto-decrements at end of turn';
    labelRow.appendChild(indicator);
  }

  row.appendChild(labelRow);

  const tierGroup = document.createElement('div');
  tierGroup.classList.add('baph-tier-group');

  const btnRemove = document.createElement('button');
  btnRemove.classList.add('baph-tier-btn', 'baph-btn-remove');
  btnRemove.textContent = '✕';
  btnRemove.title = 'Remove';
  if (currentTier === 0) btnRemove.classList.add('disabled');
  btnRemove.addEventListener('click', async (e) => {
    e.stopPropagation();
    await removeCondition(actor, key);
    _refreshPanel(e.target);
  });
  tierGroup.appendChild(btnRemove);

  for (let t = 1; t <= cond.maxTier; t++) {
    const btn = document.createElement('button');
    btn.classList.add('baph-tier-btn');
    if (t === currentTier) btn.classList.add('selected');
    btn.textContent = String(t);
    btn.title = `${cond.name} ${t}`;
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await applyCondition(actor, key, t);
      _refreshPanel(e.target);
    });
    tierGroup.appendChild(btn);
  }

  row.appendChild(tierGroup);
  return row;
}

function _buildToggleRow(actor, key, cond) {
  const existing = _findExistingBuff(actor, key);
  const isActive = !!existing;

  const row = document.createElement('div');
  row.classList.add('baph-condition-row', 'baph-toggle-row');
  if (isActive) row.classList.add('active');

  const label = document.createElement('span');
  label.classList.add('baph-condition-label', 'baph-toggle-label');
  label.textContent = cond.name;
  label.title = cond.description;
  row.appendChild(label);

  const btn = document.createElement('button');
  btn.classList.add('baph-toggle-btn');
  if (isActive) btn.classList.add('active');
  btn.textContent = isActive ? 'ON' : 'OFF';
  btn.title = isActive ? `Remove ${cond.name}` : `Apply ${cond.name}`;
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (isActive) {
      await removeCondition(actor, key);
    } else {
      await applyCondition(actor, key, 1);
    }
    _refreshPanel(e.target);
  });

  row.appendChild(btn);
  return row;
}

function _refreshPanel(element) {
  const container = element.closest('.baph-condition-container');
  if (!container) return;
  const panel = container.querySelector('.baph-condition-panel');
  if (!panel) return;

  const actorId = container.dataset.actorId;
  const actor = game.actors.get(actorId);
  if (!actor) return;

  setTimeout(() => {
    const newPanel = _buildConditionPanel(actor);
    panel.replaceWith(newPanel);
  }, 100);
}

/* ----------------------------------------------------------
   PF1 CONDITION REGISTRY — NEUTRALIZE PASS + CANARY (v2.40.0, TD-38 part 1)

   pf1's own registry entries for six conditions that PF1.5 canon redefines
   carry native penalties that would stack with the Ledger's. The pass empties
   their mechanics.changes and mechanics.flags in place (entry.updateSource)
   and relabels them. Runs on every client: the registry is per client.
   Reference: GOAL_v2.40.0 FIX-1/FIX-2 and the TD-38 fact pack (read-only);
   docs/reference/foundry-v13/99_Combined_Foundry_v13_PF1_[KnowledgeFiles.md].md
   (pf1.registry.conditions as a Map-like registry: get/has/keys/entries).
   ---------------------------------------------------------- */

// R1 — FROZEN list (Michael, 2026-08-29, register TD-38). Do not extend.
const _BAPH_NEUTRALIZED_LABELS = Object.freeze({
  shaken: 'Shaken → Frightened 1 (Ledger)',
  frightened: 'Frightened → Frightened 2 (Ledger)',
  panicked: 'Panicked → Frightened 3 + Fleeing (Ledger)',
  sickened: 'Sickened → Sickened 2 (Ledger)',
  stunned: 'Stunned → Stunned 1 (Ledger)',
  blind: 'Blind → Blinded (Ledger)',
});

// Kept entries that STILL carry pf1's loseDexToAC flag after the pass: the tier-3 Dex-0 statuses.
// v2.42.0 FIX-1 (R-3, R-5): `cowering`, `flatFooted` and `pinned` (tier 1) are cleared by the pass
// so Off-Guard replaces their lost Dex bonus; the canary now expects no flag on them.
const _BAPH_KEPT_DEX_LOST = Object.freeze([
  'dying', 'helpless', 'paralyzed',
  'petrified', 'sleep', 'stable', 'unconscious',
]);

// v2.42.0 FIX-1 (R-3): the pf1 Off-Guard source set, PINNED. pf1 11.11 ships `loseDexToAC` on twelve
// entries (blind and stunned are two of the frozen six, so not pf1 sources); these ten are the rest.
// The pass warns when what pf1 recorded differs (P-h) — warn, never act.
const _BAPH_OFFGUARD_SOURCES_EXPECTED = Object.freeze([
  'cowering', 'dying', 'flatFooted', 'helpless', 'paralyzed',
  'petrified', 'pinned', 'sleep', 'stable', 'unconscious',
]);

// Tier 1 (R-3, R-5): the entries whose `loseDexToAC` the pass clears.
const _BAPH_DEX_CLEARED_IDS = Object.freeze(['cowering', 'flatFooted', 'pinned']);

// Pinned's Dex cap (`_baphChangeSig` form), removed by the pass (R-5). Its ac:-4 and cmd:-4 stay.
const _BAPH_PINNED_DEXMOD_SIG = 'dexMod:min(0, @abilities.dex.mod):untyped:set:1001';

// v2.43.0 FIX-5 (R-1, GOAL_v2.43.0_CONDITION_CANON): every AC penalty reaches CMD. This extends the
// frozen neutralize pass (R1 above, Michael 2026-08-29, which CLAUDE.md allows only through a GOAL):
// pf1's kept `cowering` (ac -2) and `squeezing` (ac -4) gain a `cmd` change copied from their own
// `ac` change, unless the entry already carries one. Nothing else on either entry changes and no
// other entry is touched. pf1's registry condition changes never reach CMD through `ac` themselves.
const _BAPH_CMD_FROM_AC_IDS = Object.freeze(['cowering', 'squeezing']);

// Kept entries with changes: exact expected set, `target:formula:type:operator:priority`.
// v2.43.0 FIX-5 (R-1): `cowering` and `squeezing` each also expect their copied `cmd` change.
const _BAPH_KEPT_CHANGES = Object.freeze({
  cowering: ['ac:-2:untyped:add:0', 'cmd:-2:untyped:add:0'],
  dazzled: ['attack:-1:untyped:add:0'],
  deaf: ['init:-4:untyped:add:0'],
  dying: ['dex:0:untypedPerm:set:1001'],
  entangled: ['attack:-2:untyped:add:0', 'dexPen:-4:untyped:add:0'],
  exhausted: ['dexPen:-6:untyped:add:0', 'strPen:-6:untyped:add:0'],
  fatigued: ['dexPen:-2:untyped:add:0', 'strPen:-2:untyped:add:0'],
  grappled: ['attack:-2:untyped:add:0', 'dexPen:-4:untyped:add:0'],
  helpless: ['dex:0:untypedPerm:set:1001'],
  incorporeal: ['ac:max(1, @abilities.cha.mod):deflection:add:0', 'nac:0:base:set:-10'],
  paralyzed: ['dex:0:untypedPerm:set:1001', 'str:0:untypedPerm:set:1001'],
  petrified: ['dex:0:untypedPerm:set:1001'],
  pinned: ['ac:-4:untyped:add:0', 'cmd:-4:untyped:add:0'],
  prone: ['mattack:-4:untyped:add:0'],
  sleep: ['dex:0:untypedPerm:set:1001'],
  squeezing: ['ac:-4:untyped:add:0', 'attack:-4:untyped:add:0', 'cmd:-4:untyped:add:0'],
  stable: ['dex:0:untypedPerm:set:1001'],
  unconscious: ['dex:0:untypedPerm:set:1001'],
});

// Record of the pass, read by game.baphometConditions.neutralizeState().
let _baphNeutralizeState = null;

function _baphChangeSig(change) {
  return [change?.target, change?.formula, change?.type, change?.operator, change?.priority].join(':');
}

function _baphEntryChangeSigs(entry) {
  return Array.from(entry?.mechanics?.changes ?? []).map(_baphChangeSig).sort();
}

function _baphEntryFlags(entry) {
  return Array.from(entry?.mechanics?.flags ?? []).map(String).sort();
}

/**
 * Fires inside pf1's Registry constructor, before CONFIG.statusEffects is built
 * from the registry and before Foundry prepares any world document. The hook's
 * only argument is the registry; pf1.registry.conditions is not assigned yet.
 */
Hooks.once('pf1RegisterConditions', registry => {
  const beforeDocuments = !game._documentsReady;

  // v2.42.0 FIX-1 (R-3): RECORD, before anything is cleared, every registry entry whose
  // `mechanics.flags` holds `loseDexToAC` as pf1 ships it. The pf1 Off-Guard source set is that
  // recorded set minus the frozen six (blind and stunned reach Off-Guard through the Ledger's own
  // Blinded and Stunned).
  const loseDexRecorded = [];
  try {
    for (const [id, entry] of registry.entries()) {
      if (_baphEntryFlags(entry).includes('loseDexToAC')) loseDexRecorded.push(id);
    }
  } catch (err) {
    console.error(`${MODULE_ID} | Condition neutralize pass could not record loseDexToAC`, err);
  }
  loseDexRecorded.sort();
  const loseDexSources = loseDexRecorded.filter(id => !Object.hasOwn(_BAPH_NEUTRALIZED_LABELS, id));

  const ids = [];
  for (const [id, label] of Object.entries(_BAPH_NEUTRALIZED_LABELS)) {
    try {
      const entry = registry?.get?.(id);
      if (!entry) continue;
      entry.updateSource({ 'mechanics.changes': [], 'mechanics.flags': [], name: label });
      ids.push(id);
    } catch (err) {
      console.error(`${MODULE_ID} | Condition neutralize pass failed for '${id}'`, err);
    }
  }

  // v2.42.0 FIX-1 (R-3, R-5): tier 1 — remove `loseDexToAC` from flatFooted, cowering and pinned,
  // and Pinned's `dexMod` cap change. Nothing else on those three changes; no other entry is touched.
  const dexCleared = [];
  for (const id of _BAPH_DEX_CLEARED_IDS) {
    try {
      const entry = registry?.get?.(id);
      if (!entry) continue;
      const mechanics = entry.toObject().mechanics ?? {};
      const update = { 'mechanics.flags': Array.from(mechanics.flags ?? []).filter(f => f !== 'loseDexToAC') };
      if (id === 'pinned') {
        const changes = Array.from(mechanics.changes ?? []);
        const kept = changes.filter(c => _baphChangeSig(c) !== _BAPH_PINNED_DEXMOD_SIG);
        if (kept.length !== changes.length) update['mechanics.changes'] = kept;
      }
      entry.updateSource(update);
      dexCleared.push(id);
    } catch (err) {
      console.error(`${MODULE_ID} | Condition neutralize pass failed to clear loseDexToAC on '${id}'`, err);
    }
  }
  dexCleared.sort();

  // v2.43.0 FIX-5 (R-1): after the tier-1 loop — copy the entry's own `ac` change as a `cmd` change on
  // cowering and squeezing (same formula, type, operator and priority), unless a `cmd` change is already
  // there. A copy that carries a document `_id` gets a fresh one so the two changes never share it.
  const cmdAdded = [];
  for (const id of _BAPH_CMD_FROM_AC_IDS) {
    try {
      const entry = registry?.get?.(id);
      if (!entry) continue;
      const changes = Array.from(entry.toObject().mechanics?.changes ?? []);
      if (changes.some(c => c?.target === 'cmd')) continue;
      const ac = changes.find(c => c?.target === 'ac');
      if (!ac) continue;
      const copy = { ...ac, target: 'cmd' };
      if (typeof copy._id === 'string') {
        // `foundry.utils.randomID()`: used in docs/reference/socket-authority/socketlib-v1.1.4-source.js:165.
        if (typeof foundry.utils?.randomID === 'function') copy._id = foundry.utils.randomID();
        else delete copy._id;
      }
      entry.updateSource({ 'mechanics.changes': [...changes, copy] });
      cmdAdded.push(id);
    } catch (err) {
      console.error(`${MODULE_ID} | Condition neutralize pass failed to add a cmd change on '${id}'`, err);
    }
  }
  cmdAdded.sort();

  _baphNeutralizeState = { ranAt: Date.now(), ids, beforeDocuments, loseDexRecorded, loseDexSources, dexCleared, cmdAdded };

  // v2.42.0 FIX-1 (P-h): drift guard — warn on every client, never act.
  const drift = _baphLoseDexCompare(loseDexSources);
  if (!drift.ok) _baphLoseDexWarn(drift);
});

/* ----------------------------------------------------------
   OFF-GUARD SOURCE DRIFT GUARD + UNCANNY DODGE AUDIT — v2.42.0 (FIX-1, FIX-4; P-h, R-1)
   ---------------------------------------------------------- */

function _baphLoseDexCompare(ids) {
  const have = new Set(Array.from(ids ?? []).map(String));
  const want = new Set(_BAPH_OFFGUARD_SOURCES_EXPECTED);
  const missing = [...want].filter(id => !have.has(id)).sort();
  const extra = [...have].filter(id => !want.has(id)).sort();
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

function _baphLoseDexWarn(drift) {
  console.warn(`${MODULE_ID} | Off-Guard source set differs from the pinned ten — missing: [${drift.missing.join(', ')}], extra: [${drift.extra.join(', ')}]. Nothing was changed; Off-Guard uses what pf1 recorded.`);
}

// One GM-only whisper, flagged so a probe or a sweep can find it. Returns the message id.
async function _baphGmWhisper(html, flag) {
  const message = await ChatMessage.create({
    content: html,
    whisper: _translatorGMIds(),
    flags: { [MODULE_ID]: { [flag]: true } },
  });
  return message?.id ?? null;
}

// The drift guard's reporting: a console warning, and one flagged GM whisper from a GM client
// (`activeOnly`: from the active GM's client only — what `ready` uses so a load posts it once).
function _baphLoseDexReport(drift, { consoleWarn = true, activeOnly = false } = {}) {
  if (drift.ok) return;
  if (consoleWarn) _baphLoseDexWarn(drift);
  if (!(activeOnly ? _isActiveGMClient() : game.user?.isGM)) return;
  const esc = foundry.utils.escapeHTML;
  _baphGmWhisper(
    `<div style="font-family: var(--baph-font-body, 'Alegreya', serif); font-size: 12px;">`
    + `Off-Guard sources: the pf1 conditions that deny Dex to AC differ from the pinned ten. `
    + `Missing: ${esc(drift.missing.join(', ') || 'none')}. Extra: ${esc(drift.extra.join(', ') || 'none')}. `
    + `Nothing was changed; Off-Guard uses what pf1 recorded.</div>`,
    'offGuardDrift'
  ).catch(err => console.error(`${MODULE_ID} | Off-Guard drift whisper failed`, err));
}

// FIX-4 (R-1): world actors holding an item named like "Uncanny Dodge" (not "Improved") whose
// `actor.itemFlags.boolean.uncannyDodge` is not set. Warn-only: one GM whisper, sets nothing.
async function _baphUncannyDodgeAudit() {
  const actors = [];
  for (const actor of Array.from(game.actors ?? [])) {
    const named = Array.from(actor.items ?? []).some(i => /uncanny dodge/i.test(i.name ?? '') && !/improved/i.test(i.name ?? ''));
    if (named && !_offGuardHasUncannyDodge(actor)) actors.push({ id: actor.id, name: actor.name });
  }
  actors.sort((a, b) => a.name.localeCompare(b.name));

  let messageId = null;
  if (actors.length && game.user?.isGM) {
    const esc = foundry.utils.escapeHTML;
    messageId = await _baphGmWhisper(
      `<div style="font-family: var(--baph-font-body, 'Alegreya', serif); font-size: 12px;">`
      + `These actors have an Uncanny Dodge item without the flag, so they are Off-Guard until their first turn: `
      + `${actors.map(a => esc(a.name)).join(', ')}. `
      + `Add the flag on the item sheet (Advanced → Boolean Flags → uncannyDodge). Nothing was changed.</div>`,
      'uncannyDodgeAudit'
    );
  }
  return { actors, messageId };
}

/**
 * Fail-loud canary (TD-13 shape). Checks the live registry; warns, never fixes,
 * never writes to the registry.
 * @returns {{ ok: boolean, failures: Array<{ id: string, problem: string }> }}
 */
function _baphConditionRegistryCanary() {
  const reg = globalThis.pf1?.registry?.conditions;
  const failures = [];

  if (!reg) {
    failures.push({ id: 'registry', problem: 'missing' });
  } else {
    for (const id of Object.keys(_BAPH_NEUTRALIZED_LABELS)) {
      const entry = reg.get(id);
      if (!entry) {
        failures.push({ id, problem: 'missing' });
        continue;
      }
      if (Array.from(entry.mechanics?.changes ?? []).length > 0) {
        failures.push({ id, problem: 'neutralized-has-changes' });
      }
      if (_baphEntryFlags(entry).length > 0) {
        failures.push({ id, problem: 'neutralized-has-flags' });
      }
    }

    for (const [id, expected] of Object.entries(_BAPH_KEPT_CHANGES)) {
      const entry = reg.get(id);
      if (!entry) {
        failures.push({ id, problem: 'missing' });
        continue;
      }
      if (_baphEntryChangeSigs(entry).join('|') !== expected.slice().sort().join('|')) {
        failures.push({ id, problem: 'kept-changes-differ' });
      }
    }

    // Every kept entry (any entry other than the six): exact flag set.
    for (const [id, entry] of reg.entries()) {
      if (Object.hasOwn(_BAPH_NEUTRALIZED_LABELS, id)) continue;
      const want = _BAPH_KEPT_DEX_LOST.includes(id) ? 'loseDexToAC' : '';
      if (_baphEntryFlags(entry).join(',') !== want) {
        failures.push({ id, problem: 'kept-flags-differ' });
      }
    }
    for (const id of _BAPH_KEPT_DEX_LOST) {
      if (!reg.has(id) && !failures.some(f => f.id === id && f.problem === 'missing')) {
        failures.push({ id, problem: 'missing' });
      }
    }
  }

  const ok = failures.length === 0;
  if (!ok) {
    const ids = [...new Set(failures.map(f => f.id))];
    const detail = failures.map(f => `${f.id} (${f.problem})`).join(', ');
    console.warn(`${MODULE_ID} | pf1 condition registry canary FAILED: ${detail}`);
    if (game.user?.isGM) {
      ui.notifications?.warn?.(
        `${MODULE_ID}: pf1 condition registry is not as expected (${ids.join(', ')}). ` +
        'Penalties may stack or be missing. See the console.'
      );
    }
  }
  return { ok, failures };
}

/* ----------------------------------------------------------
   THE LOAD REBUILD AND THE ORPHAN AUDIT — v2.43.0 (GOAL_v2.43.0, FIX-7; P-6, P-7)

   A Ledger buff stores its changes, name and card text when it is created, so a condition already on
   an actor keeps yesterday's numbers until it is rewritten. `refreshConditionChanges(actors)` rewrites
   every buff whose stored changes (as sorted `target:formula:type:operator:priority`), name,
   `system.description.value` or `conditionType` differ from what the create branch of `applyCondition`
   would write now, with the tier clamped to 1...maxTier. It never creates or deletes a buff, never
   changes `system.active`, touches no other flag, posts no chat, and is idempotent. Off-Guard compares
   and writes its description only (`_syncOffGuard` owns its changes). A buff whose `conditionKey` is no
   longer in the catalog (an orphan: Drained, Persistent Dmg) is only LISTED — never written.
   `conditionOrphanAudit(actors)` whispers the GMs one flagged line naming them and sets nothing.
   Both are GM-only (a non-GM gets `null`) and both run once at `ready` on the active GM's client.
   ---------------------------------------------------------- */

function _condChangeSig(change) {
  return [change?.target, change?.formula, change?.type ?? change?.modifier, change?.operator, change?.priority].join(':');
}

// Every Ledger-keyed buff on an actor. Foundry collections lack several array methods, so the item
// collection is read through `.contents`.
function _conditionBuffsOf(actor) {
  return Array.from(actor?.items?.contents ?? []).filter(i => i.type === 'buff' && i.getFlag(MODULE_ID, 'conditionKey'));
}

function _conditionOrphansOf(actors) {
  const orphans = [];
  for (const actor of actors) {
    for (const buff of _conditionBuffsOf(actor)) {
      const key = buff.getFlag(MODULE_ID, 'conditionKey');
      if (Object.hasOwn(CONDITIONS, key)) continue;
      orphans.push({ actorId: actor.id, actorName: actor.name, itemId: buff.id, itemName: buff.name, key: String(key) });
    }
  }
  return orphans;
}

// The given actors, each once (by uuid), in order.
function _conditionActorList(actors) {
  const seen = new Set();
  const list = [];
  for (const actor of Array.from(actors ?? [])) {
    if (!actor || actor.pack || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    list.push(actor);
  }
  return list;
}

async function _refreshConditionChanges(actors) {
  if (!game.user?.isGM) return null;
  const list = _conditionActorList(actors);
  let checked = 0;
  const updated = [];

  for (const actor of list) {
    for (const buff of _conditionBuffsOf(actor)) {
      const key = buff.getFlag(MODULE_ID, 'conditionKey');
      if (!Object.hasOwn(CONDITIONS, key)) continue;
      checked += 1;
      const cond = CONDITIONS[key];
      try {
        if (key === 'offGuard') {
          const card = _conditionCardHtml(cond, 1);
          if ((buff.system?.description?.value ?? '') !== card) {
            await buff.update({ 'system.description.value': card });
            updated.push({ actorId: actor.id, itemId: buff.id, key });
          }
          continue;
        }

        const storedTier = Number(buff.getFlag(MODULE_ID, 'tier'));
        // v2.44.0 FIX-1: an `uncapped` condition keeps its stored tier (a Stunned 15 is never rebuilt to 12).
        const tier = cond.uncapped
          ? Math.max(1, Number.isFinite(storedTier) ? storedTier : 1)
          : Math.clamp(Number.isFinite(storedTier) ? storedTier : 1, 1, cond.maxTier);
        const changes = cond.buildChanges(tier);
        const name = _buffName(key, tier);
        const card = _conditionCardHtml(cond, tier);
        const same =
          Array.from(buff.system?.changes ?? []).map(_condChangeSig).sort().join('|')
            === changes.map(_condChangeSig).sort().join('|')
          && buff.name === name
          && (buff.system?.description?.value ?? '') === card
          && buff.getFlag(MODULE_ID, 'conditionType') === cond.type;
        if (same) continue;

        await buff.update({
          name,
          'system.description.value': card,
          'system.changes': [],
          [`flags.${MODULE_ID}.tier`]: tier,
          [`flags.${MODULE_ID}.conditionType`]: cond.type,
        });
        if (changes.length > 0) {
          await pf1.components.ItemChange.create(changes, { parent: buff });
        }
        await _stampChangesAt(buff); // FIX-10 (B-1): the last write to the buff
        if (key === 'fatigued' && buff.system?.active === true) await _ledgerSetsPf1Status(actor, key);
        updated.push({ actorId: actor.id, itemId: buff.id, key });
      } catch (err) {
        console.error(`${MODULE_ID} | Condition rebuild failed for '${key}' on ${actor.name}`, err);
      }
    }
  }

  updated.sort((a, b) => a.key.localeCompare(b.key) || String(a.actorId).localeCompare(String(b.actorId)));
  return { checked, updated, orphans: _conditionOrphansOf(list) };
}

async function _conditionOrphanAudit(actors) {
  if (!game.user?.isGM) return null;
  const orphans = _conditionOrphansOf(_conditionActorList(actors));
  let messageId = null;
  if (orphans.length) {
    const esc = foundry.utils.escapeHTML;
    messageId = await _baphGmWhisper(
      `<div style="font-family: var(--baph-font-body, 'Alegreya', serif); font-size: 12px;">`
      + `These buffs are no longer Ledger conditions, but they still apply their changes, so remove them by hand: `
      + `${orphans.map(o => `${esc(o.actorName)} — ${esc(o.itemName)}`).join('; ')}. `
      + `Nothing was changed.</div>`,
      'conditionOrphans'
    );
  }
  return { orphans, messageId };
}

// Every world actor and the synthetic actor of every unlinked token on every scene.
function _conditionSweepActors() {
  const actors = Array.from(game.actors?.contents ?? []);
  for (const scene of Array.from(game.scenes?.contents ?? [])) {
    for (const token of Array.from(scene.tokens?.contents ?? [])) {
      try {
        if (token.actor?.isToken) actors.push(token.actor);
      } catch (err) { /* token without a usable actor */ }
    }
  }
  return actors;
}

// Once per load, on the active GM's client: rebuild, then list orphans (one whisper at most).
async function _conditionLoadSweep() {
  const actors = _conditionSweepActors();
  const refreshed = await _refreshConditionChanges(actors);
  const audit = await _conditionOrphanAudit(actors);
  console.info(`${MODULE_ID} | Condition load sweep: ${refreshed?.checked ?? 0} buffs checked, ${refreshed?.updated?.length ?? 0} rebuilt, ${audit?.orphans?.length ?? 0} orphans listed.`);
}

/* ----------------------------------------------------------
   HOOKS
   ---------------------------------------------------------- */

Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Initializing PF1.5 Condition Overlay v2.9`);
});

Hooks.once('ready', () => {
  _injectCorruptedEdgeFilter();

  game.baphometConditions = {
    apply: applyCondition,
    remove: removeCondition,
    adjust: adjustCondition,
    CONDITIONS,
    getTier(actor, condKey) {
      const buff = _findExistingBuff(actor, condKey);
      return buff?.getFlag(MODULE_ID, 'tier') ?? 0;
    },
    listActive(actor) {
      return actor.items
        .filter(i => i.type === 'buff' && i.getFlag(MODULE_ID, 'conditionKey'))
        .map(i => ({
          key: i.getFlag(MODULE_ID, 'conditionKey'),
          tier: i.getFlag(MODULE_ID, 'tier'),
          name: i.name,
          active: i.system.active,
        }));
    },
    // v2.40.0 — pf1 condition registry canary (TD-38 part 1)
    registryCanary() {
      return _baphConditionRegistryCanary();
    },
    neutralizeState() {
      if (!_baphNeutralizeState) return null;
      return {
        ranAt: _baphNeutralizeState.ranAt,
        ids: [..._baphNeutralizeState.ids],
        beforeDocuments: _baphNeutralizeState.beforeDocuments,
        // v2.42.0 FIX-1: every entry pf1 shipped with loseDexToAC (sorted), and the entries the pass
        // cleared it from.
        loseDexRecorded: [..._baphNeutralizeState.loseDexRecorded],
        dexCleared: [..._baphNeutralizeState.dexCleared],
        // v2.43.0 FIX-5: the sorted ids that gained a `cmd` change copied from their `ac` change.
        cmdAdded: [..._baphNeutralizeState.cmdAdded],
      };
    },
    // v2.42.0 FIX-1 — the recorded set, the pf1 Off-Guard source set (recorded minus the frozen
    // six), the pinned expectation, and the drift result.
    offGuardSources() {
      const recorded = [...(_baphNeutralizeState?.loseDexRecorded ?? [])];
      const sources = [...(_baphNeutralizeState?.loseDexSources ?? [])];
      return { recorded, sources, expected: [..._BAPH_OFFGUARD_SOURCES_EXPECTED], ..._baphLoseDexCompare(sources) };
    },
    // v2.42.0 FIX-1 — compare any id list with the pinned ten; a mismatch warns exactly as the drift
    // guard does (console, and one flagged GM whisper on a GM client).
    loseDexDrift(ids) {
      const result = _baphLoseDexCompare(ids);
      _baphLoseDexReport(result);
      return result;
    },
    // v2.42.0 FIX-2 — { want, have, sources }: the sorted source tokens that hold, and whether the
    // Off-Guard buff exists.
    offGuardState(actor) {
      const sources = _offGuardSources(actor);
      return { want: sources.length > 0, have: !!_findExistingBuff(actor, 'offGuard'), sources };
    },
    // v2.42.0 FIX-4 — { actors: [{ id, name }], messageId }
    uncannyDodgeAudit() {
      return _baphUncannyDodgeAudit();
    },
    // v2.43.0 FIX-7 — GM-only (a non-GM gets null). `{ checked, updated, orphans }` and `{ orphans, messageId }`.
    refreshConditionChanges(actors) {
      return _refreshConditionChanges(actors);
    },
    conditionOrphanAudit(actors) {
      return _conditionOrphanAudit(actors);
    },
    // v2.41.0 — condition translator (TD-38 part 2). Defined at the end of this file.
    translationTable() {
      return _translationTableCopy();
    },
    translatorLog() {
      return _translatorLogCopy();
    },
    translatorIdle() {
      return _translatorIdle();
    },
    resolveTranslation(messageId, choice) {
      return _resolveTranslation(messageId, choice);
    }
  };

  _baphConditionRegistryCanary();

  // v2.42.0 (P-h, FIX-4): once per load, from the active GM's client — the drift whisper when the
  // recorded set differs from the pinned ten (the pass already warned in the console on a recorded
  // set), and the Uncanny Dodge audit. Both warn only; neither sets anything.
  const drift = game.baphometConditions.offGuardSources();
  _baphLoseDexReport(drift, { consoleWarn: !_baphNeutralizeState, activeOnly: true });
  if (_isActiveGMClient()) {
    _baphUncannyDodgeAudit().catch(err => console.error(`${MODULE_ID} | Uncanny Dodge audit failed`, err));
    // v2.43.0 FIX-7 (P-6, P-7): rebuild old-shape buffs once, then list any orphans — after the API object exists.
    _conditionLoadSweep().catch(err => console.error(`${MODULE_ID} | Condition load sweep failed`, err));
  }

  console.log(`${MODULE_ID} | PF1.5 Condition Overlay v2.9 ready.`);
  console.log(`${MODULE_ID} | API: game.baphometConditions.apply(actor, 'frightened', 3)`);
  console.log(`${MODULE_ID} | API: game.baphometConditions.adjust(actor, 'sickened', -1)`);
  console.log(`${MODULE_ID} | API: game.baphometConditions.remove(actor, 'clumsy')`);
});

// Token HUD button — v13 compatible
Hooks.on('renderTokenHUD', (hud, html, data) => {
  if (!game.user.isGM) return;

  const token = hud.object;
  const actor = token.actor;
  if (!actor) return;

  const hudElement = _baphNormalizeHtml(html);
  if (!hudElement) return;

  const btn = document.createElement('div');
  btn.classList.add('control-icon', 'baph-condition-hud-btn');
  btn.title = 'PF1.5 Conditions';
  btn.innerHTML = '<i class="fas fa-head-side-virus"></i>';

  // v2.6: hoist these to the outer closure so manual-close can
  // disconnect the observer (previously a closure-local that
  // leaked until the HUD itself mutated).
  let panelOpen = false;
  let panelContainer = null;
  let hudCloseObserver = null;

  const _teardown = () => {
    hudCloseObserver?.disconnect();
    hudCloseObserver = null;
    panelContainer?.remove();
    panelContainer = null;
    panelOpen = false;
  };

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (panelOpen && panelContainer) {
      _teardown();
      return;
    }

    panelContainer = document.createElement('div');
    panelContainer.classList.add('baph-condition-container');
    panelContainer.dataset.actorId = actor.id;
    panelContainer.appendChild(_buildConditionPanel(actor));

    const btnRect = btn.getBoundingClientRect();
    panelContainer.style.position = 'fixed';
    panelContainer.style.top = `${btnRect.top}px`;
    panelContainer.style.left = `${btnRect.left - 300}px`;
    panelContainer.style.zIndex = '1000';
    document.body.appendChild(panelContainer);

    for (const evt of ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup']) {
      panelContainer.addEventListener(evt, (ev) => ev.stopPropagation());
    }

    panelOpen = true;

    hudCloseObserver = new MutationObserver(() => {
      if (!document.contains(hudElement) || !hudElement.querySelector('.baph-condition-hud-btn')) {
        _teardown();
      }
    });
    hudCloseObserver.observe(hudElement.parentElement ?? document.body, { childList: true, subtree: true });
  });

  const rightCol = hudElement.querySelector('.col.right');
  if (rightCol) {
    rightCol.appendChild(btn);
  } else {
    console.warn(`${MODULE_ID} | Could not find .col.right in Token HUD`);
  }
});

/* ----------------------------------------------------------
   TRUST-4 — ACTIVE-GM GATE — v2.34.0

   Mirrors task-tracker.js's `_baphTaskIsActiveGMClient()` pattern
   (`game.user?.isGM && game.user === game.users?.activeGM`). Bare
   `game.user.isGM` passes for EVERY connected GM-role client
   simultaneously; with two GM-role clients connected, each independently
   running `_handleAutoDecrement` would double-decrement (or race) the
   same turn transition. Only the elected active GM client proceeds.
   task-tracker.js is not in this goal's allowlist, so this is a local
   equivalent rather than an import.
   ---------------------------------------------------------- */

function _isActiveGMClient() {
  return !!(game.user?.isGM && game.user === game.users?.activeGM);
}

/* ----------------------------------------------------------
   PROACTIVE BREADCRUMB READ — v2.34.0

   Two prior fix attempts derived "who is the prior (departing) combatant"
   REACTIVELY at combatTurn/combatRound/pf1PostTurnChange hook-fire time —
   first from `combat.current.turn`/`updateData.turn`, then from
   `combat.combatant` — and both were disproven by live two-seat
   re-verification in a 2-combatant alternating encounter: Foundry
   combat-state propagation is not guaranteed settled at the exact moment
   these hooks fire in this environment.

   Replaced with a read of `globalThis.baphometActiveCombatant`, a value
   STAMPED proactively by action-tracker.js's render-based turn-start
   detection (`_stampActiveCombatantBreadcrumb`, called from
   `_maybeResetForNewTurn` — see that file's header comment for the full
   rationale). That stamp point is already proven safe (it's the same
   `.active`-CSS-class / renderCombatTracker signal the v1.6 rewrite in
   that file trusts), and — critically — it fires only when the NEW
   combatant's turn starts, which happens AFTER these turn-transition
   hooks fire for the OLD (departing) combatant. So at the moment any of
   the three hooks below fire, the breadcrumb still holds the departing
   combatant, not the arriving one.

   Fail-safe (EXACTLY_ONE_OR_FAIL_OPEN precedent, this repo): returns null
   — no decrement performed — if the breadcrumb is missing or belongs to
   a different combat, rather than guessing.
   ---------------------------------------------------------- */

function _getBreadcrumbCombatant(combat) {
  const breadcrumb = globalThis.baphometActiveCombatant;
  if (!breadcrumb || !combat || breadcrumb.combatId !== combat.id) return null;
  return breadcrumb;
}

/* ----------------------------------------------------------
   STUNNED COUNTDOWN LIFECYCLE — v2.34.0

   Stunned is NOT a static per-turn tier like Slowed (SS5:224, SS5:268 —
   "lose X actions starting NEXT turn; if X exceeds 3, the remainder
   carries to subsequent turns"). Two ACTOR flags (MODULE_ID namespace)
   track it, deliberately separate from the Stunned buff's own `tier`
   flag (set in `applyCondition` above, which stays at the
   originally-applied value — display/history only, never read for
   action-loss math):

     stunnedCountdown  (number) — the actual remaining action-debt. Read
                                  directly and unconditionally by
                                  action-tracker.js's
                                  `_readConditionActionLoss` — no gate on
                                  whether the Stunned buff still exists,
                                  which sidesteps the exact race that
                                  broke an earlier design (the buff being
                                  deleted the same transition its tier
                                  was last needed).
     stunnedAppliedAt  ({combatId, round, turn} | null) — the combat
                                  identity/round/turn at which the
                                  countdown was last EXTERNALLY
                                  (re)initialized (GM UI apply/tier-adjust,
                                  macro API call — see `applyCondition`
                                  above). Captured via a live read of
                                  `game.combat` at the moment of
                                  application (a GM UI click, or a macro
                                  call) — safe because that read isn't
                                  tied to the volatile turn-transition
                                  update itself, unlike the disproven
                                  hook-fire-time reads described above.

   `_decrementStunnedCountdown` (called once per turn-transition for the
   DEPARTING combatant, from `_handleAutoDecrement`) pays down
   min(countdown, 3) — never more than one turn's 3-action pool — and
   removes the buff + both flags when the remainder reaches 0.

   Round-4 mid-turn-application-skip (SS5:224 "starting NEXT turn"): if
   Stunned is (re)applied to the CURRENTLY-ACTIVE combatant mid-turn, the
   turn-start pip lock in action-tracker.js already ran before the
   countdown existed, so no actions were actually lost that turn — paying
   down debt at that same turn's end would charge a loss that was never
   locked. Guarded by comparing `stunnedAppliedAt` against the PROACTIVE
   BREADCRUMB (`_getBreadcrumbCombatant`, above): if they name the SAME
   {combatId, round, turn}, the countdown was (re)initialized during the
   very turn that is now ending, so the pay-down is skipped for this one
   transition. Because the breadcrumb's round/turn always reflects
   whichever turn is currently ending, this self-resolves on the
   combatant's NEXT turn without any explicit clearing.

   v2.44.1 FIX-B (TD-84): `turn` is an array index, and a mid-turn
   initiative change moves it while the same combatant stays current. A
   stamp that carries a `combatantId` is therefore compared by
   {combatId, round, combatantId} (a combatant has one turn per round, so
   combatant and round name the turn). A stamp written by v2.44.0, or one
   whose `combatantId` is null, keeps the {combatId, round, turn} comparison.

   Implementation-trap note (named explicitly in the goal): a naive
   design decrements by calling back into `applyCondition('stunned',
   remaining)`, which would re-stamp `stunnedAppliedAt` on every internal
   resync and skip every subsequent decrement forever. This function does
   NOT do that — it writes `stunnedCountdown` directly and calls
   `removeCondition` only at zero, never `applyCondition` — so
   `stunnedAppliedAt` is only ever written by the external path in
   `applyCondition`, and this trap does not apply to this implementation.
   ---------------------------------------------------------- */

async function _decrementStunnedCountdown(actor, breadcrumb) {
  if (!actor) return;

  const countdown = Number(actor.getFlag(MODULE_ID, 'stunnedCountdown')) || 0;
  if (countdown <= 0) return;

  const appliedAt = actor.getFlag(MODULE_ID, 'stunnedAppliedAt') ?? null;
  const _stampNamesCombatant = typeof appliedAt?.combatantId === 'string' && appliedAt.combatantId !== '';
  const sameTurn = !!(
    appliedAt && breadcrumb &&
    appliedAt.combatId === breadcrumb.combatId &&
    appliedAt.round === breadcrumb.round &&
    (_stampNamesCombatant
      ? appliedAt.combatantId === breadcrumb.combatantId
      : appliedAt.turn === breadcrumb.turn)
  );

  if (sameTurn) {
    console.debug(`${MODULE_ID} | Stunned countdown: skip pay-down for ${actor.name} — countdown was (re)applied during the turn that just ended (round-4 mid-turn-skip guard)`);
    return;
  }

  const paidDown = Math.min(countdown, 3);
  const remaining = countdown - paidDown;
  console.debug(`${MODULE_ID} | Stunned countdown: ${actor.name} ${countdown} -> ${remaining} (paid down ${paidDown})`);

  if (remaining <= 0) {
    await removeCondition(actor, 'stunned'); // clears the buff + both lifecycle flags
  } else {
    await actor.setFlag(MODULE_ID, 'stunnedCountdown', remaining);
    await _syncStunLock(actor); // v2.44.0 FIX-3: after the partial pay-down write (the lock stays while > 0)
  }
}

/* ----------------------------------------------------------
   AUTO-DECREMENT — v2.5 REWRITE, v2.34.0 TRUST-4 + STUNNED COUNTDOWN
   ---------------------------------------------------------- */

const _decrementProcessed = new Set();

async function _handleAutoDecrement(combat, priorCombatantId, source, breadcrumb) {
  if (!_isActiveGMClient()) return;
  if (!priorCombatantId) {
    console.debug(`${MODULE_ID} | Auto-decrement (${source}): no prior combatant ID (breadcrumb missing/stale), skipping`);
    return;
  }

  const dedupeKey = `${combat.id}-${combat.round}-${combat.turn}-${priorCombatantId}`;
  if (_decrementProcessed.has(dedupeKey)) {
    console.debug(`${MODULE_ID} | Auto-decrement (${source}): already processed ${dedupeKey}, skipping duplicate`);
    return;
  }
  _decrementProcessed.add(dedupeKey);

  if (_decrementProcessed.size > 50) {
    const entries = [..._decrementProcessed];
    entries.slice(0, entries.length - 20).forEach(k => _decrementProcessed.delete(k));
  }

  const combatant = combat.combatants.get(priorCombatantId);
  if (!combatant?.actor) {
    console.debug(`${MODULE_ID} | Auto-decrement (${source}): combatant ${priorCombatantId} has no actor`);
    return;
  }

  const actor = combatant.actor;
  console.debug(`${MODULE_ID} | Auto-decrement (${source}): processing end-of-turn for ${actor.name}`);

  let decremented = false;
  for (const [key, cond] of Object.entries(CONDITIONS)) {
    if (!cond.autoDecrement) continue;
    if (key === 'stunned') continue; // v2.34.0: bespoke multi-action countdown, handled below — not a simple -1

    const buff = _findExistingBuff(actor, key);
    if (!buff) continue;

    const currentTier = buff.getFlag(MODULE_ID, 'tier') ?? 0;
    if (currentTier > 0) {
      console.debug(`${MODULE_ID} | Auto-decrement: ${actor.name} ${cond.name} ${currentTier} → ${currentTier - 1}`);
      await adjustCondition(actor, key, -1);
      decremented = true;
    }
  }

  await _decrementStunnedCountdown(actor, breadcrumb);

  // v2.37.3 FIX-5: explicit call site named by the goal. `_decrementStunnedCountdown` already
  // routes through `removeCondition('stunned')` (which itself re-syncs) when the countdown hits
  // zero, but when it only pays the countdown DOWN to a still-positive remainder it writes the
  // `stunnedCountdown` flag directly with no callback — this call is the idempotent safety net
  // for that path. A no-op here (the common case, since `> 0` is unchanged either side of a
  // partial pay-down) performs zero document writes, per `_syncOffGuard`'s idempotency contract.
  await _syncOffGuard(actor);

  if (!decremented) {
    console.debug(`${MODULE_ID} | Auto-decrement (${source}): ${actor.name} has no auto-decrement conditions active`);
  }
}

Hooks.on('pf1PostTurnChange', (combat, prior, current) => {
  console.debug(`${MODULE_ID} | Hook fired: pf1PostTurnChange`, { prior, current });

  const breadcrumb = _getBreadcrumbCombatant(combat);
  _handleAutoDecrement(combat, breadcrumb?.combatantId ?? null, 'pf1PostTurnChange', breadcrumb);
});

Hooks.on('combatTurn', (combat, updateData, updateOptions) => {
  console.debug(`${MODULE_ID} | Hook fired: combatTurn`, { turn: combat.current?.turn, round: combat.current?.round });

  const breadcrumb = _getBreadcrumbCombatant(combat);
  _handleAutoDecrement(combat, breadcrumb?.combatantId ?? null, 'combatTurn', breadcrumb);
});

Hooks.on('combatRound', (combat, updateData, updateOptions) => {
  console.debug(`${MODULE_ID} | Hook fired: combatRound`, { turn: combat.current?.turn, round: combat.current?.round });

  const breadcrumb = _getBreadcrumbCombatant(combat);
  _handleAutoDecrement(combat, breadcrumb?.combatantId ?? null, 'combatRound', breadcrumb);
});

/* ----------------------------------------------------------
   ORPHANED STUNNED FLAG CLEANUP — v2.34.0 round-2 FIX-1

   The Stunned countdown lifecycle above deliberately decouples
   stunnedCountdown/stunnedAppliedAt from the Stunned buff Item's own
   existence — action-tracker.js's `_readConditionActionLoss` reads
   stunnedCountdown UNCONDITIONALLY, with no gate on whether the buff Item
   still exists, to avoid re-opening the intra-transition race this design
   closed (see the STUNNED COUNTDOWN LIFECYCLE comment above). That
   decoupling means a direct Item deletion — a GM deleting the Stunned
   buff Item straight from the actor sheet, or any other path that
   deletes the Item without going through `removeCondition()` — would
   leave stunnedCountdown/stunnedAppliedAt orphaned on the actor: a
   "ghost" Stunned action-loss surviving the buff's own removal.

   `removeCondition()` (above) already clears both flags itself before it
   deletes the Item, so this hook exists to catch every OTHER deletion
   path. Rather than trying to distinguish those paths, it unsets the
   same two flags unconditionally whenever a Stunned buff Item (matched
   by `type === 'buff'` + `conditionKey === 'stunned'`, the existing
   pattern at `_findExistingBuff`/`applyCondition` above) is deleted, by
   any route. This is deliberately idempotent: when it fires as a
   side-effect of removeCondition's OWN delete, the flags are already
   unset and `unsetFlag` on an already-clear flag is a harmless no-op —
   so this cannot loop back into the lifecycle (no `applyCondition`,
   `removeCondition`, or Item-delete call happens from here).

   Gated through `_isActiveGMClient()` (TRUST-4, above) so two connected
   GM-role clients cannot both fire this cleanup redundantly or race a
   permission-limited flag write. Mirrors the confirmed in-repo
   `deleteItem` hook pattern at `action-tracker.js:1634`
   (`Hooks.on('deleteItem', (item) => _onBuffChangeForHasteBonus(item));`)
   — the only other `deleteItem` hook anywhere in this tree.
   ---------------------------------------------------------- */

async function _onDeleteItemCleanupOrphanedStunnedFlags(item) {
  if (!_isActiveGMClient()) return;
  if (item?.type !== 'buff') return;
  if (item.getFlag(MODULE_ID, 'conditionKey') !== 'stunned') return;

  const actor = item.actor ?? item.parent;
  if (!actor) return;

  console.debug(`${MODULE_ID} | deleteItem: clearing any orphaned Stunned countdown flags for ${actor.name}`);
  // v2.44.0 FIX-3: awaited so `syncStunLock` reads the cleared countdown and restores the locked pips.
  await actor.unsetFlag(MODULE_ID, 'stunnedCountdown');
  await actor.unsetFlag(MODULE_ID, 'stunnedAppliedAt');
  await _syncStunLock(actor);
}
Hooks.on('deleteItem', (item) => _onDeleteItemCleanupOrphanedStunnedFlags(item));

/* ----------------------------------------------------------
   CONDITION TRANSLATOR — v2.41.0 (GOAL_v2.41.0_CONDITION_TRANSLATOR, FIX-2/FIX-3, TD-38 part 2)

   v2.40.0 made pf1's `shaken`, `frightened`, `panicked`, `sickened`, `stunned` and `blind`
   inert. This block turns a pf1 status that APPEARS on an actor into the Ledger condition canon
   assigns it (Condition_Conversion.md § Translation Table), either by itself (world setting
   `autoConditionTranslate` ON, canon Shape B) or by asking the GM on a whispered card (OFF,
   canon Shape C).

   Rulings in force (Michael, 2026-10-01): R2 — the Ledger tier wins, a pf1 status is a floor.
   R-A translate once: acts on an appearance only, never as a continuous floor (Frightened and
   Stunned count themselves down). R-B release on removal, narrowly. R-C only the active GM's
   client acts. P-1 no-op when the Ledger tier is already at or above the default (Stunned is read
   from `stunnedCountdown`). P-2 only a buff the translator CREATED is marked
   `translatedFrom: { status, tier }`. P-3 no retroactive translation. P-4 R-B runs in both modes.

   TRIGGER. Not one hook's payload: Foundry's document hooks (create/update/delete for
   ActiveEffect and Item, and pf1's `pf1ToggleActorBuff`) only tell the translator an actor MAY
   have changed. It then compares the actor's current `actor.statuses`, restricted to the nine
   table ids, with the set it last saw for that actor. In the new set and not the old: APPEARED.
   In the old and not the new: REMOVED. Statuses arrive three ways (pf1's condition toggle makes
   one actor-hosted effect per status; a plain effect carries its own `statuses`; a pf1 buff whose
   `system.conditions` lists a status creates no effect and reaches `actor.statuses` in data
   preparation) — all three go through the same comparison.

   COALESCING. The first hook for an actor in a task schedules ONE check for that actor in a later
   macrotask (`setTimeout(…, 0)`); every further hook for that actor before it runs joins it. A
   three-status `setConditions` (three synchronous `createActiveEffect` hooks) becomes one check and
   one card, and the check reads `actor.statuses` after Foundry and pf1 have re-prepared the actor.
   A hook that lands while that actor's check is running marks it dirty and one more check follows.

   WHO ACTS. Hooks are listened to on GM clients only (a player's client keeps no state; at most it
   logs one console.info when it makes a change with no GM online — P-3). A non-active GM client
   only keeps its picture of the actor current; only `_isActiveGMClient()` writes and records.

   STARTING SETS (P-3). An actor's statuses when a GM client first sees it are its starting set,
   never an appearance. World actors are seeded at `ready` and on `createActor`; token actors of
   the viewed scene on `canvasReady` and `createToken`. An actor the client has never seen when a
   hook arrives (an unlinked token off the viewed scene) is seeded at that moment: its first check
   records the note `first-sight` and translates nothing.

   RESOLVING A DOCUMENT TO ITS ACTOR. An ActiveEffect's `parent` is the actor, or an Item whose
   `parent` is the actor; an Item's `parent` is the actor; `pf1ToggleActorBuff` hands the actor over.

   References: docs/reference/foundry-v13/99_Combined_Foundry_v13_PF1_[KnowledgeFiles.md].md —
   document hooks `createActiveEffect(effect, options, userId)` (:2177) and the type-specific
   Item variants (:2306), `renderChatMessageHTML(message, html, data)` with an HTMLElement (:2317,
   :2416), `pf1ToggleActorBuff(actor, item, state)` (:805), `actor.statuses` (:3816),
   `actor.setCondition` / `setConditions` (:839-840).
   ---------------------------------------------------------- */

// The nine rows, pf1 id -> Ledger catalog key + default tier (toggles at 1). `panicked` is
// Frightened 3 plus Fleeing (v2.42.0 FIX-5, R-2): its `also` row is a second write, Fleeing, whose
// tier is 3 unless the source is a buff with a duration (see `_translatorAlsoTier`).
const _TRANSLATION_TABLE = Object.freeze({
  shaken:     Object.freeze({ key: 'frightened', tier: 1 }),
  frightened: Object.freeze({ key: 'frightened', tier: 2 }),
  panicked:   Object.freeze({ key: 'frightened', tier: 3, also: Object.freeze({ key: 'fleeing', tier: 3 }) }),
  sickened:   Object.freeze({ key: 'sickened',   tier: 2 }),
  stunned:    Object.freeze({ key: 'stunned',     tier: 3 }), // v2.44.0 FIX-2: the default; see `_translatorStunnedTier`
  blind:      Object.freeze({ key: 'blinded',     tier: 1 }),
  staggered:  Object.freeze({ key: 'slowed',      tier: 1 }),
  disabled:   Object.freeze({ key: 'slowed',      tier: 1 }),
  nauseated:  Object.freeze({ key: 'nauseated',   tier: 1 }),
});

const _TRANSLATOR_PF1_NAMES = Object.freeze({
  shaken: 'Shaken', frightened: 'Frightened', panicked: 'Panicked', sickened: 'Sickened',
  stunned: 'Stunned', blind: 'Blind', staggered: 'Staggered', disabled: 'Disabled', nauseated: 'Nauseated',
});

// Ledger conditions that count themselves down: R-B never releases these.
const _TRANSLATOR_SELF_DECREMENTING = Object.freeze(['frightened', 'stunned', 'fleeing']);

const _TRANSLATOR_LOG_MAX = 50;

const _translatorSeen = new Map();      // actor uuid -> Set of table ids last seen on it
const _translatorQueue = new Map();     // actor uuid -> { actor, timer, running, dirty }
const _translatorLog = [];              // in-memory record log, oldest first, last 50
const _translatorResolving = new Set(); // card message ids being resolved right now
let _translatorSeq = 0;

function _translationTableCopy() {
  return Object.fromEntries(
    Object.entries(_TRANSLATION_TABLE).map(([id, row]) => [id, row.also
      ? { key: row.key, tier: row.tier, also: { key: row.also.key, tier: row.also.tier } }
      : { key: row.key, tier: row.tier }])
  );
}

function _translatorLogCopy() {
  return _translatorLog.map(r => structuredClone(r));
}

function _translatorIdle() {
  return _translatorQueue.size === 0;
}

function _translatorAutoOn() {
  try {
    return game.settings.get(MODULE_ID, 'autoConditionTranslate') === true;
  } catch (err) {
    return false; // not registered — behave as the default (OFF)
  }
}

function _translatorIds(iterable) {
  return Array.from(iterable ?? []).filter(id => Object.hasOwn(_TRANSLATION_TABLE, id));
}

function _translatorStatusSet(actor) {
  return new Set(_translatorIds(actor?.statuses));
}

function _translatorActorLive(actor) {
  if (!actor) return false;
  if (actor.isToken) return !!(actor.token && actor.token.parent?.tokens?.has(actor.token.id));
  return !!game.actors?.has(actor.id);
}

function _translatorActorOfEffect(effect) {
  const parent = effect?.parent;
  if (!parent) return null;
  if (parent.documentName === 'Actor') return parent;
  if (parent.documentName === 'Item' && parent.parent?.documentName === 'Actor') return parent.parent;
  return null;
}

function _translatorActorOfItem(item) {
  const parent = item?.parent;
  return parent?.documentName === 'Actor' ? parent : null;
}

function _translatorGMIds() {
  return ChatMessage.getWhisperRecipients('GM').map(u => u.id);
}

// Group pf1 ids by Ledger key, each group's ids in alphabetical order, so the alphabetically first
// one names the group (the record's `status` and the mark's).
function _translatorGroupByKey(ids) {
  const groups = new Map();
  for (const id of [...ids].sort()) {
    const key = _TRANSLATION_TABLE[id].key;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }
  return groups;
}

// P-1: the current tier is `getTier()`, except Stunned, where it is `stunnedCountdown`.
function _translatorCurrentTier(actor, key) {
  if (key === 'stunned') return Number(actor.getFlag(MODULE_ID, 'stunnedCountdown')) || 0;
  return _findExistingBuff(actor, key)?.getFlag(MODULE_ID, 'tier') ?? 0;
}

// Which Ledger writes a set of appeared ids needs. A key whose Ledger tier is already at or above
// its default (the highest default among its ids) is skipped and nothing is written for it.
function _translatorPlan(actor, ids) {
  const writes = [];
  const skipped = [];
  for (const [key, statuses] of _translatorGroupByKey(ids)) {
    const tier = Math.max(...statuses.map(id => _translatorDefaultTier(actor, id)));
    const from = _translatorCurrentTier(actor, key);
    if (from >= tier) skipped.push(...statuses);
    else writes.push({ key, status: statuses[0], statuses, tier, from });
  }

  // v2.42.0 FIX-5: a row's `also` is a second write under the same rule (max(current, default), no
  // write at or above). A status counts as skipped only when none of its writes was needed.
  const alsoWritten = new Set();
  for (const id of [...ids].sort()) {
    const also = _TRANSLATION_TABLE[id]?.also;
    if (!also || writes.some(w => w.key === also.key)) continue;
    const tier = _translatorAlsoTier(actor, id, also);
    const from = _translatorCurrentTier(actor, also.key);
    if (from >= tier) continue;
    writes.push({ key: also.key, status: id, statuses: [id], tier, from, also: true });
    alsoWritten.add(id);
  }
  return { writes, skipped: skipped.filter(id => !alsoWritten.has(id)).sort() };
}

// v2.44.0 FIX-2 (R-1, R-3): a table id's default tier on THIS actor. Every id uses its table tier,
// except the one whose Ledger key is `stunned`, which converts at 3 per round of its source's duration.
function _translatorDefaultTier(actor, id) {
  return _TRANSLATION_TABLE[id].key === 'stunned'
    ? _translatorStunnedTier(actor)
    : _TRANSLATION_TABLE[id].tier;
}

// v2.44.0 FIX-2 (R-1, R-3, Q6, L-5): a PF1 stun converts at Stunned 3 per round of its duration
// (3 when no duration is stated, as for the HUD toggle). The highest across every source wins: each
// ACTIVE buff whose `system.conditions` lists `stunned`, and each non-disabled ActiveEffect on the
// actor itself that carries the `stunned` status with `flags.pf1.autoDelete` true (pf1's condition
// toggle, which can carry a duration). Seconds come from the source's own seconds-type ActiveEffect
// only; an expired or durationless effect gives 3. No cap here (R-2).
function _translatorStunnedTier(actor) {
  const round = Number(CONFIG.time?.roundTime);
  const tierOf = seconds => (seconds !== null && round > 0 ? 3 * Math.ceil(seconds / round) : 3);
  let best = 0;

  for (const buff of Array.from(actor.items ?? [])) {
    if (buff.type !== 'buff' || !buff.system?.active) continue;
    if (!Array.from(buff.system?.conditions ?? []).includes('stunned')) continue;
    best = Math.max(best, tierOf(_translatorBuffSeconds(buff)));
  }

  for (const effect of Array.from(actor.effects ?? [])) {
    if (effect.disabled || !effect.statuses?.has?.('stunned')) continue;
    if (effect.getFlag('pf1', 'autoDelete') !== true) continue;
    best = Math.max(best, tierOf(_translatorEffectSeconds(effect)));
  }

  return best > 0 ? best : 3;
}

// FIX-5 (R-2, P-f): the tier of a row's `also` write. Fleeing matches the default (3), except when the
// status's source is an ACTIVE pf1 buff with a finite duration: then it is
// Math.ceil(remaining / CONFIG.time.roundTime), clamped to 1-10 (the clamp is a tracker limit, P-f).
// `remaining` is in seconds — read from the buff's own seconds-type ActiveEffect (`duration.remaining`)
// only (v2.44.0 FIX-2: a pf1 dice duration is re-rolled by reading it from the item, so the item is never
// asked). An expired (remaining <= 0) or durationless effect gives the default.
function _translatorAlsoTier(actor, status, also) {
  const buff = actor.items.find(i =>
    i.type === 'buff' && i.system?.active && Array.from(i.system?.conditions ?? []).includes(status)
  );
  const seconds = buff ? _translatorBuffSeconds(buff) : null;
  const round = Number(CONFIG.time?.roundTime);
  if (seconds === null || !(round > 0)) return also.tier;
  return Math.clamp(Math.ceil(seconds / round), 1, 10);
}

// One effect's remaining seconds: a non-disabled seconds-type ActiveEffect whose `duration.remaining`
// is finite and above 0 (an expired one is no duration, Q6), else null.
function _translatorEffectSeconds(effect) {
  if (!effect || effect.disabled || effect.duration?.type !== 'seconds') return null;
  const remaining = Number(effect.duration.remaining);
  return Number.isFinite(remaining) && remaining > 0 ? remaining : null;
}

function _translatorBuffSeconds(buff) {
  for (const effect of Array.from(buff.effects ?? [])) {
    const seconds = _translatorEffectSeconds(effect);
    if (seconds !== null) return seconds;
  }
  return null;
}

// One Ledger write. P-2: the buff is marked `translatedFrom` only when the translator created it
// (no buff for the key existed before); a buff it merely raised is left unmarked.
// v2.44.0 FIX-4: the mark also records the `source` (`_translatorSource` at the time of the write —
// 'condition toggle' for pf1's own condition effect), so `removeCondition` knows whether pf1's own
// status should clear with a toggle-sourced Stunned.
async function _translatorWrite(actor, write) {
  const existed = !!_findExistingBuff(actor, write.key);
  await applyCondition(actor, write.key, write.tier);
  if (!existed) {
    const buff = _findExistingBuff(actor, write.key);
    if (buff) {
      await buff.setFlag(MODULE_ID, 'translatedFrom', {
        status: write.status, tier: write.tier, source: _translatorSource(actor, write.status),
      });
    }
  }
  return { status: write.status, key: write.key, from: write.from, to: write.tier };
}

// The source named for an appeared status: the active buff whose `system.conditions` lists it; else
// 'condition toggle' for pf1's own condition effect (flags.pf1.autoDelete === true); else the effect's
// own name (an effect on an item is named by its item).
function _translatorSource(actor, id) {
  const buff = actor.items.find(i =>
    i.type === 'buff' && i.system?.active && Array.from(i.system?.conditions ?? []).includes(id)
  );
  if (buff) return buff.name;

  const effects = [...actor.effects, ...Array.from(actor.items).flatMap(i => Array.from(i.effects ?? []))];
  const effect = effects.find(e => !e.disabled && e.statuses?.has?.(id));
  if (effect) {
    if (effect.getFlag('pf1', 'autoDelete') === true) return 'condition toggle';
    return effect.parent?.documentName === 'Item' ? effect.parent.name : effect.name;
  }
  return 'unknown';
}

function _translatorAppend(rec) {
  rec.seq = ++_translatorSeq;
  _translatorLog.push(rec);
  while (_translatorLog.length > _TRANSLATOR_LOG_MAX) _translatorLog.shift();
}

// One line per pf1 status. `items` are that status's card items (v2.42.0 FIX-5: a Panicked line
// carries two, Frightened and Fleeing: "Apply Frightened 3 and Fleeing 3?").
function _translatorCardLine(actor, items, source) {
  const esc = foundry.utils.escapeHTML;
  const names = items.map(item => esc(_buffName(item.key, item.tier))).join(' and ');
  return `<li>${esc(source)} applied ${_TRANSLATOR_PF1_NAMES[items[0].status]} to ${esc(actor.name)}. `
    + `Apply ${names}?</li>`;
}

// Shape C: one card per check, whispered to GMs only, speaker the actor. Returns the message id.
async function _translatorPostCard(actor, items, sources) {
  const esc = foundry.utils.escapeHTML;
  const byStatus = new Map();
  for (const item of items) {
    if (!byStatus.has(item.status)) byStatus.set(item.status, []);
    byStatus.get(item.status).push(item);
  }
  const lines = [...byStatus].map(([status, group]) => _translatorCardLine(actor, group, sources[status] ?? 'unknown')).join('');
  const btn = 'font-family: var(--baph-font-heading, \'Courier Prime\', monospace); text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px; cursor: pointer; margin-right: 6px;';
  const content = `<div class="baph-translator-card">
    <div style="font-family: var(--baph-font-heading, 'Courier Prime', monospace); text-transform: uppercase; letter-spacing: 0.05em; color: var(--baph-gold, #b8943e); font-size: 13px;">
      ${esc(actor.name)} — Condition translation
    </div>
    <ul style="font-family: var(--baph-font-body, 'Alegreya', serif); font-size: 12px; margin: 4px 0; padding-left: 18px;">${lines}</ul>
    <div class="baph-translator-actions" style="margin-top: 4px;">
      <button type="button" style="${btn}" data-baph-translate="apply">Apply</button>
      <button type="button" style="${btn}" data-baph-translate="skip">Skip</button>
    </div>
  </div>`;

  const message = await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: _translatorGMIds(),
    flags: {
      [MODULE_ID]: {
        translatorPrompt: {
          actorUuid: actor.uuid,
          items: items.map(i => ({ status: i.status, key: i.key, tier: i.tier })),
          state: 'open',
        },
      },
    },
  });
  return message?.id ?? null;
}

// The translating half of a check: appearances, then removals. Fills `rec` in place.
async function _translatorTranslate(actor, rec, had, now) {
  rec.appeared = [...now].filter(id => !had.has(id)).sort();
  rec.removed = [...had].filter(id => !now.has(id)).sort();

  for (const id of rec.appeared) rec.sources[id] = _translatorSource(actor, id);

  // ---- appearances ----
  if (rec.appeared.length) {
    const plan = _translatorPlan(actor, rec.appeared);
    rec.skipped = plan.skipped;

    if (rec.mode === 'auto') {
      for (const write of plan.writes) rec.applied.push(await _translatorWrite(actor, write));
    } else {
      // v2.42.0 FIX-5: an `also` write (Fleeing) carries its own tier on the card, not the row's.
      const items = plan.writes.flatMap(w => w.statuses.map(status => ({
        status, key: w.key, tier: w.also ? w.tier : _translatorDefaultTier(actor, status),
      }))).sort((a, b) => a.status.localeCompare(b.status));
      if (items.length) rec.promptId = await _translatorPostCard(actor, items, rec.sources);
    }
  }

  // ---- removals: one decision per Ledger key (R-B, P-4, both modes) ----
  if (rec.removed.length) {
    const stillOn = _translatorStatusSet(actor);
    for (const [key, statuses] of _translatorGroupByKey(rec.removed)) {
      const status = statuses[0];
      const buff = _findExistingBuff(actor, key);
      if (!buff) continue; // nothing left to decide for this key

      if (_TRANSLATOR_SELF_DECREMENTING.includes(key)) {
        rec.kept.push({ status, key, reason: 'self-decrementing' });
        continue;
      }

      const mark = buff.getFlag(MODULE_ID, 'translatedFrom') ?? null;
      let reason = null;
      if (!mark) reason = 'not-translated';
      else if ((buff.getFlag(MODULE_ID, 'tier') ?? 0) !== mark.tier) reason = 'tier-changed';
      else if (Object.entries(_TRANSLATION_TABLE).some(([id, row]) => row.key === key && stillOn.has(id))) reason = 'other-source';

      if (reason) {
        rec.kept.push({ status, key, reason });
      } else {
        await removeCondition(actor, key);
        rec.released.push(key);
      }
    }

    // v2.42.0 FIX-5: a row's `also` condition (Fleeing) counts itself down, so it is kept like
    // Frightened and never released (R-2). Only the self-decrementing path exists for it.
    const alsoSeen = new Set();
    for (const id of [...rec.removed].sort()) {
      const also = _TRANSLATION_TABLE[id]?.also;
      if (!also || alsoSeen.has(also.key)) continue;
      alsoSeen.add(also.key);
      if (!_TRANSLATOR_SELF_DECREMENTING.includes(also.key) || !_findExistingBuff(actor, also.key)) continue;
      rec.kept.push({ status: id, key: also.key, reason: 'self-decrementing' });
    }
  }
}

async function _translatorCheck(actor) {
  const uuid = actor.uuid;
  if (!_translatorActorLive(actor)) {
    _translatorSeen.delete(uuid);
    return;
  }

  const now = _translatorStatusSet(actor);
  const had = _translatorSeen.get(uuid) ?? null;
  _translatorSeen.set(uuid, new Set(now));

  // R-C: only the active GM's client records or writes anything. Another GM client keeps its
  // picture of the actor current, so it never replays an old change if it later becomes active.
  if (!_isActiveGMClient()) return;

  const rec = {
    seq: 0,
    at: Date.now(),
    actorUuid: uuid,
    mode: _translatorAutoOn() ? 'auto' : 'prompt',
    appeared: [],
    removed: [],
    sources: {},
    applied: [],
    skipped: [],
    released: [],
    kept: [],
    promptId: null,
    notes: [],
  };

  try {
    if (!had) rec.notes.push('first-sight'); // P-3: a status already there is a starting set
    else await _translatorTranslate(actor, rec, had, now);
  } catch (err) {
    console.error(`${MODULE_ID} | Condition translator failed for ${actor.name}`, err);
    rec.notes.push('error');
  }

  // v2.42.0 FIX-2: every check ends by re-deriving Off-Guard (a first-sight check translates nothing
  // but still syncs), so a pf1 status, a buff, an item flag or a combat change reaches
  // `_syncOffGuard` through this one coalesced, macrotask-scheduled check.
  try {
    await _syncOffGuard(actor);
  } catch (err) {
    console.error(`${MODULE_ID} | Off-Guard sync failed for ${actor.name}`, err);
    rec.notes.push('error');
  }

  // Appended only after the check's writes have finished.
  _translatorAppend(rec);
}

async function _translatorRun(uuid) {
  const q = _translatorQueue.get(uuid);
  if (!q) return;
  q.timer = null;
  q.running = true;
  q.dirty = false;
  try {
    await _translatorCheck(q.actor);
  } catch (err) {
    console.error(`${MODULE_ID} | Condition translator check threw`, err);
  }
  q.running = false;
  if (q.dirty) {
    q.dirty = false;
    q.timer = setTimeout(() => _translatorRun(uuid), 0);
  } else {
    _translatorQueue.delete(uuid);
  }
}

// An actor MAY have changed. The first hook in a task schedules one check in a later macrotask;
// every further hook for that actor before it runs joins it.
function _translatorSchedule(actor) {
  if (!actor || actor.pack || !game.user?.isGM) return;
  const uuid = actor.uuid;
  let q = _translatorQueue.get(uuid);
  if (!q) {
    q = { actor, timer: null, running: false, dirty: false };
    _translatorQueue.set(uuid, q);
  }
  q.actor = actor;
  if (q.timer !== null) return;
  if (q.running) { q.dirty = true; return; }
  q.timer = setTimeout(() => _translatorRun(uuid), 0);
}

function _translatorSeed(actor) {
  if (!actor || actor.pack || !game.user?.isGM) return;
  if (_translatorSeen.has(actor.uuid)) return;
  _translatorSeen.set(actor.uuid, _translatorStatusSet(actor));
}

function _translatorSeedScene(scene) {
  for (const token of scene?.tokens ?? []) {
    try { _translatorSeed(token.actor); } catch (err) { /* token without a usable actor */ }
  }
}

// P-3: when no GM is online nothing can act. The client whose user made the change says so, once.
function _translatorNoGmNote(actor, ids, userId) {
  if (!ids.length || game.users?.activeGM || userId !== game.user?.id) return;
  console.info(`${MODULE_ID} | Condition translator: no GM is online, so ${actor.name}'s ${ids.join(', ')} was not translated to a Ledger condition.`);
}

Hooks.on('createActiveEffect', (effect, options, userId) => {
  const actor = _translatorActorOfEffect(effect);
  if (!actor) return;
  _translatorNoGmNote(actor, _translatorIds(effect.statuses), userId);
  _translatorSchedule(actor);
});

// The update hook gives no prior state and a player client keeps none, so the no-GM line names every
// mapped status the effect now carries, not strictly the newly added ones.
Hooks.on('updateActiveEffect', (effect, changes, options, userId) => {
  const actor = _translatorActorOfEffect(effect);
  if (!actor) return;
  const touched = !!changes && (Object.hasOwn(changes, 'statuses') || Object.hasOwn(changes, 'disabled'));
  if (touched && effect.disabled !== true) {
    _translatorNoGmNote(actor, _translatorIds(effect.statuses), userId);
  }
  _translatorSchedule(actor);
});
Hooks.on('deleteActiveEffect', (effect) => _translatorSchedule(_translatorActorOfEffect(effect)));

Hooks.on('createItem', (item, options, userId) => {
  const actor = _translatorActorOfItem(item);
  if (!actor) return;
  if (item.type === 'buff' && item.system?.active) {
    _translatorNoGmNote(actor, _translatorIds(item.system?.conditions), userId);
  }
  _translatorSchedule(actor);
});

Hooks.on('updateItem', (item, changes, options, userId) => {
  const actor = _translatorActorOfItem(item);
  if (!actor) return;
  const sys = changes?.system;
  const touched = !!sys && (Object.hasOwn(sys, 'active') || Object.hasOwn(sys, 'conditions'));
  if (item.type === 'buff' && touched && item.system?.active === true) {
    _translatorNoGmNote(actor, _translatorIds(item.system?.conditions), userId);
  }
  _translatorSchedule(actor);
});

Hooks.on('deleteItem', (item) => _translatorSchedule(_translatorActorOfItem(item)));

// A buff whose system.conditions lists a status makes no effect; activating or deactivating it is
// signalled here and by updateItem. Joining the same scheduled check makes the double signal free.
Hooks.on('pf1ToggleActorBuff', (actor) => _translatorSchedule(actor));

// Starting sets (P-3).
Hooks.once('ready', () => {
  if (!game.user?.isGM) return;
  for (const actor of game.actors ?? []) _translatorSeed(actor);
});
Hooks.on('createActor', (actor) => _translatorSeed(actor));
Hooks.on('deleteActor', (actor) => { if (actor?.uuid) _translatorSeen.delete(actor.uuid); });
Hooks.on('canvasReady', () => {
  if (game.user?.isGM) _translatorSeedScene(canvas?.scene);
});
Hooks.on('createToken', (token) => {
  try { _translatorSeed(token.actor); } catch (err) { /* token without a usable actor */ }
});

/* ----------------------------------------------------------
   FIX-3 — SHAPE C's CARD: the buttons and the one resolver
   ---------------------------------------------------------- */

function _translatorFindActor(uuid) {
  try {
    const doc = fromUuidSync(uuid);
    if (doc?.documentName === 'Actor') return doc;
    if (doc?.actor) return doc.actor;
  } catch (err) { /* fall through to the world collection */ }
  return typeof uuid === 'string' && uuid.startsWith('Actor.') ? (game.actors?.get(uuid.slice(6)) ?? null) : null;
}

// The card with its buttons removed and one line saying what was done.
function _translatorClosedContent(content, line) {
  const tpl = document.createElement('template');
  tpl.innerHTML = content ?? '';
  tpl.content.querySelector('.baph-translator-actions')?.remove();
  const done = document.createElement('div');
  done.className = 'baph-translator-done';
  done.style.cssText = 'font-family: var(--baph-font-body, \'Alegreya\', serif); font-size: 12px; margin-top: 4px;';
  done.textContent = line;
  (tpl.content.querySelector('.baph-translator-card') ?? tpl.content).appendChild(done);
  return tpl.innerHTML;
}

// Apply: re-reads each line's status and current tier now. A status no longer on the actor is not
// applied; one already at or above its default is skipped; the rest are applied and marked exactly
// as Shape B does.
async function _translatorApplyItems(actor, items) {
  const ids = [];
  const gone = [];
  for (const item of items) {
    if (!Object.hasOwn(_TRANSLATION_TABLE, item?.status)) continue;
    if (actor.statuses?.has(item.status)) ids.push(item.status);
    else gone.push(item.status);
  }
  const plan = _translatorPlan(actor, [...new Set(ids)]);
  const applied = [];
  for (const write of plan.writes) applied.push(await _translatorWrite(actor, write));
  return { applied, skipped: plan.skipped, gone };
}

async function _resolveTranslation(messageId, choice) {
  if (!game.user?.isGM) return { ok: false, reason: 'not-gm' };
  if (choice !== 'apply' && choice !== 'skip') return { ok: false, reason: 'bad-choice' };

  const message = game.messages?.get(messageId) ?? null;
  const prompt = message?.flags?.[MODULE_ID]?.translatorPrompt ?? null;
  if (!prompt) return { ok: false, reason: 'not-found' };
  if (prompt.state !== 'open' || _translatorResolving.has(messageId)) return { ok: false, reason: 'resolved' };

  _translatorResolving.add(messageId);
  try {
    let line = 'Skipped — nothing was applied.';
    if (choice === 'apply') {
      const actor = _translatorFindActor(prompt.actorUuid);
      if (!actor) return { ok: false, reason: 'no-actor' };
      const result = await _translatorApplyItems(actor, prompt.items ?? []);
      const parts = [];
      if (result.applied.length) {
        parts.push(`Applied ${result.applied.map(a => _buffName(a.key, a.to)).join(', ')}.`);
      }
      if (result.skipped.length) {
        parts.push(`Left alone, already at or above the default: ${result.skipped.map(s => _TRANSLATOR_PF1_NAMES[s]).join(', ')}.`);
      }
      if (result.gone.length) {
        parts.push(`No longer on the actor: ${result.gone.map(s => _TRANSLATOR_PF1_NAMES[s]).join(', ')}.`);
      }
      line = parts.length ? parts.join(' ') : 'Applied — nothing needed writing.';
    }

    const state = choice === 'apply' ? 'applied' : 'skipped';
    await message.update({
      content: _translatorClosedContent(message.content, line),
      [`flags.${MODULE_ID}.translatorPrompt.state`]: state,
    });
    return { ok: true, state };
  } finally {
    _translatorResolving.delete(messageId);
  }
}

// The buttons, wired on GM clients only (v13: `html` is an HTMLElement).
Hooks.on('renderChatMessageHTML', (message, html, data) => {
  if (!game.user?.isGM) return;
  if (message?.flags?.[MODULE_ID]?.translatorPrompt?.state !== 'open') return;
  const root = _baphNormalizeHtml(html);
  if (!root?.querySelectorAll) return;
  for (const btn of root.querySelectorAll('[data-baph-translate]')) {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      _resolveTranslation(message.id, btn.dataset.baphTranslate).catch(err => {
        console.error(`${MODULE_ID} | Condition translator card could not be resolved`, err);
      });
    });
  }
});
