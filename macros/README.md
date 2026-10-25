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
  From v2.46.0 the intent carries `actorUuid` and each use rolls **one attack**.
- `vital-strike.js` — **Vital Strike** (token-driven, feat-gated `/vital strike/i`). Sets
  `globalThis.baphometVitalStrike = { actorUuid }` so `action-tracker.js` charges **2 actions**
  and a `pf1PreDamageRoll` handler doubles the weapon's base damage dice (Strength, the PF1.5
  ½-level flat bonus, and precision/sneak-attack damage are excluded). The use rolls **one
  attack** at any base attack bonus (v2.46.0).
- `charge.js` — **Charge** (token-driven, no feat gate — universal). Sets
  `globalThis.baphometCharge = { actorUuid }` so `action-tracker.js` charges **2 actions** and
  sets pf1's own `charge` option, so the attack reads **`2[Charge]`** (v2.46.0; it replaces the
  old `secondaryPenalty` +2) and rolls **one attack** at any base attack bonus; on a confirmed
  swing only, applies a **−2 AC** buff Item that auto-expires at the start of the actor's next
  turn.
- `cleave.js` — **Cleave** (token-driven, post-kill, feat-gated `/cleave/i`). Sets
  `globalThis.baphometCleave = { actorUuid }` so `action-tracker.js` **skips** the action spend
  (0 actions, 0 swings, no MAP advance). From v2.46.0 it rolls **one attack**, carries the
  dropping Strike's MAP, Power Attack and Charge +2, and is refused a second time in a round
  (before any roll) unless the actor has a `/great\s*cleave/i` feat. "Dropped a foe" + adjacency
  are player-declared.
- `haste-bonus-action.js` — **GM-only** toggle. Calls
  `game.baphometActions.toggleBonusAction(combatant.id)` to grant/revoke the 4th "bonus action"
  pip (Haste) on the selected token's combatant. Independent of the "Auto-Grant Haste Bonus
  Action" world setting.
- `ready.js` — **Ready** (token-driven, no feat gate — universal, `GOAL_v2.37.8`). Declares
  Ready and spends **2 actions** via `game.baphometActions.spendAction`. If the Reaction pip
  was already spent before the declare, warns that the readied action has nothing to trigger
  on but still spends the 2 actions — it does not block.
- `total-defense.js` — **Total Defense** (token-driven, no feat gate — universal,
  `GOAL_v2.37.8`). Declares Total Defense and spends **1 action**; on a successful spend
  only, applies a **+4 dodge** AC buff Item that lives through the enemies' turns and lifts
  at this actor's own next turn start.
- `withdraw.js` — **Withdraw** (token-driven, no feat gate — universal, `GOAL_v2.37.8`).
  Declares Withdraw and zeroes **all remaining actions**, including a live Haste bonus pip,
  via `game.baphometActions.endTurnActions`. Refuses outright, with no spend, on a creature
  carrying an active Fleeing marker buff.
- `delay.js` — **Delay** (token-driven, no feat gate — universal, `GOAL_v2.46.1`). Declares Delay: asks the module
  (`game.baphometActions.declareDelay`, relayed through the GM from a player) to mark the creature as delaying, then
  passes the turn. Refuses, with no request and no turn change, a creature that is not in the active combat, is not the
  current combatant, or already Delayed this round. Nothing refreshes when the creature acts later in the round; its
  Frightened and Fleeing countdowns run once, when the delayed turn ends (or at the wrap, if it never acts).

The three token-driven declare-macros (`vital-strike.js`, `charge.js`, `cleave.js`), the
GM-only `haste-bonus-action.js`, and the three `GOAL_v2.37.8` declare-macros (`ready.js`,
`total-defense.js`, `withdraw.js`) are **not per-character** — one copy each serves every
actor. Only `twf-tier-aware.js` is per-character (hardcoded actor + weapon IDs).

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
| `ready.js` | Ready |
| `total-defense.js` | Total Defense |
| `withdraw.js` | Withdraw |
| `delay.js` | Delay |

**TWF is per-character**: copy `twf-tier-aware.js`'s contents per dual-wielder, edit the actor
name and the two weapon item IDs near the top, and create a separate in-world macro for each.

## Keeping the world macro in sync

1. The repo copy here is **canonical**. After editing either copy, update the other and bump
   `SYNC_STAMP` in the header.
2. **Drift check** — run in the GM console any time (swap the URL filename and the world-macro
   name per the table above). Line endings are ignored: a Windows checkout writes CRLF, the release zip
   ships LF, and Foundry stores whatever was pasted, so identical text must not read as drift.
   ```js
   const url = '/modules/baphomet-utils/macros/twf-tier-aware.js';
   const repo  = await (await fetch(url, { cache: 'no-store' })).text();
   const world = game.macros.getName('Two-Weapon Fighting')?.command ?? '';
   const norm = s => s.replace(/\r\n/g, '\n').trim();
   console.log(norm(repo) === norm(world) ? 'TWF macro: IN SYNC' : 'TWF macro: DRIFT — world ≠ repo');
   ```

### v2.47.0 sync note — re-paste four

