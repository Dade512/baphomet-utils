/* ============================================================================
 * baphomet-utils — PF1.5 BOSS ACTION declare macro (GM-only, token-driven)
 * ----------------------------------------------------------------------------
 * CANONICAL SOURCE OF TRUTH: macros/boss-action.js
 *   SYNC_STAMP: 2026-11-01
 *   The in-world Foundry macro "Boss Action" must be kept byte-identical to this
 *   file. After editing either copy, sync the other and bump SYNC_STAMP. Drift
 *   check: see README.md here.
 *
 * WHAT IT DOES (GOAL_v2.48.0 FIX-3, TD-98 item 4; canon H:295, H:300, H:519):
 *   declares a Legendary action or a Lair action for the selected creature. The
 *   action tracker then charges NOTHING for that creature's NEXT action use -
 *   no action, no Reaction, no Combat Reflexes pip - on its own turn or off, and
 *   posts one GM-whispered card naming the item. The module charges an off-turn
 *   spell or consumable the Reaction; a boss's Legendary or Lair action does not
 *   owe it, and the module cannot tell the two apart without this declaration.
 *   It sets globalThis.baphometBossAction = { actorUuid, kind, combatId, round }
 *   (kind 'legendary' or 'lair'; combatId and round are the active combat's id
 *   and round, or null outside combat); the tracker consumes it at the next use,
 *   whatever that use is. A declaration is spent on the next use, dropped
 *   silently when stale (from another combat, or more than one round old), and
 *   cleared at the boss's own turn start (v2.48.1); a replacement declaration
 *   or a page reload also clears it.
 *
 * WARNS (never refuses - the GM rules, H:512 / H:509): Legendary only - when the
 *   creature cannot act fully (Stunned, a no-action state, Nauseated) or when it
 *   is the current combatant (a Legendary action comes after another creature's
 *   turn ends). Lair checks nothing (H:504).
 *
 * GM-ONLY. TOKEN-DRIVEN: operates on the one controlled token, so a single
 *   button serves every boss.
 * ========================================================================== */
(async () => {
  // 1) GM only
  if (!game.user.isGM) {
    return ui.notifications.warn('Boss Action: only the GM can declare a Legendary or Lair action.');
  }

  // 2) exactly one controlled token
  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length !== 1) {
    return ui.notifications.warn(`Boss Action: select exactly one token (you have ${controlled.length}).`);
  }
  const token = controlled[0];
  const actor = token.actor;
  if (!actor) return ui.notifications.error('Boss Action: the selected token has no actor.');

  // 3) the kind: scope.kind when supplied (a probe), else a two-button dialog
  let kind = null;
  if (typeof scope === 'object' && scope && (scope.kind === 'legendary' || scope.kind === 'lair')) kind = scope.kind;
  if (!kind) {
    kind = await foundry.applications.api.DialogV2.wait({
      window: { title: `Boss Action — ${actor.name}` },
      content: '<p>Which kind of boss action is this?</p>',
      buttons: [
        { action: 'legendary', label: 'Legendary', default: true, callback: () => 'legendary' },
        { action: 'lair', label: 'Lair', callback: () => 'lair' }
      ],
      rejectClose: false // dismissed resolves to null (no throw)
    });
    if (kind !== 'legendary' && kind !== 'lair') return; // dismissed - nothing set
  }

  // 4) Legendary only: warn (never refuse) when the creature cannot act fully or is on its own turn
  if (kind === 'legendary') {
    const combat = game.combats?.active ?? null;
    const combatant = combat?.combatants?.find((c) => c.tokenId === token.id)
      ?? combat?.combatants?.find((c) => c.actor?.uuid === actor.uuid);
    if (combat && combatant) {
      const gate = game.baphometActions?.getState?.(combatant.id)?.reactionGate ?? null;
      if (gate && gate !== 'your first turn has not started') {
        ui.notifications.warn(`${actor.name}: ${gate} — a creature that cannot act fully cannot take a Legendary action. Declared anyway; the GM rules.`);
      }
      if (combat.combatant?.id === combatant.id) {
        ui.notifications.warn(`${actor.name}: a Legendary action comes only after another creature's turn ends, not on its own turn. Declared anyway; the GM rules.`);
      }
    }
  }

  // 5) declare (replaces any earlier declaration); the action tracker consumes it at the next use
  //    v2.48.1: the declaration carries the combat and round it was made in, so a stale one can expire.
  const active = game.combats?.active ?? null;
  globalThis.baphometBossAction = { actorUuid: actor.uuid, kind, combatId: active?.id ?? null, round: active?.round ?? null };
  const label = kind === 'legendary' ? 'Legendary' : 'Lair';
  ui.notifications.info(`Boss Action: ${label} action declared for ${actor.name} — its next action use charges nothing.`);
})();
