/* ============================================================
   ECHOES OF BAPHOMET — PF1.5 ACTION TRACKER v1.25
   Visual 3-action + reaction economy tracker for Combat Tracker.

   DISPLAY:  ◆ ◆ ◆   ◇  ◈ ◈ …   (3 actions, 1 reaction, + Combat Reflexes
             AoO pips = Dexterity modifier; single row on its own line)
   LOCATION: Injected BELOW combatant name row in Combat Tracker sidebar
   BEHAVIOR: Manual click-to-spend. ACTION pips reset at the START of the
             combatant's OWN turn (you get 3 actions on your turn). The
             REACTION and Combat Reflexes (AoO) pips are a PER-ROUND
             resource: they reset at the start of a NEW ROUND, NOT on the
             combatant's own turn (PF1.5 ruling). An AoO spent earlier in
             a round stays spent until the next round begins.
             Reads Stunned/Slowed/Staggered/Paralyzed/Nauseated from
             baphomet-utils condition buffs to auto-lock pips.

   v1.25 Changes (AoO / COMBAT REFLEXES ATTACK SPENDS THE JADE POOL):
   - Attack dialog gains an "AoO (Combat Reflexes)" checkbox in the
     Miscellaneous row, injected by _diagHandleAttackDialogRender only
     when app.actor has the Combat Reflexes feat. Its state bridges to
     pf1PreActionUse via globalThis.baphometAoO (mirrors the baphometTWF
     bridge): reset per dialog open, cleared after the hook consumes it.
   - New game.baphometActions.spendCombatReflex(combatantId): spends one
     available green jade AoO pip (mirrors spendReaction).
   - pf1PreActionUse off-turn (AoO) branch: when the attack is flagged AoO
     AND the actor has Combat Reflexes AND a jade pip is available, spend a
     jade pip; otherwise fall back to the blue reaction (Michael's ruling),
     warning if neither is available. Unflagged behavior is unchanged.
   - Rides the existing autoAttackSpend setting (no new setting).
   - FIX (v2.24.0 regression): _maybeResetReactionsForNewRound now ADOPTS the
     current round on a client's first observation (round marker null) instead
     of resetting, so a mid-round reload/reconnect no longer refills reaction/AoO
     pips already spent this round (pip state is hydrated from the combatant
     flags). Only a genuine round change refreshes pips.

   v1.24 Changes (PER-ROUND REACTION / AoO RESET):
   - Reaction and Combat Reflexes (AoO) pips are now a PER-ROUND resource.
     They reset at the start of a NEW ROUND (combat.round advances), for
     ALL combatants, via _maybeResetReactionsForNewRound() in the
     renderCombatTracker hook (render-based; guarded by _reactionResetRound
     so it fires once per round across many renders).
   - Action pips still reset on the combatant's OWN turn. Previously
     _maybeResetForNewTurn reset reaction/reflex on the own turn too, so
     AoOs spent earlier in a round wrongly refreshed when the spender's
     turn came up in the SAME round. They now persist until the next round.
   - Full incapacitation (Paralyzed) still zeroes reaction/reflex at reset.

   v1.23 Changes (PIP TRAY — OWN LINE, SINGLE ROW + DEX-SCALED COMBAT REFLEXES):
   - The pip tray now occupies its OWN full-width line below the v13
     combatant row, as a single horizontal row:
       [3 action pips]  [1 reaction pip]  [Combat Reflexes pips x Dex mod]
     Root cause of the prior squeeze: v13's combatant <li> is a
     non-wrapping flex ROW and the legacy "#combat-tracker .combatant
     { flex-direction: column }" rule matched nothing in v13, so the
     tray collapsed inline. action-tracker.css v1.9 wraps the combatant
     row and gives the tray flex-basis:100%. The .baph-pip-separator is
     no longer emitted; pips are grouped (.baph-pip-actions /
     .baph-pip-reactions) with a gap between groups.
   - Combat Reflexes now SCALES: reflexPip length = the actor's Dexterity
     modifier (floored at 0), rendered as jade AoO pips after the blue
     reaction (PF1: total AoO = 1 base + Dex mod). _combatReflexCount(actor)
     reads actor.system.abilities.dex.mod (path confirmed live). The count
     is reconciled on init, turn reset, condition lock, and render sync.
   - No change to the 3-action spend math, condition reading, turn-reset
     timing, ownership gating, cross-client sync, or any automation.
   - Module release version (module.json) and git tag owned by Michael.

   v1.21 Changes (R6 TWF PENALTY + OFF-HAND GUARD):
   - Added pf1PreAttackRoll advisory hook for PF1.5 Two-Weapon
     Fighting attack penalties. It reads globalThis.baphometTWF,
     adds the selected per-hand penalty to rollConfig.secondaryPenalty
     as a plain signed-number string, and never returns false.
     Surface + format confirmed by live probe P-2: secondaryPenalty
     is a plain numeric string; flavor brackets parse to NaN and
     break the roll. Attacks bypass pf1PreD20Roll.
   - Documented and migrated the existing TWF off-hand action-cost
     guard: off-hand bonus swings ride the main-hand Strike, roll
     normally, and spend no extra action. The guard now reads the
     unified globalThis.baphometTWF.offhand bridge instead of the
     retired loose off-hand flag. No loose _baphTWFOffhandActive
     reference remains in this file.
   - Paired with the in-world "Two-Weapon Fighting" macro, which
     computes the per-hand penalty (tier from @bFlags; light vs.
     one-handed from weaponSubtype) and sets globalThis.baphometTWF.
     Verified live: 1 action total, -2/-2 on both swings for base
     TWF with two light weapons.
   - Module release version (module.json) and git tag unchanged —
     Michael owns release.

   v1.20 Changes (DISABLE DEVICE TASK PREP):
   - SKILL_ACTION_COSTS: dev (Disable Device) removed entirely.
     Disable Device now uses the PF1.5 multi-round task pattern
     (commit 1 action/round with Continue Disabling). It is not
     an auto-spendable 1-action skill.
   - Live pf1ActorRollSkill handler: early gate added for dev
     BEFORE the allowlist check. When skillKey === 'dev' and
     combat is active, the handler warns the user that Disable
     Device uses multi-round task handling, logs the decision,
     and returns without spending any pips. The PF1 roll itself
     continues (no pre-roll blocking).
   - LIVE SKILL AUTO-SPEND section banner updated to remove
     the now-obsolete Disable Device 3-action reference.
   - No task subsystem built. No task state, no Continue Task
     button, no duration tracking, no automatic final check.
   - All other skill costs unchanged. No other automation changes.

   v1.19 Changes (HIDE PF1 FULL ATTACK BUTTON):
   - _diagHandleAttackDialogRender restructured: normalization
     now always runs (not just when debugLogging is ON), so the
     suppression pass can act on the root regardless of debug state.
   - When pf15ModeEnabled is true, removes button[name="attack_full"]
     from AttackDialog using root.querySelector + .remove().
     Confirmed selector from v2.13.5 live diagnostics.
     button[name="attack_single"] is untouched.
   - Debug log emitted on successful suppression:
     "PF1.5 mode: removed Full Attack button from AttackDialog"
   - All existing diagnostics retained and still debug-gated.
   - No attack auto-spend. No swing tracking. No MAP.
     No pf1PreActionUse cancellation. No ESM migration.

   v1.18 Changes (FIX STRIKE GUARD DIAGNOSTICS):
   - Added _diagNormalizeRoot(input): accepts HTMLElement,
     DocumentFragment, jQuery wrapper, or array-like wrapper.
     Guards globalThis.jQuery before instanceof check. Falls
     through gracefully if none match.
   - Added _diagStringify(value): safe JSON.stringify wrapper
     with try/catch. Logs compact, copy-friendly JSON strings
     alongside every diagnostic object.
   - Diagnostic 1 (renderActorSheetPFCharacter): replaced bare
     `element instanceof HTMLElement` guard with _diagNormalizeRoot.
     Live PF1 hook was passing a non-HTMLElement wrapper, causing
     the scan to bail with 'element is not HTMLElement'. Now also
     logs the raw constructor name and normalized constructor name
     for future reference. JSON log added.
   - Diagnostic 2 (pf1RenderQuickActions): updated root resolution
     to use _diagNormalizeRoot for consistency. JSON log added.
   - Diagnostic 3 (AttackDialog): updated _diagHandleAttackDialogRender
     to use _diagNormalizeRoot instead of _baphNormalizeHtml so the
     same coercion logic applies everywhere. Added targeted
     renderAttackDialog hook (fires only if AttackDialog uses the
     expected class name). JSON log added.
   - Diagnostic 4 (pf1PreActionUse): JSON log added.
   - pf1AttackRoll diagnostic: JSON log added for attack summary.
   - No gameplay behavior changes. No suppression. No cancellation.
   - All output remains debug-gated.

   v1.17 Changes (PF1.5 STRIKE GUARD DIAGNOSTICS):
   - Added four observer-only diagnostic hooks to identify PF1
     full-attack UI controls and ActionUse payload shape before
     implementing full-attack suppression in v2.14.0.
   - [DIAG] renderActorSheetPFCharacter: logs all buttons and
     [data-action] elements in the rendered actor sheet, filtered
     to highlight any attack/full-attack candidates.
   - [DIAG] pf1RenderQuickActions: logs all interactive elements
     in the token HUD quick-actions DocumentFragment, filtered
     for attack/full-attack candidates.
   - [DIAG] renderApplication / renderApplicationV2: logs all
     interactive elements when the rendered app constructor name
     matches 'AttackDialog'. Both V1 and V2 hook names registered
     since AttackDialog's ApplicationV1/V2 status is unconfirmed.
   - [DIAG] pf1PreActionUse: logs a structured payload summary
     (constructor, keys, actor, item, action, possible full-attack
     flags, activation/rollMode data). NEVER returns false —
     observer only.
   - All four diagnostics are gated behind the existing
     debugLogging setting. Zero gameplay behavior change.
   - No selectors removed or disabled. No pips spent from
     attack hooks. No swing tracking. No MAP. No ESM migration.

   v1.16 Changes (PF1ATTACKROLL DIAGNOSTIC ENRICHMENT):
   - Added _summarizeAttackRoll(action, roll, extraData): builds a
     focused per-fire summary tailored to characterizing the
     pf1AttackRoll hook before any attack auto-spend is wired.
     Captures:
       timestamp        — Date.now() for firing-rate analysis
       actorPath        — which property the actor was resolved from
       actor            — shallow actor summary (constructor/id/uuid/name/type)
       item             — parent item id/uuid/name/type
       action           — ItemAction id/name/constructorName
       roll             — D20RollPF constructor/formula/total/_evaluated
       messageId        — first available chat-message ref, with source
       extraDataKeys    — top-level keys of args[2] (capped at 30)
       activeCombatantMatch / activeCombatant — comparison via
         _getActiveCombatantForActor; reveals AoO / off-turn cases
       dedupeCandidate  — composite key candidate for future dedupe
         design (actor:item:action:messageId|timestamp). Observation
         only — NOT used for any actual dedupe in this version.
   - pf1AttackRoll diagnostic now emits a third [DIAG] line with
     the focused summary. Existing raw-args and arg-summary lines
     are preserved so prior log corpora remain comparable.
   - NEVER reads arg?.data — keeps the v2.10.1 deprecation cleanup
     intact.
   - Still observer-only. No pip spending. No live behavior change.
   - All output gated behind the debugLogging setting.

   v1.15 Changes (FLOATING ACTION SPEND PANEL):
   - Replaced single Stride button with a compact 3-button
     Action Spend Panel. Buttons:
       Spend 1 — Swing / Move       (1 action, reason: manual-1)
       Spend 2 — Cast / Ready       (2 actions, reason: manual-2)
       Spend 3 — Disable / Full     (3 actions, reason: manual-3)
   - Labels are descriptive examples only. No action-type rules
     are enforced. All spends are generic pip deductions.
   - Panel header shows the active combatant name.
   - All-or-nothing enforced via existing _spendActionForCombatant.
   - Condition-locked pips not consumed.
   - Ownership/combatant re-validated at click time.
   - Position still controlled by moveButtonPosition setting.
   - Old Stride helpers (_getStrideButtonId, _removeStrideButton,
     _shouldShowStrideButton, _renderStrideButton) removed and
     replaced with panel equivalents (_getActionPanelId,
     _removeActionPanel, _shouldShowActionPanel, _renderActionPanel,
     _buildActionSpendButton).
   - Hook registrations unchanged (renderCombatTracker,
     updateCombat, combatStart, deleteCombat, ready).
   - No attack automation. No token drag. No ESM migration.

   v1.14 Changes (FLOATING STRIDE BUTTON):
   - Added floating Stride button that spends 1 action from the
     current active combatant (game.combat.combatant).
   - Button visibility: active combat only; current user must be
     GM or able to control the active combatant via
     _canUserControlCombatant. Not based on selected tokens.
   - Click re-validates combatant and ownership before spending.
   - Uses _spendActionForCombatant(combatant.id, 1, 'stride').
   - Failed spend: shows ui.notifications.warn and refreshes pip
     row. No partial spending.
   - Position controlled by existing moveButtonPosition setting
     (bottom-right / bottom-left / top-right / top-left).
   - Button removed when combat ends (deleteCombat).
   - Button refreshes on renderCombatTracker, combatStart,
     updateCombat to track turn changes correctly.
   - Croaker's Ledger aesthetic: parchment background, brass
     border, iron-gall text. CSS added to action-tracker.css.
   - No token drag automation. No attack auto-spend.
   - No MAP/Strike counter. No ESM migration.

   v1.13 Changes (EXPAND KNOWLEDGE SKILL AUTO-SPEND):
   - Added full standard PF1 Knowledge sub-skill keys to
     SKILL_ACTION_COSTS (all cost 1 action):
       kdu = Knowledge Dungeoneering
       ken = Knowledge Engineering
       kge = Knowledge Geography
       khi = Knowledge History
       kno = Knowledge Nobility
       kpl = Knowledge Planes
     (kar, kre, kna, klo already present from prior releases)
   - Perception (per) remains excluded.
   - Added explicit failure _debugLog after failed spend attempt.
     Previously the failure path left no visible log at the
     call site when _spendActionForCombatant returned false.
   - All-or-nothing spend behavior unchanged.
   - pf1AttackRoll remains diagnostic-only.
   - No Move/Stride button. No ESM migration.

   v1.12 Changes (SKILL ALLOWLIST MIGRATION — klo ADDED):
   - Added klo (Knowledge Local) to SKILL_ACTION_COSTS (cost 1).
     Confirmed from live v2.11.0 testing — key fired in debug output.
   - klo added to allowlist default in settings.js.
   - No other behavior changes. All gates and spend logic unchanged.

   v1.11 Changes (LIVE SKILL AUTO-SPEND):
   - SKILL_ACTION_COSTS updated to confirmed PF1 key strings
     from v2.10.x diagnostic testing. Provisional language removed.
     Keys: acr, blf, int, ste, hea, umd, dev (3), slt, kar, kre, kna.
   - Live pf1ActorRollSkill hook wired. Spends action pips when:
     autoSkillSpend setting is ON, combat is active, actor is the
     current active combatant, user controls the combatant, skill
     is in the allowlist, and enough pips are available for the
     full cost (all-or-nothing).
   - Disable Device (dev) costs 3. If fewer than 3 pips remain,
     nothing is spent.
   - Perception (per) excluded from all costs and allowlist.
   - Dedupe guard added (_skillSpendDedupeSet). Key is
     actor.id:skillKey:chatMessage.id. 500ms window.
   - pf1ActorRollSkill removed from diagnostic block to prevent
     duplicate/noisy logs. Live handler carries its own debug
     logging at every decision gate.
   - pf1AttackRoll remains diagnostic-only — dedupe behavior
     not yet designed.
   - No token movement automation. No Move/Stride button.
   - Manual pip behavior unchanged.

   v1.10 Changes (DIAGNOSTIC CLEANUP):
   - Removed all arg?.data probing from _summarizeHookArg.
     PF1 ItemAction.data is deprecated and emits compatibility
     warnings when accessed. Affected paths removed:
       summary.actorFromData (arg?.data?.actor)
       possibleSkillKeys.dataSkill (arg?.data?.skill)
       possibleSkillKeys.dataSkillId (arg?.data?.skillId)
       possibleSkillKeys.dataSkillKey (arg?.data?.skillKey)
   - Expanded non-.data actor probing to cover additional paths:
     arg?.action?.actor, arg?.parent?.actor, arg?.parent.
   - Expanded non-.data skill key probing to cover additional paths:
     arg?.action?.skill/skillId/skillKey,
     arg?.subject?.skill/skillId/skillKey, arg?.name.
   - Diagnostic hooks remain observer-only. No pip spending.
     No automation enabled.

   v1.9 Changes (ACTION AUTOMATION DIAGNOSTICS):
   - Added _summarizePossibleActor(actor): shallow defensive summary
     of a potential actor reference for diagnostic output.
   - Added _summarizeHookArg(arg, index): shallow defensive summary
     of a single hook argument. Checks common actor paths, possible
     skill key paths, constructor name, and top-level keys (capped
     at 30). Never deep-traverses Foundry/PF1 objects.
   - Added _summarizeHookArgs(args): maps _summarizeHookArg over
     a hook argument array.
   - Added _baphActionDiagnosticsRegistered guard and
     _registerActionAutomationDiagnostics(): registers
     debug-gated Hooks.on listeners for pf1AttackRoll and
     pf1ActorRollSkill. Guard prevents duplicate registration
     if ready fires more than once or is called manually.
   - Added second Hooks.once('ready') that calls
     _registerActionAutomationDiagnostics().
   - NO pip spending. NO automation wired. Diagnostic hooks log
     only. All output gated behind the debugLogging setting.

   v1.8 Changes (AUTOMATION PREP — SCAFFOLD ONLY):
   - Added _debugLog(msg, ...args): conditional debug output
     gated on the 'debugLogging' module setting. Fails safely
     if settings are not yet registered.
   - Added _getActiveCombatant(): returns game.combat.combatant
     or null. Intended lookup point for attack-roll automation.
   - Added _getActiveCombatantForActor(actor): returns the current
     active combatant only if its actor matches the provided actor.
     Does NOT search all combatants — only the active one is
     eligible for automation spending. Corrected in v2.9.9 patch.
   - Added _canUserControlCombatant(combatant): mirrors the
     ownership check in _refreshPipRow so automation uses the
     same gate as manual interaction.
   - Added _spendActionForCombatant(combatantId, count, reason):
     spends N pips; DELEGATES to game.baphometActions.spendAction
     to avoid duplicating spend logic. Returns boolean.
     Spend is all-or-nothing — partial spending is never allowed.
   - Added _spendActionForActor(actor, count, reason): convenience
     wrapper combining lookup + ownership + spend in one call.
   - Added SKILL_ACTION_COSTS constant: provisional skill→cost
     map (INERT — key names unverified, no hook calls it yet).
   - NO PF1 hooks added. NO behavior change to manual pip flow.
     All helpers are unreachable from live code in this version.

   v1.7 Changes (OWNERSHIP HARDENING):
   - Broadened the isOwner computation in both _refreshPipRow()
     and the renderCombatTracker injection. Previously:
       game.user.isGM || combatant.isOwner
     Now:
       game.user.isGM || combatant.isOwner
         || combatant.actor?.isOwner || combatant.token?.isOwner
     combatant.isOwner is the primary PF1e path. The actor and
     token fallbacks cover edge cases: unlinked tokens where
     actor ownership propagates differently, and timing windows
     during combatant setup where one chain resolves before the
     other. The broader check ensures pips are clickable for
     all ownership paths Foundry recognizes.
   - No behavior change for fully-linked tokens where
     combatant.isOwner resolves correctly (common case). No
     change to turn reset, state management, or any other logic.

   v1.6 Changes:
   - [BUG FIX] The just-ended combatant's pips were resetting at end
     of turn instead of the new active combatant's pips resetting at
     start of turn. Root cause: the three turn-change hook handlers
     (pf1PostTurnChange / combatTurn / combatRound) were trying to
     compute "the new active combatant" by reading combat.current.turn
     during the hook fire — but the value of combat.current.turn
     during those hooks is unreliable across versions and across
     interactions with other modules (monks-combat-details,
     specifically). At least one combination resulted in the OLD
     combatant being identified as the new active.
   - [ARCHITECTURE] Switched from hook-based turn detection to a
     render-based "self-correcting" approach. Each pipState entry
     now carries a `_resetForRound` marker. Inside renderCombatTracker
     (which Foundry guarantees to fire after combat state is fully
     updated), we look at which combatant entry has the `.active`
     CSS class — that's Foundry's own truth, the combatant whose
     turn it currently is. If their `_resetForRound` doesn't match
     `combat.round`, we reset their state and update the marker.
     This is idempotent (multiple renders in the same round = no-op),
     independent of hook firing order, and self-correcting (any
     later render fixes a missed reset).
   - [REMOVED] The three turn-change Hooks.on handlers
     (pf1PostTurnChange, combatTurn, combatRound), the
     _turnChangeProcessed dedupe Set, and the _handleTurnChange
     function. Render-based detection replaces all of them.
   - The combatStart, deleteCombat, deleteCombatant, and
     createCombatant hooks are kept — they handle state lifecycle
     (init / cleanup), not turn detection.

   v1.5 Changes:
   - [BUG FIX] _refreshPipRow was using querySelector (single-match),
     which meant that when the Encounter Tracker was popped out into
     its own window, only ONE of the two rendered pip rows would
     update on click. Switched to querySelectorAll and now replaces
     ALL matching rows.
   - [BUG FIX] Turn-change hooks could throw "Cannot read properties
     of undefined (reading '0')" during a transient state where
     combat.turns is briefly undefined or empty. Added Array.isArray
     + length guards. (v1.6 removes those hook handlers entirely;
     guards no longer relevant in this file but kept the lesson.)
   - [CLEANUP] Removed [DIAG] console.log calls.

   v1.4 Changes:
   - [CLICK FIX] Pips are now <button type="button"> elements
     instead of <div>. Native buttons handle click events more
     reliably in sidebar UIs.
   - [CLICK FIX] Row-level event suppression slimmed from five
     events to just mousedown + click.
   - [CLICK FIX] _refreshPipRow re-derives isOwner from the live
     combatant rather than reading from the old DOM's stale dataset.

   v1.3 Changes:
   - [HARDENING] Turn-change handling refactored to use a dedupe-Set
     pattern to handle multiple redundant hooks firing for the same
     turn change. (REMOVED in v1.6 — render-based approach makes
     dedupe unnecessary.)
   - [HARDENING] DOM normalization uses the shared _baphNormalizeHtml
     helper from scripts/dom-utils.js.

   v1.2 Changes:
   - [UI BUG FIX] Pip row injected as full-width block BELOW the
     combatant name row, not appended inline with HP/Initiative.
   - [LOGIC BUG FIX] _readConditionActionLoss() rewritten to use
     boolean tracking + integer accumulators with post-loop math.

   For Foundry VTT v13 + PF1e System
   Requires: baphomet-utils condition-overlay.js (for condition reading)
   ============================================================ */

