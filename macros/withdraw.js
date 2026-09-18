/* ============================================================================
 * baphomet-utils — PF1.5 WITHDRAW declare macro (token-driven)
 * ----------------------------------------------------------------------------
 * CANONICAL SOURCE OF TRUTH: macros/withdraw.js
 *   SYNC_STAMP: 2026-09-18
 *   The in-world Foundry macro "Withdraw" must be kept byte-identical to this
 *   file. After editing either copy, sync the other and bump SYNC_STAMP.
 *   Drift check: see README.md here.
 *
 * WHAT IT DOES (PF1.5 / GOAL_v2.37.8_DECLARE_AND_WITHDRAW FIX-3): declares
 *   Withdraw, which canon costs ALL REMAINING actions (ruling 1, including a
 *   live Haste bonus pip) — a claim the public spendAction cannot express
 *   (it is count-based and its allowBonus is hard-wired false). This macro
 *   calls the new public game.baphometActions.endTurnActions(combatantId)
 *   instead, which zeroes both pools by its own path without widening
 *   _spendActionCore's allowBonus parameter. Leaves the Reaction pip and the
 *   Combat Reflexes (jade) pool untouched — Withdraw ends the turn; it does
 *   not surrender off-turn capability.
 *
 * FLEEING REFUSAL (ruling 3): a creature carrying an ACTIVE buff Item whose
 *   flags['baphomet-utils'].conditionKey === 'fleeing' is already running
 *   and does not get to Withdraw as well. Checked BEFORE any spend; on a
 *   match this macro warns and returns, spending nothing at all. Fleeing has
 *   no pf1 condition key and no action-loss semantics of its own — this
 *   macro reads the marker directly and _readConditionActionLoss's switch is
 *   not touched.
 *
 * TOKEN-DRIVEN: operates on the one selected token, so a single button serves
 *   every character.
 *
 * NO FEAT GATE: Withdraw is universal (everyone can withdraw).
 *
 * NOT AUTOMATED (explicitly out of scope, GOAL_v2.37.8): AoO / provoke
 *   adjudication for the withdrawing creature's movement — that stays a
 *   table call.
 * ========================================================================== */
(async () => {
  // 1) exactly one controlled token
  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length !== 1) {
    return ui.notifications.warn(`baphomet-utils | Withdraw: select exactly one token (you have ${controlled.length}).`);
  }
  const token = controlled[0];
  const actor = token.actor;
  if (!actor) return ui.notifications.error(`baphomet-utils | Withdraw: the selected token has no actor.`);

  // 2) no feat gate — Withdraw is universal.

  // 3) ruling 3 — refuse outright on a Fleeing creature, before any spend.
  const isFleeing = actor.items.some((i) => i.type === "buff"
    && i.system?.active
    && i.flags?.["baphomet-utils"]?.conditionKey === "fleeing");
  if (isFleeing) {
    return ui.notifications.warn(`baphomet-utils | Withdraw: ${actor.name} is Fleeing and cannot also Withdraw.`);
  }

  // 4) resolve this token's combatant in the active combat
  const combatant = game.combat?.combatants?.find((c) => c.tokenId === token.id)
    ?? game.combat?.combatants?.find((c) => c.actorId === actor.id);
  if (!combatant) {
    return ui.notifications.warn(`baphomet-utils | Withdraw: ${actor.name} is not in the active combat.`);
  }

  // 5) declare -> zero the turn, including any live Haste bonus pip (ruling 1). The
  //    Reaction pip and the Combat Reflexes (jade) pool are untouched by design.
  const zeroed = game.baphometActions.endTurnActions(combatant.id);
  if (!zeroed) {
    ui.notifications.warn(`baphomet-utils | Withdraw: ${actor.name} had no remaining actions to spend.`);
  }
})();
