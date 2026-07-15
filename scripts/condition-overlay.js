/* ============================================================
   ECHOES OF BAPHOMET — PF1.5 CONDITION OVERLAY v2.8
   Applies PF2e-style conditions as PF1e system Buffs.

   v2.8 Changes (GOAL_v2.34.0_CONDITION_CANON — "The Single Tally"):
   - [MECH-3] Removed the `staggered` CONDITIONS entry entirely. Canon
     (SS5 "Folded / Retired Conditions") forbids a live tracked Staggered
     condition — PF1 Staggered folds into Slowed 1 at the point of
     application. No automated conversion path existed (GM-selected UI
     toggle only), so this is a clean removal, not a redirect.
   - [Stunned countdown] Added a genuine, persisted Stunned countdown
     lifecycle, distinct from the Stunned buff's own `tier` flag (see the
     "STUNNED COUNTDOWN LIFECYCLE" comment block near
     `_decrementStunnedCountdown` below for the full flag shape and
     decrement mechanics, and action-tracker.js's `_readConditionActionLoss`
     for the read side). Handles the round-4 mid-turn-application-skip
     case (SS5:224 "starting NEXT turn") via a proactive breadcrumb read
     rather than re-deriving the departing combatant reactively.
   - [Prior-combatant identification — architecture change] `_getPriorCombatantId`
     (which read `combat.current.turn`/`updateData.turn`, then in a disproven
     fix attempt `combat.combatant`) is REMOVED. Both were reactive reads at
     `combatTurn`/`combatRound`/`pf1PostTurnChange` hook-fire time and both
     were disproven by live two-seat re-verification — Foundry combat-state
     propagation is not guaranteed settled at that exact moment in this
     environment. Replaced with `_getBreadcrumbCombatant`, which reads
     `globalThis.baphometActiveCombatant` — a value STAMPED proactively by
     action-tracker.js's render-based turn-start detection (a point already
     proven safe; see that file's header comment on
     `_stampActiveCombatantBreadcrumb`), not re-derived at hook-fire time.
     Fail-safe: returns null (no decrement performed) if the breadcrumb is
     missing or belongs to a different combat, rather than guessing.
   - [TRUST-4] `_handleAutoDecrement`'s gate changed from bare
     `game.user.isGM` (true for every connected GM-role client
     simultaneously) to `_isActiveGMClient()` — mirrors
     `task-tracker.js`'s `_baphTaskIsActiveGMClient()` pattern
     (`game.user?.isGM && game.user === game.users?.activeGM`). Prevents
     two connected GM-role clients from each independently decrementing
     the same turn transition.

   v2.7 Changes:
   - [BUG FIX] Turn/round hooks (combatTurn, combatRound) could
     throw "Cannot read properties of undefined (reading 'length')"
     during a transient state where combat.turns is briefly
     undefined or empty — observed with monks-combat-details
     triggering initiative re-rolls on round advance. Added
     Array.isArray + length guards in _getPriorCombatantId and
     in the combatRound handler before any turns[] access.

   v2.7.1 Changes:
   - [SECURITY] _postConditionChat: actor.name is now escaped with
     foundry.utils.escapeHTML() before interpolation into chat HTML.
     Previously raw, allowing a maliciously-named actor to inject
     arbitrary HTML into condition notification messages.

   v2.6 Changes:
   - [LEAK FIX] Token HUD condition panel's MutationObserver was
     created on each open as a closure-local variable. Manual
     close (clicking the button again) removed the panel but
     did NOT disconnect the observer — it would linger until
     the HUD itself mutated. Hoisted the observer reference to
     the outer scope so both manual-close and HUD-mediated-close
     paths can disconnect cleanly.
   - [HARDENING] DOM normalization for the renderTokenHUD hook
     now uses the shared _baphNormalizeHtml helper
     (scripts/dom-utils.js) instead of an inline guard.

   v2.5 Changes:
   - [BUG FIX] Auto-decrement (Frightened, Stunned) was not
     firing on turn advance. Root cause: pf1PostTurnChange hook
     may not fire reliably in all PF1e v13 builds, AND the
     combatTurn fallback had a guard that skipped it whenever
     pf1PostTurnChange had any listeners registered.
   
   - New approach: Use Foundry core hooks (combatTurn, combatRound)
     as PRIMARY triggers. pf1PostTurnChange kept as secondary.
     Debounce flag prevents double-decrements if multiple hooks
     fire for the same turn change.
   
   - Added console logging for all auto-decrement events.

   v2.5.1 Changes:
   - Clamp helper: use Math.clamp (the Foundry v13 helper). NOTE: an earlier
     note here had this backwards — Math.clamped is deprecated (since v12) and
     removed in v14, so Math.clamp is the correct, forward-compatible call.

   TIERED (1-4):  Frightened, Sickened, Stupefied, Clumsy,
                  Enfeebled, Drained, Stunned, Slowed, Fascinated
   TOGGLE (on/off): Fatigued, Off-Guard, Persistent Damage,
                    Blinded, Deafened, Nauseated, Confused,
                    Paralyzed
   (Staggered is NOT a live tracked condition — SS5 folds it into Slowed 1
   at the point of application; see v2.8 Changes above, MECH-3.)

   For Foundry VTT v13 + PF1e System
   Source: Homebrew_Master_File.md § Simplified Conditions
   ============================================================ */