const AT_MODULE_ID = 'baphomet-utils';

/* ----------------------------------------------------------
   STATE MANAGEMENT
   In-memory only. Resets on page reload. No DB writes.

   v1.6: pipState entries gained a `_resetForRound` field.
   It tracks the round number we last auto-reset this combatant
   for. If `_resetForRound !== combat.round` AND this combatant
   is the current active, the renderCombatTracker hook resets
   them and updates the marker. Idempotent across renders.
   ---------------------------------------------------------- */

// Map<combatantId, {
//   actions: [bool,bool,bool],
//   reaction: [bool],
//   combatReflex: bool,
//   reflexPip: [bool],
//   conditionLocked: number,
//   _resetForRound: number | null   // v1.6
// }>
// true = available, false = spent
const pipState = new Map();

// Flag key used to persist pip state cross-client on the Combatant document.
// Stored as: { actions: [bool,bool,bool], reaction: [bool], reflexPip: [bool], resetForRound: number|null }
const PIP_FLAG_KEY = 'pipState';

function _initState(combatantId) {
  // Hydrate from the shared combatant flag if it exists (cross-client reload support).
  // getFlag is synchronous — reads from the document's in-memory data.
  const combatant = game.combat?.combatants?.get(combatantId);
  const actor = combatant?.actor;
  const saved = combatant?.getFlag('baphomet-utils', PIP_FLAG_KEY) ?? null;

  // v1.23: Combat Reflexes pips scale to the actor's Dex modifier. Reconcile
  // any saved reflexPip array to the current count, preserving spent state.
  const reflexCount = _combatReflexCount(actor);
  const reflexPip = Array.isArray(saved?.reflexPip)
    ? Array.from({ length: reflexCount }, (_, i) => saved.reflexPip[i] ?? true)
    : Array(reflexCount).fill(true);

  pipState.set(combatantId, {
    actions:         (saved?.actions  && saved.actions.length  === 3) ? [...saved.actions]  : [true, true, true],
    reaction:        (saved?.reaction && saved.reaction.length === 1)  ? [...saved.reaction] : [true],
    combatReflex:    reflexCount > 0,
    reflexPip,
    conditionLocked: 0,
    _resetForRound:  saved?.resetForRound ?? null,
  });
}

function _getState(combatantId) {
  return pipState.get(combatantId) ?? null;
}

function _resetState(combatantId) {
  const state = _getState(combatantId);
  if (!state) return;
  state.actions = [true, true, true];
  state.reaction = [true];
  // v1.23: recompute Combat Reflexes pips from current Dex mod.
  const reflexCount = _combatReflexCount(game.combat?.combatants?.get(combatantId)?.actor);
  state.combatReflex = reflexCount > 0;
  state.reflexPip = Array(reflexCount).fill(true);
  state.conditionLocked = 0;
  // _resetForRound is metadata, not pip state — DO NOT touch it here.
  // It's owned by the render-based reset logic.
}

/**
 * Persist the current pip availability state to the Combatant document flag.
 * All connected clients receive an updateCombatant hook event and re-hydrate
 * their local pipState cache, providing cross-client pip synchronization.
 *
 * Fire-and-forget (no await) — keeps all spend paths synchronous.
 * Errors are logged to console but never throw.
 */
function _writePipFlag(combatantId) {
  const state = _getState(combatantId);
  if (!state) return;
  const combatant = game.combat?.combatants?.get(combatantId);
  if (!combatant) return;
  if (!combatant.isOwner) return;

  combatant.setFlag('baphomet-utils', PIP_FLAG_KEY, {
    actions:      [...state.actions],
    reaction:     [...state.reaction],
    reflexPip:    [...state.reflexPip],
    resetForRound: state._resetForRound,
  }).catch(err => console.error(`baphomet-utils | _writePipFlag error: ${err}`));
}

/* ----------------------------------------------------------
   CONDITION READING — v1.2 REWRITE
   [DIRECTIVE: LOGIC BUG FIX]

   Previous implementation used Math.max() inside the item loop
   for Staggered/Nauseated, creating order-dependent results when
   conditions stacked (e.g. Staggered 2 + Stunned 1 could yield
   wrong totals depending on item array order).

   New implementation:
   1. Declare ALL condition trackers BEFORE the loop.
   2. Inside the loop: set booleans (isStaggered, isNauseated)
      and accumulate integers (stunnedTotal, slowedTotal).
      NO Math.max() or conditional logic inside the loop.
   3. AFTER the loop: calculate final actionsLost from all
      tracked values in one deterministic pass.

   PF1.5 ACTION-LOSS RULE (confirmed ruling):
   Compute actions lost from each applicable source, take the
   maximum of the sources, cap at 3, then subtract from the
   3-action pool (floor 0).

   Sources that set a floor (baseBlock):
     Staggered: 2 actions lost
     Nauseated:  2 actions lost

   Sources that are additive (stacked together):
     Stunned X: +X actions lost
     Slowed X:  +X actions lost

   Final formula: actionsLost = min(max(baseBlock, additive), 3)

   Worked examples:
     Staggered alone          → max(2, 0) = 2 lost → 1 action remains
     Slowed 1 alone           → max(0, 1) = 1 lost → 2 actions remain
     Staggered + Slowed 1    → max(2, 1) = 2 lost → 1 action remains
     Staggered + Slowed 2    → max(2, 2) = 2 lost → 1 action remains
     Staggered + Slowed 3    → max(2, 3) = 3 lost → 0 actions remain
     Stunned 2 + Slowed 1    → max(0, 3) = 3 lost → 0 actions remain
     Paralyzed               → bypasses math; all actions + reaction locked

   Note: Staggered + Slowed 3 equals 3 actions lost because the
   Slowed additive total (3) exceeds the Staggered floor (2).
   Slowed does not stack with Staggered's floor — it only matters
   when the additive total surpasses the floor.
   ---------------------------------------------------------- */

function _readConditionActionLoss(actor) {
  if (!actor) return { actionsLost: 0, fullyIncapacitated: false };

  let isStaggered       = false;
  let isNauseated       = false;
  let stunnedTotal      = 0;
  let slowedTotal       = 0;
  let fullyIncapacitated = false;

  for (const item of actor.items) {
    if (item.type !== 'buff') continue;
    const flags = item.flags?.[AT_MODULE_ID];
    if (!flags?.conditionKey) continue;
    if (!item.system?.active) continue;

    const tier = flags.tier ?? 1;

    switch (flags.conditionKey) {
      case 'stunned':    stunnedTotal += tier; break;
      case 'slowed':     slowedTotal  += tier; break;
      case 'staggered':  isStaggered = true;   break;
      case 'nauseated':  isNauseated = true;   break;
      case 'paralyzed':  fullyIncapacitated = true; break;
    }
  }

  if (fullyIncapacitated) {
    return { actionsLost: 3, fullyIncapacitated: true };
  }

  const baseBlock = (isStaggered || isNauseated) ? 2 : 0;
  const additive  = stunnedTotal + slowedTotal;
  const actionsLost = Math.min(Math.max(baseBlock, additive), 3);

  return { actionsLost, fullyIncapacitated: false };
}

function _hasCombatReflexes(actor) {
  if (!actor) return false;
  return actor.items.some(i =>
    i.type === 'feat' &&
    i.name.toLowerCase().includes('combat reflexes')
  );
}

/**
 * v1.23: number of Combat Reflexes attack-of-opportunity pips a combatant
 * should have — the actor's Dexterity modifier (PF1: AoOs = 1 base + Dex
 * mod; the base is the blue reaction pip, these jade pips are the extra
 * AoOs). Returns 0 when the feat is absent or the Dex modifier is <= 0.
 * Dex path confirmed live: actor.system.abilities.dex.mod.
 *
 * @param {Actor} actor
 * @returns {number}
 */
function _combatReflexCount(actor) {
  if (!_hasCombatReflexes(actor)) return 0;
  const dexMod = actor?.system?.abilities?.dex?.mod;
  return Number.isFinite(dexMod) ? Math.max(0, dexMod) : 0;
}

/* ----------------------------------------------------------
   PER-ROUND REACTION / AoO RESET — v1.24

   Reaction + Combat Reflexes pips are a per-round resource:
   they refresh at the start of a NEW ROUND, not on each
   combatant's own turn. Render-based (mirrors the v1.6
   turn-reset approach) and guarded by a module-level round
   marker so it fires exactly once per round across renders.
   ---------------------------------------------------------- */

// Last round for which reaction/reflex pips were refreshed (module-global).
let _reactionResetRound = null;

/**
 * Refresh one combatant's reaction + Combat Reflexes pips to full for a
 * new round, recomputing the AoO count from current Dex mod. Respects
 * full incapacitation (Paralyzed -> no reactions/AoOs).
 */
function _resetReactionReflexForRound(combatantId, combatant) {
  const state = _getState(combatantId);
  if (!state) return;
  state.reaction = [true];
  const reflexCount = _combatReflexCount(combatant?.actor);
  state.combatReflex = reflexCount > 0;
  state.reflexPip = Array(reflexCount).fill(true);
  const { fullyIncapacitated } = _readConditionActionLoss(combatant?.actor);
  if (fullyIncapacitated) {
    state.reaction = [false];
    state.reflexPip = state.reflexPip.map(() => false);
  }
  _writePipFlag(combatantId);
}

/**
 * When combat.round has advanced, refresh reaction + Combat Reflexes pips
 * for every combatant once. Idempotent within a round via _reactionResetRound.
 */
function _maybeResetReactionsForNewRound(combat) {
  const round = combat?.round ?? 0;
  if (round === _reactionResetRound) return;
  // v1.25 fix: first observation on this client (fresh/reloaded client mid-combat) — ADOPT the
  // current round WITHOUT resetting, so a mid-round reload/reconnect does not refill reaction/AoO
  // pips already spent this round (pip state is hydrated from the combatant flags in _initState).
  // Only a genuine round CHANGE refreshes pips.
  if (_reactionResetRound === null) { _reactionResetRound = round; return; }
  _reactionResetRound = round;
  for (const combatant of combat.combatants) {
    if (!combatant?.actor) continue;
    if (!_getState(combatant.id)) _initState(combatant.id);
    _resetReactionReflexForRound(combatant.id, combatant);
  }
  _debugLog(`Per-round reaction/AoO reset for round ${round}`);
}

/* ----------------------------------------------------------
   APPLY CONDITION LOCKS
   Auto-lock pips at turn start based on conditions.
   ---------------------------------------------------------- */

function _applyConditionLocks(combatantId, actor) {
  const state = _getState(combatantId);
  if (!state) return;

  const { actionsLost, fullyIncapacitated } = _readConditionActionLoss(actor);

  if (fullyIncapacitated) {
    state.actions = [false, false, false];
    state.reaction = [false];
    state.reflexPip = state.reflexPip.map(() => false);
    state.conditionLocked = 3;
    return;
  }

  const toLock = Math.min(actionsLost, 3);
  for (let i = 0; i < toLock; i++) {
    state.actions[i] = false;
  }
  state.conditionLocked = toLock;
}

/* ----------------------------------------------------------
   RENDER-BASED TURN-START RESET — v1.6

   Called from inside the renderCombatTracker hook for the
   combatant whose row has the `.active` CSS class. Foundry
   sets `.active` on the current combatant's <li> AFTER all
   combat state has been updated, so it's the most reliable
   signal of "who is the active combatant right now."

   The dedupe is per-round, stored on the state itself as
   `_resetForRound`. So this function is safely idempotent —
   call it on every render of the active combatant; it'll
   only do work the first time we see them as active in a
   given round.
   ---------------------------------------------------------- */

function _maybeResetForNewTurn(combat, combatantId, combatant) {
  if (!combat || !combatantId) return;

  const state = _getState(combatantId);
  if (!state) return;

  const round = combat.round ?? 0;
  if (state._resetForRound === round) return; // already reset this round

  // Mark first to prevent any chance of re-entry (defensive).
  state._resetForRound = round;

  // v1.24: reset ONLY the action pips for the new turn. Reaction + Combat
  // Reflexes (AoO) pips are a per-ROUND resource, refreshed at round start
  // by _maybeResetReactionsForNewRound — NOT on the combatant's own turn.
  state.actions = [true, true, true];
  state.conditionLocked = 0;

  if (combatant?.actor) {
    _applyConditionLocks(combatantId, combatant.actor);
  }

  // Persist reset state so remote clients hydrate the fresh full pips.
  _writePipFlag(combatantId);

  _debugLog(`Reset pips for ${combatant?.name ?? combatantId} (round ${round})`);
}

/* ----------------------------------------------------------
   UI: BUILD PIP ROW

   v1.4: pips are <button type="button"> instead of <div>.
   The action-tracker.css carries an `appearance: none;
   padding: 0; font: inherit;` reset so button defaults
   don't override the coin-on-parchment styling.
   ---------------------------------------------------------- */

function _buildPipRow(combatantId, isOwner) {
  const state = _getState(combatantId);
  if (!state) return null;

  const row = document.createElement('div');
  row.classList.add('baph-action-tracker');
  row.dataset.combatantId = combatantId;

  // v1.22: two sub-rows — actions on top, reactions (+ Combat Reflexes) below.
  const actionsRow = document.createElement('div');
  actionsRow.classList.add('baph-pip-actions');
  const reactionsRow = document.createElement('div');
  reactionsRow.classList.add('baph-pip-reactions');

  // --- Action pips (3) ---
  state.actions.forEach((available, idx) => {
    const pip = document.createElement('button');
    pip.type = 'button';
    pip.classList.add('baph-pip', 'action');
    pip.dataset.pipType = 'action';
    pip.dataset.pipIndex = idx;
    pip.title = `Action ${idx + 1}`;

    if (!available && idx < state.conditionLocked) {
      pip.classList.add('condition-locked');
      pip.title = `Action ${idx + 1} — Lost to condition`;
    } else if (!available) {
      pip.classList.add('spent');
    }

    if (isOwner) {
      pip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        _togglePip(combatantId, 'action', idx);
      });
    } else {
      pip.disabled = true;
    }

    actionsRow.appendChild(pip);
  });

  // --- Reaction pip ---
  state.reaction.forEach((available, idx) => {
    const pip = document.createElement('button');
    pip.type = 'button';
    pip.classList.add('baph-pip', 'reaction');
    pip.dataset.pipType = 'reaction';
    pip.dataset.pipIndex = idx;
    pip.title = 'Reaction';

    if (!available) pip.classList.add('spent');

    if (isOwner) {
      pip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        _togglePip(combatantId, 'reaction', idx);
      });
    } else {
      pip.disabled = true;
    }

    reactionsRow.appendChild(pip);
  });

  // --- Combat Reflexes pip ---
  if (state.combatReflex) {
    state.reflexPip.forEach((available, idx) => {
      const pip = document.createElement('button');
      pip.type = 'button';
      pip.classList.add('baph-pip', 'combat-reflex');
      pip.dataset.pipType = 'reflex';
      pip.dataset.pipIndex = idx;
      pip.title = 'Combat Reflexes — AoO Only';

      if (!available) pip.classList.add('spent');

      if (isOwner) {
        pip.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          _togglePip(combatantId, 'reflex', idx);
        });
      } else {
        pip.disabled = true;
      }

      reactionsRow.appendChild(pip);
    });
  }

  // v1.22: assemble the two sub-rows into the tray.
  row.appendChild(actionsRow);
  row.appendChild(reactionsRow);

  // Only block what's strictly needed.
  // - mousedown: triggers Foundry's _onCombatantMouseDown (opens actor sheet)
  // - click:     belt-and-suspenders for any other delegated handlers
  ['mousedown', 'click'].forEach(evt => {
    row.addEventListener(evt, (e) => e.stopPropagation());
  });

  return row;
}

