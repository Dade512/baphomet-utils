/* ============================================================================
 * baphomet-utils — PF1.5 ADMINISTER POTION declare macro (token-driven)
 * ----------------------------------------------------------------------------
 * CANONICAL SOURCE OF TRUTH: macros/administer-potion.js
 *   SYNC_STAMP: 2026-10-28
 *   The in-world Foundry macro "Administer Potion" must be kept byte-identical to
 *   this file. After editing either copy, sync the other and bump SYNC_STAMP.
 *   Drift check: see README.md here.
 *
 * WHAT IT DOES (GOAL_v2.48.0 FIX-4, TD-98 item 5; canon H:563, MR:231): administering
 *   a potion to a creature that cannot drink it (an unconscious ally) costs THREE
 *   actions - draw, kneel, administer - not the two of drinking one's own. The
 *   selected token is the giver. This macro sets an actor-scoped intent object
 *   (globalThis.baphometAdminister = { actorUuid }) that action-tracker.js
 *   `_deriveConsumableActionCost` reads for the potion's cost, uses the potion
 *   (potion.use({ skipDialog: true })), and clears the intent by OBJECT IDENTITY in
 *   finally - the intent never outlives the use, so a forgotten declaration cannot
 *   tax a later potion. It then posts one public chat line saying so and that it
 *   provokes attacks of opportunity (provoking is text; the module does not
 *   resolve it). The recipient's seat is never involved: the GM applies the
 *   potion's effect to the recipient by hand.
 *
 * REFUSES (nothing used, nothing charged): the giver is not in the active
 *   combat; it is not the giver's own turn (never off turn, never the Reaction);
 *   fewer than 3 NORMAL actions remain (the Haste action is never part of a
 *   multi-action activity, H:415 / MR:114); the giver carries no potion or oil
 *   (pf1 labels the subType "Potion/Oil").
 *
 * TOKEN-DRIVEN: operates on the one controlled token, so a single button serves
 *   every character. Any player may run it.
 * ========================================================================== */
(async () => {
  // 1) exactly one controlled token (the giver)
  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length !== 1) {
    return ui.notifications.warn(`Administer Potion: select exactly one token (you have ${controlled.length}).`);
  }
  const token = controlled[0];
  const actor = token.actor;
  if (!actor) return ui.notifications.error('Administer Potion: the selected token has no actor.');

  const refuse = (reason) => ui.notifications.warn(`${actor.name} cannot Administer Potion — ${reason}`);

  // 2) the creature's combatant in the active, started combat (by token id, then by actor uuid)
  const combat = game.combats?.active ?? null;
  const combatant = combat?.combatants?.find((c) => c.tokenId === token.id)
    ?? combat?.combatants?.find((c) => c.actor?.uuid === actor.uuid);
  if (!combat || !combat.started || !combatant) return refuse('not in the active combat.');

  // 3) it must be the giver's own turn (never off turn, never the Reaction)
  if (combat.combatant?.id !== combatant.id) {
    return refuse('it is not their turn — the giver pays on its own turn; nothing charged.');
  }

  // 4) three NORMAL actions free (a locked pip is not free; the Haste pip is not counted)
  const left = game.baphometActions?.getState?.(combatant.id)?.actionsRemaining ?? 0;
  if (left < 3) {
    return refuse(`it needs 3 actions: ${left} of 3 remaining; nothing charged. The GM rules.`);
  }

  // 5) the potion: the giver's consumables of subType potion (pf1's Potion/Oil)
  const potions = actor.items.filter((i) => i.type === 'consumable' && i.system?.subType === 'potion');
  if (potions.length === 0) return refuse('they carry no potion or oil.');
  let potion = null;
  if (typeof scope === 'object' && scope && scope.itemId) {
    potion = potions.find((i) => i.id === scope.itemId) ?? null;
  }
  if (!potion && potions.length === 1) potion = potions[0];
  if (!potion) {
    const chosenId = await foundry.applications.api.DialogV2.wait({
      window: { title: `Administer Potion — choose ${actor.name}'s potion` },
      content: '<p>Which potion or oil is being administered?</p>',
      buttons: potions.map((p, idx) => ({
        action: p.id,
        label: p.name,
        default: idx === 0,
        callback: () => p.id
      })),
      rejectClose: false // dismissed picker resolves to null (no throw)
    });
    if (!chosenId) return; // cancelled — no intent was set
    potion = actor.items.get(chosenId) ?? null;
    if (!potion) return;
  }

  // 6) declare intent (actor-scoped, per-invocation) -> use -> clear by identity
  const intent = { actorUuid: actor.uuid };
  globalThis.baphometAdminister = intent;
  let r;
  try {
    // the action tracker charges 3 actions while this intent is set; r is an ActionUse on a
    // confirmed use, undefined / null if cancelled, or a truthy { err, code } when a requirement failed
    r = await potion.use({ skipDialog: true });
  } finally {
    if (globalThis.baphometAdminister === intent) globalThis.baphometAdminister = null;
  }

  // 7) only on a confirmed use: one public chat line
  if (r && r.err === undefined) {
    const giver = foundry.utils.escapeHTML(actor.name);
    const what = foundry.utils.escapeHTML(String(potion.name));
    await ChatMessage.create({
      content: `<p><strong>Administer Potion:</strong> ${giver} administers ${what} to a creature that cannot drink it — 3 actions; this provokes attacks of opportunity.</p>`,
      speaker: ChatMessage.getSpeaker({ actor, token: token.document }),
      flags: { 'baphomet-utils': { administerPotion: true } }
    });
  }
})();
