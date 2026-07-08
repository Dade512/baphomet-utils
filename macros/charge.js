/* ============================================================================
 * baphomet-utils — PF1.5 CHARGE declare macro (token-driven)
 * ----------------------------------------------------------------------------
 * CANONICAL SOURCE OF TRUTH: macros/charge.js
 *   SYNC_STAMP: 2026-07-07
 *   The in-world Foundry macro "Charge" must be kept byte-identical to this file.
 *   After editing either copy, sync the other and bump SYNC_STAMP. Drift check:
 *   see README.md here.
 *
 * WHAT IT DOES (PF1.5 / GOAL_v2.28.0 + GOAL_v2.31.0): declares a Charge so the
 *   action tracker charges its correct cost of 2 ACTIONS (not 1). pf1 11.11 has
 *   no combat-Charge concept to auto-detect (live probe 2026-06-26: the only
 *   "charge" fields are item-resource charges), so this macro sets an
 *   actor-scoped intent object (globalThis.baphometCharge = { actorId }) that
 *   action-tracker.js `_deriveActionUseCost` reads for the action cost AND a
 *   `pf1PreAttackRoll` handler reads to add +2 to the attack roll (GOAL_v2.31.0).
 *   After a confirmed swing (see step 4), this macro also applies a −2 AC
 *   PF1 buff Item that auto-expires at the start of this actor's next turn
 *   (runtime-confirmed mechanism + timing in
 *   docs/ai-council/RUNTIME_PROBE_RESULTS_v2.31.0.md, Seam 2). MAP advances via
 *   the existing v2.30.0 `pf1PreAttackRoll` handler — no change needed here. The
 *   intent is cleared by OBJECT IDENTITY in finally.
 *
 * TOKEN-DRIVEN: operates on the one selected token, so a single button serves
 *   every character. A Charge is a melee Strike preceded by movement — move the
 *   token first, then run this; pick the melee weapon you are charging with.
 *
 * NO FEAT GATE: charging is a universal action (everyone can charge).
 *
 * CANCEL SAFETY (GOAL_v2.31.0, Seam 1): weapon.use({skipDialog:true}) returns an
 *   ActionUse on a real swing and undefined if pf1 cancels the roll after the
 *   pre-rolls (RUNTIME_PROBE_RESULTS_v2.31.0.md). The −2 AC buff is applied ONLY
 *   when the swing is confirmed (return value truthy) — a cancelled Charge never
 *   strands the AC debuff. The +2 to-hit self-discards on cancel (no chat card).
 *
 * NOTE: only meaningful while the Attack Auto-Spend setting is ON (for the
 *   action-cost read); the +2 to-hit and −2 AC buff apply regardless.
 * ========================================================================== */
(async () => {
  // 1) exactly one controlled token
  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length !== 1) {
    return ui.notifications.warn(`Charge: select exactly one token (you have ${controlled.length}).`);
  }
  const actor = controlled[0].actor;
  if (!actor) return ui.notifications.error("Charge: the selected token has no actor.");

  // 2) no feat gate — charging is universal.

  // 3) resolve the weapon BEFORE setting any intent
  const weapons = actor.items.filter((i) => i.type === "weapon" || i.type === "attack");
  if (weapons.length === 0) {
    return ui.notifications.warn(`${actor.name} has no weapon/attack items to use.`);
  }
  let weapon = weapons[0];
  if (weapons.length > 1) {
    const chosenId = await foundry.applications.api.DialogV2.wait({
      window: { title: `Charge — choose ${actor.name}'s weapon` },
      content: "<p>Which (melee) weapon for the Charge?</p>",
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
  globalThis.baphometCharge = intent;
  let r;
  try {
    // action tracker charges 2 actions; the pf1PreAttackRoll handler (action-tracker.js,
    // GOAL_v2.31.0) adds the +2 to-hit while this intent is set. r is an ActionUse on a
    // real swing, undefined if pf1 cancels the roll (Seam 1, RUNTIME_PROBE_RESULTS_v2.31.0.md).
    r = await weapon.use({ skipDialog: true });
  } finally {
    if (globalThis.baphometCharge === intent) globalThis.baphometCharge = null;
  }

  // 5) Charge -2 AC (GOAL_v2.31.0) — ONLY on a confirmed swing (r truthy). A cancelled
  //    Charge (r === undefined) never applies/strands the AC debuff. Mechanism + timing
  //    runtime-confirmed in docs/ai-council/RUNTIME_PROBE_RESULTS_v2.31.0.md (Seam 2): a
  //    PF1 buff Item with duration {units:'turn', value:1} applies -2 to normal/touch/ff AC
  //    and auto-deactivates exactly at the start of this actor's next turn via pf1's own
  //    buff-duration system (no render-based removal needed).
  if (r) {
    // Sweep any prior (now-inactive, or stale) Charge AC buff before adding a new one so
    // repeated Charges across turns don't accumulate inert leftovers.
    const staleCharged = actor.items.filter((i) => i.flags?.["baphomet-utils"]?.chargeBuff === true);
    if (staleCharged.length > 0) {
      await actor.deleteEmbeddedDocuments("Item", staleCharged.map((i) => i.id));
    }

    await actor.createEmbeddedDocuments("Item", [{
      name: "Charged (−2 AC)",
      type: "buff",
      img: "icons/svg/downgrade.svg",
      system: {
        active: true,
        subType: "temp",
        duration: { units: "turn", value: 1 },
        changes: [{ formula: "-2", target: "ac", type: "untyped" }]
      },
      flags: { "baphomet-utils": { chargeBuff: true } }
    }]);
  }
})();