/* ----------------------------------------------------------
   PIP TOGGLE LOGIC
   ---------------------------------------------------------- */

function _togglePip(combatantId, type, index) {
  const state = _getState(combatantId);
  if (!state) return;

  if (type === 'action') {
    if (index < state.conditionLocked && !state.actions[index]) return;
    state.actions[index] = !state.actions[index];
  } else if (type === 'reaction') {
    state.reaction[index] = !state.reaction[index];
  } else if (type === 'reflex') {
    state.reflexPip[index] = !state.reflexPip[index];
  }

  _refreshPipRow(combatantId);
  _writePipFlag(combatantId);
}

/* ----------------------------------------------------------
   _refreshPipRow — v1.5 + v1.7 ownership hardening

   Rebuilds every pip row currently rendered for this combatant.
   Important when the Encounter Tracker is popped out: the same
   combatant is rendered TWICE (once in the sidebar tracker, once
   in the popout window), and both need to be replaced. State is
   already shared between the two — pipState is keyed on
   combatantId — so the fix is purely in the DOM write step.

   v1.7: isOwner computation broadened to cover unlinked tokens
   and edge-case ownership chains. See header comment for rationale.
   ---------------------------------------------------------- */

function _refreshPipRow(combatantId) {
  const rows = document.querySelectorAll(`.baph-action-tracker[data-combatant-id="${combatantId}"]`);
  if (!rows.length) return;

  const combat = game.combat;
  const combatant = combat?.combatants.get(combatantId);

  rows.forEach(existing => {
    const parent = existing.parentElement;
    if (!parent) return;

    // v1.7: broadened ownership check — combatant.isOwner is primary;
    // actor and token fallbacks cover unlinked token edge cases.
    const isOwner = combatant
      ? (game.user.isGM || combatant.isOwner || combatant.actor?.isOwner || combatant.token?.isOwner)
      : (existing.dataset.isOwner === 'true');

    const newRow = _buildPipRow(combatantId, isOwner);
    if (!newRow) return;

    newRow.dataset.isOwner = String(isOwner);
    parent.replaceChild(newRow, existing);
  });
}

/* ----------------------------------------------------------
   COMBAT TRACKER INJECTION + RENDER-BASED TURN RESET — v1.6

   This hook now does double duty:
   1. (Original v1.2 layout fix) Inject the pip row as a full-width
      block below the combatant's stats row.
   2. (NEW in v1.6) Detect the active combatant via the `.active`
      CSS class Foundry sets on the active combatant's <li>, and
      reset their pips if we haven't already this round.

   The active-class detection is the truth source. We do NOT trust
   combat.current.turn during volatile hook events — only the DOM
   that Foundry has finished rendering after all updates apply.

   Insertion priority (unchanged from v1.2):
     a) .token-initiative (insert after — best, sits below stats)
     b) .combatant-controls wrapper (insert before — also below stats)
     c) .token-resource (insert after HP)
     d) .token-name / .combatant-name (insert after name)
     e) append() as last resort
   ---------------------------------------------------------- */

Hooks.on('renderCombatTracker', (app, html, data) => {
  const combat = game.combat;
  if (!combat) return;

  // v1.24: per-ROUND reaction + Combat Reflexes (AoO) refresh. Runs once
  // when combat.round advances; action pips reset separately on own turn.
  _maybeResetReactionsForNewRound(combat);

  const root = _baphNormalizeHtml(html);
  if (!root) return;

  const combatantEntries = root.querySelectorAll('.combatant, [data-combatant-id]');

  combatantEntries.forEach(entry => {
    const combatantId = entry.dataset.combatantId
      ?? entry.getAttribute('data-combatant-id')
      ?? entry.closest('[data-combatant-id]')?.dataset.combatantId;

    if (!combatantId) return;

    const combatant = combat.combatants.get(combatantId);
    if (!combatant?.actor) return;

    // Ensure state exists
    if (!_getState(combatantId)) {
      _initState(combatantId);
    }

    // v1.23: sync Combat Reflexes pip count if the feat or Dex mod changed mid-combat.
    const state = _getState(combatantId);
    const reflexCount = _combatReflexCount(combatant.actor);
    if (state.combatReflex !== (reflexCount > 0) || state.reflexPip.length !== reflexCount) {
      state.combatReflex = reflexCount > 0;
      const prev = state.reflexPip;
      state.reflexPip = Array.from({ length: reflexCount }, (_, i) => prev[i] ?? true);
    }

    // v1.6: render-based turn-start reset.
    // If THIS entry is the active one (Foundry's own .active class)
    // and we haven't reset them for the current round yet, do so.
    // Must happen BEFORE the pip row is built so the new row reflects
    // the freshly-reset state.
    if (entry.classList.contains('active')) {
      _maybeResetForNewTurn(combat, combatantId, combatant);
    }

    // Remove stale pip row before re-render
    const oldRow = entry.querySelector('.baph-action-tracker');
    if (oldRow) oldRow.remove();

    // v1.7: broadened ownership check — same as _refreshPipRow.
    const isOwner = game.user.isGM || combatant.isOwner || combatant.actor?.isOwner || combatant.token?.isOwner;
    const pipRow = _buildPipRow(combatantId, isOwner);
    if (!pipRow) return;

    pipRow.dataset.isOwner = String(isOwner);

    // Find the best anchor: insert pip row AFTER this element
    const initiativeEl = entry.querySelector('.token-initiative');
    const resourceEl   = entry.querySelector('.token-resource');
    const nameEl       = entry.querySelector('.token-name, .combatant-name');
    const controlsEl   = entry.querySelector('.combatant-controls');

    if (initiativeEl) {
      initiativeEl.insertAdjacentElement('afterend', pipRow);
    } else if (controlsEl) {
      entry.insertBefore(pipRow, controlsEl);
    } else if (resourceEl) {
      resourceEl.insertAdjacentElement('afterend', pipRow);
    } else if (nameEl) {
      nameEl.insertAdjacentElement('afterend', pipRow);
    } else {
      entry.appendChild(pipRow);
    }
  });
});

/* ----------------------------------------------------------
   COMBAT LIFECYCLE: STATE INIT + CLEANUP

   v1.6: turn-detection hooks (pf1PostTurnChange, combatTurn,
   combatRound) and _handleTurnChange / _turnChangeProcessed
   all REMOVED. Render-based detection in renderCombatTracker
   replaces them. These lifecycle hooks remain — they manage
   pipState entries (init / cleanup), not turn detection.
   ---------------------------------------------------------- */

Hooks.on('deleteCombat', (combat) => {
  for (const c of combat.combatants) pipState.delete(c.id);
  _reactionResetRound = null;
});

Hooks.on('deleteCombatant', (combatant) => {
  pipState.delete(combatant.id);
});

Hooks.on('createCombatant', (combatant) => {
  if (!combatant.actor) return;
  _initState(combatant.id, _hasCombatReflexes(combatant.actor));
});

Hooks.on('combatStart', (combat) => {
  for (const combatant of combat.combatants) {
    if (!combatant.actor) continue;
    _initState(combatant.id);
  }

  // The first active combatant gets their condition locks applied
  // immediately. The render-based reset will pick them up too on
  // first render, but applying here means the first render shows
  // correct state without waiting for a second render pass.
  const firstCombatant = combat.turns?.[0];
  if (firstCombatant?.actor) {
    _applyConditionLocks(firstCombatant.id, firstCombatant.actor);
    const state = _getState(firstCombatant.id);
    if (state) state._resetForRound = combat.round ?? 1;
  }

  // v1.24: mark this round as already reaction-refreshed (init set reactions
  // available), so the first render does not redundantly reset them.
  _reactionResetRound = combat.round ?? 1;
});

/* ----------------------------------------------------------
   MACRO API
   ---------------------------------------------------------- */

Hooks.once('ready', () => {
  game.baphometActions = {
    getState: (combatantId) => {
      const state = _getState(combatantId);
      if (!state) return null;
      return {
        actionsRemaining: state.actions.filter(a => a).length,
        actionsTotal: 3,
        reactionAvailable: state.reaction[0],
        combatReflexAvailable: state.combatReflex ? state.reflexPip.filter(p => p).length : null,
        conditionLocked: state.conditionLocked
      };
    },
    reset: (combatantId) => {
      _resetState(combatantId);
      _refreshPipRow(combatantId);
      _writePipFlag(combatantId);
    },
    spendAction: (combatantId, count = 1) => {
      const state = _getState(combatantId);
      if (!state) return false;
      let spent = 0;
      for (let i = 0; i < 3 && count > 0; i++) {
        if (state.actions[i] && i >= state.conditionLocked) {
          state.actions[i] = false;
          count--;
          spent++;
        }
      }
      _refreshPipRow(combatantId);
      if (spent > 0) _writePipFlag(combatantId);
      return spent > 0;
    },
    spendReaction: (combatantId) => {
      const state = _getState(combatantId);
      if (!state || !state.reaction[0]) return false;
      state.reaction[0] = false;
      _refreshPipRow(combatantId);
      _writePipFlag(combatantId);
      return true;
    },
    // v1.25: spend one available Combat Reflexes (jade) AoO pip. Mirrors
    // spendReaction. Returns true only if a jade pip was actually spent.
    spendCombatReflex: (combatantId) => {
      const state = _getState(combatantId);
      if (!state) return false;
      const idx = state.reflexPip.findIndex(p => p);
      if (idx === -1) return false;
      state.reflexPip[idx] = false;
      _refreshPipRow(combatantId);
      _writePipFlag(combatantId);
      return true;
    }
  };

  _debugLog('Action Tracker v1.8 ready');
});

/* ============================================================
   AUTOMATION PREP SCAFFOLD — v1.8
   ══════════════════════════════════════════════════════════

   INERT. Nothing below this line is called by any live hook.
   These helpers are declared for future wiring in v2.10.0.

   Do NOT add pf1AttackRoll or pf1ActorRollSkill calls here
   until v2.10.0. The helpers are available for manual testing
   via browser console or macros if needed.

   Guiding constraints for v2.10.0 (do not violate):
   - No token drag / movement auto-spending
   - No inference of standard/move/swift/full-round PF1 actions
   - Verify all SKILL_ACTION_COSTS key names at runtime via
     pf1ActorRollSkill before wiring any skill automation
   - A deduplication guard is required before live hooks go in
   - Debug logging should trace every spend decision
   ============================================================ */

/* ----------------------------------------------------------
   DEBUG LOGGING HELPER
   ---------------------------------------------------------- */

/**
 * Emit a debug log line when the 'debugLogging' module setting
 * is enabled. Fails silently if settings are not yet registered
 * (safe to call at any lifecycle stage).
 *
 * @param {string} msg
 * @param {...*} args
 */
function _debugLog(msg, ...args) {
  try {
    if (!game.settings.get(AT_MODULE_ID, 'debugLogging')) return;
  } catch {
    return; // settings not yet registered — noop
  }
  console.log(`${AT_MODULE_ID} | [DEBUG] ${msg}`, ...args);
}

/* ----------------------------------------------------------
   AUTOMATION HELPER FUNCTIONS
   
   These wrap existing state and render logic for clean use
   from automation hooks. They do not introduce new state.
   ---------------------------------------------------------- */

/**
 * Return the currently active combatant in the live combat,
 * or null if no combat is active or no turn is current.
 *
 * This is the lookup entry point for attack-roll automation
 * (pf1AttackRoll → who is acting → spend their pip).
 *
 * @returns {Combatant|null}
 */
function _getActiveCombatant() {
  return game.combat?.combatant ?? null;
}

/**
 * Return the current active combatant if and only if its linked
 * actor matches the provided actor. Returns null otherwise.
 *
 * SAFETY RULE: Only the current active combatant is eligible for
 * automation spending. Searching all combatants was intentionally
 * removed — it would allow a PF1 hook firing for a non-active
 * actor (e.g. an AoO, an off-turn triggered ability) to incorrectly
 * spend pips for a combatant who hasn't taken their turn yet.
 *
 * Returns null if: combat is inactive, no actor provided,
 * the active combatant has no actor, or the actor IDs do not match.
 *
 * NOTE: Matches on actor.id. Unlinked tokens use synthetic actors
 * not in game.actors — verify behavior with unlinked tokens before
 * enabling automation in v2.10.0. A token-ID fallback may be needed.
 *
 * @param {Actor} actor
 * @returns {Combatant|null}
 */
function _getActiveCombatantForActor(actor) {
  if (!actor || !game.combat) return null;
  const active = game.combat.combatant;
  if (!active?.actor) return null;
  return active.actor.id === actor.id ? active : null;
}

/**
 * Check whether the current user is permitted to control the
 * given combatant's action pips.
 *
 * Mirrors the isOwner computation in _refreshPipRow and the
 * renderCombatTracker injection exactly, so automation gates
 * on the same ownership logic as manual interaction. If the
 * user can't click a pip, automation won't spend it either.
 *
 * @param {Combatant} combatant
 * @returns {boolean}
 */
function _canUserControlCombatant(combatant) {
  if (!combatant) return false;
  return (
    game.user.isGM           ||
    combatant.isOwner         ||
    combatant.actor?.isOwner  ||
    combatant.token?.isOwner
  );
}

/**
 * Spend N action pips for a combatant identified by ID.
 *
 * DELEGATES to game.baphometActions.spendAction() to avoid
 * duplicating the spend loop. game.baphometActions is set up
 * in the ready hook — guards defensively in case this is
 * somehow called before ready fires.
 *
 * Returns true if the full spend was dispatched, false if
 * state was absent, the API wasn't ready, or fewer than
 * count actions are available. Spend is all-or-nothing.
 *
 * `reason` is a short string for debug output only; it is
 * never shown to the user. Suggested values: 'attack-roll',
 * 'skill-acrobatics', 'skill-bluff', etc.
 *
 * @param {string} combatantId
 * @param {number} [count=1]  Number of action pips to spend (1–3)
 * @param {string} [reason]   Debug label
 * @returns {boolean}
 */
function _spendActionForCombatant(combatantId, count = 1, reason = '') {
  const state = _getState(combatantId);
  if (!state) {
    _debugLog(`_spendActionForCombatant: no state for ${combatantId} [${reason}]`);
    return false;
  }

  // Require enough spendable actions to satisfy the full requested count.
  // Spend is all-or-nothing: a 3-action cost (e.g. Disable Device) must
  // have exactly 3 available pips or nothing is spent and false is returned.
  // Partial spending is never permitted.
  const spendable = state.actions.filter((a, i) => a && i >= state.conditionLocked).length;
  if (spendable < count) {
    _debugLog(`_spendActionForCombatant: insufficient actions (${spendable} available, ${count} needed) for ${combatantId} [${reason}]`);
    return false;
  }

  // Delegate to the existing macro API. This is the single spend
  // implementation — do not duplicate the loop here.
  if (!game.baphometActions?.spendAction) {
    _debugLog(`_spendActionForCombatant: baphometActions API not ready [${reason}]`);
    return false;
  }

  game.baphometActions.spendAction(combatantId, count);
  _debugLog(`_spendActionForCombatant: spent ${count} action(s) for ${combatantId} [${reason}]`);
  return true;
}

/* ----------------------------------------------------------
   SKILL ACTION COSTS
   
   Confirmed PF1 key strings from v2.10.x diagnostic testing.
   Signature: pf1ActorRollSkill(actor, chatMessage, skillKey)
   
   Key  →  Skill Name               →  Action cost
   acr  →  Acrobatics               →  1
   blf  →  Bluff                    →  1
   int  →  Intimidate               →  1
   ste  →  Stealth                  →  1
   hea  →  Heal                     →  1
   umd  →  Use Magic Device         →  1
   slt  →  Sleight of Hand          →  1
   kar  →  Knowledge (Arcana)       →  1
   kdu  →  Knowledge (Dungeoneering) →  1
   ken  →  Knowledge (Engineering)  →  1
   kge  →  Knowledge (Geography)    →  1
   khi  →  Knowledge (History)      →  1
   klo  →  Knowledge (Local)        →  1
   kna  →  Knowledge (Nature)       →  1
   kno  →  Knowledge (Nobility)     →  1
   kpl  →  Knowledge (Planes)       →  1
   kre  →  Knowledge (Religion)     →  1
   
   Excluded from auto-spend:
   per  →  Perception — passive/reactive sense; excluded
           intentionally from action economy tracking.
   dev  →  Disable Device — uses PF1.5 multi-round task pattern.
           Not auto-spendable. Live handler warns user when dev
           is rolled in combat. Re-add once task subsystem is built.
   
   Any skills added in future must be verified against the
   pf1ActorRollSkill payload before adding here.
   ---------------------------------------------------------- */

const SKILL_ACTION_COSTS = {
  acr: 1,
  blf: 1,
  int: 1,
  ste: 1,
  hea: 1,
  umd: 1,
  slt: 1,
  // Knowledge sub-skills — all cost 1 action
  kar: 1,  // Knowledge Arcana
  kdu: 1,  // Knowledge Dungeoneering
  ken: 1,  // Knowledge Engineering
  kge: 1,  // Knowledge Geography
  khi: 1,  // Knowledge History
  klo: 1,  // Knowledge Local
  kna: 1,  // Knowledge Nature
  kno: 1,  // Knowledge Nobility
  kpl: 1,  // Knowledge Planes
  kre: 1   // Knowledge Religion
};

