# baphomet-utils

Campaign utilities and Gaslamp Gothic theme for **Echoes of Baphomet's Fall** — a PF1.5 homebrew Adventure Path.

**Foundry Version:** V13  
**Current Version:** 2.5.0

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

---

## Changelog

### v2.5.0 — "The Ledger Notes the Result"
- **New:** `scripts/roll-cards.js` — Roll Card Styler. Dark leather result bar injected on all dice roll messages. Nat 20 detected via d20 die face reading; result bar turns burnished gold, left-rail goes brass, flavor label reads "⚔ Critical Success". Nat 1 result bar goes dried blood, parchment text, label reads "✖ Critical Failure". No glow on either — physical materials only.
- **Fix:** Brass roll links (BAB, Fortitude, Reflex, Will, CMB, Initiative, skill links) — added `font-weight: 700` and `‑webkit‑text‑stroke: 0.4px` dark iron edge. Text reads as stamped brass on parchment rather than painted-on thin lettering.
- **Fix:** Category headers (WEAPONS, CONSUMABLES, EQUIPMENT, etc.) — bumped to `font-weight: 700`, `font-size: 0.82em`, `letter-spacing: 0.08em`. Courier Prime bold uppercase now has real weight at small sizes.

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
| Accent hover | `#9e7d43` (tarnished brass) |
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
Add new: `scripts/roll-cards.js`

---

## Git Workflow

```bash
git add styles/noir-theme.css scripts/roll-cards.js module.json README.md
git commit -m "v2.5.0 — Roll card styler, brass link weight, header boldness"
git tag v2.5.0
git push && git push --tags
```

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

---

## Changelog

### v2.4.0 — "Croaker's Ledger"
- **Theme Pivot:** Abandoned dark lampblack aesthetic. Full pivot to *The Black Company* mercenary ledger aesthetic.
- **Backgrounds:** Mid-tone muddy parchment (`#d1c6b4`, `#beb09b`) for sheet interiors; scuffed leather (`#8a7b66`) for sidebar and window chrome.
- **Text Inversion:** All text now dark oxidized iron gall ink (`#2a231d` primary, `#5e5246` secondary/faded). Removed all v2.3.2 `!important` light-text overrides — PF1e system default dark text now works correctly without interference.
- **Accents:** Tarnished brass (`#9e7d43`) for active/hover states; dried blood (`#6e2a22`) for danger, active tab indicators, and hover on item names.
- **Action Tracker (`action-tracker.css`):** Pip row background updated to parchment inset tray. All pips given stronger outer borders to read as physical objects on a light background. Spent ash darkened for legibility. Condition-locked blood pips increased to 85% opacity.
- **Condition Overlay (`condition-overlay.css`):** Panel now reads as a physical brass-and-leather index card clipped to the open ledger. Parchment backgrounds throughout, brass rivets for tier buttons, leather scrollbars.
- **CSS Variables:** Full legacy alias system added so `--baph-bg-dark`, `--baph-gold`, etc. continue to resolve correctly in all three CSS files without a full rewrite of condition-overlay and action-tracker.

### v2.3.2 — "The Names Were Always There"
- **Fix:** Active item names forced to `--baph-text-primary` via deep selector targeting `.item-name h4` and `.item-name a`
- **Fix:** Disabled/inactive buff names rendered in `--baph-text-secondary` with `italic` style
- **Fix:** Gold hover state added to all item/buff names; disabled items get dimmed gold variant

### v2.3.1 — "The Candle Wasn't Enough"
- **Hotfix:** Buffs tab item names invisible — targeted contrast fix applied

### v2.3.0 — "The Lamp is Lit"
- Accessibility pass: sidebar, compendium, PF1e sheet global contrast improvements

### v2.2.0 — "The Ledger Rebound"
- Gaslamp Gothic palette overhaul
- Layout and logic bug fixes

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
| Accent hover | `#9e7d43` (tarnished brass) |
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

Replace: `styles/noir-theme.css`, `styles/action-tracker.css`, `styles/condition-overlay.css`, `module.json`, `README.md`

---

## Git Workflow

```bash
git add styles/noir-theme.css styles/action-tracker.css styles/condition-overlay.css module.json README.md
git commit -m "v2.4.0 — Croaker's Ledger: full parchment/leather theme pivot"
git tag v2.4.0
git push && git push --tags
```
