/* ============================================================
   ECHOES OF BAPHOMET — MULTI-ROUND TASK TRACKER v1.0
   v2.16.0 — Multi-Round Task Scaffold

   Exposes: game.baphometTasks
   Depends on: action-tracker.js (must load first, per module.json)
   Uses globals from action-tracker.js:
     _spendActionForCombatant(combatantId, count, reason) → boolean
     _debugLog(msg, ...args) — gated on debugLogging setting

   Storage model:
     Public task state  → combatant.actor flags       (player-visible)
     Hidden task data   → game.user flags (GM only)   (never exposed)

   Hidden data policy:
     roundsRequired and metadataHidden are stored only on the GM user
     who creates the task (game.user at creation time). This is acceptable
     for the current single-GM campaign workflow. No multi-GM authority
     election or hidden-data migration is implemented in v2.16.0.
     If a different GM user later needs to resolve a hidden task, that
     is future work and should be designed deliberately.

     readyToResolve is ONLY set by the GM client that can read hidden
     data (game.user.isGM and the hiddenData entry exists). Non-GM
     clients and GM clients missing hidden data must NOT guess
     completion state. If hidden data is absent at commit time,
     readyToResolve is left false and a debug warning is logged.

   In-memory cache:
     Map<combatantId, Record<taskId, PublicTaskObject>>
     Rebuilt on pf1PostReady. Updated on every own API write.
     No updateActor listener in v2.16.0 (deferred to v2.17.1 when
     the Continue Task button enables player-client writes).

   API entry point: game.baphometTasks
   All public methods accept Combatant objects as the first argument.
   Defensive string-ID fallback is available internally only.

   v2.16.0 scope — this file does NOT implement:
     - Continue Task UI or button
     - Task progress widget
     - Disable Device integration (dev warning in action-tracker unchanged)
     - pf1PreActionUse suppression
     - actor.rollSkill() invocation or final task resolution
     - resolveTask logic (stubbed — logs only)
     - updateActor cache listener
     - MAP, swing, Full Attack, or action panel changes
     - skill auto-spend changes
     - condition math changes
     - ESM migration
     - PF1 prototype patches
     - pf1.config mutation

   For Foundry VTT v13 + PF1e System
   Requires: baphomet-utils action-tracker.js (loaded before this file)
   ============================================================ */

/* ----------------------------------------------------------
   MODULE CONSTANTS
   Prefixed BAPH_TASK_ to avoid global collision with other files.
   ---------------------------------------------------------- */

const BAPH_TASK_MODULE_ID    = 'baphomet-utils';
const BAPH_TASK_FLAG_PUBLIC  = 'tasks';          // actor flag key
const BAPH_TASK_FLAG_HIDDEN  = 'hiddenTaskData'; // GM user flag key

/* ----------------------------------------------------------
   IN-MEMORY CACHE

   Map<combatantId: string, Record<taskId: string, PublicTaskObject>>

   Contains only PublicTaskObject data. Hidden data is never cached —
   always read fresh from game.user flags at call time to avoid
   serving stale hidden data if the GM user document updates.

   Rebuilt on pf1PostReady. Updated after every own API write.
   Cleared on deleteCombat.
   ---------------------------------------------------------- */

const _baphTaskCache = new Map();

/* ============================================================
   INTERNAL HELPERS
   All prefixed _baphTask to avoid global scope collision.
   ============================================================ */

/* ----------------------------------------------------------
   _baphTaskDebugLog
   Wrapper around the global _debugLog from action-tracker.js.
   Prefixes messages with the task-tracker context label.
   Defensive: no-ops safely if _debugLog is somehow unavailable
   (e.g. action-tracker.js load failure).
   ---------------------------------------------------------- */

function _baphTaskDebugLog(msg, ...args) {
  try {
    _debugLog(`[task] ${msg}`, ...args);
  } catch {
    // _debugLog unavailable — noop. Do not throw from logging.
  }
}

