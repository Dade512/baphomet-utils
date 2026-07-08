/* ============================================================================
 * baphomet-utils — PF1.5 Two-Weapon Fighting STRIKE macro (tier-aware)
 * ----------------------------------------------------------------------------
 * CANONICAL SOURCE OF TRUTH: macros/twf-tier-aware.js
 *   SYNC_STAMP: 2026-07-07
 *   The in-world Foundry macro "Two-Weapon Fighting" must be kept byte-identical
 *   to this file. After editing either copy, sync the other and bump SYNC_STAMP.
 *   (The earlier -4/-4 drift happened because the macro lived ONLY in world data,
 *   with no repo copy and no version marker.) Drift check: see README.md here.
 *
 * WHAT IT DOES (PF1.5 / R6): rolls a main-hand Strike, then — if the per-turn
 *   off-hand pool has room — ONE off-hand bonus swing, applying the correct
 *   per-hand two-weapon to-hit penalty via globalThis.baphometTWF (consumed by
 *   action-tracker.js pf1PreAttackRoll). The off-hand swing rides the main Strike's
 *   action (no extra action).
 *
 * v2.30.0 — PER-TURN OFF-HAND BUDGET (Model A). The off-hand bonus is a PER-TURN
 *   pool (canon §4 Incremental Mastery): base = 1 / improved = 2 / greater = 3
 *   off-hand swings PER TURN, NOT per Strike. Each press makes the main-hand Strike
 *   plus AT MOST ONE off-hand swing, consuming the pool; the pool drains the earliest
 *   Strikes and later Strikes that turn are main-hand-only. The budget is reserved
 *   through game.baphometActions.reserveOffHandSwing (committed on a real swing,
 *   rolled back if the off-hand dialog is cancelled). Graceful fallback: if the budget
 *   API / combatant is unavailable, the main-hand Strike still happens.
 *
 * PENALTY: base -mag/-mag; improved 0/-mag; greater 0/0; mag = 2 if the OFF-HAND
 *   weapon is light, else 4. (Incremental Mastery accuracy penalty — separate from MAP.)
 * ABORTS if the actor has no TWF feat — untrained two-weapon fighting is not
 *   canonized in PF1.5; do NOT import the PF1 -6/-10 untrained penalty.
 *
 * v2.30.0 — MAP IS NOW AUTOMATIC: action-tracker.js applies the Multiple Attack
 *   Penalty to each weapon Strike this turn (3rd swing -5, 4th+ cumulative -5),
 *   stacking with the two-weapon penalty above. The GM no longer applies MAP by hand
 *   (requires the "MAP / Swing Tracking" setting ON, default ON).
 *
 * PER-CHARACTER: the actor name + weapon item IDs below are hardcoded (by design,
 *   so it's obvious what to fill in). To add another dual-wielder, copy this file,
 *   change the three IDs, and create a matching in-world macro.
 *
 * IDs must point at type:weapon items (type:attack items have weaponSubtype null).
 * ========================================================================== */
(async () => {
  const ACTOR_NAME   = "Pants";
  const MAIN_HAND_ID = "TJN0eQxAkYb2I7WG"; // Shortsword (R) — type:weapon
  const OFF_HAND_ID  = "XUi5mKuViHovZ92K"; // Dagger (L) — type:weapon

  const actor = game.actors.getName(ACTOR_NAME);
  if (!actor) return ui.notifications.error(`No actor named "${ACTOR_NAME}".`);

  const mainHand = actor.items.get(MAIN_HAND_ID);
  const offHand  = actor.items.get(OFF_HAND_ID);
  if (!mainHand) return ui.notifications.error(`Main-hand weapon ${MAIN_HAND_ID} not on ${actor.name}.`);
  if (!offHand)  return ui.notifications.error(`Off-hand weapon ${OFF_HAND_ID} not on ${actor.name}.`);

  // Tier from @bFlags (set by the "Two-Weapon Fighting (PF1.5)" feat-chain).
  const bf = actor.getRollData()?.bFlags ?? {};
  const tier = bf.twfGreater ? "greater" : bf.twfImproved ? "improved" : bf.twf ? "base" : null;
  if (!tier) {
    return ui.notifications.warn(
      `${actor.name} has no PF1.5 Two-Weapon Fighting feat — macro aborted ` +
      `(untrained two-weapon fighting is a manual/GM ruling).`
    );
  }

  // Light off-hand halves the penalty magnitude. Warn on the silent -4 trap.
  if (offHand.system?.weaponSubtype == null) {
    ui.notifications.warn(
      `${offHand.name}: weaponSubtype is empty — treating as non-light (-4). ` +
      `Confirm this is a type:weapon item, not a type:attack item.`
    );
  }
  const mag = offHand.system?.weaponSubtype === "light" ? 2 : 4;

  let mainPen = "0", offPen = "0";
  if (tier === "base")          { mainPen = String(-mag); offPen = String(-mag); }
  else if (tier === "improved") { mainPen = "0";          offPen = String(-mag); }
  else                          { mainPen = "0";          offPen = "0"; } // greater

  // Resolve the actor's combatant for the per-turn off-hand budget (Model A, v2.30.0).
  const combatant = game.combat?.combatants?.find(c => c.actor?.id === actor.id) ?? null;
  const api = game.baphometActions;

  globalThis.baphometTWF = { active: true, offhand: false, mainPenalty: mainPen, offPenalty: offPen };
  try {
    await mainHand.use({ skipDialog: true });               // main-hand Strike (1 action; 1 swing)

    // ONE off-hand swing this press, only if the per-turn pool (1/2/3 by tier) has room.
    if (combatant && api?.reserveOffHandSwing) {
      const token = api.reserveOffHandSwing(combatant.id, tier);
      if (!token) {
        ui.notifications.info(`${actor.name}: off-hand pool spent this turn — main-hand only.`);
      } else {
        globalThis.baphometTWF.offhand = true;              // off-hand swing rides free + takes offPenalty
        let result;
        try {
          result = await offHand.use({ skipDialog: true });
        } finally {
          globalThis.baphometTWF.offhand = false;
        }
        // Commit on a real swing (use() -> ActionUse); rollback the reservation if the
        // dialog was cancelled (use() -> undefined) so the pool isn't wrongly spent.
        if (!result) api.rollbackOffHandSwing?.(token);
      }
    } else {
      // Graceful fallback — main-hand Strike already happened; never throw after it.
      ui.notifications.warn(`${actor.name}: action-tracker budget API unavailable — off-hand not tracked (main-hand only).`);
    }
  } finally {
    globalThis.baphometTWF = { active: false, offhand: false, mainPenalty: "0", offPenalty: "0" };
  }
})();
