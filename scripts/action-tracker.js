/* ============================================================
   ECHOES OF BAPHOMET — PF1.5 ACTION TRACKER v1.0
   Visual 3-action + reaction economy tracker for Combat Tracker.

   DISPLAY:  ◆ ◆ ◆ | ◇ [◇]   (3 actions + 1 reaction [+ Combat Reflexes])
   LOCATION: Injected per-combatant in Combat Tracker sidebar
   BEHAVIOR: Manual click-to-spend. Auto-reset on turn advance.
             Reads Stunned/Slowed/Staggered/Paralyzed/Nauseated
             from baphomet-utils condition buffs to auto-spend pips.

   For Foundry VTT v13 + PF1e System
   Requires: baphomet-utils condition-overlay.js (for condition reading)
   Source:   HANDOFF-Action-Tracker-PF15.md
   ============================================================ */

const AT_MODULE_ID = 'baphomet-utils';

/* ----------------------------------------------------------
   STATE MANAGEMENT
   In-memory only. Resets on page reload. No DB writes.
   ---------------------------------------------------------- */

// Map<combatantId, { actions: [bool,bool,bool], reaction: [bool], combatReflex: bool, reflexPip: [bool], conditionLocked: number }>
// true = available, false = spent
const pipState = new Map();

function _initState(combatantId, hasCombatReflex) {
  pipState.set(combatantId, {
    actions: [true, true, true],
    reaction: [true],
    combatReflex: hasCombatReflex,
    reflexPip: hasCombatReflex ? [true] : [],
    conditionLocked: 0  // number of action pips locked by conditions
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
}

/* ----------------------------------------------------------
   CONDITION READING
   Reads baphomet-utils condition buffs from actor items.
   ---------------------------------------------------------- */

function _readConditionActionLoss(actor) {
  if (!actor) return { actionsLost: 0, fullyIncapacitated: false };

  let actionsLost = 0;
  let fullyIncapacitated = false;

  for (const item of actor.items) {
    if (item.type !== 'buff') continue;
    const flags = item.flags?.[AT_MODULE_ID];
    if (!flags?.conditionKey) continue;
    if (!item.system?.active) continue;

    const tier = flags.tier ?? 1;

    switch (flags.conditionKey) {
      case 'stunned':
        actionsLost += tier;
        break;
      case 'slowed':
        actionsLost += tier;
        break;
      case 'staggered':
        actionsLost = Math.max(actionsLost, 2);  // 1 action remains
        break;
      case 'nauseated':
        actionsLost = Math.max(actionsLost, 2);  // move only
        break;
      case 'paralyzed':
        fullyIncapacitated = true;
        break;
    }
  }

  return {
    actionsLost: Math.min(actionsLost, 3),
    fullyIncapacitated
  };
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
   Auto-spend pips at turn start based on conditions.
   ---------------------------------------------------------- */

function _applyConditionLocks(combatantId, actor) {
  const state = _getState(combatantId);
  if (!state) return;

  const { actionsLost, fullyIncapacitated } = _readConditionActionLoss(actor);

  if (fullyIncapacitated) {
    // Lock all action pips
    state.actions = [false, false, false];
    state.reaction = [false];
    if (state.combatReflex) state.reflexPip = [false];
    state.conditionLocked = 3;
    return;
  }

  // Lock leftmost action pips
  const toLock = Math.min(actionsLost, 3);
  for (let i = 0; i < toLock; i++) {
    state.actions[i] = false;
  }
  state.conditionLocked = toLock;
}

/* ----------------------------------------------------------
   UI: BUILD PIP ROW
   ---------------------------------------------------------- */

function _buildPipRow(combatantId, isOwner) {
  const state = _getState(combatantId);
  if (!state) return null;

  const row = document.createElement('div');
  row.classList.add('baph-action-tracker');
  row.dataset.combatantId = combatantId;

  // --- Action pips (3) ---
  state.actions.forEach((available, idx) => {
    const pip = document.createElement('div');
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
    }

    row.appendChild(pip);
  });

  // --- Separator ---
  const sep = document.createElement('div');
  sep.classList.add('baph-pip-separator');
  row.appendChild(sep);

  // --- Reaction pip ---
  state.reaction.forEach((available, idx) => {
    const pip = document.createElement('div');
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
    }

    row.appendChild(pip);
  });

  // --- Combat Reflexes pip ---
  if (state.combatReflex) {
    state.reflexPip.forEach((available, idx) => {
      const pip = document.createElement('div');
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
      }

      row.appendChild(pip);
    });
  }

  // Block event propagation on the entire row
  ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup'].forEach(evt => {
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
    // Don't allow toggling condition-locked pips back on
    if (index < state.conditionLocked && !state.actions[index]) return;
    state.actions[index] = !state.actions[index];
  } else if (type === 'reaction') {
    state.reaction[index] = !state.reaction[index];
  } else if (type === 'reflex') {
    state.reflexPip[index] = !state.reflexPip[index];
  }

  // Re-render just this combatant's pip row
  _refreshPipRow(combatantId);
}

function _refreshPipRow(combatantId) {
  const existing = document.querySelector(`.baph-action-tracker[data-combatant-id="${combatantId}"]`);
  if (!existing) return;

  const parent = existing.parentElement;
  const isOwner = existing.dataset.isOwner === 'true';

  const newRow = _buildPipRow(combatantId, isOwner);
  if (newRow) {
    newRow.dataset.isOwner = String(isOwner);
    parent.replaceChild(newRow, existing);
  }
}

