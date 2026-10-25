/* ============================================================================
 * baphomet-utils — PF1.5 DELAY declare macro (token-driven)
 * ----------------------------------------------------------------------------
 * CANONICAL SOURCE OF TRUTH: macros/delay.js
 *   SYNC_STAMP: 2026-10-24
 *   The in-world Foundry macro "Delay" must be kept byte-identical to this
 *   file. After editing either copy, sync the other and bump SYNC_STAMP.
 *   Drift check: see README.md here.
 *
 * WHAT IT DOES (GOAL_v2.46.1_TURN_ENGINE FIX-7, canon H:40): declares Delay.
 *   Your turn starts when you Delay: your actions and Reaction refresh then
 *   (already done at your turn's start) and nothing refreshes again when you
 *   act later in the round. End-of-turn effects (the Frightened and Fleeing
 *   countdowns) happen when your delayed turn actually ends, once; a creature
 *   still delaying when the round wraps forfeited its turn, and its countdown
 *   runs then. This macro asks the module to mark the creature as delaying
 *   (game.baphometActions.declareDelay) and then passes the turn
 *   (combat.nextTurn()). The GM moves the delayer's initiative by hand when it
 *   acts - Delay is the only thing that changes your place in the order.
 *
 * REFUSES (no request, no turn change): the creature is not in the active
 *   combat; it is not the current combatant; it already Delayed this round.
 *   It does NOT refuse after actions were spent (H:40 is silent; the remaining
 *   pips carry to the re-entry unrefreshed).
 *
 * TOKEN-DRIVEN: operates on the one controlled token, so a single button
 *   serves every character. NO FEAT GATE: Delay is universal.
 * ========================================================================== */
(async () => {
  // 1) exactly one controlled token
  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length !== 1) {
    return ui.notifications.warn(`baphomet-utils | Delay: select exactly one token (you have ${controlled.length}).`);
  }
  const token = controlled[0];
  const actor = token.actor;
  if (!actor) return ui.notifications.error(`baphomet-utils | Delay: the selected token has no actor.`);

  const refuse = (reason) => ui.notifications.warn(`${actor.name} cannot Delay — ${reason}`);

  // 2) the creature's combatant in the active combat (by token id, then by actor uuid)
  const combat = game.combats?.active ?? null;
  const combatant = combat?.combatants?.find((c) => c.tokenId === token.id)
    ?? combat?.combatants?.find((c) => c.actor?.uuid === actor.uuid);
  if (!combat || !combatant) return refuse('not in the active combat.');

  // 3) it must be this creature's turn
  if (combat.combatant?.id !== combatant.id) return refuse('it is not their turn.');

  // 4) one Delay per round
  const api = game.baphometActions;
  if (typeof api?.declareDelay !== 'function') {
    return ui.notifications.warn(`baphomet-utils | Delay: this needs baphomet-utils v2.46.1 or later (declareDelay is missing).`);
  }
  const round = String(combat.round);
  if (api.turnLedger?.(combat.id)?.rounds?.[round]?.delaying?.[combatant.id]) return refuse('already Delayed this round.');

  // 5) ask the module to mark the delay (through the GM when this is a player's client), then pass the turn
  const result = await api.declareDelay(combatant.id);
  // v2.47.0: with no GM connected the module has shown its one quiet notice and answers 'no-active-gm' - say nothing more.
  if (result?.ok !== true && result?.reason === 'no-active-gm') return;
  if (!result?.ok) return refuse(`the GM refused it (${result?.reason ?? 'no reason given'}).`);
  await combat.nextTurn();
  ui.notifications.info(`${actor.name} Delays — the GM moves their initiative when they act.`);
})();
