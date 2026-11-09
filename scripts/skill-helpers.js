/* ============================================================
   BAPHOMET UTILS — SKILL HELPERS v1.0
   Read-only PF1.5 skill table-rule helpers.

   v1.0 (module v2.21.0 — "Perception Class-Skill Audit Helper"):
   - game.baphometSkills.auditPerception({ post = true }):
     GM-only, READ-ONLY. Reports character actors whose Perception
     class-skill box (system.skills.per.cs) is unchecked. PF1.5
     table rule: Perception is a class skill for everyone.
     Advisory only — no actor writes, no auto-toggle, no enforcement.

   v2.49.0 (TD-100 (b), F-D-16): the audit no longer reads the DERIVED
   `cs` (the setting makes it true for everyone while ON, so the audit
   could report no one). It recomputes each character's NATIVE eligibility
   as pf1 does (class / race / feat items' `classSkills.per`, else the
   source `system.skills.per.cs`), reports the setting's state (`settingOn`)
   and heads its card with it. Still read-only and GM-only.

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
 * @returns {{ checked: number, unchecked: string[], total: number, settingOn: boolean }}
 */
function baphometAuditPerception({ post = true } = {}) {
  let settingOn = false;
  try { settingOn = game.settings.get(SKILLS_MODULE_ID, 'perceptionAlwaysClassSkill') === true; }
  catch (e) { settingOn = false; }

  if (!game.user?.isGM) {
    ui.notifications?.warn('Perception audit is GM-only.');
    return { checked: 0, unchecked: [], total: 0, settingOn };
  }

  const chars = game.actors.filter((a) => a.type === 'character');
  const unchecked = [];

  for (const actor of chars) {
    // Native eligibility, recomputed as pf1 does (v2.49.0): when any class,
    // race or feat item grants any skill, native is whether one of them grants
    // Perception; otherwise it is the actor's SOURCE `cs`. The derived `cs` is
    // never read (the setting overrides it while ON).
    const items = Array.from(actor.items ?? []).filter((i) => ['class', 'race', 'feat'].includes(i.type));
    const anyGrant = items.some((i) => Object.values(i.system?.classSkills ?? {}).some((v) => v === true));
    const native = anyGrant
      ? items.some((i) => i.system?.classSkills?.per === true)
      : actor._source?.system?.skills?.per?.cs === true;
    if (!native) unchecked.push(actor.name);
  }

  const total = chars.length;
  const checked = total - unchecked.length;

  if (post) {
    const stateLine = settingOn
      ? `<p>Setting ON — Perception is a class skill for every creature; the +3 is supplied for all of them.</p>`
      : `<p>Setting OFF — the characters listed roll Perception without the +3.</p>`;
    const content = `<p><strong>Perception class-skill audit</strong></p>` + stateLine + (unchecked.length
      ? `<p>${unchecked.length} of ${total} character(s) do not have Perception as a class skill of their own:</p>` +
        `<ul>${unchecked.map((n) => `<li>${foundry.utils.escapeHTML(n)}</li>`).join('')}</ul>`
      : `<p>All ${total} character(s) have Perception as a class skill of their own.</p>`);

    ChatMessage.create({
      content,
      speaker: { alias: 'Baphomet Skills' },
      whisper: game.users.filter((u) => u.isGM).map((u) => u.id),
    });
  }

  return { checked, unchecked, total, settingOn };
}

Hooks.once('ready', () => {
  game.baphometSkills = Object.assign(game.baphometSkills ?? {}, {
    auditPerception: baphometAuditPerception,
  });
  console.debug(
    `${SKILLS_MODULE_ID} | Skill Helpers v1.0 ready — game.baphometSkills.auditPerception()`
  );
});