const MODULE_ID = 'baphomet-utils';

/* ----------------------------------------------------------
   CORRUPTED EDGE SVG FILTER INJECTION
   ---------------------------------------------------------- */

function _injectCorruptedEdgeFilter() {
  if (document.getElementById('baph-corrupted-edge')) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'baph-svg-filters');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
  svg.setAttribute('aria-hidden', 'true');

  svg.innerHTML = `
    <defs>
      <filter id="baph-corrupted-edge" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="linearRGB">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.065 0.12"
          numOctaves="3"
          seed="7"
          stitchTiles="stitch"
          result="noise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale="3.5"
          xChannelSelector="R"
          yChannelSelector="G"
          result="displaced"
        />
      </filter>
    </defs>
  `;

  document.body.appendChild(svg);
}

/* ----------------------------------------------------------
   CONDITION DEFINITIONS
   ---------------------------------------------------------- */

const CONDITIONS = {

  // ======== TIERED CONDITIONS (value 1–4) ========

  frightened: {
    name: 'Frightened',
    icon: 'icons/svg/terror.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to attack rolls, saving throws, skill checks, and ability checks. Decreases by 1 at end of your turn.',
    autoDecrement: true,
    buildChanges(tier) {
      const v = String(-tier);
      return [
        { formula: v, operator: 'add', target: 'attack',         modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'allSavingThrows', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'skills',         modifier: 'penalty', priority: 0 },
      ];
    }
  },

  sickened: {
    name: 'Sickened',
    icon: 'icons/svg/poison.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to attack rolls, weapon damage, saving throws, skill checks, and ability checks. Cannot eat or drink (including potions). Spend 1 action to Retch (Fort save vs. source DC) to reduce by 1.',
    autoDecrement: false,
    buildChanges(tier) {
      const v = String(-tier);
      return [
        { formula: v, operator: 'add', target: 'attack',         modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'damage',         modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'allSavingThrows', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'skills',         modifier: 'penalty', priority: 0 },
      ];
    }
  },

  stupefied: {
    name: 'Stupefied',
    icon: 'icons/svg/daze.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to INT/WIS/CHA-based rolls, spell DCs, and Will saves. Casting a spell requires a DC (5 + X) flat check or it fails.',
    autoDecrement: false,
    buildChanges(tier) {
      const v = String(-tier);
      return [
        { formula: v, operator: 'add', target: 'int', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'wis', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'cha', modifier: 'penalty', priority: 0 },
      ];
    }
  },

  clumsy: {
    name: 'Clumsy',
    icon: 'icons/svg/falling.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to DEX-based attack rolls, Reflex saves, DEX-based skill checks, and AC.',
    autoDecrement: false,
    buildChanges(tier) {
      const v = String(-tier);
      return [
        { formula: v, operator: 'add', target: 'dex', modifier: 'penalty', priority: 0 },
      ];
    }
  },

  enfeebled: {
    name: 'Enfeebled',
    icon: 'icons/svg/downgrade.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to STR-based attack rolls, damage rolls, Fortitude saves, STR-based skill checks, and carrying capacity.',
    autoDecrement: false,
    buildChanges(tier) {
      const v = String(-tier);
      return [
        { formula: v, operator: 'add', target: 'str', modifier: 'penalty', priority: 0 },
      ];
    }
  },

  drained: {
    name: 'Drained',
    icon: 'icons/svg/blood.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to CON-based checks, Fortitude saves, and Max HP reduced by X × character level. Decreases by 1 after a full night\'s rest.',
    autoDecrement: false,
    buildChanges(tier) {
      const v = String(-tier);
      return [
        { formula: v, operator: 'add', target: 'con', modifier: 'penalty', priority: 0 },
      ];
    }
  },

  stunned: {
    name: 'Stunned',
    icon: 'icons/svg/stoned.svg',
    maxTier: 4,
    type: 'tiered',
    description: 'You lose X actions on your next turn. If Stunned exceeds 3, excess carries over to subsequent turns.',
    // v2.34.0: `autoDecrement: true` still marks this as an auto-decrementing condition for
    // the token HUD's "↓" indicator, but `_handleAutoDecrement` skips 'stunned' in its
    // generic per-tier -1 loop — the real decrement is the bespoke, multi-action
    // `_decrementStunnedCountdown` (see that function's comment block below), driven by the
    // separate `stunnedCountdown` actor flag, not this buff's own `tier`.
    autoDecrement: true,
    buildChanges(_tier) {
      return [];
    }
  },

  slowed: {
    name: 'Slowed',
    icon: 'icons/svg/clockwork.svg',
    maxTier: 3,
    type: 'tiered',
    description: 'You lose X actions at the start of each turn (persistent while condition lasts). Does not decrease automatically.',
    autoDecrement: false,
    buildChanges(_tier) {
      return [];
    }
  },

  fascinated: {
    name: 'Fascinated',
    icon: 'icons/svg/eye.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to Perception and skill checks. Cannot use Concentrate actions except to investigate the source of fascination.',
    autoDecrement: false,
    buildChanges(tier) {
      const v = String(-tier);
      return [
        { formula: v, operator: 'add', target: 'skill.per', modifier: 'penalty', priority: 0 },
        { formula: v, operator: 'add', target: 'skills',    modifier: 'penalty', priority: 0 },
      ];
    }
  },

  // ======== TOGGLE CONDITIONS (on/off, no tiers) ========

  fatigued: {
    name: 'Fatigued',
    icon: 'icons/svg/unconscious.svg',
    maxTier: 1,
    type: 'toggle',
    description: '–1 penalty to AC and all saving throws. Cannot run or charge. Cannot use Exploration activities during travel.',
    autoDecrement: false,
    buildChanges() {
      return [
        { formula: '-1', operator: 'add', target: 'ac',              modifier: 'penalty', priority: 0 },
        { formula: '-1', operator: 'add', target: 'allSavingThrows', modifier: 'penalty', priority: 0 },
      ];
    }
  },

  offGuard: {
    name: 'Off-Guard',
    icon: 'icons/svg/target.svg',
    maxTier: 1,
    type: 'toggle',
    description: '–2 circumstance penalty to AC. (Formerly Flat-Footed.) Applied by flanking, surprise, or other conditions.',
    autoDecrement: false,
    buildChanges() {
      return [
        { formula: '-2', operator: 'add', target: 'ac', modifier: 'untyped', priority: 0 },
      ];
    }
  },

  persistentDamage: {
    name: 'Persistent Dmg',
    icon: 'icons/svg/fire.svg',
    maxTier: 1,
    type: 'toggle',
    description: 'Take damage at end of every turn. DC 15 flat check to end it. Receiving healing grants an immediate extra flat check.',
    autoDecrement: false,
    buildChanges() {
      return [];
    }
  },

  blinded: {
    name: 'Blinded',
    icon: 'icons/svg/blind.svg',
    maxTier: 1,
    type: 'toggle',
    description: 'Cannot see. Loses DEX bonus to AC. All opponents have total concealment (50% miss chance). –4 penalty to STR/DEX-based skill checks. Automatically fails sight-based Perception checks.',
    autoDecrement: false,
    buildChanges() {
      return [
        { formula: '-2', operator: 'add', target: 'allAttack',   modifier: 'penalty', priority: 0 },
        { formula: '-4', operator: 'add', target: 'skills.per',  modifier: 'penalty', priority: 0 },
      ];
    }
  },

  deafened: {
    name: 'Deafened',
    icon: 'icons/svg/deaf.svg',
    maxTier: 1,
    type: 'toggle',
    description: 'Cannot hear. –4 penalty to initiative and Perception. 20% arcane spell failure on spells with verbal components. Automatically fails hearing-based Perception checks.',
    autoDecrement: false,
    buildChanges() {
      return [
        { formula: '-4', operator: 'add', target: 'skills.per',  modifier: 'penalty', priority: 0 },
        { formula: '-4', operator: 'add', target: 'init',        modifier: 'penalty', priority: 0 },
      ];
    }
  },

  nauseated: {
    name: 'Nauseated',
    icon: 'icons/svg/acid.svg',
    maxTier: 1,
    type: 'toggle',
    description: 'Can only take a single move action each turn. Cannot attack, cast spells, or concentrate. Cannot eat or drink (including potions).',
    autoDecrement: false,
    buildChanges() {
      return [
        { formula: '-20', operator: 'add', target: 'allAttack', modifier: 'penalty', priority: 0 },
      ];
    }
  },

  confused: {
    name: 'Confused',
    icon: 'icons/svg/daze.svg',
    maxTier: 1,
    type: 'toggle',
    description: 'Acts randomly each round: 01–25 act normally, 26–50 babble incoherently, 51–75 deal 1d8+STR to self, 76–100 attack nearest creature. Cannot make attacks of opportunity.',
    autoDecrement: false,
    buildChanges() {
      return [];
    }
  },

  paralyzed: {
    name: 'Paralyzed',
    icon: 'icons/svg/paralysis.svg',
    maxTier: 1,
    type: 'toggle',
    description: 'Cannot move, speak, or take any physical action. Helpless (effective DEX 0, –5 modifier). Melee attackers get +4 to hit. Vulnerable to coup de grace.',
    autoDecrement: false,
    buildChanges() {
      return [
        { formula: '-20', operator: 'add', target: 'dex', modifier: 'penalty', priority: 0 },
      ];
    }
  },
};