/* ----------------------------------------------------------
   _baphTaskResolveCombatant
   Accept a Combatant object (documented API) or an ID string
   (internal fallback for macro convenience only).
   ---------------------------------------------------------- */

function _baphTaskResolveCombatant(combatantOrId) {
  if (!combatantOrId) return null;
  if (typeof combatantOrId === 'string') {
    return game.combat?.combatants.get(combatantOrId) ?? null;
  }
  return combatantOrId;
}

/* ----------------------------------------------------------
   _baphTaskCanControl
   Returns true if the current user can control a combatant's
   action pips. Mirrors _canUserControlCombatant from
   action-tracker.js exactly so the same ownership gate applies.
   ---------------------------------------------------------- */

function _baphTaskCanControl(combatant) {
  if (!combatant) return false;
  return (
    game.user.isGM            ||
    combatant.isOwner          ||
    combatant.actor?.isOwner   ||
    combatant.token?.isOwner
  );
}

/* ----------------------------------------------------------
   Actor flag I/O
   Deep-clone reads so callers mutate freely.
   ---------------------------------------------------------- */

function _baphTaskReadActorTasks(actor) {
  return foundry.utils.deepClone(
    actor.getFlag(BAPH_TASK_MODULE_ID, BAPH_TASK_FLAG_PUBLIC) ?? {}
  );
}

async function _baphTaskWriteActorTasks(actor, tasks) {
  await actor.setFlag(BAPH_TASK_MODULE_ID, BAPH_TASK_FLAG_PUBLIC, tasks);
}

/* ----------------------------------------------------------
   GM user flag I/O
   Returns {} for non-GM clients — intentional. Any code path
   that needs roundsRequired must verify game.user.isGM before
   calling _baphTaskReadHiddenAll.
   ---------------------------------------------------------- */

function _baphTaskReadHiddenAll() {
  if (!game.user.isGM) return {};
  return foundry.utils.deepClone(
    game.user.getFlag(BAPH_TASK_MODULE_ID, BAPH_TASK_FLAG_HIDDEN) ?? {}
  );
}

async function _baphTaskWriteHiddenAll(data) {
  if (!game.user.isGM) {
    console.error(
      `${BAPH_TASK_MODULE_ID} | task-tracker: _baphTaskWriteHiddenAll called by non-GM — aborting`
    );
    return;
  }
  await game.user.setFlag(BAPH_TASK_MODULE_ID, BAPH_TASK_FLAG_HIDDEN, data);
}

/* ----------------------------------------------------------
   _baphTaskSanitize
   Strip all hidden fields before returning data to non-GM clients.
   roundsRequired and metadataHidden are absent from the result.
   readyToResolve is included — it is set only by the GM client
   and is safe to expose as a boolean.
   ---------------------------------------------------------- */

function _baphTaskSanitize(task) {
  return {
    taskId:               task.taskId,
    skillKey:             task.skillKey,
    taskType:             task.taskType,
    taskName:             task.taskName,
    roundsCommitted:      task.roundsCommitted,
    startedRound:         task.startedRound,
    lastCommittedRound:   task.lastCommittedRound,
    status:               task.status,
    pausedReason:         task.pausedReason,
    readyToResolve:       task.readyToResolve,
    createdByUserId:      task.createdByUserId,
    hiddenDataOwnerUserId: task.hiddenDataOwnerUserId,
    metadataPublic:       task.metadataPublic,
  };
}

/* ----------------------------------------------------------
   Cache helpers
   ---------------------------------------------------------- */

function _baphTaskUpdateCache(combatantId, tasks) {
  _baphTaskCache.set(combatantId, foundry.utils.deepClone(tasks));
}

function _baphTaskGetCachedOrLive(combatant) {
  if (_baphTaskCache.has(combatant.id)) {
    return foundry.utils.deepClone(_baphTaskCache.get(combatant.id));
  }
  return _baphTaskReadActorTasks(combatant.actor);
}

/**
 * Rebuild the in-memory cache from actor flags for all combatants
 * in the current combat. Called once on pf1PostReady.
 */
