# Foundry VTT v13 + Pathfinder 1e API Reference

Source of truth. Rules in this file are upstream-defined; do not override.
If a class/method/path/hook is not listed here AND not in the uploaded v13 docs, do not invent — request the page.

---

## 1. Module File Structure

- `module.json` — manifest
- `scripts/` — ES modules (`.mjs` or `.js`); ESM mandatory since v13.338
- `templates/` — Handlebars `.hbs`; mirror core structure
- `styles/` — module-scoped CSS
- `lang/` — localization JSON

### Manifest essentials
- Required for in-app installer: `id`, `version`, `manifest`, `download`. Missing `download` or invalid JSON = silent install failure.
- Use `"esmodules": ["scripts/main.mjs"]`. Do NOT use legacy `"scripts"`.
- `compatibility.minimum` ≥ 13 for v13-only modules.
- Custom subtypes: declare under document `types` block, register a `foundry.abstract.TypeDataModel` subclass:
  ```javascript
  CONFIG.Actor.dataModels.myCustomType = MyCustomActorDataModel;
  ```

---

## 2. Foundry Lifecycle (Verified Order)

Once-hooks fire exactly once per page load, in this sequence:
1. `init`
2. `i18nInit`
3. `setup`
4. `initializeDynamicTokenRingConfig`
5. `initializeCombatConfiguration`
6. `canvasConfig` (only if Canvas enabled)
7. `ready`

```javascript
Hooks.once("init",  () => { /* CONFIG, class registration, settings */ });
Hooks.once("setup", () => { /* post-system, pre-world-load */ });
Hooks.once("ready", () => { /* world + documents fully loaded */ });
```

For PF1-aware module init, prefer `pf1PostInit` / `pf1PostSetup` / `pf1PostReady` (see §10) — they fire after PF1 has bootstrapped its own config.

---

## 3. Render Hooks

V2 render hooks pass native `HTMLElement`. V1 still passes jQuery.
```javascript
Hooks.on("renderApplicationV2", (app, element, context) => { /* element: HTMLElement */ });
Hooks.on("closeApplicationV2",  (app, element)          => {});
Hooks.on("renderApplicationV1", (app, html, data)       => { /* html: jQuery */ });
```
Use `element.querySelector()`, never `$()`.

---

## 4. Namespaced API Paths

Prefer namespaces over legacy globals.

- `foundry.applications.api.ApplicationV2`
- `foundry.applications.api.HandlebarsApplicationMixin`
- `foundry.applications.api.DocumentSheetV2`
- `foundry.applications.api.DialogV2`
- `foundry.applications.api.CategoryBrowser`
- `foundry.applications.sheets.ActorSheetV2` / `ItemSheetV2`
- `foundry.applications.apps.DocumentSheetConfig`
- `foundry.applications.apps.FilePicker`
- `foundry.documents.Actor` / `Item` / `Scene` / `BaseActor` / `BaseItem`
- `foundry.abstract.Document` / `DataModel` / `TypeDataModel`
- `foundry.helpers.Hooks`
- `foundry.utils.*` — `mergeObject`, `getProperty`, `setProperty`, `deepClone`, `duplicate`, `isEmpty`
- `foundry.canvas.*`
- `foundry.data.*` — `StringField`, `NumberField`, `SchemaField`, etc.

---

## 5. Documents

- **Primary** (`Actor`, `Item`, `Scene`, `ChatMessage`, `Combat`): own DB tables, global lookup.
- **Embedded** (`ActiveEffect`, `Token`, `Item`-on-Actor): live in parent's `EmbeddedCollection`.
- Modules CANNOT define new embedded relationships — server validates schema.
- Override core classes via `CONFIG`, never by mutating prototypes:
  ```javascript
  CONFIG.Actor.documentClass     = MyActor;
  CONFIG.Actor.dataModels.myType = MyActorTypeModel;
  ```

---

## 6. ApplicationV2

`ApplicationV2` extends `EventEmitter`. It does NOT include `HandlebarsApplicationMixin` by default — mix it in for `PARTS` / Handlebars rendering.

