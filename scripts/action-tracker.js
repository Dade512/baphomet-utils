/* ============================================================
   ECHOES OF BAPHOMET — PF1.5 ACTION TRACKER v1.29
   Visual 3-action + reaction economy tracker for Combat Tracker.

   DISPLAY:  ◆ ◆ ◆   ◇  ◈ ◈ …   (3 actions, 1 reaction, + Combat Reflexes
             AoO pips = Dexterity modifier; single row on its own line)
   LOCATION: Injected BELOW combatant name row in Combat Tracker sidebar
   BEHAVIOR: Manual click-to-spend. ACTION pips AND the REACTION +
             Combat Reflexes (AoO) pips all reset at the START of the
             combatant's OWN turn (CONFLICT-1 ruling, v1.27 — each
             creature's own turn, not a shared round-start moment for
             everyone). An AoO spent on someone else's turn stays spent
             until this combatant's own next turn begins.
             Reads Stunned (via the stunnedCountdown actor flag)/Slowed/
             Paralyzed/Nauseated from baphomet-utils condition buffs/flags
             to auto-lock pips. Staggered is not a live tracked condition
             (folds into Slowed 1 — see v1.26 Changes / MECH-3).

   v1.29 Changes (GOAL_v2.37.0_PIP_AUTHORITY — "Whose Hand Moves", the FD-06
   fix):
   - [FD-06] `combatant.isOwner === true` does not predict server-side
     Combatant-update permission for a role-2 client in this world/version
     (live evidence: GOAL_v2.35.0_REACTION_RETIME round-01,
     `docs/ai-council/GOAL_v2.35.0_REACTION_RETIME/20260725-104515/RUNTIME_RESULT.md`).
     Every write path that could run on a non-GM client now branches on
     `game.user.isGM`: the GM path is byte-identical to before (direct
     `_writePipFlag`/`_writeOffBudget`, no socket). A non-GM client applies
     its mutation optimistically (same local state change + render as
     before — the return value keeps its old synchronous meaning, Trap 2)
     and relays the request to the active GM via socketlib's
     verified-sender pattern (action name `baphPipSpendRelay` — see the
     "PIP-WRITE SOCKET RELAY" block below), instead of attempting the
     doomed direct write. Touched: `spendReaction`, `spendCombatReflex`,
     `reserveOffHandSwing`, `rollbackOffHandSwing`, `_spendActionCore`
     (covers both the public `spendAction` and the
     `_spendActionForCombatant` automation path), `_togglePip` (the manual
     pip-click path).
   - [Reset path] `_maybeResetForNewTurn` and the public `reset()` fire
     identically on every connected client (turn/round state is not
     player-specific), so the GM's own client already performs the
     correct write on its own authority — a non-GM client now skips the
     write there entirely rather than attempting a second, doomed copy of
     it. No relay needed for this one; this is "the flag write itself"
     Trap 4 names, not a change to the turn-sequence guard logic above it.
   - [Trap 3 — pipState supersede] A client-local `state.pipSeq` counter
     (mirrors the existing off-hand `state.offSeq` pattern) guards every
     optimistic pip-mutation revert: a revert closure captures the seq
     value at the moment it mutated, plus (round, activeId) at that same
     moment, and only actually reverts if BOTH `state.pipSeq` still equals
     the captured value AND (round, activeId) are still unchanged when the
     (async) relay response arrives. **Round-02 correction: `pipSeq` is
     bumped by (1) every optimistic non-GM mutation itself, (2) `_resetState`
     (the manual `reset()` path), and (3) the `updateCombatant` pip
     hydrator — i.e. EVERY authoritative pip-flag write this client
     observes, including its own relayed spend echoing back, another
     client's spend, or a turn-start reset written from
     `_maybeResetForNewTurn`.** It does NOT itself distinguish "an incoming
     cross-client echo" as a category — an earlier draft of this comment
     overstated that. The turn-start-reset case specifically is covered by
     the added (round, activeId) re-check in each revert closure (the same
     test `rollbackOffHandSwing` already used), not by a dedicated echo
     detector, because `_maybeResetForNewTurn` mutates the pip arrays
     in-place without going through `_resetState` and is Trap-4 protected
     (no line was added inside it beyond the pre-existing flag write, which
     was already the one permitted exception).
   - [FIX-1, round-02] `rollbackOffHandSwing`'s non-GM path now relays the
     release through the active GM (`kind: 'offHandRollback'`) instead of
     attempting the doomed direct write it used unchanged through round-01
     — see `_releaseOffHandSwingForCombatant` for how the GM validates it
     from its own state rather than the client's token `seq`.
   - [FIX-3, round-02] `_togglePip` now returns its real outcome (`false`
     at any preflight guard, `true` once applied) instead of the GM
     relay handler's `case 'toggle'` always reporting `ok: true`
     regardless of what happened — a GM-side refusal now correctly
     reverts the requester's optimistic toggle and warns once.
   - [Trap 1] The GM handler (`_baphSocketPipSpendRelay`) re-derives the
     caller from socketlib's verified `this.socketdata.userId`, never
     `payload.requestingUserId`, and re-checks both actor ownership
     (mirrors task-tracker.js's `_baphSocketResolveAdjudicate`) and
     active-combat membership before re-running the exact same public
     spend function a GM's own click would call.
   - [Trap 2, accepted limitation] The public spend API stays fully
     synchronous — the relay round trip and any revert happen after the
     call already returned. A caller reading the return value still only
     ever learns "applied locally," never "persisted."
   - [Trap 4] `_advanceTurnSeq`, the `advanced`/dedupe guard inside
     `_maybeResetForNewTurn`, `_turnSeqTrack`, `_resetForSeq`, and the
     off-hand `(round, activeId)` staleness key (`_currentActiveCombatantId`)
     are byte-unchanged — only the flag-write calls at the tail of
     `_maybeResetForNewTurn` were touched.
   - [FIX-4, round-02 — OVERSEER FIX BRIEF Defect A] `_togglePip` now
     rejects, before any mutation, any `toggleIndex` that is not an integer
     in range for the array `toggleType` selects (`0 <= toggleIndex <
     arr.length`) — on every path, including the GM's own call. `bonusPip`
     is `[]` when nothing has been granted, so this closes a forged-toggle
     self-grant at the root (an out-of-range index into an empty array
     previously created and persisted a pip that was never granted); the
     same guard also rejects out-of-range `actions`/`reaction`/`reflexPip`
     indices so none of those arrays can grow. Every existing UI click
     passes an index produced by the render loop and is therefore in
     range — behavior for in-range slots is unchanged.
   - [FIX-5, round-02 — OVERSEER FIX BRIEF Defect B] The previous entry
     here described a "known, accepted limitation": an automation-triggered
     Haste-bonus attack spend relayed as a plain normal-pool spend and
     could be refused by the GM's stricter redo even though the client's
     local pool had room. **That limitation is fixed and this entry no
     longer describes current behavior.** `_spendActionCore`'s non-GM
     branch now carries its own `allowBonus` value on the relay payload,
     and the GM handler's `'action'` case calls the private
     `_spendActionCore` directly (never the public `spendAction`, which
     stays hard-wired `allowBonus = false`) so the GM re-runs the SAME
     availability check — `bonusUsable` — the client itself ran, per Trap 1
     (GOAL:151-152). `bonusUsable` is unweakened: it still requires the
     GM's own authoritative `state.bonusPip[0] === true` and a
     non-incapacitated actor, so a client-claimed `allowBonus` confers no
     capability the sender lacks — it only selects which already-granted
     pool a spend may draw from.

   v1.27 Changes (GOAL_v2.35.0_REACTION_RETIME — "On Your Own Time"):
   - [CONFLICT-1] Reaction + Combat Reflexes (AoO) pip refresh MOVED off
     the shared, simultaneous round-start boundary and onto each
     combatant's own turn-start moment. The v1.24/v1.25 round-keyed
     mechanism (_maybeResetReactionsForNewRound, _reactionResetRound) is
     REMOVED; _maybeResetForNewTurn now also refreshes reaction/reflex
     pips (via _resetReactionReflexPips, formerly
     _resetReactionReflexForRound) at the same point it refreshes action
     pips, reusing the same proven render-based `.active`-combatant
     detection — no new hook.
   - [Delay fix, round-01 — DISPROVEN LIVE, do not resurrect] The first
     attempt keyed the dedupe guard on the (round, `combat.turn`-index)
     PAIR. `combat.turn` is an index into a re-sortable array, not an
     identity: the round-01 two-seat live probe
     (`docs/ai-council/GOAL_v2.35.0_REACTION_RETIME/20260724-163226/LIVE_PROBE_RESULT.md`)
     confirmed Delay (lowering initiative) and a mid-round insertion
     ABOVE the active combatant both re-sort the turn order and move
     `combat.turn` out from under the still-active combatant WITHOUT a
     genuine new turn beginning, causing the guard to mismatch and the
     entire turn-start reset body to spuriously re-fire mid-turn.
   - [Turn-sequence guard, round-02 — the shipped fix] The guard now keys
     on a module-owned, CLIENT-LOCAL turn-sequence tracker (`_turnSeqTrack`,
     `_advanceTurnSeq`), never on any Foundry-supplied numeric index. The
     sequence for a combat advances only when the `.active` combatant's
     IDENTITY differs from the one last observed, OR `combat.round`
     advances (the latter is required so a single-combatant combat still
     refreshes on its own round boundary — an identity-only key would
     advance once and never again). Each combatant persists the sequence
     value its own last reset fired at (`_resetForSeq`, replacing the
     retired `_resetForRound` / `_resetForTurn` pair) purely for schema
     parity with the pre-round-02 shape; the live guard decision itself
     reads only the client-local tracker, never that persisted value,
     which is what avoids the durable-cross-client-write question
     entirely. See `_advanceTurnSeq` for the full rationale, including the
     adopt-on-first-observation branch that preserves reload-safety below.
   - [Reload-safety preserved, re-verified on the round-02 guard] A fresh
     client's local `_turnSeqTrack` starts empty for a combat it has not
     yet observed. Rather than treat "no local record" as "advance," the
     first observation ADOPTS the current active combatant without firing
     a reset — the same shape as the retired v1.25
     `_maybeResetReactionsForNewRound` null-branch above. `_initState`
     already hydrated the correct spent/available pip VALUES from the
     persisted combatant flag; only the dedupe bookkeeping is being
     (re)established here, not the pips themselves, so a mid-turn
     reload/reconnect still does not re-fill already-spent pips.
   - No changes to MAP/swing tracking, TWF, Vital Strike/Charge
     automation, the Combat Reflexes pip *count* (Dex-mod sizing), or
     any other system in this file.

   v1.28 Changes (GOAL_v2.35.0_REACTION_RETIME round-03 — FD-01, the TWF
   off-hand budget's own staleness key):
   - [FD-01 fix] The round-02 turn-sequence guard above never touched the
     TWF off-hand budget's OWN staleness test, which round-02's probe never
     read. That test still keyed on `(round, combat.turn)` — the exact
     value round-01 disproved for the pip guard, in the same file, one
     resource over. Delay and a mid-round insertion above the active
     combatant both move `combat.turn` under an unchanged active
     combatant (captured live, same evidence as round-01/round-02); on
     re-hydration a spent off-hand swing came back. `_writeOffBudget`,
     `_initState`'s off-budget hydration, the `updateCombatant` off-budget
     hydrator, and the `reserveOffHandSwing`/`rollbackOffHandSwing` token
     pair now key on `(round, activeId)` instead — both are replicated
     document/breadcrumb state that does not move when the turn order
     re-sorts. `_turnSeqTrack` is deliberately NOT reused here: it is
     client-local by design (two clients hold different `seq` values for
     the same combat), and this staleness test is inherently cross-client
     (written by one client, read by another), so keying it on the
     turn-sequence would be silently wrong.
   - [Active-identity source] "Who is active" is sourced from
     `globalThis.baphometActiveCombatant` (the v2.34.0 proactive
     breadcrumb — see `_stampActiveCombatantBreadcrumb` below), guarded on
     `combatId`, mirroring `condition-overlay.js`'s
     `_getBreadcrumbCombatant`. This codebase has now disproven three
     separate reactive turn-identity reads (`combat.current.turn`,
     `combat.combatant`, `combat.turn`) — see `_currentActiveCombatantId`
     for the one narrow, commented exception (a client that has not yet
     observed a genuine turn-start for this combat).
   - [Legacy shim] A flag persisted before round-03 carries `turn` and no
     `activeId`. Such a flag is NOT treated as stale (that would be the
     refill bug under a new name) — the comparison falls back to the old
     `(round, turn)` test when `activeId` is absent from the stored flag,
     and self-heals on the next write (every off-hand spend and every
     turn reset rewrites the flag).
   - No changes to `_advanceTurnSeq`, `_maybeResetForNewTurn`'s dedupe
     guard itself, `_turnSeqTrack`, `_resetForSeq`, the pip/reaction/AoO
     guard, the MAP swing counter, or `condition-overlay.js`.

   v1.26 Changes (GOAL_v2.34.0_CONDITION_CANON — "The Single Tally"):
   - [MECH-1/MECH-2/MECH-3] _readConditionActionLoss REWRITTEN to the canon
     max-not-sum model (SS5 "Action-Loss Stacking"): Slowed, the new Stunned
     countdown, and the corrected Nauseated-1 value are peer inputs to a
     single Math.max(), never summed. The Staggered read is REMOVED
     entirely (condition-overlay.js no longer defines a `staggered`
     CONDITIONS entry — canon folds Staggered into Slowed 1). See the
     rewritten comment block directly above that function for full worked
     examples; the prior block's "confirmed ruling" additive model and its
     worked examples are gone, not left alongside the new ones.
   - [Stunned countdown] Stunned's action-loss contribution now comes from
     a persisted `stunnedCountdown` ACTOR flag (module id `baphomet-utils`,
     maintained by condition-overlay.js — see that file's "STUNNED
     COUNTDOWN LIFECYCLE" comment block), read directly and
     unconditionally here — no gate on the Stunned buff still existing.
     This is deliberately distinct from the buff's own `tier` flag, which
     is display/history only and is no longer read for action-loss math.
   - [Proactive breadcrumb] Added `_stampActiveCombatantBreadcrumb`,
     called from `_maybeResetForNewTurn` (render-based turn-start
     detection — already the file's most reliable "who is active right
     now" signal, per the v1.6 rewrite below) and from the `combatStart`
     hook. Writes `globalThis.baphometActiveCombatant = { combatId,
     combatantId, round, turn }`. condition-overlay.js's turn-transition
     decrement logic reads this instead of re-deriving the departing
     combatant reactively at its own hook-fire time — two prior attempts
     at that reactive approach (`combat.current.turn`, then
     `combat.combatant`) were each disproven by live two-seat
     re-verification. Classic <script> load order (module.json lists this
     file before condition-overlay.js) guarantees the global exists by the
     time it's read.
   - No changes to manual pip spend/toggle, MAP/swing tracking, TWF,
     Vital Strike/Charge automation, or any other system in this file.

   v1.25 Changes (AoO / COMBAT REFLEXES ATTACK SPENDS THE JADE POOL):
   - Attack dialog gains an "AoO (Combat Reflexes)" checkbox in the
     Miscellaneous row, injected by _diagHandleAttackDialogRender only
     when app.actor has the Combat Reflexes feat. Its state bridges to
     pf1PreActionUse via globalThis.baphometAoO (mirrors the baphometTWF
     bridge): reset per dialog open, cleared after the hook consumes it.
   - New game.baphometActions.spendCombatReflex(combatantId): spends one
     available green jade AoO pip (mirrors spendReaction).
   - pf1PreActionUse off-turn (AoO) branch: when the attack is flagged AoO
     AND the actor has Combat Reflexes AND a jade pip is available, spend a
     jade pip; otherwise fall back to the blue reaction (Michael's ruling),
     warning if neither is available. Unflagged behavior is unchanged.
   - Rides the existing autoAttackSpend setting (no new setting).
   - FIX (v2.24.0 regression): _maybeResetReactionsForNewRound now ADOPTS the
     current round on a client's first observation (round marker null) instead
     of resetting, so a mid-round reload/reconnect no longer refills reaction/AoO
     pips already spent this round (pip state is hydrated from the combatant
     flags). Only a genuine round change refreshes pips.

   v1.24 Changes (PER-ROUND REACTION / AoO RESET):
   - Reaction and Combat Reflexes (AoO) pips are now a PER-ROUND resource.
     They reset at the start of a NEW ROUND (combat.round advances), for
     ALL combatants, via _maybeResetReactionsForNewRound() in the
     renderCombatTracker hook (render-based; guarded by _reactionResetRound
     so it fires once per round across many renders).
   - Action pips still reset on the combatant's OWN turn. Previously
     _maybeResetForNewTurn reset reaction/reflex on the own turn too, so
     AoOs spent earlier in a round wrongly refreshed when the spender's
     turn came up in the SAME round. They now persist until the next round.
   - Full incapacitation (Paralyzed) still zeroes reaction/reflex at reset.

   v1.23 Changes (PIP TRAY — OWN LINE, SINGLE ROW + DEX-SCALED COMBAT REFLEXES):
   - The pip tray now occupies its OWN full-width line below the v13
     combatant row, as a single horizontal row:
       [3 action pips]  [1 reaction pip]  [Combat Reflexes pips x Dex mod]
     Root cause of the prior squeeze: v13's combatant <li> is a
     non-wrapping flex ROW and the legacy "#combat-tracker .combatant
     { flex-direction: column }" rule matched nothing in v13, so the
     tray collapsed inline. action-tracker.css v1.9 wraps the combatant
     row and gives the tray flex-basis:100%. The .baph-pip-separator is
     no longer emitted; pips are grouped (.baph-pip-actions /
     .baph-pip-reactions) with a gap between groups.
   - Combat Reflexes now SCALES: reflexPip length = the actor's Dexterity
     modifier (floored at 0), rendered as jade AoO pips after the blue
     reaction (PF1: total AoO = 1 base + Dex mod). _combatReflexCount(actor)
     reads actor.system.abilities.dex.mod (path confirmed live). The count
     is reconciled on init, turn reset, condition lock, and render sync.
   - No change to the 3-action spend math, condition reading, turn-reset
     timing, ownership gating, cross-client sync, or any automation.
   - Module release version (module.json) and git tag owned by Michael.

   v1.21 Changes (R6 TWF PENALTY + OFF-HAND GUARD):
   - Added pf1PreAttackRoll advisory hook for PF1.5 Two-Weapon
     Fighting attack penalties. It reads globalThis.baphometTWF,
     adds the selected per-hand penalty to rollConfig.secondaryPenalty
     as a plain signed-number string, and never returns false.
     Surface + format confirmed by live probe P-2: secondaryPenalty
     is a plain numeric string; flavor brackets parse to NaN and
     break the roll. Attacks bypass pf1PreD20Roll.
   - Documented and migrated the existing TWF off-hand action-cost
     guard: off-hand bonus swings ride the main-hand Strike, roll
     normally, and spend no extra action. The guard now reads the
     unified globalThis.baphometTWF.offhand bridge instead of the
     retired loose off-hand flag. No loose _baphTWFOffhandActive
     reference remains in this file.
   - Paired with the in-world "Two-Weapon Fighting" macro, which
     computes the per-hand penalty (tier from @bFlags; light vs.
     one-handed from weaponSubtype) and sets globalThis.baphometTWF.
     Verified live: 1 action total, -2/-2 on both swings for base
     TWF with two light weapons.
   - Module release version (module.json) and git tag unchanged —
     Michael owns release.

   v1.20 Changes (DISABLE DEVICE TASK PREP):
   - SKILL_ACTION_COSTS: dev (Disable Device) removed entirely.
     Disable Device now uses the PF1.5 multi-round task pattern
     (commit 1 action/round with Continue Disabling). It is not
     an auto-spendable 1-action skill.
   - Live pf1ActorRollSkill handler: early gate added for dev
     BEFORE the allowlist check. When skillKey === 'dev' and
     combat is active, the handler warns the user that Disable
     Device uses multi-round task handling, logs the decision,
     and returns without spending any pips. The PF1 roll itself
     continues (no pre-roll blocking).
   - LIVE SKILL AUTO-SPEND section banner updated to remove
     the now-obsolete Disable Device 3-action reference.
   - No task subsystem built. No task state, no Continue Task
     button, no duration tracking, no automatic final check.
   - All other skill costs unchanged. No other automation changes.

   v1.19 Changes (HIDE PF1 FULL ATTACK BUTTON):
   - _diagHandleAttackDialogRender restructured: normalization
     now always runs (not just when debugLogging is ON), so the
     suppression pass can act on the root regardless of debug state.
   - When pf15ModeEnabled is true, removes button[name="attack_full"]
     from AttackDialog using root.querySelector + .remove().
     Confirmed selector from v2.13.5 live diagnostics.
     button[name="attack_single"] is untouched.
   - Debug log emitted on successful suppression:
     "PF1.5 mode: removed Full Attack button from AttackDialog"
   - All existing diagnostics retained and still debug-gated.
   - No attack auto-spend. No swing tracking. No MAP.
     No pf1PreActionUse cancellation. No ESM migration.

   v1.18 Changes (FIX STRIKE GUARD DIAGNOSTICS):
   - Added _diagNormalizeRoot(input): accepts HTMLElement,
     DocumentFragment, jQuery wrapper, or array-like wrapper.
     Guards globalThis.jQuery before instanceof check. Falls
     through gracefully if none match.
   - Added _diagStringify(value): safe JSON.stringify wrapper
     with try/catch. Logs compact, copy-friendly JSON strings
     alongside every diagnostic object.
   - Diagnostic 1 (renderActorSheetPFCharacter): replaced bare
     `element instanceof HTMLElement` guard with _diagNormalizeRoot.
     Live PF1 hook was passing a non-HTMLElement wrapper, causing
     the scan to bail with 'element is not HTMLElement'. Now also
     logs the raw constructor name and normalized constructor name
     for future reference. JSON log added.
   - Diagnostic 2 (pf1RenderQuickActions): updated root resolution
     to use _diagNormalizeRoot for consistency. JSON log added.
   - Diagnostic 3 (AttackDialog): updated _diagHandleAttackDialogRender
     to use _diagNormalizeRoot instead of _baphNormalizeHtml so the
     same coercion logic applies everywhere. Added targeted
     renderAttackDialog hook (fires only if AttackDialog uses the
     expected class name). JSON log added.
   - Diagnostic 4 (pf1PreActionUse): JSON log added.
   - pf1AttackRoll diagnostic: JSON log added for attack summary.
   - No gameplay behavior changes. No suppression. No cancellation.
   - All output remains debug-gated.

   v1.17 Changes (PF1.5 STRIKE GUARD DIAGNOSTICS):
   - Added four observer-only diagnostic hooks to identify PF1
     full-attack UI controls and ActionUse payload shape before
     implementing full-attack suppression in v2.14.0.
   - [DIAG] renderActorSheetPFCharacter: logs all buttons and
     [data-action] elements in the rendered actor sheet, filtered
     to highlight any attack/full-attack candidates.
   - [DIAG] pf1RenderQuickActions: logs all interactive elements
     in the token HUD quick-actions DocumentFragment, filtered
     for attack/full-attack candidates.
   - [DIAG] renderApplication / renderApplicationV2: logs all
     interactive elements when the rendered app constructor name
     matches 'AttackDialog'. Both V1 and V2 hook names registered
     since AttackDialog's ApplicationV1/V2 status is unconfirmed.
   - [DIAG] pf1PreActionUse: logs a structured payload summary
     (constructor, keys, actor, item, action, possible full-attack
     flags, activation/rollMode data). NEVER returns false —
     observer only.
   - All four diagnostics are gated behind the existing
     debugLogging setting. Zero gameplay behavior change.
   - No selectors removed or disabled. No pips spent from
     attack hooks. No swing tracking. No MAP. No ESM migration.

   v1.16 Changes (PF1ATTACKROLL DIAGNOSTIC ENRICHMENT):
   - Added _summarizeAttackRoll(action, roll, extraData): builds a
     focused per-fire summary tailored to characterizing the
     pf1AttackRoll hook before any attack auto-spend is wired.
     Captures:
       timestamp        — Date.now() for firing-rate analysis
       actorPath        — which property the actor was resolved from
       actor            — shallow actor summary (constructor/id/uuid/name/type)
       item             — parent item id/uuid/name/type
       action           — ItemAction id/name/constructorName
       roll             — D20RollPF constructor/formula/total/_evaluated
       messageId        — first available chat-message ref, with source
       extraDataKeys    — top-level keys of args[2] (capped at 30)
       activeCombatantMatch / activeCombatant — comparison via
         _getActiveCombatantForActor; reveals AoO / off-turn cases
       dedupeCandidate  — composite key candidate for future dedupe
         design (actor:item:action:messageId|timestamp). Observation
         only — NOT used for any actual dedupe in this version.
   - pf1AttackRoll diagnostic now emits a third [DIAG] line with
     the focused summary. Existing raw-args and arg-summary lines
     are preserved so prior log corpora remain comparable.
   - NEVER reads arg?.data — keeps the v2.10.1 deprecation cleanup
     intact.
   - Still observer-only. No pip spending. No live behavior change.
   - All output gated behind the debugLogging setting.

   v1.15 Changes (FLOATING ACTION SPEND PANEL):
   - Replaced single Stride button with a compact 3-button
     Action Spend Panel. Buttons:
       Spend 1 — Swing / Move       (1 action, reason: manual-1)
       Spend 2 — Cast / Ready       (2 actions, reason: manual-2)
       Spend 3 — Disable / Full     (3 actions, reason: manual-3)
   - Labels are descriptive examples only. No action-type rules
     are enforced. All spends are generic pip deductions.
   - Panel header shows the active combatant name.
   - All-or-nothing enforced via existing _spendActionForCombatant.
   - Condition-locked pips not consumed.
   - Ownership/combatant re-validated at click time.
   - Position still controlled by moveButtonPosition setting.
   - Old Stride helpers (_getStrideButtonId, _removeStrideButton,
     _shouldShowStrideButton, _renderStrideButton) removed and
     replaced with panel equivalents (_getActionPanelId,
     _removeActionPanel, _shouldShowActionPanel, _renderActionPanel,
     _buildActionSpendButton).
   - Hook registrations unchanged (renderCombatTracker,
     updateCombat, combatStart, deleteCombat, ready).
   - No attack automation. No token drag. No ESM migration.

   v1.14 Changes (FLOATING STRIDE BUTTON):
   - Added floating Stride button that spends 1 action from the
     current active combatant (game.combat.combatant).
   - Button visibility: active combat only; current user must be
     GM or able to control the active combatant via
     _canUserControlCombatant. Not based on selected tokens.
   - Click re-validates combatant and ownership before spending.
   - Uses _spendActionForCombatant(combatant.id, 1, 'stride').
   - Failed spend: shows ui.notifications.warn and refreshes pip
     row. No partial spending.
   - Position controlled by existing moveButtonPosition setting
     (bottom-right / bottom-left / top-right / top-left).
   - Button removed when combat ends (deleteCombat).
   - Button refreshes on renderCombatTracker, combatStart,
     updateCombat to track turn changes correctly.
   - Croaker's Ledger aesthetic: parchment background, brass
     border, iron-gall text. CSS added to action-tracker.css.
   - No token drag automation. No attack auto-spend.
   - No MAP/Strike counter. No ESM migration.

   v1.13 Changes (EXPAND KNOWLEDGE SKILL AUTO-SPEND):
   - Added full standard PF1 Knowledge sub-skill keys to
     SKILL_ACTION_COSTS (all cost 1 action):
       kdu = Knowledge Dungeoneering
       ken = Knowledge Engineering
       kge = Knowledge Geography
       khi = Knowledge History
       kno = Knowledge Nobility
       kpl = Knowledge Planes
     (kar, kre, kna, klo already present from prior releases)
   - Perception (per) remains excluded.
   - Added explicit failure _debugLog after failed spend attempt.
     Previously the failure path left no visible log at the
     call site when _spendActionForCombatant returned false.
   - All-or-nothing spend behavior unchanged.
   - pf1AttackRoll remains diagnostic-only.
   - No Move/Stride button. No ESM migration.

   v1.12 Changes (SKILL ALLOWLIST MIGRATION — klo ADDED):
   - Added klo (Knowledge Local) to SKILL_ACTION_COSTS (cost 1).
     Confirmed from live v2.11.0 testing — key fired in debug output.
   - klo added to allowlist default in settings.js.
   - No other behavior changes. All gates and spend logic unchanged.

   v1.11 Changes (LIVE SKILL AUTO-SPEND):
   - SKILL_ACTION_COSTS updated to confirmed PF1 key strings
     from v2.10.x diagnostic testing. Provisional language removed.
     Keys: acr, blf, int, ste, hea, umd, dev (3), slt, kar, kre, kna.
   - Live pf1ActorRollSkill hook wired. Spends action pips when:
     autoSkillSpend setting is ON, combat is active, actor is the
     current active combatant, user controls the combatant, skill
     is in the allowlist, and enough pips are available for the
     full cost (all-or-nothing).
   - Disable Device (dev) costs 3. If fewer than 3 pips remain,
     nothing is spent.
   - Perception (per) excluded from all costs and allowlist.
   - Dedupe guard added (_skillSpendDedupeSet). Key is
     actor.id:skillKey:chatMessage.id. 500ms window.
   - pf1ActorRollSkill removed from diagnostic block to prevent
     duplicate/noisy logs. Live handler carries its own debug
     logging at every decision gate.
   - pf1AttackRoll remains diagnostic-only — dedupe behavior
     not yet designed.
   - No token movement automation. No Move/Stride button.
   - Manual pip behavior unchanged.

   v1.10 Changes (DIAGNOSTIC CLEANUP):
   - Removed all arg?.data probing from _summarizeHookArg.
     PF1 ItemAction.data is deprecated and emits compatibility
     warnings when accessed. Affected paths removed:
       summary.actorFromData (arg?.data?.actor)
       possibleSkillKeys.dataSkill (arg?.data?.skill)
       possibleSkillKeys.dataSkillId (arg?.data?.skillId)
       possibleSkillKeys.dataSkillKey (arg?.data?.skillKey)
   - Expanded non-.data actor probing to cover additional paths:
     arg?.action?.actor, arg?.parent?.actor, arg?.parent.
   - Expanded non-.data skill key probing to cover additional paths:
     arg?.action?.skill/skillId/skillKey,
     arg?.subject?.skill/skillId/skillKey, arg?.name.
   - Diagnostic hooks remain observer-only. No pip spending.
     No automation enabled.

   v1.9 Changes (ACTION AUTOMATION DIAGNOSTICS):
   - Added _summarizePossibleActor(actor): shallow defensive summary
     of a potential actor reference for diagnostic output.
   - Added _summarizeHookArg(arg, index): shallow defensive summary
     of a single hook argument. Checks common actor paths, possible
     skill key paths, constructor name, and top-level keys (capped
     at 30). Never deep-traverses Foundry/PF1 objects.
   - Added _summarizeHookArgs(args): maps _summarizeHookArg over
     a hook argument array.
   - Added _baphActionDiagnosticsRegistered guard and
     _registerActionAutomationDiagnostics(): registers
     debug-gated Hooks.on listeners for pf1AttackRoll and
     pf1ActorRollSkill. Guard prevents duplicate registration
     if ready fires more than once or is called manually.
   - Added second Hooks.once('ready') that calls
     _registerActionAutomationDiagnostics().
   - NO pip spending. NO automation wired. Diagnostic hooks log
     only. All output gated behind the debugLogging setting.

   v1.8 Changes (AUTOMATION PREP — SCAFFOLD ONLY):
   - Added _debugLog(msg, ...args): conditional debug output
     gated on the 'debugLogging' module setting. Fails safely
     if settings are not yet registered.
   - Added _getActiveCombatant(): returns game.combat.combatant
     or null. Intended lookup point for attack-roll automation.
   - Added _getActiveCombatantForActor(actor): returns the current
     active combatant only if its actor matches the provided actor.
     Does NOT search all combatants — only the active one is
     eligible for automation spending. Corrected in v2.9.9 patch.
   - Added _canUserControlCombatant(combatant): mirrors the
     ownership check in _refreshPipRow so automation uses the
     same gate as manual interaction.
   - Added _spendActionForCombatant(combatantId, count, reason):
     spends N pips; DELEGATES to game.baphometActions.spendAction
     to avoid duplicating spend logic. Returns boolean.
     Spend is all-or-nothing — partial spending is never allowed.
   - Added _spendActionForActor(actor, count, reason): convenience
     wrapper combining lookup + ownership + spend in one call.
   - Added SKILL_ACTION_COSTS constant: provisional skill→cost
     map (INERT — key names unverified, no hook calls it yet).
   - NO PF1 hooks added. NO behavior change to manual pip flow.
     All helpers are unreachable from live code in this version.

   v1.7 Changes (OWNERSHIP HARDENING):
   - Broadened the isOwner computation in both _refreshPipRow()
     and the renderCombatTracker injection. Previously:
       game.user.isGM || combatant.isOwner
     Now:
       game.user.isGM || combatant.isOwner
         || combatant.actor?.isOwner || combatant.token?.isOwner
     combatant.isOwner is the primary PF1e path. The actor and
     token fallbacks cover edge cases: unlinked tokens where
     actor ownership propagates differently, and timing windows
     during combatant setup where one chain resolves before the
     other. The broader check ensures pips are clickable for
     all ownership paths Foundry recognizes.
   - No behavior change for fully-linked tokens where
     combatant.isOwner resolves correctly (common case). No
     change to turn reset, state management, or any other logic.

   v1.6 Changes:
   - [BUG FIX] The just-ended combatant's pips were resetting at end
     of turn instead of the new active combatant's pips resetting at
     start of turn. Root cause: the three turn-change hook handlers
     (pf1PostTurnChange / combatTurn / combatRound) were trying to
     compute "the new active combatant" by reading combat.current.turn
     during the hook fire — but the value of combat.current.turn
     during those hooks is unreliable across versions and across
     interactions with other modules (monks-combat-details,
     specifically). At least one combination resulted in the OLD
     combatant being identified as the new active.
   - [ARCHITECTURE] Switched from hook-based turn detection to a
     render-based "self-correcting" approach. Each pipState entry
     now carries a `_resetForRound` marker. Inside renderCombatTracker
     (which Foundry guarantees to fire after combat state is fully
     updated), we look at which combatant entry has the `.active`
     CSS class — that's Foundry's own truth, the combatant whose
     turn it currently is. If their `_resetForRound` doesn't match
     `combat.round`, we reset their state and update the marker.
     This is idempotent (multiple renders in the same round = no-op),
     independent of hook firing order, and self-correcting (any
     later render fixes a missed reset).
   - [REMOVED] The three turn-change Hooks.on handlers
     (pf1PostTurnChange, combatTurn, combatRound), the
     _turnChangeProcessed dedupe Set, and the _handleTurnChange
     function. Render-based detection replaces all of them.
   - The combatStart, deleteCombat, deleteCombatant, and
     createCombatant hooks are kept — they handle state lifecycle
     (init / cleanup), not turn detection.

   v1.5 Changes:
   - [BUG FIX] _refreshPipRow was using querySelector (single-match),
     which meant that when the Encounter Tracker was popped out into
     its own window, only ONE of the two rendered pip rows would
     update on click. Switched to querySelectorAll and now replaces
     ALL matching rows.
   - [BUG FIX] Turn-change hooks could throw "Cannot read properties
     of undefined (reading '0')" during a transient state where
     combat.turns is briefly undefined or empty. Added Array.isArray
     + length guards. (v1.6 removes those hook handlers entirely;
     guards no longer relevant in this file but kept the lesson.)
   - [CLEANUP] Removed [DIAG] console.log calls.

   v1.4 Changes:
   - [CLICK FIX] Pips are now <button type="button"> elements
     instead of <div>. Native buttons handle click events more
     reliably in sidebar UIs.
   - [CLICK FIX] Row-level event suppression slimmed from five
     events to just mousedown + click.
   - [CLICK FIX] _refreshPipRow re-derives isOwner from the live
     combatant rather than reading from the old DOM's stale dataset.

   v1.3 Changes:
   - [HARDENING] Turn-change handling refactored to use a dedupe-Set
     pattern to handle multiple redundant hooks firing for the same
     turn change. (REMOVED in v1.6 — render-based approach makes
     dedupe unnecessary.)
   - [HARDENING] DOM normalization uses the shared _baphNormalizeHtml
     helper from scripts/dom-utils.js.

   v1.2 Changes:
   - [UI BUG FIX] Pip row injected as full-width block BELOW the
     combatant name row, not appended inline with HP/Initiative.
   - [LOGIC BUG FIX] _readConditionActionLoss() rewritten to use
     boolean tracking + integer accumulators with post-loop math.

   For Foundry VTT v13 + PF1e System
   Requires: baphomet-utils condition-overlay.js (for condition reading)
   ============================================================ */