function _baphTaskRebuildCache() {
  _baphTaskCache.clear();
  const combat = game.combat;
  if (!combat) {
    _baphTaskDebugLog('cache rebuild: no active combat — cache empty');
    return;
  }
  for (const combatant of combat.combatants) {
    if (!combatant.actor) continue;
    const tasks = combatant.actor.getFlag(BAPH_TASK_MODULE_ID, BAPH_TASK_FLAG_PUBLIC) ?? {};
    _baphTaskCache.set(combatant.id, tasks);
  }
  _baphTaskDebugLog(
    `cache rebuilt — ${_baphTaskCache.size} combatant(s) indexed`
  );
  console.log(
    `${BAPH_TASK_MODULE_ID} | task-tracker: cache rebuilt — ` +
    `${_baphTaskCache.size} combatant(s) indexed`
  );
}

/* ============================================================
   PUBLIC API IMPLEMENTATIONS
   Exposed via game.baphometTasks on pf1PostReady.
   ============================================================ */

/* ----------------------------------------------------------
   createTask(combatant, options)

   Create a new multi-round task on a combatant's actor.
   GM only. roundsRequired and metadataHidden go to GM user flags.
   All player-visible fields go to actor flags.

   Hidden data is stored on the GM user who calls createTask.
   In a single-GM campaign this is always the same user.
   Multi-GM scenarios are not handled in v2.16.0.

   @param {Combatant|string} combatant
   @param {object}  options
   @param {string}  [options.skillKey='unknown']   PF1 skill key
   @param {string}  [options.taskType='generic']   Task type label
   @param {string}  [options.taskName='Task']       Human-readable name
   @param {number}  options.roundsRequired          Positive integer, hidden
   @param {object}  [options.metadataPublic={}]     Player-safe notes
   @param {object}  [options.metadataHidden={}]     GM-only notes / DCs
   @returns {string|false}  taskId on success, false on any failure
   ---------------------------------------------------------- */

async function _baphTaskCreate(combatantOrId, options = {}) {
  if (!game.user.isGM) {
    _baphTaskDebugLog('createTask rejected: GM only');
    ui.notifications.warn('Baphomet Tasks: only the GM can create tasks.');
    return false;
  }

  const combatant = _baphTaskResolveCombatant(combatantOrId);
  if (!combatant) {
    _baphTaskDebugLog('createTask rejected: could not resolve combatant');
    console.error(`${BAPH_TASK_MODULE_ID} | createTask: invalid combatant`);
    return false;
  }
  if (!combatant.actor) {
    _baphTaskDebugLog(`createTask rejected: combatant "${combatant.name}" has no actor`);
    console.error(`${BAPH_TASK_MODULE_ID} | createTask: combatant "${combatant.name}" has no actor`);
    return false;
  }

  const {
    skillKey        = 'unknown',
    taskType        = 'generic',
    taskName        = 'Task',
    roundsRequired,
    metadataPublic  = {},
    metadataHidden  = {},
  } = options;

  if (
    typeof roundsRequired !== 'number' ||
    !Number.isInteger(roundsRequired)  ||
    roundsRequired < 1
  ) {
    _baphTaskDebugLog(
      `createTask rejected: roundsRequired must be a positive integer ` +
      `(received ${JSON.stringify(roundsRequired)})`
    );
    console.error(
      `${BAPH_TASK_MODULE_ID} | createTask: roundsRequired must be a positive integer ` +
      `(received ${JSON.stringify(roundsRequired)})`
    );
    return false;
  }

  // Stable, human-readable task ID.
  const taskId     = `${combatant.id}-${skillKey}-${Date.now()}`;
  const startRound = game.combat?.round ?? 0;

  // ── Public task state (actor flags — player-visible) ─────────────
  const publicTask = {
    taskId,
    skillKey,
    taskType,
    taskName,
    roundsCommitted:       0,
    startedRound:          startRound,
    lastCommittedRound:    null,
    status:                'active',
    pausedReason:          null,
    readyToResolve:        false,
    createdByUserId:       game.user.id,
    hiddenDataOwnerUserId: game.user.id,
    metadataPublic,
  };

  const actorTasks = _baphTaskReadActorTasks(combatant.actor);
  actorTasks[taskId] = publicTask;
  await _baphTaskWriteActorTasks(combatant.actor, actorTasks);

  // ── Hidden task data (GM user flags — never on actor flags) ──────
  // roundsRequired and metadataHidden are strictly private.
  const hiddenAll = _baphTaskReadHiddenAll();
  hiddenAll[taskId] = { taskId, roundsRequired, metadataHidden };
  await _baphTaskWriteHiddenAll(hiddenAll);

  // ── Cache ──────────────────────────────────────────────────────────
  _baphTaskUpdateCache(combatant.id, actorTasks);

  _baphTaskDebugLog(
    `createTask: created "${taskName}" (${taskId}) on ${combatant.actor.name}, ` +
    `requires ${roundsRequired} round(s), hiddenDataOwner=${game.user.id}`
  );
  console.log(
    `${BAPH_TASK_MODULE_ID} | task-tracker: created task "${taskName}" ` +
    `(${taskId}) on ${combatant.actor.name}`
  );
  return taskId;
}

