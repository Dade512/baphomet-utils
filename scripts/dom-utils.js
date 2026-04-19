/* ============================================================
   ECHOES OF BAPHOMET — DOM UTILITIES v1.0
   Tiny shared helpers for hook handlers that may receive
   either a native HTMLElement or a jQuery wrapper, depending
   on Foundry version and module load order.

   Foundry v13 migrated most hooks to pass HTMLElement directly
   (e.g. renderTokenHUD, renderCombatTracker), but legacy code
   paths and some compat shims still hand back jQuery objects.
   Rather than scatter the same instanceof guard across every
   hook handler, normalize once here.

   Loaded FIRST in module.json's scripts array so other files
   can call _baphNormalizeHtml() at top-level without ordering
   surprises.

   For Foundry VTT v13 + PF1e System
   ============================================================ */

/**
 * Coerce a hook's html argument to a native HTMLElement.
 *
 * Handles three cases:
 *   1. Already an HTMLElement → return as-is
 *   2. jQuery wrapper (when jQuery is present globally) → unwrap [0]
 *   3. Anything else with array-like access → fall back to [0] ?? value
 *
 * The jQuery instanceof check is guarded by globalThis.jQuery
 * so this stays safe even if jQuery is somehow absent.
 *
 * @param {HTMLElement|jQuery|*} html
 * @returns {HTMLElement|null}
 */
function _baphNormalizeHtml(html) {
  if (html instanceof HTMLElement) return html;
  if (globalThis.jQuery && html instanceof globalThis.jQuery) return html[0] ?? null;
  return html?.[0] ?? html ?? null;
}