/* ============================================================
   ACTION AUTOMATION DIAGNOSTICS — v1.11
   ══════════════════════════════════════════════════════════

   pf1AttackRoll: diagnostic-only. Not yet wired to spend
   pips — dedupe behavior not yet designed.

   pf1ActorRollSkill: removed from this block in v1.11.
   The live skill automation hook below carries its own
   debug logging at every decision gate. Having both would
   produce duplicate/noisy output on every skill roll.

   NOTHING HERE SPENDS PIPS.

   .data paths are intentionally not probed — PF1 ItemAction.data
   is deprecated and emits compatibility warnings on access.

   To use: enable Action Tracker Debug Logging in
   Configure Settings → Baphomet Utils, then open F12.
   All output is prefixed:
     baphomet-utils | [DEBUG] [DIAG] ...
   ============================================================ */

// Guard: prevent duplicate hook registration if ready fires
// more than once or _registerActionAutomationDiagnostics is
// called manually from a macro during testing.
let _baphActionDiagnosticsRegistered = false;

/**
 * Produce a shallow summary of a possible actor reference.
 * Defensive: never throws, never deep-traverses.
 *
 * @param {*} actor
 * @returns {object|null}
 */
function _summarizePossibleActor(actor) {
  if (!actor) return null;
  return {
    constructorName: actor?.constructor?.name ?? null,
    id:      actor?.id ?? actor?._id ?? null,
    uuid:    actor?.uuid ?? null,
    name:    actor?.name ?? null,
    type:    actor?.type ?? null,
    isOwner: actor?.isOwner ?? null
  };
}

/**
 * Produce a shallow summary of a single hook argument.
 * Checks common actor paths and skill key paths without
 * deep-traversing any Foundry or PF1 document object.
 *
 * @param {*}      arg
 * @param {number} index  Position in the hook args array
 * @returns {object}
 */
function _summarizeHookArg(arg, index) {
  const summary = {
    index,
    type:    typeof arg,
    isNull:  arg === null,
    isArray: Array.isArray(arg)
  };

  if (arg === null || arg === undefined) return summary;

  try {
    summary.constructorName = arg?.constructor?.name ?? null;
  } catch {
    summary.constructorName = '[unavailable]';
  }

  try {
    summary.keys = typeof arg === 'object'
      ? Object.keys(arg).slice(0, 30)
      : [];
  } catch {
    summary.keys = ['[keys unavailable]'];
  }

  try {
    summary.id        = arg?.id ?? arg?._id ?? null;
    summary.uuid      = arg?.uuid ?? null;
    summary.name      = arg?.name ?? null;
    summary.typeValue = arg?.type ?? null;
  } catch {
    // Diagnostic-only. Ignore safely.
  }

  try {
    summary.actorDirect         = _summarizePossibleActor(arg?.actor);
    summary.actorFromItem       = _summarizePossibleActor(arg?.item?.actor);
    summary.actorFromAction     = _summarizePossibleActor(arg?.action?.actor);
    summary.actorFromSubject    = _summarizePossibleActor(arg?.subject?.actor);
    summary.actorFromParentActor = _summarizePossibleActor(arg?.parent?.actor);
    summary.parentAsActor       = _summarizePossibleActor(arg?.parent);
  } catch {
    // Diagnostic-only. Ignore safely.
  }

  try {
    summary.possibleSkillKeys = {
      skill:          arg?.skill          ?? null,
      skillId:        arg?.skillId        ?? null,
      skillKey:       arg?.skillKey       ?? null,
      key:            arg?.key            ?? null,
      id:             arg?.id             ?? null,
      name:           arg?.name           ?? null,
      actionSkill:    arg?.action?.skill    ?? null,
      actionSkillId:  arg?.action?.skillId  ?? null,
      actionSkillKey: arg?.action?.skillKey ?? null,
      subjectSkill:    arg?.subject?.skill    ?? null,
      subjectSkillId:  arg?.subject?.skillId  ?? null,
      subjectSkillKey: arg?.subject?.skillKey ?? null
    };
  } catch {
    // Diagnostic-only. Ignore safely.
  }

  return summary;
}

/**
 * Map _summarizeHookArg over a full hook argument array.
 *
 * @param {Array} args
 * @returns {Array}
 */
function _summarizeHookArgs(args) {
  return args.map((arg, index) => _summarizeHookArg(arg, index));
}

/**
 * Build a focused diagnostic summary of a single pf1AttackRoll fire.
 *
 * Confirmed hook signature (from v2.10.x diagnostic testing):
 *   pf1AttackRoll(action, roll, extraData)
 *     action    — ItemAction (the specific action of an item being used)
 *     roll      — D20RollPF (the evaluated d20 roll)
 *     extraData — Object (options / message data / chat hints)
 *
 * Captures the fields needed to characterize this hook before
 * wiring attack auto-spend in a future release. Specifically:
 *
 *   - timestamp        : Date.now() so firing rate can be analyzed
 *                        across iteratives, full attacks, and AoOs
 *   - actorPath        : which property chain the actor was resolved
 *                        from — useful for future automation gates
 *   - actor            : shallow actor summary
 *   - item             : parent item id / uuid / name / type
 *   - action           : ItemAction id / name / constructorName
 *   - roll             : D20RollPF shape (formula, total, _evaluated)
 *   - messageId        : first available chat-message reference
 *   - extraDataKeys    : top-level keys of args[2] (capped at 30)
 *   - activeCombatantMatch / activeCombatant : whether the resolved
 *                        actor is the current active combatant
 *                        (reveals AoO / off-turn / GM-NPC cases)
 *   - dedupeCandidate  : composite key candidate for future dedupe
 *                        design. OBSERVATION ONLY — not used by any
 *                        live spend logic in this version.
 *
 * Defensive: every property access is guarded; never throws.
 * NEVER reads arg?.data — PF1 ItemAction.data is deprecated and
 * emits compatibility warnings on access (cleaned up in v2.10.1).
 *
 * @param {*} action     args[0] — expected ItemAction
 * @param {*} roll       args[1] — expected D20RollPF
 * @param {*} extraData  args[2] — expected options / extraData object
 * @returns {object}
 */
function _summarizeAttackRoll(action, roll, extraData) {
  const timestamp = Date.now();
  const item = action?.item ?? null;

  // Resolve actor — prefer item.actor (canonical PF1 path), with
  // fallbacks for less common shapes. NEVER probes arg?.data.
  let actor     = null;
  let actorPath = null;
  if (item?.actor)                { actor = item.actor;            actorPath = 'action.item.actor'; }
  else if (action?.actor)         { actor = action.actor;          actorPath = 'action.actor'; }
  else if (action?.parent?.actor) { actor = action.parent.actor;   actorPath = 'action.parent.actor'; }
  else if (extraData?.actor)      { actor = extraData.actor;       actorPath = 'extraData.actor'; }

  // Active-combatant comparison. Reveals AoO / off-turn / mid-attack
  // turn-advance cases that any future automation will need to gate on.
  let activeMatchCombatant = null;
  try {
    activeMatchCombatant = _getActiveCombatantForActor(actor);
  } catch {
    // Diagnostic-only. Ignore safely.
  }

  // Roll / chat-message identifier. D20RollPF doesn't carry a stable
  // own-id, but a chat message reference is often reachable via the
  // roll itself or via extraData. Try several shapes; tolerate misses.
  let messageId        = null;
  let messageRefSource = null;
  if (roll?.message?.id)               { messageId = roll.message.id;            messageRefSource = 'roll.message.id'; }
  else if (extraData?.chatMessage?.id) { messageId = extraData.chatMessage.id;   messageRefSource = 'extraData.chatMessage.id'; }
  else if (extraData?.message?.id)     { messageId = extraData.message.id;       messageRefSource = 'extraData.message.id'; }
  else if (extraData?.messageId)       { messageId = extraData.messageId;        messageRefSource = 'extraData.messageId'; }

  // Composite candidate dedupe key. Stable across iteratives if
  // messageId is shared; distinct across separate attack actions.
  // If no messageId is reachable, falls back to timestamp — in which
  // case dedupe across rapid fires would be unreliable.
  const dedupeCandidate = [
    actor?.id  ?? '?',
    item?.id   ?? '?',
    action?.id ?? '?',
    messageId ?? `t${timestamp}`
  ].join(':');

  let extraDataKeys = [];
  try {
    if (extraData && typeof extraData === 'object') {
      extraDataKeys = Object.keys(extraData).slice(0, 30);
    }
  } catch {
    extraDataKeys = ['[keys unavailable]'];
  }

  return {
    timestamp,

    actorPath,
    actor: _summarizePossibleActor(actor),

    item: item ? {
      id:   item?.id   ?? item?._id ?? null,
      uuid: item?.uuid ?? null,
      name: item?.name ?? null,
      type: item?.type ?? null
    } : null,

    action: {
      id:              action?.id ?? action?._id ?? null,
      name:            action?.name ?? null,
      constructorName: action?.constructor?.name ?? null
    },

    roll: {
      constructorName: roll?.constructor?.name ?? null,
      formula:         roll?.formula ?? null,
      total:           roll?.total ?? null,
      _evaluated:      roll?._evaluated ?? null
    },

    messageId,
    messageRefSource,

    extraDataKeys,

    activeCombatantMatch: !!activeMatchCombatant,
    activeCombatant: activeMatchCombatant ? {
      id:   activeMatchCombatant.id,
      name: activeMatchCombatant.name
    } : null,

    dedupeCandidate
  };
}

/**
 * Register debug-gated diagnostic listeners for pf1AttackRoll
 * and pf1ActorRollSkill. Idempotent via _baphActionDiagnosticsRegistered.
 *
 * Called once from the diagnostics ready hook below.
 */
function _registerActionAutomationDiagnostics() {
  if (_baphActionDiagnosticsRegistered) return;
  _baphActionDiagnosticsRegistered = true;

  // pf1AttackRoll: diagnostic-only. Logs raw args, generic shallow
  // summary, AND a focused attack-roll summary (v1.16). Does not
  // spend pips. Dedupe behavior not yet designed — the dedupeCandidate
  // field in the focused summary is observation-only.
  Hooks.on('pf1AttackRoll', (...args) => {
    _debugLog('[DIAG] pf1AttackRoll raw args:', ...args);
    _debugLog('[DIAG] pf1AttackRoll arg summary:', _summarizeHookArgs(args));
    const attackSummary = _summarizeAttackRoll(args[0], args[1], args[2]);
    _debugLog('[DIAG] pf1AttackRoll attack summary:', attackSummary);
    _debugLog('[DIAG] pf1AttackRoll attack summary JSON:', _diagStringify(attackSummary));
  });

  // pf1ActorRollSkill intentionally not registered here.
  // The live skill automation hook (below) handles this event
  // and carries its own debug logging.

  _debugLog('Action automation diagnostics registered (pf1AttackRoll only — pf1ActorRollSkill handled by live hook)');
}

// Separate ready hook for diagnostics registration.
// Kept distinct from the macro API ready hook above for clarity —
// two concerns, two hooks.
Hooks.once('ready', () => {
  _registerActionAutomationDiagnostics();
});

/* ============================================================
   LIVE SKILL AUTO-SPEND — v1.11
   ══════════════════════════════════════════════════════════

   Confirmed hook signature:
     pf1ActorRollSkill(actor, chatMessage, skillKey)

   Gated behind 'autoSkillSpend' world setting (default OFF).
   Only fires for the current active combatant on the user's
   controlled token. Non-active actors are silently ignored.

   Disable Device (dev) is intercepted BEFORE the allowlist gate
   and receives a specific PF1.5 multi-round task warning instead
   of a generic "not in allowlist" message. No pip is spent.

   Dedupe: keyed on actor.id + skillKey + chatMessage.id.
   500ms window. Client-local in-memory Set — does NOT protect
   across multiple connected clients. This is acceptable because
   pipState is also client-local and not synchronized across
   clients. Each client maintains its own pip view independently.
   ============================================================ */

// In-memory dedupe set. Not persisted. Cleared by 500ms timeouts.
const _skillSpendDedupeSet = new Set();

/**
 * Check whether a skill spend event is a duplicate.
 * Adds the key to the set and schedules its removal.
 * Returns true if this is a duplicate (do not spend).
 *
 * @param {Actor}       actor
 * @param {string}      skillKey
 * @param {ChatMessage} chatMessage
 * @returns {boolean}
 */
function _isSkillSpendDuped(actor, skillKey, chatMessage) {
  // Prefer chatMessage.id as the most stable unique identifier.
  // Fall back to uuid, then to a bare actor+skill key (accepts the
  // theoretical risk of two legitimate rolls in 500ms being deduped
  // — that's an edge case well within acceptable bounds).
  const msgId = chatMessage?.id ?? chatMessage?.uuid ?? null;
  if (!msgId) {
    _debugLog(`skill auto-spend dedupe: chatMessage.id and uuid both absent for ${actor?.id}:${skillKey} — using fallback key, increased double-spend risk on this client`);
  }
  const key = msgId
    ? `${actor.id}:${skillKey}:${msgId}`
    : `${actor.id}:${skillKey}`;

  if (_skillSpendDedupeSet.has(key)) return true;

  _skillSpendDedupeSet.add(key);
  setTimeout(() => _skillSpendDedupeSet.delete(key), 500);
  return false;
}

/**
 * Live pf1ActorRollSkill handler.
 * Spends action pips for the active combatant when all gates pass.
 * Every decision path emits a _debugLog line.
 */
Hooks.on('pf1ActorRollSkill', (actor, chatMessage, skillKey) => {
  // Gate 1: setting enabled
  if (!game.settings.get(AT_MODULE_ID, 'autoSkillSpend')) {
    _debugLog(`skill auto-spend: setting disabled — no spend for ${skillKey}`);
    return;
  }

  // Gate 2: active combat
  if (!game.combat?.active) {
    _debugLog(`skill auto-spend: no active combat — no spend for ${skillKey}`);
    return;
  }

  // Gate 3: actor present
  if (!actor) {
    _debugLog('skill auto-spend: actor missing from hook args');
    return;
  }

  // Gate 4: skillKey present
  if (!skillKey) {
    _debugLog('skill auto-spend: skillKey missing from hook args');
    return;
  }

  // Early gate: Disable Device uses PF1.5 multi-round task pattern.
  // It is NOT auto-spendable here. Warn when this is a standalone
  // player-initiated roll outside the task resolution framework.
  // Suppressed when task-tracker.js is actively running resolveTask()
  // OR aidTask() (_baphResolveTaskRollActive / _baphAidTaskRollActive).
  if (skillKey === 'dev') {
    const taskRollActive =
      (typeof _baphResolveTaskRollActive !== 'undefined' && _baphResolveTaskRollActive) ||
      (typeof _baphAidTaskRollActive !== 'undefined' && _baphAidTaskRollActive);
    if (!taskRollActive) {
      _debugLog('skill auto-spend: Disable Device (dev) — PF1.5 multi-round task, no auto-spend');
      ui.notifications?.warn?.('Disable Device: PF1.5 multi-round task — use Continue Task / Resolve Task in the task widget.');
    }
    return;
  }

  // Early gate: suppress auto-spend during any task-system-initiated skill roll.
  // Prevents double-action-spend when resolveTask() or aidTask() fires a skill
  // roll internally. Non-dev task skills (future resolvers) are also protected.
  if ((typeof _baphResolveTaskRollActive !== 'undefined' && _baphResolveTaskRollActive) ||
      (typeof _baphAidTaskRollActive !== 'undefined' && _baphAidTaskRollActive)) {
    _debugLog(`skill auto-spend: task system roll in progress — suppressing auto-spend for ${skillKey}`);
    return;
  }

  // Gate 5: skill in allowlist
  const allowlistRaw = game.settings.get(AT_MODULE_ID, 'skillAutoAllowlist') ?? '';
  const allowlist = allowlistRaw.split(',').map(s => s.trim()).filter(Boolean);
  if (!allowlist.includes(skillKey)) {
    _debugLog(`skill auto-spend: "${skillKey}" not in allowlist — no spend`);
    return;
  }

  // Gate 6: skill has a known cost
  const cost = SKILL_ACTION_COSTS[skillKey];
  if (cost === undefined) {
    _debugLog(`skill auto-spend: "${skillKey}" has no cost mapping — no spend`);
    return;
  }

  // Gate 7: actor is the current active combatant
  const combatant = _getActiveCombatantForActor(actor);
  if (!combatant) {
    _debugLog(`skill auto-spend: "${actor.name}" is not the active combatant — no spend`);
    return;
  }

  // Gate 8: current user controls this combatant
  if (!_canUserControlCombatant(combatant)) {
    _debugLog(`skill auto-spend: user cannot control combatant for "${actor.name}" — no spend`);
    return;
  }

  // Gate 9: dedupe check
  if (_isSkillSpendDuped(actor, skillKey, chatMessage)) {
    _debugLog(`skill auto-spend: duplicate event for ${actor.name}:${skillKey} — skipping`);
    return;
  }

  // All gates passed. _spendActionForCombatant enforces all-or-nothing.
  _debugLog(`skill auto-spend: attempting spend — ${actor.name} / ${skillKey} / cost ${cost}`);
  const spent = _spendActionForCombatant(combatant.id, cost, `skill-${skillKey}`);

  if (!spent) {
    // _spendActionForCombatant already logged the reason (insufficient actions
    // or API not ready).
    _debugLog(`skill auto-spend: failed — spend blocked or insufficient actions for ${actor.name} [${skillKey}], needed ${cost}`);
    return;
  }

  _debugLog(`skill auto-spend: success — spent ${cost} action(s) for ${actor.name} [${skillKey}]`);
});

/* ============================================================
   LIVE ATTACK & SPELL AUTO-SPEND — v2.22.0 (Phase B)
   ══════════════════════════════════════════════════════════

   Hook: pf1PreActionUse(actionUse) — fires ONCE per action-use
   (one Strike, one cast), for both attacks and spells. Using this
   pre-hook (NOT pf1AttackRoll, which fires per iterative roll)
   means a single Strike/cast spends exactly once — no iterative
   dedupe gymnastics. Pilot 45 confirmed the cadence + field paths.

   MODULE DESIGN PATTERN — NOT NATIVE PF1.

   OBSERVE-ONLY: this handler NEVER returns false. Returning false
   from pf1PreActionUse CANCELS the action in PF1 — auto-spend must
   never block an action, only decrement pips.

   Gated behind 'autoAttackSpend' / 'autoSpellSpend' (default OFF).
   Cost:
     - attack/weapon item → 1 action (1 Strike = 1 action).
     - spell item → action.activation.unchained.cost
       (standard 2 / full-round 3 / swift 1), NOT spell.level.
   Reaction: an off-turn action-use (acting actor is not the active
   combatant — confirmed via activeCombatantMatch=false in Pilot 45)
   is an AoO: spend 1 reaction on the acting actor's own combatant,
   no action, no swing.

   Deferred (see GOAL_v2.22.0 Out of Scope): swing-counter / MAP
   penalty injection, Cleave 0-cost gating, Vital Strike (2 actions),
   Magus Spellstrike, feat multi-attack adjudication.
   ============================================================ */

