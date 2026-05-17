/* ============================================================
   ECHOES OF BAPHOMET — MULTI-ROUND TASK TRACKER v1.0
   v2.16.0 — Multi-Round Task Scaffold

   Exposes: game.baphometTasks
   Depends on: action-tracker.js (must load first, per module.json)
   Uses globals from action-tracker.js:
     _spendActionForCombatant(combatantId, count, reason) → boolean
     _debugLog(msg, ...args) — gated on debugLogging setting
     _renderActionPanel() — re-renders action panel + task widget (v2.17.1)

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
   _baphResolveTaskRollActive
   Cross-script flag: true while resolveTask() is executing its
   actor.rollSkill() call. action-tracker.js reads this at runtime
   (both scripts loaded) to suppress the 'dev' no-auto-spend
   warning when the roll is an intentional task-resolution roll.
   var is required: top-level var creates a window property that
   is accessible from other classic-script files at runtime.
   ---------------------------------------------------------- */
// eslint-disable-next-line no-var
var _baphResolveTaskRollActive = false;

/* ----------------------------------------------------------
   _baphAidTaskRollActive
   Cross-script flag: true while aidTask() is executing its
   actor.rollSkill() call for the Aid Another check. action-tracker.js
   reads this to suppress the 'dev' warning and skill auto-spend
   during what is an intentional aid-check roll, not a standalone
   skill use.
   var is required: top-level var creates a window property that
   is accessible from other classic-script files at runtime.
   ---------------------------------------------------------- */
// eslint-disable-next-line no-var
var _baphAidTaskRollActive = false;

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
    taskId:                   task.taskId,
    skillKey:                 task.skillKey,
    taskType:                 task.taskType,
    taskName:                 task.taskName,
    roundsCommitted:          task.roundsCommitted,
    startedRound:             task.startedRound,
    lastCommittedRound:       task.lastCommittedRound,
    lastResolvedAttemptRound: task.lastResolvedAttemptRound ?? null,
    status:                      task.status,
    pausedReason:                task.pausedReason,
    readyToResolve:              task.readyToResolve,
    createdByUserId:             task.createdByUserId,
    hiddenDataOwnerUserId:       task.hiddenDataOwnerUserId,
    metadataPublic:              task.metadataPublic,
    pendingResolutionBonuses:    task.pendingResolutionBonuses ?? [],
    successfulAidContributors:    task.successfulAidContributors ?? [],
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
    roundsCommitted:          0,
    startedRound:             startRound,
    lastCommittedRound:       null,
    lastResolvedAttemptRound: null,
    status:                   'active',
    pausedReason:             null,
    readyToResolve:              false,
    createdByUserId:             game.user.id,
    hiddenDataOwnerUserId:       game.user.id,
    metadataPublic,
    pendingResolutionBonuses:    [],
    successfulAidContributors:    [],  // cleared on each Resolve attempt
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

  // Non-GM: public progress is now written; request GM-side readiness evaluation.
  // The GM client reads hidden roundsRequired and flips readyToResolve when the
  // public committed progress meets the threshold.
  // GM clients skip this — they already evaluated readiness synchronously above.
  if (!game.user.isGM) {
    _baphTaskDebugLog(
      `commitAction: emitting readiness-check request — ` +
      `task "${task.taskName}", roundsCommitted=${task.roundsCommitted}`
    );
    game.socket.emit(`module.${BAPH_TASK_MODULE_ID}`, {
      action:  'baphTaskReadinessCheck',
      payload: {
        combatantId:        combatant.id,
        taskId,
        roundsCommitted:    task.roundsCommitted,
        requestingUserId:   game.user.id,
      },
    });
  }

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

  if (task.status === 'resolved' || task.status === 'abandoned') {
    _baphTaskDebugLog(
      `abandonTask rejected: task "${task.taskName}" is already ${task.status}`
    );
    return false;
  }

  const taskName  = task.taskName;
  const actorName = combatant.actor.name;

  task.status                   = 'abandoned';
  task.pendingResolutionBonuses = [];
  tasks[taskId]                 = task;
  await _baphTaskWriteActorTasks(combatant.actor, tasks);
  _baphTaskUpdateCache(combatant.id, tasks);

  await ChatMessage.create({
    content:
      `<p><strong>${actorName}</strong> abandons <em>${taskName}</em>.</p>` +
      `<p>Task abandoned — no further progress possible.</p>`,
    speaker: { alias: 'Baphomet Tasks' },
    whisper: [],
  });

  _baphTaskDebugLog(
    `abandonTask: "${taskName}" abandoned — actor flag data preserved for audit, ` +
    `hidden data preserved, pending bonuses cleared`
  );
  return true;
}

/* ----------------------------------------------------------
   _baphTaskAdjudicate(combatant, taskId, task, rollTotal)

   GM-only. Reads the hidden DC for the task, classifies the
   roll result, posts a chat message, and writes updated task
   state to actor flags in one pass.

   Called by:
     - _baphTaskResolve (GM-direct path, task in memory)
     - The socket listener (player-triggered path, task read
       from live actor flags by the socket handler)

   In both cases the task object carries lastResolvedAttemptRound
   already set. This function merges it back into a fresh read
   of the full tasks object before writing, ensuring no other
   concurrent task changes are discarded.

   @param {Combatant} combatant    Resolved Combatant object
   @param {string}    taskId       Task identifier string
   @param {object}    task         Task object (in-memory, pre-modified)
   @param {number}    rollTotal    Captured roll total from pf1ActorRollSkill
   @returns {Promise<void>}
   ---------------------------------------------------------- */