const AT_MODULE_ID = 'baphomet-utils';

/* ----------------------------------------------------------
   STATE MANAGEMENT
   In-memory only. Resets on page reload. No DB writes.

   v1.6: pipState entries gained a `_resetForRound` field.
   It tracks the round number we last auto-reset this combatant
   for. If `_resetForRound !== combat.round` AND this combatant
   is the current active, the renderCombatTracker hook resets
   them and updates the marker. Idempotent across renders.

   v1.27 round-01 (DISPROVEN LIVE, retired): added `_resetForTurn`,
   tracking `combat.turn` at the moment of the last turn-start reset
   alongside `_resetForRound`, requiring BOTH to match before skipping.
   `combat.turn` is a re-sortable array index, not an identity — Delay and
   mid-round insertion above the active combatant both move it without a
   genuine new turn beginning, which the live probe confirmed spuriously
   re-fires the entire reset body. See the v1.27 changelog block above.

   v1.27 round-02 (shipped): `_resetForRound` AND `_resetForTurn` are BOTH
   retired, replaced by a single `_resetForSeq` field — the sequence value
   (from the client-local `_advanceTurnSeq` tracker, see below) at which
   this combatant's own last turn-start reset fired. The guard in
   _maybeResetForNewTurn no longer compares against any Foundry-supplied
   round/turn value at all; see GOAL_v2.35.0_REACTION_RETIME.
   ---------------------------------------------------------- */

// Map<combatantId, {
//   actions: [bool,bool,bool],
//   reaction: [bool],
//   combatReflex: bool,
//   reflexPip: [bool],
//   conditionLocked: number,
//   _resetForSeq: number | null   // v1.27 round-02 — replaces the retired
//                                 // v1.6 `_resetForRound` / round-01 `_resetForTurn`
// }>
// true = available, false = spent
const pipState = new Map();

// Flag key used to persist pip state cross-client on the Combatant document.
// Stored as: { actions: [bool,bool,bool], reaction: [bool], reflexPip: [bool], resetForSeq: number|null }
const PIP_FLAG_KEY = 'pipState';

// v1.27 round-02 (GOAL_v2.35.0_REACTION_RETIME) — module-owned, CLIENT-LOCAL
// turn-sequence tracker backing the _maybeResetForNewTurn dedupe guard. See
// _advanceTurnSeq for the full rationale. Map<combatId, { seq: number,
// activeId: string, round: number }>. In-memory only, per client, cleared on
// deleteCombat — never persisted, never compared cross-client (that is the
// deliberate choice that sidesteps the durable-shared-flag question; see the
// v1.27 changelog block and _advanceTurnSeq).
const _turnSeqTrack = new Map();

// v2.30.0 MAP / TWF off-hand budget.
// OFF_BUDGET_FLAG_KEY: an ISOLATED, versioned combatant flag for the TWF off-hand
// per-turn budget, deliberately SEPARATE from the whole-blob pipState flag so an
// unrelated pip/Haste/reset write can't carry-and-clobber it (GATE-1 probe fact 7).
// Stored as: { used: number, seq: number, round: number, activeId: string|null }.
// v2.35.0 round-03 (GOAL_v2.35.0_REACTION_RETIME, FD-01): `activeId` replaces the
// prior `turn` field — see `_currentActiveCombatantId` and the v1.28 changelog
// block above for why. A flag persisted before round-03 carries `turn` and no
// `activeId`; every comparison site below falls back to `(round, turn)` in that
// legacy case so it does not hydrate as unspent.
const OFF_BUDGET_FLAG_KEY = 'offHandBudget';
// Two-Weapon Fighting off-hand bonus swings PER TURN by tier (canon §4 Incremental Mastery).
const TWF_OFF_BUDGET = { base: 1, improved: 2, greater: 3 };

/**
 * v2.35.0 round-03 (GOAL_v2.35.0_REACTION_RETIME, FD-01): resolve "who is the
 * active combatant right now," for the TWF off-hand budget's staleness key
 * ONLY. Do not reuse `_turnSeqTrack` here — it is client-local by design (two
 * clients hold different `seq` values for the same combat), and this
 * comparison is inherently cross-client (one client writes the flag, another
 * reads it), so a client-local sequence would be silently wrong.
 *
 * Prefers `globalThis.baphometActiveCombatant`, the v2.34.0 proactive
 * breadcrumb stamped by `_stampActiveCombatantBreadcrumb` from the same
 * render-based `.active` detection this whole GOAL relies on — guarded on
 * `combatId` matching, exactly as `condition-overlay.js`'s
 * `_getBreadcrumbCombatant` does. This codebase has disproven three separate
 * reactive turn-identity reads (`combat.current.turn`, `combat.combatant`,
 * `combat.turn`); prefer the module-owned signal over a fourth.
 *
 * Falls back to a reactive `combat.combatant?.id` read ONLY when the
 * breadcrumb is null or belongs to a different combat (a client that has not
 * yet observed a genuine turn-start for this combat this session). That
 * fallback is acceptable here specifically because every call site is
 * `_initState` (render-triggered hydration), the `updateCombatant` off-budget
 * hydrator (a post-commit document-update echo), or the reserve/rollback
 * pair (invoked synchronously from a GM/owner-driven UI action) — none of
 * them run inside a volatile turn-transition hook. Treating a null breadcrumb
 * as "no match, therefore stale" would zero the budget and reintroduce the
 * FD-01 defect under a new name, so this does NOT do that.
 *
 * @param {Combat|null|undefined} combat
 * @returns {string|null}
 */
function _currentActiveCombatantId(combat) {
  const breadcrumb = globalThis.baphometActiveCombatant;
  if (breadcrumb && combat && breadcrumb.combatId === combat.id) return breadcrumb.combatantId ?? null;
  return combat?.combatant?.id ?? null;
}

// Crit-confirmation guard (GATE-1 probe fact 3): on a crit threat the hooks fire a
// second pre→atk pair before the single use. `_mapArmCrit` is set at an eligible
// pf1PreAttackRoll (candidate penalty), promoted to `_mapPendingConfirm` at the
// threat's pf1AttackRoll iff roll.isCrit; the confirmation's pf1PreAttackRoll reuses
// that penalty and does NOT advance the swing counter (canon: same swing's MAP).
// Both keyed by actor.id; cleared on turn reset.
const _mapArmCrit = new Map();        // actorId -> { penalty }
const _mapPendingConfirm = new Map(); // actorId -> { penalty }

// Resolve the floating Action Spend Panel / task-widget corner from the
// 'moveButtonPosition' client setting, defaulting to 'bottom-right' (and on any
// settings read error). Consolidates the position read used across the renderers.
function _getButtonPosition() {
  try { return game.settings.get(AT_MODULE_ID, 'moveButtonPosition') ?? 'bottom-right'; }
  catch { return 'bottom-right'; }
}

function _initState(combatantId) {
  // Hydrate from the shared combatant flag if it exists (cross-client reload support).
  // getFlag is synchronous — reads from the document's in-memory data.
  const combatant = game.combat?.combatants?.get(combatantId);
  const actor = combatant?.actor;
  const saved = combatant?.getFlag('baphomet-utils', PIP_FLAG_KEY) ?? null;

  // v1.23: Combat Reflexes pips scale to the actor's Dex modifier. Reconcile
  // any saved reflexPip array to the current count, preserving spent state.
  const reflexCount = _combatReflexCount(actor);
  const reflexPip = Array.isArray(saved?.reflexPip)
    ? Array.from({ length: reflexCount }, (_, i) => saved.reflexPip[i] ?? true)
    : Array(reflexCount).fill(true);

  // v2.29.0 Haste bonus: hydrate provenance + availability LOCALLY (no flag write in init).
  // Auto is derived from the actor's active Haste buffs when the setting is on; forced false
  // when off (never hydrate a stale saved `true`). Manual + spent-state come from the flag.
  let _bonusSettingOn = false;
  try { _bonusSettingOn = game.settings.get(AT_MODULE_ID, 'autoHasteBonusAction'); } catch (e) { /* setting not registered yet */ }
  const bonusManual = !!saved?.bonusManual;
  const bonusAuto   = _bonusSettingOn ? _hasActiveHasteBuff(actor) : false;
  const bonusEff    = bonusManual || bonusAuto;
  const bonusPip    = bonusEff
    ? ((Array.isArray(saved?.bonusPip) && saved.bonusPip.length === 1) ? [...saved.bonusPip] : [true])
    : [];

  // v2.30.0: TWF off-hand budget hydrates from its OWN isolated, versioned flag (NOT pipState).
  // Valid only for the current round + active-combatant identity; a stale (prior-turn) value
  // hydrates as 0. `offSeq` is preserved for the stale-echo guard in the dedicated
  // updateCombatant hydrator.
  // v2.35.0 round-03 (FD-01): keyed on (round, activeId), not (round, turn) — see
  // `_currentActiveCombatantId` and OFF_BUDGET_FLAG_KEY's comment. A legacy flag (no
  // `activeId` key) falls back to the old (round, turn) comparison so it is not
  // treated as stale-therefore-unspent.
  const ob = combatant?.getFlag(AT_MODULE_ID, OFF_BUDGET_FLAG_KEY) ?? null;
  const _obRound = game.combat?.round ?? 0;
  const _obIsCurrent = !!ob && ob.round === _obRound && (
    Object.prototype.hasOwnProperty.call(ob, 'activeId')
      ? ob.activeId === _currentActiveCombatantId(game.combat)
      : ob.turn === (game.combat?.turn ?? 0) // legacy pre-round-03 flag shape
  );
  const offHandUsed = _obIsCurrent ? (Number(ob.used) || 0) : 0;
  const offSeq      = Number(ob?.seq) || 0;

  pipState.set(combatantId, {
    actions:         (saved?.actions  && saved.actions.length  === 3) ? [...saved.actions]  : [true, true, true],
    reaction:        (saved?.reaction && saved.reaction.length === 1)  ? [...saved.reaction] : [true],
    combatReflex:    reflexCount > 0,
    reflexPip,
    conditionLocked: 0,
    bonusManual,
    bonusAuto,
    bonusPip,
    // v1.27 round-02: the sequence value (from the client-local
    // _advanceTurnSeq tracker) at which this combatant's own last
    // turn-start reset fired. Replaces the retired _resetForRound /
    // _resetForTurn pair — see _maybeResetForNewTurn and the STATE
    // MANAGEMENT comment block above.
    _resetForSeq:    saved?.resetForSeq ?? null,
    // v2.30.0 MAP swing counter — in-memory ONLY, never flag-persisted (sidesteps R6 P-8).
    swingsTaken:     0,
    // v2.30.0 TWF off-hand budget — persisted via the isolated OFF_BUDGET_FLAG_KEY flag.
    offHandUsed,
    offSeq,
    // v2.37.0 (GOAL_v2.37.0_PIP_AUTHORITY, Trap 3): client-local, in-memory-only
    // generation counter for pipState (reaction/reflex/action/bonus). Bumped by
    // every optimistic non-GM mutation; a pending relay-failure revert only acts
    // if this still matches the value it captured — see spendReaction et al.
    // Deliberately NOT persisted (unlike offSeq) — this guards only against a
    // local revert clobbering a local newer write, never a cross-client compare.
    pipSeq: 0,
  });
}

function _getState(combatantId) {
  return pipState.get(combatantId) ?? null;
}

function _resetState(combatantId) {
  const state = _getState(combatantId);
  if (!state) return;
  state.actions = [true, true, true];
  state.reaction = [true];
  // v1.23: recompute Combat Reflexes pips from current Dex mod.
  const reflexCount = _combatReflexCount(game.combat?.combatants?.get(combatantId)?.actor);
  state.combatReflex = reflexCount > 0;
  state.reflexPip = Array(reflexCount).fill(true);
  state.conditionLocked = 0;
  // v2.29.0: refill the Haste bonus availability (grant persists; incap is derived at use).
  state.bonusPip = (state.bonusManual || state.bonusAuto) ? [true] : [];
  // v2.30.0: clear the per-turn MAP counter + TWF off-hand budget on a manual reset too.
  state.swingsTaken = 0;
  state.offHandUsed = 0;
  state.offSeq = (Number(state.offSeq) || 0) + 1;
  // v2.37.0 round-02 (GOAL_v2.37.0_PIP_AUTHORITY FIX-2): bump pipSeq here too —
  // a manual reset() replaces the pip arrays wholesale, and any pending relay
  // revert captured BEFORE this call must never clobber it (Trap 3).
  state.pipSeq = (Number(state.pipSeq) || 0) + 1;
  const _rsActor = game.combat?.combatants?.get(combatantId)?.actor;
  if (_rsActor) { _mapArmCrit.delete(_rsActor.id); _mapPendingConfirm.delete(_rsActor.id); }
  // _resetForSeq is metadata, not pip state — DO NOT touch it here.
  // It's owned by the render-based reset logic (_maybeResetForNewTurn).
}

/**
 * Persist the current pip availability state to the Combatant document flag.
 * All connected clients receive an updateCombatant hook event and re-hydrate
 * their local pipState cache, providing cross-client pip synchronization.
 *
 * Fire-and-forget (no await) — keeps all spend paths synchronous.
 * Errors are logged to console but never throw.
 */
function _writePipFlag(combatantId) {
  const state = _getState(combatantId);
  if (!state) return;
  const combatant = game.combat?.combatants?.get(combatantId);
  if (!combatant) return;
  if (!combatant.isOwner) return;

  combatant.setFlag('baphomet-utils', PIP_FLAG_KEY, {
    actions:      [...state.actions],
    reaction:     [...state.reaction],
    reflexPip:    [...state.reflexPip],
    bonusManual:  !!state.bonusManual,
    bonusAuto:    !!state.bonusAuto,
    bonusPip:     Array.isArray(state.bonusPip) ? [...state.bonusPip] : [],
    resetForSeq:  state._resetForSeq, // v1.27 round-02 — see _maybeResetForNewTurn / _advanceTurnSeq
  }).catch(err => console.error(`baphomet-utils | _writePipFlag error: ${err}`));
}

/**
 * v2.30.0: Persist the TWF off-hand budget to its OWN isolated, versioned flag
 * (OFF_BUDGET_FLAG_KEY) — deliberately separate from the whole-blob pipState flag so
 * an unrelated pip/Haste/reset write can never carry-and-clobber it (GATE-1 probe fact 7).
 * Owner-gated, fire-and-forget (mirrors _writePipFlag). The bumped `seq` lets the
 * dedicated updateCombatant hydrator reject a stale self-echo.
 */
function _writeOffBudget(combatantId) {
  const state = _getState(combatantId);
  if (!state) return;
  const combatant = game.combat?.combatants?.get(combatantId);
  if (!combatant || !combatant.isOwner) return;
  // v2.35.0 round-03 (FD-01): stamp activeId, not turn — see OFF_BUDGET_FLAG_KEY's comment
  // and `_currentActiveCombatantId`.
  combatant.setFlag(AT_MODULE_ID, OFF_BUDGET_FLAG_KEY, {
    used:     Number(state.offHandUsed) || 0,
    seq:      Number(state.offSeq) || 0,
    round:    game.combat?.round ?? 0,
    activeId: _currentActiveCombatantId(game.combat),
  }).catch(err => console.error(`baphomet-utils | _writeOffBudget error: ${err}`));
}

/* ----------------------------------------------------------
   CONDITION READING — v2.34.0 REWRITE (max-not-sum canon)
   [GOAL_v2.34.0_CONDITION_CANON — MECH-1, MECH-2, MECH-3]

   Canon ground truth: docs/reference/pf1.5/PF1.5_Module_Mechanics_Reference.md
   section 5 ("SS5"), "Action-Loss Stacking" — every action-loss source is a
   PEER INPUT to ONE Math.max(), never summed against each other. The prior
   model here summed Stunned + Slowed and used a hardcoded 2-action floor
   for Staggered/Nauseated, and called that the "confirmed ruling" — it was
   not; that label and its worked examples are gone, not left in place
   alongside the corrected ones below.

   Sources (all peers to the same Math.max(), no floor/additive split):
     Slowed X   → X actions lost (static per-turn tier; does not decrement)
     Stunned    → the CURRENT `stunnedCountdown` actor flag value — NOT a
                  read of the buff's own tier (see below)
     Nauseated  → 1 action lost (MECH-2: corrected from a hardcoded 2). The
                  no-attack/no-cast restriction that accompanies Nauseated
                  is a SEPARATE overlay on top of this count, not itself an
                  action-loss value — and this module does not build hard
                  enforcement of that restriction (out of scope for this
                  goal; tracked separately as LANE-B-5 / a follow-up item).
   Paralyzed (full incapacitation) bypasses this math entirely: all 3
   actions + the reaction are locked, matching prior behavior.

   Staggered is REMOVED (MECH-3): canon (SS5 "Folded / Retired Conditions")
   forbids a live tracked Staggered condition — PF1 Staggered folds into
   Slowed 1 at the point of application. condition-overlay.js's CONDITIONS
   object has no `staggered` entry, and there is no `isStaggered` read
   anywhere in this file.

   Final formula: actionsLost = min(max(slowedTotal, stunnedCountdown,
   nauseatedLoss), 3); remaining = max(0, 3 - actionsLost).

   Worked examples (match SS5:272-277 exactly — cross-checked against the
   goal's required runtime cases):
     Slowed 1 alone           → max(1, 0, 0) = 1 lost → 2 actions remain
     Nauseated alone          → max(0, 0, 1) = 1 lost → 2 actions remain
     Slowed 1 + Nauseated     → max(1, 0, 1) = 1 lost → 2 actions remain
     Stunned 2 + Slowed 1     → max(1, 2, 0) = 2 lost → 1 action remains
     Paralyzed                → bypasses math; all actions + reaction locked

   Stunned carryover (structural — SS5:224, SS5:268; NOT a formula-only
   fix): Stunned X means "lose X actions starting NEXT turn; if X exceeds
   3, the remainder carries to subsequent turns" — it is not a static
   per-turn tier the way Slowed is. `stunnedCountdown` is a persisted actor
   flag (module id `AT_MODULE_ID` == condition-overlay.js's `MODULE_ID`,
   both `'baphomet-utils'` — one shared flag namespace) maintained entirely
   by condition-overlay.js; see that file's "STUNNED COUNTDOWN LIFECYCLE"
   comment block for the full flag shape, the decrement mechanics, and the
   round-4 mid-turn-application-skip guard (SS5:224 "starting NEXT turn").
   It is read here unconditionally — no gate on whether the Stunned buff
   itself still exists, which sidesteps the buff-deletion-vs-pip-read race
   that broke an earlier design. Worked example, Stunned 4 applied before
   the actor's turn 1: turn 1 → lose 3 (0 remain, countdown 4 → 1); turn 2
   → lose 1 (2 remain, countdown 1 → 0, buff removed, condition clears).
   ---------------------------------------------------------- */

function _readConditionActionLoss(actor) {
  if (!actor) return { actionsLost: 0, fullyIncapacitated: false };

  let isNauseated        = false;
  let slowedTotal        = 0;
  let fullyIncapacitated = false;

  for (const item of actor.items) {
    if (item.type !== 'buff') continue;
    const flags = item.flags?.[AT_MODULE_ID];
    if (!flags?.conditionKey) continue;
    if (!item.system?.active) continue;

    const tier = flags.tier ?? 1;

    switch (flags.conditionKey) {
      case 'slowed':     slowedTotal  += tier;      break;
      case 'nauseated':  isNauseated = true;        break;
      case 'paralyzed':  fullyIncapacitated = true; break;
      // 'stunned' is deliberately NOT read from the buff loop — its
      // action-loss contribution comes from the stunnedCountdown actor
      // flag below, not this buff's own tier. See the comment block above.
    }
  }

  if (fullyIncapacitated) {
    return { actionsLost: 3, fullyIncapacitated: true };
  }

  const stunnedCountdown = Number(actor.getFlag(AT_MODULE_ID, 'stunnedCountdown')) || 0;
  const nauseatedLoss = isNauseated ? 1 : 0;
  const actionsLost = Math.min(Math.max(slowedTotal, stunnedCountdown, nauseatedLoss), 3);

  return { actionsLost, fullyIncapacitated: false };
}

function _hasCombatReflexes(actor) {
  if (!actor) return false;
  return actor.items.some(i =>
    i.type === 'feat' &&
    i.name.toLowerCase().includes('combat reflexes')
  );
}

/**
 * v1.23: number of Combat Reflexes attack-of-opportunity pips a combatant
 * should have — the actor's Dexterity modifier (PF1: AoOs = 1 base + Dex
 * mod; the base is the blue reaction pip, these jade pips are the extra
 * AoOs). Returns 0 when the feat is absent or the Dex modifier is <= 0.
 * Dex path confirmed live: actor.system.abilities.dex.mod.
 *
 * @param {Actor} actor
 * @returns {number}
 */
function _combatReflexCount(actor) {
  if (!_hasCombatReflexes(actor)) return 0;
  const dexMod = actor?.system?.abilities?.dex?.mod;
  return Number.isFinite(dexMod) ? Math.max(0, dexMod) : 0;
}

/* ----------------------------------------------------------
   REACTION / AoO PIP REFRESH — v1.27 (retimed, GOAL_v2.35.0_REACTION_RETIME)

   Reaction + Combat Reflexes pips are a per-TURN resource: they refresh
   at the start of EACH COMBATANT'S OWN turn (CONFLICT-1 ruling), not at
   a single simultaneous round-start moment for everyone. The prior
   round-keyed mechanism (_maybeResetReactionsForNewRound, guarded by the
   module-level _reactionResetRound marker) is REMOVED — no code path
   here refreshes reactions on a shared round boundary anymore.

   _resetReactionReflexPips (below, formerly _resetReactionReflexForRound)
   is now called directly from _maybeResetForNewTurn, at the same
   render-based `.active`-combatant detection point action pips already
   reset from. It no longer writes the pip flag itself — the caller
   (_maybeResetForNewTurn) does a single flag write after ALL of a turn's
   resets (actions, reaction/reflex, condition locks) are applied.
   ---------------------------------------------------------- */

/**
 * Refresh one combatant's reaction + Combat Reflexes pips to full for
 * their own new turn, recomputing the AoO count from current Dex mod.
 * Respects full incapacitation (Paralyzed -> no reactions/AoOs). Does
 * NOT write the pip flag itself — caller is responsible for that.
 */
function _resetReactionReflexPips(combatantId, combatant) {
  const state = _getState(combatantId);
  if (!state) return;
  state.reaction = [true];
  const reflexCount = _combatReflexCount(combatant?.actor);
  state.combatReflex = reflexCount > 0;
  state.reflexPip = Array(reflexCount).fill(true);
  const { fullyIncapacitated } = _readConditionActionLoss(combatant?.actor);
  if (fullyIncapacitated) {
    state.reaction = [false];
    state.reflexPip = state.reflexPip.map(() => false);
  }
}

/* ----------------------------------------------------------
   APPLY CONDITION LOCKS
   Auto-lock pips at turn start based on conditions.
   ---------------------------------------------------------- */

function _applyConditionLocks(combatantId, actor) {
  const state = _getState(combatantId);
  if (!state) return;

  const { actionsLost, fullyIncapacitated } = _readConditionActionLoss(actor);

  if (fullyIncapacitated) {
    state.actions = [false, false, false];
    state.reaction = [false];
    state.reflexPip = state.reflexPip.map(() => false);
    state.conditionLocked = 3;
    return;
  }

  const toLock = Math.min(actionsLost, 3);
  for (let i = 0; i < toLock; i++) {
    state.actions[i] = false;
  }
  state.conditionLocked = toLock;
}

/* ----------------------------------------------------------
   RENDER-BASED TURN-START RESET — v1.6, guard redesigned v1.27 round-02

   Called from inside the renderCombatTracker hook for the
   combatant whose row has the `.active` CSS class. Foundry
   sets `.active` on the current combatant's <li> AFTER all
   combat state has been updated, so it's the most reliable
   signal of "who is the active combatant right now."

   The dedupe no longer compares against combat.round or combat.turn at
   all (see the v1.27 round-01/round-02 changelog blocks near the top of
   this file for why: combat.turn is a re-sortable array index, not an
   identity, and Delay / mid-round insertion above the active combatant
   were both confirmed live to move it without a genuine new turn
   beginning). Instead the guard asks the client-local `_advanceTurnSeq`
   tracker "did a genuine new turn actually start for this combatant,"
   which is `true` only on an active-identity change or a round advance.
   Still safely idempotent — call it on every render of the active
   combatant; it only does work on a genuine turn-start transition.
   ---------------------------------------------------------- */

/**
 * v2.34.0: PROACTIVE BREADCRUMB — cross-script "who is the active combatant
 * right now" signal, read by condition-overlay.js's turn-transition decrement
 * logic (Stunned countdown + the TRUST-4 activeGM gate's dedupe context).
 *
 * Two prior fix attempts derived the departing combatant REACTIVELY at
 * combatTurn hook-fire time (first `combat.current.turn`, then
 * `combat.combatant`), and both were disproven by live two-seat
 * re-verification in a 2-combatant alternating encounter — Foundry
 * combat-state propagation is not guaranteed settled at that exact moment
 * in this environment. Instead of a fourth reactive read, this STAMPS the
 * active combatant at the one point already proven safe: the render-based
 * turn-start detection below (`_maybeResetForNewTurn`, called from inside
 * `renderCombatTracker`, which Foundry guarantees fires only after combat
 * state is fully committed — the whole premise of the v1.6 rewrite this
 * function is part of). condition-overlay.js reads this instead of
 * re-deriving anything from combat.turns/combat.combatant/combat.current.turn
 * at its own hook-fire time.
 *
 * Bridged via `globalThis` (the same pattern already used by
 * `globalThis.baphometTWF` / `globalThis.baphometAoO` elsewhere in this
 * file) because `module.json` loads these as classic (non-module)
 * `<script>` tags sharing one global scope — action-tracker.js is listed
 * BEFORE condition-overlay.js, so the global is already declared by the
 * time the other file reads it.
 *
 * @param {Combat} combat
 * @param {string} combatantId
 */
function _stampActiveCombatantBreadcrumb(combat, combatantId) {
  globalThis.baphometActiveCombatant = {
    combatId:    combat?.id ?? null,
    combatantId: combatantId ?? null,
    round:       combat?.round ?? null,
    turn:        combat?.turn ?? null,
  };
}

/**
 * v1.27 round-02 (GOAL_v2.35.0_REACTION_RETIME) — module-owned, CLIENT-LOCAL
 * turn-sequence advance, backing the _maybeResetForNewTurn dedupe guard.
 *
 * Replaces the round-01 (round, `combat.turn`-index) pair guard, which the
 * live two-seat probe
 * (`docs/ai-council/GOAL_v2.35.0_REACTION_RETIME/20260724-163226/LIVE_PROBE_RESULT.md`)
 * confirmed spuriously re-fires the ENTIRE turn-start reset body when Delay
 * or a mid-round insertion above the active combatant re-sorts the turn
 * order and moves `combat.turn` out from under a combatant whose active
 * IDENTITY never actually changed. `combat.turn` is an index into a
 * re-sortable array, not an identity — this never keys on it.
 *
 * The sequence for a given combat (`_turnSeqTrack`, keyed by combat.id)
 * advances only when EITHER:
 *   1. the `.active` combatant's IDENTITY differs from the one last
 *      observed by THIS client, or
 *   2. `combat.round` has advanced since THIS client last observed it.
 * Condition 2 is required, not redundant: a single-combatant combat (solo
 * boss, one-creature scene) never changes active identity, so an
 * identity-only key would advance exactly once and that combatant would
 * never refresh again for the rest of the fight (required case 7).
 *
 * CLIENT-LOCALITY TRAP (the reason this is a tracker, not a document flag):
 * a module-owned counter held only in client memory starts EMPTY on every
 * fresh client. Rather than treat "no local record for this combat yet" as
 * "advance" (which would refresh already-spent pips on a mid-turn
 * reload/reconnect — regressing required case 6), the first observation of
 * a combat ADOPTS the current active combatant as already-current WITHOUT
 * signaling an advance. This is the same shape as the retired v1.25
 * `_maybeResetReactionsForNewRound` null-branch (see that changelog entry
 * above). `_initState` already hydrated this combatant's correct
 * spent/available pip VALUES from the persisted combatant flag before this
 * ever runs — only the dedupe bookkeeping is being (re)established here,
 * not the pips themselves. This is also why the persisted `_resetForSeq`
 * field is schema-parity bookkeeping only: this function never compares a
 * remote client's persisted sequence number against its own, which is what
 * avoids needing a durable, permission-sensitive, cross-client-shared
 * document write for this guard at all.
 *
 * `combatStart` seeds `_turnSeqTrack` for a brand-new combat directly (see
 * that hook) so the very first render doesn't redundantly re-fire on top
 * of the fresh full pool `_initState` + `_applyConditionLocks` already gave
 * the first combatant.
 *
 * @param {Combat} combat
 * @param {string} combatantId - the combatant Foundry marked `.active`
 * @returns {{ advanced: boolean, seq: number }}
 */
function _advanceTurnSeq(combat, combatantId) {
  const combatId = combat.id;
  const round = combat.round ?? 0;
  let track = _turnSeqTrack.get(combatId);

  if (!track) {
    // First observation of this combat by THIS client — adopt, don't fire.
    track = { seq: 0, activeId: combatantId, round };
    _turnSeqTrack.set(combatId, track);
    return { advanced: false, seq: track.seq };
  }

  const identityChanged = track.activeId !== combatantId;
  const roundAdvanced = track.round !== round;
  if (!identityChanged && !roundAdvanced) {
    return { advanced: false, seq: track.seq }; // no genuine new turn-start; already caught up
  }

  track.seq += 1;
  track.activeId = combatantId;
  track.round = round;
  return { advanced: true, seq: track.seq };
}