// In-memory dedupe (mirrors the skill dedupe). 500ms window.
const _actionUseSpendDedupeSet = new Set();

function _isActionUseSpendDuped(actor, actionUse) {
  const actId  = actionUse?.action?.id ?? actionUse?.action?.data?.id ?? '?';
  const itemId = actionUse?.item?.id ?? actionUse?.item?.name ?? '?';
  const key = `${actor?.id}:${itemId}:${actId}`;
  if (_actionUseSpendDedupeSet.has(key)) return true;
  _actionUseSpendDedupeSet.add(key);
  setTimeout(() => _actionUseSpendDedupeSet.delete(key), 500);
  return false;
}

/**
 * Find the combatant for an actor in the current combat, whether or
 * not it is the active combatant. Used for off-turn reaction spends.
 * (_getActiveCombatantForActor returns only the *active* match.)
 */
function _getCombatantForActor(actor) {
  if (!actor || !game.combat) return null;
  return game.combat.combatants.find((c) => c.actor?.id === actor.id) ?? null;
}

/**
 * Derive the PF1.5 action cost of an action-use.
 * Attacks: 1. Spells: action.activation.unchained.cost (casting time),
 * with a chained-type fallback. Never reads spell.level.
 */
function _deriveActionUseCost(actionUse) {
  const item = actionUse?.item;
  if (item?.type !== 'spell') return 1; // attacks/weapons: 1 Strike = 1 action

  const act = actionUse?.action;
  const actData = act?.data ?? act?.system ?? act ?? {};
  const uc = actData?.activation?.unchained?.cost ?? act?.activation?.unchained?.cost;
  if (typeof uc === 'number' && uc >= 1) return uc;

  // Fallback by chained casting-time type if unchained.cost is absent.
  const t = actData?.activation?.type ?? act?.activation?.type;
  if (t === 'round') return 3;                      // full-round
  if (t === 'swift' || t === 'immediate') return 1; // swift / quickened
  return 2;                                         // standard default
}

// PF1.5 TWF attack penalty (R6). Advisory-only: ADDS the two-weapon to-hit penalty to the
// native secondary-attack field; NEVER returns false. Dormant unless the TWF Strike macro has
// set globalThis.baphometTWF.active. The macro computes the per-hand penalty (tier + light);
// this hook just applies the right one. Surface + format verified by live probe P-2 (2026-06-07):
// rollConfig.secondaryPenalty is a plain signed-number string; brackets -> NaN -> breaks the roll.
Hooks.on('pf1PreAttackRoll', (attackData, rollConfig) => {
  const twf = globalThis.baphometTWF;
  if (!twf?.active) return;                                  // only during a TWF Strike
  const pen = twf.offhand ? twf.offPenalty : twf.mainPenalty;
  if (!pen || pen === "0") return;
  const base = Number(rollConfig.secondaryPenalty) || 0;     // add, don't clobber (baseline "0")
  rollConfig.secondaryPenalty = String(base + Number(pen));
});

/**
 * Live pf1PreActionUse handler — attack & spell auto-spend.
 * OBSERVE-ONLY. Never returns false.
 */
Hooks.on('pf1PreActionUse', (actionUse) => {
  try {
    const item  = actionUse?.item;
    const actor = actionUse?.actor ?? item?.actor;
    if (!item || !actor || !game.combat?.active) return;

    const isSpell  = item.type === 'spell';
    const isAttack = item.type === 'attack' || item.type === 'weapon';
    if (!isSpell && !isAttack) return; // only attacks and spells

    // PF1.5 TWF off-hand: the off-hand bonus swing rides on the main-hand
    // Strike action and must NOT cost its own action. The PF1.5 Two-Weapon
    // Strike macro sets globalThis.baphometTWF.offhand (try/finally-scoped)
    // around the off-hand use(), so this swing still rolls but spends nothing.
    // Mirrors the _baphResolveTaskRollActive suppression pattern.
    // OBSERVE-ONLY: returns early, never returns false.
    if (isAttack && globalThis.baphometTWF?.offhand) {
      _debugLog(`auto-spend: TWF off-hand swing for "${actor.name}" — rides on main-hand Strike, no action spent`);
      return;
    }

    const settingOn = isSpell
      ? game.settings.get(AT_MODULE_ID, 'autoSpellSpend')
      : game.settings.get(AT_MODULE_ID, 'autoAttackSpend');
    if (!settingOn) {
      _debugLog(`auto-spend: ${item.type} setting OFF — no spend for "${item.name}"`);
      return;
    }

    if (_isActionUseSpendDuped(actor, actionUse)) {
      _debugLog(`auto-spend: duplicate action-use for "${item.name}" — skipping`);
      return;
    }

    const cost = _deriveActionUseCost(actionUse);
    const activeCombatant = _getActiveCombatantForActor(actor);

    // v2.25.1 (Lyra audit): read + consume the AoO (Combat Reflexes) intent ONCE,
    // on every path, scoped to THIS actor. The dialog checkbox sets a one-shot
    // globalThis.baphometAoO; consuming it here (not only in the off-turn branch)
    // stops a stale on-turn tick from surviving to a later off-turn attack, and the
    // actor-id scope means actor A's attack never eats actor B's open-dialog flag.
    const _aooFlag = globalThis.baphometAoO;
    const aooIntentForActor = !!(_aooFlag?.active && _aooFlag.actorId === actor.id);
    if (_aooFlag && _aooFlag.actorId === actor.id) globalThis.baphometAoO = null;

    if (activeCombatant) {
      // On-turn: spend the action cost (all-or-nothing).
      if (!_canUserControlCombatant(activeCombatant)) {
        _debugLog(`auto-spend: user cannot control "${actor.name}" — no spend`);
        return;
      }
      const spent = _spendActionForCombatant(
        activeCombatant.id, cost, isSpell ? `spell-${item.name}` : `attack-${item.name}`
      );
      if (spent) {
        _debugLog(`auto-spend: spent ${cost} action(s) for "${actor.name}" [${item.type}: ${item.name}]`);
      } else {
        _debugLog(`auto-spend: insufficient actions (${cost} needed) for "${actor.name}" [${item.name}]`);
        ui.notifications?.warn?.(`${actor.name}: not enough actions for ${item.name} (needs ${cost}).`);
      }
      // NOTE: swing-counter / MAP tracking deferred (GOAL_v2.22.0 Out of Scope).
    } else {
      // Off-turn → reaction (AoO). Only attacks consume a reaction.
      if (!isAttack) {
        _debugLog(`auto-spend: off-turn spell by "${actor.name}" — not charged (no active-turn action)`);
        return;
      }
      const own = _getCombatantForActor(actor);
      if (!own) {
        _debugLog(`auto-spend: off-turn attack but "${actor.name}" not in combat — no spend`);
        return;
      }
      if (!_canUserControlCombatant(own)) {
        _debugLog(`auto-spend: cannot control "${actor.name}" — no reaction spend`);
        return;
      }
      // v1.25: prefer the green Combat Reflexes (jade) pool when the attack
      // was flagged "AoO (Combat Reflexes)" on the dialog and the actor has
      // the feat; fall back to the blue reaction when no jade is left.
      // v2.25.1: the AoO intent was read + consumed once before the branch
      // (actor-scoped) — a stale on-turn tick can't survive, and actor A's
      // attack never eats actor B's open-dialog flag.
      const wantsCR = aooIntentForActor && _combatReflexCount(actor) > 0;
      if (wantsCR && game.baphometActions?.spendCombatReflex?.(own.id)) {
        _debugLog(`auto-spend: off-turn AoO by "${actor.name}" — Combat Reflexes (jade) pip spent`);
      } else {
        const r = game.baphometActions?.spendReaction?.(own.id);
        if (wantsCR && !r) ui.notifications?.warn?.(`${actor.name}: no Combat Reflexes AoO or reaction left.`);
        _debugLog(`auto-spend: off-turn AoO by "${actor.name}" — ${wantsCR ? 'no jade → ' : ''}reaction ${r ? 'spent' : 'unavailable'} (no action, no swing)`);
      }
    }
  } catch (e) {
    _debugLog('auto-spend (pf1PreActionUse) error: ' + e.message);
  }
  return undefined; // NEVER cancel the action
});

/* ============================================================
   FLOATING ACTION SPEND PANEL — v1.15
   ══════════════════════════════════════════════════════════

   A fixed-position panel visible only during active combat.
   Provides three generic manual action-spend buttons:

     Spend 1 — Swing / Move      (1 pip, reason: manual-1)
     Spend 2 — Cast / Ready      (2 pips, reason: manual-2)
     Spend 3 — F.Cast / Run       (3 pips, reason: manual-3)

   Labels are descriptive examples only. No action-type rules
   are enforced. All spends are generic pip deductions.

   Source of truth: game.combat.combatant (active combatant).
   Never reads from selected tokens.

   Visibility: only shown when the current user is GM or can
   control the active combatant (_canUserControlCombatant).

   All spends are all-or-nothing. Spending 2 with only 1 pip
   available spends 0 and warns. Condition-locked pips are
   never consumed.

   Position: controlled by the existing 'moveButtonPosition'
   client setting (bottom-right / bottom-left / top-right / top-left).

   Replaces the single Stride button from v1.14.
   ============================================================ */

/**
 * Return the DOM id used for the action spend panel.
 * @returns {string}
 */
function _getActionPanelId() {
  return 'baph-action-panel';
}

/**
 * Remove the action panel from the DOM if it exists.
 */
function _removeActionPanel() {
  document.getElementById(_getActionPanelId())?.remove();
}

/**
 * Return true if the action panel should be shown to the
 * current user right now.
 *
 * Requires:
 *   - Active combat with a current combatant
 *   - Current user is GM or can control the active combatant
 *
 * @returns {boolean}
 */
function _shouldShowActionPanel() {
  const combat = game.combat;
  if (!combat?.active || !combat.combatant) return false;
  return _canUserControlCombatant(combat.combatant);
}

/**
 * Build a single spend button row for the action panel.
 *
 * Re-validates combatant and ownership at click time so stale
 * renders don't enable spending for the wrong combatant.
 *
 * @param {number} cost    Number of action pips to spend (1–3)
 * @param {string} label   Short descriptive label shown on the button
 * @param {string} hint    Tooltip / title text
 * @param {string} reason  Debug reason string passed to _spendActionForCombatant
 * @returns {HTMLButtonElement}
 */
function _buildActionSpendButton(cost, label, hint, reason) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.classList.add('baph-action-spend-btn');
  btn.title = hint;

  const costBadge = document.createElement('span');
  costBadge.classList.add('baph-action-spend-cost');
  costBadge.textContent = String(cost);

  const labelEl = document.createElement('span');
  labelEl.classList.add('baph-action-spend-label');
  labelEl.textContent = label;

  btn.appendChild(costBadge);
  btn.appendChild(labelEl);

  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Re-validate at click time — active combatant or permissions
    // may have changed since the panel was last rendered.
    const active = game.combat?.combatant;

    if (!active) {
      _debugLog('Action panel: failed — no active combatant at click time');
      ui.notifications?.warn?.('No active combatant available.');
      _renderActionPanel();
      return;
    }

    if (!_canUserControlCombatant(active)) {
      _debugLog(`Action panel: failed — user cannot control ${active.name}`);
      ui.notifications?.warn?.(`You cannot control ${active.name}.`);
      _renderActionPanel();
      return;
    }

    _debugLog(`Action panel: attempting spend — ${active.name} / cost ${cost} / ${reason}`);

    // _spendActionForCombatant is synchronous and all-or-nothing.
    const spent = _spendActionForCombatant(active.id, cost, reason);

    if (!spent) {
      _debugLog(`Action panel: failed — not enough actions for ${active.name}, needed ${cost}`);
      ui.notifications?.warn?.(`${active.name} does not have enough actions.`);
      _refreshPipRow(active.id);
      return;
    }

    _debugLog(`Action panel: success — spent ${cost} action(s) for ${active.name}`);
    _refreshPipRow(active.id);
    _renderActionPanel();
  });

  return btn;
}

/**
 * Remove any existing action panel and, if the user should see
 * one, inject a fresh panel into document.body.
 *
 * Always calls _removeActionPanel() first to prevent duplicates.
 */
function _renderActionPanel() {
  _removeActionPanel();
  _renderTaskWidget();
  _renderAidPanel();

  if (!_shouldShowActionPanel()) return;

  const combatant = game.combat.combatant;
  const position  = game.settings.get(AT_MODULE_ID, 'moveButtonPosition') ?? 'bottom-right';

  const panel = document.createElement('div');
  panel.id = _getActionPanelId();
  panel.classList.add('baph-action-panel', `baph-action-panel-${position}`);

  // Compact header showing the active combatant name.
  const header = document.createElement('div');
  header.classList.add('baph-action-panel-header');
  header.textContent = combatant.name;
  header.title = combatant.name;
  panel.appendChild(header);

  // Spend buttons — labels are examples only, not rules.
  panel.appendChild(_buildActionSpendButton(1, 'Swing / Move',   'Spend 1 action',  'manual-1'));
  panel.appendChild(_buildActionSpendButton(2, 'Cast / Ready',   'Spend 2 actions', 'manual-2'));
  panel.appendChild(_buildActionSpendButton(3, 'F.Cast / Run',    'Spend 3 actions', 'manual-3'));

  document.body.appendChild(panel);
}

/* ============================================================
   TASK PROGRESS WIDGET — v2.17.0 / v2.17.1
   Interactive display for the active combatant's first active task.

   Visible to all users when all three conditions are met:
     1. Active combat encounter
     2. Current active combatant
     3. At least one task with status === 'active' on that combatant

   Does NOT expose hidden task data (roundsRequired, metadataHidden).
   Player-safe display only: taskName + roundsCommitted + readyToResolve.

   If multiple active tasks exist, shows the first one found.
   Multi-task display is future work.

   v2.17.1 additions:
   - Continue Task button (shown when task is not readyToResolve and
     the current user can control the active combatant).
   - Click: spends 1 action via game.baphometTasks.commitAction(),
     then calls _renderActionPanel() to refresh.
   - Cross-client cache sync handled by updateActor hook in
     task-tracker.js — widget updates automatically on all clients.
   ============================================================ */

const TASK_WIDGET_ID = 'baph-task-widget';

function _removeTaskWidget() {
  document.getElementById(TASK_WIDGET_ID)?.remove();
}

/**
 * Render (or remove) the task progress widget for the active combatant.
 * Called from _renderActionPanel() on every panel lifecycle event and
 * indirectly by the updateActor cache-sync hook in task-tracker.js.
 *
 * Widget visibility depends on combat/combatant/task state only.
 * Continue Task button additionally requires user control of combatant.
 */
function _renderTaskWidget() {
  _removeTaskWidget();

  const combat = game.combat;
  if (!combat?.active) return;
  const combatant = combat.combatant;
  if (!combatant) return;

  // game.baphometTasks is registered on pf1PostReady; guard for early calls.
  if (!game.baphometTasks) return;

  const tasks = game.baphometTasks.getTasks(combatant);
  const task = Object.values(tasks).find(t => t.status === 'active');

  if (!task) {
    const position = (() => {
      try { return game.settings.get(AT_MODULE_ID, 'moveButtonPosition') ?? 'bottom-right'; }
      catch { return 'bottom-right'; }
    })();
    if (game.user.isGM) {
      _renderBeginTaskWidget(combatant, position);
    } else if (_canUserControlCombatant(combatant)) {
      _renderRequestTaskWidget(combatant, position);
    }
    return;
  }

  const canControl = _canUserControlCombatant(combatant);

  const position = (() => {
    try { return game.settings.get(AT_MODULE_ID, 'moveButtonPosition') ?? 'bottom-right'; }
    catch { return 'bottom-right'; }
  })();

  const widget = document.createElement('div');
  widget.id = TASK_WIDGET_ID;
  widget.classList.add('baph-task-widget', `baph-task-widget-${position}`);

  const header = document.createElement('div');
  header.classList.add('baph-task-widget-header');
  header.textContent = 'Task';
  widget.appendChild(header);

  const nameEl = document.createElement('div');
  nameEl.classList.add('baph-task-widget-name');
  nameEl.textContent = task.taskName ?? '(unnamed)';
  nameEl.title = task.taskName ?? '';
  widget.appendChild(nameEl);

  // Player-safe progress: never exposes roundsRequired or hidden metadata.
  const progressEl = document.createElement('div');
  progressEl.classList.add('baph-task-widget-progress');
  if (task.readyToResolve) {
    const currentRound     = game.combat?.round ?? null;
    const lastAttemptRound = task.lastResolvedAttemptRound ?? null;
    if (lastAttemptRound !== null && lastAttemptRound === currentRound) {
      progressEl.textContent = 'Minor failure — retry next round';
      progressEl.classList.add('baph-task-widget-minor-failure');
    } else if (lastAttemptRound !== null) {
      progressEl.textContent = 'Retry available — resolve again';
      progressEl.classList.add('baph-task-widget-retry');
    } else {
      progressEl.textContent = 'Ready to resolve';
      progressEl.classList.add('baph-task-widget-ready');
    }
  } else {
    progressEl.textContent = `Progress: ${task.roundsCommitted ?? 0} committed`;
  }
  widget.appendChild(progressEl);

  // Pending aid display — shows total queued assistance if any.
  const pendingBonuses     = task.pendingResolutionBonuses ?? [];
  const pendingBonusTotal  = pendingBonuses.reduce((s, b) => s + (b.amount ?? 0), 0);
  if (pendingBonusTotal > 0) {
    const aidEl = document.createElement('div');
    aidEl.classList.add('baph-task-widget-aid-queued');
    aidEl.textContent = `Assistance queued: +${pendingBonusTotal}`;
    widget.appendChild(aidEl);
  }

  // Continue Task button — only for controlling users on unresolved tasks.
  // Spend 1 action + commit 1 progress unit. Hidden when readyToResolve.
  if (!task.readyToResolve && canControl) {
    const taskId = task.taskId;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.classList.add('baph-task-widget-continue-btn');
    btn.textContent = 'Continue Task';
    btn.title = 'Spend 1 action to commit 1 round of task progress';

    btn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const active = game.combat?.combatant;
      if (!active || !game.baphometTasks) {
        _debugLog('Task widget: Continue Task — no active combatant or API not ready');
        return;
      }

      _debugLog(`Task widget: Continue Task — ${active.name} / task ${taskId}`);
      const ok = await game.baphometTasks.commitAction(active, taskId);

      if (ok) {
        _debugLog('Task widget: Continue Task succeeded — refreshing');
        _renderActionPanel();
      } else {
        _debugLog('Task widget: Continue Task failed — commitAction returned false');
        ui.notifications?.warn?.(
          'Continue Task: action not taken. Not enough actions or already committed this round.'
        );
        _renderActionPanel();
      }
    });

    widget.appendChild(btn);
  }

  // Resolve Task button — shown when task is ready to resolve and user controls combatant.
  // Spend 1 action and roll the skill check via the existing resolveTask path.
  if (task.readyToResolve && canControl) {
    const taskId = task.taskId;
    const resolveBtn = document.createElement('button');
    resolveBtn.type = 'button';
    resolveBtn.classList.add('baph-task-widget-resolve-btn');
    resolveBtn.textContent = 'Resolve Task';
    resolveBtn.title = 'Spend 1 action to roll the skill check and resolve this task';

    resolveBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const active = game.combat?.combatant;
      if (!active || !game.baphometTasks) {
        _debugLog('Task widget: Resolve Task — no active combatant or API not ready');
        return;
      }

      _debugLog(`Task widget: Resolve Task — ${active.name} / task ${taskId}`);
      const ok = await game.baphometTasks.resolveTask(active, taskId);

      if (!ok) {
        _debugLog('Task widget: Resolve Task failed — resolveTask returned false');
        ui.notifications?.warn?.(
          'Resolve Task: action not taken. Not enough actions, task not ready, or already attempted this round.'
        );
      } else {
        _debugLog('Task widget: Resolve Task succeeded — refreshing');
      }
      _renderActionPanel();
    });

    widget.appendChild(resolveBtn);
  }

  // Abandon Task button — shown to controlling users for any non-terminal active task.
  // Costs 0 actions, no roll. Clears pending aid. Chat notification posted.
  if (canControl) {
    const abandonTaskId = task.taskId;
    const abandonBtn = document.createElement('button');
    abandonBtn.type = 'button';
    abandonBtn.classList.add('baph-task-widget-abandon-btn');
    abandonBtn.textContent = 'Abandon Task';
    abandonBtn.title = 'Abandon this task. Costs no actions.';

    abandonBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const active = game.combat?.combatant;
      if (!active || !game.baphometTasks) {
        _debugLog('Task widget: Abandon Task — no active combatant or API not ready');
        return;
      }

      _debugLog(`Task widget: Abandon Task — ${active.name} / task ${abandonTaskId}`);
      const ok = await game.baphometTasks.abandonTask(active, abandonTaskId);

      if (!ok) {
        _debugLog('Task widget: Abandon Task failed — abandonTask returned false');
        ui.notifications?.warn?.('Abandon Task: could not abandon this task.');
      }
      _renderActionPanel();
    });

    widget.appendChild(abandonBtn);
  }

  document.body.appendChild(widget);
}