/* ----------------------------------------------------------
   COMBAT TRACKER INJECTION
   Hook into renderCombatTracker to add pips to each row.
   ---------------------------------------------------------- */

Hooks.on('renderCombatTracker', (app, html, data) => {
  const combat = game.combat;
  if (!combat) return;

  // Normalize html to HTMLElement (v13 compat)
  const root = html instanceof HTMLElement ? html
    : html instanceof jQuery ? html[0]
    : html;

  if (!root) return;

  // Find all combatant entries in the tracker
  // v13 PF1e uses .combatant or [data-combatant-id] in the combat tracker list
  const combatantEntries = root.querySelectorAll('.combatant, [data-combatant-id]');

  combatantEntries.forEach(entry => {
    // Get combatant ID from the DOM
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

    // Check if Combat Reflexes changed (feat added/removed mid-combat)
    const state = _getState(combatantId);
    const currentHasCR = _hasCombatReflexes(combatant.actor);
    if (state.combatReflex !== currentHasCR) {
      state.combatReflex = currentHasCR;
      state.reflexPip = currentHasCR ? [true] : [];
    }

    // Remove any existing pip row (re-render)
    const oldRow = entry.querySelector('.baph-action-tracker');
    if (oldRow) oldRow.remove();

    // Permission check: GM can click any; players can click their own
    const isOwner = game.user.isGM || combatant.isOwner;

    const pipRow = _buildPipRow(combatantId, isOwner);
    if (pipRow) {
      pipRow.dataset.isOwner = String(isOwner);

      // Insert pip row into the combatant entry
      // Try to find the best insertion point — after the name/stats area
      const nameBlock = entry.querySelector('.token-name')
        ?? entry.querySelector('.combatant-name')
        ?? entry.querySelector('.token-resource');

      if (nameBlock) {
        // Insert after the name block
        nameBlock.after(pipRow);
      } else {
        // Fallback: append to end of combatant entry
        entry.appendChild(pipRow);
      }
    }
  });
});

/* ----------------------------------------------------------
   TURN ADVANCE: AUTO-RESET + CONDITION APPLICATION
   ---------------------------------------------------------- */

// PF1e-specific turn change hook
Hooks.on('pf1PostTurnChange', (combat, prior, current) => {
  if (!game.user.isGM) return;
  _handleTurnChange(combat, current.combatantId);
});

// Generic Foundry fallback
Hooks.on('combatTurn', (combat, updateData, updateOptions) => {
  if (Hooks.events['pf1PostTurnChange']?.length > 1) return;  // >1 because our hook counts
  if (!game.user.isGM) return;

  const currentTurn = combat.current?.turn ?? updateData.turn;
  if (currentTurn == null) return;

  const currentCombatant = combat.turns[currentTurn];
  if (currentCombatant) {
    _handleTurnChange(combat, currentCombatant.id);
  }
});

// Also handle round advance
Hooks.on('combatRound', (combat, updateData, updateOptions) => {
  if (!game.user.isGM) return;

  const currentTurn = combat.current?.turn ?? 0;
  const currentCombatant = combat.turns[currentTurn];
  if (currentCombatant) {
    _handleTurnChange(combat, currentCombatant.id);
  }
});

function _handleTurnChange(combat, activeCombatantId) {
  if (!activeCombatantId) return;

  const combatant = combat.combatants.get(activeCombatantId);
  if (!combatant?.actor) return;

  // Ensure state exists
  if (!_getState(activeCombatantId)) {
    _initState(activeCombatantId, _hasCombatReflexes(combatant.actor));
  }

  // Reset pips to full
  _resetState(activeCombatantId);

  // Apply condition locks
  _applyConditionLocks(activeCombatantId, combatant.actor);

  // Schedule UI refresh after Foundry finishes its own combat tracker re-render
  setTimeout(() => _refreshPipRow(activeCombatantId), 50);
}

/* ----------------------------------------------------------
   COMBAT LIFECYCLE: CLEANUP
   ---------------------------------------------------------- */

Hooks.on('deleteCombat', (combat) => {
  // Clear all state for this combat's combatants
  for (const c of combat.combatants) {
    pipState.delete(c.id);
  }
});

Hooks.on('deleteCombatant', (combatant) => {
  pipState.delete(combatant.id);
});

Hooks.on('createCombatant', (combatant) => {
  if (!combatant.actor) return;
  _initState(combatant.id, _hasCombatReflexes(combatant.actor));
});

/* ----------------------------------------------------------
   COMBAT START: INITIALIZE ALL COMBATANTS
   ---------------------------------------------------------- */

Hooks.on('combatStart', (combat) => {
  for (const combatant of combat.combatants) {
    if (!combatant.actor) continue;
    _initState(combatant.id, _hasCombatReflexes(combatant.actor));
  }

  // Apply condition locks for the first combatant
  const firstCombatant = combat.turns[0];
  if (firstCombatant?.actor) {
    _applyConditionLocks(firstCombatant.id, firstCombatant.actor);
  }
});

/* ----------------------------------------------------------
   MACRO API
   game.baphometActions.reset(combatantId)
   game.baphometActions.getState(combatantId)
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

  console.log(`${AT_MODULE_ID} | Action Tracker v1.0 ready`);
});