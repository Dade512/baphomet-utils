/* ============================================================
   BAPHOMET UTILS — SETTINGS v1.13
   Central module settings registration.

   v1.13 (module v2.27.0 — "Perception is always a class skill"):
   - perceptionAlwaysClassSkill registered. World scope, default false.
     When ON, scripts/perception-class-skill.js runs in pf1PrepareDerivedActorData
     (after pf1's class-skill aggregation) and sets skills.per.cs = true for every
     actor with a Perception skill, adding the standard +3 to skills.per.mod when the
     skill was not already a class skill and rank >= 1. Derived override only — never
     writes actor data; recomputed each prep. onChange re-preps world actors so the
     toggle applies immediately. Default OFF.

   v1.12 (module v2.26.0 — "Hygiene — remove dead Background-Skills settings"):
   - Background Skills settings REMOVED: backgroundSkillsEnabled,
     backgroundSkillKeys, backgroundBudgetLevel1, backgroundBudgetPerLevel,
     plus the two one-time migration flags/hooks (Migrated228 / Migrated209).
     The advisory layer was never wired to actor data; the campaign uses
     vanilla PF1 native Background Skills (pf1.allowBackgroundSkills) instead,
     where the per-level rank count is fixed by PF1's own variant-rule
     settings. Orphaned stored values in existing worlds are ignored
     (unregistered keys). The v1.8/v1.9 entries below are retained as history.

   v1.11 (module v2.23.0 — "Critical Roll Card Flourish"):
   - critCardFlourish registered. World scope, default false.
     Gates the nat-20/nat-1 chat-card flourish (presentation only;
     CSS in styles/noir-theme.css). OFF = today's plain-label behavior.
   - hiddenTaskStore registered. Client scope, config hidden.
     Stores active-GM-only hidden task data by world id; replaces the
     legacy replicated GM User flag after task-tracker migration.

   v1.10 (module v2.22.0 — "Attack & Spell Auto-Spend"):
   - autoAttackSpend activated (was a FUTURE scaffold). World scope,
     default false. Live attack auto-spend via pf1PreActionUse.
   - autoSpellSpend registered. World scope, default false. Spell
     auto-spend via pf1PreActionUse; cost from casting time
     (standard 2 / full-round 3 / swift 1), NOT spell.level.

   v1.9 (module v2.20.9 — "Background Skills Native Budget Alignment"):
   - backgroundBudgetLevel1 default changed 4 → 2 to match PF1 native
     Background Skills math (HD × backgroundSkillsPerLevel = 2/level).
     The earlier 4-at-level-1 house rule is retired.
   - backgroundBudgetMigrated209 flag registered. One-time world-setting
     migration: if backgroundBudgetLevel1 is still the v2.20.8 default 4,
     set it to 2 on first GM ready. GM-customized values are untouched.
     Touches the module world setting ONLY — never actor data.

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
   - backgroundBudgetLevel1 registered. World scope, default 4 in v2.20.8.
     Originally represented a campaign deviation later dropped in v2.20.9.
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
     ATTACK & SPELL AUTO-SPEND — LIVE as of v2.22.0 (Phase B)

     Hook: pf1PreActionUse(actionUse) — fires once per action-use
     (one Strike, one cast), so no iterative dedupe is needed.
     Pilot 45 confirmed: attacks (item.type attack/weapon) and
     spells (item.type spell) both surface here; spell cost reads
     action.activation.unchained.cost (standard 2 / full-round 3 /
     swift 1); off-turn uses spend a reaction, not an action.
     Both default OFF. Handler lives in scripts/action-tracker.js.
     ---------------------------------------------------------- */
  game.settings.register(SETTINGS_MODULE_ID, 'autoAttackSpend', {
    name: 'Auto-Spend on Attack',
    hint: 'When enabled, an attack by the active combatant spends 1 action pip; an off-turn attack (AoO) spends the reaction pip instead. Default OFF — enable deliberately.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(SETTINGS_MODULE_ID, 'autoSpellSpend', {
    name: 'Auto-Spend on Spell Cast',
    hint: 'When enabled, casting a spell by the active combatant spends action pips equal to its casting time (standard = 2, full-round = 3, swift/quickened = 1). Cost is by casting time, not spell level. Default OFF — enable deliberately.',
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
     HIDDEN TASK STORE — A-017 confidentiality fix

     Client-scope, config-hidden storage for active-GM hidden task
     records. Shape:
       { schemaVersion: 1, worlds: { [game.world.id]: { tasks: {} } } }

     This setting is intentionally not world/user scope: hidden task
     metadata must not replicate to player clients.
     ---------------------------------------------------------- */
  game.settings.register(SETTINGS_MODULE_ID, 'hiddenTaskStore', {
    scope: 'client',
    config: false,
    type: Object,
    default: {
      schemaVersion: 1,
      worlds: {}
    }
  });

  /* ----------------------------------------------------------
     CRITICAL ROLL CARD FLOURISH — v2.23.0 (presentation only)

     Gates the nat-20 / nat-1 chat-card flourish (color wash,
     decaying/swell glow, dramatized label). Default OFF — OFF is
     byte-for-byte today's plain-label behavior. All styling lives
     in styles/noir-theme.css; roll-cards.js sets the body marker
     class and (when ON) extends crit detection to PF1 attack cards.
     No change to crit confirmation, damage, or roll resolution.
     ---------------------------------------------------------- */
  game.settings.register(SETTINGS_MODULE_ID, 'critCardFlourish', {
    name: 'Critical Roll Card Flourish',
    hint: 'When enabled, a natural 20 or natural 1 makes the chat card flourish — a gold celebratory pulse on a crit, a slow bruise-purple swell on a fumble — with a dramatized label. Presentation only; does not change crit confirmation, damage, or resolution. Respects reduced-motion. Default OFF.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    // Toggle the body marker that scopes the flourish CSS (see roll-cards.js).
    onChange: (value) => { try { document.body.classList.toggle('baph-crit-flourish-on', !!value); } catch (e) { /* noop */ } }
  });

  /* ----------------------------------------------------------
     PERCEPTION ALWAYS A CLASS SKILL — v2.27.0

     World toggle. When ON, scripts/perception-class-skill.js treats
     Perception as a class skill for every actor regardless of class. It
     runs in pf1PrepareDerivedActorData (after pf1's own class-skill
     aggregation, which would otherwise force cs=false on classed actors)
     and sets skills.per.cs = true, adding the standard +3 to skills.per.mod
     when the skill was not already a class skill and the actor has >=1 rank.
     This does NOT grant ranks, adds no bonus to 0-rank actors, does not
     double for actors who already have Perception, and never writes actor
     documents (recomputed each prep). onChange re-preps world actors so the
     toggle applies live.
     ---------------------------------------------------------- */
  game.settings.register(SETTINGS_MODULE_ID, 'perceptionAlwaysClassSkill', {
    name: 'Perception Is Always a Class Skill',
    hint: 'When enabled, Perception counts as a class skill for every character regardless of class — the standard +3 applies once they have at least 1 rank. Does not grant ranks; no effect on actors with 0 Perception ranks or those who already have it as a class skill. Default OFF.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    onChange: () => {
      // Re-prepare world actors so the class-skill override applies/clears at once.
      // Use the cached _sheet to avoid lazily instantiating a sheet for every actor.
      try {
        for (const a of game.actors) { a.reset(); if (a._sheet?.rendered) a._sheet.render(false); }
      } catch (e) { /* noop */ }
    }
  });

  console.log(`${SETTINGS_MODULE_ID} | Settings v1.13 registered`);
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
