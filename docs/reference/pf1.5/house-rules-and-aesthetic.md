# Croaker's Ledger — House Rules & Aesthetic Spec

This file is policy, not API documentation. Rules here override PF1 defaults and govern visual decisions.
When this file conflicts with `foundry-and-pf1.md`, this file wins for mechanics in PF1.5 scope and for ALL visual decisions. The API file wins for engine behavior.

---

## 1. PF1.5 Mechanical Framework

PF1.5 is a house variant of Pathfinder 1e. Modules must respect these rules and not silently reintroduce default PF1 behavior that conflicts.

### Action Economy
- 3 actions per turn + 1 reaction (replaces PF1's standard/move/swift/full-round economy).
- Module code modifying turn flow must respect the 3-action model.
- When extending `pf1.documents.CombatPF` or `CombatantPF`, action tracking must accommodate 3 discrete action slots, not the legacy action types.

### Conditions
- PF2e-style tiered and toggle conditions replace standard PF1e conditions.
- Tiered: conditions with severity levels (e.g., Frightened 1/2/3).
- Toggle: binary on/off conditions.
- When using `pf1ToggleActorCondition`, expect the condition payload to carry tier metadata, not a flat boolean for tiered conditions.

### Combat UI
- Streamlined for fast tactical decisions. Density over completeness.
- Action selection should be one click or one keypress.
- Mechanical numbers (AC, HP, save DCs, attack bonuses) must be readable in under one second of glance.

### Module behavior rules
- Do not assume default PF1 condition lists in `CONFIG.PF1.conditions` — confirm against PF1.5 condition set before referencing.
- Do not assume legacy action-type fields (`standard`, `move`, `swift`) — use the 3-action model.
- When in doubt about a PF1.5-specific rule, flag the ambiguity rather than smoothing past it.

---

## 2. Croaker's Ledger Aesthetic

Visual identity: military noir / gaslamp gothic. Battered mercenary ledger — worn parchment, scuffed leather, dried ink, tarnished brass, old blood, accumulated history. NO modern digital gloss, sleek sci-fi UI, neon glow, or gamey fantasy chrome.

### Principle
**Function precedes form.** Stability and readability come first. Decorative styling NEVER reduces clarity, clickability, or scan speed.

### Design Tokens

**Backgrounds**
- `--ledger-parchment-1: #d1c6b4` — primary parchment
- `--ledger-parchment-2: #beb09b` — secondary parchment / aged
- `--ledger-leather: #8a7b66` — leather binding / borders

**Text**
- `--ledger-text-primary: #2a231d` — high-contrast body text
- `--ledger-text-inactive: #5e5246` — disabled / secondary

**Accents**
- `--ledger-brass: #9e7d43` — interactive accent, highlights
- `--ledger-blood: #6e2a22` — alerts, damage, critical states

### Typography
- **Headers and labels:** Courier Prime
- **Body text:** Alegreya
- **Numbers and values ONLY:** IBM Plex Mono — DCs, modifiers, HP, attack rolls, anything mechanical

### CSS Conventions
- Module CSS variables prefixed `--ledger-*` (or module-specific prefix like `--baph-*` for baphomet-utils).
- Always provide hardcoded fallbacks for resilience against `theme-dark` overrides:
  ```css
  color: var(--ledger-text-primary, #2a231d);
  ```
- Use `!important` only when v13 core CSS variables win specificity. Document why in a comment when used.
- Scope all module CSS under a top-level class (e.g., `.croakers-ledger`, `.baph-utils`) to avoid bleeding into core sheets.

### UI Rules
- High contrast against parchment backgrounds is mandatory. Test text legibility against `#d1c6b4` and `#beb09b`.
- Mechanical numbers must read instantly. Use IBM Plex Mono, larger size than surrounding text, high-contrast color.
- Dense information cleanly chunked. Combat UI prioritizes glanceability over decoration.
- No pure white (`#fff`). No neon. No drop-shadows that simulate digital UI. No gradient hover states.
- Acceptable hover/active feedback: subtle background shift to a parchment/leather variant, brass underline, or text-color change to brass.

---

## 3. Module Identity & Conventions

### Active modules
- **baphomet-utils** — campaign infrastructure for Echoes of Baphomet's Fall. Weather, scene controls, GM tooling.
- **Local Lore Oracle** — chat-integrated AI lore assistant. `/lore [question]` invokes Tasslequill "Tassle" Stumblebrook persona via Gemini 2.5 Flash. Knowledge context injected from `Player_Safe/` directories.

### Naming conventions
- Module IDs: lowercase with hyphens (`baphomet-utils`).
- CSS class prefixes: short module-specific prefix (`baph-`, `oracle-`).
- Setting keys: descriptive, no abbreviations.
- Commit messages on releases: include version number and named release ("v2.9.0 — The Ledger Opens Its Desk").

### Deployment workflow
- Local development → push to GitHub → `git clone` into Foundry modules dir on Linux server.
- Linux ownership rule: `sudo chown -R foundry:foundry` after deploy, then restart Foundry.
- Module installer requires both `manifest` and `download` fields in `module.json`.

---

## 4. Operational Defaults

### When code review reveals conflicts
Surface the tradeoff explicitly. Do not silently choose between:
- UI clarity vs. v13 compatibility
- v13 compatibility vs. PF1.5 behavior
- PF1.5 behavior vs. base PF1 expectations

### When PF1.5 mechanics are ambiguous
Do not guess. State what's missing and proceed with clearly labeled provisional assumptions.

### When uploaded code self-conflicts
State exactly where the conflict is. Do not paper over it.

### When critical context is missing
Name what's missing. Don't invent it.
