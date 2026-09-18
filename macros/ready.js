/* ============================================================================
 * baphomet-utils — PF1.5 READY declare macro (token-driven)
 * ----------------------------------------------------------------------------
 * CANONICAL SOURCE OF TRUTH: macros/ready.js
 *   SYNC_STAMP: 2026-09-18
 *   The in-world Foundry macro "Ready" must be kept byte-identical to this
 *   file. After editing either copy, sync the other and bump SYNC_STAMP.
 *   Drift check: see README.md here.
 *
 * WHAT IT DOES (PF1.5 / GOAL_v2.37.8_DECLARE_AND_WITHDRAW FIX-1): declares
 *   Ready so the action tracker charges its correct cost of 2 ACTIONS. Ready
 *   rolls nothing, so pf1PreActionUse never hears about it — this macro
 *   spends directly through the public game.baphometActions API, the same
 *   approach Total Defense and Withdraw use (Charge's own approach hangs its
 *   declaration on a weapon swing it was going to make anyway; these three
 *   have no weapon).
 *
 * TOKEN-DRIVEN: operates on the one selected token, so a single button serves
 *   every character.
 *
 * NO FEAT GATE: Readying an action is universal (everyone can ready).
 *
 * REACTION WARNING (canon §2 — should warn, not should block): if the
 *   Reaction pip was already spent BEFORE this declare, this macro warns
 *   that the readied action has nothing to trigger on, but still spends the
 *   2 actions and does NOT block the declare. Ready reserves nothing at
 *   declare time — the off-turn trigger path already routes readied
 *   ATTACKS to the Reaction (action-tracker.js:3929); readied spells are
 *   TD-34's and out of scope here.
 *
 * ALL-OR-NOTHING: the public spendAction is all-or-nothing
 *   (action-tracker.js:2552) — an attempted 2-spend on fewer than 2
 *   remaining actions returns false and changes nothing. This macro checks
 *   actionsRemaining first and never reports success on a false return.
 * ========================================================================== */
(async () => {
  // 1) exactly one controlled token
  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length !== 1) {
    return ui.notifications.warn(`baphomet-utils | Ready: select exactly one token (you have ${controlled.length}).`);
  }
  const token = controlled[0];
  const actor = token.actor;
  if (!actor) return ui.notifications.error(`baphomet-utils | Ready: the selected token has no actor.`);

  // 2) no feat gate — Ready is universal.

  // 3) resolve this token's combatant in the active combat
  const combatant = game.combat?.combatants?.find((c) => c.tokenId === token.id)
    ?? game.combat?.combatants?.find((c) => c.actorId === actor.id);
  if (!combatant) {
    return ui.notifications.warn(`baphomet-utils | Ready: ${actor.name} is not in the active combat.`);
  }

  const state = game.baphometActions.getState(combatant.id);
  if (!state) {
    return ui.notifications.warn(`baphomet-utils | Ready: no action-tracker state for ${actor.name} yet.`);
  }

  // 4) not enough actions — the public spend is all-or-nothing, so an attempted 2-spend
  //    on 1 pip would return false and change nothing. Warn and spend nothing rather than
  //    attempt it.
  if (state.actionsRemaining < 2) {
    return ui.notifications.warn(
      `baphomet-utils | Ready: ${actor.name} has only ${state.actionsRemaining} action(s) left — Ready needs 2.`
    );
  }

  // 5) capture Reaction availability BEFORE the spend — Ready reserves nothing at declare
  //    time; it only warns if there is nothing left to trigger on.
  const hadReaction = state.reactionAvailable;

  // 6) spend 2. Do not report success on a false return (all-or-nothing).
  const spent = game.baphometActions.spendAction(combatant.id, 2);
  if (!spent) {
    return ui.notifications.warn(`baphomet-utils | Ready: ${actor.name}'s Ready could not be declared — the spend was refused.`);
  }

  // 7) warn (do not block) when the Reaction was already gone before this declare.
  if (!hadReaction) {
    ui.notifications.warn(
      `baphomet-utils | Ready: ${actor.name} has no Reaction left — the readied action will have nothing to trigger on.`
    );
  }
})();