function _maybeResetForNewTurn(combat, combatantId, combatant) {
  if (!combat || !combatantId) return;

  const state = _getState(combatantId);
  if (!state) return;

  const { advanced, seq } = _advanceTurnSeq(combat, combatantId);
  if (!advanced) return; // adopted, or already reset for this turn instance — no genuine new turn-start

  // Mark first to prevent any chance of re-entry (defensive).
  state._resetForSeq = seq;

  // v2.34.0: stamp the proactive breadcrumb — see the comment block above
  // _stampActiveCombatantBreadcrumb for the full rationale. Safe here
  // specifically because this runs inside renderCombatTracker (post-commit),
  // not inside a volatile turn-transition hook.
  _stampActiveCombatantBreadcrumb(combat, combatantId);

  // v1.24: reset the action pips for the new turn.
  state.actions = [true, true, true];
  state.conditionLocked = 0;
  // v1.27 (GOAL_v2.35.0_REACTION_RETIME): reaction + Combat Reflexes (AoO)
  // pips are a per-TURN resource (CONFLICT-1 ruling) — refresh them here
  // too, at the same turn-start detection point as the action pips, instead
  // of on the retired shared round-start boundary.
  _resetReactionReflexPips(combatantId, combatant);
  // v2.29.0: refill the Haste bonus availability for the new turn (grant persists; incap derived).
  state.bonusPip = (state.bonusManual || state.bonusAuto) ? [true] : [];
  // v2.30.0: reset the per-turn MAP swing counter (in-memory) and TWF off-hand budget.
  state.swingsTaken = 0;
  state.offHandUsed = 0;
  state.offSeq = (Number(state.offSeq) || 0) + 1; // bump so this reset write supersedes prior values
  const _resetActorId = combatant?.actor?.id;
  if (_resetActorId) { _mapArmCrit.delete(_resetActorId); _mapPendingConfirm.delete(_resetActorId); }

  if (combatant?.actor) {
    _applyConditionLocks(combatantId, combatant.actor);
  }

  // Persist reset state so remote clients hydrate the fresh full pips.
  // v2.37.0 (GOAL_v2.37.0_PIP_AUTHORITY / FD-06, Trap 4's "the flag write
  // itself"): this whole function already fires identically and independently
  // on EVERY connected client — turn/round state is not player-specific, so
  // the GM's own client detects the same turn-start and performs this same
  // write on its own authority. A non-GM client attempting it too would just
  // be FD-06's doomed direct write a second time for no benefit; no relay is
  // needed here (contrast the player-driven spend paths below, which ARE
  // player-specific and do relay). The turn-sequence guard above this block
  // (_advanceTurnSeq / the `advanced` check / _resetForSeq) is untouched.
  if (game.user.isGM) {
    _writePipFlag(combatantId);
    _writeOffBudget(combatantId); // v2.30.0: persist the reset off-hand budget (isolated flag)
  }

  _debugLog(`Reset pips for ${combatant?.name ?? combatantId} (round ${combat.round ?? 0}, seq ${seq})`);
}

/* ----------------------------------------------------------
   UI: BUILD PIP ROW

   v1.4: pips are <button type="button"> instead of <div>.
   The action-tracker.css carries an `appearance: none;
   padding: 0; font: inherit;` reset so button defaults
   don't override the coin-on-parchment styling.
   ---------------------------------------------------------- */

function _buildPipRow(combatantId, isOwner) {
  const state = _getState(combatantId);
  if (!state) return null;

  const row = document.createElement('div');
  row.classList.add('baph-action-tracker');
  row.dataset.combatantId = combatantId;

  // v1.22: two sub-rows — actions on top, reactions (+ Combat Reflexes) below.
  const actionsRow = document.createElement('div');
  actionsRow.classList.add('baph-pip-actions');
  const reactionsRow = document.createElement('div');
  reactionsRow.classList.add('baph-pip-reactions');

  // --- Action pips (3) ---
  state.actions.forEach((available, idx) => {
    const pip = document.createElement('button');
    pip.type = 'button';
    pip.classList.add('baph-pip', 'action');
    pip.dataset.pipType = 'action';
    pip.dataset.pipIndex = idx;
    pip.title = `Action ${idx + 1}`;

    if (!available && idx < state.conditionLocked) {
      pip.classList.add('condition-locked');
      pip.title = `Action ${idx + 1} — Lost to condition`;
    } else if (!available) {
      pip.classList.add('spent');
    }

    if (isOwner) {
      pip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        _togglePip(combatantId, 'action', idx);
      });
    } else {
      pip.disabled = true;
    }

    actionsRow.appendChild(pip);
  });

  // --- Bonus action pip (Haste) — v2.29.0 ---
  // A 4th *action* pip, shown with the action group. Present when bonusPip is non-empty
  // (granted). Full incapacitation is DERIVED (suppresses use + locks the pip) and never
  // mutates bonusPip, so spent-state survives an incap -> recover cycle within a turn.
  if (Array.isArray(state.bonusPip) && state.bonusPip.length) {
    const _bonusActor = game.combat?.combatants?.get(combatantId)?.actor;
    const _bonusIncap = !!_readConditionActionLoss(_bonusActor).fullyIncapacitated;
    state.bonusPip.forEach((available, idx) => {
      const pip = document.createElement('button');
      pip.type = 'button';
      pip.classList.add('baph-pip', 'bonus');
      pip.dataset.pipType = 'bonus';
      pip.dataset.pipIndex = idx;
      pip.title = 'Bonus action (Haste)';

      if (_bonusIncap) {
        pip.classList.add('condition-locked');
        pip.title = 'Bonus action — suppressed (incapacitated)';
      } else if (!available) {
        pip.classList.add('spent');
      }

      if (isOwner && !_bonusIncap) {
        pip.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          _togglePip(combatantId, 'bonus', idx);
        });
      } else {
        pip.disabled = true;
      }

      actionsRow.appendChild(pip);
    });
  }

  // --- Reaction pip ---
  state.reaction.forEach((available, idx) => {
    const pip = document.createElement('button');
    pip.type = 'button';
    pip.classList.add('baph-pip', 'reaction');
    pip.dataset.pipType = 'reaction';
    pip.dataset.pipIndex = idx;
    pip.title = 'Reaction';

    if (!available) pip.classList.add('spent');

    if (isOwner) {
      pip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        _togglePip(combatantId, 'reaction', idx);
      });
    } else {
      pip.disabled = true;
    }

    reactionsRow.appendChild(pip);
  });

  // --- Combat Reflexes pip ---
  if (state.combatReflex) {
    state.reflexPip.forEach((available, idx) => {
      const pip = document.createElement('button');
      pip.type = 'button';
      pip.classList.add('baph-pip', 'combat-reflex');
      pip.dataset.pipType = 'reflex';
      pip.dataset.pipIndex = idx;
      pip.title = 'Combat Reflexes — AoO Only';

      if (!available) pip.classList.add('spent');

      if (isOwner) {
        pip.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          _togglePip(combatantId, 'reflex', idx);
        });
      } else {
        pip.disabled = true;
      }

      reactionsRow.appendChild(pip);
    });
  }

  // v1.22: assemble the two sub-rows into the tray.
  row.appendChild(actionsRow);
  row.appendChild(reactionsRow);

  // Only block what's strictly needed.
  // - mousedown: triggers Foundry's _onCombatantMouseDown (opens actor sheet)
  // - click:     belt-and-suspenders for any other delegated handlers
  ['mousedown', 'click'].forEach(evt => {
    row.addEventListener(evt, (e) => e.stopPropagation());
  });

  return row;
}

/* ----------------------------------------------------------
   PIP TOGGLE LOGIC
   ---------------------------------------------------------- */

function _togglePip(combatantId, type, index) {
  const state = _getState(combatantId);
  if (!state) return false;

  // Preflight guards that block the toggle entirely (unchanged from pre-v2.37.0).
  // v2.37.0 round-02 (GOAL_v2.37.0_PIP_AUTHORITY FIX-3): these early returns
  // now report `false` — this function's return value is the real outcome.
  // The GM-side relay handler's `case 'toggle'` reads it directly (see
  // _baphSocketPipSpendRelay); its pre-existing UI click-handler callers
  // still ignore the return, unchanged.
  if (type === 'action' && index < state.conditionLocked && !state.actions[index]) return false;
  if (type === 'bonus') {
    // v2.29.0: can't use the Haste bonus while fully incapacitated (derived guard).
    const _bActor = game.combat?.combatants?.get(combatantId)?.actor;
    if (_readConditionActionLoss(_bActor).fullyIncapacitated) return false;
    if (!Array.isArray(state.bonusPip)) return false;
  }

  // v2.37.0 (GOAL_v2.37.0_PIP_AUTHORITY / FD-06): a locally-knowable fact (is
  // there an active GM at all) is checked BEFORE mutating, same as the spend
  // functions below — no active GM means no mutation, no relay, one warning.
  if (!game.user.isGM && !game.users.activeGM) {
    _baphActionWarnPipRelayFailure('no-active-gm');
    return false;
  }

  // v2.37.0 round-02 (OVERSEER FIX BRIEF Defect A): a toggle may only flip a
  // pip slot that ALREADY EXISTS. This is the single choke point for that
  // rule — it runs on every path, including the GM's own call, so a GM
  // console call is covered too. `bonusPip` is `[]` when nothing has been
  // granted, so length 0 rejects every index here and closes the self-grant
  // at the root; out-of-range `actions`/`reaction`/`reflexPip` indices are
  // likewise rejected so none of those arrays can grow. Every existing UI
  // click passes an index produced by the render loop and is therefore
  // in-range — behavior for in-range slots is unchanged by this guard.
  const _toggleArr = type === 'action' ? state.actions
    : type === 'reaction' ? state.reaction
    : type === 'reflex' ? state.reflexPip
    : type === 'bonus' ? state.bonusPip
    : null;
  if (!Array.isArray(_toggleArr) || !Number.isInteger(index) || index < 0 || index >= _toggleArr.length) {
    return false;
  }

  // v2.37.1 (GOAL_v2.37.1_RELAY_PARAMS FIX-3 / F7 ruling, 2026-08-23): a
  // non-GM may flip a pip available -> spent freely (spending is presumed
  // valid), but only a GM may flip spent -> available. "Am I a GM" and "is
  // this slot already spent" are both locally knowable, so this is refused
  // HERE rather than round-tripped — same reasoning as the no-active-gm
  // guard above. This sits ADJACENT to the round-02 bounds guard immediately
  // above, not inside it: that guard answers "does this slot exist?"; this
  // one answers "may this caller move it in that direction?".
  // _maybeResetForNewTurn does not call _togglePip and is untouched by this
  // guard — it must keep returning pips to available on every client.
  if (!game.user.isGM && _toggleArr[index] === false) {
    _baphActionWarnPipRelayFailure('not-gm-return');
    return false;
  }

  let priorValue;
  if (type === 'action') {
    priorValue = state.actions[index];
    state.actions[index] = !priorValue;
  } else if (type === 'reaction') {
    priorValue = state.reaction[index];
    state.reaction[index] = !priorValue;
  } else if (type === 'reflex') {
    priorValue = state.reflexPip[index];
    state.reflexPip[index] = !priorValue;
  } else if (type === 'bonus') {
    priorValue = state.bonusPip[index];
    state.bonusPip[index] = !priorValue;
  } else {
    return false;
  }

  _refreshPipRow(combatantId);

  if (game.user.isGM) {
    _writePipFlag(combatantId);
    return true;
  }

  // Player path: relay through the active GM instead of the doomed direct
  // write (FD-06). On rejection/no-active-GM, revert this specific toggle
  // locally — never via _writePipFlag, which would attempt the same doomed
  // write again.
  const seq = ++state.pipSeq;
  // v2.37.0 round-02 (FIX-2): a pending revert must not fire after this
  // combatant's own turn has ended and the pips have been reset in place by
  // _maybeResetForNewTurn (Trap-4 protected — not edited here). That reset
  // writes the flag on the GM's client, which does bump pipSeq via the
  // updateCombatant hydrator (FIX-2 above) once the write round-trips back
  // to this client — but a rejection response racing ahead of that echo
  // must not be allowed to clobber the fresh post-reset pips in the
  // meantime. Capturing and re-checking (round, activeId) here closes that
  // race without touching _maybeResetForNewTurn itself — the identical test
  // rollbackOffHandSwing already uses for the same reason.
  const capturedRound = game.combat?.round ?? 0;
  const capturedActiveId = _currentActiveCombatantId(game.combat);
  _baphActionEmitPipRelay(combatantId, 'toggle', { toggleType: type, toggleIndex: index }, () => {
    if (state.pipSeq !== seq) return; // superseded by a newer local write — Trap 3
    if ((game.combat?.round ?? 0) !== capturedRound || _currentActiveCombatantId(game.combat) !== capturedActiveId) return; // this combatant's turn has since ended — Trap 3/FIX-2
    _baphActionApplyPipValue(state, type, index, priorValue);
    _refreshPipRow(combatantId);
  });
  return true;
}

/* ----------------------------------------------------------
   _refreshPipRow — v1.5 + v1.7 ownership hardening

   Rebuilds every pip row currently rendered for this combatant.
   Important when the Encounter Tracker is popped out: the same
   combatant is rendered TWICE (once in the sidebar tracker, once
   in the popout window), and both need to be replaced. State is
   already shared between the two — pipState is keyed on
   combatantId — so the fix is purely in the DOM write step.

   v1.7: isOwner computation broadened to cover unlinked tokens
   and edge-case ownership chains. See header comment for rationale.
   ---------------------------------------------------------- */

function _refreshPipRow(combatantId) {
  const rows = document.querySelectorAll(`.baph-action-tracker[data-combatant-id="${combatantId}"]`);
  if (!rows.length) return;

  const combat = game.combat;
  const combatant = combat?.combatants.get(combatantId);

  rows.forEach(existing => {
    const parent = existing.parentElement;
    if (!parent) return;

    // v1.7: broadened ownership check — combatant.isOwner is primary;
    // actor and token fallbacks cover unlinked token edge cases.
    const isOwner = combatant
      ? (game.user.isGM || combatant.isOwner || combatant.actor?.isOwner || combatant.token?.isOwner)
      : (existing.dataset.isOwner === 'true');

    const newRow = _buildPipRow(combatantId, isOwner);
    if (!newRow) return;

    newRow.dataset.isOwner = String(isOwner);
    parent.replaceChild(newRow, existing);
  });
}

/* ----------------------------------------------------------
   COMBAT TRACKER INJECTION + RENDER-BASED TURN RESET — v1.6

   This hook now does double duty:
   1. (Original v1.2 layout fix) Inject the pip row as a full-width
      block below the combatant's stats row.
   2. (NEW in v1.6) Detect the active combatant via the `.active`
      CSS class Foundry sets on the active combatant's <li>, and
      reset their pips if we haven't already this round.

   The active-class detection is the truth source. We do NOT trust
   combat.current.turn during volatile hook events — only the DOM
   that Foundry has finished rendering after all updates apply.

   Insertion priority (unchanged from v1.2):
     a) .token-initiative (insert after — best, sits below stats)
     b) .combatant-controls wrapper (insert before — also below stats)
     c) .token-resource (insert after HP)
     d) .token-name / .combatant-name (insert after name)
     e) append() as last resort
   ---------------------------------------------------------- */

Hooks.on('renderCombatTracker', (app, html, data) => {
  const combat = game.combat;
  if (!combat) return;

  // v1.27 (GOAL_v2.35.0_REACTION_RETIME): the per-round reaction/Combat
  // Reflexes refresh call that used to live here is REMOVED. Reaction +
  // reflex pips now refresh inside _maybeResetForNewTurn, alongside the
  // action pips, for the active combatant only — see that function.

  const root = _baphNormalizeHtml(html);
  if (!root) return;

  const combatantEntries = root.querySelectorAll('.combatant, [data-combatant-id]');

  combatantEntries.forEach(entry => {
    const combatantId = entry.dataset.combatantId
      ?? entry.getAttribute('data-combatant-id')
      ?? entry.closest('[data-combatant-id]')?.dataset.combatantId;

    if (!combatantId) return;

    const combatant = combat.combatants.get(combatantId);
    if (!combatant?.actor) return;

    // Ensure state exists
    if (!_getState(combatantId)) {
      _initState(combatantId);
    }

    // v1.23: sync Combat Reflexes pip count if the feat or Dex mod changed mid-combat.
    const state = _getState(combatantId);
    const reflexCount = _combatReflexCount(combatant.actor);
    if (state.combatReflex !== (reflexCount > 0) || state.reflexPip.length !== reflexCount) {
      state.combatReflex = reflexCount > 0;
      const prev = state.reflexPip;
      state.reflexPip = Array.from({ length: reflexCount }, (_, i) => prev[i] ?? true);
    }

    // v1.6: render-based turn-start reset.
    // If THIS entry is the active one (Foundry's own .active class)
    // and we haven't reset them for the current round yet, do so.
    // Must happen BEFORE the pip row is built so the new row reflects
    // the freshly-reset state.
    if (entry.classList.contains('active')) {
      _maybeResetForNewTurn(combat, combatantId, combatant);
    }

    // Remove stale pip row before re-render
    const oldRow = entry.querySelector('.baph-action-tracker');
    if (oldRow) oldRow.remove();

    // v1.7: broadened ownership check — same as _refreshPipRow.
    const isOwner = game.user.isGM || combatant.isOwner || combatant.actor?.isOwner || combatant.token?.isOwner;
    const pipRow = _buildPipRow(combatantId, isOwner);
    if (!pipRow) return;

    pipRow.dataset.isOwner = String(isOwner);

    // Find the best anchor: insert pip row AFTER this element
    const initiativeEl = entry.querySelector('.token-initiative');
    const resourceEl   = entry.querySelector('.token-resource');
    const nameEl       = entry.querySelector('.token-name, .combatant-name');
    const controlsEl   = entry.querySelector('.combatant-controls');

    if (initiativeEl) {
      initiativeEl.insertAdjacentElement('afterend', pipRow);
    } else if (controlsEl) {
      entry.insertBefore(pipRow, controlsEl);
    } else if (resourceEl) {
      resourceEl.insertAdjacentElement('afterend', pipRow);
    } else if (nameEl) {
      nameEl.insertAdjacentElement('afterend', pipRow);
    } else {
      entry.appendChild(pipRow);
    }
  });
});

/* ----------------------------------------------------------
   COMBAT LIFECYCLE: STATE INIT + CLEANUP

   v1.6: turn-detection hooks (pf1PostTurnChange, combatTurn,
   combatRound) and _handleTurnChange / _turnChangeProcessed
   all REMOVED. Render-based detection in renderCombatTracker
   replaces them. These lifecycle hooks remain — they manage
   pipState entries (init / cleanup), not turn detection.
   ---------------------------------------------------------- */

Hooks.on('deleteCombat', (combat) => {
  for (const c of combat.combatants) pipState.delete(c.id);
  // v1.27 round-02: clear this combat's client-local turn-sequence tracker
  // (hygiene only — a deleted combat's id is never reused).
  _turnSeqTrack.delete(combat.id);
  // v2.34.0: clear the breadcrumb if it belonged to this now-deleted combat
  // (hygiene only — _getBreadcrumbCombatant in condition-overlay.js already
  // guards on combatId matching a live combat).
  if (globalThis.baphometActiveCombatant?.combatId === combat.id) {
    globalThis.baphometActiveCombatant = null;
  }
});

Hooks.on('deleteCombatant', (combatant) => {
  pipState.delete(combatant.id);
});

Hooks.on('createCombatant', (combatant) => {
  if (!combatant.actor) return;
  _initState(combatant.id, _hasCombatReflexes(combatant.actor));
});

Hooks.on('combatStart', (combat) => {
  for (const combatant of combat.combatants) {
    if (!combatant.actor) continue;
    _initState(combatant.id);
  }

  // The first active combatant gets their condition locks applied
  // immediately. The render-based reset will pick them up too on
  // first render, but applying here means the first render shows
  // correct state without waiting for a second render pass.
  const firstCombatant = combat.turns?.[0];
  if (firstCombatant?.actor) {
    _applyConditionLocks(firstCombatant.id, firstCombatant.actor);
    const state = _getState(firstCombatant.id);
    const seedRound = combat.round ?? 1;
    if (state) {
      // v1.27 round-02: seed this combat's client-local turn-sequence
      // tracker with the first active combatant already current, and stamp
      // their own _resetForSeq to match — _initState already gave them a
      // full action/reaction/reflex pool, so the first render's
      // _maybeResetForNewTurn call should not redundantly re-reset them.
      state._resetForSeq = 0;
    }
    _turnSeqTrack.set(combat.id, { seq: 0, activeId: firstCombatant.id, round: seedRound });
    // v2.34.0: stamp the breadcrumb here too (combatStart runs synchronously,
    // not via renderCombatTracker) so it's correct from the very first
    // turn-transition, before any render has fired.
    _stampActiveCombatantBreadcrumb(combat, firstCombatant.id);
  }
});

/* ----------------------------------------------------------
   MACRO API
   ---------------------------------------------------------- */

Hooks.once('ready', () => {
  game.baphometActions = {
    getState: (combatantId) => {
      const state = _getState(combatantId);
      if (!state) return null;
      return {
        actionsRemaining: state.actions.filter(a => a).length,
        actionsTotal: 3,
        reactionAvailable: state.reaction[0],
        combatReflexAvailable: state.combatReflex ? state.reflexPip.filter(p => p).length : null,
        conditionLocked: state.conditionLocked,
        bonusActionsRemaining: Array.isArray(state.bonusPip) ? state.bonusPip.filter(p => p).length : 0,
        bonusActionsTotal:     Array.isArray(state.bonusPip) ? state.bonusPip.length : 0,
        bonusManualGranted:    !!state.bonusManual
      };
    },
    reset: (combatantId) => {
      _resetState(combatantId);
      _refreshPipRow(combatantId);
      // v2.37.0 (GOAL_v2.37.0_PIP_AUTHORITY / FD-06): same reasoning as
      // _maybeResetForNewTurn — reset is not player-specific, the GM's own
      // client independently performs the same write, so a non-GM client
      // skips it (no relay needed, unlike the spend paths below).
      if (game.user.isGM) {
        _writePipFlag(combatantId);
        _writeOffBudget(combatantId); // v2.30.0: persist the off-hand-budget reset (isolated flag)
      }
    },
    // Public spend is NORMAL-pool only (never the Haste bonus). Bonus eligibility is
    // enforced privately in _spendActionCore, reachable only via _spendActionForCombatant
    // on the validated single-Strike path. (v2.29.0)
    spendAction: (combatantId, count = 1) => _spendActionCore(combatantId, count, false),
    spendReaction: (combatantId) => {
      const state = _getState(combatantId);
      if (!state || !state.reaction[0]) return false;
      // v2.37.0 (GOAL_v2.37.0_PIP_AUTHORITY / FD-06): "is a GM connected at
      // all" is locally knowable synchronously — refuse cleanly, no
      // mutation, no relay, one warning. Contrast case 7 (ownership), which
      // cannot be known client-side and is why the relay round trip exists.
      if (!game.user.isGM && !game.users.activeGM) {
        _baphActionWarnPipRelayFailure('no-active-gm');
        return false;
      }
      const priorReaction = [...state.reaction];
      state.reaction[0] = false;
      _refreshPipRow(combatantId);
      if (game.user.isGM) {
        _writePipFlag(combatantId);
        return true;
      }
      // Player path: relay through the active GM (FD-06) instead of the
      // doomed direct write. Trap 2: still returns true synchronously here;
      // the relay/revert below happens after this call has already returned.
      const seq = ++state.pipSeq;
      // v2.37.0 round-02 (FIX-2): also capture (round, activeId) — see the
      // shared rationale comment on the _togglePip revert closure below.
      const capturedRound = game.combat?.round ?? 0;
      const capturedActiveId = _currentActiveCombatantId(game.combat);
      _baphActionEmitPipRelay(combatantId, 'reaction', {}, () => {
        if (state.pipSeq !== seq) return; // superseded by a newer local write — Trap 3
        if ((game.combat?.round ?? 0) !== capturedRound || _currentActiveCombatantId(game.combat) !== capturedActiveId) return; // this combatant's turn has since ended — Trap 3/FIX-2
        state.reaction = priorReaction;
        _refreshPipRow(combatantId);
      });
      return true;
    },
    // v1.25: spend one available Combat Reflexes (jade) AoO pip. Mirrors
    // spendReaction. Returns true only if a jade pip was actually spent.
    spendCombatReflex: (combatantId) => {
      const state = _getState(combatantId);
      if (!state) return false;
      const idx = state.reflexPip.findIndex(p => p);
      if (idx === -1) return false;
      if (!game.user.isGM && !game.users.activeGM) {
        _baphActionWarnPipRelayFailure('no-active-gm');
        return false;
      }
      const priorReflexPip = [...state.reflexPip];
      state.reflexPip[idx] = false;
      _refreshPipRow(combatantId);
      if (game.user.isGM) {
        _writePipFlag(combatantId);
        return true;
      }
      const seq = ++state.pipSeq;
      // v2.37.0 round-02 (FIX-2): also capture (round, activeId) — see the
      // shared rationale comment on the _togglePip revert closure below.
      const capturedRound = game.combat?.round ?? 0;
      const capturedActiveId = _currentActiveCombatantId(game.combat);
      _baphActionEmitPipRelay(combatantId, 'combatReflex', {}, () => {
        if (state.pipSeq !== seq) return; // superseded by a newer local write — Trap 3
        if ((game.combat?.round ?? 0) !== capturedRound || _currentActiveCombatantId(game.combat) !== capturedActiveId) return; // this combatant's turn has since ended — Trap 3/FIX-2
        state.reflexPip = priorReflexPip;
        _refreshPipRow(combatantId);
      });
      return true;
    },

    // v2.29.0 Haste bonus action. grant/revoke/toggle are GM-gated (granting is a GM act);
    // reconcile*BonusAuto are active-GM-gated (single writer for buff/setting-driven state).
    grantBonusAction:  (combatantId) => _setManualBonus(combatantId, true),
    revokeBonusAction: (combatantId) => _setManualBonus(combatantId, false),
    toggleBonusAction: (combatantId) => {
      const s = _getState(combatantId);
      if (!s) return false;
      return _setManualBonus(combatantId, !s.bonusManual);
    },
    reconcileBonusAuto:    (combatantId) => _reconcileBonusAutoFor(combatantId),
    reconcileAllBonusAuto: () => _reconcileAllBonusAuto(),

    // v2.30.0 TWF off-hand per-turn budget (Model A; option C — owner-write, no socket).
    // reserve: synchronously consume one off-hand swing if the per-turn pool has room;
    // returns a token for commit/rollback, or null if the pool is already spent this turn.
    reserveOffHandSwing: (combatantId, tier) => {
      let state = _getState(combatantId);
      if (!state) { _initState(combatantId); state = _getState(combatantId); }
      if (!state) return null;
      const budget = TWF_OFF_BUDGET[tier] ?? 0;
      if ((Number(state.offHandUsed) || 0) >= budget) return null; // pool spent this turn
      if (!game.user.isGM && !game.users.activeGM) {
        _baphActionWarnPipRelayFailure('no-active-gm');
        return null;
      }
      state.offHandUsed = (Number(state.offHandUsed) || 0) + 1;
      state.offSeq = (Number(state.offSeq) || 0) + 1;
      // v2.35.0 round-03 (FD-01): token carries activeId, not turn — the sole producer of
      // this token, so no legacy-token compatibility is needed (in-memory only, one session).
      const token = { combatantId, round: game.combat?.round ?? 0, activeId: _currentActiveCombatantId(game.combat), seq: state.offSeq };
      if (game.user.isGM) {
        _writeOffBudget(combatantId);
        return token;
      }
      // v2.37.0 (GOAL_v2.37.0_PIP_AUTHORITY / FD-06): player path — relay
      // through the active GM. On rejection, revert LOCALLY ONLY, mirroring
      // rollbackOffHandSwing's own supersede check exactly (same token
      // shape) but WITHOUT its final _writeOffBudget call — a non-GM client
      // calling that would just attempt the same doomed direct write this
      // goal exists to route around. The token returned below is otherwise
      // unchanged in shape (A14).
      _baphActionEmitPipRelay(combatantId, 'offHandReserve', { tier }, () => {
        if ((Number(state.offSeq) || 0) !== token.seq) return; // superseded by a newer write
        if ((game.combat?.round ?? 0) !== token.round || _currentActiveCombatantId(game.combat) !== token.activeId) return;
        state.offHandUsed = Math.max(0, (Number(state.offHandUsed) || 0) - 1);
        state.offSeq = (Number(state.offSeq) || 0) + 1;
      });
      return token;
    },
    // rollback a reservation when its off-hand use() was cancelled — only if it is still the
    // latest write for this combatant and the same round/active-combatant (else a newer
    // reserve superseded it, or a genuine turn-start already reset the budget).
    rollbackOffHandSwing: (token) => {
      if (!token?.combatantId) return false;
      const state = _getState(token.combatantId);
      if (!state) return false;
      if ((Number(state.offSeq) || 0) !== token.seq) return false; // superseded by a newer write
      // v2.35.0 round-03 (FD-01): compare (round, activeId), not (round, turn) — see
      // OFF_BUDGET_FLAG_KEY's comment and `_currentActiveCombatantId`.
      if ((game.combat?.round ?? 0) !== token.round || _currentActiveCombatantId(game.combat) !== token.activeId) return false;
      state.offHandUsed = Math.max(0, (Number(state.offHandUsed) || 0) - 1);
      state.offSeq = (Number(state.offSeq) || 0) + 1;
      if (game.user.isGM) {
        _writeOffBudget(token.combatantId);
        return true;
      }
      // v2.37.0 round-02 (GOAL_v2.37.0_PIP_AUTHORITY FIX-1): non-GM client
      // relays the release through the active GM instead of attempting the
      // doomed direct write (FD-06) — this call was previously byte-unchanged
      // from before the FD-06 fix and left a cancelled off-hand swing stuck
      // spent on the server and every other client. The local decrement above
      // is already applied optimistically (Trap 2); on rejection/no-active-GM
      // it is undone by re-incrementing offHandUsed, guarded by THIS client's
      // own offSeq value captured just now (Trap 3 — a purely local
      // supersede check; the GM cannot be handed this client's token `seq` at
      // all — see `_releaseOffHandSwingForCombatant`'s doc comment for how
      // the GM instead validates from its own authoritative state that it is
      // releasing this same turn's reservation).
      const localSeq = state.offSeq;
      _baphActionEmitPipRelay(token.combatantId, 'offHandRollback', {}, () => {
        if ((Number(state.offSeq) || 0) !== localSeq) return; // superseded by a newer local write
        state.offHandUsed = (Number(state.offHandUsed) || 0) + 1;
        state.offSeq = (Number(state.offSeq) || 0) + 1;
      });
      return true;
    },
    // v2.30.0 named bridge for settings.js: clear the in-memory MAP swing counter (and the
    // crit-confirm guards) on toggle-off. Does NOT touch the TWF off-hand budget (separate
    // concern). Mirrors the Phase-5 reconcileAllBonusAuto bridge.
    resetMapCounters: () => {
      for (const [, st] of pipState) { if (st) st.swingsTaken = 0; }
      _mapArmCrit.clear();
      _mapPendingConfirm.clear();
    }
  };

  _debugLog('Action Tracker v1.8 ready');
});

/* ============================================================
   PIP-WRITE SOCKET RELAY   [v2.37.0 — GOAL_v2.37.0_PIP_AUTHORITY,
   "Whose Hand Moves" — the FD-06 fix]

   FD-06 (established live 2026-07-25, GOAL_v2.35.0_REACTION_RETIME
   round-01 evidence): combatant.isOwner === true does NOT predict
   server-side Combatant-update permission for a role-2 client in this
   world/version. Every write path above that could run on a non-GM
   client (spendReaction, spendCombatReflex, reserveOffHandSwing,
   rollbackOffHandSwing, _spendActionCore, _togglePip) now branches on
   game.user.isGM: the GM path is byte-identical to before (direct
   _writePipFlag/_writeOffBudget, no socket). A non-GM client applies its
   mutation optimistically (same local state change + render as before) and
   relays the request here instead of attempting the doomed direct write.
   Success is NOT echoed back on a bespoke channel — the existing
   updateCombatant hydrators (pip state hydrator; off-hand-budget hydrator,
   further down this file) already propagate the GM's authoritative write
   to every client, including the requester. Only failure/no-active-GM
   reverts the optimistic mutation, guarded by each caller's own
   `state.pipSeq` capture PLUS a re-check that (round, activeId) is
   unchanged since capture (or, for off-hand, the existing `state.offSeq`
   token, which already carries round/activeId) so a late revert can never
   clobber a spend — or a turn-start reset — that landed after it (Trap 3;
   see the `_togglePip` and `updateCombatant`-hydrator comment blocks for
   what the pipSeq guard actually covers, round-02 corrected).

   SOCKET ACTION NAME: 'baphPipSpendRelay'

   PAYLOAD SHAPE:
     {
       combatantId: string,                                          // required
       kind: 'reaction' | 'combatReflex' | 'action' | 'offHandReserve'
             | 'offHandRollback' | 'toggle',                          // optional, default 'action'
       count: number,                                                 // 'action' only, default 1
       allowBonus: boolean,                                           // 'action' only, default false —
                                                                        // v2.37.0 round-02 (OVERSEER FIX
                                                                        // BRIEF Defect B). Carries the
                                                                        // client's own eligibility (set
                                                                        // ONLY by _spendActionForCombatant
                                                                        // for a validated single ordinary
                                                                        // Strike). The GM re-runs
                                                                        // _spendActionCore's own
                                                                        // `bonusUsable` check against its
                                                                        // OWN authoritative
                                                                        // state.bonusPip[0] — this field
                                                                        // only selects which
                                                                        // already-granted pool may be
                                                                        // drawn from; it cannot create a
                                                                        // bonus pip that doesn't already
                                                                        // exist in the GM's state.
       tier: 'base' | 'improved' | 'greater',                         // 'offHandReserve' only
       toggleType: 'action' | 'reaction' | 'reflex' | 'bonus',        // 'toggle' only
       toggleIndex: number,                                           // 'toggle' only
       requestingUserId: string                                       // OPTIONAL, CLIENT-CLAIMED.
                                                                        // Advisory/logging only — NEVER
                                                                        // read for authority. The verified
                                                                        // sender is always socketlib's own
                                                                        // this.socketdata.userId (§3,
                                                                        // VERIFIED_SENDER_PATTERN_REFERENCE.md).
     }

   Registration/emit/handler shape copied from task-tracker.js's
   TD-04/v2.36.0 migration, itself copied from
   docs/reference/socket-authority/VERIFIED_SENDER_PATTERN_REFERENCE.md:
     - COPIED: Hooks.once('socketlib.ready', ...) registration
       (task-tracker.js:144-150); socketlib.registerModule(...) is
       idempotent per module id (socketlib-v1.1.4-source.js:32-35), so
       this returns the SAME Socket instance task-tracker.js already
       registered — one shared functions map, two independent action
       names ('baphPipSpendRelay' here; baphTaskResolveAdjudicate /
       baphTaskAidAdjudicate / baphTaskReadinessCheck there).
     - COPIED: executeAsGM(action, payload) as the emit call
       (task-tracker.js:527), not a raw game.socket.emit.
     - COPIED: the GM handler re-derives the caller from
       `this?.socketdata?.userId` (task-tracker.js:2391) — the verified
       sender, sourced from Foundry's own socket/session layer
       (socketlib-v1.1.4-source.js:190-192, 251-259) — NEVER from
       `payload.requestingUserId` — and re-checks ownership against that
       verified id via combatant.actor.ownership /
       CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER (task-tracker.js:2419-2424).
     - NOT COPIED: the raw `game.socket.on('module.baphomet-utils', ...)`
       listener further down this file (baphTaskRequest /
       baphTaskRequestResponse, TRUST-1 unfixed / TD-23) — that pattern
       is explicitly out of scope and is not the shape reused here.
   ============================================================ */