```javascript
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class MyApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "my-app",
    classes: ["my-mod", "ledger"],
    tag: "form",
    window:   { title: "My App", icon: "fas fa-cog", resizable: true },
    position: { width: 480 },
    actions:  { save: MyApp.#onSave },
    form: {
      handler: MyApp.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: true
    }
  };
  static PARTS = {
    body: { template: "modules/my-mod/templates/body.hbs" }
  };
  static TABS = {
    primary: { tabs: [{ id: "general" }, { id: "advanced" }], initial: "general" }
  };
}
```

### DEFAULT_OPTIONS keys (verified)
- `id`, `classes[]`, `tag` (default `"div"`)
- `window`: `{ title, icon, controls[], resizable, minimizable }`
- `position`: `{ width, height, top, left, scale, zIndex }`
- `actions`: `{ [name]: handlerFunction }`
- `form`: `{ handler, submitOnChange, closeOnSubmit }`

### Static properties
- `DEFAULT_OPTIONS`, `BASE_APPLICATION`, `RENDER_STATES`, `TABS`, `emittedEvents`
- `PARTS` is from `HandlebarsApplicationMixin`, NOT bare `ApplicationV2`.

### Lifecycle (verified call order)
1. `_preFirstRender(context, options)` — first render only
2. `_preRender(context, options)` — every render, awaited
3. `_prepareContext(options) → Promise<context>` — global context for all parts
4. `_renderHTML(context, options)` — produces HTML; subclasses must implement
5. `_replaceHTML(...)` — applies result to DOM
6. `_postRender(context, options)`
7. `_onFirstRender(context, options)` — first render only
8. `_onRender(context, options)` — every render

Close path: `_preClose(options) → _onClose(options)`. `_onClose` is NOT awaited.

`HandlebarsApplicationMixin` adds `_preparePartContext(partId, context, options)` for per-part data.

### Action handlers
- HTML: `<button data-action="save">Save</button>`
- Signature: `static async handler(event, target)` where `target` is the clicked `HTMLElement`.
- `_onClickAction(event, target)` is a fallback — only invoked for `data-action` values WITHOUT a handler in `DEFAULT_OPTIONS.actions`. Don't override expecting universal behavior.

### Form handling — two distinct signatures
- `DEFAULT_OPTIONS.form.handler` callback: `static async handler(event, form, formData)` — what you write for submission logic.
- Internal lifecycle method: `_onSubmitForm(formConfig, event)` — protected; only override when extending core submit behavior.
- Input changes: `_onChangeForm(formConfig, event)`.

---

## 7. DocumentSheetV2

Extends `ApplicationV2` for `foundry.abstract.Document` instances. Handles permissions, document binding, submission-to-update plumbing.

### Binding
- Constructed with `new MySheet({ document: doc })`.
- Access via `this.document`.

### Submit pipeline (protected)
1. `_processFormData(event, form, formData)` — alter raw `FormData` before object conversion.
2. `_prepareSubmitData(event, form, formData)` — convert to update-shaped object.
3. `_processSubmitData(event, form, submitData)` — executes `this.document.update(submitData)`.

### Registration
```javascript
DocumentSheetConfig.registerSheet(Actor, "my-module", MyActorSheetV2, {
  types: ["character", "npc"],
  makeDefault: true,
  label: "My Custom Sheet"
});
```

---

## 8. DialogV2

Replaces legacy `Dialog`. Inherits from `ApplicationV2`.

### Static helpers
- `DialogV2.confirm({ window:{title}, content, yes:{callback}, no:{callback}, rejectClose })` → `Promise<boolean>`
- `DialogV2.prompt({ window:{title}, content, ok:{callback}, rejectClose })` → `Promise<callbackReturn>`
- `DialogV2.wait({ window:{title}, content, buttons:[...], rejectClose })` → generic

### Button shape
```javascript
buttons: [{
  action: "myAction",
  label: "Click Me",
  icon: "fas fa-check",
  default: true,
  callback: (event, button, dialog) => true
}]
```

---

## 9. Foundry Hook Reference (verified v13)