/* ============================================================
   AID TASK PANEL — v2.18.0

   Compact panel listing allied ready-to-resolve tasks that the
   active combatant can aid this turn. Appears when eligible aid
   targets exist in the current combat.

   Position: above the task widget on the same horizontal rail.
   The active combatant's own task widget and the aid panel may
   show simultaneously; they share the same position setting.
   ============================================================ */

const AID_PANEL_ID = 'baph-aid-panel';

function _removeAidPanel() {
  document.getElementById(AID_PANEL_ID)?.remove();
}

/**
 * Render (or remove) the aid task panel for the active combatant.
 * Shows one row per eligible ally ready task with an Aid button.
 * Called from _renderActionPanel() on every panel lifecycle event.
 */
function _renderAidPanel() {
  _removeAidPanel();

  const combat = game.combat;
  if (!combat?.active) return;
  const activeCombatant = combat.combatant;
  if (!activeCombatant) return;
  if (!game.baphometTasks) return;
  if (!_canUserControlCombatant(activeCombatant)) return;

  const aidTargets   = [];

  for (const combatant of combat.combatants) {
    if (combatant.id === activeCombatant.id) continue;
    if (!combatant.actor) continue;

    const tasks = game.baphometTasks.getTasks(combatant);
    for (const task of Object.values(tasks)) {
      // Aid available for all active tasks: both in-progress and ready-to-resolve (v2.18.1)
      if (task.status !== 'active') continue;

      // "Aided ✓" state: helper already has a successful contribution for this pending Resolve attempt.
      // Uses successfulAidContributors (cleared on Resolve) rather than roundAdded (cleared on turn).
      const successfulContributors = task.successfulAidContributors ?? [];
      const alreadyAided = successfulContributors.includes(activeCombatant.id);
      aidTargets.push({ combatant, task, alreadyAided });
    }
  }

  if (aidTargets.length === 0) return;

  const position = (() => {
    try { return game.settings.get(AT_MODULE_ID, 'moveButtonPosition') ?? 'bottom-right'; }
    catch { return 'bottom-right'; }
  })();

  const panel = document.createElement('div');
  panel.id = AID_PANEL_ID;
  panel.classList.add('baph-aid-panel', `baph-aid-panel-${position}`);

  const header = document.createElement('div');
  header.classList.add('baph-aid-panel-header');
  header.textContent = 'Aid Task';
  panel.appendChild(header);

  for (const { combatant, task, alreadyAided } of aidTargets) {
    const row = document.createElement('div');
    row.classList.add('baph-aid-panel-row');

    const label = document.createElement('span');
    label.classList.add('baph-aid-panel-label');
    label.textContent = `${combatant.actor.name} — ${task.taskName}`;
    label.title = `${combatant.actor.name}: ${task.taskName}`;
    row.appendChild(label);

    if (alreadyAided) {
      const aidedNote = document.createElement('span');
      aidedNote.classList.add('baph-aid-panel-aided');
      aidedNote.textContent = 'Aided ✓';
      row.appendChild(aidedNote);
    } else {
      const targetCombatantId = combatant.id;
      const targetTaskId      = task.taskId;

      const aidBtn = document.createElement('button');
      aidBtn.type = 'button';
      aidBtn.classList.add('baph-aid-panel-btn');
      aidBtn.textContent = 'Aid';
      aidBtn.title =
        `Spend 1 action, roll ${task.taskName ? task.skillKey.toUpperCase() : 'skill'} vs DC 10 ` +
        `to aid ${combatant.actor.name}'s ${task.taskName} (+2 on success)`;

      aidBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const active = game.combat?.combatant;
        if (!active || !game.baphometTasks) return;

        _debugLog(
          `Aid panel: Aid Task — ${active.name} → ${combatant.actor.name} / task ${targetTaskId}`
        );
        const ok = await game.baphometTasks.aidTask(active, targetCombatantId, targetTaskId);

        if (!ok) {
          ui.notifications?.warn?.(
            'Aid Task: could not aid. Not enough actions, task no longer eligible, or already aided this round.'
          );
        }
        _renderActionPanel();
      });

      row.appendChild(aidBtn);
    }

    panel.appendChild(row);
  }

  document.body.appendChild(panel);
}

/**
 * Render a minimal task widget showing only the "Begin Task" button.
 * Visible to GM only, when the active combatant has no unresolved task.
 */
function _renderBeginTaskWidget(combatant, position) {
  const widget = document.createElement('div');
  widget.id = TASK_WIDGET_ID;
  widget.classList.add('baph-task-widget', `baph-task-widget-${position}`);

  const header = document.createElement('div');
  header.classList.add('baph-task-widget-header');
  header.textContent = 'Task';
  widget.appendChild(header);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.classList.add('baph-task-widget-begin-btn');
  btn.textContent = 'Begin Task';
  btn.title = 'Open GM task builder for this combatant';
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    _openTaskBuilderOverlay(combatant);
  });
  widget.appendChild(btn);

  document.body.appendChild(widget);
}

/* ============================================================
   GM TASK BUILDER OVERLAY — v2.19.0

   GM-only compact form overlay for initiating a supported
   multi-round Disable Device task for the active combatant.

   Opens when the GM clicks the "Begin Task" button that appears
   in the task widget area when the active combatant has no task.

   The overlay collects:
     - Task Name (text)
     - Action flavor (select: disable / arm / sabotage / jury_rig / custom)
     - Duration mode (Simple 1d4 / Difficult 2d4 / Manual)
     - Manual rounds required (shown only for Manual mode)
     - Resolution DC (number)

   On confirm:
     1. Re-validates active combatant matches the stored ID.
     2. Secret rolls for Simple/Difficult modes (GM-side Math.random).
     3. Calls game.baphometTasks.initiateTask() which spends 1 action
        and creates the task with roundsCommitted=1.

   Positioned at the task widget location (bottom: 11.5rem for bottom-*
   variants), z-index: 101 (above task widget and aid panel at 100).

   Removed by: confirm click, cancel click, deleteCombat hook.
   Does NOT close on _renderActionPanel calls so the GM can fill it
   across incremental re-renders. Stale-combatant is caught at confirm.
   ============================================================ */

const TASK_BUILDER_ID = 'baph-task-builder';

function _removeTaskBuilderOverlay() {
  document.getElementById(TASK_BUILDER_ID)?.remove();
}

function _openTaskBuilderOverlay(combatant) {
  _removeTaskBuilderOverlay();
  _removeTaskWidget();

  const position = (() => {
    try { return game.settings.get(AT_MODULE_ID, 'moveButtonPosition') ?? 'bottom-right'; }
    catch { return 'bottom-right'; }
  })();

  const overlay = document.createElement('div');
  overlay.id = TASK_BUILDER_ID;
  overlay.classList.add('baph-task-builder', `baph-task-builder-${position}`);
  overlay.dataset.combatantId = combatant.id;

  // Header
  const header = document.createElement('div');
  header.classList.add('baph-task-builder-header');
  header.textContent = 'Begin Task';
  overlay.appendChild(header);

  // Read-only skill display
  const skillEl = document.createElement('div');
  skillEl.classList.add('baph-task-builder-skill-line');
  skillEl.textContent = 'Skill: Disable Device';
  overlay.appendChild(skillEl);

  // Task Name
  const nameLabel = document.createElement('label');
  nameLabel.classList.add('baph-task-builder-field-label');
  nameLabel.textContent = 'Task Name';
  overlay.appendChild(nameLabel);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.classList.add('baph-task-builder-input');
  nameInput.name = 'taskName';
  nameInput.placeholder = 'e.g. Disable Poison Dart Trap';
  overlay.appendChild(nameInput);

  // Action flavor
  const actionLabel = document.createElement('label');
  actionLabel.classList.add('baph-task-builder-field-label');
  actionLabel.textContent = 'Action';
  overlay.appendChild(actionLabel);

  const actionSelect = document.createElement('select');
  actionSelect.classList.add('baph-task-builder-select');
  actionSelect.name = 'taskAction';
  [
    { value: 'disable',  label: 'Disable' },
    { value: 'arm',      label: 'Arm' },
    { value: 'sabotage', label: 'Sabotage' },
    { value: 'jury_rig', label: 'Jury-rig' },
    { value: 'custom',   label: 'Custom' },
  ].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    actionSelect.appendChild(opt);
  });
  overlay.appendChild(actionSelect);

  // Duration mode
  const durationLabel = document.createElement('label');
  durationLabel.classList.add('baph-task-builder-field-label');
  durationLabel.textContent = 'Duration';
  overlay.appendChild(durationLabel);

  const durationSelect = document.createElement('select');
  durationSelect.classList.add('baph-task-builder-select');
  durationSelect.name = 'roundsMode';
  [
    { value: 'simple',    label: 'Simple — secret 1d4' },
    { value: 'difficult', label: 'Difficult — secret 2d4' },
    { value: 'manual',    label: 'Manual' },
  ].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    durationSelect.appendChild(opt);
  });
  overlay.appendChild(durationSelect);

  // Manual rounds group (hidden unless manual selected)
  const manualGroup = document.createElement('div');
  manualGroup.classList.add('baph-task-builder-manual-group');
  manualGroup.style.display = 'none';

  const manualLabel = document.createElement('label');
  manualLabel.classList.add('baph-task-builder-field-label');
  manualLabel.textContent = 'Rounds Required';
  manualGroup.appendChild(manualLabel);

  const manualInput = document.createElement('input');
  manualInput.type = 'number';
  manualInput.classList.add('baph-task-builder-input', 'baph-task-builder-input-num');
  manualInput.name = 'roundsManual';
  manualInput.min = '1';
  manualInput.step = '1';
  manualInput.value = '2';
  manualGroup.appendChild(manualInput);
  overlay.appendChild(manualGroup);

  durationSelect.addEventListener('change', () => {
    manualGroup.style.display = durationSelect.value === 'manual' ? '' : 'none';
  });

  // Resolution DC
  const dcLabel = document.createElement('label');
  dcLabel.classList.add('baph-task-builder-field-label');
  dcLabel.textContent = 'Resolution DC';
  overlay.appendChild(dcLabel);

  const dcInput = document.createElement('input');
  dcInput.type = 'number';
  dcInput.classList.add('baph-task-builder-input', 'baph-task-builder-input-num');
  dcInput.name = 'dc';
  dcInput.min = '1';
  dcInput.step = '1';
  dcInput.value = '15';
  overlay.appendChild(dcInput);

  // Button row
  const btnRow = document.createElement('div');
  btnRow.classList.add('baph-task-builder-btn-row');

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.classList.add('baph-task-builder-btn', 'baph-task-builder-btn-confirm');
  confirmBtn.textContent = 'Begin Task';

  confirmBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Re-validate active combatant at click time
    const active = game.combat?.combatant;
    if (!active) {
      ui.notifications?.warn?.('No active combatant — cannot begin task.');
      _removeTaskBuilderOverlay();
      _renderActionPanel();
      return;
    }
    if (active.id !== overlay.dataset.combatantId) {
      ui.notifications?.warn?.('Turn has changed — task builder closed.');
      _removeTaskBuilderOverlay();
      _renderActionPanel();
      return;
    }

    // Collect and validate form values
    const taskName   = nameInput.value.trim();
    const taskAction = actionSelect.value;
    const roundsMode = durationSelect.value;
    const dcRaw      = parseInt(dcInput.value, 10);

    if (!taskName) {
      ui.notifications?.warn?.('Task Name is required.');
      nameInput.focus();
      return;
    }
    if (!Number.isFinite(dcRaw) || dcRaw < 1) {
      ui.notifications?.warn?.('Resolution DC must be a positive integer.');
      dcInput.focus();
      return;
    }

    // Secret roll for duration (GM-side only — not visible to players)
    let roundsRequired;
    if (roundsMode === 'simple') {
      roundsRequired = Math.floor(Math.random() * 4) + 1;       // 1d4
    } else if (roundsMode === 'difficult') {
      roundsRequired = (Math.floor(Math.random() * 4) + 1)      // 2d4
                     + (Math.floor(Math.random() * 4) + 1);
    } else {
      roundsRequired = parseInt(manualInput.value, 10);
      if (!Number.isFinite(roundsRequired) || roundsRequired < 1) {
        ui.notifications?.warn?.('Rounds Required must be a positive integer.');
        manualInput.focus();
        return;
      }
    }

    _removeTaskBuilderOverlay();

    if (!game.baphometTasks) {
      ui.notifications?.warn?.('Task system not ready.');
      _renderActionPanel();
      return;
    }

    // initiateTask handles: action spend, task creation, chat, panel refresh
    await game.baphometTasks.initiateTask(active, {
      taskName,
      taskAction,
      roundsRequired,
      dc: dcRaw,
    });
    // initiateTask calls _renderActionPanel() on success.
    // On failure it notifies via ui.notifications and we fall through.
    _renderActionPanel();
  });
  btnRow.appendChild(confirmBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.classList.add('baph-task-builder-btn', 'baph-task-builder-btn-cancel');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    _removeTaskBuilderOverlay();
    _renderActionPanel();
  });
  btnRow.appendChild(cancelBtn);

  overlay.appendChild(btnRow);
  document.body.appendChild(overlay);

  // Focus task name field after DOM insertion
  setTimeout(() => nameInput.focus(), 50);
}

/* ----------------------------------------------------------
   ACTION PANEL HOOK REGISTRATIONS

   Separate from the existing combat lifecycle hooks above
   (which manage pipState). These hooks manage only the
   action panel DOM element.

   renderCombatTracker: covers turn advance, combatant changes,
   and any re-render of the tracker. Most state changes that
   matter for the panel fire this hook.

   updateCombat: belt-and-suspenders for turn advances that may
   not always trigger a full renderCombatTracker re-render.

   combatStart: ensures the panel appears when combat begins.

   deleteCombat: removes the panel when combat ends.
   (The existing deleteCombat hook cleans up pipState separately;
   this listener only removes the DOM panel.)
   ---------------------------------------------------------- */

Hooks.on('renderCombatTracker', () => {
  _renderActionPanel();
});

Hooks.on('updateCombat', () => {
  _renderActionPanel();
});

Hooks.on('combatStart', () => {
  _renderActionPanel();
});

Hooks.on('deleteCombat', () => {
  _removeActionPanel();
  _removeTaskWidget();
  _removeAidPanel();
  _removeTaskBuilderOverlay();
  _removeRequestTaskOverlay();
  _removeGMApprovalModal();
});

/* ----------------------------------------------------------
   CROSS-CLIENT PIP SYNC — v2.19.1

   When any client writes the pip flag (spendAction, spendReaction,
   reset, or manual toggle), Foundry propagates an updateCombatant
   hook to ALL connected clients. This hook re-hydrates the local
   pipState from the combatant flag and refreshes the pip row,
   making remote clients display the current spend state without
   requiring a manual reload.

   updateCombatant is confirmed in:
     docs/reference/foundry-v13/99_Combined_Foundry_v13_PF1_[KnowledgeFiles.md].md
     Hooks.on('updateCombatant', (combatant, changes, options, userId) => {});

   getFlag is synchronous (reads from in-memory document data).
   ---------------------------------------------------------- */
Hooks.on('updateCombatant', (combatant, changes) => {
  // Bail fast if this isn't a pip-state flag update.
  if (!changes?.flags?.['baphomet-utils']?.[PIP_FLAG_KEY]) return;

  const combat = game.combat;
  if (!combat) return;

  // Confirm this combatant belongs to the currently active combat.
  if (combatant.parent?.id !== combat.id) return;

  const existing = _getState(combatant.id);
  if (!existing) return;

  // Read authoritative merged state from the document (not from changes
  // which may be a partial update in edge cases).
  const saved = combatant.getFlag('baphomet-utils', PIP_FLAG_KEY);
  if (!saved) return;

  // Hydrate pip arrays only; conditionLocked is derived from actor, not stored.
  if (Array.isArray(saved.actions)   && saved.actions.length   === 3) existing.actions   = [...saved.actions];
  if (Array.isArray(saved.reaction)  && saved.reaction.length  === 1) existing.reaction  = [...saved.reaction];
  if (Array.isArray(saved.reflexPip))                                  existing.reflexPip = [...saved.reflexPip];
  if ('resetForRound' in saved) existing._resetForRound = saved.resetForRound;

  // Refresh the pip row in the combat tracker sidebar for this combatant.
  _refreshPipRow(combatant.id);
});

