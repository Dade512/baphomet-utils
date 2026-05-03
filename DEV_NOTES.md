# DEV_NOTES — baphomet-utils

Internal development notes. Not user-facing.

---

## v2.10.1 — Diagnostic Cleanup

Cleaned up `_summarizeHookArg` in `scripts/action-tracker.js` to remove all `arg?.data` probing.

**Root cause:** PF1 emits `ItemAction.data has been deprecated. Use the data directly on the action instead.` compatibility warnings whenever `.data` is accessed on an ItemAction object. The v2.10.0 diagnostic summarizer accessed `arg?.data?.actor`, `arg?.data?.skill`, `arg?.data?.skillId`, and `arg?.data?.skillKey`, triggering these warnings on every `pf1AttackRoll` fire.

**Fix:** All `.data` paths removed from the summarizer. No replacement `.data` access was added. The summarizer now probes non-deprecated paths only:
- Actor paths: `arg?.actor`, `arg?.item?.actor`, `arg?.action?.actor`, `arg?.subject?.actor`, `arg?.parent?.actor`, `arg?.parent`
- Skill key paths: direct (`skill`, `skillId`, `skillKey`, `key`, `id`, `name`), via `arg?.action.*`, via `arg?.subject.*`

Diagnostics remain debug-gated behind the `debugLogging` setting and observer-only. No live action automation is enabled.

---

## v2.10.0 — Action Automation Diagnostics

This version begins action automation work with diagnostic-only PF1 hook logging.

Added debug-gated logging for:
- `pf1AttackRoll`
- `pf1ActorRollSkill`

These hooks do not spend action pips. They exist only to verify the actual PF1 runtime payload shape before final automation logic is wired.

**Testing goals:**
- Confirm actor path for attack rolls.
- Confirm actor path for skill rolls.
- Confirm skill key path and format.
- Confirm whether `pf1AttackRoll` fires once per attack action, once per iterative attack, for AoOs, or during damage/card display flow.
- Look for any stable roll/message/action identifier usable for dedupe.

Automation remains disabled until payload extraction and dedupe rules are confirmed.

---

## v2.10.0 — Action Automation (Future Release — Planning Notes)

**Status:** Planned. Scaffold registered in v2.9.9. Do NOT implement mid-campaign.

**What v2.9.9 added (inert):**
- `scripts/settings.js` — all automation settings registered, all default OFF
- `_debugLog`, `_getActiveCombatant`, `_getActiveCombatantForActor`, `_canUserControlCombatant`, `_spendActionForCombatant`, `_spendActionForActor` helpers in `action-tracker.js` (no hooks call them yet)
- `SKILL_ACTION_COSTS` constant in `action-tracker.js` (provisional key names, unverified)

**What v2.10.0 must add:**

### First step: diagnostic payload logging (v2.10.0 — do this before wiring)

The argument signatures for `pf1AttackRoll` and `pf1ActorRollSkill` are **not verified yet**. Do not assume argument positions, field names, or payload shape. The first thing v2.10.0 must do is add temporary diagnostic hooks that log all raw arguments with `debugLogging` enabled.

With `debugLogging` ON in Module Settings, add temporary hooks like these to identify the actual payload shape:

```javascript
// DIAGNOSTIC ONLY — do not ship. Log full argument list.
// Run a few attacks and check F12 for the output.
Hooks.on('pf1AttackRoll', (...args) => {
  _debugLog('pf1AttackRoll raw args:', ...args);
});

// DIAGNOSTIC ONLY — do not ship. Run each skill in the approved list.
Hooks.on('pf1ActorRollSkill', (...args) => {
  _debugLog('pf1ActorRollSkill raw args:', ...args);
});
```

**What to verify from the diagnostic output before wiring any automation:**

- `pf1AttackRoll`: Which argument position (or property) carries the actor? Does it fire once per attack action, once per individual attack roll (iteratives), or once per damage/card event? Does it fire for AoOs? The dedup guard design depends on this.
- `pf1ActorRollSkill`: Which argument position carries the actor? Which argument carries the skill key? Is the skill key a flat string (`acrobatics`), camelCase (`useMagicDevice`), a dot-path (`knowledge.arcana`), or something else? Log all sub-skill knowledge rolls to confirm the format.
- Verify all keys in `SKILL_ACTION_COSTS` against logged output before enabling any skill automation.

Only after logging and confirming the payload shape should spend wiring be added — using the verified argument positions and field names.

### Approved first-pass skill list (v2.10.0)

These skills are included in the default allowlist and `SKILL_ACTION_COSTS`. All key names are **provisional** and must be verified against the actual `pf1ActorRollSkill` hook payload at runtime before automation is enabled.