### Cancellability rule
Pre-hooks return `boolean | void`. Returning `false` cancels.
**CRITICAL:** Hooks are never awaited. An `async` handler returns a Promise, not `false`, so async pre-hooks CANNOT cancel. Pre-hook handlers must be synchronous if they need to cancel.

### "Generic" hooks fire under both generic and per-type names
`createDocument` AND `createActor` both fire when an Actor is created. Same for `update*`, `delete*`, `pre*`, and `renderApplicationV1`/V2.

### Application lifecycle
- `renderApplicationV2(app, element, context)` — `element` is HTMLElement
- `closeApplicationV2(app, element)`
- `getHeaderControlsApplicationV2(app, controls)` — add header buttons
- `getDocumentContextOptions(app, options)` — context menu items on document lists

### Document CRUD (cancellable: pre-hooks)
- `preCreateDocument(doc, data, options, userId)` / `createDocument(doc, options, userId)`
- `preUpdateDocument(doc, changes, options, userId)` / `updateDocument(doc, changes, options, userId)`
- `preDeleteDocument(doc, options, userId)` / `deleteDocument(doc, options, userId)`

### ActiveEffect
- `applyActiveEffect(actor, change, current, delta, changes)`

### Combat
- `combatStart(combat, updateData)`
- `combatRound(combat, updateData, updateOptions)`
- `combatTurn(combat, updateData, updateOptions)`
- `combatTurnChange(combat, prior, current)`
- `initializeCombatConfiguration`

### Chat
- `renderChatMessageHTML(message, html, data)` — **replaces v12's `renderChatMessage`**. Code copied from v12 tutorials silently fails.
- `preCreateChatMessage(message, data, options, userId)` — return `false` to cancel
- `chatMessage(chatLog, message, chatData)` — fires when user submits chat input
- `chatBubbleHTML`

### Canvas
- `canvasInit(canvas)`, `canvasReady(canvas)`, `canvasTearDown(canvas)`, `canvasPan`, `canvasDraw`, `canvasConfig`

### Scene controls
- `getSceneControlButtons(controls)` — `controls` mutated in place. v13 argument shape changed from v12; do not assume legacy array form.

### Tokens (v13 movement system — major v12 change)
- `preMoveToken(token, movement)` — cancellable
- `moveToken(token, movement)`
- `recordToken`, `pauseToken`, `stopToken`
- `targetToken(user, token, targeted)`
- `applyTokenStatusEffect(token, statusId, active)`

### Misc
- `hotbarDrop(bar, data, slot)`
- `updateWorldTime(worldTime, dt, options, userId)`
- `error`, `hotReload`, `streamReady`

---

## 10. Pathfinder 1e (PF1) System

### Top-level namespaces under `pf1.*`
`actionUse`, `applications`, `canvas`, `chat`, `components`, `config`, `const`, `dice`, `documents`, `migrations`, `models`, `registry`, `tours`, `utils`.

`CONFIG.PF1` mirrors `pf1.config` for compatibility.

### `pf1.documents.*`
- Sub-namespaces: `actor`, `item`, `controls`, `macros`, `settings`
- Direct classes: `ActiveEffectPF`, `ChatMessagePF`, `CombatantPF`, `CombatPF`, `TokenDocumentPF`
- Note: PF1 extends `Combat` and `Combatant` — relevant when modifying combat flow.

### Document types
- Actors: `character`, `npc`
- Items: `weapon`, `equipment`, `spell`, `feat`, `buff`, `class`, `race`, `consumable`, `attack`
- Item data via `item.system`.

### PF1 hook cancellability rule
Each PF1 hook is dispatched via either `Hooks.call` (cancellable with `false`) or `Hooks.callAll` (not cancellable). Verify per-hook in PF1 docs before assuming a `pf1Pre*` hook is cancellable.

### Lifecycle (fires AFTER core Foundry equivalents)
- `pf1PostInit` — after PF1 init
- `pf1PostSetup` — after PF1 setup
- `pf1PostReady` — after PF1 fully ready
- Use these for module init that depends on PF1 being bootstrapped.

### Migration
- `pf1MigrationStarted`, `pf1MigrationFinished`
- Gate any module logic touching actor data on `pf1MigrationFinished`.

