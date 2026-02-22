# Echoes of Baphomet — PF1.5 House Rules Module

**For Foundry VTT v13.350 + Pathfinder 1e System**

Version 2.3.0 | [GitHub](https://github.com/Dade512/baphomet-utils)

---

## What This Module Does

- **Gaslamp Gothic Theme** — Replaces Foundry's default parchment look with warm, dark, weathered tones: tarnished leather, candlewax, foxed paper. Typography uses Courier Prime (headings, labels), Alegreya (body text), and IBM Plex Mono strictly for mechanical numbers. Tarnished gold accents, dried-blood red (`#5e1b14`), and a subtle grain texture overlay. No digital slate. No cyan. No neon.
- **Automated PF1.5 Condition Overlay** — 18 PF2e-style conditions implemented as native PF1e Buff items with full Token HUD integration. Tiered conditions (1–4) with automatic mechanical penalties, auto-decrement support, and a macro API. Panel uses CSS Grid layout with a corrupted-ink-bleed hover effect.
- **Action Economy Tracker** — Visual 3-action + reaction pip display in the Combat Tracker sidebar. Click to spend (triggers a shard-burn animation), auto-resets on turn advance, reads conditions to auto-lock lost actions. Supports Combat Reflexes feat detection.

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
   │   ├── condition-overlay.js
   │   └── action-tracker.js
   └── styles/
       ├── noir-theme.css
       ├── condition-overlay.css
       └── action-tracker.css
   ```

3. Launch Foundry → **Settings → Manage Modules** → Enable **"Echoes of Baphomet — PF1.5 House Rules"**.

### Option B: Manifest URL

In Foundry's **Add-on Modules** installer, paste:

```
https://github.com/Dade512/baphomet-utils/releases/latest/download/module.json
```

---

## Action Economy Tracker

### Overview

During active combat, every combatant in the Combat Tracker sidebar displays action pips:

```
◆ ◆ ◆ | ◇ [◇]        ← 3 gold actions + 1 verdigris reaction [+ cold iron AoO]
```

Click a pip to mark it as spent — triggers a brief shard-burn flare before settling into ash. Click again to restore it. Pips auto-reset when initiative advances to that combatant's turn.

All players and the GM can see all pips. GM can click any combatant's pips; players can click their own.

### Pip Colors

| Pip | Color | Meaning |
|-----|-------|---------|
| **Tarnished gold** | `#b8943e` | Action (available) |
| **Verdigris** | `#4b7a7a` | Reaction (available) |
| **Cold iron** | `#3a5a78` | Combat Reflexes bonus reaction (AoO only) |
| **Ash radial gradient** | dim | Spent (shard-burnt, gone) |
| **Dried blood** | `#5e1b14` | Condition-locked (lost to Stunned/Slowed/etc.) |

### Condition Integration

The action tracker reads conditions applied through the Condition Overlay system. At the start of a combatant's turn:

| Condition | Effect on Pips |
|-----------|---------------|
| **Stunned X** | X action pips auto-locked (dried blood) |
| **Slowed X** | X action pips auto-locked (dried blood) |
| **Staggered** | 2 action pips auto-locked (1 remains) |
| **Nauseated** | 2 action pips auto-locked (1 remains) |
| **Paralyzed** | All action + reaction pips locked |

Condition-locked pips cannot be toggled back by clicking. They display in dried-blood red with a "not-allowed" cursor. No shard-burn animation — they weren't spent, they were taken.

### Combat Reflexes

If an actor has a feat named "Combat Reflexes" in their item list, they automatically receive a bonus cold-iron reaction pip with the tooltip "AoO Only." This extra reaction can only be used for Attacks of Opportunity — not Legacy abilities, class features, or Readied Actions.

### PF1.5 Action Cost Reference

| Activity | Cost | Notes |
|----------|------|-------|
| Move (up to speed) | 1 | Cannot split between other actions |
| 5-Foot Step | 1 | Does not provoke AoO |
| Assault (all BAB attacks) | 1 | Once per turn. Full BAB, no iterative penalties. |
| Vital Strike | 1 | Single focused strike alternative to Assault |
| Cleave / Great Cleave | 1 | Initiates the chain |
| Skill (Demoralize, Feint, etc.) | 1 | |
| Aid Another | 1 | |
| Combat Maneuver (standalone) | 1 | Can also replace an attack within Assault |
| Stand from Prone | 1 | |
| Bardic Performance (start) | 1 | Free to maintain on subsequent turns |
| Lay on Hands (self) | 1 | |
| Cast (standard action spell) | 2 | fireball, cure wounds, etc. |
| Channel Energy | 2 | |
| Lay on Hands (other) | 2 | |
| Rapid Shot | 2 | 2 attacks at full BAB |
| Magus Spellstrike | 2 | Also consumes Reaction |
| Lancer Jump | 2 | Reduces to 1 action at level 13 |
| Spring Attack | 2 | Move + Strike, no AoO |
| Withdraw | 2 | Double speed, no provoke from start |
| Total Defense | 2 | +4 AC until start of next turn |
| Ready an Action | 2 | Triggers via Reaction pip |
| Draw Potion + Drink | 2 | Draw (1) + Drink (1) |
| Cast (full-round spell) | 3 | Summon Monster IV+, Gate, etc. |
| Coup de Grace | 3 | Full turn to execute helpless target |
| Draw Scroll + Cast | 3 | Draw (1) + Cast (2) |
| Lancer Dragoon Dive | 3 | AoE capstone (level 20) |
| Delay | Free | Changes initiative order |

### Action Tracker Macro API

```javascript
// Get a combatant's current pip state
game.baphometActions.getState(combatantId)
// Returns: { actionsRemaining, actionsTotal, reactionAvailable, combatReflexAvailable, conditionLocked }

// Reset all pips to full
game.baphometActions.reset(combatantId)

// Spend N action pips
game.baphometActions.spendAction(combatantId, 2)

// Spend the reaction pip
game.baphometActions.spendReaction(combatantId)
```

---

## Condition Overlay System

### Overview

Right-click any token (GM only) → click the **virus head icon** in the Token HUD right column → opens a condition panel. Conditions are applied as PF1e system Buffs with mechanical penalties calculated automatically.

The panel uses a CSS Grid layout. At 290px wide it renders two columns by default. Hovering a condition row triggers a subtle corrupted-ink-bleed effect (SVG turbulence filter) with a faint red wash — torn parchment, not a glitch.

### 18 Conditions

#### Tiered Conditions (value 1–4)

| Condition | Icon | Auto-Decrement | Effect |
|-----------|------|:--------------:|--------|
| **Frightened** | terror | ✅ end of turn | –X to attack, saves, skills |
| **Sickened** | poison | ❌ (Retch action) | –X to attack, damage, saves, skills |
| **Stupefied** | daze | ❌ | –X to INT/WIS/CHA (cascades to Will, spell DCs) |
| **Clumsy** | falling | ❌ | –X to DEX (cascades to Reflex, AC, ranged) |
| **Enfeebled** | downgrade | ❌ | –X to STR (cascades to Fort, melee, carry) |
| **Drained** | blood | ❌ (long rest) | –X to CON (cascades to Fort, HP) + Max HP reduction |
| **Stunned** | stoned | ✅ as actions lost | Lose X actions (auto-locks action tracker pips) |
| **Slowed** | clockwork | ❌ | Lose X actions per turn (auto-locks action tracker pips) |
| **Fascinated** | eye | ❌ | –X to Perception and skills; Concentrate restriction |

#### Toggle Conditions (on/off)

| Condition | Icon | Effect |
|-----------|------|--------|
| **Fatigued** | unconscious | –1 AC, –1 saves; no run/charge |
| **Off-Guard** | target | –2 untyped AC (stacks with other penalties) |
| **Persistent Damage** | fire | Reminder/tracker; DC 15 flat check to end |
| **Blinded** | blind | –2 attack, –4 Perception; GM: 50% miss chance, lose DEX to AC |
| **Deafened** | deaf | –4 initiative, –4 Perception; GM: 20% verbal spell failure |
| **Nauseated** | acid | –20 attack (soft block); GM: move action only |
| **Confused** | daze | Behavioral tracker; GM rolls d100 per confusion table |
| **Paralyzed** | paralysis | –20 DEX (effective DEX 0); helpless, coup de grace vulnerable |
| **Staggered** | stoned | Action restriction tracker; GM: move OR standard, not both |

### Token HUD Panel

- **Grid layout:** Conditions display in two columns (auto-fill at 110px min-width). Change `minmax(110px, 1fr)` to `minspace(260px, 1fr)` in `condition-overlay.css` for a single-column list.
- **Tiered section:** Each cell shows condition name, auto-decrement indicator (↓), remove button (✕), and tier buttons (1–4)
- **Toggle section:** Each cell shows condition name and ON/OFF toggle
- Active conditions highlighted with gold border and text
- Hover over condition names for tooltip descriptions
- Hovering any row triggers a subtle ink-bleed distortion (SVG filter, injected at module load)

### Condition Macro API

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

**Tiered:** `frightened` · `sickened` · `stupefied` · `clumsy` · `enfeebled` · `drained` · `stunned` · `slowed` · `fascinated`

**Toggle:** `fatigued` · `offGuard` · `persistentDamage` · `blinded` · `deafened` · `nauseated` · `confused` · `paralyzed` · `staggered`

---

## Theme Details

### Fonts

| Font | Usage |
|------|-------|
| **Courier Prime** | Headings, tabs, window titles, condition labels — typewriter weight, archaic authority |
| **Alegreya** | Body text, descriptions, journal content — readable old-style serif |
| **IBM Plex Mono** | Dice rolls, timestamps, mechanical values — clean monospace |

### Color Palette

| Role | Color | Hex |
|------|-------|-----|
| Background (darkest) | Lamp-black | `#0e0c0b` – `#3d3732` |
| Text (primary) | Candlelit parchment | `#d4c9b8` |
| Text (labels) | Aged off-white | `#c2b49a` |
| Text (secondary) | Faded ink | `#9a8e7e` |
| Accent | Tarnished gold | `#b8943e` (bright: `#d4aa4f`) |
| Reaction pip | Verdigris / oxidised copper | `#4b7a7a` |
| AoO pip | Cold iron | `#3a5a78` |
| Danger / condition-locked | Dried blood | `#5e1b14` (bright: `#8b3028`) |

### Customization

All colors and fonts are CSS variables in the `:root` block of `noir-theme.css`. Edit them to adjust the entire palette without touching any other selectors.

---

## Troubleshooting

### Console verification

Open browser console (F12). On a healthy load you should see both:
```
baphomet-utils | Condition Overlay v2.4 ready
baphomet-utils | Action Tracker v1.2 ready
```

### Action pips don't appear

1. Verify the module is enabled in **Settings → Manage Modules**
2. Start a combat encounter — pips only render during active combat
3. Check console for the `Action Tracker v1.2 ready` message
4. If missing, verify `action-tracker.js` exists in `modules/baphomet-utils/scripts/` and that `module.json` lists it in `esmodules`

### Condition panel doesn't appear

1. Verify you're logged in as GM (panel is GM-only)
2. Right-click a token and look for the virus head icon in the right column
3. Check console for `Condition Overlay v2.4 ready`

### Ink-bleed filter not appearing on hover

The SVG filter is injected at module load via JS. If hovering conditions shows no distortion, check the console for errors at startup. The filter requires a modern Chromium-based browser (Foundry's Electron shell qualifies).

### Verify file versions

```javascript
// Run in browser console (F12)
fetch('modules/baphomet-utils/scripts/condition-overlay.js')
  .then(r => r.text()).then(t => console.log(t.substring(0, 200)))

fetch('modules/baphomet-utils/scripts/action-tracker.js')
  .then(r => r.text()).then(t => console.log(t.substring(0, 200)))
```

### Known unrelated errors

These console errors are from **other modules or the PF1e system**, not baphomet-utils:

- `e.find is not a function` at `index.js` — Another module using jQuery `.find()` on v13 hooks
- v13 deprecation warnings from `pf1.mjs` — PF1e system catching up to v13 API changes
- `polygon cannot be computed` — Canvas/lighting issue on specific scenes

---

## Changelog

### v2.3.0 (2026-02-22)
- **[ACCESSIBILITY] Sidebar & Compendium contrast** — Directory lists, compendium pack entries, folder headers, and sidebar buttons now render in warm lamplight off-whites (`--baph-text-bright`, `--baph-text-label`). Previously invisible against dark backgrounds
- **[SYSTEM UI] PF1e sheet global base** — `.pf1.sheet.actor` now forces warm parchment base text (`#d4c9b8`) throughout the sheet. PF1e's default dark-on-light assumptions no longer leak through
- **[SYSTEM UI] PF1e conditions list** — `.condition-name`, condition toggle labels, and active condition states styled with `--baph-text-bright` / `--baph-gold` for immediate readability
- **[SYSTEM UI] PF1e attributes section** — Attribute abbreviations use `--baph-text-label` (aged off-white), score values use `--baph-text-bright` (fresh vellum), modifiers and mechanical numbers use `--baph-gold` (lamplight). No muted greys on mechanical values
- **[SYSTEM UI] Saving throws, skills, AC, initiative** — All mechanical values styled in `--baph-gold` mono; all labels in `--baph-text-label` Courier Prime
- **[SYSTEM UI] Item rows, tab backgrounds, section headers** — Tab content areas, item list rows, and section dividers explicitly themed to dark leather tones
- **Tone compliance** — No pure whites anywhere. Brightest value is `#e8ddd0` (fresh vellum). All high-contrast text uses warm off-whites or pale lamplight brass
- `noir-theme.css` bumped to v2.3

### v2.2.0 (2026-02-22)
- **THEME: Gaslamp Gothic** — `noir-theme.css` palette overhauled from digital slate/cyan to warm weathered tones (`#0e0c0b`, `#1e1917`, `#2a2421`). Tarnished leather replaces cold industrial grey throughout
- **Dried blood** updated to `#5e1b14` (deeper, more desaturated) from `#8b2020`
- **Text readability** — new `--baph-text-label` variable (`#c2b49a`, aged parchment off-white) for labels/buttons replacing muted grey `#5c6370`
- **`.baph-toggle-btn`** font-size raised from `8px` to `11px`; color updated to `--baph-text-label` for high contrast on dark backgrounds; font-family changed to `Courier Prime` (labels use Courier Prime, numbers use IBM Plex Mono)
- **Neon purge** — all outer/color `box-shadow` glow effects replaced with physical inset shadows (stamped iron, pressed leather) throughout all three CSS files
- **IBM Plex Mono reserved strictly for mechanical numbers** — dice totals, initiative, HP, timestamps, tier buttons. Headings and labels use Courier Prime
- **[BUG FIX] Action Tracker layout** — pip row now injected BELOW the combatant stats row (after `.token-initiative`), not inline. Pips render as a full-width block beneath name/HP/initiative; initiative score no longer pushed off-screen
- **[BUG FIX] `_readConditionActionLoss()`** — rewritten with boolean flags (`isStaggered`, `isNauseated`) and integer accumulators (`stunnedTotal`, `slowedTotal`) set inside the loop. Post-loop calculation is deterministic and order-independent. `Math.max()` removed from inside the loop
- Action Tracker bumped to v1.2

### v2.1.0 (2026-02-21)
- **AESTHETIC OVERHAUL:** Fonts changed from Oswald to Courier Prime (headings) + Alegreya (body) for a Black Company grimoire feel
- **Action pip colors desaturated:** Reaction → verdigris `#4b7a7a`, Combat Reflexes → cold iron `#3a5a78`
- **Danger/red unified** to dried blood `#8b2020` across conditions and theme
- **`@keyframes shardBurn`:** Spent pips now briefly flare dull red before settling into ash radial-gradient
- **Action tracker bar** refactored to `inline-flex; flex-wrap: nowrap` — rigid bar with faded brass border and inset shadow
- **Condition panel** refactored to CSS Grid (`auto-fill, minmax(110px, 1fr)`) with inset-tray shadow
- **`#baph-overlay-panel`** uses `grid-template-rows: auto 1fr` — header pinned, only grid scrolls
- **Corrupted-ink-bleed hover effect:** SVG `feTurbulence` + `feDisplacementMap` filter injected at module load; applied on `.baph-condition-row:hover`
- Condition overlay bumped to v2.4

### v2.0.0 (2026-02-21)
- **NEW: Action Economy Tracker** — Visual 3-action + 1-reaction pip display in Combat Tracker sidebar
- Click-to-spend/unspend with sharp military noir transitions
- Auto-reset on turn advance
- Condition integration: Stunned/Slowed/Staggered/Nauseated/Paralyzed auto-lock pips
- Combat Reflexes feat detection adds bonus AoO-only reaction pip
- Active combatant subtle glow effect
- Macro API: `game.baphometActions.getState()`, `.spendAction()`, `.spendReaction()`, `.reset()`
- Condition overlay expanded to 18 conditions (added Blinded, Deafened, Nauseated, Confused, Paralyzed, Staggered)
- Fixed tier interpolation for standalone X values (Drained, Stunned, Slowed descriptions)
- Fixed click handler event propagation on condition panel

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