/* ----------------------------------------------------------
   getTask(combatant, taskId)

   GM clients receive the full merged object (public + hidden).
   Non-GM clients receive a sanitized public-only object.
   Returns null if the task does not exist.

   @param {Combatant|string} combatant
   @param {string}           taskId
   @returns {object|null}
   ---------------------------------------------------------- */

function _baphTaskGet(combatantOrId, taskId) {
  const combatant = _baphTaskResolveCombatant(combatantOrId);
  if (!combatant?.actor) {
    _baphTaskDebugLog(`getTask: invalid combatant (id=${combatantOrId})`);
    return null;
  }

  const tasks = _baphTaskGetCachedOrLive(combatant);
  const task  = tasks[taskId] ?? null;
  if (!task) {
    _baphTaskDebugLog(`getTask: task "${taskId}" not found on ${combatant.actor.name}`);
    return null;
  }

  if (game.user.isGM) {
    const hiddenAll = _baphTaskReadHiddenAll();
    const hidden    = hiddenAll[taskId] ?? {};
    _baphTaskDebugLog(`getTask: returning full merged object for GM (task: ${taskId})`);
    return foundry.utils.mergeObject(
      foundry.utils.deepClone(task),
      {
        roundsRequired: hidden.roundsRequired ?? null,
        metadataHidden: hidden.metadataHidden ?? {},
      }
    );
  }

  _baphTaskDebugLog(`getTask: returning sanitized object for non-GM (task: ${taskId})`);
  return _baphTaskSanitize(task);
}

/* ----------------------------------------------------------
   getTasks(combatant)

   Return all tasks for a combatant's actor as a keyed object.
   Same GM vs. non-GM sanitization as getTask.
   Returns {} if the actor has no tasks.

   @param {Combatant|string} combatant
   @returns {Record<string, object>}
   ---------------------------------------------------------- */

function _baphTaskGetAll(combatantOrId) {
  const combatant = _baphTaskResolveCombatant(combatantOrId);
  if (!combatant?.actor) {
    _baphTaskDebugLog(`getTasks: invalid combatant (id=${combatantOrId})`);
    return {};
  }

  const tasks = _baphTaskGetCachedOrLive(combatant);

  if (game.user.isGM) {
    const hiddenAll = _baphTaskReadHiddenAll();
    const result    = {};
    for (const [id, task] of Object.entries(tasks)) {
      const hidden = hiddenAll[id] ?? {};
      result[id] = foundry.utils.mergeObject(
        foundry.utils.deepClone(task),
        {
          roundsRequired: hidden.roundsRequired ?? null,
          metadataHidden: hidden.metadataHidden ?? {},
        }
      );
    }
    _baphTaskDebugLog(`getTasks: ${Object.keys(result).length} task(s) for ${combatant.actor.name} (GM view)`);
    return result;
  }

  const result = {};
  for (const [id, task] of Object.entries(tasks)) {
    result[id] = _baphTaskSanitize(task);
  }
  _baphTaskDebugLog(`getTasks: ${Object.keys(result).length} task(s) for ${combatant.actor.name} (player view)`);
  return result;
}

