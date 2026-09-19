/* ============================================================================
 * baphomet-utils — PF1.5 TOTAL DEFENSE declare macro (token-driven)
 * ----------------------------------------------------------------------------
 * CANONICAL SOURCE OF TRUTH: macros/total-defense.js
 *   SYNC_STAMP: 2026-09-18
 *   The in-world Foundry macro "Total Defense" must be kept byte-identical to
 *   this file. After editing either copy, sync the other and bump SYNC_STAMP.
 *   Drift check: see README.md here.
 *
 * WHAT IT DOES (PF1.5 / GOAL_v2.37.8_DECLARE_AND_WITHDRAW FIX-2): declares
 *   Total Defense so the action tracker charges its correct cost of 1
 *   ACTION. Total Defense rolls nothing, so pf1PreActionUse never hears
 *   about it — this macro spends directly through the public
 *   game.baphometActions API, the same approach Ready and Withdraw use
 *   (Charge's own approach hangs its declaration on a weapon swing it was
 *   going to make anyway; these three have no weapon). On a successful
 *   spend only, applies a +4 dodge AC buff Item with duration
 *   { units: 'round', value: '1', end: 'turnStart' } — ruling 4 (dodge, not
 *   untyped: pf1.config.bonusTypes carries 'dodge' and dodge bonuses stack)
 *   and the 2026-09-15 duration amendment (the buff must live through the
 *   enemies' turns and lift at THIS actor's own next turn start; a units of
 *   'turn' duration would instead deactivate at the end of THIS actor's own
 *   turn, protecting nobody from anything).
 *
 * TOKEN-DRIVEN: operates on the one selected token, so a single button serves
 *   every character.
 *
 * NO FEAT GATE: Total Defense is universal (everyone can take it).
 *
 * STALE-BUFF SWEEP: any prior Item carrying this macro's own flag
 *   (flags['baphomet-utils'].totalDefenseBuff === true) is deleted before a
 *   new one is created, mirroring charge.js's own sweep, so repeated
 *   declares across turns never leave inert residue.
 * ========================================================================== */
(async () => {
  // 1) exactly one controlled token
  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length !== 1) {
    return ui.notifications.warn(`baphomet-utils | Total Defense: select exactly one token (you have ${controlled.length}).`);
  }
  const token = controlled[0];
  const actor = token.actor;
  if (!actor) return ui.notifications.error(`baphomet-utils | Total Defense: the selected token has no actor.`);

  // 2) no feat gate — Total Defense is universal.

  // 3) resolve this token's combatant in the active combat
  const combatant = game.combat?.combatants?.find((c) => c.tokenId === token.id)
    ?? game.combat?.combatants?.find((c) => c.actorId === actor.id);
  if (!combatant) {
    return ui.notifications.warn(`baphomet-utils | Total Defense: ${actor.name} is not in the active combat.`);
  }

  // 4) declare -> spend 1 -> apply the buff ONLY on a successful spend.
  const spent = game.baphometActions.spendAction(combatant.id, 1);
  if (!spent) {
    return ui.notifications.warn(`baphomet-utils | Total Defense: ${actor.name} has no action left to declare Total Defense.`);
  }

  // 5) sweep any prior Total Defense buff before adding a new one so repeated declares
  //    across turns don't accumulate inert residue (charge.js's own sweep, same shape).
  const stale = actor.items.filter((i) => i.flags?.["baphomet-utils"]?.totalDefenseBuff === true);
  if (stale.length > 0) {
    await actor.deleteEmbeddedDocuments("Item", stale.map((i) => i.id));
  }

  // 6) ruling 4 (dodge) + the 2026-09-15 duration amendment (round/turnStart, not turn) —
  //    both non-negotiable per the goal contract.
  await actor.createEmbeddedDocuments("Item", [{
    name: "Total Defense (+4 dodge AC)",
    type: "buff",
    img: "icons/svg/shield.svg",
    system: {
      active: true,
      subType: "temp",
      duration: { units: "round", value: "1", end: "turnStart" },
      changes: [{ formula: "4", target: "ac", type: "dodge" }]
    },
    flags: { "baphomet-utils": { totalDefenseBuff: true } }
  }]);
})();