let _baphActionSocket = null;

Hooks.once('socketlib.ready', () => {
  _baphActionSocket = socketlib.registerModule(AT_MODULE_ID);
  _baphActionSocket.register('baphPipSpendRelay', _baphSocketPipSpendRelay);
  _debugLog('socketlib: registered baphPipSpendRelay handler');
});

/**
 * Distinguishable, exactly-once "Say So" warning for a reverted relay
 * spend — never fired for an ordinary exhausted-pool click (those return
 * false/no-op above with no notification, unchanged pre-v2.37.0
 * behavior), so this is never ambiguous with that case.
 */
function _baphActionWarnPipRelayFailure(reason) {
  const messages = {
    'no-active-gm':  'No GM is connected — this action could not be saved and was undone.',
    'not-owner':     'The GM rejected this action (ownership check failed) — it was undone.',
    'rejected':      'The GM could not process this action — it was undone.',
    // v2.37.1 (GOAL_v2.37.1_RELAY_PARAMS FIX-3 / F7 ruling): a non-GM tried
    // to flip a spent pip back to available. Distinguishable from an
    // ordinary exhausted-pool no-op (which never reaches this function).
    'not-gm-return': 'Only the GM may return a spent pip — this click was undone.',
  };
  ui.notifications?.warn?.(messages[reason] ?? messages.rejected);
  _debugLog(`pipSpendRelay: reverted (${reason})`);
}

// Shared apply for a _togglePip-shaped revert (type/index -> pipState array).
function _baphActionApplyPipValue(state, type, index, value) {
  if (type === 'action') state.actions[index] = value;
  else if (type === 'reaction') state.reaction[index] = value;
  else if (type === 'reflex') state.reflexPip[index] = value;
  else if (type === 'bonus' && Array.isArray(state.bonusPip)) state.bonusPip[index] = value;
}

/**
 * Player-path emit helper. The caller has ALREADY applied its optimistic
 * local mutation and returned synchronously (Trap 2) before this runs.
 * `onFailure` is invoked at most once, only when the GM rejects the
 * request or no active GM ever answers it — never for success, since the
 * existing updateCombatant hydrators already reconcile the happy path (no
 * bespoke response path for that case, by design).
 *
 * @param {string} combatantId
 * @param {'reaction'|'combatReflex'|'action'|'offHandReserve'|'offHandRollback'|'toggle'} kind
 * @param {object} extra           - kind-specific payload fields (count/tier/toggleType/toggleIndex)
 * @param {() => void} onFailure   - reverts the optimistic mutation; must itself
 *                                   re-check supersession (Trap 3) before acting
 */
function _baphActionEmitPipRelay(combatantId, kind, extra, onFailure) {
  if (!_baphActionSocket) {
    console.warn(`${AT_MODULE_ID} | pipSpendRelay: socketlib module not yet registered — "${kind}" not sent.`);
    onFailure();
    _baphActionWarnPipRelayFailure('no-active-gm');
    return;
  }
  _baphActionSocket.executeAsGM('baphPipSpendRelay', { combatantId, kind, ...extra })
    .then((result) => {
      if (result?.ok) return; // happy path — the updateCombatant hydrator reconciles this client
      onFailure();
      _baphActionWarnPipRelayFailure(result?.reason ?? 'rejected');
    })
    .catch((err) => {
      console.error(`${AT_MODULE_ID} | pipSpendRelay ("${kind}") failed: ${err}`);
      onFailure();
      _baphActionWarnPipRelayFailure('no-active-gm');
    });
}

/**
 * v2.37.0 round-02 (GOAL_v2.37.0_PIP_AUTHORITY FIX-1): GM-side release for a
 * relayed off-hand-swing rollback (`rollbackOffHandSwing` on a non-GM
 * client). The requester's own reservation token carries a `seq` value, but
 * that value is NOT comparable to the GM's own `state.offSeq` — the GM's
 * offSeq already advanced independently when it relayed (and wrote) the
 * original `reserveOffHandSwing` call, so handing the client's token `seq`
 * to the existing token-based supersede check would silently no-op every
 * relayed rollback (a false-negative "superseded," not a real one). This
 * instead validates entirely from the GM's OWN authoritative state, never
 * from anything the payload claims:
 *
 *   - `state.offHandUsed > 0` on the GM's own client is true ONLY within the
 *     SAME turn as the reservation that produced it. `_resetState` (the
 *     manual reset() path) and the inline reset inside
 *     `_maybeResetForNewTurn` (Trap-4 protected, not touched) both always
 *     zero `offHandUsed` first, on every turn boundary, on every client
 *     including the GM's own. So a nonzero value already PROVES "this is
 *     still the current turn's reservation" — establishing that the
 *     release is for the same turn without trusting any round/activeId the
 *     client might send.
 *   - `combatantId` must still be the GM's own live
 *     `_currentActiveCombatantId(game.combat)` — the identical invariant
 *     `reserveOffHandSwing` itself enforces (via the token it mints), here
 *     re-derived fresh from the GM's own combat object rather than read
 *     from the client's token.
 *
 * @param {string} combatantId
 * @returns {boolean}
 */
function _releaseOffHandSwingForCombatant(combatantId) {
  const state = _getState(combatantId);
  if (!state) return false;
  if ((Number(state.offHandUsed) || 0) <= 0) return false; // nothing reserved this turn — GM's own state says so
  if (_currentActiveCombatantId(game.combat) !== combatantId) return false; // not this combatant's turn on the GM's own client
  state.offHandUsed = Math.max(0, (Number(state.offHandUsed) || 0) - 1);
  state.offSeq = (Number(state.offSeq) || 0) + 1;
  _writeOffBudget(combatantId);
  return true;
}

/**
 * GM-side handler for a relayed pip/off-hand spend. socketlib's
 * executeAsGM/ONE_GM routing already guarantees this only runs on the
 * elected active GM client; the isGM/activeGM checks mirror
 * task-tracker.js's FIX-02 pattern defensively rather than rely on that
 * alone. Trap 1: re-derives the caller from the VERIFIED sender
 * (`this.socketdata.userId`), never `payload.requestingUserId`, and
 * re-checks both ownership of the target combatant's actor and combat
 * membership before doing anything.
 *
 * The actual spend re-runs the SAME public game.baphometActions.spend*
 * function (or, for 'toggle', the same private _togglePip) a GM's own
 * click would call. Because this handler only ever executes on a genuine
 * active-GM client, that function takes its unchanged "GM path: write
 * directly" branch — so the availability checks really are re-run
 * against the GM's own authoritative state, not merely replayed from
 * anything the client claimed.
 *
 * Declared with `function`, not arrow syntax, so socketlib's
 * `.call({socketdata}, ...)` binding supplies `this.socketdata.userId`
 * (VERIFIED_SENDER_PATTERN_REFERENCE.md §3).
 *
 * @param {object} payload
 * @returns {{ok: boolean, reason?: string}|undefined}
 */
async function _baphSocketPipSpendRelay(payload = {}) {
  if (!game.user.isGM) return { ok: false, reason: 'not-gm' };
  if (game.user !== game.users?.activeGM) return; // silent — non-active GM correctly ignores

  const requestingUserId = this?.socketdata?.userId; // verified sender — NEVER payload.requestingUserId
  const { combatantId, kind = 'action', count = 1, tier, toggleType, toggleIndex, allowBonus } = payload ?? {};

  const combat = game.combat;
  if (!combat) {
    _debugLog(`pipSpendRelay: no active combat — rejected (kind=${kind}, from ${requestingUserId})`);
    return { ok: false, reason: 'no-active-combat' };
  }
  const combatant = combat.combatants.get(combatantId);
  if (!combatant || combatant.parent?.id !== combat.id) {
    console.warn(`${AT_MODULE_ID} | pipSpendRelay: combatant "${combatantId}" not in the active combat — rejected (from ${requestingUserId})`);
    return { ok: false, reason: 'combatant-not-in-active-combat' };
  }

  const requestingUser = game.users.get(requestingUserId);
  if (!requestingUser) {
    console.warn(`${AT_MODULE_ID} | pipSpendRelay: requesting user "${requestingUserId}" not found — rejected`);
    return { ok: false, reason: 'unknown-user' };
  }

  // Trap 1 — re-derive ownership from the VERIFIED sender, never the payload.
  const OWNER_LEVEL    = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  const actorOwnership = combatant.actor?.ownership ?? {};
  const userLevel      = actorOwnership[requestingUserId] ?? 0;
  const defaultLevel   = actorOwnership['default'] ?? 0;
  const effectiveLevel = Math.max(userLevel, defaultLevel);
  if (!requestingUser.isGM && effectiveLevel < OWNER_LEVEL) {
    console.warn(
      `${AT_MODULE_ID} | pipSpendRelay: user "${requestingUser.name}" (${requestingUserId}) does not own ` +
      `"${combatant.name}" — rejected (kind=${kind})`
    );
    return { ok: false, reason: 'not-owner' };
  }

  if (!_getState(combatantId)) _initState(combatantId);

  let ok = false;
  switch (kind) {
    case 'reaction':       ok = game.baphometActions.spendReaction(combatantId); break;
    case 'combatReflex':   ok = game.baphometActions.spendCombatReflex(combatantId); break;
    case 'offHandReserve': {
      // v2.37.1 (GOAL_v2.37.1_RELAY_PARAMS FIX-1 / D-1a): the payload's
      // `tier` is DISCARDED — the GM derives it fresh from the combatant's
      // own actor, the identical bFlags shape macros/twf-tier-aware.js:56-57
      // uses (a read-only reference, copied here, not edited).
      // reserveOffHandSwing(combatantId, tier) itself is UNCHANGED — this
      // only fixes what value this relay boundary hands to it. An actor with
      // no TWF feat at all is refused with a distinct reason rather than
      // falling through to `?? 0`, which would silently pass a zero budget
      // that reads as an already-spent pool.
      const bf = combatant.actor?.getRollData()?.bFlags ?? {};
      const derivedTier = bf.twfGreater ? 'greater' : bf.twfImproved ? 'improved' : bf.twf ? 'base' : null;
      if (!derivedTier) {
        console.warn(
          `${AT_MODULE_ID} | pipSpendRelay: "${combatant.name}" has no PF1.5 Two-Weapon Fighting feat — ` +
          `offHandReserve rejected (from ${requestingUser.name}, verified id ${requestingUserId})`
        );
        return { ok: false, reason: 'no-twf-feat' };
      }
      ok = !!game.baphometActions.reserveOffHandSwing(combatantId, derivedTier);
      break;
    }
    case 'offHandRollback': ok = _releaseOffHandSwingForCombatant(combatantId); break;
    // v2.37.0 round-02 (GOAL_v2.37.0_PIP_AUTHORITY FIX-3): report _togglePip's
    // ACTUAL result. It previously always reported `ok = true`, so a refusal
    // (a locked/incapacitated pip, or an unknown toggle type) never reverted
    // the requester's optimistic toggle and never warned — FD-06's exact
    // signature reproduced inside this fix. _togglePip now returns the real
    // outcome (see its own comment block).
    case 'toggle': {
      // v2.37.1 (GOAL_v2.37.1_RELAY_PARAMS FIX-3 / F7 ruling, 2026-08-23):
      // LOAD-BEARING — a forged executeAsGM payload never runs the
      // client-side guard inside _togglePip (that guard lives on the
      // requester's own client), so the directional rule (players spend;
      // only a GM returns) must be re-enforced here against the GM's OWN
      // authoritative slot value, never the payload's claim.
      // _maybeResetForNewTurn does not call _togglePip and is not routed
      // through this case, so the turn-start reset is unaffected.
      const toggleState = _getState(combatantId);
      const toggleArr = toggleType === 'action' ? toggleState?.actions
        : toggleType === 'reaction' ? toggleState?.reaction
        : toggleType === 'reflex' ? toggleState?.reflexPip
        : toggleType === 'bonus' ? toggleState?.bonusPip
        : null;
      const slotExists = Array.isArray(toggleArr) && Number.isInteger(toggleIndex)
        && toggleIndex >= 0 && toggleIndex < toggleArr.length;
      if (!requestingUser.isGM && slotExists && toggleArr[toggleIndex] === false) {
        console.warn(
          `${AT_MODULE_ID} | pipSpendRelay: user "${requestingUser.name}" (${requestingUserId}) tried to ` +
          `return an already-spent ${toggleType} pip (index ${toggleIndex}) on "${combatant.name}" — ` +
          `only a GM may do that — rejected`
        );
        return { ok: false, reason: 'return-requires-gm' };
      }
      ok = _togglePip(combatantId, toggleType, toggleIndex);
      break;
    }
    // v2.37.0 round-02 (OVERSEER FIX BRIEF Defect B): call the PRIVATE
    // _spendActionCore directly (never the public spendAction, which is
    // hard-wired allowBonus=false) so the GM's replay re-runs the SAME
    // availability check the client ran — Trap 1, GOAL:151-152 — instead of
    // a stricter one that would refuse a Haste-bonus Strike the client
    // legitimately permitted. `bonusUsable` inside _spendActionCore is
    // UNWEAKENED: it still requires the GM's own authoritative
    // `state.bonusPip[0] === true`. `allowBonus === true` here only selects
    // which already-granted pool this spend may draw from — it cannot
    // create a pip that doesn't already exist in the GM's own state.
    case 'action':
    default: {
      // v2.37.1 (GOAL_v2.37.1_RELAY_PARAMS FIX-2 / D-1b): hardening, NOT a
      // closed exploit — _spendActionCore:2469 already refuses any count
      // larger than the pool, and a negative/fractional count already grants
      // nothing (see the goal's D-1b analysis). This still refuses junk AT
      // THE BOUNDARY with a distinct reason instead of silently coercing it
      // via the previous `Number(count) || 1`.
      if (!Number.isInteger(count) || count < 1 || count > 3) {
        console.warn(
          `${AT_MODULE_ID} | pipSpendRelay: count ${JSON.stringify(count)} out of range (expected integer ` +
          `1..3) for "${combatant.name}" — rejected (from ${requestingUser.name}, verified id ${requestingUserId})`
        );
        return { ok: false, reason: 'count-out-of-range' };
      }
      ok = _spendActionCore(combatantId, count, allowBonus === true);
      break;
    }
  }
  _debugLog(`pipSpendRelay: ${kind} for "${combatant.name}" (from ${requestingUser.name}, verified id ${requestingUserId}) -> ${ok}`);
  return ok ? { ok: true } : { ok: false, reason: 'spend-failed' };
}

/* ============================================================
   AUTOMATION PREP SCAFFOLD — v1.8
   ══════════════════════════════════════════════════════════

   INERT. Nothing below this line is called by any live hook.
   These helpers are declared for future wiring in v2.10.0.

   Do NOT add pf1AttackRoll or pf1ActorRollSkill calls here
   until v2.10.0. The helpers are available for manual testing
   via browser console or macros if needed.

   Guiding constraints for v2.10.0 (do not violate):
   - No token drag / movement auto-spending
   - No inference of standard/move/swift/full-round PF1 actions
   - Verify all SKILL_ACTION_COSTS key names at runtime via
     pf1ActorRollSkill before wiring any skill automation
   - A deduplication guard is required before live hooks go in
   - Debug logging should trace every spend decision
   ============================================================ */

/* ----------------------------------------------------------
   DEBUG LOGGING HELPER
   ---------------------------------------------------------- */

/**
 * Emit a debug log line when the 'debugLogging' module setting
 * is enabled. Fails silently if settings are not yet registered
 * (safe to call at any lifecycle stage).
 *
 * @param {string} msg
 * @param {...*} args
 */
function _debugLog(msg, ...args) {
  try {
    if (!game.settings.get(AT_MODULE_ID, 'debugLogging')) return;
  } catch {
    return; // settings not yet registered — noop
  }
  console.log(`${AT_MODULE_ID} | [DEBUG] ${msg}`, ...args);
}

/* ----------------------------------------------------------
   AUTOMATION HELPER FUNCTIONS
   
   These wrap existing state and render logic for clean use
   from automation hooks. They do not introduce new state.
   ---------------------------------------------------------- */

/**
 * Return the currently active combatant in the live combat,
 * or null if no combat is active or no turn is current.
 *
 * This is the lookup entry point for attack-roll automation
 * (pf1AttackRoll → who is acting → spend their pip).
 *
 * @returns {Combatant|null}
 */
function _getActiveCombatant() {
  return game.combat?.combatant ?? null;
}

/**
 * Return the current active combatant if and only if its linked
 * actor matches the provided actor. Returns null otherwise.
 *
 * SAFETY RULE: Only the current active combatant is eligible for
 * automation spending. Searching all combatants was intentionally
 * removed — it would allow a PF1 hook firing for a non-active
 * actor (e.g. an AoO, an off-turn triggered ability) to incorrectly
 * spend pips for a combatant who hasn't taken their turn yet.
 *
 * Returns null if: combat is inactive, no actor provided,
 * the active combatant has no actor, or the actor IDs do not match.
 *
 * NOTE: Matches on actor.id. Unlinked tokens use synthetic actors
 * not in game.actors — verify behavior with unlinked tokens before
 * enabling automation in v2.10.0. A token-ID fallback may be needed.
 *
 * @param {Actor} actor
 * @returns {Combatant|null}
 */
function _getActiveCombatantForActor(actor) {
  if (!actor || !game.combat) return null;
  const active = game.combat.combatant;
  if (!active?.actor) return null;
  return active.actor.id === actor.id ? active : null;
}

/**
 * Check whether the current user is permitted to control the
 * given combatant's action pips.
 *
 * Mirrors the isOwner computation in _refreshPipRow and the
 * renderCombatTracker injection exactly, so automation gates
 * on the same ownership logic as manual interaction. If the
 * user can't click a pip, automation won't spend it either.
 *
 * @param {Combatant} combatant
 * @returns {boolean}
 */
function _canUserControlCombatant(combatant) {
  if (!combatant) return false;
  return (
    game.user.isGM           ||
    combatant.isOwner         ||
    combatant.actor?.isOwner  ||
    combatant.token?.isOwner
  );
}

/**
 * Spend N action pips for a combatant identified by ID.
 *
 * DELEGATES to game.baphometActions.spendAction() to avoid
 * duplicating the spend loop. game.baphometActions is set up
 * in the ready hook — guards defensively in case this is
 * somehow called before ready fires.
 *
 * Returns true if the full spend was dispatched, false if
 * state was absent, the API wasn't ready, or fewer than
 * count actions are available. Spend is all-or-nothing.
 *
 * `reason` is a short string for debug output only; it is
 * never shown to the user. Suggested values: 'attack-roll',
 * 'skill-acrobatics', 'skill-bluff', etc.
 *
 * @param {string} combatantId
 * @param {number} [count=1]  Number of action pips to spend (1–3)
 * @param {string} [reason]   Debug label
 * @returns {boolean}
 */
/* ----------------------------------------------------------
   HASTE BONUS ACTION — v2.29.0
   A dedicated 4th-action pip (separate from the 3-action core),
   modeled on the Combat-Reflexes (reflexPip) pool. Three axes:
     granted    = bonusManual || bonusAuto  (drives whether bonusPip exists)
     available  = bonusPip[0]               (true=available / false=spent; preserved across incap)
     suppressed = full incapacitation       (DERIVED at use; never mutates bonusPip)
   Usable = granted && !fullyIncapacitated && bonusPip[0] === true.
   ---------------------------------------------------------- */

// Actor-wide scan for an active Haste buff. Callers recompute on ANY buff change, so a
// Haste buff renamed away is handled (the scan simply no longer finds it).
function _hasActiveHasteBuff(actor) {
  return !!actor?.items?.some(i => i.type === 'buff' && i.system?.active && /haste/i.test(i.name));
}

// Transition-only, LOCAL mutation. Never refills a still-effective pip (no mid-turn
// resurrection); never considers incapacitation (derived at use). Refill happens ONLY
// in _resetState / _maybeResetForNewTurn.
function _reconcileBonusPip(combatantId) {
  const state = _getState(combatantId);
  if (!state) return;
  if (!Array.isArray(state.bonusPip)) state.bonusPip = [];
  const effective = !!(state.bonusManual || state.bonusAuto);
  if (!effective) { state.bonusPip = []; return; }            // true -> false: remove pip
  if (state.bonusPip.length === 0) state.bonusPip = [true];    // false -> true: new grant, available
  // else: still effective -> preserve existing [true]/[false]
}

// Recompute auto-grant from the setting + active Haste buffs, then reconcile. LOCAL only.
function _recomputeBonusAuto(combatantId) {
  const state = _getState(combatantId);
  if (!state) return;
  const actor = game.combat?.combatants?.get(combatantId)?.actor;
  let settingOn = false;
  try { settingOn = game.settings.get(AT_MODULE_ID, 'autoHasteBonusAction'); } catch (e) { /* not registered */ }
  state.bonusAuto = !!(settingOn && actor && _hasActiveHasteBuff(actor));
  _reconcileBonusPip(combatantId);
}

// GM-gated manual grant/revoke. Authoritative path: reconcile THEN refresh + persist.
function _setManualBonus(combatantId, on) {
  if (!game.user?.isGM) { ui.notifications?.warn?.('Only the GM can grant a bonus action.'); return false; }
  const state = _getState(combatantId);
  if (!state) return false;
  state.bonusManual = !!on;
  _reconcileBonusPip(combatantId);
  _refreshPipRow(combatantId);
  _writePipFlag(combatantId);
  return true;
}

// Active-GM single-writer reconcile of auto state (the buff/setting bridge).
function _reconcileBonusAutoFor(combatantId) {
  if (game.user !== game.users?.activeGM) return;
  _recomputeBonusAuto(combatantId);
  _refreshPipRow(combatantId);
  _writePipFlag(combatantId);
}

function _reconcileAllBonusAuto() {
  if (game.user !== game.users?.activeGM) return;
  const combat = game.combat;
  if (!combat) return;
  for (const c of combat.combatants) {
    _recomputeBonusAuto(c.id);
    _refreshPipRow(c.id);
    _writePipFlag(c.id);
  }
}

// Auto-detect: recompute on ANY buff create/update/delete on a combatant's actor, on the
// active GM only (single writer). Not keyed on the changed item's current name, so renaming
// a Haste buff away still triggers a recompute (the actor-wide scan decides the result).
function _onBuffChangeForHasteBonus(item) {
  if (!game.user?.isGM) return;
  if (game.user !== game.users?.activeGM) return;
  if (item?.type !== 'buff') return;
  let settingOn = false;
  try { settingOn = game.settings.get(AT_MODULE_ID, 'autoHasteBonusAction'); } catch (e) { return; }
  if (!settingOn) return;
  const actor = item.actor ?? item.parent;
  if (!actor) return;
  const combatant = _getCombatantForActor(actor);
  if (!combatant) return;
  _reconcileBonusAutoFor(combatant.id);
}
Hooks.on('createItem', (item) => _onBuffChangeForHasteBonus(item));
Hooks.on('updateItem', (item) => _onBuffChangeForHasteBonus(item));
Hooks.on('deleteItem', (item) => _onBuffChangeForHasteBonus(item));

// Single spend implementation. Bonus eligibility is enforced HERE (never exposed via the
// public spendAction API): allowBonus is set ONLY by _spendActionForCombatant on a validated
// single ordinary Strike. All-or-nothing; spends the 3 normal pips first, then the bonus.
function _spendActionCore(combatantId, count = 1, allowBonus = false) {
  const state = _getState(combatantId);
  if (!state) return false;
  const actor = game.combat?.combatants?.get(combatantId)?.actor;
  const incap = !!_readConditionActionLoss(actor).fullyIncapacitated;
  const normalAvail = state.actions.filter((a, i) => a && i >= state.conditionLocked).length;
  const bonusUsable = allowBonus && !incap && Array.isArray(state.bonusPip) && state.bonusPip[0] === true;
  const bonusAvail  = bonusUsable ? 1 : 0;
  if (normalAvail + bonusAvail < count) return false; // all-or-nothing across both pools
  // v2.37.0 (GOAL_v2.37.0_PIP_AUTHORITY / FD-06): "is a GM connected at all"
  // is locally knowable synchronously — refuse cleanly before mutating.
  if (!game.user.isGM && !game.users.activeGM) {
    _baphActionWarnPipRelayFailure('no-active-gm');
    return false;
  }
  const priorActions  = [...state.actions];
  const priorBonusPip = Array.isArray(state.bonusPip) ? [...state.bonusPip] : [];
  let remaining = count;
  for (let i = 0; i < 3 && remaining > 0; i++) {
    if (state.actions[i] && i >= state.conditionLocked) { state.actions[i] = false; remaining--; }
  }
  if (remaining > 0 && bonusUsable) { state.bonusPip[0] = false; remaining--; }
  _refreshPipRow(combatantId);
  if (game.user.isGM) {
    _writePipFlag(combatantId);
    return true;
  }
  // Player path (covers both the public spendAction and the
  // _spendActionForCombatant automation path — see the Haste-bonus known
  // limitation noted in the v1.29 changelog block above): relay through the
  // active GM instead of the doomed direct write. Trap 2: still returns
  // true synchronously; the relay/revert happens after this returns.
  const seq = ++state.pipSeq;
  // v2.37.0 round-02 (FIX-2): also capture (round, activeId) — see the
  // shared rationale comment on the _togglePip revert closure below.
  const capturedRound = game.combat?.round ?? 0;
  const capturedActiveId = _currentActiveCombatantId(game.combat);
  // v2.37.0 round-02 (OVERSEER FIX BRIEF Defect B): carry this call's own
  // `allowBonus` on the wire so the GM's replay can re-run the SAME
  // availability check the client just ran (Trap 1, GOAL:151-152) instead
  // of a stricter one that refuses a Haste-bonus Strike the client
  // legitimately permitted. This confers no new capability: the GM still
  // requires its own authoritative `state.bonusPip[0] === true` in
  // `bonusUsable` above (unweakened) — `allowBonus` only selects which
  // already-granted pool the GM is allowed to draw the spend from.
  _baphActionEmitPipRelay(combatantId, 'action', { count, allowBonus }, () => {
    if (state.pipSeq !== seq) return; // superseded by a newer local write — Trap 3
    if ((game.combat?.round ?? 0) !== capturedRound || _currentActiveCombatantId(game.combat) !== capturedActiveId) return; // this combatant's turn has since ended — Trap 3/FIX-2
    state.actions  = priorActions;
    state.bonusPip = priorBonusPip;
    _refreshPipRow(combatantId);
  });
  return true;
}

function _spendActionForCombatant(combatantId, count = 1, reason = '') {
  const state = _getState(combatantId);
  if (!state) {
    _debugLog(`_spendActionForCombatant: no state for ${combatantId} [${reason}]`);
    return false;
  }

  // Haste bonus is spendable ONLY for a single ordinary Strike (reason `attack-*`, count 1).
  // Spells/skills/manual-panel and cost>1 Vital Strike/Charge use normal pips only. Move /
  // manually-resolved Strike use the bonus via a direct click on the pip. (Codex r3 #1.)
  const allowBonus = (count === 1) && typeof reason === 'string' && reason.startsWith('attack-');

  // All-or-nothing is enforced inside _spendActionCore (preflight across both pools).
  const ok = _spendActionCore(combatantId, count, allowBonus);
  if (ok) {
    _debugLog(`_spendActionForCombatant: spent ${count} action(s) for ${combatantId} [${reason}${allowBonus ? ', bonus-eligible' : ''}]`);
  } else {
    _debugLog(`_spendActionForCombatant: insufficient actions (${count} needed) for ${combatantId} [${reason}]`);
  }
  return ok;
}

/* ----------------------------------------------------------
   SKILL ACTION COSTS
   
   Confirmed PF1 key strings from v2.10.x diagnostic testing.
   Signature: pf1ActorRollSkill(actor, chatMessage, skillKey)
   
   Key  →  Skill Name               →  Action cost
   acr  →  Acrobatics               →  1
   blf  →  Bluff                    →  1
   int  →  Intimidate               →  1
   ste  →  Stealth                  →  1
   hea  →  Heal                     →  1
   umd  →  Use Magic Device         →  1
   slt  →  Sleight of Hand          →  1
   kar  →  Knowledge (Arcana)       →  1
   kdu  →  Knowledge (Dungeoneering) →  1
   ken  →  Knowledge (Engineering)  →  1
   kge  →  Knowledge (Geography)    →  1
   khi  →  Knowledge (History)      →  1
   klo  →  Knowledge (Local)        →  1
   kna  →  Knowledge (Nature)       →  1
   kno  →  Knowledge (Nobility)     →  1
   kpl  →  Knowledge (Planes)       →  1
   kre  →  Knowledge (Religion)     →  1

   FIX-2 (GOAL_v2.37.7, D-2) — twelve more, all cost 1. Nine flat, three
   sub-skilled entered as the BASE key (Perform/Lore/Artistry are
   sub-skilled skills; a roll arrives "base.sub" and is normalised to its
   base by the pf1ActorRollSkill handler below, BEFORE Gate 5, per the
   supplied payload-shape fact —
   docs/ai-council/GOAL_v2.37.7_COSTS_AND_ESCAPES/SUPPLIED_FACT_20260912_pf1ActorRollSkill_subskill_keys.md):
   clm  →  Climb                    →  1
   swm  →  Swim                     →  1
   fly  →  Fly                      →  1
   esc  →  Escape Artist            →  1
   rid  →  Ride                     →  1
   han  →  Handle Animal            →  1
   sen  →  Sense Motive             →  1
   spl  →  Spellcraft               →  1
   sur  →  Survival                 →  1
   prf  →  Perform (base key)       →  1
   lor  →  Lore (base key)          →  1
   art  →  Artistry (base key)      →  1

   Excluded from auto-spend:
   per  →  Perception — passive/reactive sense; excluded
           intentionally from action economy tracking.
   dev  →  Disable Device — uses PF1.5 multi-round task pattern.
           Not auto-spendable. Live handler warns user when dev
           is rolled in combat. Re-add once task subsystem is built.

   "Cannot be used in combat" (GOAL_v2.37.7, D-2) — not allowlisted, not
   costed, warned instead (see _COMBAT_FORBIDDEN_SKILLS below):
   dip  →  Diplomacy
   dis  →  Disguise
   lin  →  Linguistics
   pro  →  Profession

   Any skills added in future must be verified against the
   pf1ActorRollSkill payload before adding here.
   ---------------------------------------------------------- */

const SKILL_ACTION_COSTS = {
  acr: 1,
  blf: 1,
  int: 1,
  ste: 1,
  hea: 1,
  umd: 1,
  slt: 1,
  // Knowledge sub-skills — all cost 1 action
  kar: 1,  // Knowledge Arcana
  kdu: 1,  // Knowledge Dungeoneering
  ken: 1,  // Knowledge Engineering
  kge: 1,  // Knowledge Geography
  khi: 1,  // Knowledge History
  klo: 1,  // Knowledge Local
  kna: 1,  // Knowledge Nature
  kno: 1,  // Knowledge Nobility
  kpl: 1,  // Knowledge Planes
  kre: 1,  // Knowledge Religion
  // FIX-2 (GOAL_v2.37.7, D-2) — nine flat keys, all cost 1.
  clm: 1,  // Climb
  swm: 1,  // Swim
  fly: 1,  // Fly
  esc: 1,  // Escape Artist
  rid: 1,  // Ride
  han: 1,  // Handle Animal
  sen: 1,  // Sense Motive
  spl: 1,  // Spellcraft
  sur: 1,  // Survival
  // FIX-2 (GOAL_v2.37.7, D-2) — three sub-skilled keys, entered as the BASE
  // key. The pf1ActorRollSkill handler normalises "base.sub" rolls (e.g.
  // "prf.prf1") to "base" before Gate 5, so these are reached by every
  // real sub-skilled roll and are never looked up dotted.
  prf: 1,  // Perform (base key)
  lor: 1,  // Lore (base key)
  art: 1   // Artistry (base key)
};