// Initial render on world ready — shows the panel if a combat
// is already active when the page loads (e.g. after a reload).
Hooks.once('ready', () => {
  _renderActionPanel();
});

/* ============================================================
   PLAYER TASK REQUEST SYSTEM — v2.20.0

   Entry point for non-GM players to request multi-round task
   initiation through the combat HUD. Requests route to the GM
   via socket for approval, preserving the hidden-data privacy model.

   Key design principles (from GOAL_v2.20.0.md):
     - Hidden DC and roundsRequired remain on GM user flags only.
     - Player request contains no DC or duration — GM sets those.
     - Approval calls the existing initiateTask path (not a parallel one).
     - Request expires after 60 s if no GM responds.

   Cross-file globals (callable from task-tracker.js):
     _openGMApprovalModal(payload, validation)
     _baphHandleRequestResponse(payload)
     _removeRequestTaskOverlay()
     _removeGMApprovalModal()
     _baphSignalNextGMRequest()
   ============================================================ */

/* --- Multi-round skill registry ---
   Registry-driven: add entries here to expose new skills in future
   milestones without modifying the player dialog UI code.
   v2.20.0: Disable Device ('dev') only. */
const BAPH_MULTI_ROUND_SKILL_REGISTRY = [
  { key: 'dev', label: 'Disable Device' },
];

const BAPH_REQUEST_OVERLAY_ID = 'baph-request-task-overlay';
const BAPH_GM_APPROVAL_ID     = 'baph-gm-approval-modal';

// Single pending request state (player side only — one request at a time).
let _baphActiveRequestId    = null;
let _baphRequestExpireTimer = null;

function _clearPendingRequest() {
  if (_baphRequestExpireTimer !== null) {
    clearTimeout(_baphRequestExpireTimer);
    _baphRequestExpireTimer = null;
  }
  _baphActiveRequestId = null;
}

function _removeRequestTaskOverlay() {
  document.getElementById(BAPH_REQUEST_OVERLAY_ID)?.remove();
}

function _removeGMApprovalModal() {
  document.getElementById(BAPH_GM_APPROVAL_ID)?.remove();
}

/**
 * Look up the display label for a skill key in the registry.
 * Falls back to the raw key if not found.
 */
function _getSkillLabel(skillKey) {
  const entry = BAPH_MULTI_ROUND_SKILL_REGISTRY.find(s => s.key === skillKey);
  return entry ? entry.label : skillKey;
}

/**
 * Render the "Request Skill Task" widget for a non-GM player who
 * controls the active combatant and has no active task.
 * Mirrors _renderBeginTaskWidget structurally.
 */
function _renderRequestTaskWidget(combatant, position) {
  const widget = document.createElement('div');
  widget.id = TASK_WIDGET_ID;
  widget.classList.add('baph-task-widget', `baph-task-widget-${position}`);

  const header = document.createElement('div');
  header.classList.add('baph-task-widget-header');
  header.textContent = 'Task';
  widget.appendChild(header);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.classList.add('baph-task-widget-request-btn');
  btn.textContent = 'Request Skill Task';
  btn.title = 'Send a multi-round skill task request to the GM for approval';
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const active = game.combat?.combatant;
    if (!active || active.id !== combatant.id) {
      ui.notifications?.warn?.('You are no longer the active combatant.');
      _renderActionPanel();
      return;
    }
    _openRequestTaskDialog(combatant);
  });
  widget.appendChild(btn);

  document.body.appendChild(widget);
}

/**
 * Open the player-side task initiation dialog.
 * Collects skill (registry-driven) and description, then emits a
 * socket request to the GM. Switches to a waiting state on submit.
 */
function _openRequestTaskDialog(combatant) {
  _removeRequestTaskOverlay();

  const position = (() => {
    try { return game.settings.get(AT_MODULE_ID, 'moveButtonPosition') ?? 'bottom-right'; }
    catch { return 'bottom-right'; }
  })();

  const overlay = document.createElement('div');
  overlay.id = BAPH_REQUEST_OVERLAY_ID;
  overlay.classList.add('baph-request-overlay', `baph-request-overlay-${position}`);
  overlay.dataset.combatantId = combatant.id;

  // Header
  const header = document.createElement('div');
  header.classList.add('baph-request-overlay-header');
  header.textContent = 'Request Skill Task';
  overlay.appendChild(header);

  // Skill selector (single entry = read-only label; multiple = dropdown)
  const skillLineLabel = document.createElement('label');
  skillLineLabel.classList.add('baph-task-builder-field-label');
  skillLineLabel.textContent = 'Skill';
  overlay.appendChild(skillLineLabel);

  let selectedSkillKey = BAPH_MULTI_ROUND_SKILL_REGISTRY[0].key;

  if (BAPH_MULTI_ROUND_SKILL_REGISTRY.length === 1) {
    const skillDisplay = document.createElement('div');
    skillDisplay.classList.add('baph-task-builder-skill-line');
    skillDisplay.textContent = BAPH_MULTI_ROUND_SKILL_REGISTRY[0].label;
    overlay.appendChild(skillDisplay);
  } else {
    const skillSelect = document.createElement('select');
    skillSelect.classList.add('baph-task-builder-select');
    for (const { key, label } of BAPH_MULTI_ROUND_SKILL_REGISTRY) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = label;
      skillSelect.appendChild(opt);
    }
    skillSelect.addEventListener('change', () => { selectedSkillKey = skillSelect.value; });
    overlay.appendChild(skillSelect);
  }

  // Description
  const descLabel = document.createElement('label');
  descLabel.classList.add('baph-task-builder-field-label');
  descLabel.textContent = 'What are you attempting?';
  overlay.appendChild(descLabel);

  const descInput = document.createElement('textarea');
  descInput.classList.add('baph-task-builder-input', 'baph-request-textarea');
  descInput.name = 'description';
  descInput.placeholder = 'e.g. Disabling the poison-dart trap on the floor tile';
  descInput.rows = 3;
  overlay.appendChild(descInput);

  // Info text
  const infoEl = document.createElement('div');
  infoEl.classList.add('baph-request-overlay-info');
  infoEl.textContent = 'Your request will be sent to the GM for approval.';
  overlay.appendChild(infoEl);

  // Button row
  const btnRow = document.createElement('div');
  btnRow.classList.add('baph-task-builder-btn-row');

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.classList.add('baph-task-builder-btn', 'baph-task-builder-btn-confirm');
  submitBtn.textContent = 'Submit';
  submitBtn.disabled = true;

  descInput.addEventListener('input', () => {
    submitBtn.disabled = descInput.value.trim().length === 0;
  });

  submitBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    const description = descInput.value.trim();
    if (!description) return;

    // Re-validate active combatant at click time
    const active = game.combat?.combatant;
    if (!active || active.id !== combatant.id) {
      ui.notifications?.warn?.('You are no longer the active combatant.');
      _removeRequestTaskOverlay();
      _renderActionPanel();
      return;
    }
    if (!_canUserControlCombatant(active)) {
      ui.notifications?.warn?.('You do not control this combatant.');
      _removeRequestTaskOverlay();
      _renderActionPanel();
      return;
    }

    // Unique request ID (stable without requiring crypto.randomUUID)
    const requestId = `req-${game.user.id}-${Date.now()}`;

    // Switch to waiting state
    submitBtn.disabled  = true;
    submitBtn.textContent = 'Waiting…';
    descInput.disabled  = true;
    infoEl.textContent  = 'Request sent. Awaiting GM response…';

    // Track pending request and start 60 s expiry timer
    _clearPendingRequest();
    _baphActiveRequestId = requestId;
    _baphRequestExpireTimer = setTimeout(() => {
      if (_baphActiveRequestId !== requestId) return;
      _clearPendingRequest();
      _removeRequestTaskOverlay();
      _renderActionPanel();
      ui.notifications?.warn?.(
        'Task request expired — no GM responded. Try again when the GM is ready.'
      );
      _debugLog(`Request ${requestId} expired after 60 s`);
    }, 60000);

    const payload = {
      requestId,
      requestingUserId:      game.user.id,
      requestingActorId:     combatant.actor?.id ?? null,
      requestingCombatantId: combatant.id,
      skillId:               selectedSkillKey,
      description,
      timestamp:             Date.now(),
    };

    game.socket.emit(`module.${AT_MODULE_ID}`, {
      action:  'baphTaskRequest',
      payload,
    });

    _debugLog(`Task request submitted: ${requestId}`, payload);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.classList.add('baph-task-builder-btn', 'baph-task-builder-btn-cancel');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    _clearPendingRequest();
    _removeRequestTaskOverlay();
    _renderActionPanel();
  });

  btnRow.appendChild(submitBtn);
  btnRow.appendChild(cancelBtn);
  overlay.appendChild(btnRow);

  document.body.appendChild(overlay);
  setTimeout(() => descInput.focus(), 50);
}

/**
 * Open the GM approval modal for a player-submitted task request.
 * Called from task-tracker.js socket handler on GM clients.
 *
 * @param {object} payload     - The baphTaskRequest socket payload
 * @param {object} validation  - { isActiveCombatant, userName, actorName }
 */
function _openGMApprovalModal(payload, validation) {
  _removeGMApprovalModal();

  const position = (() => {
    try { return game.settings.get(AT_MODULE_ID, 'moveButtonPosition') ?? 'bottom-right'; }
    catch { return 'bottom-right'; }
  })();

  const modal = document.createElement('div');
  modal.id = BAPH_GM_APPROVAL_ID;
  modal.classList.add('baph-gm-approval', `baph-gm-approval-${position}`);
  modal.dataset.requestId = payload.requestId;

  // Header
  const header = document.createElement('div');
  header.classList.add('baph-gm-approval-header');
  header.textContent = 'Player Task Request';
  modal.appendChild(header);

  // Read-only request details
  const details = document.createElement('div');
  details.classList.add('baph-gm-approval-details');

  function addDetailRow(label, value) {
    const row = document.createElement('div');
    row.classList.add('baph-gm-approval-detail-row');
    const lbl = document.createElement('span');
    lbl.classList.add('baph-gm-approval-detail-label');
    lbl.textContent = `${label}: `;
    const val = document.createElement('span');
    val.classList.add('baph-gm-approval-detail-value');
    val.textContent = value;
    row.appendChild(lbl);
    row.appendChild(val);
    details.appendChild(row);
  }

  addDetailRow('Player',    validation.userName  ?? 'Unknown');
  addDetailRow('Character', validation.actorName ?? 'Unknown');
  addDetailRow('Skill',     _getSkillLabel(payload.skillId));
  addDetailRow(
    'Active turn',
    validation.isActiveCombatant ? 'Yes — active turn' : 'No — turn has changed'
  );

  const descLabel = document.createElement('div');
  descLabel.classList.add('baph-task-builder-field-label');
  descLabel.textContent = 'Description:';
  details.appendChild(descLabel);

  const descText = document.createElement('div');
  descText.classList.add('baph-gm-approval-description');
  descText.textContent = payload.description ?? '(none)';
  details.appendChild(descText);

  modal.appendChild(details);

  // GM-only section divider
  const divider = document.createElement('div');
  divider.classList.add('baph-gm-approval-divider');
  divider.textContent = '─── GM Settings (hidden from player) ───';
  modal.appendChild(divider);

  // Difficulty preset
  const diffLabel = document.createElement('label');
  diffLabel.classList.add('baph-task-builder-field-label');
  diffLabel.textContent = 'Difficulty Preset';
  modal.appendChild(diffLabel);

  const diffSelect = document.createElement('select');
  diffSelect.classList.add('baph-task-builder-select');
  [
    { value: 'simple',    label: 'Simple trap — 1d4 rounds' },
    { value: 'difficult', label: 'Difficult trap — 2d4 rounds' },
    { value: 'custom',    label: 'Custom / Manual' },
  ].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    diffSelect.appendChild(opt);
  });
  modal.appendChild(diffSelect);

  // Rounds Required row (input + roll button)
  const roundsLabel = document.createElement('label');
  roundsLabel.classList.add('baph-task-builder-field-label');
  roundsLabel.textContent = 'Rounds Required';
  modal.appendChild(roundsLabel);

  const roundsRow = document.createElement('div');
  roundsRow.classList.add('baph-gm-approval-inline-row');

  const roundsInput = document.createElement('input');
  roundsInput.type = 'number';
  roundsInput.classList.add('baph-task-builder-input', 'baph-task-builder-input-num');
  roundsInput.name = 'roundsRequired';
  roundsInput.min  = '1';
  roundsInput.step = '1';
  roundsInput.value = '2';
  roundsRow.appendChild(roundsInput);

  const rollBtn = document.createElement('button');
  rollBtn.type = 'button';
  rollBtn.classList.add('baph-gm-approval-roll-btn');
  rollBtn.textContent = '🎲 Roll';
  rollBtn.title = 'Roll the selected difficulty preset';
  rollBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const mode = diffSelect.value;
    if (mode === 'simple') {
      roundsInput.value = Math.floor(Math.random() * 4) + 1;
    } else if (mode === 'difficult') {
      roundsInput.value = (Math.floor(Math.random() * 4) + 1)
                        + (Math.floor(Math.random() * 4) + 1);
    } else {
      roundsInput.value = parseInt(roundsInput.value, 10) || 2;
    }
  });
  roundsRow.appendChild(rollBtn);
  modal.appendChild(roundsRow);

  // Auto-roll when a preset is selected (except custom)
  diffSelect.addEventListener('change', () => {
    const mode = diffSelect.value;
    if (mode === 'simple') {
      roundsInput.value = Math.floor(Math.random() * 4) + 1;
    } else if (mode === 'difficult') {
      roundsInput.value = (Math.floor(Math.random() * 4) + 1)
                        + (Math.floor(Math.random() * 4) + 1);
    }
  });

  // Resolution DC
  const dcLabel = document.createElement('label');
  dcLabel.classList.add('baph-task-builder-field-label');
  dcLabel.textContent = 'Resolution DC';
  modal.appendChild(dcLabel);

  const dcInput = document.createElement('input');
  dcInput.type  = 'number';
  dcInput.classList.add('baph-task-builder-input', 'baph-task-builder-input-num');
  dcInput.name  = 'dc';
  dcInput.min   = '1';
  dcInput.step  = '1';
  dcInput.value = '20';
  modal.appendChild(dcInput);

  // Button row
  const btnRow = document.createElement('div');
  btnRow.classList.add('baph-task-builder-btn-row');

  const approveBtn = document.createElement('button');
  approveBtn.type = 'button';
  approveBtn.classList.add('baph-task-builder-btn', 'baph-task-builder-btn-confirm');
  approveBtn.textContent = 'Approve';
  if (!validation.isActiveCombatant) {
    approveBtn.disabled = true;
    approveBtn.title = 'Cannot approve: this combatant is no longer the active turn.';
  }

  approveBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Re-validate at click time
    const combatant = game.combat?.combatants.get(payload.requestingCombatantId);
    if (!combatant) {
      ui.notifications?.warn?.('Combatant no longer exists — cannot approve.');
      _removeGMApprovalModal();
      _baphSignalNextGMRequest();
      return;
    }
    if (combatant.id !== game.combat?.combatant?.id) {
      ui.notifications?.warn?.('Combatant is no longer the active turn — cannot approve.');
      approveBtn.disabled = true;
      approveBtn.title = 'Cannot approve: turn has advanced.';
      return;
    }

    const roundsRaw = parseInt(roundsInput.value, 10);
    const dcRaw     = parseInt(dcInput.value, 10);
    if (!Number.isFinite(roundsRaw) || roundsRaw < 1) {
      ui.notifications?.warn?.('Rounds Required must be a positive integer.');
      roundsInput.focus();
      return;
    }
    if (!Number.isFinite(dcRaw) || dcRaw < 1) {
      ui.notifications?.warn?.('Resolution DC must be a positive integer.');
      dcInput.focus();
      return;
    }

    _removeGMApprovalModal();

    if (!game.baphometTasks) {
      ui.notifications?.warn?.('Task system not ready.');
      _baphSignalNextGMRequest();
      return;
    }

    // Use the player's description as the task name; initiateTask handles action spend,
    // flag writes, and chat message exactly as the GM task builder does.
    const taskId = await game.baphometTasks.initiateTask(combatant, {
      taskName:       payload.description ?? 'Skill Task',
      taskAction:     'disable',
      roundsRequired: roundsRaw,
      dc:             dcRaw,
    });

    game.socket.emit(`module.${AT_MODULE_ID}`, {
      action:  'baphTaskRequestResponse',
      payload: {
        requestId:    payload.requestId,
        approved:     taskId !== false,
        reason:       taskId !== false ? null : 'Task initiation failed.',
        taskId:       taskId !== false ? taskId : null,
        targetUserId: payload.requestingUserId,
      },
    });

    _debugLog(
      `GM approved task request ${payload.requestId}: ` +
      `taskId=${taskId}, combatant=${combatant.name}`
    );

    _baphSignalNextGMRequest();
    _renderActionPanel();
  });

  const rejectBtn = document.createElement('button');
  rejectBtn.type = 'button';
  rejectBtn.classList.add('baph-task-builder-btn', 'baph-task-builder-btn-cancel');
  rejectBtn.textContent = 'Reject';

  rejectBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    _removeGMApprovalModal();

    // Whisper rejection notice to the requesting player
    const requestingUser = game.users.get(payload.requestingUserId);
    const skillLabel = _getSkillLabel(payload.skillId);
    await ChatMessage.create({
      content:
        `<p><strong>Task Request Declined.</strong></p>` +
        `<p>Your <em>${skillLabel}</em> task request was declined by the GM. ` +
        `Try a different approach or wait for a better moment.</p>`,
      speaker: { alias: 'Baphomet Tasks' },
      whisper: requestingUser ? [requestingUser.id] : [],
    });

    game.socket.emit(`module.${AT_MODULE_ID}`, {
      action:  'baphTaskRequestResponse',
      payload: {
        requestId:    payload.requestId,
        approved:     false,
        reason:       'GM declined',
        taskId:       null,
        targetUserId: payload.requestingUserId,
      },
    });

    _debugLog(`GM rejected task request ${payload.requestId}`);
    _baphSignalNextGMRequest();
  });

  btnRow.appendChild(approveBtn);
  btnRow.appendChild(rejectBtn);
  modal.appendChild(btnRow);

  document.body.appendChild(modal);
}

/**
 * Handle a baphTaskRequestResponse on the requesting player's client.
 * Clears the pending timer, closes the overlay, and notifies the player.
 * Called from the task-tracker.js socket handler.
 */
