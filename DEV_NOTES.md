# DEV_NOTES — baphomet-utils

Internal development notes. Not user-facing.

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

- `settings.js` / `OraclePromptEditor` in local-lore-oracle still uses `FormApplication` — will fire v13 deprecation console warnings but is functional. Migrate to `ApplicationV2` in a future pass.
- `baphomet-utils` has no `settings.js` yet — any future GM-configurable options beyond the weather UI should land there.