// FIX-2 (GOAL_v2.37.7, D-2): Diplomacy, Disguise, Linguistics and Profession
// are canonically "cannot be used in combat" (PF1.5_Combat_Skill_Action_Costs.md,
// line 16 and the per-skill table rows). Not allowlisted, not costed. The
// live handler below warns once per actor+skill (client-local, in-memory —
// the RULE-2 dedupe pattern), charges nothing, and never blocks the roll.
const _COMBAT_FORBIDDEN_SKILLS = {
  dip: 'Diplomacy',
  dis: 'Disguise',
  lin: 'Linguistics',
  pro: 'Profession'
};

// Dedupe store for the "cannot be used in combat" warning. Client-local,
// in-memory ONLY, mirroring _unknownCastingTypeWarned's pattern.
const _combatForbiddenSkillWarned = new Set();

/* ============================================================
   ACTION AUTOMATION DIAGNOSTICS — v1.11
   ══════════════════════════════════════════════════════════

   pf1AttackRoll: diagnostic-only. Not yet wired to spend
   pips — dedupe behavior not yet designed.

   pf1ActorRollSkill: removed from this block in v1.11.
   The live skill automation hook below carries its own
   debug logging at every decision gate. Having both would
   produce duplicate/noisy output on every skill roll.

   NOTHING HERE SPENDS PIPS.

   .data paths are intentionally not probed — PF1 ItemAction.data
   is deprecated and emits compatibility warnings on access.

   To use: enable Action Tracker Debug Logging in
   Configure Settings → Baphomet Utils, then open F12.
   All output is prefixed:
     baphomet-utils | [DEBUG] [DIAG] ...
   ============================================================ */

// Guard: prevent duplicate hook registration if ready fires
// more than once or _registerActionAutomationDiagnostics is
// called manually from a macro during testing.
let _baphActionDiagnosticsRegistered = false;

/**
 * Produce a shallow summary of a possible actor reference.
 * Defensive: never throws, never deep-traverses.
 *
 * @param {*} actor
 * @returns {object|null}
 */
function _summarizePossibleActor(actor) {
  if (!actor) return null;
  return {
    constructorName: actor?.constructor?.name ?? null,
    id:      actor?.id ?? actor?._id ?? null,
    uuid:    actor?.uuid ?? null,
    name:    actor?.name ?? null,
    type:    actor?.type ?? null,
    isOwner: actor?.isOwner ?? null
  };
}

/**
 * Produce a shallow summary of a single hook argument.
 * Checks common actor paths and skill key paths without
 * deep-traversing any Foundry or PF1 document object.
 *
 * @param {*}      arg
 * @param {number} index  Position in the hook args array
 * @returns {object}
 */
function _summarizeHookArg(arg, index) {
  const summary = {
    index,
    type:    typeof arg,
    isNull:  arg === null,
    isArray: Array.isArray(arg)
  };

  if (arg === null || arg === undefined) return summary;

  try {
    summary.constructorName = arg?.constructor?.name ?? null;
  } catch {
    summary.constructorName = '[unavailable]';
  }

  try {
    summary.keys = typeof arg === 'object'
      ? Object.keys(arg).slice(0, 30)
      : [];
  } catch {
    summary.keys = ['[keys unavailable]'];
  }

  try {
    summary.id        = arg?.id ?? arg?._id ?? null;
    summary.uuid      = arg?.uuid ?? null;
    summary.name      = arg?.name ?? null;
    summary.typeValue = arg?.type ?? null;
  } catch {
    // Diagnostic-only. Ignore safely.
  }

  try {
    summary.actorDirect         = _summarizePossibleActor(arg?.actor);
    summary.actorFromItem       = _summarizePossibleActor(arg?.item?.actor);
    summary.actorFromAction     = _summarizePossibleActor(arg?.action?.actor);
    summary.actorFromSubject    = _summarizePossibleActor(arg?.subject?.actor);
    summary.actorFromParentActor = _summarizePossibleActor(arg?.parent?.actor);
    summary.parentAsActor       = _summarizePossibleActor(arg?.parent);
  } catch {
    // Diagnostic-only. Ignore safely.
  }

  try {
    summary.possibleSkillKeys = {
      skill:          arg?.skill          ?? null,
      skillId:        arg?.skillId        ?? null,
      skillKey:       arg?.skillKey       ?? null,
      key:            arg?.key            ?? null,
      id:             arg?.id             ?? null,
      name:           arg?.name           ?? null,
      actionSkill:    arg?.action?.skill    ?? null,
      actionSkillId:  arg?.action?.skillId  ?? null,
      actionSkillKey: arg?.action?.skillKey ?? null,
      subjectSkill:    arg?.subject?.skill    ?? null,
      subjectSkillId:  arg?.subject?.skillId  ?? null,
      subjectSkillKey: arg?.subject?.skillKey ?? null
    };
  } catch {
    // Diagnostic-only. Ignore safely.
  }

  return summary;
}

/**
 * Map _summarizeHookArg over a full hook argument array.
 *
 * @param {Array} args
 * @returns {Array}
 */
function _summarizeHookArgs(args) {
  return args.map((arg, index) => _summarizeHookArg(arg, index));
}

/**
 * Build a focused diagnostic summary of a single pf1AttackRoll fire.
 *
 * Confirmed hook signature (from v2.10.x diagnostic testing):
 *   pf1AttackRoll(action, roll, extraData)
 *     action    — ItemAction (the specific action of an item being used)
 *     roll      — D20RollPF (the evaluated d20 roll)
 *     extraData — Object (options / message data / chat hints)
 *
 * Captures the fields needed to characterize this hook before
 * wiring attack auto-spend in a future release. Specifically:
 *
 *   - timestamp        : Date.now() so firing rate can be analyzed
 *                        across iteratives, full attacks, and AoOs
 *   - actorPath        : which property chain the actor was resolved
 *                        from — useful for future automation gates
 *   - actor            : shallow actor summary
 *   - item             : parent item id / uuid / name / type
 *   - action           : ItemAction id / name / constructorName
 *   - roll             : D20RollPF shape (formula, total, _evaluated)
 *   - messageId        : first available chat-message reference
 *   - extraDataKeys    : top-level keys of args[2] (capped at 30)
 *   - activeCombatantMatch / activeCombatant : whether the resolved
 *                        actor is the current active combatant
 *                        (reveals AoO / off-turn / GM-NPC cases)
 *   - dedupeCandidate  : composite key candidate for future dedupe
 *                        design. OBSERVATION ONLY — not used by any
 *                        live spend logic in this version.
 *
 * Defensive: every property access is guarded; never throws.
 * NEVER reads arg?.data — PF1 ItemAction.data is deprecated and
 * emits compatibility warnings on access (cleaned up in v2.10.1).
 *
 * @param {*} action     args[0] — expected ItemAction
 * @param {*} roll       args[1] — expected D20RollPF
 * @param {*} extraData  args[2] — expected options / extraData object
 * @returns {object}
 */
function _summarizeAttackRoll(action, roll, extraData) {
  const timestamp = Date.now();
  const item = action?.item ?? null;

  // Resolve actor — prefer item.actor (canonical PF1 path), with
  // fallbacks for less common shapes. NEVER probes arg?.data.
  let actor     = null;
  let actorPath = null;
  if (item?.actor)                { actor = item.actor;            actorPath = 'action.item.actor'; }
  else if (action?.actor)         { actor = action.actor;          actorPath = 'action.actor'; }
  else if (action?.parent?.actor) { actor = action.parent.actor;   actorPath = 'action.parent.actor'; }
  else if (extraData?.actor)      { actor = extraData.actor;       actorPath = 'extraData.actor'; }

  // Active-combatant comparison. Reveals AoO / off-turn / mid-attack
  // turn-advance cases that any future automation will need to gate on.
  let activeMatchCombatant = null;
  try {
    activeMatchCombatant = _getActiveCombatantForActor(actor);
  } catch {
    // Diagnostic-only. Ignore safely.
  }

  // Roll / chat-message identifier. D20RollPF doesn't carry a stable
  // own-id, but a chat message reference is often reachable via the
  // roll itself or via extraData. Try several shapes; tolerate misses.
  let messageId        = null;
  let messageRefSource = null;
  if (roll?.message?.id)               { messageId = roll.message.id;            messageRefSource = 'roll.message.id'; }
  else if (extraData?.chatMessage?.id) { messageId = extraData.chatMessage.id;   messageRefSource = 'extraData.chatMessage.id'; }
  else if (extraData?.message?.id)     { messageId = extraData.message.id;       messageRefSource = 'extraData.message.id'; }
  else if (extraData?.messageId)       { messageId = extraData.messageId;        messageRefSource = 'extraData.messageId'; }

  // Composite candidate dedupe key. Stable across iteratives if
  // messageId is shared; distinct across separate attack actions.
  // If no messageId is reachable, falls back to timestamp — in which
  // case dedupe across rapid fires would be unreliable.
  const dedupeCandidate = [
    actor?.id  ?? '?',
    item?.id   ?? '?',
    action?.id ?? '?',
    messageId ?? `t${timestamp}`
  ].join(':');

  let extraDataKeys = [];
  try {
    if (extraData && typeof extraData === 'object') {
      extraDataKeys = Object.keys(extraData).slice(0, 30);
    }
  } catch {
    extraDataKeys = ['[keys unavailable]'];
  }

  return {
    timestamp,

    actorPath,
    actor: _summarizePossibleActor(actor),

    item: item ? {
      id:   item?.id   ?? item?._id ?? null,
      uuid: item?.uuid ?? null,
      name: item?.name ?? null,
      type: item?.type ?? null
    } : null,

    action: {
      id:              action?.id ?? action?._id ?? null,
      name:            action?.name ?? null,
      constructorName: action?.constructor?.name ?? null
    },

    roll: {
      constructorName: roll?.constructor?.name ?? null,
      formula:         roll?.formula ?? null,
      total:           roll?.total ?? null,
      _evaluated:      roll?._evaluated ?? null
    },

    messageId,
    messageRefSource,

    extraDataKeys,

    activeCombatantMatch: !!activeMatchCombatant,
    activeCombatant: activeMatchCombatant ? {
      id:   activeMatchCombatant.id,
      name: activeMatchCombatant.name
    } : null,

    dedupeCandidate
  };
}

/**
 * Register debug-gated diagnostic listeners for pf1AttackRoll
 * and pf1ActorRollSkill. Idempotent via _baphActionDiagnosticsRegistered.
 *
 * Called once from the diagnostics ready hook below.
 */
function _registerActionAutomationDiagnostics() {
  if (_baphActionDiagnosticsRegistered) return;
  _baphActionDiagnosticsRegistered = true;

  // pf1AttackRoll: diagnostic-only. Logs raw args, generic shallow
  // summary, AND a focused attack-roll summary (v1.16). Does not
  // spend pips. Dedupe behavior not yet designed — the dedupeCandidate
  // field in the focused summary is observation-only.
  Hooks.on('pf1AttackRoll', (...args) => {
    _debugLog('[DIAG] pf1AttackRoll raw args:', ...args);
    _debugLog('[DIAG] pf1AttackRoll arg summary:', _summarizeHookArgs(args));
    const attackSummary = _summarizeAttackRoll(args[0], args[1], args[2]);
    _debugLog('[DIAG] pf1AttackRoll attack summary:', attackSummary);
    _debugLog('[DIAG] pf1AttackRoll attack summary JSON:', _diagStringify(attackSummary));
  });

  // pf1ActorRollSkill intentionally not registered here.
  // The live skill automation hook (below) handles this event
  // and carries its own debug logging.

  _debugLog('Action automation diagnostics registered (pf1AttackRoll only — pf1ActorRollSkill handled by live hook)');
}

// Separate ready hook for diagnostics registration.
// Kept distinct from the macro API ready hook above for clarity —
// two concerns, two hooks.
Hooks.once('ready', () => {
  _registerActionAutomationDiagnostics();
});

/* ============================================================
   LIVE SKILL AUTO-SPEND — v1.11
   ══════════════════════════════════════════════════════════

   Confirmed hook signature:
     pf1ActorRollSkill(actor, chatMessage, skillKey)

   Gated behind 'autoSkillSpend' world setting (default OFF).
   Only fires for the current active combatant on the user's
   controlled token. Non-active actors are silently ignored.

   Disable Device (dev) is intercepted BEFORE the allowlist gate
   and receives a specific PF1.5 multi-round task warning instead
   of a generic "not in allowlist" message. No pip is spent.

   Dedupe: keyed on actor.id + skillKey + chatMessage.id.
   500ms window. Client-local in-memory Set — does NOT protect
   across multiple connected clients. This is acceptable because
   pipState is also client-local and not synchronized across
   clients. Each client maintains its own pip view independently.
   ============================================================ */

// In-memory dedupe set. Not persisted. Cleared by 500ms timeouts.
const _skillSpendDedupeSet = new Set();

/**
 * Check whether a skill spend event is a duplicate.
 * Adds the key to the set and schedules its removal.
 * Returns true if this is a duplicate (do not spend).
 *
 * @param {Actor}       actor
 * @param {string}      skillKey
 * @param {ChatMessage} chatMessage
 * @returns {boolean}
 */
function _isSkillSpendDuped(actor, skillKey, chatMessage) {
  // Prefer chatMessage.id as the most stable unique identifier.
  // Fall back to uuid, then to a bare actor+skill key (accepts the
  // theoretical risk of two legitimate rolls in 500ms being deduped
  // — that's an edge case well within acceptable bounds).
  const msgId = chatMessage?.id ?? chatMessage?.uuid ?? null;
  if (!msgId) {
    _debugLog(`skill auto-spend dedupe: chatMessage.id and uuid both absent for ${actor?.id}:${skillKey} — using fallback key, increased double-spend risk on this client`);
  }
  const key = msgId
    ? `${actor.id}:${skillKey}:${msgId}`
    : `${actor.id}:${skillKey}`;

  if (_skillSpendDedupeSet.has(key)) return true;

  _skillSpendDedupeSet.add(key);
  setTimeout(() => _skillSpendDedupeSet.delete(key), 500);
  return false;
}

/**
 * Live pf1ActorRollSkill handler.
 * Spends action pips for the active combatant when all gates pass.
 * Every decision path emits a _debugLog line.
 */
Hooks.on('pf1ActorRollSkill', (actor, chatMessage, skillKey) => {
  // Gate 1: setting enabled
  if (!game.settings.get(AT_MODULE_ID, 'autoSkillSpend')) {
    _debugLog(`skill auto-spend: setting disabled — no spend for ${skillKey}`);
    return;
  }

  // Gate 2: active combat
  if (!game.combat?.active) {
    _debugLog(`skill auto-spend: no active combat — no spend for ${skillKey}`);
    return;
  }

  // Gate 3: actor present
  if (!actor) {
    _debugLog('skill auto-spend: actor missing from hook args');
    return;
  }

  // Gate 4: skillKey present
  if (!skillKey) {
    _debugLog('skill auto-spend: skillKey missing from hook args');
    return;
  }

  // Early gate: Disable Device uses PF1.5 multi-round task pattern.
  // It is NOT auto-spendable here. Warn when this is a standalone
  // player-initiated roll outside the task resolution framework.
  // Suppressed when task-tracker.js is actively running resolveTask()
  // OR aidTask() (_baphResolveTaskRollActive / _baphAidTaskRollActive).
  if (skillKey === 'dev') {
    const taskRollActive =
      (typeof _baphResolveTaskRollActive !== 'undefined' && _baphResolveTaskRollActive) ||
      (typeof _baphAidTaskRollActive !== 'undefined' && _baphAidTaskRollActive);
    if (!taskRollActive) {
      _debugLog('skill auto-spend: Disable Device (dev) — PF1.5 multi-round task, no auto-spend');
      ui.notifications?.warn?.('Disable Device: PF1.5 multi-round task — use Continue Task / Resolve Task in the task widget.');
    }
    return;
  }

  // Early gate: suppress auto-spend during any task-system-initiated skill roll.
  // Prevents double-action-spend when resolveTask() or aidTask() fires a skill
  // roll internally. Non-dev task skills (future resolvers) are also protected.
  if ((typeof _baphResolveTaskRollActive !== 'undefined' && _baphResolveTaskRollActive) ||
      (typeof _baphAidTaskRollActive !== 'undefined' && _baphAidTaskRollActive)) {
    _debugLog(`skill auto-spend: task system roll in progress — suppressing auto-spend for ${skillKey}`);
    return;
  }

  // FIX-2 edit 4 (GOAL_v2.37.7, D-2): normalise skillKey to its base skill
  // BEFORE Gate 5. Sub-skilled rolls (Perform/Lore/Artistry) arrive as
  // "base.sub" (e.g. "prf.prf1"); SKILL_ACTION_COSTS and skillAutoAllowlist
  // store only the base key. Flat keys carry no dot, so split('.')[0]
  // returns them unchanged — the existing seventeen and the nine new flat
  // keys are unaffected. Confirmed payload shape (live capture 2026-09-12):
  // docs/ai-council/GOAL_v2.37.7_COSTS_AND_ESCAPES/SUPPLIED_FACT_20260912_pf1ActorRollSkill_subskill_keys.md
  const baseSkillKey = skillKey.split('.')[0];

  // FIX-2 (GOAL_v2.37.7, D-2): "cannot be used in combat" skills — not
  // allowlisted, not costed. Warn once per actor+skill (client-local,
  // in-memory dedupe), charge nothing, never block the roll.
  if (Object.prototype.hasOwnProperty.call(_COMBAT_FORBIDDEN_SKILLS, baseSkillKey)) {
    const forbidWarnKey = `${actor.id}:${baseSkillKey}`;
    if (!_combatForbiddenSkillWarned.has(forbidWarnKey)) {
      _combatForbiddenSkillWarned.add(forbidWarnKey);
      console.warn(
        `baphomet-utils | skill auto-spend: actor "${actor.name}" rolled `
        + `${_COMBAT_FORBIDDEN_SKILLS[baseSkillKey]} — this skill cannot be `
        + `used in combat (PF1.5 table rule). Not charged; roll is not blocked.`
      );
    }
    _debugLog(`skill auto-spend: "${baseSkillKey}" cannot be used in combat — no spend, warned`);
    return;
  }

  // Gate 5: skill in allowlist
  const allowlistRaw = game.settings.get(AT_MODULE_ID, 'skillAutoAllowlist') ?? '';
  const allowlist = allowlistRaw.split(',').map(s => s.trim()).filter(Boolean);
  if (!allowlist.includes(baseSkillKey)) {
    _debugLog(`skill auto-spend: "${baseSkillKey}" not in allowlist — no spend`);
    return;
  }

  // Gate 6: skill has a known cost
  const cost = SKILL_ACTION_COSTS[baseSkillKey];
  if (cost === undefined) {
    _debugLog(`skill auto-spend: "${baseSkillKey}" has no cost mapping — no spend`);
    return;
  }

  // Gate 7: actor is the current active combatant
  const combatant = _getActiveCombatantForActor(actor);
  if (!combatant) {
    _debugLog(`skill auto-spend: "${actor.name}" is not the active combatant — no spend`);
    return;
  }

  // Gate 8: current user controls this combatant
  if (!_canUserControlCombatant(combatant)) {
    _debugLog(`skill auto-spend: user cannot control combatant for "${actor.name}" — no spend`);
    return;
  }

  // Gate 9: dedupe check
  if (_isSkillSpendDuped(actor, skillKey, chatMessage)) {
    _debugLog(`skill auto-spend: duplicate event for ${actor.name}:${skillKey} — skipping`);
    return;
  }

  // All gates passed. _spendActionForCombatant enforces all-or-nothing.
  _debugLog(`skill auto-spend: attempting spend — ${actor.name} / ${skillKey} / cost ${cost}`);
  const spent = _spendActionForCombatant(combatant.id, cost, `skill-${skillKey}`);

  if (!spent) {
    // _spendActionForCombatant already logged the reason (insufficient actions
    // or API not ready).
    _debugLog(`skill auto-spend: failed — spend blocked or insufficient actions for ${actor.name} [${skillKey}], needed ${cost}`);
    return;
  }

  _debugLog(`skill auto-spend: success — spent ${cost} action(s) for ${actor.name} [${skillKey}]`);
});

/* ============================================================
   LIVE ATTACK & SPELL AUTO-SPEND — v2.22.0 (Phase B)
   ══════════════════════════════════════════════════════════

   Hook: pf1PreActionUse(actionUse) — fires ONCE per action-use
   (one Strike, one cast), for both attacks and spells. Using this
   pre-hook (NOT pf1AttackRoll, which fires per iterative roll)
   means a single Strike/cast spends exactly once — no iterative
   dedupe gymnastics. Pilot 45 confirmed the cadence + field paths.

   MODULE DESIGN PATTERN — NOT NATIVE PF1.

   OBSERVE-ONLY: this handler NEVER returns false. Returning false
   from pf1PreActionUse CANCELS the action in PF1 — auto-spend must
   never block an action, only decrement pips.

   Gated behind 'autoAttackSpend' / 'autoSpellSpend' (default OFF).
   Cost:
     - attack/weapon item → 1 action (1 Strike = 1 action).
     - spell item → with pf1.unchainedActionEconomy ON, the numeric cost on
       pf1's substituted activation shape (the FIX-2 guard in
       _deriveActionUseCost); with it OFF, the CHAINED_CASTING_TIME_ACTION_COST
       map keyed on activation.type (GOAL_v2.37.6 FIX-1). NOT spell.level.
   Reaction: an off-turn action-use (acting actor is not the active
   combatant — confirmed via activeCombatantMatch=false in Pilot 45)
   is an AoO: spend 1 reaction on the acting actor's own combatant,
   no action, no swing.

   Deferred (see GOAL_v2.22.0 Out of Scope): swing-counter / MAP
   penalty injection, Cleave 0-cost gating, Vital Strike (2 actions),
   Magus Spellstrike, feat multi-attack adjudication.
   ============================================================ */

// In-memory dedupe (mirrors the skill dedupe). 500ms window.
const _actionUseSpendDedupeSet = new Set();

function _isActionUseSpendDuped(actor, actionUse) {
  const actId  = actionUse?.action?.id ?? actionUse?.action?.data?.id ?? '?';
  const itemId = actionUse?.item?.id ?? actionUse?.item?.name ?? '?';
  const key = `${actor?.id}:${itemId}:${actId}`;
  if (_actionUseSpendDedupeSet.has(key)) return true;
  _actionUseSpendDedupeSet.add(key);
  setTimeout(() => _actionUseSpendDedupeSet.delete(key), 500);
  return false;
}

/**
 * Find the combatant for an actor in the current combat, whether or
 * not it is the active combatant. Used for off-turn reaction spends.
 * (_getActiveCombatantForActor returns only the *active* match.)
 */
function _getCombatantForActor(actor) {
  if (!actor || !game.combat) return null;
  return game.combat.combatants.find((c) => c.actor?.id === actor.id) ?? null;
}

// FIX-1 (GOAL_v2.37.6, D-1/D-2/D-3): the nine chained casting-time -> action-cost
// entries canon establishes, as a single named map — not an inline chain — so a
// future reader can diff it against pf1's fourteen-value chained
// abilityActivationTypes menu in one glance. See
// docs/reference/foundry-v13/pf1-activation-types-and-unchained-substitution.md
// for the full fourteen-value menu this was checked against (pf1 11.11).
//   nonaction/passive: 0 — not actions, by pf1's own definition.
//   swift/move/standard/full/round: the chained per-type costs.
//   attack: 1 — CLAUDE.md, "Every attack is a single Strike that costs 1
//     action and produces 1 swing." Citation-only; no fixture exercises it.
//   immediate: 0 — a reaction-cost spell. _isReactionCostSpell has already
//     routed it to the Reaction before this map's value would be used
//     (FIX-1a); it is listed for completeness of the nine-type map only.
// free, aoo, minute, hour and special are deliberately NOT here — each is
// ambiguous for a documented reason (GOAL_v2.37.6 FIX-1) and takes the
// unknown-type path (FIX-2) below instead of a guessed value. 'reaction' is
// unchained vocabulary, never a chained activation.type, and is not one of
// the fourteen either.
const CHAINED_CASTING_TIME_ACTION_COST = Object.freeze({
  nonaction: 0,
  passive: 0,
  swift: 1,
  move: 1,
  standard: 2,
  full: 3,
  round: 3,
  attack: 1,
  immediate: 0,
});

// FIX-2 (GOAL_v2.37.6, RULE-2): dedupe store for the unenumerated-casting-time
// warning. Client-local, in-memory ONLY — never an actor flag, never a
// setting (constraint 2: a persisted store would add a mutated surface the
// cleanup contract must then cover, and would make an observe-only handler
// write world data). Keyed on `${actor.id}:${activation.type}` so the
// warning fires once per actor+type and survives within a client session
// (constraint 3) — see GOAL_v2.37.6 "### Re-entry rules".
const _unknownCastingTypeWarned = new Set();

/**
 * Derive the PF1.5 action cost of an action-use.
 * Attacks: 1. Spells: with unchainedActionEconomy ON, the numeric cost on
 * pf1's substituted activation shape read by the guard below; with it off,
 * the chained casting-type map below (CHAINED_CASTING_TIME_ACTION_COST), or
 * the FIX-2 unknown-type path for anything the map does not enumerate.
 * Never reads spell.level.
 */
function _deriveActionUseCost(actionUse) {
  const item = actionUse?.item;
  if (item?.type !== 'spell') {
    // PF1.5 cost-aware spending (GOAL_v2.28.0): Vital Strike and Charge each cost
    // 2 actions, not 1. pf1 11.11 exposes no marker to auto-detect them (live probe
    // 2026-06-26), so the player declares intent via a token-driven macro that sets an
    // actor-scoped intent object (globalThis.baphomet{VitalStrike,Charge} = { actorId }).
    // Read it only for THIS actor; the macro clears it by object identity.
    const actor = actionUse?.actor ?? item?.actor;
    const aid = actor?.id;
    if (aid && (globalThis.baphometVitalStrike?.actorId === aid
             || globalThis.baphometCharge?.actorId === aid)) {
      return 2;
    }
    return 1; // attacks/weapons default: 1 Strike = 1 action
  }

  const act = actionUse?.action;
  const actData = act?.data ?? act?.system ?? act ?? {};
  const activation = actData?.activation ?? act?.activation;

  // FIX-2 (GOAL_v2.37.4, D-3): with pf1.unchainedActionEconomy ON, pf1
  // substitutes the owned item's activation for the unchained object itself
  // at data-prep time (`this.activation = this.activation.unchained`), so the
  // substituted shape carries its own numeric `cost` directly and has no
  // nested `.unchained` key of its own. Read that substituted cost here.
  // (round 2 fix, GOAL_v2.37.4 A08 regression: the prior unconditional
  // `activation?.unchained?.cost` read above this comment fired even with the
  // setting OFF, because the chained/off-setting activation shape carries its
  // own nested `.unchained.cost` annotation alongside its chained `type`/
  // `cost` — e.g. a swift spell's chained activation already has an
  // `unchained: { cost: 2, ... }` sibling. That unconditional read returned
  // the unchained cost regardless of setting state, short-circuiting the
  // chained `swift` -> 1 fallback below and mis-charging a quickened spell 2
  // actions instead of 1 with the setting OFF. It is removed rather than
  // guarded: it can never fire validly here in either setting state — ON,
  // the substituted shape has no nested `.unchained` key so the read was
  // always `undefined`; OFF, the chained fallback below is the correct path
  // and this short-circuit only ever pre-empted it wrongly.)
  // A reaction-typed substituted activation is NOT a numeric action cost —
  // it is a reaction-cost spell (see _isReactionCostSpell / FIX-1) and is
  // excluded so it falls through to the `return 0` below instead.
  if (activation && !activation.unchained && activation.type !== 'reaction'
      && typeof activation.cost === 'number' && activation.cost >= 1) {
    return activation.cost;
  }

  // FIX-A (GOAL_v2.37.6 round 2, PRIOR_FAILURES 1/2A): an unchained
  // 'reaction' substituted activation is not a numeric action cost — it is
  // a reaction-cost spell (_isReactionCostSpell / FIX-1) whose cost is spent
  // entirely via _baphSpendReactionForSpell before this function's return
  // value is ever consumed. It must not fall into the chained-map lookup
  // below (the map does not enumerate it — canon holds exactly nine chained
  // types) nor the FIX-2 unknown-type path (which would warn falsely and
  // insert a dedupe key for a type that was never actually mischarged).
  // Mirrors the vocabulary exclusion the guard above already makes and
  // returns 0, the exact value HEAD returned for this type.
  if (activation?.type === 'reaction') {
    return 0;
  }

  // Fallback by chained casting-time type if the substituted-shape read above
  // did not fire (setting OFF). FIX-1 (GOAL_v2.37.6, D-1/D-2/D-3): a single
  // lookup against CHAINED_CASTING_TIME_ACTION_COST, replacing the four-branch
  // chain that used to sit here and silently mischarged every type it did not
  // enumerate (D-3), including `full` (D-1) and `move` (D-2).
  const t = activation?.type;
  if (Object.prototype.hasOwnProperty.call(CHAINED_CASTING_TIME_ACTION_COST, t)) {
    return CHAINED_CASTING_TIME_ACTION_COST[t];
  }

  // FIX-4/FIX-5 (GOAL_v2.37.7, D-4(a), D-4(b), RULE-4, RULE-5): an
  // activation.type the map above does not enumerate, OR an absent one
  // (null/undefined/"" — RULE-5: "" must normalise the same as null/undefined,
  // not fall through to the map lookup above and land on the "unenumerated"
  // label instead of the "absent" one). ONE message template, not two
  // branches — the label varies, the disposition does not. RULE-4: this
  // function COMPUTES a cost; whether it is actually charged is decided
  // ~300 lines downstream in the pf1PreActionUse routing, so the text names
  // the cost without asserting the charge. (Moving this warning to the spend
  // site was considered and deferred — that distance crosses into the
  // routing v2.37.6 just stabilized, and is a separate change with its own
  // runtime surface.) Charges the standard 2 either way, and never blocks —
  // the GM adjudicates, same disposition as an immediate spell cast with the
  // Reaction already spent.
  const warnActor = actionUse?.actor ?? item?.actor;
  const isAbsentType = t === null || t === undefined || t === '';
  const warnKey = `${warnActor?.id ?? '?'}:${isAbsentType ? 'absent' : t}`;
  if (!_unknownCastingTypeWarned.has(warnKey)) {
    _unknownCastingTypeWarned.add(warnKey);
    const label = isAbsentType ? 'no activation.type declared' : `unenumerated activation.type "${t}"`;
    console.warn(
      `baphomet-utils | _deriveActionUseCost: actor "${warnActor?.name ?? '?'}" cast `
      + `"${item?.name ?? '?'}" with ${label} — this computes a cost of 2 actions for `
      + `it (whether that cost is actually charged is decided by the pf1PreActionUse `
      + `routing downstream, not here). This casting time is not in the canon nine-type `
      + `map (GOAL_v2.37.6 FIX-1); adjudicate manually if 2 is wrong for this cast.`
    );
  }
  return 2; // standard default — unchanged; only the silence is fixed (D-3)
}

// FIX-1 (GOAL_v2.37.7, D-1): dedupe store for the unknown-consumable-subType /
// unmapped-wand-casting-type warning. Client-local, in-memory ONLY, mirroring
// the FIX-2 dedupe pattern above — a distinct mechanism from it because the
// condition being warned about is different (an unrecognised consumable
// subType, not an unenumerated spell casting time).
const _unknownConsumableWarned = new Set();

function _warnUnknownConsumable(actor, item, label) {
  const warnKey = `${actor?.id ?? '?'}:${item?.id ?? item?.name ?? '?'}`;
  if (_unknownConsumableWarned.has(warnKey)) return;
  _unknownConsumableWarned.add(warnKey);
  console.warn(
    `baphomet-utils | _deriveConsumableActionCost: actor "${actor?.name ?? '?'}" used `
    + `${label} — this computes a cost of 2 actions for it. This subType/casting time `
    + `is not in the canon FIX-1 table (GOAL_v2.37.7); adjudicate manually if 2 is `
    + `wrong for this use. Never blocks the use.`
  );
}

/**
 * FIX-1 (GOAL_v2.37.7, D-1): cost a consumable item-use by system.subType.
 * potion -> 2 (Draw 1 + Drink 1). scroll -> 3 (Draw 1 + Cast 2). wand -> the
 * wand action's OWN activation.type, looked up through
 * CHAINED_CASTING_TIME_ACTION_COST — the same route every chained spell cost
 * takes, NOT a hardcoded number (pf1 stamps a wand action's activation.type
 * "standard", so both fixtures answer 2 today, but a wand of a full-round
 * spell would answer 3 without a second table). The map itself is read only,
 * never modified (GOAL_v2.37.6 settled its nine entries). Any subType outside
 * the three above, or a wand action whose activation.type the map does not
 * enumerate, takes the unknown path: warn once per actor+item, charge the
 * standard 2, never block — the same disposition FIX-2 gives an
 * unenumerated casting time, for the same reason.
 */
