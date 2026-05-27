/* ============================================================
   BAPHOMET UTILS — SETTINGS v1.8
   Central module settings registration.

   v1.8 (module v2.20.8 — "Background Skills Settings Foundation"):
   - backgroundSkillsEnabled registered. World scope, default false.
     Master toggle for Background Skills tracking mode (OFF by default).
     Advisory only — does NOT enable PF1 native Background Skills
     (use pf1.allowBackgroundSkills in PF1 Variant Rules for that).
   - backgroundSkillKeys registered. World scope, CSV string.
     GM-editable list of PF1 skill keys treated as background skills.
     Default: all 13 native PF1 background-skill keys
     (apr,art,crf,han,ken,kge,khi,kno,lin,lor,prf,pro,slt).
     Artistry (art) and Lore (lor) are native PF1 background-only
     arbitrary skills (pf1.config.backgroundOnlySkills — Pilot 36);
     their sub-skill actor data paths are UNVERIFIED.
     Phase B registers them but does not read actors.
   - backgroundBudgetLevel1 registered. World scope, default 4.
     Background rank budget at level 1 (campaign deviation from RAW 2).
   - backgroundBudgetPerLevel registered. World scope, default 2.
     Background rank budget per level after level 1 (matches RAW).
   - backgroundSkillKeysMigrated228 migration flag registered.
     One-time correction from the Pilot 35 provisional default
     (per→prf, art/lor added). Runs once on GM ready.

   v1.7 (module v2.15.0 — "Disable Device Task Prep"):
   - skillAutoAllowlist default updated: dev removed.
     Disable Device now uses the PF1.5 multi-round task pattern
     and is not auto-spendable. The live handler warns when dev
     is rolled in combat.
   - skillAllowlistMigrated215 flag registered for one-time
     migration from v2.14.0 to v2.15.0 confirmed allowlist.

   v1.6 (module v2.14.0 — "Hide PF1 Full Attack Button"):
   - pf15ModeEnabled registered. World scope, default true.
     Enables PF1.5 action economy enforcement, starting with
     hiding the Full Attack button from AttackDialog.

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
     PF1.5 MODE — LIVE as of v2.14.0
     
     Master toggle for PF1.5 action economy enforcement.
     Default ON for this campaign world (all actors are PF1.5).
     
     Currently controls:
     - Hiding the Full Attack button from AttackDialog
     
     Future enforcement (v2.15.0+):
     - Strike auto-spend via pf1PreActionUse
     - Swing tracking and MAP injection
     ---------------------------------------------------------- */
  game.settings.register(SETTINGS_MODULE_ID, 'pf15ModeEnabled', {
    name: 'PF1.5 Mode',
    hint: 'Enables PF1.5 action economy enforcement, including hiding PF1 full-attack controls.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

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
     v2.10.x–v2.15.0 live testing. Any additional skills added
     manually must be verified against the pf1ActorRollSkill
     hook payload before they will work.
     
     Confirmed keys and costs:
       acr = Acrobatics               (1 action)
       blf = Bluff                    (1 action)
       int = Intimidate               (1 action)
       ste = Stealth                  (1 action)
       hea = Heal                     (1 action)
       umd = Use Magic Device         (1 action)
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

       dev = Disable Device — excluded as of v2.15.0. Disable
       Device uses the PF1.5 multi-round task pattern (commit
       1 action/round with Continue Disabling). The live handler
       warns the user when dev is rolled in combat. It will be
       re-added once the task subsystem is built.
     ---------------------------------------------------------- */
  game.settings.register(SETTINGS_MODULE_ID, 'skillAutoAllowlist', {
    name: 'Skill Auto-Spend Allowlist',
    hint: 'Comma-separated PF1 skill keys for automatic action spending. Confirmed keys: acr, blf, int, ste, hea, umd, slt, kar, kdu, ken, kge, khi, klo, kna, kno, kpl, kre. Any keys added manually must be verified against the pf1ActorRollSkill hook payload.',
    scope: 'world',
    config: true,
    type: String,
    default: 'acr,blf,int,ste,hea,umd,slt,kar,kdu,ken,kge,khi,klo,kna,kno,kpl,kre'
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

  game.settings.register(SETTINGS_MODULE_ID, 'skillAllowlistMigrated215', {
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

  /* ----------------------------------------------------------
     BACKGROUND SKILLS — SETTINGS FOUNDATION (v2.20.8)

     Four world settings for the Background Skills optional system
     (Pathfinder Unchained / PF1.5). Advisory/tracking only in MVP:
     no actor reads, no actor writes, no enforcement, no migration.

     Artistry (art) and Lore (lor) are native PF1 background-only
     arbitrary skills (pf1.config.backgroundOnlySkills — Pilot 36).
     Their sub-skill actor data paths are UNVERIFIED; Phase B registers
     them in the key list but does not read actors.
     ---------------------------------------------------------- */
  game.settings.register(SETTINGS_MODULE_ID, 'backgroundSkillsEnabled', {
    name: 'Background Skills Mode',
    hint: 'Enables the baphomet-utils Background Skills budget tracker for this world. Advisory layer only — does NOT enable PF1 native Background Skills (use the PF1 system Variant Rules setting pf1.allowBackgroundSkills for that). When active, budget settings below apply. Enable alongside pf1.allowBackgroundSkills to track the campaign level-1 deviation (4 ranks at level 1 instead of PF1 native 2). Default OFF.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(SETTINGS_MODULE_ID, 'backgroundSkillKeys', {
    name: 'Background Skill Keys',
    hint: 'Comma-separated PF1 skill keys treated as background skills. Default: all 13 native PF1 background-skill keys (apr, art, crf, han, ken, kge, khi, kno, lin, lor, prf, pro, slt). Artistry (art) and Lore (lor) are native PF1 background-only arbitrary skills — sub-skill actor data paths UNVERIFIED, Phase B does not read actors. Perception (per) is NOT a background skill.',
    scope: 'world',
    config: true,
    type: String,
    default: 'apr,art,crf,han,ken,kge,khi,kno,lin,lor,prf,pro,slt'
  });

  game.settings.register(SETTINGS_MODULE_ID, 'backgroundBudgetLevel1', {
    name: 'Background Skill Budget — Level 1',
    hint: 'Number of background skill ranks granted at level 1. Campaign default: 4 (RAW is 2). These ranks do not receive the Intelligence modifier.',
    scope: 'world',
    config: true,
    type: Number,
    default: 4
  });

  game.settings.register(SETTINGS_MODULE_ID, 'backgroundBudgetPerLevel', {
    name: 'Background Skill Budget — Per Level',
    hint: 'Number of background skill ranks granted per level after level 1. Default: 2 (matches RAW). These ranks do not receive the Intelligence modifier.',
    scope: 'world',
    config: true,
    type: Number,
    default: 2
  });

  game.settings.register(SETTINGS_MODULE_ID, 'backgroundSkillKeysMigrated228', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  console.log(`${SETTINGS_MODULE_ID} | Settings v1.8 registered`);
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

/* ----------------------------------------------------------
   v2.15.0 MIGRATION — Remove Disable Device from Allowlist
   
   Runs once on the first GM ready after updating to v2.15.0.
   Detects the confirmed v2.14.0 allowlist string and replaces
   it with the v2.15.0 string (dev removed).
   
   Disable Device (dev) is no longer auto-spendable. It now
   uses the PF1.5 multi-round task pattern. The live skill
   handler warns the user when dev is rolled in combat.
   
   Safety: only replaces the exact v2.14.0 string.
   Any GM-customized allowlist is left completely untouched.
   The migration flag (skillAllowlistMigrated215) is written
   regardless so this block never runs a second time.
   ---------------------------------------------------------- */

const _V214_ALLOWLIST = 'acr,blf,int,ste,hea,umd,dev,slt,kar,kdu,ken,kge,khi,klo,kna,kno,kpl,kre';
const _V215_ALLOWLIST = 'acr,blf,int,ste,hea,umd,slt,kar,kdu,ken,kge,khi,klo,kna,kno,kpl,kre';

Hooks.once('ready', async () => {
  if (!game.user.isGM) return;

  if (game.settings.get(SETTINGS_MODULE_ID, 'skillAllowlistMigrated215')) return;

  const current = game.settings.get(SETTINGS_MODULE_ID, 'skillAutoAllowlist');

  if (current === _V214_ALLOWLIST) {
    await game.settings.set(SETTINGS_MODULE_ID, 'skillAutoAllowlist', _V215_ALLOWLIST);
    console.log(
      `%c ${SETTINGS_MODULE_ID} | v2.15.0 migration: dev removed from skillAutoAllowlist (Disable Device now uses multi-round task pattern) `,
      'background: #6e2a22; color: #e8dfd0; font-weight: bold; padding: 2px 6px;'
    );
  } else {
    console.log(
      `${SETTINGS_MODULE_ID} | v2.15.0 migration: skillAutoAllowlist already customized or up-to-date — no change ("${current}")`
    );
  }

  await game.settings.set(SETTINGS_MODULE_ID, 'skillAllowlistMigrated215', true);
});

/* ----------------------------------------------------------
   v2.20.8 MIGRATION — Background Skill Keys Correction

   Runs once on the first GM ready after updating to v2.20.8.
   Detects the Pilot 35 provisional default (per=Perception, no
   art/lor) and replaces it with the corrected Pilot 37 default.

   Safety: only replaces the exact Pilot 35 provisional string.
   Any GM-customized backgroundSkillKeys is left completely untouched.
   The migration flag (backgroundSkillKeysMigrated228) is written
   regardless so this block never runs a second time.
   ---------------------------------------------------------- */

const _BG_KEYS_P35_DEFAULT = 'apr,crf,han,ken,kge,khi,kno,lin,per,pro,slt';
const _BG_KEYS_P37_CORRECT = 'apr,art,crf,han,ken,kge,khi,kno,lin,lor,prf,pro,slt';

Hooks.once('ready', async () => {
  if (!game.user.isGM) return;

  if (game.settings.get(SETTINGS_MODULE_ID, 'backgroundSkillKeysMigrated228')) return;

  const current = game.settings.get(SETTINGS_MODULE_ID, 'backgroundSkillKeys');

  if (current === _BG_KEYS_P35_DEFAULT) {
    await game.settings.set(SETTINGS_MODULE_ID, 'backgroundSkillKeys', _BG_KEYS_P37_CORRECT);
    console.log(
      `%c ${SETTINGS_MODULE_ID} | v2.20.8 migration: backgroundSkillKeys corrected (per→prf; art,lor added) `,
      'background: #6e2a22; color: #e8dfd0; font-weight: bold; padding: 2px 6px;'
    );
  } else {
    console.log(
      `${SETTINGS_MODULE_ID} | v2.20.8 migration: backgroundSkillKeys already customized — no change ("${current}")`
    );
  }

  await game.settings.set(SETTINGS_MODULE_ID, 'backgroundSkillKeysMigrated228', true);
});