function _baphHandleRequestResponse(payload) {
  const { requestId, approved, reason, targetUserId } = payload;

  // Only the targeted user processes this response
  if (targetUserId && targetUserId !== game.user.id) return;

  // Ensure this matches the currently pending request
  if (requestId !== _baphActiveRequestId) {
    _debugLog(`baphTaskRequestResponse: requestId mismatch — ignoring (got ${requestId})`);
    return;
  }

  _clearPendingRequest();
  _removeRequestTaskOverlay();

  if (approved) {
    ui.notifications?.info?.(
      'GM approved — your task has begun. Check the task widget for progress.'
    );
    _debugLog(`Task request ${requestId} approved`);
  } else {
    ui.notifications?.warn?.(
      `GM declined: ${reason ?? 'no reason given'}.`
    );
    _debugLog(`Task request ${requestId} rejected: ${reason}`);
  }

  _renderActionPanel();
}

/**
 * Signal that the GM approval modal was closed (approve or reject).
 * Calls _baphProcessNextGMRequest in task-tracker.js if available.
 * Guard: noop if called before task-tracker.js has loaded.
 */
function _baphSignalNextGMRequest() {
  if (typeof _baphProcessNextGMRequest === 'function') {
    _baphProcessNextGMRequest();
  }
}

/* ============================================================
   PF1.5 STRIKE GUARD DIAGNOSTICS — v1.17
   ══════════════════════════════════════════════════════════

   Observer-only diagnostics. NOTHING HERE changes gameplay.
   No pips are spent, no controls are hidden, no actions cancelled.

   Purpose: confirm PF1 full-attack UI selectors and ActionUse
   payload shape before implementing full-attack suppression in
   v2.14.0. All output is gated behind the debugLogging setting.

   Four surfaces:
     1. renderActorSheetPFCharacter — actor sheet attack controls
     2. pf1RenderQuickActions       — token HUD quick-action controls
     3. renderApplication /         — AttackDialog (V1 or V2)
        renderApplicationV2
     4. pf1PreActionUse             — ActionUse payload shape
   ============================================================ */

/* ----------------------------------------------------------
   SHARED DIAGNOSTIC HELPER
   Summarises one interactive element into a compact object.
   Never throws. Never reads .data or deprecated PF1 paths.
   ---------------------------------------------------------- */

function _diagSummariseElement(el) {
  const s = {};
  try { s.tag          = el.tagName?.toLowerCase() ?? null; } catch { s.tag = null; }
  try { s.text         = el.textContent?.trim().slice(0, 80) ?? null; } catch { s.text = null; }
  try { s.className    = el.className ?? null; } catch { s.className = null; }
  try { s.name         = el.name ?? null; } catch { s.name = null; }
  try { s.type         = el.type ?? null; } catch { s.type = null; }
  try { s.value        = el.value ?? null; } catch { s.value = null; }
  try { s.title        = el.title ?? null; } catch { s.title = null; }
  try { s.ariaLabel    = el.getAttribute?.('aria-label') ?? null; } catch { s.ariaLabel = null; }
  // dataset: copy to plain object; skip any key whose value is huge
  try {
    const ds = {};
    for (const [k, v] of Object.entries(el.dataset ?? {})) {
      ds[k] = String(v).slice(0, 120);
    }
    s.dataset = ds;
  } catch { s.dataset = null; }
  return s;
}

/**
 * Test whether an element summary is likely related to attacks or
 * full-attack controls. Used to highlight candidates in log output.
 */
function _diagIsAttackCandidate(summary) {
  const TERMS = ['attack', 'full', 'fullattack', 'iterative', 'multiple', 'swing'];
  const fields = [
    summary.text,
    summary.className,
    summary.name,
    summary.title,
    summary.ariaLabel,
    summary.value,
    ...Object.values(summary.dataset ?? {})
  ];
  return fields.some(f =>
    typeof f === 'string' &&
    TERMS.some(t => f.toLowerCase().includes(t))
  );
}

/**
 * Summarise all interactive elements inside a root node.
 * Queries: button, a, input, select, [data-action], [data-tooltip].
 * Returns { all, candidates } where candidates are attack-related.
 *
 * root must support querySelectorAll (HTMLElement or DocumentFragment).
 */
function _diagScanElements(root) {
  const all = [];
  const candidates = [];
  try {
    const els = root.querySelectorAll(
      'button, a, input, select, [data-action], [data-tooltip]'
    );
    for (const el of els) {
      const s = _diagSummariseElement(el);
      all.push(s);
      if (_diagIsAttackCandidate(s)) candidates.push(s);
    }
  } catch { /* noop */ }
  return { all, candidates };
}

/**
 * Normalise a diagnostic hook's root argument to HTMLElement or
 * DocumentFragment. Accepts: HTMLElement, DocumentFragment, jQuery
 * wrapper, or an array-like wrapper whose [0] is one of those.
 *
 * jQuery is guarded with globalThis.jQuery before instanceof so
 * the code does not throw in environments without jQuery.
 *
 * Returns null if none of the known shapes match.
 *
 * @param {*} input
 * @returns {HTMLElement|DocumentFragment|null}
 */
function _diagNormalizeRoot(input) {
  if (!input) return null;
  // Direct HTMLElement or DocumentFragment
  if (input instanceof HTMLElement || input instanceof DocumentFragment) return input;
  // jQuery wrapper
  if (globalThis.jQuery && input instanceof globalThis.jQuery) {
    const el = input[0];
    return (el instanceof HTMLElement || el instanceof DocumentFragment) ? el : null;
  }
  // Generic array-like wrapper (e.g. V1 compat shims)
  const first = input?.[0];
  if (first instanceof HTMLElement || first instanceof DocumentFragment) return first;
  return null;
}

/**
 * Safely stringify a diagnostic summary to a compact, copy-friendly
 * JSON string. Since all diagnostic summaries are already plain
 * objects with no circular refs, JSON.stringify is sufficient, but
 * the try/catch ensures nothing throws if that assumption is wrong.
 *
 * @param {*} value
 * @returns {string}
 */
function _diagStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return `[unstringifiable diagnostic summary: ${err?.message ?? String(err)}]`;
  }
}

/* ----------------------------------------------------------
   DIAGNOSTIC 1 — renderActorSheetPFCharacter

   PF1 actor sheets are ApplicationV2. element is documented as
   HTMLElement but live testing showed a wrapper being passed.
   _diagNormalizeRoot handles HTMLElement, DocumentFragment,
   jQuery wrapper, and generic array-like wrappers.

   Goal: identify which button/element represents the full-attack
   control on a weapon row, so v2.14.0 can hide it safely.

   Does NOT modify the sheet DOM.
   ---------------------------------------------------------- */

Hooks.on('renderActorSheetPFCharacter', (sheet, element, context) => {
  if (!game.settings.get?.(AT_MODULE_ID, 'debugLogging')) return;

  const rawConstructor = element?.constructor?.name ?? 'unknown';
  const root = _diagNormalizeRoot(element);
  if (!root) {
    _debugLog(
      '[DIAG] renderActorSheetPFCharacter: could not normalize element to HTMLElement/DocumentFragment',
      { rawConstructor, element }
    );
    return;
  }

  const actor = sheet?.actor;
  const { all, candidates } = _diagScanElements(root);

  const summary = {
    actorName:           actor?.name ?? null,
    actorType:           actor?.type ?? null,
    sheetConstructor:    sheet?.constructor?.name ?? null,
    rawElementConstructor: rawConstructor,
    normalizedConstructor: root?.constructor?.name ?? null,
    totalInteractiveElements: all.length,
    attackCandidates:    candidates,
    allElements:         all
  };

  _debugLog('[DIAG] renderActorSheetPFCharacter controls:', summary);
  _debugLog('[DIAG] renderActorSheetPFCharacter controls JSON:', _diagStringify(summary));
});

/* ----------------------------------------------------------
   DIAGNOSTIC 2 — pf1RenderQuickActions

   Confirmed hook: pf1RenderQuickActions(hud, token, template)
   template is a DocumentFragment. DocumentFragment supports
   querySelectorAll directly — no coercion needed.

   Goal: confirm whether PF1 quick actions include a full-attack
   button distinct from the single-attack button.

   Does NOT modify the template.
   ---------------------------------------------------------- */

Hooks.on('pf1RenderQuickActions', (hud, token, template) => {
  if (!game.settings.get?.(AT_MODULE_ID, 'debugLogging')) return;

  const rawConstructor = template?.constructor?.name ?? 'unknown';
  const root = _diagNormalizeRoot(template);
  if (!root) {
    _debugLog('[DIAG] pf1RenderQuickActions: could not normalize template',
      { rawConstructor });
    return;
  }

  const { all, candidates } = _diagScanElements(root);

  const summary = {
    tokenName:            token?.name ?? token?.document?.name ?? null,
    actorName:            token?.actor?.name ?? null,
    rawTemplateConstructor: rawConstructor,
    normalizedConstructor:  root?.constructor?.name ?? null,
    totalElements:        all.length,
    attackCandidates:     candidates,
    allElements:          all
  };

  _debugLog('[DIAG] pf1RenderQuickActions controls:', summary);
  _debugLog('[DIAG] pf1RenderQuickActions controls JSON:', _diagStringify(summary));
});

/* ----------------------------------------------------------
   DIAGNOSTIC 3 — AttackDialog render

   AttackDialog's V1 vs. V2 status is unconfirmed. Three hooks
   registered to maximise capture chance:
     - renderApplicationV1 (generic V1 catch, filtered by name)
     - renderApplicationV2 (generic V2 catch, filtered by name)
     - renderAttackDialog  (targeted — fires if PF1 uses this
                           exact class name for the dialog)

   All three call _diagHandleAttackDialogRender which uses
   _diagNormalizeRoot (same coercion as other diagnostics).

   Does NOT modify the dialog.
   ---------------------------------------------------------- */

function _diagHandleAttackDialogRender(app, element) {
  const name = app?.constructor?.name ?? '';
  // Filter to only AttackDialog or anything 'Attack' in the name.
  // Intentionally broad since the exact class name is unconfirmed.
  if (!name.toLowerCase().includes('attack')) return;

  // Normalize root unconditionally — both suppression and diagnostics
  // need it, and suppression runs regardless of debugLogging state.
  const rawConstructor = element?.constructor?.name ?? 'unknown';
  const root = _diagNormalizeRoot(element);
  if (!root) {
    _debugLog('[DIAG] AttackDialog: could not normalize element',
      { appConstructor: name, rawElementConstructor: rawConstructor });
    return;
  }

  /* ----------------------------------------------------------
     PF1.5 FULL ATTACK SUPPRESSION
     MODULE DESIGN PATTERN — NOT NATIVE PF1

     Confirmed selector from v2.13.5 live diagnostics:
       button[name="attack_full"]   -> Full Attack button (remove only
                                      when attack_single is also present)
       button[name="attack_single"] -> Single Attack button (leave)

     PF1 reuses name="attack_full" for the generic "Use" submit
     button on non-attack spell/action dialogs. Save/template spells
     such as Fireball and Burning Hands need that button to create
     their normal chat card, so never remove attack_full by itself.

     Runs whenever pf15ModeEnabled is true, independent of
     debug logging. Fails silently if the setting is not yet
     registered or the button is not present.
     ---------------------------------------------------------- */
  try {
    if (game.settings.get?.(AT_MODULE_ID, 'pf15ModeEnabled')) {
      const singleAttackBtn = root.querySelector('button[name="attack_single"]');
      const fullAttackBtn = root.querySelector('button[name="attack_full"]');
      if (singleAttackBtn && fullAttackBtn) {
        fullAttackBtn.remove();
        _debugLog('PF1.5 mode: removed Full Attack button from AttackDialog');
      }
    }
  } catch { /* settings not yet registered or other safe failure — noop */ }

  /* ----------------------------------------------------------
     v1.25: AoO (Combat Reflexes) checkbox in the Miscellaneous row.
     Injected only when the acting actor has the feat. Its state bridges
     to pf1PreActionUse via globalThis.baphometAoO so a flagged off-turn
     attack spends a green jade pip (see spendCombatReflex + the off-turn
     branch). Runs regardless of debugLogging, like the suppression above.
     ---------------------------------------------------------- */
  try {
    const aooActor = app.actor;
    const hasCR = !!aooActor?.items?.some(i => i.type === 'feat' && (i.name || '').toLowerCase().includes('combat reflexes'));
    const flagsGroup = root.querySelector('.form-group.stacked.flags');
    if (hasCR && flagsGroup && !flagsGroup.querySelector('.baph-aoo-cb')) {
      globalThis.baphometAoO = { active: false, actorId: aooActor.id };  // reset stale flag per dialog open
      const label = document.createElement('label');
      label.classList.add('checkbox');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.classList.add('baph-aoo-cb');
      cb.addEventListener('change', () => { globalThis.baphometAoO = { active: cb.checked, actorId: aooActor.id }; });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' AoO (Combat Reflexes)'));
      flagsGroup.appendChild(label);
    }
  } catch(err) { _debugLog('AoO checkbox injection failed', err); }

  /* ----------------------------------------------------------
     DIAGNOSTIC LOGGING — debug-gated
     ---------------------------------------------------------- */
  if (!game.settings.get?.(AT_MODULE_ID, 'debugLogging')) return;

  // Scan after suppression so the log reflects what the player sees.
  const { all, candidates } = _diagScanElements(root);

  const summary = {
    appConstructor:         name,
    rawElementConstructor:  rawConstructor,
    normalizedConstructor:  root?.constructor?.name ?? null,
    pf15ModeEnabled:        (() => { try { return game.settings.get?.(AT_MODULE_ID, 'pf15ModeEnabled') ?? null; } catch { return null; } })(),
    totalElements:          all.length,
    attackCandidates:       candidates,
    allElements:            all
  };

  _debugLog('[DIAG] AttackDialog controls:', summary);
  _debugLog('[DIAG] AttackDialog controls JSON:', _diagStringify(summary));
}

// V1-era application render hook (confirmed Foundry v13 hook name)
Hooks.on('renderApplicationV1', (app, html, data) => {
  _diagHandleAttackDialogRender(app, html);
});

// V2-era application render hook (confirmed Foundry v13 hook name)
Hooks.on('renderApplicationV2', (app, element, context) => {
  _diagHandleAttackDialogRender(app, element);
});

// Targeted hook — fires only if PF1 names the dialog 'AttackDialog'.
// The constructor-name filter inside _diagHandleAttackDialogRender
// still applies as a belt-and-suspenders guard.
// If this hook name is wrong it registers silently and never fires.
Hooks.on('renderAttackDialog', (app, element, context) => {
  _diagHandleAttackDialogRender(app, element);
});

/* ----------------------------------------------------------
   DIAGNOSTIC 4 — pf1PreActionUse payload

   Confirmed cancellable hook: pf1PreActionUse(actionUse)
   Argument is a single ActionUse instance.

   THIS HANDLER NEVER RETURNS FALSE. It is observer-only.
   Returning false would cancel the action — do not do that
   until full-attack suppression is deliberately implemented.

   Goal: log the shape of ActionUse to confirm:
   - actor access path
   - item access path
   - whether actionUse.isFullAttack / fullAttack / action.fullAttack exist
   - activation and rollMode fields
   - any field that could distinguish a single Strike from a full attack

   All probing uses safe optional chaining. No .data access.
   ---------------------------------------------------------- */

Hooks.on('pf1PreActionUse', (actionUse) => {
  if (!game.settings.get?.(AT_MODULE_ID, 'debugLogging')) return;

  // Build a structured summary without deep-traversing circular objects.
  const summary = {};

  try { summary.constructorName = actionUse?.constructor?.name ?? null; } catch { summary.constructorName = null; }

  // Own enumerable keys (shallow — avoids circular refs)
  try {
    summary.ownKeys = Object.keys(actionUse ?? {}).slice(0, 40);
  } catch { summary.ownKeys = ['[unavailable]']; }

  // Actor
  try {
    const a = actionUse?.actor;
    summary.actorName = a?.name ?? null;
    summary.actorId   = a?.id   ?? null;
    summary.actorType = a?.type ?? null;
  } catch { /* noop */ }

  // Item
  try {
    const i = actionUse?.item;
    summary.itemName = i?.name ?? null;
    summary.itemId   = i?.id   ?? null;
    summary.itemType = i?.type ?? null;
  } catch { /* noop */ }

  // Action (the specific ItemAction being used)
  try {
    const ac = actionUse?.action;
    summary.actionName        = ac?.name ?? null;
    summary.actionId          = ac?.id   ?? null;
    summary.actionConstructor = ac?.constructor?.name ?? null;
    // Shallow keys of the action object — do not expand sub-objects
    summary.actionKeys = ac ? Object.keys(ac).slice(0, 30) : null;
  } catch { summary.actionKeys = null; }

  // Possible full-attack / attack flags — probe common field names
  // without assuming any of them exist. Null = not present.
  try {
    summary.possibleFullAttackFlags = {
      'actionUse.isFullAttack':         actionUse?.isFullAttack          ?? null,
      'actionUse.fullAttack':           actionUse?.fullAttack            ?? null,
      'actionUse.action?.fullAttack':   actionUse?.action?.fullAttack    ?? null,
      'actionUse.action?.isFullAttack': actionUse?.action?.isFullAttack  ?? null,
      'actionUse.action?.type':         actionUse?.action?.type          ?? null,
      'actionUse.options?.fullAttack':  actionUse?.options?.fullAttack   ?? null,
      'actionUse.config?.fullAttack':   actionUse?.config?.fullAttack    ?? null
    };
  } catch { summary.possibleFullAttackFlags = null; }

  // Activation data — may carry action type / cost info
  try {
    const act = actionUse?.action?.activation ?? actionUse?.activation;
    summary.possibleActivationData = act
      ? {
          type:  act?.type  ?? null,
          cost:  act?.cost  ?? null,
          cond:  act?.cond  ?? null,
          keys: Object.keys(act).slice(0, 20)
        }
      : null;
  } catch { summary.possibleActivationData = null; }

  // Roll mode / shared data
  try {
    summary.possibleRollModeData = {
      'actionUse.rollMode':    actionUse?.rollMode    ?? null,
      'actionUse.options?.rollMode': actionUse?.options?.rollMode ?? null,
      'actionUse.shared':      actionUse?.shared ? '[present]' : null
    };
  } catch { summary.possibleRollModeData = null; }

  // Config / options keys
  try {
    summary.configKeys  = actionUse?.config  ? Object.keys(actionUse.config).slice(0, 20)  : null;
    summary.optionsKeys = actionUse?.options ? Object.keys(actionUse.options).slice(0, 20) : null;
  } catch { /* noop */ }

  _debugLog('[DIAG] pf1PreActionUse summary:', summary);
  _debugLog('[DIAG] pf1PreActionUse summary JSON:', _diagStringify(summary));

  // IMPORTANT: do NOT return false here.
  // Returning false would cancel the action use.
  // Full-attack suppression in v2.14.0 is implemented via the
  // AttackDialog render hook, not by cancelling pf1PreActionUse.
  // Do not add cancellation here without a deliberate decision.
});