function _deriveConsumableActionCost(actionUse) {
  const item = actionUse?.item;
  const subType = item?.system?.subType ?? null;
  const actor = actionUse?.actor ?? item?.actor;

  if (subType === 'potion') return 2; // Draw 1 + Drink 1
  if (subType === 'scroll') return 3; // Draw 1 + Cast 2

  if (subType === 'wand') {
    const act = actionUse?.action;
    const actData = act?.data ?? act?.system ?? act ?? {};
    const activation = actData?.activation ?? act?.activation;
    const t = activation?.type;
    if (Object.prototype.hasOwnProperty.call(CHAINED_CASTING_TIME_ACTION_COST, t)) {
      return CHAINED_CASTING_TIME_ACTION_COST[t];
    }
    _warnUnknownConsumable(actor, item, `a wand action with unenumerated activation.type "${t}"`);
    return 2;
  }

  _warnUnknownConsumable(actor, item, `a consumable with unrecognised subType "${subType}"`);
  return 2;
}

/**
 * FIX-1 (GOAL_v2.37.4, D-1/D-2): is this action-use a reaction-cost spell —
 * spends the base Reaction, never an action and never a Combat Reflexes
 * (jade) pip (Homebrew_Master_File.md, "Combat Reflexes & Extra Reactions" —
 * counterspells named explicitly)? True for the chained casting-time
 * 'immediate', or (FIX-2, D-3) the pf1.unchainedActionEconomy-substituted
 * activation shape reporting the unchained 'reaction' type. The two
 * vocabularies never overlap (chained never reports 'reaction'; the
 * substituted/unchained shape never reports 'immediate'), so a single type
 * check safely covers both setting states.
 */
function _isReactionCostSpell(actionUse) {
  if (actionUse?.item?.type !== 'spell') return false;
  const act = actionUse?.action;
  const actData = act?.data ?? act?.system ?? act ?? {};
  const t = (actData?.activation ?? act?.activation)?.type;
  return t === 'immediate' || t === 'reaction';
}

// PF1.5 TWF attack penalty (R6). Advisory-only: ADDS the two-weapon to-hit penalty to the
// native secondary-attack field; NEVER returns false. Dormant unless the TWF Strike macro has
// set globalThis.baphometTWF.active. The macro computes the per-hand penalty (tier + light);
// this hook just applies the right one. Surface + format verified by live probe P-2 (2026-06-07):
// rollConfig.secondaryPenalty is a plain signed-number string; brackets -> NaN -> breaks the roll.
Hooks.on('pf1PreAttackRoll', (attackData, rollConfig) => {
  const twf = globalThis.baphometTWF;
  if (!twf?.active) return;                                  // only during a TWF Strike
  const pen = twf.offhand ? twf.offPenalty : twf.mainPenalty;
  if (!pen || pen === "0") return;
  const base = Number(rollConfig.secondaryPenalty) || 0;     // add, don't clobber (baseline "0")
  rollConfig.secondaryPenalty = String(base + Number(pen));
});

// PF1.5 Charge +2 to-hit (GOAL_v2.31.0). Dormant unless the Charge declare macro has set
// globalThis.baphometCharge = { actorId } (macros/charge.js). Gated to the
// declaring actor only (mirrors the VS/MAP actor-scope pattern in _deriveActionUseCost).
// Injection field RUNTIME-CONFIRMED live 2026-07-07 (tab focused, module 2.31.0 loaded):
// pf1PreAttackRoll's rollConfig exposes only { proficient, secondaryPenalty } — there is NO
// `parts` array on any arg, so rollConfig.parts.push() is a dead write (verified: produced no
// +2). The correct surface is rollConfig.secondaryPenalty — the same signed-number-string field
// MAP/TWF use (P-2/GATE-1). A POSITIVE value ADDS to the attack roll (probe: +2 → "1d20 + … +
// 2[Secondary Attack]", total +2; +1000 → total +1000). Add (don't clobber) so Charge stacks
// with MAP/TWF, which also write this field. Renders as "[Secondary Attack]" in the attack card
// (pf1's label for this field) — cosmetic only; the +2 is mechanically applied to the swing.
Hooks.on('pf1PreAttackRoll', (attackData, rollConfig) => {
  const charge = globalThis.baphometCharge;
  if (!charge?.actorId) return;
  const actor = attackData?.actor ?? attackData?.item?.actor ?? attackData?.parent?.actor;
  if (!actor || actor.id !== charge.actorId) return;
  const base = Number(rollConfig.secondaryPenalty) || 0; // add, don't clobber (MAP/TWF share this field)
  rollConfig.secondaryPenalty = String(base + 2);        // Charge +2 to-hit (renders as "Secondary Attack")
});

/* ============================================================
   VITAL STRIKE — DAMAGE DICE DOUBLING — v2.33.0 structural hardening
   (GOAL_v2.33.0_VS_STRUCTURAL_HARDENING.md; prior fix: GOAL_v2.32.0_VS_DOUBLER_FIX.md)
   ══════════════════════════════════════════════════════════
   Runtime-confirmed (docs/ai-council/RUNTIME_PROBE_RESULTS_v2.31.0.md, Seam 3/4):
   pf1PreDamageRoll fires (action: ItemAction, rollData: Object, parts: Array,
   extraParts: Array). arg2 ("parts") is the TRANSIENT per-roll damage-parts array —
   pushing to it changes the resolved damage but is never persisted (no item.update()).
   arg0 ("action") is the LIVE persisted ItemAction; read-only here.

   CORRECTED PREDICATE (docs/ai-council/VS_DOUBLER_FIX_IDENTIFICATION_PROBE_RESULTS.md):
   the v2.31.0 predicate matched any transient part whose `base` was a member of the SET
   of ALL action.damage.parts[].formula strings. Live probe evidence proved this over-
   doubles: elemental riders and flat per-action modifiers stored as additional
   damage.parts entries were also doubled (wrong). The load-bearing identification probe
   (config 4: two damage.parts entries sharing an IDENTICAL formula string) further
   proved NO reliable signal — not provenance, not object identity, not insertion index —
   distinguishes the primary base weapon die from any other damage.parts entry at
   pf1PreDamageRoll time, and PF1 does NOT guarantee the base die is stored first
   (authored-order test: an elemental rider authored at index 0 stayed at index 0).
   Per the ratified VS_AMBIGUOUS_PRIMARY_POLICY = FAIL_OPEN_NO_MULTIPLICATION, the fix
   only auto-doubles when the weapon action has EXACTLY ONE damage.parts entry (the
   unambiguous case — the only configuration v2.31.0 live verification actually
   exercised). Any action with zero or more-than-one damage.parts entries is left
   untouched — no guess, no silent multiplication — and a debug-gated diagnostic is
   emitted so the player knows to apply Vital Strike's doubling manually.

   v2.33.0 STRUCTURAL HARDENING adds two seams on top of the above (defense-in-depth;
   no behavior change expected for the currently verified PF1 11.11 weapon shapes):

   - VS_TRANSIENT_MULTIPLICITY_POLICY = EXACTLY_ONE_OR_FAIL_OPEN: the persisted-parts gate
     above only guarantees the PERSISTED action.damage.parts array is unambiguous. The
     actual duplication reads the separate TRANSIENT `parts` array. A future weapon/feat/
     ammo/condition path could in principle inject more than one transient candidate
     sharing the persisted base formula. The transient candidate count (`toDuplicate`) is
     now itself gated to EXACTLY ONE before doubling proceeds — symmetric with the
     persisted-parts gate above. Zero or more-than-one transient matches fails open, doubles
     nothing, and emits the manual-adjudication diagnostic. No provenance heuristic is
     added; the module does not guess which of multiple candidates is the true base die.

   - VS_DUPLICATE_EXTRA_POLICY = EMPTY_ARRAY: the pushed Vital Strike duplicate no longer
     copies the transient part's `extra` array. v2.32.0 Probe B confirmed `extra: []` for
     every tested PF1 11.11 shape, but that evidence is bounded — it does not prove no
     future weapon/feat/condition combination could carry modifier or metadata content in
     transient `p.extra`. Setting `extra: []` structurally closes that copy seam rather than
     relying on the bounded empirical guarantee. `base`, `damageType` (Set-cloned), and
     `type` are still carried from the single matched transient candidate.

   VS_FAIL_OPEN_DIAGNOSTIC_POLICY = EVERY_AUTOMATION_DECLINE_PATH_LOGS_REASON: every path
   below that declines automatic doubling (persisted ambiguous, transient parts empty/
   unavailable, transient candidate count !== 1) emits a debug-gated diagnostic naming the
   reason and the manual-adjudication outcome. No player-facing UI/notification is added.

   Gated on globalThis.baphometVitalStrike = { actorId } (vital-strike.js), scoped to the
   declaring actor only. VS multiplier is 2 (Greater VS would be 3 — out of scope).
   ============================================================ */
Hooks.on('pf1PreDamageRoll', (action, rollData, parts, extraParts) => {
  try {
    const vs = globalThis.baphometVitalStrike;
    if (!vs?.actorId) return;
    const actor = action?.actor ?? action?.item?.actor ?? action?.parent?.actor;
    if (!actor || actor.id !== vs.actorId) return;

    const actionParts = Array.isArray(action?.damage?.parts) ? action.damage.parts : [];

    // Ambiguity gate MUST run before the transient-parts emptiness check below: a
    // zero-part (or multi-part) action.damage.parts shape is itself the ambiguous/
    // degenerate case this policy exists for, and must emit the diagnostic regardless
    // of whether the transient `parts` array happens to be empty.
    if (actionParts.length !== 1 || typeof actionParts[0]?.formula !== "string" || actionParts[0].formula.length === 0) {
      // VS_AMBIGUOUS_PRIMARY_POLICY = FAIL_OPEN_NO_MULTIPLICATION (GOAL_v2.32.0_VS_DOUBLER_FIX.md):
      // no reliable signal identifies the primary base weapon die on a multi-part (or
      // zero-part) damage action — do not guess, do not multiply anything.
      _debugLog(`Vital Strike: weapon action has ${actionParts.length} damage part(s); primary base die is ambiguous for multi-part damage — no auto-doubling (VS_AMBIGUOUS_PRIMARY_POLICY = FAIL_OPEN_NO_MULTIPLICATION). Apply Vital Strike doubling manually.`);
      return;
    }

    const baseFormula = actionParts[0].formula;

    // Item 3 (VS_FAIL_OPEN_DIAGNOSTIC_POLICY): transient parts empty/unavailable → fail open + diagnostic (was a silent return).
    if (!Array.isArray(parts) || parts.length === 0) {
      _debugLog(`Vital Strike: transient damage-parts array is empty/unavailable — no auto-doubling (fail open). Apply Vital Strike doubling manually.`);
      return;
    }

    const toDuplicate = parts.filter((p) => p?.base === baseFormula);

    // Item 1 (VS_TRANSIENT_MULTIPLICITY_POLICY = EXACTLY_ONE_OR_FAIL_OPEN): require exactly one transient
    // candidate matching the sole persisted base formula. Zero OR more-than-one is ambiguous — fail open,
    // double nothing, emit the diagnostic. Symmetric with the persisted-parts gate. Do NOT add a provenance
    // heuristic; do NOT guess which of multiple candidates is the true base die.
    if (toDuplicate.length !== 1) {
      _debugLog(`Vital Strike: ${toDuplicate.length} transient damage part(s) match the base weapon formula (expected exactly 1) — base die ambiguous, no auto-doubling (VS_TRANSIENT_MULTIPLICITY_POLICY = EXACTLY_ONE_OR_FAIL_OPEN). Apply Vital Strike doubling manually.`);
      return;
    }

    const VS_MULTIPLIER = 2; // Vital Strike; Greater VS (x3) is out of scope
    const p = toDuplicate[0];
    for (let i = 0; i < VS_MULTIPLIER - 1; i++) {
      parts.push({
        base: p.base,
        extra: [], // Item 2 (VS_DUPLICATE_EXTRA_POLICY = EMPTY_ARRAY): never copy transient `extra` onto the VS duplicate.
        damageType: (p.damageType instanceof Set) ? new Set(p.damageType) : p.damageType,
        type: p.type
      });
    }
  } catch (e) {
    _debugLog('Vital Strike pf1PreDamageRoll error: ' + e.message);
  }
});

/* ============================================================
   MAP / SWING TRACKING — v2.30.0
   ══════════════════════════════════════════════════════════
   Single pre-roll handler: (crit-confirm guard) → classify → inject → advance.
   Live-verified by the GATE-1 probe (2026-06-29): the hook order is
   pf1PreAttackRoll -> pf1AttackRoll -> pf1PreActionUse, so pf1PreAttackRoll is the
   ONLY pre-roll injection surface; pf1PreActionUse is NOT used for MAP. The penalty is
   silent (rides rollConfig.secondaryPenalty, the same additive field the TWF handler
   above uses, so MAP stacks with the TWF penalty). NO per-use nonce / dedupe: the probe
   observed NO duplicate little-helper hook fires across single/crit/TWF paths. That is
   bounded-empirical (sampled paths only), NOT a guarantee duplicates are impossible — if a
   real duplicate source later surfaces, add a targeted identity guard then. The ONLY real
   double-fire is the crit confirmation, handled by the guard below.
   ============================================================ */

// Eligible MAP swing? On-turn manufactured-weapon Strike, not Cleave.
// Manufactured = item.type 'weapon' OR ('attack' with system.subType 'weapon') — GATE-1c:
// weaponSubtype is null on the 'attack' representation, so subType is the discriminator.
// Naturals/unarmed (subType !== 'weapon'), spells, and off-turn/AoO all FAIL OPEN (no MAP).
function _isEligibleSwing(actor, item, activeCombatant) {
  if (!actor || !item || !activeCombatant) return false;             // off-turn / AoO → no active match
  if (globalThis.baphometCleave?.actorId === actor.id) return false; // Cleave = 0 swings / full BAB
  const t = item.type;
  if (t === 'weapon') return true;
  if (t === 'attack' && item.system?.subType === 'weapon') return true;
  return false; // spell / natural / unarmed / unconfirmed → fail open (deferred)
}

// MAP penalty for the swing being rolled, reading the PRIOR count: max(0, prior - 1) * -5.
// prior 0->0, 1->0, 2->-5, 3->-10, 4->-15 (canon: 1st-2nd full BAB, 3rd -5, 4th+ cumulative).
function _mapPenaltyForPrior(prior) {
  return Math.max(0, (Number(prior) || 0) - 1) * -5;
}

Hooks.on('pf1PreAttackRoll', (attackData, rollConfig) => {
  try {
    if (!game.combat?.active) return;
    if (!game.settings.get(AT_MODULE_ID, 'mapTracking')) return;
    const actor = attackData?.actor;
    if (!actor) return;

    // Crit-confirmation guard: a confirmation pre reuses the threat swing's MAP and does NOT
    // advance the counter (canon: same swing's MAP). Armed at the threat's pf1AttackRoll below.
    const pending = _mapPendingConfirm.get(actor.id);
    if (pending) {
      _mapPendingConfirm.delete(actor.id);
      if (pending.penalty < 0) {
        rollConfig.secondaryPenalty = String((Number(rollConfig.secondaryPenalty) || 0) + pending.penalty);
      }
      return; // confirmation roll — do NOT advance
    }

    _mapArmCrit.delete(actor.id); // never carry an arm across rolls
    const activeCombatant = _getActiveCombatantForActor(actor);
    if (!_isEligibleSwing(actor, attackData?.item, activeCombatant)) return;

    let state = _getState(activeCombatant.id);
    if (!state) { _initState(activeCombatant.id); state = _getState(activeCombatant.id); }
    if (!state) return;

    const penalty = _mapPenaltyForPrior(state.swingsTaken); // prior count → this swing's MAP
    if (penalty < 0) {
      rollConfig.secondaryPenalty = String((Number(rollConfig.secondaryPenalty) || 0) + penalty); // additive; stacks with TWF
    }
    state.swingsTaken = (Number(state.swingsTaken) || 0) + 1; // advance: this swing is now counted
    _mapArmCrit.set(actor.id, { penalty });                   // candidate; promoted at atk iff crit threat
  } catch (e) {
    _debugLog('MAP pf1PreAttackRoll error: ' + e.message);
  }
});

// Arm the crit-confirmation guard. On a crit THREAT (roll.isCrit) for the swing just injected,
// stash that swing's MAP penalty so the confirmation's pre (firing next, per the probe) reuses it.
Hooks.on('pf1AttackRoll', (action, roll) => {
  try {
    if (!game.combat?.active) return;
    if (!game.settings.get(AT_MODULE_ID, 'mapTracking')) return;
    const actor = action?.actor ?? action?.item?.actor ?? action?.parent?.actor;
    if (!actor) return;
    const armed = _mapArmCrit.get(actor.id);
    _mapArmCrit.delete(actor.id);
    if (armed && roll?.isCrit === true) {
      _mapPendingConfirm.set(actor.id, { penalty: armed.penalty });
    }
  } catch (e) {
    _debugLog('MAP pf1AttackRoll (crit-arm) error: ' + e.message);
  }
});

// FIX-1 (GOAL_v2.37.4, D-1/D-2): spend the base Reaction for a reaction-cost
// spell. ONE spend path for both turn states — only
// game.baphometActions.spendReaction is called here; it must never reach
// spendCombatReflex, which is Combat Reflexes (jade) AoO capacity only and
// cannot pay for a spell. When the Reaction is unavailable: warn once,
// charge nothing, and do NOT cancel the use — the 2026-08-29 "SOFTEN CANON"
// ruling lets the GM adjudicate rather than blocking the roll.
function _baphSpendReactionForSpell(combatant, actor, item) {
  const r = game.baphometActions?.spendReaction?.(combatant.id);
  if (r) {
    _debugLog(`auto-spend: reaction-cost spell "${item.name}" by "${actor.name}" — Reaction spent`);
  } else {
    _debugLog(`auto-spend: reaction-cost spell "${item.name}" by "${actor.name}" — no Reaction available, not charged`);
    ui.notifications?.warn?.(`${actor.name}: no Reaction available to cast ${item.name} — not charged.`);
  }
}

/**
 * Live pf1PreActionUse handler — attack & spell auto-spend.
 * OBSERVE-ONLY. Never returns false.
 */
Hooks.on('pf1PreActionUse', (actionUse) => {
  try {
    const item  = actionUse?.item;
    const actor = actionUse?.actor ?? item?.actor;
    if (!item || !actor || !game.combat?.active) return;

    const isSpell      = item.type === 'spell';
    const isAttack     = item.type === 'attack' || item.type === 'weapon';
    // FIX-1 (GOAL_v2.37.7, D-1): a consumable (potion/scroll/wand/other) is
    // really drawn and activated by item.use(), so it costs actions too.
    const isConsumable = item.type === 'consumable';
    if (!isSpell && !isAttack && !isConsumable) return; // only attacks, spells and consumables

    // FIX-3 (GOAL_v2.37.7, D-3, Mechanics Ref §14): the skip-dialog
    // multi-swing escape. item.use({ skipDialog: true }) on a weapon/natural
    // attack can roll a full PF1 attack — Token Action HUD PF1's own toggle
    // writes the same client-scoped pf1.skipActionDialogs setting the module
    // cannot prevent and should not try. Gated on isAttack (the same test
    // above already makes), never a spell — Magic Missile's extraAttacks
    // resolves as one Standard action correctly charged, not an escape, and
    // must never card. Also gated on actor.type === 'character'
    // (docs/reference/foundry-v13/foundry-and-pf1.md; confirmed Actor types
    // "character"/"npc").
    //
    // FIELD READ, cited under No API Invention: this reads
    // actionUse.shared.attacks.length — the field named in
    // docs/specs/action-economy/R6_OPEN_QUESTIONS.md:164 ("The reliable
    // per-use roll count is the pf1AttackRoll firing count /
    // shared.attacks.length"), NOT chat-message systemRolls.attacks.length
    // (a different field, read off the posted ChatMessage rather than the
    // hook payload). R6:164's own capture recorded shared.attacks.length ===
    // 1 for every use in that cycle (a single Strike, and each of two
    // SEPARATE macro-bridged item.use() calls for a TWF pair) — it never
    // captured a single item.use() on a natural attack configured with 2+
    // attacks in the SAME action (the Claw fixture below), which is a
    // different case R6 left open. GOAL_v2.37.7 (D-3) supplies its own
    // live-verified fact for exactly that case — a skeleton claw's
    // skipDialog use rolling systemRolls.attacks.length === 2 on the
    // resulting chat message — and directs reading the equivalent hook-time
    // count off actionUse.shared.attacks.length so the module never has to
    // wait for, or parse, the chat message. This follows that directive
    // exactly; case 7's probe (A14) is what proves shared.attacks.length
    // actually populates to 2 for the Claw fixture, since R6 alone does not
    // settle it.
    //
    // On more than one swing with pf1.skipActionDialogs true: allow it, let
    // it resolve, and post a GM-whispered card — never cancel, never convert
    // to a single Strike, never block. One card per occurrence, no dedupe:
    // this is a GM-facing record, the opposite of RULE-2's
    // developer-diagnostic dedupe — a GM who sees one card and then nothing
    // has been told the escape happened once when it happened six times.
    //
    // Placed ABOVE the settingOn/Cleave/dedupe gates below, and ABOVE the TWF
    // off-hand return that now follows it: the card reports an escape the
    // module cannot prevent, so it must not inherit any suppression on the
    // spend path — it must fire whether or not autoAttackSpend is on, Cleave
    // is declared, _isActionUseSpendDuped's 500ms window would otherwise
    // skip this use, or the action is a TWF off-hand swing that correctly
    // spends no action. The TWF return below suppresses the CHARGE, never
    // the REPORT. Ordinary TWF play is unaffected by this card firing first:
    // each macro-bridged off-hand item.use() carries shared.attacks.length
    // === 1 (docs/specs/action-economy/R6_OPEN_QUESTIONS.md:164), so
    // swingCount > 1 never trips for a normal TWF off-hand swing.
    if (isAttack && actor?.type === 'character'
        && game.settings.get('pf1', 'skipActionDialogs')) {
      const swingCount = actionUse?.shared?.attacks?.length ?? 0;
      if (swingCount > 1) {
        _debugLog(`auto-spend: §14 skip-dialog escape — "${actor.name}" resolved ${swingCount} swings on "${item.name}" with pf1.skipActionDialogs ON — allowed, not auto-tracked, posting GM card`);
        const safeActorName = foundry.utils.escapeHTML(actor.name);
        const safeItemName  = foundry.utils.escapeHTML(item.name);
        // Fire-and-forget, not awaited: this handler is synchronous and
        // OBSERVE-ONLY (must never return a Promise to pf1PreActionUse), and
        // the enclosing try/catch is synchronous and cannot observe an async
        // rejection. See RUNTIME_VERIFICATION_REQUIRED.md:128-139 — do not
        // infer a settled promise from a rendered card.
        ChatMessage.create({
          content:
            `<p><strong>Action Economy Notice (Mechanics Ref §14):</strong> `
            + `${safeActorName} resolved <strong>${swingCount}</strong> swings on `
            + `<em>${safeItemName}</em> via the skip-dialog full-attack escape. `
            + `The action was allowed and was <strong>not</strong> auto-tracked — `
            + `adjudicate the action economy by hand.</p>`,
          speaker: ChatMessage.getSpeaker({ actor }),
          whisper: ChatMessage.getWhisperRecipients('GM')
        }).catch((err) => {
          console.warn(
            `baphomet-utils | FIX-3 §14 card failed to post for "${actor.name}" — handled here, not thrown. `
            + `The attack still resolved and was never blocked.`, err
          );
        });
      }
    }

    // PF1.5 TWF off-hand: the off-hand bonus swing rides on the main-hand
    // Strike action and must NOT cost its own action. The PF1.5 Two-Weapon
    // Strike macro sets globalThis.baphometTWF.offhand (try/finally-scoped)
    // around the off-hand use(), so this swing still rolls but spends nothing.
    // Mirrors the _baphResolveTaskRollActive suppression pattern.
    // OBSERVE-ONLY: returns early, never returns false.
    if (isAttack && globalThis.baphometTWF?.offhand) {
      _debugLog(`auto-spend: TWF off-hand swing for "${actor.name}" — rides on main-hand Strike, no action spent`);
      return;
    }

    // FIX-1 (GOAL_v2.37.7, D-1): a consumable is gated on the same setting as
    // a spell, not a new toggle — no consumable-specific setting is
    // registered (FIX-2's settings.js edits are the skill allowlist only). A
    // consumable use is a cast-flavored action-use, not a Strike.
    const settingOn = isAttack
      ? game.settings.get(AT_MODULE_ID, 'autoAttackSpend')
      : game.settings.get(AT_MODULE_ID, 'autoSpellSpend');
    if (!settingOn) {
      _debugLog(`auto-spend: ${item.type} setting OFF — no spend for "${item.name}"`);
      return;
    }

    // PF1.5 Cleave (GOAL_v2.28.0): a Cleave follow-up is a FREE Strike — 0 actions,
    // 0 swings, no MAP advance — declared post-kill via a token-driven macro that sets an
    // actor-scoped intent. Mirror the TWF off-hand skip above: the Strike still rolls but
    // spends no action. Placed AFTER the auto-spend gate (so it is inert when auto-spend is
    // OFF) and BEFORE dedupe (so a skipped Cleave never enters the dedupe set).
    // OBSERVE-ONLY: returns early, never returns false.
    if (isAttack && globalThis.baphometCleave?.actorId === actor.id) {
      _debugLog(`auto-spend: Cleave free Strike for "${actor.name}" — 0 actions, no action spent`);
      return;
    }

    if (_isActionUseSpendDuped(actor, actionUse)) {
      _debugLog(`auto-spend: duplicate action-use for "${item.name}" — skipping`);
      return;
    }

    // FIX-1 (GOAL_v2.37.7, D-1): a consumable is costed by system.subType via
    // _deriveConsumableActionCost, not the spell/attack routine above (which
    // would otherwise match the "not a spell" branch and return a flat 1).
    const cost = isConsumable ? _deriveConsumableActionCost(actionUse) : _deriveActionUseCost(actionUse);
    const activeCombatant = _getActiveCombatantForActor(actor);

    // v2.25.1 (Lyra audit): read + consume the AoO (Combat Reflexes) intent ONCE,
    // on every path, scoped to THIS actor. The dialog checkbox sets a one-shot
    // globalThis.baphometAoO; consuming it here (not only in the off-turn branch)
    // stops a stale on-turn tick from surviving to a later off-turn attack, and the
    // actor-id scope means actor A's attack never eats actor B's open-dialog flag.
    const _aooFlag = globalThis.baphometAoO;
    const aooIntentForActor = !!(_aooFlag?.active && _aooFlag.actorId === actor.id);
    if (_aooFlag && _aooFlag.actorId === actor.id) globalThis.baphometAoO = null;

    if (activeCombatant) {
      // On-turn: spend the action cost (all-or-nothing).
      if (!_canUserControlCombatant(activeCombatant)) {
        _debugLog(`auto-spend: user cannot control "${actor.name}" — no spend`);
        return;
      }
      if (isSpell && _isReactionCostSpell(actionUse)) {
        // FIX-1 (GOAL_v2.37.4, D-1): an immediate-action (reaction-cost)
        // spell spends the base Reaction, never an action — on turn the
        // same as off it. Self-contained: spend/warn via the shared helper
        // and return; never falls through to the action-cost spend below.
        _baphSpendReactionForSpell(activeCombatant, actor, item);
        return;
      }
      const spent = _spendActionForCombatant(
        activeCombatant.id, cost,
        isSpell ? `spell-${item.name}` : isAttack ? `attack-${item.name}` : `consumable-${item.name}`
      );
      if (spent) {
        _debugLog(`auto-spend: spent ${cost} action(s) for "${actor.name}" [${item.type}: ${item.name}]`);
      } else {
        _debugLog(`auto-spend: insufficient actions (${cost} needed) for "${actor.name}" [${item.name}]`);
        ui.notifications?.warn?.(`${actor.name}: not enough actions for ${item.name} (needs ${cost}).`);
      }
      // NOTE: swing-counter / MAP tracking deferred (GOAL_v2.22.0 Out of Scope).
    } else {
      // Off-turn → reaction. FIX-1 (GOAL_v2.37.4, D-2): a reaction-cost spell
      // spends the Reaction here too — the archetypal immediate-action spell
      // use (Feather Fall, a readied counterspell) is off-turn. Self-
      // contained: resolved and RETURNS here, before the shared attack/AoO
      // path below — that path never sees a spell. Any other spell is still
      // not charged, as before; this narrows the old !isAttack early return
      // rather than removing it.
      if (isSpell && _isReactionCostSpell(actionUse)) {
        const ownForSpell = _getCombatantForActor(actor);
        if (!ownForSpell) {
          _debugLog(`auto-spend: off-turn reaction-cost spell but "${actor.name}" not in combat — no spend`);
          return;
        }
        if (!_canUserControlCombatant(ownForSpell)) {
          _debugLog(`auto-spend: cannot control "${actor.name}" — no reaction spend for spell "${item.name}"`);
          return;
        }
        _baphSpendReactionForSpell(ownForSpell, actor, item);
        return;
      }
      // FIX-1 (GOAL_v2.37.7, D-1): off-turn consumables are not charged,
      // debug text only — this mirrors spells (v2.37.4 carved exactly one
      // exception out of the return below, the reaction-cost spell above,
      // and nothing about drinking a potion out of turn asks for a second).
      // Placed after that carve-out and before the generic !isAttack return,
      // so the debug text correctly names a consumable instead of reusing
      // the spell-only wording below.
      if (isConsumable) {
        _debugLog(`auto-spend: off-turn consumable "${item.name}" by "${actor.name}" — not charged (no active-turn action)`);
        return;
      }
      if (!isAttack) {
        _debugLog(`auto-spend: off-turn spell by "${actor.name}" — not charged (no active-turn action)`);
        return;
      }
      const own = _getCombatantForActor(actor);
      if (!own) {
        _debugLog(`auto-spend: off-turn attack but "${actor.name}" not in combat — no spend`);
        return;
      }
      if (!_canUserControlCombatant(own)) {
        _debugLog(`auto-spend: cannot control "${actor.name}" — no reaction spend`);
        return;
      }
      // v1.25: prefer the green Combat Reflexes (jade) pool when the attack
      // was flagged "AoO (Combat Reflexes)" on the dialog and the actor has
      // the feat; fall back to the blue reaction when no jade is left.
      // v2.25.1: the AoO intent was read + consumed once before the branch
      // (actor-scoped) — a stale on-turn tick can't survive, and actor A's
      // attack never eats actor B's open-dialog flag.
      const wantsCR = isAttack && aooIntentForActor && _combatReflexCount(actor) > 0;
      if (wantsCR && game.baphometActions?.spendCombatReflex?.(own.id)) {
        _debugLog(`auto-spend: off-turn AoO by "${actor.name}" — Combat Reflexes (jade) pip spent`);
      } else {
        const r = game.baphometActions?.spendReaction?.(own.id);
        if (wantsCR && !r) ui.notifications?.warn?.(`${actor.name}: no Combat Reflexes AoO or reaction left.`);
        _debugLog(`auto-spend: off-turn AoO by "${actor.name}" — ${wantsCR ? 'no jade → ' : ''}reaction ${r ? 'spent' : 'unavailable'} (no action, no swing)`);
      }
    }
  } catch (e) {
    _debugLog('auto-spend (pf1PreActionUse) error: ' + e.message);
  }
  return undefined; // NEVER cancel the action
});

/* ============================================================
   FLOATING ACTION SPEND PANEL — v1.15
   ══════════════════════════════════════════════════════════

   A fixed-position panel visible only during active combat.
   Provides three generic manual action-spend buttons:

     Spend 1 — Swing / Move      (1 pip, reason: manual-1)
     Spend 2 — Cast / Ready      (2 pips, reason: manual-2)
     Spend 3 — F.Cast / Run       (3 pips, reason: manual-3)

   Labels are descriptive examples only. No action-type rules
   are enforced. All spends are generic pip deductions.

   Source of truth: game.combat.combatant (active combatant).
   Never reads from selected tokens.

   Visibility: only shown when the current user is GM or can
   control the active combatant (_canUserControlCombatant).

   All spends are all-or-nothing. Spending 2 with only 1 pip
   available spends 0 and warns. Condition-locked pips are
   never consumed.

   Position: controlled by the existing 'moveButtonPosition'
   client setting (bottom-right / bottom-left / top-right / top-left).

   Replaces the single Stride button from v1.14.
   ============================================================ */

/**
 * Return the DOM id used for the action spend panel.
 * @returns {string}
 */
function _getActionPanelId() {
  return 'baph-action-panel';
}

/**
 * Remove the action panel from the DOM if it exists.
 */
function _removeActionPanel() {
  document.getElementById(_getActionPanelId())?.remove();
}

/**
 * Return true if the action panel should be shown to the
 * current user right now.
 *
 * Requires:
 *   - Active combat with a current combatant
 *   - Current user is GM or can control the active combatant
 *
 * @returns {boolean}
 */
function _shouldShowActionPanel() {
  const combat = game.combat;
  if (!combat?.active || !combat.combatant) return false;
  return _canUserControlCombatant(combat.combatant);
}

