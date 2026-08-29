/* ============================================================
   ECHOES OF BAPHOMET — PF1.5 CONDITION OVERLAY v2.9
   Applies PF2e-style conditions as PF1e system Buffs.

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

   TIERED (1-4):  Frightened, Sickened, Stupefied, Clumsy,
                  Enfeebled, Drained, Stunned, Slowed, Fascinated
   TOGGLE (on/off): Fatigued, Off-Guard, Persistent Damage,
                    Blinded, Deafened, Nauseated, Confused,
                    Paralyzed
   (Staggered is NOT a live tracked condition — SS5 folds it into Slowed 1
   at the point of application; see v2.8 Changes above, MECH-3.)

   For Foundry VTT v13 + PF1e System
   Source: Homebrew_Master_File.md § Simplified Conditions
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
    description: '–X penalty to attack rolls, saving throws, skill checks, and ability checks. Decreases by 1 at end of your turn.',
    autoDecrement: true,
    buildChanges(tier) {
      const v = String(-tier);
      return [
        { formula: v, operator: 'add', target: 'attack',         modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'allSavingThrows', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'skills',         modifier: 'penalty', priority: 0 },
      ];
    }
  },

  sickened: {
    name: 'Sickened',
    icon: 'icons/svg/poison.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to attack rolls, weapon damage, saving throws, skill checks, and ability checks. Cannot eat or drink (including potions). Spend 1 action to Retch (Fort save vs. source DC) to reduce by 1.',
    autoDecrement: false,
    buildChanges(tier) {
      const v = String(-tier);
      return [
        { formula: v, operator: 'add', target: 'attack',         modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'damage',         modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'allSavingThrows', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'skills',         modifier: 'penalty', priority: 0 },
      ];
    }
  },

  stupefied: {
    name: 'Stupefied',
    icon: 'icons/svg/daze.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to INT/WIS/CHA-based rolls, spell DCs, and Will saves. Casting a spell requires a DC (5 + X) flat check or it fails.',
    autoDecrement: false,
    buildChanges(tier) {
      const v = String(-tier);
      return [
        { formula: v, operator: 'add', target: 'int', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'wis', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'cha', modifier: 'penalty', priority: 0 },
      ];
    }
  },

  clumsy: {
    name: 'Clumsy',
    icon: 'icons/svg/falling.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to DEX-based attack rolls, Reflex saves, DEX-based skill checks, and AC.',
    autoDecrement: false,
    buildChanges(tier) {
      const v = String(-tier);
      return [
        { formula: v, operator: 'add', target: 'dex', modifier: 'penalty', priority: 0 },
      ];
    }
  },

  enfeebled: {
    name: 'Enfeebled',
    icon: 'icons/svg/downgrade.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to STR-based attack rolls, damage rolls, Fortitude saves, STR-based skill checks, and carrying capacity.',
    autoDecrement: false,
    buildChanges(tier) {
      const v = String(-tier);
      return [
        { formula: v, operator: 'add', target: 'str', modifier: 'penalty', priority: 0 },
      ];
    }
  },

  drained: {
    name: 'Drained',
    icon: 'icons/svg/blood.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to CON-based checks, Fortitude saves, and Max HP reduced by X × character level. Decreases by 1 after a full night\'s rest.',
    autoDecrement: false,
    buildChanges(tier) {
      const v = String(-tier);
      return [
        { formula: v, operator: 'add', target: 'con', modifier: 'penalty', priority: 0 },
      ];
    }
  },

  stunned: {
    name: 'Stunned',
    icon: 'icons/svg/stoned.svg',
    maxTier: 4,
    type: 'tiered',
    description: 'You lose X actions on your next turn. If Stunned exceeds 3, excess carries over to subsequent turns.',
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
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to Perception and skill checks. Cannot use Concentrate actions except to investigate the source of fascination.',
    autoDecrement: false,
    buildChanges(tier) {
      const v = String(-tier);
      return [
        { formula: v, operator: 'add', target: 'skill.per', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'skills',    modifier: 'penalty', priority: 0 },
      ];
    }
  },

  // ======== TOGGLE CONDITIONS (on/off, no tiers) ========

  fatigued: {
    name: 'Fatigued',
    icon: 'icons/svg/unconscious.svg',
    maxTier: 1,
    type: 'toggle',
    description: '–1 penalty to AC and all saving throws. Cannot run or charge. Cannot use Exploration activities during travel.',
    autoDecrement: false,
    buildChanges() {
      return [
        { formula: '-1', operator: 'add', target: 'ac',              modifier: 'penalty', priority: 0 },
        { formula: '-1', operator: 'add', target: 'allSavingThrows', modifier: 'penalty', priority: 0 },
      ];
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
    description: '–2 circumstance penalty to AC. (Formerly Flat-Footed.) Automatically derived from Blinded, Stunned, or Paralyzed; also granted by surprise or other conditions. The GM toggle force-applies Off-Guard as an override — it no longer writes the buff directly.',
    autoDecrement: false,
    buildChanges() {
      return [
        { formula: '-2', operator: 'add', target: 'ac', modifier: 'untyped', priority: 0 },
      ];
    }
  },

  persistentDamage: {
    name: 'Persistent Dmg',
    icon: 'icons/svg/fire.svg',
    maxTier: 1,
    type: 'toggle',
    description: 'Take damage at end of every turn. DC 15 flat check to end it. Receiving healing grants an immediate extra flat check.',
    autoDecrement: false,
    buildChanges() {
      return [];
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
    // arcane spell failure claim is left UNCHANGED — unenforced and out of scope for this
    // release (see GOAL_v2.37.3_CONDITION_CANON.md "Explicitly out of scope" / follow-up docket).
    // Sentence order is deliberate: the auto-fail clause precedes the '-4' initiative figure so
    // no dead numeric substring reads as a Perception penalty claim.
    description: 'Cannot hear. Automatically fails hearing-based Perception checks (table-adjudicated, not enforced). –4 penalty to initiative. 20% arcane spell failure on spells with verbal components.',
    autoDecrement: false,
    buildChanges() {
      return [
        { formula: '-4', operator: 'add', target: 'init', modifier: 'penalty', priority: 0 },
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
    description: 'Can only take a single move action each turn. Cannot attack, cast spells, or concentrate. Cannot eat or drink (including potions).',
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
    description: 'Cannot move, speak, or take any physical action. Helpless (effective DEX 0, –5 modifier). Melee attackers get +4 to hit. Vulnerable to coup de grace.',
    autoDecrement: false,
    buildChanges() {
      // v2.37.3 FIX-3: `-20 dex` UNCHANGED — it approximates but does not equal true Dex 0 (a
      // Dex 24 creature lands at 4, not 0); recorded in D-3, out of scope to change here.
      // `paralyzed` is now one of FIX-5's Off-Guard SOURCES — `_syncOffGuard` derives Off-Guard
      // from this buff's presence directly, rather than this condition emitting its own `-2 ac`.
      return [
        { formula: '-20', operator: 'add', target: 'dex', modifier: 'penalty', priority: 0 },
      ];
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

function _offGuardDerived(actor) {
  return !!_findExistingBuff(actor, 'blinded')
    || (Number(actor.getFlag(MODULE_ID, 'stunnedCountdown')) || 0) > 0
    || !!_findExistingBuff(actor, 'paralyzed');
}

function _offGuardSourceLabel(actor) {
  const sources = [];
  if (_findExistingBuff(actor, 'blinded')) sources.push('Blinded');
  if ((Number(actor.getFlag(MODULE_ID, 'stunnedCountdown')) || 0) > 0) sources.push('Stunned');
  if (_findExistingBuff(actor, 'paralyzed')) sources.push('Paralyzed');
  if (actor.getFlag(MODULE_ID, 'offGuardForced') === true) sources.push('manual override');
  return sources.length ? sources.join(' + ') : 'unknown';
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

async function _syncOffGuard(actor) {
  if (!actor) return;
  if (!_isActiveGMClient()) return;

  const cond = CONDITIONS.offGuard;
  const derived = _offGuardDerived(actor);
  const forced = actor.getFlag(MODULE_ID, 'offGuardForced') === true;
  const want = derived || forced;
  const have = _findExistingBuff(actor, 'offGuard');

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
        }
      }
    }]);

    if (changes.length > 0) {
      await pf1.components.ItemChange.create(changes, { parent: created });
    }
    await created.setActive(true);

    _postOffGuardSyncChat(actor, true, _offGuardSourceLabel(actor));
  } else if (!want && have) {
    await have.delete();
    _postOffGuardSyncChat(actor, false, null);
  }
  // otherwise: NO-OP. No rewrite, no re-create, no chat — idempotent by construction.
}

async function applyCondition(actor, condKey, tier) {
  if (!actor || !CONDITIONS[condKey]) return;

  const cond = CONDITIONS[condKey];
  tier = Math.clamp(tier, 0, cond.maxTier);

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
      'system.changes': [],
      [`flags.${MODULE_ID}.tier`]: tier,
    });
    if (changes.length > 0) {
      await pf1.components.ItemChange.create(changes, { parent: existing });
    }
    if (!existing.system.active) {
      await existing.setActive(true);
    }
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
  }

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
    });
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
    return;
  }

  const cond = CONDITIONS[condKey];
  await existing.delete();
  _postConditionChat(actor, cond, 0, 'remove');

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
  label.textContent = cond.name;
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
    }
  };

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
  const sameTurn = !!(
    appliedAt && breadcrumb &&
    appliedAt.combatId === breadcrumb.combatId &&
    appliedAt.round === breadcrumb.round &&
    appliedAt.turn === breadcrumb.turn
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

function _onDeleteItemCleanupOrphanedStunnedFlags(item) {
  if (!_isActiveGMClient()) return;
  if (item?.type !== 'buff') return;
  if (item.getFlag(MODULE_ID, 'conditionKey') !== 'stunned') return;

  const actor = item.actor ?? item.parent;
  if (!actor) return;

  console.debug(`${MODULE_ID} | deleteItem: clearing any orphaned Stunned countdown flags for ${actor.name}`);
  actor.unsetFlag(MODULE_ID, 'stunnedCountdown');
  actor.unsetFlag(MODULE_ID, 'stunnedAppliedAt');
}
Hooks.on('deleteItem', (item) => _onDeleteItemCleanupOrphanedStunnedFlags(item));