/* ----------------------------------------------------------
   BUFF MANAGEMENT
   ---------------------------------------------------------- */

function _buffName(condKey, tier) {
  const cond = CONDITIONS[condKey];
  if (cond.type === 'toggle') return cond.name;
  return `${cond.name} ${tier}`;
}

function _findExistingBuff(actor, condKey) {
  return actor.items.find(i =>
    i.type === 'buff' &&
    i.getFlag(MODULE_ID, 'conditionKey') === condKey
  );
}

async function applyCondition(actor, condKey, tier) {
  if (!actor || !CONDITIONS[condKey]) return;

  const cond = CONDITIONS[condKey];
  tier = Math.clamp(tier, 0, cond.maxTier);

  if (tier === 0) return removeCondition(actor, condKey);

  const existing = _findExistingBuff(actor, condKey);

  if (existing) {
    const changes = cond.buildChanges(tier);
    await existing.update({
      name: _buffName(condKey, tier),
      'system.changes': [],
      [`flags.${MODULE_ID}.tier`]: tier,
    });
    if (changes.length > 0) {
      await pf1.components.ItemChange.create(changes, { parent: existing });
    }
    if (!existing.system.active) {
      await existing.setActive(true);
    }
  } else {
    const changes = cond.buildChanges(tier);

    const descHtml = cond.type === 'tiered'
      ? `<p><strong>${cond.name} ${tier}:</strong> ${cond.description.replace(/–X/g, `–${tier}`).replace(/\bX\b/g, String(tier))}</p>`
      : `<p><strong>${cond.name}:</strong> ${cond.description}</p>`;

    const [created] = await actor.createEmbeddedDocuments('Item', [{
      img: cond.icon,
      name: _buffName(condKey, tier),
      type: 'buff',
      system: {
        subType: 'temp',
        description: { value: descHtml },
      },
      flags: {
        [MODULE_ID]: {
          conditionKey: condKey,
          tier: tier,
          autoDecrement: cond.autoDecrement,
          conditionType: cond.type,
        }
      }
    }]);

    if (changes.length > 0) {
      await pf1.components.ItemChange.create(changes, { parent: created });
    }
    await created.setActive(true);
  }

  // v2.34.0: Stunned countdown lifecycle — this is an EXTERNAL (re)application (GM UI tier
  // button, macro API `game.baphometConditions.apply`, or `adjustCondition`'s tier-up path —
  // never the internal decrement, which writes stunnedCountdown/removes the buff directly and
  // never calls back into applyCondition; see `_decrementStunnedCountdown`'s comment block).
  // (Re)initializes the countdown to the freshly-applied tier and stamps when this happened,
  // via a live (safe, non-hook-fire-time) read of game.combat. The stamp is compared against
  // the proactive breadcrumb at decrement time to implement the round-4 mid-turn-application
  // skip (SS5:224). stunnedCountdown is genuinely distinct from this buff's own `tier` flag
  // above, which stays at the originally-applied value (display/history only).
  if (condKey === 'stunned') {
    await actor.setFlag(MODULE_ID, 'stunnedCountdown', tier);
    await actor.setFlag(MODULE_ID, 'stunnedAppliedAt', {
      combatId: game.combat?.id ?? null,
      round:    game.combat?.round ?? null,
      turn:     game.combat?.turn ?? null,
    });
  }

  _postConditionChat(actor, cond, tier, 'apply');
}