/**
 * Build a single spend button row for the action panel.
 *
 * Re-validates combatant and ownership at click time so stale
 * renders don't enable spending for the wrong combatant.
 *
 * @param {number} cost    Number of action pips to spend (1–3)
 * @param {string} label   Short descriptive label shown on the button
 * @param {string} hint    Tooltip / title text
 * @param {string} reason  Debug reason string passed to _spendActionForCombatant
 * @returns {HTMLButtonElement}
 */
function _buildActionSpendButton(cost, label, hint, reason) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.classList.add('baph-action-spend-btn');
  btn.title = hint;

  const costBadge = document.createElement('span');
  costBadge.classList.add('baph-action-spend-cost');
  costBadge.textContent = String(cost);

  const labelEl = document.createElement('span');
  labelEl.classList.add('baph-action-spend-label');
  labelEl.textContent = label;

  btn.appendChild(costBadge);
  btn.appendChild(labelEl);

  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Re-validate at click time — active combatant or permissions
    // may have changed since the panel was last rendered.
    const active = game.combat?.combatant;

    if (!active) {
      _debugLog('Action panel: failed — no active combatant at click time');
      ui.notifications?.warn?.('No active combatant available.');
      _renderActionPanel();
      return;
    }

    if (!_canUserControlCombatant(active)) {
      _debugLog(`Action panel: failed — user cannot control ${active.name}`);
      ui.notifications?.warn?.(`You cannot control ${active.name}.`);
      _renderActionPanel();
      return;
    }

    _debugLog(`Action panel: attempting spend — ${active.name} / cost ${cost} / ${reason}`);

    // _spendActionForCombatant is synchronous and all-or-nothing.
    const spent = _spendActionForCombatant(active.id, cost, reason);

    if (!spent) {
      _debugLog(`Action panel: failed — not enough actions for ${active.name}, needed ${cost}`);
      ui.notifications?.warn?.(`${active.name} does not have enough actions.`);
      _refreshPipRow(active.id);
      return;
    }

    _debugLog(`Action panel: success — spent ${cost} action(s) for ${active.name}`);
    _refreshPipRow(active.id);
    _renderActionPanel();
  });

  return btn;
}

/**
 * Remove any existing action panel and, if the user should see
 * one, inject a fresh panel into document.body.
 *
 * Always calls _removeActionPanel() first to prevent duplicates.
 */
function _renderActionPanel() {
  _removeActionPanel();
  _renderTaskWidget();
  _renderAidPanel();

  if (!_shouldShowActionPanel()) return;

  const combatant = game.combat.combatant;
  const position = _getButtonPosition();

  const panel = document.createElement('div');
  panel.id = _getActionPanelId();
  panel.classList.add('baph-action-panel', `baph-action-panel-${position}`);

  // Compact header showing the active combatant name.
  const header = document.createElement('div');
  header.classList.add('baph-action-panel-header');
  header.textContent = combatant.name;
  header.title = combatant.name;
  panel.appendChild(header);

  // Spend buttons — labels are examples only, not rules.
  panel.appendChild(_buildActionSpendButton(1, 'Swing / Move',   'Spend 1 action',  'manual-1'));
  panel.appendChild(_buildActionSpendButton(2, 'Cast / Ready',   'Spend 2 actions', 'manual-2'));
  panel.appendChild(_buildActionSpendButton(3, 'F.Cast / Run',    'Spend 3 actions', 'manual-3'));

  document.body.appendChild(panel);
}

/* ============================================================
   TASK PROGRESS WIDGET — v2.17.0 / v2.17.1
   Interactive display for the active combatant's first active task.

   Visible to all users when all three conditions are met:
     1. Active combat encounter
     2. Current active combatant
     3. At least one task with status === 'active' on that combatant

   Does NOT expose hidden task data (roundsRequired, metadataHidden).
   Player-safe display only: taskName + roundsCommitted + readyToResolve.

   If multiple active tasks exist, shows the first one found.
   Multi-task display is future work.

   v2.17.1 additions:
   - Continue Task button (shown when task is not readyToResolve and
     the current user can control the active combatant).
   - Click: spends 1 action via game.baphometTasks.commitAction(),
     then calls _renderActionPanel() to refresh.
   - Cross-client cache sync handled by updateActor hook in
     task-tracker.js — widget updates automatically on all clients.
   ============================================================ */

const TASK_WIDGET_ID = 'baph-task-widget';

function _removeTaskWidget() {
  document.getElementById(TASK_WIDGET_ID)?.remove();
}

/**
 * Render (or remove) the task progress widget for the active combatant.
 * Called from _renderActionPanel() on every panel lifecycle event and
 * indirectly by the updateActor cache-sync hook in task-tracker.js.
 *
 * Widget visibility depends on combat/combatant/task state only.
 * Continue Task button additionally requires user control of combatant.
 */
function _renderTaskWidget() {
  _removeTaskWidget();

  const combat = game.combat;
  if (!combat?.active) return;
  const combatant = combat.combatant;
  if (!combatant) return;

  // game.baphometTasks is registered on pf1PostReady; guard for early calls.
  if (!game.baphometTasks) return;

  const tasks = game.baphometTasks.getTasks(combatant);
  const task = Object.values(tasks).find(t => t.status === 'active');

  if (!task) {
    const position = _getButtonPosition();
    if (game.user.isGM) {
      _renderBeginTaskWidget(combatant, position);
    } else if (_canUserControlCombatant(combatant)) {
      _renderRequestTaskWidget(combatant, position);
    }
    return;
  }

  const canControl = _canUserControlCombatant(combatant);

  const position = _getButtonPosition();

  const widget = document.createElement('div');
  widget.id = TASK_WIDGET_ID;
  widget.classList.add('baph-task-widget', `baph-task-widget-${position}`);

  const header = document.createElement('div');
  header.classList.add('baph-task-widget-header');
  header.textContent = 'Task';
  widget.appendChild(header);

  const nameEl = document.createElement('div');
  nameEl.classList.add('baph-task-widget-name');
  nameEl.textContent = task.taskName ?? '(unnamed)';
  nameEl.title = task.taskName ?? '';
  widget.appendChild(nameEl);

  // Player-safe progress: never exposes roundsRequired or hidden metadata.
  const progressEl = document.createElement('div');
  progressEl.classList.add('baph-task-widget-progress');
  if (task.readyToResolve) {
    const currentRound     = game.combat?.round ?? null;
    const lastAttemptRound = task.lastResolvedAttemptRound ?? null;
    if (lastAttemptRound !== null && lastAttemptRound === currentRound) {
      progressEl.textContent = 'Minor failure — retry next round';
      progressEl.classList.add('baph-task-widget-minor-failure');
    } else if (lastAttemptRound !== null) {
      progressEl.textContent = 'Retry available — resolve again';
      progressEl.classList.add('baph-task-widget-retry');
    } else {
      progressEl.textContent = 'Ready to resolve';
      progressEl.classList.add('baph-task-widget-ready');
    }
  } else {
    progressEl.textContent = `Progress: ${task.roundsCommitted ?? 0} committed`;
  }
  widget.appendChild(progressEl);

  // Pending aid display — shows total queued assistance if any.
  const pendingBonuses     = task.pendingResolutionBonuses ?? [];
  const pendingBonusTotal  = pendingBonuses.reduce((s, b) => s + (b.amount ?? 0), 0);
  if (pendingBonusTotal > 0) {
    const aidEl = document.createElement('div');
    aidEl.classList.add('baph-task-widget-aid-queued');
    aidEl.textContent = `Assistance queued: +${pendingBonusTotal}`;
    widget.appendChild(aidEl);
  }

  // Continue Task button — only for controlling users on unresolved tasks.
  // Spend 1 action + commit 1 progress unit. Hidden when readyToResolve.
  if (!task.readyToResolve && canControl) {
    const taskId = task.taskId;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.classList.add('baph-task-widget-continue-btn');
    btn.textContent = 'Continue Task';
    btn.title = 'Spend 1 action to commit 1 round of task progress';

    btn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const active = game.combat?.combatant;
      if (!active || !game.baphometTasks) {
        _debugLog('Task widget: Continue Task — no active combatant or API not ready');
        return;
      }

      _debugLog(`Task widget: Continue Task — ${active.name} / task ${taskId}`);
      const ok = await game.baphometTasks.commitAction(active, taskId);

      if (ok) {
        _debugLog('Task widget: Continue Task succeeded — refreshing');
        _renderActionPanel();
      } else {
        _debugLog('Task widget: Continue Task failed — commitAction returned false');
        ui.notifications?.warn?.(
          'Continue Task: action not taken. Not enough actions or already committed this round.'
        );
        _renderActionPanel();
      }
    });

    widget.appendChild(btn);
  }

  // Resolve Task button — shown when task is ready to resolve and user controls combatant.
  // Spend 1 action and roll the skill check via the existing resolveTask path.
  if (task.readyToResolve && canControl) {
    const taskId = task.taskId;
    const resolveBtn = document.createElement('button');
    resolveBtn.type = 'button';
    resolveBtn.classList.add('baph-task-widget-resolve-btn');
    resolveBtn.textContent = 'Resolve Task';
    resolveBtn.title = 'Spend 1 action to roll the skill check and resolve this task';

    resolveBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const active = game.combat?.combatant;
      if (!active || !game.baphometTasks) {
        _debugLog('Task widget: Resolve Task — no active combatant or API not ready');
        return;
      }

      _debugLog(`Task widget: Resolve Task — ${active.name} / task ${taskId}`);
      const ok = await game.baphometTasks.resolveTask(active, taskId);

      if (!ok) {
        _debugLog('Task widget: Resolve Task failed — resolveTask returned false');
        ui.notifications?.warn?.(
          'Resolve Task: action not taken. Not enough actions, task not ready, or already attempted this round.'
        );
      } else {
        _debugLog('Task widget: Resolve Task succeeded — refreshing');
      }
      _renderActionPanel();
    });

    widget.appendChild(resolveBtn);
  }

  // Abandon Task button — shown to controlling users for any non-terminal active task.
  // Costs 0 actions, no roll. Clears pending aid. Chat notification posted.
  if (canControl) {
    const abandonTaskId = task.taskId;
    const abandonBtn = document.createElement('button');
    abandonBtn.type = 'button';
    abandonBtn.classList.add('baph-task-widget-abandon-btn');
    abandonBtn.textContent = 'Abandon Task';
    abandonBtn.title = 'Abandon this task. Costs no actions.';

    abandonBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const active = game.combat?.combatant;
      if (!active || !game.baphometTasks) {
        _debugLog('Task widget: Abandon Task — no active combatant or API not ready');
        return;
      }

      _debugLog(`Task widget: Abandon Task — ${active.name} / task ${abandonTaskId}`);
      const ok = await game.baphometTasks.abandonTask(active, abandonTaskId);

      if (!ok) {
        _debugLog('Task widget: Abandon Task failed — abandonTask returned false');
        ui.notifications?.warn?.('Abandon Task: could not abandon this task.');
      }
      _renderActionPanel();
    });

    widget.appendChild(abandonBtn);
  }

  document.body.appendChild(widget);
}

/* ============================================================
   AID TASK PANEL — v2.18.0

   Compact panel listing allied ready-to-resolve tasks that the
   active combatant can aid this turn. Appears when eligible aid
   targets exist in the current combat.

   Position: above the task widget on the same horizontal rail.
   The active combatant's own task widget and the aid panel may
   show simultaneously; they share the same position setting.
   ============================================================ */

const AID_PANEL_ID = 'baph-aid-panel';

function _removeAidPanel() {
  document.getElementById(AID_PANEL_ID)?.remove();
}

/**
 * Render (or remove) the aid task panel for the active combatant.
 * Shows one row per eligible ally ready task with an Aid button.
 * Called from _renderActionPanel() on every panel lifecycle event.
 */
function _renderAidPanel() {
  _removeAidPanel();

  const combat = game.combat;
  if (!combat?.active) return;
  const activeCombatant = combat.combatant;
  if (!activeCombatant) return;
  if (!game.baphometTasks) return;
  if (!_canUserControlCombatant(activeCombatant)) return;

  const aidTargets   = [];

  for (const combatant of combat.combatants) {
    if (combatant.id === activeCombatant.id) continue;
    if (!combatant.actor) continue;

    const tasks = game.baphometTasks.getTasks(combatant);
    for (const task of Object.values(tasks)) {
      // Aid available for all active tasks: both in-progress and ready-to-resolve (v2.18.1)
      if (task.status !== 'active') continue;

      // "Aided ✓" state: helper already has a successful contribution for this pending Resolve attempt.
      // Uses successfulAidContributors (cleared on Resolve) rather than roundAdded (cleared on turn).
      const successfulContributors = task.successfulAidContributors ?? [];
      const alreadyAided = successfulContributors.includes(activeCombatant.id);
      aidTargets.push({ combatant, task, alreadyAided });
    }
  }

  if (aidTargets.length === 0) return;

  const position = _getButtonPosition();

  const panel = document.createElement('div');
  panel.id = AID_PANEL_ID;
  panel.classList.add('baph-aid-panel', `baph-aid-panel-${position}`);

  const header = document.createElement('div');
  header.classList.add('baph-aid-panel-header');
  header.textContent = 'Aid Task';
  panel.appendChild(header);

  for (const { combatant, task, alreadyAided } of aidTargets) {
    const row = document.createElement('div');
    row.classList.add('baph-aid-panel-row');

    const label = document.createElement('span');
    label.classList.add('baph-aid-panel-label');
    label.textContent = `${combatant.actor.name} — ${task.taskName}`;
    label.title = `${combatant.actor.name}: ${task.taskName}`;
    row.appendChild(label);

    if (alreadyAided) {
      const aidedNote = document.createElement('span');
      aidedNote.classList.add('baph-aid-panel-aided');
      aidedNote.textContent = 'Aided ✓';
      row.appendChild(aidedNote);
    } else {
      const targetCombatantId = combatant.id;
      const targetTaskId      = task.taskId;

      const aidBtn = document.createElement('button');
      aidBtn.type = 'button';
      aidBtn.classList.add('baph-aid-panel-btn');
      aidBtn.textContent = 'Aid';
      aidBtn.title =
        `Spend 1 action, roll ${task.taskName ? task.skillKey.toUpperCase() : 'skill'} vs DC 10 ` +
        `to aid ${combatant.actor.name}'s ${task.taskName} (+2 on success)`;

      aidBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const active = game.combat?.combatant;
        if (!active || !game.baphometTasks) return;

        _debugLog(
          `Aid panel: Aid Task — ${active.name} → ${combatant.actor.name} / task ${targetTaskId}`
        );
        const ok = await game.baphometTasks.aidTask(active, targetCombatantId, targetTaskId);

        if (!ok) {
          ui.notifications?.warn?.(
            'Aid Task: could not aid. Not enough actions, task no longer eligible, or already aided this round.'
          );
        }
        _renderActionPanel();
      });

      row.appendChild(aidBtn);
    }

    panel.appendChild(row);
  }

  document.body.appendChild(panel);
}

/**
 * Render a minimal task widget showing only the "Begin Task" button.
 * Visible to GM only, when the active combatant has no unresolved task.
 */
function _renderBeginTaskWidget(combatant, position) {
  const widget = document.createElement('div');
  widget.id = TASK_WIDGET_ID;
  widget.classList.add('baph-task-widget', `baph-task-widget-${position}`);

  const header = document.createElement('div');
  header.classList.add('baph-task-widget-header');
  header.textContent = 'Task';
  widget.appendChild(header);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.classList.add('baph-task-widget-begin-btn');
  btn.textContent = 'Begin Task';
  btn.title = 'Open GM task builder for this combatant';
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    _openTaskBuilderOverlay(combatant);
  });
  widget.appendChild(btn);

  document.body.appendChild(widget);
}

/* ============================================================
   GM TASK BUILDER OVERLAY — v2.19.0

   GM-only compact form overlay for initiating a supported
   multi-round Disable Device task for the active combatant.

   Opens when the GM clicks the "Begin Task" button that appears
   in the task widget area when the active combatant has no task.

   The overlay collects:
     - Task Name (text)
     - Action flavor (select: disable / arm / sabotage / jury_rig / custom)
     - Duration mode (Simple 1d4 / Difficult 2d4 / Manual)
     - Manual rounds required (shown only for Manual mode)
     - Resolution DC (number)

   On confirm:
     1. Re-validates active combatant matches the stored ID.
     2. Secret rolls for Simple/Difficult modes (GM-side Math.random).
     3. Calls game.baphometTasks.initiateTask() which spends 1 action
        and creates the task with roundsCommitted=1.

   Positioned at the task widget location (bottom: 11.5rem for bottom-*
   variants), z-index: 101 (above task widget and aid panel at 100).

   Removed by: confirm click, cancel click, deleteCombat hook.
   Does NOT close on _renderActionPanel calls so the GM can fill it
   across incremental re-renders. Stale-combatant is caught at confirm.
   ============================================================ */

const TASK_BUILDER_ID = 'baph-task-builder';

function _removeTaskBuilderOverlay() {
  document.getElementById(TASK_BUILDER_ID)?.remove();
}

function _openTaskBuilderOverlay(combatant) {
  _removeTaskBuilderOverlay();
  _removeTaskWidget();

  const position = _getButtonPosition();

  const overlay = document.createElement('div');
  overlay.id = TASK_BUILDER_ID;
  overlay.classList.add('baph-task-builder', `baph-task-builder-${position}`);
  overlay.dataset.combatantId = combatant.id;

  // Header
  const header = document.createElement('div');
  header.classList.add('baph-task-builder-header');
  header.textContent = 'Begin Task';
  overlay.appendChild(header);

  // Read-only skill display
  const skillEl = document.createElement('div');
  skillEl.classList.add('baph-task-builder-skill-line');
  skillEl.textContent = 'Skill: Disable Device';
  overlay.appendChild(skillEl);

  // Task Name
  const nameLabel = document.createElement('label');
  nameLabel.classList.add('baph-task-builder-field-label');
  nameLabel.textContent = 'Task Name';
  overlay.appendChild(nameLabel);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.classList.add('baph-task-builder-input');
  nameInput.name = 'taskName';
  nameInput.placeholder = 'e.g. Disable Poison Dart Trap';
  overlay.appendChild(nameInput);

  // Action flavor
  const actionLabel = document.createElement('label');
  actionLabel.classList.add('baph-task-builder-field-label');
  actionLabel.textContent = 'Action';
  overlay.appendChild(actionLabel);

  const actionSelect = document.createElement('select');
  actionSelect.classList.add('baph-task-builder-select');
  actionSelect.name = 'taskAction';
  [
    { value: 'disable',  label: 'Disable' },
    { value: 'arm',      label: 'Arm' },
    { value: 'sabotage', label: 'Sabotage' },
    { value: 'jury_rig', label: 'Jury-rig' },
    { value: 'custom',   label: 'Custom' },
  ].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    actionSelect.appendChild(opt);
  });
  overlay.appendChild(actionSelect);

  // Duration mode
  const durationLabel = document.createElement('label');
  durationLabel.classList.add('baph-task-builder-field-label');
  durationLabel.textContent = 'Duration';
  overlay.appendChild(durationLabel);

  const durationSelect = document.createElement('select');
  durationSelect.classList.add('baph-task-builder-select');
  durationSelect.name = 'roundsMode';
  [
    { value: 'simple',    label: 'Simple — secret 1d4' },
    { value: 'difficult', label: 'Difficult — secret 2d4' },
    { value: 'manual',    label: 'Manual' },
  ].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    durationSelect.appendChild(opt);
  });
  overlay.appendChild(durationSelect);

  // Manual rounds group (hidden unless manual selected)
  const manualGroup = document.createElement('div');
  manualGroup.classList.add('baph-task-builder-manual-group');
  manualGroup.style.display = 'none';

  const manualLabel = document.createElement('label');
  manualLabel.classList.add('baph-task-builder-field-label');
  manualLabel.textContent = 'Rounds Required';
  manualGroup.appendChild(manualLabel);

  const manualInput = document.createElement('input');
  manualInput.type = 'number';
  manualInput.classList.add('baph-task-builder-input', 'baph-task-builder-input-num');
  manualInput.name = 'roundsManual';
  manualInput.min = '1';
  manualInput.step = '1';
  manualInput.value = '2';
  manualGroup.appendChild(manualInput);
  overlay.appendChild(manualGroup);

  durationSelect.addEventListener('change', () => {
    manualGroup.style.display = durationSelect.value === 'manual' ? '' : 'none';
  });

  // Resolution DC
  const dcLabel = document.createElement('label');
  dcLabel.classList.add('baph-task-builder-field-label');
  dcLabel.textContent = 'Resolution DC';
  overlay.appendChild(dcLabel);

  const dcInput = document.createElement('input');
  dcInput.type = 'number';
  dcInput.classList.add('baph-task-builder-input', 'baph-task-builder-input-num');
  dcInput.name = 'dc';
  dcInput.min = '1';
  dcInput.step = '1';
  dcInput.value = '15';
  overlay.appendChild(dcInput);

  // Button row
  const btnRow = document.createElement('div');
  btnRow.classList.add('baph-task-builder-btn-row');

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.classList.add('baph-task-builder-btn', 'baph-task-builder-btn-confirm');
  confirmBtn.textContent = 'Begin Task';

  confirmBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Re-validate active combatant at click time
    const active = game.combat?.combatant;
    if (!active) {
      ui.notifications?.warn?.('No active combatant — cannot begin task.');
      _removeTaskBuilderOverlay();
      _renderActionPanel();
      return;
    }
    if (active.id !== overlay.dataset.combatantId) {
      ui.notifications?.warn?.('Turn has changed — task builder closed.');
      _removeTaskBuilderOverlay();
      _renderActionPanel();
      return;
    }

    // Collect and validate form values
    const taskName   = nameInput.value.trim();
    const taskAction = actionSelect.value;
    const roundsMode = durationSelect.value;
    const dcRaw      = parseInt(dcInput.value, 10);

    if (!taskName) {
      ui.notifications?.warn?.('Task Name is required.');
      nameInput.focus();
      return;
    }
    if (!Number.isFinite(dcRaw) || dcRaw < 1) {
      ui.notifications?.warn?.('Resolution DC must be a positive integer.');
      dcInput.focus();
      return;
    }

    // Secret roll for duration (GM-side only — not visible to players)
    let roundsRequired;
    if (roundsMode === 'simple') {
      roundsRequired = Math.floor(Math.random() * 4) + 1;       // 1d4
    } else if (roundsMode === 'difficult') {
      roundsRequired = (Math.floor(Math.random() * 4) + 1)      // 2d4
                     + (Math.floor(Math.random() * 4) + 1);
    } else {
      roundsRequired = parseInt(manualInput.value, 10);
      if (!Number.isFinite(roundsRequired) || roundsRequired < 1) {
        ui.notifications?.warn?.('Rounds Required must be a positive integer.');
        manualInput.focus();
        return;
      }
    }

    _removeTaskBuilderOverlay();

    if (!game.baphometTasks) {
      ui.notifications?.warn?.('Task system not ready.');
      _renderActionPanel();
      return;
    }

    // initiateTask handles: action spend, task creation, chat, panel refresh
    await game.baphometTasks.initiateTask(active, {
      taskName,
      taskAction,
      roundsRequired,
      dc: dcRaw,
    });
    // initiateTask calls _renderActionPanel() on success.
    // On failure it notifies via ui.notifications and we fall through.
    _renderActionPanel();
  });
  btnRow.appendChild(confirmBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.classList.add('baph-task-builder-btn', 'baph-task-builder-btn-cancel');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    _removeTaskBuilderOverlay();
    _renderActionPanel();
  });
  btnRow.appendChild(cancelBtn);

  overlay.appendChild(btnRow);
  document.body.appendChild(overlay);

  // Focus task name field after DOM insertion
  setTimeout(() => nameInput.focus(), 50);
}

/* ----------------------------------------------------------
   ACTION PANEL HOOK REGISTRATIONS

   Separate from the existing combat lifecycle hooks above
   (which manage pipState). These hooks manage only the
   action panel DOM element.

   renderCombatTracker: covers turn advance, combatant changes,
   and any re-render of the tracker. Most state changes that
   matter for the panel fire this hook.

   updateCombat: belt-and-suspenders for turn advances that may
   not always trigger a full renderCombatTracker re-render.

   combatStart: ensures the panel appears when combat begins.

   deleteCombat: removes the panel when combat ends.
   (The existing deleteCombat hook cleans up pipState separately;
   this listener only removes the DOM panel.)
   ---------------------------------------------------------- */

Hooks.on('renderCombatTracker', () => {
  _renderActionPanel();
});

Hooks.on('updateCombat', () => {
  _renderActionPanel();
});

Hooks.on('combatStart', () => {
  _renderActionPanel();
});

Hooks.on('deleteCombat', () => {
  _removeActionPanel();
  _removeTaskWidget();
  _removeAidPanel();
  _removeTaskBuilderOverlay();
  _removeRequestTaskOverlay();
  _removeGMApprovalModal();
});

/* ----------------------------------------------------------
   CROSS-CLIENT PIP SYNC — v2.19.1

   When any client writes the pip flag (spendAction, spendReaction,
   reset, or manual toggle), Foundry propagates an updateCombatant
   hook to ALL connected clients. This hook re-hydrates the local
   pipState from the combatant flag and refreshes the pip row,
   making remote clients display the current spend state without
   requiring a manual reload.

   updateCombatant is confirmed in:
     docs/reference/foundry-v13/99_Combined_Foundry_v13_PF1_[KnowledgeFiles.md].md
     Hooks.on('updateCombatant', (combatant, changes, options, userId) => {});

   getFlag is synchronous (reads from in-memory document data).
   ---------------------------------------------------------- */
Hooks.on('updateCombatant', (combatant, changes) => {
  // Bail fast if this isn't a pip-state flag update.
  if (!changes?.flags?.['baphomet-utils']?.[PIP_FLAG_KEY]) return;

  const combat = game.combat;
  if (!combat) return;

  // Confirm this combatant belongs to the currently active combat.
  if (combatant.parent?.id !== combat.id) return;

  const existing = _getState(combatant.id);
  if (!existing) return;

  // Read authoritative merged state from the document (not from changes
  // which may be a partial update in edge cases).
  const saved = combatant.getFlag('baphomet-utils', PIP_FLAG_KEY);
  if (!saved) return;

  // Hydrate pip arrays only; conditionLocked is derived from actor, not stored.
  if (Array.isArray(saved.actions)   && saved.actions.length   === 3) existing.actions   = [...saved.actions];
  if (Array.isArray(saved.reaction)  && saved.reaction.length  === 1) existing.reaction  = [...saved.reaction];
  if (Array.isArray(saved.reflexPip))                                  existing.reflexPip = [...saved.reflexPip];
  if ('bonusManual' in saved) existing.bonusManual = !!saved.bonusManual;
  if ('bonusAuto'   in saved) existing.bonusAuto   = !!saved.bonusAuto;
  if (Array.isArray(saved.bonusPip)) existing.bonusPip = [...saved.bonusPip];
  if ('resetForSeq' in saved) existing._resetForSeq = saved.resetForSeq; // v1.27 round-02

  // v2.37.0 round-02 (GOAL_v2.37.0_PIP_AUTHORITY FIX-2): this hook fires for
  // EVERY authoritative pip-flag write this client observes — the requester's
  // own relayed spend echoing back, another client's spend, a manual reset(),
  // or (via this same flag key) a turn-start reset written from
  // _maybeResetForNewTurn (Trap-4 protected — not edited; it already goes
  // through _writePipFlag, so its write lands here like any other). Bumping
  // pipSeq on every such hydration means a pending local revert captured
  // before this authoritative state landed can never fire after it and
  // clobber it (Trap 3) — this is the guard's actual coverage; it is NOT
  // limited to "an incoming cross-client echo" as a prior draft of this
  // comment block overstated.
  existing.pipSeq = (Number(existing.pipSeq) || 0) + 1;

  // Refresh the pip row in the combat tracker sidebar for this combatant.
  _refreshPipRow(combatant.id);
});

/* ----------------------------------------------------------
   v2.30.0: dedicated hydrator for the ISOLATED off-hand-budget flag.
   Kept separate from the pipState hydrator above so the two never interfere.
   Rejects a stale self-echo via the monotonic `seq` (accept only seq > local —
   GATE-1 probe fact 7), and treats a prior-round/activeId value as 0 (the v1.25
   "adopt current state, don't let a stale signal undo newer state" instinct).
   No UI refresh: the off-hand budget has no rendered pip.

   v2.35.0 round-03 (FD-01): the current-vs-stale test now compares
   (round, activeId) instead of (round, turn) — see OFF_BUDGET_FLAG_KEY's
   comment and `_currentActiveCombatantId`. A legacy flag (no `activeId` key)
   falls back to the old (round, turn) comparison so it is not treated as
   stale-therefore-unspent.
   ---------------------------------------------------------- */
Hooks.on('updateCombatant', (combatant, changes) => {
  if (!changes?.flags?.['baphomet-utils']?.[OFF_BUDGET_FLAG_KEY]) return;
  const combat = game.combat;
  if (!combat || combatant.parent?.id !== combat.id) return;
  const existing = _getState(combatant.id);
  if (!existing) return;
  const ob = combatant.getFlag(AT_MODULE_ID, OFF_BUDGET_FLAG_KEY);
  if (!ob) return;
  const incomingSeq = Number(ob.seq) || 0;
  if (incomingSeq <= (Number(existing.offSeq) || 0)) return; // stale / self-echo — ignore
  existing.offSeq = incomingSeq;
  const isCurrent = ob.round === (combat.round ?? 0) && (
    Object.prototype.hasOwnProperty.call(ob, 'activeId')
      ? ob.activeId === _currentActiveCombatantId(combat)
      : ob.turn === (combat.turn ?? 0) // legacy pre-round-03 flag shape
  );
  existing.offHandUsed = isCurrent ? (Number(ob.used) || 0) : 0; // not current -> not valid for now
});

// Initial render on world ready — shows the panel if a combat
// is already active when the page loads (e.g. after a reload).
Hooks.once('ready', () => {
  _renderActionPanel();
});

/* ============================================================
   PLAYER TASK REQUEST SYSTEM — v2.20.0

   Entry point for non-GM players to request multi-round task
   initiation through the combat HUD. Requests route to the GM
   via socket for approval, preserving the hidden-data privacy model.

   Key design principles (from GOAL_v2.20.0.md):
     - Hidden DC and roundsRequired remain on GM user flags only.
     - Player request contains no DC or duration — GM sets those.
     - Approval calls the existing initiateTask path (not a parallel one).
     - Request expires after 60 s if no GM responds.

   Cross-file globals (callable from task-tracker.js):
     _openGMApprovalModal(payload, validation)
     _baphHandleRequestResponse(payload)
     _removeRequestTaskOverlay()
     _removeGMApprovalModal()
     _baphSignalNextGMRequest()
   ============================================================ */

/* --- Multi-round skill registry ---
   Registry-driven: add entries here to expose new skills in future
   milestones without modifying the player dialog UI code.
   v2.20.0: Disable Device ('dev') only. */
const BAPH_MULTI_ROUND_SKILL_REGISTRY = [
  { key: 'dev', label: 'Disable Device' },
];

const BAPH_REQUEST_OVERLAY_ID = 'baph-request-task-overlay';
const BAPH_GM_APPROVAL_ID     = 'baph-gm-approval-modal';

// Single pending request state (player side only — one request at a time).
let _baphActiveRequestId    = null;
let _baphRequestExpireTimer = null;

function _clearPendingRequest() {
  if (_baphRequestExpireTimer !== null) {
    clearTimeout(_baphRequestExpireTimer);
    _baphRequestExpireTimer = null;
  }
  _baphActiveRequestId = null;
}

function _removeRequestTaskOverlay() {
  document.getElementById(BAPH_REQUEST_OVERLAY_ID)?.remove();
}

function _removeGMApprovalModal() {
  document.getElementById(BAPH_GM_APPROVAL_ID)?.remove();
}

/**
 * Look up the display label for a skill key in the registry.
 * Falls back to the raw key if not found.
 */
function _getSkillLabel(skillKey) {
  const entry = BAPH_MULTI_ROUND_SKILL_REGISTRY.find(s => s.key === skillKey);
  return entry ? entry.label : skillKey;
}

/**
 * Render the "Request Skill Task" widget for a non-GM player who
 * controls the active combatant and has no active task.
 * Mirrors _renderBeginTaskWidget structurally.
 */
function _renderRequestTaskWidget(combatant, position) {
  const widget = document.createElement('div');
  widget.id = TASK_WIDGET_ID;
  widget.classList.add('baph-task-widget', `baph-task-widget-${position}`);

  const header = document.createElement('div');
  header.classList.add('baph-task-widget-header');
  header.textContent = 'Task';
  widget.appendChild(header);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.classList.add('baph-task-widget-request-btn');
  btn.textContent = 'Request Skill Task';
  btn.title = 'Send a multi-round skill task request to the GM for approval';
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const active = game.combat?.combatant;
    if (!active || active.id !== combatant.id) {
      ui.notifications?.warn?.('You are no longer the active combatant.');
      _renderActionPanel();
      return;
    }
    _openRequestTaskDialog(combatant);
  });
  widget.appendChild(btn);

  document.body.appendChild(widget);
}

/**
 * Open the player-side task initiation dialog.
 * Collects skill (registry-driven) and description, then emits a
 * socket request to the GM. Switches to a waiting state on submit.
 */