async function _baphTaskAdjudicate(combatant, taskId, task, rollTotal) {
  if (!game.user.isGM) return;

  const hiddenAll = _baphTaskReadHiddenAll();
  const hidden    = hiddenAll[taskId];
  const dc        = hidden?.metadataHidden?.dc ?? null;
  const actorName = combatant.actor.name;
  const taskName  = task.taskName;

  if (dc !== null && Number.isFinite(rollTotal)) {
    const diff = rollTotal - dc;
    let chatContent;

    if (diff >= 0) {
      task.status        = 'resolved';
      task.readyToResolve = false;
      chatContent =
        `<p><strong>${actorName}</strong> successfully resolves ` +
        `<em>${taskName}</em>.</p>` +
        `<p>Result: <strong>Success.</strong></p>`;
      _baphTaskDebugLog(
        `adjudicate SUCCESS — "${taskName}" / ${actorName} / ` +
        `roll ${rollTotal} vs DC ${dc} (margin: +${diff})`
      );
      console.log(
        `${BAPH_TASK_MODULE_ID} | task-tracker: adjudicate SUCCESS — ` +
        `"${taskName}" on ${actorName} (roll ${rollTotal}, DC ${dc})`
      );
    } else if (diff >= -4) {
      // task.status and task.readyToResolve unchanged — stays ready to retry.
      chatContent =
        `<p><strong>Minor Failure</strong> — <strong>${actorName}</strong> does not complete ` +
        `<em>${taskName}</em>.</p>` +
        `<p>The task is not complete and remains ready. ` +
        `Resolve may be retried next round.</p>`;
      _baphTaskDebugLog(
        `adjudicate MINOR FAILURE — "${taskName}" / ${actorName} / ` +
        `roll ${rollTotal} vs DC ${dc} (margin: ${diff})`
      );
      console.log(
        `${BAPH_TASK_MODULE_ID} | task-tracker: adjudicate MINOR FAILURE — ` +
        `"${taskName}" on ${actorName} (roll ${rollTotal}, DC ${dc})`
      );
    } else {
      task.status        = 'resolved';
      task.readyToResolve = false;
      chatContent =
        `<p><strong>${actorName}</strong> catastrophically fails ` +
        `<em>${taskName}</em>.</p>` +
        `<p>Result: <strong>Catastrophic Failure</strong> — GM: apply trap ` +
        `consequence manually where appropriate.</p>`;
      _baphTaskDebugLog(
        `adjudicate CATASTROPHIC FAILURE — "${taskName}" / ${actorName} / ` +
        `roll ${rollTotal} vs DC ${dc} (margin: ${diff})`
      );
      console.log(
        `${BAPH_TASK_MODULE_ID} | task-tracker: adjudicate CATASTROPHIC FAILURE — ` +
        `"${taskName}" on ${actorName} (roll ${rollTotal}, DC ${dc})`
      );
    }

    await ChatMessage.create({
      content: chatContent,
      speaker: { alias: 'Baphomet Tasks' },
      whisper: [],
    });

  } else {
    // DC absent or roll total not finite — classification not possible.
    _baphTaskDebugLog(
      `adjudicate WARNING: classification skipped — ` +
      `dc=${dc}, rollTotal=${rollTotal}. ` +
      `Hidden data may be absent. GM should adjudicate manually.`
    );
    console.warn(
      `${BAPH_TASK_MODULE_ID} | task-tracker: adjudicate — ` +
      `classification skipped (dc=${dc}, rollTotal=${rollTotal}). ` +
      `Was this task created on a different GM client?`
    );
  }

  // Consume pending aid bonuses and successful contributor records after every Resolve attempt.
  // Both clear regardless of outcome (success, minor failure, catastrophic failure).
  // After minor failure the task stays ready; to help again the aider must Aid again.
  task.pendingResolutionBonuses = [];
  task.successfulAidContributors = [];

  // Always write the task state (includes lastResolvedAttemptRound + any status change).
  // Read fresh tasks object so no concurrent sibling-task changes are discarded.
  const tasks = _baphTaskReadActorTasks(combatant.actor);
  tasks[taskId] = task;
  await _baphTaskWriteActorTasks(combatant.actor, tasks);
  _baphTaskUpdateCache(combatant.id, tasks);

  _baphTaskDebugLog(
    `adjudicate: wrote task state for "${taskName}" — ` +
    `status=${task.status}, readyToResolve=${task.readyToResolve}`
  );
}

/* ----------------------------------------------------------
   resolveTask(combatant, taskId)

   Spend 1 PF1.5 action and execute the skill check resolution
   for a task that is in readyToResolve state. Implements the
   Disable Device resolution path (v2.17.2).

   Gate order:
     1.  Active combat exists
     2.  Combatant resolves and is valid with an actor
     3.  Combatant is the currently active combatant
     4.  Current user can control the combatant
     5.  Task exists on the actor
     6.  Task readyToResolve is true
     7.  Task status is not already 'resolved' or 'abandoned'
     8.  Same-round guard (lastResolvedAttemptRound !== currentRound)
     9.  Spend 1 action via _spendActionForCombatant

   On spend success:
     - Registers a one-time pf1ActorRollSkill hook to capture total.
     - Sets _baphResolveTaskRollActive=true so action-tracker.js
       suppresses the 'dev' no-auto-spend warning during this roll.
     - Calls actor.rollSkill(skillKey, {skipDialog:true}).
     - Cleans up the flag and hook after the roll completes.

   GM clients:
     - Calls _baphTaskAdjudicate() directly with the captured total.
     - Adjudicate reads DC from metadataHidden.dc, classifies, posts
       chat, and writes all task state changes in one setFlag call.

   Non-GM clients:
     - Writes lastResolvedAttemptRound to actor flags immediately.
     - Emits a socket message (module.baphomet-utils) with the roll
       total and identifying context.
     - The socket listener on the GM client picks this up and calls
       _baphTaskAdjudicate() server-side to classify without leaking
       the hidden DC to the player.

   @param {Combatant|string} combatant
   @param {string}           taskId
   @returns {Promise<boolean>}  true if action spent and roll fired
   ---------------------------------------------------------- */

async function _baphTaskResolve(combatantOrId, taskId) {

  // Gate 1: active combat
  if (!game.combat) {
    _baphTaskDebugLog('resolveTask rejected: no active combat');
    return false;
  }

  // Gate 2: valid combatant with actor
  const combatant = _baphTaskResolveCombatant(combatantOrId);
  if (!combatant) {
    _baphTaskDebugLog('resolveTask rejected: could not resolve combatant');
    return false;
  }
  if (!combatant.actor) {
    _baphTaskDebugLog(`resolveTask rejected: combatant "${combatant.name}" has no actor`);
    return false;
  }

  // Gate 3: must be the active combatant
  if (combatant.id !== game.combat.combatant?.id) {
    _baphTaskDebugLog(
      `resolveTask rejected: "${combatant.name}" is not the active combatant ` +
      `(active: "${game.combat.combatant?.name ?? 'none'}")`
    );
    return false;
  }

  // Gate 4: user can control this combatant
  if (!_baphTaskCanControl(combatant)) {
    _baphTaskDebugLog(
      `resolveTask rejected: current user cannot control "${combatant.name}"`
    );
    return false;
  }

  // Gate 5: task exists (read live for current status)
  const tasks = _baphTaskReadActorTasks(combatant.actor);
  const task  = tasks[taskId];
  if (!task) {
    _baphTaskDebugLog(
      `resolveTask rejected: task "${taskId}" not found on ${combatant.actor.name}`
    );
    return false;
  }

  // Gate 6: task must be ready to resolve
  if (!task.readyToResolve) {
    _baphTaskDebugLog(
      `resolveTask rejected: task "${task.taskName}" is not ready to resolve`
    );
    return false;
  }

  // Gate 7: not already terminal
  if (task.status === 'resolved' || task.status === 'abandoned') {
    _baphTaskDebugLog(
      `resolveTask rejected: task "${task.taskName}" is already ${task.status}`
    );
    return false;
  }

  // Gate 8: same-round guard
  const currentRound = game.combat.round;
  if ((task.lastResolvedAttemptRound ?? null) === currentRound) {
    _baphTaskDebugLog(
      `resolveTask rejected: already attempted resolution for "${task.taskName}" ` +
      `this round (round ${currentRound}) — wait for the next round`
    );
    return false;
  }

  // Gate 9: spend 1 action
  const spent = _spendActionForCombatant(combatant.id, 1, `resolve-${task.skillKey}`);
  if (!spent) {
    _baphTaskDebugLog(
      `resolveTask rejected: action spend failed for "${task.taskName}" ` +
      `— not enough actions remaining`
    );
    return false;
  }

  // ── All gates passed. Roll the resolution skill check. ────────────

  // Record this attempt so same-round double-clicks are blocked.
  task.lastResolvedAttemptRound = currentRound;

  // Capture the roll total via pf1ActorRollSkill.
  // The hook fires synchronously inside actor.rollSkill() before its
  // Promise resolves, so capturedTotal is populated by the time the
  // await below returns.
  let capturedTotal = null;
  const captureHook = (rolledActor, chatMessage, rolledSkillKey) => {
    if (rolledActor?.id === combatant.actor.id && rolledSkillKey === task.skillKey) {
      capturedTotal = chatMessage?.rolls?.[0]?.total ?? null;
    }
  };
  Hooks.on('pf1ActorRollSkill', captureHook);

  // Sum queued aid bonuses and apply to the resolution roll.
  // bonus option confirmed in PF1 docs (actor.rollSkill options: skipDialog, bonus, dice).
  const pendingBonus = (task.pendingResolutionBonuses ?? [])
    .reduce((sum, b) => sum + (b.amount ?? 0), 0);
  const rollOptions = { skipDialog: true };
  if (pendingBonus !== 0) rollOptions.bonus = pendingBonus;

  // Suppress the action-tracker.js 'dev' no-auto-spend notification
  // for this intentional task-resolution roll.
  _baphResolveTaskRollActive = true;
  try {
    await combatant.actor.rollSkill(task.skillKey, rollOptions);
  } finally {
    _baphResolveTaskRollActive = false;
    Hooks.off('pf1ActorRollSkill', captureHook);
  }

  _baphTaskDebugLog(
    `resolveTask: rolled ${task.skillKey} for "${task.taskName}" on ${combatant.actor.name} ` +
    `— captured total: ${capturedTotal}`
  );

  // ── Classify and write outcome ────────────────────────────────────
  if (game.user.isGM) {
    // GM-direct path: classify locally using hidden DC, write all changes
    // in a single setFlag call via _baphTaskAdjudicate.
    await _baphTaskAdjudicate(combatant, taskId, task, capturedTotal);
  } else {
    // Non-GM path: write the player's lastResolvedAttemptRound change first
    // to block same-round retry, then request GM-side adjudication via socket.
    tasks[taskId] = task;
    await _baphTaskWriteActorTasks(combatant.actor, tasks);
    _baphTaskUpdateCache(combatant.id, tasks);

    if (capturedTotal !== null && Number.isFinite(capturedTotal)) {
      _baphTaskDebugLog(
        `resolveTask: emitting GM adjudication request — ` +
        `task "${task.taskName}", rollTotal=${capturedTotal}`
      );
      game.socket.emit(`module.${BAPH_TASK_MODULE_ID}`, {
        action:  'baphTaskResolveAdjudicate',
        payload: {
          combatantId:        combatant.id,
          taskId,
          rollTotal:          capturedTotal,
          requestingUserId:   game.user.id,
        },
      });
    } else {
      // Roll total not captured — socket not emitted; GM must adjudicate manually.
      _baphTaskDebugLog(
        `resolveTask: roll total not captured — socket adjudication skipped. ` +
        `GM must adjudicate manually.`
      );
      console.warn(
        `${BAPH_TASK_MODULE_ID} | task-tracker: resolveTask — ` +
        `roll total not captured for non-GM path. Manual GM adjudication required.`
      );
    }
  }

  _baphTaskDebugLog(
    `resolveTask: completed — ` +
    `status=${task.status}, readyToResolve=${task.readyToResolve}, ` +
    `lastResolvedAttemptRound=${task.lastResolvedAttemptRound}`
  );
  return true;
}

