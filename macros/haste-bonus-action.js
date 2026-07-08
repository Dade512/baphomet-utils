/* ============================================================================
 * baphomet-utils — PF1.5 HASTE BONUS-ACTION toggle macro (GM-only, token-driven)
 * ----------------------------------------------------------------------------
 * CANONICAL SOURCE OF TRUTH: macros/haste-bonus-action.js
 *   SYNC_STAMP: 2026-07-07
 *   The in-world "Haste: Bonus Action" macro must be kept byte-identical to this
 *   file. After editing either copy, sync the other and bump SYNC_STAMP. Drift
 *   check: see README.md here.
 *
 * WHAT IT DOES (PF1.5 / GOAL_v2.29.0): toggles the 4th "bonus action" pip (Haste)
 *   on the SELECTED token's combatant, via game.baphometActions.toggleBonusAction.
 *   GM-only (granting is a GM act). The bonus pip auto-spends on an ordinary 4th
 *   Strike; to use it for a Move, click the brass pip directly in the tracker.
 *
 * NOTE: if the "Auto-Grant Haste Bonus Action" setting is ON, an active Haste buff
 *   already grants the pip automatically. This macro is for a MANUAL grant (or any
 *   non-buff source of a bonus action). Manual and auto grants are independent.
 * ========================================================================== */
(async () => {
  if (!game.user.isGM) {
    return ui.notifications.warn('Haste bonus action: GM only.');
  }
  if (!game.combat?.active) {
    return ui.notifications.warn('Haste bonus action: no active combat.');
  }

  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length !== 1) {
    return ui.notifications.warn(`Haste bonus action: select exactly one token (you have ${controlled.length}).`);
  }
  const token = controlled[0];

  const combatant = game.combat.getCombatantByToken?.(token.id)
    ?? game.combat.combatants.find((c) => c.tokenId === token.id);
  if (!combatant) {
    return ui.notifications.warn(`Haste bonus action: ${token.name} is not in this combat.`);
  }

  const before = game.baphometActions?.getState?.(combatant.id)?.bonusManualGranted ?? false;
  const ok = game.baphometActions?.toggleBonusAction?.(combatant.id);
  if (ok === false || ok === undefined) {
    return ui.notifications.warn(`Haste bonus action: could not toggle for ${combatant.name}.`);
  }
  ui.notifications.info(`Haste bonus action ${before ? 'revoked from' : 'granted to'} ${combatant.name}.`);
})();
