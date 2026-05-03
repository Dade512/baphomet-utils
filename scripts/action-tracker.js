/* ============================================================
   ECHOES OF BAPHOMET — PF1.5 ACTION TRACKER v1.12
   Visual 3-action + reaction economy tracker for Combat Tracker.

   DISPLAY:  ◆ ◆ ◆ | ◇ [◇]   (3 actions + 1 reaction [+ Combat Reflexes])
   LOCATION: Injected BELOW combatant name row in Combat Tracker sidebar
   BEHAVIOR: Manual click-to-spend. Auto-reset on the START of the
             combatant's OWN next turn (reactions spent during other
             creatures' turns persist until this combatant acts again,
             per PF2-style reaction economy).
             Reads Stunned/Slowed/Staggered/Paralyzed/Nauseated from
             baphomet-utils condition buffs to auto-lock pips.

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

function _initState(combatantId, hasCombatReflex) {
  pipState.set(combatantId, {
    actions: [true, true, true],
    reaction: [true],
    combatReflex: hasCombatReflex,
    reflexPip: hasCombatReflex ? [true] : [],
    conditionLocked: 0,
    _resetForRound: null
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
  if (state.combatReflex) state.reflexPip = [true];
  state.conditionLocked = 0;
  // _resetForRound is metadata, not pip state — DO NOT touch it here.
  // It's owned by the render-based reset logic.
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

   Actual rule: Staggered/Nauseated block to 2 actions lost
   (1 action remaining). Stunned/Slowed add on top of that.
   Combined: actionsLost = max(baseBlock, additive), capped at 3.
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
    if (state.combatReflex) state.reflexPip = [false];
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

  // Reset pip availability + apply fresh condition locks.
  state.actions = [true, true, true];
  state.reaction = [true];
  if (state.combatReflex) state.reflexPip = [true];
  state.conditionLocked = 0;

  if (combatant?.actor) {
    _applyConditionLocks(combatantId, combatant.actor);
  }

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

    row.appendChild(pip);
  });

  // --- Separator ---
  const sep = document.createElement('div');
  sep.classList.add('baph-pip-separator');
  row.appendChild(sep);

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

    row.appendChild(pip);
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

      row.appendChild(pip);
    });
  }

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
      _initState(combatantId, _hasCombatReflexes(combatant.actor));
    }

    // Sync Combat Reflexes if feat changed mid-combat
    const state = _getState(combatantId);
    const currentHasCR = _hasCombatReflexes(combatant.actor);
    if (state.combatReflex !== currentHasCR) {
      state.combatReflex = currentHasCR;
      state.reflexPip = currentHasCR ? [true] : [];
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
    _initState(combatant.id, _hasCombatReflexes(combatant.actor));
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
        combatReflexAvailable: state.combatReflex ? state.reflexPip[0] : null,
        conditionLocked: state.conditionLocked
      };
    },
    reset: (combatantId) => {
      _resetState(combatantId);
      _refreshPipRow(combatantId);
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
      return spent > 0;
    },
    spendReaction: (combatantId) => {
      const state = _getState(combatantId);
      if (!state || !state.reaction[0]) return false;
      state.reaction[0] = false;
      _refreshPipRow(combatantId);
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

/**
 * Spend N action pips for the combatant whose actor matches the
 * provided actor reference.
 *
 * Convenience wrapper combining:
 *   _getActiveCombatantForActor → _canUserControlCombatant
 *   → _spendActionForCombatant
 *
 * This is the intended entry point for pf1AttackRoll and
 * pf1ActorRollSkill hooks in v2.10.0. Call with the actor
 * from the hook payload and an appropriate reason string.
 *
 * Returns false without throwing if: no combat is active,
 * no combatant matches the actor, the current user doesn't
 * control the combatant, or no pips are available.
 *
 * @param {Actor} actor
 * @param {number} [count=1]  Number of action pips to spend
 * @param {string} [reason]   Debug label
 * @returns {boolean}
 */
function _spendActionForActor(actor, count = 1, reason = '') {
  const combatant = _getActiveCombatantForActor(actor);
  if (!combatant) {
    _debugLog(`_spendActionForActor: no active combatant for actor "${actor?.name}" [${reason}]`);
    return false;
  }

  if (!_canUserControlCombatant(combatant)) {
    _debugLog(`_spendActionForActor: user cannot control combatant ${combatant.id} [${reason}]`);
    return false;
  }

  return _spendActionForCombatant(combatant.id, count, reason);
}

/* ----------------------------------------------------------
   SKILL ACTION COSTS
   
   Confirmed PF1 key strings from v2.10.x diagnostic testing.
   Signature: pf1ActorRollSkill(actor, chatMessage, skillKey)
   
   Key  →  Skill Name            →  Action cost
   acr  →  Acrobatics            →  1
   blf  →  Bluff                 →  1
   int  →  Intimidate            →  1
   ste  →  Stealth               →  1
   hea  →  Heal                  →  1
   umd  →  Use Magic Device      →  1
   dev  →  Disable Device        →  3  (all-or-nothing)
   slt  →  Sleight of Hand       →  1
   kar  →  Knowledge (Arcana)    →  1
   kre  →  Knowledge (Religion)  →  1
   kna  →  Knowledge (Nature)    →  1
   klo  →  Knowledge (Local)     →  1
   
   Excluded:
   per  →  Perception — passive/reactive sense; excluded
           intentionally from action economy tracking.
   
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
  dev: 3,  // 3-action cost — all-or-nothing enforced by _spendActionForCombatant
  slt: 1,
  kar: 1,
  kre: 1,
  kna: 1,
  klo: 1   // Knowledge Local — confirmed live v2.11.0
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
 * Register debug-gated diagnostic listeners for pf1AttackRoll
 * and pf1ActorRollSkill. Idempotent via _baphActionDiagnosticsRegistered.
 *
 * Called once from the diagnostics ready hook below.
 */
function _registerActionAutomationDiagnostics() {
  if (_baphActionDiagnosticsRegistered) return;
  _baphActionDiagnosticsRegistered = true;

  // pf1AttackRoll: diagnostic-only. Logs raw args and shallow summary.
  // Does not spend pips. Dedupe behavior not yet designed.
  Hooks.on('pf1AttackRoll', (...args) => {
    _debugLog('[DIAG] pf1AttackRoll raw args:', ...args);
    _debugLog('[DIAG] pf1AttackRoll arg summary:', _summarizeHookArgs(args));
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

   All-or-nothing: a skill with cost 3 (Disable Device) will
   spend nothing if fewer than 3 pips are available.

   Gated behind 'autoSkillSpend' world setting (default OFF).
   Only fires for the current active combatant on the user's
   controlled token. Non-active actors are silently ignored.

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

  // All gates passed. _spendActionForCombatant enforces all-or-nothing:
  // if cost is 3 (Disable Device) and fewer than 3 pips are available,
  // it returns false without spending anything.
  _debugLog(`skill auto-spend: attempting spend — ${actor.name} / ${skillKey} / cost ${cost}`);
  const spent = _spendActionForCombatant(combatant.id, cost, `skill-${skillKey}`);

  if (!spent) {
    // _spendActionForCombatant already logged the reason (insufficient actions
    // or API not ready).
    return;
  }

  _debugLog(`skill auto-spend: success — spent ${cost} action(s) for ${actor.name} [${skillKey}]`);
});