/* ----------------------------------------------------------
   aidTask(aiderCombatant, targetCombatantOrId, targetTaskId)

   Spend 1 PF1.5 action from the aider and queue a +2 pending
   resolution bonus on an allied ready-to-resolve task (v2.18.0).

   Gate order:
     1.  Active combat exists
     2.  Aider combatant resolves and has an actor
     3.  Aider is the currently active combatant
     4.  Current user can control the aider
     5.  Target combatant resolves, has an actor, and differs from aider
     6.  Target task exists, status is 'active', readyToResolve is true,
         not already terminal
     7.  Aider has not already contributed aid to this task this round
     8.  Spend 1 action from aider via _spendActionForCombatant

   GM clients:
     - Write the +2 bonus directly to the target actor's task flags.
     - Post a chat message confirming aid.

   Non-GM clients:
     - Action is already spent; emit a socket message (module.baphomet-utils)
       with action 'baphTaskAidAdjudicate'.
     - GM socket listener validates and writes the bonus.
     - Hidden DC and hidden task metadata are never transmitted.

   @param {Combatant|string} aiderCombatantOrId
   @param {Combatant|string} targetCombatantOrId
   @param {string}           targetTaskId
   @returns {Promise<boolean>}  true if action spent and aid queued
   ---------------------------------------------------------- */