/* ----------------------------------------------------------
   commitAction(combatant, taskId)

   Spend 1 action pip and advance task progress by 1 round.
   Enforces all gates in strict order. Returns boolean.

   Gate order:
     1. Active combat exists (game.combat is truthy)
     2. Combatant resolves and is valid
     3. Provided combatant is game.combat.combatant (active turn)
     4. Current user is GM or can control the combatant
     5. Task exists on combatant.actor flags
     6. Task status is not 'paused'
     7. Task status is not 'resolved' or 'abandoned'
     8. lastCommittedRound !== game.combat.round (same-round guard)
     9. Spend 1 action via _spendActionForCombatant (from action-tracker.js)

   On spend success:
     - roundsCommitted += 1
     - lastCommittedRound = game.combat.round
     - If GM and hidden data present: check roundsCommitted >= roundsRequired;
       set readyToResolve = true if threshold reached.
     - If GM but hidden data absent: log warning, leave readyToResolve false.
     - If non-GM: skip readyToResolve evaluation entirely.
     - Write updated public state to actor flags.
     - Update cache.

   readyToResolve policy:
     Only the GM client that holds hidden data may set this true.
     Non-GM clients read whatever the GM last wrote. Do not guess.

   @param {Combatant|string} combatant
   @param {string}           taskId
   @returns {boolean}
   ---------------------------------------------------------- */