async function removeCondition(actor, condKey) {
  const existing = _findExistingBuff(actor, condKey);

  // v2.34.0: clear the Stunned countdown lifecycle flags regardless of whether a buff was
  // found — defensive: no removal path (GM "X" button, adjustCondition reaching tier 0, or
  // _decrementStunnedCountdown's own zero-remainder cleanup) should leave a stale countdown
  // or stamp behind.
  if (condKey === 'stunned') {
    await actor.unsetFlag(MODULE_ID, 'stunnedCountdown');
    await actor.unsetFlag(MODULE_ID, 'stunnedAppliedAt');
  }

  if (!existing) return;

  const cond = CONDITIONS[condKey];
  await existing.delete();
  _postConditionChat(actor, cond, 0, 'remove');
}

async function adjustCondition(actor, condKey, delta) {
  const existing = _findExistingBuff(actor, condKey);
  const currentTier = existing?.getFlag(MODULE_ID, 'tier') ?? 0;
  const newTier = Math.max(0, currentTier + delta);
  return applyCondition(actor, condKey, newTier);
}

function _postConditionChat(actor, cond, tier, action) {
  const isRemove = action === 'remove';
  const color = isRemove ? 'var(--baph-success-bright, #5a9a5a)' : 'var(--baph-gold, #b8943e)';
  const label = isRemove
    ? `${cond.name} removed`
    : cond.type === 'toggle'
      ? `${cond.name}`
      : `${cond.name} ${tier}`;

  // v2.7.1: escape actor.name before interpolating into HTML.
  // cond.name, label, and cond.description are internal constants
  // and do not require escaping.
  const safeActorName = foundry.utils.escapeHTML(actor.name);

  ChatMessage.create({
    content: `<div style="font-family: var(--baph-font-heading, 'Courier Prime', monospace); text-transform: uppercase; letter-spacing: 0.05em; color: ${color}; font-size: 13px;">
      ${safeActorName} — ${label}
    </div>
    ${!isRemove ? `<div style="font-family: var(--baph-font-body, 'Alegreya', serif); color: var(--baph-text-secondary, #8a919d); font-size: 12px; margin-top: 2px;">
      ${cond.description.replace(/–X/g, `–${tier}`).replace(/\bX\b/g, String(tier))}
    </div>` : ''}`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

/* ----------------------------------------------------------
   UI: Token HUD Condition Panel
   ---------------------------------------------------------- */

function _buildConditionPanel(actor) {
  const panel = document.createElement('div');
  panel.classList.add('baph-condition-panel');

  const tieredHeader = document.createElement('div');
  tieredHeader.classList.add('baph-section-header');
  tieredHeader.textContent = 'Conditions';
  panel.appendChild(tieredHeader);

  const grid = document.createElement('div');
  grid.classList.add('baph-conditions-grid');

  const tieredLabel = document.createElement('div');
  tieredLabel.style.cssText = 'grid-column: 1 / -1; font-family: var(--baph-font-heading, monospace); font-size: 8px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--baph-text-muted, #5c6370); padding: 2px 0 1px; border-bottom: 1px solid var(--baph-border, #2a2f38);';
  tieredLabel.textContent = '— Tiered —';
  grid.appendChild(tieredLabel);

  for (const [key, cond] of Object.entries(CONDITIONS)) {
    if (cond.type !== 'tiered') continue;
    grid.appendChild(_buildTieredRow(actor, key, cond));
  }

  const toggleLabel = document.createElement('div');
  toggleLabel.style.cssText = tieredLabel.style.cssText;
  toggleLabel.textContent = '— Status —';
  grid.appendChild(toggleLabel);

  for (const [key, cond] of Object.entries(CONDITIONS)) {
    if (cond.type !== 'toggle') continue;
    grid.appendChild(_buildToggleRow(actor, key, cond));
  }

  panel.appendChild(grid);
  return panel;
}

function _buildTieredRow(actor, key, cond) {
  const existing = _findExistingBuff(actor, key);
  const currentTier = existing?.getFlag(MODULE_ID, 'tier') ?? 0;

  const row = document.createElement('div');
  row.classList.add('baph-condition-row');
  if (currentTier > 0) row.classList.add('active');

  const labelRow = document.createElement('div');
  labelRow.style.display = 'flex';
  labelRow.style.alignItems = 'center';

  const label = document.createElement('span');
  label.classList.add('baph-condition-label');
  label.textContent = cond.name;
  label.title = cond.description;
  labelRow.appendChild(label);

  if (cond.autoDecrement) {
    const indicator = document.createElement('span');
    indicator.classList.add('baph-auto-indicator');
    indicator.textContent = '↓';
    indicator.title = 'Auto-decrements at end of turn';
    labelRow.appendChild(indicator);
  }

  row.appendChild(labelRow);

  const tierGroup = document.createElement('div');
  tierGroup.classList.add('baph-tier-group');

  const btnRemove = document.createElement('button');
  btnRemove.classList.add('baph-tier-btn', 'baph-btn-remove');
  btnRemove.textContent = '✕';
  btnRemove.title = 'Remove';
  if (currentTier === 0) btnRemove.classList.add('disabled');
  btnRemove.addEventListener('click', async (e) => {
    e.stopPropagation();
    await removeCondition(actor, key);
    _refreshPanel(e.target);
  });
  tierGroup.appendChild(btnRemove);

  for (let t = 1; t <= cond.maxTier; t++) {
    const btn = document.createElement('button');
    btn.classList.add('baph-tier-btn');
    if (t === currentTier) btn.classList.add('selected');
    btn.textContent = String(t);
    btn.title = `${cond.name} ${t}`;
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await applyCondition(actor, key, t);
      _refreshPanel(e.target);
    });
    tierGroup.appendChild(btn);
  }

  row.appendChild(tierGroup);
  return row;
}

function _buildToggleRow(actor, key, cond) {
  const existing = _findExistingBuff(actor, key);
  const isActive = !!existing;

  const row = document.createElement('div');
  row.classList.add('baph-condition-row', 'baph-toggle-row');
  if (isActive) row.classList.add('active');

  const label = document.createElement('span');
  label.classList.add('baph-condition-label', 'baph-toggle-label');
  label.textContent = cond.name;
  label.title = cond.description;
  row.appendChild(label);

  const btn = document.createElement('button');
  btn.classList.add('baph-toggle-btn');
  if (isActive) btn.classList.add('active');
  btn.textContent = isActive ? 'ON' : 'OFF';
  btn.title = isActive ? `Remove ${cond.name}` : `Apply ${cond.name}`;
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (isActive) {
      await removeCondition(actor, key);
    } else {
      await applyCondition(actor, key, 1);
    }
    _refreshPanel(e.target);
  });

  row.appendChild(btn);
  return row;
}