async function _baphTaskAid(aiderCombatantOrId, targetCombatantOrId, targetTaskId) {

  // Gate 1: active combat
  if (!game.combat) {
    _baphTaskDebugLog('aidTask rejected: no active combat');
    return false;
  }

  // Gate 2: valid aider combatant with actor
  const aider = _baphTaskResolveCombatant(aiderCombatantOrId);
  if (!aider) {
    _baphTaskDebugLog('aidTask rejected: could not resolve aider combatant');
    return false;
  }
  if (!aider.actor) {
    _baphTaskDebugLog(`aidTask rejected: aider "${aider.name}" has no actor`);
    return false;
  }

  // Gate 3: aider must be the active combatant
  if (aider.id !== game.combat.combatant?.id) {
    _baphTaskDebugLog(
      `aidTask rejected: "${aider.name}" is not the active combatant ` +
      `(active: "${game.combat.combatant?.name ?? 'none'}")` 
    );
    return false;
  }

  // Gate 4: user can control the aider
  if (!_baphTaskCanControl(aider)) {
    _baphTaskDebugLog(`aidTask rejected: current user cannot control "${aider.name}"`);
    return false;
  }

  // Gate 5: valid target combatant — different from aider, has actor
  const targetCombatant = _baphTaskResolveCombatant(targetCombatantOrId);
  if (!targetCombatant?.actor) {
    _baphTaskDebugLog('aidTask rejected: could not resolve target combatant');
    return false;
  }
  if (targetCombatant.id === aider.id) {
    _baphTaskDebugLog('aidTask rejected: aider and target are the same combatant');
    return false;
  }

  // Gate 6: target task exists and is an eligible active task.
  // Aid Another is available during BOTH:
  //   - in-progress tasks (status === 'active', readyToResolve === false)
  //   - ready-to-resolve tasks (status === 'active', readyToResolve === true)
  // Aid is NOT available for: paused, resolved, or abandoned tasks.
  const targetTasks = _baphTaskReadActorTasks(targetCombatant.actor);
  const targetTask  = targetTasks[targetTaskId];
  if (!targetTask) {
    _baphTaskDebugLog(
      `aidTask rejected: task "${targetTaskId}" not found on ${targetCombatant.actor.name}`
    );
    return false;
  }
  if (targetTask.status !== 'active') {
    _baphTaskDebugLog(
      `aidTask rejected: target task "${targetTask.taskName}" is not active ` +
      `(status: ${targetTask.status})`
    );
    return false;
  }

  // Gate 7: duplicate contributor guard.
  // successfulAidContributors tracks combatant IDs who have already banked a +2
  // for this pending Resolve attempt. Cleared when Resolve fires (success or failure).
  // Failed aid attempts do NOT add to successfulAidContributors; a helper may retry
  // after a failure (natural 3-action economy is the deterrent).
  const existingContributors = targetTask.successfulAidContributors ?? [];
  if (existingContributors.includes(aider.id)) {
    _baphTaskDebugLog(
      `aidTask rejected: "${aider.name}" already successfully aided "${targetTask.taskName}" ` +
      `for this pending Resolve attempt`
    );
    return false;
  }

  // Gate 8: spend 1 action from aider
  const spent = _spendActionForCombatant(aider.id, 1, `aid-${targetTask.skillKey}`);
  if (!spent) {
    _baphTaskDebugLog(
      `aidTask rejected: action spend failed for aider "${aider.name}" — not enough actions remaining`
    );
    return false;
  }

  // ── All gates passed. Roll the Aid Another skill check (DC 10). ─────────────
  // The aider rolls the task's relevant skill. A result of 10+ banks +2 on the
  // target task. Failure banks no bonus. Action is spent on both outcomes.
  //
  // Roll pattern mirrors resolveTask: pf1ActorRollSkill hook fires synchronously
  // inside actor.rollSkill(), so capturedAidTotal is populated before await returns.
  // Confirmed API: actor.rollSkill(skillKey, {skipDialog:true})
  //   (docs/reference/foundry-v13/99_Combined_Foundry_v13_PF1_[KnowledgeFiles.md].md)

  let capturedAidTotal = null;
  const captureHook = (rolledActor, chatMessage, rolledSkillKey) => {
    if (rolledActor?.id === aider.actor.id && rolledSkillKey === targetTask.skillKey) {
      capturedAidTotal = chatMessage?.rolls?.[0]?.total ?? null;
    }
  };
  Hooks.on('pf1ActorRollSkill', captureHook);

  // _baphAidTaskRollActive suppresses: dev warning in action-tracker.js AND
  // skill auto-spend handler (to prevent double-action-spend during this roll).
  _baphAidTaskRollActive = true;
  try {
    await aider.actor.rollSkill(targetTask.skillKey, { skipDialog: true });
  } finally {
    _baphAidTaskRollActive = false;
    Hooks.off('pf1ActorRollSkill', captureHook);
  }

  _baphTaskDebugLog(
    `aidTask: rolled ${targetTask.skillKey} for "${aider.actor.name}" (Aid check) ` +
    `— captured total: ${capturedAidTotal}`
  );

  // ── DC 10 adjudication ────────────────────────────────────────────────────────
  // Aid DC is fixed public DC 10 (not the task's hidden resolution DC).
  const AID_DC = 10;

  if (game.user.isGM) {
    // GM-direct path: compare locally, write bonus immediately.
    const aidSucceeded = capturedAidTotal !== null && capturedAidTotal >= AID_DC;

    if (aidSucceeded) {
      const bonusEntry = {
        sourceCombatantId: aider.id,
        sourceActorId:     aider.actor.id,
        sourceUserId:      game.user.id,
        amount:            2,
        label:             'Aid Another',
        roundAdded:        game.combat.round,
      };
      const existingBonuses = targetTask.pendingResolutionBonuses ?? [];
      targetTask.pendingResolutionBonuses    = [...existingBonuses, bonusEntry];
      targetTask.successfulAidContributors   = [...existingContributors, aider.id];
      targetTasks[targetTaskId]              = targetTask;
      await _baphTaskWriteActorTasks(targetCombatant.actor, targetTasks);
      _baphTaskUpdateCache(targetCombatant.id, targetTasks);

      await ChatMessage.create({
        content:
          `<p><strong>${aider.actor.name}</strong> aids ` +
          `<strong>${targetCombatant.actor.name}</strong>'s ` +
          `<em>${targetTask.taskName}</em>.</p>` +
          `<p>Aid check: <strong>${capturedAidTotal}</strong> vs DC ${AID_DC} — ` +
          `<strong>Success.</strong> Aid queued: +2 to the next resolution roll.</p>`,
        speaker: { alias: 'Baphomet Tasks' },
        whisper: [],
      });

      _baphTaskDebugLog(
        `aidTask: SUCCESS — "${aider.actor.name}" aided "${targetTask.taskName}" on ` +
        `${targetCombatant.actor.name} (+2, roll ${capturedAidTotal} vs DC ${AID_DC}, GM direct)`
      );
    } else {
      // Failed Aid: action spent, no bonus banked.
      await ChatMessage.create({
        content:
          `<p><strong>${aider.actor.name}</strong> attempts to aid ` +
          `<strong>${targetCombatant.actor.name}</strong>'s ` +
          `<em>${targetTask.taskName}</em>.</p>` +
          `<p>Aid check: <strong>${capturedAidTotal ?? '?'}</strong> vs DC ${AID_DC} — ` +
          `<strong>Failure.</strong> No bonus queued. Action spent.</p>`,
        speaker: { alias: 'Baphomet Tasks' },
        whisper: [],
      });

      _baphTaskDebugLog(
        `aidTask: FAILURE — "${aider.actor.name}" failed aid for "${targetTask.taskName}" ` +
        `(roll ${capturedAidTotal ?? '?'} vs DC ${AID_DC}, GM direct)`
      );
    }
  } else {
    // Non-GM path: action already spent on player client.
    // Emit socket with roll total for GM-side DC 10 adjudication.
    // Hidden task DC and metadataHidden are never transmitted.
    _baphTaskDebugLog(
      `aidTask: emitting GM aid adjudication request — ` +
      `aider=${aider.id}, target=${targetCombatant.id}, task=${targetTaskId}, ` +
      `rollTotal=${capturedAidTotal}`
    );

    if (capturedAidTotal !== null && Number.isFinite(capturedAidTotal)) {
      game.socket.emit(`module.${BAPH_TASK_MODULE_ID}`, {
        action:  'baphTaskAidAdjudicate',
        payload: {
          aiderCombatantId:  aider.id,
          aiderActorId:      aider.actor.id,
          aiderActorName:    aider.actor.name,
          targetCombatantId: targetCombatant.id,
          targetTaskId,
          requestingUserId:  game.user.id,
          roundAdded:        game.combat.round,
          rollTotal:         capturedAidTotal,  // GM uses this for DC 10 check
        },
      });
    } else {
      // Roll total not captured — skip socket; action was spent but no bonus queued.
      _baphTaskDebugLog(
        `aidTask: roll total not captured — socket adjudication skipped. ` +
        `Action was spent but no bonus queued. GM may need to adjudicate manually.`
      );
      console.warn(
        `${BAPH_TASK_MODULE_ID} | task-tracker: aidTask — ` +
        `roll total not captured for non-GM path. Manual GM adjudication required.`
      );
    }
  }

  return true;
}

/* ----------------------------------------------------------
   initiateTask(combatant, options)

   GM-only combat task initiation. Spends exactly 1 PF1.5 action
   from the active combatant and creates a new multi-round task
   with the first round of work already committed.

   This is the front-door entry point for combat task creation.
   Unlike createTask() (which starts with roundsCommitted=0),
   initiateTask() records the initiation action as the first
   committed work unit (roundsCommitted=1). If roundsRequired<=1,
   the task immediately enters readyToResolve state.

   Gate order:
     1.  GM only
     2.  Active combat exists
     3.  Combatant resolves and has an actor
     4.  Combatant is the currently active combatant
     5.  No existing active task on this combatant
     6.  taskName is a non-empty string
     7.  roundsRequired is a positive integer
     8.  dc is a positive integer
     9.  Spend 1 action via _spendActionForCombatant

   On spend success:
     - Creates task with roundsCommitted=1, lastCommittedRound=startRound
     - readyToResolve=true when roundsRequired<=1
     - Stores roundsRequired+dc in GM user hidden flags (never on actor)
     - Posts public chat (no hidden data revealed)
     - Calls _renderActionPanel() to refresh UI

   @param {Combatant|string} combatantOrId
   @param {object}  options
   @param {string}  options.taskName        Human-readable label (required)
   @param {string}  [options.taskAction='disable']  Flavor tag (disable/arm/sabotage/jury_rig/custom)
   @param {number}  options.roundsRequired  Positive integer; hidden from players
   @param {number}  options.dc              Resolution DC; hidden from players
   @returns {string|false}  taskId on success, false on any failure
   ---------------------------------------------------------- */

