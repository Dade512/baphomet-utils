/* ============================================================
   BAPHOMET UTILS — SKILL HELPERS v1.0
   Read-only PF1.5 skill table-rule helpers.

   v1.0 (module v2.21.0 — "Perception Class-Skill Audit Helper"):
   - game.baphometSkills.auditPerception({ post = true }):
     GM-only, READ-ONLY. Reports character actors whose Perception
     class-skill box (system.skills.per.cs) is unchecked. PF1.5
     table rule: Perception is a class skill for everyone.
     Advisory only — no actor writes, no auto-toggle, no enforcement.

   Verified data path (PF1 11.11, live 2026-05-30):
     actor.system.skills.per.cs  (Boolean — true = class skill).
   Uses ChatMessage.create (same pattern as task-tracker.js) and
   console.debug (no console.log, per guardrail convention).
   ============================================================ */

const SKILLS_MODULE_ID = 'baphomet-utils';

/**
 * Audit character actors against the PF1.5 "Perception is a class skill for
 * everyone" table rule. READ-ONLY — never writes actor data and never toggles
 * the class-skill flag.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.post=true]  Post a GM-whispered chat summary.
 * @returns {{ checked: number, unchecked: string[], total: number }}
 */
function baphometAuditPerception({ post = true } = {}) {
  if (!game.user?.isGM) {
    ui.notifications?.warn('Perception audit is GM-only.');
    return { checked: 0, unchecked: [], total: 0 };
  }

  const chars = game.actors.filter((a) => a.type === 'character');
  const unchecked = [];

  for (const actor of chars) {
    const per = actor.system?.skills?.per;
    // Read-only: flag only an explicit unchecked class-skill box.
    if (per && per.cs === false) unchecked.push(actor.name);
  }

  const total = chars.length;
  const checked = total - unchecked.length;

  if (post) {
    const content = unchecked.length
      ? `<p><strong>Perception class-skill audit</strong></p>` +
        `<p>${unchecked.length} of ${total} character(s) have Perception <em>unchecked</em>:</p>` +
        `<ul>${unchecked.map((n) => `<li>${foundry.utils.escapeHTML(n)}</li>`).join('')}</ul>` +
        `<p>PF1.5 table rule: Perception is a class skill for everyone. ` +
        `Toggle it on each sheet manually (no automation).</p>`
      : `<p><strong>Perception class-skill audit</strong></p>` +
        `<p>All ${total} character(s) have Perception as a class skill. ✓</p>`;

    ChatMessage.create({
      content,
      speaker: { alias: 'Baphomet Skills' },
      whisper: game.users.filter((u) => u.isGM).map((u) => u.id),
    });
  }

  return { checked, unchecked, total };
}

Hooks.once('ready', () => {
  game.baphometSkills = Object.assign(game.baphometSkills ?? {}, {
    auditPerception: baphometAuditPerception,
  });
  console.debug(
    `${SKILLS_MODULE_ID} | Skill Helpers v1.0 ready — game.baphometSkills.auditPerception()`
  );
});
