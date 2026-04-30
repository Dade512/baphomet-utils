# DEV_NOTES — baphomet-utils

Internal development notes. Not user-facing.

---

## v2.10.0 — Action Automation (Future Release)

**Status:** Planned. Scaffold registered in v2.9.9. Do NOT implement mid-campaign.

**What v2.9.9 added (inert):**
- `scripts/settings.js` — all automation settings registered, all default OFF
- `_debugLog`, `_getActiveCombatant`, `_getActiveCombatantForActor`, `_canUserControlCombatant`, `_spendActionForCombatant`, `_spendActionForActor` helpers in `action-tracker.js` (no hooks call them yet)
- `SKILL_ACTION_COSTS` constant in `action-tracker.js` (provisional key names, unverified)

**What v2.10.0 must add:**

### Planned hooks

```javascript
// Attack roll → spend 1 action
Hooks.on('pf1AttackRoll', (actor, rollData) => {
  if (!game.settings.get('baphomet-utils', 'autoAttackSpend')) return;
  _spendActionForActor(actor, 1, 'attack-roll');
});

// Skill roll → allowlist-gated spend
Hooks.on('pf1ActorRollSkill', (actor, skillKey, rollData) => {
  if (!game.settings.get('baphomet-utils', 'autoSkillSpend')) return;
  const allowlist = game.settings.get('baphomet-utils', 'skillAutoAllowlist')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!allowlist.includes(skillKey)) return;
  const cost = SKILL_ACTION_COSTS[skillKey] ?? 1;
  _spendActionForActor(actor, cost, `skill-${skillKey}`);
});
```

### Required verification before enabling hooks

- **Confirm pf1AttackRoll payload:** verify which field carries the actor, whether it fires for AoOs, whether it fires for iterative attacks separately (if so, a dedup guard is needed keyed on roll ID or timestamp).
- **Confirm pf1ActorRollSkill payload:** verify the exact skill key string format (flat key vs dot-path for sub-skills, casing), confirm which field to read.
- **Verify SKILL_ACTION_COSTS keys:** open a game session, add temporary logging to pf1ActorRollSkill, perform each skill check, compare logged key against the SKILL_ACTION_COSTS entries.
- **Unlinked tokens:** verify `_getActiveCombatantForActor` matches synthetic actors correctly. May need a token-ID fallback.

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

### Exclusions (do not add in v2.10.0 first pass)

- **Disable Device** (listed as 3-action cost) — verify action economy before including
- **Use Magic Device** — edge cases around untrained use and item-activation interaction
- **Knowledge/\*** — need a unified approach for all knowledge sub-skills
- **Token drag movement** — too noisy, wrong abstraction
- **Standard/move/swift/full-round inference** — PF1.5 uses 3-action economy; never map back to PF1 action types

### Stability requirements

- All automation must be gatable to ON/OFF per setting (already registered)
- Enable `debugLogging` during development — every spend decision should appear in F12
- Test with automation ON and OFF to confirm pips stay unchanged when disabled
- Test with no active combat — helpers must return false/null gracefully

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