function _refreshPanel(element) {
  const container = element.closest('.baph-condition-container');
  if (!container) return;
  const panel = container.querySelector('.baph-condition-panel');
  if (!panel) return;

  const actorId = container.dataset.actorId;
  const actor = game.actors.get(actorId);
  if (!actor) return;

  setTimeout(() => {
    const newPanel = _buildConditionPanel(actor);
    panel.replaceWith(newPanel);
  }, 100);
}

/* ----------------------------------------------------------
   HOOKS
   ---------------------------------------------------------- */

Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Initializing PF1.5 Condition Overlay v2.8`);
});

Hooks.once('ready', () => {
  _injectCorruptedEdgeFilter();

  game.baphometConditions = {
    apply: applyCondition,
    remove: removeCondition,
    adjust: adjustCondition,
    CONDITIONS,
    getTier(actor, condKey) {
      const buff = _findExistingBuff(actor, condKey);
      return buff?.getFlag(MODULE_ID, 'tier') ?? 0;
    },
    listActive(actor) {
      return actor.items
        .filter(i => i.type === 'buff' && i.getFlag(MODULE_ID, 'conditionKey'))
        .map(i => ({
          key: i.getFlag(MODULE_ID, 'conditionKey'),
          tier: i.getFlag(MODULE_ID, 'tier'),
          name: i.name,
          active: i.system.active,
        }));
    }
  };

  console.log(`${MODULE_ID} | PF1.5 Condition Overlay v2.8 ready.`);
  console.log(`${MODULE_ID} | API: game.baphometConditions.apply(actor, 'frightened', 3)`);
  console.log(`${MODULE_ID} | API: game.baphometConditions.adjust(actor, 'sickened', -1)`);
  console.log(`${MODULE_ID} | API: game.baphometConditions.remove(actor, 'clumsy')`);
});

// Token HUD button — v13 compatible
Hooks.on('renderTokenHUD', (hud, html, data) => {
  if (!game.user.isGM) return;

  const token = hud.object;
  const actor = token.actor;
  if (!actor) return;

  const hudElement = _baphNormalizeHtml(html);
  if (!hudElement) return;

  const btn = document.createElement('div');
  btn.classList.add('control-icon', 'baph-condition-hud-btn');
  btn.title = 'PF1.5 Conditions';
  btn.innerHTML = '<i class="fas fa-head-side-virus"></i>';

  // v2.6: hoist these to the outer closure so manual-close can
  // disconnect the observer (previously a closure-local that
  // leaked until the HUD itself mutated).
  let panelOpen = false;
  let panelContainer = null;
  let hudCloseObserver = null;

  const _teardown = () => {
    hudCloseObserver?.disconnect();
    hudCloseObserver = null;
    panelContainer?.remove();
    panelContainer = null;
    panelOpen = false;
  };

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (panelOpen && panelContainer) {
      _teardown();
      return;
    }

    panelContainer = document.createElement('div');
    panelContainer.classList.add('baph-condition-container');
    panelContainer.dataset.actorId = actor.id;
    panelContainer.appendChild(_buildConditionPanel(actor));

    const btnRect = btn.getBoundingClientRect();
    panelContainer.style.position = 'fixed';
    panelContainer.style.top = `${btnRect.top}px`;
    panelContainer.style.left = `${btnRect.left - 300}px`;
    panelContainer.style.zIndex = '1000';
    document.body.appendChild(panelContainer);

    for (const evt of ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup']) {
      panelContainer.addEventListener(evt, (ev) => ev.stopPropagation());
    }

    panelOpen = true;

    hudCloseObserver = new MutationObserver(() => {
      if (!document.contains(hudElement) || !hudElement.querySelector('.baph-condition-hud-btn')) {
        _teardown();
      }
    });
    hudCloseObserver.observe(hudElement.parentElement ?? document.body, { childList: true, subtree: true });
  });

  const rightCol = hudElement.querySelector('.col.right');
  if (rightCol) {
    rightCol.appendChild(btn);
  } else {
    console.warn(`${MODULE_ID} | Could not find .col.right in Token HUD`);
  }
});

/* ----------------------------------------------------------
   TRUST-4 — ACTIVE-GM GATE — v2.34.0

   Mirrors task-tracker.js's `_baphTaskIsActiveGMClient()` pattern
   (`game.user?.isGM && game.user === game.users?.activeGM`). Bare
   `game.user.isGM` passes for EVERY connected GM-role client
   simultaneously; with two GM-role clients connected, each independently
   running `_handleAutoDecrement` would double-decrement (or race) the
   same turn transition. Only the elected active GM client proceeds.
   task-tracker.js is not in this goal's allowlist, so this is a local
   equivalent rather than an import.
   ---------------------------------------------------------- */

function _isActiveGMClient() {
  return !!(game.user?.isGM && game.user === game.users?.activeGM);
}

/* ----------------------------------------------------------
   PROACTIVE BREADCRUMB READ — v2.34.0

   Two prior fix attempts derived "who is the prior (departing) combatant"
   REACTIVELY at combatTurn/combatRound/pf1PostTurnChange hook-fire time —
   first from `combat.current.turn`/`updateData.turn`, then from
   `combat.combatant` — and both were disproven by live two-seat
   re-verification in a 2-combatant alternating encounter: Foundry
   combat-state propagation is not guaranteed settled at the exact moment
   these hooks fire in this environment.

   Replaced with a read of `globalThis.baphometActiveCombatant`, a value
   STAMPED proactively by action-tracker.js's render-based turn-start
   detection (`_stampActiveCombatantBreadcrumb`, called from
   `_maybeResetForNewTurn` — see that file's header comment for the full
   rationale). That stamp point is already proven safe (it's the same
   `.active`-CSS-class / renderCombatTracker signal the v1.6 rewrite in
   that file trusts), and — critically — it fires only when the NEW
   combatant's turn starts, which happens AFTER these turn-transition
   hooks fire for the OLD (departing) combatant. So at the moment any of
   the three hooks below fire, the breadcrumb still holds the departing
   combatant, not the arriving one.

   Fail-safe (EXACTLY_ONE_OR_FAIL_OPEN precedent, this repo): returns null
   — no decrement performed — if the breadcrumb is missing or belongs to
   a different combat, rather than guessing.
   ---------------------------------------------------------- */

function _getBreadcrumbCombatant(combat) {
  const breadcrumb = globalThis.baphometActiveCombatant;
  if (!breadcrumb || !combat || breadcrumb.combatId !== combat.id) return null;
  return breadcrumb;
}

/* ----------------------------------------------------------
   STUNNED COUNTDOWN LIFECYCLE — v2.34.0

   Stunned is NOT a static per-turn tier like Slowed (SS5:224, SS5:268 —
   "lose X actions starting NEXT turn; if X exceeds 3, the remainder
   carries to subsequent turns"). Two ACTOR flags (MODULE_ID namespace)
   track it, deliberately separate from the Stunned buff's own `tier`
   flag (set in `applyCondition` above, which stays at the
   originally-applied value — display/history only, never read for
   action-loss math):

     stunnedCountdown  (number) — the actual remaining action-debt. Read
                                  directly and unconditionally by
                                  action-tracker.js's
                                  `_readConditionActionLoss` — no gate on
                                  whether the Stunned buff still exists,
                                  which sidesteps the exact race that
                                  broke an earlier design (the buff being
                                  deleted the same transition its tier
                                  was last needed).
     stunnedAppliedAt  ({combatId, round, turn} | null) — the combat
                                  identity/round/turn at which the
                                  countdown was last EXTERNALLY
                                  (re)initialized (GM UI apply/tier-adjust,
                                  macro API call — see `applyCondition`
                                  above). Captured via a live read of
                                  `game.combat` at the moment of
                                  application (a GM UI click, or a macro
                                  call) — safe because that read isn't
                                  tied to the volatile turn-transition
                                  update itself, unlike the disproven
                                  hook-fire-time reads described above.

   `_decrementStunnedCountdown` (called once per turn-transition for the
   DEPARTING combatant, from `_handleAutoDecrement`) pays down
   min(countdown, 3) — never more than one turn's 3-action pool — and
   removes the buff + both flags when the remainder reaches 0.

   Round-4 mid-turn-application-skip (SS5:224 "starting NEXT turn"): if
   Stunned is (re)applied to the CURRENTLY-ACTIVE combatant mid-turn, the
   turn-start pip lock in action-tracker.js already ran before the
   countdown existed, so no actions were actually lost that turn — paying
   down debt at that same turn's end would charge a loss that was never
   locked. Guarded by comparing `stunnedAppliedAt` against the PROACTIVE
   BREADCRUMB (`_getBreadcrumbCombatant`, above): if they name the SAME
   {combatId, round, turn}, the countdown was (re)initialized during the
   very turn that is now ending, so the pay-down is skipped for this one
   transition. Because the breadcrumb's round/turn always reflects
   whichever turn is currently ending, this self-resolves on the
   combatant's NEXT turn without any explicit clearing.

   Implementation-trap note (named explicitly in the goal): a naive
   design decrements by calling back into `applyCondition('stunned',
   remaining)`, which would re-stamp `stunnedAppliedAt` on every internal
   resync and skip every subsequent decrement forever. This function does
   NOT do that — it writes `stunnedCountdown` directly and calls
   `removeCondition` only at zero, never `applyCondition` — so
   `stunnedAppliedAt` is only ever written by the external path in
   `applyCondition`, and this trap does not apply to this implementation.
   ---------------------------------------------------------- */

async function _decrementStunnedCountdown(actor, breadcrumb) {
  if (!actor) return;

  const countdown = Number(actor.getFlag(MODULE_ID, 'stunnedCountdown')) || 0;
  if (countdown <= 0) return;

  const appliedAt = actor.getFlag(MODULE_ID, 'stunnedAppliedAt') ?? null;
  const sameTurn = !!(
    appliedAt && breadcrumb &&
    appliedAt.combatId === breadcrumb.combatId &&
    appliedAt.round === breadcrumb.round &&
    appliedAt.turn === breadcrumb.turn
  );

  if (sameTurn) {
    console.debug(`${MODULE_ID} | Stunned countdown: skip pay-down for ${actor.name} — countdown was (re)applied during the turn that just ended (round-4 mid-turn-skip guard)`);
    return;
  }

  const paidDown = Math.min(countdown, 3);
  const remaining = countdown - paidDown;
  console.debug(`${MODULE_ID} | Stunned countdown: ${actor.name} ${countdown} -> ${remaining} (paid down ${paidDown})`);

  if (remaining <= 0) {
    await removeCondition(actor, 'stunned'); // clears the buff + both lifecycle flags
  } else {
    await actor.setFlag(MODULE_ID, 'stunnedCountdown', remaining);
  }
}

/* ----------------------------------------------------------
   AUTO-DECREMENT — v2.5 REWRITE, v2.34.0 TRUST-4 + STUNNED COUNTDOWN
   ---------------------------------------------------------- */

const _decrementProcessed = new Set();

async function _handleAutoDecrement(combat, priorCombatantId, source, breadcrumb) {
  if (!_isActiveGMClient()) return;
  if (!priorCombatantId) {
    console.debug(`${MODULE_ID} | Auto-decrement (${source}): no prior combatant ID (breadcrumb missing/stale), skipping`);
    return;
  }

  const dedupeKey = `${combat.id}-${combat.round}-${combat.turn}-${priorCombatantId}`;
  if (_decrementProcessed.has(dedupeKey)) {
    console.debug(`${MODULE_ID} | Auto-decrement (${source}): already processed ${dedupeKey}, skipping duplicate`);
    return;
  }
  _decrementProcessed.add(dedupeKey);

  if (_decrementProcessed.size > 50) {
    const entries = [..._decrementProcessed];
    entries.slice(0, entries.length - 20).forEach(k => _decrementProcessed.delete(k));
  }

  const combatant = combat.combatants.get(priorCombatantId);
  if (!combatant?.actor) {
    console.debug(`${MODULE_ID} | Auto-decrement (${source}): combatant ${priorCombatantId} has no actor`);
    return;
  }

  const actor = combatant.actor;
  console.debug(`${MODULE_ID} | Auto-decrement (${source}): processing end-of-turn for ${actor.name}`);

  let decremented = false;
  for (const [key, cond] of Object.entries(CONDITIONS)) {
    if (!cond.autoDecrement) continue;
    if (key === 'stunned') continue; // v2.34.0: bespoke multi-action countdown, handled below — not a simple -1

    const buff = _findExistingBuff(actor, key);
    if (!buff) continue;

    const currentTier = buff.getFlag(MODULE_ID, 'tier') ?? 0;
    if (currentTier > 0) {
      console.debug(`${MODULE_ID} | Auto-decrement: ${actor.name} ${cond.name} ${currentTier} → ${currentTier - 1}`);
      await adjustCondition(actor, key, -1);
      decremented = true;
    }
  }

  await _decrementStunnedCountdown(actor, breadcrumb);

  if (!decremented) {
    console.debug(`${MODULE_ID} | Auto-decrement (${source}): ${actor.name} has no auto-decrement conditions active`);
  }
}

Hooks.on('pf1PostTurnChange', (combat, prior, current) => {
  console.debug(`${MODULE_ID} | Hook fired: pf1PostTurnChange`, { prior, current });

  const breadcrumb = _getBreadcrumbCombatant(combat);
  _handleAutoDecrement(combat, breadcrumb?.combatantId ?? null, 'pf1PostTurnChange', breadcrumb);
});

Hooks.on('combatTurn', (combat, updateData, updateOptions) => {
  console.debug(`${MODULE_ID} | Hook fired: combatTurn`, { turn: combat.current?.turn, round: combat.current?.round });

  const breadcrumb = _getBreadcrumbCombatant(combat);
  _handleAutoDecrement(combat, breadcrumb?.combatantId ?? null, 'combatTurn', breadcrumb);
});

Hooks.on('combatRound', (combat, updateData, updateOptions) => {
  console.debug(`${MODULE_ID} | Hook fired: combatRound`, { turn: combat.current?.turn, round: combat.current?.round });

  const breadcrumb = _getBreadcrumbCombatant(combat);
  _handleAutoDecrement(combat, breadcrumb?.combatantId ?? null, 'combatRound', breadcrumb);
});

/* ----------------------------------------------------------
   ORPHANED STUNNED FLAG CLEANUP — v2.34.0 round-2 FIX-1

   The Stunned countdown lifecycle above deliberately decouples
   stunnedCountdown/stunnedAppliedAt from the Stunned buff Item's own
   existence — action-tracker.js's `_readConditionActionLoss` reads
   stunnedCountdown UNCONDITIONALLY, with no gate on whether the buff Item
   still exists, to avoid re-opening the intra-transition race this design
   closed (see the STUNNED COUNTDOWN LIFECYCLE comment above). That
   decoupling means a direct Item deletion — a GM deleting the Stunned
   buff Item straight from the actor sheet, or any other path that
   deletes the Item without going through `removeCondition()` — would
   leave stunnedCountdown/stunnedAppliedAt orphaned on the actor: a
   "ghost" Stunned action-loss surviving the buff's own removal.

   `removeCondition()` (above) already clears both flags itself before it
   deletes the Item, so this hook exists to catch every OTHER deletion
   path. Rather than trying to distinguish those paths, it unsets the
   same two flags unconditionally whenever a Stunned buff Item (matched
   by `type === 'buff'` + `conditionKey === 'stunned'`, the existing
   pattern at `_findExistingBuff`/`applyCondition` above) is deleted, by
   any route. This is deliberately idempotent: when it fires as a
   side-effect of removeCondition's OWN delete, the flags are already
   unset and `unsetFlag` on an already-clear flag is a harmless no-op —
   so this cannot loop back into the lifecycle (no `applyCondition`,
   `removeCondition`, or Item-delete call happens from here).

   Gated through `_isActiveGMClient()` (TRUST-4, above) so two connected
   GM-role clients cannot both fire this cleanup redundantly or race a
   permission-limited flag write. Mirrors the confirmed in-repo
   `deleteItem` hook pattern at `action-tracker.js:1634`
   (`Hooks.on('deleteItem', (item) => _onBuffChangeForHasteBonus(item));`)
   — the only other `deleteItem` hook anywhere in this tree.
   ---------------------------------------------------------- */

function _onDeleteItemCleanupOrphanedStunnedFlags(item) {
  if (!_isActiveGMClient()) return;
  if (item?.type !== 'buff') return;
  if (item.getFlag(MODULE_ID, 'conditionKey') !== 'stunned') return;

  const actor = item.actor ?? item.parent;
  if (!actor) return;

  console.debug(`${MODULE_ID} | deleteItem: clearing any orphaned Stunned countdown flags for ${actor.name}`);
  actor.unsetFlag(MODULE_ID, 'stunnedCountdown');
  actor.unsetFlag(MODULE_ID, 'stunnedAppliedAt');
}
Hooks.on('deleteItem', (item) => _onDeleteItemCleanupOrphanedStunnedFlags(item));
