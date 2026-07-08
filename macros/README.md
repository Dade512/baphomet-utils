# Canonical macro source — `/macros`

This folder holds the **canonical source of truth** for the PF1.5 declare-intent macros
shipped alongside the `baphomet-utils` module (as of **v2.32.0**). Each file here is also
pasted, byte-for-byte, into an **in-world Foundry Script Macro** in the campaign's live
world. The in-world copy and the repo copy must be kept byte-identical.

## Why this folder exists (and why it moved here in v2.32.0)

These macros previously lived under `docs/homebrew/macros/`, which is wholesale gitignored.
That kept them out of the git repo entirely and out of the release ZIP — a fresh install of
the module shipped the runtime hooks (`scripts/action-tracker.js`) that read an intent flag,
but nothing in the released package could ever set that flag, because the macro source did
not exist in the package. `/macros` is a tracked, non-ignored top-level folder specifically so
the canonical macro source is version-tracked and packaged in the release ZIP
(`.github/workflows/release.yml`). This closes the "source exists locally but not in the
distributed artifact" gap — it does **not** add any automatic world↔repo sync. A world Macro
you paste in today can still drift from a later edit to the file here; re-check the
`SYNC_STAMP` in each file's header if you suspect drift.

`docs/homebrew/macros/author_twf_feats.js` (a one-time GM authoring helper that creates the
PF1.5 TWF feat carrier items) and its own README remain local-only under `docs/` — it is a
one-off tool, not a runtime-dependency macro, and stays out of scope for this relocation.

## Files

- `twf-tier-aware.js` — the per-character **Two-Weapon Fighting Strike** macro (hardcoded actor
  name + two weapon item IDs near the top of the file — copy per dual-wielder, edit the three
  IDs). Rolls a main-hand Strike, then — if the per-turn off-hand pool (base 1 / improved 2 /
  greater 3 swings per turn, via `game.baphometActions.reserveOffHandSwing`) has room — one
  off-hand bonus swing, applying the correct per-hand two-weapon penalty via
  `globalThis.baphometTWF`. MAP is applied automatically by the module (no macro-side work).
- `vital-strike.js` — **Vital Strike** (token-driven, feat-gated `/vital strike/i`). Sets
  `globalThis.baphometVitalStrike = { actorId }` so `action-tracker.js` charges **2 actions**
  and a `pf1PreDamageRoll` handler doubles the weapon's base damage dice (Strength, the PF1.5
  ½-level flat bonus, and precision/sneak-attack damage are excluded).
- `charge.js` — **Charge** (token-driven, no feat gate — universal). Sets
  `globalThis.baphometCharge = { actorId }` so `action-tracker.js` charges **2 actions** and a
  `pf1PreAttackRoll` handler adds **+2 to the attack roll**; on a confirmed swing only, applies
  a **−2 AC** buff Item that auto-expires at the start of the actor's next turn.
- `cleave.js` — **Cleave** (token-driven, post-kill, feat-gated `/cleave/i`). Sets
  `globalThis.baphometCleave = { actorId }` so `action-tracker.js` **skips** the action spend
  (0 actions, 0 swings, no MAP advance). "Dropped a foe" + adjacency are player-declared.
- `haste-bonus-action.js` — **GM-only** toggle. Calls
  `game.baphometActions.toggleBonusAction(combatant.id)` to grant/revoke the 4th "bonus action"
  pip (Haste) on the selected token's combatant. Independent of the "Auto-Grant Haste Bonus
  Action" world setting.

The three token-driven declare-macros (`vital-strike.js`, `charge.js`, `cleave.js`) and the
GM-only `haste-bonus-action.js` are **not per-character** — one copy each serves every actor.
Only `twf-tier-aware.js` is per-character (hardcoded actor + weapon IDs).

## Manual deployment (fresh install)

Foundry does not auto-create world Macro documents from a module's shipped files. To use one:

1. Open the **Macro Directory** → **Create Macro**.
2. Set **Type: Script**.
3. Name it per the table below.
4. Copy the **complete** contents of the file here and paste into the macro's command box.
5. Save, and set permissions so the players who need it can execute it.

| Repo file | In-world macro name |
| --- | --- |
| `twf-tier-aware.js` | Two-Weapon Fighting |
| `vital-strike.js` | Vital Strike |
| `charge.js` | Charge |
| `cleave.js` | Cleave |
| `haste-bonus-action.js` | Haste: Bonus Action |

**TWF is per-character**: copy `twf-tier-aware.js`'s contents per dual-wielder, edit the actor
name and the two weapon item IDs near the top, and create a separate in-world macro for each.

## Keeping the world macro in sync

1. The repo copy here is **canonical**. After editing either copy, update the other and bump
   `SYNC_STAMP` in the header.
2. **Drift check** — run in the GM console any time (swap the URL filename and the world-macro
   name per the table above):
   ```js
   const url = '/modules/baphomet-utils/macros/twf-tier-aware.js';
   const repo  = await (await fetch(url, { cache: 'no-store' })).text();
   const world = game.macros.getName('Two-Weapon Fighting')?.command ?? '';
   console.log(repo.trim() === world.trim() ? 'TWF macro: IN SYNC' : 'TWF macro: DRIFT — world ≠ repo');
   ```

**Canonical repo source ≠ world-copy-drift elimination.** This folder (and its packaging into
the release ZIP as of v2.32.0) guarantees there is exactly one authoritative repo source and
that a fresh install has that source available. It does **not** mean the world copy and the
repo copy can no longer diverge — that still requires a manual re-paste + drift check after any
edit. A future deployment/sync mechanism is out of scope for this milestone.

## History

- **v2.32.0** — Relocated from `docs/homebrew/macros/` (gitignored) to top-level `/macros`
  (tracked, packaged in the release ZIP). Header `CANONICAL SOURCE OF TRUTH` paths updated to
  `macros/<name>.js`; all five `SYNC_STAMP`s set to `2026-07-07`. No macro logic changed.
- **v2.31.0** — Vital Strike's weapon-dice doubling and Charge's +2 to-hit / −2 AC became
  automatic (see `action-tracker.js` and the main `README.md` changelog).
- **v2.30.0** — MAP / swing tracking became automatic; TWF off-hand budget became a per-turn
  pool (Model A).
- **v2.29.0** — Haste bonus-action pip (GM toggle macro added).
- **v2.28.0** — Cost-aware declare-intent macros (Vital Strike / Charge / Cleave) introduced.