async function _baphTaskCommit(combatantOrId, taskId) {

  // Gate 1: active combat
  if (!game.combat) {
    _baphTaskDebugLog('commitAction rejected: no active combat');
    return false;
  }

  // Gate 2: valid combatant
  const combatant = _baphTaskResolveCombatant(combatantOrId);
  if (!combatant) {
    _baphTaskDebugLog('commitAction rejected: could not resolve combatant');
    return false;
  }
  if (!combatant.actor) {
    _baphTaskDebugLog(`commitAction rejected: combatant "${combatant.name}" has no actor`);
    return false;
  }

  // Gate 3: must be the active combatant
  if (combatant.id !== game.combat.combatant?.id) {
    _baphTaskDebugLog(
      `commitAction rejected: "${combatant.name}" is not the active combatant ` +
      `(active: "${game.combat.combatant?.name ?? 'none'}")`
    );
    return false;
  }

  // Gate 4: user is GM or can control this combatant
  if (!_baphTaskCanControl(combatant)) {
    _baphTaskDebugLog(
      `commitAction rejected: current user cannot control "${combatant.name}"`
    );
    return false;
  }

  // Gate 5: task exists (read live — not from cache — to get current status)
  const tasks = _baphTaskReadActorTasks(combatant.actor);
  const task  = tasks[taskId];
  if (!task) {
    _baphTaskDebugLog(
      `commitAction rejected: task "${taskId}" not found on ${combatant.actor.name}`
    );
    return false;
  }

  // Gate 6: not paused
  if (task.status === 'paused') {
    _baphTaskDebugLog(
      `commitAction rejected: task "${task.taskName}" is paused ` +
      `(reason: ${task.pausedReason ?? 'none'}) — use resumeTask first`
    );
    return false;
  }

  // Gate 7: not terminal
  if (task.status === 'resolved' || task.status === 'abandoned') {
    _baphTaskDebugLog(
      `commitAction rejected: task "${task.taskName}" is already ${task.status}`
    );
    return false;
  }

  // Gate 8: same-round guard
  const currentRound = game.combat.round;
  if (task.lastCommittedRound === currentRound) {
    _baphTaskDebugLog(
      `commitAction rejected: already committed to "${task.taskName}" ` +
      `this round (round ${currentRound}) — no double-spend`
    );
    return false;
  }

  // Gate 9: spend 1 action
  // _spendActionForCombatant is a global from action-tracker.js (loads before this file).
  // It is all-or-nothing, updates the pip row, and returns boolean.
  const spent = _spendActionForCombatant(combatant.id, 1, `task-${task.skillKey}`);
  if (!spent) {
    _baphTaskDebugLog(
      `commitAction rejected: action spend failed for "${task.taskName}" ` +
      `— not enough actions remaining or tracker not ready`
    );
    return false;
  }

  // ── All gates passed. Advance progress. ──────────────────────────
  task.roundsCommitted   += 1;
  task.lastCommittedRound = currentRound;

  // readyToResolve: evaluated only by the GM client that holds hidden data.
  // Non-GM clients leave this field as-is (already written by the GM client
  // on a prior commit, or will be set on the next commit by the GM).
  if (game.user.isGM) {
    const hiddenAll = _baphTaskReadHiddenAll();
    const hidden    = hiddenAll[taskId];
    if (hidden?.roundsRequired != null) {
      if (task.roundsCommitted >= hidden.roundsRequired) {
        task.readyToResolve = true;
        _baphTaskDebugLog(
          `commitAction: "${task.taskName}" is ready to resolve ` +
          `(${task.roundsCommitted}/${hidden.roundsRequired} rounds)`
        );
        console.log(
          `${BAPH_TASK_MODULE_ID} | task-tracker: ` +
          `"${task.taskName}" is ready to resolve`
        );
      }
    } else {
      // Hidden data absent for this task on this GM client.
      // Per design policy: do not guess. Log clearly.
      _baphTaskDebugLog(
        `commitAction WARNING: no hidden data for task "${taskId}" on this GM client. ` +
        `readyToResolve not evaluated. ` +
        `Check game.user.flags['${BAPH_TASK_MODULE_ID}'].hiddenTaskData.`
      );
      console.warn(
        `${BAPH_TASK_MODULE_ID} | task-tracker: ` +
        `no hidden data found for task "${taskId}" on this GM client. ` +
        `readyToResolve not evaluated. ` +
        `Was this task created by a different GM user?`
      );
    }
  }

  // Write updated public state.
  tasks[taskId] = task;
  await _baphTaskWriteActorTasks(combatant.actor, tasks);
  _baphTaskUpdateCache(combatant.id, tasks);

  _baphTaskDebugLog(
    `commitAction: "${task.taskName}" advanced — ` +
    `roundsCommitted=${task.roundsCommitted}, ` +
    `round=${currentRound}, ` +
    `readyToResolve=${task.readyToResolve}`
  );
  return true;
}

/* ----------------------------------------------------------
   pauseTask(combatant, taskId, reason)

   Set task status to 'paused'. Does not consume an action.
   Requires GM or combatant owner. Only valid on 'active' tasks.

   @param {Combatant|string} combatant
   @param {string}           taskId
   @param {string|null}      [reason]
   @returns {boolean}
   ---------------------------------------------------------- */

async function _baphTaskPause(combatantOrId, taskId, reason = null) {
  const combatant = _baphTaskResolveCombatant(combatantOrId);
  if (!combatant?.actor) {
    _baphTaskDebugLog('pauseTask rejected: invalid combatant');
    return false;
  }
  if (!_baphTaskCanControl(combatant)) {
    _baphTaskDebugLog(`pauseTask rejected: current user cannot control "${combatant.name}"`);
    return false;
  }

  const tasks = _baphTaskReadActorTasks(combatant.actor);
  const task  = tasks[taskId];
  if (!task) {
    _baphTaskDebugLog(`pauseTask rejected: task "${taskId}" not found`);
    return false;
  }
  if (task.status !== 'active') {
    _baphTaskDebugLog(
      `pauseTask rejected: task "${task.taskName}" is not active (status: ${task.status})`
    );
    return false;
  }

  task.status      = 'paused';
  task.pausedReason = reason;
  tasks[taskId]    = task;
  await _baphTaskWriteActorTasks(combatant.actor, tasks);
  _baphTaskUpdateCache(combatant.id, tasks);

  _baphTaskDebugLog(
    `pauseTask: "${task.taskName}" paused (reason: ${reason ?? 'none'})`
  );
  return true;
}

