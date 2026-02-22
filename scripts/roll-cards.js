/* ============================================================
   ECHOES OF BAPHOMET — ROLL CARD STYLER v1.0
   Chat message post-processing for Gaslamp Gothic roll cards.

   WHAT IT DOES:
   - Wraps the dice result line in a dark leather bar so the
     gold result number pops — restores the dramatic contrast
     lost in the Croaker's Ledger parchment pivot.
   - Detects nat 20 and nat 1 d20 results and adds CSS classes
     to the message element for special styling:
       .baph-nat20  → gold bar, near-black text
       .baph-nat1   → dried blood bar, parchment text
   - Adds a flavor label ("CRITICAL SUCCESS" / "CRITICAL FAIL")
     beneath nat results.

   SCOPE: Only processes messages that contain a dice roll
   (.dice-roll present). Ignores chat, whisper-only messages.

   HOOKS:
   - renderChatMessage — fires after each message renders.
     V13 compatible: html param handled as HTMLElement or jQuery.

   For Foundry VTT v13 + PF1e System
   ============================================================ */

const RC_MODULE_ID = 'baphomet-utils';

/* ----------------------------------------------------------
   NAT DETECTION
   Reads the rendered HTML for d20 dice results.
   PF1e renders individual die faces as:
     <li class="roll dX"> inside <ol class="dice-rolls">
   We look for a d20 roll (die value 1 or 20) within a
   .dice-formula that includes "d20".

   Returns: 'nat20' | 'nat1' | null
   ---------------------------------------------------------- */
function _detectNatResult(messageEl) {
  // Only care about messages with a dice roll
  const diceRoll = messageEl.querySelector('.dice-roll');
  if (!diceRoll) return null;

  // Check if this roll involves a d20
  const formula = messageEl.querySelector('.dice-formula');
  if (!formula) return null;

  const formulaText = formula.textContent ?? '';
  // Must contain d20 somewhere in the formula
  if (!formulaText.toLowerCase().includes('d20')) return null;

  // Find individual d20 die results
  // PF1e renders: <ol class="dice-rolls"><li class="roll d20">N</li>...
  const dieResults = messageEl.querySelectorAll('.dice-rolls .roll.d20');
  if (!dieResults.length) return null;

  for (const die of dieResults) {
    const val = parseInt(die.textContent?.trim(), 10);
    if (val === 20) return 'nat20';
    if (val === 1)  return 'nat1';
  }

  return null;
}

/* ----------------------------------------------------------
   RESULT BAR INJECTION
   Wraps the .dice-total element in a .baph-result-bar div
   that provides the dark leather strip background.
   Idempotent — won't double-wrap on re-renders.
   ---------------------------------------------------------- */
function _injectResultBar(messageEl) {
  const diceTotal = messageEl.querySelector('.dice-total');
  if (!diceTotal) return;

  // Already wrapped — skip
  if (diceTotal.closest('.baph-result-bar')) return;

  const bar = document.createElement('div');
  bar.classList.add('baph-result-bar');

  diceTotal.parentNode.insertBefore(bar, diceTotal);
  bar.appendChild(diceTotal);
}

/* ----------------------------------------------------------
   NAT LABEL INJECTION
   Adds a small flavor label beneath the result bar for
   nat 20 and nat 1. Idempotent.
   ---------------------------------------------------------- */
function _injectNatLabel(messageEl, natType) {
  // Don't add twice
  if (messageEl.querySelector('.baph-nat-label')) return;

  const bar = messageEl.querySelector('.baph-result-bar');
  if (!bar) return;

  const label = document.createElement('div');
  label.classList.add('baph-nat-label');

  if (natType === 'nat20') {
    label.classList.add('baph-nat20-label');
    label.textContent = '⚔ Critical Success';
  } else {
    label.classList.add('baph-nat1-label');
    label.textContent = '✖ Critical Failure';
  }

  bar.insertAdjacentElement('afterend', label);
}

/* ----------------------------------------------------------
   MAIN HOOK — renderChatMessage
   V13: html may be HTMLElement or jQuery — handle both.
   ---------------------------------------------------------- */
Hooks.on('renderChatMessage', (message, html, data) => {
  // Normalize to HTMLElement
  const el = html instanceof HTMLElement ? html
    : html instanceof jQuery        ? html[0]
    : null;
  if (!el) return;

  // Only process roll messages
  if (!el.querySelector('.dice-roll')) return;

  // Inject the dark result bar
  _injectResultBar(el);

  // Detect nat and apply classes + label
  const natType = _detectNatResult(el);
  if (natType === 'nat20') {
    el.classList.add('baph-nat20');
    _injectNatLabel(el, 'nat20');
  } else if (natType === 'nat1') {
    el.classList.add('baph-nat1');
    _injectNatLabel(el, 'nat1');
  }
});

/* ----------------------------------------------------------
   READY
   ---------------------------------------------------------- */
Hooks.once('ready', () => {
  console.log(`${RC_MODULE_ID} | Roll Card Styler v1.0 ready`);
});
