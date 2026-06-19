/* ============================================================
   BAPHOMET UTILS — PERCEPTION CLASS-SKILL OVERRIDE v2.27.0
   "Perception is always a class skill" toggle.

   When the world setting `perceptionAlwaysClassSkill` is ON, this forces
   Perception to count as a class skill for EVERY actor, regardless of class.

   Mechanism (runtime-verified — see DEV_NOTES v2.27.0):
   It runs in `pf1PrepareDerivedActorData`, which fires AFTER pf1's own
   class-skill aggregation (`_prepareClassSkills`). That ordering is essential:
   pf1 explicitly sets `skills.per.cs = false` during derived prep for any
   classed actor whose class does not grant Perception, so flipping the flag
   earlier (in base prep) is overwritten and has NO effect on real (classed)
   actors. Setting it here — last — sticks.

   Because the skill total (`skills.per.mod`) is already computed before this
   hook runs, flipping `cs` alone does NOT add the +3: pf1 does not recompute
   the modifier from `cs` at roll time (`getSkillInfo` and rollData read the
   cached `mod`). So when this hook newly turns Perception into a class skill
   for an actor with >= 1 rank, it also adds the standard PF1 class-skill bonus
   (+3) to `skills.per.mod` itself, which is the single value the sheet, rollData,
   and `getSkillInfo` all consume.

   Guarantees:
   - Derived override ONLY. Never writes actor documents; recomputed each prep;
     nothing persisted (`cs` is absent from actor _source).
   - Idempotent. The +3 is added only when Perception was NOT already a class
     skill, so actors who naturally have it keep their single pf1-computed +3 —
     no doubling.
   - No bonus at 0 ranks. The +3 is added only when `rank >= 1` (PF1's own rule),
     so non-investors gain nothing and no ranks are granted. The `cs` flag is
     still set true so the skill reads as a class skill on every actor.
   - Default OFF (setting registered in scripts/settings.js, whose onChange
     re-preps world actors so the toggle applies live).

   For Foundry VTT v13 + PF1e System
   ============================================================ */

(() => {
  const PCS_MODULE_ID = 'baphomet-utils';
  const CLASS_SKILL_BONUS = 3; // PF1 RAW: +3 for a class skill with >= 1 rank.

  function _featureEnabled() {
    try { return game.settings.get(PCS_MODULE_ID, 'perceptionAlwaysClassSkill') === true; }
    catch (e) { return false; }
  }

  function _debugEnabled() {
    try { return game.settings.get(PCS_MODULE_ID, 'debugLogging') === true; }
    catch (e) { return false; }
  }

  // Runs after pf1's class-skill aggregation. When the setting is ON, mark
  // Perception a class skill and apply the +3 pf1 would have given — only when
  // it was not already a class skill AND the actor has >= 1 rank.
  Hooks.on('pf1PrepareDerivedActorData', (actor) => {
    if (!_featureEnabled()) return;
    const per = actor?.system?.skills?.per;
    if (!per) return;
    const wasClassSkill = per.cs === true;
    per.cs = true;
    const appliesBonus = !wasClassSkill && (per.rank ?? 0) >= 1;
    if (appliesBonus) {
      per.mod = (per.mod ?? 0) + CLASS_SKILL_BONUS;
    }
    if (_debugEnabled()) {
      console.log(`${PCS_MODULE_ID} | perception-class-skill | ${actor?.name ?? actor?.id ?? 'actor'}: cs=true${appliesBonus ? ` (+${CLASS_SKILL_BONUS})` : ' (no bonus)'}`);
    }
  });

  Hooks.once('ready', () => {
    console.log(`${PCS_MODULE_ID} | Perception Class-Skill v2.27.0 loaded (feature ${_featureEnabled() ? 'ON' : 'OFF'})`);
  });
})();
