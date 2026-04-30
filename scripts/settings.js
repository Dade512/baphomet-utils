/* ============================================================
   BAPHOMET UTILS — SETTINGS v1.0
   Central module settings registration.

   v1.0 (module v2.9.9 — "Automation Prep"):
   Introduces the settings.js file. Registers existing world
   settings (if any are migrated here from other files) and
   all new automation scaffold settings.

   IMPORTANT: All automation settings added in this version
   are INERT. They are registered so the Module Settings UI
   exposes them, but no behavior is wired to them yet.
   Live automation hooks ship in v2.10.0.

   Automation defaults to OFF in all cases to preserve
   existing manual-pip behavior exactly.

   For Foundry VTT v13 + PF1e System
   ============================================================ */

// Use a unique local name to avoid collision with other files
// that declare their own MODULE_ID constants in global scope
// (legacy scripts mode — no module isolation).
const SETTINGS_MODULE_ID = 'baphomet-utils';

Hooks.once('init', () => {

  /* ----------------------------------------------------------
     FUTURE AUTOMATION SETTINGS
     
     All settings below are INERT in v2.9.9.
     They will be wired to behavior in v2.10.0.
     Do not enable them expecting any effect — they are visible
     in the UI as early documentation of planned automation.
     ---------------------------------------------------------- */

  // Attack roll auto-spend ────────────────────────────────────
  // Will trigger on pf1AttackRoll in v2.10.0 to spend 1 action
  // pip per attack. Defaults OFF to preserve manual flow.
  game.settings.register(SETTINGS_MODULE_ID, 'autoAttackSpend', {
    name: 'Auto-Spend on Attack Roll [v2.10.0]',
    hint: 'FUTURE — not active yet. When enabled, will automatically spend 1 action pip when a PF1.5 attack roll is made in combat.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  // Skill roll auto-spend ──────────────────────────────────────
  // Will trigger on pf1ActorRollSkill in v2.10.0 for skills in
  // the allowlist. Defaults OFF to preserve manual flow.
  game.settings.register(SETTINGS_MODULE_ID, 'autoSkillSpend', {
    name: 'Auto-Spend on Skill Roll [v2.10.0]',
    hint: 'FUTURE — not active yet. When enabled, will automatically spend action pips when a skill check is made for skills in the allowlist below.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  // Skill allowlist ────────────────────────────────────────────
  // Comma-separated PF1 skill keys eligible for auto-spend.
  // Keys must be verified against pf1ActorRollSkill payload
  // at runtime before v2.10.0 automation is enabled.
  // Excluded from default: disableDevice (3-action equivalent),
  // useMagicDevice, knowledge/* (need unified handling).
  game.settings.register(SETTINGS_MODULE_ID, 'skillAutoAllowlist', {
    name: 'Skill Auto-Spend Allowlist [v2.10.0]',
    hint: 'FUTURE — not active yet. Comma-separated PF1 skill keys eligible for automatic action spending. Requires Auto-Spend on Skill Roll to be enabled. Example: acrobatics,bluff,intimidate,stealth.',
    scope: 'world',
    config: true,
    type: String,
    default: 'acrobatics,bluff,intimidate,stealth,perception,heal'
  });

  // Floating Move / Stride button position ─────────────────────
  // Controls where the future floating Move button will appear.
  // The button itself does not exist yet — this is UI prep only.
  game.settings.register(SETTINGS_MODULE_ID, 'moveButtonPosition', {
    name: 'Move / Stride Button Position [v2.10.0]',
    hint: 'FUTURE — not active yet. Controls the screen position of the floating Move / Stride action button when it is implemented.',
    scope: 'client',
    config: true,
    type: String,
    default: 'bottom-right',
    choices: {
      'bottom-right': 'Bottom-right',
      'bottom-left':  'Bottom-left',
      'top-right':    'Top-right',
      'top-left':     'Top-left'
    }
  });

  // Debug logging ──────────────────────────────────────────────
  // Per-client. Logs action-spending decisions to the browser
  // console. Useful for tracing automation behavior in v2.10.0+.
  // Has no effect on anything in v2.9.9 since no automation
  // fires yet, but is available to trace the scaffold helpers
  // if called manually from macros.
  game.settings.register(SETTINGS_MODULE_ID, 'debugLogging', {
    name: 'Action Tracker Debug Logging',
    hint: 'Log verbose action-spending decisions to the browser console (F12). Per-client setting. Useful for verifying automation behavior in v2.10.0+.',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false
  });

  console.log(`${SETTINGS_MODULE_ID} | Settings v1.0 registered`);
});
