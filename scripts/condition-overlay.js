/* ============================================================
   ECHOES OF BAPHOMET — PF1.5 CONDITION OVERLAY v2
   Applies PF2e-style conditions as PF1e system Buffs.

   TIERED (1-4):  Frightened, Sickened, Stupefied, Clumsy,
                  Enfeebled, Drained, Stunned, Slowed, Fascinated
   TOGGLE (on/off): Fatigued, Off-Guard, Persistent Damage

   For Foundry VTT v13 + PF1e System
   Source: Homebrew_Master_File.md § Simplified Conditions
   ============================================================ */

const MODULE_ID = 'baphomet-utils';

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
        // Cascades to: Will save, spell DCs, mental skill checks
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
        // DEX penalty cascades to: Reflex, ranged/finesse attacks, DEX skills, AC
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
        // STR penalty cascades to: melee attack, STR damage, Fort, carry capacity
      ];
    }
  },

  drained: {
    name: 'Drained',
    icon: 'icons/svg/blood.svg',
    maxTier: 4,
    type: 'tiered',
    description: '–X penalty to CON-based checks, Fortitude saves, and Max HP reduced by X × character level. Decreases by 1 after a full night\'s rest.',
    autoDecrement: false, // Decrements on long rest, not per-turn — GM manages
    buildChanges(tier) {
      const v = String(-tier);
      return [
        { formula: v, operator: 'add', target: 'con', modifier: 'penalty', priority: 0 },
        // CON penalty cascades to: Fortitude, HP per level
        // NOTE: Max HP reduction (X × level) is a secondary effect.
        // The CON penalty handles most of it automatically since PF1e
        // recalculates HP from CON mod. For precise tracking, GM can
        // manually adjust HP on the token. The buff description reminds
        // the GM of the additional Max HP reduction.
      ];
    }
  },

  stunned: {
    name: 'Stunned',
    icon: 'icons/svg/stoned.svg',
    maxTier: 4,
    type: 'tiered',
    description: 'You lose X actions on your next turn. If Stunned exceeds 3, excess carries over to subsequent turns.',
    autoDecrement: true, // Value reduces as actions are lost
    buildChanges(_tier) {
      // Stunned removes actions — no numeric penalties to apply.
      // Buff serves as visible tracker. GM enforces action loss.
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
      // Slowed removes actions — no numeric penalties to apply.
      // Buff serves as visible tracker. GM enforces action loss.
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
        // Concentrate action restriction is GM-enforced
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
        // Using 'untyped' so it stacks with other AC penalties
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
      // No mechanical penalties — this is a reminder/tracker.
      // GM rolls DC 15 flat check at end of affected creature's turn.
      return [];
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

  // Tier 0 = remove
  if (tier === 0) return removeCondition(actor, condKey);

  const existing = _findExistingBuff(actor, condKey);

  if (existing) {
    // Update existing buff to new tier
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
    // Create new buff from system template
    const buffData = foundry.utils.duplicate(game.system.template.Item.buff);
    const changes = cond.buildChanges(tier);

    const descHtml = cond.type === 'tiered'
      ? `<p><strong>${cond.name} ${tier}:</strong> ${cond.description}</p>`
      : `<p><strong>${cond.name}:</strong> ${cond.description}</p>`;

    const newBuff = await Item.create({
      img: cond.icon,
      name: _buffName(condKey, tier),
      type: 'buff',
      system: {
        ...buffData,
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
    }, { temporary: true });

    const [created] = await actor.createEmbeddedDocuments('Item', [newBuff]);
    if (changes.length > 0) {
      await pf1.components.ItemChange.create(changes, { parent: created });
    }
    await created.setActive(true);
  }

  // Chat notification
  _postConditionChat(actor, cond, tier, 'apply');
}

async function removeCondition(actor, condKey) {
  const existing = _findExistingBuff(actor, condKey);
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

  ChatMessage.create({
    content: `<div style="font-family: var(--baph-font-heading, 'Oswald', sans-serif); text-transform: uppercase; letter-spacing: 0.05em; color: ${color}; font-size: 13px;">
      ${actor.name} — ${label}
    </div>
    ${!isRemove ? `<div style="font-family: var(--baph-font-body, 'Bitter', serif); color: var(--baph-text-secondary, #8a919d); font-size: 12px; margin-top: 2px;">
      ${cond.description}
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

  // Section: Tiered Conditions
  const tieredHeader = document.createElement('div');
  tieredHeader.classList.add('baph-section-header');
  tieredHeader.textContent = 'Tiered Conditions';
  panel.appendChild(tieredHeader);

  for (const [key, cond] of Object.entries(CONDITIONS)) {
    if (cond.type !== 'tiered') continue;
    panel.appendChild(_buildTieredRow(actor, key, cond));
  }

  // Section: Toggle Conditions
  const toggleHeader = document.createElement('div');
  toggleHeader.classList.add('baph-section-header');
  toggleHeader.textContent = 'Status Conditions';
  panel.appendChild(toggleHeader);

  for (const [key, cond] of Object.entries(CONDITIONS)) {
    if (cond.type !== 'toggle') continue;
    panel.appendChild(_buildToggleRow(actor, key, cond));
  }

  return panel;
}

function _buildTieredRow(actor, key, cond) {
  const existing = _findExistingBuff(actor, key);
  const currentTier = existing?.getFlag(MODULE_ID, 'tier') ?? 0;

  const row = document.createElement('div');
  row.classList.add('baph-condition-row');
  if (currentTier > 0) row.classList.add('active');

  // Label
  const label = document.createElement('span');
  label.classList.add('baph-condition-label');
  label.textContent = cond.name;
  label.title = cond.description;
  row.appendChild(label);

  // Auto-decrement indicator
  if (cond.autoDecrement) {
    const indicator = document.createElement('span');
    indicator.classList.add('baph-auto-indicator');
    indicator.textContent = '↓';
    indicator.title = 'Auto-decrements at end of turn';
    row.appendChild(indicator);
  }

  // Tier buttons
  const tierGroup = document.createElement('div');
  tierGroup.classList.add('baph-tier-group');

  // Remove button
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

  // Tier 1-max buttons
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

  // Label
  const label = document.createElement('span');
  label.classList.add('baph-condition-label', 'baph-toggle-label');
  label.textContent = cond.name;
  label.title = cond.description;
  row.appendChild(label);

  // Toggle button
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
  // Walk up to find the panel container, rebuild it
  const container = element.closest('.baph-condition-container');
  if (!container) return;
  const panel = container.querySelector('.baph-condition-panel');
  if (!panel) return;

  // Get the actor from the stored reference
  const actorId = container.dataset.actorId;
  const actor = game.actors.get(actorId);
  if (!actor) return;

  // Small delay to let Foundry process the document update
  setTimeout(() => {
    const newPanel = _buildConditionPanel(actor);
    panel.replaceWith(newPanel);
  }, 100);
}

/* ----------------------------------------------------------
   HOOKS
   ---------------------------------------------------------- */

Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Initializing PF1.5 Condition Overlay v2`);
});

Hooks.once('ready', () => {
  // Expose API for macros
  game.baphometConditions = {
    apply: applyCondition,
    remove: removeCondition,
    adjust: adjustCondition,
    CONDITIONS,
    // Convenience: get current tier of a condition on an actor
    getTier(actor, condKey) {
      const buff = _findExistingBuff(actor, condKey);
      return buff?.getFlag(MODULE_ID, 'tier') ?? 0;
    },
    // Convenience: list all active conditions on an actor
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

  console.log(`${MODULE_ID} | PF1.5 Condition Overlay v2 ready.`);
  console.log(`${MODULE_ID} | API: game.baphometConditions.apply(actor, 'frightened', 3)`);
  console.log(`${MODULE_ID} | API: game.baphometConditions.adjust(actor, 'sickened', -1)`);
  console.log(`${MODULE_ID} | API: game.baphometConditions.remove(actor, 'clumsy')`);
  console.log(`${MODULE_ID} | API: game.baphometConditions.getTier(actor, 'enfeebled')`);
  console.log(`${MODULE_ID} | API: game.baphometConditions.listActive(actor)`);
});

// Token HUD button
Hooks.on('renderTokenHUD', (hud, html, data) => {
  if (!game.user.isGM) return;

  const token = hud.object;
  const actor = token.actor;
  if (!actor) return;

  // Create the HUD button
  const btn = document.createElement('div');
  btn.classList.add('control-icon', 'baph-condition-hud-btn');
  btn.title = 'PF1.5 Conditions';
  btn.innerHTML = '<i class="fas fa-head-side-virus"></i>';

  let panelOpen = false;
  let panelContainer = null;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (panelOpen && panelContainer) {
      panelContainer.remove();
      panelContainer = null;
      panelOpen = false;
      return;
    }

    panelContainer = document.createElement('div');
    panelContainer.classList.add('baph-condition-container');
    panelContainer.dataset.actorId = actor.id;
    panelContainer.appendChild(_buildConditionPanel(actor));

    const hudElement = html[0] ?? html;
    hudElement.appendChild(panelContainer);
    panelOpen = true;
  });

  // Insert into Token HUD right column
  const rightCol = html[0]?.querySelector('.col.right') ?? html.find('.col.right')[0];
  if (rightCol) {
    rightCol.appendChild(btn);
  }
});

// Auto-decrement conditions at end of turn (Frightened, Stunned)
Hooks.on('pf1PostTurnChange', (combat, prior, current) => {
  if (!game.user.isGM) return;

  const priorCombatant = combat.combatants.get(prior.combatantId);
  if (!priorCombatant?.actor) return;

  const actor = priorCombatant.actor;

  for (const [key, cond] of Object.entries(CONDITIONS)) {
    if (!cond.autoDecrement) continue;

    const buff = _findExistingBuff(actor, key);
    if (!buff) continue;

    const currentTier = buff.getFlag(MODULE_ID, 'tier') ?? 0;
    if (currentTier > 0) {
      adjustCondition(actor, key, -1);
    }
  }
});

// Fallback: if pf1PostTurnChange doesn't exist, try the generic Foundry hook
Hooks.on('combatTurn', (combat, updateData, updateOptions) => {
  // Only fire if pf1PostTurnChange didn't handle it
  // We check by seeing if the PF1e hook exists
  if (Hooks.events['pf1PostTurnChange']?.length > 0) return;
  if (!game.user.isGM) return;

  const prevTurn = updateData.turn != null
    ? (updateData.turn === 0 ? combat.turns.length - 1 : updateData.turn - 1)
    : null;
  if (prevTurn == null) return;

  const priorCombatant = combat.turns[prevTurn];
  if (!priorCombatant?.actor) return;

  const actor = priorCombatant.actor;

  for (const [key, cond] of Object.entries(CONDITIONS)) {
    if (!cond.autoDecrement) continue;

    const buff = _findExistingBuff(actor, key);
    if (!buff) continue;

    const currentTier = buff.getFlag(MODULE_ID, 'tier') ?? 0;
    if (currentTier > 0) {
      adjustCondition(actor, key, -1);
    }
  }
});
