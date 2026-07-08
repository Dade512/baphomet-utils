/* ============================================================================
 * baphomet-utils — PF1.5 VITAL STRIKE declare macro (token-driven)
 * ----------------------------------------------------------------------------
 * CANONICAL SOURCE OF TRUTH: macros/vital-strike.js
 *   SYNC_STAMP: 2026-07-07
 *   The in-world Foundry macro "Vital Strike" must be kept byte-identical to this
 *   file. After editing either copy, sync the other and bump SYNC_STAMP. Drift
 *   check: see README.md here.
 *
 * WHAT IT DOES (PF1.5 / GOAL_v2.28.0 + GOAL_v2.31.0): declares a Vital Strike so
 *   the action tracker charges its correct cost of 2 ACTIONS (not 1). pf1 11.11
 *   exposes no Vital Strike marker to auto-detect (live probe 2026-06-26), so this
 *   macro sets an actor-scoped intent object (globalThis.baphometVitalStrike =
 *   { actorId }) that action-tracker.js `_deriveActionUseCost` reads for the action
 *   cost AND a `pf1PreDamageRoll` handler reads to double the weapon's base damage
 *   dice (GOAL_v2.31.0 — runtime-confirmed in
 *   docs/ai-council/RUNTIME_PROBE_RESULTS_v2.31.0.md). MAP still advances via the
 *   existing v2.30.0 `pf1PreAttackRoll` handler — no change needed here. The intent
 *   is cleared by OBJECT IDENTITY in finally, so a cancelled picker, a thrown
 *   use(), or a same-actor double-click never leaves it dangling.
 *
 * TOKEN-DRIVEN: operates on the one selected token, so a single button serves
 *   every character. Vital Strike is a single weapon attack; weapon eligibility
 *   is the player's call — pick the weapon you are vital-striking.
 *
 * FEAT-GATED: aborts if the actor has no feat matching /vital strike/i.
 *
 * NOTE: only meaningful while the Attack Auto-Spend setting is ON (that is the
 *   feature that reads the cost); with it OFF, spend manually via the pip panel.
 *   Dice doubling and MAP advance regardless of Attack Auto-Spend (they ride the
 *   attack/damage roll hooks, not the action-cost auto-spend path).
 * ========================================================================== */
(async () => {
  // 1) exactly one controlled token
  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length !== 1) {
    return ui.notifications.warn(`Vital Strike: select exactly one token (you have ${controlled.length}).`);
  }
  const actor = controlled[0].actor;
  if (!actor) return ui.notifications.error("Vital Strike: the selected token has no actor.");

  // 2) feat gate (name match — mirrors the existing Combat Reflexes check)
  const hasFeat = actor.items.some((i) => i.type === "feat" && /vital\s*strike/i.test(i.name));
  if (!hasFeat) {
    return ui.notifications.warn(`${actor.name} has no Vital Strike feat — macro aborted.`);
  }

  // 3) resolve the weapon BEFORE setting any intent
  const weapons = actor.items.filter((i) => i.type === "weapon" || i.type === "attack");
  if (weapons.length === 0) {
    return ui.notifications.warn(`${actor.name} has no weapon/attack items to use.`);
  }
  let weapon = weapons[0];
  if (weapons.length > 1) {
    const chosenId = await foundry.applications.api.DialogV2.wait({
      window: { title: `Vital Strike — choose ${actor.name}'s weapon` },
      content: "<p>Which weapon for the Vital Strike?</p>",
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
  globalThis.baphometVitalStrike = intent;
  try {
    // action tracker charges 2 actions; the pf1PreDamageRoll handler (action-tracker.js,
    // GOAL_v2.31.0) doubles the weapon's base damage dice while this intent is set.
    // r is an ActionUse on a real swing, undefined if pf1 cancels the roll (Seam 1,
    // RUNTIME_PROBE_RESULTS_v2.31.0.md) — the dice-double and MAP advance self-discard on
    // cancel (no chat card is posted), so no rollback is needed on this macro's side.
    const r = await weapon.use({ skipDialog: true });
    void r; // reserved for future cancel-aware handling; not needed for VS today
  } finally {
    if (globalThis.baphometVitalStrike === intent) globalThis.baphometVitalStrike = null;
  }
})();
