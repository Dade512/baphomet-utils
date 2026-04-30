/**
 * Custom XP Progression — Echoes of Baphomet's Fall
 * Version: 1.2
 *
 * Overwrites PF1e's "Fast" XP track with a campaign-specific table.
 * Characters set to "Fast" on their sheet will use these thresholds.
 *
 * v1.2 Changes (LIFECYCLE HOOK PATCH):
 *   - Replaced Hooks.once('init', ...) with Hooks.once('pf1PostInit', ...).
 *     'init' fires during Foundry's own initialization pass, before PF1e
 *     has bootstrapped CONFIG.PF1. Writing to CONFIG.PF1 during 'init'
 *     is a race: PF1e may overwrite our values when it runs its own init
 *     immediately after. 'pf1PostInit' fires after PF1e has completed its
 *     initialization and CONFIG.PF1 is fully populated — the correct point
 *     to override PF1-owned config.
 *   - Added a safe fallback guard: checks CONFIG?.PF1?.CHARACTER_EXP_LEVELS?.fast
 *     exists before overriding. Logs a clear warning and returns without
 *     throwing if the path is absent (e.g., PF1e not active, API changed).
 *     Does not silently fail.
 *
 * Design:
 *   Levels 1–7:  Custom early-game ramp (faster than slow track, smooth acceleration)
 *   Levels 8–12: 10% reduction on standard slow track cumulative XP
 *   Levels 13–15: 15% reduction
 *   Levels 16–20: 20% reduction
 *
 * Array index = level (0-indexed, so index 0 = level 1 threshold).
 */

const XP_MODULE_ID = 'baphomet-utils';

Hooks.once('pf1PostInit', () => {
  // Guard: CONFIG.PF1 and the XP levels structure must exist before we touch them.
  // If PF1e has not populated this path (system not active, API restructured,
  // or hook fired unexpectedly early), warn loudly and bail — do not throw.
  if (!CONFIG?.PF1?.CHARACTER_EXP_LEVELS?.fast) {
    console.warn(
      `%c ${XP_MODULE_ID} | XP Progression v1.2: CONFIG.PF1.CHARACTER_EXP_LEVELS.fast not found — campaign XP table NOT applied. Is the PF1e system active?`,
      'background: #6e2a22; color: #e8dfd0; font-weight: bold; padding: 2px 6px;'
    );
    return;
  }

  const CAMPAIGN_XP = [
    0,          // Level 1
    2000,       // Level 2   — custom early-game
    5000,       // Level 3   — custom early-game
    10000,      // Level 4   — custom early-game
    18000,      // Level 5   — custom early-game
    28000,      // Level 6   — custom early-game
    42000,      // Level 7   — custom early-game
    69300,      // Level 8   — 77,000  × 0.90
    103500,     // Level 9   — 115,000 × 0.90
    144000,     // Level 10  — 160,000 × 0.90
    211500,     // Level 11  — 235,000 × 0.90
    297000,     // Level 12  — 330,000 × 0.90
    403750,     // Level 13  — 475,000 × 0.85
    565250,     // Level 14  — 665,000 × 0.85
    811750,     // Level 15  — 955,000 × 0.85
    1080000,    // Level 16  — 1,350,000 × 0.80
    1520000,    // Level 17  — 1,900,000 × 0.80
    2160000,    // Level 18  — 2,700,000 × 0.80
    3080000,    // Level 19  — 3,850,000 × 0.80
    4280000     // Level 20  — 5,350,000 × 0.80
  ];

  CONFIG.PF1.CHARACTER_EXP_LEVELS.fast = CAMPAIGN_XP;

  console.log(
    '%c Custom XP Progression v1.2: Overwrote "fast" track with campaign table ',
    'background: #6e2a22; color: #e8dfd0; font-weight: bold; padding: 2px 6px;'
  );
});
