/* ============================================================
   ECHOES OF BAPHOMET — PF1.5 ACTION TRACKER v1.6
   Visual 3-action + reaction economy tracker for Combat Tracker.

   DISPLAY:  ◆ ◆ ◆ | ◇ [◇]   (3 actions + 1 reaction [+ Combat Reflexes])
   LOCATION: Injected BELOW combatant name row in Combat Tracker sidebar
   BEHAVIOR: Manual click-to-spend. Auto-reset on the START of the
             combatant's OWN next turn (reactions spent during other
             creatures' turns persist until this combatant acts again,
             per PF2-style reaction economy).
             Reads Stunned/Slowed/Staggered/Paralyzed/Nauseated from
             baphomet-utils condition buffs to auto-lock pips.

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

  console.log(`${AT_MODULE_ID} | Reset pips for ${combatant?.name ?? combatantId} (round ${round})`);
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
   _refreshPipRow — v1.5

   Rebuilds every pip row currently rendered for this combatant.
   Important when the Encounter Tracker is popped out: the same
   combatant is rendered TWICE (once in the sidebar tracker, once
   in the popout window), and both need to be replaced. State is
   already shared between the two — pipState is keyed on
   combatantId — so the fix is purely in the DOM write step.

   Re-derives isOwner from the live combatant each time, not from
   the old DOM's stale dataset (defends against an early-render
   isOwner=false perpetuation bug).
   ---------------------------------------------------------- */

function _refreshPipRow(combatantId) {
  const rows = document.querySelectorAll(`.baph-action-tracker[data-combatant-id="${combatantId}"]`);
  if (!rows.length) return;

  const combat = game.combat;
  const combatant = combat?.combatants.get(combatantId);

  rows.forEach(existing => {
    const parent = existing.parentElement;
    if (!parent) return;

    const isOwner = combatant
      ? (game.user.isGM || combatant.isOwner)
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

    const isOwner = game.user.isGM || combatant.isOwner;
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
      if (!state) return;
      for (let i = 0; i < 3 && count > 0; i++) {
        if (state.actions[i] && i >= state.conditionLocked) {
          state.actions[i] = false;
          count--;
        }
      }
      _refreshPipRow(combatantId);
    },
    spendReaction: (combatantId) => {
      const state = _getState(combatantId);
      if (!state) return;
      state.reaction[0] = false;
      _refreshPipRow(combatantId);
    }
  };

  console.log(`${AT_MODULE_ID} | Action Tracker v1.6 ready`);
});
