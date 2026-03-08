/* ============================================================
   ECHOES OF BAPHOMET — CUSTOM XP PROGRESSION v1.0
   Overrides PF1e's "Fast" XP track with the campaign's
   modified slow track progression.

   WHAT IT DOES:
   - Replaces CONFIG.PF1.CHARACTER_EXP_LEVELS.fast with the
     campaign's custom XP table (escalating reductions on the
     standard slow track).
   - Renames the "Fast" track label to "Campaign" in the
     character sheet dropdown via localization override.
   - Characters set to the "Fast" XP track will automatically
     use the campaign progression for level-ups, skill points,
     feats, BAB, saves, and all level-dependent calculations.

   PROGRESSION MATH:
   - Levels 1–7:   Custom early-game values (faster ramp-up)
   - Levels 8–12:  Standard slow track × 0.90 (10% reduction)
   - Levels 13–15: Standard slow track × 0.85 (15% reduction)
   - Levels 16–20: Standard slow track × 0.80 (20% reduction)

   See: XP_Pacing.md for full reference table.

   For Foundry VTT v13 + PF1e System
   ============================================================ */

const XP_MODULE_ID = 'baphomet-utils';

/* ----------------------------------------------------------
   CAMPAIGN XP TABLE
   Array index = level (0-indexed: index 0 = level 1)
   Values = cumulative XP required to reach that level.
   Must be monotonically increasing.
   ---------------------------------------------------------- */
const CAMPAIGN_XP_TABLE = [
  0,          // Level 1  — starting
  1000,       // Level 2  — custom early-game
  3000,       // Level 3  — custom early-game
  6000,       // Level 4  — custom early-game
  10000,      // Level 5  — custom early-game
  15000,      // Level 6  — custom early-game
  21000,      // Level 7  — custom early-game
  69300,      // Level 8  — 77,000 × 0.90
  103500,     // Level 9  — 115,000 × 0.90
  144000,     // Level 10 — 160,000 × 0.90
  211500,     // Level 11 — 235,000 × 0.90
  297000,     // Level 12 — 330,000 × 0.90
  403750,     // Level 13 — 475,000 × 0.85
  565250,     // Level 14 — 665,000 × 0.85
  811750,     // Level 15 — 955,000 × 0.85
  1080000,    // Level 16 — 1,350,000 × 0.80
  1520000,    // Level 17 — 1,900,000 × 0.80
  2160000,    // Level 18 — 2,700,000 × 0.80
  3080000,    // Level 19 — 3,850,000 × 0.80
  4280000     // Level 20 — 5,350,000 × 0.80
];

/* ----------------------------------------------------------
   INIT HOOK — Override at the earliest possible moment.
   'init' fires before any sheets render, so the config
   is in place before any actor data is calculated.
   ---------------------------------------------------------- */
Hooks.once('init', () => {
  // Overwrite the "fast" XP track with campaign values
  if (CONFIG.PF1?.CHARACTER_EXP_LEVELS) {
    CONFIG.PF1.CHARACTER_EXP_LEVELS.fast = CAMPAIGN_XP_TABLE;
    console.log(`${XP_MODULE_ID} | Custom XP Progression v1.0: Overwrote "fast" track with campaign table`);
    console.log(`${XP_MODULE_ID} | Campaign XP table:`, CAMPAIGN_XP_TABLE);
  } else {
    console.warn(`${XP_MODULE_ID} | Custom XP Progression: CONFIG.PF1.CHARACTER_EXP_LEVELS not found — XP override skipped`);
  }

  // Rename "Fast" → "Campaign" in localization
  // PF1e may derive dropdown labels from translation keys or key names.
  // We cover both approaches:

  // Approach 1: Set explicit localization key
  if (game.i18n?.translations?.PF1) {
    game.i18n.translations.PF1.Fast = 'Campaign';
  }

  // Approach 2: If the system uses a separate config for track labels,
  // patch that too (future-proofing)
  if (CONFIG.PF1?.experienceTrack) {
    CONFIG.PF1.experienceTrack.fast = 'Campaign';
  }
});

/* ----------------------------------------------------------
   READY — Confirmation log with validation
   ---------------------------------------------------------- */
Hooks.once('ready', () => {
  // Validate the override stuck
  const currentFast = CONFIG.PF1?.CHARACTER_EXP_LEVELS?.fast;
  if (currentFast && currentFast[7] === 69300) {
    console.log(`${XP_MODULE_ID} | Custom XP Progression v1.0 ready — "Campaign" track active`);
  } else {
    console.warn(`${XP_MODULE_ID} | Custom XP Progression: override may not have applied correctly`, currentFast);
  }
});