/* ----------------------------------------------------------
   resumeTask(combatant, taskId)

   Set task status back to 'active'. Clears pausedReason.
   Does not consume an action. Does not advance progress.
   Requires GM or combatant owner. Only valid on 'paused' tasks.

   @param {Combatant|string} combatant
   @param {string}           taskId
   @returns {boolean}
   ---------------------------------------------------------- */

async function _baphTaskResume(combatantOrId, taskId) {
  const combatant = _baphTaskResolveCombatant(combatantOrId);
  if (!combatant?.actor) {
    _baphTaskDebugLog('resumeTask rejected: invalid combatant');
    return false;
  }
  if (!_baphTaskCanControl(combatant)) {
    _baphTaskDebugLog(`resumeTask rejected: current user cannot control "${combatant.name}"`);
    return false;
  }

  const tasks = _baphTaskReadActorTasks(combatant.actor);
  const task  = tasks[taskId];
  if (!task) {
    _baphTaskDebugLog(`resumeTask rejected: task "${taskId}" not found`);
    return false;
  }
  if (task.status !== 'paused') {
    _baphTaskDebugLog(
      `resumeTask rejected: task "${task.taskName}" is not paused (status: ${task.status})`
    );
    return false;
  }

  task.status      = 'active';
  task.pausedReason = null;
  tasks[taskId]    = task;
  await _baphTaskWriteActorTasks(combatant.actor, tasks);
  _baphTaskUpdateCache(combatant.id, tasks);

  _baphTaskDebugLog(`resumeTask: "${task.taskName}" resumed`);
  return true;
}

/* ----------------------------------------------------------
   abandonTask(combatant, taskId)

   Mark task as 'abandoned'. Does not consume an action.
   Requires GM or combatant owner.
   Actor flag data is preserved for GM audit — not deleted.
   Hidden data on GM user flags is also preserved.

   @param {Combatant|string} combatant
   @param {string}           taskId
   @returns {boolean}
   ---------------------------------------------------------- */

async function _baphTaskAbandon(combatantOrId, taskId) {
  const combatant = _baphTaskResolveCombatant(combatantOrId);
  if (!combatant?.actor) {
    _baphTaskDebugLog('abandonTask rejected: invalid combatant');
    return false;
  }
  if (!_baphTaskCanControl(combatant)) {
    _baphTaskDebugLog(`abandonTask rejected: current user cannot control "${combatant.name}"`);
    return false;
  }

  const tasks = _baphTaskReadActorTasks(combatant.actor);
  const task  = tasks[taskId];
  if (!task) {
    _baphTaskDebugLog(`abandonTask rejected: task "${taskId}" not found`);
    return false;
  }

  task.status   = 'abandoned';
  tasks[taskId] = task;
  await _baphTaskWriteActorTasks(combatant.actor, tasks);
  _baphTaskUpdateCache(combatant.id, tasks);

  _baphTaskDebugLog(
    `abandonTask: "${task.taskName}" abandoned (actor flag data preserved for audit)`
  );
  return true;
}

/* ----------------------------------------------------------
   resolveTask(combatant, taskId)

   STUBBED in v2.16.0. GM only.
   Actual resolution logic (skill roll, trap trigger, etc.)
   is deferred to v2.19.0 — Task Resolution Polish.
   Hidden data is never read or revealed by this stub.

   @param {Combatant|string} combatant
   @param {string}           taskId
   @returns {false}          Always false in this version.
   ---------------------------------------------------------- */

