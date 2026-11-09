/* ============================================================
   BAPHOMET UTILS — PERCEPTION CLASS-SKILL OVERRIDE v2.49.0
   "Perception is always a class skill" toggle.

   When the world setting `perceptionAlwaysClassSkill` is ON, this makes
   Perception count as a class skill for EVERY creature with a Perception
   skill (characters, NPCs and monsters alike), regardless of class.

   Mechanism (v2.49.0, TD-100 (a); pf1 11.11):
   It listens on `pf1AddDefaultChanges` and sets only `skills.per.cs = true`.
   pf1 fires that hook from `_prepareTypeChanges`, which runs from
   `applyActiveEffects()` -> `_prepareChanges()`, AFTER `_prepareClassSkills`
   has forced `cs` from the class / race / feat items' `classSkills` and
   BEFORE the type changes are pushed. The type changes are where pf1 builds
   its own `+rank[Skill Ranks]` and, if `cs`, `+3[Class Skill]` (untyped,
   target `skill.~per`) for every skill with rank > 0. So a `cs` set inside
   this hook is the one the change builder reads: the +3 lands on the roll,
   the sheet, `getSkillInfo('per')` and the roll data alike, as pf1's own
   change, with no arithmetic of ours.

   This replaces the v2.27.0 mechanism, which ran in
   `pf1PrepareDerivedActorData` and added +3 to `skills.per.mod` by hand on the
   premise that "pf1 reads the cached `mod` at roll time". That premise is not
   so in pf1 11.11: pf1 rolls the actor's CHANGES, the `+3[Class Skill]` change
   is built from `cs` before derived prep runs, and a derived-prep patch comes
   too late (the sheet showed the +3, `rollSkill('per')` rolled without it).

   Scope: every creature with a `skills.per` (H:2398) — no type test.

   Guarantees:
   - Derived override ONLY. Never writes actor documents; recomputed each prep;
     nothing persisted (`cs` is absent from actor _source).
   - No ranks granted. pf1 builds its +3 at rank > 0 and nothing at rank 0.
   - No doubling. A creature already class-skilled keeps pf1's one +3.
   - Default OFF (setting registered in scripts/settings.js, whose onChange
     re-preps world actors so the toggle applies live). The listener is
     registered unconditionally (pf1 calls the hook only while a listener
     exists) and tests the setting inside, so an ON toggle needs no reload.

   For Foundry VTT v13 + PF1e System
   ============================================================ */

(() => {
  const PCS_MODULE_ID = 'baphomet-utils';

  function _featureEnabled() {
    try { return game.settings.get(PCS_MODULE_ID, 'perceptionAlwaysClassSkill') === true; }
    catch (e) { return false; }
  }

  function _debugEnabled() {
    try { return game.settings.get(PCS_MODULE_ID, 'debugLogging') === true; }
    catch (e) { return false; }
  }

  // Runs inside every actor's preparation, after pf1's class-skill aggregation
  // and before pf1 builds its type changes. Derived data only; never awaits,
  // never writes a document.
  Hooks.on('pf1AddDefaultChanges', (actor) => {
    if (!_featureEnabled()) return;
    const per = actor?.system?.skills?.per;
    if (!per) return;
    per.cs = true;
    if (_debugEnabled()) console.log(`${PCS_MODULE_ID} | perception-class-skill | ${actor?.name ?? actor?.id ?? 'actor'}: cs=true (pf1 builds the +3 at rank > 0)`);
  });

  Hooks.once('ready', () => {
    console.log(`${PCS_MODULE_ID} | Perception Class-Skill v2.49.0 loaded — pf1AddDefaultChanges (feature ${_featureEnabled() ? 'ON' : 'OFF'})`);
  });
})();