async function _baphTaskInitiate(combatantOrId, options = {}) {

  // Gate 1: GM only
  if (!game.user.isGM) {
    _baphTaskDebugLog('initiateTask rejected: GM only');
    ui.notifications?.warn?.('Baphomet Tasks: only the GM can initiate tasks.');
    return false;
  }

  // Gate 2: active combat
  if (!game.combat) {
    _baphTaskDebugLog('initiateTask rejected: no active combat');
    return false;
  }

  // Gate 3: valid combatant with actor
  const combatant = _baphTaskResolveCombatant(combatantOrId);
  if (!combatant) {
    _baphTaskDebugLog('initiateTask rejected: could not resolve combatant');
    return false;
  }
  if (!combatant.actor) {
    _baphTaskDebugLog(`initiateTask rejected: combatant "${combatant.name}" has no actor`);
    return false;
  }

  // Gate 4: must be the currently active combatant
  if (combatant.id !== game.combat.combatant?.id) {
    _baphTaskDebugLog(
      `initiateTask rejected: "${combatant.name}" is not the active combatant ` +
      `(active: "${game.combat.combatant?.name ?? 'none'}")`
    );
    ui.notifications?.warn?.('Task initiation: this combatant is not currently active.');
    return false;
  }

  // Gate 5: no existing active task on this combatant
  const existingTasks = _baphTaskGetCachedOrLive(combatant);
  const hasActive = Object.values(existingTasks).some(t => t.status === 'active');
  if (hasActive) {
    _baphTaskDebugLog(
      `initiateTask rejected: "${combatant.name}" already has an active task`
    );
    ui.notifications?.warn?.('This combatant already has an active task.');
    return false;
  }

  // Gate 6: taskName required
  const {
    taskName,
    taskAction = 'disable',
    roundsRequired,
    dc,
  } = options;

  const trimmedName = (taskName ?? '').trim();
  if (!trimmedName) {
    _baphTaskDebugLog('initiateTask rejected: taskName is required');
    ui.notifications?.warn?.('Task Name is required.');
    return false;
  }

  // Gate 7: roundsRequired must be a positive integer
  if (
    typeof roundsRequired !== 'number' ||
    !Number.isInteger(roundsRequired)  ||
    roundsRequired < 1
  ) {
    _baphTaskDebugLog(
      `initiateTask rejected: roundsRequired must be a positive integer ` +
      `(received ${JSON.stringify(roundsRequired)})`
    );
    ui.notifications?.warn?.('Rounds Required must be a positive integer.');
    return false;
  }

  // Gate 8: dc must be a positive integer
  if (
    typeof dc !== 'number' ||
    !Number.isInteger(dc) ||
    dc < 1
  ) {
    _baphTaskDebugLog(
      `initiateTask rejected: dc must be a positive integer ` +
      `(received ${JSON.stringify(dc)})`
    );
    ui.notifications?.warn?.('Resolution DC must be a positive integer.');
    return false;
  }

  // Gate 9: spend 1 action — all-or-nothing
  const spent = _spendActionForCombatant(combatant.id, 1, 'task-initiate');
  if (!spent) {
    _baphTaskDebugLog(
      `initiateTask rejected: action spend failed for "${combatant.actor.name}" ` +
      `— insufficient actions remaining`
    );
    ui.notifications?.warn?.(
      `${combatant.actor.name} has no actions available to begin this task.`
    );
    return false;
  }

  // ── All gates passed. Build and store the task. ──────────────────

  const taskId     = `${combatant.id}-dev-${Date.now()}`;
  const startRound = game.combat.round ?? 0;

  // readyToResolve immediately if the task requires only 1 round.
  // The initiation action itself counts as that one committed work unit.
  const readyToResolve = roundsRequired <= 1;

  const publicTask = {
    taskId,
    skillKey:                 'dev',
    taskType:                 taskAction,
    taskName:                 trimmedName,
    roundsCommitted:          1,           // initiation counts as first round
    startedRound:             startRound,
    lastCommittedRound:       startRound,  // prevents double-commit same round
    lastResolvedAttemptRound: null,
    status:                   'active',
    pausedReason:             null,
    readyToResolve,
    createdByUserId:          game.user.id,
    hiddenDataOwnerUserId:    game.user.id,
    metadataPublic:           { taskAction },
    pendingResolutionBonuses: [],
    successfulAidContributors: [],
  };

  const actorTasks = _baphTaskReadActorTasks(combatant.actor);
  actorTasks[taskId] = publicTask;
  await _baphTaskWriteActorTasks(combatant.actor, actorTasks);

  // Hidden data: roundsRequired and DC never go on actor flags.
  const hiddenAll = _baphTaskReadHiddenAll();
  hiddenAll[taskId] = { taskId, roundsRequired, metadataHidden: { dc } };
  await _baphTaskWriteHiddenAll(hiddenAll);

  _baphTaskUpdateCache(combatant.id, actorTasks);

  // Chat notification — no hidden rounds or DC revealed.
  const stateLabel = readyToResolve
    ? 'Task begun and ready to resolve.'
    : 'Task begun. Work in progress.';
  await ChatMessage.create({
    content:
      `<p><strong>${combatant.actor.name}</strong> begins ` +
      `<em>${trimmedName}</em>.</p>` +
      `<p>${stateLabel}</p>`,
    speaker: { alias: 'Baphomet Tasks' },
    whisper: [],
  });

  _baphTaskDebugLog(
    `initiateTask: created "${trimmedName}" (${taskId}) on ${combatant.actor.name} — ` +
    `roundsRequired=${roundsRequired}, readyToResolve=${readyToResolve}, ` +
    `hiddenDC=${dc}, hiddenDataOwner=${game.user.id}`
  );
  console.log(
    `${BAPH_TASK_MODULE_ID} | task-tracker: initiated task "${trimmedName}" ` +
    `(${taskId}) on ${combatant.actor.name}`
  );

  // Refresh UI on all clients via updateActor hook triggered by setFlag.
  // The direct call here ensures the initiating GM's UI updates immediately
  // without waiting for the hook propagation.
  if (typeof _renderActionPanel === 'function') _renderActionPanel();

  return taskId;
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
   HOOK: updateActor — cross-client cache sync (v2.17.1)

   When actor.setFlag() writes task progress (after commitAction),
   Foundry propagates an updateActor hook to ALL connected clients.
   Without this listener, clients that did not make the write keep
   stale data in _baphTaskCache and show outdated widget progress.

   On every baphomet-utils flag change on an actor that is a
   combatant in the current combat:
     1. Rebuild that combatant's cache entry from live actor flags.
     2. Call _renderActionPanel() so the widget reflects fresh data.

   _renderActionPanel is globally available from action-tracker.js,
   which loads before this file. This continues the established
   cross-file global pattern (see: _spendActionForCombatant, _debugLog).

   The hook is safe to register at module load time because
   _baphTaskCache and _baphTaskUpdateCache are available immediately,
   and _renderTaskWidget already guards for !game.baphometTasks.
   ============================================================ */

Hooks.on('updateActor', (actor, changes) => {
  // Fast bail: only interested in baphomet-utils flag updates on actors.
  if (!changes?.flags?.[BAPH_TASK_MODULE_ID]) return;

  const combat = game.combat;
  if (!combat) return;

  // Find the combatant for this actor in the active combat.
  const combatant = combat.combatants.find(c => c.actor?.id === actor.id);
  if (!combatant) return;

  // Rebuild this combatant's cache entry from the now-authoritative actor data.
  const freshTasks = actor.getFlag(BAPH_TASK_MODULE_ID, BAPH_TASK_FLAG_PUBLIC) ?? {};
  _baphTaskUpdateCache(combatant.id, freshTasks);

  _baphTaskDebugLog(
    `updateActor: task cache refreshed for "${combatant.name}" — re-rendering widget`
  );

  // Re-render floating UI on all clients so the widget shows fresh progress.
  _renderActionPanel();
});

/* ============================================================
   PLAYER TASK REQUEST — GM SIDE STATE AND HELPERS (v2.20.0)

   Handles the GM's side of the player task request handshake:
     Player → baphTaskRequest → GM validates + shows approval modal
     GM approves/rejects → baphTaskRequestResponse → player clears state

   _openGMApprovalModal is a global from action-tracker.js (loads first).
   _baphSignalNextGMRequest (also action-tracker.js) calls _baphProcessNextGMRequest
   after the modal closes, allowing sequential request handling.
   ============================================================ */

// Queue of pending player task request payloads awaiting GM attention.
const _baphGMRequestQueue = [];
let _baphGMApprovalActive = false;

/**
 * Validate and dispatch a baphTaskRequest payload received from a player.
 * If a modal is already active, the request is queued for sequential handling.
 * GM-side only.
 */
function _baphHandleTaskRequest(payload) {
  if (!game.user.isGM) return;

  _baphTaskDebugLog(`baphTaskRequest received: ${payload.requestId}`);

  const {
    requestId, requestingUserId, requestingActorId,
    requestingCombatantId, timestamp,
  } = payload;

  if (!requestId || !requestingCombatantId || !requestingUserId) {
    _baphTaskDebugLog('baphTaskRequest rejected: missing required fields');
    return;
  }

  // Reject stale requests older than 70 s (buffer above the 60 s player timeout)
  if (timestamp && Date.now() - timestamp > 70000) {
    _baphTaskDebugLog(`baphTaskRequest ${requestId} expired on arrival — ignoring`);
    return;
  }

  if (_baphGMApprovalActive) {
    _baphGMRequestQueue.push(payload);
    _baphTaskDebugLog(`baphTaskRequest ${requestId} queued (modal already active, queue depth: ${_baphGMRequestQueue.length})`);
    return;
  }

  _baphShowGMApprovalForPayload(payload);
}

/**
 * Validate a single request payload and open the GM approval modal for it.
 */
function _baphShowGMApprovalForPayload(payload) {
  if (!game.user.isGM) return;

  _baphGMApprovalActive = true;

  const {
    requestId, requestingUserId, requestingActorId, requestingCombatantId,
  } = payload;

  // Validate: active combat
  if (!game.combat) {
    _baphTaskDebugLog('baphTaskRequest: no active combat — rejecting request');
    _baphGMApprovalActive = false;
    _baphProcessNextGMRequest();
    return;
  }

  // Validate: combatant exists and actor is consistent
  const combatant = game.combat.combatants.get(requestingCombatantId);
  if (!combatant?.actor) {
    _baphTaskDebugLog(`baphTaskRequest: combatant "${requestingCombatantId}" not found`);
    _baphGMApprovalActive = false;
    _baphProcessNextGMRequest();
    return;
  }
  if (requestingActorId && combatant.actor.id !== requestingActorId) {
    _baphTaskDebugLog(
      `baphTaskRequest: actor mismatch — ` +
      `expected ${requestingActorId}, got ${combatant.actor.id}`
    );
    _baphGMApprovalActive = false;
    _baphProcessNextGMRequest();
    return;
  }

  // Validate: requesting user exists and owns the actor
  const requestingUser = game.users.get(requestingUserId);
  if (!requestingUser) {
    _baphTaskDebugLog(`baphTaskRequest: user ${requestingUserId} not found`);
    _baphGMApprovalActive = false;
    _baphProcessNextGMRequest();
    return;
  }
  const OWNER_LEVEL = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  const ownership   = combatant.actor.ownership ?? {};
  const userLevel   = ownership[requestingUserId] ?? 0;
  const defLevel    = ownership['default'] ?? 0;
  const effLevel    = Math.max(userLevel, defLevel);
  if (!requestingUser.isGM && effLevel < OWNER_LEVEL) {
    _baphTaskDebugLog(
      `baphTaskRequest: user ${requestingUserId} does not own "${combatant.actor.name}" — rejected`
    );
    _baphGMApprovalActive = false;
    _baphProcessNextGMRequest();
    return;
  }

  const isActiveCombatant = (combatant.id === game.combat.combatant?.id);

  const validation = {
    isActiveCombatant,
    userName:  requestingUser.name  ?? 'Unknown Player',
    actorName: combatant.actor.name ?? 'Unknown',
  };

  _baphTaskDebugLog(
    `baphTaskRequest ${requestId}: opening GM approval modal — ` +
    `user="${validation.userName}", isActive=${isActiveCombatant}`
  );

  // _openGMApprovalModal is a global from action-tracker.js (loads before this file).
  if (typeof _openGMApprovalModal === 'function') {
    _openGMApprovalModal(payload, validation);
  } else {
    _baphTaskDebugLog('baphTaskRequest: _openGMApprovalModal not available — aborting');
    _baphGMApprovalActive = false;
    _baphProcessNextGMRequest();
  }
}

/**
 * Process the next queued GM request after the current modal closes.
 * Called from action-tracker.js _baphSignalNextGMRequest() after Approve or Reject.
 */
function _baphProcessNextGMRequest() {
  _baphGMApprovalActive = false;
  if (_baphGMRequestQueue.length === 0) return;
  const next = _baphGMRequestQueue.shift();
  _baphTaskDebugLog(
    `baphTaskRequest: dequeuing next request ${next.requestId} ` +
    `(${_baphGMRequestQueue.length} remaining)`
  );
  _baphShowGMApprovalForPayload(next);
}

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

  /* ── Socket: GM-side adjudication for player-triggered Resolve Task ──
     Registered on all clients; only the GM client processes messages.
     Channel: module.baphomet-utils  (requires "socket": true in module.json)

     Payload received from player:
       combatantId      string   — the Combatant document ID
       taskId           string   — the task being resolved
       rollTotal        number   — captured from pf1ActorRollSkill hook
       requestingUserId string   — the player's User document ID

     Hidden DC is read here on the GM client — never sent to the player.
  ──────────────────────────────────────────────────────────────────── */
  game.socket.on(`module.${BAPH_TASK_MODULE_ID}`, async (message) => {

    /* ── baphTaskRequestResponse (v2.20.0) ───────────────────────────
       GM → player response to a task initiation request.
       Handled by the requesting player's client (non-GM).
       Processed before the GM-only early return below.
    ─────────────────────────────────────────────────────────────────── */
    if (message?.action === 'baphTaskRequestResponse') {
      // _baphHandleRequestResponse is a global from action-tracker.js.
      if (!game.user.isGM && typeof _baphHandleRequestResponse === 'function') {
        _baphHandleRequestResponse(message.payload ?? {});
      }
      return;
    }

    // All remaining socket actions on this channel require a GM client.
    if (!game.user.isGM) return;

    /* ── baphTaskRequest (v2.20.0) ───────────────────────────────────
       Player-initiated task request. GM validates and shows approval modal.
    ─────────────────────────────────────────────────────────────────── */
    if (message?.action === 'baphTaskRequest') {
      _baphHandleTaskRequest(message.payload ?? {});

    /* ── baphTaskResolveAdjudicate ────────────────────────────────────
       Player-triggered task resolution. GM classifies roll total
       against hidden DC and writes outcome. (v2.17.2)
    ─────────────────────────────────────────────────────────────────── */
    } else if (message?.action === 'baphTaskResolveAdjudicate') {
      const { combatantId, taskId, rollTotal, requestingUserId } = message.payload ?? {};

      _baphTaskDebugLog(
        `socket: baphTaskResolveAdjudicate received — ` +
        `combatant=${combatantId}, task=${taskId}, total=${rollTotal}, from=${requestingUserId}`
      );

      if (!Number.isFinite(rollTotal)) {
        _baphTaskDebugLog('socket resolveAdjudicate: rollTotal not finite — rejected');
        return;
      }

      if (!game.combat) {
        _baphTaskDebugLog('socket resolveAdjudicate: no active combat — rejected');
        return;
      }
      const combatant = game.combat.combatants.get(combatantId);
      if (!combatant?.actor) {
        _baphTaskDebugLog(`socket resolveAdjudicate: combatant "${combatantId}" not found — rejected`);
        return;
      }

      const requestingUser = game.users.get(requestingUserId);
      if (!requestingUser) {
        _baphTaskDebugLog(`socket resolveAdjudicate: requesting user "${requestingUserId}" not found — rejected`);
        return;
      }
      const OWNER_LEVEL    = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
      const actorOwnership = combatant.actor.ownership ?? {};
      const userLevel      = actorOwnership[requestingUserId] ?? 0;
      const defaultLevel   = actorOwnership['default'] ?? 0;
      const effectiveLevel = Math.max(userLevel, defaultLevel);
      if (!requestingUser.isGM && effectiveLevel < OWNER_LEVEL) {
        _baphTaskDebugLog(
          `socket resolveAdjudicate: user "${requestingUserId}" cannot control ` +
          `"${combatant.name}" — rejected`
        );
        return;
      }

      const tasks = _baphTaskReadActorTasks(combatant.actor);
      const task  = tasks[taskId];
      if (!task) {
        _baphTaskDebugLog(`socket resolveAdjudicate: task "${taskId}" not found on ${combatant.actor.name}`);
        return;
      }
      if (!task.readyToResolve) {
        _baphTaskDebugLog(`socket resolveAdjudicate: task "${task.taskName}" is not ready to resolve`);
        return;
      }
      if (task.status === 'resolved' || task.status === 'abandoned') {
        _baphTaskDebugLog(`socket resolveAdjudicate: task "${task.taskName}" already ${task.status}`);
        return;
      }

      _baphTaskDebugLog(
        `socket resolveAdjudicate: adjudicating "${task.taskName}" for ${combatant.actor.name} ` +
        `(roll total: ${rollTotal})`
      );
      await _baphTaskAdjudicate(combatant, taskId, task, rollTotal);

    /* ── baphTaskAidAdjudicate ────────────────────────────────────────
       Player-triggered aid on another combatant's ready task.
       GM writes the +2 pending bonus to the target actor's task flags. (v2.18.0)
    ─────────────────────────────────────────────────────────────────── */
    } else if (message?.action === 'baphTaskAidAdjudicate') {
      const {
        aiderCombatantId, aiderActorId, aiderActorName,
        targetCombatantId, targetTaskId,
        requestingUserId, roundAdded,
        rollTotal,   // received from player client; GM performs DC 10 check
      } = message.payload ?? {};

      _baphTaskDebugLog(
        `socket: baphTaskAidAdjudicate received — ` +
        `aider=${aiderCombatantId}, target=${targetCombatantId}, task=${targetTaskId}, ` +
        `rollTotal=${rollTotal}, from=${requestingUserId}, round=${roundAdded}`
      );

      if (!game.combat) {
        _baphTaskDebugLog('socket aidAdjudicate: no active combat — rejected');
        return;
      }

      const aider = game.combat.combatants.get(aiderCombatantId);
      if (!aider?.actor) {
        _baphTaskDebugLog(`socket aidAdjudicate: aider "${aiderCombatantId}" not found — rejected`);
        return;
      }

      const requestingUser = game.users.get(requestingUserId);
      if (!requestingUser) {
        _baphTaskDebugLog(`socket aidAdjudicate: requesting user "${requestingUserId}" not found — rejected`);
        return;
      }
      const OWNER_LEVEL     = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
      const aiderOwnership  = aider.actor.ownership ?? {};
      const aiderUserLevel  = aiderOwnership[requestingUserId] ?? 0;
      const aiderDefLevel   = aiderOwnership['default'] ?? 0;
      const aiderEffLevel   = Math.max(aiderUserLevel, aiderDefLevel);
      if (!requestingUser.isGM && aiderEffLevel < OWNER_LEVEL) {
        _baphTaskDebugLog(
          `socket aidAdjudicate: user "${requestingUserId}" cannot control ` +
          `aider "${aider.name}" — rejected`
        );
        return;
      }

      const targetCombatant = game.combat.combatants.get(targetCombatantId);
      if (!targetCombatant?.actor) {
        _baphTaskDebugLog(`socket aidAdjudicate: target combatant "${targetCombatantId}" not found — rejected`);
        return;
      }

      if (aiderCombatantId === targetCombatantId) {
        _baphTaskDebugLog('socket aidAdjudicate: aider and target are the same combatant — rejected');
        return;
      }

      const targetTasks = _baphTaskReadActorTasks(targetCombatant.actor);
      const targetTask  = targetTasks[targetTaskId];
      if (!targetTask) {
        _baphTaskDebugLog(`socket aidAdjudicate: task "${targetTaskId}" not found on ${targetCombatant.actor.name}`);
        return;
      }
      // Eligibility: task must be active (in-progress or ready), not terminal
      if (targetTask.status !== 'active') {
        _baphTaskDebugLog(`socket aidAdjudicate: target task "${targetTask.taskName}" is not active (${targetTask.status}) — rejected`);
        return;
      }

      // Duplicate check: one successful contribution per helper per pending Resolve attempt
      const existingContributors = targetTask.successfulAidContributors ?? [];
      if (existingContributors.includes(aiderCombatantId)) {
        _baphTaskDebugLog(
          `socket aidAdjudicate: duplicate successful aid from "${aiderCombatantId}" on ` +
          `"${targetTask.taskName}" — rejected`
        );
        return;
      }

      // DC 10 comparison on GM side
      const AID_DC = 10;
      const aidSucceeded = Number.isFinite(rollTotal) && rollTotal >= AID_DC;

      if (aidSucceeded) {
        const bonusEntry = {
          sourceCombatantId: aiderCombatantId,
          sourceActorId:     aiderActorId,
          sourceUserId:      requestingUserId,
          amount:            2,
          label:             'Aid Another',
          roundAdded,
        };
        const existingBonuses = targetTask.pendingResolutionBonuses ?? [];
        targetTask.pendingResolutionBonuses  = [...existingBonuses, bonusEntry];
        targetTask.successfulAidContributors = [...existingContributors, aiderCombatantId];
        targetTasks[targetTaskId]            = targetTask;
        await _baphTaskWriteActorTasks(targetCombatant.actor, targetTasks);
        _baphTaskUpdateCache(targetCombatant.id, targetTasks);

        await ChatMessage.create({
          content:
            `<p><strong>${aiderActorName ?? aider.actor.name}</strong> aids ` +
            `<strong>${targetCombatant.actor.name}</strong>'s ` +
            `<em>${targetTask.taskName}</em>.</p>` +
            `<p>Aid check: <strong>${rollTotal}</strong> vs DC ${AID_DC} — ` +
            `<strong>Success.</strong> Aid queued: +2 to the next resolution roll.</p>`,
          speaker: { alias: 'Baphomet Tasks' },
          whisper: [],
        });

        _baphTaskDebugLog(
          `socket aidAdjudicate: SUCCESS — +2 aid applied to "${targetTask.taskName}" on ` +
          `${targetCombatant.actor.name} (from ${aiderActorName ?? aider.actor.name}, ` +
          `roll ${rollTotal} vs DC ${AID_DC})`
        );
      } else {
        // Failed aid: no bonus, no contributor record added
        await ChatMessage.create({
          content:
            `<p><strong>${aiderActorName ?? aider.actor.name}</strong> attempts to aid ` +
            `<strong>${targetCombatant.actor.name}</strong>'s ` +
            `<em>${targetTask.taskName}</em>.</p>` +
            `<p>Aid check: <strong>${Number.isFinite(rollTotal) ? rollTotal : '?'}</strong> vs DC ${AID_DC} — ` +
            `<strong>Failure.</strong> No bonus queued. Action spent.</p>`,
          speaker: { alias: 'Baphomet Tasks' },
          whisper: [],
        });

        _baphTaskDebugLog(
          `socket aidAdjudicate: FAILURE — aid failed for "${targetTask.taskName}" ` +
          `(from ${aiderActorName ?? aider.actor.name}, roll ${rollTotal} vs DC ${AID_DC})`
        );
      }

    /* ── baphTaskReadinessCheck ─────────────────────────────────────
       Player-driven Continue Task committed public progress.
       GM reads hidden roundsRequired, compares against the authoritative
       public roundsCommitted from actor flags, and flips readyToResolve
       when the threshold is met. Hidden duration never leaves GM-side
       storage. (v2.20.1)
    ─────────────────────────────────────────────────────────────────── */
    } else if (message?.action === 'baphTaskReadinessCheck') {
      const { combatantId, taskId, requestingUserId } = message.payload ?? {};

      _baphTaskDebugLog(
        `socket: baphTaskReadinessCheck received — ` +
        `combatant=${combatantId}, task=${taskId}, from=${requestingUserId}`
      );

      if (!game.combat) {
        _baphTaskDebugLog('socket readinessCheck: no active combat — rejected');
        return;
      }

      const rcCombatant = game.combat.combatants.get(combatantId);
      if (!rcCombatant?.actor) {
        _baphTaskDebugLog(`socket readinessCheck: combatant "${combatantId}" not found — rejected`);
        return;
      }

      const rcUser = game.users.get(requestingUserId);
      if (!rcUser) {
        _baphTaskDebugLog(`socket readinessCheck: user "${requestingUserId}" not found — rejected`);
        return;
      }
      const RC_OWNER_LEVEL    = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
      const rcActorOwnership  = rcCombatant.actor.ownership ?? {};
      const rcUserLevel       = rcActorOwnership[requestingUserId] ?? 0;
      const rcDefaultLevel    = rcActorOwnership['default'] ?? 0;
      const rcEffectiveLevel  = Math.max(rcUserLevel, rcDefaultLevel);
      if (!rcUser.isGM && rcEffectiveLevel < RC_OWNER_LEVEL) {
        _baphTaskDebugLog(
          `socket readinessCheck: user "${requestingUserId}" cannot control ` +
          `"${rcCombatant.name}" — rejected`
        );
        return;
      }

      // Read authoritative public task state directly from actor flags (not payload).
      const rcTasks = _baphTaskReadActorTasks(rcCombatant.actor);
      const rcTask  = rcTasks[taskId];
      if (!rcTask) {
        _baphTaskDebugLog(`socket readinessCheck: task "${taskId}" not found on ${rcCombatant.actor.name} — rejected`);
        return;
      }
      if (rcTask.status !== 'active') {
        _baphTaskDebugLog(`socket readinessCheck: task "${rcTask.taskName}" is not active (${rcTask.status}) — no-op`);
        return;
      }
      if (rcTask.readyToResolve) {
        _baphTaskDebugLog(`socket readinessCheck: task "${rcTask.taskName}" already readyToResolve — no-op`);
        return;
      }

      // Read hidden data from GM user flag. Hidden duration never leaves GM-side storage.
      const rcHiddenAll = _baphTaskReadHiddenAll();
      const rcHidden    = rcHiddenAll[taskId];
      if (!rcHidden?.roundsRequired) {
        _baphTaskDebugLog(
          `socket readinessCheck WARNING: no hidden data for task "${taskId}" on this GM client — ` +
          `readyToResolve not evaluated`
        );
        console.warn(
          `${BAPH_TASK_MODULE_ID} | task-tracker: ` +
          `socket readinessCheck — no hidden data for task "${taskId}". ` +
          `Was this task created by a different GM user?`
        );
        return;
      }

      if (rcTask.roundsCommitted >= rcHidden.roundsRequired) {
        rcTask.readyToResolve = true;
        rcTasks[taskId] = rcTask;
        await _baphTaskWriteActorTasks(rcCombatant.actor, rcTasks);
        _baphTaskUpdateCache(rcCombatant.id, rcTasks);

        _baphTaskDebugLog(
          `socket readinessCheck: "${rcTask.taskName}" is ready to resolve ` +
          `(${rcTask.roundsCommitted}/${rcHidden.roundsRequired} rounds)`
        );
        console.log(
          `${BAPH_TASK_MODULE_ID} | task-tracker: ` +
          `socket readinessCheck — "${rcTask.taskName}" is ready to resolve ` +
          `(${rcTask.roundsCommitted}/${rcHidden.roundsRequired} rounds)`
        );
      } else {
        _baphTaskDebugLog(
          `socket readinessCheck: "${rcTask.taskName}" not yet ready ` +
          `(${rcTask.roundsCommitted}/${rcHidden.roundsRequired} rounds) — no-op`
        );
      }
    }
  });

  game.baphometTasks = {
    createTask:   _baphTaskCreate,
    initiateTask: _baphTaskInitiate,
    getTask:      _baphTaskGet,
    getTasks:     _baphTaskGetAll,
    commitAction: _baphTaskCommit,
    pauseTask:    _baphTaskPause,
    resumeTask:   _baphTaskResume,
    abandonTask:  _baphTaskAbandon,
    resolveTask:  _baphTaskResolve,
    aidTask:      _baphTaskAid,
  };

  console.log(`${BAPH_TASK_MODULE_ID} | task-tracker v1.0: game.baphometTasks API ready`);
});