| Skill | Action cost | Notes |
|---|---|---|
| Acrobatics | 1 | |
| Bluff | 1 | |
| Intimidate | 1 | |
| Stealth | 1 | |
| Heal | 1 | |
| Use Magic Device | 1 | Verify untrained-use edge cases |
| Disable Device | 3 | Verify cost is correct and not context-dependent |
| Sleight of Hand | 1 | |
| Knowledge (all) | 1 | Placeholder key — verify whether PF1 uses a flat key or dot-paths (e.g. `knowledge.arcana`) |

**Excluded from the default allowlist:**
- **Perception** — passive/reactive sense; spending an action on a Perception check conflicts with PF1.5 action economy intent. Remove from allowlist if a player adds it manually.

### Required verification before enabling hooks

- **Confirm pf1AttackRoll payload:** verify which field carries the actor, whether it fires for AoOs, whether it fires for iterative attacks separately (if so, a dedup guard is needed keyed on roll ID or timestamp).
- **Confirm pf1ActorRollSkill payload:** verify the exact skill key string format (flat key vs dot-path for sub-skills, casing). Perform test rolls for each skill in the approved list and log the raw key received.
- **Verify SKILL_ACTION_COSTS keys:** log pf1ActorRollSkill for each skill, compare output against the scaffold keys. Update any mismatches before enabling.
- **Verify Disable Device cost:** confirm 3 actions is correct for all contexts in PF1.5 before enabling.
- **Verify Knowledge key format:** confirm whether sub-skills arrive as `knowledge`, `knowledge.arcana`, or some other shape.
- **Unlinked tokens:** `_getActiveCombatantForActor` matches on `actor.id`. Verify that unlinked token synthetic actors resolve correctly, or add a token-ID fallback.

### Dedupe guard (required)

Attack hooks and skill hooks may fire multiple times for the same user action (e.g., iterative attacks, hook re-entrant from PF1 internals). Before going live, implement a short-window dedup:

```javascript
const _recentSpends = new Set();

function _dedupeSpend(key, fn) {
  if (_recentSpends.has(key)) return;
  _recentSpends.add(key);
  setTimeout(() => _recentSpends.delete(key), 500); // 500ms window
  fn();
}
```

### Floating Move / Stride button

- Position preference stored in `moveButtonPosition` setting (already registered)
- Implementation: inject a fixed-position button during combat; clicking spends 1 action and emits a chat message or notification
- Do NOT use token drag movement as the implementation — too unreliable and fires from GM scene panning
- The button should appear only when combat is active AND the current user has a combatant with actions remaining

### Exclusions (never add without explicit GM review)

- **Perception** — excluded from default allowlist; do not include in first pass
- **Token drag movement** — too noisy, wrong abstraction
- **Standard/move/swift/full-round inference** — PF1.5 uses 3-action economy; never map back to PF1 action types

### Stability requirements

- All automation must be gatable to ON/OFF per setting (already registered)
- Enable `debugLogging` during development — every spend decision should appear in F12
- Test with automation ON and OFF to confirm pips stay unchanged when disabled
- Test with no active combat — helpers must return false/null gracefully
- `_getActiveCombatantForActor` only returns the current active combatant — off-turn actors must not trigger pip spends

---

## Staged ESM Migration (Future Task)

**Status:** Deferred. Not in scope for any current patch.

**Why it needs doing eventually:**
`module.json` currently declares scripts via the legacy `"scripts"` array. Foundry v13 mandates ES modules (`"esmodules"`) as the canonical pattern — `"scripts"` loads files as classic scripts (no `import`/`export`, no module scope isolation, global variable pollution). It still works in v13 but is the deprecated path and will eventually be removed.

**When to do it:**
Once a session-boundary exists where a full regression test is practical. This is not a quick rename — converting classic scripts to ESM requires:
- Confirming all inter-file globals (`_baphNormalizeHtml`, `pipState`, etc.) are properly imported/exported rather than relying on global scope load order
- Introducing a `scripts/main.js` or `scripts/main.mjs` as the single entry point declared in `"esmodules"`, which imports the rest
- Or migrating each file independently and declaring all of them in `"esmodules"` (easier, but loses the single-entry-point pattern)
- Verifying `data/climate-zones.js` is also converted (it's loaded first in the scripts array and likely relies on being globally available)
- End-to-end test: all seven features (theme, conditions, action tracker, roll cards, XP, weather engine, weather UI) pass smoke tests

**Recommended approach:**
Introduce `scripts/main.mjs` as the orchestrator entry point. Convert each existing file to ESM (`export function`, `import { x } from './y.js'`). Declare only `main.mjs` in `"esmodules"`. Remove `"scripts"` array. This matches the pattern used by `local-lore-oracle`.

**Do NOT do this mid-campaign** without a full test session.

---

## Known Deferred Items

- `FormApplication` in `local-lore-oracle` settings.js — fires v13 deprecation console warnings but is functional. Migrate to `ApplicationV2` in a future pass.
- `baphomet-utils` now has `scripts/settings.js` — any future GM-configurable options (beyond weather UI and automation scaffold) should land there.