function _openRequestTaskDialog(combatant) {
  _removeRequestTaskOverlay();

  const position = _getButtonPosition();

  const overlay = document.createElement('div');
  overlay.id = BAPH_REQUEST_OVERLAY_ID;
  overlay.classList.add('baph-request-overlay', `baph-request-overlay-${position}`);
  overlay.dataset.combatantId = combatant.id;

  // Header
  const header = document.createElement('div');
  header.classList.add('baph-request-overlay-header');
  header.textContent = 'Request Skill Task';
  overlay.appendChild(header);

  // Skill selector (single entry = read-only label; multiple = dropdown)
  const skillLineLabel = document.createElement('label');
  skillLineLabel.classList.add('baph-task-builder-field-label');
  skillLineLabel.textContent = 'Skill';
  overlay.appendChild(skillLineLabel);

  let selectedSkillKey = BAPH_MULTI_ROUND_SKILL_REGISTRY[0].key;

  if (BAPH_MULTI_ROUND_SKILL_REGISTRY.length === 1) {
    const skillDisplay = document.createElement('div');
    skillDisplay.classList.add('baph-task-builder-skill-line');
    skillDisplay.textContent = BAPH_MULTI_ROUND_SKILL_REGISTRY[0].label;
    overlay.appendChild(skillDisplay);
  } else {
    const skillSelect = document.createElement('select');
    skillSelect.classList.add('baph-task-builder-select');
    for (const { key, label } of BAPH_MULTI_ROUND_SKILL_REGISTRY) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = label;
      skillSelect.appendChild(opt);
    }
    skillSelect.addEventListener('change', () => { selectedSkillKey = skillSelect.value; });
    overlay.appendChild(skillSelect);
  }

  // Description
  const descLabel = document.createElement('label');
  descLabel.classList.add('baph-task-builder-field-label');
  descLabel.textContent = 'What are you attempting?';
  overlay.appendChild(descLabel);

  const descInput = document.createElement('textarea');
  descInput.classList.add('baph-task-builder-input', 'baph-request-textarea');
  descInput.name = 'description';
  descInput.placeholder = 'e.g. Disabling the poison-dart trap on the floor tile';
  descInput.rows = 3;
  overlay.appendChild(descInput);

  // Info text
  const infoEl = document.createElement('div');
  infoEl.classList.add('baph-request-overlay-info');
  infoEl.textContent = 'Your request will be sent to the GM for approval.';
  overlay.appendChild(infoEl);

  // Button row
  const btnRow = document.createElement('div');
  btnRow.classList.add('baph-task-builder-btn-row');

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.classList.add('baph-task-builder-btn', 'baph-task-builder-btn-confirm');
  submitBtn.textContent = 'Submit';
  submitBtn.disabled = true;

  descInput.addEventListener('input', () => {
    submitBtn.disabled = descInput.value.trim().length === 0;
  });

  submitBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    const description = descInput.value.trim();
    if (!description) return;

    // Re-validate active combatant at click time
    const active = game.combat?.combatant;
    if (!active || active.id !== combatant.id) {
      ui.notifications?.warn?.('You are no longer the active combatant.');
      _removeRequestTaskOverlay();
      _renderActionPanel();
      return;
    }
    if (!_canUserControlCombatant(active)) {
      ui.notifications?.warn?.('You do not control this combatant.');
      _removeRequestTaskOverlay();
      _renderActionPanel();
      return;
    }

    // Unique request ID (stable without requiring crypto.randomUUID)
    const requestId = `req-${game.user.id}-${Date.now()}`;

    // Switch to waiting state
    submitBtn.disabled  = true;
    submitBtn.textContent = 'Waiting…';
    descInput.disabled  = true;
    infoEl.textContent  = 'Request sent. Awaiting GM response…';

    // Track pending request and start 60 s expiry timer
    _clearPendingRequest();
    _baphActiveRequestId = requestId;
    _baphRequestExpireTimer = setTimeout(() => {
      if (_baphActiveRequestId !== requestId) return;
      _clearPendingRequest();
      _removeRequestTaskOverlay();
      _renderActionPanel();
      ui.notifications?.warn?.(
        'Task request expired — no GM responded. Try again when the GM is ready.'
      );
      _debugLog(`Request ${requestId} expired after 60 s`);
    }, 60000);

    const payload = {
      requestId,
      requestingUserId:      game.user.id,
      requestingActorId:     combatant.actor?.id ?? null,
      requestingCombatantId: combatant.id,
      skillId:               selectedSkillKey,
      description,
      timestamp:             Date.now(),
    };

    game.socket.emit(`module.${AT_MODULE_ID}`, {
      action:  'baphTaskRequest',
      payload,
    });

    _debugLog(`Task request submitted: ${requestId}`, payload);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.classList.add('baph-task-builder-btn', 'baph-task-builder-btn-cancel');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    _clearPendingRequest();
    _removeRequestTaskOverlay();
    _renderActionPanel();
  });

  btnRow.appendChild(submitBtn);
  btnRow.appendChild(cancelBtn);
  overlay.appendChild(btnRow);

  document.body.appendChild(overlay);
  setTimeout(() => descInput.focus(), 50);
}

/**
 * Open the GM approval modal for a player-submitted task request.
 * Called from task-tracker.js socket handler on GM clients.
 *
 * @param {object} payload     - The baphTaskRequest socket payload
 * @param {object} validation  - { isActiveCombatant, userName, actorName }
 */
function _openGMApprovalModal(payload, validation) {
  _removeGMApprovalModal();

  const position = _getButtonPosition();

  const modal = document.createElement('div');
  modal.id = BAPH_GM_APPROVAL_ID;
  modal.classList.add('baph-gm-approval', `baph-gm-approval-${position}`);
  modal.dataset.requestId = payload.requestId;

  // Header
  const header = document.createElement('div');
  header.classList.add('baph-gm-approval-header');
  header.textContent = 'Player Task Request';
  modal.appendChild(header);

  // Read-only request details
  const details = document.createElement('div');
  details.classList.add('baph-gm-approval-details');

  function addDetailRow(label, value) {
    const row = document.createElement('div');
    row.classList.add('baph-gm-approval-detail-row');
    const lbl = document.createElement('span');
    lbl.classList.add('baph-gm-approval-detail-label');
    lbl.textContent = `${label}: `;
    const val = document.createElement('span');
    val.classList.add('baph-gm-approval-detail-value');
    val.textContent = value;
    row.appendChild(lbl);
    row.appendChild(val);
    details.appendChild(row);
  }

  addDetailRow('Player',    validation.userName  ?? 'Unknown');
  addDetailRow('Character', validation.actorName ?? 'Unknown');
  addDetailRow('Skill',     _getSkillLabel(payload.skillId));
  addDetailRow(
    'Active turn',
    validation.isActiveCombatant ? 'Yes — active turn' : 'No — turn has changed'
  );

  const descLabel = document.createElement('div');
  descLabel.classList.add('baph-task-builder-field-label');
  descLabel.textContent = 'Description:';
  details.appendChild(descLabel);

  const descText = document.createElement('div');
  descText.classList.add('baph-gm-approval-description');
  descText.textContent = payload.description ?? '(none)';
  details.appendChild(descText);

  modal.appendChild(details);

  // GM-only section divider
  const divider = document.createElement('div');
  divider.classList.add('baph-gm-approval-divider');
  divider.textContent = '─── GM Settings (hidden from player) ───';
  modal.appendChild(divider);

  // Difficulty preset
  const diffLabel = document.createElement('label');
  diffLabel.classList.add('baph-task-builder-field-label');
  diffLabel.textContent = 'Difficulty Preset';
  modal.appendChild(diffLabel);

  const diffSelect = document.createElement('select');
  diffSelect.classList.add('baph-task-builder-select');
  [
    { value: 'simple',    label: 'Simple trap — 1d4 rounds' },
    { value: 'difficult', label: 'Difficult trap — 2d4 rounds' },
    { value: 'custom',    label: 'Custom / Manual' },
  ].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    diffSelect.appendChild(opt);
  });
  modal.appendChild(diffSelect);

  // Rounds Required row (input + roll button)
  const roundsLabel = document.createElement('label');
  roundsLabel.classList.add('baph-task-builder-field-label');
  roundsLabel.textContent = 'Rounds Required';
  modal.appendChild(roundsLabel);

  const roundsRow = document.createElement('div');
  roundsRow.classList.add('baph-gm-approval-inline-row');

  const roundsInput = document.createElement('input');
  roundsInput.type = 'number';
  roundsInput.classList.add('baph-task-builder-input', 'baph-task-builder-input-num');
  roundsInput.name = 'roundsRequired';
  roundsInput.min  = '1';
  roundsInput.step = '1';
  roundsInput.value = '2';
  roundsRow.appendChild(roundsInput);

  const rollBtn = document.createElement('button');
  rollBtn.type = 'button';
  rollBtn.classList.add('baph-gm-approval-roll-btn');
  rollBtn.textContent = '🎲 Roll';
  rollBtn.title = 'Roll the selected difficulty preset';
  rollBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const mode = diffSelect.value;
    if (mode === 'simple') {
      roundsInput.value = Math.floor(Math.random() * 4) + 1;
    } else if (mode === 'difficult') {
      roundsInput.value = (Math.floor(Math.random() * 4) + 1)
                        + (Math.floor(Math.random() * 4) + 1);
    } else {
      roundsInput.value = parseInt(roundsInput.value, 10) || 2;
    }
  });
  roundsRow.appendChild(rollBtn);
  modal.appendChild(roundsRow);

  // Auto-roll when a preset is selected (except custom)
  diffSelect.addEventListener('change', () => {
    const mode = diffSelect.value;
    if (mode === 'simple') {
      roundsInput.value = Math.floor(Math.random() * 4) + 1;
    } else if (mode === 'difficult') {
      roundsInput.value = (Math.floor(Math.random() * 4) + 1)
                        + (Math.floor(Math.random() * 4) + 1);
    }
  });

  // Resolution DC
  const dcLabel = document.createElement('label');
  dcLabel.classList.add('baph-task-builder-field-label');
  dcLabel.textContent = 'Resolution DC';
  modal.appendChild(dcLabel);

  const dcInput = document.createElement('input');
  dcInput.type  = 'number';
  dcInput.classList.add('baph-task-builder-input', 'baph-task-builder-input-num');
  dcInput.name  = 'dc';
  dcInput.min   = '1';
  dcInput.step  = '1';
  dcInput.value = '20';
  modal.appendChild(dcInput);

  // Button row
  const btnRow = document.createElement('div');
  btnRow.classList.add('baph-task-builder-btn-row');

  const approveBtn = document.createElement('button');
  approveBtn.type = 'button';
  approveBtn.classList.add('baph-task-builder-btn', 'baph-task-builder-btn-confirm');
  approveBtn.textContent = 'Approve';
  if (!validation.isActiveCombatant) {
    approveBtn.disabled = true;
    approveBtn.title = 'Cannot approve: this combatant is no longer the active turn.';
  }

  approveBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Re-validate at click time
    const combatant = game.combat?.combatants.get(payload.requestingCombatantId);
    if (!combatant) {
      ui.notifications?.warn?.('Combatant no longer exists — cannot approve.');
      _removeGMApprovalModal();
      _baphSignalNextGMRequest();
      return;
    }
    if (combatant.id !== game.combat?.combatant?.id) {
      ui.notifications?.warn?.('Combatant is no longer the active turn — cannot approve.');
      approveBtn.disabled = true;
      approveBtn.title = 'Cannot approve: turn has advanced.';
      return;
    }

    const roundsRaw = parseInt(roundsInput.value, 10);
    const dcRaw     = parseInt(dcInput.value, 10);
    if (!Number.isFinite(roundsRaw) || roundsRaw < 1) {
      ui.notifications?.warn?.('Rounds Required must be a positive integer.');
      roundsInput.focus();
      return;
    }
    if (!Number.isFinite(dcRaw) || dcRaw < 1) {
      ui.notifications?.warn?.('Resolution DC must be a positive integer.');
      dcInput.focus();
      return;
    }

    _removeGMApprovalModal();

    if (!game.baphometTasks) {
      ui.notifications?.warn?.('Task system not ready.');
      _baphSignalNextGMRequest();
      return;
    }

    // Use the player's description as the task name; initiateTask handles action spend,
    // flag writes, and chat message exactly as the GM task builder does.
    const taskId = await game.baphometTasks.initiateTask(combatant, {
      taskName:       payload.description ?? 'Skill Task',
      taskAction:     'disable',
      roundsRequired: roundsRaw,
      dc:             dcRaw,
    });

    game.socket.emit(`module.${AT_MODULE_ID}`, {
      action:  'baphTaskRequestResponse',
      payload: {
        requestId:    payload.requestId,
        approved:     taskId !== false,
        reason:       taskId !== false ? null : 'Task initiation failed.',
        taskId:       taskId !== false ? taskId : null,
        targetUserId: payload.requestingUserId,
      },
    });

    _debugLog(
      `GM approved task request ${payload.requestId}: ` +
      `taskId=${taskId}, combatant=${combatant.name}`
    );

    _baphSignalNextGMRequest();
    _renderActionPanel();
  });

  const rejectBtn = document.createElement('button');
  rejectBtn.type = 'button';
  rejectBtn.classList.add('baph-task-builder-btn', 'baph-task-builder-btn-cancel');
  rejectBtn.textContent = 'Reject';

  rejectBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    _removeGMApprovalModal();

    // Whisper rejection notice to the requesting player
    const requestingUser = game.users.get(payload.requestingUserId);
    const skillLabel = _getSkillLabel(payload.skillId);
    await ChatMessage.create({
      content:
        `<p><strong>Task Request Declined.</strong></p>` +
        `<p>Your <em>${skillLabel}</em> task request was declined by the GM. ` +
        `Try a different approach or wait for a better moment.</p>`,
      speaker: { alias: 'Baphomet Tasks' },
      whisper: requestingUser ? [requestingUser.id] : [],
    });

    game.socket.emit(`module.${AT_MODULE_ID}`, {
      action:  'baphTaskRequestResponse',
      payload: {
        requestId:    payload.requestId,
        approved:     false,
        reason:       'GM declined',
        taskId:       null,
        targetUserId: payload.requestingUserId,
      },
    });

    _debugLog(`GM rejected task request ${payload.requestId}`);
    _baphSignalNextGMRequest();
  });

  btnRow.appendChild(approveBtn);
  btnRow.appendChild(rejectBtn);
  modal.appendChild(btnRow);

  document.body.appendChild(modal);
}

/**
 * Handle a baphTaskRequestResponse on the requesting player's client.
 * Clears the pending timer, closes the overlay, and notifies the player.
 * Called from the task-tracker.js socket handler.
 */
function _baphHandleRequestResponse(payload) {
  const { requestId, approved, reason, targetUserId } = payload;

  // Only the targeted user processes this response
  if (targetUserId && targetUserId !== game.user.id) return;

  // Ensure this matches the currently pending request
  if (requestId !== _baphActiveRequestId) {
    _debugLog(`baphTaskRequestResponse: requestId mismatch — ignoring (got ${requestId})`);
    return;
  }

  _clearPendingRequest();
  _removeRequestTaskOverlay();

  if (approved) {
    ui.notifications?.info?.(
      'GM approved — your task has begun. Check the task widget for progress.'
    );
    _debugLog(`Task request ${requestId} approved`);
  } else {
    ui.notifications?.warn?.(
      `GM declined: ${reason ?? 'no reason given'}.`
    );
    _debugLog(`Task request ${requestId} rejected: ${reason}`);
  }

  _renderActionPanel();
}

/**
 * Signal that the GM approval modal was closed (approve or reject).
 * Calls _baphProcessNextGMRequest in task-tracker.js if available.
 * Guard: noop if called before task-tracker.js has loaded.
 */
function _baphSignalNextGMRequest() {
  if (typeof _baphProcessNextGMRequest === 'function') {
    _baphProcessNextGMRequest();
  }
}

/* ============================================================
   PF1.5 STRIKE GUARD DIAGNOSTICS — v1.17
   ══════════════════════════════════════════════════════════

   Observer-only diagnostics. NOTHING HERE changes gameplay.
   No pips are spent, no controls are hidden, no actions cancelled.

   Purpose: confirm PF1 full-attack UI selectors and ActionUse
   payload shape before implementing full-attack suppression in
   v2.14.0. All output is gated behind the debugLogging setting.

   Four surfaces:
     1. renderActorSheetPFCharacter — actor sheet attack controls
     2. pf1RenderQuickActions       — token HUD quick-action controls
     3. renderApplication /         — AttackDialog (V1 or V2)
        renderApplicationV2
     4. pf1PreActionUse             — ActionUse payload shape
   ============================================================ */

/* ----------------------------------------------------------
   SHARED DIAGNOSTIC HELPER
   Summarises one interactive element into a compact object.
   Never throws. Never reads .data or deprecated PF1 paths.
   ---------------------------------------------------------- */

function _diagSummariseElement(el) {
  const s = {};
  try { s.tag          = el.tagName?.toLowerCase() ?? null; } catch { s.tag = null; }
  try { s.text         = el.textContent?.trim().slice(0, 80) ?? null; } catch { s.text = null; }
  try { s.className    = el.className ?? null; } catch { s.className = null; }
  try { s.name         = el.name ?? null; } catch { s.name = null; }
  try { s.type         = el.type ?? null; } catch { s.type = null; }
  try { s.value        = el.value ?? null; } catch { s.value = null; }
  try { s.title        = el.title ?? null; } catch { s.title = null; }
  try { s.ariaLabel    = el.getAttribute?.('aria-label') ?? null; } catch { s.ariaLabel = null; }
  // dataset: copy to plain object; skip any key whose value is huge
  try {
    const ds = {};
    for (const [k, v] of Object.entries(el.dataset ?? {})) {
      ds[k] = String(v).slice(0, 120);
    }
    s.dataset = ds;
  } catch { s.dataset = null; }
  return s;
}

/**
 * Test whether an element summary is likely related to attacks or
 * full-attack controls. Used to highlight candidates in log output.
 */
function _diagIsAttackCandidate(summary) {
  const TERMS = ['attack', 'full', 'fullattack', 'iterative', 'multiple', 'swing'];
  const fields = [
    summary.text,
    summary.className,
    summary.name,
    summary.title,
    summary.ariaLabel,
    summary.value,
    ...Object.values(summary.dataset ?? {})
  ];
  return fields.some(f =>
    typeof f === 'string' &&
    TERMS.some(t => f.toLowerCase().includes(t))
  );
}

/**
 * Summarise all interactive elements inside a root node.
 * Queries: button, a, input, select, [data-action], [data-tooltip].
 * Returns { all, candidates } where candidates are attack-related.
 *
 * root must support querySelectorAll (HTMLElement or DocumentFragment).
 */
function _diagScanElements(root) {
  const all = [];
  const candidates = [];
  try {
    const els = root.querySelectorAll(
      'button, a, input, select, [data-action], [data-tooltip]'
    );
    for (const el of els) {
      const s = _diagSummariseElement(el);
      all.push(s);
      if (_diagIsAttackCandidate(s)) candidates.push(s);
    }
  } catch { /* noop */ }
  return { all, candidates };
}

/**
 * Normalise a diagnostic hook's root argument to HTMLElement or
 * DocumentFragment. Accepts: HTMLElement, DocumentFragment, jQuery
 * wrapper, or an array-like wrapper whose [0] is one of those.
 *
 * jQuery is guarded with globalThis.jQuery before instanceof so
 * the code does not throw in environments without jQuery.
 *
 * Returns null if none of the known shapes match.
 *
 * @param {*} input
 * @returns {HTMLElement|DocumentFragment|null}
 */
function _diagNormalizeRoot(input) {
  if (!input) return null;
  // Direct HTMLElement or DocumentFragment
  if (input instanceof HTMLElement || input instanceof DocumentFragment) return input;
  // jQuery wrapper
  if (globalThis.jQuery && input instanceof globalThis.jQuery) {
    const el = input[0];
    return (el instanceof HTMLElement || el instanceof DocumentFragment) ? el : null;
  }
  // Generic array-like wrapper (e.g. V1 compat shims)
  const first = input?.[0];
  if (first instanceof HTMLElement || first instanceof DocumentFragment) return first;
  return null;
}

/**
 * Safely stringify a diagnostic summary to a compact, copy-friendly
 * JSON string. Since all diagnostic summaries are already plain
 * objects with no circular refs, JSON.stringify is sufficient, but
 * the try/catch ensures nothing throws if that assumption is wrong.
 *
 * @param {*} value
 * @returns {string}
 */
function _diagStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return `[unstringifiable diagnostic summary: ${err?.message ?? String(err)}]`;
  }
}

/* ----------------------------------------------------------
   DIAGNOSTIC 1 — renderActorSheetPFCharacter

   PF1 actor sheets are ApplicationV2. element is documented as
   HTMLElement but live testing showed a wrapper being passed.
   _diagNormalizeRoot handles HTMLElement, DocumentFragment,
   jQuery wrapper, and generic array-like wrappers.

   Goal: identify which button/element represents the full-attack
   control on a weapon row, so v2.14.0 can hide it safely.

   Does NOT modify the sheet DOM.
   ---------------------------------------------------------- */

Hooks.on('renderActorSheetPFCharacter', (sheet, element, context) => {
  if (!game.settings.get?.(AT_MODULE_ID, 'debugLogging')) return;

  const rawConstructor = element?.constructor?.name ?? 'unknown';
  const root = _diagNormalizeRoot(element);
  if (!root) {
    _debugLog(
      '[DIAG] renderActorSheetPFCharacter: could not normalize element to HTMLElement/DocumentFragment',
      { rawConstructor, element }
    );
    return;
  }

  const actor = sheet?.actor;
  const { all, candidates } = _diagScanElements(root);

  const summary = {
    actorName:           actor?.name ?? null,
    actorType:           actor?.type ?? null,
    sheetConstructor:    sheet?.constructor?.name ?? null,
    rawElementConstructor: rawConstructor,
    normalizedConstructor: root?.constructor?.name ?? null,
    totalInteractiveElements: all.length,
    attackCandidates:    candidates,
    allElements:         all
  };

  _debugLog('[DIAG] renderActorSheetPFCharacter controls:', summary);
  _debugLog('[DIAG] renderActorSheetPFCharacter controls JSON:', _diagStringify(summary));
});

/* ----------------------------------------------------------
   DIAGNOSTIC 2 — pf1RenderQuickActions

   Confirmed hook: pf1RenderQuickActions(hud, token, template)
   template is a DocumentFragment. DocumentFragment supports
   querySelectorAll directly — no coercion needed.

   Goal: confirm whether PF1 quick actions include a full-attack
   button distinct from the single-attack button.

   Does NOT modify the template.
   ---------------------------------------------------------- */

Hooks.on('pf1RenderQuickActions', (hud, token, template) => {
  if (!game.settings.get?.(AT_MODULE_ID, 'debugLogging')) return;

  const rawConstructor = template?.constructor?.name ?? 'unknown';
  const root = _diagNormalizeRoot(template);
  if (!root) {
    _debugLog('[DIAG] pf1RenderQuickActions: could not normalize template',
      { rawConstructor });
    return;
  }

  const { all, candidates } = _diagScanElements(root);

  const summary = {
    tokenName:            token?.name ?? token?.document?.name ?? null,
    actorName:            token?.actor?.name ?? null,
    rawTemplateConstructor: rawConstructor,
    normalizedConstructor:  root?.constructor?.name ?? null,
    totalElements:        all.length,
    attackCandidates:     candidates,
    allElements:          all
  };

  _debugLog('[DIAG] pf1RenderQuickActions controls:', summary);
  _debugLog('[DIAG] pf1RenderQuickActions controls JSON:', _diagStringify(summary));
});

/* ----------------------------------------------------------
   DIAGNOSTIC 3 — AttackDialog render

   AttackDialog's V1 vs. V2 status is unconfirmed. Three hooks
   registered to maximise capture chance:
     - renderApplicationV1 (generic V1 catch, filtered by name)
     - renderApplicationV2 (generic V2 catch, filtered by name)
     - renderAttackDialog  (targeted — fires if PF1 uses this
                           exact class name for the dialog)

   All three call _diagHandleAttackDialogRender which uses
   _diagNormalizeRoot (same coercion as other diagnostics).

   Does NOT modify the dialog.
   ---------------------------------------------------------- */

function _diagHandleAttackDialogRender(app, element) {
  const name = app?.constructor?.name ?? '';
  // Filter to only AttackDialog or anything 'Attack' in the name.
  // Intentionally broad since the exact class name is unconfirmed.
  if (!name.toLowerCase().includes('attack')) return;

  // Normalize root unconditionally — both suppression and diagnostics
  // need it, and suppression runs regardless of debugLogging state.
  const rawConstructor = element?.constructor?.name ?? 'unknown';
  const root = _diagNormalizeRoot(element);
  if (!root) {
    _debugLog('[DIAG] AttackDialog: could not normalize element',
      { appConstructor: name, rawElementConstructor: rawConstructor });
    return;
  }

  /* ----------------------------------------------------------
     PF1.5 FULL ATTACK SUPPRESSION
     MODULE DESIGN PATTERN — NOT NATIVE PF1

     Confirmed selector from v2.13.5 live diagnostics:
       button[name="attack_full"]   -> Full Attack button (remove only
                                      when attack_single is also present)
       button[name="attack_single"] -> Single Attack button (leave)

     PF1 reuses name="attack_full" for the generic "Use" submit
     button on non-attack spell/action dialogs. Save/template spells
     such as Fireball and Burning Hands need that button to create
     their normal chat card, so never remove attack_full by itself.

     Runs whenever pf15ModeEnabled is true, independent of
     debug logging. Fails silently if the setting is not yet
     registered or the button is not present.
     ---------------------------------------------------------- */
  try {
    if (game.settings.get?.(AT_MODULE_ID, 'pf15ModeEnabled')) {
      const singleAttackBtn = root.querySelector('button[name="attack_single"]');
      const fullAttackBtn = root.querySelector('button[name="attack_full"]');
      if (singleAttackBtn && fullAttackBtn) {
        fullAttackBtn.remove();
        _debugLog('PF1.5 mode: removed Full Attack button from AttackDialog');
      }
    }
  } catch { /* settings not yet registered or other safe failure — noop */ }

  /* ----------------------------------------------------------
     v1.25: AoO (Combat Reflexes) checkbox in the Miscellaneous row.
     Injected only when the acting actor has the feat. Its state bridges
     to pf1PreActionUse via globalThis.baphometAoO so a flagged off-turn
     attack spends a green jade pip (see spendCombatReflex + the off-turn
     branch). Runs regardless of debugLogging, like the suppression above.
     ---------------------------------------------------------- */
  try {
    const aooActor = app.actor;
    const hasCR = !!aooActor?.items?.some(i => i.type === 'feat' && (i.name || '').toLowerCase().includes('combat reflexes'));
    const flagsGroup = root.querySelector('.form-group.stacked.flags');
    if (hasCR && flagsGroup && !flagsGroup.querySelector('.baph-aoo-cb')) {
      globalThis.baphometAoO = { active: false, actorId: aooActor.id };  // reset stale flag per dialog open
      const label = document.createElement('label');
      label.classList.add('checkbox');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.classList.add('baph-aoo-cb');
      cb.addEventListener('change', () => { globalThis.baphometAoO = { active: cb.checked, actorId: aooActor.id }; });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' AoO (Combat Reflexes)'));
      flagsGroup.appendChild(label);
    }
  } catch(err) { _debugLog('AoO checkbox injection failed', err); }

  /* ----------------------------------------------------------
     DIAGNOSTIC LOGGING — debug-gated
     ---------------------------------------------------------- */
  if (!game.settings.get?.(AT_MODULE_ID, 'debugLogging')) return;

  // Scan after suppression so the log reflects what the player sees.
  const { all, candidates } = _diagScanElements(root);

  const summary = {
    appConstructor:         name,
    rawElementConstructor:  rawConstructor,
    normalizedConstructor:  root?.constructor?.name ?? null,
    pf15ModeEnabled:        (() => { try { return game.settings.get?.(AT_MODULE_ID, 'pf15ModeEnabled') ?? null; } catch { return null; } })(),
    totalElements:          all.length,
    attackCandidates:       candidates,
    allElements:            all
  };

  _debugLog('[DIAG] AttackDialog controls:', summary);
  _debugLog('[DIAG] AttackDialog controls JSON:', _diagStringify(summary));
}

// V1-era application render hook (confirmed Foundry v13 hook name)
Hooks.on('renderApplicationV1', (app, html, data) => {
  _diagHandleAttackDialogRender(app, html);
});

// V2-era application render hook (confirmed Foundry v13 hook name)
Hooks.on('renderApplicationV2', (app, element, context) => {
  _diagHandleAttackDialogRender(app, element);
});

// Targeted hook — fires only if PF1 names the dialog 'AttackDialog'.
// The constructor-name filter inside _diagHandleAttackDialogRender
// still applies as a belt-and-suspenders guard.
// If this hook name is wrong it registers silently and never fires.
Hooks.on('renderAttackDialog', (app, element, context) => {
  _diagHandleAttackDialogRender(app, element);
});

/* ----------------------------------------------------------
   DIAGNOSTIC 4 — pf1PreActionUse payload

   Confirmed cancellable hook: pf1PreActionUse(actionUse)
   Argument is a single ActionUse instance.

   THIS HANDLER NEVER RETURNS FALSE. It is observer-only.
   Returning false would cancel the action — do not do that
   until full-attack suppression is deliberately implemented.

   Goal: log the shape of ActionUse to confirm:
   - actor access path
   - item access path
   - whether actionUse.isFullAttack / fullAttack / action.fullAttack exist
   - activation and rollMode fields
   - any field that could distinguish a single Strike from a full attack

   All probing uses safe optional chaining. No .data access.
   ---------------------------------------------------------- */

Hooks.on('pf1PreActionUse', (actionUse) => {
  if (!game.settings.get?.(AT_MODULE_ID, 'debugLogging')) return;

  // Build a structured summary without deep-traversing circular objects.
  const summary = {};

  try { summary.constructorName = actionUse?.constructor?.name ?? null; } catch { summary.constructorName = null; }

  // Own enumerable keys (shallow — avoids circular refs)
  try {
    summary.ownKeys = Object.keys(actionUse ?? {}).slice(0, 40);
  } catch { summary.ownKeys = ['[unavailable]']; }

  // Actor
  try {
    const a = actionUse?.actor;
    summary.actorName = a?.name ?? null;
    summary.actorId   = a?.id   ?? null;
    summary.actorType = a?.type ?? null;
  } catch { /* noop */ }

  // Item
  try {
    const i = actionUse?.item;
    summary.itemName = i?.name ?? null;
    summary.itemId   = i?.id   ?? null;
    summary.itemType = i?.type ?? null;
  } catch { /* noop */ }

  // Action (the specific ItemAction being used)
  try {
    const ac = actionUse?.action;
    summary.actionName        = ac?.name ?? null;
    summary.actionId          = ac?.id   ?? null;
    summary.actionConstructor = ac?.constructor?.name ?? null;
    // Shallow keys of the action object — do not expand sub-objects
    summary.actionKeys = ac ? Object.keys(ac).slice(0, 30) : null;
  } catch { summary.actionKeys = null; }

  // Possible full-attack / attack flags — probe common field names
  // without assuming any of them exist. Null = not present.
  try {
    summary.possibleFullAttackFlags = {
      'actionUse.isFullAttack':         actionUse?.isFullAttack          ?? null,
      'actionUse.fullAttack':           actionUse?.fullAttack            ?? null,
      'actionUse.action?.fullAttack':   actionUse?.action?.fullAttack    ?? null,
      'actionUse.action?.isFullAttack': actionUse?.action?.isFullAttack  ?? null,
      'actionUse.action?.type':         actionUse?.action?.type          ?? null,
      'actionUse.options?.fullAttack':  actionUse?.options?.fullAttack   ?? null,
      'actionUse.config?.fullAttack':   actionUse?.config?.fullAttack    ?? null
    };
  } catch { summary.possibleFullAttackFlags = null; }

  // Activation data — may carry action type / cost info
  try {
    const act = actionUse?.action?.activation ?? actionUse?.activation;
    summary.possibleActivationData = act
      ? {
          type:  act?.type  ?? null,
          cost:  act?.cost  ?? null,
          cond:  act?.cond  ?? null,
          keys: Object.keys(act).slice(0, 20)
        }
      : null;
  } catch { summary.possibleActivationData = null; }

  // Roll mode / shared data
  try {
    summary.possibleRollModeData = {
      'actionUse.rollMode':    actionUse?.rollMode    ?? null,
      'actionUse.options?.rollMode': actionUse?.options?.rollMode ?? null,
      'actionUse.shared':      actionUse?.shared ? '[present]' : null
    };
  } catch { summary.possibleRollModeData = null; }

  // Config / options keys
  try {
    summary.configKeys  = actionUse?.config  ? Object.keys(actionUse.config).slice(0, 20)  : null;
    summary.optionsKeys = actionUse?.options ? Object.keys(actionUse.options).slice(0, 20) : null;
  } catch { /* noop */ }

  _debugLog('[DIAG] pf1PreActionUse summary:', summary);
  _debugLog('[DIAG] pf1PreActionUse summary JSON:', _diagStringify(summary));

  // IMPORTANT: do NOT return false here.
  // Returning false would cancel the action use.
  // Full-attack suppression in v2.14.0 is implemented via the
  // AttackDialog render hook, not by cancelling pf1PreActionUse.
  // Do not add cancellation here without a deliberate decision.
});
