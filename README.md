# baphomet-utils

Campaign utilities and Gaslamp Gothic theme for **Echoes of Baphomet's Fall** — a PF1.5 homebrew Adventure Path.

**Foundry Version:** V13  
**Current Version:** 2.8.0

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
- **Weather Engine** — Seeded RNG weather generation with 8 Golarion climate zones, integrated with Simple Calendar Reborn; posts daily weather to chat in Croaker's Ledger style

---

## Weather Engine

The weather engine generates deterministic daily weather based on the current date and active climate zone. Same date always produces the same weather unless the climate zone changes.

### Climate Zones

| Zone | Regions | Character |
|------|---------|-----------|
| `arctic` | Crown of the World, Irrisen | Perpetual cold, long winters, brief cool summers |
| `subarctic` | Northern Brevoy, Mammoth Lords | Harsh winters, cool summers |
| `temperate` | Central Brevoy, Mendev, Ustalav, Druma | Four distinct seasons, moderate rainfall |
| `warm` | Absalom, Taldor, Andoran, Cheliax | Mild winters, warm summers, Mediterranean feel |
| `tropical` | Mwangi Expanse, Sargava | Hot year-round, heavy monsoon rains |
| `arid` | Osirion, Thuvia, Katapesh, Qadira | Scorching days, cold nights, rare rain |
| `mountain` | Mindspin Mountains, Five Kings | Cold, thin air, rapid weather shifts |
| `coastal` | Varisian coast, Hermea, Mediogalti | Moderate temps, frequent fog, steady rain |

### GM API

```js
game.baphometWeather.post()                // Show today's weather in chat
game.baphometWeather.setClimate('arid')    // Party enters Osirion
game.baphometWeather.listClimates()        // Show all available zones
game.baphometWeather.reroll()              // Regenerate today's weather (rare)
game.baphometWeather.toggleChat()          // Toggle auto-posting on day advance
game.baphometWeather.getWeatherFor(4712, 7, 15, 'temperate')  // Query specific date
```

Default zone: **Temperate** (Canorate, Molthune — campaign starting region).

---

## Changelog

### v2.8.0 — "The Ledger Reads the Sky"
- **New:** `data/climate-zones.js` — 8 Golarion climate zones with per-season temperature, precipitation, and wind parameters. Each zone includes descriptive text generators for immersive chat output.
- **New:** `scripts/weather-engine.js` — Seeded RNG weather generation integrated with Simple Calendar Reborn. Deterministic daily weather (temperature high/low, precipitation type and intensity, wind speed and gusts, cloud cover). GM climate zone switching via `game.baphometWeather` API. Auto-posts to chat on day advance as a GM whisper in Croaker's Ledger style.

### v2.7.0 — "The Ledger Counts Slower"
- **Updated:** `scripts/xp-progression.js` — Revised early-game XP ramp for smoother acceleration into mid-levels. New values: 2k/5k/10k/18k/28k/42k (was 1k/3k/6k/10k/15k/21k). Session pacing updated for ~120 session campaign. Levels 8–20 unchanged.
- **New:** GitHub Actions release workflow — automatic zip build and release asset attachment on tag push.

### v2.6.0 — "The Ledger Counts the Cost"
- **New:** `scripts/xp-progression.js` — Custom XP progression system. Overwrites PF1e's "Fast" XP track with the campaign's modified slow track table.

### v2.5.1 — "The Ink Holds"
- **Critical Fix:** Roll card result bar no longer wraps `h3.dice-total` in a `<div>`. Zero DOM reparenting.
- **Fix:** Brass accent color deepened to `#846528` for text-on-parchment links. WCAG AA compliant.

### v2.5.0 — "The Ledger Notes the Result"
- **New:** `scripts/roll-cards.js` — Roll Card Styler. Dark leather result bar, nat 20 gold bar, nat 1 blood bar.
- **Fix:** Auto-decrement for Frightened/Stunned conditions rewritten with debounced multi-hook system.

### v2.4.0 — "Croaker's Ledger"
- Full theme pivot to battered mercenary ledger aesthetic

### v2.3.0–v2.3.2 — Accessibility and contrast fixes

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

---

## Release Workflow

Pushing a version tag automatically builds and publishes a GitHub release:

```bash
git tag v2.8.0
git push origin v2.8.0
```

The GitHub Actions workflow builds the module zip and attaches both `module.json` and `baphomet-utils.zip` to the release.
