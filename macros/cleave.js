/* ============================================================================
 * baphomet-utils — PF1.5 CLEAVE declare macro (token-driven, post-kill)
 * ----------------------------------------------------------------------------
 * CANONICAL SOURCE OF TRUTH: macros/cleave.js
 *   SYNC_STAMP: 2026-07-07
 *   The in-world Foundry macro "Cleave" must be kept byte-identical to this file.
 *   After editing either copy, sync the other and bump SYNC_STAMP. Drift check:
 *   see README.md here.
 *
 * WHAT IT DOES (PF1.5 / GOAL_v2.28.0): declares a Cleave follow-up so the action
 *   tracker charges its correct cost of 0 ACTIONS (a FREE Strike — 0 swings, no
 *   MAP advance), instead of the default 1. pf1 11.11 has no marker to auto-detect
 *   a Cleave (it is an ordinary Strike; live probe 2026-06-26), so this macro sets
 *   an actor-scoped intent object (globalThis.baphometCleave = { actorId }) that
 *   action-tracker.js reads to SKIP the action spend for that Strike, then rolls
 *   the chosen weapon. The intent is cleared by OBJECT IDENTITY in finally.
 *
 * REACTIVE (POST-KILL): Cleave triggers after you drop an adjacent foe. Run this
 *   AFTER the kill, against the adjacent target. Token-driven: operates on the one
 *   selected token, so a single button serves every character.
 *
 * FEAT-GATED: aborts if the actor has no feat matching /cleave/i.
 *
 * TRUST MODEL: the "you actually dropped a foe" and "the new target is adjacent"
 *   conditions are the player's declaration — the macro does not (and cannot
 *   reliably) enforce them. Click it only on a legitimate Cleave.
 *
 * KNOWN LIMITATION — MAP IS MANUAL. (Cleave itself adds no MAP.)
 *
 * NOTE: only meaningful while the Attack Auto-Spend setting is ON.
 * ========================================================================== */
(async () => {
  // 1) exactly one controlled token
  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length !== 1) {
    return ui.notifications.warn(`Cleave: select exactly one token (you have ${controlled.length}).`);
  }
  const actor = controlled[0].actor;
  if (!actor) return ui.notifications.error("Cleave: the selected token has no actor.");

  // 2) feat gate (name match — mirrors the existing Combat Reflexes check)
  const hasFeat = actor.items.some((i) => i.type === "feat" && /cleave/i.test(i.name));
  if (!hasFeat) {
    return ui.notifications.warn(`${actor.name} has no Cleave feat — macro aborted.`);
  }

  // 3) resolve the weapon BEFORE setting any intent
  const weapons = actor.items.filter((i) => i.type === "weapon" || i.type === "attack");
  if (weapons.length === 0) {
    return ui.notifications.warn(`${actor.name} has no weapon/attack items to use.`);
  }
  let weapon = weapons[0];
  if (weapons.length > 1) {
    const chosenId = await foundry.applications.api.DialogV2.wait({
      window: { title: `Cleave — choose ${actor.name}'s weapon` },
      content: "<p>Which (melee) weapon for the Cleave follow-up?</p>",
      buttons: weapons.map((w, idx) => ({
        action: w.id,
        label: `${w.name} (${w.type})`,
        default: idx === 0,
        callback: () => w.id,
      })),
      rejectClose: false, // dismissed picker resolves to null (no throw)
    });
    if (!chosenId) return; // cancelled — no intent was set
    weapon = actor.items.get(chosenId) ?? weapon;
  }

  // 4) declare intent (actor-scoped, per-invocation) -> roll -> clear by identity
  const intent = { actorId: actor.id };
  globalThis.baphometCleave = intent;
  try {
    await weapon.use({ skipDialog: true }); // action tracker SKIPS the spend (0 actions)
  } finally {
    if (globalThis.baphometCleave === intent) globalThis.baphometCleave = null;
  }
  // REMINDER: a Cleave follow-up is a free Strike (0 actions, 0 swings, no MAP advance).
})();
