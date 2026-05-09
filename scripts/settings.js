/* ============================================================
   BAPHOMET UTILS — SETTINGS v1.5
   Central module settings registration.

   v1.5 (module v2.13.0 — "Floating Action Spend Panel"):
   - moveButtonPosition label/hint updated from Stride/Button
     language to Action Spend Panel language. Setting key unchanged.

   v1.4 (module v2.12.0 — "Floating Stride Button"):
   - moveButtonPosition setting now live. Label/hint updated.

   v1.3 (module v2.11.2 — "Expand Knowledge Skill Auto-Spend"):
   - skillAutoAllowlist default expanded to full standard PF1
     Knowledge sub-skills: kdu, ken, kge, khi, kno, kpl added.
   - skillAllowlistMigrated212 flag registered for one-time
     migration from v2.11.1 to v2.11.2 confirmed allowlist.

   v1.2 (module v2.11.1 — "Migrate Confirmed Skill Allowlist"):
   - skillAutoAllowlist default updated to include klo.
   - skillAllowlistMigrated211 migration flag registered.

   v1.1 (module v2.11.0 — "Skill Auto-Spend"):
   - autoSkillSpend live. skillAutoAllowlist updated to confirmed keys.

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
     
     Comma-separated PF1 skill key strings. Keys confirmed via
     v2.10.x–v2.11.2 live testing. Any additional skills added
     manually must be verified against the pf1ActorRollSkill
     hook payload before they will work.
     
     Confirmed keys and costs:
       acr = Acrobatics               (1 action)
       blf = Bluff                    (1 action)
       int = Intimidate               (1 action)
       ste = Stealth                  (1 action)
       hea = Heal                     (1 action)
       umd = Use Magic Device         (1 action)
       dev = Disable Device           (3 actions — all-or-nothing)
       slt = Sleight of Hand          (1 action)
       kar = Knowledge Arcana         (1 action)
       kdu = Knowledge Dungeoneering  (1 action)
       ken = Knowledge Engineering    (1 action)
       kge = Knowledge Geography      (1 action)
       khi = Knowledge History        (1 action)
       klo = Knowledge Local          (1 action)
       kna = Knowledge Nature         (1 action)
       kno = Knowledge Nobility       (1 action)
       kpl = Knowledge Planes         (1 action)
       kre = Knowledge Religion       (1 action)
     
     Excluded:
       per = Perception — excluded intentionally. Perception is
       a passive/reactive sense; spending an action pip on it
       conflicts with PF1.5 action economy intent.
     ---------------------------------------------------------- */
  game.settings.register(SETTINGS_MODULE_ID, 'skillAutoAllowlist', {
    name: 'Skill Auto-Spend Allowlist',
    hint: 'Comma-separated PF1 skill keys for automatic action spending. Confirmed keys: acr, blf, int, ste, hea, umd, dev, slt, kar, kdu, ken, kge, khi, klo, kna, kno, kpl, kre. Any keys added manually must be verified against the pf1ActorRollSkill hook payload.',
    scope: 'world',
    config: true,
    type: String,
    default: 'acr,blf,int,ste,hea,umd,dev,slt,kar,kdu,ken,kge,khi,klo,kna,kno,kpl,kre'
  });

  /* ----------------------------------------------------------
     SKILL ALLOWLIST MIGRATION FLAGS
     
     Hidden world flags. Set to true after each version's
     one-time migration runs. Prevents re-running on reload.
     ---------------------------------------------------------- */
  game.settings.register(SETTINGS_MODULE_ID, 'skillAllowlistMigrated211', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(SETTINGS_MODULE_ID, 'skillAllowlistMigrated212', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  /* ----------------------------------------------------------
     ACTION SPEND PANEL POSITION — LIVE as of v2.12.0
     
     Controls where the floating Action Spend Panel appears.
     Per-client setting (each user can choose their preferred corner).
     ---------------------------------------------------------- */
  game.settings.register(SETTINGS_MODULE_ID, 'moveButtonPosition', {
    name: 'Action Spend Panel Position',
    hint: 'Controls the screen position of the floating Action Spend Panel during combat.',
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

  console.log(`${SETTINGS_MODULE_ID} | Settings v1.5 registered`);
});

/* ----------------------------------------------------------
   v2.11.1 MIGRATION — Skill Allowlist
   
   Runs once on the first GM ready after updating to v2.11.1.
   Detects the old provisional v2.9.9 allowlist string and
   replaces it with the confirmed PF1 keys including klo.
   
   Safety: only replaces the exact old provisional value.
   Any GM-customized allowlist is left completely untouched.
   The migration flag (skillAllowlistMigrated211) is written
   regardless so this block never runs a second time.
   ---------------------------------------------------------- */

const _OLD_PROVISIONAL_ALLOWLIST = 'acrobatics,bluff,intimidate,stealth,heal,useMagicDevice,disableDevice,sleightOfHand,knowledge';
const _NEW_CONFIRMED_ALLOWLIST   = 'acr,blf,int,ste,hea,umd,dev,slt,kar,kre,kna,klo';

Hooks.once('ready', async () => {
  if (!game.user.isGM) return;

  // Check and set the migration flag atomically.
  if (game.settings.get(SETTINGS_MODULE_ID, 'skillAllowlistMigrated211')) return;

  const current = game.settings.get(SETTINGS_MODULE_ID, 'skillAutoAllowlist');

  if (current === _OLD_PROVISIONAL_ALLOWLIST) {
    await game.settings.set(SETTINGS_MODULE_ID, 'skillAutoAllowlist', _NEW_CONFIRMED_ALLOWLIST);
    console.log(
      `%c ${SETTINGS_MODULE_ID} | v2.11.1 migration: skillAutoAllowlist updated to confirmed PF1 keys `,
      'background: #6e2a22; color: #e8dfd0; font-weight: bold; padding: 2px 6px;'
    );
  } else {
    console.log(
      `${SETTINGS_MODULE_ID} | v2.11.1 migration: skillAutoAllowlist already customized or up-to-date — no change ("${current}")`
    );
  }

  await game.settings.set(SETTINGS_MODULE_ID, 'skillAllowlistMigrated211', true);
});

/* ----------------------------------------------------------
   v2.11.2 MIGRATION — Skill Allowlist (Expand Knowledge)
   
   Runs once on the first GM ready after updating to v2.11.2.
   Detects the confirmed v2.11.1 allowlist string and replaces
   it with the expanded v2.11.2 string including all standard
   PF1 Knowledge sub-skills.
   
   Safety: only replaces the exact v2.11.1 string.
   Any GM-customized allowlist is left completely untouched.
   The migration flag (skillAllowlistMigrated212) is written
   regardless so this block never runs a second time.
   ---------------------------------------------------------- */

const _V211_ALLOWLIST = 'acr,blf,int,ste,hea,umd,dev,slt,kar,kre,kna,klo';
const _V212_ALLOWLIST = 'acr,blf,int,ste,hea,umd,dev,slt,kar,kdu,ken,kge,khi,klo,kna,kno,kpl,kre';

Hooks.once('ready', async () => {
  if (!game.user.isGM) return;

  if (game.settings.get(SETTINGS_MODULE_ID, 'skillAllowlistMigrated212')) return;

  const current = game.settings.get(SETTINGS_MODULE_ID, 'skillAutoAllowlist');

  if (current === _V211_ALLOWLIST) {
    await game.settings.set(SETTINGS_MODULE_ID, 'skillAutoAllowlist', _V212_ALLOWLIST);
    console.log(
      `%c ${SETTINGS_MODULE_ID} | v2.11.2 migration: skillAutoAllowlist expanded to full Knowledge sub-skills `,
      'background: #6e2a22; color: #e8dfd0; font-weight: bold; padding: 2px 6px;'
    );
  } else {
    console.log(
      `${SETTINGS_MODULE_ID} | v2.11.2 migration: skillAutoAllowlist already customized or up-to-date — no change ("${current}")`
    );
  }

  await game.settings.set(SETTINGS_MODULE_ID, 'skillAllowlistMigrated212', true);
});