### Actor data preparation
- `pf1PrepareBaseActorData(actor)`
- `pf1PrepareDerivedActorData(actor)`
- `pf1AddDefaultChanges(actor, changes)`
- `pf1GetRollData(actor, rollData)`
- `pf1GetChangeFlat(...)`

### Rolling (Pre/Post pairs; pre is cancellable)
- `pf1PreD20Roll` / (no post; D20 roll is the primitive)
- `pf1PreActorRollSkill` / `pf1ActorRollSkill`
- `pf1PreActorRollSave` / `pf1ActorRollSave`
- `pf1PreActorRollAbility` / `pf1ActorRollAbility`
- `pf1PreActorRollBab` / `pf1ActorRollBab`
- `pf1PreActorRollCl` / `pf1ActorRollCl`
- `pf1PreActorRollConcentration` / `pf1ActorRollConcentration`
- `pf1PreAttackRoll` / `pf1AttackRoll`
- `pf1PreDamageRoll` / (no post in this name)
- `pf1ApplyDamage`, `pf1ApplyDamageTargetOptions`

### Action use pipeline (in order)
1. `pf1PreActionUse`
2. `pf1CreateActionUse`
3. `pf1PreDisplayActionUse`
4. `pf1DisplayCard`
5. `pf1PostActionUse`

### Combat (PF1-specific)
- `pf1CombatTurnSkip` — relevant for action-economy modifications

### Items / buffs / conditions
- `pf1ToggleActorBuff(actor, buff, active)`
- `pf1ToggleActorCondition(actor, condition, active)`
- `pf1ClassLevelChange(actor, classItem, oldLevel, newLevel)`
- `pf1CreateItemLink`, `pf1DeleteItemLink`

### Rest / XP
- `pf1ActorRest` / `pf1PreActorRest`
- `pf1PartyRest` / `pf1PrePartyRest`
- `pf1GainXp(actor, xp)`

### UI
- `pf1RenderQuickActions`
- `renderPF1ExtendedTooltip`
- `pf1HealthDeltaRender`
- `pf1DisplayCard` — chat card display (use this, NOT a hallucinated `renderItemActionSheet`)

### Registry
- `pf1RegisterRegistry` — extension point for module-defined registries

### Drop handlers
- `pf1DropContainerSheetData`

---

## 11. Privacy / API Stability

- `@public` — call freely
- `@protected` — override only via subclass
- `@internal` — core-only; never touch
- `_prefix` without annotation → treat as private
- `#privateMethod` — true JS private; external access is `SyntaxError`
- Private API breaks without deprecation. Module code uses Public API only.

---

## 12. Settings & Flags

- `init` hook: `game.settings.register(moduleId, key, config)` and `game.settings.registerMenu(...)` for ApplicationV2 setting menus.
- Per-document state: `doc.setFlag(moduleId, key, value)` / `doc.getFlag(...)` / `doc.unsetFlag(...)`.
- Never write to another module's flag namespace.

---

## 13. Verified Gotchas

- `Math.clamped(v, min, max)` is the Foundry helper. Native `Math.clamp` proposal is not interchangeable.
- Don't mix `await` with `.then()` in the same hook handler — race conditions.
- `getSceneControlButtons` argument shape changed in v13. Mutate what you're given.
- v13 core CSS variables (notably `theme-dark`) can override module styles. Use module-prefixed vars with hardcoded fallbacks.
- Linux self-host: modules in `Data/modules/` must be `chown -R foundry:foundry` and Foundry restarted.
- Render hooks pass native `HTMLElement` for V2 apps. `$()` will throw.
- v13 chat hook is `renderChatMessageHTML`, NOT `renderChatMessage`.
- `PARTS` requires `HandlebarsApplicationMixin`. Bare `ApplicationV2` ignores it.
- `_onClickAction` only fires for actions NOT registered in `DEFAULT_OPTIONS.actions`.
- Async pre-hooks CANNOT cancel (Promise ≠ false). Use sync handlers when cancellation matters.
- `renderItemActionSheet` does NOT exist in PF1 — use `pf1DisplayCard` for chat card hooks.