`withdraw.js`, `delay.js`, `ready.js` and `total-defense.js` changed in v2.47.0 (`SYNC_STAMP` `2026-10-24`). The
module's spends now answer `null` — not `false` — when no GM is connected, and show one quiet notice; Ready, Total
Defense, Delay and Withdraw stay silent on that answer instead of adding a second warning of their own. Withdraw also
needs a normal action: with only the Haste pip left it refuses and warns. After updating the module, **re-paste each of
the four world macros in place** (open the existing macro and replace its command; keep its id and owner), then run the
drift check above for each (`withdraw.js` / `Withdraw`, `delay.js` / `Delay`, `ready.js` / `Ready`, `total-defense.js` /
`Total Defense`). A world macro that is not re-pasted keeps working, but with no GM connected it adds its own second
warning (Ready, Total Defense, Delay), and Withdraw on the Haste pip alone reads the module's refusal as "no remaining
actions".

### v2.46.1 sync note — paste one new macro

`delay.js` is new in v2.46.1 (`SYNC_STAMP` `2026-10-18`). After updating the module, **create one new world macro named
"Delay"** (Type: Script) and paste the complete file into it; no other macro changed, so nothing is re-pasted. Run the
drift check above with `delay.js` and `Delay`. Set the macro so the players who need it can execute it.

### v2.46.0 sync note — re-paste all four

`vital-strike.js`, `charge.js`, `cleave.js` and `twf-tier-aware.js` changed in v2.46.0 (`SYNC_STAMP`
`2026-10-15`): the intent names its actor by uuid (`{ actorUuid }`), the Cleave macro refuses a second
Cleave in a round, and the module — not the macro — forces each declared use down to one attack. After
updating the module, **re-paste each of the four world macros in place** (open the existing macro and
replace its command; keep its id and owner), then run the drift check above for each. A world macro that
is not re-pasted still gets its single attack and its cost from the module (the old `{ actorId }` intent
is still honoured), but twin monsters are not told apart for it, and the old Cleave macro cannot refuse a
second Cleave (the module warns once in the console). `twf-tier-aware.js` stays per-character: re-paste
each copy and re-apply its actor name and weapon IDs.

**Canonical repo source ≠ world-copy-drift elimination.** This folder (and its packaging into
the release ZIP as of v2.32.0) guarantees there is exactly one authoritative repo source and
that a fresh install has that source available. It does **not** mean the world copy and the
repo copy can no longer diverge — that still requires a manual re-paste + drift check after any
edit. A future deployment/sync mechanism is out of scope for this milestone.

## History

- **v2.47.0** — `withdraw.js`, `delay.js`, `ready.js` and `total-defense.js` (`GOAL_v2.47.0_REACTION_GATE` FIX-5,
  FIX-10): Withdraw needs a normal action (the Haste pip alone refuses) and says nothing on a no-GM `null`; Delay,
  Ready and Total Defense stay silent when no GM is connected. All four `SYNC_STAMP`s set to `2026-10-24`;
  re-paste the four world macros (see the v2.47.0 sync note above).
- **v2.46.1** — New `delay.js` (`GOAL_v2.46.1_TURN_ENGINE` FIX-7): Delay, token-driven, no feat gate. Marks the
  creature as delaying through `game.baphometActions.declareDelay` and passes the turn. `SYNC_STAMP` `2026-10-18`.
  Paste a new world macro "Delay"; no other macro changed.
- **v2.46.0** — `vital-strike.js`, `charge.js`, `cleave.js` and `twf-tier-aware.js`: intents carry
  `actorUuid`; the module forces one attack per declared use; Charge uses pf1's own `2[Charge]`;
  the Cleave macro refuses a second Cleave per round without Great Cleave. All four `SYNC_STAMP`s
  set to `2026-10-15`; re-paste the world macros (see the v2.46.0 sync note above).
- **v2.37.8** — Three new declare-macros added: `ready.js`, `total-defense.js`, `withdraw.js`
  (`GOAL_v2.37.8_DECLARE_AND_WITHDRAW` FIX-1/FIX-2/FIX-3). Ready and Total Defense spend
  through the public `game.baphometActions.spendAction`; Withdraw spends through the new
  `game.baphometActions.endTurnActions`, which zeroes all remaining actions including a live
  Haste bonus pip. All three are token-driven, feat-gate-free, and not per-character.
- **v2.32.0** — Relocated from `docs/homebrew/macros/` (gitignored) to top-level `/macros`
  (tracked, packaged in the release ZIP). Header `CANONICAL SOURCE OF TRUTH` paths updated to
  `macros/<name>.js`; all five `SYNC_STAMP`s set to `2026-07-07`. No macro logic changed.
- **v2.31.0** — Vital Strike's weapon-dice doubling and Charge's +2 to-hit / −2 AC became
  automatic (see `action-tracker.js` and the main `README.md` changelog).
- **v2.30.0** — MAP / swing tracking became automatic; TWF off-hand budget became a per-turn
  pool (Model A).
- **v2.29.0** — Haste bonus-action pip (GM toggle macro added).
- **v2.28.0** — Cost-aware declare-intent macros (Vital Strike / Charge / Cleave) introduced.
