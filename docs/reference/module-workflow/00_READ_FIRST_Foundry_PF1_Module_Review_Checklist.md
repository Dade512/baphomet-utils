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
