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