function _baphTaskResolve(combatantOrId, taskId) {
  if (!game.user.isGM) {
    _baphTaskDebugLog('resolveTask rejected: GM only');
    return false;
  }
  const combatant = _baphTaskResolveCombatant(combatantOrId);
  const actorName = combatant?.actor?.name ?? String(combatantOrId);
  _baphTaskDebugLog(
    `resolveTask: STUB — resolution not implemented in v2.16.0 ` +
    `(task: ${taskId}, actor: ${actorName}). Implement in v2.19.0.`
  );
  console.log(
    `${BAPH_TASK_MODULE_ID} | task-tracker: resolveTask is a stub in v2.16.0. ` +
    `Implement resolution in v2.19.0.`
  );
  return false;
}

/* ============================================================
   HOOK: deleteCombat

   On combat deletion:
     - Walk all combatants in the ending combat.
     - Pause any 'active' tasks with pausedReason 'combat-ended'.
     - Do NOT delete actor flags.
     - Do NOT silently abandon tasks.
     - Do NOT prompt with a modal.
     - Clear in-memory cache.
     - Log and notify GM if tasks were paused.

   This listener coexists with two deleteCombat listeners in
   action-tracker.js (pipState cleanup and panel removal).
   Multiple listeners for the same hook are normal and safe.
   ============================================================ */

Hooks.on('deleteCombat', async (combat, options, userId) => {
  // Non-GM clients clear their cache and exit.
  // They cannot write actor flags authoritatively.
  if (!game.user.isGM) {
    _baphTaskCache.clear();
    return;
  }

  let pausedCount = 0;

  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor) continue;

    // Read live — cache is about to be cleared anyway.
    const tasks = actor.getFlag(BAPH_TASK_MODULE_ID, BAPH_TASK_FLAG_PUBLIC);
    if (!tasks || typeof tasks !== 'object') continue;

    let modified = false;
    for (const task of Object.values(tasks)) {
      if (task.status === 'active') {
        task.status       = 'paused';
        task.pausedReason = 'combat-ended';
        modified          = true;
        pausedCount++;
      }
    }

    if (modified) {
      // setFlag directly — cache is being cleared right after this loop.
      await actor.setFlag(BAPH_TASK_MODULE_ID, BAPH_TASK_FLAG_PUBLIC, tasks);
    }
  }

  _baphTaskCache.clear();

  if (pausedCount > 0) {
    _baphTaskDebugLog(
      `deleteCombat: paused ${pausedCount} active task(s) with reason 'combat-ended'`
    );
    console.log(
      `${BAPH_TASK_MODULE_ID} | task-tracker: ` +
      `paused ${pausedCount} active task(s) on combat end`
    );
    ui.notifications.info(
      `Baphomet Tasks: ${pausedCount} open task(s) paused — combat ended. ` +
      `Resume via game.baphometTasks.resumeTask() when the next encounter begins.`
    );
  } else {
    _baphTaskDebugLog('deleteCombat: no active tasks to pause; cache cleared');
    console.log(
      `${BAPH_TASK_MODULE_ID} | task-tracker: no active tasks to pause; cache cleared`
    );
  }
});

/* ============================================================
   HOOK: pf1PostReady

   - Rebuild in-memory cache from actor flags.
   - Expose game.baphometTasks API.

   pf1PostReady is preferred over ready for PF1 modules —
   it fires after PF1 has fully bootstrapped, ensuring actor
   documents and flags are accessible.
   ============================================================ */

Hooks.once('pf1PostReady', () => {
  _baphTaskRebuildCache();

  game.baphometTasks = {
    createTask:   _baphTaskCreate,
    getTask:      _baphTaskGet,
    getTasks:     _baphTaskGetAll,
    commitAction: _baphTaskCommit,
    pauseTask:    _baphTaskPause,
    resumeTask:   _baphTaskResume,
    abandonTask:  _baphTaskAbandon,
    resolveTask:  _baphTaskResolve,
  };

  console.log(`${BAPH_TASK_MODULE_ID} | task-tracker v1.0: game.baphometTasks API ready`);
});
