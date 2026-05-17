# Foundry VTT v13 + PF1 Knowledge Files - Combined Review

Generated: 2026-05-03 00:35
Source: S:\Campaign Material\Modules\~ Knowledge_Files
Files included: 26

---

## FILE: 00_READ_FIRST_Foundry_PF1_Module_Dev_Index.md

# Foundry + PF1 Module Development Index

## Purpose

Unified master index for module development using **Foundry VTT v13.350+** with the **Pathfinder 1e (`pf1`)** system. Explains how to use both Foundry core docs and PF1 system docs together.

## When to Use This

- Starting a new module project for PF1
- Need to find which reference file covers your specific task
- Understanding the relationship between Foundry core and PF1 system APIs
- Planning module architecture for PF1 + PF1.5

---

## How Foundry Core and PF1 Docs Work Together

### Platform vs System Architecture

| Layer           | Foundry VTT Core                                             | Pathfinder 1e System                                                   |
| --------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **Platform**    | Foundry engine, canvas, UI framework                         | PF1 game rules implementation                                          |
| **Documents**   | Base `Document`, `ClientDocument`, `CanvasDocument`          | `ActorPF`, `ItemPF`, `CombatPF`, etc.                                  |
| **Data Models** | Base `DataModel`, `TypeDataModel`                            | `CharacterModel`, `NPCModel`, `WeaponModel`, etc.                      |
| **UI**          | `ApplicationV2`, `DialogV2`, `DocumentSheetV2`               | `ActionDialog`, `SpellbookManager`, `ApplyDamage`, etc.                |
| **Registries**  | Core Foundry registries                                      | `pf1.registry.conditions`, `pf1.registry.damageTypes`, etc.            |
| **Hooks**       | Core Foundry hooks (`init`, `ready`, `createDocument`, etc.) | PF1-specific hooks (`pf1PreActorRollSkill`, `pf1CombatTurnSkip`, etc.) |
| **Dice**        | Base `Roll`, `DiceRoll`                                      | `D20RollPF`, `DamageRoll`, `RollPF`                                    |

**Rule of Thumb**:

- **Foundry core docs** govern **engine behavior** (canvas, documents, applications, hooks system)
- **PF1 system docs** govern **PF1-specific behavior** (actor/item data, combat, rolls, conditions)
- **Use both** for complete module development

### When to Consult Which Docs

| Task Category               | Primary Docs | Key Files                                    |
| --------------------------- | ------------ | -------------------------------------------- |
| **Module Setup**            | Foundry      | `Foundry_v13_Module_Manifest_Packages.md`    |
| **API Safety**              | Foundry      | `Foundry_v13_API_Safety_and_Migration.md`    |
| **Hooks System**            | Foundry      | `Foundry_v13_Hooks_Lifecycle_Rendering.md`   |
| **Core Documents**          | Foundry      | `Foundry_v13_Documents_Data_Canvas.md`       |
| **ApplicationV2 UI**        | Foundry      | `Foundry_v13_ApplicationV2_UI.md`            |
| **PF1 Namespaces/Config**   | PF1          | `PF1_Namespaces_Config_Registry.md`          |
| **PF1 Actors**              | PF1          | `PF1_Actor_Documents_Data_Paths.md`          |
| **PF1 Items**               | PF1          | `PF1_Item_Documents_Data_Paths.md`           |
| **PF1 Conditions/Buffs**    | PF1          | `PF1_Buffs_Conditions_ActiveEffects.md`      |
| **PF1 Combat**              | PF1          | `PF1_Combat_Turns_Action_Economy.md`         |
| **PF1 Rolls**               | PF1          | `PF1_Rolls_ActionUse_ChatCards.md`           |
| **PF1 Tokens/Sheets/UI**    | PF1          | `PF1_Tokens_Canvas_Sheets_UI.md`             |
| **PF1 Hooks/Lifecycle**     | PF1          | `PF1_Hooks_Lifecycle_Extension_Points.md`    |
| **Code Review**             | Both         | `Foundry_PF1_Module_Review_Checklist.md`     |
| **Claude Code Setup**       | Both         | `Claude_Code_Foundry_PF1_Module_Addendum.md` |

---

## Standard Module Folder Structure

```
my-pf1-module/
├── module.json              # Manifest (required)
├── README.md
│
├── scripts/
│   ├── module.mjs           # Main entry point
│   ├── settings.mjs
│   │
│   ├── hooks/
│   │   ├── actor.mjs
│   │   ├── combat.mjs
│   │   ├── item.mjs
│   │   ├── rolls.mjs
│   │   └── ui.mjs
│   │
│   ├── pf1/
│   │   ├── actions/
│   │   │   └── tracker.mjs  # PF1.5: 3 actions + 1 reaction
│   │   ├── conditions/
│   │   │   ├── tiered.mjs
│   │   │   └── toggle.mjs
│   │   └── utils.mjs
│   │
│   └── apps/
│       └── action-hud.mjs
│
├── styles/
│   └── module.css
│
├── templates/
│   └── action-hud.hbs
│
└── lang/
    └── en.json
```

---

## Preferred ES Module Entry Pattern

```javascript
// scripts/module.mjs
import { registerSettings } from './settings.mjs';
import { setupHooks }       from './hooks/module.mjs';
import { setupPF1Hooks }    from './pf1/hooks.mjs';

// 1. init — settings, CONFIG, data model registration; no world data
Hooks.once('init', () => {
  registerSettings();
});

// 2. pf1PostReady — world fully loaded, PF1 bootstrapped
Hooks.once('pf1PostReady', () => {
  setupHooks();
  setupPF1Hooks();
});
```

---

## Do Not Guess Rule

If an API, method, hook, or data path is **not** in the Foundry v13 API docs **and** not in the PF1 API docs:

- Mark it: **"Not confirmed in indexed docs"**
- Do not use it in production code
- Implement a fallback using confirmed APIs

### Common Unconfirmed Assumptions (and what to use instead)

