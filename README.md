# Echoes of Baphomet — PF1.5 House Rules Module

**For Foundry VTT v13.350 + Pathfinder 1e System**

Version 1.3.5 | [GitHub](https://github.com/Dade512/baphomet-utils)

---

## What This Module Does

- **Military Noir Theme** — Replaces Foundry's default parchment look with a slate/dark steel aesthetic, brutalist typography (Oswald headings, Bitter body, IBM Plex Mono for numbers/rolls), and tarnished gold accents. Subtle grain texture overlay for that worn-document feel.
- **Automated PF1.5 Condition Overlay** — 12 PF2e-style conditions implemented as native PF1e Buff items with full Token HUD integration. Tiered conditions (1–4) with automatic mechanical penalties, auto-decrement support, and a macro API.

---

## Installation

### Option A: Manual Install (Recommended)

1. Locate your Foundry Data folder:
   - **Windows:** `%LOCALAPPDATA%/FoundryVTT/Data/`
   - **macOS:** `~/Library/Application Support/FoundryVTT/Data/`
   - **Linux:** `~/.local/share/FoundryVTT/Data/`
   - Or check Foundry: **Settings → Configure → User Data Path**

2. Copy the entire `baphomet-utils` folder into `Data/modules/`. Your structure should be:

   ```
   Data/modules/baphomet-utils/
   ├── module.json
   ├── README.md
   ├── scripts/
   │   └── condition-overlay.js
   └── styles/
       ├── noir-theme.css
       └── condition-overlay.css
   ```

3. Launch Foundry → **Settings → Manage Modules** → Enable **"Echoes of Baphomet — PF1.5 House Rules"**.

### Option B: Manifest URL

In Foundry's **Add-on Modules** installer, paste:

```
https://github.com/Dade512/baphomet-utils/releases/latest/download/module.json
```

---

## Condition Overlay System

### Overview

Right-click any token (GM only) → click the **virus head icon** (🧠) in the Token HUD right column → opens a condition panel. Conditions are applied as PF1e system Buffs with mechanical penalties calculated automatically.

### 12 Conditions

#### Tiered Conditions (value 1–4)

| Condition | Icon | Auto-Decrement | Effect |
|-----------|------|:--------------:|--------|
| **Frightened** | terror | ✅ end of turn | –X to attack, saves, skills |
| **Sickened** | poison | ❌ (Retch action) | –X to attack, damage, saves, skills |
| **Stupefied** | daze | ❌ | –X to INT/WIS/CHA (cascades to Will, spell DCs) |
| **Clumsy** | falling | ❌ | –X to DEX (cascades to Reflex, AC, ranged) |
| **Enfeebled** | downgrade | ❌ | –X to STR (cascades to Fort, melee, carry) |
| **Drained** | blood | ❌ (long rest) | –X to CON (cascades to Fort, HP) + Max HP reduction |
| **Stunned** | stoned | ✅ as actions lost | Lose X actions (tracker, GM enforced) |
| **Slowed** | clockwork | ❌ | Lose X actions per turn (tracker, max 3) |
| **Fascinated** | eye | ❌ | –X to Perception and skills; Concentrate restriction |

#### Toggle Conditions (on/off)

| Condition | Icon | Effect |
|-----------|------|--------|
| **Fatigued** | unconscious | –1 AC, –1 saves; no run/charge |
| **Off-Guard** | target | –2 untyped AC (stacks with other penalties) |
| **Persistent Damage** | fire | Reminder/tracker; DC 15 flat check to end |

### How It Works

- Conditions create **PF1e Buff items** (`type: buff`, `subType: temp`) on the actor
- Mechanical penalties use `pf1.components.ItemChange` for system-native change tracking
- Buffs are flagged with `baphomet-utils.conditionKey` and `baphomet-utils.tier` for identification
- Auto-decrement hooks into `pf1PostTurnChange` (with `combatTurn` fallback)
- Chat messages announce condition changes with themed styling
- Panel auto-refreshes after each action (100ms delay for document processing)

### Token HUD Panel

- **Tiered section:** Each row shows condition name, auto-decrement indicator (↓), remove button (✕), and tier buttons (1–4)
- **Toggle section:** Each row shows condition name and ON/OFF toggle
- Active conditions highlighted with gold border and text
- Hover over condition names for tooltip descriptions

---

## Macro API

The module exposes `game.baphometConditions` for macro and script access:

```javascript
// Apply a condition at a specific tier
game.baphometConditions.apply(actor, 'frightened', 3)

// Remove a condition entirely
game.baphometConditions.remove(actor, 'clumsy')

// Adjust tier by delta (+1, -1, etc.)
game.baphometConditions.adjust(actor, 'sickened', -1)

// Get current tier (returns 0 if not active)
game.baphometConditions.getTier(actor, 'enfeebled')

// List all active conditions on an actor
game.baphometConditions.listActive(actor)
```

### Condition Keys

Use these exact strings with the API:

`frightened` · `sickened` · `stupefied` · `clumsy` · `enfeebled` · `drained` · `stunned` · `slowed` · `fascinated` · `fatigued` · `offGuard` · `persistentDamage`

---

## Theme Details

### Fonts

| Font | Usage |
|------|-------|
| **Oswald** | Headings, tabs, window titles — condensed, industrial, commanding |
| **Bitter** | Body text, descriptions, journal content — readable slab-serif |
| **IBM Plex Mono** | Dice rolls, timestamps, mechanical values — clean monospace |

### Color Palette

| Role | Color | Hex |
|------|-------|-----|
| Background (darkest) | Dark slate | `#0f1114` – `#353c47` |
| Text (primary) | Cool grey | `#c8ccd4` |
| Text (secondary) | Muted grey | `#8a919d` |
| Accent | Tarnished gold | `#b8943e` (bright: `#d4aa4f`) |
| Danger | Muted crimson | `#8b3a3a` |

### Customization

All colors and fonts are CSS variables in the `:root` block of `noir-theme.css`. Edit them to adjust the entire palette without touching any other selectors.

---

## PF1.5 Action Economy Quick Reference

This module supports the **PF1.5 hybrid action economy** used in the Echoes of Baphomet campaign:

- **3 actions per turn** (replaces standard/move/swift)
- **Assault** (1 action): Full attack sequence — 1st and 2nd attacks at full BAB, 3rd+ at –5 cumulative
- **Spellcasting:** Standard action spells = 2 actions, full-round = 3 actions
- **1 Reaction per round:** AoO, counterspells, readied actions, Legacy Item abilities
- **Half-level damage bonus:** All PCs add floor(Level ÷ 2) to damage rolls
- **Inherent DR:** DR 1/– at level 5, +1 per odd level thereafter

See `Homebrew_Master_File.md` for complete rules.

---

## Troubleshooting

### Condition panel doesn't appear

1. Verify the module is enabled in **Settings → Manage Modules**
2. Check that you're logged in as GM (panel is GM-only)
3. Open browser console (F12) and look for:
   ```
   baphomet-utils | PF1.5 Condition Overlay v2.1.1 ready.
   ```
4. If you see `v2` instead of `v2.1.1`, the old file is cached — replace `condition-overlay.js` in your module folder

### Verify file version

Run in browser console (F12):
```javascript
fetch('modules/baphomet-utils/scripts/condition-overlay.js')
  .then(r => r.text())
  .then(t => console.log(t.substring(0, 200)))
```
Should show `v2.1.1` in the header.

### Known unrelated errors

The following console errors are from **other modules or the PF1e system**, not baphomet-utils:

- `e.find is not a function` at `index.js` — Another module using jQuery `.find()` on v13 hooks
- v13 deprecation warnings from `pf1.mjs` — PF1e system catching up to v13 API changes
- `polygon cannot be computed` — Canvas/lighting issue on specific scenes

---

## Changelog

### v1.3.5 (2026-02-18)
- Condition overlay script v2.1.1: v13-compatible Token HUD integration
- Fixed: `html.find is not a function` error (v13 passes HTMLElement, not jQuery)
- Fixed: Deprecated `game.system.template.Item` API for buff creation
- Added `scripts/` directory to repository (was missing from v1.0.0)
- Updated README with full condition system documentation and macro API

### v1.3.1
- Added `condition-overlay.css` styles
- Module.json updated with esmodules and styles declarations

### v1.0.0 (2026-02-10)
- Initial release: Military noir theme only
- Manual condition setup instructions in README

---

## License

Private module for the Echoes of Baphomet's Fall campaign.

## Credits

Built for Foundry VTT v13 + Pathfinder 1e system.
