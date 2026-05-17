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