- `actor.system.attributes.hp.value` — PF1 path, **not confirmed in indexed docs**. Verify in PF1 source per version.
- `actor.hasCondition(id)` — not directly indexed in the public API. Use `actor.statuses.has(id)` (Foundry core) or read `actor.system.conditions[id]` directly. The condition state path **is** verified in canonical `hooks.d.ts`.
- `actor.getRollData()` — **available** (Foundry core method, inherited from `Actor`). PF1 extends it via the `pf1GetRollData(actor, rollData)` hook. Both safe to use; the hook is the cleaner injection point for custom data.
- `actor.rollSkill('stealth')` — **confirmed** as `actor.rollSkill(skillId, options)` per PF1 docs (options include `skipDialog`, `bonus`, `dice`). The `pf1PreActorRollSkill` hook still fires and is the right place for cross-cutting bonus injection.
- `actor.toggleCondition(key, state)` / `actor.setCondition(key, state)` / `actor.setConditions({...})` — all **confirmed** PF1 methods.
- `Hooks.on('pf1SomeHook')` — only valid if listed in PF1 `hookEvents` docs (or in the canonical `hooks.d.ts` if you're cross-referencing the source).

---

## PF1.5 House Rule Framework

### PF1.5 Is NOT a Foundry System

PF1.5 is a custom house rule framework on top of Foundry v13 + Pathfinder 1e.

| Feature                | PF1 Native | Implementation Required         |
| ---------------------- | ---------- | ------------------------------- |
| 3 actions + 1 reaction | No         | Module-owned flag tracking      |
| Tiered conditions      | No         | Custom severity tracking        |
| Toggle conditions      | Partial    | Use PF1 native where compatible |
| Action costs on items  | No         | Module-owned item flags         |

### Implementation Strategy

```javascript
// MODULE DESIGN PATTERN — PF1.5 action tracking via flags
const MODULE_ID = 'my-pf1-5-module';

function spendAction(actor, cost = 1) {
  const current = actor.getFlag(MODULE_ID, 'actions') || 0;
  if (current + cost > 3) return false;
  actor.setFlag(MODULE_ID, 'actions', current + cost);
  return true;
}

// Use combatTurn for per-turn resets (fires every turn advance)
Hooks.on('combatTurn', (combat, updateData, updateOptions) => {
  const combatant = combat.combatant;
  if (combatant?.actor) {
    combatant.actor.unsetFlag(MODULE_ID, 'actions');
    combatant.actor.unsetFlag(MODULE_ID, 'reactions');
  }
});
```

---

## Source Pages Consulted

- [Foundry VTT v13 API Documentation](https://foundryvtt.com/api/v13/index.html)
- [Introduction to Module Development](https://foundryvtt.com/article/module-development/)
- [API Migration Guides](https://foundryvtt.com/article/migration/)
- [Release 13.350 Notes](https://foundryvtt.com/releases/13.350)
- [Pathfinder 1e for Foundry VTT - Main Documentation](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/index.html)
- [PF1 Hook Events](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/hookEvents.html)

---

*Last updated: May 2026 | Foundry VTT v13.350+ | Pathfinder 1e System | PF1.5 Framework*

---

## FILE: 00_READ_FIRST_Foundry_PF1_Module_Review_Checklist.md

# Foundry + PF1 Module Review Checklist

## Purpose

Combined pre-publish review checklist for Foundry VTT v13 modules targeting the Pathfinder 1e system with PF1.5 house rules. Covers API safety, PF1 data correctness, v13 compatibility, and PF1.5 mechanical integrity.

## When to Use This

- Before committing a release
- After adding a new feature
- When reviewing someone else's PF1 module code
- After a Foundry version update

---

## Section 1 — Foundry v13 Core Compatibility

### Manifest

- [ ] `esmodules` used instead of legacy `scripts`
- [ ] `compatibility.minimum` set to `13`
- [ ] Both `manifest` and `download` fields present (required for in-app installer)
- [ ] JSON is valid — no trailing commas, no missing brackets

### API Safety

- [ ] No `_underscore` private methods called externally
- [ ] No `#privateField` access attempted
- [ ] No prototype patching (`Actor.prototype.x = ...`)
- [ ] All `@internal` methods avoided
- [ ] Unconfirmed APIs wrapped in try/catch with fallback

### Hooks

- [ ] `combatRound` used instead of removed `combatRoundChange`
- [ ] `combatTurn` used for per-turn logic instead of `pf1CombatTurnSkip`
- [ ] `renderChatMessageHTML` used instead of removed `renderChatMessage`
- [ ] `renderApplicationV2` handler uses 3 args `(app, element, context)`, not 2
- [ ] `getHeaderControlsApplicationV2` used for V2 header buttons
- [ ] No hooks assumed to be awaited — async handling is internal
- [ ] Pre-hooks that must cancel use **synchronous** handlers (async cannot cancel)

### Render Hooks — Element Types

- [ ] V2 render hooks use `element.querySelector()`, not `$(element).find()`
- [ ] V1 render hooks (PF1 sheets, Token HUD) use `html[0]` or jQuery correctly
- [ ] `renderTokenHUD` treats `html` as jQuery (Token HUD is V1)
- [ ] PF1 system hooks pass the **right type** for their actual signature: `pf1DisplayCard` passes `(item, {template, templateData, chatData})` (structured data object, NOT jQuery); `pf1RenderQuickActions` passes `(hud, token, template:DocumentFragment)`; `pf1HealthDeltaRender` passes `(actor, options, textOptions)` config objects; `renderPF1ExtendedTooltip` passes `(sheet, id, template:DocumentFragment)`. None of these pass jQuery.
- [ ] PF1 actor sheet render hooks (`renderActorSheet`, `renderActorSheetPFCharacter`, etc.) treat the second arg as **`HTMLElement`** — PF1 sheets are V2 (`ApplicationV2 + HandlebarsApplicationMixin`), not V1.

### Lifecycle Timing

- [ ] `game.actors`, `game.items`, `canvas` not accessed in `init` or `setup`
- [ ] PF1 registries not accessed before `pf1PostSetup`
- [ ] World documents not accessed before `pf1PostReady`
- [ ] Settings registered in `init`

### CSS

- [ ] All module CSS scoped with module ID prefix
- [ ] No overrides of core or PF1 CSS without `!important` documentation
- [ ] Theme-dark variables do not bleed into module styles unexpectedly

---

## Section 2 — PF1 System Correctness

### Namespaces and Config

- [ ] `pf1.config` read only — never mutated
- [ ] `pf1.registry.*` accessed no earlier than `pf1PostSetup`
- [ ] `CONFIG.PF1` used only where `pf1.config` is unavailable
- [ ] Registry IDs are lowercase strings (e.g., `'blinded'` not `'Blinded'`)

### Actor Data

- [ ] No `actor.hasCondition()` calls (not directly indexed) — use `actor.statuses.has(key)` (Foundry core) or read `actor.system.conditions[key]` directly
- [ ] `actor.getRollData()` is fine to call directly (Foundry core; PF1 extends via `pf1GetRollData` hook). Use the hook for cross-cutting bonus injection, not as a replacement.
- [ ] No hardcoded `system.*` data paths without source verification (exception: `actor.system.conditions` is verified per `hooks.d.ts`)
- [ ] `actor.isOwner` checked before updates in multiplayer context
- [ ] All `actor.update()` calls are awaited

### Item Data

- [ ] Item type strings are lowercase (`'weapon'`, `'feat'`, `'buff'`)
- [ ] No `system.*` item paths used without verification
- [ ] `pf1DisplayCard` handler signature is `(item, data)` where `data` is `{ template, templateData, chatData }` — not `(actor, html, data)`. Mutate `data.chatData.flags` to flag the eventual chat message; use `renderChatMessageHTML` to mutate the rendered DOM.
- [ ] `pf1PreActionUse(actionUse) => boolean` is **cancellable** (`Hooks.call`); takes a single `ActionUse`, not `(actor, item, options)`

### Conditions and Buffs

- [ ] No `actor.addCondition()` / `actor.removeCondition()` calls (don't exist) — use `actor.setCondition(key, true|false)` or `actor.toggleCondition(key, state)`
- [ ] ActiveEffect `changes` key paths marked as unconfirmed or verified in PF1 source
- [ ] Condition state read via `actor.statuses.has(key)` or `actor.system.conditions[key]`; written via `setCondition`/`toggleCondition`/`setConditions`. The `pf1ToggleActorCondition(actor, condition, state)` hook is for reactive bookkeeping, not as a method substitute.

### Rolls

- [ ] `actor.getRollData()` called directly is fine (Foundry core); use `pf1GetRollData(actor, rollData)` hook for cross-cutting bonus injection
- [ ] `D20RollPF` constructor options verified in PF1 source before use
- [ ] Action-use pre-hooks cancellation **is confirmed**: `pf1PreActionUse`, `pf1PreDisplayActionUse`, `pf1DisplayCard`, and `pf1DropContainerSheetData` all return `boolean` and accept `return false`. Roll pre-hooks (e.g., `pf1PreD20Roll`) need per-hook verification.

### Combat

- [ ] `combatTurn` used for turn-start resets (fires every advance)
- [ ] `pf1CombatTurnSkip` used only for skip-specific edge cases
- [ ] Combat hooks use v13 names: `combatRound`, `combatTurn`, `combatTurnChange`

---

## Section 3 — PF1.5 Mechanical Integrity

### Action Economy

- [ ] 3-action + 1-reaction tracking implemented entirely via module flags
- [ ] No assumption that PF1 natively stores action counts
- [ ] Turn-start reset hooked to `combatTurn`, not `pf1CombatTurnSkip` alone
- [ ] `spendAction()` and `spendReaction()` return false and notify before failing
- [ ] Combat start resets all combatants' action flags

### Conditions

- [ ] Tiered conditions (fatigued, exhausted, staggered) stored as flag integers, not PF1 native condition state
- [ ] Toggle conditions tracked separately from tiered conditions
- [ ] PF1.5 condition UI does not assume PF1's StatusHUD shows correct severity
- [ ] Condition severity 0 = inactive; no negative tiers

### UI

- [ ] Action tracker visible on character sheets (not NPC sheets unless intended)
- [ ] Token HUD action display does not break non-PF1.5 tokens
- [ ] High contrast maintained on parchment backgrounds (Croaker's Ledger aesthetic)
- [ ] Mechanical numbers readable at a glance
- [ ] No pure white, neon glow, or modern digital styling

---

## Section 4 — Module Architecture

- [ ] No `console.log` left in production paths
- [ ] All async operations have error handling (try/catch or `.catch()`)
- [ ] All hooks removed on module disable (or scoped to session lifetime correctly)
- [ ] Socket handler registered before `ready` fires
- [ ] Socket channel uses `module.{module-id}` prefix
- [ ] Flags use module ID namespace — never another module's namespace
- [ ] Settings registered only once (in `init`)
- [ ] No duplicate hook registrations on hot reload

---

## Section 5 — Files Still Needing API-Level Review

> Tracked for future passes; current state below.

- [x] PF1 hook signatures audited against canonical `hooks.d.ts` (commit `16f49ae3`) — buff/condition/action-use/combat-skip/item-link signatures verified
- [x] PF1 sheet provenance confirmed V2 (`ApplicationV2 + HandlebarsApplicationMixin`)
- [x] `pf1RenderQuickActions`, `renderPF1ExtendedTooltip`, `pf1HealthDeltaRender`, `pf1DropContainerSheetData`, `pf1DisplayCard` argument shapes corrected throughout reference set
- [ ] `PF1_Namespaces_Config_Registry.md` — `ClientSettings.register()` call style; v13 correct form is `game.settings.register()`
- [ ] Foundry core `TokenHUD` V1/V2 status not directly verified; current claim of V1 (jQuery) retained pending positive confirmation either way

---

## Source Pages Consulted

- [Foundry VTT v13 API Documentation](https://foundryvtt.com/api/v13/index.html)
- [Module: hookEvents v13](https://foundryvtt.com/api/v13/modules/hookEvents.html)
- [API Migration Guides](https://foundryvtt.com/article/migration/)
- [Pathfinder 1e Hook Events](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/hookEvents.html)
- [PF1 Namespace: documents](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/pf1.documents.html)

---

*Last updated: May 2026 | Foundry VTT v13.350+ | Pathfinder 1e System | PF1.5 Framework*

---

## FILE: 00_READ_FIRST_Foundry_v13_API_Safety_and_Migration.md

# Foundry VTT v13 API Safety & Migration

## Purpose

Reference for Foundry VTT v13 API safety boundaries, public/private API distinctions, and v12→v13 migration considerations. Essential for writing stable, future-proof modules.

## When to Use This

- Before using any Foundry API method or property
- Migrating a module from v12 to v13
- Reviewing module code for API safety
- Debugging breakage after Foundry updates

---

## Core Classes / APIs

- `**foundry.helpers.Hooks**` - Event framework with public methods
- `**foundry.helpers.ClientSettings**` - Settings management
- `**foundry.abstract.Document**` - Base document class
- `**foundry.ClientDocument**` - Client-side document mixin
- `**foundry.CanvasDocument**` - Canvas-visible document mixin
- `**foundry.abstract.DataModel**` - Base data model class

---

## Confirmed Namespaces / Classes / Hooks / Fields

### API Classification System


| Annotation   | Access Level | Stability  | Usage                       |
| ------------ | ------------ | ---------- | --------------------------- |
| `@public`    | External     | ✅ Stable   | Safe to call from modules   |
| `@protected` | Subclass     | ✅ Stable   | Override in subclasses only |
| `@private`   | Internal     | ❌ Unstable | Do NOT use                  |
| `@internal`  | Core-only    | ❌ Unstable | Do NOT use                  |


### Naming Conventions


| Prefix/Style  | Meaning          | Usage                                                 |
| ------------- | ---------------- | ----------------------------------------------------- |
| `_method()`   | Implied private  | Treat as `@private` - **Do NOT use**                  |
| `#field`      | JS private field | Syntax error if accessed externally                   |
| No annotation | Unclear          | **Not confirmed in indexed docs** - Verify before use |


### Confirmed Public API Patterns

From Foundry v13 documentation:

**Public Methods (Safe to Use):**

- `Hooks.on(hook, callback)` - Register hook
- `Hooks.once(hook, callback)` - Register one-time hook
- `Hooks.off(hook, callback)` - Remove hook
- `Hooks.call(hook, ...args)` - Call hooks
- `Hooks.callAll(hook, ...args)` - Call all hooks
- `game.settings.register(module, key, config)` - Register setting (the underlying class is `foundry.helpers.ClientSettings`, but call sites use `game.settings.*`)
- `game.settings.get(module, key)` - Get setting value
- `game.settings.set(module, key, value)` - Set setting value

**Document Operations (Public):**

- `Document.create(data, options)` - Create document
- `Document.update(changes, options)` - Update document
- `Document.delete(options)` - Delete document
- `Document.getEmbeddedCollection(collectionName)` - Get embedded collection
- `Document.createEmbeddedDocuments(collectionName, data, options)` - Create embedded
- `Document.updateEmbeddedDocuments(collectionName, changes, options)` - Update embedded
- `Document.deleteEmbeddedDocuments(collectionName, ids, options)` - Delete embedded

---

## Safe Module Patterns

### ✅ Using Public APIs

```javascript
// HOOKS - All public
Hooks.on('init', () => {});
Hooks.once('ready', () => {});
Hooks.off('someHook', callback);

// SETTINGS - Public (call sites use game.settings.*)
game.settings.register('my-module', 'enable', {
  name: 'Enable Feature',
  scope: 'world',
  type: Boolean,
  default: true,
  config: true
});

// DOCUMENTS - Public
// Note: bare `Actor` is a legacy global; canonical class is `foundry.documents.Actor`.
const actor = await foundry.documents.Actor.create({ name: 'Test', type: 'character' });
actor.update({ 'name': 'New Name' });
actor.delete();

// COLLECTIONS - Public
game.actors.get('id');
game.actors.filter(a => a.type === 'character');
game.actors.find(a => a.name === 'Gandalf');
```

### ✅ Extending Public Classes

> ⚠️ **Import specifier**: `foundry/applications/api/application-v2.mjs` is a bare specifier requiring Foundry's import map or a bundler. Use the global directly if neither is configured.

```javascript
// Global (always works in Foundry module context, no import needed)
const { ApplicationV2 } = foundry.applications.api;
// OR with import map/bundler only:
// import { ApplicationV2 } from 'foundry/applications/api/application-v2.mjs';

// Use HandlebarsApplicationMixin when rendering Handlebars templates
const { ApplicationV2: AppV2, HandlebarsApplicationMixin } = foundry.applications.api;

class MyApp extends HandlebarsApplicationMixin(AppV2) {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    id: 'my-app'
  };

  // With HandlebarsApplicationMixin, templates live in PARTS
  static PARTS = {
    main: { template: 'modules/my-module/templates/app.hbs' }
  };

  // Override protected methods (safe in subclasses)
  _onRender(context, options) {
    super._onRender(context, options);
    // Custom logic
  }
}
```

### ✅ Canvas Access with Guard

```javascript
// Always check canvas readiness
if (canvas?.ready) {
  const token = canvas.tokens.get('token-id');
  token.control();
}

// Or use canvasReady hook
Hooks.on('canvasReady', () => {
  // Safe to access canvas
});
```

### ❌ Unsafe: Private/Internal APIs

```javascript
// PRIVATE - Will break
actor._onUpdate();           // ❌ Underscore prefix = private
canvas._draw();              // ❌ Underscore prefix = private
game._someInternalMethod(); // ❌ @internal

// JS PRIVATE - Syntax error
actor.#privateField;         // ❌ SyntaxError: Private field
```

---

## Common Pitfalls

1. **Underscore Methods**: All `_method()` calls are **unstable**. Foundry is migrating these to true private (`#`) fields. **Do NOT use.**
2. **Legacy Globals**: Some classes still exist as globals but are **deprecated**. Use `foundry.*` namespace: `foundry.documents.Actor`, not global `Actor`.
3. **ESM Migration**: Client code migrated to ESM in **v13.338**. Use `import`/`export` syntax. Legacy `scripts` array is deprecated; use `esmodules`.
4. **Async Assumptions**: Not all methods are async. Check documentation. Some hooks are sync, some are async.
5. **Context Availability**: `canvas` is undefined outside scene contexts. Always check `canvas?.ready`.
6. **Document Types**: `ClientDocument` methods don't exist server-side. Use `document.isOwner` to check permissions.
7. **Collection Methods**: Some collection methods are private. Use public `get()`, `filter()`, `find()`.
8. **CONFIG Modifications**: Modifying `CONFIG` directly can break. Use `CONFIG.patch()` or hooks.
9. **Prototype Pollution**: **Never** modify core prototypes (`Actor.prototype`, `Item.prototype`, etc.). Will break with updates.
10. **Hooks Are Never Awaited**: Foundry hooks are never awaited. Async handlers run fire-and-forget; returning a Promise does not block the caller and cannot cancel a pre-hook. Use synchronous handlers for cancellable pre-hooks and handle async work internally.

---

## v12 → v13 Migration Pitfalls

### ✅ Confirmed v13 Changes

1. **ESM Migration (v13.338)**: Client code now uses ES modules. Use `esmodules` array in manifest, not `scripts`.
2. **Namespace Organization**: Many classes moved to `foundry.*` namespace. Avoid legacy globals.
  - **v12**: `Actor`, `Item`, `Scene` (globals)
  - **v13**: `foundry.documents.Actor`, `foundry.documents.Item`, `foundry.documents.Scene`
3. **ApplicationV2**: New UI framework. Prefer over legacy `Application` where possible.
4. **Canvas Layers**: Layer hierarchy reorganized. Some layer names/z-indices changed.
5. **Document Data Models**: `DataModel` and `TypeDataModel` introduced for structured data validation.
6. **ClientDocument vs Document**: Client-side methods separated into `ClientDocument` mixin.

### ⚠️ Migration Warnings

1. **Check `scripts` vs `esmodules**`: If your manifest has `scripts`, migrate to `esmodules` for v13.
2. **Global References**: Search for unqualified references (`Actor`, `Item`, `Hooks`, etc.) and replace with `foundry.*` or proper imports.
3. **Underscore Usage**: Search for `_` prefixed method calls and replace with public alternatives.
4. **Async Hooks**: Foundry does not await hook callbacks. Do not rely on async hook handlers to block execution or cancel pre-hooks.
5. **Application Rendering**: If using legacy `Application`, check if `ApplicationV2` provides the same functionality.

### Migration Checklist

- Replace `scripts` with `esmodules` in manifest
- Replace global references with `foundry.*` namespace
- Remove underscore-prefixed method calls
- Test with Foundry v13.350+
- Verify all hooks fire correctly
- Verify canvas operations work
- Verify document operations work
- Check for console errors

---

## Handling Missing or Unconfirmed APIs

### When API is Not Documented

```javascript
// If you need to use an API not confirmed in docs:
// 1. Check if it's in the indexed documentation
// 2. If not found, mark as unconfirmed

// Example: Some method you found in source code
// someObject.someMethod(); // Not confirmed in indexed docs

// Instead, use documented alternatives or request documentation
```

### Safe Pattern for Unconfirmed APIs

```javascript
// If you MUST use an unconfirmed API, wrap it with checks
function safeCall(obj, method, ...args) {
  if (obj && typeof obj[method] === 'function') {
    try {
      return obj[method](...args);
    } catch (err) {
      console.error(`Unconfirmed API ${method} failed:`, err);
      // Fallback to documented API
    }
  }
  // Fallback behavior
}
```

---

## PF1.5 Notes / House Rule Warnings

### ⚠️ PF1 System vs PF1.5 Framework

- **PF1 System**: Official Foundry system with documented APIs
- **PF1.5 Framework**: Your custom house rules (3 actions + 1 reaction, tiered conditions)

**Do NOT assume PF1 APIs support PF1.5**:

- PF1 natively implements classic PF1 action economy
- PF1.5 action tracking must be implemented in your module
- PF1 conditions are flat (binary); PF1.5 tiered conditions require custom implementation

### ⚠️ API Safety with PF1.5

```javascript
// Safe: Using documented PF1 APIs
const actor = game.actors.get('id');
const hp = actor.system.attributes.hp.value; // ⚠️ illustrative PF1 path — verify in PF1 source before using

// Unsafe: Assuming PF1.5 support
const actions = actor.system.actions.remaining; // Not confirmed in PF1 docs

// Safe: Implement PF1.5 in your module
const actions = actor.getFlag('my-pf1-5-module', 'actions') || 0;
```

---

## Questions This File Should Answer

- How do I know if an API method is safe to use?
- What do `@public`, `@protected`, `@private`, `@internal` mean?
- What about methods that start with `_`?
- What about methods that start with `#`?
- Can I override protected methods?
- What's the difference between public and protected?
- What changed in v13 that might break my v12 module?
- How do I migrate from v12 to v13?
- Are hooks awaited in v13?
- What should I do if I need to use an unconfirmed API?
- How do PF1.5 house rules affect API safety?

---

## Source Pages Consulted

- [Foundry VTT v13 API Documentation: Public vs Private API](https://foundryvtt.com/api/v13/index.html#public-vs-private-api)
- [Class: Hooks](https://foundryvtt.com/api/v13/classes/foundry.helpers.Hooks.html)
- [Class: ClientSettings](https://foundryvtt.com/api/v13/classes/foundry.helpers.ClientSettings.html)
- [Class: Document](https://foundryvtt.com/api/v13/classes/foundry.abstract.Document.html)
- [Class: ClientDocument](https://foundryvtt.com/api/v13/classes/foundry.ClientDocument.html)
- [Class: CanvasDocument](https://foundryvtt.com/api/v13/classes/foundry.CanvasDocument.html)
- [Class: DataModel](https://foundryvtt.com/api/v13/classes/foundry.abstract.DataModel.html)
- [API Migration Guides](https://foundryvtt.com/article/migration/)
- [Version 10 Manifest Migration Guide](https://foundryvtt.com/article/manifest-migration-guide/)
- [Release 13.350 Notes](https://foundryvtt.com/releases/13.350)
- [Release 13.348 Notes](https://foundryvtt.com/releases/13.348)
- [Release 13.341 Notes](https://foundryvtt.com/releases/13.341)

---

*Last updated: May 3, 2026 | Foundry VTT v13.350+*

---

## FILE: 00_READ_FIRST_PF1_Module_Dev_Index.md

# PF1 Module Development Index

## Purpose

Master index for the Pathfinder 1e system reference pack. Covers what the PF1 system adds on top of Foundry core, which reference file handles which PF1 topic, and the key classes, namespaces, hooks, and patterns specific to PF1 module development.

## When to Use This

- Starting a PF1-specific module feature
- Finding which PF1 reference file covers your task
- Understanding PF1's extension points over Foundry core
- Locating confirmed PF1 hooks, classes, and registries quickly

---

## What PF1 Adds Over Foundry Core

Foundry VTT provides the engine. The PF1 system extends it with Pathfinder-specific documents, data models, registries, hooks, and UI. Everything in this reference pack describes what PF1 adds or changes — not Foundry core behavior.

| Foundry Core | PF1 Extension |
|---|---|
| `Actor` | `pf1.documents.ActorPF` |
| `Item` | `pf1.documents.ItemPF` |
| `Combat` | `pf1.documents.CombatPF` |
| `Combatant` | `pf1.documents.CombatantPF` |
| `ActiveEffect` | `pf1.documents.ActiveEffectPF` |
| `TokenDocument` | `pf1.documents.TokenDocumentPF` |
| `DataModel` subtypes | `CharacterModel`, `NPCModel`, `WeaponModel`, `SpellModel`, etc. |
| `CONFIG.*` | `pf1.config.*` (read-only) + `CONFIG.PF1` alias |
| Core hooks | `pf1Post*` lifecycle, `pf1PrepareActorData`, roll hooks, action hooks |
| None | `pf1.registry.*` — conditions, damage types, materials, sources |

---

## File Map

| Task | File |
|---|---|
| PF1 namespaces, config, registries | `PF1_Namespaces_Config_Registry.md` |
| PF1 actor document classes, data paths | `PF1_Actor_Documents_Data_Paths.md` |
| PF1 item types, models, action use | `PF1_Item_Documents_Data_Paths.md` |
| PF1 conditions, buffs, ActiveEffectPF | `PF1_Buffs_Conditions_ActiveEffects.md` |
| PF1 combat, CombatPF, turn hooks | `PF1_Combat_Turns_Action_Economy.md` |
| PF1 rolls, D20RollPF, chat cards | `PF1_Rolls_ActionUse_ChatCards.md` |
| PF1 tokens, sheets, UI hooks | `PF1_Tokens_Canvas_Sheets_UI.md` |
| PF1 lifecycle hooks, data prep pipeline | `PF1_Hooks_Lifecycle_Extension_Points.md` |
| Pre-publish review checklist | `PF1_Module_Review_Checklist.md` |
| Claude Code project setup for PF1 | `Claude_Code_PF1_Module_CLAUDE_Addendum.md` |

For Foundry core topics (ApplicationV2, canvas, document CRUD, settings, manifest), use the Foundry v13 reference pack.

---

## Key PF1 Namespaces

```
pf1
├── config/        Read-only game configuration (abilities, conditions, item types, etc.)
├── const/         PF1 constants
├── documents/     ActorPF, ItemPF, CombatPF, CombatantPF, ActiveEffectPF, TokenDocumentPF
├── models/
│   ├── actor/     CharacterModel, NPCModel, HauntModel, TrapModel, VehicleModel
│   └── item/      WeaponModel, SpellModel, FeatModel, BuffModel, AttackModel, ClassModel, etc.
├── registry/      conditions, damageTypes, materials, sources, scriptCalls
├── dice/          D20RollPF, DamageRoll, RollPF, d20Roll()
├── applications/  ActionDialog, ApplyDamage, SpellbookManager, LevelUpForm, etc.
├── utils/         PF1 utility functions
└── ux/            PF1 UX helpers
```

**`pf1.config` is read-only at runtime.** Use module settings or flags for custom configuration. `CONFIG.PF1` mirrors `pf1.config` for compatibility — prefer `pf1.config`.

---

## Key Confirmed Hooks

### PF1 Lifecycle (use instead of bare Foundry hooks for PF1-aware code)

| Hook | Safe to Access |
|---|---|
| `pf1PostInit` | `pf1.config`, `pf1.const` |
| `pf1PostSetup` | `pf1.registry.*` |
| `pf1PostReady` | All PF1 documents, world data |

### Data Preparation

- `pf1PrepareBaseActorData(actor, data)`
- `pf1PrepareDerivedActorData(actor, data)`
- `pf1PrepareBaseItemData(item, data)`
- `pf1PrepareDerivedItemData(item, data)`
- `pf1GetRollData(actor, rollData)` — inject custom roll bonuses here

### Actor Roll Hooks (all have Pre/Post pairs)

`pf1PreActorRollAbility`, `pf1PreActorRollSkill`, `pf1PreActorRollSave`, `pf1PreActorRollBab`, `pf1PreActorRollCl`, `pf1PreActorRollConcentration`

### Combat

- `pf1CombatTurnSkip(combat: CombatPF, skipped: Set<CombatantPF>, context: object)` — fires when combatants' turns are skipped (`skipped` is a **Set**, iterate it). **Not** every turn.
- Use core `combatTurn(combat, updateData, updateOptions)` for per-turn resets.

### Conditions and Buffs

- `pf1ToggleActorCondition(actor: ActorPF, condition: string, state: boolean)` — condition state map at `actor.system.conditions`
- `pf1ToggleActorBuff(actor: ActorPF, item: ItemBuffPF, state: boolean)` — second arg is the `ItemBuffPF`, not just an ID
- `pf1AddDefaultChanges(actor: ActorPF, changes: ItemChange[])`

### Action Use and Rolls

- `pf1PreActionUse(actionUse: ActionUse) => boolean` — cancellable (single arg, NOT `(actor, item, options)`)
- `pf1PostActionUse(actionUse: ActionUse, chatMessage: ChatMessage | null)`
- `pf1CreateActionUse(actionUse: ActionUse)`
- `pf1PreDisplayActionUse(actionUse: ActionUse) => boolean` — cancellable
- `pf1PreAttackRoll(attackData, rollConfig)` / `pf1AttackRoll(attackData, roll)`
- `pf1PreDamageRoll(damageData, rollConfig)` / `pf1DamageRoll(damageData, roll)`
- `pf1PreD20Roll(rollConfig)` / `pf1D20Roll(roll)`
- `pf1DisplayCard(item: ItemPF, data: { template, templateData, chatData }) => boolean` — cancellable; passes a structured data object, **not** jQuery / not HTMLElement

### Item Links

- `pf1CreateItemLink(item, link, kind)` / `pf1DeleteItemLink(item, link, kind)` — `kind` is one of `"children" | "charges" | "classAssociations" | "ammunition"`

### Registry

- `pf1RegisterRegistry(registryName, registry)`

---

## Confirmed Actor Method Status

| Method | Status |
|---|---|
| `actor.update()` | Confirmed (Foundry core) |
| `actor.createEmbeddedDocuments()` | Confirmed (Foundry core) |
| `actor.setFlag()` / `getFlag()` / `unsetFlag()` | Confirmed (Foundry core) |
| `actor.statuses.has(id)` | Confirmed (Foundry core) — use for condition state checks |
| `actor.getRollData()` | Confirmed (Foundry core; PF1 extends via `pf1GetRollData` hook) |
| `actor.toggleCondition(key, state)` | Confirmed PF1 method |
| `actor.setCondition(key, state)` | Confirmed PF1 method (state can be boolean or merge object) |
| `actor.setConditions({k1: s1, ...})` | Confirmed PF1 method (batch + handles tracks) |
| `actor.rollSkill(skillId, options)` | Confirmed PF1 method |
| `actor.expireActiveEffects(options, context)` | Confirmed PF1 method |
| `actor.hasCondition(id)` | Not directly indexed — use `actor.statuses.has(id)` instead |
| `actor.addCondition()` / `removeCondition()` | Don't exist as named methods — use `setCondition(key, true|false)` or `toggleCondition(key, state)` |

---

## PF1.5 Framework Position

PF1.5 is a house rule framework on top of Foundry v13 + PF1. Nothing in the PF1 API natively supports it.

| PF1.5 Feature | Implementation |
|---|---|
| 3 actions + 1 reaction | Module flags; reset via `combatTurn` hook |
| Tiered conditions | Module flags with integer severity |
| Toggle conditions | PF1 `pf1ToggleActorCondition` hook + flags |
| Action costs on items | Module flags per item |

All PF1.5 code in the reference files is marked **MODULE DESIGN PATTERN — NOT NATIVE PF1 API**.

---

## Source Pages Consulted

- [PF1 Main Namespace](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/pf1.html)
- [PF1 Hook Events](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/hookEvents.html)
- [Namespace: documents](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/pf1.documents.html)
- [Namespace: models](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/pf1.models.html)
- [Namespace: registry](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/pf1.registry.html)
- [Namespace: config](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/pf1.config.html)
- [Namespace: dice](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/pf1.dice.html)

---

*Last updated: May 2026 | Foundry VTT v13.350+ | Pathfinder 1e System*

---

## FILE: 01_Foundry_v13_ApplicationV2_UI.md

# Foundry VTT v13 ApplicationV2 UI Framework

## Purpose

Reference for building UI with Foundry VTT v13's ApplicationV2 framework and related UI components. Covers modern UI patterns, replacing legacy Application where possible.

## When to Use This

- Building custom dialogs, sheets, or UI panels
- Migrating from legacy Application to ApplicationV2
- Customizing form handling and rendering
- Implementing modal or non-modal UI

---

## Core Classes / APIs

### Application Hierarchy (v13)

```
ApplicationV2 (abstract base)
├── DialogV2
│   └── ConfirmationDialogV2
├── DocumentSheetV2
│   ├── ActorSheetV2
│   ├── ItemSheetV2
│   └── ... (other document sheets)
└── Custom Applications
```

### Key Classes

- `**foundry.applications.api.ApplicationV2**` - Base class for all modern applications
- `**foundry.applications.api.DialogV2**` - Modal dialog framework
- `**foundry.applications.api.DocumentSheetV2**` - Base for document editing sheets
- `**foundry.applications.sheets.ActorSheetV2**` - Actor sheet implementation
- `**foundry.applications.sheets.ItemSheetV2**` - Item sheet implementation
- `**foundry.applications.ux.Tabs**` - Tab management
- `**foundry.applications.ux.TextEditor**` - Rich text editing
- `**foundry.applications.ux.ContextMenu**` - Right-click menus
- `**foundry.applications.ux.DragDrop**` - Drag and drop utilities

---

## Safe Module Patterns

> ⚠️ **Import specifiers note**: The `foundry/applications/...` bare specifiers shown in examples below require either Foundry's import map or a build tool (Vite/Rollup). Without those, use globals directly — `foundry.applications.api.ApplicationV2`, `foundry.applications.api.DialogV2`, etc. are available on `globalThis` without any import.

### ✅ Basic ApplicationV2 Implementation

```javascript
// Use HandlebarsApplicationMixin when rendering Handlebars templates
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
// OR with import map / bundler only:
// import { ApplicationV2 } from 'foundry/applications/api/application-v2.mjs';
// import { HandlebarsApplicationMixin } from 'foundry/applications/api/handlebars-application.mjs';

export class MyCustomApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    id: 'my-custom-app',
    title: 'My Custom App',
    position: { width: 400, height: 'auto' },
    window: { resizable: true, minimizable: true }
  };

  // With HandlebarsApplicationMixin, templates live in PARTS (not DEFAULT_OPTIONS.template)
  static PARTS = {
    main: { template: 'modules/my-module/templates/my-app.hbs' }
  };

  static PARAMS = {
    ...super.PARAMS,
    myParam: { type: String, default: 'value' }
  };

  _prepareContext(context, options) {
    context.myData = 'Hello World';
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    // Post-render logic
  }

  _onClose(options) {
    super._onClose(options);
    // Cleanup
  }
}
```

### ✅ Using DialogV2

```javascript
// Global: const { DialogV2 } = foundry.applications.api;
// import { DialogV2 } from 'foundry/applications/api/dialog-v2.mjs'; // requires import map/bundler
const { DialogV2 } = foundry.applications.api;

const dialog = new DialogV2({
  title: 'Confirmation',
  content: '<p>Are you sure?</p>',
  buttons: [
    { label: 'Yes', callback: () => console.log('Confirmed') },
    { label: 'No', callback: () => console.log('Cancelled') }
  ]
});

dialog.render(true); // true = modal
```

### ✅ DocumentSheetV2 for Custom Documents

```javascript
// DocumentSheetV2 does NOT include HandlebarsApplicationMixin by default —
// wrap it explicitly when rendering Handlebars templates.
const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;
// OR with import map/bundler only:
// import { DocumentSheetV2 } from 'foundry/applications/api/document-sheet-v2.mjs';
// import { HandlebarsApplicationMixin } from 'foundry/applications/api/handlebars-application.mjs';

export class MyCustomDocumentSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    id: 'my-custom-sheet',
    classes: ['sheet', 'my-custom-sheet'],
    position: { width: 600, height: 400 }
  };

  static PARTS = {
    main: { template: 'modules/my-module/templates/my-sheet.hbs' }
  };

  get document() {
    return this.options.document;
  }

  _prepareContext(context, options) {
    context.document = this.document.toObject();
    context.editable = this.document.isOwner;
    return context;
  }
}

// Register for your document type
Hooks.on('init', () => {
  CONFIG.MyCustomDocument.sheetClass = MyCustomDocumentSheet;
});
```

### ✅ Form Handling

```javascript
// Form-handling example uses Handlebars templates — wrap with the mixin.
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
// import { ApplicationV2 } from 'foundry/applications/api/application-v2.mjs'; // requires import map/bundler
// import { HandlebarsApplicationMixin } from 'foundry/applications/api/handlebars-application.mjs';

export class MyFormApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    id: 'my-form',
    form: {
      handler: MyFormApp.onSubmit,   // static method reference (NOT a string)
      closeOnSubmit: true,
      submitOnChange: false
    }
  };

  static PARTS = {
    form: { template: 'modules/my-module/templates/form.hbs' }
  };

  _prepareContext(context) {
    context.formData = this.formData || {};
    return context;
  }

  // Form handler is a STATIC method — receives (event, form, formData)
  // 'this' is the application instance when invoked via the form config.
  static async onSubmit(event, form, formData) {
    event.preventDefault();
    const data = foundry.utils.expandObject(formData.object);
    // Process data
    await this.processFormData(data);
  }

  async processFormData(data) {
    // Custom logic here
  }
}
```

> ⚠️ **`form.handler` is a function reference, not a string.** Common mistake from older patterns: `handler: 'onSubmit'` will fail silently. Pass `MyFormApp.onSubmit` or an inline arrow function. The handler receives `(event, form, formData)` where `formData` is a `FormDataExtended` instance with `.object` already parsed.

> ⚠️ **The handler is invoked with `this` bound to the application instance** — so `this.close()` and `this.render()` work inside it.

---

## Common v13 Pitfalls

1. **Legacy Application**: Still exists but deprecated. Use ApplicationV2 for new code.
2. **Template Paths**: Must be relative to module root or use `foundry` namespace.
3. **Context Preparation**: Use `_prepareContext()` not `_getTemplateData()` (legacy).
4. **Form Submission**: Use `_onSubmit()` with form config, not manual event handlers.
5. **Modal Behavior**: DialogV2 is modal by default. Set `modal: false` for non-modal.
6. **Z-Index**: Applications auto-manage z-index. Don't override unless necessary.
7. **Rendering**: Use `render(true)` for immediate rendering. `render(false)` queues it.
8. **Closing**: Use `close()` not `this.element.remove()`. Allows proper cleanup.
9. **Positioning**: Use `position` option object, not CSS. Supports snapping to edges.
10. **Tabs**: Use `foundry.applications.ux.Tabs` for tabbed interfaces.

---

## ApplicationV2 Lifecycle

The official 8-step render pipeline (per `foundry.applications.api.ApplicationV2` docs):

```
render(options)
  └─→ _configureRenderOptions(options)            // sync; mutate options in place
  └─→ _preFirstRender(context, options)           // async; FIRST render only
  └─→ _prepareContext(options)                    // async; build template context
  └─→ _renderHTML(context, options)               // async; produce HTML/element
  └─→ _replaceHTML(result, content, options)      // sync; mount into DOM
  └─→ _onFirstRender(context, options)            // async; FIRST render only — listeners
  └─→ _onRender(context, options)                 // async; EVERY render — re-bind dynamic state

close(options)
  └─→ _preClose(options)                          // async; pre-cleanup
  └─→ _onClose(options)                           // sync; final cleanup
```

**Key distinctions:**
- `_onFirstRender` runs ONCE per app instance (good for one-time event listeners on static elements).
- `_onRender` runs EVERY render (use for re-binding listeners on elements that get rebuilt; or re-applying state).
- `_prepareContext` MUST return the context object — it's not mutated in place.
- `_replaceHTML` is what actually swaps the HTML into `this.element`. Override only for non-standard mount strategies.
- All `_on*` and `_pre*` hooks must call `super.*(...)` if you override them, or you'll break parent-class behavior.

See also `HandlebarsApplicationMixin` if using `static PARTS` for multi-template rendering — it adds `_preparePartContext`, `_attachPartListeners`, etc. between the steps above.

---

## UI Utilities

### Tabs

```javascript
// Globals (no import needed): foundry.applications.ux.Tabs, .TextEditor, .ContextMenu
// import { Tabs } from 'foundry/applications/ux/tabs.mjs'; // requires import map/bundler
const { Tabs } = foundry.applications.ux;

const tabs = new Tabs({
  navSelector: '.my-tabs-nav',
  contentSelector: '.my-tabs-content',
  callback: (active, previous, group) => {}
});
```

### TextEditor

```javascript
// const { TextEditor } = foundry.applications.ux;
// import { TextEditor } from 'foundry/applications/ux/text-editor.mjs'; // requires import map/bundler
const { TextEditor } = foundry.applications.ux;

const editor = new TextEditor({
  target: document.getElementById('editor-container'),
  initialContent: '<p>Start typing...</p>'
});
```

### ContextMenu

```javascript
// const { ContextMenu } = foundry.applications.ux;
// import { ContextMenu } from 'foundry/applications/ux/context-menu.mjs'; // requires import map/bundler
const { ContextMenu } = foundry.applications.ux;

ContextMenu.create([
  { label: 'Option 1', callback: () => {} },
  { label: 'Option 2', callback: () => {} }
], event);
```

---

## Questions This File Should Answer

- How do I create a custom application in v13?
- What's the difference between ApplicationV2 and legacy Application?
- How do I create a modal dialog?
- How do I create a document sheet?
- How do I handle form submission in ApplicationV2?
- What lifecycle methods can I override?
- How do I add tabs to my application?
- How do I use the rich text editor?
- How do I create context menus?
- What's the proper way to close an application?

---

## Source Pages Consulted

- [Class: ApplicationV2](https://foundryvtt.com/api/v13/classes/foundry.applications.api.ApplicationV2.html)
- [Class: DialogV2](https://foundryvtt.com/api/v13/classes/foundry.applications.api.DialogV2.html)
- [Class: DocumentSheetV2](https://foundryvtt.com/api/v13/classes/foundry.applications.api.DocumentSheetV2.html)
- [Class: ActorSheetV2](https://foundryvtt.com/api/v13/classes/foundry.applications.sheets.ActorSheetV2.html)
- [Class: ItemSheetV2](https://foundryvtt.com/api/v13/classes/foundry.applications.sheets.ItemSheetV2.html)
- [Class: Tabs](https://foundryvtt.com/api/v13/classes/foundry.applications.ux.Tabs.html)
- [Class: TextEditor](https://foundryvtt.com/api/v13/classes/foundry.applications.ux.TextEditor.html)
- [Class: ContextMenu](https://foundryvtt.com/api/v13/classes/foundry.applications.ux.ContextMenu.html)

---

*Last updated: May 2, 2026 | Foundry VTT v13.350+*

---

## FILE: 01_Foundry_v13_Canvas_Scenes_Tokens.md

# Foundry VTT v13 Canvas, Scenes & Tokens

## Purpose

Reference for Foundry VTT v13's canvas system, scene management, and token operations. Covers canvas layers, placeable objects, and scene-specific workflows for module development.

## When to Use This

- Interacting with the game canvas
- Manipulating tokens programmatically
- Working with scenes and scene controls
- Customizing canvas rendering
- Implementing canvas overlays or HUD elements

---

## Core Classes / APIs

### Canvas Architecture

```
foundry.canvas.Canvas
├── Layers (foundry.canvas.layers.*)
│   ├── PlaceablesLayer (tokens, tiles, drawings, etc.)
│   ├── GridLayer
│   ├── EffectsLayer
│   ├── LightingLayer
│   ├── SightLayer
│   ├── SoundsLayer
│   ├── TemplateLayer
│   ├── WallsLayer
│   └── ...
│
└── Placeables (foundry.canvas.placeables.*)
    ├── Token
    ├── Tile
    ├── Drawing
    ├── MeasuredTemplate
    ├── Wall
    ├── Region
    └── Note
```

### Key Classes

- `**foundry.canvas.Canvas**` - Main canvas controller
- `**foundry.canvas.layers.CanvasLayer**` - Base layer class
- `**foundry.canvas.layers.PlaceablesLayer**` - Manages placeable objects
- `**foundry.canvas.layers.TokenLayer**` - Token-specific layer
- `**foundry.canvas.layers.TilesLayer**` - Tile layer
- `**foundry.canvas.layers.WallsLayer**` - Wall layer
- `**foundry.canvas.layers.TemplateLayer**` - Measured template layer
- `**foundry.canvas.placeables.PlaceableObject**` - Base placeable class
- `**foundry.canvas.placeables.Token**` - Token on canvas
- `**foundry.canvas.placeables.Tile**` - Tile on canvas
- `**foundry.canvas.placeables.MeasuredTemplate**` - Template on canvas
- `**foundry.documents.Scene**` - Scene document
- `**foundry.documents.TokenDocument**` - Token data model

---

## Safe Module Patterns

### ✅ Canvas Availability Check

```javascript
// Always check canvas readiness
if (canvas?.ready) {
  // Safe to access canvas
  const token = canvas.tokens.get(tokenId);
}

// Or use hook that guarantees canvas
Hooks.on('canvasReady', () => {
  // Canvas is ready
});
```

### ✅ Scene Activation

```javascript
// Get current scene
const scene = game.scenes.active;

// Activate a scene
scene.activate();

// Hook for scene changes
Hooks.on('canvasPan', (view) => {});
Hooks.on('changeScene', (scene, previous) => {});
```

### ✅ Token Operations

```javascript
// Get token by ID (scene-scoped)
const token = canvas.tokens.get(tokenId);

// Get token by actor
const actorTokens = canvas.tokens.placeables.filter(t => t.actor?.id === actorId);

// Move token
token.setPosition(x, y);

// Animate movement
await token.animateMovement([{ x: 100, y: 100 }, { x: 200, y: 200 }]);

// Control token
token.control({ releaseOthers: true });

// Select token
token.toggleSelection();

// Get token's actor
const actor = token.actor;
```

### ✅ Token Creation & Deletion

```javascript
// Create token on scene
// Note: bare `TokenDocument` is the legacy global; canonical is `foundry.documents.TokenDocument`.
const tokenDoc = await foundry.documents.TokenDocument.create({
  name: 'Goblin',
  x: 100,
  y: 100,
  sceneId: scene.id,
  actorId: actor.id
});

// Delete token
tokenDoc.delete();

// Create token from actor
const token = await scene.createEmbeddedDocuments('Token', [{
  actorId: actor.id,
  x: 100,
  y: 100
}]);
```

### ✅ Token HUD Customization

> ⚠️ **`renderTokenHUD` passes jQuery** — TokenHUD extends the V1 Application class. Use `html[0]` to get the native element.

```javascript
// Hook into HUD rendering
Hooks.on('renderTokenHUD', (app, html, data) => {
  // html is jQuery (TokenHUD is V1)
  const btn = document.createElement('button');
  btn.textContent = 'Custom';
  btn.addEventListener('click', () => {
    const token = app.object;
    // Custom logic
  });
  // html[0] = native HTMLElement
  html[0].querySelector('.token-hud')?.appendChild(btn);
});
```

### ✅ Canvas Layers Access

```javascript
// Access layers
const tokenLayer = canvas.tokens;
const gridLayer = canvas.grid;
const effectsLayer = canvas.effects;

// Add custom layer
class MyCustomLayer extends CanvasLayer {
  static get layerOptions() {
    return {
      ...super.layerOptions,
      name: 'myCustomLayer',
      zIndex: 500
    };
  }
}

// Register layer (in canvas init hook)
Hooks.on('canvasInit', () => {
  canvas.addLayer('myCustomLayer', MyCustomLayer);
});
```

### ✅ Drawing on Canvas

```javascript
// Use PIXI graphics
const graphics = token.addChild(new PIXI.Graphics());
graphics.beginFill(0xFF0000);
graphics.drawCircle(0, 0, 10);
graphics.endFill();

// Or use foundry's drawing utilities
const shape = canvas.grid.addHighlightLayer('my-highlight');
shape.beginFill(0xFF0000, 0.5);
shape.drawCircle(token.center.x, token.center.y, token.w * 2);
shape.endFill();
```

### ✅ Measured Templates

```javascript
// Create template
const template = await MeasuredTemplateDocument.create({
  t: 'cone',
  distance: 15,
  direction: 45,
  x: token.center.x,
  y: token.center.y,
  sceneId: scene.id
});

// Delete template
template.delete();

// Hook for template creation
Hooks.on('createMeasuredTemplate', (template) => {
  // Custom logic
});
```

---

## Common v13 Pitfalls

1. **Canvas Context**: `canvas` is undefined outside scene contexts. Always check `canvas?.ready`.
2. **Token vs TokenDocument**: `canvas.tokens` contains `Token` placeables. `scene.tokens` contains `TokenDocument` data.
3. **Scene Activation**: Canvas hooks only fire for the active scene. Handle scene changes.
4. **Token Control**: `token.control()` doesn't automatically release other tokens. Use `{ releaseOthers: true }`.
5. **Position Coordinates**: Canvas uses pixel coordinates. Use `canvas.grid.size` for grid snapping.
6. **Layer Z-Index**: Custom layers need proper zIndex to appear above/below others.
7. **Token Visibility**: Check `token.visible` before interacting. Tokens may be hidden by fog.
8. **Scene Dimensions**: Use `scene.dimensions` for scene bounds, not canvas width/height.
9. **Token Elevation**: v13 supports elevation. Use `token.document.elevation` for 3D positioning.
10. **Template Types**: Use `CONST.MEASURED_TEMPLATE_TYPES` for valid template types.
11. **Lighting/Sight**: Modifying lighting layers can be performance-intensive. Batch changes.
12. **Canvas Refresh**: After modifying canvas objects, call `canvas.draw()` or use specific layer refresh methods.

---

## Canvas Hooks Reference

```javascript
// Canvas initialization
Hooks.on('canvasInit', (canvas) => {});
Hooks.on('canvasReady', (canvas) => {});

// Canvas rendering
Hooks.on('canvasDraw', (canvas) => {});
Hooks.on('drawToken', (token) => {});
Hooks.on('drawTile', (tile) => {});
Hooks.on('drawWall', (wall) => {});

// Canvas interaction
Hooks.on('clickToken', (token, event) => {});
Hooks.on('hoverToken', (token, hovered) => {});
Hooks.on('controlToken', (token, controlled) => {});
Hooks.on('selectToken', (token, selected) => {});

// Canvas movement
Hooks.on('canvasPan', (view) => {});
Hooks.on('canvasZoom', (view) => {});

// Scene changes
Hooks.on('changeScene', (scene, previous) => {});
```

---

## Canvas Layers Hierarchy (Default v13)


| Layer Name   | Z-Index | Purpose                     |
| ------------ | ------- | --------------------------- |
| `background` | 0       | Scene background            |
| `grid`       | 50      | Grid lines                  |
| `tokens`     | 100     | Token placeables            |
| `tiles`      | 150     | Tile placeables             |
| `drawings`   | 200     | Drawing placeables          |
| `template`   | 250     | Measured templates          |
| `walls`      | 300     | Wall placeables             |
| `lighting`   | 350     | Lighting effects            |
| `sight`      | 400     | Vision/line of sight        |
| `effects`    | 450     | Weather/atmospheric effects |
| `notes`      | 500     | Note placeables             |
| `regions`    | 550     | Region placeables           |
| `controls`   | 1000    | Scene controls              |
| `hud`        | 1100    | Token HUD                   |
| `ui`         | 2000    | UI overlays                 |


---

## Questions This File Should Answer

- How do I access the canvas safely?
- What's the difference between Token and TokenDocument?
- How do I move a token programmatically?
- How do I create a token on the canvas?
- How do I customize the Token HUD?
- How do I add a custom canvas layer?
- How do I draw on the canvas?
- How do I work with measured templates?
- What hooks are available for canvas interaction?
- How do I handle scene changes?
- What are the default canvas layers and their order?
- How do I check if a token is visible?

---

## Source Pages Consulted

- [Foundry VTT v13 API: The Game Canvas](https://foundryvtt.com/api/v13/index.html#the-game-canvas)
- [Class: Canvas](https://foundryvtt.com/api/v13/classes/foundry.canvas.Canvas.html)
- [Class: CanvasLayer](https://foundryvtt.com/api/v13/classes/foundry.canvas.layers.CanvasLayer.html)
- [Class: PlaceablesLayer](https://foundryvtt.com/api/v13/classes/foundry.canvas.layers.PlaceablesLayer.html)
- [Class: TokenLayer](https://foundryvtt.com/api/v13/classes/foundry.canvas.layers.TokenLayer.html)
- [Class: Token](https://foundryvtt.com/api/v13/classes/foundry.canvas.placeables.Token.html)
- [Class: TokenDocument](https://foundryvtt.com/api/v13/classes/foundry.documents.TokenDocument.html)
- [Class: Scene](https://foundryvtt.com/api/v13/classes/foundry.documents.Scene.html)
- [Class: PlaceableObject](https://foundryvtt.com/api/v13/classes/foundry.canvas.placeables.PlaceableObject.html)
- [Class: MeasuredTemplate](https://foundryvtt.com/api/v13/classes/foundry.canvas.placeables.MeasuredTemplate.html)
- [Class: TokenHUD](https://foundryvtt.com/api/v13/classes/foundry.applications.hud.TokenHUD.html)

---

*Last updated: May 2, 2026 | Foundry VTT v13.350+*

---

## FILE: 01_Foundry_v13_Documents_Data_Canvas.md

# Foundry VTT v13 Documents, Data & Canvas

## Purpose

Consolidated reference for Foundry VTT v13 document system, data models, and canvas operations. Covers core classes used by PF1 modules for document management, data access, and canvas interaction.

## When to Use This

- Working with Foundry documents (Actor, Item, Scene, etc.)
- Accessing or modifying document data
- Working with canvas, tokens, and placeables
- Querying document collections
- Managing embedded documents

---

## Core Classes / APIs

### Document Hierarchy

```
foundry.abstract.Document (base)
├── foundry.ClientDocument (client-side mixin)
│   ├── foundry.CanvasDocument (canvas-visible mixin)
│   │
foundry.documents.Actor
foundry.documents.Item
foundry.documents.Scene
foundry.documents.Combat
foundry.documents.Combatant
foundry.documents.ActiveEffect
foundry.documents.ChatMessage
foundry.documents.TokenDocument
foundry.documents.Folder
foundry.documents.JournalEntry
foundry.documents.Macro
foundry.documents.Playlist
foundry.documents.RollTable
foundry.documents.User
foundry.documents.Adventure
```

### Data Model Hierarchy

```
foundry.abstract.DataModel (base)
└── foundry.abstract.TypeDataModel (for custom types)

foundry.documents.collections.DocumentCollection
├── foundry.documents.collections.WorldCollection
└── foundry.documents.collections.CompendiumCollection
```

### Canvas Hierarchy

```
foundry.canvas.Canvas
├── foundry.canvas.layers.CanvasLayer (base)
│   ├── foundry.canvas.layers.PlaceablesLayer
│   │   ├── foundry.canvas.layers.TokenLayer
│   │   ├── foundry.canvas.layers.TilesLayer
│   │   └── ...
│   ├── foundry.canvas.layers.GridLayer
│   ├── foundry.canvas.layers.LightingLayer
│   ├── foundry.canvas.layers.SightLayer
│   └── ...
│
└── foundry.canvas.placeables.PlaceableObject (base)
    ├── foundry.canvas.placeables.Token
    ├── foundry.canvas.placeables.Tile
    ├── foundry.canvas.placeables.Drawing
    ├── foundry.canvas.placeables.MeasuredTemplate
    ├── foundry.canvas.placeables.Wall
    ├── foundry.canvas.placeables.Region
    └── foundry.canvas.placeables.Note
```

---

## Confirmed Namespaces / Classes / Hooks / Fields

### Document Classes


| Class                             | Purpose                  | Collection          |
| --------------------------------- | ------------------------ | ------------------- |
| `foundry.abstract.Document`       | Base document class      | -                   |
| `foundry.ClientDocument`          | Client-side extensions   | -                   |
| `foundry.CanvasDocument`          | Canvas-visible documents | -                   |
| `foundry.documents.Actor`         | Actor documents          | `game.actors`       |
| `foundry.documents.Item`          | Item documents           | `game.items`        |
| `foundry.documents.Scene`         | Scene documents          | `game.scenes`       |
| `foundry.documents.Combat`        | Combat documents         | `game.combats`      |
| `foundry.documents.Combatant`     | Combatant documents      | `combat.combatants` |
| `foundry.documents.ActiveEffect`  | Active effect documents  | `actor.effects`     |
| `foundry.documents.ChatMessage`   | Chat message documents   | `game.messages`     |
| `foundry.documents.TokenDocument` | Token documents          | `scene.tokens`      |
| `foundry.documents.Folder`        | Folder documents         | `game.folders`      |
| `foundry.documents.JournalEntry`  | Journal entry documents  | `game.journal`      |
| `foundry.documents.Macro`         | Macro documents          | `game.macros`       |


### Data Model Classes


| Class                            | Purpose                      |
| -------------------------------- | ---------------------------- |
| `foundry.abstract.DataModel`     | Base data model with schema  |
| `foundry.abstract.TypeDataModel` | For custom document subtypes |


### Collection Classes


| Class                                                | Purpose                          |
| ---------------------------------------------------- | -------------------------------- |
| `foundry.documents.abstract.DocumentCollection`      | Base document collection         |
| `foundry.documents.abstract.WorldCollection`         | World-level document collections |
| `foundry.documents.collections.CompendiumCollection` | Compendium-specific collections  |


### Canvas Classes


| Class                                       | Purpose                   |
| ------------------------------------------- | ------------------------- |
| `foundry.canvas.Canvas`                     | Main canvas controller    |
| `foundry.canvas.layers.CanvasLayer`         | Base canvas layer         |
| `foundry.canvas.layers.PlaceablesLayer`     | Manages placeable objects |
| `foundry.canvas.layers.TokenLayer`          | Token-specific layer      |
| `foundry.canvas.layers.TilesLayer`          | Tile layer                |
| `foundry.canvas.placeables.PlaceableObject` | Base placeable object     |
| `foundry.canvas.placeables.Token`           | Token placeable on canvas |
| `foundry.applications.hud.TokenHUD`         | Token HUD application     |


---

## Safe Module Patterns

### ✅ Document CRUD Operations

```javascript
// Create document
// Note: bare `Actor`, `Item`, `TokenDocument` etc. are legacy globals; canonical references live under `foundry.documents.*`.
const actor = await foundry.documents.Actor.create({
  name: 'Gandalf',
  type: 'character'
});

// Update document (system.* paths shown are illustrative PF1 examples — verify in PF1 source before using)
actor.update({
  'name': 'Gandalf the Grey',
  'system.attributes.hp.value': 50    // ⚠️ illustrative PF1 path
});

// Delete document
actor.delete();

// Bulk operations (canonical: foundry.documents.Actor; bare Actor is a legacy alias)
foundry.documents.Actor.updateDocuments([
  { _id: 'actor1', 'name': 'New Name 1' },
  { _id: 'actor2', 'name': 'New Name 2' }
]);
foundry.documents.Actor.deleteDocuments(['actor1', 'actor2']);
```

### ✅ Embedded Documents

```javascript
// Create embedded document (e.g., ActiveEffect on Actor)
// ⚠️ The `system.*` key path below is an illustrative PF1 example — verify in PF1 source before using.
const effect = await actor.createEmbeddedDocuments('ActiveEffect', [{
  name: 'Bless',
  changes: [{ key: 'system.attributes.ac.bonus', mode: 2, value: 1 }],
  duration: { rounds: 5 }
}]);

// Update embedded documents
actor.updateEmbeddedDocuments('ActiveEffect', [{
  _id: 'effect-id',
  'changes.0.value': 2
}]);

// Delete embedded documents
actor.deleteEmbeddedDocuments('ActiveEffect', ['effect-id']);

// Get embedded collection
const effects = actor.effects; // WorldCollection of ActiveEffect
```

### ✅ Querying Collections

```javascript
// Get by ID
const actor = game.actors.get('actor-id');
const item = game.items.get('item-id');

// Filter
const characters = game.actors.filter(a => a.type === 'character');
const spells = game.items.filter(i => i.type === 'spell');

// Find
const gandalf = game.actors.find(a => a.name === 'Gandalf');

// Compendium access
const pack = game.packs.get('my-compendium');
const items = await pack.getDocuments();
const item = await pack.getDocument('item-id');
```

### ✅ Flags (Module Data)

```javascript
// Set flag
actor.setFlag('my-module', 'customData', { value: 42 });

// Get flag
const data = actor.getFlag('my-module', 'customData');

// Unset flag
actor.unsetFlag('my-module', 'customData');

// Check flag existence
const hasFlag = actor.hasFlag('my-module', 'customData');
```

### ✅ Canvas Access

```javascript
// Always check canvas readiness
if (canvas?.ready) {
  const token = canvas.tokens.get('token-id');
  
  // Token placeable methods
  token.setPosition(100, 100);
  token.control({ releaseOthers: true });
  token.toggleSelection();
}

// Use canvasReady hook
Hooks.on('canvasReady', () => {
  // Canvas is ready
});
```

### ✅ Token vs TokenDocument

**Critical distinction**:

- **Token placeable** (`canvas.tokens.get()`): Visual representation on canvas, has position, rendering
- **TokenDocument** (`scene.tokens.get()`): Data model, has actor reference, document properties

```javascript
// Get Token placeable (canvas object)
const tokenPlaceable = canvas.tokens.get('token-id');
// Methods: setPosition(), control(), toggleSelection(), etc.

// Get TokenDocument (data model)
const tokenDoc = scene.tokens.get('token-id');
// Properties: actor, x, y, width, height, etc.

// Relationship
const actor = tokenPlaceable.document.actor; // Actor from token placeable
const tokenPlaceable2 = tokenDoc.object; // Token placeable from document
```

### ✅ Token HUD Integration

> ⚠️ **`renderTokenHUD` passes jQuery** — TokenHUD extends the V1 Application class. Use `html[0]` to access the native element.

```javascript
// Hook into TokenHUD rendering
Hooks.on('renderTokenHUD', (hud, html) => {
  // hud: TokenHUD application
  // html: jQuery (TokenHUD is V1)
  
  const token = hud.object; // Token placeable
  const actor = token.actor; // Linked actor
  
  // Add custom button
  const btn = document.createElement('button');
  btn.textContent = 'Custom';
  btn.addEventListener('click', () => {
    if (actor) {
      myCustomFunction(actor);
    }
  });
  html[0].appendChild(btn); // html[0] = native HTMLElement
});
```

---

## Common Pitfalls

1. **Canvas Context**: `canvas` is **undefined** outside scene contexts. Always check `canvas?.ready` before accessing.
2. **Token vs TokenDocument Confusion**: These are **different objects** with different methods/properties. Don't confuse them.
3. **Scene-Scoped Tokens**: `scene.tokens` contains TokenDocuments for that scene. `canvas.tokens` contains Token placeables currently visible.
4. **Embedded Document Ownership**: Embedded documents belong to their parent. Deleting parent deletes children.
5. **Collection Timing**: Some collections (like `game.actors`) are only available after `ready` hook.
6. **Async Operations**: Document operations (`create`, `update`, `delete`) are **async**. Use `await` or return promises.
7. **Permission Checks**: Always check `document.isOwner` before modifying documents in multiplayer.
8. **Compendium Loading**: Compendium documents are **lazy-loaded**. Use `await pack.getDocument()` or `await pack.getDocuments()`.
9. **Canvas Refresh**: After modifying canvas objects, you may need to call `canvas.draw()` or specific layer refresh.
10. **Token HUD Element Type**: `renderTokenHUD` passes **jQuery** — TokenHUD is a V1 application. Use `html[0]` to get the native element, or jQuery methods directly.

---

## PF1.5 Notes / House Rule Warnings

### ⚠️ Token Data for PF1.5

PF1 tokens use `TokenDocumentPF` (PF1-specific). PF1.5 action tracking should use flags:

```javascript
// Get token's actor and check PF1.5 actions
const token = canvas.tokens.get('token-id');
if (token?.actor) {
  const actions = token.actor.getFlag('my-pf1-5-module', 'actions') || 0;
  const reactions = token.actor.getFlag('my-pf1-5-module', 'reactions') || 0;
  
  // Display in TokenHUD
  Hooks.on('renderTokenHUD', (hud, html) => {
    if (hud.object === token) {
      const actionSpan = document.createElement('span');
      actionSpan.textContent = `${actions}A/${reactions}R`;
      html[0].appendChild(actionSpan); // html is jQuery; html[0] = native element
    }
  });
}
```

### ⚠️ Canvas Layers for PF1.5

Add custom canvas layers for PF1.5 UI elements:

```javascript
// Add custom layer for PF1.5 action tracking
class PF15ActionLayer extends CanvasLayer {
  static get layerOptions() {
    return {
      ...super.layerOptions,
      name: 'pf15Actions',
      zIndex: 600 // Above tokens, below HUD
    };
  }
}

Hooks.on('canvasInit', () => {
  canvas.addLayer('pf15Actions', PF15ActionLayer);
});
```

---

## Questions This File Should Answer

- What are the core document classes?
- What are the core data model classes?
- What are the core collection classes?
- What are the core canvas classes?
- How do I create documents?
- How do I update documents?
- How do I delete documents?
- How do I work with embedded documents?
- How do I query document collections?
- How do I use flags for module data?
- How do I access the canvas safely?
- What's the difference between Token and TokenDocument?
- How do I extend TokenHUD?
- How do I add custom canvas layers?

---

## Source Pages Consulted

- [Class: Document](https://foundryvtt.com/api/v13/classes/foundry.abstract.Document.html)
- [Class: ClientDocument](https://foundryvtt.com/api/v13/classes/foundry.ClientDocument.html)
- [Class: CanvasDocument](https://foundryvtt.com/api/v13/classes/foundry.CanvasDocument.html)
- [Class: DataModel](https://foundryvtt.com/api/v13/classes/foundry.abstract.DataModel.html)
- [Class: TypeDataModel](https://foundryvtt.com/api/v13/classes/foundry.abstract.TypeDataModel.html)
- [Class: DocumentCollection](https://foundryvtt.com/api/v13/classes/foundry.documents.abstract.DocumentCollection.html)
- [Class: WorldCollection](https://foundryvtt.com/api/v13/classes/foundry.documents.abstract.WorldCollection.html)
- [Class: CompendiumCollection](https://foundryvtt.com/api/v13/classes/foundry.documents.collections.CompendiumCollection.html)
- [Class: Actor](https://foundryvtt.com/api/v13/classes/foundry.documents.Actor.html)
- [Class: Item](https://foundryvtt.com/api/v13/classes/foundry.documents.Item.html)
- [Class: Scene](https://foundryvtt.com/api/v13/classes/foundry.documents.Scene.html)
- [Class: Combat](https://foundryvtt.com/api/v13/classes/foundry.documents.Combat.html)
- [Class: Combatant](https://foundryvtt.com/api/v13/classes/foundry.documents.Combatant.html)
- [Class: ActiveEffect](https://foundryvtt.com/api/v13/classes/foundry.documents.ActiveEffect.html)
- [Class: ChatMessage](https://foundryvtt.com/api/v13/classes/foundry.documents.ChatMessage.html)
- [Class: TokenDocument](https://foundryvtt.com/api/v13/classes/foundry.documents.TokenDocument.html)
- [Class: Canvas](https://foundryvtt.com/api/v13/classes/foundry.canvas.Canvas.html)
- [Class: CanvasLayer](https://foundryvtt.com/api/v13/classes/foundry.canvas.layers.CanvasLayer.html)
- [Class: PlaceablesLayer](https://foundryvtt.com/api/v13/classes/foundry.canvas.layers.PlaceablesLayer.html)
- [Class: TokenLayer](https://foundryvtt.com/api/v13/classes/foundry.canvas.layers.TokenLayer.html)
- [Class: Token](https://foundryvtt.com/api/v13/classes/foundry.canvas.placeables.Token.html)
- [Class: PlaceableObject](https://foundryvtt.com/api/v13/classes/foundry.canvas.placeables.PlaceableObject.html)
- [Class: TokenHUD](https://foundryvtt.com/api/v13/classes/foundry.applications.hud.TokenHUD.html)
- [Foundry VTT v13 API Documentation](https://foundryvtt.com/api/v13/index.html)

---

*Last updated: May 3, 2026 | Foundry VTT v13.350+*

---

## FILE: 01_Foundry_v13_Documents_Data_Model.md

# Foundry VTT v13 Documents & Data Model

## Purpose

Reference for Foundry VTT v13's document system, data models, and collections. Covers primary/embedded documents, data validation, and safe data manipulation patterns.

## When to Use This

- Creating or modifying document types
- Working with Actor, Item, Scene, or other document data
- Implementing data validation
- Querying document collections
- Understanding document lifecycle

---

## Core Classes / APIs

### Document Hierarchy

```
foundry.abstract.DataModel (base data model)
├── TypeDataModel (for document subtypes)
│
foundry.abstract.Document (base document)
├── ClientDocument (client-side mixin)
│   ├── CanvasDocument (canvas-visible mixin)
│   │
├── Primary Documents (world-level)
│   ├── Actor, Item, Scene, Combat, JournalEntry, etc.
│
└── Embedded Documents (owned by primary)
    ├── ActiveEffect, Token, Combatant, etc.
```

### Key Classes

- `**foundry.abstract.Document**` - Base document class with CRUD operations
- `**foundry.ClientDocument**` - Client-side extensions (rendering, UI)
- `**foundry.CanvasDocument**` - Canvas-visible documents (Token, Tile, etc.)
- `**foundry.abstract.DataModel**` - Schema and validation base
- `**foundry.abstract.TypeDataModel**` - For custom document subtypes
- `**foundry.documents.abstract.WorldCollection**` - World-level document collections
- `**foundry.documents.abstract.DocumentCollection**` - Generic document collections
- `**foundry.documents.collections.CompendiumCollection**` - Compendium-specific collections

### Primary Document Types (v13.350+)


| Document     | Class                            | Collection        | Embedded Docs              |
| ------------ | -------------------------------- | ----------------- | -------------------------- |
| Actor        | `foundry.documents.Actor`        | `game.actors`     | ActiveEffect, Token        |
| Item         | `foundry.documents.Item`         | `game.items`      | ActiveEffect               |
| Scene        | `foundry.documents.Scene`        | `game.scenes`     | Token, Tile, Drawing, etc. |
| Combat       | `foundry.documents.Combat`       | `game.combats`    | Combatant                  |
| JournalEntry | `foundry.documents.JournalEntry` | `game.journal`    | JournalEntryPage           |
| Macro        | `foundry.documents.Macro`        | `game.macros`     | -                          |
| User         | `foundry.documents.User`         | `game.users`      | -                          |
| Folder       | `foundry.documents.Folder`       | `game.folders`    | -                          |
| RollTable    | `foundry.documents.RollTable`    | `game.tables`     | TableResult                |
| Playlist     | `foundry.documents.Playlist`     | `game.playlists`  | PlaylistSound              |
| Cards        | `foundry.documents.Cards`        | `game.cards`      | Card                       |
| Adventure    | `foundry.documents.Adventure`    | (compendium only) | -                          |


### Embedded Document Types


| Document         | Parent       | Class                                        |
| ---------------- | ------------ | -------------------------------------------- |
| ActiveEffect     | Actor/Item   | `foundry.documents.ActiveEffect`             |
| Token            | Scene/Actor  | `foundry.documents.TokenDocument`            |
| Combatant        | Combat       | `foundry.documents.Combatant`                |
| Tile             | Scene        | `foundry.documents.TileDocument`             |
| Drawing          | Scene        | `foundry.documents.DrawingDocument`          |
| Wall             | Scene        | `foundry.documents.WallDocument`             |
| AmbientLight     | Scene        | `foundry.documents.AmbientLightDocument`     |
| AmbientSound     | Scene        | `foundry.documents.AmbientSoundDocument`     |
| Region           | Scene        | `foundry.documents.RegionDocument`           |
| MeasuredTemplate | Scene        | `foundry.documents.MeasuredTemplateDocument` |
| Note             | Scene        | `foundry.documents.NoteDocument`             |
| JournalEntryPage | JournalEntry | `foundry.documents.JournalEntryPage`         |
| TableResult      | RollTable    | `foundry.documents.TableResult`              |
| PlaylistSound    | Playlist     | `foundry.documents.PlaylistSound`            |
| Card             | Cards        | `foundry.documents.Card`                     |
| RegionBehavior   | Region       | `foundry.documents.RegionBehavior`           |


---

## Safe Module Patterns

### ✅ Creating Documents

```javascript
// Note on document class globals: bare `Actor`, `Item`, `TokenDocument` etc. are legacy aliases.
// Canonical references live under `foundry.documents.*` (e.g., `foundry.documents.Actor`).
// PF1 extends these per `CONFIG.Actor.documentClass` → `pf1.documents.ActorPF`.
// Examples below use the bare globals for brevity; substitute `foundry.documents.*` for explicit references.

// Safe document creation
const actor = await foundry.documents.Actor.create({
  name: 'Gandalf',
  type: 'npc',
  img: 'icons/svg/mage.svg'
}, { temporary: false });

// With parent document (embedded)
// ⚠️ The `system.*` key path below is an illustrative PF1 example — verify in PF1 source before using.
const effect = await actor.createEmbeddedDocuments('ActiveEffect', [{
  name: 'Bless',
  changes: [{ key: 'system.attributes.ac.value', mode: 2, value: 1 }]
}]);
```

### ✅ Updating Documents

```javascript
// Single document update (system.* paths illustrative PF1 — verify in PF1 source)
actor.update({ 'system.attributes.hp.value': 25 }); // ⚠️ illustrative PF1 path

// Multiple documents (canonical: foundry.documents.Actor; bare Actor is a legacy alias)
foundry.documents.Actor.updateDocuments([
  { _id: 'actor1', 'system.attributes.hp.value': 20 }, // ⚠️ illustrative PF1 path
  { _id: 'actor2', 'system.attributes.hp.value': 15 }  // ⚠️ illustrative PF1 path
]);

// Embedded document update
await actor.updateEmbeddedDocuments('ActiveEffect', [
  { _id: 'effect1', disabled: true }
]);
```

### ✅ Deleting Documents

```javascript
// Single document
actor.delete();

// Multiple documents (canonical: foundry.documents.Actor; bare Actor is a legacy alias)
foundry.documents.Actor.deleteDocuments(['actor1', 'actor2']);

// Embedded documents
await actor.deleteEmbeddedDocuments('ActiveEffect', ['effect1']);
```

### ✅ Querying Collections

```javascript
// Get by ID
const actor = game.actors.get('actor-id');

// Filter
const npcs = game.actors.filter(a => a.type === 'npc');
const visibleTokens = canvas.tokens.placeables.filter(t => t.visible);

// Find
const gandalf = game.actors.find(a => a.name === 'Gandalf');

// Compendium access
const pack = game.packs.get('my-compendium');
const items = await pack.getDocuments();
```

### ✅ Custom Document Subtypes (PF1 Example)

```javascript
// In your module's init hook
Hooks.once('init', () => {
  CONFIG.Actor.documentClass = class PF1Actor extends CONFIG.Actor.documentClass {
    // Custom PF1 logic
    get initiativeBonus() {
      // ⚠️ UNCONFIRMED PF1 path — system.stats.dex.mod is illustrative only.
      // Verify the actual path in PF1 source before using.
      return this.system.stats.dex.mod || 0;
    }
  };
});
```

### ✅ Data Validation with TypeDataModel

> ⚠️ **Import specifier unconfirmed for module runtime.** The `foundry/abstract/type-data-model.mjs` bare specifier requires either Foundry's import map or a bundler. Without those, use the global directly: `const { TypeDataModel } = foundry.abstract;`

```javascript
// Option A: global (works in all module runtimes)
const { TypeDataModel } = foundry.abstract;

// Option B: import specifier (requires Foundry import map or bundler)
// import { TypeDataModel } from 'foundry/abstract/type-data-model.mjs';

class PF1ActorData extends TypeDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      attributes: new foundry.data.fields.SchemaField({
        hp: new foundry.data.fields.NumberField({ required: true }),
        ac: new foundry.data.fields.NumberField()
      })
    };
  }
}

// Register in CONFIG
CONFIG.Actor.dataModels.pf1 = PF1ActorData;
```

---

## Common v13 Pitfalls

1. **Client vs Server Documents**: `ClientDocument` methods don't exist server-side. Use `document.isOwner` to check permissions.
2. **Embedded Document Paths**: Use `actor.effects` not `game.effects` for actor's effects.
3. **Collection Availability**: Some collections (like `game.actors`) are only available after `ready` hook.
4. **Data Model Changes**: Schema validation is stricter in v13. Ensure your data conforms.
5. **Temporary Documents**: Use `{ temporary: true }` for UI-only documents that shouldn't persist.
6. **Compendium Access**: Compendium documents are lazy-loaded. Use `await pack.getDocument(id)`.
7. **Document Links**: Use `Document.uuid` for stable references across worlds/compendiums.
8. **Update Conflicts**: Last update wins. Use `Document.update()` with version checking for safety.
9. **Embedded Document Ownership**: Embedded docs belong to their parent. Deleting parent deletes children.
10. **TypeDataModel Registration**: Must be registered in CONFIG before use.

---

## Document Lifecycle Hooks

```javascript
// Document creation
Hooks.on('createActor', (actor, options, userId) => {});
Hooks.on('createActiveEffect', (effect, options, userId) => {});

// Document update
Hooks.on('updateActor', (actor, changes, options, userId) => {});

// Document deletion
Hooks.on('deleteActor', (actor, options, userId) => {});

// Embedded document hooks
Hooks.on('createActiveEffect', (effect, options, userId) => {
  if (effect.parent?.documentName === 'Actor') {
    // Actor's effect
  }
});
```

---

## Data Model Schema Fields (v13)


| Field Type      | Class           | Use Case                |
| --------------- | --------------- | ----------------------- |
| `StringField`   | Text data       | Names, descriptions     |
| `NumberField`   | Numeric         | HP, AC, damage          |
| `BooleanField`  | True/False      | Toggle states           |
| `SchemaField`   | Nested object   | Complex data structures |
| `ArrayField`    | Array of values | Lists, multiple items   |
| `ObjectField`   | Generic object  | Flexible data           |
| `FilePathField` | File reference  | Image paths             |


---

## Questions This File Should Answer

- What are the main document types in Foundry v13?
- What's the difference between primary and embedded documents?
- How do I create a new document?
- How do I update document data?
- How do I delete documents?
- How do I query document collections?
- What's the difference between ClientDocument and Document?
- How do I create custom document subtypes?
- How do I work with compendium documents?
- How do I validate document data?
- What hooks are available for document lifecycle?
- How do I reference documents across worlds/compendiums?

---

## Source Pages Consulted

- [Foundry VTT v13 API: Documents and Data](https://foundryvtt.com/api/v13/index.html#documents-and-data)
- [Class: Document](https://foundryvtt.com/api/v13/classes/foundry.abstract.Document.html)
- [Class: ClientDocument](https://foundryvtt.com/api/v13/classes/foundry.ClientDocument.html)
- [Class: CanvasDocument](https://foundryvtt.com/api/v13/classes/foundry.CanvasDocument.html)
- [Class: DataModel](https://foundryvtt.com/api/v13/classes/foundry.abstract.DataModel.html)
- [Class: TypeDataModel](https://foundryvtt.com/api/v13/classes/foundry.abstract.TypeDataModel.html)
- [Class: WorldCollection](https://foundryvtt.com/api/v13/classes/foundry.documents.abstract.WorldCollection.html)
- [Class: CompendiumCollection](https://foundryvtt.com/api/v13/classes/foundry.documents.collections.CompendiumCollection.html)
- [Primary Document Types](https://foundryvtt.com/api/v13/index.html#primary-document-types)
- [Embedded Document Types](https://foundryvtt.com/api/v13/index.html#embedded-document-types)

---

*Last updated: May 2, 2026 | Foundry VTT v13.350+*

---

## FILE: 01_Foundry_v13_Hooks_Lifecycle_Rendering.md

# Foundry VTT v13 Hooks, Lifecycle & Rendering

## Purpose

Concise reference for Foundry VTT v13 hook system, lifecycle order, and rendering patterns. Focuses on module-relevant hooks and safe usage patterns.

## When to Use This

- Finding the right hook for your module
- Understanding hook timing and order
- Implementing event-driven module behavior
- Working with render hooks and element types

---

## Core Classes / APIs

- `**foundry.helpers.Hooks**` - Core event framework
  - Methods: `on(hook, fn)`, `once(hook, fn)`, `off(hook, fn)`, `call(hook, ...args)`, `callAll(hook, ...args)`
  - Returns: Hook registration returns a numeric ID for removal

---

## Confirmed Namespaces / Classes / Hooks / Fields

### Hook Registration Methods

| Method          | Signature                                                 | Returns | Description                            |
| --------------- | --------------------------------------------------------- | ------- | -------------------------------------- |
| `Hooks.on`      | `(hook: string, fn: Function, options?: {once: boolean})` | number  | Register persistent hook, returns ID   |
| `Hooks.once`    | `(hook: string, fn: Function)`                            | number  | Register one-time hook, returns ID     |
| `Hooks.off`     | `(hook: string, fn: number | Function)`                   | void    | Remove hook by ID or function          |
| `Hooks.call`    | `(hook: string, ...args: any[])`                          | boolean | Call hooks, stops if any returns false |
| `Hooks.callAll` | `(hook: string, ...args: any[])`                          | void    | Call all hooks, cannot be stopped      |

### Lifecycle Hooks (Core Foundry — Verified Order)

| Hook        | Arguments | Timing | Description                                  |
| ----------- | --------- | ------ | -------------------------------------------- |
| `init`      | `()`      | 1st    | Module/system registration; no world data    |
| `i18nInit`  | `()`      | 2nd    | Localization initialized                     |
| `setup`     | `()`      | 3rd    | Post-system init; world not yet loaded       |
| `ready`     | `()`      | Last   | World + documents fully loaded; canvas ready |
| `hotReload` | `()`      | Dev    | Fires during hot reload in development       |

**Order**: `init` → `i18nInit` → `setup` → `ready`

> **PF1 preference**: Use `pf1PostInit` / `pf1PostSetup` / `pf1PostReady` for PF1-aware init — they fire after PF1 has bootstrapped its own config.

### Document Hooks

| Hook             | Arguments                              | Description                        |
| ---------------- | -------------------------------------- | ---------------------------------- |
| `createDocument` | `(document, options, userId)`          | Fires when any document is created |
| `updateDocument` | `(document, changes, options, userId)` | Fires when any document is updated |
| `deleteDocument` | `(document, options, userId)`          | Fires when any document is deleted |

**Type-Specific Variants**: `createActor`, `updateActor`, `deleteActor`, `createItem`, `updateItem`, `deleteItem`, etc.

### Render Hooks

| Hook                  | Arguments                   | Element Type                                      | Description                   |
| --------------------- | --------------------------- | ------------------------------------------------- | ----------------------------- |
| `renderApplicationV1` | `(app, html, data)`         | **jQuery** (V1 legacy)                            | Legacy Application rendering  |
| `renderApplicationV2` | `(app, element, context)`   | **HTMLElement** (3 args)                          | ApplicationV2 rendering (v13) |
| `renderActorSheet`    | `(sheet, html, data)`       | **HTMLElement** — PF1 sheets confirmed V2 (`pf1.applications.actor.abstract.ActorSheetPF` extends `ApplicationV2 + HandlebarsApplicationMixin`) | Actor sheet rendering |
| `renderItemSheet`     | `(sheet, html, data)`       | **Check sheet base class**                        | Item sheet rendering          |
| `renderSceneControls` | `(controls, html)`          | **HTMLElement**                                   | Scene controls rendering      |
| `renderChatMessageHTML` | `(message, html, data)`   | **HTMLElement** — v13 replacement for `renderChatMessage` | Chat message rendering |
| `renderTokenHUD`      | `(hud, html)`               | **jQuery** (HUD is V1 in v13)                     | Token HUD rendering           |

> ⚠️ **`renderChatMessage` does NOT exist in v13.** Code copied from v12 tutorials silently fails. Use `renderChatMessageHTML`.

> ⚠️ **`renderApplicationV2` takes 3 arguments** `(app, element, context)`, not 2. `element` is a native `HTMLElement`.

### Canvas Hooks

| Hook          | Arguments  | Description                                |
| ------------- | ---------- | ------------------------------------------ |
| `canvasInit`  | `(canvas)` | Fires when canvas is initialized           |
| `canvasReady` | `(canvas)` | Fires when canvas is ready for interaction |
| `canvasDraw`  | `(canvas)` | Fires when canvas is drawn                 |
| `drawToken`   | `(token)`  | Fires when a token is drawn                |

### Combat Hooks (v13 Verified Names)

| Hook                | Arguments                          | Description                                   |
| ------------------- | ---------------------------------- | --------------------------------------------- |
| `combatStart`       | `(combat, updateData)`             | Fires when combat starts                      |
| `combatRound`       | `(combat, updateData, updateOptions)` | Fires when round changes (v13 name)        |
| `combatTurn`        | `(combat, updateData, updateOptions)` | Fires on every turn advance (v13 name)     |
| `combatTurnChange`  | `(combat, prior, current)`         | Fires when active turn changes (v13 variant)  |

> ⚠️ **`combatRoundChange` and the old `combatTurnChange(combat, turn)` signature do not exist in v13.** The v13 round hook is `combatRound`; the v13 turn hook is `combatTurn`.

### Chat Hooks

| Hook                  | Arguments              | Description                                    |
| --------------------- | ---------------------- | ---------------------------------------------- |
| `createChatMessage`   | `(msg, options, userId)` | Fires when chat message is created           |
| `renderChatMessageHTML` | `(msg, html, data)`  | **v13** — Fires when chat message is rendered  |
| `renderChatLog`       | `(log, html)`          | Fires when chat log is rendered                |

### UI Hooks

| Hook                            | Arguments        | Description                                |
| ------------------------------- | ---------------- | ------------------------------------------ |
| `getSceneControlButtons`        | `(controls)`     | Fires when scene control buttons are built; mutate in place |
| `getHeaderControlsApplicationV2`| `(app, controls)`| **v13**: ApplicationV2 header buttons      |
| `getDocumentContextOptions`     | `(app, options)` | Context menu items on document lists       |

---

## Safe Module Patterns

### ✅ Hook Registration

```javascript
// Basic registration
Hooks.on('ready', () => {
  console.log('Game is ready');
});

// One-time hook
Hooks.once('init', () => {
  console.log('Initializing module');
});

// Remove hook by ID
const hookId = Hooks.on('updateActor', (actor, changes) => {
  console.log('Actor updated:', actor.id);
});
Hooks.off('updateActor', hookId);
```

### ✅ Lifecycle Usage

```javascript
// 1. init — register settings, CONFIG, data models; NO world data yet
Hooks.once('init', () => {
  game.settings.register('my-module', 'some-setting', { ... });
});

// 2. setup — post-system, pre-world-load
Hooks.once('setup', () => {
  // System has initialized but world documents not yet available
});

// 3. ready — safe to access game.actors, game.scenes, canvas, etc.
Hooks.once('ready', () => {
  const actors = game.actors;
});
```

### ✅ Render Hooks — V2 (HTMLElement)

**ApplicationV2 render hooks pass native `HTMLElement` with 3 arguments.**

```javascript
// ApplicationV2 render hook — 3 args, HTMLElement
Hooks.on('renderApplicationV2', (app, element, context) => {
  const div = document.createElement('div');
  div.textContent = 'Custom content';
  element.appendChild(div);
});

// Chat message — v13 name is renderChatMessageHTML
Hooks.on('renderChatMessageHTML', (message, html, data) => {
  const span = document.createElement('span');
  span.textContent = ' [Custom]';
  html.querySelector('.message-header')?.appendChild(span);
});
```

### ✅ Render Hooks — V1 (jQuery)

**Legacy V1 apps still pass jQuery.** Note: PF1 actor sheets are NOT V1 — they're confirmed `ApplicationV2 + HandlebarsApplicationMixin` (see §3 PF1 sheet provenance below). Use the V2 example for PF1 sheets. The pattern below is for arbitrary V1 apps from other systems/modules.

```javascript
// For arbitrary unknown sheet provenance, the safest pattern is to coerce:
Hooks.on('renderSomeUnknownSheet', (sheet, html, data) => {
  const root = html instanceof HTMLElement ? html : html[0];
  const btn = document.createElement('button');
  btn.textContent = 'Custom Action';
  btn.addEventListener('click', () => myCustomAction(sheet));
  root.querySelector('.sheet-header')?.appendChild(btn);
});
```

**For PF1 sheets (use this directly — sheets are V2):**

```javascript
Hooks.on('renderActorSheetPFCharacter', (sheet, element, context) => {
  // element is HTMLElement
  const btn = document.createElement('button');
  btn.textContent = 'Custom Action';
  btn.addEventListener('click', () => myCustomAction(sheet.actor));
  element.querySelector('.sheet-header')?.appendChild(btn);
});
```

### ✅ Cancelling Hooks

Only `pre*` hooks support cancellation via `return false`. **Pre-hook handlers must be synchronous** — an async function returns a Promise, not `false`, so it cannot cancel.

```javascript
// Synchronous pre-hook that can cancel
Hooks.on('preCreateItem', (createData) => {
  if (!isAllowed(createData)) return false;
});

// Async — CANNOT cancel even with return false
// Don't rely on this pattern for cancellation
```

### ✅ Async Hooks

Hooks are **never awaited**. Handle async internally.

```javascript
Hooks.on('someHook', async (data) => {
  try {
    await doAsyncThing(data);
  } catch (err) {
    console.error('Hook error:', err);
  }
});
```

---

## Common Pitfalls

1. **`renderChatMessage` is gone in v13.** Use `renderChatMessageHTML(message, html, data)`. Silent failure otherwise.
2. **`renderApplicationV2` takes 3 args** `(app, element, context)`. Forgetting `context` will cause your third parameter to be undefined.
3. **`combatRoundChange` is not a v13 hook.** Use `combatRound(combat, updateData, updateOptions)`.
4. **Hook timing**: `setup` fires BEFORE `ready`. Don't access `game.actors` or `canvas` in `init` or `setup`.
5. **V1 vs V2 render hooks**: V2 passes `HTMLElement`; V1 passes jQuery. **PF1 sheets are V2** (HTMLElement). For unknown sheet provenance, check base class.
6. **Async pre-hooks cannot cancel**: async function returns a Promise, which is truthy — Foundry won't treat it as `false`.
7. **`getSceneControlButtons`**: v13 argument shape changed from v12. Mutate what you're given; don't assume legacy array form.
8. **Error handling**: Wrap hook callbacks in try/catch; hooks have no built-in error handling.

---

## PF1.5 Notes / House Rule Warnings

### ⚠️ PF1 System Hooks Are Separate

PF1 provides its own hooks prefixed with `pf1`. Core Foundry hooks still also fire.

- Use `pf1PreActorRollSkill` for PF1 skill roll interception
- Use `pf1ToggleActorCondition` for PF1 condition toggles
- Use core `combatTurn` for per-turn-start logic

### ⚠️ Turn-Start Reset for PF1.5 Action Tracking

**MODULE DESIGN PATTERN — NOT NATIVE PF1 API**

> `pf1CombatTurnSkip` fires **only when a turn is skipped**, not on every turn start. Do not use it as your primary turn-start reset hook.

Use core `combatTurn` to reset action tracking at the start of each turn:

```javascript
// CORRECT: fires every time the active turn advances
Hooks.on('combatTurn', (combat, updateData, updateOptions) => {
  const combatant = combat.combatant;
  if (combatant?.actor) {
    combatant.actor.unsetFlag('my-pf1-5-module', 'actions');
    combatant.actor.unsetFlag('my-pf1-5-module', 'reactions');
  }
});

// Optional: also handle pf1CombatTurnSkip for skipped-turn edge cases
// pf1CombatTurnSkip fires when a combatant's turn is explicitly skipped,
// which may not fire combatTurn depending on PF1 implementation.
Hooks.on('pf1CombatTurnSkip', (combat, combatant) => {
  if (combatant?.actor) {
    combatant.actor.unsetFlag('my-pf1-5-module', 'actions');
    combatant.actor.unsetFlag('my-pf1-5-module', 'reactions');
  }
});
```

---

## Source Pages Consulted

- [Class: Hooks](https://foundryvtt.com/api/v13/classes/foundry.helpers.Hooks.html)
- [Module: hookEvents](https://foundryvtt.com/api/v13/modules/hookEvents.html)
- [Foundry VTT v13 API Documentation](https://foundryvtt.com/api/v13/index.html)
- [Introduction to Module Development](https://foundryvtt.com/article/module-development/)
- [Release 13.350 Notes](https://foundryvtt.com/releases/13.350)
- [Release 13.348 Notes](https://foundryvtt.com/releases/13.348)
- [API Migration Guides](https://foundryvtt.com/article/migration/)

---

*Last updated: May 2026 | Foundry VTT v13.350+*

---

## FILE: 01_Foundry_v13_Hooks_Settings_Utilities.md

# Foundry VTT v13 Hooks, Settings & Utilities

## Purpose

Reference for Foundry VTT v13's hook system, settings management, and utility classes. Covers event-driven development patterns and module configuration.

## When to Use This

- Implementing event-driven module behavior
- Registering and using module settings
- Finding the right hook for your use case
- Working with utility classes (KeyboardManager, etc.)

---

## Core Classes / APIs

### Hook System

- `**foundry.helpers.Hooks**` - Core event framework
  - Methods: `on(hook, callback)`, `once(hook, callback)`, `off(hook, callback)`, `call(hook, ...args)`, `callAll(hook, ...args)`

### Settings System

- `**game.settings**` - Client-side settings management (access via `game.settings.register/get/set`)
- `**foundry.documents.Setting**` - Setting document type
- `**foundry.applications.settings.SettingsConfig**` - Settings UI

### Utility Classes

- `**foundry.helpers.interaction.KeyboardManager**` - Keyboard shortcuts
- `**game.socket**` - Socket communication (core Foundry socket; use `game.socket.emit` / `game.socket.on`)
- `**foundry.helpers.GameTime**` - Game time management
- `**foundry.helpers.media.ImageHelper**` - Image utilities
- `**foundry.helpers.media.VideoHelper**` - Video utilities
- `**foundry.audio.AudioHelper**` - Audio utilities
- `**foundry.audio.Sound**` - Sound playback

---

## Safe Module Patterns

### ✅ Hook Registration

```javascript
// Basic hook registration
Hooks.on('init', () => {
  console.log('Module initialized');
});

Hooks.once('ready', () => {
  console.log('Game ready');
});

// With error handling
Hooks.on('someHook', async (arg1, arg2) => {
  try {
    await doSomething();
  } catch (err) {
    console.error('Hook error:', err);
  }
});

// Remove hook
const callback = () => {};
const id = Hooks.on('someHook', callback);
Hooks.off('someHook', id);  // By ID (preferred)
// Hooks.off('someHook', callback);  // Or by function reference
```

### ✅ Settings Registration

Use `game.settings.register` in the `init` hook.

```javascript
Hooks.once('init', () => {
  // Boolean setting
  game.settings.register('my-module', 'enable-feature', {
    name: 'Enable Feature',
    hint: 'Description of the feature',
    scope: 'world',   // 'world' | 'client'
    type: Boolean,
    default: true,
    config: true,
    onChange: value => console.log('Setting changed:', value)
  });

  // Select setting
  game.settings.register('my-module', 'theme', {
    name: 'Theme',
    scope: 'client',
    type: String,
    default: 'default',
    choices: { default: 'Default', dark: 'Dark', light: 'Light' },
    config: true
  });

  // Number / range setting
  game.settings.register('my-module', 'opacity', {
    name: 'Opacity',
    scope: 'client',
    type: Number,
    default: 100,
    range: { min: 0, max: 100, step: 10 },
    config: true
  });
});
```

### ✅ Settings Access

```javascript
// Get
const enabled = game.settings.get('my-module', 'enable-feature');

// Set
await game.settings.set('my-module', 'enable-feature', false);
```

### ✅ Core Lifecycle Hooks — Verified Order

```javascript
// 1. init — register settings, CONFIG, data models; no world data
Hooks.once('init', () => {});

// 2. i18nInit — localization loaded
Hooks.once('i18nInit', () => {});

// 3. setup — post-system init; world not loaded yet
Hooks.once('setup', () => {});

// 4. ready — world + documents fully loaded; canvas available
Hooks.once('ready', () => {});

// Dev only
Hooks.on('hotReload', () => {});

// Game pause/resume
Hooks.on('pauseGame', (paused) => {});
```

> ⚠️ **`setup` fires BEFORE `ready`**, not after. Do not access `game.actors` or `canvas` in `init` or `setup`.

### ✅ Document Hooks

```javascript
// Creation
Hooks.on('createActor', (actor, options, userId) => {});
Hooks.on('createItem', (item, options, userId) => {});

// Update
Hooks.on('updateActor', (actor, changes, options, userId) => {});

// Deletion
Hooks.on('deleteActor', (actor, options, userId) => {});

// Embedded documents
Hooks.on('createActiveEffect', (effect, options, userId) => {});
Hooks.on('updateToken', (tokenDoc, changes, options, userId) => {});
```

### ✅ Canvas Hooks

```javascript
Hooks.on('canvasInit', (canvas) => {});
Hooks.on('canvasReady', (canvas) => {});
Hooks.on('canvasDraw', (canvas) => {});
Hooks.on('drawToken', (token) => {});

Hooks.on('clickToken', (token, event) => {});
Hooks.on('hoverToken', (token, hovered) => {});
Hooks.on('controlToken', (token, controlled) => {});
```

### ✅ UI Hooks

```javascript
// V2 render hook — 3 args, HTMLElement
Hooks.on('renderApplicationV2', (app, element, context) => {
  // element is HTMLElement
});

// V1 render hook — jQuery
Hooks.on('renderApplicationV1', (app, html, data) => {
  // html is jQuery
});

// PF1 actor sheets are V2 (HandlebarsApplicationMixin) — html is HTMLElement
Hooks.on('renderActorSheet', (sheet, html, data) => {});
Hooks.on('renderItemSheet', (sheet, html, data) => {});

// Context menus
Hooks.on('getDocumentContextOptions', (app, options) => {});
Hooks.on('getSceneControlButtons', (controls) => {});  // mutate in place

// V13 header buttons
Hooks.on('getHeaderControlsApplicationV2', (app, controls) => {});

// Chat — v13 name
Hooks.on('createChatMessage', (msg) => {});
Hooks.on('renderChatMessageHTML', (msg, html, data) => {});  // NOT renderChatMessage
```

> ⚠️ **`renderChatMessage` does not exist in v13.** Use `renderChatMessageHTML`. Code from v12 tutorials silently fails.

### ✅ Combat Hooks (v13 Verified Names)

```javascript
// Combat lifecycle
Hooks.on('combatStart', (combat, updateData) => {});
Hooks.on('combatRound', (combat, updateData, updateOptions) => {});   // v13 — was combatRoundChange
Hooks.on('combatTurn', (combat, updateData, updateOptions) => {});    // v13 — fires every turn advance
Hooks.on('combatTurnChange', (combat, prior, current) => {});         // v13 — different signature

// Combatant
Hooks.on('updateCombatant', (combatant, changes, options, userId) => {});
```

> ⚠️ **`combatRoundChange` is not a v13 hook.** The v13 name is `combatRound`.

### ✅ Dice Hooks

```javascript
Hooks.on('diceSoNiceRollComplete', (messageId) => {});
```

### ✅ Keyboard Shortcuts

```javascript
// Register in the 'init' hook
Hooks.once('init', () => {
  game.keybindings.register('my-module', 'my-shortcut', {
    name: 'My Shortcut',
    hint: 'Description',
    editable: [{ key: 'KeyM', modifiers: ['Control'] }],
    onDown: () => { console.log('Shortcut pressed'); },
    onUp: () => {},
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
});
```

### ✅ Socket Communication

Use `game.socket` — enable by adding `"socket": true` in `module.json`.

```javascript
// Listen — register handler before 'ready'
Hooks.once('ready', () => {
  game.socket.on('module.my-module', (data) => {
    if (data.action === 'myAction') handleMyAction(data);
  });
});

// Emit to all clients
game.socket.emit('module.my-module', { action: 'myAction', payload: {} });
```

---

## Common v13 Pitfalls

1. **`setup` is BEFORE `ready`.** Don't access `game.actors` or `canvas` in `setup`.
2. **`renderChatMessage` → `renderChatMessageHTML`**. Silent failure in v13.
3. **`combatRoundChange` → `combatRound`**. Old name doesn't fire.
4. **`renderApplicationV2` takes 3 args**: `(app, element, context)`. `element` is `HTMLElement`.
5. **V1 render hooks still pass jQuery.** PF1 sheets are V2 (HTMLElement). For non-PF1 sheet hooks, check base class before assuming.
6. **Setting scope**: `world` = all players; `client` = local only. No `user` scope in v13 core (check PF1 docs if needed).
7. **Socket prefix**: channel name must be `module.{your-module-id}`.
8. **Keyboard binding**: register in `init` via `game.keybindings.register`, not `KeyboardManager.register`.
9. **Hooks are never awaited**: async handlers don't block; handle async internally.
10. **Error handling**: wrap in try/catch; hooks have no built-in error handling.

---

## Utility Classes Quick Reference

| Utility       | Purpose              | Key Methods                              |
| ------------- | -------------------- | ---------------------------------------- |
| `GameTime`    | Game time management | `advance()`, `setTime()`                 |
| `ImageHelper` | Image manipulation   | `createThumbnail()`, `uploadImage()`     |
| `VideoHelper` | Video playback       | `play()`, `stop()`                       |
| `AudioHelper` | Audio management     | `playSound()`, `preloadSound()`          |
| `Sound`       | Sound instance       | `play()`, `pause()`, `stop()`, `fade()`  |

---

## Source Pages Consulted

- [Foundry VTT v13 API: Hook Events](https://foundryvtt.com/api/v13/modules/hookEvents.html)
- [Class: Hooks](https://foundryvtt.com/api/v13/classes/foundry.helpers.Hooks.html)
- [Class: ClientSettings](https://foundryvtt.com/api/v13/classes/foundry.helpers.ClientSettings.html)
- [Class: Setting](https://foundryvtt.com/api/v13/classes/foundry.documents.Setting.html)
- [Class: SettingsConfig](https://foundryvtt.com/api/v13/classes/foundry.applications.settings.SettingsConfig.html)
- [Class: KeyboardManager](https://foundryvtt.com/api/v13/classes/foundry.helpers.interaction.KeyboardManager.html)
- [Class: GameTime](https://foundryvtt.com/api/v13/classes/foundry.helpers.GameTime.html)
- [Class: ImageHelper](https://foundryvtt.com/api/v13/classes/foundry.helpers.media.ImageHelper.html)
- [Class: Sound](https://foundryvtt.com/api/v13/classes/foundry.audio.Sound.html)

---

*Last updated: May 2026 | Foundry VTT v13.350+*

---

## FILE: 01_Foundry_v13_Module_Dev_Index.md

# Foundry VTT v13 Module Development Index

## Purpose

Master reference index for Foundry VTT v13.350+ module development. Use this as your starting point when building custom modules for Pathfinder 1e with Claude/GPT assistance. This file organizes all other reference docs and provides quick navigation to core concepts.

## When to Use This

- Starting a new module project
- Need to find which API area covers your use case
- Unsure which reference file contains the information you need
- Planning module architecture

---

## Core API Areas Overview


| Area                     | Primary Classes                                             | Reference File                            | Use Case                         |
| ------------------------ | ----------------------------------------------------------- | ----------------------------------------- | -------------------------------- |
| **Public API Safety**    | `Hooks`, `ClientSettings`, `@public`/`@private`             | `Foundry_v13_Public_API_Safety.md`        | Understanding what's safe to use |
| **ApplicationV2 UI**     | `ApplicationV2`, `DialogV2`, `DocumentSheetV2`              | `Foundry_v13_ApplicationV2_UI.md`         | Building modern UI               |
| **Documents & Data**     | `Document`, `ClientDocument`, `CanvasDocument`, `DataModel` | `Foundry_v13_Documents_Data_Model.md`     | Data management                  |
| **Canvas/Scenes/Tokens** | `Canvas`, `Scene`, `Token`, `TokenDocument`, Layers         | `Foundry_v13_Canvas_Scenes_Tokens.md`     | Canvas interaction               |
| **Hooks & Settings**     | `Hooks`, `ClientSettings`, `Setting`                        | `Foundry_v13_Hooks_Settings_Utilities.md` | Event handling & config          |


---

## Module Development Workflow

### 1. **Project Setup**

```javascript
// module.json
{
  "id": "your-module-id",
  "title": "Your Module",
  "description": "...",
  "version": "1.0.0",
  "compatibility": { "minimum": "13.350" },
  "esmodules": ["module.mjs"],
  "styles": ["module.css"],
  "languages": [{"lang": "en", "path": "lang/en.json"}]
}
```

### 2. **Entry Point Pattern**

```javascript
// module.mjs
import { registerSettings } from './settings.mjs';
import { setupHooks } from './hooks.mjs';

Hooks.once('init', () => {
  registerSettings();
});

Hooks.once('ready', () => {
  setupHooks();
});
```

### 3. **ES Module Structure**

```
module/
├── module.mjs          # Main entry
├── module.css          # Scoped styles
├── settings.mjs        # Settings registration
├── hooks/              # Hook handlers
│   ├── canvas.mjs
│   ├── combat.mjs
│   └── ui.mjs
├── ui/                 # UI components
│   ├── apps/           # ApplicationV2 subclasses
│   └── hud/            # HUD elements
└── utils/              # Shared utilities
```

---

## Core Classes / APIs by Category

### Foundry Namespace Roots

- `foundry` - Global namespace (v13 uses ESM but exposes via `foundry`)
- `foundry.applications.api` - ApplicationV2, DialogV2
- `foundry.applications.sheets` - ActorSheetV2, ItemSheetV2
- `foundry.canvas` - Canvas, layers, placeables
- `foundry.documents` - All document types
- `foundry.helpers` - Hooks, ClientSettings, utilities
- `foundry.abstract` - Base classes (Document, DataModel)

### Key Global Objects

- `game` - `foundry.Game` instance
- `canvas` - `foundry.Canvas` instance (scene context)
- `ui` - UI manager
- `CONFIG` - System/module configuration
- `Hooks` - `foundry.helpers.Hooks`

---

## Safe Module Patterns

### ✅ DO

- **Use `@public` APIs** - Marked as safe for external use
- **Extend via documented patterns** - Subclass `ApplicationV2`, `DocumentSheetV2`
- **Use `ClientSettings**` - For module settings
- **Register hooks early** - Use `init` for registration, `ready` for execution
- **Scope CSS** - Prefix all selectors with your module ID
- **Check `game.modules.get()**` - Verify your module is active

### ❌ DON'T

- **Use `_` prefixed methods** - Treat as `@private`
- **Use `#private` fields** - JavaScript private fields, inaccessible
- **Override core prototypes** - Will break with updates
- **Assume global `game` in all contexts** - Some hooks fire before ready
- **Use `@internal` methods** - Reserved for core Foundry

---

## Common v13 Pitfalls

1. **ESM Migration**: Client code migrated to ESM in v13.338. Use `import`/`export` syntax.
2. **Namespace Changes**: Many classes moved to `foundry.*` namespace. Avoid legacy globals.
3. **ApplicationV2**: New UI framework. Prefer over legacy `Application` where possible.
4. **Document vs ClientDocument**: `ClientDocument` adds client-specific methods. Don't assume server-side availability.
5. **Canvas Context**: `canvas` is only available in scene contexts. Check `game.scenes.active` first.
6. **Async Hooks**: Foundry hooks are **never awaited**. Async handlers run fire-and-forget; returning a Promise does not block the caller and cannot cancel a pre-hook. Always handle async work internally.
7. **TypeScript Definitions**: Use `@types/foundry__v13` or similar for type safety.

---

## Questions This File Should Answer

- What are the main API areas in Foundry v13?
- Which reference file covers my specific use case?
- What's the recommended project structure for a v13 module?
- What are the key global objects I can access?
- What's the difference between `init` and `ready` hooks?
- How do I organize my module code?
- Where do I find information about UI development?
- Where do I find information about data models?

---

## Source Pages Consulted

- [Foundry Virtual Tabletop - API Documentation - Version 13](https://foundryvtt.com/api/v13/index.html)
- [Class: Game](https://foundryvtt.com/api/v13/classes/foundry.Game.html)
- [Class: Hooks](https://foundryvtt.com/api/v13/classes/foundry.helpers.Hooks.html)
- [Class: ClientSettings](https://foundryvtt.com/api/v13/classes/foundry.helpers.ClientSettings.html)
- [Class: ApplicationV2](https://foundryvtt.com/api/v13/classes/foundry.applications.api.ApplicationV2.html)
- [Class: Document](https://foundryvtt.com/api/v13/classes/foundry.abstract.Document.html)
- [Class: ClientDocument](https://foundryvtt.com/api/v13/classes/foundry.ClientDocument.html)

---

*Last updated: May 2, 2026 | Foundry VTT v13.350+*

---

## FILE: 01_Foundry_v13_Module_Manifest_Packages.md

# Foundry VTT v13 Module Manifest & Packages

## Purpose

Reference for Foundry VTT v13 module manifest (`module.json`) structure, package management, and installer/update behavior. Covers all documented manifest fields and common installation issues.

## When to Use This

- Creating or updating a `module.json` manifest
- Debugging module installation or update failures
- Understanding Foundry package system requirements
- Configuring module dependencies and compatibility

---

## Core Classes / APIs

- `**foundry.packages.Module**` - Module package class
- `**foundry.packages.BasePackage**` - Base package class (Module extends this)
- `**foundry.packages.types.PackageManifestData**` - Manifest data interface

---

## Confirmed Namespaces / Classes / Hooks / Fields

### Confirmed Manifest Fields

From `PackageManifestData` interface and Foundry documentation:


| Field               | Type                     | Required | Description                                                     |
| ------------------- | ------------------------ | -------- | --------------------------------------------------------------- |
| `id`                | string                   | ✅ Yes    | Machine-readable unique ID (lowercase, no spaces/special chars) |
| `title`             | string                   | ✅ Yes    | Human-readable module name                                      |
| `version`           | string                   | ✅ Yes    | Semantic version (major.minor.patch)                            |
| `description`       | string                   | ❌ No     | Module description (HTML allowed)                               |
| `authors`           | PackageAuthorData[]      | ❌ No     | Array of author objects                                         |
| `url`               | string                   | ❌ No     | Module homepage URL                                             |
| `manifest`          | string                   | ❌ No     | URL to latest manifest (required for updates)                   |
| `download`          | string                   | ❌ No     | URL to module zip (required for installation)                   |
| `readme`            | string                   | ❌ No     | URL or path to README                                           |
| `changelog`         | string                   | ❌ No     | URL to changelog                                                |
| `license`           | string                   | ❌ No     | URL or path to license                                          |
| `bugs`              | string                   | ❌ No     | URL for bug reports                                             |
| `compatibility`     | PackageCompatibilityData | ❌ No     | Version compatibility object                                    |
| `esmodules`         | string[]                 | ❌ No     | Array of ES module entry points                                 |
| `scripts`           | string[]                 | ❌ No     | **Legacy**: CommonJS scripts (use `esmodules` for v13)          |
| `styles`            | string[]                 | ❌ No     | Array of CSS file paths                                         |
| `languages`         | PackageLanguageData[]    | ❌ No     | Array of language objects                                       |
| `packs`             | PackageCompendiumData[]  | ❌ No     | Compendium packs included                                       |
| `packFolders`       | PackFolderData[]         | ❌ No     | Compendium pack folders                                         |
| `socket`            | boolean                  | ❌ No     | Whether module uses sockets                                     |
| `flags`             | PackageFlagsData         | ❌ No     | Custom module flags                                             |
| `media`             | PackageMediaData[]       | ❌ No     | Array of media objects (screenshots for package browser) |
| `protected`         | boolean                  | ❌ No     | Whether package is protected                                    |
| `exclusive`         | boolean                  | ❌ No     | Whether this is an Exclusive pack                               |
| `persistentStorage` | boolean                  | ❌ No     | Whether to use persistent storage                               |
| `relationships`     | PackageRelationshipsData | ❌ No     | Dependencies, conflicts, and requirements                       |


### Compatibility Object Structure

```typescript
interface PackageCompatibilityData {
  minimum?: string;   // Minimum Foundry version (e.g., "13.350")
  verified?: string;  // Verified Foundry version(s)
  maximum?: string;   // Maximum Foundry version (rarely used)
}
```

### Relationships Object Structure

```typescript
interface PackageRelationshipsData {
  requires?: string[];    // Required package IDs
  conflicts?: string[];   // Conflicting package IDs
  suggestions?: string[]; // Suggested package IDs
  dependencies?: {       // Version-specific dependencies
    [packageId: string]: string;
  };
}
```

### Language Object Structure

```typescript
interface PackageLanguageData {
  lang: string;      // Language code (e.g., "en")
  name: string;      // Language name (e.g., "English")
  path: string;      // Path to language file (e.g., "lang/en.json")
}
```

### Media Object Structure

```typescript
interface PackageMediaData {
  type: "image" | "video" | "audio";
  url: string;          // URL to media file
  thumbnail?: string;   // Thumbnail URL for videos
  caption?: string;    // Media caption
}
```

---

## Safe Module Patterns

### ✅ Minimal Valid `module.json` for v13 ES Module

```json
{
  "id": "my-module",
  "title": "My Module",
  "version": "1.0.0",
  "description": "A custom module for Foundry VTT v13",
  "author": "Your Name",
  "url": "https://github.com/yourname/my-module",
  "manifest": "https://github.com/yourname/my-module/releases/latest/download/module.json",
  "download": "https://github.com/yourname/my-module/releases/latest/download/my-module.zip",
  "compatibility": {
    "minimum": "13.350",
    "verified": "13.350"
  },
  "esmodules": ["module.mjs"],
  "styles": ["module.css"],
  "languages": [
    {
      "lang": "en",
      "name": "English",
      "path": "lang/en.json"
    }
  ],
  "media": [
    {
      "type": "image",
      "url": "https://raw.githubusercontent.com/yourname/my-module/main/screenshot.png",
      "caption": "Module screenshot"
    }
  ]
}
```

### ✅ PF1 System Dependency

```json
{
  "relationships": {
    "requires": ["pf1"],
    "conflicts": []
  }
}
```

### ✅ Socket Usage

```json
{
  "socket": true
}
```

### ✅ Multiple Entry Points

```json
{
  "esmodules": [
    "module.mjs",
    "scripts/init.mjs",
    "scripts/hooks.mjs"
  ]
}
```

### ✅ Compendium Packs

```json
{
  "packs": [
    {
      "name": "custom-items",
      "label": "Custom Items",
      "path": "packs/custom-items.db",
      "system": "pf1",
      "type": "Item"
    }
  ]
}
```

---

## Common Pitfalls

1. **Invalid JSON**: `module.json` must be valid JSON. Use a validator. Common errors: trailing commas, unquoted keys, comments.
2. **Missing Required Fields**: `id`, `title`, and `version` are **required**. Missing any will prevent installation. `manifest` and `download` are required for in-app install/update; `media` is optional (used for the package browser listing only).
3. **Missing `manifest` URL**: Without `manifest`, Foundry cannot check for updates. Use a URL that always points to the latest manifest.
4. **Missing `download` URL**: Without `download`, users cannot install via manifest URL. Must point to a direct zip download.
5. **Wrong Compatibility**: If `compatibility.minimum` is higher than the user's Foundry version, installation is blocked. Use `"13.350"` or lower for v13.350+.
6. **Legacy `scripts` vs `esmodules**`: For v13 modules, use `esmodules` array. `scripts` is for legacy CommonJS (deprecated in v13).
7. **Bad Zip Structure**: Module zip must contain files at the root, not in a subfolder. Structure: `my-module.zip` → `module.json`, `module.mjs`, etc. (not `my-module/module.json`)
8. **Case-Sensitive IDs**: Package IDs are case-sensitive. `"MyModule"` ≠ `"mymodule"`. Use lowercase consistently.
9. **Special Characters in ID**: IDs cannot contain spaces or special characters. Use hyphens or underscores: `"my-module"` or `"my_module"`.
10. **Version Format**: Use semantic versioning (major.minor.patch). Avoid `"1.0"` (missing patch). Use `"1.0.0"`.
11. **Relative vs Absolute Paths**: In `esmodules` and `styles`, use relative paths from module root. In `manifest` and `download`, use absolute URLs.
12. **Media Field**: `media` is **optional** — it appears in the package browser but is not required for installation. Include a screenshot if publishing publicly, but omit for private/home-game modules.
13. **Socket Flag Mismatch**: If `socket: true` but module doesn't use sockets, or vice versa, may cause issues. Only set to `true` if using `SocketInterface`.
14. **Language Path Errors**: Language file paths in `languages` array must be correct. `"lang/en.json"` must exist.
15. **Dependency Cycles**: Avoid circular dependencies in `relationships.requires`. Foundry may fail to load modules with circular requirements.

---

## PF1.5 Notes / House Rule Warnings

### ⚠️ System Dependency

PF1.5 is a **house rule framework**, not a separate Foundry system. Your module should:

- **Require PF1 system**: `"requires": ["pf1"]` in relationships
- **Not require PF1.5**: PF1.5 is your custom framework, not a Foundry package
- **Handle both modes**: Use module settings to enable/disable PF1.5 features

```json
{
  "relationships": {
    "requires": ["pf1"],
    "conflicts": []
  }
}
```

### ⚠️ Compatibility Versioning

- Set `compatibility.minimum` to `"13.350"` for v13.350+
- PF1.5 features should be **opt-in** via module settings
- Document PF1.5 compatibility in your `description`

---

## Questions This File Should Answer

- What fields are required in `module.json`?
- What fields are optional in `module.json`?
- How do I specify ES module entry points?
- How do I specify CSS files?
- How do I specify language files?
- How do I specify dependencies?
- How do I specify conflicts?
- How do I specify version compatibility?
- What's the difference between `manifest` and `download`?
- What's the correct zip structure for module distribution?
- What are common manifest errors?
- How do I configure for PF1 system?
- How do I handle PF1.5 in my manifest?

---

## Source Pages Consulted

- [PackageManifestData Interface](https://foundryvtt.com/api/v13/interfaces/foundry.packages.types.PackageManifestData.html)
- [Module Class](https://foundryvtt.com/api/v13/classes/foundry.packages.Module.html)
- [BasePackage Class](https://foundryvtt.com/api/v13/classes/foundry.packages.BasePackage.html)
- [Introduction to Module Development](https://foundryvtt.com/article/module-development/)
- [Package Management](https://foundryvtt.com/article/package-management/)
- [Module Management](https://foundryvtt.com/article/modules/)
- [Version 10 Manifest Migration Guide](https://foundryvtt.com/article/manifest-migration-guide/)
- [API Migration Guides](https://foundryvtt.com/article/migration/)

---

*Last updated: May 3, 2026 | Foundry VTT v13.350+*

---

## FILE: 01_Foundry_v13_Module_Review_Checklist.md

# Foundry VTT v13 Module Review Checklist

## Purpose

Pre-deployment checklist for Foundry VTT v13 modules. Use this to verify your module follows best practices, uses safe APIs, and is ready for production use with Pathfinder 1e.

## When to Use This

- Before publishing a module
- During code review
- When debugging module issues
- When updating a module for v13 compatibility

---

## Core Checklist Categories

### ✅ Module Metadata

- `module.json` has valid JSON
- `id` is unique and descriptive (lowercase, hyphen-separated)
- `title` is clear and matches module purpose
- `description` explains module functionality
- `version` follows semantic versioning (major.minor.patch)
- `compatibility.minimum` is set to "13.350" or higher
- `compatibility.verified` includes tested versions
- `url` points to module homepage/repository
- `manifest` points to raw module.json URL
- `download` points to module zip file
- `author` is accurate
- `esmodules` array lists all ES module entry points
- `styles` array lists all CSS files
- `languages` includes English (en.json) at minimum
- `dependencies` lists required modules (if any)
- `conflicts` lists incompatible modules (if known)
- `socket` is true if using socket communication

### ✅ File Structure

- Module files are in a dedicated folder
- `module.json` is in module root
- ES modules use `.mjs` extension
- CSS files use `.css` extension
- Template files use `.hbs` extension (if using Handlebars)
- Language files are in `lang/` folder
- Assets are in `assets/` or similar organized folder
- No unnecessary files included in distribution

### ✅ Code Quality

- Uses ES modules (`import`/`export`)
- No global variable pollution
- All variables properly scoped
- Uses strict equality (`===`/`!==`)
- No `var` declarations (use `const`/`let`)
- Consistent indentation (2 or 4 spaces)
- Consistent code style throughout
- Meaningful variable/function names
- Functions are concise (< 50 lines)
- Complex logic is well-commented
- No commented-out code
- No `console.log` in production

### ✅ API Safety

- Only uses `@public` APIs
- No `_` prefixed method calls
- No `#` private field access
- No `@private` or `@internal` method usage
- No core prototype modifications
- All hooks properly registered/removed
- Hook callbacks have error handling
- Settings use `game.settings.*` API (the underlying class is `foundry.helpers.ClientSettings`)
- No direct DOM manipulation (use Foundry APIs)
- Canvas access is guarded (`canvas?.ready`)
- Document operations use proper methods
- No assumptions about global `game` availability

### ✅ Performance

- No expensive operations in frequently-firing hooks
- Canvas operations are batched where possible
- Event listeners are removed when no longer needed
- No memory leaks (unbound event listeners, etc.)
- Large data operations are async
- Image assets are optimized
- Audio files are compressed
- No unnecessary re-renders
- Caching used for expensive computations

### ✅ UI/UX

- CSS is module-scoped (prefix with module ID)
- No style conflicts with core Foundry
- High contrast colors used
- Readable font sizes
- Responsive design (works at different resolutions)
- Touch-friendly controls (for tablet users)
- Keyboard navigation support
- Screen reader accessible (aria labels, etc.)
- Clear visual feedback for interactions
- No UI flickering or layout shifts
- Loading states are indicated
- Error states are handled gracefully

### ✅ Settings

- Settings registered via `game.settings.register`
- Setting names are descriptive
- Setting hints explain purpose
- Default values are sensible
- Setting types are appropriate
- Config flag set to `true` for user-configurable settings
- Settings UI is intuitive
- Setting changes take effect immediately (or after reload)
- Setting migrations handled for updates

### ✅ Localization

- All user-facing text is localized
- English translations are complete
- Translation keys are descriptive
- Pluralization handled correctly
- Right-to-left language support considered
- Text doesn't overflow containers
- Icons have text alternatives

### ✅ Security

- No eval() or Function() constructors
- No innerHTML assignments with user input
- Socket data is validated
- User input is sanitized
- No sensitive data logged
- No cross-site scripting vulnerabilities
- File uploads are validated
- No arbitrary code execution possible

### ✅ Error Handling

- All async operations have try/catch
- Network errors are handled
- File errors are handled
- Permission errors are handled
- User-friendly error messages
- Errors don't crash the game
- Errors are logged appropriately
- Error recovery is possible

### ✅ Documentation

- README.md explains module purpose
- Installation instructions included
- Usage instructions included
- Configuration options documented
- Known issues listed
- Changelog maintained
- License specified
- Contribution guidelines (if open source)

### ✅ Testing

- Tested with Foundry v13.350+
- Tested with Pathfinder 1e system
- Tested with multiple browsers (Chrome, Firefox, Edge)
- Tested with different screen sizes
- Tested with different DPI settings
- Tested with keyboard-only navigation
- Tested with screen readers
- Tested module enable/disable
- Tested module update process
- Tested with other popular modules

### ✅ Pathfinder 1e Specific

- Compatible with PF1 rules
- Respects PF1 data model
- Works with PF1 sheet structure
- Handles PF1-specific document types
- Doesn't conflict with PF1 core functionality
- PF1.5 custom rules considered (if applicable)
- 3-action economy compatible (if applicable)
- Toggle conditions compatible (if applicable)

---

## Pre-Publish Verification

### Manual Testing Checklist

- Module loads without errors
- All features work as expected
- Settings UI works correctly
- Module survives Foundry restart
- Module survives scene changes
- Module survives world changes
- No console errors
- No console warnings (except known ones)
- No memory leaks over time
- Multiplayer functionality works
- GM and player views both work correctly

### Code Review Checklist

- All code follows Foundry v13 best practices
- No deprecated APIs used
- No breaking changes from v12
- ESM migration complete
- TypeScript definitions valid (if using TS)
- No circular dependencies
- All imports are valid
- All exports are used
- No unused code

### Performance Testing

- Module load time < 500ms
- Memory usage stable over time
- No frame rate drops during canvas operations
- Large scenes handled efficiently
- Many tokens handled efficiently
- Complex operations don't freeze UI

---

## Common Issues to Catch

1. **Global Leaks**: Check for variables assigned to `window` or global scope
2. **Event Leaks**: Ensure all event listeners are removed on module disable
3. **Canvas Assumptions**: Code that assumes `canvas` always exists
4. **Game Assumptions**: Code that assumes `game` always exists
5. **Async Await**: Missing `await` on async operations
6. **Error Swallowing**: Empty catch blocks that hide errors
7. **Race Conditions**: Operations that depend on timing
8. **State Mutations**: Directly modifying Foundry state objects
9. **Version Checks**: Not checking Foundry version compatibility
10. **Module Conflicts**: Not handling conflicts with other modules

---

## Questions This File Should Answer

- What do I need to check before publishing my module?
- What are the best practices for module structure?
- How do I ensure my module is safe to use?
- What should I test before release?
- How do I verify my module uses only public APIs?
- What are common module issues to avoid?
- How do I ensure my module works with Pathfinder 1e?
- What performance considerations are there?
- How do I handle errors properly?
- What documentation should I include?

---

## Source Pages Consulted

- [Foundry VTT v13 API Documentation](https://foundryvtt.com/api/v13/index.html)
- [Foundry VTT Module Development Guide](https://foundryvtt.com/article/module-development/)
- [Foundry VTT Versioning Policy](https://foundryvtt.com/article/versioning/)
- [Pathfinder 1e System Documentation](https://foundryvtt.com/packages/pf1)

---

*Last updated: May 2, 2026 | Foundry VTT v13.350+*

---

## FILE: 01_Foundry_v13_Public_API_Safety.md

# Foundry VTT v13 Public API Safety Guide

## Purpose

Guide to safely navigating Foundry VTT v13's public, protected, private, and internal APIs. Essential reading before writing any module code to avoid breakage across updates.

## When to Use This

- Before calling any Foundry API method
- When reviewing existing module code for safety
- When debugging unexpected behavior
- When planning API usage in new features

---

## Core Classes / APIs

### API Classification System


| Annotation   | Access Level    | Stability      | Usage                       |
| ------------ | --------------- | -------------- | --------------------------- |
| `@public`    | External        | ✅ Stable       | Safe to call from modules   |
| `@protected` | Subclass        | ⚠️ Stable      | Override in subclasses only |
| `@private`   | Internal        | ❌ Unstable     | Do NOT use                  |
| `@internal`  | Core-only       | ❌ Unstable     | Do NOT use                  |
| `_prefix`    | Implied Private | ❌ Unstable     | Treat as `@private`         |
| `#prefix`    | JS Private      | ❌ Inaccessible | Syntax error if accessed    |


### Key Safety Classes

- `**foundry.helpers.Hooks**` - Event framework (`@public` methods: `on`, `once`, `off`, `call`, `callAll`)
- `**foundry.helpers.ClientSettings**` - Module settings management (`@public`)
- `**foundry.abstract.Document**` - Base document class (extend, don't call private methods)
- `**foundry.ClientDocument**` - Client-side document mixin
- `**foundry.CanvasDocument**` - Canvas-visible document mixin

---

## Safe Module Patterns

### ✅ Safe: Using Public API

> ⚠️ **Import specifiers**: The `foundry/...` bare specifiers below require Foundry's import map or a bundler. Use globals (`foundry.applications.api.ApplicationV2`, `game.settings`) where no import map is available.

```javascript
// HOOKS - All public
Hooks.on('init', () => {});
Hooks.once('ready', () => {});
Hooks.off('someHook', callback);
Hooks.callAll('customHook', data);

// SETTINGS - use game.settings (always available as global)
game.settings.register('my-module', 'my-setting', {
  name: 'My Setting',
  hint: 'A description',
  scope: 'world',
  type: String,
  default: 'value',
  config: true
});
// import { ClientSettings } from 'foundry/client/settings.mjs'; // requires import map/bundler

// DOCUMENT OPERATIONS - Public
// Note: bare `Actor` is a legacy global; canonical class is `foundry.documents.Actor`.
const actor = await foundry.documents.Actor.create({ name: 'Test', type: 'character' });
actor.update({ 'system.hp.value': 10 });
actor.delete();

// CANVAS - Public access
if (canvas?.ready) {
  const token = canvas.tokens.get(tokenId);
  token.control();
}
```

### ✅ Safe: Extending Public Classes

```javascript
// Use the global (no import needed)
const { ApplicationV2 } = foundry.applications.api;
// OR with import map/bundler: import { ApplicationV2 } from 'foundry/applications/api/application-v2.mjs';

// Use HandlebarsApplicationMixin when rendering Handlebars templates
const { HandlebarsApplicationMixin } = foundry.applications.api;

class MyCustomApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    id: 'my-custom-app'
  };

  // With HandlebarsApplicationMixin, templates live in PARTS
  static PARTS = {
    main: { template: 'modules/my-module/templates/app.hbs' }
  };

  // Override protected methods (safe)
  _onRender(context, options) {
    super._onRender(context, options);
    // Custom logic
  }
}
```

### ⚠️ Caution: Protected Methods

```javascript
// Only call from subclasses
class MyActorSheet extends ActorSheetV2 {
  // This is PROTECTED - only call from subclass
  _onChangeTab(tab) {
    super._onChangeTab(tab);
    // Custom tab handling
  }
}

// DO NOT do this:
const sheet = new ActorSheetV2();
sheet._onChangeTab(); // ❌ Calling protected method externally
```

### ❌ Unsafe: Private/Internal API

```javascript
// PRIVATE - Will break
actor._onUpdate(); // ❌ Underscore prefix = private
canvas._draw(); // ❌ Underscore prefix = private

// INTERNAL - Will break
game._someInternalMethod(); // ❌ @internal

// JS PRIVATE - Syntax error
actor.#privateField; // ❌ SyntaxError: Private field
```

---

## Common v13 Pitfalls

1. **Underscore Methods**: All `_method()` calls are unstable. Foundry is migrating these to true private (`#`) fields.
2. **Legacy Globals**: Some classes still exist as globals but are deprecated. Use `foundry.*` namespace.
3. **Async Assumptions**: Not all methods are async. Check documentation.
4. **Context Availability**: `canvas` is undefined outside scene contexts. Always check `canvas?.ready`.
5. **Document Types**: `ClientDocument` methods don't exist on server. Use feature detection.
6. **Collection Methods**: Some collection methods are private. Use public `get()`, `filter()`, `find()`.
7. **CONFIG Modifications**: Modifying `CONFIG` directly can break. Use `CONFIG.patch()` or hooks.

---

## API Stability Matrix


| Category     | Stability | Deprecation Notice  | Breaking Changes        |
| ------------ | --------- | ------------------- | ----------------------- |
| `@public`    | ✅ High    | Yes (when possible) | Only in specific phases |
| `@protected` | ✅ High    | Yes                 | Only in specific phases |
| `@private`   | ❌ None    | No                  | Any time                |
| `@internal`  | ❌ None    | No                  | Any time                |
| `_prefix`    | ❌ None    | No                  | Any time                |
| `#private`   | ❌ N/A     | N/A                 | N/A (inaccessible)      |


---

## Questions This File Should Answer

- How do I know if an API method is safe to use?
- What do `@public`, `@protected`, `@private`, `@internal` mean?
- What about methods that start with `_`?
- What about methods that start with `#`?
- Can I override protected methods?
- What's the difference between public and protected?
- How do I check if a method is part of the public API?
- What should I do if I need to use a private API?

---

## Source Pages Consulted

- [Foundry Virtual Tabletop - API Documentation - Version 13: Public vs Private API](https://foundryvtt.com/api/v13/index.html#public-vs-private-api)
- [Class: Hooks](https://foundryvtt.com/api/v13/classes/foundry.helpers.Hooks.html)
- [Class: ClientSettings](https://foundryvtt.com/api/v13/classes/foundry.helpers.ClientSettings.html)
- [Class: Document](https://foundryvtt.com/api/v13/classes/foundry.abstract.Document.html)
- [Class: ClientDocument](https://foundryvtt.com/api/v13/classes/foundry.ClientDocument.html)
- [Code Guidelines: Annotations](https://foundryvtt.com/api/v13/index.html#annotations)

---

*Last updated: May 2, 2026 | Foundry VTT v13.350+*

---

## FILE: 02_PF1_Actor_Documents_Data_Paths.md

# PF1 Actor Documents & Data Paths

## Purpose

Reference for Pathfinder 1e actor document classes, data models, and confirmed data paths. Covers PF1-specific actor types, methods, and safe data access patterns.

---

## Core Classes / APIs

- `**pf1.documents.ActorPF**` - Base PF1 actor document (extends Foundry `Actor`)

### Data Model Classes

| Model Class                       | Actor Type  | Purpose                     |
| --------------------------------- | ----------- | --------------------------- |
| `pf1.models.actor.CharacterModel` | `character` | Player character data model |
| `pf1.models.actor.NPCModel`       | `npc`       | NPC data model              |
| `pf1.models.actor.HauntModel`     | `haunt`     | Haunt data model            |
| `pf1.models.actor.TrapModel`      | `trap`      | Trap data model             |
| `pf1.models.actor.VehicleModel`   | `vehicle`   | Vehicle data model          |

---

## Confirmed Hooks for Actor Operations

- `pf1PrepareBaseActorData` / `pf1PrepareDerivedActorData`
- `pf1GetRollData`
- `pf1PreActorRollAbility` / `pf1ActorRollAbility`
- `pf1PreActorRollSkill` / `pf1ActorRollSkill`
- `pf1PreActorRollSave` / `pf1ActorRollSave`
- `pf1PreActorRollBab` / `pf1ActorRollBab`
- `pf1PreActorRollCl` / `pf1ActorRollCl`
- `pf1PreActorRollConcentration` / `pf1ActorRollConcentration`
- `pf1PreActorRest` / `pf1ActorRest`
- `pf1ToggleActorBuff` / `pf1ToggleActorCondition`
- `pf1ClassLevelChange`

## Actor Methods — Confirmation Status

**Confirmed methods on `ActorPF`** (verified in PF1 docs / from inherited HauntPF/etc. doc pages):

- `actor.toggleCondition(key, state)` — toggle a condition; `key` from `pf1.registry.conditions` (e.g., `'shaken'`, `'dazed'`).
- `actor.setCondition(key, state)` — set a single condition; `state` may be boolean OR an object to merge into the AE on enable.
- `actor.setConditions({ key1: state1, key2: state2 })` — batched condition updates; handles tracks; returns mapping of actual updates.
- `actor.rollSkill(skillId, options)` — confirmed; `options` includes `skipDialog`, `bonus`, `dice`, etc.
- `actor.getRollData()` — Foundry-core method (inherited from `Actor`); PF1 extends via the `pf1GetRollData(actor, rollData)` hook. Safe to call.
- `actor.statuses` — Foundry-core `Set` of active status IDs. Use `actor.statuses.has(key)` for state checks.
- `actor.expireActiveEffects(options, context)` — confirmed.
- `actor.createSpellbook(config)` — confirmed.
- `actor.displayDefenseCard(options)` — confirmed.

**Not directly indexed (use the alternatives above)**:

- `actor.hasCondition(key)` — not directly indexed in the public API page. Use `actor.statuses.has(key)` or read `actor.system.conditions[key]` instead.
- `actor.addCondition()` / `actor.removeCondition()` — do not exist as named methods. Use `setCondition(key, true|false)` or `toggleCondition(key, state)`.

---

## Safe Module Patterns

### ✅ Actor Querying

```javascript
const characters = game.actors.filter(a => a.type === 'character');
const actor = game.actors.get('actor-id');

if (actor?.type === 'character') { /* ... */ }
```

### ✅ Actor Data — Use Hooks or Confirmed Methods

> ⚠️ **PF1 actor data paths under `system.*` are NOT fully indexed in the public API docs.** Don't hardcode `system.attributes.hp.value`-style paths without verifying in PF1 source. The condition state path `actor.system.conditions` IS verified per `hooks.d.ts`.

```javascript
// Safe: receive prepared data via hook
Hooks.on('pf1PrepareBaseActorData', (actor, data) => {});
Hooks.on('pf1PrepareDerivedActorData', (actor, data) => {});

// Safe: inject custom roll data via hook
Hooks.on('pf1GetRollData', (actor, rollData) => {
  rollData.bonuses = rollData.bonuses ?? {};
  rollData.bonuses.myModuleBonus = getCustomBonus(actor);
});

// Also safe: call getRollData() directly (Foundry core; PF1 extends via hook above)
const rollData = actor.getRollData();
```

### ✅ Actor Updates

```javascript
// Always check ownership; always await
if (actor.isOwner) {
  await actor.update({ name: 'New Name' });
}

await actor.updateEmbeddedDocuments('Item', [{
  _id: 'item-id',
  'system.quantity': 5   // ⚠️ item quantity path — verify in PF1 source
}]);
```

### ✅ Model Type Checking

```javascript
if (actor.system instanceof pf1.models.actor.CharacterModel) { /* ... */ }
if (actor.system instanceof pf1.models.actor.NPCModel) { /* ... */ }
```

---

## PF1.5 Notes / House Rule Warnings

### ⚠️ Action Economy — MODULE DESIGN PATTERN

Use `combatTurn` (not `pf1CombatTurnSkip`) for per-turn resets. `pf1CombatTurnSkip` fires only on explicit skips.

```javascript
// MODULE DESIGN PATTERN
const MODULE_ID = 'my-pf1-5-module';

Hooks.on('combatTurn', (combat, updateData, updateOptions) => {
  const combatant = combat.combatant;
  if (combatant?.actor) {
    combatant.actor.unsetFlag(MODULE_ID, 'actions');
    combatant.actor.unsetFlag(MODULE_ID, 'reactions');
  }
});

Hooks.on('pf1CombatTurnSkip', (combat, combatant) => {
  if (combatant?.actor) {
    combatant.actor.unsetFlag(MODULE_ID, 'actions');
    combatant.actor.unsetFlag(MODULE_ID, 'reactions');
  }
});
```

### ⚠️ Tiered Conditions — MODULE DESIGN PATTERN

```javascript
function setTieredCondition(actor, conditionId, tier) {
  actor.setFlag(MODULE_ID, `condition.${conditionId}`, tier);
}
function getTieredCondition(actor, conditionId) {
  return actor.getFlag(MODULE_ID, `condition.${conditionId}`) || 0;
}
```

---

## Source Pages Consulted

- [Class: ActorPF](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.documents.ActorPF.html)
- [Namespace: actor models](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/pf1.models.actor.html)
- [Hook: pf1PrepareBaseActorData](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1PrepareBaseActorData.html)
- [Hook: pf1GetRollData](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1GetRollData.html)
- [Hook Events List](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/hookEvents.html)

---

*Last updated: May 2026 | Foundry VTT v13.350+ | Pathfinder 1e System*

---

## FILE: 02_PF1_Buffs_Conditions_ActiveEffects.md

# PF1 Buffs, Conditions & Active Effects

## Purpose

Reference for Pathfinder 1e's condition, buff, and ActiveEffect systems. Covers how PF1 implements conditions, buffs, and their relationship to Foundry's ActiveEffect system.

## When to Use This

- Working with PF1 conditions (blinded, deafened, etc.)
- Managing buffs and their effects
- Understanding PF1's ActiveEffect extensions
- Toggling or checking condition/buff states

---

## Core Classes / APIs

- `**pf1.documents.ActiveEffectPF**` - PF1-specific ActiveEffect document (extends `ActiveEffect`)
- `**pf1.models.item.BuffModel**` - Data model for `buff` type items
- `**pf1.registry.Condition**` - Condition registry entry class
- `**pf1.registry.Conditions**` - Condition registry singleton (`pf1.registry.conditions`)
- `**pf1.registry.StatusHudModel**` - Status HUD model for conditions

---

## Confirmed Namespaces / Classes / Hooks

### Condition Registry

```javascript
const blinded = pf1.registry.conditions.get('blinded');
// condition has: id, label (translation key), icon
```

### Confirmed Hooks

All dispatched via `Hooks.callAll` — **not cancellable**. Signatures verified against canonical `hooks.d.ts`:

- **`pf1ToggleActorBuff(actor: ActorPF, item: ItemBuffPF, state: boolean)`** — fires when a buff item's `system.active` changes. Also fires when a buff is added with `active: true`.
- **`pf1ToggleActorCondition(actor: ActorPF, condition: string, state: boolean)`** — fires when a condition is toggled. State map at **`actor.system.conditions`** (current canonical path; older docs that reference `actor.system.attributes.conditions` are stale).
- **`pf1AddDefaultChanges(actor: ActorPF, changes: ItemChange[])`** — fires when default changes are being applied; mutate `changes` in place.

### Confirmed Config Values

- `pf1.config.conditionTypes`
- `pf1.config.buffTypes`
- `pf1.config.buffTargets`
- `pf1.config.buffTargetCategories`

---

## Safe Module Patterns

### ✅ Accessing the Condition Registry

```javascript
const condition = pf1.registry.conditions.get('blinded');

if (pf1.registry.conditions.has('blinded')) { /* ... */ }

for (const [id, condition] of pf1.registry.conditions.entries()) {
  console.log(id, condition.label);
}
```

### ✅ Checking Actor Condition State

PF1's `ActorPF` exposes condition methods (verified from PF1 docs). Use these instead of the unconfirmed `hasCondition`:

- `actor.toggleCondition(key, state)` — confirmed
- `actor.setCondition(key, state)` — confirmed (state can be boolean OR an object for merge into the AE on enable)
- `actor.setConditions({ key1: state1, key2: state2 })` — confirmed (handles tracks; minimizes updates)
- `actor.statuses.has(key)` — Foundry-core Set check; works on any actor
- Direct read: `actor.system.conditions[key]` (current canonical path)

```javascript
// Best practice: use Foundry-core statuses for read, PF1 methods for write
function hasCondition(actor, key) {
  return actor.statuses.has(key);
}

async function applyBlinded(actor) {
  await actor.setCondition('blind', true);
}

async function clearMultiple(actor) {
  await actor.setConditions({ blind: false, sleep: false });
}
```

```javascript
// If you specifically want to track via hooks (e.g., for module-internal cache):
const conditionStates = new Map();
Hooks.on('pf1ToggleActorCondition', (actor, condition, state) => {
  conditionStates.set(`${actor.id}.${condition}`, state);
});
```

### ✅ Working with Buff Items

```javascript
const buffs = actor.items.filter(i => i.type === 'buff');

const buffItem = game.items.get('buff-id');
if (buffItem.system instanceof pf1.models.item.BuffModel) {
  // Buff-specific logic
}
```

### ✅ Creating ActiveEffects

> ⚠️ **ActiveEffect `changes` key paths (e.g., `system.attributes.ac.bonus`) are NOT confirmed in indexed PF1 API docs.** The key paths in the example below are unconfirmed — verify in PF1 source or test at runtime before shipping.

```javascript
// Key paths in 'changes' are UNCONFIRMED — verify in PF1 source
await actor.createEmbeddedDocuments('ActiveEffect', [{
  name: 'Custom Effect',
  changes: [
    // ⚠️ UNCONFIRMED PATH: system.attributes.ac.bonus
    { key: 'system.attributes.ac.bonus', mode: 2, value: 2 }
  ],
  duration: { rounds: 5 },
  origin: actor.uuid
}]);
```

### ✅ Hook-Based Condition Management

```javascript
Hooks.on('pf1ToggleActorCondition', (actor, condition, state) => {
  if (condition === 'blind' && state) {
    ui.notifications.info(`${actor.name} is now blinded!`);
  }
});

Hooks.on('pf1ToggleActorBuff', (actor, item, state) => {
  // 'item' is the ItemBuffPF, not just an ID
  if (state) console.log(`Buff applied: ${item.name}`);
  else      console.log(`Buff removed: ${item.name}`);
});
```

---

## Common PF1 + Foundry v13 Pitfalls

1. **Condition vs Buff vs ActiveEffect**: Conditions = registry entries; Buffs = item type; ActiveEffects = mechanical changes applied via Foundry system.
2. **Toggle vs Tiered**: PF1 conditions are flat/binary. PF1.5 tiered conditions are not natively supported.
3. **`actor.hasCondition()` may exist but isn't directly indexed**: prefer `actor.statuses.has(key)` (Foundry core) for state checks, `actor.toggleCondition`/`setCondition`/`setConditions` (PF1, confirmed) for writes.
4. **Conditions data path**: `actor.system.conditions` is the current canonical location per PF1 source. Older docs sometimes reference `actor.system.attributes.conditions` — that path is stale.
5. **ActiveEffect key paths are unconfirmed**: Verify `system.*` paths against PF1 source before using.
6. **Status HUD**: PF1 uses `StatusHudModel`. Do not assume core Foundry status icons apply.

---

## PF1.5 Notes / House Rule Warnings

### ⚠️ Tiered Conditions — MODULE DESIGN PATTERN

PF1 conditions are binary. Tiered conditions are entirely custom module territory.

```javascript
// MODULE DESIGN PATTERN — NOT NATIVE PF1 API
const TIERED_CONDITIONS = {
  fatigued:  { maxTier: 2 },
  exhausted: { maxTier: 1 }
};

function setTieredCondition(actor, conditionId, tier) {
  const max = TIERED_CONDITIONS[conditionId]?.maxTier ?? 0;
  if (tier < 0 || tier > max) throw new Error(`Invalid tier ${tier} for ${conditionId}`);
  actor.setFlag('my-pf1-5-module', `tieredCondition.${conditionId}`, tier);
}

function getTieredCondition(actor, conditionId) {
  return actor.getFlag('my-pf1-5-module', `tieredCondition.${conditionId}`) || 0;
}

function incrementTieredCondition(actor, conditionId) {
  const current = getTieredCondition(actor, conditionId);
  const max = TIERED_CONDITIONS[conditionId]?.maxTier ?? 0;
  if (current < max) { setTieredCondition(actor, conditionId, current + 1); return true; }
  return false;
}
```

### ⚠️ Toggle Conditions (PF1.5 Binary Conditions)

For binary on/off conditions compatible with native PF1, use the confirmed `actor.setCondition()` / `actor.toggleCondition()` methods, and read state via `actor.statuses.has(key)` or directly from `actor.system.conditions[key]`:

```javascript
// Native PF1 condition API — confirmed methods
const TOGGLE_CONDITIONS = ['blind', 'deaf', 'dazed', 'stunned'];

async function applyToggleCondition(actor, conditionKey, state) {
  await actor.setCondition(conditionKey, state);
}

function hasCondition(actor, conditionKey) {
  return actor.statuses.has(conditionKey);
  // OR: return !!actor.system.conditions?.[conditionKey];
}

// React to condition changes via hook (signature: actor, condition, state)
Hooks.on('pf1ToggleActorCondition', (actor, condition, state) => {
  // module-side bookkeeping if needed
});
```

### ⚠️ Buffs with Severity — MODULE DESIGN PATTERN

```javascript
// MODULE DESIGN PATTERN — store severity in flags, key paths are UNCONFIRMED
async function applyBuffWithSeverity(actor, buffItem, severity) {
  await actor.createEmbeddedDocuments('ActiveEffect', [{
    name: buffItem.name,
    changes: [
      // ⚠️ UNCONFIRMED PATH — verify before using
      { key: 'system.attributes.ac.bonus', mode: 2, value: severity }
    ],
    origin: buffItem.uuid,
    flags: { 'my-pf1-5-module': { severity } }
  }]);
}
```

---

## Source Pages Consulted

- [Class: ActiveEffectPF](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.documents.ActiveEffectPF.html)
- [Class: BuffModel](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.models.item.BuffModel.html)
- [Class: Condition](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.registry.Condition.html)
- [Class: Conditions](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.registry.Conditions.html)
- [Class: StatusHudModel](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.registry.StatusHudModel.html)
- [Hook: pf1ToggleActorBuff](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1ToggleActorBuff.html)
- [Hook: pf1ToggleActorCondition](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1ToggleActorCondition.html)
- [Hook: pf1AddDefaultChanges](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1AddDefaultChanges.html)
- [Hook Events List](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/hookEvents.html)

---

*Last updated: May 2026 | Foundry VTT v13.350+ | Pathfinder 1e System*

---

## FILE: 02_PF1_Combat_Turns_Action_Economy.md

# PF1 Combat, Turns & Action Economy

## Purpose

Reference for Pathfinder 1e combat system, turn management, and action economy as implemented in the PF1 Foundry system.

## When to Use This

- Working with PF1 combat tracking
- Modifying turn order or combat flow
- Implementing combat-related features
- Understanding PF1's combat hooks

---

## Core Classes / APIs

- `**pf1.documents.CombatPF**` - PF1 combat document (extends Foundry `Combat`)
- `**pf1.documents.CombatantPF**` - PF1 combatant document (extends Foundry `Combatant`)

---

## Confirmed Hooks

### PF1 Combat Hooks
All dispatched via `Hooks.callAll` — not cancellable. Verified against canonical `hooks.d.ts`.

- **`pf1CombatTurnSkip(combat: CombatPF, skipped: Set<CombatantPF>, context: object)`** — Fires when combatants' turns are skipped (e.g., by `combat.nextTurn()` skipping defeated/hidden combatants). `skipped` is a **Set**, not a single combatant. Iterate it.
- **`pf1ClassLevelChange(actor: ActorPF, classItem: ItemClassPF, currentLevel: number, newLevel: number)`** — Fires when a character's class level changes (4 args, not 3).

### Core Foundry Combat Hooks (v13 Names)

| Hook               | Arguments                             | When                              |
| ------------------ | ------------------------------------- | --------------------------------- |
| `combatStart`      | `(combat, updateData)`                | Combat begins                     |
| `combatRound`      | `(combat, updateData, updateOptions)` | Round advances (v13 name)         |
| `combatTurn`       | `(combat, updateData, updateOptions)` | Active turn advances (every turn) |
| `combatTurnChange` | `(combat, prior, current)`            | Active combatant changes          |

> ⚠️ **`combatRoundChange` is not a v13 hook.** Use `combatRound`.
> ⚠️ **`pf1CombatTurnSkip` is NOT a turn-start hook.** Use `combatTurn` for per-turn resets.

---

## Safe Module Patterns

### ✅ Per-Turn Reset (Primary Pattern)

```javascript
// CORRECT: fires every time the active turn advances
Hooks.on('combatTurn', (combat, updateData, updateOptions) => {
  const combatant = combat.combatant;
  if (combatant?.actor) {
    combatant.actor.unsetFlag('my-pf1-5-module', 'actions');
    combatant.actor.unsetFlag('my-pf1-5-module', 'reactions');
  }
});

// Handle skip edge case separately. NOTE: skipped is a Set<CombatantPF>, iterate it.
Hooks.on('pf1CombatTurnSkip', (combat, skipped, context) => {
  for (const combatant of skipped) {
    if (combatant?.actor) {
      combatant.actor.unsetFlag('my-pf1-5-module', 'actions');
      combatant.actor.unsetFlag('my-pf1-5-module', 'reactions');
    }
  }
});
```

### ✅ Combat Lifecycle

```javascript
Hooks.on('combatStart', (combat, updateData) => {
  if (combat.constructor.name !== 'CombatPF') return;
  for (const combatant of combat.combatants) {
    combatant.actor?.unsetFlag('my-pf1-5-module', 'actions');
    combatant.actor?.unsetFlag('my-pf1-5-module', 'reactions');
  }
});

Hooks.on('combatRound', (combat, updateData, updateOptions) => {
  // Round advanced — use combatRound, not combatRoundChange
});
```

### ✅ PF1.5 Action Economy — MODULE DESIGN PATTERN

**Not native PF1 API. Implement entirely via flags.**

```javascript
// MODULE DESIGN PATTERN
const MODULE_ID = 'my-pf1-5-module';

function spendAction(actor, cost = 1) {
  const current = actor.getFlag(MODULE_ID, 'actions') || 0;
  if (current + cost > 3) {
    ui.notifications.warn(`Not enough actions!`);
    return false;
  }
  actor.setFlag(MODULE_ID, 'actions', current + cost);
  return true;
}

function getRemainingActions(actor) {
  return 3 - (actor.getFlag(MODULE_ID, 'actions') || 0);
}

function spendReaction(actor) {
  if (actor.getFlag(MODULE_ID, 'reactions') || 0) {
    ui.notifications.warn(`No reactions remaining!`);
    return false;
  }
  actor.setFlag(MODULE_ID, 'reactions', 1);
  return true;
}
```

---

## Source Pages Consulted

- [Class: CombatPF](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.documents.CombatPF.html)
- [Class: CombatantPF](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.documents.CombatantPF.html)
- [Hook: pf1CombatTurnSkip](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1CombatTurnSkip.html)
- [Module: hookEvents v13](https://foundryvtt.com/api/v13/modules/hookEvents.html)
- [Hook Events List (PF1)](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/hookEvents.html)

---

*Last updated: May 2026 | Foundry VTT v13.350+ | Pathfinder 1e System*

---

## FILE: 02_PF1_Hooks_Lifecycle_Extension_Points.md

# PF1 Hooks, Lifecycle & Extension Points

## Purpose

Reference for Pathfinder 1e's hook system, lifecycle extension points, and data preparation pipeline. Covers PF1-specific hooks that extend or replace Foundry's core lifecycle, and safe patterns for hooking into PF1 internals.

## When to Use This

- Understanding when PF1 is ready for use vs when Foundry is ready
- Finding the right PF1 hook for your module
- Extending PF1 data preparation
- Safely hooking into PF1's initialization and data pipeline

---

## Core Concept: Two Lifecycles

Your module operates across two overlapping lifecycles. Foundry's core lifecycle fires first; PF1 hooks fire after PF1 has bootstrapped inside those same windows.

```
Foundry:   init → i18nInit → setup → ready
PF1:              pf1PostInit        pf1PostSetup   pf1PostReady
```

**Use PF1 lifecycle hooks (`pf1Post*`) rather than core hooks** whenever you need PF1's config, registries, or document extensions to be available.

---

## Confirmed PF1 Lifecycle Hooks

### Initialization Hooks

| Hook           | Fires After         | Safe to Access                          |
| -------------- | ------------------- | --------------------------------------- |
| `pf1PostInit`  | PF1 init complete   | `pf1.config`, `pf1.const`, class registrations |
| `pf1PostSetup` | PF1 setup complete  | `pf1.registry.*`, PF1 registries        |
| `pf1PostReady` | PF1 ready complete  | All PF1 documents, actors, items, world |

```javascript
// Prefer pf1PostInit over init for PF1-aware registration
Hooks.once('pf1PostInit', () => {
  // pf1.config is available here
  // pf1.registry.* may not be populated yet — use pf1PostSetup for that
  game.settings.register('my-module', 'some-setting', { ... });
});

Hooks.once('pf1PostSetup', () => {
  // Safe to read pf1.registry.conditions, pf1.registry.damageTypes, etc.
  const blinded = pf1.registry.conditions.get('blinded');
});

Hooks.once('pf1PostReady', () => {
  // Safe to access game.actors, world documents, PF1 actor/item data
  const characters = game.actors.filter(a => a.type === 'character');
});
```

### Registry Hook

```javascript
// pf1RegisterRegistry — fires when PF1 registers its registries
Hooks.on('pf1RegisterRegistry', (registryName, registry) => {
  // registryName: string ('conditions', 'damageTypes', etc.)
  // registry: the Registry instance being registered
  // Use this to register custom entries if the registry supports it
  // ⚠️ Custom entry registration: NOT confirmed for all registries
});
```

---

## Confirmed PF1 Data Preparation Hooks

These hooks fire during document preparation and are safe to use for injecting custom data.

### Actor Data Preparation

| Hook                         | Arguments          | Purpose                                  |
| ---------------------------- | ------------------ | ---------------------------------------- |
| `pf1PrepareBaseActorData`    | `(actor, data)`    | Base data prepared; before derivations   |
| `pf1PrepareDerivedActorData` | `(actor, data)`    | Derived data prepared; final stats ready |
| `pf1GetRollData`             | `(actor, rollData)`| Roll data gathered; inject custom bonuses here |

```javascript
// Inject custom roll bonuses
Hooks.on('pf1GetRollData', (actor, rollData) => {
  rollData.bonuses = rollData.bonuses ?? {};
  rollData.bonuses.myModuleBonus = getCustomBonus(actor);
});

// Read derived stats after PF1 has prepared them
Hooks.on('pf1PrepareDerivedActorData', (actor, data) => {
  // Use data here; do not cache — it is rebuilt each preparation pass
});
```

### Item Data Preparation

| Hook                        | Arguments        | Purpose                       |
| --------------------------- | ---------------- | ----------------------------- |
| `pf1PrepareBaseItemData`    | `(item, data)`   | Base item data prepared       |
| `pf1PrepareDerivedItemData` | `(item, data)`   | Derived item data prepared    |

```javascript
Hooks.on('pf1PrepareBaseItemData', (item, data) => {
  // Runs during item.prepareBaseData()
  // Modify base item data before derivations
});

Hooks.on('pf1PrepareDerivedItemData', (item, data) => {
  // Runs during item.prepareDerivedData()
  // Derived stats are available here
});
```

### Buff & Condition Hooks

All dispatched via `Hooks.callAll` — **not cancellable**. Signatures verified against canonical `hooks.d.ts` source.

| Hook                    | Arguments                         | Purpose                        |
| ----------------------- | --------------------------------- | ------------------------------ |
| `pf1ToggleActorBuff`    | `(actor: ActorPF, item: ItemBuffPF, state: boolean)` | Buff's `system.active` changed; also fires when buff is added with `active: true` |
| `pf1ToggleActorCondition` | `(actor: ActorPF, condition: string, state: boolean)` | Condition toggled; state map at **`actor.system.conditions`**; `condition` is a key from `pf1.config.conditionTypes` / `pf1.registry.conditions` |
| `pf1AddDefaultChanges`  | `(actor: ActorPF, changes: ItemChange[])` | Default changes being applied; mutate `changes` in place |

```javascript
// Track condition state via hook (state arg is boolean)
Hooks.on('pf1ToggleActorCondition', (actor, condition, state) => {
  actor.setFlag('my-module', `condition.${condition}`, state);
});

// Add a custom default change during data prep
Hooks.on('pf1AddDefaultChanges', (actor, changes) => {
  changes.push(new pf1.components.ItemChange({
    subTarget: 'str',
    formula: '2'
  }));
});
```

---

## Confirmed Actor Roll Hooks

All actor roll hooks come in `Pre`/`Post` pairs. Pre-hooks receive a config object; modify it there.

| Pre-Hook                         | Post-Hook                       |
| -------------------------------- | ------------------------------- |
| `pf1PreActorRollAbility`         | `pf1ActorRollAbility`           |
| `pf1PreActorRollSkill`           | `pf1ActorRollSkill`             |
| `pf1PreActorRollSave`            | `pf1ActorRollSave`              |
| `pf1PreActorRollBab`             | `pf1ActorRollBab`               |
| `pf1PreActorRollCl`              | `pf1ActorRollCl`                |
| `pf1PreActorRollConcentration`   | `pf1ActorRollConcentration`     |

```javascript
// Modify a skill roll before it fires
Hooks.on('pf1PreActorRollSkill', (actor, rollConfig, skill) => {
  const bonus = getCustomSkillBonus(actor, skill);
  if (bonus) rollConfig.parts.push(String(bonus));
});
```

> ⚠️ **Pre-hook cancellation**: For PF1 hooks, cancellability is documented per-hook in the source. Confirmed cancellable: `pf1PreActionUse`, `pf1PreDisplayActionUse`, `pf1DisplayCard`, `pf1DropContainerSheetData`. Confirmed NOT cancellable (use `Hooks.callAll`): `pf1ToggleActorBuff`, `pf1ToggleActorCondition`, `pf1ClassLevelChange`, `pf1CreateItemLink`, `pf1DeleteItemLink`, `pf1CombatTurnSkip`, `pf1AddDefaultChanges`, all `pf1Post*` hooks. For roll hooks, verify per-hook in the canonical `hooks.d.ts` (`Hooks.call` = cancellable, `Hooks.callAll` = not).

---

## Confirmed Action Hooks

Signatures verified against canonical `hooks.d.ts`. Note these all take a single `ActionUse` instance — NOT `(actor, item, options)` as older docs sometimes imply.

| Hook                    | Arguments                                            | Cancellable?  |
| ----------------------- | ---------------------------------------------------- | ------------- |
| `pf1PreActionUse`       | `(actionUse: ActionUse) => boolean`                  | YES (`Hooks.call`) |
| `pf1CreateActionUse`    | `(actionUse: ActionUse)`                             | No (`Hooks.callAll`) |
| `pf1PreDisplayActionUse`| `(actionUse: ActionUse) => boolean`                  | YES (`Hooks.call`) |
| `pf1PostActionUse`      | `(actionUse: ActionUse, chatMessage: ChatMessage \| null)` | No (`Hooks.callAll`) |

```javascript
// Cancel an action use before it fires
Hooks.on('pf1PreActionUse', (actionUse) => {
  const cost = getActionCost(actionUse.item);
  if (!spendAction(actionUse.actor, cost)) return false;
});

Hooks.on('pf1PostActionUse', (actionUse, chatMessage) => {
  logActionUse(actionUse.actor, actionUse.item, chatMessage);
});
```

---

## Confirmed Rest Hooks

| Hook              | Arguments                   |
| ----------------- | --------------------------- |
| `pf1PreActorRest` | `(actor, options)`          |
| `pf1ActorRest`    | `(actor, options, result)`  |
| `pf1PrePartyRest` | `(actors, options)`         |
| `pf1PartyRest`    | `(actors, options, results)`|

---

## Confirmed Miscellaneous Hooks

All dispatched via `Hooks.callAll` — not cancellable. Signatures verified against canonical `hooks.d.ts`.

| Hook                  | Arguments                                                    | Purpose                            |
| --------------------- | ------------------------------------------------------------ | ---------------------------------- |
| `pf1ClassLevelChange` | `(actor: ActorPF, classItem: ItemClassPF, currentLevel: number, newLevel: number)` | Character class level changed (note: 4 args, not 3) |
| `pf1RegisterRegistry` | `(registryName, registry)`                                   | PF1 registries being registered    |
| `pf1CombatTurnSkip`   | `(combat: CombatPF, skipped: Set<CombatantPF>, context: object)` | Turns skipped in combat (`skipped` is a **Set**, iterate with for...of) |
| `pf1CreateItemLink`   | `(item: ItemPF, link: ItemLink, kind: "children"\|"charges"\|"classAssociations"\|"ammunition")` | Item link created (fires AFTER) |
| `pf1DeleteItemLink`   | `(item: ItemPF, link: ItemLink, kind: "children"\|"charges"\|"classAssociations"\|"ammunition")` | Item link deleted (fires AFTER) |

---

## Safe Module Patterns

### ✅ Full PF1-Aware Module Init

```javascript
// Register settings in Foundry init (safe, no PF1 dependency)
Hooks.once('init', () => {
  game.settings.register('my-module', 'enable', {
    scope: 'world', type: Boolean, default: true, config: true
  });
});

// Access PF1 config in pf1PostInit
Hooks.once('pf1PostInit', () => {
  // pf1.config, pf1.const available
});

// Access PF1 registries in pf1PostSetup
Hooks.once('pf1PostSetup', () => {
  const conditions = [...pf1.registry.conditions.keys()];
  console.log('Available conditions:', conditions);
});

// Access world data in pf1PostReady
Hooks.once('pf1PostReady', () => {
  for (const actor of game.actors) {
    if (actor.type === 'character') initializeActorFlags(actor);
  }
});
```

### ✅ Safely Extending PF1 Data

```javascript
// Always use hooks rather than patching PF1 internals directly
// Never modify pf1.config — it is read-only at runtime
// Never patch ActorPF.prototype or ItemPF.prototype

// CORRECT: extend via hooks
Hooks.on('pf1PrepareDerivedActorData', (actor, data) => {
  // Add custom computed value
  data.myModuleValue = computeCustomValue(actor);
});

// WRONG: prototype patching
// ActorPF.prototype.myMethod = function() {}; // ❌ Breaks on updates
```

---

## Common Pitfalls

1. **Registry timing**: `pf1.registry.*` is not populated during `init`. Use `pf1PostSetup` or later.
2. **`pf1PostInit` vs `init`**: Both run in the same Foundry init window but PF1 has not bootstrapped at raw `init` time. Use `pf1PostInit` for PF1-aware code.
3. **Data preparation is stateless**: `pf1PrepareBaseActorData` data is rebuilt on every prepare call. Don't cache it.
4. **Hook cancellation**: Foundry hooks are never awaited; async handlers cannot cancel pre-hooks. Use synchronous handlers when you need to `return false`. (For PF1 specifically, the longer block above enumerates which hooks are cancellable per `hooks.d.ts`.)
5. **`pf1config` is read-only**: Do not mutate `pf1.config`. Use module settings or flags for custom config.
6. **`pf1CombatTurnSkip` ≠ turn start**: It fires only on explicit skips. Use core `combatTurn` for per-turn resets.

---

## PF1.5 Notes / House Rule Warnings

### ⚠️ PF1 Lifecycle Has No PF1.5 Awareness

PF1's data preparation hooks (`pf1PrepareBaseActorData`, `pf1PrepareDerivedActorData`) operate on standard PF1 data. PF1.5 overrides (3-action economy, tiered conditions) are not reflected — implement them in your module's hook handlers.

```javascript
// MODULE DESIGN PATTERN — inject PF1.5 data during preparation
Hooks.on('pf1PrepareDerivedActorData', (actor, data) => {
  // Don't read from data.system.actions — that field doesn't exist
  // Read from module flags instead
  data.pf15 = {
    actionsRemaining: 3 - (actor.getFlag('my-module', 'actions') || 0),
    reactionsRemaining: 1 - (actor.getFlag('my-module', 'reactions') || 0)
  };
});
```

---

## Source Pages Consulted

- [Hook: pf1PostInit](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1PostInit.html)
- [Hook: pf1PostSetup](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1PostSetup.html)
- [Hook: pf1PostReady](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1PostReady.html)
- [Hook: pf1PrepareBaseActorData](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1PrepareBaseActorData.html)
- [Hook: pf1PrepareDerivedActorData](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1PrepareDerivedActorData.html)
- [Hook: pf1PrepareBaseItemData](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1PrepareBaseItemData.html)
- [Hook: pf1PrepareDerivedItemData](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1PrepareDerivedItemData.html)
- [Hook: pf1GetRollData](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1GetRollData.html)
- [Hook: pf1RegisterRegistry](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/types/hookEvents.pf1RegisterRegistry.html)
- [Hook: pf1CombatTurnSkip](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1CombatTurnSkip.html)
- [Hook Events List](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/hookEvents.html)

---

*Last updated: May 2026 | Foundry VTT v13.350+ | Pathfinder 1e System*

---

## FILE: 02_PF1_Item_Documents_Data_Paths.md

# PF1 Item Documents & Data Paths

## Purpose

Reference for Pathfinder 1e item document classes, item types, data models, and safe data access patterns. Covers PF1-specific item types, the action (ItemAction) system, and item-related hooks.

## When to Use This

- Working with PF1 items (weapons, spells, feats, buffs, etc.)
- Accessing item system data safely
- Hooking into item data preparation
- Understanding PF1's action/item relationship

---

## Core Classes / APIs

- `**pf1.documents.ItemPF**` - Base PF1 item document (extends Foundry `Item`)

### Item Data Model Classes

| Model Class                         | Item Type     | Purpose                     |
| ----------------------------------- | ------------- | --------------------------- |
| `pf1.models.item.WeaponModel`       | `weapon`      | Weapon data model           |
| `pf1.models.item.EquipmentModel`    | `equipment`   | Armor/equipment data model  |
| `pf1.models.item.ConsumableModel`   | `consumable`  | Consumable data model       |
| `pf1.models.item.LootModel`         | `loot`        | Loot/treasure data model    |
| `pf1.models.item.SpellModel`        | `spell`       | Spell data model            |
| `pf1.models.item.FeatModel`         | `feat`        | Feat data model             |
| `pf1.models.item.BuffModel`         | `buff`        | Buff/condition data model   |
| `pf1.models.item.AttackModel`       | `attack`      | Attack data model           |
| `pf1.models.item.RaceModel`         | `race`        | Race data model             |
| `pf1.models.item.ClassModel`        | `class`       | Class data model            |
| `pf1.models.item.ContainerModel`    | `container`   | Container data model        |

> ⚠️ **Model class list**: Confirmed by namespace existence in PF1 docs. Individual model properties are **not confirmed in indexed API docs** — verify field names in PF1 source before accessing.

---

## Item Actions (ItemAction)

In PF1, many item types (weapons, spells, feats, attacks) contain **actions** (`ItemAction`) which define the actual use of the item (damage dice, action type, range, etc.). An item can have multiple actions.

> ⚠️ **`ItemAction` class and its specific methods/properties are NOT fully confirmed in indexed PF1 API docs.** The concept is documented; specific field names are not. Verify in PF1 source.

```javascript
// Items may have embedded actions (unconfirmed structure)
const weapon = actor.items.find(i => i.type === 'weapon');
// weapon.system.actions — existence UNCONFIRMED; verify in PF1 source
```

---

## Confirmed Hooks

### Item Data Preparation Hooks

| Hook                        | Arguments        | Purpose                    |
| --------------------------- | ---------------- | -------------------------- |
| `pf1PrepareBaseItemData`    | `(item, data)`   | Base item data prepared    |
| `pf1PrepareDerivedItemData` | `(item, data)`   | Derived item data prepared |

### Action Hooks

Verified against canonical `hooks.d.ts`. All take a single `ActionUse` instance — NOT `(actor, item, options)`. `pf1DisplayCard` takes `(item, data)` where `data` is a structured object.

| Hook                     | Arguments                                            | Cancellable? |
| ------------------------ | ---------------------------------------------------- | ------------ |
| `pf1PreActionUse`        | `(actionUse: ActionUse) => boolean`                  | YES (`Hooks.call`) |
| `pf1PostActionUse`       | `(actionUse: ActionUse, chatMessage: ChatMessage \| null)` | No (`Hooks.callAll`) |
| `pf1CreateActionUse`     | `(actionUse: ActionUse)`                             | No (`Hooks.callAll`) |
| `pf1PreDisplayActionUse` | `(actionUse: ActionUse) => boolean`                  | YES (`Hooks.call`) |
| `pf1DisplayCard`         | `(item: ItemPF, data: { template: string; templateData: object; chatData: object }) => boolean` | YES (`Hooks.call`) — passes a structured data object, NOT jQuery |

### Roll Hooks Related to Items

| Hook                | Arguments               |
| ------------------- | ----------------------- |
| `pf1PreAttackRoll`  | `(attackData, rollConfig)` |
| `pf1AttackRoll`     | `(attackData, roll)`    |
| `pf1PreDamageRoll`  | `(damageData, rollConfig)` |
| `pf1DamageRoll`     | `(damageData, roll)`    |

---

## Safe Module Patterns

### ✅ Querying Items by Type

```javascript
// Items on an actor
const weapons = actor.items.filter(i => i.type === 'weapon');
const spells  = actor.items.filter(i => i.type === 'spell');
const feats   = actor.items.filter(i => i.type === 'feat');
const buffs   = actor.items.filter(i => i.type === 'buff');

// World items
const allWeapons = game.items.filter(i => i.type === 'weapon');

// Single item by ID
const item = actor.items.get('item-id');
```

### ✅ Checking Item Type via Model

```javascript
if (item.system instanceof pf1.models.item.WeaponModel) {
  // Weapon-specific logic
}

if (item.system instanceof pf1.models.item.BuffModel) {
  // Buff-specific logic
}

if (item.system instanceof pf1.models.item.SpellModel) {
  // Spell-specific logic
}
```

### ✅ Safe Item Data Access

> ⚠️ **PF1 item data paths (`item.system.*`) are NOT confirmed in indexed PF1 API docs.** Do not hardcode paths without verifying in PF1 source or testing at runtime.

```javascript
// UNSAFE — paths not confirmed:
// const qty = item.system.quantity;   // ⚠️ UNCONFIRMED
// const dmg = item.system.damage.parts[0]; // ⚠️ UNCONFIRMED

// SAFER — check existence before accessing:
function safeGetItemField(item, path) {
  return foundry.utils.getProperty(item.system, path);
}

// SAFEST — use hooks to receive prepared data
Hooks.on('pf1PrepareDerivedItemData', (item, data) => {
  // Read prepared data here rather than accessing system paths directly
});
```

### ✅ Item Creation and Update

```javascript
// Create item on actor
await actor.createEmbeddedDocuments('Item', [{
  name: 'Custom Feat',
  type: 'feat',
  // system: {} — field paths UNCONFIRMED, verify before populating
}]);

// Update item
const item = actor.items.get('item-id');
if (item) {
  await item.update({
    name: 'New Name'
    // Do not include system.* paths without verifying them
  });
}
```

### ✅ Item Preparation Hooks

```javascript
Hooks.on('pf1PrepareBaseItemData', (item, data) => {
  // Fires during item.prepareBaseData()
  // Inject module-specific base data before derivations
});

Hooks.on('pf1PrepareDerivedItemData', (item, data) => {
  // Fires during item.prepareDerivedData()
  // Read derived stats or inject final computed values
  if (item.type === 'weapon') {
    const customBonus = getCustomWeaponBonus(item);
    // Store in a module-safe location, not in data.system.*
    item.setFlag('my-module', 'computedBonus', customBonus);
  }
});
```

### ✅ Intercepting Action Use

`pf1PreActionUse` IS cancellable per `hooks.d.ts` (`Hooks.call`, returns `boolean`). Single arg is the `ActionUse` instance — access `.actor`, `.item`, etc. on it.

```javascript
// Before an action on an item is used
Hooks.on('pf1PreActionUse', (actionUse) => {
  // MODULE DESIGN PATTERN: check PF1.5 action economy
  const cost = getActionCost(actionUse.item);
  if (!spendAction(actionUse.actor, cost)) {
    ui.notifications.warn('Not enough actions!');
    return false; // confirmed cancellable
  }
});

// After an action is used
Hooks.on('pf1PostActionUse', (actionUse, chatMessage) => {
  // chatMessage may be null if no message was created
  logActionUse(actionUse.actor, actionUse.item, chatMessage);
});
```

### ✅ Chat Card Hook

Signature: `pf1DisplayCard(item: ItemPF, data: { template, templateData, chatData }) => boolean`. Passes a STRUCTURED DATA OBJECT, not jQuery and not an HTMLElement. Cancellable. Use it to suppress display or to mutate `chatData` (e.g., add flags) BEFORE the chat message is created.

```javascript
// Tag the eventual chat message via flags
Hooks.on('pf1DisplayCard', (item, data) => {
  data.chatData.flags = data.chatData.flags ?? {};
  data.chatData.flags['my-module'] = { tagged: true };
});
```

To modify the rendered chat HTML AFTER the message is in chat, use the core `renderChatMessageHTML` hook and read your flags:

```javascript
Hooks.on('renderChatMessageHTML', (message, element, data) => {
  if (!message.flags?.['my-module']?.tagged) return;
  const span = document.createElement('span');
  span.className = 'my-module-tag';
  span.textContent = ' [Custom]';
  element.querySelector('.message-header')?.appendChild(span);
});
```

---

## Common Pitfalls

1. **Item data paths unconfirmed**: `item.system.*` field names differ by item type. Verify in PF1 source before use.
2. **Actions are nested**: PF1 items can have multiple embedded actions. Don't assume a weapon has exactly one attack.
3. **Buff vs ActiveEffect**: A `buff` type item defines the source; `ActiveEffect` documents apply the mechanical changes. They are separate.
4. **Item type names are lowercase strings**: `'weapon'`, `'feat'`, `'buff'` — not `'Weapon'` or `ItemTypes.WEAPON`.
5. **`pf1DisplayCard` does NOT pass jQuery** — it passes `(item, data)` where `data` is `{ template, templateData, chatData }`. Modify `data.chatData.flags` before the message is created; use `renderChatMessageHTML` to mutate the rendered DOM.
6. **Action-use hooks take a single `ActionUse`**, not `(actor, item, options)`. `pf1PreActionUse` and `pf1PreDisplayActionUse` are confirmed cancellable.
7. **World items vs actor items**: `game.items` = world; `actor.items` = embedded on actor. An actor item is a different document from the world item it may have been created from.

---

## PF1.5 Notes / House Rule Warnings

### ⚠️ Action Costs per Item Type — MODULE DESIGN PATTERN

PF1 items don't natively carry a PF1.5 action cost. Implement this in your module:

```javascript
// MODULE DESIGN PATTERN — define action costs per item type/tag
function getActionCost(item) {
  // Assign costs based on item type or custom flags
  const customCost = item.getFlag('my-module', 'actionCost');
  if (customCost !== undefined) return customCost;

  const defaults = {
    weapon:     1,
    spell:      1, // may vary by spell
    feat:       1,
    consumable: 1,
    attack:     1
  };
  return defaults[item.type] ?? 1;
}
```

### ⚠️ Spell Action Cost Variance — MODULE DESIGN PATTERN

In PF1.5, some spells cost different numbers of actions. Track this via item flags:

```javascript
// MODULE DESIGN PATTERN — per-spell action cost override
Hooks.on('pf1PreActionUse', (actionUse) => {
  if (actionUse.item.type !== 'spell') return;
  const cost = actionUse.item.getFlag('my-module', 'spellActionCost') ?? 1;
  if (!spendAction(actionUse.actor, cost)) return false;
});
```

---

## Source Pages Consulted

- [Class: ItemPF](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.documents.ItemPF.html)
- [Namespace: item models](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/pf1.models.item.html)
- [Class: WeaponModel](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.models.item.WeaponModel.html)
- [Class: SpellModel](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.models.item.SpellModel.html)
- [Class: FeatModel](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.models.item.FeatModel.html)
- [Class: BuffModel](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.models.item.BuffModel.html)
- [Hook: pf1PrepareBaseItemData](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1PrepareBaseItemData.html)
- [Hook: pf1PrepareDerivedItemData](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1PrepareDerivedItemData.html)
- [Hook: pf1PreActionUse](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1PreActionUse.html)
- [Hook: pf1PostActionUse](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1PostActionUse.html)
- [Hook: pf1DisplayCard](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1DisplayCard.html)
- [Hook Events List](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/hookEvents.html)

---

*Last updated: May 2026 | Foundry VTT v13.350+ | Pathfinder 1e System*

---

## FILE: 02_PF1_Module_Review_Checklist.md

# PF1 Module Review Checklist

## Purpose

PF1-specific pre-deployment checklist for Foundry VTT v13 modules. Use this to verify your module follows PF1 best practices, uses safe APIs, and handles PF1.5 house rules correctly.

## When to Use This

- Before publishing a PF1 module
- During code review of PF1-specific code
- When debugging PF1 module issues
- When updating a module for PF1 compatibility

---

## PF1-Specific Checks

### ✅ PF1 Data Paths

- All PF1 data paths are confirmed in the indexed API docs
- No assumed data paths from other systems (D&D5e, PF2e)
- Data paths use PF1-specific structure
- Actor data accesses use `ActorPF` or model classes
- Item data accesses use `ItemPF` or model classes
- Combat data accesses use `CombatPF` or `CombatantPF`

### ✅ PF1 Classes & Methods

- Only confirmed PF1 classes are used (`pf1.documents.*`, `pf1.models.*`, etc.)
- No assumptions about base Foundry classes having PF1 methods
- Model type checks use `instanceof` with confirmed model classes
- Document type checks use confirmed type strings

### ✅ PF1 Hooks

- Only confirmed PF1 hooks are used
- Hook arguments match documented signatures
- Cancellable hooks use `return false` appropriately
- Hook callbacks have error handling
- Hooks are removed on module disable

### ✅ PF1 Registries

- Registry access uses confirmed registry names
- Registry entries use confirmed IDs
- No mutations of read-only registries
- Registry access is guarded for timing (after `pf1PostInit`)

### ✅ PF1 Applications

- PF1 applications are used correctly
- No patching of PF1 application prototypes
- Custom UI extends Foundry `ApplicationV2` where appropriate
- CSS is properly scoped with module ID

---

## PF1.5 House Rule Compatibility

### ⚠️ Action Economy

- PF1.5 action tracking (3 actions + 1 reaction) is implemented in module code
- Action costs are tracked separately from PF1 native systems
- Actions are reset on turn start via core `combatTurn` hook (NOT `pf1CombatTurnSkip` — that hook fires only when turns are skipped, with signature `(combat, skipped: Set<CombatantPF>, context)`)
- Actions are reset on combat start
- Action spending is checked before allowing actions
- Reaction tracking is separate from action tracking
- Action UI displays remaining actions/reactions

### ⚠️ Tiered Conditions

- PF1.5 tiered conditions are tracked separately from PF1 flat conditions
- Tiered condition severity is stored (flags or custom data)
- Tiered condition penalties are applied in roll hooks
- Tiered condition UI displays severity levels
- Toggle conditions use PF1 native system where compatible

### ⚠️ No PF1 Native Assumptions

- Code does not assume PF1 natively supports PF1.5 rules
- PF1.5 features are implemented in module, not expected from system
- Fallbacks exist for when PF1.5 is disabled
- Module settings allow enabling/disabling PF1.5 features

---

## API Safety

### ✅ Public API Usage

- Only `@public` PF1 APIs are used
- No `_` prefixed methods called
- No `#` private fields accessed
- No `@private` or `@internal` methods used
- No core Foundry prototype modifications
- No PF1 prototype modifications

### ✅ Config & Registry Usage

- `pf1.config` is only read, never mutated
- Registries are accessed safely (existence checks)
- Registry mutations use documented methods only
- Config values are not assumed to be plain strings (may be translation keys)

---

## Data Access

### ✅ Safe Data Patterns

- Actor queries use `game.actors` or actor collections
- Item queries use `game.items` or item collections
- Embedded documents use proper parent references
- Data updates use `update()` or `updateEmbeddedDocuments()`
- Data creation uses `create()` or `createEmbeddedDocuments()`

### ✅ Ownership & Permissions

- Actor/item access checks `isOwner` where appropriate
- GM-only features check `game.user.isGM`
- Multiplayer-safe operations used
- No assumptions about client/server context

---

## Combat Safety

### ✅ Combat Operations

- Combat access uses `game.combats.active`
- Combatant access uses combat collections
- Initiative modifications use proper methods
- Combat hooks use confirmed PF1 combat hooks
- Turn tracking respects combat state

### ✅ Roll Safety

- Roll hooks use confirmed PF1 roll hooks
- Roll modifications use `rollConfig` in pre-hooks
- Roll data uses `pf1GetRollData` hook where appropriate
- Dice rolls use PF1 dice classes (`D20RollPF`, etc.)

---

## UI/UX

### ✅ PF1 UI Integration

- PF1 sheets are extended via hooks, not patched
- Custom UI uses Foundry `ApplicationV2` patterns
- UI is responsive and readable
- High contrast colors used
- Touch-friendly controls for tablet users

### ✅ CSS Scoping

- All CSS selectors prefixed with module ID
- No style conflicts with PF1 core
- No style conflicts with other popular modules
- CSS files are ES modules where appropriate

### ✅ Visual Style (Croaker's Ledger)

- Muddy parchment background colors considered
- Scuffed leather texture patterns considered
- Iron-gall ink dark colors used
- Tarnished brass accent colors used
- Dried blood red accents used sparingly
- High contrast maintained for readability
- Fast tactical use prioritized

---

## Settings & Flags

### ✅ Module Settings

- Settings registered via `game.settings.register`
- Setting names are descriptive and namespaced
- Setting hints explain purpose
- Default values are sensible
- Setting types are appropriate
- Config flag set to `true` for user-configurable settings

### ✅ Flag Usage

- Flags use module ID namespace
- Flags are documented
- Flags are cleaned up when no longer needed
- Flag schema is defined for complex data

---

## Error Handling

### ✅ Robust Error Handling

- All async operations have try/catch
- Hook callbacks have error handling
- Network errors are handled
- Permission errors are handled
- User-friendly error messages
- Errors don't crash the game
- Errors are logged appropriately

---

## Testing

### ✅ PF1 Testing

- Tested with PF1 system active
- Tested with multiple PF1 actor types
- Tested with multiple PF1 item types
- Tested combat functionality
- Tested roll functionality
- Tested in multiplayer
- No console errors
- No console warnings (except known)

### ✅ PF1.5 Testing

- PF1.5 features tested with module settings enabled
- PF1.5 features tested with module settings disabled
- Action economy tested (3 actions + 1 reaction)
- Tiered conditions tested
- Toggle conditions tested
- Fallback to PF1 behavior tested

---

## Documentation

### ✅ Module Documentation

- README.md explains module purpose
- PF1 compatibility noted
- PF1.5 compatibility noted
- Installation instructions included
- Usage instructions included
- Configuration options documented
- Known issues listed
- Changelog maintained

### ✅ Code Documentation

- Complex logic is well-commented
- PF1-specific code is documented
- PF1.5-specific code is clearly marked
- Hook usage is documented

---

## Common Issues to Catch

1. **Unconfirmed Data Paths**: Using data paths not confirmed in PF1 API docs
2. **Assumed Methods**: Calling methods not confirmed on PF1 classes
3. **PF1.5 Native Support**: Assuming PF1 natively supports PF1.5 rules
4. **Config Mutation**: Mutating `pf1.config` directly
5. **Registry Assumptions**: Assuming registry entries exist without checking
6. **Hook Signature Mismatch**: Using wrong arguments for hooks
7. **Async Without Await**: Missing `await` on async operations
8. **Error Swallowing**: Empty catch blocks that hide errors
9. **CSS Conflicts**: Unscoped CSS that affects PF1 or other modules
10. **Prototype Patching**: Modifying PF1 or Foundry prototypes

---

## Pre-Publish Verification

### Manual Testing Checklist

- Module loads without errors in PF1 world
- All features work with PF1 actors
- All features work with PF1 items
- Combat features work correctly
- Roll modifications work
- PF1.5 features work when enabled
- PF1.5 features don't break PF1 when disabled
- Settings UI works correctly
- Module survives Foundry restart
- Module survives scene changes
- Module survives world changes
- Multiplayer functionality works
- GM and player views both work correctly

### Code Review Checklist

- All code follows PF1 best practices
- Only confirmed PF1 APIs used
- No unconfirmed data paths
- No unconfirmed methods
- PF1.5 code is clearly separated
- Error handling is comprehensive
- No memory leaks
- No global pollution
- ESM modules used correctly

---

## Questions This File Should Answer

- What do I need to check before publishing my PF1 module?
- What are the PF1-specific checks I need to perform?
- How do I verify my module uses only confirmed PF1 APIs?
- What PF1.5 compatibility checks are needed?
- How do I ensure my module doesn't break PF1?
- What are common PF1 module issues to avoid?
- How do I test my PF1 module?
- How do I document PF1-specific features?
- How do I handle PF1.5 features safely?

---

## Source Pages Consulted

- [Pathfinder 1e for Foundry VTT - Main Documentation](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/index.html)
- [Module: pf1](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/pf1.html)
- [Hook Events Module](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/hookEvents.html)
- All PF1 class and namespace documentation pages

---

*Last updated: May 3, 2026 | Foundry VTT v13.350+ | Pathfinder 1e System*

---

## FILE: 02_PF1_Namespaces_Config_Registry.md

# PF1 Namespaces, Config & Registry

## Purpose

Reference for Pathfinder 1e's namespace structure, configuration objects, and registry system. Covers `pf1.*` namespace, `CONFIG.PF1`, constants, and documented registries.

## When to Use This

- Accessing PF1 configuration values
- Working with PF1 registries (conditions, damage types, etc.)
- Understanding PF1's extension of Foundry's CONFIG system
- Registering custom entries in PF1 registries

---

## Core Classes / APIs

### Namespace Structure

```
pf1 (global namespace)
├── applications/    # PF1 UI applications
├── canvas/         # PF1 canvas extensions
├── chat/          # PF1 chat handling
├── components/    # PF1 UI components
├── config/        # PF1 configuration (read-only)
├── const/         # PF1 constants
├── dice/          # PF1 dice system
├── documents/     # PF1 document extensions
├── migrations/    # PF1 migration utilities
├── models/        # PF1 data models
├── registry/      # PF1 registries (mutable via API)
├── tours/         # PF1 guided tours
├── utils/         # PF1 utilities
└── ux/            # PF1 UX helpers
```

### Key Registry Classes

- `**pf1.registry.Registry<T>**` - Base registry class
- `**pf1.registry.RegistryEntry**` - Base registry entry class
- `**pf1.registry.Condition**` - Condition registry entry
- `**pf1.registry.Conditions**` - Condition registry (singleton)
- `**pf1.registry.DamageType**` - Damage type registry entry
- `**pf1.registry.DamageTypes**` - Damage type registry (singleton)
- `**pf1.registry.Material**` - Material registry entry
- `**pf1.registry.Materials**` - Material registry (singleton)
- `**pf1.registry.Source**` - Source registry entry
- `**pf1.registry.Sources**` - Source registry (singleton)
- `**pf1.registry.ScriptCallCategory**` - Script call category entry
- `**pf1.registry.ScriptCalls**` - Script call registry (singleton)

---

## Confirmed Namespaces / Classes / Hooks

### Confirmed PF1 Namespaces


| Namespace          | Path               | Purpose                       |
| ------------------ | ------------------ | ----------------------------- |
| `pf1`              | Global             | Root PF1 namespace            |
| `pf1.applications` | `pf1.applications` | PF1-specific applications     |
| `pf1.canvas`       | `pf1.canvas`       | PF1 canvas extensions         |
| `pf1.chat`         | `pf1.chat`         | PF1 chat handling             |
| `pf1.components`   | `pf1.components`   | PF1 UI components             |
| `pf1.config`       | `pf1.config`       | PF1 configuration (read-only) |
| `pf1.const`        | `pf1.const`        | PF1 constants                 |
| `pf1.dice`         | `pf1.dice`         | PF1 dice rolling              |
| `pf1.documents`    | `pf1.documents`    | PF1 document extensions       |
| `pf1.migrations`   | `pf1.migrations`   | PF1 data migrations           |
| `pf1.models`       | `pf1.models`       | PF1 data models               |
| `pf1.registry`     | `pf1.registry`     | PF1 registries                |
| `pf1.tours`        | `pf1.tours`        | PF1 guided tours              |
| `pf1.utils`        | `pf1.utils`        | PF1 utilities                 |
| `pf1.ux`           | `pf1.ux`           | PF1 UX helpers                |


### Confirmed Registries


| Registry     | Singleton                  | Entry Class          | Purpose                                   |
| ------------ | -------------------------- | -------------------- | ----------------------------------------- |
| Conditions   | `pf1.registry.conditions`  | `Condition`          | Game conditions (blinded, deafened, etc.) |
| Damage Types | `pf1.registry.damageTypes` | `DamageType`         | Damage type definitions                   |
| Materials    | `pf1.registry.materials`   | `Material`           | Material type definitions                 |
| Sources      | `pf1.registry.sources`     | `Source`             | Source book definitions                   |
| Script Calls | `pf1.registry.scriptCalls` | `ScriptCallCategory` | Script call categories                    |


### Confirmed Config Objects

Accessible via `pf1.config` (read-only at runtime):

- `**pf1.config.abilities**` - Ability score configuration
- `**pf1.config.abilityTypes**` - Ability type definitions
- `**pf1.config.alignments**` - Alignment options
- `**pf1.config.armorTypes**` - Armor type definitions
- `**pf1.config.buffTypes**` - Buff type categories
- `**pf1.config.conditionTypes**` - Condition type definitions
- `**pf1.config.creatureTypes**` - Creature type definitions
- `**pf1.config.damageResistances**` - Damage resistance types
- `**pf1.config.equipmentSlots**` - Equipment slot definitions
- `**pf1.config.equipmentTypes**` - Equipment type definitions
- `**pf1.config.itemTypes**` - Item type definitions
- `**pf1.config.featTypes**` - Feat type definitions
- `**pf1.config.weaponTypes**` - Weapon type definitions
- `**pf1.config.spellTypes**` - Spell type definitions

**Note**: Config values are **read-only**. Do not mutate `pf1.config` directly.

---

## Safe Module Patterns

### ✅ Reading Config Values

```javascript
// Access PF1 config (read-only)
const alignments = pf1.config.alignments;
const creatureTypes = pf1.config.creatureTypes;
const abilityScores = pf1.config.abilities;

// Use in validation
if (!pf1.config.creatureTypes.includes(creatureType)) {
  throw new Error(`Invalid creature type: ${creatureType}`);
}
```

### ✅ Working with Registries

```javascript
// Access registry entries
const blinded = pf1.registry.conditions.get('blinded');
const fireDamage = pf1.registry.damageTypes.get('fire');
const steel = pf1.registry.materials.get('steel');

// Iterate registry
for (const [id, condition] of pf1.registry.conditions.entries()) {
  console.log(`Condition: ${id}`, condition.label);
}

// Check if entry exists
if (pf1.registry.conditions.has('blinded')) {
  // Condition exists
}
```

### ✅ Registry Hook

```javascript
// Hook: pf1RegisterRegistry
Hooks.on('pf1RegisterRegistry', (registryName, registry) => {
  // Called when registries are being registered
  // registryName: string (e.g., 'conditions', 'damageTypes')
  // registry: the Registry instance
});
```

### ✅ Extending Registries (If Supported)

**Not confirmed in indexed PF1 API docs** whether registries support custom entry registration. Check specific registry documentation.

```javascript
// HYPOTHETICAL - Not confirmed
// pf1.registry.conditions.register('customCondition', { ... });
// Use only if explicitly documented for the specific registry
```

---

## Common PF1 + Foundry v13 Pitfalls

1. **Config Mutation**: `pf1.config` is read-only. Mutating it may cause undefined behavior. Use module settings or flags for custom configuration.
2. **Registry Timing**: Registries may not be populated during `init` hook. Use `pf1PostInit` or later hooks to access registry data.
3. **CONFIG.PF1 vs pf1.config**: Foundry's `CONFIG.PF1` may exist but `pf1.config` is the canonical PF1 configuration. Prefer `pf1.config` for consistency.
4. **Case Sensitivity**: Registry IDs are typically lowercase (e.g., 'blinded' not 'Blinded'). Verify exact IDs in the registry.
5. **Translation**: Many config values are translation keys, not raw strings. Use `game.i18n.localize()` to get display text.
6. **PF1.5 Overrides**: If PF1.5 house rules are active, some config values may be overridden. Do not assume default PF1 behavior.

---

## PF1.5 Notes / House Rule Warnings

### ⚠️ PF1.5 Configuration Conflicts

- **Action Economy**: PF1 config assumes standard PF1 action economy (standard/move/swift/full-round). PF1.5's 3-action + 1-reaction system is **not reflected** in PF1 config.
- **Conditions**: PF1 config has flat condition definitions. PF1.5 tiered conditions require custom registry or data structure.
- **Do not assume**: Default PF1 config values apply when PF1.5 is active. Always check for PF1.5 overrides in your module.

### Recommended Pattern for PF1.5

```javascript
// In your module, define PF1.5-specific config
const PF1_5_CONFIG = {
  actionEconomy: {
    maxActions: 3,
    maxReactions: 1
  },
  conditions: {
    tiered: ['fatigued', 'exhausted', 'staggered'],
    toggle: ['blinded', 'deafened', 'dazed']
  }
};

// Use module settings to enable PF1.5 mode
game.settings.register('my-pf1-5-module', 'enablePF1_5', {
  name: 'Enable PF1.5 Rules',
  scope: 'world',
  type: Boolean,
  default: false,
  config: true
});
```

---

## Questions This File Should Answer

- What are the main PF1 namespaces?
- How do I access PF1 configuration values?
- What registries are available in PF1?
- How do I safely read registry entries?
- Can I add custom entries to PF1 registries?
- What's the difference between `pf1.config` and `CONFIG.PF1`?
- When are registries available to access?
- How do PF1.5 house rules affect config/registry access?

---

## Source Pages Consulted

- [Namespace: config](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/pf1.config.html)
- [Namespace: registry](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/pf1.registry.html)
- [Class: Registry](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.registry.Registry.html)
- [Class: Conditions](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.registry.Conditions.html)
- [Class: DamageTypes](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.registry.DamageTypes.html)
- [Class: Materials](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.registry.Materials.html)
- [Class: Sources](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.registry.Sources.html)
- [Hook: pf1RegisterRegistry](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/types/hookEvents.pf1RegisterRegistry.html)
- [Module: pf1](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/pf1.html)

---

*Last updated: May 3, 2026 | Foundry VTT v13.350+ | Pathfinder 1e System*

---

## FILE: 02_PF1_Rolls_ActionUse_ChatCards.md

# PF1 Rolls, Action Use & Chat Cards

## Purpose

Reference for Pathfinder 1e dice rolling, action usage, and chat card display systems. Covers PF1-specific roll classes, action pipeline, and chat output hooks.

## When to Use This

- Working with PF1 dice rolls (d20, damage, etc.)
- Intercepting or modifying roll data
- Implementing custom action use behavior
- Working with PF1 chat cards

---

## Core Classes / APIs

- `**pf1.dice.D20RollPF**` - PF1-specific d20 roll class
- `**pf1.dice.DamageRoll**` - PF1-specific damage roll class
- `**pf1.dice.RollPF**` - PF1 base roll class
- `**pf1.dice.d20Roll**` - Function to create a d20 roll

---

## Confirmed Hooks

### Roll Hooks
- `pf1PreD20Roll` / `pf1D20Roll` — Before/after d20 roll
- `pf1PreAttackRoll` / `pf1AttackRoll`
- `pf1PreDamageRoll` / `pf1DamageRoll`

### Actor Roll Hooks
- `pf1PreActorRollAbility` / `pf1ActorRollAbility`
- `pf1PreActorRollSkill` / `pf1ActorRollSkill`
- `pf1PreActorRollSave` / `pf1ActorRollSave`
- `pf1PreActorRollBab` / `pf1ActorRollBab`
- `pf1PreActorRollCl` / `pf1ActorRollCl`
- `pf1PreActorRollConcentration` / `pf1ActorRollConcentration`

### Action & Roll Data Hooks

Verified against canonical `hooks.d.ts`. The action-use hooks all take a single `ActionUse` instance — NOT `(actor, item, options)`.

- `pf1PreActionUse(actionUse: ActionUse) => boolean` — `Hooks.call`, **cancellable** (return `false`)
- `pf1CreateActionUse(actionUse: ActionUse)` — `Hooks.callAll`
- `pf1PreDisplayActionUse(actionUse: ActionUse) => boolean` — `Hooks.call`, **cancellable**
- `pf1PostActionUse(actionUse: ActionUse, chatMessage: ChatMessage | null)` — `Hooks.callAll`
- `pf1DisplayCard(item: ItemPF, data: { template: string; templateData: object; chatData: object }) => boolean` — `Hooks.call`, **cancellable**. Note: passes a structured data object, NOT a jQuery/HTMLElement. `templateData` and `chatData` shapes are explicitly unstable per JSDoc.
- `pf1GetRollData(actor, rollData)` — fires when roll data is gathered; preferred entry point for adding custom bonuses.

---

## Safe Module Patterns

### ✅ Intercepting Rolls

```javascript
Hooks.on('pf1PreD20Roll', (rollConfig) => {
  // Modify rollConfig before roll is created
  // rollConfig.parts — array of roll formula parts
  // rollConfig.options — roll options
  // Do NOT use actor.hasCondition() — UNCONFIRMED method
});

Hooks.on('pf1PreAttackRoll', (attackData, rollConfig) => {
  const bonus = getCustomAttackBonus(attackData.actor);
  if (bonus) rollConfig.parts.push(bonus);
});
```

### ✅ Modifying Roll Data via Hook

`actor.getRollData()` is a Foundry-core method that PF1 extends via the `pf1GetRollData` hook. Both are safe to use; the hook is the preferred extension point for injecting custom data into all roll data calls.

```javascript
Hooks.on('pf1GetRollData', (actor, rollData) => {
  rollData.bonuses = rollData.bonuses ?? {};
  rollData.bonuses.myModuleBonus = getCustomBonus(actor);
});

// Direct call also works — hook above will fire during it
const rollData = actor.getRollData();
```

### ✅ Creating D20 Rolls

```javascript
// Pass actor's roll data — PF1's pf1GetRollData hook fires during this call
const rollData = actor.getRollData();
const roll = await pf1.dice.d20Roll({
  parts: ['1d20'],
  actor: actor,
  data: rollData,
  title: 'Custom Roll',
  rollMode: 'publicroll'
});
if (roll) console.log('Total:', roll.total);
```

### ✅ Action Use Pipeline

Verified cancellability per `hooks.d.ts`: `pf1PreActionUse`, `pf1PreDisplayActionUse`, and `pf1DisplayCard` are all `Hooks.call` and accept `return false`. Each takes a single `ActionUse` (or `ItemPF` + data) argument, NOT `(actor, item, options)`.

```javascript
// Cancel an action before it's used
Hooks.on('pf1PreActionUse', (actionUse) => {
  const cost = getActionCost(actionUse.item);
  if (!spendAction(actionUse.actor, cost)) return false;
});

// Fires after the action completes; chatMessage may be null
Hooks.on('pf1PostActionUse', (actionUse, chatMessage) => {
  logActionUse(actionUse.actor, actionUse.item, chatMessage);
});
```

### ✅ Chat Card Hook

Signature: `pf1DisplayCard(item: ItemPF, data: { template: string; templateData: object; chatData: object }) => boolean`. Passes a STRUCTURED DATA OBJECT, NOT jQuery / NOT an HTMLElement. `Hooks.call` — cancellable.

Use this hook to:
- **Suppress** card display (return `false`)
- **Mutate** `data.templateData` or `data.chatData` BEFORE the card is rendered

```javascript
// Cancel display entirely
Hooks.on('pf1DisplayCard', (item, data) => {
  if (shouldSuppressCard(item)) return false;
});

// Mutate template data before render (templateData/chatData shapes are unstable
// per JSDoc — don't depend on internal field names across PF1 versions)
Hooks.on('pf1DisplayCard', (item, data) => {
  data.chatData.flags = data.chatData.flags ?? {};
  data.chatData.flags['my-pf1-5-module'] = {
    actionsRemaining: getRemainingActions(item.actor)
  };
});
```

**To modify the rendered HTML AFTER the card is in chat**, use Foundry-core `renderChatMessageHTML` and read your flags:

```javascript
Hooks.on('renderChatMessageHTML', (message, element, data) => {
  const flags = message.flags?.['my-pf1-5-module'];
  if (!flags) return;
  const span = document.createElement('span');
  span.className = 'pf15-actions';
  span.textContent = `[${flags.actionsRemaining} actions]`;
  element.querySelector('.message-header')?.appendChild(span);
});
```

### ✅ D20RollPF

> ⚠️ **`D20RollPF` constructor options are not fully confirmed in indexed docs.** Verify in PF1 source.

```javascript
try {
  const roll = new pf1.dice.D20RollPF(
    '1d20 + @skills.acrobatics.total',
    actor.getRollData(), // safe — Foundry core method
    { actor: actor, type: 'skill', skill: 'acrobatics' }
  );
  await roll.evaluate();
  roll.toMessage({ flavor: 'Acrobatics Check', rollMode: 'publicroll' });
} catch (err) {
  console.error('D20RollPF failed:', err);
}
```

---

## Common Pitfalls

1. **`actor.hasCondition()` not directly indexed** — use `actor.statuses.has(key)` (Foundry core) or read `actor.system.conditions[key]`.
2. **`actor.getRollData()` IS available** — Foundry core method; PF1 extends via `pf1GetRollData` hook.
3. **`pf1DisplayCard` does NOT pass jQuery** — it passes `(item, data)` where `data` is `{ template, templateData, chatData }`. Modify `chatData` to flag the eventual chat message; use `renderChatMessageHTML` to mutate the rendered DOM.
4. **Action-use hooks take a single `ActionUse`**, NOT `(actor, item, options)`.
5. **`pf1PreActionUse` / `pf1PreDisplayActionUse` / `pf1DisplayCard` ARE cancellable** (`Hooks.call`, return `false`). Most `Pre*` roll hooks need per-hook verification.
6. **Roll timing** — `pf1Pre*` hooks fire before roll creation; modify `rollConfig` there, not on the roll object.

---

## PF1.5 Notes / House Rule Warnings

### ⚠️ Action Costs in Rolls — MODULE DESIGN PATTERN

```javascript
// MODULE DESIGN PATTERN
Hooks.on('pf1PreD20Roll', (rollConfig) => {
  const isActionRoll = rollConfig.options?.type === 'attack' ||
                       rollConfig.options?.type === 'skill';
  if (isActionRoll && rollConfig.actor) {
    spendAction(rollConfig.actor, getRollActionCost(rollConfig));
    // cancellability UNCONFIRMED for pf1PreD20Roll
  }
});
```

### ⚠️ Concentration with Tiered Conditions — MODULE DESIGN PATTERN

```javascript
// MODULE DESIGN PATTERN
Hooks.on('pf1PreActorRollConcentration', (actor, rollConfig) => {
  const fatigueLevel = actor.getFlag('my-pf1-5-module', 'condition.fatigued') || 0;
  if (fatigueLevel >= 1) rollConfig.parts.push('-2');
  if (fatigueLevel >= 2) rollConfig.parts.push('-2');
});
```

### ⚠️ Chat Cards with Action Costs — MODULE DESIGN PATTERN

Flag the message during `pf1DisplayCard`, then decorate the rendered DOM via core `renderChatMessageHTML`:

```javascript
// Step 1: tag the chat data BEFORE the message is created
Hooks.on('pf1DisplayCard', (item, data) => {
  if (item.type !== 'attack' && item.type !== 'weapon') return;
  data.chatData.flags = data.chatData.flags ?? {};
  data.chatData.flags['my-pf1-5-module'] = {
    actionCost: getActionCostForItem(item.actor, item)
  };
});

// Step 2: decorate the rendered DOM
Hooks.on('renderChatMessageHTML', (message, element, data) => {
  const flags = message.flags?.['my-pf1-5-module'];
  if (!flags) return;
  const span = document.createElement('span');
  span.className = 'action-cost';
  span.textContent = ` [${flags.actionCost} action]`;
  element.querySelector('.card-header, .message-header')?.appendChild(span);
});
```

---

## Source Pages Consulted

- [Namespace: dice](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/pf1.dice.html)
- [Class: D20RollPF](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.dice.D20RollPF.html)
- [Class: DamageRoll](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.dice.DamageRoll.html)
- [Function: d20Roll](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/functions/pf1.dice.d20Roll.html)
- [Hook: pf1PreD20Roll](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1PreD20Roll.html)
- [Hook: pf1PreAttackRoll](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1PreAttackRoll.html)
- [Hook: pf1AttackRoll](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1AttackRoll.html)
- [Hook: pf1PreActionUse](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1PreActionUse.html)
- [Hook: pf1DisplayCard](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1DisplayCard.html)
- [Hook: pf1GetRollData](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1GetRollData.html)
- [Hook Events List](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/hookEvents.html)

---

*Last updated: May 2026 | Foundry VTT v13.350+ | Pathfinder 1e System*

---

## FILE: 02_PF1_Tokens_Canvas_Sheets_UI.md

# PF1 Tokens, Canvas, Sheets & UI

## Purpose

Reference for Pathfinder 1e token document extensions, canvas behavior, actor/item sheets, and UI components. Covers PF1-specific visual and interaction elements.

## When to Use This

- Working with PF1 tokens on the canvas
- Extending PF1 actor or item sheets
- Adding UI elements to PF1 interfaces
- Customizing PF1 canvas rendering

---

## Core Classes / APIs

- `**pf1.documents.TokenDocumentPF**` - PF1-specific token document (extends `TokenDocument`)

From `pf1.applications` namespace (confirmed in PF1 docs):
- `pf1.applications.ActionDialog`
- `pf1.applications.ApplyDamage`
- `pf1.applications.SpellbookManager`
- `pf1.applications.TraitSelector`
- `pf1.applications.SensesSelector`
- `pf1.applications.ActionSelector`
- `pf1.applications.CategorizedItemPicker`
- `pf1.applications.ExperienceDistributor`
- `pf1.applications.LevelUpForm`

**Deprecated** (avoid): `pf1.applications.EntrySelector`, `pf1.applications.FlagSelector`, `pf1.applications.Widget_ItemPicker`

---

## Confirmed Hooks

Signatures verified against canonical `hooks.d.ts`. Several of these were previously documented with incorrect signatures (jQuery / `(actor, html, actions)`) — the actual shapes are below.

- **`pf1RenderQuickActions(hud: TokenHUD, token: Token, template: DocumentFragment)`** — Token HUD quick actions; passes a `DocumentFragment` (live DOM, not jQuery, not actors/actions array). `Hooks.callAll`.
- **`renderPF1ExtendedTooltip(sheet: ActorSheet, id: string, template: DocumentFragment)`** — Extended tooltip render hook; passes a `DocumentFragment`, not jQuery. `Hooks.callAll`.
- **`pf1HealthDeltaRender(actor: ActorPF, options: object, textOptions: object)`** — Health delta scrolling text; passes config objects, not jQuery. Per JSDoc, returning `false` suppresses the scrolling text.
- **`pf1DropContainerSheetData(item: ItemContainerPF, sheet: ItemSheetPF_Container, data: object) => boolean`** — Container sheet drop; `Hooks.call`, **cancellable** (return false to prevent drop).

---

## Safe Module Patterns

### ✅ Extending PF1 Actor Sheets

**PF1 actor sheets are V2.** `pf1.applications.actor.abstract.ActorSheetPF` extends `ApplicationV2 + HandlebarsApplicationMixin` (declares `static PARTS`; action handlers signed `(event, target: HTMLElement)`). Concrete sheets: `ActorSheetPFCharacter`, `ActorSheetPFNPC`, `ActorSheetPFNPCLite`, `ActorSheetPFNPCLoot`, `BaseCharacterSheetPF`, `HauntSheetPF`, `TrapSheetPF`, `VehicleSheetPF`, plus `pf1.applications.actor.LootSheetPF`.

`renderActorSheet` (and the subclass-specific `renderActorSheetPFCharacter`, etc.) pass **HTMLElement**, not jQuery. The hook signature is `(sheet, element, context)` for V2.

```javascript
// PF1 ActorSheetPF is V2 → element is HTMLElement
Hooks.on('renderActorSheetPFCharacter', (sheet, element, context) => {
  const btn = document.createElement('button');
  btn.className = 'my-custom-button';
  btn.textContent = 'Custom Action';
  btn.addEventListener('click', () => myCustomAction(sheet.actor));

  // Native DOM directly — no jQuery .find() / [0] indirection
  element.querySelector('.sheet-header')?.appendChild(btn);
});

// Hooking the generic name catches all PF1 actor sheet variants
Hooks.on('renderActorSheet', (sheet, element, context) => {
  if (!(sheet instanceof pf1.applications.actor.abstract.ActorSheetPF)) return;
  // element is HTMLElement; same pattern as above
});
```

> If you need to outlive a re-render, use a `MutationObserver` or re-attach in your handler. PF1 sheets re-render frequently on data changes.
### ✅ Token Document Access

```javascript
// scene.tokens → TokenDocumentPF
const tokenDoc = canvas.scene.tokens.get(tokenId);

// canvas.tokens → Token placeable; .document → TokenDocumentPF
const tokenDoc2 = canvas.tokens.get(tokenId)?.document;

const actor = tokenDoc.actor;
if (actor?.type === 'character') { /* ... */ }
```

### ✅ Quick Actions Hook

Signature: `(hud: TokenHUD, token: Token, template: DocumentFragment) => void`. Passes a live `DocumentFragment` you can mutate before it's added to the DOM — NOT a jQuery object, NOT an `actions` array.

```javascript
Hooks.on('pf1RenderQuickActions', (hud, token, template) => {
  if (!token.actor) return;

  // template is a DocumentFragment — use native DOM
  const action = document.createElement('div');
  action.className = 'quick-action my-custom-action';
  action.innerHTML = '<i class="fas fa-bolt"></i>';
  action.addEventListener('click', () => myCustomAction(token.actor));
  template.appendChild(action);
});
```

### ✅ Container Sheet Drops

Signature: `(item: ItemContainerPF, sheet: ItemSheetPF_Container, data: object) => boolean`. **Cancellable** (return `false` to prevent the drop).

```javascript
Hooks.on('pf1DropContainerSheetData', (container, sheet, data) => {
  if (data.type === 'Item') {
    const item = game.items.get(data.id) ?? fromUuidSync(data.uuid);
    if (item && !canAcceptItem(container, item)) return false; // cancel drop
    if (item) addItemToContainer(container, item);
  }
});
```

### ✅ Extended Tooltips

Signature: `(sheet: ActorSheet, id: string, template: DocumentFragment) => void`. Passes a `DocumentFragment`, NOT jQuery.

```javascript
Hooks.on('renderPF1ExtendedTooltip', (sheet, id, template) => {
  if (id !== 'item') return;
  const customInfo = getCustomItemInfo(sheet);
  if (!customInfo) return;

  // template is a DocumentFragment — native DOM
  const div = document.createElement('div');
  div.className = 'custom-info';
  div.textContent = customInfo;
  template.querySelector('.tooltip-content')?.appendChild(div);
});
```

### ✅ Health Delta Rendering

Signature: `(actor: ActorPF, options: object, textOptions: object) => void`. Passes config objects, NOT jQuery / NOT a DOM element. Mutate `options` or `textOptions` to alter the scrolling text. Per the JSDoc, returning `false` prevents the message from being rendered.

```javascript
Hooks.on('pf1HealthDeltaRender', (actor, options, textOptions) => {
  // textOptions is the options object passed to createScrollingText
  // Modify color/fontSize/etc. here. Not all fields are mutable — verify per-field.
  if (options.delta < 0) {
    textOptions.fill = '#aa0000';
  } else {
    textOptions.fill = '#00aa00';
  }
  // return false here to suppress the scrolling text entirely
});
```

### ✅ Token HUD

> **`renderTokenHUD` passes jQuery** — Token HUD is a V1 application in v13.

```javascript
Hooks.on('renderTokenHUD', (app, html, data) => {
  const token = app.object;
  if (!token.actor) return;

  const div = document.createElement('div');
  div.className = 'pf15-token-actions';
  div.textContent = `${getRemainingActions(token.actor)} Actions`;
  html[0].appendChild(div);
});
```

---

## Common Pitfalls

1. **PF1 sheets are V2**: `renderActorSheet` passes `HTMLElement`. Use `element.querySelector()` directly. Old guides claiming jQuery / V1 are stale.
2. **Token vs TokenDocument**: `canvas.tokens.get()` → Token placeable. `scene.tokens.get()` → `TokenDocumentPF`.
3. **PF1 hook arg shapes were widely misdocumented**: `pf1RenderQuickActions` is `(hud, token, template:DocumentFragment)`, NOT `(actor, html, actions)`. `renderPF1ExtendedTooltip` is `(sheet, id, template:DocumentFragment)`, NOT `(tooltip, html, data)`. `pf1HealthDeltaRender` passes objects, NOT a DOM element. `pf1DropContainerSheetData` is `(item, sheet, data)`, NOT `(container, data, event)`. Verify against `hooks.d.ts` if unsure.
4. **CSS scope**: Prefix all module CSS with your module ID.
5. **Deprecated apps**: Avoid `EntrySelector`, `FlagSelector`, `Widget_ItemPicker`.

---

## PF1.5 Notes / House Rule Warnings

### ⚠️ Action Tracker in Sheets — MODULE DESIGN PATTERN

```javascript
// MODULE DESIGN PATTERN — PF1 sheets have no native 3-action tracker
// PF1 sheets are V2 → element is HTMLElement
Hooks.on('renderActorSheetPFCharacter', (sheet, element, context) => {
  if (sheet.actor.type !== 'character') return;

  const tracker = document.createElement('div');
  tracker.className = 'pf15-action-tracker';
  tracker.innerHTML = `
    <h4>PF1.5 Actions</h4>
    <div class="action-slots">
      <span class="action-slot"></span>
      <span class="action-slot"></span>
      <span class="action-slot"></span>
    </div>
    <div class="reaction-slot"></div>
  `;
  element.querySelector('.sheet-header')?.insertAdjacentElement('afterend', tracker);
  updateActionTracker(sheet.actor, tracker);
});

function updateActionTracker(actor, element) {
  const actions = getRemainingActions(actor);
  const hasReaction = !actor.getFlag('my-pf1-5-module', 'reactions');
  element.querySelectorAll('.action-slot').forEach((slot, i) => {
    slot.classList.toggle('used', i >= actions);
  });
  element.querySelector('.reaction-slot')?.classList.toggle('used', !hasReaction);
}
```

### ⚠️ Tiered Condition Token Overlays — MODULE DESIGN PATTERN

```javascript
// MODULE DESIGN PATTERN
Hooks.on('drawToken', (token) => {
  if (!token.actor) return;
  const fatigue = token.actor.getFlag('my-pf1-5-module', 'condition.fatigued') || 0;
  if (fatigue > 0) addTokenOverlay(token, `fatigue-${fatigue}`, `Fatigued ${fatigue}`);
});
```

---

## Source Pages Consulted

- [Class: TokenDocumentPF](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.documents.TokenDocumentPF.html)
- [Namespace: applications](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/pf1.applications.html)
- [Class: ApplyDamage](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.applications.ApplyDamage.html)
- [Class: SpellbookManager](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/classes/pf1.applications.SpellbookManager.html)
- [Hook: pf1RenderQuickActions](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1RenderQuickActions.html)
- [Hook: renderPF1ExtendedTooltip](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.renderPF1ExtendedTooltip.html)
- [Hook: pf1DropContainerSheetData](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1DropContainerSheetData.html)
- [Hook: pf1HealthDeltaRender](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/variables/hookEvents.pf1HealthDeltaRender.html)
- [Hook Events List](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/hookEvents.html)

---

*Last updated: May 2026 | Foundry VTT v13.350+ | Pathfinder 1e System*

---

## FILE: 03_Claude_Code_Foundry_Module_Addendum.md

# Claude Code Foundry Module Development Addendum

## Purpose

Claude Code-specific guidance for Foundry VTT v13 module development. This addendum provides Claude Code configuration tips, project setup recommendations, and workflow optimizations for building Foundry modules with AI assistance.

## When to Use This

- Setting up Claude Code for Foundry module development
- Configuring `.claude` files for optimal AI assistance
- Structuring your project for better AI understanding
- Debugging with Claude Code
- Optimizing AI prompts for Foundry development

---

## Core Configuration

### `.claudeignore` Recommendations

```
# Foundry VTT
foundryvtt/
node_modules/
dist/
*.min.js
*.min.css

# Build artifacts
build/
dist/
*.zip

# IDE files
.idea/
.vscode/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Environment
.env
.env.*

# Temporary files
tmp/
temp/
```

### `.clauderc` or `claude.json` Configuration

```json
{
  "workspace": {
    "trustedFolders": [
      "."
    ]
  },
  "git": {
    "autoStage": false
  },
  "code": {
    "maxTokens": 16384,
    "temperature": 0.7,
    "model": "claude-3-5-sonnet-20250620"
  }
}
```

---

## Project Structure for Claude Code

```
my-foundry-module/
├── .claude/                  # Claude Code configuration
│   ├── commands/            # Custom commands
│   │   └── foundry.md       # Foundry-specific commands
│   └── ignore               # Additional ignore patterns
│
├── .github/                  # GitHub configuration
│   └── workflows/           # CI/CD
│
├── src/                     # Source files
│   ├── module.mjs           # Main entry point
│   ├── settings.mjs         # Settings registration
│   ├── hooks/               # Hook handlers
│   │   ├── canvas.mjs
│   │   ├── combat.mjs
│   │   └── ui.mjs
│   ├── ui/                  # UI components
│   │   ├── apps/            # ApplicationV2 subclasses
│   │   └── hud/             # HUD elements
│   ├── documents/           # Custom document types
│   ├── utils/               # Shared utilities
│   └── lang/                # Localization
│       └── en.json
│
├── templates/               # Handlebars templates
│   └── my-template.hbs
│
├── assets/                  # Static assets
│   ├── css/
│   │   └── module.css
│   ├── images/
│   └── sounds/
│
├── tests/                   # Test files
│   └── module.test.mjs
│
├── docs/                    # Documentation
│   ├── API_REFERENCE.md     # Generated API docs
│   └── CHANGELOG.md
│
├── module.json              # Module manifest
├── package.json             # Node.js metadata
├── README.md                # Module documentation
└── .gitignore
```

---

## Claude Code Commands for Foundry

### Custom Commands (`.claude/commands/foundry.md`)

```markdown
# Foundry VTT Module Development Commands

## Module Scaffolding
- "Create a new Foundry VTT v13 module with ES modules, proper manifest, and basic structure for [description]"
- "Generate a module.json for a Foundry v13 module that [purpose] with compatibility for 13.350+"
- "Create a basic ES module entry point for Foundry v13 with init and ready hooks"

## Document Operations
- "Generate code to create a custom document type for [purpose] extending foundry.abstract.Document"
- "Show me how to register a custom document subtype for Actor in Foundry v13"
- "Create a TypeDataModel for Pathfinder 1e [specific data structure]"

## UI Development
- "Generate an ApplicationV2 subclass for [purpose] with proper options and context preparation"
- "Create a DocumentSheetV2 for [document type] with form handling"
- "Show me how to add custom tabs to an ApplicationV2 using foundry.applications.ux.Tabs"

## Canvas Operations
- "Generate code to add a custom canvas layer for [purpose]"
- "Show me how to draw on the Foundry canvas using PIXI.Graphics"
- "Create a token HUD extension that adds [feature]"

## Hooks & Events
- "Generate hook handlers for [event type] with proper error handling"
- "Show me all available hooks for [specific use case] in Foundry v13"
- "Create a custom hook that other modules can use"

## Settings
- "Generate game.settings registration for [setting name] with proper config"
- "Create a settings UI with multiple setting types for [module name]"

## Debugging
- "Help me debug why my [feature] isn't working in Foundry v13"
- "What are common reasons for [specific error] in Foundry module development?"
- "How do I check if my module is using any deprecated APIs?"

## Best Practices
- "What are the best practices for [specific task] in Foundry v13?"
- "Show me examples of safe module patterns for [use case]"
- "What should I avoid when doing [task] in Foundry?"
```

---

## AI Prompt Optimization

### Effective Prompt Structure

```
You are an expert Foundry VTT v13 module developer. 
The current Foundry version is 13.350+.
The game system is Pathfinder 1e (pf1).

Context:
- [Provide relevant context about your module]
- [Describe what you're trying to achieve]
- [Mention any specific APIs or classes you're working with]

Requirements:
1. [Specific requirement 1]
2. [Specific requirement 2]
3. [Specific requirement 3]

Constraints:
- Use only public APIs (@public)
- Avoid underscore-prefixed methods
- Use ES modules
- Follow Foundry v13 best practices
- Compatible with Pathfinder 1e

Provide:
- Code examples with proper imports
- Explanation of key concepts
- Any relevant warnings or pitfalls
```

### Example Prompts

**Good:**

```
"I need to create a custom token HUD button in Foundry v13 that casts a spell from the selected token's actor. The button should only appear for owned tokens with spellcasting. Use ApplicationV2 patterns and only public APIs. Show me the complete implementation with proper error handling."
```

**Bad:**

```
"How do I add a button?"
```

---

## Debugging with Claude Code

### Common Debugging Commands

```bash
# Check Foundry version
cat resources/app/package.json | grep version

# Check module loading
grep -r "my-module" foundryvtt/data/modules/

# Check console errors
# (In browser dev tools)

# Validate module.json
jq . module.json

# Check for deprecated API usage
grep -r "_" src/ | grep -v "node_modules" | grep -v "\.min\."
```

### Debugging Workflow

1. **Reproduce the Issue**: Get clear steps to reproduce
2. **Check Console**: Look for errors/warnings in browser console
3. **Isolate Code**: Narrow down to specific file/function
4. **Review API**: Check if using public APIs correctly
5. **Add Logging**: Temporary console.log for debugging
6. **Test Incrementally**: Add code back piece by piece

### Debugging Prompts

```
"My token HUD button isn't appearing. Here's my code: [paste code]. 
The button should appear for owned tokens. What could be wrong?"

"I'm getting 'Cannot read property of undefined' when calling [method]. 
Here's the error stack: [paste stack]. What's causing this?"

"My module works in single player but not multiplayer. 
Here's my socket code: [paste code]. What am I missing?"
```

---

## Code Review with Claude Code

### Review Checklist Prompt

```
"Please review this Foundry v13 module code for:
1. API safety (no private/internal usage)
2. Best practices adherence
3. Performance issues
4. Potential bugs
5. Security concerns
6. Pathfinder 1e compatibility

Here's the code:
[paste code]

Provide:
- List of issues found
- Suggested fixes
- Severity rating (low/medium/high)
- Explanation for each issue"
```

### Code Optimization Prompt

```
"How can I optimize this Foundry v13 code for better performance?
Current code: [paste code]

Consider:
- Reducing canvas operations
- Minimizing DOM manipulation
- Batch operations where possible
- Caching expensive computations
- Reducing hook frequency"
```

---

## GitHub Integration

### Pull Request Template

```markdown
## Description

[Describe the changes]

## Related Issues

[Link to any related issues]

## Changes Made

- [ ] New feature
- [ ] Bug fix
- [ ] Performance improvement
- [ ] Documentation update
- [ ] Refactoring

## Testing

- [ ] Tested with Foundry v13.350+
- [ ] Tested with Pathfinder 1e
- [ ] Tested in multiplayer
- [ ] No console errors
- [ ] Settings work correctly

## Checklist

- [ ] Code follows Foundry v13 best practices
- [ ] Only public APIs used
- [ ] No breaking changes
- [ ] Documentation updated
- [ ] All tests pass
```

### CI/CD with GitHub Actions

```yaml
# .github/workflows/test.yml
name: Foundry Module Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Test
        run: npm test
      
      - name: Validate module.json
        run: node scripts/validate-manifest.js
```

---

## Foundry-Specific Claude Code Tips

### Working with API Documentation

1. **Reference the indexed library**: "Use only the information from my indexed Foundry VTT v13 API Library"
2. **Cite sources**: "Include source links to the relevant API pages"
3. **Verify information**: "Confirm this is accurate for Foundry v13.350+"

### Handling API Changes

```
"What changed in Foundry v13 regarding [specific feature]?
Compare with v12 if possible."
```

### System-Specific Questions (Pathfinder 1e)

```
"How does Pathfinder 1e implement [feature] in Foundry v13?
Show me the relevant CONFIG settings or document classes."
```

---

## Common Pitfalls & Solutions


| Pitfall                  | Solution                        | Claude Prompt                                                 |
| ------------------------ | ------------------------------- | ------------------------------------------------------------- |
| Using deprecated APIs    | Check API documentation         | "What's the v13 replacement for [deprecated API]?"            |
| Module not loading       | Check manifest and paths        | "Why isn't my module loading? Here's my module.json: [paste]" |
| Settings not saving      | Verify scope and registration   | "My settings aren't saving. Here's my code: [paste]"          |
| Canvas undefined         | Check hook timing               | "Why is canvas undefined in my hook?"                         |
| Token operations failing | Check ownership and permissions | "My token operations aren't working. What am I missing?"      |
| UI not updating          | Check for proper rendering      | "My UI isn't updating when data changes. How do I fix this?"  |


---

## Questions This File Should Answer

- How do I set up Claude Code for Foundry module development?
- What project structure works best with Claude Code?
- What custom commands should I create for Foundry development?
- How do I write effective prompts for Foundry module development?
- How do I debug Foundry modules with Claude Code?
- How do I review my code with Claude Code?
- How do I optimize my prompts for Foundry-specific questions?
- What GitHub integration works well for Foundry modules?
- What are common issues and how do I solve them with Claude Code?
- How do I ensure my prompts reference the correct API documentation?

---

## Source Pages Consulted

- [Claude Code Documentation](https://code.claude.ai/)
- [Foundry VTT v13 API Documentation](https://foundryvtt.com/api/v13/index.html)
- [Foundry VTT Module Development Guide](https://foundryvtt.com/article/module-development/)

---

*Last updated: May 2, 2026 | Foundry VTT v13.350+ | Claude Code*

---

## FILE: 03_Claude_Code_Foundry_PF1_Module_Addendum.md

# Claude Code: Foundry + PF1 Module Addendum

## Purpose

Claude Code-specific guidance for Foundry VTT v13 + Pathfinder 1e module development. Provides configuration, project structure, and prompt templates tailored for this project.

## When to Use This

- Setting up Claude Code for Foundry + PF1 module development
- Configuring `.claudeignore` and project structure
- Writing effective prompts for code review and development
- Debugging modules with AI assistance

---

## Core Configuration

### `.claudeignore` for Foundry + PF1 Projects

```
# Foundry VTT installation
foundryvtt/
foundryvtt-data/
User Data/

# Node.js
node_modules/
package-lock.json

# Build artifacts
dist/
build/
*.zip
*.min.js
*.min.css

# IDE files
.idea/
.vscode/
*.swp
*.swo
*.sublime-workspace
*.sublime-project

# OS files
.DS_Store
Thumbs.db
desktop.ini

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment
.env
.env.*
!.env.example

# Foundry-specific
Data/
resources/

# PF1 system (if cloned locally)
systems/pf1/

# Temporary files
tmp/
temp/
*.tmp

# Coverage
coverage/
.nyc_output/

# Test results
.test.cache
```

### `.clauderc` Configuration

```json
{
  "workspace": {
    "trustedFolders": [
      ".",
      "../FoundryVTT"
    ]
  },
  "git": {
    "autoStage": false
  },
  "code": {
    "maxTokens": 16384,
    "temperature": 0.3,
    "model": "claude-3-5-sonnet-20250620"
  }
}
```

**Note**: Lower temperature (0.3) for more deterministic API usage in module development.

---

## Project Structure

```
my-pf1-module/
├── .claude/                          # Claude Code configuration
│   ├── commands/                    # Custom commands
│   │   ├── foundry.md               # Foundry-specific commands
│   │   └── pf1.md                   # PF1-specific commands
│   └── ignore                       # Additional ignore patterns
│
├── .github/                          # GitHub configuration
│   └── workflows/                   # CI/CD
│       └── test.yml                 # Test workflow
│
├── module.json                       # Module manifest (required)
├── package.json                      # Node.js metadata
├── README.md                         # Module documentation
│
├── scripts/                         # ES module scripts
│   ├── module.mjs                  # Main entry point (required)
│   ├── settings.mjs                # Settings registration
│   │
│   ├── hooks/                      # Hook handlers
│   │   ├── actor.mjs               # Actor-related hooks
│   │   ├── combat.mjs              # Combat-related hooks
│   │   ├── item.mjs                # Item-related hooks
│   │   ├── rolls.mjs               # Roll-related hooks
│   │   └── ui.mjs                  # UI-related hooks
│   │
│   ├── pf1/                        # PF1-specific code
│   │   ├── actions/                # PF1.5 action tracking
│   │   │   └── tracker.mjs         # 3 actions + 1 reaction
│   │   ├── conditions/             # PF1.5 condition system
│   │   │   ├── tiered.mjs          # Tiered conditions
│   │   │   └── toggle.mjs          # Toggle conditions
│   │   └── utils.mjs               # PF1 utilities
│   │
│   └── apps/                       # Custom applications
│       ├── action-hud.mjs           # PF1.5 action HUD
│       └── condition-display.mjs   # Condition display
│
├── styles/                          # CSS files
│   ├── module.css                  # Main styles (required)
│   └── croakers-ledger.css          # PF1.5 theme
│
├── templates/                       # Handlebars templates
│   ├── action-hud.hbs              # Action HUD template
│   └── condition-display.hbs       # Condition display template
│
├── lang/                            # Localization
│   └── en.json                      # English translations
│
├── docs/                            # Documentation
│   ├── API_REFERENCE.md             # API usage notes
│   └── PF1_5_DESIGN.md              # PF1.5 architecture
│
└── assets/                          # Static assets
    └── icons/                       # Custom icons
        └── action-icon.svg
```

---

## Custom Commands

### `.claude/commands/foundry.md`

```markdown
# Foundry VTT v13 Module Development Commands

## Module Setup
- "Create a Foundry VTT v13 module manifest for a PF1 module with ES modules"
- "Generate a module.json for a Foundry v13.350+ module with PF1 system dependency"
- "Create a basic Foundry v13 module structure with ES modules and ApplicationV2"
- "Show me the required fields in module.json for Foundry v13"

## API Safety
- "Review this code for Foundry v13 public API safety"
- "Identify any underscore-prefixed method calls in this code"
- "Check if this API is confirmed in the Foundry v13 indexed docs"
- "What's the public alternative to this private API method?"
- "How do I migrate this v12 code to v13?"

## Documents & Data
- "Show me how to safely create a document in Foundry v13"
- "How do I work with embedded documents in Foundry v13?"
- "What's the difference between ClientDocument and Document in v13?"
- "How do I query document collections in Foundry v13?"
- "Show me safe flag usage patterns for module data"

## Canvas & Tokens
- "How do I safely access the canvas in Foundry v13?"
- "What's the difference between Token and TokenDocument?"
- "Show me how to extend TokenHUD in Foundry v13"
- "How do I add a custom canvas layer?"
- "Show me safe canvas readiness checks"

## Hooks
- "List all confirmed Foundry v13 hooks with their arguments"
- "What's the difference between Hooks.on and Hooks.once?"
- "How do I cancel a Foundry hook?"
- "Are Foundry v13 hooks awaited?"
- "Show me how to register hooks with error handling"

## UI
- "How do I extend ApplicationV2 in Foundry v13?"
- "Show me how to add custom buttons to a sheet"
- "What element type do render hooks pass in v13?"
- "Show me how to create a custom ApplicationV2 subclass"

## Debugging
- "Help me debug why my module isn't loading. Here's my code: [paste]"
- "My hook isn't firing. Here's my registration: [paste]"
- "I'm getting undefined when accessing [property]. Here's my code: [paste]"
- "What are common causes of [specific error] in Foundry v13?"
```

### `.claude/commands/pf1.md`

```markdown
# Pathfinder 1e Foundry Module Development Commands

## PF1 Data Access
- "Show me how to safely access PF1 actor data using only confirmed APIs"
- "What are the confirmed PF1 actor types and their model classes?"
- "How do I query PF1 items by type using confirmed item types?"
- "Show me safe patterns for reading PF1 document data"

## PF1.5 Implementation
- "Generate a PF1.5 action tracker (3 actions + 1 reaction) using flags"
- "Create a tiered condition system for PF1.5 with severity levels"
- "Show me how to modify PF1 rolls to apply PF1.5 tiered condition penalties"
- "Generate code to display PF1.5 action economy in token HUDs"

## PF1 Hooks
- "List all confirmed PF1 hooks with their arguments and use cases"
- "Show me how to use pf1PreActionUse hook to implement PF1.5 action costs"
- "How do I intercept PF1 rolls to add PF1.5 modifiers?"
- "What's the difference between pf1Pre* and pf1* hooks?"

## PF1 UI
- "Show me how to add custom buttons to PF1 actor sheets"
- "How do I extend PF1 quick actions with custom actions?"
- "Create a custom PF1.5 HUD overlay for action tracking"
- "Show me how to style UI with Croaker's Ledger theme"

## PF1 + Foundry Integration
- "How do Foundry v13 core docs and PF1 system docs work together?"
- "What PF1 classes extend which Foundry core classes?"
- "How do I use both reference packs together?"

## Debugging
- "My PF1 module isn't working. Here's what I'm seeing: [error]"
- "My PF1.5 action tracker isn't working. Here's my code: [paste]"
- "I'm getting undefined when accessing [PF1 data path]. Is it confirmed?"
- "How do I check if a PF1 API is confirmed in the docs?"
```

---

## Effective Prompt Templates

### 1. Foundry v13 API Safety Review

```
You are an expert Foundry VTT v13 module developer.

**Context:**
- Foundry VTT version: 13.350+
- Module type: [describe]
- Game system: Pathfinder 1e (pf1)

**Requirements:**
1. Review this code for Foundry v13 public API safety
2. Identify any use of:
   - Underscore-prefixed methods (`_method()`)
   - Hash-prefixed private fields (`#field`)
   - @private or @internal annotated APIs
   - Core Foundry prototype modifications
3. Check for deprecated v12 patterns
4. Verify ESM usage
5. Check hook usage

**Code to review:**
[paste code]

**Constraints:**
- Only use APIs confirmed in the indexed Foundry v13 API Library
- Flag any unconfirmed API usages
- Note: Hooks are not awaited unless documented

**Provide:**
- List of API violations
- List of unconfirmed API usages (mark as "Not confirmed in indexed docs")
- Suggested fixes for each issue
- Severity rating (low/medium/high)
```

### 2. PF1 Actor Data Review

```
You are an expert Foundry VTT v13 + PF1 module developer.

**Task:** Review this PF1 actor data code.

**Context:**
- Foundry v13.350+
- PF1 system
- PF1.5 house rules may apply

**Requirements:**
1. Only use confirmed PF1 APIs from the indexed docs
2. If a data path or method is not confirmed, mark it as such
3. Check for PF1.5 compatibility issues
4. Verify error handling
5. Check for performance issues

**Code to review:**
[paste code]

**Provide:**
- List of confirmed API usages
- List of unconfirmed data paths/methods (mark as "Not confirmed in indexed PF1 API docs")
- PF1.5 compatibility notes
- Suggested improvements
```

### 3. PF1.5 Action Tracker Implementation

```
You are an expert Foundry VTT v13 + PF1 module developer.

**Task:** Help me implement a PF1.5 action tracker (3 actions + 1 reaction per turn).

**Context:**
- Foundry v13.350+
- PF1 system (does NOT natively support PF1.5)
- Need: Track 3 actions + 1 reaction per round
- Display: Token HUD, combat tracker, character sheet

**Requirements:**
1. Use only confirmed PF1 hooks
2. Use flags for tracking (module-owned data)
3. Reset on turn start and combat start
4. Block actions when out of actions/reactions
5. Display remaining actions/reactions in UI
6. Use Croaker's Ledger visual style

**Constraints:**
- PF1 does not natively track actions this way
- Do not patch PF1 prototypes
- Use safe hook patterns

**Provide:**
- Complete implementation code
- Hook registrations
- UI display code (HTML/CSS)
- Action spending logic
- Reaction spending logic
- Visual styling for Croaker's Ledger theme
```

### 4. PF1.5 Condition Manager

```
You are an expert Foundry VTT v13 + PF1 module developer.

**Task:** Help me implement a PF1.5 condition manager with tiered and toggle conditions.

**Context:**
- PF1 has flat (binary) conditions natively
- PF1.5 needs tiered conditions (Fatigued 1, Fatigued 2)
- PF1.5 also uses toggle conditions (Blinded, Deafened)
- Need to apply penalties based on severity
- Need to display severity in UI

**Tiered Conditions:**
- fatigued: max tier 2
- exhausted: max tier 1
- staggered: max tier 1

**Toggle Conditions:**
- blinded
- deafened
- dazed
- stunned

**Requirements:**
1. Track severity per condition per actor
2. Apply penalties in roll hooks
3. Display severity in token HUD
4. Don't break PF1 native condition system
5. Use Croaker's Ledger visual style

**Provide:**
- Severity tracking implementation
- Roll modification code
- UI display code
- Integration with native PF1 conditions
- Visual styling
```

### 5. PF1 Roll/Action/Chat Debugging

```
You are an expert Foundry VTT v13 + PF1 module developer.

**Task:** Help me debug PF1 roll/action/chat card issues.

**Context:**
- Foundry v13.350+
- PF1 system
- PF1.5 house rules [enabled/disabled]

**Problem:**
[Describe the issue: rolls not firing, wrong values, chat cards broken, etc.]

**Current code:**
[paste relevant code]

**Error messages (if any):**
[paste error messages]

**Provide:**
- Analysis of the issue
- List of potential causes
- Debugging steps to try
- Suggested fixes
- Reference to relevant docs
```

### 6. Module.json Validation

```
You are an expert Foundry VTT v13 module developer.

**Task:** Validate this module.json for Foundry v13.350+.

**Module.json:**
[paste module.json]

**Requirements:**
1. Check for valid JSON
2. Check for required fields
3. Check for correct field types
4. Check for PF1 system dependency
5. Check for ES module configuration
6. Check for update/install URLs

**Provide:**
- List of issues found
- Suggested fixes
- Severity rating
- Validated fields
```

### 7. Croaker's Ledger CSS Review

```
You are an expert UI/UX designer for Foundry VTT modules.

**Task:** Review this CSS for Croaker's Ledger theme compatibility.

**Theme Requirements:**
- Muddy parchment background colors
- Scuffed leather texture patterns
- Iron-gall ink dark colors
- Tarnished brass accent colors
- Dried blood red accents (sparingly)
- High contrast for readability
- Fast tactical use (no laggy animations)

**CSS to review:**
[paste CSS]

**Provide:**
- Theme compliance assessment
- Suggested color adjustments
- Readability improvements
- Performance considerations
```

---

## Using Both Reference Packs

### How to Reference Documentation

**Foundry v13 Core Pack** covers:

- Platform APIs (`foundry.*` namespace)
- Core document classes
- ApplicationV2 framework
- Canvas, layers, placeables
- General hooks and settings
- Utility classes

**PF1 System Pack** covers:

- PF1-specific classes (`pf1.*` namespace)
- PF1 data models
- PF1 registries
- PF1-specific hooks
- PF1 dice and rolls
- PF1 documents and applications

### Cross-Reference Prompt

```
Use both the Foundry v13 API reference pack AND the PF1 API reference pack.

For Foundry core features, use the Foundry v13 docs.
For PF1-specific features, use the PF1 docs.

If a class or method is in the foundry namespace, use Foundry v13 docs.
If a class or method is in the pf1 namespace, use PF1 docs.

When in doubt, check both packs and note which one confirms the API.
If an API is not in either pack, mark it as "Not confirmed in indexed docs."
```

---

## Debugging Commands

```bash
# Check Foundry version
cat resources/app/package.json | grep version

# Check PF1 system version
cat User Data/systems/pf1/system.json | grep version

# Check module loading
grep -r "my-module" foundryvtt/data/modules/

# Validate module.json
jq . module.json

# Check for deprecated API usage (underscore methods)
grep -r "_\." scripts/ | grep -v "node_modules" | grep -v "\.min\."

# Check for global references (should use foundry.* namespace)
grep -r "Actor\|Item\|Scene\|Hooks" scripts/ | grep -v "foundry\." | grep -v "import"

# Check ES module imports
grep -r "import\|export" scripts/ | head -20
```

---

## GitHub Integration

### Pull Request Template

```markdown
## Description

[Describe changes and purpose]

## Foundry Compatibility

- [ ] Tested with Foundry VTT v13.350+
- [ ] No deprecated APIs used
- [ ] ES modules configured correctly

## PF1 Compatibility

- [ ] Tested with PF1 system
- [ ] Only confirmed PF1 APIs used
- [ ] PF1 hooks used correctly

## PF1.5 Compatibility

- [ ] PF1.5 features tested
- [ ] PF1.5 features can be disabled
- [ ] Vanilla PF1 not affected

## Changes

- [ ] New feature
- [ ] Bug fix
- [ ] Performance improvement
- [ ] Documentation update

## Testing

- [ ] Tested in single player
- [ ] Tested in multiplayer
- [ ] Tested with various PF1 actor types
- [ ] Tested with various PF1 item types
- [ ] No console errors
- [ ] No console warnings

## Checklist

- [ ] Code follows Foundry v13 best practices
- [ ] Code follows PF1 best practices
- [ ] Only confirmed APIs used
- [ ] PF1.5 code clearly separated
- [ ] Error handling comprehensive
- [ ] Documentation updated
```

### CI/CD Workflow

```yaml
# .github/workflows/test.yml
name: Foundry + PF1 Module Tests

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Check for unconfirmed APIs
        run: node scripts/check-apis.js

  test:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
```

---

## Common Pitfalls & Solutions


| Pitfall                       | Solution                    | Prompt                                    |
| ----------------------------- | --------------------------- | ----------------------------------------- |
| Using unconfirmed APIs        | Check both reference packs  | "Is [API] confirmed in the indexed docs?" |
| Assuming PF1.5 native support | Implement in module         | "How do I implement PF1.5 [feature]?"     |
| Mutating pf1.config           | Use module settings         | "How do I safely store config?"           |
| Wrong hook timing             | Use correct lifecycle hooks | "Which hook should I use for [task]?"     |
| Missing error handling        | Add try/catch               | "Add error handling to this code"         |
| CSS conflicts                 | Scope with module ID        | "How do I scope this CSS?"                |
| Prototype patching            | Use hooks instead           | "How do I extend [class]?"                |
| Async without await           | Handle internally           | "How do I handle async in hooks?"         |


---

## Questions This File Should Answer

- How do I set up Claude Code for Foundry + PF1 development?
- What project structure works best?
- What custom commands should I create?
- How do I write effective prompts for Foundry + PF1?
- How do I review code with Claude Code?
- How do I debug modules with Claude Code?
- How do I use both reference packs together?
- What GitHub integration works well?
- What are common pitfalls and how do I avoid them?

---

## Source Pages Consulted

### Foundry VTT v13

- [Foundry VTT v13 API Documentation](https://foundryvtt.com/api/v13/index.html)
- [Introduction to Module Development](https://foundryvtt.com/article/module-development/)
- [Package Management](https://foundryvtt.com/article/package-management/)
- [Module Management](https://foundryvtt.com/article/modules/)
- [API Migration Guides](https://foundryvtt.com/article/migration/)

### Pathfinder 1e

- [Pathfinder 1e for Foundry VTT Documentation](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/index.html)
- [PF1 Module: pf1](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/pf1.html)
- [PF1 Hook Events](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/modules/hookEvents.html)

### Previously Created References

- All files in Foundry v13 core reference pack
- All files in PF1 system reference pack

---

*Last updated: May 3, 2026 | Foundry VTT v13.350+ | Pathfinder 1e System | PF1.5 Framework | Claude Code*

---

## FILE: 03_Claude_Code_PF1_Module_Addendum.md

# Claude Code PF1 Module Development Addendum

## Purpose

Claude Code-specific guidance for Pathfinder 1e Foundry VTT module development. Provides configuration tips, project structure recommendations, and prompt templates tailored for PF1 + PF1.5 development.

## When to Use This

- Setting up Claude Code for PF1 module development
- Configuring `.claude` files for PF1 projects
- Writing effective prompts for PF1 development
- Debugging PF1 modules with AI assistance
- Reviewing PF1 code with AI

---

## Core Configuration

### `.claudeignore` for PF1 Projects

```
# Foundry VTT
foundryvtt/
node_modules/
dist/
*.min.js
*.min.css

# Build artifacts
build/
dist/
*.zip

# IDE files
.idea/
.vscode/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Environment
.env
.env.*

# PF1-specific
systems/pf1/  # Exclude PF1 system files from indexing
User Data/systems/pf1/

# Temporary files
tmp/
temp/
```

### `.clauderc` or `claude.json` for PF1

```json
{
  "workspace": {
    "trustedFolders": [
      ".",
      "../FoundryVTT"  // If you have local Foundry install
    ]
  },
  "git": {
    "autoStage": false
  },
  "code": {
    "maxTokens": 16384,
    "temperature": 0.3,
    "model": "claude-3-5-sonnet-20250620"
  }
}
```

**Note**: Lower temperature (0.3) for more deterministic PF1 API usage.

---

## Project Structure for PF1 + PF1.5 Modules

```
my-pf1-module/
├── .claude/                  # Claude Code configuration
│   ├── commands/            # Custom commands
│   │   └── pf1.md           # PF1-specific commands
│   └── ignore               # Additional ignore patterns
│
├── .github/                  # GitHub configuration
│   └── workflows/           # CI/CD
│
├── src/                     # Source files
│   ├── module.mjs           # Main entry point
│   ├── settings.mjs         # Settings registration
│   │
│   ├── hooks/               # Hook handlers
│   │   ├── actor.mjs        # Actor-related hooks
│   │   ├── combat.mjs       # Combat-related hooks
│   │   ├── item.mjs         # Item-related hooks
│   │   ├── rolls.mjs        # Roll-related hooks
│   │   └── ui.mjs           # UI-related hooks
│   │
│   ├── pf1/                 # PF1-specific code
│   │   ├── actions/         # PF1.5 action tracking
│   │   │   └── tracker.mjs  # Action/reaction tracker
│   │   ├── conditions/      # PF1.5 condition system
│   │   │   ├── tiered.mjs   # Tiered condition handling
│   │   │   └── toggle.mjs   # Toggle condition handling
│   │   └── utils.mjs        # PF1 utilities
│   │
│   ├── models/              # Custom data models
│   │   └── extensions.mjs   # PF1 model extensions
│   │
│   ├── ui/                  # UI components
│   │   ├── hud/             # HUD elements
│   │   │   └── action-hud.mjs
│   │   └── sheets/          # Sheet extensions
│   │
│   └── lang/                # Localization
│       └── en.json
│
├── templates/               # Handlebars templates
│   ├── action-hud.hbs
│   └── condition-display.hbs
│
├── assets/                  # Static assets
│   ├── css/
│   │   ├── module.css       # Main styles
│   │   └── croakers-ledger.css  # PF1.5 theme
│   └── images/
│       └── icons/
│
├── docs/                    # Documentation
│   ├── API_REFERENCE.md
│   └── PF1_5_DESIGN.md      # PF1.5 architecture notes
│
├── module.json              # Module manifest
├── package.json             # Node.js metadata
├── README.md                # Module documentation
└── .gitignore
```

---

## Custom Commands for PF1 Development

Create `.claude/commands/pf1.md`:

```markdown
# Pathfinder 1e Foundry Module Development Commands

## Module Setup
- "Create a PF1 module for Foundry VTT v13.350+ with ES modules, proper manifest for PF1 system, and basic structure"
- "Generate a module.json for a PF1 module that [purpose] with compatibility for 13.350+ and PF1 system dependency"
- "Create a PF1.5 module structure with action tracker, condition system, and UI components"

## PF1 Data Access
- "Show me how to safely access PF1 actor data using only confirmed APIs from the indexed docs"
- "What are the confirmed PF1 actor types and their corresponding model classes?"
- "How do I query PF1 items by type using confirmed item types?"
- "Show me safe patterns for reading PF1 document data without assuming unconfirmed paths"

## PF1.5 Implementation
- "Generate a PF1.5 action tracker (3 actions + 1 reaction) using flags and hooks"
- "Create a tiered condition system for PF1.5 with severity levels"
- "Show me how to modify PF1 rolls to apply PF1.5 tiered condition penalties"
- "Generate code to display PF1.5 action economy in token HUDs and sheets"

## PF1 Hooks
- "List all confirmed PF1 hooks with their arguments and use cases"
- "Show me how to use pf1PreActionUse hook to implement PF1.5 action costs"
- "How do I intercept PF1 rolls to add PF1.5 modifiers?"
- "What's the difference between pf1Pre* and pf1* hooks?"

## PF1 UI
- "Show me how to add custom buttons to PF1 actor sheets without patching"
- "How do I extend PF1 quick actions with custom actions?"
- "Create a custom PF1.5 HUD overlay for action tracking"
- "Show me how to style UI with Croaker's Ledger theme (muddy parchment, scuffed leather, iron-gall ink)"

## Debugging
- "Help me debug why my PF1 hook isn't firing. Here's my code: [paste]"
- "What are common reasons for [specific error] in PF1 module development?"
- "My PF1.5 action tracker isn't working. Here's my implementation: [paste]"
- "How do I check if a PF1 data path is confirmed in the API docs?"

## Best Practices
- "What are the best practices for PF1 module development in Foundry v13?"
- "Show me examples of safe PF1 module patterns"
- "What should I avoid when writing PF1 modules?"
- "How do I ensure my PF1.5 module doesn't break vanilla PF1?"
```

---

## Effective Prompt Templates

### PF1 Code Review Prompt

```
You are an expert Foundry VTT v13 + PF1 module developer.

**Context:**
- Foundry VTT version: 13.350+
- Game system: Pathfinder 1e (pf1)
- Module type: [describe module purpose]

**Requirements:**
1. Review this code for PF1 API safety
2. Identify any unconfirmed APIs, methods, or data paths
3. Check for PF1.5 compatibility issues
4. Verify error handling
5. Check for performance issues

**Code to review:**
[paste code]

**Constraints:**
- Only use APIs confirmed in the indexed PF1 API Library
- Flag any usage of unconfirmed data paths or methods
- Note: PF1 does NOT natively support PF1.5 rules
- Use only public APIs

**Provide:**
- List of confirmed issues
- List of unconfirmed API usages (mark as "Not confirmed in indexed PF1 API docs")
- Suggested fixes
- Severity rating for each issue
```

### PF1 Actor Data Prompt

```
You are an expert Foundry VTT v13 + PF1 module developer.

**Task:** Help me work with PF1 actor data safely.

**Context:**
- I need to [describe what you're trying to do]
- I'm using Foundry v13.350+ with PF1 system
- I need to support PF1.5 house rules

**Requirements:**
1. Only use confirmed PF1 APIs from the indexed docs
2. If a data path or method is not confirmed, say "Not confirmed in indexed PF1 API docs"
3. Provide safe patterns for accessing the data
4. Include PF1.5 considerations

**Current approach:**
[paste your code or describe your approach]

**Provide:**
- Confirmed API usage
- Safe data access patterns
- PF1.5 compatibility notes
- Any warnings about unconfirmed assumptions
```

### PF1.5 Action Tracker Prompt

```
You are an expert Foundry VTT v13 + PF1 module developer.

**Task:** Help me implement a PF1.5 action tracker (3 actions + 1 reaction per turn).

**Context:**
- Foundry VTT v13.350+
- PF1 system (does NOT natively support PF1.5)
- Need to track: 3 actions + 1 reaction per round
- Need to display in: Token HUD, combat tracker, character sheet

**Requirements:**
1. Use only confirmed PF1 hooks
2. Use flags for tracking (module-owned data)
3. Reset on turn start and combat start
4. Block actions when out of actions/reactions
5. Display remaining actions/reactions in UI

**Constraints:**
- PF1 does not natively track actions this way
- Do not patch PF1 prototypes
- Use safe hook patterns

**Provide:**
- Complete implementation code
- Hook registrations
- UI display code
- Action spending logic
- Reaction spending logic
```

### PF1.5 Tiered Conditions Prompt

```
You are an expert Foundry VTT v13 + PF1 module developer.

**Task:** Help me implement PF1.5 tiered conditions.

**Context:**
- PF1 has flat (binary) conditions
- PF1.5 needs tiered conditions (e.g., Fatigued 1, Fatigued 2)
- Need to apply penalties based on severity
- Need to display severity in UI

**Tiered Conditions:**
- fatigued: max tier 2
- exhausted: max tier 1
- staggered: max tier 1

**Requirements:**
1. Track severity per condition per actor
2. Apply penalties in roll hooks
3. Display severity in token HUD
4. Don't break PF1 native condition system

**Provide:**
- Severity tracking implementation
- Roll modification code
- UI display code
- Integration with native PF1 conditions where possible
```

### PF1 Roll Modification Prompt

```
You are an expert Foundry VTT v13 + PF1 module developer.

**Task:** Help me modify PF1 rolls to add custom bonuses.

**Context:**
- Using confirmed PF1 roll hooks
- Need to add bonuses based on [describe conditions]
- Foundry v13.350+, PF1 system

**Requirements:**
1. Use only confirmed PF1 hooks (pf1PreD20Roll, pf1PreAttackRoll, etc.)
2. Modify rollConfig in pre-hooks, not the roll itself
3. Don't break existing roll behavior
4. Include PF1.5 considerations if applicable

**Current code:**
[paste code]

**Provide:**
- Correct hook usage
- Safe roll modification patterns
- Error handling
- Any PF1.5 considerations
```

### PF1 + v13 Compatibility Prompt

```
You are an expert Foundry VTT v13 + PF1 module developer.

**Task:** Check if my module is compatible with Foundry v13.350+ and PF1.

**Context:**
- Foundry version: 13.350+
- Game system: Pathfinder 1e
- Module code: [paste relevant sections]

**Requirements:**
1. Check for deprecated Foundry v13 APIs
2. Check for PF1 API usage
3. Verify ESM module usage
4. Check for underscore-prefixed method calls
5. Verify hook usage

**Provide:**
- List of compatibility issues
- List of deprecated API usages
- Suggested fixes
- Version compatibility assessment
```

---

## Working with Both Reference Packs

### How to Use the Reference Docs Together

**Foundry v13 Core Pack** covers:

- Base Foundry APIs (`foundry.*`)
- Core document classes
- ApplicationV2 framework
- Canvas, layers, placeables
- General hooks and settings
- Utility classes

**PF1 System Pack** covers:

- PF1-specific classes (`pf1.*`)
- PF1 data models
- PF1 registries
- PF1-specific hooks
- PF1 dice and rolls
- PF1 documents and applications

### When to Consult Which Pack


| Task                      | Primary Pack       | Secondary Pack                  |
| ------------------------- | ------------------ | ------------------------------- |
| Using ApplicationV2       | Foundry v13        | -                               |
| Using PF1 actor data      | PF1                | Foundry v13 (for base Document) |
| Using canvas layers       | Foundry v13        | PF1 (for PF1-specific layers)   |
| Using PF1 hooks           | PF1                | Foundry v13 (for hook system)   |
| Creating custom documents | Foundry v13        | PF1 (for PF1 document types)    |
| Working with rolls        | PF1 (for PF1 dice) | Foundry v13 (for base Roll)     |


### Prompt for Cross-Reference

```
Use both the Foundry v13 API reference pack AND the PF1 API reference pack.

For Foundry core features, use the Foundry v13 docs.
For PF1-specific features, use the PF1 docs.

If a class or method is in the PF1 namespace (pf1.*), use PF1 docs.
If a class or method is in the foundry namespace, use Foundry v13 docs.

When in doubt, check both packs and note which one confirms the API.
```

---

## Debugging with Claude Code

### Debugging Commands

```bash
# Check Foundry version
cat resources/app/package.json | grep version

# Check PF1 system version
cat User Data/systems/pf1/system.json | grep version

# Check module loading
grep -r "my-pf1-module" foundryvtt/data/modules/

# Validate module.json
jq . module.json

# Check for deprecated API usage
grep -r "_" src/ | grep -v "node_modules" | grep -v "\.min\."
```

### Debugging Prompts

```
"My PF1 module isn't working. Here's what I'm seeing:
- Error message: [paste error]
- Code that triggers it: [paste code]
- Foundry version: 13.350+
- PF1 system version: [version]

What could be causing this?"

"My hook isn't firing. Here's my registration:
[Hooks.on('pf1SomeHook', ...)]

What should I check?"

"My PF1.5 action tracker is losing track of actions. Here's my code:
[paste code]

What's wrong?"

"I'm getting undefined when accessing [data path]. Here's my code:
[paste code]

Is this path confirmed in the PF1 API docs?"
```

---

## GitHub Integration

### PF1 Module Pull Request Template

```markdown
## Description

[Describe the changes and their purpose]

## PF1 Compatibility

- [ ] Tested with PF1 system v[X.Y.Z]
- [ ] Tested with Foundry VTT v13.350+
- [ ] No PF1 API violations
- [ ] Only confirmed PF1 APIs used

## PF1.5 Compatibility (if applicable)

- [ ] PF1.5 features tested
- [ ] PF1.5 features can be disabled
- [ ] Vanilla PF1 not affected

## Changes Made

- [ ] New feature
- [ ] Bug fix
- [ ] Performance improvement
- [ ] Documentation update
- [ ] PF1.5 compatibility layer

## Testing

- [ ] Tested with PF1 actors (character, npc, etc.)
- [ ] Tested with PF1 items (spell, weapon, feat, etc.)
- [ ] Tested combat functionality
- [ ] Tested roll modifications
- [ ] Tested in multiplayer
- [ ] No console errors
- [ ] No console warnings

## Checklist

- [ ] Code follows Foundry v13 best practices
- [ ] Code follows PF1 best practices
- [ ] Only confirmed PF1 APIs used
- [ ] PF1.5 code is clearly separated
- [ ] Error handling is comprehensive
- [ ] Documentation updated
- [ ] All tests pass
```

### CI/CD for PF1 Modules

```yaml
# .github/workflows/test.yml
name: PF1 Module Tests

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Check for unconfirmed APIs
        run: node scripts/check-pf1-apis.js

  test:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
```

---

## Common Pitfalls & Solutions


| Pitfall                       | Solution                     | Claude Prompt                                      |
| ----------------------------- | ---------------------------- | -------------------------------------------------- |
| Using unconfirmed data paths  | Check PF1 API docs           | "Is [data path] confirmed in PF1 API docs?"        |
| Assuming PF1.5 native support | Implement in module          | "How do I implement PF1.5 [feature] in my module?" |
| Mutating pf1.config           | Use module settings          | "How do I safely store custom config?"             |
| Wrong hook timing             | Use pre/post hooks correctly | "Which hook should I use for [task]?"              |
| Missing error handling        | Add try/catch                | "Add error handling to this code: [paste]"         |
| CSS conflicts                 | Scope with module ID         | "How do I scope this CSS?"                         |
| Prototype patching            | Use hooks instead            | "How do I extend [class] without patching?"        |


---

## Questions This File Should Answer

- How do I set up Claude Code for PF1 module development?
- What project structure works best for PF1 + PF1.5 modules?
- What custom commands should I create for PF1 development?
- How do I write effective prompts for PF1 module development?
- How do I debug PF1 modules with Claude Code?
- How do I review PF1 code with Claude Code?
- How do I use both reference packs together?
- What GitHub integration works well for PF1 modules?
- What are common PF1 module issues and how do I solve them?
- How do I ensure my prompts reference the correct API documentation?

---

## Source Pages Consulted

- [Claude Code Documentation](https://code.claude.ai/)
- [Foundry VTT v13 API Documentation](https://foundryvtt.com/api/v13/index.html)
- [Pathfinder 1e for Foundry VTT Documentation](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/index.html)

---

*Last updated: May 3, 2026 | Foundry VTT v13.350+ | Pathfinder 1e System | Claude Code*

---
