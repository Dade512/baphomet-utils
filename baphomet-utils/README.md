# baphomet-utils

Campaign utilities and Gaslamp Gothic theme for **Echoes of Baphomet's Fall** — a PF1.5 homebrew Adventure Path.

**Foundry Version:** V13  
**Current Version:** 2.6.0

---

## Installation

Manifest URL:
```
https://github.com/Dade512/baphomet-utils/releases/latest/download/module.json
```

---

## Features

- **Croaker's Ledger Theme** (`noir-theme.css`) — Full Gaslamp Gothic theme for Foundry V13 and PF1e character sheets
- **Condition Overlay** — Visual condition tracking on tokens; panel styled as a brass-and-leather index card
- **Action Tracker** — PF1.5 three-action economy UI with pips calibrated for the parchment aesthetic
- **Roll Card Styler** — Dark leather result bar on all roll cards; nat 20 gold bar and nat 1 blood bar with flavor labels
- **Custom XP Progression** — Campaign-specific modified slow track overriding PF1e's "Fast" track; integrates organically with character sheet level-up, skill points, feats, and class features

---

## Changelog

### v2.6.0 — "The Ledger Counts the Cost"
- **New:** `scripts/xp-progression.js` — Custom XP progression system. Overwrites PF1e's "Fast" XP track with the campaign's modified slow track table. Escalating reductions on the standard slow track (10% at levels 8–12, 15% at 13–15, 20% at 16–20) with custom early-game values for levels 1–7. Integrates organically with PF1e character sheets — skill points, feats, BAB, saves, and class features all calculate correctly against the custom thresholds. Renames "Fast" track label to "Campaign" in the sheet dropdown.

### v2.5.1 — "The Ink Holds"
- **Critical Fix:** Roll card result bar no longer wraps `h3.dice-total` in a `<div>`. PF1e's `h3.dice-total` contains all inline roll elements (d20 icon, natural, bonus, ⇒, total) as child spans — wrapping it in a flex container scrambled the native layout. `roll-cards.js` v1.1 now adds `.baph-styled` class to the existing `.dice-result` div instead. CSS targets `.dice-result.baph-styled` for the dark leather bar. Zero DOM reparenting.
- **Fix:** Brass accent color deepened from `#9e7d43` to `#846528` (`--baph-brass-readable`) for text-on-parchment links. Passes WCAG AA contrast on all parchment backgrounds without losing the tarnished metal feel.
- **Fix:** Roll link labels bumped from `0.75em` to `0.85em` with `-webkit-text-stroke: 0.5px`. Courier Prime bold uppercase now has enough visual mass at small sizes.
- **Fix:** Legacy `.baph-result-bar` wrapper collapses via `display: contents` so old chat messages with the v1.0 wrapping don't double-style.

### v2.5.0 — "The Ledger Notes the Result"
- **New:** `scripts/roll-cards.js` — Roll Card Styler. Dark leather result bar injected on all dice roll messages. Nat 20 detected via d20 die face reading; result bar turns burnished gold, left-rail goes brass, flavor label reads "⚔ Critical Success". Nat 1 result bar goes dried blood, parchment text, label reads "✖ Critical Failure". No glow on either — physical materials only.
- **Fix:** Brass roll links (BAB, Fortitude, Reflex, Will, CMB, Initiative, skill links) — added `font-weight: 700` and `-webkit-text-stroke: 0.4px` dark iron edge.
- **Fix:** Category headers (WEAPONS, CONSUMABLES, EQUIPMENT, etc.) — bumped to `font-weight: 700`, `font-size: 0.82em`, `letter-spacing: 0.08em`.
- **Fix:** Auto-decrement for Frightened/Stunned conditions rewritten with debounced multi-hook system (`combatTurn`, `combatRound`, `pf1PostTurnChange`). Removed broken guard that prevented `combatTurn` fallback from firing. Diagnostic logging added for all auto-decrement events.

### v2.4.0 — "Croaker's Ledger"
- Full theme pivot to battered mercenary ledger aesthetic
- Parchment backgrounds, dark ink text, brass/blood accents
- action-tracker.css and condition-overlay.css updated to match

### v2.3.2 — "The Names Were Always There"
- Item name contrast pass across all item lists

### v2.3.1 — "The Candle Wasn't Enough"
- Hotfix: Buffs tab item names invisible

### v2.3.0 — "The Lamp is Lit"
- Accessibility pass: sidebar, compendium, PF1e sheet

### v2.2.0 — "The Ledger Rebound"
- Gaslamp Gothic palette overhaul, layout/logic bug fixes

---

## Aesthetic Rules — Croaker's Ledger

| Rule | Value |
|------|-------|
| Brightest value | `#e8dfd0` (fresh vellum) — no pure white |
| Background (main) | `#d1c6b4` (field parchment) |
| Background (worn) | `#beb09b` (mud-stained parchment) |
| Sidebar / chrome | `#8a7b66` (scuffed leather) |
| Primary text | `#2a231d` (oxidized iron gall ink) |
| Secondary text | `#5e5246` (watered-down faded ink) |
| Accent (text) | `#846528` (oxidized bronze — readable) |
| Accent (chrome) | `#9e7d43` (tarnished brass — decorative) |
| Accent hover | `#b8943e` (polished brass — active states) |
| Danger / active tab | `#6e2a22` (dried blood) |
| No neon/cyan/digital glow | Everything reads as physical materials |
| Font: Labels/Headings | Courier Prime |
| Font: Body/Descriptions | Alegreya |
| Font: Numbers only | IBM Plex Mono |

---

## Server Deployment

```
/opt/foundrydata/Data/modules/baphomet-utils/
```

Replace: `styles/noir-theme.css`, `module.json`, `README.md`  
Add/Replace: `scripts/xp-progression.js`, `scripts/roll-cards.js`, `scripts/condition-overlay.js`

---

## Git Workflow

```bash
git add -A
git commit -m "v2.6.0 — Custom XP progression, roll card layout fix, brass readability, auto-decrement fix"
git tag v2.6.0
git push && git push --tags
```