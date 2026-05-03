/* ============================================================
   BAPHOMET UTILS — SETTINGS v1.1
   Central module settings registration.

   v1.1 (module v2.11.0 — "Skill Auto-Spend"):
   - autoSkillSpend is now live. PF1 skill key payload confirmed
     via v2.10.x diagnostics. Skill auto-spend wired in
     action-tracker.js behind this setting.
   - skillAutoAllowlist updated to confirmed PF1 key strings.
     Provisional language removed for confirmed keys.
   - autoAttackSpend remains FUTURE — pf1AttackRoll dedupe
     behavior not yet designed.
   - moveButtonPosition remains FUTURE — Move/Stride button
     not yet implemented.

   v1.0 (module v2.9.9 — "Automation Prep"):
   Introduced settings.js. All settings registered but inert.

   For Foundry VTT v13 + PF1e System
   ============================================================ */

const SETTINGS_MODULE_ID = 'baphomet-utils';

Hooks.once('init', () => {

  /* ----------------------------------------------------------
     ATTACK ROLL AUTO-SPEND — FUTURE
     
     Deferred from v2.10.0/v2.11.0. pf1AttackRoll hook confirmed
     shape is (ItemAction, D20RollPF, Object). Dedupe behavior
     must be designed before wiring — unclear whether the hook
     fires once per attack action, once per iterative roll, or
     once per damage/card event.
     ---------------------------------------------------------- */
  game.settings.register(SETTINGS_MODULE_ID, 'autoAttackSpend', {
    name: 'Auto-Spend on Attack Roll [FUTURE]',
    hint: 'Not active yet. When enabled, will automatically spend 1 action pip when an attack roll is made in combat. Deferred pending dedupe design.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  /* ----------------------------------------------------------
     SKILL ROLL AUTO-SPEND — LIVE as of v2.11.0
     
     Triggers on pf1ActorRollSkill. Only spends for skills in
     the allowlist. Default OFF to preserve manual flow.
     
     Confirmed hook signature:
       pf1ActorRollSkill(actor, chatMessage, skillKey)
     ---------------------------------------------------------- */
  game.settings.register(SETTINGS_MODULE_ID, 'autoSkillSpend', {
    name: 'Auto-Spend on Skill Roll',
    hint: 'When enabled, automatically spends action pips when an active combatant makes a skill check for skills in the allowlist below. Default OFF — enable deliberately.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  /* ----------------------------------------------------------
     SKILL ALLOWLIST
     
     Comma-separated PF1 skill key strings. Keys below are
     confirmed via v2.10.x diagnostic testing. Any additional
     skills added manually must also be verified against the
     actual pf1ActorRollSkill hook payload before they will work.
     
     Confirmed keys and costs:
       acr = Acrobatics        (1 action)
       blf = Bluff             (1 action)
       int = Intimidate        (1 action)
       ste = Stealth           (1 action)
       hea = Heal              (1 action)
       umd = Use Magic Device  (1 action)
       dev = Disable Device    (3 actions — all-or-nothing)
       slt = Sleight of Hand   (1 action)
       kar = Knowledge Arcana  (1 action)
       kre = Knowledge Religion (1 action)
       kna = Knowledge Nature  (1 action)
     
     Excluded:
       per = Perception — excluded intentionally. Perception is
       a passive/reactive sense; spending an action pip on it
       conflicts with PF1.5 action economy intent.
     ---------------------------------------------------------- */
  game.settings.register(SETTINGS_MODULE_ID, 'skillAutoAllowlist', {
    name: 'Skill Auto-Spend Allowlist',
    hint: 'Comma-separated PF1 skill keys eligible for automatic action spending. Confirmed keys: acr, blf, int, ste, hea, umd, dev, slt, kar, kre, kna. Any keys added manually must be verified against the pf1ActorRollSkill hook payload.',
    scope: 'world',
    config: true,
    type: String,
    default: 'acr,blf,int,ste,hea,umd,dev,slt,kar,kre,kna'
  });

  /* ----------------------------------------------------------
     FLOATING MOVE / STRIDE BUTTON POSITION — FUTURE
     
     The button itself is not implemented yet. This setting
     is pre-registered for v2.12.0 or later.
     ---------------------------------------------------------- */
  game.settings.register(SETTINGS_MODULE_ID, 'moveButtonPosition', {
    name: 'Move / Stride Button Position [FUTURE]',
    hint: 'Not active yet. Controls the screen position of the floating Move / Stride action button when it is implemented.',
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

  /* ----------------------------------------------------------
     DEBUG LOGGING
     
     Per-client. Gates all _debugLog output in action-tracker.js.
     Logs skill-spend decisions at every gate when enabled.
     ---------------------------------------------------------- */
  game.settings.register(SETTINGS_MODULE_ID, 'debugLogging', {
    name: 'Action Tracker Debug Logging',
    hint: 'Log verbose action-spending decisions to the browser console (F12). Per-client setting. Useful for verifying automation behavior.',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false
  });

  console.log(`${SETTINGS_MODULE_ID} | Settings v1.1 registered`);
});
