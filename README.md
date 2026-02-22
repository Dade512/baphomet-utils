# baphomet-utils

Campaign utilities and Gaslamp Gothic theme for **Echoes of Baphomet's Fall** — a PF1.5 homebrew Adventure Path.

**Foundry Version:** V13  
**Current Version:** 2.3.2

---

## Installation

Manifest URL:
```
https://github.com/Dade512/baphomet-utils/releases/latest/download/module.json
```

---

## Features

- **Gaslamp Gothic Theme** (`noir-theme.css`) — Full dark theme for Foundry V13 and PF1e character sheets
- **Condition Overlay** — Visual condition tracking on tokens
- **Action Tracker** — PF1.5 three-action economy UI

---

## Changelog

### v2.3.2 — "The Names Were Always There"
- **Fix:** Active item names (Buffs, Inventory, Spells, Features) now forced to `--baph-text-primary` via deep selector targeting `.item-name h4` and `.item-name a`
- **Fix:** Disabled/inactive buff names now render in `--baph-text-secondary` with `italic` style — legible but clearly distinct from active items
- **Fix:** Gold hover state (`--baph-gold`) added to all item/buff names for clear mouseover feedback; disabled items get a dimmed gold variant

### v2.3.1 — "The Candle Wasn't Enough"
- **Hotfix:** Buffs tab item names invisible — targeted contrast fix applied

### v2.3.0 — "The Lamp is Lit"
- Accessibility pass: sidebar, compendium, PF1e sheet global contrast improvements

### v2.2.0 — "The Ledger Rebound"
- Gaslamp Gothic palette overhaul
- Layout and logic bug fixes

---

## Aesthetic Rules

| Rule | Value |
|------|-------|
| Brightest value | `#e8ddd0` (fresh vellum) — no pure white |
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

---

## Git Workflow

```bash
git add styles/noir-theme.css module.json README.md
git commit -m "v2.3.2 — Item name contrast: active, disabled, hover states"
git tag v2.3.2
git push && git push --tags
```
